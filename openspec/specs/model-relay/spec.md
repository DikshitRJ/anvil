# model-relay Specification

## Purpose
Keep working when the model fails: classify failures, retry transient ones with backoff, switch automatically to the next configured model in the same session, and otherwise fail clearly with an unchanged workspace.

## Requirements

### Requirement: Failure classification
The extension SHALL classify failures as transient (network, 429, 5xx, stall), model-fatal (401, 403, 404, invalid key, unknown model, unreachable endpoint), harness-down (TrueForge unreachable) or cancelled.

#### Scenario: Invalid key
- **WHEN** a turn ends with `turn.done` status `error` mentioning 401 or an invalid API key
- **THEN** the failure is classified as model-fatal

### Requirement: Retry with backoff and automatic fallback
Transient failures SHALL be retried with exponential backoff up to `anvil.retriesPerModel`. Model-fatal failures, or exhausted retries, SHALL switch to the next model in `anvil.models` in the same session, with no user action.

#### Scenario: Fallback to second model
- **WHEN** the primary model fails with an invalid key and a second model is configured
- **THEN** the session's spec is updated to the second model, the input is resent, and a notice explains the switch

### Requirement: Workspace unchanged by failed attempts
Writes applied by a failed attempt SHALL be rolled back before a retry or switch.

#### Scenario: Failure after a write
- **WHEN** an attempt fails after one accepted write
- **THEN** that write is reverted before the next attempt starts

### Requirement: Clear terminal error
When all models fail or TrueForge is unreachable, the extension SHALL show one clear message with a Doctor action and leave the workspace unchanged.

#### Scenario: Harness down
- **WHEN** TrueForge is not reachable
- **THEN** the user sees "TrueForge is not reachable at <url>" with actions to start it or open Doctor
