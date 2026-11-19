// Per-hunk review UI (D-013): native diff editor + CodeLens Accept/Reject per hunk. Never writes to disk.
import * as vscode from 'vscode';
import type { HunkDecision } from '../core/diff/hunks';
import { ReviewModel } from './reviewModel';
import type { ReviewOutcome } from './reviewModel';

export interface ReviewRequest {
  path: string;
  original: string;
  proposed: string;
  title?: string;
  source: 'agent' | 'inline';
}
export interface ReviewResult {
  content: string | null;
  accepted: number;
  total: number;
  feedback: string;
}
export class ReviewCancelledError extends Error {}
export interface LiveReview {
  update(proposed: string): void;
  finish(finalProposed: string): Promise<ReviewResult>;
  cancel(): void;
}

const ORIGINAL = 'anvil-original';
const PROPOSED = 'anvil-proposed';
const THROTTLE_MS = 100;

interface Session {
  id: number;
  req: Omit<ReviewRequest, 'proposed'>;
  model?: ReviewModel; // undefined while the proposal is still streaming
  streamText: string;
  opened: boolean;
  closing: boolean;
  cancelled: boolean;
  settle?: { resolve(r: ReviewResult): void; reject(e: Error): void };
  originalUri: vscode.Uri;
  proposedUri: vscode.Uri;
}

