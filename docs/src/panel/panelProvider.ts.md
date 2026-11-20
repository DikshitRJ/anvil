# `src/panel/panelProvider.ts`

**Purpose**
Hosts the Anvil panel webview by managing message forwarding between the extension and the webview. It ensures messages are queued until the webview is ready and handles state replay for specific message types.

**Exports**
* PanelProvider (class): Implements `vscode.WebviewViewProvider` to manage the webview lifecycle and messaging.

**Collaborators**
* Imports:
    * `node:crypto`: Provides `randomBytes` for generating CSP nonces.
    * `vscode`: Provides the `WebviewViewProvider` interface and URI utilities.
    * `./messageQueue`: Provides the `enqueue` function to manage the message queue.
    * `./protocol`: Provides `HostToWebview` and `WebviewToHost` types for message definitions.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* `viewType` is set to `'anvil.panel'`.
* `REPLAYED` messages include `'init'`, `'health'`, and `'changes'`.
* `resolveWebviewView` sets `localResourceRoots` to `dist` and `media` directories.
* `post` stores the latest value of `REPLAYED` types in a `last` map.
* `receive` sets `ready` to `true` when a `'ready'` message is received.
* `receive` prepends replayed messages to the queue before messages that are not in the replay set.
* `flush` only sends messages if `view` is defined and `ready` is `true`.
* `html` generates a Content-Security-Policy with a 16-byte base64 nonce.

**Notes**
* `resolveWebviewView` resets `ready` to `false` and clears the `view` on disposal.
* `flush` clears the `queue` immediately after capturing the `pending` array.
* `reveal` executes the `anvil.panel.focus` command.
