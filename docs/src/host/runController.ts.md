# `src/host/runController.ts`

**Purpose**
Owns the chat `AnvilSession`, the checkpoint store and the active run. Handles panel messages, builds the context-augmented prompt, and implements `WriteGate` so the MCP bridge routes every write and command through review/approval.

**Exports**
- `RunDeps`: `root`, `getConfig`, `getClient`, `getAgents`, `getIndex`, `readFile`, `review`, `commands`, `statusBar`, `post`, `initMessage`, `healthMessage`, `runDoctor`, `log`.
- `RunController` (implements `WriteGate`): `checkpoints`, `sessionId`, `isRunActive`, `isBusy`, `resolveWrite`, `authorizeCommand`, `applyWrite`, `applyStandalone`, `runCommand`, `onPanelMessage`, `startRun`, `newSession`, `cancel`, `newChat`, `resetSessionIfIdle`, `undo`, `undoLast`, `revertRun`, `trackSaved`, `postChanges`, `notice`, `dispose`.

**Collaborators**
- Imports: `vscode`, TrueForge SDK type, `core/agent/fallback` (`ModelRelay`), `core/context/*` (assemble, mentions, types), `core/config`, `core/paths`, `core/transaction`, `mcp/server` types, `panel/protocol`, `trueforge/session`, `trueforge/spec`, `./approvalFlow`, `./commandRunner`, `./fileStore`, `./panelEvents`, `./reviewController`, `./statusBar`.
- Used by: `extension.ts` (also the `gate` given to the MCP bridge).

**Key behaviour and invariants**
- One run at a time: `startRun` refuses while `active` is set ("A run is already in progress") and errors if `anvil.models` is empty. Each run gets a run id; `anvil.running` and the status bar are set for its duration, and `flow.clear()` runs afterwards.
- `isRunActive` is true only while a run exists and is not cancelled. `applyWrite` and `runCommand` throw ("Run is not active") otherwise, so a cancelled run cannot write or execute. `applyStandalone` (inline edit) refuses if the file differs from the reviewed `before`, writing nothing.
- Every write goes `fileStore.write` then `checkpoints.record` with the post-save text (VS Code may normalise EOLs), under the run id (`inline-<time>` for standalone).
- `isBusy` counts in-flight write reviews and commands; the session's stall watchdog must not fire while it is non-zero (a user reviewing a diff is not a stall).
- Prompt: mentions are parsed, context is assembled within `contextBudget` from the query, mentions, active file, selection, open tabs and the last 10 saved files (`trackSaved`), then the `<anvil_context>` block is appended; the panel receives `runStarted` and a `context` summary. If the index is still building a notice says context may be incomplete.
- Cancel (`cancel`): marks the run cancelled, cancels the session, all pending reviews, kills running commands, rejects pending command approvals and clears the approval flow. `newChat` cancels, disposes the session, clears state and posts `chatReset` so the panel drops its global notices; `resetSessionIfIdle` drops the session only when idle (called on config change).
- Revert policy (`execute`): after the session returns, `runFinished` is posted. Only with `cancelBehavior === 'revert'`: a `cancelled` result reverts the run's checkpoints, and an `error` result reverts if the run recorded any change. A `done` result is never reverted, and `keep` leaves all edits in place. The notice reports restored files and lists conflicts (files edited since, left alone).
- Retry policy (`beforeRetry` hook): before the session retries or switches model it cancels reviews, kills commands, rejects pending approvals, clears the flow and reverts the run's changes, so every attempt starts from the original files (independent of `cancelBehavior`). Model switches post `modelSwitch`, update the status bar and warn; retries post an info notice.
- Undo/revert from the panel or `anvil.undoLast` run through `restoreWithPrompt`: the first attempt does not force; on conflicts the user is asked "Restore anyway?" and only then it forces.
- The `onQuestion` hook shows a quick pick (with options) or an input box; dismissal returns an empty answer.
- Panel messages handled: `ready`, `send`, `cancel`, `newChat`, `approve`, `mentionQuery`, `openFile`, `openSession`, `undoChange`, `revertRun`, `doctor`, `notice-action`. Unexpected errors are logged, not thrown.

**Notes**
- `execute` converts a thrown error into an `error` result, so the same revert and notice logic applies.
