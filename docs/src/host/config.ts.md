# `src/host/config.ts`

**Purpose**
Reads the `anvil.*` VS Code settings into an `AnvilConfig` and notifies on change.

**Exports**
- `readConfig()`: reads `trueforgeUrl`, `models`, `retriesPerModel`, `stallTimeoutSec`, `contextBudget`, `mcpPort`, `cancelBehavior`, `commandTimeoutSec` and passes them through `mergeConfig`.
- `onConfigChange(listener)`: returns a `vscode.Disposable`.

**Collaborators**
- Imports: `vscode`, `../core/config` (`mergeConfig`, `AnvilConfig`).
- Used by: `extension.ts`.

**Key behaviour and invariants**
- Defaults and clamping come from `mergeConfig`, so out-of-range or missing settings are repaired here (see `core/config.ts`).
- The listener fires only when the change affects the `anvil` section, and receives a freshly read config.

**Notes**
- `readConfig` reads settings at call time; there is no cache.
