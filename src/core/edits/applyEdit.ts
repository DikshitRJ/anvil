// Pure simulation of an edit operation on file text (exact match, then whitespace-tolerant line match).
export type EditOp =
  | { kind: 'write'; path: string; content: string }
  | { kind: 'replace'; path: string; oldString: string; newString: string; replaceAll?: boolean };

export type EditErrorCode = 'FILE_NOT_FOUND' | 'NOT_FOUND' | 'AMBIGUOUS' | 'NO_CHANGE' | 'INVALID';

export class EditError extends Error {
  constructor(
    public code: EditErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'EditError';
  }
}

type ReplaceOp = Extract<EditOp, { kind: 'replace' }>;

const toLf = (s: string): string => s.replace(/\r\n/g, '\n');
const indentOf = (l: string): string => /^[ \t]*/.exec(l)![0];

function countOccurrences(text: string, needle: string): number {
  let n = 0;
  for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + needle.length)) n++;
  return n;
}

function stripBlankEnds(lines: string[]): string[] {
  let s = 0;
  let e = lines.length;
  while (s < e && (lines[s] ?? '').trim() === '') s++;
  while (e > s && (lines[e - 1] ?? '').trim() === '') e--;
  return lines.slice(s, e);
}

function reindent(lines: string[], delta: number, unit: string): string[] {
  return lines.map((l) => {
    if (l.trim() === '') return l;
    if (delta > 0) return unit.repeat(delta) + l;
    return l.slice(Math.min(-delta, indentOf(l).length));
  });
}

function findWindows(cur: string[], oldLines: string[]): number[] {
  const starts: number[] = [];
  for (let i = 0; i + oldLines.length <= cur.length; i++) {
    if (oldLines.every((l, k) => l.trim() === (cur[i + k] ?? '').trim())) starts.push(i);
  }
  return starts;
}

function fuzzyReplace(current: string, eol: string, op: ReplaceOp): string {
  const oldLines = stripBlankEnds(toLf(op.oldString).split('\n'));
  const cur = current.split(eol);
  const starts = oldLines.length > 0 ? findWindows(cur, oldLines) : [];
  if (starts.length === 0) {
    const q = oldLines[0]?.trim() ?? '';
    throw new EditError(
      'NOT_FOUND',
      `old_string not found (first line: "${q}"). read_file the region first; old_string must match exactly.`,
    );
  }
  if (starts.length > 1) {
    throw new EditError(
      'AMBIGUOUS',
      `old_string matches ${starts.length} places (ignoring whitespace); add surrounding lines to make it unique.`,
    );
  }
  const at = starts[0] ?? 0;
  const curIndent = indentOf(cur[at] ?? '');
  const delta = curIndent.length - indentOf(oldLines[0] ?? '').length;
  const unit = curIndent.startsWith('\t') ? '\t' : ' ';
  const newLines = reindent(stripBlankEnds(toLf(op.newString).split('\n')), delta, unit);
  return [...cur.slice(0, at), ...newLines, ...cur.slice(at + oldLines.length)].join(eol);
}

function replaceExact(current: string, oldS: string, newS: string, all: boolean): string | null {
  const n = countOccurrences(current, oldS);
  if (n === 0) return null;
  if (n > 1 && !all) {
    throw new EditError(
      'AMBIGUOUS',
      `old_string matches ${n} places; add surrounding lines to make it unique, or set replaceAll.`,
    );
  }
  return all ? current.split(oldS).join(newS) : current.replace(oldS, () => newS);
}

function simulateReplace(current: string | null, op: ReplaceOp): string {
  if (current === null) throw new EditError('FILE_NOT_FOUND', `File not found: ${op.path}`);
  if (op.oldString === '') throw new EditError('INVALID', 'old_string must not be empty.');
  const eol = current.includes('\r\n') ? '\r\n' : '\n';
  const fit = (s: string): string => (eol === '\r\n' ? toLf(s).replace(/\n/g, '\r\n') : toLf(s));
  const exact = replaceExact(current, fit(op.oldString), fit(op.newString), !!op.replaceAll);
  const result = exact ?? fuzzyReplace(current, eol, op);
  if (result === current) throw new EditError('NO_CHANGE', 'The edit would not change the file.');
  return result;
}

// exact match first; then a whitespace-tolerant line match (trimmed lines) if it is unique.
export function simulateEdit(current: string | null, op: EditOp): string {
  if (op.kind === 'replace') return simulateReplace(current, op);
  if (current === op.content) throw new EditError('NO_CHANGE', 'The file already has this content.');
  return op.content;
}
