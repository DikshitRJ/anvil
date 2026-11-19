// Pure (vscode-free) helpers for the panel: turn TurnView snapshots into protocol messages, summarise tool calls,
// and match @-mention queries.
import type { MessageView, ThreadView, ToolCallView, TurnView } from '../core/agent/events';
import type { SymbolInfo } from '../core/context/types';
import type { HostToWebview } from '../panel/protocol';

const RESULT_PREVIEW = 1500;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** One-line description of a tool call, e.g. `search_code "query"`, `read_file path:1-400`, `edit_file path`. */
export function summarizeTool(tool: string, input: Record<string, unknown>): string {
  const q = (s: string) => `"${s.length > 80 ? s.slice(0, 77) + '...' : s}"`;
  switch (tool) {
    case 'search_code':
      return `${tool} ${q(str(input.query))}`;
    case 'grep':
      return `${tool} ${q(str(input.pattern))}`;
    case 'find_symbol':
      return `${tool} ${str(input.name)}`;
    case 'read_file': {
      const range = input.start_line || input.end_line ? `:${input.start_line ?? 1}-${input.end_line ?? 'end'}` : '';
      return `${tool} ${str(input.path)}${range}`;
    }
    case 'edit_file':
    case 'write_file':
      return `${tool} ${str(input.path)}`;
    case 'run_command':
      return `${tool} ${q(str(input.command))}`;
    case 'list_files':
      return `${tool} ${str(input.path) || '.'}${input.pattern ? ' ' + str(input.pattern) : ''}`;
    case 'diagnostics':
      return input.path ? `${tool} ${str(input.path)}` : tool;
    default:
      return tool;
  }
}

export interface TurnSnapshot {
  messages: Map<string, string>;
  tools: Map<string, string>;
  threads: Map<string, string>;
}

export const emptySnapshot = (): TurnSnapshot => ({ messages: new Map(), tools: new Map(), threads: new Map() });

function toolSig(t: ToolCallView): string {
  return `${t.status}|${t.result?.length ?? -1}|${summarizeTool(t.tool, t.input)}`;
}

function toolMessage(runId: string, t: ToolCallView): HostToWebview {
  const call: Extract<HostToWebview, { type: 'tool' }>['call'] = {
    id: t.id,
    threadId: t.threadId,
    tool: t.tool,
    summary: summarizeTool(t.tool, t.input),
    status: t.status,
  };
  if (t.result !== undefined) call.result = t.result.slice(0, RESULT_PREVIEW);
  return { type: 'tool', runId, call };
}

const textMessage = (runId: string, m: MessageView): HostToWebview => ({
  type: 'text',
  runId,
  messageId: m.id,
  threadId: m.threadId,
  content: m.content,
});

const threadMessage = (runId: string, t: ThreadView): HostToWebview => ({
  type: 'thread',
  runId,
  thread: { id: t.id, title: t.title, status: t.status },
});

/** Compare `prev` with `view`; return only the messages for changed entries and update `prev` in place. */
export function diffTurn(runId: string, prev: TurnSnapshot, view: TurnView): HostToWebview[] {
  const out: HostToWebview[] = [];
  for (const t of view.threads) {
    const sig = `${t.title}|${t.status}`;
    if (prev.threads.get(t.id) !== sig) {
      prev.threads.set(t.id, sig);
      out.push(threadMessage(runId, t));
    }
  }
  for (const m of view.messages) {
    if (prev.messages.get(m.id) !== m.content) {
      prev.messages.set(m.id, m.content);
      out.push(textMessage(runId, m));
    }
  }
  for (const t of view.toolCalls) {
    const sig = toolSig(t);
    if (prev.tools.get(t.id) !== sig) {
      prev.tools.set(t.id, sig);
      out.push(toolMessage(runId, t));
    }
  }
  return out;
}

export interface MentionItem {
  kind: 'file' | 'symbol';
  label: string;
  detail: string;
  insert: string;
}

/** Lower is better; -1 = no match. Basename prefix beats basename substring beats path substring beats subsequence. */
export function fileScore(path: string, query: string): number {
  if (!query) return 4;
  const p = path.toLowerCase();
  const q = query.toLowerCase();
  const base = p.slice(p.lastIndexOf('/') + 1);
  if (base.startsWith(q)) return 0;
  if (base.includes(q)) return 1;
  if (p.includes(q)) return 2;
  let i = 0;
  for (const c of p) if (c === q[i]) i++;
  return i === q.length ? 3 : -1;
}

/** Top-N mention candidates: files first (ranked), then symbols matching the query. */
export function matchMentions(
  query: string,
  files: readonly string[],
  findSymbol: (prefix: string) => SymbolInfo[],
  limit = 20,
): MentionItem[] {
  const ranked = files
    .map((path) => ({ path, s: fileScore(path, query) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.path.length - b.path.length || a.path.localeCompare(b.path))
    .slice(0, limit)
    .map((x): MentionItem => ({ kind: 'file', label: x.path, detail: 'file', insert: `@${x.path}` }));
  const room = limit - ranked.length;
  if (room <= 0 || !query) return ranked;
  const seen = new Set<string>();
  const symbols: MentionItem[] = [];
  for (const s of findSymbol(query)) {
    if (symbols.length >= room) break;
    const key = `${s.name}@${s.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    symbols.push({ kind: 'symbol', label: s.name, detail: `${s.kind} · ${s.path}:${s.line}`, insert: `@#${s.name}` });
  }
  return [...ranked, ...symbols];
}

const IGNORED_SEGMENTS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  '.venv',
  'venv',
  '__pycache__',
  '.claude',
  'coverage',
]);

/** True when any path segment is in the default-ignored set (used by the index file watcher). */
export function isIgnoredPath(rel: string): boolean {
  return rel.split('/').some((s) => IGNORED_SEGMENTS.has(s));
}

/** Short outcome text for a review result. */
export function reviewOutcome(accepted: number, total: number, applied: boolean): string {
  if (!applied) return 'rejected';
  return accepted === total ? `accepted all ${total} hunk(s)` : `accepted ${accepted}/${total} hunks`;
}
