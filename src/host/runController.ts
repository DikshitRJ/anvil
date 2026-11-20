// Run controller: owns the chat AnvilSession, checkpoints and the active run; handles panel messages and
// implements WriteGate so the MCP bridge routes writes through review.
import * as vscode from 'vscode';
import type { TrueForge } from '@truefoundry/trueforge-sdk';
import { ModelRelay } from '../core/agent/fallback';
import { assembleContext, renderContextPack } from '../core/context/assemble';
import type { CodeIndex } from '../core/context/codeIndex';
import { parseMentions } from '../core/context/mentions';
import type { ContextSignals } from '../core/context/types';
import type { AnvilConfig } from '../core/config';
import { resolveInWorkspace, toRelative } from '../core/paths';
import { CheckpointStore, type RestoreReport } from '../core/transaction';
import type { WorkspaceHost, WriteGate } from '../mcp/server';
import type { HostToWebview, WebviewToHost } from '../panel/protocol';
import { AnvilSession, type RunHooks, type RunResult } from '../trueforge/session';
import type { AgentDefinition } from '../trueforge/spec';
import { ApprovalFlow } from './approvalFlow';
import type { CommandRunner } from './commandRunner';
import { VsCodeFileStore } from './fileStore';
import { diffTurn, emptySnapshot, matchMentions } from './panelEvents';
import type { ReviewController } from './reviewController';
import type { AnvilStatusBar } from './statusBar';

export interface RunDeps {
  root: string;
  getConfig(): AnvilConfig;
  getClient(): TrueForge;
  getAgents(): { coder: AgentDefinition; inline: AgentDefinition };
  getIndex(): { index: CodeIndex; ready: boolean };
  readFile: WorkspaceHost['readFile'];
  review: ReviewController;
  commands: CommandRunner;
  statusBar: AnvilStatusBar;
  post(msg: HostToWebview): void;
  initMessage(): HostToWebview;
  healthMessage(): HostToWebview;
  runDoctor(): void;
  log(msg: string): void;
}

interface ActiveRun {
  runId: string;
  cancelled: boolean;
}

export class RunController implements WriteGate {
  readonly checkpoints: CheckpointStore;
  private readonly fileStore: VsCodeFileStore;
  private readonly flow: ApprovalFlow;
  private session: AnvilSession | undefined;
  private active: ActiveRun | undefined;
  private readonly recent: string[] = [];

  constructor(private readonly d: RunDeps) {
    this.fileStore = new VsCodeFileStore(d.root);
    this.checkpoints = new CheckpointStore(this.fileStore);
    this.checkpoints.onChange(() => this.postChanges());
    this.flow = new ApprovalFlow({ ...d, runId: () => this.active?.runId });
  }

  get sessionId(): string | undefined {
    return this.session?.sessionId;
  }

  // ---- WriteGate ----
  isRunActive = (): boolean => !!this.active;
  resolveWrite: WriteGate['resolveWrite'] = (t, a, c, p) => this.flow.gate.resolveWrite(t, a, c, p);
  authorizeCommand: WriteGate['authorizeCommand'] = (a) => this.flow.gate.authorizeCommand(a);

  // ---- writes ----
  async applyWrite(rel: string, content: string, summary: string): Promise<void> {
    await this.writeAndRecord(this.active?.runId ?? 'manual', rel, content, summary);
  }

  async applyStandalone(path: string, _before: string, after: string, summary: string): Promise<void> {
    await this.writeAndRecord(`inline-${Date.now()}`, path, after, summary);
  }

  private async writeAndRecord(runId: string, rel: string, content: string, summary: string): Promise<void> {
    const before = await this.d.readFile(rel);
    await this.fileStore.write(rel, content);
    const after = (await this.d.readFile(rel)) ?? content; // post-save text (VS Code may normalise EOLs)
    this.checkpoints.record({ runId, path: rel, before, after, summary });
  }

  async runCommand(command: string, opts: { cwd?: string; timeoutMs: number }) {
    const cwd = resolveInWorkspace(this.d.root, opts.cwd ?? '.');
    return this.d.commands.run(command, { cwd, timeoutMs: opts.timeoutMs });
  }

  // ---- panel messages ----
  onPanelMessage(msg: WebviewToHost): void {
    switch (msg.type) {
      case 'ready':
        this.d.post(this.d.initMessage());
        this.d.post(this.d.healthMessage());
        this.postChanges();
        break;
      case 'send':
        void this.startRun(msg.text);
        break;
      case 'cancel':
        this.cancel();
        break;
      case 'newChat':
        this.newChat();
        break;
      case 'approve':
        this.flow.answer(msg.id, msg.allow);
        break;
      case 'mentionQuery':
        this.postMentions(msg.query);
        break;
      case 'openFile':
        void this.openFile(msg.path, msg.line);
        break;
      case 'openSession':
        void vscode.commands.executeCommand('anvil.openSession');
        break;
      case 'undoChange':
        void this.undo(msg.seq);
        break;
      case 'revertRun':
        void this.revertRun(msg.runId);
        break;
      case 'doctor':
        this.d.runDoctor();
        break;
      case 'notice-action':
        this.noticeAction(msg.action);
        break;
    }
  }

