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
  // lines are unchanged: the hunk only carries a trailing-newline / EOL change (origLines equals newLines)
  eofOnly?: boolean;
}
// origStart/newStart: 0-based line indices. Hunks contain only changed lines (no context lines).
export type HunkDecision = 'pending' | 'accepted' | 'rejected';

type Eol = '\n' | '\r\n';

// eols[i] is the terminator that followed lines[i] ('' only for a last line without trailing newline).
// eol is the dominant style (CRLF when CRLF terminators are at least as common as bare LF, else LF).
export function splitLines(text: string): {
  lines: string[];
  eol: Eol;
  trailingNewline: boolean;
  eols: string[];
} {
  const lines: string[] = [];
  const eols: string[] = [];
  let crlf = 0;
  let lf = 0;
  let pos = 0;
  for (;;) {
    const nl = text.indexOf('\n', pos);
    if (nl < 0) break;
    const isCrlf = nl > pos && text[nl - 1] === '\r';
    lines.push(text.slice(pos, isCrlf ? nl - 1 : nl));
    eols.push(isCrlf ? '\r\n' : '\n');
    if (isCrlf) crlf++;
    else lf++;
    pos = nl + 1;
  }
  const trailingNewline = text.endsWith('\n');
  if (pos < text.length) {
    lines.push(text.slice(pos));
    eols.push('');
  }
  const eol: Eol = crlf > 0 && crlf >= lf ? '\r\n' : '\n';
  return { lines, eol, trailingNewline, eols };
}

export function computeHunks(original: string, proposed: string): Hunk[] {
  const o = splitLines(original);
  const p = splitLines(proposed);
  // the proposed style only counts when the proposed text has a terminator to learn it from
  const pEol: Eol = p.eols.some((e) => e !== '') ? p.eol : o.eol;
  const hunks: Hunk[] = [];
  let oi = 0;
  let ni = 0;
  let cur: Hunk | undefined;
  const flush = (): void => {
    if (!cur) return;
    const atEnd =
      cur.origStart + cur.origLines.length === o.lines.length && cur.newStart + cur.newLines.length === p.lines.length;
    if (atEnd) cur.eof = { trailingNewline: p.trailingNewline, eol: pEol };
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
  // same lines but a different trailing newline / dominant EOL: surface it as a hunk over the last line
  const eofChanged = o.trailingNewline !== p.trailingNewline || pEol !== o.eol;
  if (eofChanged && o.lines.length > 0 && p.lines.length > 0 && !hunks.at(-1)?.eof) {
    hunks.push({
      id: hunks.length,
      origStart: o.lines.length - 1,
      origLines: [o.lines[o.lines.length - 1] ?? ''],
      newStart: p.lines.length - 1,
      newLines: [p.lines[p.lines.length - 1] ?? ''],
      eof: { trailingNewline: p.trailingNewline, eol: pEol },
      eofOnly: true,
    });
  }
  return hunks;
}

// Untouched and rejected lines keep their own terminators. Inserted lines use the file's dominant EOL.
// An accepted hunk with `eof` also sets the trailing newline and the dominant EOL; when that EOL differs from the
// original's, every terminator in the file is rewritten to it (so accepting all hunks yields the proposed text).
export function applyHunks(original: string, hunks: Hunk[], accepted: ReadonlySet<number>): string {
  const o = splitLines(original);
  const sorted = [...hunks].sort((a, b) => a.origStart - b.origStart);
  const out: { text: string; term: string | null }[] = [];
  const keep = (from: number, to: number): void => {
    for (let i = from; i < to; i++) out.push({ text: o.lines[i] ?? '', term: o.eols[i] ?? '' });
  };
  let pos = 0;
  let trailing = o.trailingNewline;
  let eol = o.eol;
  for (const h of sorted) {
    keep(pos, h.origStart);
    if (accepted.has(h.id)) {
      for (const l of h.newLines) out.push({ text: l, term: null });
      if (h.eof) {
        trailing = h.eof.trailingNewline;
        eol = h.eof.eol;
      }
    } else {
      keep(h.origStart, h.origStart + h.origLines.length);
    }
    pos = h.origStart + h.origLines.length;
  }
  keep(pos, o.lines.length);
  if (out.length === 0) return '';
  const convert = eol !== o.eol;
  const termOf = (t: string | null): string => (t && !convert ? t : eol);
  return out.map((e, i) => e.text + (i < out.length - 1 ? termOf(e.term) : trailing ? termOf(e.term) : '')).join('');
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
