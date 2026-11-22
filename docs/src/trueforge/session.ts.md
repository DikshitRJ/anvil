# `src/trueforge/session.ts`

**Purpose**
Runs one user request as a TrueForge turn: streams events, answers approval and question pauses, supports cancellation, and drives the Model Relay (retry or switch model) on failures.

**Exports**
- `ApprovalRequest` (`{call}`), `ApprovalDecision` (`{allow:true}` or `{allow:false, reason}`).
- `RunHooks`: `onEvent`, `onApproval` (required), `onQuestion`, `onModelSwitch`, `onRetry`, `beforeRetry` (host rolls back the failed attempt's writes).
- `RunResult`: `status` (`done | cancelled | error`), `output`, `model`, `error`, `sessionId`, `metrics`.
- `AnvilSession(opts)`: `sessionId`, `run(input, hooks)`, `cancel()`, `dispose()`. Options: `client`, `agent`, `relay`, `stallTimeoutMs`, `title`, `baseUrl`, `isBusy`.

**Collaborators**
- Imports: TrueForge SDK types, `core/agent/toolCalls`, `core/agent/events` (`TurnReducer`), `core/agent/fallback` (`classifyFailure`, `ModelRelay`), `./spec` (`buildSpec`).
- Used by: `host/runController.ts`, `host/inlineEdit.ts`.

**Key behaviour and invariants**
- One run at a time per session ("A run is already in progress"). The server-side session is created lazily on the first attempt (title cut to 50 chars) and reused across runs, so chat context persists; before a run the session is moved back to the relay's current model if an earlier fallback changed it.
- `run` resets the relay, then loops: attempt, and on failure ask the relay. `retry`: `onRetry`, then backoff (which first calls `beforeRetry`, then sleeps, abortable by cancel). `switch`: `beforeRetry`, update the session spec to the new model (if that fails it counts as another failure), then `onModelSwitch`. `give-up`: `cancelled` gives status `cancelled`; otherwise `error` (for `harness-down` the message names the TrueForge URL).
- A retried or switched attempt sends the original input prefixed with a note that the previous attempt failed, its changes were reverted, and files must be re-read.
- One attempt creates a turn stream and drains events into `TurnReducer`, calling `onEvent` per event with the current view. Failures before any event are phase `connect`, after the first event phase `turn`. `turn.done` ends the attempt; a `paused` update triggers `answerPause`.
- If the stream ends without `turn.done`, it re-subscribes after the last event id, at most 3 consecutive times (counter resets whenever events arrive or after a pause); with no turn id or too many drops it fails with "stream ended unexpectedly".
- Stall watchdog: if no event arrives within `stallTimeoutMs` the attempt fails as `stall` (transient: aborted and cancelled server-side). While `isBusy()` is true (host is reviewing a write or running a command) the timer is re-armed instead, so waiting on the user is never a stall.
- Pauses: for each pending tool call, `ask_user_question` (a TrueForge system tool) is answered via `onQuestion` (empty answer becomes a "dismissed" text, no hook gives "Proceed with your best judgement."); every other call goes to `onApproval` and becomes `user.tool_approval` allow or deny (a throwing hook means deny "Review failed"; cancel means deny "Cancelled"). The session subscribes first, then posts the answers, so no event is missed. A pause with no pending call is an error.
- `cancel()` (only while running) sets `cancelled`, aborts the HTTP request, fires the cancel signal (which also unblocks hooks stuck in `unlessCancelled` and backoff) and cancels the turn on the server. A server-side cancelled turn that the user did not request is treated as a failure.

**Notes**
- Both `retry` and `switch` call `beforeRetry` exactly once per recovery, so the host can revert writes before the next attempt.
- The stall watchdog is paused while the host reports busy (`isBusy`) and between `thread.context_compaction_started` and `thread.context_compaction_finished`, because TrueForge emits no events while it compacts history.

- Every new attempt resets compaction state so cancellation during compaction cannot disable the stall watchdog for later turns.

- Before starting any turn, the session model must match the relay model. Failed synchronization enters normal retry/fallback handling; no turn runs under the stale specification.
