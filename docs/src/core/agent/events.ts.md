# `src/core/agent/events.ts`

**Purpose**
Folds the raw TrueForge SDK turn events into one UI-friendly `TurnView` snapshot.

**Exports**
- `ToolStatus`: `streaming | awaiting-approval | running | done | denied | error`.
- `ToolCallView`, `MessageView`, `ThreadView`, `TurnView` (`turnId`, `status` running/paused/done/cancelled/error, messages, toolCalls, threads, `pending`, `error`, `output`, `lastEventId`, `metrics`).
- `TurnReducer`: `apply(event)`, `view()`, `toolCall(id)`, `reset()`.

**Collaborators**
- Imports: `@truefoundry/trueforge-sdk` (`isEventDelta`, `mergeEventDelta`), `./toolCalls`.
- Used by: `trueforge/session.ts`, `host/runController.ts`, panel events.

**Key behaviour and invariants**
- `apply` ignores events without a string `type` and records `lastEventId` (used to resume the stream).
- `model.message` stores a full message (complete); `model.message.delta` merges into a message and marks it complete when `finishReason` is set. Tool calls in an incomplete message show `streaming`, in a complete one `running`.
- `tool.approval_required` marks calls `awaiting-approval` and adds them to `pending` (no duplicates); `tool.response_required` marks them `running` and also adds to `pending`.
- `user.tool_approval` sets `denied` (approval status `deny`) or `running`, and clears pending. `tool.response` sets `done` with the result text cut to 2000 characters (`RESULT_LIMIT`) and clears pending. `user.tool_response` only clears pending.
- `turn.update` yields `paused` or `running`. `turn.done` yields `done` (with output text), `cancelled` (error = reason) or `error` (error = message), and empties `pending`.
- `thread.done` marks the thread `error` if its state status is `error`, else `done`.
- `view()` returns copies, so callers cannot mutate reducer state. `reset()` clears everything back to `running`.

**Notes**
- `textOf` joins `text` parts of array content and returns `''` for other shapes.
