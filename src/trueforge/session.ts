// AnvilSession: runs one user request as a TrueForge turn - streams events, answers approval/question pauses,
// supports cancellation, and drives the Model Relay (retry / switch model) on failures.
import type { TrueForge, TrueForgeApi } from '@truefoundry/trueforge-sdk';
import type { ResolvedToolCall } from '../core/agent/toolCalls';
import { TurnReducer, type TurnView } from '../core/agent/events';
import { classifyFailure, type FailureKind, type ModelRelay } from '../core/agent/fallback';
import { buildSpec, type AgentDefinition } from './spec';

export interface ApprovalRequest {
  call: ResolvedToolCall;
}

export type ApprovalDecision = { allow: true } | { allow: false; reason: string };

export interface RunHooks {
  onEvent?(event: unknown, view: TurnView): void;
  onApproval(req: ApprovalRequest): Promise<ApprovalDecision>;
  onQuestion?(question: string, options: string[]): Promise<string>;
  onModelSwitch?(from: string, to: string, reason: string): void;
  onRetry?(model: string, attempt: number, delayMs: number, reason: string): void;
  // host rolls back the failed attempt's writes
  beforeRetry?(): Promise<void>;
}

export interface RunResult {
  status: 'done' | 'cancelled' | 'error';
  output?: string;
  model: string;
  error?: string;
  sessionId?: string;
  metrics?: Record<string, number>;
}

type Failure = {
  kind: 'failure';
  phase: 'connect' | 'turn' | 'stall';
  message: string;
  statusCode?: number;
  code?: string;
};
type Outcome = { kind: 'done'; output?: string; metrics?: Record<string, number> } | { kind: 'cancelled' } | Failure;
type Stream = AsyncIterable<TrueForgeApi.TurnStreamingEvent>;
type Drain = 'terminal' | 'paused' | 'ended' | 'stall' | 'cancelled';

const MAX_RESUBSCRIBES = 3;
const RETRY_NOTE =
  '[Anvil] The previous attempt failed and any file changes it made were reverted. Re-read files before editing.\n\n';
const DEFAULT_ANSWER = 'Proceed with your best judgement.';
const DISMISSED_ANSWER = 'The user dismissed the question without answering.';

export class AnvilSession {
  private id?: string;
  private specModel?: string;
  private running = false;
  private cancelled = false;
  private received = false;
  private controller = new AbortController();
  private reducer = new TurnReducer();
  private cancelSignal!: Promise<'cancelled'>;
  private fireCancel!: () => void;

  constructor(
    protected opts: {
      client: TrueForge;
      agent: AgentDefinition;
      relay: ModelRelay;
      stallTimeoutMs: number;
      title?: string;
      baseUrl?: string;
      // true while the host is running a tool call for the turn; the stall watchdog then waits
      isBusy?: () => boolean;
    },
  ) {}

  get sessionId(): string | undefined {
    return this.id;
  }

  async run(input: string, hooks: RunHooks): Promise<RunResult> {
    if (this.running) throw new Error('A run is already in progress');
    this.running = true;
    this.cancelled = false;
    this.cancelSignal = new Promise((r) => (this.fireCancel = () => r('cancelled')));
    try {
      return await this.runLoop(input, hooks);
    } finally {
      this.running = false;
    }
  }

  async cancel(): Promise<void> {
    if (!this.running) return;
    this.cancelled = true;
    this.controller.abort();
    this.fireCancel();
    await this.serverCancel();
  }

  dispose(): void {
    void this.cancel();
  }

  // ---- retry / fallback loop ----

  private async runLoop(input: string, hooks: RunHooks): Promise<RunResult> {
    const { relay } = this.opts;
    relay.reset();
    let retries = 0;
    let text = input;
    for (;;) {
      if (this.cancelled) return { status: 'cancelled', ...this.ids() };
      let out = await this.attempt(text, hooks);
      if (out.kind === 'done') return { status: 'done', output: out.output, metrics: out.metrics, ...this.ids() };
      if (out.kind === 'cancelled') return { status: 'cancelled', ...this.ids() };
      for (;;) {
        const kind = classifyFailure(out);
        const step = relay.onFailure(kind, out.message);
        if (step.action === 'give-up') return this.giveUp(kind, step.reason, out.message);
        if (step.action === 'retry') {
          hooks.onRetry?.(step.model, ++retries, step.delayMs, out.message);
          if (!(await this.backoff(hooks, step.delayMs))) return { status: 'cancelled', ...this.ids() };
          break;
        }
        retries = 0;
        await hooks.beforeRetry?.();
        const err = await this.swapModel(step.model);
        if (!err) {
          hooks.onModelSwitch?.(step.from, step.model, out.message);
          break;
        }
        out = this.failTurn(err);
      }
      if (this.cancelled) return { status: 'cancelled', ...this.ids() };
      text = RETRY_NOTE + input;
    }
  }

