# `src/host/statusBar.ts`

**Purpose**
This file manages the status bar item for the Anvil extension. It displays the current model, indexing progress, running state, and TrueForge connection status. It also handles the visual styling and tooltips for the status bar.

**Exports**
* AnvilStatusBar (class): Implements `vscode.Disposable` to manage the status bar item lifecycle.

**Collaborators**
* Imports: `vscode` is used to create and manage the `StatusBarItem`.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* The status bar item is aligned to the left with a priority of 100.
* Clicking the status bar item triggers the `anvil.focusPanel` command.
* The `render` method updates the text based on the priority: running state, then down state, then indexing state.
* The `indexing` state displays the number of files when the value is not `undefined`.
* The `down` state sets the background color to `statusBarItem.warningBackground` only if `running` is false.
* The tooltip displays the model chain joined by ` → ` or `(none — set anvil.models)` if empty.
* The `model` defaults to `no model set` if the string is empty.

**Notes**
* `setHealth` inverts the boolean input to set the `down` property.
* `setIndexing` accepts `number | undefined`, where `undefined` indicates the index is ready.
* `dispose` cleans up the `StatusBarItem` resource.
