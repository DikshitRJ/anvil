// The ten Anvil editor tools exposed over MCP. Every path is validated against the workspace root; errors are
// returned as isError results, never thrown.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { EditError, simulateEdit } from '../core/edits/applyEdit';
import { resolveInWorkspace, toRelative } from '../core/paths';
import type { WorkspaceHost, WriteGate } from './server';

type Result = { isError?: true; content: { type: 'text'; text: string }[] };

const ok = (text: string): Result => ({ content: [{ type: 'text', text }] });
const fail = (text: string): Result => ({ isError: true, content: [{ type: 'text', text }] });

const READ_CAP = 16 * 1024;
const DEFAULT_WINDOW = 250;
const CMD_CAP = 16 * 1024;

// validates a workspace path and returns its relative POSIX form
function relPath(host: WorkspaceHost, p: string): string {
  return toRelative(host.root, resolveInWorkspace(host.root, p));
}

function guarded<A>(fn: (args: A) => Promise<Result>): (args: A) => Promise<Result> {
  return async (args) => {
    try {
      return await fn(args);
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  };
}

function capText(text: string, cap: number): string {
  if (text.length <= cap) return text;
  return `${text.slice(0, cap)}\n… [output truncated at ${cap} bytes]`;
}

function numberedWindow(rel: string, content: string, start?: number, end?: number): string {
  const lines = content.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  const total = lines.length;
  const a = Math.max(1, start ?? 1);
  const explicitEnd = end !== undefined;
  const b = Math.min(total, explicitEnd ? end : a + DEFAULT_WINDOW - 1);
  const body = lines
    .slice(a - 1, b)
    .map((l, i) => `${String(a + i).padStart(5)}| ${l}`)
    .join('\n');
  let out = `${rel} (lines ${a}-${b} of ${total})\n${body}`;
  if (!explicitEnd && b < total) {
    out += `\n… truncated (${total} lines total); call read_file with start_line=${b + 1} to continue`;
  }
  return capText(out, READ_CAP);
}

function capCommandOutput(output: string): string {
  if (output.length <= CMD_CAP) return output;
  return `${output.slice(0, 4096)}\n… [output truncated] …\n${output.slice(-12 * 1024)}`;
}

const RO = { readOnlyHint: true } as const;

function registerReadTools(server: McpServer, host: WorkspaceHost): void {
  server.registerTool(
    'read_file',
    {
      title: 'Read file',
      description: 'Read a workspace file with line numbers. Optional 1-based start_line/end_line window.',
      inputSchema: {
        path: z.string(),
        start_line: z.number().int().min(1).optional(),
        end_line: z.number().int().min(1).optional(),
      },
      annotations: RO,
    },
    guarded(async ({ path, start_line, end_line }) => {
      const rel = relPath(host, path);
      const content = await host.readFile(rel);
      if (content === null) {
        return fail(`File not found: ${rel}. Use list_files or search_code to locate files.`);
      }
      return ok(numberedWindow(rel, content, start_line, end_line));
    }),
  );
  server.registerTool(
    'list_files',
    {
      title: 'List files',
      description: 'List workspace files, optionally under a directory and filtered by a glob pattern.',
      inputSchema: {
        path: z.string().optional(),
        pattern: z.string().optional(),
        limit: z.number().int().min(1).max(1000).optional(),
      },
      annotations: RO,
    },
    guarded(async ({ path, pattern, limit }) => {
      const dir = path ? relPath(host, path) : undefined;
      const files = await host.listFiles(dir, pattern, limit ?? 200);
      return ok(`${files.join('\n')}\n(${files.length} files)`);
    }),
  );
  server.registerTool(
    'get_diagnostics',
    {
      title: 'Get diagnostics',
      description: 'Errors and warnings reported by the editor, for one file or the whole workspace.',
      inputSchema: { path: z.string().optional() },
      annotations: RO,
    },
    guarded(async ({ path }) => {
      const list = await host.diagnostics(path ? relPath(host, path) : undefined);
      if (list.length === 0) return ok('No diagnostics.');
      return ok(
        list
          .slice(0, 100)
          .map((d) => `${d.path}:${d.line} ${d.severity}: ${d.message}`)
          .join('\n'),
      );
    }),
  );
}

function formatHit(h: {
  chunk: { path: string; startLine: number; endLine: number; text: string };
  score: number;
  matched: string[];
}): string {
  const { chunk } = h;
  const lines = chunk.text.split('\n');
  const text = lines.slice(0, 12).join('\n') + (lines.length > 12 ? '\n…' : '');
  const head = `## ${chunk.path}:${chunk.startLine}-${chunk.endLine}  (score ${h.score.toFixed(1)}; matched: ${h.matched.join(', ')})`;
  return `${head}\n${text}`;
}

function registerSearchTools(server: McpServer, host: WorkspaceHost): void {
  server.registerTool(
    'search_code',
    {
      title: 'Search code',
      description: 'Ranked semantic/keyword search over the workspace index. Returns matching code chunks.',
      inputSchema: { query: z.string(), limit: z.number().int().min(1).max(20).optional() },
      annotations: RO,
    },
    guarded(async ({ query, limit }) => {
      const hits = host.index.search(query, limit ?? 8);
      if (hits.length === 0) return ok('No matches. Try grep or different terms.');
      return ok(hits.map(formatHit).join('\n\n'));
    }),
  );
  server.registerTool(
    'grep',
    {
      title: 'Grep',
      description: 'Regex search over workspace files. Returns path:line: text.',
      inputSchema: {
        pattern: z.string(),
        glob: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        ignore_case: z.boolean().optional(),
      },
      annotations: RO,
    },
    guarded(async ({ pattern, glob, limit, ignore_case }) => {
      const hits = host.index.grep(pattern, { glob, limit: limit ?? 50, ignoreCase: ignore_case });
      if (hits.length === 0) return ok('No matches.');
      return ok(hits.map((h) => `${h.path}:${h.line}: ${h.text}`).join('\n'));
    }),
  );
  server.registerTool(
    'find_symbol',
    {
      title: 'Find symbol',
      description: 'Find definitions of a symbol by name, optionally filtered by kind.',
      inputSchema: { name: z.string(), kind: z.string().optional() },
      annotations: RO,
    },
    guarded(async ({ name, kind }) => {
      const syms = host.index.findSymbol(name, kind);
      if (syms.length === 0) return ok(`No symbol named ${name}. Try search_code.`);
      return ok(syms.map((s) => `${s.kind} ${s.name} — ${s.path}:${s.line}  ${s.signature}`).join('\n'));
    }),
  );
  server.registerTool(
    'repo_map',
    {
      title: 'Repo map',
      description: 'Compact map of the repository structure and key symbols within a token budget.',
      inputSchema: {
        path: z.string().optional(),
        max_tokens: z.number().int().min(100).max(6000).optional(),
      },
      annotations: RO,
    },
    guarded(async ({ path, max_tokens }) => {
      const focus = path ? [relPath(host, path)] : undefined;
      return ok(host.index.repoMap({ maxTokens: max_tokens ?? 1500, focus }));
    }),
  );
}

// Applies a proposed write through the gate. `args` is the validated input exactly as received: the approval
// ledger key is a hash of these args and must match what TrueForge showed in its approval event, so no defaults
// are ever injected (hence no zod `.default()` on these tools' fields).
async function gatedWrite(
  host: WorkspaceHost,
  gate: WriteGate,
  tool: 'edit_file' | 'write_file',
  args: Record<string, unknown>,
  build: (rel: string, current: string | null) => string,
): Promise<Result> {
  if (!gate.isRunActive()) return fail('No active Anvil run — edits are refused.');
  const rel = relPath(host, args.path as string);
  const current = await host.readFile(rel);
  let proposed: string;
  try {
    proposed = build(rel, current);
  } catch (e) {
    if (e instanceof EditError) return fail(`${e.code}: ${e.message}`);
    throw e;
  }
  const { content, feedback } = await gate.resolveWrite(tool, args, current, proposed);
  if (content === null) return ok(`The user rejected this edit. ${feedback}`.trim());
  if ((await host.readFile(rel)) !== current) {
    return ok('The file changed while the review was open; re-read it and propose the edit again.');
  }
  await host.applyWrite(rel, content, `${tool} ${rel}`);
  return ok(`Applied edit to ${rel}. ${feedback}`.trim());
}

function registerWriteTools(server: McpServer, host: WorkspaceHost, gate: WriteGate): void {
  const annotations = { readOnlyHint: false, destructiveHint: false } as const;
  server.registerTool(
    'edit_file',
    {
      title: 'Edit file',
      description:
        'Replace old_string with new_string in a file (must match exactly once unless replace_all). The user reviews the change.',
      inputSchema: {
        path: z.string(),
        old_string: z.string(),
        new_string: z.string(),
        replace_all: z.boolean().optional(),
      },
      annotations,
    },
    guarded((args) =>
      gatedWrite(host, gate, 'edit_file', args, (rel, current) =>
        simulateEdit(current, {
          kind: 'replace',
          path: rel,
          oldString: args.old_string,
          newString: args.new_string,
          replaceAll: args.replace_all,
        }),
      ),
    ),
  );
  server.registerTool(
    'write_file',
    {
      title: 'Write file',
      description: 'Create or overwrite a file with the given content. The user reviews the change.',
      inputSchema: { path: z.string(), content: z.string() },
      annotations,
    },
    guarded((args) =>
      gatedWrite(host, gate, 'write_file', args, (rel) =>
        simulateEdit(null, { kind: 'write', path: rel, content: args.content }),
      ),
    ),
  );
}

function registerRunCommand(server: McpServer, host: WorkspaceHost, gate: WriteGate): void {
  server.registerTool(
    'run_command',
    {
      title: 'Run command',
      description: 'Run a shell command in the workspace. The user must approve it first.',
      inputSchema: {
        command: z.string(),
        cwd: z.string().optional(),
        timeout_sec: z.number().int().min(1).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    guarded(async (args) => {
      if (!gate.isRunActive()) return fail('No active Anvil run — commands are refused.');
      const cwd = args.cwd ? relPath(host, args.cwd) : undefined;
      // args passed untouched: see gatedWrite for why.
      if (!(await gate.authorizeCommand(args))) return fail('The user did not approve this command.');
      const timeoutMs = Math.min(args.timeout_sec ?? host.defaultCommandTimeoutSec ?? 120, 600) * 1000;
      const r = await host.runCommand(args.command, { cwd, timeoutMs });
      const status = `exit code: ${r.exitCode}${r.timedOut ? ' (timed out)' : ''}`;
      return ok(`$ ${args.command}\n${status}\n${capCommandOutput(r.output)}`);
    }),
  );
}

export function registerTools(server: McpServer, host: WorkspaceHost, gate: WriteGate): void {
  registerReadTools(server, host);
  registerSearchTools(server, host);
  registerWriteTools(server, host, gate);
  registerRunCommand(server, host, gate);
}