const reviewId = (uri: vscode.Uri): number => Number(new URLSearchParams(uri.query).get('review'));
const truncate = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export class ReviewController implements vscode.Disposable {
  private nextId = 1;
  private readonly sessions = new Map<number, Session>();
  private readonly queue: Session[] = [];
  private current: Session | undefined;
  private readonly changed = new vscode.EventEmitter<vscode.Uri>();
  private readonly lensChanged = new vscode.EventEmitter<void>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly acceptedDeco = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor('diffEditor.insertedTextBackground'),
  });
  private readonly rejectedDeco = vscode.window.createTextEditorDecorationType({ isWholeLine: true, opacity: '0.5' });
  private lastFire = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(_context: vscode.ExtensionContext) {
    const d = this.disposables;
    d.push(this.changed, this.lensChanged, this.acceptedDeco, this.rejectedDeco);
    d.push(
      vscode.workspace.registerTextDocumentContentProvider(ORIGINAL, {
        provideTextDocumentContent: (u) => this.sessions.get(reviewId(u))?.req.original ?? '',
      }),
    );
    d.push(
      vscode.workspace.registerTextDocumentContentProvider(PROPOSED, {
        onDidChange: this.changed.event,
        provideTextDocumentContent: (u) => this.contentOf(this.sessions.get(reviewId(u))),
      }),
    );
    d.push(
      vscode.languages.registerCodeLensProvider(
        { scheme: PROPOSED },
        { onDidChangeCodeLenses: this.lensChanged.event, provideCodeLenses: (doc) => this.lenses(doc) },
      ),
    );
    d.push(vscode.window.onDidChangeVisibleTextEditors(() => this.decorate()));
    d.push(vscode.window.tabGroups.onDidChangeTabs(() => this.onTabsChanged()));
    this.registerCommands();
  }

  get pendingCount(): number {
    return this.sessions.size;
  }

  review(req: ReviewRequest): Promise<ReviewResult> {
    const s = this.newSession(req);
    s.model = new ReviewModel(req.original, req.proposed);
    if (s.model.total === 0) return Promise.resolve(s.model.outcome());
    return this.enqueue(s);
  }

  openLive(req: Omit<ReviewRequest, 'proposed'>): LiveReview {
    const s = this.newSession(req);
    this.sessions.set(s.id, s);
    this.queue.push(s);
    this.showNext();
    return {
      update: (p) => {
        s.streamText = p;
        this.throttledFire(s);
      },
      finish: (finalProposed) => this.finishLive(s, finalProposed),
      cancel: () => this.cancelSession(s, new ReviewCancelledError('cancelled')),
    };
  }

  cancelAll(reason: string): void {
    for (const s of [...this.sessions.values()]) this.cancelSession(s, new ReviewCancelledError(reason));
  }

  dispose(): void {
    this.cancelAll('disposed');
    if (this.timer) clearTimeout(this.timer);
    this.disposables.forEach((x) => x.dispose());
  }

  // ---- session lifecycle ----

  private newSession(req: Omit<ReviewRequest, 'proposed'>): Session {
    const id = this.nextId++;
    const path = '/' + req.path.replace(/^\/+/, '');
    const q = `review=${id}`;
    const { proposed: _p, ...rest } = req as ReviewRequest;
    return {
      id,
      req: rest,
      streamText: req.original,
      opened: false,
      closing: false,
      cancelled: false,
      originalUri: vscode.Uri.from({ scheme: ORIGINAL, path, query: q }),
      proposedUri: vscode.Uri.from({ scheme: PROPOSED, path, query: q }),
    };
  }

  private enqueue(s: Session): Promise<ReviewResult> {
    return new Promise((resolve, reject) => {
      s.settle = { resolve, reject };
      this.sessions.set(s.id, s);
      this.queue.push(s);
      this.showNext();
    });
  }

  private finishLive(s: Session, finalProposed: string): Promise<ReviewResult> {
    if (s.cancelled) return Promise.reject(new ReviewCancelledError('cancelled'));
    s.model = new ReviewModel(s.req.original, finalProposed);
    return new Promise((resolve, reject) => {
      s.settle = { resolve, reject };
      if (s.model!.total === 0) return this.complete(s);
      this.changed.fire(s.proposedUri);
      this.lensChanged.fire();
      this.decorate();
    });
  }

  private showNext(): void {
    if (this.current || this.queue.length === 0) return;
    const s = this.queue.shift()!;
    this.current = s;
    void vscode.commands.executeCommand('setContext', 'anvil.reviewing', true);
    const title = s.req.title ?? `${s.req.path.split('/').pop()} ↔ Anvil proposal (${s.req.source})`;
    void Promise.resolve(
      vscode.commands.executeCommand('vscode.diff', s.originalUri, s.proposedUri, title, { preview: false }),
    ).then(() => {
      s.opened = true;
      this.decorate();
    });
  }

  private complete(s: Session): void {
    const outcome: ReviewOutcome = s.model!.outcome();
    this.finalize(s);
    s.settle?.resolve(outcome);
  }

  private cancelSession(s: Session, err: Error): void {
    if (!this.sessions.has(s.id)) return;
    s.cancelled = true;
    this.finalize(s);
    s.settle?.reject(err);
  }

  // remove from state, close its tab, advance the queue
  private finalize(s: Session): void {
    s.closing = true;
    this.sessions.delete(s.id);
    const qi = this.queue.indexOf(s);
    if (qi >= 0) this.queue.splice(qi, 1);
    if (this.current === s) {
      this.current = undefined;
      void vscode.commands.executeCommand('setContext', 'anvil.reviewing', false);
    }
    void this.closeTab(s);
    this.showNext();
  }

  private async closeTab(s: Session): Promise<void> {
    const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
    const tab = tabs.find(
      (t) => t.input instanceof vscode.TabInputTextDiff && t.input.modified.toString() === s.proposedUri.toString(),
    );
    if (tab) await vscode.window.tabGroups.close(tab);
  }

  // user closed the diff tab by hand during decision mode: treat pending hunks as rejected
  private onTabsChanged(): void {
    const s = this.current;
    if (!s || !s.opened || s.closing || !s.model) return;
    const open = vscode.window.tabGroups.all.some((g) =>
      g.tabs.some(
        (t) => t.input instanceof vscode.TabInputTextDiff && t.input.modified.toString() === s.proposedUri.toString(),
      ),
    );
    if (open) return;
    for (const h of s.model.hunks) if (s.model.decisionOf(h.id) === 'pending') s.model.decide(h.id, 'rejected');
    this.complete(s);
  }

  // ---- content, lenses, decorations ----

  private contentOf(s: Session | undefined): string {
    if (!s) return '';
    return s.model ? s.model.preview() : s.streamText;
  }

  private throttledFire(s: Session): void {
    const fire = (): void => {
      this.lastFire = Date.now();
      this.timer = undefined;
      this.changed.fire(s.proposedUri);
    };
    const wait = THROTTLE_MS - (Date.now() - this.lastFire);
    if (wait <= 0) return fire();
    this.timer ??= setTimeout(fire, wait);
  }

  private lenses(doc: vscode.TextDocument): vscode.CodeLens[] {
    const s = this.sessions.get(reviewId(doc.uri));
    const top = new vscode.Range(0, 0, 0, 0);
    if (!s) return [];
    if (!s.model) return [new vscode.CodeLens(top, { title: '$(sync~spin) Anvil is writing…', command: '' })];
    const m = s.model;
    const lens = (line: number, title: string, command = '', args: unknown[] = []): vscode.CodeLens => {
      const l = Math.min(line, Math.max(doc.lineCount - 1, 0));
      return new vscode.CodeLens(new vscode.Range(l, 0, l, 0), { title, command, arguments: args });
    };
    const out = [
      lens(0, 'Accept all', 'anvil.review.acceptAll', [s.id]),
      lens(0, 'Reject all', 'anvil.review.rejectAll', [s.id]),
      lens(0, `$(info) ${m.decidedCount} of ${m.total} decided`),
    ];
    for (const a of m.anchors()) out.push(...this.hunkLenses(s, a.hunkId, a.line, lens));
    return out;
  }

  private hunkLenses(
    s: Session,
    id: number,
    line: number,
    lens: (l: number, t: string, c?: string, a?: unknown[]) => vscode.CodeLens,
  ): vscode.CodeLens[] {
    const m = s.model!;
    const h = m.hunks.find((x) => x.id === id)!;
    const label = `Hunk ${id + 1}/${m.total}`;
    const d = m.decisionOf(id);
    if (d === 'accepted') return [lens(line, `✓ accepted — click to undo`, 'anvil.review.undoHunk', [s.id, id])];
    if (d === 'rejected') return [lens(line, `✗ rejected — click to undo`, 'anvil.review.undoHunk', [s.id, id])];
    const del = h.newLines.length === 0 ? ` (deletes: ${truncate(h.origLines.join(' ⏎ '), 50)})` : '';
    return [
      lens(line, '$(check) Accept', 'anvil.review.acceptHunk', [s.id, id]),
      lens(line, '$(close) Reject', 'anvil.review.rejectHunk', [s.id, id]),
      lens(line, label + del),
    ];
  }

  private decorate(): void {
    for (const ed of vscode.window.visibleTextEditors) {
      if (ed.document.uri.scheme !== PROPOSED) continue;
      const s = this.sessions.get(reviewId(ed.document.uri));
      const acc: vscode.Range[] = [];
      const rej: vscode.Range[] = [];
      for (const a of s?.model?.anchors() ?? []) {
        const d = s!.model!.decisionOf(a.hunkId);
        if (a.span === 0 || d === 'pending') continue;
        (d === 'accepted' ? acc : rej).push(new vscode.Range(a.line, 0, a.line + a.span - 1, 0));
      }
      ed.setDecorations(this.acceptedDeco, acc);
      ed.setDecorations(this.rejectedDeco, rej);
    }
  }

  // ---- commands ----

  private decide(
    s: Session | undefined,
    hunkId: number | undefined,
    d: HunkDecision | 'all-accepted' | 'all-rejected',
  ): void {
    const m = s?.model;
    if (!s || !m) return;
    if (d === 'all-accepted' || d === 'all-rejected') m.decideAll(d === 'all-accepted' ? 'accepted' : 'rejected');
    else if (hunkId === undefined || !m.decide(hunkId, d)) return;
    this.changed.fire(s.proposedUri);
    this.lensChanged.fire();
    this.decorate();
    if (m.allDecided) this.complete(s);
  }

  // explicit [reviewId, hunkId] args, or the active anvil-proposed editor (hunk at the cursor)
  private target(args: unknown[], needHunk: boolean): { s?: Session; hunkId?: number } {
    if (typeof args[0] === 'number') return { s: this.sessions.get(args[0]), hunkId: args[1] as number | undefined };
    const ed = vscode.window.activeTextEditor;
    if (!ed || ed.document.uri.scheme !== PROPOSED) return {};
    const s = this.sessions.get(reviewId(ed.document.uri));
    return { s, hunkId: needHunk ? s?.model?.hunkAtLine(ed.selection.active.line) : undefined };
  }

  private registerCommands(): void {
    const reg = (name: string, needHunk: boolean, d: HunkDecision | 'all-accepted' | 'all-rejected'): void => {
      this.disposables.push(
        vscode.commands.registerCommand(name, (...args: unknown[]) => {
          const t = this.target(args, needHunk);
          this.decide(t.s, t.hunkId, d);
        }),
      );
    };
    reg('anvil.review.acceptHunk', true, 'accepted');
    reg('anvil.review.rejectHunk', true, 'rejected');
    reg('anvil.review.acceptAll', false, 'all-accepted');
    reg('anvil.review.rejectAll', false, 'all-rejected');
    reg('anvil.review.undoHunk', true, 'pending');
  }
}
