// WorkspaceHost implementation backed by VS Code: open-buffer-aware reads with a symlink-escape guard,
// index-based file listing, and diagnostics. Writes and commands are delegated.
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { CodeIndex } from '../core/context/codeIndex';
import { resolveInWorkspace, toRelative } from '../core/paths';
import type { DiagnosticInfo, WorkspaceHost } from '../mcp/server';
import { filterFiles } from '../core/fileList';
import { assertRealPathInside } from './realPath';

export interface HostDelegates {
  applyWrite(rel: string, content: string, summary: string): Promise<void>;
  runCommand: WorkspaceHost['runCommand'];
}

const SEVERITY: Record<number, DiagnosticInfo['severity']> = {
  [vscode.DiagnosticSeverity.Error]: 'error',
  [vscode.DiagnosticSeverity.Warning]: 'warning',
  [vscode.DiagnosticSeverity.Information]: 'info',
  [vscode.DiagnosticSeverity.Hint]: 'info',
};

export class VsCodeWorkspaceHost implements WorkspaceHost {
  constructor(
    readonly root: string,
    private readonly getIndex: () => CodeIndex,
    private readonly delegates: HostDelegates,
  ) {}

  get index(): CodeIndex {
    return this.getIndex();
  }

  async readFile(rel: string): Promise<string | null> {
    const abs = resolveInWorkspace(this.root, rel);
    await assertRealPathInside(this.root, abs);
    const open = vscode.workspace.textDocuments.find((d) => d.uri.scheme === 'file' && d.uri.fsPath === abs);
    if (open) return open.getText();
    try {
      return Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.file(abs))).toString('utf8');
    } catch {
      return null;
    }
  }

  async listFiles(dir = '', glob?: string, limit = 200): Promise<string[]> {
    return filterFiles(this.index.files(), dir, glob, limit);
  }

  private inRoot(fsPath: string): boolean {
    return fsPath === this.root || fsPath.startsWith(this.root.endsWith(path.sep) ? this.root : this.root + path.sep);
  }

  async diagnostics(rel?: string): Promise<DiagnosticInfo[]> {
    const all = rel
      ? [
          [
            vscode.Uri.file(resolveInWorkspace(this.root, rel)),
            vscode.languages.getDiagnostics(vscode.Uri.file(resolveInWorkspace(this.root, rel))),
          ] as const,
        ]
      : vscode.languages.getDiagnostics();
    const out: DiagnosticInfo[] = [];
    for (const [uri, diags] of all) {
      if (uri.scheme !== 'file' || !this.inRoot(uri.fsPath)) continue;
      const p = toRelative(this.root, uri.fsPath);
      for (const d of diags) {
        out.push({
          path: p,
          line: d.range.start.line + 1,
          severity: SEVERITY[d.severity] ?? 'info',
          message: d.message,
        });
      }
    }
    return out;
  }

  applyWrite(rel: string, content: string, summary: string): Promise<void> {
    return this.delegates.applyWrite(rel, content, summary);
  }

  runCommand: WorkspaceHost['runCommand'] = (command, opts) => this.delegates.runCommand(command, opts);
}
