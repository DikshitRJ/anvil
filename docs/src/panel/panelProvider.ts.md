# `src/panel/panelProvider.ts`

**Purpose**
Hosts the Anvil side-panel webview: strict-CSP HTML, message forwarding, and a ready-gated outbound queue. No business logic.

**Exports**
- `PanelProvider(extensionUri, onMessage)` (implements `vscode.WebviewViewProvider`): static `viewType = 'anvil.panel'`, `resolveWebviewView`, `post(msg)`, `reveal()`.

**Collaborators**
- Imports: `node:crypto`, `vscode`, `./messageQueue`, `./protocol`.
- Used by: `extension.ts` (receives messages into `RunController.onPanelMessage`).

**Key behaviour and invariants**
- Messages are queued until a view exists and the webview has sent `ready`, then flushed in order and the queue emptied. `ready` resets to false when a view is (re)resolved or disposed.
- The latest `init`, `health` and `changes` messages are remembered; on `ready` they are replayed ahead of the queue so a reloaded webview regains its state. Other messages (runs, text, approvals) are not replayed.
- Webview options: scripts enabled, resources limited to the extension's `dist` and `media` folders. HTML loads `dist/webview.js` and `webview.css` with a CSP of `default-src 'none'` and a per-load 16-byte random nonce for the script.
- Every webview message, including `ready`, is forwarded to `onMessage`.

**Notes**
- The view is registered with `retainContextWhenHidden` in `extension.ts`. `reveal` runs `anvil.panel.focus`.
