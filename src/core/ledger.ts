// Approval ledger: remembers review outcomes keyed by a canonical hash of (tool, args).
import { createHash } from 'node:crypto';

export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const parts = Object.keys(obj)
      .sort()
      .filter((k) => obj[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
    return `{${parts.join(',')}}`;
  }
  return JSON.stringify(value);
}

// sha256 hex of `${tool}\n${stableStringify(args)}`
export function canonicalKey(tool: string, args: unknown): string {
  return createHash('sha256')
    .update(`${tool}\n${stableStringify(args)}`)
    .digest('hex');
}

export interface LedgerEntry {
  finalContent: string | null;
  acceptedHunks: number[];
  totalHunks: number;
  feedback: string;
}

const TTL_MS = 10 * 60 * 1000;

export class ApprovalLedger {
  private entries = new Map<string, { entry: LedgerEntry; at: number }>();

  put(key: string, e: LedgerEntry): void {
    const now = Date.now();
    for (const [k, v] of this.entries) if (now - v.at > TTL_MS) this.entries.delete(k);
    this.entries.set(key, { entry: e, at: now });
  }
  take(key: string): LedgerEntry | undefined {
    const v = this.entries.get(key);
    this.entries.delete(key);
    return v?.entry;
  }
  clear(): void {
    this.entries.clear();
  }
  size(): number {
    return this.entries.size;
  }
}
