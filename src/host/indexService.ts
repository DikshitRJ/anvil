// Owns the CodeIndex: initial async build plus incremental updates from a debounced FileSystemWatcher.
import * as vscode from 'vscode';
import { CodeIndex } from '../core/context/codeIndex';
import { toRelative } from '../core/paths';
import { isIgnoredPath } from './panelEvents';

const MAX_BYTES = 512 * 1024;
const DEBOUNCE_MS = 300;

export class IndexService implements vscode.Disposable {
  readonly index: CodeIndex;
  ready = false;
  private readonly changed = new Set<string>();
  private readonly deleted = new Set<string>();
  private timer: NodeJS.Timeout | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly root: string,
    private readonly onStatus: (state: { ready: boolean; files: number }) => void,
    private readonly log: (msg: string) => void,
  ) {
    this.index = new CodeIndex(root);
  }

  start(): void {
    this.onStatus({ ready: false, files: 0 });
    this.index
      .build((done) => this.onStatus({ ready: false, files: done }))
      .then(() => {
        this.ready = true;
        this.onStatus({ ready: true, files: this.index.files().length });
      })
      .catch((e) => this.log(`index build failed: ${String(e)}`));
    const w = vscode.workspace.createFileSystemWatcher('**/*');
    this.disposables.push(
      w,
      w.onDidCreate((u) => this.queue(u, false)),
      w.onDidChange((u) => this.queue(u, false)),
      w.onDidDelete((u) => this.queue(u, true)),
    );
  }

  private queue(uri: vscode.Uri, del: boolean): void {
    if (uri.scheme !== 'file') return;
    const rel = toRelative(this.root, uri.fsPath);
    if (rel.startsWith('..') || isIgnoredPath(rel)) return;
    (del ? this.deleted : this.changed).add(rel);
    (del ? this.changed : this.deleted).delete(rel);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), DEBOUNCE_MS);
  }

  private async flush(): Promise<void> {
    const changed = [...this.changed];
    const deleted = [...this.deleted];
    this.changed.clear();
    this.deleted.clear();
    for (const rel of deleted) this.index.removeFile(rel);
    await Promise.all(changed.map((rel) => this.refresh(rel)));
    this.onStatus({ ready: this.ready, files: this.index.files().length });
  }

  private async refresh(rel: string): Promise<void> {
    try {
      const uri = vscode.Uri.file(`${this.root}/${rel}`);
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.type !== vscode.FileType.File || stat.size > MAX_BYTES) {
        this.index.removeFile(rel);
        return;
      }
      const bytes = await vscode.workspace.fs.readFile(uri);
      if (bytes.includes(0)) {
        this.index.removeFile(rel);
        return;
      } // binary
      this.index.updateFile(rel, Buffer.from(bytes).toString('utf8'));
    } catch {
      this.index.removeFile(rel);
    }
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.disposables.forEach((d) => d.dispose());
  }
}
