# `src/mcp/tools.ts`

**Purpose**
This file defines and registers the ten Anvil editor tools exposed over the Model Context Protocol (MCP). It handles tool registration, input validation, path normalization, and gated execution for read, search, write, and command operations.

**Exports**
* registerTools(server: McpServer, host: WorkspaceHost, gate: WriteGate): void (function): Registers all available tools to the MCP server.

**Collaborators**
* Imports:
    * `@modelcontextprotocol/sdk/server/mcp.js`: Provides the `McpServer` type.
    * `zod`: Used for input schema validation.
    * `../core/edits/applyEdit`: Provides `EditError` and `simulateEdit` for write operations.
    * `../core/paths`: Provides `resolveInWorkspace` and `toRelative` for path handling.
    * `./server`: Provides `WorkspaceHost` and `WriteGate` types.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* All paths are validated against the workspace root.
* Errors are returned as `isError` results instead of being thrown.
* `READ_CAP` is set to 24 * 1024 bytes for text output.
* `DEFAULT_WINDOW` is set to 400 lines for file reading.
* `CMD_CAP` is set to 16 * 1024 bytes for command output.
* `repo_map` has a `max_tokens` limit between 100 and 6000.
* `search_code` has a `limit` between 1 and 20.
* `list_files` has a `limit` between 1 and 1000.
* `grep` has a `limit` between 1 and 200.
* `run_command` has a `timeout_sec` capped at 600 seconds.
* `gatedWrite` requires an active Anvil run and a successful user approval via the `WriteGate`.
* `gatedWrite` ensures the file content has not changed between the proposal and the application.
* `capCommandOutput` truncates output to 4096 bytes for the prefix and 12 * 1024 bytes for the suffix.

**Notes**
* `gatedWrite` does not inject defaults into arguments to ensure the approval ledger hash remains valid.
* `numberedWindow` handles trailing empty lines by removing the last line if it is empty.
* `get_diagnostics` limits the output to the first 100 diagnostics.
* `formatHit` limits the displayed text chunk to the first 12 lines.
