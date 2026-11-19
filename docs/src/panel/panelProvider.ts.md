# `src/panel/panelProvider.ts`

**Purpose**
This file hosts the Anvil panel webview. It moves protocol messages between the extension and the webview. It contains no business logic.

**Exports**
* PanelProvider(extensionUri: vscode.Uri, onMessage: (msg: WebviewToHost) => void): PanelProvider - class and provides the webview view provider.
* viewType: string - constant and holds the value 'anvil.panel'.

**Collaborators**
* Imports: node:crypto, vscode, ./protocol.
* Exports: Not visible from this file.

**Key behaviour and invariants**
* The class queues messages until the webview reports a ready state.
* It flushes the queue in the order of arrival.
* It replays the latest 'init', 'health', and 'changes' messages to a new webview.
* It generates a random nonce for the Content Security Policy (CSP).
* It sets local resource roots for the webview.

**Notes**
* The `ready` flag prevents message delivery before the webview is initialized.
* The `last` map stores the most recent state for replayable message types.
