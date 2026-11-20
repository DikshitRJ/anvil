// anvil.inlineEdit: stream a rewrite of the selection into a live whole-file diff, then per-hunk review (ARCH §3.2).
import * as vscode from 'vscode';
import {
  buildInlinePrompt,
  extractPartialReplacement,
  extractReplacement,
  matchIndentation,
} from '../core/inline/prompt';
import type { CodeIndex } from '../core/context/codeIndex';
import type { AnvilSession } from '../trueforge/session';
import type { LiveReview, ReviewController } from './reviewController';
import { relativeInside } from './reviewModel';

export interface InlineEditDeps {
  review: ReviewController;
  getIndex(): CodeIndex | undefined;
  createSession(): AnvilSession;
  applyAccepted(path: string, before: string, after: string, summary: string): Promise<void>;
  log(msg: string): void;
  /** Notified when the model relay falls back (status bar, panel). */
  onModelSwitch?(from: string, to: string, reason: string): void;
}

let activeCancel: (() => void) | undefined;

// called by the host's anvil.cancel handler; true when an inline edit was running
export function cancelActiveInlineEdit(): boolean {
  if (!activeCancel) return false;
  activeCancel();
  return true;
}

const CONTEXT_CHAR_BUDGET = 8000; // ~2000 tokens

function lineSelection(editor: vscode.TextEditor, index: CodeIndex | undefined, rel: string): vscode.Range {
  const doc = editor.document;
  let startLine = editor.selection.start.line;
  let endLine = editor.selection.end.line;
  if (editor.selection.isEmpty) {
    const cursor = startLine + 1; // index symbol lines are 1-based
    const sym = index
      ?.symbolsOf(rel)
      .filter((s) => s.line <= cursor && cursor <= s.endLine && s.kind !== 'module')
      .sort((a, b) => a.endLine - a.line - (b.endLine - b.line))[0];
    if (sym) {
      startLine = sym.line - 1;
      endLine = Math.min(sym.endLine - 1, doc.lineCount - 1);
    }
  } else if (editor.selection.end.character === 0 && endLine > startLine) {
    endLine -= 1;
  }
  return new vscode.Range(startLine, 0, endLine, doc.lineAt(endLine).range.end.character);
}

function buildContext(index: CodeIndex | undefined, rel: string, selection: string): string {
  if (!index) return '';
  const names = new Set(selection.match(/[A-Za-z_][A-Za-z0-9_]{2,}/g) ?? []);
  const parts: string[] = [];
  let used = 0;
  for (const name of names) {
    const sym = index.findSymbol(name).find((s) => s.path !== rel || !selection.includes(s.signature));
    if (!sym) continue;
    const body = (index.getContent(sym.path) ?? '')
      .split('\n')
      .slice(sym.line - 1, sym.line + 5)
      .join('\n');
    const block = `// ${sym.path}:${sym.line}\n${body}`;
    if (used + block.length > CONTEXT_CHAR_BUDGET) break;
    parts.push(block);
    used += block.length;
  }
  return parts.join('\n\n');
}

interface Job {
  deps: InlineEditDeps;
  doc: vscode.TextDocument;
  rel: string;
  instruction: string;
  before: string;
  selection: string;
  after: string;
  original: string;
  version: number;
}

const stitch = (j: Job, replacement: string): string => j.before + matchIndentation(replacement, j.selection) + j.after;

function hooks(j: Job, live: LiveReview) {
  return {
    onEvent: (_e: unknown, view: { messages: { threadId: string; content: string }[] }): void => {
      const last = view.messages.filter((m) => m.threadId === 'main').pop();
      if (last) live.update(stitch(j, extractPartialReplacement(last.content)));
    },
    onApproval: async () => ({ allow: false as const, reason: 'Inline edit has no tools.' }),
    onModelSwitch: (from: string, to: string, reason: string): void => {
      j.deps.onModelSwitch?.(from, to, reason);
      void vscode.window.showWarningMessage(`Anvil: ${from} failed — falling back to ${to}`);
    },
    onRetry: (model: string, attempt: number, delayMs: number, reason: string): void =>
      j.deps.log(`inline retry ${attempt} on ${model} in ${delayMs}ms: ${reason}`),
  };
}

