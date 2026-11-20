# `src/host/healthLoop.ts`

**Purpose**
This file implements a polling mechanism to monitor the health of TrueForge. It periodically executes a check function and triggers callbacks based on the resulting state transitions.

**Exports**
* HealthLoop(check, onChange, onUp, intervalMs): class: Implements `vscode.Disposable` to manage a periodic health check timer.

**Collaborators**
* Imports: 
    * `vscode`: Provides the `Disposable` interface.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* The `intervalMs` defaults to 15000.
* The `state` property initializes to `'unknown'`.
* The `tick` method uses a `busy` flag to prevent concurrent executions of the check.
* The `tick` method catches any errors from the `check` function and treats them as `false`.
* The `onChange` callback fires on every tick regardless of the transition.
* The `onUp` callback fires only when the state transitions from a non-`ok` state to `'ok'`.
* The `dispose` method clears the `timer` interval.

**Notes**
* The `start` method triggers an immediate `tick` before starting the interval.
* The `tick` method is asynchronous but does not await the interval.
