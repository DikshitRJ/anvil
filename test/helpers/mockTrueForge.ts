// Scripted in-process TrueForge server for integration tests.
//
// Wire details verified against @truefoundry/trueforge-sdk@0.185.0 (dist/cjs) and the reference server source:
//   POST   /api/v1/sessions                          {agent:{spec}|{name}, metadata?}   -> {data: Session}
//   PATCH  /api/v1/sessions/{id}                     {agent?, title?, metadata?}        -> {data: Session}
//   POST   /api/v1/sessions/{id}/cancel              {}                                 -> {data: ...}
//   POST   /api/v1/sessions/{id}/turns               {input:[{type:'user.message',content}], stream:true} -> SSE
//   GET    /api/v1/sessions/{id}/turns/{tid}/subscribe?after_event_id=...               -> SSE
//   POST   /api/v1/sessions/{id}/turns/{tid}/events  {events:[user.tool_approval|user.tool_response]} -> {data:[]}
//   GET    /api/v1/agents?agent_name=  -> {data:[Agent], pagination:{limit, next_page_token?}}
//   POST   /api/v1/agents (create) / PUT /api/v1/agents/{id} (update)                   -> {data: Agent}
//   GET    /api/v1/settings/mcp-servers/{name}  (404 when missing) / PUT /api/v1/settings/mcp-servers {manifest}
// Request bodies are snake_case JSON (SDK serializer). SSE frames are `id: <seq>\ndata: <json>\n\n` (hono streamSSE),
// no `event:` line and no terminator: the stream ends when the server closes the body. Events are snake_case JSON.
// Errors: non-2xx JSON `{error:{message}}`; the SDK throws TrueForgeError{statusCode} (network failures: no statusCode).
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export type Step = { event: Record<string, unknown> } | { delay: number } | 'pause' | 'hang';
export interface Scenario {
  httpFail?: { status: number; message?: string };
  steps: Step[];
}
export interface Recorded {
  method: string;
  path: string;
  query: URLSearchParams;
  body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const now = () => new Date().toISOString();
const base = (type: string, extra: object = {}) => ({ type, created_at: now(), thread_id: null, ...extra });

// event builders (snake_case wire shape)
export const E = {
  created: (turnId = 'turn_1') =>
    base('turn.created', { turn_id: turnId, previous_turn_id: null, state: { status: 'running' } }),
  delta: (id: string, content: string, thread = 'main') =>
    base('model.message.delta', { id, thread_id: thread, content }),
  message: (id: string, content: string | null, toolCalls?: object[], thread = 'main') =>
    base('model.message', { id, thread_id: thread, content, tool_calls: toolCalls, finish_reason: 'stop' }),
  mcpCall: (id: string, tool: string, input: object) => ({
    id,
    type: 'function',
    function: { name: tool, arguments: JSON.stringify(input) },
    tool_info: { type: 'mcp', server_id: 's1', server_name: 'anvil-editor', name: tool },
  }),
  deferredCall: (id: string, tool: string, input: object) => ({
    id,
    type: 'function',
    function: {
      name: 'call_tool',
      arguments: JSON.stringify({ mcp_server: 'anvil-editor', tool_name: tool, input }),
    },
    tool_info: { type: 'truefoundry-system', name: 'call_tool' },
  }),
  askCall: (id: string, question: string, options: string[]) => ({
    id,
    type: 'function',
    function: { name: 'ask_user_question', arguments: JSON.stringify({ question, options }) },
    tool_info: { type: 'truefoundry-system', name: 'ask_user_question' },
  }),
  approvalRequired: (callId: string, sourceId: string, thread = 'main') =>
    base('tool.approval_required', { thread_id: thread, tool_calls: [{ id: callId, source_event_id: sourceId }] }),
  responseRequired: (callId: string, sourceId: string, thread = 'main') =>
    base('tool.response_required', { thread_id: thread, tool_calls: [{ id: callId, source_event_id: sourceId }] }),
  toolResponse: (callId: string, content: string, thread = 'main') =>
    base('tool.response', { thread_id: thread, tool_call_id: callId, content }),
  running: () => base('turn.update', { state: { status: 'running' } }),
  paused: () => base('turn.update', { state: { status: 'paused' } }),
  done: (output: string) =>
    base('turn.done', {
      state: {
        status: 'done',
        completed_at: now(),
        output: { type: 'model.message', id: 'out', thread_id: 'main', created_at: now(), content: output },
        required_actions: [],
      },
    }),
  error: (message: string) => base('turn.done', { state: { status: 'error', completed_at: now(), message } }),
};
export const emit = (event: Record<string, unknown>): Step => ({ event });

interface Turn {
  id: string;
  rest: Step[] | null; // steps after a pause
  answered: boolean;
  sub: ServerResponse | null;
  live: ServerResponse | null;
  seq: number;
}

export class MockTrueForge {
  requests: Recorded[] = [];
  scenarios: Scenario[] = [];
  // number of upcoming PATCH session / POST events requests to fail with a 400
  failNext = { patch: 0, events: 0 };
  private server: Server;
  private turns = new Map<string, Turn>();
  private agents: { id: string; name: string }[] = [];
  private mcp = new Set<string>();
  private turnCount = 0;

  constructor() {
    this.server = createServer((req, res) => void this.handle(req, res));
  }

  async start(): Promise<string> {
    await new Promise<void>((r) => this.server.listen(0, '127.0.0.1', r));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    this.server.closeAllConnections();
    await new Promise((r) => this.server.close(r));
  }

  push(...s: Scenario[]): void {
    this.scenarios.push(...s);
  }

