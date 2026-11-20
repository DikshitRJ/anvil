# `src/trueforge/session.ts`

**Purpose**
This file manages the execution of a single user request as a TrueForge turn. It handles event streaming, manages pauses for user approvals or questions, supports cancellation, and coordinates model retries or switches via a Model Relay.

**Exports**
* ApprovalRequest (interface): Represents a request for user approval on a tool call.
* ApprovalDecision (type): Represents the result of an approval request, either allowing or denying with a reason.
* RunHooks (interface): Defines optional hooks for event handling, approvals, questions, model switches, retries, and pre-retry actions.
* RunResult (interface): Represents the final outcome of a run, including status, output, model, and metrics.
* AnvilSession (class): The primary class for executing a turn, managing the lifecycle of a session, and handling fallbacks.

**Collaborators**
* Imports:
    * `@truefoundry/trueforge-sdk`: Provides `TrueForge` and `TrueForgeApi` types for client interaction.
    * `../core/agent/toolCalls`: Provides `ResolvedToolCall` type.
    * `../core/agent/events`: Provides `TurnReducer` and `TurnView` for state management.
    * `../core/agent/fallback`: Provides `classifyFailure`, `FailureKind`, and `ModelRelay` for error handling.
    * `./spec`: Provides `buildSpec` and `AgentDefinition` for session configuration.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* A run is blocked if `running` is true.
* `MAX_RESUBSCRIBES` is set to 3 for handling transient stream drops.
* `timeoutInSeconds` is set to 600 for request options.
* `RETRY_NOTE` prepends a specific string to the input on retry attempts.
* `DEFAULT_ANSWER` defaults to 'Proceed with your best judgement.' if no question hook is provided.
* `DISMISSED_ANSWER` is used when the question hook returns an empty string.
* `unlessCancelled` ensures that stuck host hooks do not block session settlement during cancellation.
* `syncModel` ensures the session spec matches the relay's current model.
* `backoff` uses a race between a timeout and the `cancelSignal`.
* `ensureSession` creates a new session and truncates the title to 50 characters.
* `nextEvent` re-arms the stall watchdog if `isBusy` returns true.

**Notes**
* `cancel()` triggers an `AbortController` and calls `serverCancel()` to notify the backend.
* `beforeRetry` is called before backoff and before model swaps.
* `closeStream` ensures the async iterator is returned properly.
* `fromError` maps various error properties (message, statusCode, code, cause) into a `Failure` object.
* `answerPause` throws an error if a turn is paused but no tool calls are pending.
