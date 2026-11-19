export function stableStringify(_value: unknown): string {
  throw new Error('not implemented');
}

// sha256 hex of `${tool}\n${stableStringify(args)}`
export function canonicalKey(_tool: string, _args: unknown): string {
  throw new Error('not implemented');
}

export interface LedgerEntry {
  finalContent: string | null;
  acceptedHunks: number[];
  totalHunks: number;
  feedback: string;
}

export class ApprovalLedger {
  put(_key: string, _e: LedgerEntry): void {
    throw new Error('not implemented');
  }
  take(_key: string): LedgerEntry | undefined {
    throw new Error('not implemented');
  }
  clear(): void {
    throw new Error('not implemented');
  }
  size(): number {
    throw new Error('not implemented');
  }
}
