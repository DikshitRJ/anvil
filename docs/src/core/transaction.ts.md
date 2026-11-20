# `src/core/transaction.ts`

**Purpose**
This file manages a checkpoint store to record applied edits for undo and revert operations. It tracks changes, maintains base states for runs, and handles restoration of file content.

**Exports**
* FileStore (interface): Defines methods for reading, writing, and removing file content.
* AppliedChange (interface): Represents a single recorded change with sequence, run ID, path, and content states.
* RestoreReport (interface): Contains lists of restored paths and paths with conflicts.
* CheckpointStore (class): Manages the collection of changes, base states, and provides undo/revert logic.

**Collaborators**
* Imports: Not visible from this file.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* `CheckpointStore` limits `entries` to a maximum of `maxEntries` (default 200) by shifting the oldest entries.
* `CheckpointStore` limits `bases` to a maximum of `maxBaseRuns` (default 50) by deleting the oldest run.
* `record` assigns a monotonically increasing `nextSeq` starting at 1 and captures the current timestamp as `at`.
* `record` stores the first `before` value per path per run in the `bases` map to ensure true base restoration.
* `undo` only restores a path if the current content matches the `after` state or if `force` is true.
* `revertRun` processes changes in reverse order and identifies the target state based on the `bases` map or the earliest `before` value.
* `onChange` registers a listener and returns a function to remove that listener.

**Notes**
* `undo` returns an empty `RestoreReport` if the sequence number is not found.
* `restore` performs a `store.remove` if the `before` value is `null`.
* `emit` executes all registered listeners in the `listeners` set.
* `drop` removes specific entries from the `entries` array based on a set of sequence numbers.
