// Scripted OpenAI-compatible mock LLM for the TrueForge e2e suite (CI only, no real model, no API keys).
//
// The reply is chosen from the REQUEST CONTENT only, never from a call counter: TrueForge may make extra calls of its
// own (title generation, compaction), and those must not desynchronise the script. The decision logic lives in the pure
// function planReply() so it can be unit-tested without a socket.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';

export const MOCK_MODES = ['script', 'hang'] as const;
export type MockMode = (typeof MOCK_MODES)[number];

export interface MockLlmOptions {
  mode?: MockMode;
  delayMs?: number;
}

export interface ToolDef {
  type?: string;
  function?: ToolFn;
}

export interface ToolFn {
  name?: string;
  arguments?: string;
}

export interface ToolCall {
  id: string;
  type: string;
  function: ToolFn;
}

export interface ChatMessage {
  role: string;
  content?: unknown;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ChatRequest {
  model?: string;
  stream?: boolean;
  stream_options?: { include_usage?: boolean };
  messages?: ChatMessage[];
  tools?: ToolDef[];
}

export interface RecordedRequest {
  method: string;
  path: string;
  body: ChatRequest;
}

export interface TextReply {
  kind: 'text';
  text: string;
}

export interface ToolReply {
  kind: 'tool';
  name: string;
  args: Record<string, unknown>;
}

export type Reply = TextReply | ToolReply;

export interface MockLlm {
  url: string;
  port: number;
  requests: RecordedRequest[];
  toolNamesSeen: Set<string>;
  setMode(mode: MockMode): void;
  setDelay(ms: number): void;
  close(): Promise<void>;
}

export const SELECTION_REPLY = "```python\ndef greet():\n    return 'hi'\n```";
export const FINAL_TEXT = 'Done: updated src/app.py';
export const SEARCH_QUERY = 'greet function';
export const EDIT_OLD = 'return "hello"';
export const EDIT_NEW = 'return "hello, world"';
const MCP_SERVER = 'anvil-editor';
const EMPTY_TEXT = '';
const TEXT_KIND = 'text';
const TOOL_KIND = 'tool';

export function toolCall(name: string, args: Record<string, unknown>): ToolReply {
  return { kind: TOOL_KIND, name, args };
}

export function textReply(text: string): TextReply {
  return { kind: TEXT_KIND, text };
}
const NO_TOOL = 'none';
const DEFERRED = 'call_tool';

const toolNameOf = (t: ToolDef): string => t.function?.name ?? NO_TOOL;

export function resolveTool(tools: ToolDef[], wanted: string, args: Record<string, unknown>): ToolReply {
  const names = tools.map(toolNameOf);
  const direct = names.find((n) => (n === wanted ? true : n.endsWith(wanted)));
  if (direct === undefined) {
    return names.includes(DEFERRED) ? deferredCall(wanted, args) : toolCall(NO_TOOL, args);
  }
  return toolCall(direct, args);
}

export function deferredCall(wanted: string, args: Record<string, unknown>): ToolReply {
  return toolCall(DEFERRED, { mcp_server: MCP_SERVER, tool_name: wanted, input: args });
}

export function callNames(messages: ChatMessage[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of messages) {
    for (const tc of m.tool_calls ?? []) {
      out.set(tc.id, bareName(effectiveName(tc)));
    }
  }
  return out;
}

// Strips a namespace prefix such as mcp__anvil-editor__ so names compare as bare tool names.
function bareName(name: string): string {
  const parts = name.split('__');
  return parts[parts.length - 1] ?? name;
}

function effectiveName(tc: ToolCall): string {
  const raw = tc.function.name ?? NO_TOOL;
  if (raw !== DEFERRED) return raw;
  return deferredTarget(tc.function.arguments ?? '{}', raw);
}

function deferredTarget(args: string, fallback: string): string {
  try {
    const parsed = JSON.parse(args) as { tool_name?: string };
    return parsed.tool_name === undefined ? fallback : parsed.tool_name;
  } catch {
    return fallback;
  }
}

export function lastUserText(messages: ChatMessage[]): string {
  const users = messages.filter((m) => m.role === 'user');
  const last = users[users.length - 1];
  return last === undefined ? EMPTY_TEXT : textOf(last.content);
}

export const SEARCH_ARGS: Record<string, unknown> = { query: SEARCH_QUERY };
export const EDIT_ARGS: Record<string, unknown> = { path: 'src/app.py', old_string: EDIT_OLD, new_string: EDIT_NEW };

function answeredNames(messages: ChatMessage[], names: Map<string, string>): string[] {
  const out: string[] = [];
  for (const m of messages) {
    if (m.role === 'tool' && m.tool_call_id !== undefined) out.push(names.get(m.tool_call_id) ?? NO_TOOL);
  }
  return out;
}

// True when the request offers any Anvil tool (search_code, edit_file, or the deferred call_tool). TrueForge adds its
// own platform tools to requests even for agents without MCP servers, so 'any tool' is the wrong test.
export function offersAnvilTools(tools: ToolDef[]): boolean {
  const wanted = ['search_code', 'edit_file', DEFERRED];
  return tools.map(toolNameOf).some((n) => wanted.some((w) => n.endsWith(w)));
}

export function planReply(req: ChatRequest): Reply {
  const messages = req.messages ?? [];
  const tools = req.tools ?? [];
  if (!offersAnvilTools(tools)) {
    const text = lastUserText(messages);
    return textReply(text.includes('SELECTION') ? SELECTION_REPLY : 'ok');
  }
  const answered = answeredNames(messages, callNames(messages));
  if (answered.includes('edit_file')) return textReply(FINAL_TEXT);
  const next = answered.includes('search_code')
    ? resolveTool(tools, 'edit_file', EDIT_ARGS)
    : resolveTool(tools, 'search_code', SEARCH_ARGS);
  if (next.name === NO_TOOL) return textReply(`no tool offered for step ${next.name}`);
  return next;
}

// Splits text into fragments of at most size characters.
function fragments(s: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}

const usage = () => ({ prompt_tokens: 120, completion_tokens: 40, total_tokens: 160 });

function writeStream(res: ServerResponse, reply: Reply, req: ChatRequest, id: string): void {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  const created = Math.floor(Date.now() / 1000);
  const model = req.model ?? 'mock-coder';
  const send = (choices: unknown[], extra: Record<string, unknown> = {}) => {
    const chunk = { id, object: 'chat.completion.chunk', created, model, choices, ...extra };
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  };
  send([{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }]);
  if (reply.kind === 'text') {
    for (const piece of fragments(reply.text, 16)) send([{ index: 0, delta: { content: piece }, finish_reason: null }]);
    send([{ index: 0, delta: {}, finish_reason: 'stop' }]);
  } else {
    writeToolCall(send, reply, id);
  }
  if (req.stream_options?.include_usage) send([], { usage: usage() });
  res.write('data: [DONE]\n\n');
  res.end();
}

type Send = (choices: unknown[]) => void;

// Streams one tool call: a header fragment with the name, then at least two argument fragments.
function writeToolCall(send: Send, reply: ToolReply, id: string): void {
  const args = JSON.stringify(reply.args);
  const header = { index: 0, id: `call_${id}`, type: 'function', function: { name: reply.name, arguments: '' } };
  send([{ index: 0, delta: { tool_calls: [header] }, finish_reason: null }]);
  for (const frag of fragments(args, Math.max(1, Math.ceil(args.length / 3)))) {
    send([{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: frag } }] }, finish_reason: null }]);
  }
  send([{ index: 0, delta: {}, finish_reason: 'tool_calls' }]);
}

