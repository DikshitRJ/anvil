// Checkpoint store: records applied edits so single changes or whole runs can be undone safely.
export interface FileStore {
  read(rel: string): Promise<string | null>;
  write(rel: string, content: string): Promise<void>;
  remove(rel: string): Promise<void>;
}

export interface AppliedChange {
  seq: number;
  runId: string;
  path: string;
  before: string | null;
  after: string;
  at: number;
  summary: string;
}

export interface RestoreReport {
  restored: string[];
  conflicts: string[];
}

export class CheckpointStore {
  private entries: AppliedChange[] = [];
  private nextSeq = 1;
  private listeners = new Set<() => void>();

  constructor(
    protected store: FileStore,
    protected maxEntries: number = 200,
  ) {}

  record(c: Omit<AppliedChange, 'seq' | 'at'>): AppliedChange {
    const change: AppliedChange = { ...c, seq: this.nextSeq++, at: Date.now() };
    this.entries.push(change);
    while (this.entries.length > this.maxEntries) this.entries.shift();
    this.emit();
    return change;
  }
  list(): AppliedChange[] {
    return [...this.entries];
  }
  forRun(runId: string): AppliedChange[] {
    return this.entries.filter((e) => e.runId === runId);
  }

  private async restore(path: string, before: string | null): Promise<void> {
    if (before === null) await this.store.remove(path);
    else await this.store.write(path, before);
  }
  private drop(seqs: Set<number>): void {
    this.entries = this.entries.filter((e) => !seqs.has(e.seq));
  }
  private emit(): void {
    for (const l of [...this.listeners]) l();
  }

  // restores `before` if current === after
  async undo(seq: number, opts?: { force?: boolean }): Promise<RestoreReport> {
    const report: RestoreReport = { restored: [], conflicts: [] };
    const e = this.entries.find((x) => x.seq === seq);
    if (!e) return report;
    const current = await this.store.read(e.path);
    if (current !== e.after && !opts?.force) {
      report.conflicts.push(e.path);
    } else {
      await this.restore(e.path, e.before);
      report.restored.push(e.path);
      this.drop(new Set([seq]));
    }
    this.emit();
    return report;
  }

  // reverse order, earliest `before` per file
  async revertRun(runId: string, opts?: { force?: boolean }): Promise<RestoreReport> {
    const report: RestoreReport = { restored: [], conflicts: [] };
    const byPath = new Map<string, AppliedChange[]>();
    for (const e of this.forRun(runId).reverse()) {
      byPath.set(e.path, [...(byPath.get(e.path) ?? []), e]);
    }
    for (const [path, list] of byPath) {
      const current = await this.store.read(path);
      if (current !== list[0]?.after && !opts?.force) {
        report.conflicts.push(path);
        continue;
      }
      await this.restore(path, list[list.length - 1]?.before ?? null);
      report.restored.push(path);
      this.drop(new Set(list.map((x) => x.seq)));
    }
    this.emit();
    return report;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