  find(method: string, pathPart: string): Recorded[] {
    return this.requests.filter((r) => r.method === method && r.path.includes(pathPart));
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://x');
    let text = '';
    for await (const c of req) text += String(c);
    const rec: Recorded = {
      method: req.method ?? '',
      path: url.pathname,
      query: url.searchParams,
      body: text ? JSON.parse(text) : undefined,
    };
    this.requests.push(rec);
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const p = url.pathname.replace('/api/v1', '');
    const m = (re: RegExp) => re.exec(p);
    if (url.pathname === '/healthz') return json(200, { ok: true });
    if (rec.method === 'POST' && p === '/sessions') return json(200, { data: { id: 'sess_1' } });
    if (rec.method === 'PATCH' && this.failNext.patch-- > 0) return json(400, { error: { message: 'bad spec' } });
    if (rec.method === 'PATCH' && m(/^\/sessions\/[^/]+$/)) return json(200, { data: { id: 'sess_1' } });
    if (rec.method === 'POST' && m(/^\/sessions\/[^/]+\/cancel$/)) return this.cancel(json);
    if (rec.method === 'POST' && m(/^\/sessions\/[^/]+\/turns$/)) return this.startTurn(res, json);
    const sub = m(/^\/sessions\/[^/]+\/turns\/([^/]+)\/subscribe$/);
    if (rec.method === 'GET' && sub) return this.subscribe(sub[1] as string, res);
    const ev = m(/^\/sessions\/[^/]+\/turns\/([^/]+)\/events$/);
    if (rec.method === 'POST' && ev && this.failNext.events-- > 0)
      return json(400, { error: { message: 'bad events' } });
    if (rec.method === 'POST' && ev) return this.answer(ev[1] as string, json);
    return this.handleResources(rec, p, json);
  }

  private handleResources(rec: Recorded, p: string, json: (s: number, b: unknown) => void): void {
    if (rec.method === 'GET' && p === '/agents') {
      const name = rec.query.get('agent_name');
      return json(200, { data: this.agents.filter((a) => !name || a.name === name), pagination: { limit: 50 } });
    }
    if (rec.method === 'POST' && p === '/agents') {
      const id = `agent_${this.agents.length + 1}`;
      this.agents.push({ id, name: rec.body.name });
      return json(200, { data: { id, ...rec.body } });
    }
    if (rec.method === 'PUT' && p.startsWith('/agents/'))
      return json(200, { data: { id: p.split('/')[2], ...rec.body } });
    if (p === '/settings/mcp-servers' && rec.method === 'PUT') {
      this.mcp.add(rec.body.manifest.name);
      return json(200, { data: rec.body.manifest });
    }
    const name = /^\/settings\/mcp-servers\/(.+)$/.exec(p)?.[1];
    if (name && this.mcp.has(name)) return json(200, { data: { name } });
    json(404, { error: { message: `not found: ${p}` } });
  }

  private startTurn(res: ServerResponse, json: (s: number, b: unknown) => void): void {
    const sc = this.scenarios.shift() ?? { steps: [emit(E.created()), emit(E.done('(no scenario)'))] };
    if (sc.httpFail) return json(sc.httpFail.status, { error: { message: sc.httpFail.message ?? 'failure' } });
    const turn: Turn = { id: `turn_${++this.turnCount}`, rest: null, answered: false, sub: null, live: res, seq: 0 };
    this.turns.set(turn.id, turn);
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    res.flushHeaders();
    void this.play(
      turn,
      res,
      sc.steps.map((s) => this.stamp(s, turn)),
    );
  }

  private stamp(s: Step, turn: Turn): Step {
    if (typeof s === 'object' && 'event' in s && s.event.type === 'turn.created')
      return emit({ ...s.event, turn_id: turn.id });
    return s;
  }

  private async play(turn: Turn, res: ServerResponse, steps: Step[]): Promise<void> {
    for (const [i, s] of steps.entries()) {
      if (res.destroyed || res.writableEnded) return;
      if (s === 'hang') return void (turn.live = res); // stays open until cancel/abort
      if (s === 'pause') {
        turn.rest = steps.slice(i + 1);
        break;
      }
      if ('delay' in s) await new Promise((r) => setTimeout(r, s.delay));
      else res.write(`id: ${++turn.seq}\ndata: ${JSON.stringify({ id: `ev_${turn.seq}`, ...s.event })}\n\n`);
    }
    res.end();
  }

  private subscribe(turnId: string, res: ServerResponse): void {
    const turn = this.turns.get(turnId);
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.flushHeaders();
    if (!turn) return void res.end();
    turn.sub = res;
    this.resume(turn);
  }

  private answer(turnId: string, json: (s: number, b: unknown) => void): void {
    const turn = this.turns.get(turnId);
    if (turn) turn.answered = true;
    json(200, { data: [] });
    if (turn) this.resume(turn);
  }

  private resume(turn: Turn): void {
    if (!turn.rest || !turn.answered || !turn.sub) return;
    const steps = turn.rest;
    turn.rest = null;
    turn.answered = false;
    const sub = turn.sub;
    turn.sub = null;
    turn.live = sub;
    void this.play(turn, sub, steps);
  }

  private cancel(json: (s: number, b: unknown) => void): void {
    for (const t of this.turns.values()) {
      const live = t.live;
      if (live && !live.writableEnded && !live.destroyed) {
        live.write(
          `id: ${++t.seq}\ndata: ${JSON.stringify({ id: `ev_${t.seq}`, ...base('turn.done', { state: { status: 'cancelled', completed_at: now(), reason: 'client-cancelled' } }) })}\n\n`,
        );
        live.end();
      }
    }
    json(200, { data: {} });
  }
}
