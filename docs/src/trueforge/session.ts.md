# `src/trueforge/session.ts`

**Purpose**
This file manages a single user request as a TrueForge turn. It handles event streaming, pauses for user input, and automatic model retries or switches on failure.

**Exports**
* ApprovalRequest(call: ResolvedToolCall): ApprovalRequest - interface - Defines the structure for a tool call requiring user approval.
* ApprovalDecision({ allow: true } | { allow: false; reason: string }): ApprovalDecision - type - Represents the user's decision to allow or deny a tool call.
* RunHooks(onEvent?: ..., onApproval: ..., onQuestion?: ..., onModelSwitch?: ..., onRetry?: ..., beforeRetry?: ...): RunHooks - interface - Defines optional callbacks for tracking events, approvals, questions, and model changes.
* RunResult({ status: 'done' | 'cancelled' | 'error', output?: string, model: string, error?: string, sessionId?: string, metrics?: Record<string, number> }): RunResult - interface - Represents the final result of a run.
* AnvilSession({ client: TrueForge, agent: AgentDefinition, relay: ModelRelay, stallTimeoutMs: number, title?: string, baseUrl?: string }): AnvilSession - class - Manages the execution of a turn, including retries and model relay logic.

**Collaborators**
* Imports: `@truefoundry/trueforge-sdk`, `../core/agent/toolCalls`, `../core/agent/events`, `../core/agent/fallback`, `./spec`.
* Exports: Not visible from this file.

**Key behaviour and invariants**
* A run is already in progress if `run()` is called while `running` is true.
* The `MAX_RESUBSCRIBES` limit is 3.
* The `DEFAULT_ANSWER` is 'Proceed with your best judgement.'.
* `run()` sets `running` to false in a `finally` block.
* `cancel()` triggers the `AbortController` and calls `serverCancel()`.
* `backoff()` uses a race between a timeout and the `cancelSignal`.
* `unlessCancelled()` ensures that a stuck host hook does not block the settlement of a cancelled run.
* `swapModel()` updates the session agent spec if the session ID exists.
* `ensureSession()` creates a new session if `id` is not present.

**Notes**
* `beforeRetry()` is called before both backoff delays and model swaps.
* `answerPause()` throws an error if a turn is paused but no tool calls are pending.
* `serverCancel()` catches errors to prevent them from interrupting the cancellation flow.