  private ids(): { model: string; sessionId?: string } {
    return { model: this.opts.relay.current(), sessionId: this.id };
  }

  private giveUp(kind: FailureKind, reason: string, message: string): RunResult {
    if (kind === 'cancelled') return { status: 'cancelled', ...this.ids() };
    const where = this.opts.baseUrl ? ` at ${this.opts.baseUrl}` : '';
    const error = kind === 'harness-down' ? `${reason}${where} (${message})` : reason;
    return { status: 'error', error, ...this.ids() };
  }

  private async backoff(hooks: RunHooks, delayMs: number): Promise<boolean> {
    await hooks.beforeRetry?.();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const slept = new Promise<'slept'>((r) => (timer = setTimeout(() => r('slept'), delayMs)));
    const r = await Promise.race([slept, this.cancelSignal]);
    clearTimeout(timer);
    return r === 'slept' && !this.cancelled;
  }

  // returns an error message when the session spec could not be updated
  private async swapModel(model: string): Promise<string | undefined> {
    if (!this.id) return undefined;
    try {
      await this.opts.client.sessions.update(this.id, { agent: { spec: buildSpec(this.opts.agent, model) } });
      this.specModel = model;
      return undefined;
    } catch (e) {
      return (e as { message?: string })?.message ?? String(e);
    }
  }

  // ---- one attempt ----

  private reqOpts() {
    return { abortSignal: this.controller.signal, timeoutInSeconds: 600, maxRetries: 0 };
  }

  private async attempt(input: string, hooks: RunHooks): Promise<Outcome> {
    this.reducer.reset();
    this.compacting = false;
    this.received = false;
    this.controller = new AbortController();
    try {
      if (this.id && this.specModel !== this.opts.relay.current()) {
        const error = await this.swapModel(this.opts.relay.current());
        if (error) return this.failTurn(error);
      }
      const sid = await this.ensureSession();
      const turn = this.opts.client.sessions.createTurnStream(
        sid,
        { input: [{ type: 'user.message', content: input }] },
        this.reqOpts(),
      );
      return await this.consume(sid, await turn, hooks);
    } catch (e) {
      return this.cancelled ? { kind: 'cancelled' } : this.fromError(e);
    }
  }

  private async ensureSession(): Promise<string> {
    if (this.id) return this.id;
    const { client, agent, relay, title } = this.opts;
    const res = await client.sessions.create({ agent: { spec: buildSpec(agent, relay.current()) } }, this.reqOpts());
    this.id = res.data.id;
    this.specModel = relay.current();
    if (title) await client.sessions.update(this.id, { title: title.slice(0, 50) }).catch(() => undefined);
    return this.id;
  }

  private fromError(e: unknown): Failure {
    const err = e as { message?: string; statusCode?: number; code?: string; cause?: { code?: string } };
    return {
      kind: 'failure',
      phase: this.received ? 'turn' : 'connect',
      message: err?.message ?? String(e),
      statusCode: err?.statusCode,
      code: err?.cause?.code ?? err?.code,
    };
  }

  private async consume(sid: string, first: Stream, hooks: RunHooks): Promise<Outcome> {
    let stream = first;
    let resubs = 0;
    for (;;) {
      this.drainEvents = 0;
      const r = await this.drain(stream, hooks);
      if (this.drainEvents > 0) resubs = 0; // healthy progress: transient drops only count when consecutive
      if (r === 'cancelled') return { kind: 'cancelled' };
      if (r === 'stall') return { kind: 'failure', phase: 'stall', message: 'stream stalled' };
      const view = this.reducer.view();
      if (r === 'terminal') return this.terminal(view);
      if (r === 'paused') {
        resubs = 0;
        const next = await this.answerPause(sid, view, hooks);
        if (!next) return { kind: 'cancelled' };
        stream = next;
      } else {
        if (++resubs > MAX_RESUBSCRIBES || !view.turnId) return this.failTurn('stream ended unexpectedly');
        stream = await this.subscribe(sid, view);
      }
    }
  }

  private failTurn(message: string): Failure {
    return { kind: 'failure', phase: 'turn', message };
  }

  private terminal(view: TurnView): Outcome {
    if (view.status === 'done') return { kind: 'done', output: view.output, metrics: view.metrics };
    if (view.status === 'cancelled') {
      return this.cancelled ? { kind: 'cancelled' } : this.failTurn(`turn cancelled by server: ${view.error}`);
    }
    return this.failTurn(view.error ?? 'turn failed');
  }

