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
  constructor(
    protected store: FileStore,
    protected maxEntries?: number,
  ) {}

  record(_c: Omit<AppliedChange, 'seq' | 'at'>): AppliedChange {
    throw new Error('not implemented');
  }
  list(): AppliedChange[] {
    throw new Error('not implemented');
  }
  forRun(_runId: string): AppliedChange[] {
    throw new Error('not implemented');
  }
  // restores `before` if current === after
  undo(_seq: number, _opts?: { force?: boolean }): Promise<RestoreReport> {
    throw new Error('not implemented');
  }
  // reverse order, earliest `before` per file
  revertRun(_runId: string, _opts?: { force?: boolean }): Promise<RestoreReport> {
    throw new Error('not implemented');
  }
  onChange(_listener: () => void): () => void {
    throw new Error('not implemented');
  }
}
