# `src/mcp/server.ts`

**Purpose**
The MCP bridge: workspace contracts, a per-request stateless MCP server, and the secured HTTP listener that TrueForge connects to.

**Exports**
- `DiagnosticInfo`: `path`, `line`, `severity` (`error | warning | info`), `message`.
- `WorkspaceHost`: `root`, `index`, `readFile`, `listFiles`, `diagnostics`, `applyWrite` (records into the active run), `runCommand`.
- `WriteGate`: `isRunActive()`, `resolveWrite(tool, args, current, proposed)` (final content or `null` = rejected, plus feedback), `authorizeCommand(args)`.
- `createAnvilMcpServer(host, gate)`: `McpServer` named `anvil-editor` with instructions, tools registered via `registerTools`.
- `startBridge({host, gate, port, token, bind = '127.0.0.1'})`: resolves `{url, port, close()}` with url `http://127.0.0.1:<port>/mcp`.

**Collaborators**
- Imports: `node:http`, MCP SDK server and Streamable HTTP transport, `CodeIndex` (type), `./auth`, `./tools`.
- Used by: `extension.ts`, `host/doctor.ts` (as a client), `host/runController.ts` (implements `WriteGate`).

**Key behaviour and invariants**
- Request checks, in order: path must be `/mcp` (else 404); method must be POST (405, `Allow: POST`); `Origin` must be loopback or absent (403); valid bearer token (401); body at most 1 MiB (413); valid JSON (400). Failures return JSON-RPC style errors; unexpected errors give 500.
- Stateless: each POST builds a fresh MCP server and transport (no session id, JSON responses) and tears them down when the response closes.
- Binds to loopback only. If the port is taken, startup fails with "Port N is in use - change the anvil.mcpPort setting" (the extension detects this as `elsewhere`).
- `close()` destroys all open sockets so the port frees immediately on deactivation.

**Notes**
- Tools themselves live in `mcp/tools.ts`; this file only transports and authenticates.
