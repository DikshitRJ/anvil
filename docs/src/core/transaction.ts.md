# `src/core/transaction.ts`

**Purpose**
This file manages a checkpoint store for file edits. It allows the system to undo single changes or entire runs of changes.

**Exports**
* FileStore(rel: string): Promise<string | null> - interface: Defines methods to read, write, and remove files.
* AppliedChange(seq: number, runId: string, path: string, before: string | null, after: string, at: number, summary: string): object - interface: Represents a single recorded change.
* RestoreReport(restored: string[], conflicts: string[]): object - interface: Contains the results of a restore or revert operation.
* CheckpointStore(store: FileStore, maxEntries: number): class: Manages a list of applied changes and provides methods to undo or revert them.

**Collaborators**
Imports: Not visible from this file.
Exports: Not visible from this file.

**Key behaviour and invariants**
* The store keeps a maximum of 200 entries.
* The `undo` method skips a change if the current file content does not match the recorded `after` value, unless the `force` option is true.
* The `revertRun` method processes changes in reverse order.
* The `revertRun` method restores the earliest `before` state for each file in a run.
* The `drop` method removes entries from the internal list when a restore succeeds.
* The `emit` method notifies all registered listeners after a change or restore.

**Notes**
* If `before` is null, the `restore` method removes the file.
* The `onChange` method returns a function to remove the listener.
