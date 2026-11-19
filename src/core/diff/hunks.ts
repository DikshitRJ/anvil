export interface Hunk {
  id: number;
  origStart: number;
  origLines: string[];
  newStart: number;
  newLines: string[];
}
// origStart/newStart: 0-based line indices. Hunks contain only changed lines (no context lines).
export type HunkDecision = 'pending' | 'accepted' | 'rejected';

export function splitLines(_text: string): { lines: string[]; eol: '\n' | '\r\n'; trailingNewline: boolean } {
  throw new Error('not implemented');
}

export function computeHunks(_original: string, _proposed: string): Hunk[] {
  throw new Error('not implemented');
}

export function applyHunks(_original: string, _hunks: Hunk[], _accepted: ReadonlySet<number>): string {
  throw new Error('not implemented');
}

// pending+accepted applied
export function previewContent(
  _original: string,
  _hunks: Hunk[],
  _decisions: ReadonlyMap<number, HunkDecision>,
): string {
  throw new Error('not implemented');
}

// unified-diff style text for agent feedback
export function summarizeHunk(_h: Hunk, _maxLines?: number): string {
  throw new Error('not implemented');
}
