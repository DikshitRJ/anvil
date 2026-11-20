# `src/mcp/tools.ts`

**Purpose**
Defines and registers the ten Anvil editor tools exposed over MCP: `read_file`, `list_files`, `get_diagnostics`, `search_code`, `grep`, `find_symbol`, `repo_map`, `edit_file`, `write_file`, `run_command`.

**Exports**
- `registerTools(server, host, gate)`.

**Collaborators**
- Imports: MCP SDK `McpServer` (type), `zod`, `../core/edits/applyEdit`, `../core/paths`, `./server` types.
- Used by: `mcp/server.ts`.

**Key behaviour and invariants**
- Every path goes through `resolveInWorkspace`; every handler is wrapped by `guarded`, so errors come back as `isError` text results, never thrown.
- Read tools (marked read-only): `read_file` returns numbered lines (default window 400 lines, optional 1-based `start_line`/`end_line`, output capped at 24 KB, with a hint to continue); a missing file suggests `list_files`/`search_code`. `list_files` default limit 200 (max 1000) uses the index. `get_diagnostics` shows at most the first 100. `search_code` (limit 1-20, default 8) prints chunks clipped to 12 lines with score and matched terms. `grep` (limit 1-200, default 50, optional `ignore_case`) prints `path:line: text`. `find_symbol` lists definitions. `repo_map` takes `max_tokens` 100-6000 (default 1500), optionally focused on a path.
- Write tools go through `gatedWrite`: refuse with "No active Anvil run" if no run is active; simulate the edit (an `EditError` becomes `CODE: message`); ask `gate.resolveWrite` for the final content. A rejection returns the user's feedback as a normal (non-error) result starting "The user rejected this edit." Before applying it re-reads the file and, if it changed during review, returns "The file changed while the review was open; re-read it and propose the edit again." without writing. Otherwise `host.applyWrite` (which records a checkpoint) and the result includes the user's feedback (e.g. which hunks were rejected).
- The `args` object is passed to the gate exactly as received, with no defaults injected (no zod `.default()`), because the approval ledger key is a hash of those args and must equal what TrueForge showed in its approval event.
- `run_command`: refused without an active run; the `cwd` is validated; `gate.authorizeCommand` must approve (else "The user did not approve this command."); the timeout is `timeout_sec` (default 120) capped at 600 s; output is `$ command`, the exit code (and "timed out"), then output; outputs over 16 KB keep the first 4 KB and last 12 KB.

**Notes**
- `edit_file` and `write_file` are annotated non-destructive (the user reviews them); `run_command` is annotated destructive.
- The `anvil.commandTimeoutSec` setting is not read here; the default in this file is 120 s.
