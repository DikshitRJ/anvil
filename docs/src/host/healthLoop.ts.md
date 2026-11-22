# `src/host/healthLoop.ts`

**Purpose**
Polls TrueForge health and reports transitions.

**Exports**
- `HealthLoop(check, onChange, onUp, intervalMs = 15000)` (implements `vscode.Disposable`): `current` getter, `start()`, `tick()`, `dispose()`.

**Collaborators**
- Imports: `vscode` (Disposable).
- Used by: `extension.ts` (check is `checkHealth`; `onUp` triggers `setup`).

**Key behaviour and invariants**
- State starts `unknown`. `start()` runs a tick immediately and then every `intervalMs`.
- `tick` is skipped while a previous tick is still running (`busy`). A rejected check counts as down.
- `onChange('ok' | 'down')` fires on every tick, not only on changes. `onUp` fires only when the state goes from `down` or `unknown` to `ok` (so the first successful check also triggers setup).
- `tick()` is public so a changed TrueForge URL can be re-checked at once. `dispose` stops the interval.

**Notes**
- Timer errors are swallowed by `void`; nothing is retried beyond the next interval.

- Starts are idempotent. Disposal permanently prevents new ticks and suppresses callbacks from already pending checks, including recovery registration.
