// MCP bridge: workspace contracts, per-request stateless MCP server, and the secured HTTP listener.
import http from 'node:http';
import type { Socket } from 'node:net';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { CodeIndex } from '../core/context/codeIndex';
import { checkBearer, isAllowedOrigin } from './auth';
import { registerTools } from './tools';

export interface DiagnosticInfo {
  path: string;
  line: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface WorkspaceHost {
  readonly root: string;
  readonly index: CodeIndex;
  readFile(rel: string): Promise<string | null>;
  listFiles(dir?: string, glob?: string, limit?: number): Promise<string[]>;
  diagnostics(rel?: string): Promise<DiagnosticInfo[]>;
  // records into the active run transaction
  applyWrite(rel: string, content: string, summary: string): Promise<void>;
  runCommand(
    command: string,
    opts: { cwd?: string; timeoutMs: number },
  ): Promise<{ exitCode: number | null; output: string; timedOut: boolean }>;
}

export interface WriteGate {
  isRunActive(): boolean;
  // returns final content to write (null = rejected) plus feedback for the agent. Uses the ledger; falls back to an
  // interactive review.
  resolveWrite(
    tool: 'edit_file' | 'write_file',
    args: Record<string, unknown>,
    current: string | null,
    proposed: string,
  ): Promise<{ content: string | null; feedback: string }>;
  authorizeCommand(args: Record<string, unknown>): Promise<boolean>;
}

const MAX_BODY = 1024 * 1024;

// registers tools
export function createAnvilMcpServer(host: WorkspaceHost, gate: WriteGate): McpServer {
  const server = new McpServer(
    { name: 'anvil-editor', version: '0.1.0' },
    {
      instructions:
        "Anvil editor tools for the user's VS Code workspace. Paths are workspace-relative. " +
        'Write tools (edit_file, write_file, run_command) are reviewed hunk by hunk by the user, who may edit or reject them.',
    },
  );
  registerTools(server, host, gate);
  return server;
}

function sendJson(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  if (res.headersSent) return;
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}

function rpcError(code: number, message: string): unknown {
  return { jsonrpc: '2.0', error: { code, message }, id: null };
}

class BodyTooLarge extends Error {}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new BodyTooLarge());
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function serveMcp(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  host: WorkspaceHost,
  gate: WriteGate,
  body: unknown,
): Promise<void> {
  const server = createAnvilMcpServer(host, gate);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}

async function handle(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: { host: WorkspaceHost; gate: WriteGate; token: string },
): Promise<void> {
  const path = (req.url ?? '').split('?')[0];
  if (path !== '/mcp') return sendJson(res, 404, rpcError(-32000, 'Not found'));
  if (req.method !== 'POST') {
    return sendJson(res, 405, rpcError(-32000, 'Method not allowed'), { allow: 'POST' });
  }
  if (!isAllowedOrigin(req.headers.origin)) {
    return sendJson(res, 403, rpcError(-32002, 'Forbidden origin'));
  }
  if (!checkBearer(req.headers.authorization, opts.token)) {
    return sendJson(res, 401, rpcError(-32001, 'Unauthorized'));
  }
  let raw: string;
  try {
    raw = await readBody(req);
  } catch (e) {
    if (e instanceof BodyTooLarge) return sendJson(res, 413, rpcError(-32000, 'Payload too large'));
    throw e;
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return sendJson(res, 400, rpcError(-32700, 'Parse error'));
  }
  await serveMcp(req, res, opts.host, opts.gate, body);
}

function listen(srv: http.Server, port: number, bind: string): Promise<number> {
  return new Promise((resolve, reject) => {
    srv.once('error', (err: NodeJS.ErrnoException) => {
      reject(
        err.code === 'EADDRINUSE' ? new Error(`Port ${port} is in use — change the "anvil.mcpPort" setting.`) : err,
      );
    });
    srv.listen(port, bind, () => {
      const addr = srv.address();
      resolve(typeof addr === 'object' && addr ? addr.port : port);
    });
  });
}

export async function startBridge(opts: {
  host: WorkspaceHost;
  gate: WriteGate;
  port: number;
  token: string;
  bind?: string;
}): Promise<{ url: string; port: number; close(): Promise<void> }> {
  const sockets = new Set<Socket>();
  const srv = http.createServer((req, res) => {
    handle(req, res, opts).catch(() => sendJson(res, 500, rpcError(-32603, 'Internal error')));
  });
  srv.on('connection', (s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });
  const port = await listen(srv, opts.port, opts.bind ?? '127.0.0.1');
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    port,
    close: () =>
      new Promise<void>((resolve) => {
        srv.close(() => resolve());
        for (const s of sockets) s.destroy();
      }),
  };
}
