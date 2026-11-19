# `src/panel/protocol.ts`

**Purpose**
This file defines the data structures for communication between the host and the webview. It ensures both sides use the same message formats.

**Exports**
* HostToWebview: type - Defines the structure of messages sent from the host to the webview.
* WebviewToHost: type - Defines the structure of messages sent from the webview to the host.

**Collaborators**
* Imports: Not visible from this file.
* Exports: Not visible from this file.

**Key behaviour and invariants**
* Messages use a `type` field to distinguish between different actions.
* `HostToWebview` includes types for initialization, health checks, run status, text content, tool calls, and approvals.
* `WebviewToHost` includes types for user actions like sending text, canceling, and opening files.
* The `changes` type in `HostToWebview` uses a `seq` number to track order.

**Notes**
* Some fields in `HostToWebview` are optional, such as `runId` in the `notice` type.
* The `mentionResults` type supports both `file` and `symbol` kinds.
