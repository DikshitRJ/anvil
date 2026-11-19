// Reads the `anvil.*` VS Code settings into an AnvilConfig and notifies on change.
import * as vscode from 'vscode';
import { mergeConfig, type AnvilConfig } from '../core/config';

export function readConfig(): AnvilConfig {
  const c = vscode.workspace.getConfiguration('anvil');
  return mergeConfig({
    trueforgeUrl: c.get<string>('trueforgeUrl'),
    models: c.get<string[]>('models'),
    retriesPerModel: c.get<number>('retriesPerModel'),
    stallTimeoutSec: c.get<number>('stallTimeoutSec'),
    contextBudget: c.get<number>('contextBudget'),
    mcpPort: c.get<number>('mcpPort'),
    cancelBehavior: c.get<'revert' | 'keep'>('cancelBehavior'),
    commandTimeoutSec: c.get<number>('commandTimeoutSec'),
  });
}

export function onConfigChange(listener: (cfg: AnvilConfig) => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('anvil')) listener(readConfig());
  });
}
