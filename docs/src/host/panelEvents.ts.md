# `src/host/panelEvents.ts`

**Purpose**
This file provides pure helper functions for the panel UI. It handles converting TurnView snapshots into protocol messages, summarizing tool calls, and matching @-mention queries.

**Exports**
* summarizeTool(tool: string, input: Record<string, unknown>): string (function): Generates a one-line description of a tool call.
* TurnSnapshot (interface): Defines the structure for a snapshot of messages, tools, and threads.
* emptySnapshot(): TurnSnapshot (function): Returns a new TurnSnapshot with empty maps.
* diffTurn(runId: string, prev: TurnSnapshot, view: TurnView): HostToWebview[] (function): Compares a previous snapshot with a new view and returns messages for changed entries.
* MentionItem (interface): Defines the structure for a mention candidate.
* fileScore(path: string, query: string): number (function): Calculates a ranking score for a file path against a query.
* matchMentions(query: string, files: readonly string[], findSymbol: (prefix: string) => SymbolInfo[], limit?: number): MentionItem[] (function): Returns a ranked list of file and symbol mention candidates.
* isIgnoredPath(rel: string): boolean (function): Checks if a path contains any segments from a default ignored set.
* reviewOutcome(accepted: number, total: number, applied: boolean): string (function): Returns a summary string for a review result.

**Collaborators**
* Imports:
    * `../core/agent/events`: Provides `MessageView`, `ThreadView`, `ToolCallView`, and `TurnView` types.
    * `../core/context/types`: Provides `SymbolInfo` type.
    * `../panel/protocol`: Provides `HostToWebview` type.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* `summarizeTool` uses a `q` helper to wrap strings in quotes and truncate them to 77 characters if they exceed 80 characters.
* `toolMessage` truncates the `result` field to a maximum of `RESULT_PREVIEW` (1500) characters.
* `diffTurn` updates the `prev` snapshot object in place.
* `fileScore` returns 0 for basename prefix matches, 1 for basename substring matches, 2 for path substring matches, and 3 for subsequence matches.
* `matchMentions` prioritizes files over symbols and limits the total results to `limit` (default 20).
* `isIgnoredPath` checks against a hardcoded set of 10 ignored segments including `.git`, `node_modules`, and `__pycache__`.
* `reviewOutcome` returns "rejected" if `applied` is false.

**Notes**
* `summarizeTool` handles various tool types including `search_code`, `grep`, `find_symbol`, `read_file`, `edit_file`, `write_file`, `run_command`, `list_files`, and `diagnostics`.
* `fileScore` returns -1 if no match is found.
* `matchMentions` uses a `Set` to ensure unique symbol keys based on name and path.
