import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CodeIndex } from '../core/context/codeIndex';

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

// registers tools
export function createAnvilMcpServer(_host: WorkspaceHost, _gate: WriteGate): McpServer {
  throw new Error('not implemented');
}

export function startBridge(_opts: {
  host: WorkspaceHost;
  gate: WriteGate;
  port: number;
  token: string;
  bind?: string;
}): Promise<{ url: string; port: number; close(): Promise<void> }> {
  throw new Error('not implemented');
}
