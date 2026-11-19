// In-memory WorkspaceHost / WriteGate fakes for MCP bridge tests. They record calls for assertions.
import picomatch from 'picomatch';
import type { CodeIndex } from '../../src/core/context/codeIndex';
import type { DiagnosticInfo, WorkspaceHost, WriteGate } from '../../src/mcp/server';

export interface FakeHost extends WorkspaceHost {
  files: Map<string, string>;
  calls: { readFile: string[]; applyWrite: { rel: string; content: string; summary: string }[]; runCommand: unknown[] };
  nextCommand: { exitCode: number | null; output: string; timedOut: boolean };
}

export function makeFakeHost(initial: Record<string, string> = {}): FakeHost {
  const files = new Map(Object.entries(initial));
  const diagnostics: DiagnosticInfo[] = [{ path: 'a.ts', line: 2, severity: 'error', message: 'boom' }];
  const index = {
    search: (q: string, k = 8) =>
      [...files.entries()]
        .filter(([, t]) => t.includes(q))
        .slice(0, k)
        .map(([path, text]) => ({
          chunk: { id: path, path, startLine: 1, endLine: text.split('\n').length, text },
          score: 7.9,
          matched: [q],
        })),
    findSymbol: (name: string) =>
      name === 'foo'
        ? [{ name, kind: 'function', path: 'a.ts', line: 1, endLine: 3, signature: 'function foo()' }]
        : [],
    grep: (pattern: string) =>
      [...files.entries()].flatMap(([path, t]) =>
        t
          .split('\n')
          .map((text, i) => ({ path, line: i + 1, text }))
          .filter((h) => h.text.includes(pattern)),
      ),
    repoMap: (o?: { maxTokens?: number; focus?: string[] }) =>
      `map max=${o?.maxTokens} focus=${(o?.focus ?? []).join(',')}`,
  } as unknown as CodeIndex;
  const host: FakeHost = {
    root: '/ws',
    index,
    files,
    calls: { readFile: [], applyWrite: [], runCommand: [] },
    nextCommand: { exitCode: 0, output: 'ok', timedOut: false },
    readFile: (rel) => {
      host.calls.readFile.push(rel);
      return Promise.resolve(files.get(rel) ?? null);
    },
    listFiles: (dir, glob, limit = 200) => {
      const match = glob ? picomatch(glob) : () => true;
      const prefix = dir ? `${dir}/` : '';
      const out = [...files.keys()].filter((f) => f.startsWith(prefix) && match(f));
      return Promise.resolve(out.slice(0, limit));
    },
    diagnostics: (rel) => Promise.resolve(rel ? diagnostics.filter((d) => d.path === rel) : diagnostics),
    applyWrite: (rel, content, summary) => {
      host.calls.applyWrite.push({ rel, content, summary });
      files.set(rel, content);
      return Promise.resolve();
    },
    runCommand: (command, opts) => {
      host.calls.runCommand.push({ command, ...opts });
      return Promise.resolve(host.nextCommand);
    },
  };
  return host;
}

export interface FakeGate extends WriteGate {
  active: boolean;
  approveCommands: boolean;
  decide: (
    tool: string,
    args: Record<string, unknown>,
    current: string | null,
    proposed: string,
  ) => { content: string | null; feedback: string };
  calls: {
    resolveWrite: { tool: string; args: Record<string, unknown> }[];
    authorizeCommand: Record<string, unknown>[];
  };
}

export function makeFakeGate(): FakeGate {
  const gate: FakeGate = {
    active: true,
    approveCommands: true,
    decide: (_t, _a, _c, proposed) => ({ content: proposed, feedback: '' }),
    calls: { resolveWrite: [], authorizeCommand: [] },
    isRunActive: () => gate.active,
    resolveWrite: (tool, args, current, proposed) => {
      gate.calls.resolveWrite.push({ tool, args });
      return Promise.resolve(gate.decide(tool, args, current, proposed));
    },
    authorizeCommand: (args) => {
      gate.calls.authorizeCommand.push(args);
      return Promise.resolve(gate.approveCommands);
    },
  };
  return gate;
}
