// Hosts the Anvil panel webview: strict-CSP HTML, message forwarding, and a ready-gated outbound queue.
// Contains no business logic; it only moves protocol messages between the extension and the webview.
import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import type { HostToWebview, WebviewToHost } from './protocol';

/** Message types whose latest value is replayed to a freshly (re)loaded webview. */
const REPLAYED = ['init', 'health', 'changes'] as const;

export class PanelProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'anvil.panel';

  private view?: vscode.WebviewView;
  private ready = false;
  private queue: HostToWebview[] = [];
  private readonly last = new Map<string, HostToWebview>();

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly onMessage: (msg: WebviewToHost) => void,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    this.ready = false;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
        vscode.Uri.joinPath(this.extensionUri, 'media'),
      ],
    };
    view.webview.html = this.html(view.webview);
    view.webview.onDidReceiveMessage((msg: WebviewToHost) => this.receive(msg));
    view.onDidDispose(() => {
      if (this.view === view) this.view = undefined;
      this.ready = false;
    });
  }

  /** Queue until the view is resolved and the webview reported 'ready', then flush in order. */
  post(msg: HostToWebview): void {
    if ((REPLAYED as readonly string[]).includes(msg.type)) this.last.set(msg.type, msg);
    this.queue.push(msg);
    this.flush();
  }

  reveal(): void {
    void vscode.commands.executeCommand('anvil.panel.focus');
  }

  private receive(msg: WebviewToHost): void {
    if (msg.type === 'ready') {
      this.ready = true;
      // A new webview has no state: replay the latest init/health/changes ahead of anything queued.
      const replay = REPLAYED.map((t) => this.last.get(t)).filter((m): m is HostToWebview => !!m);
      this.queue = [...replay, ...this.queue.filter((m) => !replay.includes(m))];
      this.flush();
    }
    this.onMessage(msg);
  }

  private flush(): void {
    if (!this.view || !this.ready) return;
    const pending = this.queue;
    this.queue = [];
    for (const m of pending) void this.view.webview.postMessage(m);
  }

  private html(webview: vscode.Webview): string {
    const nonce = randomBytes(16).toString('base64');
    const dist = vscode.Uri.joinPath(this.extensionUri, 'dist');
    const script = webview.asWebviewUri(vscode.Uri.joinPath(dist, 'webview.js'));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(dist, 'webview.css'));
    const src = webview.cspSource;
    const csp = `default-src 'none'; style-src ${src}; script-src 'nonce-${nonce}'; img-src ${src} data:; font-src ${src}`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${style}">
<title>Anvil</title>
</head>
<body>
<div id="app"></div>
<script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
  }
}
