// FileStore over the VS Code workspace: writes via WorkspaceEdit (native undo, dirty-buffer aware) and saves.
import * as path from 'node:path';
import * as vscode from 'vscode';
import { resolveInWorkspace } from '../core/paths';
import type { FileStore } from '../core/transaction';

export class VsCodeFileStore implements FileStore {
  constructor(private readonly root: string) {}

  private uri(rel: string): vscode.Uri {
    return vscode.Uri.file(resolveInWorkspace(this.root, rel));
  }

  private openDoc(uri: vscode.Uri): vscode.TextDocument | undefined {
    return vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
  }

  async read(rel: string): Promise<string | null> {
    const uri = this.uri(rel);
    const open = this.openDoc(uri);
    if (open) return open.getText();
    try {
      return Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
    } catch {
      return null;
    }
  }

  async write(rel: string, content: string): Promise<void> {
    const uri = this.uri(rel);
    const existing = await this.read(rel);
    if (existing === null) {
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(uri.fsPath)));
      const create = new vscode.WorkspaceEdit();
      create.createFile(uri, { ignoreIfExists: true, contents: Buffer.from(content, 'utf8') });
      await vscode.workspace.applyEdit(create);
    } else if (existing !== content) {
      const doc = await vscode.workspace.openTextDocument(uri);
      const edit = new vscode.WorkspaceEdit();
      edit.replace(uri, new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), content);
      await vscode.workspace.applyEdit(edit);
    }
    const doc = this.openDoc(uri);
    if (doc?.isDirty) await doc.save();
  }

  async remove(rel: string): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    edit.deleteFile(this.uri(rel), { ignoreIfNotExists: true });
    await vscode.workspace.applyEdit(edit);
  }
}
