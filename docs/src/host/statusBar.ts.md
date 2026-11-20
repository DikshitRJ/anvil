# `src/host/statusBar.ts`

**Purpose**
Status bar item showing the active model and the indexing, running and TrueForge-down states. Clicking it runs `anvil.focusPanel`.

**Exports**
- `AnvilStatusBar` (implements `vscode.Disposable`): `setConfig(models, url)`, `setModel(model)`, `setIndexing(files | undefined)`, `setRunning(bool)`, `setHealth(ok)`, `dispose()`.

**Collaborators**
- Imports: `vscode`.
- Used by: `extension.ts`, `runController.ts` (`setRunning`, `setModel`), `indexService` status callback, `healthLoop` callback.

**Key behaviour and invariants**
- Left aligned, priority 100. Text priority: running (`Anvil · <model>` with spinner), then TrueForge down (warning icon), then indexing (`indexing... (N files)`), else the flame icon and model; the model shows "no model set" when empty.
- `setIndexing(undefined)` means the index is ready; `setHealth(ok)` stores `down = !ok`.
- The warning background is used only when TrueForge is down and no run is active.
- Tooltip lists the model chain joined by arrows (or "none - set anvil.models") and the TrueForge URL. `setConfig` resets the shown model to the first configured model; `setModel` shows a fallback model after a switch.

**Notes**
- State starts as "indexing, 0 files" until the index service reports.