  private noticeAction(action: string): void {
    if (/settings/i.test(action)) void vscode.commands.executeCommand('workbench.action.openSettings', 'anvil.models');
    else if (/setup/i.test(action)) void vscode.commands.executeCommand('anvil.setup');
    else if (/doctor/i.test(action)) this.d.runDoctor();
  }

  private postMentions(query: string): void {
    const { index } = this.d.getIndex();
    const items = matchMentions(query, index.files(), (q) => index.findSymbol(q));
    this.d.post({ type: 'mentionResults', query, items });
  }

  private async openFile(rel: string, line?: number): Promise<void> {
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(`${this.d.root}/${rel}`));
      const at = new vscode.Position(Math.max(0, (line ?? 1) - 1), 0);
      await vscode.window.showTextDocument(doc, { selection: new vscode.Range(at, at) });
    } catch (e) {
      this.d.log(`openFile ${rel}: ${String(e)}`);
    }
  }

  postChanges(): void {
    const changes = this.checkpoints
      .list()
      .map((c) => ({ seq: c.seq, runId: c.runId, path: c.path, summary: c.summary, at: c.at }));
    this.d.post({ type: 'changes', changes });
  }

  notice(level: 'info' | 'warn' | 'error', message: string, actions?: string[], runId?: string): void {
    this.d.post({ type: 'notice', level, message, ...(actions ? { actions } : {}), ...(runId ? { runId } : {}) });
  }

  trackSaved(rel: string): void {
    const i = this.recent.indexOf(rel);
    if (i >= 0) this.recent.splice(i, 1);
    this.recent.unshift(rel);
    this.recent.length = Math.min(this.recent.length, 10);
  }

  // ---- runs ----
  async startRun(text: string): Promise<void> {
    if (this.active) return this.notice('warn', 'A run is already in progress. Cancel it first.');
    const cfg = this.d.getConfig();
    if (cfg.models.length === 0)
      return this.notice('error', 'No models configured. Set anvil.models.', ['Open Settings']);
    const runId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    this.active = { runId, cancelled: false };
    void vscode.commands.executeCommand('setContext', 'anvil.running', true);
    this.d.statusBar.setRunning(true);
    try {
      await this.execute(runId, text, cfg);
    } finally {
      this.active = undefined;
      void vscode.commands.executeCommand('setContext', 'anvil.running', false);
      this.d.statusBar.setRunning(false);
    }
  }

  private async execute(runId: string, text: string, cfg: AnvilConfig): Promise<void> {
    const input = this.buildInput(runId, text, cfg);
    let result: RunResult;
    try {
      this.session ??= this.newSession(this.d.getAgents().coder, cfg, text.slice(0, 60));
      result = await this.session.run(input, this.hooks(runId));
    } catch (e) {
      result = { status: 'error', model: cfg.models[0] ?? '', error: e instanceof Error ? e.message : String(e) };
    }
    this.d.post({ type: 'runFinished', runId, status: result.status, model: result.model, ...optional(result) });
    if (result.status === 'error') this.notice('error', result.error ?? 'Run failed', ['Run Doctor'], runId);
    if (result.status === 'cancelled' && cfg.cancelBehavior === 'revert') await this.revertAfterCancel(runId);
  }

  private async revertAfterCancel(runId: string): Promise<void> {
    const report = await this.checkpoints.revertRun(runId);
    const conflicts = report.conflicts.length ? ` (changed since, left alone: ${report.conflicts.join(', ')})` : '';
    this.notice('info', `Run cancelled — restored ${report.restored.length} file(s)${conflicts}`, undefined, runId);
  }

  newSession(agent: AgentDefinition, cfg: AnvilConfig, title: string): AnvilSession {
    return new AnvilSession({
      client: this.d.getClient(),
      agent,
      relay: new ModelRelay({ models: cfg.models, retriesPerModel: cfg.retriesPerModel, backoffMs: [500, 1500, 4000] }),
      stallTimeoutMs: cfg.stallTimeoutSec * 1000,
      title,
    });
  }

  private buildInput(runId: string, text: string, cfg: AnvilConfig): string {
    const { index, ready } = this.d.getIndex();
    this.d.post({ type: 'runStarted', runId, prompt: text });
    if (!ready) this.notice('info', 'Index still building — context may be incomplete.', undefined, runId);
    const { mentions, cleaned } = parseMentions(text, new Set(index.files()));
    const pack = assembleContext(index, { query: cleaned, mentions, ...this.signals() }, cfg.contextBudget);
    this.d.post({
      type: 'context',
      runId,
      items: pack.items.map((i) => ({
        path: i.path,
        ...(i.startLine !== undefined ? { startLine: i.startLine } : {}),
        ...(i.endLine !== undefined ? { endLine: i.endLine } : {}),
        kind: i.kind,
        reason: i.reason,
        tokens: i.tokens,
      })),
      budget: pack.budget,
      used: pack.used,
      dropped: pack.dropped.length,
    });
    return `${cleaned}\n\n${renderContextPack(pack)}`;
  }

  private signals(): Omit<ContextSignals, 'query' | 'mentions'> {
    const under = (u: vscode.Uri): string | undefined => {
      if (u.scheme !== 'file') return undefined;
      const rel = toRelative(this.d.root, u.fsPath);
      return rel.startsWith('..') ? undefined : rel;
    };
    const ed = vscode.window.activeTextEditor;
    const activeFile = ed ? under(ed.document.uri) : undefined;
    const sel = ed && activeFile && !ed.selection.isEmpty ? ed.selection : undefined;
    const openFiles = vscode.window.tabGroups.all
      .flatMap((g) => g.tabs)
      .flatMap((t) => (t.input instanceof vscode.TabInputText ? [under(t.input.uri)] : []))
      .filter((p): p is string => !!p);
    return {
      ...(activeFile ? { activeFile } : {}),
      ...(sel && ed && activeFile
        ? {
            selection: {
              path: activeFile,
              startLine: sel.start.line + 1,
              endLine: sel.end.line + 1,
              text: ed.document.getText(sel),
            },
          }
        : {}),
      openFiles,
      recentFiles: [...this.recent],
    };
  }

  private hooks(runId: string): RunHooks {
    const snap = emptySnapshot();
    return {
      onEvent: (_e, view) => diffTurn(runId, snap, view).forEach((m) => this.d.post(m)),
      onApproval: ({ call }) => this.flow.onApproval(call),
      onModelSwitch: (from, to, reason) => {
        this.d.post({ type: 'modelSwitch', runId, from, to, reason });
        this.d.statusBar.setModel(to);
        void vscode.window.showWarningMessage(`Anvil switched model ${from} → ${to}: ${reason}`);
      },
      onRetry: (model, attempt, delayMs, reason) =>
        this.notice(
          'info',
          `Retrying ${model} (attempt ${attempt}) in ${Math.round(delayMs)} ms: ${reason}`,
          undefined,
          runId,
        ),
      beforeRetry: async () => {
        await this.checkpoints.revertRun(runId);
      },
      onQuestion: async (question, options) => {
        if (options.length) return (await vscode.window.showQuickPick(options, { title: question })) ?? '';
        return (await vscode.window.showInputBox({ title: question })) ?? '';
      },
    };
  }

  cancel(): boolean {
    if (!this.active) return false;
    this.active.cancelled = true;
    void this.session?.cancel().catch((e) => this.d.log(`cancel: ${String(e)}`));
    this.d.review.cancelAll('Run cancelled');
    this.d.commands.killAll();
    this.flow.rejectAllPending();
    return true;
  }

  newChat(): void {
    this.cancel();
    this.session?.dispose();
    this.session = undefined;
    this.flow.clear();
  }

  /** Called when settings change: drop the chat session so the next run uses the new model chain / URL. */
  resetSessionIfIdle(): void {
    if (this.active) return;
    this.session?.dispose();
    this.session = undefined;
  }

  // ---- undo / revert with conflict prompt ----
  async undo(seq: number): Promise<void> {
    await this.restoreWithPrompt((force) => this.checkpoints.undo(seq, { force }));
  }

  async undoLast(): Promise<void> {
    const last = this.checkpoints.list().at(-1);
    if (!last) return void vscode.window.showInformationMessage('Anvil: nothing to undo.');
    await this.undo(last.seq);
  }

  async revertRun(runId: string): Promise<void> {
    await this.restoreWithPrompt((force) => this.checkpoints.revertRun(runId, { force }));
  }

  private async restoreWithPrompt(op: (force: boolean) => Promise<RestoreReport>): Promise<void> {
    const report = await op(false);
    if (report.conflicts.length === 0) return;
    const pick = await vscode.window.showWarningMessage(
      `File changed since — restore anyway? ${report.conflicts.join(', ')}`,
      'Restore anyway',
    );
    if (pick) await op(true);
  }

  dispose(): void {
    this.cancel();
    this.session?.dispose();
  }
}

function optional(r: RunResult): Partial<Extract<HostToWebview, { type: 'runFinished' }>> {
  return {
    ...(r.error !== undefined ? { error: r.error } : {}),
    ...(r.sessionId !== undefined ? { sessionId: r.sessionId } : {}),
    ...(r.metrics !== undefined ? { metrics: r.metrics } : {}),
  };
}
