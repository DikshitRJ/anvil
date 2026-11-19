# `src/core/agent/fallback.ts`

**Purpose**
This file classifies errors and manages model switching logic. It provides a mechanism to retry requests with backoff or switch to a different model when a failure occurs.

**Exports**
* FailureKind: 'transient' | 'model-fatal' | 'harness-down' | 'cancelled' | 'unknown' - type - Defines the categories of possible failures.
* classifyFailure(f: { message?: string; statusCode?: number; code?: string; phase: 'connect' | 'turn' | 'stall' }): FailureKind - function - Analyzes an error object and returns a FailureKind.
* RelayPolicy: { models: string[]; retriesPerModel: number; backoffMs: number[] } - interface - Defines the configuration for model retries and switching.
* RelayStep: { action: 'retry'; model: string; delayMs: number } | { action: 'switch'; model: string; from: string } | { action: 'give-up'; reason: string } - type - Represents the next action to take after a failure.
* ModelRelay: class - class - Manages the current model index and tracks retry attempts based on a RelayPolicy.

**Collaborators**
Imports: Not visible from this file.
Exports: Not visible from this file.

**Key behaviour and invariants**
* `classifyFailure` returns 'transient' if the phase is 'stall'.
* `classifyFailure` returns 'harness-down' if the phase is 'connect' and a network error code or message is detected.
* `ModelRelay` throws an error if the policy contains no models.
* `ModelRelay` uses a default backoff of [500, 1500, 4000] if no backoffMs are provided.
* `ModelRelay.onFailure` returns 'give-up' for 'cancelled' or 'harness-down' kinds.
* `ModelRelay.onFailure` increments the attempt counter only for 'transient' or 'unknown' kinds.
* `ModelRelay.onFailure` resets the attempt counter to 0 when it switches to a new model.

**Notes**
* The `FATAL` regex includes specific HTTP status codes (401, 403, 404) and authentication-related keywords.
* The `TRANSIENT` regex includes 429 (rate limit), 5xx (server errors), and timeout keywords.
