// Pure panel state reducer: folds host->webview messages into PanelState (no DOM access).
import type { HostToWebview } from '../src/panel/protocol';

type Msg<T extends HostToWebview['type']> = Extract<HostToWebview, { type: T }>;

export interface ContextCard {
  items: Msg<'context'>['items'];
  budget: number;
  used: number;
  dropped: number;
}
export interface ThreadInfo {
  id: string;
  title: string;
  status: string;
}
export type Entry =
  | { kind: 'text'; key: string; threadId: string; messageId: string; content: string }
  | ({ kind: 'tool'; key: string } & Msg<'tool'>['call'])
  | {
      kind: 'approval';
      key: string;
      threadId: string;
      id: string;
      approvalKind: 'edit' | 'command';
      title: string;
      detail: string;
      outcome?: string;
    }
  | { kind: 'notice'; key: string; threadId: string; level: string; message: string; actions: string[] }
  | { kind: 'modelSwitch'; key: string; threadId: string; from: string; to: string; reason: string };
export interface Finished {
  status: 'done' | 'cancelled' | 'error';
  model: string;
  error?: string;
  sessionId?: string;
  metrics?: Record<string, number>;
}
export interface Run {
  runId: string;
  prompt: string;
  context?: ContextCard;
  entries: Entry[];
  threads: ThreadInfo[];
  finished?: Finished;
}
export interface GlobalNotice {
  key: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  actions: string[];
}
export interface PanelState {
  runs: Run[];
  running: boolean;
  models: string[];
  activeModel: string;
  trueforgeUrl: string;
  health?: Msg<'health'>;
  changes: Msg<'changes'>['changes'];
  mentions?: { query: string; items: Msg<'mentionResults'>['items'] };
  notices: GlobalNotice[];
  noticeSeq: number;
}

export function initialState(): PanelState {
  return {
    runs: [],
    running: false,
    models: [],
    activeModel: '',
    trueforgeUrl: '',
    changes: [],
    notices: [],
    noticeSeq: 0,
  };
}

function updateRun(state: PanelState, runId: string, fn: (r: Run) => Run): PanelState {
  const exists = state.runs.some((r) => r.runId === runId);
  const base = exists ? state.runs : [...state.runs, { runId, prompt: '', entries: [], threads: [] }];
  return { ...state, runs: base.map((r) => (r.runId === runId ? fn(r) : r)) };
}

/** Replace the entry with the same key, or append it. */
function upsert(entries: Entry[], entry: Entry): Entry[] {
  const idx = entries.findIndex((e) => e.key === entry.key);
  if (idx < 0) return [...entries, entry];
  return entries.map((e, i) => (i === idx ? entry : e));
}

function onText(s: PanelState, m: Msg<'text'>): PanelState {
  const key = `m:${m.messageId}`;
  const entry: Entry = { kind: 'text', key, threadId: m.threadId, messageId: m.messageId, content: m.content };
  return updateRun(s, m.runId, (r) => ({ ...r, entries: upsert(r.entries, entry) }));
}

function onTool(s: PanelState, m: Msg<'tool'>): PanelState {
  const entry: Entry = { kind: 'tool', key: `t:${m.call.id}`, ...m.call };
  return updateRun(s, m.runId, (r) => ({ ...r, entries: upsert(r.entries, entry) }));
}

function onThread(s: PanelState, m: Msg<'thread'>): PanelState {
  return updateRun(s, m.runId, (r) => {
    const known = r.threads.some((t) => t.id === m.thread.id);
    const threads = known ? r.threads.map((t) => (t.id === m.thread.id ? m.thread : t)) : [...r.threads, m.thread];
    return { ...r, threads };
  });
}

function onApproval(s: PanelState, m: Msg<'approval'>): PanelState {
  const entry: Entry = {
    kind: 'approval',
    key: `a:${m.id}`,
    threadId: '',
    id: m.id,
    approvalKind: m.kind,
    title: m.title,
    detail: m.detail,
  };
  return updateRun(s, m.runId, (r) => ({ ...r, entries: upsert(r.entries, entry) }));
}

function onApprovalResolved(s: PanelState, m: Msg<'approvalResolved'>): PanelState {
  return updateRun(s, m.runId, (r) => ({
    ...r,
    entries: r.entries.map((e) => (e.kind === 'approval' && e.id === m.id ? { ...e, outcome: m.outcome } : e)),
  }));
}

function onNotice(s: PanelState, m: Msg<'notice'>): PanelState {
  const seq = s.noticeSeq + 1;
  const actions = m.actions ?? [];
  if (!m.runId) {
    const notice: GlobalNotice = { key: `n:${seq}`, level: m.level, message: m.message, actions };
    return { ...s, noticeSeq: seq, notices: [...s.notices, notice] };
  }
  const entry: Entry = { kind: 'notice', key: `n:${seq}`, threadId: '', level: m.level, message: m.message, actions };
  return { ...updateRun(s, m.runId, (r) => ({ ...r, entries: [...r.entries, entry] })), noticeSeq: seq };
}

function onModelSwitch(s: PanelState, m: Msg<'modelSwitch'>): PanelState {
  const seq = s.noticeSeq + 1;
  const entry: Entry = { kind: 'modelSwitch', key: `s:${seq}`, threadId: '', from: m.from, to: m.to, reason: m.reason };
  const next = updateRun(s, m.runId, (r) => ({ ...r, entries: [...r.entries, entry] }));
  return { ...next, noticeSeq: seq, activeModel: m.to };
}

function onRunFinished(s: PanelState, m: Msg<'runFinished'>): PanelState {
  const { type: _t, runId: _r, ...finished } = m;
  return { ...updateRun(s, m.runId, (r) => ({ ...r, finished })), running: false };
}

export function reduce(state: PanelState, msg: HostToWebview): PanelState {
  switch (msg.type) {
    case 'init':
      return { ...state, models: msg.models, activeModel: msg.activeModel, trueforgeUrl: msg.trueforgeUrl };
    case 'health':
      return { ...state, health: msg };
    case 'runStarted':
      return { ...updateRun(state, msg.runId, (r) => ({ ...r, prompt: msg.prompt })), running: true };
    case 'context': {
      const { items, budget, used, dropped } = msg;
      return updateRun(state, msg.runId, (r) => ({ ...r, context: { items, budget, used, dropped } }));
    }
    case 'text':
      return onText(state, msg);
    case 'tool':
      return onTool(state, msg);
    case 'thread':
      return onThread(state, msg);
    case 'approval':
      return onApproval(state, msg);
    case 'approvalResolved':
      return onApprovalResolved(state, msg);
    case 'modelSwitch':
      return onModelSwitch(state, msg);
    case 'notice':
      return onNotice(state, msg);
    case 'runFinished':
      return onRunFinished(state, msg);
    case 'changes':
      return { ...state, changes: msg.changes };
    case 'mentionResults':
      return { ...state, mentions: { query: msg.query, items: msg.items } };
  }
}
