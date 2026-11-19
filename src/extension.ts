import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Anvil');
  context.subscriptions.push(output);
  output.appendLine('Anvil activated');
}

export function deactivate(): void {
  // nothing to clean up yet
}
