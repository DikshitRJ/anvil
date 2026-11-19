# `src/mcp/tools.ts`

**Purpose**
This file registers Model Context Protocol (MCP) tools for the Anvil editor. It provides functions for reading files, searching code, editing files, and running commands.

**Exports**
* registerTools(server: McpServer, host: WorkspaceHost, gate: WriteGate): void - function - Registers all available read, search, write, and command tools to the MCP server.

**Collaborators**
* Imports: `@modelcontextprotocol/sdk/server/mcp.js`, `zod`, `../core/edits/applyEdit`, `../core/paths`, `./server`.
* Exports: Not visible from this file.

**Key behaviour and invariants**
* All file paths are validated against the workspace root.
* Tools return results as `isError` objects instead of throwing exceptions.
* `read_file` returns a numbered window of text.
* `read_file` and `list_files` are marked as read-only.
* `edit_file` and `write_file` require an active Anvil run and user approval via a gate.
* `run_command` requires an active Anvil run and user approval via a gate.
* Command output is truncated if it exceeds the `CMD_CAP` limit.
* File content is truncated if it exceeds the `READ_CAP` limit.
* `search_code` results are limited to a maximum of 20 hits.
* `get_diagnostics` returns a maximum of 100 diagnostics.
