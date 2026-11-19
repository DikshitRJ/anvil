// Line-based diff hunks: compute change-only hunks, apply/preview a subset of them, summarize for the agent.
import { diffArrays } from 'diff';

export interface Hunk {
  id: number;
  origStart: number;
  origLines: string[];
  newStart: number;
  newLines: string[];
  // set only on the hunk that reaches the end of both files: proposed file's end-of-file style
  eof?: { trailingNewline: boolean; eol: '\n' | '\r\n' };
}
// origStart/newStart: 0-based line indices. Hunks contain only changed lines (no context lines).
export type HunkDecision = 'pending' | 'accepted' | 'rejected';

type Eol = '\n' | '\r\n';

export function splitLines(text: string): { lines: string[]; eol: Eol; trailingNewline: boolean } {
  const eol: Eol = text.includes('\r\n') ? '\r\n' : '\n';
  const trailingNewline = text.endsWith('\n');
  if (text === '') return { lines: [], eol, trailingNewline };
  const lines = text.split(/\r?\n/);
  if (trailingNewline) lines.pop();
  return { lines, eol, trailingNewline };
}

export function computeHunks(original: string, proposed: string): Hunk[] {
  const o = splitLines(original);
  const p = splitLines(proposed);
  const hunks: Hunk[] = [];
  let oi = 0;
  let ni = 0;
  let cur: Hunk | undefined;
  const flush = (): void => {
    if (!cur) return;
    const atEnd =
      cur.origStart + cur.origLines.length === o.lines.length && cur.newStart + cur.newLines.length === p.lines.length;
    if (atEnd) cur.eof = { trailingNewline: p.trailingNewline, eol: p.eol };
    hunks.push(cur);
    cur = undefined;
  };
  for (const part of diffArrays(o.lines, p.lines)) {
    const values = part.value;
    if (!part.added && !part.removed) {
      flush();
      oi += values.length;
      ni += values.length;
      continue;
    }
    cur ??= { id: hunks.length, origStart: oi, origLines: [], newStart: ni, newLines: [] };
    if (part.removed) {
      cur.origLines.push(...values);
      oi += values.length;
    } else {
      cur.newLines.push(...values);
      ni += values.length;
    }
  }
  flush();
  return hunks;
}

export function applyHunks(original: string, hunks: Hunk[], accepted: ReadonlySet<number>): string {
  const o = splitLines(original);
  const sorted = [...hunks].sort((a, b) => a.origStart - b.origStart);
  const out: string[] = [];
  let pos = 0;
  let trailing = o.trailingNewline;
  let eol = o.eol;
  for (const h of sorted) {
    out.push(...o.lines.slice(pos, h.origStart));
    const take = accepted.has(h.id);
    out.push(...(take ? h.newLines : h.origLines));
    pos = h.origStart + h.origLines.length;
    if (take && h.eof) {
      trailing = h.eof.trailingNewline;
      if (original === '') eol = h.eof.eol;
    }
  }
  out.push(...o.lines.slice(pos));
  if (out.length === 0) return '';
  return out.join(eol) + (trailing ? eol : '');
}

// pending+accepted applied
export function previewContent(original: string, hunks: Hunk[], decisions: ReadonlyMap<number, HunkDecision>): string {
  const keep = new Set(hunks.filter((h) => decisions.get(h.id) !== 'rejected').map((h) => h.id));
  return applyHunks(original, hunks, keep);
}

function clip(prefix: string, lines: string[], max: number): string[] {
  const shown = lines.slice(0, max).map((l) => prefix + l);
  if (lines.length > max) shown.push(`… (${lines.length - max} more lines)`);
  return shown;
}

// unified-diff style text for agent feedback
export function summarizeHunk(h: Hunk, maxLines = 12): string {
  const a = h.origLines.length === 0 ? h.origStart : h.origStart + 1;
  const c = h.newLines.length === 0 ? h.newStart : h.newStart + 1;
  const header = `@@ -${a},${h.origLines.length} +${c},${h.newLines.length} @@`;
  return [header, ...clip('-', h.origLines, maxLines), ...clip('+', h.newLines, maxLines)].join('\n');
}
