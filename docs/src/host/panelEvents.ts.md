# `src/host/panelEvents.ts`

**Purpose**
Pure (vscode-free) helpers for the panel: turn `TurnView` snapshots into incremental protocol messages, summarise tool calls, rank `@` mention candidates, and filter ignored paths.

**Exports**
- `summarizeTool(tool, input)`: one-line text such as `search_code "q"`, `read_file path:1-400`, `edit_file path`.
- `TurnSnapshot`, `emptySnapshot()`, `diffTurn(runId, prev, view)`.
- `MentionItem`, `fileScore(path, query)`, `matchMentions(query, files, findSymbol, limit = 20)`.
- `isIgnoredPath(rel)`, `reviewOutcome(accepted, total, applied)`.

**Collaborators**
- Imports: `core/agent/events` (types), `core/context/types` (`SymbolInfo`), `panel/protocol` (`HostToWebview`).
- Used by: `runController.ts`, `approvalFlow.ts`, `indexService.ts`, and the mention queries answered for the panel.

**Key behaviour and invariants**
- `summarizeTool` knows `search_code`, `grep`, `find_symbol`, `read_file` (with line range), `edit_file`, `write_file`, `run_command`, `list_files`, `diagnostics`; quoted strings longer than 80 characters are cut to 77 plus `...`; unknown tools show their name only.
- `diffTurn` compares against the previous snapshot and emits only changed threads (title/status), messages (content) and tool calls (status, result length, summary), updating `prev` in place. Tool results sent to the webview are cut to 1500 characters.
- `fileScore` (lower is better, -1 no match): basename prefix 0, basename substring 1, path substring 2, subsequence 3; an empty query scores 4.
- `matchMentions`: files first (by score, then shorter path, then alphabetical), up to `limit`; remaining room is filled with symbols (only when the query is non-empty), de-duplicated by name and path, inserted as `@#name`.
- `isIgnoredPath`: true if any path segment is one of: the VCS folder, `node_modules`, `dist`, `build`, `out`, `.venv`, `venv`, `__pycache__`, `.claude`, `coverage`.
- `reviewOutcome`: `rejected` when nothing was applied, `accepted all N hunk(s)` or `accepted A/N hunks`.

**Notes**
- No state besides the snapshot passed in, so it is easy to unit test.

- File autocomplete uses `formatFileMention`, making paths with whitespace, quotes, backslashes, or trailing punctuation round-trip through pin parsing.
