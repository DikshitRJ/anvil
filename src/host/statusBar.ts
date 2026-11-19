// Status bar item: model, indexing / running / TrueForge-down states. Click focuses the panel.
import * as vscode from 'vscode';

export class AnvilStatusBar implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  private model = '';
  private chain: string[] = [];
  private url = '';
  private indexing: number | undefined = 0;
  private running = false;
  private down = false;

  constructor() {
    this.item.command = 'anvil.focusPanel';
    this.render();
    this.item.show();
  }

  setConfig(models: string[], url: string): void {
    this.chain = models;
    this.model = models[0] ?? '';
    this.url = url;
    this.render();
  }
  setModel(model: string): void {
    this.model = model;
    this.render();
  }
  /** `undefined` once the index is ready. */
  setIndexing(files: number | undefined): void {
    this.indexing = files;
    this.render();
  }
  setRunning(running: boolean): void {
    this.running = running;
    this.render();
  }
  setHealth(ok: boolean): void {
    this.down = !ok;
    this.render();
  }

  private render(): void {
    const model = this.model || 'no model set';
    let text = `$(flame) Anvil · ${model}`;
    if (this.running) text = `$(sync~spin) Anvil · ${model}`;
    else if (this.down) text = `$(warning) Anvil · TrueForge down`;
    else if (this.indexing !== undefined) text = `$(flame) Anvil · indexing… (${this.indexing} files)`;
    this.item.text = text;
    this.item.backgroundColor =
      this.down && !this.running ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined;
    this.item.tooltip = `Models: ${this.chain.join(' → ') || '(none — set anvil.models)'}\nTrueForge: ${this.url}`;
  }

  dispose(): void {
    this.item.dispose();
  }
}
