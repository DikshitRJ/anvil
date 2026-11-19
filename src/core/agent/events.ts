// TurnReducer: folds the SDK's camelCase turn events into a UI-friendly TurnView snapshot.
import { isEventDelta, mergeEventDelta, type TrueForgeApi } from '@truefoundry/trueforge-sdk';
import { resolveToolCall, type RawToolCall, type ResolvedToolCall } from './toolCalls';

export type ToolStatus = 'streaming' | 'awaiting-approval' | 'running' | 'done' | 'denied' | 'error';

export interface ToolCallView {
  id: string;
  threadId: string;
  tool: string;
  server?: string;
  input: Record<string, unknown>;
  status: ToolStatus;
  result?: string;
}

export interface MessageView {
  id: string;
  threadId: string;
  content: string;
}

export interface ThreadView {
  id: string;
  title: string;
  status: 'running' | 'done' | 'error';
}

export interface TurnView {
  turnId?: string;
  status: 'running' | 'paused' | 'done' | 'cancelled' | 'error';
  messages: MessageView[];
  toolCalls: ToolCallView[];
  threads: ThreadView[];
  pending: ResolvedToolCall[];
  error?: string;
  output?: string;
  lastEventId?: string;
  metrics?: Record<string, number>;
}

type Msg = TrueForgeApi.ModelMessageEvent;
type Ev = { type: string; id?: string } & Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const RESULT_LIMIT = 2000;

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((p: { text?: unknown }) => (typeof p?.text === 'string' ? p.text : '')).join('');
}

export class TurnReducer {
  private messages = new Map<string, Msg>();
  private complete = new Set<string>();
  private overrides = new Map<string, { status: ToolStatus; result?: string }>();
  private threads = new Map<string, ThreadView>();
  private pending: ResolvedToolCall[] = [];
  private state = this.fresh();

  private fresh(): Omit<TurnView, 'messages' | 'toolCalls' | 'threads' | 'pending'> {
    return { status: 'running' };
  }

  apply(event: unknown): void {
    const e = event as Ev;
    if (!e || typeof e.type !== 'string') return;
    if (e.id) this.state.lastEventId = e.id;
    this.dispatch(e);
  }

  private dispatch(e: Ev): void {
    switch (e.type) {
      case 'turn.created':
        this.state.turnId = e.turnId;
        break;
      case 'model.message':
        this.messages.set(e.id as string, e as unknown as Msg);
        this.complete.add(e.id as string);
        break;
      case 'model.message.delta':
        this.applyDelta(e);
        break;
      case 'tool.approval_required':
        this.requireAction(e, 'awaiting-approval');
        break;
      case 'tool.response_required':
        this.requireAction(e, 'running');
        break;
      case 'tool.response':
        this.overrides.set(e.toolCallId, { status: 'done', result: textOf(e.content).slice(0, RESULT_LIMIT) });
        this.clearPending(e.toolCallId);
        break;
      case 'user.tool_approval':
        this.onApproval(e);
        break;
      case 'user.tool_response':
        this.clearPending(e.toolCallId);
        break;
      case 'thread.created':
        this.threads.set(e.threadId, { id: e.threadId, title: e.title ?? '', status: 'running' });
        break;
      case 'thread.done':
        this.threads.set(e.threadId, {
          id: e.threadId,
          title: e.title ?? this.threads.get(e.threadId)?.title ?? '',
          status: e.state?.status === 'error' ? 'error' : 'done',
        });
        break;
      case 'turn.update':
        this.onUpdate(e);
        break;
      case 'turn.done':
        this.onDone(e);
        break;
    }
  }

  private applyDelta(e: Ev): void {
    if (!isEventDelta(e as { type: string })) return;
    const delta = e as unknown as TrueForgeApi.ModelMessageDeltaEvent;
    let base = this.messages.get(delta.id);
    if (!base) {
      base = { type: 'model.message', id: delta.id, threadId: delta.threadId, createdAt: '', content: '' } as Msg;
      this.messages.set(delta.id, base);
    }
    mergeEventDelta(base, delta);
    if (delta.finishReason) this.complete.add(delta.id);
  }

  private requireAction(e: Ev, status: ToolStatus): void {
    for (const ref of e.toolCalls ?? []) {
      this.overrides.set(ref.id, { status });
      const call = this.toolCall(ref.id);
      if (call && !this.pending.some((p) => p.callId === ref.id)) this.pending.push({ ...call, threadId: e.threadId });
    }
  }

  private onApproval(e: Ev): void {
    const denied = e.approval?.status === 'deny';
    this.overrides.set(e.toolCallId, { status: denied ? 'denied' : 'running' });
    this.clearPending(e.toolCallId);
  }

  private clearPending(callId: string): void {
    this.pending = this.pending.filter((p) => p.callId !== callId);
  }

  private onUpdate(e: Ev): void {
    const s = e.state ?? {};
    this.state.status = s.status === 'paused' ? 'paused' : 'running';
    if (s.metrics) this.state.metrics = s.metrics;
  }

  private onDone(e: Ev): void {
    const s = e.state ?? {};
    if (s.status === 'done') {
      this.state.status = 'done';
      this.state.output = textOf(s.output?.content);
    } else if (s.status === 'cancelled') {
      this.state.status = 'cancelled';
      this.state.error = String(s.reason ?? 'cancelled');
    } else {
      this.state.status = 'error';
      this.state.error = String(s.message ?? 'unknown error');
    }
    if (s.metrics) this.state.metrics = s.metrics;
    this.pending = [];
  }

  private toolCallViews(): ToolCallView[] {
    const out: ToolCallView[] = [];
    for (const msg of this.messages.values()) {
      const live = !this.complete.has(msg.id);
      for (const raw of msg.toolCalls ?? []) {
        const r = resolveToolCall(raw as unknown as RawToolCall, msg.threadId);
        const o = this.overrides.get(raw.id);
        const status: ToolStatus = o?.status ?? (live ? 'streaming' : 'running');
        out.push({
          id: raw.id,
          threadId: r.threadId,
          tool: r.tool,
          server: r.server,
          input: r.input,
          status,
          result: o?.result,
        });
      }
    }
    return out;
  }

  view(): TurnView {
    return {
      ...this.state,
      metrics: this.state.metrics ? { ...this.state.metrics } : undefined,
      messages: [...this.messages.values()].map((m) => ({
        id: m.id,
        threadId: m.threadId,
        content: textOf(m.content),
      })),
      toolCalls: this.toolCallViews(),
      threads: [...this.threads.values()].map((t) => ({ ...t })),
      pending: this.pending.map((p) => ({ ...p })),
    };
  }

  toolCall(id: string): ResolvedToolCall | undefined {
    for (const msg of this.messages.values()) {
      const raw = (msg.toolCalls ?? []).find((c) => c.id === id);
      if (raw) return resolveToolCall(raw as unknown as RawToolCall, msg.threadId);
    }
    return undefined;
  }

  reset(): void {
    this.messages.clear();
    this.complete.clear();
    this.overrides.clear();
    this.threads.clear();
    this.pending = [];
    this.state = this.fresh();
  }
}