  private subscribe(sid: string, view: TurnView): Promise<Stream> {
    const turnId = view.turnId as string;
    return this.opts.client.sessions.subscribeToTurn(sid, turnId, { afterEventId: view.lastEventId }, this.reqOpts());
  }

  // ---- reading events ----

  private drainEvents = 0;
  /** True between thread.context_compaction_started and _finished: TrueForge emits nothing while it summarises. */
  private compacting = false;

  private async drain(stream: Stream, hooks: RunHooks): Promise<Drain> {
    const it = stream[Symbol.asyncIterator]();
    try {
      for (;;) {
        const r = await this.nextEvent(it);
        if (r === 'cancelled' || r === 'stall') return r;
        if (r.done) return 'ended';
        const ev = r.value as { type: string; state?: { status?: string } };
        this.received = true;
        this.drainEvents++;
        this.reducer.apply(ev);
        this.trackCompaction(ev.type);
        hooks.onEvent?.(ev, this.reducer.view());
        if (ev.type === 'turn.done') return 'terminal';
        if (ev.type === 'turn.update' && ev.state?.status === 'paused') return 'paused';
      }
    } finally {
      void Promise.resolve(it.return?.()).catch(() => undefined);
    }
  }

  private trackCompaction(type: string): void {
    if (type === 'thread.context_compaction_started') this.compacting = true;
    else if (type === 'thread.context_compaction_finished' || type === 'turn.done') this.compacting = false;
  }

  private async nextEvent(it: AsyncIterator<TrueForgeApi.TurnStreamingEvent>) {
    const next = it.next();
    next.catch(() => undefined);
    for (;;) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const stall = new Promise<'stall'>((r) => (timer = setTimeout(() => r('stall'), this.opts.stallTimeoutMs)));
      const r = await Promise.race([next, stall, this.cancelSignal]).finally(() => clearTimeout(timer));
      if (r !== 'stall') return r;
      // Host mid tool call, or TrueForge compacting history: legitimately silent, so re-arm instead of aborting.
      if (this.compacting || this.opts.isBusy?.()) continue;
      this.controller.abort();
      void this.serverCancel();
      return r;
    }
  }

  private async serverCancel(): Promise<void> {
    if (this.id) await this.opts.client.sessions.cancel(this.id).catch(() => undefined);
  }

  // ---- pauses ----

  private async answerPause(sid: string, view: TurnView, hooks: RunHooks): Promise<Stream | undefined> {
    const events: TrueForgeApi.TurnUserEventMessage[] = [];
    for (const call of view.pending) {
      events.push(await this.answerCall(call, hooks));
      if (this.cancelled) return undefined;
    }
    if (events.length === 0) throw new Error('turn paused with no pending tool call to answer');
    const sub = await this.subscribe(sid, view); // subscribe first, then answer
    try {
      await this.opts.client.sessions.createTurnEvents(sid, view.turnId as string, { events }, this.reqOpts());
    } catch (e) {
      this.closeStream(sub);
      this.controller.abort();
      throw e;
    }
    for (const e of events) this.reducer.apply(e);
    return sub;
  }

  private closeStream(stream: Stream): void {
    const it = stream[Symbol.asyncIterator]();
    void Promise.resolve(it.return?.()).catch(() => undefined);
  }

  private async answerCall(call: ResolvedToolCall, hooks: RunHooks): Promise<TrueForgeApi.TurnUserEventMessage> {
    const ids = { threadId: call.threadId, toolCallId: call.callId };
    if (call.tool === 'ask_user_question' && !call.server) {
      const q = typeof call.input.question === 'string' ? call.input.question : '';
      const options = Array.isArray(call.input.options) ? call.input.options.map(String) : [];
      const content = hooks.onQuestion ? await this.unlessCancelled(hooks.onQuestion(q, options)) : DEFAULT_ANSWER;
      const answer = hooks.onQuestion ? content || DISMISSED_ANSWER : DEFAULT_ANSWER;
      return { type: 'user.tool_response', content: answer, ...ids };
    }
    const review = hooks
      .onApproval({ call })
      .catch((): ApprovalDecision => ({ allow: false, reason: 'Review failed' }));
    const decision = (await this.unlessCancelled(review)) ?? { allow: false as const, reason: 'Cancelled' };
    const approval = decision.allow
      ? ({ status: 'allow' } as const)
      : ({ status: 'deny', reason: decision.reason } as const);
    return { type: 'user.tool_approval', approval, ...ids };
  }

  // resolves undefined as soon as the run is cancelled, so a stuck host hook cannot block settlement
  private async unlessCancelled<T>(p: Promise<T>): Promise<T | undefined> {
    const r = await Promise.race([p, this.cancelSignal]);
    return r === 'cancelled' ? undefined : r;
  }
}
