# `src/panel/protocol.ts`

**Purpose**
Message types exchanged between the extension host and the panel webview, so both sides share one contract. Types only.

**Exports**
- `HostToWebview` (union by `type`): `init` (models, activeModel, trueforgeUrl), `health` (trueforge, bridge, indexedFiles), `runStarted`, `context` (items, budget, used, dropped count), `text` (full content so far, idempotent), `tool` (call with summary, status, optional result), `thread`, `approval` (kind `edit` or `command`), `approvalResolved`, `modelSwitch`, `notice` (level, message, optional actions and runId), `runFinished` (status done/cancelled/error, model, optional error, sessionId, metrics), `changes` (`{seq, runId, path, summary, at}[]`), `mentionResults`.
- `WebviewToHost` (union by `type`): `ready`, `send`, `cancel`, `newChat`, `approve` (id, allow, optional reason), `mentionQuery`, `openFile` (path, optional line), `openSession`, `undoChange` (seq), `revertRun` (runId), `doctor`, `notice-action`.

**Collaborators**
- Imports: none.
- Used by: `panelProvider.ts`, `messageQueue.ts`, `runController.ts`, `approvalFlow.ts`, `panelEvents.ts`, `extension.ts`, webview `state.ts`.

**Key behaviour and invariants**
- `text` messages are full snapshots, so the queue and webview may drop older ones. Most run messages carry `runId` so the webview can ignore stale runs; `init`, `health`, `changes` and `mentionResults` do not.
- Status and outcome fields are plain strings, not enums, except where noted.

**Notes**
- Change `seq` is the checkpoint sequence number used by `undoChange`.
