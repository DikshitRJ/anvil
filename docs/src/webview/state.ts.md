# `webview/state.ts`

**Purpose**
This file manages the state of the webview panel. It processes messages from the host to update the panel data without accessing the DOM.

**Exports**
* ContextCard: interface - Defines the structure for context items, budget, and usage.
* ThreadInfo: interface - Defines the structure for thread identification, title, and status.
* Entry: type - Defines the structure for different types of message entries including text, tools, approvals, notices, and model switches.
* Finished: interface - Defines the structure for run completion status, metrics, and errors.
* Run: interface - Defines the structure for a single execution run including entries and threads.
* GlobalNotice: interface - Defines the structure for global system notices.
* PanelState: interface - Defines the complete state object for the webview panel.
* initialState(): PanelState - function - Returns the default state object for the panel.
* reduce(state: PanelState, msg: HostToWebview): PanelState - function - Takes the current state and a message to return a new state.

**Collaborators**
* Imports: `../src/panel/protocol`
* Exports: Not visible from this file.

**Key behaviour and invariants**
* The reducer is a pure function and does not modify the existing state object.
* The `upsert` function replaces an entry if the key exists or appends it if the key is new.
* `noticeSeq` increments every time a notice is processed.
* `running` becomes true when a run starts and false when a run finishes.
* `updateRun` creates a new run object if the provided `runId` does not exist in the current state.
