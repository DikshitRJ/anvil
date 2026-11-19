# `src/mcp/server.ts`

**Purpose**
This file creates a stateless Model Context Protocol (MCP) server. It provides a secured HTTP listener to handle MCP requests.

**Exports**
* DiagnosticInfo(path: string, line: number, severity: 'error' | 'warning' | 'info', message: string): interface - Defines the structure for diagnostic information.
* WorkspaceHost(readonly root: string, readonly index: CodeIndex, readFile: (rel: string) => Promise<string | null>, listFiles: (dir?: string, glob?: string, limit?: number) => Promise<string[]>, diagnostics: (rel?: string) => Promise<DiagnosticInfo[]>, applyWrite: (rel: string, content: string, summary: string) => Promise<void>, runCommand: (command: string, opts: { cwd?: string; timeoutMs: number }) => Promise<{ exitCode: number | null; output: string; timedOut: boolean }>): interface - Defines the interface for workspace operations.
* WriteGate(isRunActive: () => boolean, resolveWrite: (tool: 'edit_file' | 'write_file', args: Record<string, unknown>, current: string | null, proposed: string) => Promise<{ content: string | null; feedback: string }>, authorizeCommand: (args: Record<string, unknown>) => Promise<boolean>): interface - Defines the interface for write operations and command authorization.
* createAnvilMcpServer(host: WorkspaceHost, gate: WriteGate): McpServer - function - Initializes and returns an MCP server instance with registered tools.
* startBridge(opts: { host: WorkspaceHost; gate: WriteGate; port: number; token: string; bind?: string }): Promise<{ url: string; port: number; close: () => Promise<void> }> - function - Starts the HTTP server and returns the connection details.

**Collaborators**
* Imports: `node:http`, `@modelcontextprotocol/sdk/server/mcp.js`, `@modelcontextprotocol/sdk/server/streamableHttp.js`, `../core/context/codeIndex`, `./auth`, `./tools`.
* Exports: Not visible from this file.

**Key behaviour and invariants**
* The server only accepts POST requests on the `/mcp` path.
* The server rejects requests with a body size larger than 1,048,576 bytes.
* The server requires a valid Bearer token for authorization.
* The server checks the `Origin` header against an allowed list.
* The `close` function destroys all active sockets and shuts down the HTTP server.
* The server returns a 404 status for any path other than `/mcp`.

**Notes**
* The `listen` function throws a specific error if the port is already in use.
* The `resolveWrite` method falls back to an interactive review if the ledger fails.
