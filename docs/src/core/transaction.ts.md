# `src/core/transaction.ts`

**Purpose**
Checkpoint store that records every applied edit so a single change or a whole run can be undone safely.

**Exports**
- `FileStore` (interface): `read(rel)` (string or null), `write`, `remove`.
- `AppliedChange`: `seq`, `runId`, `path`, `before` (null if file was created), `after`, `at`, `summary`.
- `RestoreReport`: `restored` and `conflicts` path lists.
- `CheckpointStore`: `record`, `list`, `forRun`, `undo`, `revertRun`, `onChange`.

**Collaborators**
- Imports: none (works through a `FileStore`).
- Used by: run controller (revert on cancel/failure), review controller (undo of single changes), MCP tools (record).

**Key behaviour and invariants**
- `record` assigns `seq` from 1 upward, stamps `at`, updates the per-run base map, then notifies listeners.
- The undo list is capped at `maxEntries` (200, oldest evicted). Base map is capped at `maxBaseRuns` (50 runs, oldest dropped).
- `bases` keeps the first `before` per path per run plus the latest `after`; it survives list eviction, so `revertRun` still restores the true original.
- `undo(seq)`: restores `before` only if the file still equals `after`; otherwise the path is reported as a conflict and left untouched (entry kept). `force` overrides. Unknown `seq` returns an empty report.
- `revertRun(runId)`: per path, compares current content with the latest recorded `after`; a mismatch is a conflict and that path is skipped. Otherwise it restores the base `before` (removes the file if it was null), drops that path's entries and base.
- `restore` deletes the file when `before` is null.
- `onChange` returns an unsubscribe function.

**Notes**
- Conflicts mean the user edited the file after Anvil; nothing is overwritten unless `force` is set.
