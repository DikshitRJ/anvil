import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WorkspaceHost, WriteGate } from './server';

export function registerTools(_server: McpServer, _host: WorkspaceHost, _gate: WriteGate): void {
  throw new Error('not implemented');
}
