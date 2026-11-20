# `src/core/agent/fallback.ts`

**Purpose**
Classifies run failures and decides the next step: retry with backoff, switch model, or give up.

**Exports**
- `FailureKind`: `transient | model-fatal | harness-down | cancelled | unknown`.
- `classifyFailure({message, statusCode, code, phase})` with phase `connect | turn | stall`.
- `RelayPolicy` (`models`, `retriesPerModel`, `backoffMs`) and `RelayStep` (`retry`, `switch`, `give-up`).
- `ModelRelay`: `current()`, `onFailure(kind, message)`, `reset()`.

**Collaborators**
- Imports: none.
- Used by: `trueforge/session.ts` and `host/runController.ts`.

**Key behaviour and invariants**
- Classification order: phase `stall` is always `transient`; a message matching client-cancel text is `cancelled`.
- Phase `connect`: network code/message or a missing status code is `harness-down`; 5xx or 429 is `transient`; anything else `unknown`.
- Phase `turn`: the fatal regex (401/403/404, auth, unknown/missing model, DNS/connection refused, certificate, invalid URL) gives `model-fatal`; the transient regex (429, rate limit, overloaded, timeout, 5xx, temporary) gives `transient`; else `unknown`. Fatal is tested before transient.
- `ModelRelay` throws if no models are configured. Backoff defaults to 500/1500/4000 ms; the last value is reused when attempts exceed the list.
- `onFailure`: `cancelled` and `harness-down` give up at once (never switch model). `transient` and `unknown` retry the same model while attempts < `retriesPerModel`. Otherwise it switches to the next model and resets attempts; with no next model it gives up with "All configured models failed" plus the last error. `model-fatal` skips retries and switches immediately.

**Notes**
- `reset()` returns to the first model with zero attempts, for a new run.
