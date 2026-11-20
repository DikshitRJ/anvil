# `src/host/config.ts`

**Purpose**
This file reads `anvil.*` VS Code settings and maps them to an `AnvilConfig` object. It provides a mechanism to listen for and react to configuration changes.

**Exports**
* readConfig(): function: Retrieves the current VS Code configuration and merges it into an `AnvilConfig` object.
* onConfigChange(listener: (cfg: AnvilConfig) => void): function: Returns a `vscode.Disposable` that triggers a callback whenever the `anvil` configuration changes.

**Collaborators**
* Imports:
    * `vscode`: Provides the `workspace.getConfiguration` and `workspace.onDidChangeConfiguration` APIs.
    * `../core/config`: Provides the `mergeConfig` function and the `AnvilConfig` type.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* `readConfig` retrieves `trueforgeUrl` (string), `models` (string[]), `retriesPerModel` (number), `stallTimeoutSec` (number), `contextBudget` (number), `mcpPort` (number), `cancelBehavior` ('revert' | 'keep'), and `commandTimeoutSec` (number).
* `onConfigChange` filters for configuration changes that specifically affect the `anvil` namespace.
* `onConfigChange` invokes the provided listener with the result of a fresh `readConfig()` call.

**Notes**
* `onConfigChange` returns a `vscode.Disposable` to allow for proper cleanup of the configuration change listener.