async function finishEdit(j: Job, live: LiveReview, output: string): Promise<void> {
  const r = await live.finish(stitch(j, extractReplacement(output)));
  if (r.content === null) return;
  if (j.doc.version !== j.version) {
    void vscode.window.showWarningMessage('Anvil: the file changed during generation; edit not applied.');
    return;
  }
  await j.deps.applyAccepted(j.rel, j.original, r.content, `inline edit: ${j.instruction}`);
  void vscode.window.showInformationMessage(`Anvil: applied ${r.accepted} of ${r.total} hunks`);
}

async function reportError(e: unknown): Promise<void> {
  const pick = await vscode.window.showErrorMessage(
    `Anvil: ${e instanceof Error ? e.message : String(e)}`,
    'Open Doctor',
  );
  if (pick === 'Open Doctor') await vscode.commands.executeCommand('anvil.doctor');
}

async function runJob(j: Job): Promise<void> {
  let session: AnvilSession;
  try {
    session = j.deps.createSession(); // may throw (no models configured): create before opening the review
  } catch (e) {
    activeCancel = undefined;
    void reportError(e);
    return;
  }
  const live = j.deps.review.openLive({
    path: j.rel,
    original: j.original,
    source: 'inline',
    title: `${j.rel} ↔ Anvil inline edit`,
  });
  let cancelled = false;
  const cancel = (): void => {
    cancelled = true;
    live.cancel();
    void session.cancel().catch(() => undefined);
  };
  activeCancel = cancel;
  void vscode.commands.executeCommand('setContext', 'anvil.running', true);
  try {
    const prompt = buildInlinePrompt({
      path: j.rel,
      languageId: j.doc.languageId,
      before: j.before,
      selection: j.selection,
      after: j.after,
      instruction: j.instruction,
      context: buildContext(j.deps.getIndex(), j.rel, j.selection),
    });
    const res = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Anvil inline edit', cancellable: true },
      (_p, token) => {
        token.onCancellationRequested(cancel);
        return session.run(prompt, hooks(j, live));
      },
    );
    if (cancelled || res.status === 'cancelled') {
      live.cancel();
      void vscode.window.setStatusBarMessage('Anvil: inline edit cancelled', 3000);
    } else if (res.status === 'error') {
      throw new Error(res.error ?? 'unknown error');
    } else {
      await finishEdit(j, live, res.output ?? '');
    }
  } catch (e) {
    live.cancel();
    // Never await the toast: it settles only when dismissed and would hold the inline-edit slot until then.
    if (!cancelled) void reportError(e);
  } finally {
    activeCancel = undefined;
    void vscode.commands.executeCommand('setContext', 'anvil.running', false);
    session.dispose();
  }
}

function workspaceRelative(doc: vscode.TextDocument): string | undefined {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  return root ? relativeInside(root, doc.uri.fsPath) : undefined;
}

async function askInstruction(): Promise<string | undefined> {
  activeCancel = () => undefined; // claim the slot while the prompt is open
  try {
    const v = await vscode.window.showInputBox({
      prompt: 'Anvil: describe the change',
      placeHolder: 'e.g. add error handling',
      ignoreFocusOut: true,
    });
    if (!v) activeCancel = undefined;
    return v;
  } catch (e) {
    activeCancel = undefined;
    throw e;
  }
}

async function inlineEdit(deps: InlineEditDeps): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.scheme !== 'file') return;
  if (activeCancel) {
    void vscode.window.showWarningMessage('Anvil: An inline edit is already running — press Esc to cancel it');
    return;
  }
  const doc = editor.document;
  const rel = workspaceRelative(doc);
  if (!rel) {
    void vscode.window.showWarningMessage('Anvil: Inline edit works on files inside the open folder');
    return;
  }
  const range = lineSelection(editor, deps.getIndex(), rel);
  const instruction = await askInstruction();
  if (!instruction) return;
  const original = doc.getText();
  const start = doc.offsetAt(range.start);
  const end = doc.offsetAt(range.end);
  await runJob({
    deps,
    doc,
    rel,
    instruction,
    before: original.slice(0, start),
    selection: original.slice(start, end),
    after: original.slice(end),
    original,
    version: doc.version,
  });
}

export function registerInlineEdit(context: vscode.ExtensionContext, deps: InlineEditDeps): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('anvil.inlineEdit', () => {
      void inlineEdit(deps).catch((e) => deps.log(`inline edit failed: ${String(e)}`));
    }),
  );
}
