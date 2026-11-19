export type HostToWebview =
  | { type: 'init'; models: string[]; activeModel: string; trueforgeUrl: string }
  | { type: 'health'; trueforge: 'ok' | 'down' | 'unknown'; bridge: 'ok' | 'down'; indexedFiles: number }
  | { type: 'runStarted'; runId: string; prompt: string }
  | {
      type: 'context';
      runId: string;
      items: { path: string; startLine?: number; endLine?: number; kind: string; reason: string; tokens: number }[];
      budget: number;
      used: number;
      dropped: number;
    }
  // full content so far (idempotent)
  | { type: 'text'; runId: string; messageId: string; threadId: string; content: string }
  | {
      type: 'tool';
      runId: string;
      call: { id: string; threadId: string; tool: string; summary: string; status: string; result?: string };
    }
  | { type: 'thread'; runId: string; thread: { id: string; title: string; status: string } }
  | { type: 'approval'; runId: string; id: string; kind: 'edit' | 'command'; title: string; detail: string }
  | { type: 'approvalResolved'; runId: string; id: string; outcome: string }
  | { type: 'modelSwitch'; runId: string; from: string; to: string; reason: string }
  | { type: 'notice'; runId?: string; level: 'info' | 'warn' | 'error'; message: string; actions?: string[] }
  | {
      type: 'runFinished';
      runId: string;
      status: 'done' | 'cancelled' | 'error';
      model: string;
      error?: string;
      sessionId?: string;
      metrics?: Record<string, number>;
    }
  | { type: 'changes'; changes: { seq: number; runId: string; path: string; summary: string; at: number }[] }
  | {
      type: 'mentionResults';
      query: string;
      items: { kind: 'file' | 'symbol'; label: string; detail: string; insert: string }[];
    };

export type WebviewToHost =
  | { type: 'ready' }
  | { type: 'send'; text: string }
  | { type: 'cancel' }
  | { type: 'newChat' }
  | { type: 'approve'; id: string; allow: boolean; reason?: string }
  | { type: 'mentionQuery'; query: string }
  | { type: 'openFile'; path: string; line?: number }
  | { type: 'openSession' }
  | { type: 'undoChange'; seq: number }
  | { type: 'revertRun'; runId: string }
  | { type: 'doctor' }
  | { type: 'notice-action'; action: string };
