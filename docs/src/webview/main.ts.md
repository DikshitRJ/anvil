# `webview/main.ts`

**Purpose**
This file manages the webview user interface. It connects host messages to the state reducer and handles DOM events.

**Exports**
* Not visible from this file.

**Collaborators**
* Imports: `../src/panel/protocol`, `./render`, `./state`
* Exports: Not visible from this file.

**Key behaviour and invariants**
* The file limits the number of saved runs to 20.
* The `persist` function saves the current state to the host.
* The `update` function refreshes the UI and saves the state.
* The `sendMessage` function only sends a message if the state is not running.
* The `mentionTimer` uses a 120ms delay for queries.
* The `autoGrow` function limits the input height to 8 line heights.
* The `mentionKey` function intercepts keyboard events for the mention dropdown.

**Notes**
* The `restore` function resets the state to the initial state if the saved state is invalid or missing runs.