function writeJson(res: ServerResponse, reply: Reply, req: ChatRequest, id: string): void {
  const message = reply.kind === 'text' ? { role: 'assistant', content: reply.text } : toolMessage(reply, id);
  const finish = reply.kind === 'text' ? 'stop' : 'tool_calls';
  const body = {
    id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: req.model ?? 'mock-coder',
    choices: [{ index: 0, message, finish_reason: finish }],
    usage: usage(),
  };
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function toolMessage(reply: ToolReply, id: string) {
  const fn = { name: reply.name, arguments: JSON.stringify(reply.args) };
  return { role: 'assistant', content: null, tool_calls: [{ id: `call_${id}`, type: 'function', function: fn }] };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

// Names of the tools offered in a request (namespaced names as sent, or the meta tool name).
function offeredNames(req: ChatRequest): string[] {
  return (req.tools ?? []).map((t) => t.function?.name ?? t.type ?? NO_TOOL);
}

export const EMPTY = '';

function partText(part: unknown): string {
  if (typeof part !== 'object' || part === null) return EMPTY;
  const text = (part as { text?: unknown }).text;
  return typeof text === 'string' ? text : EMPTY;
}

export function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(partText).join(EMPTY);
  return EMPTY;
}

export async function startMockLlm(opts: MockLlmOptions = {}): Promise<MockLlm> {
  let mode: MockMode = opts.mode ?? 'script';
  let delayMs = opts.delayMs ?? 0;
  let seq = 0;
  const requests: RecordedRequest[] = [];
  const toolNamesSeen = new Set<string>();
  const sockets = new Set<Socket>();

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const path = (req.url ?? '').split('?')[0] ?? '';
    if (req.method === 'GET' && path === '/v1/models') {
      return sendJson(res, 200, { object: 'list', data: [{ id: 'mock-coder', object: 'model', owned_by: 'mock' }] });
    }
    const isChat = path === '/v1/chat/completions' || path === '/chat/completions';
    if (req.method !== 'POST' || !isChat) {
      res.writeHead(404);
      res.end();
      return;
    }
    const raw = await readBody(req);
    const body = (raw === '' ? {} : JSON.parse(raw)) as ChatRequest;
    requests.push({ method: req.method, path, body });
    for (const name of offeredNames(body)) {
      if (!toolNamesSeen.has(name)) {
        toolNamesSeen.add(name);
        console.log(`[mock-llm] tool offered: ${name}`);
      }
    }
    if (mode === 'hang') return;
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    if (res.destroyed) return;
    seq++;
    const id = `chatcmpl-mock-${seq}`;
    const reply = planReply(body);
    if (body.stream) writeStream(res, reply, body, id);
    else writeJson(res, reply, body, id);
  }

  const server = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  server.on('connection', (s: Socket) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;

  return {
    url: `http://127.0.0.1:${port}/v1`,
    port,
    requests,
    toolNamesSeen,
    setMode: (m: MockMode) => {
      mode = m;
    },
    setDelay: (ms: number) => {
      delayMs = ms;
    },
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => resolve());
      }),
  };
}
