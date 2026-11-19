// Inline-edit prompt building and model-reply parsing (fenced code extraction, indentation matching).
export interface InlineRequest {
  path: string;
  languageId: string;
  before: string;
  selection: string;
  after: string;
  instruction: string;
  context?: string;
}

const lastLines = (s: string, n: number): string => s.split('\n').slice(-n).join('\n');
const firstLines = (s: string, n: number): string => s.split('\n').slice(0, n).join('\n');
const fenced = (body: string, lang = ''): string => `\`\`\`${lang}\n${body}\n\`\`\``;

export function buildInlinePrompt(r: InlineRequest): string {
  const parts = [
    `File: ${r.path} (${r.languageId})`,
    `Instruction: ${r.instruction}`,
    `Code before the selection (context, do not repeat):\n${fenced(lastLines(r.before, 60))}`,
    `SELECTION (rewrite this):\n${fenced(r.selection, r.languageId)}`,
    `Code after the selection (context, do not repeat):\n${fenced(firstLines(r.after, 30))}`,
  ];
  if (r.context) parts.push(`Related definitions:\n${r.context}`);
  parts.push(
    'Reply with exactly one fenced code block containing the full replacement for the SELECTION only — no explanation.',
  );
  return parts.join('\n\n');
}

const OPEN = /^\s*(`{3,}|~{3,})[^`]*$/;
const CLOSE = /^\s*(`{3,}|~{3,})\s*$/;
const splitText = (t: string): string[] => t.split(/\r?\n/);

interface Block {
  lines: string[];
  closed: boolean;
}

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let cur: Block | undefined;
  let fence = '';
  for (const line of lines) {
    if (!cur) {
      const m = OPEN.exec(line);
      if (m) {
        fence = m[1] ?? '```';
        cur = { lines: [], closed: false };
        blocks.push(cur);
      }
      continue;
    }
    const c = CLOSE.exec(line);
    if (c && (c[1] ?? '')[0] === fence[0] && (c[1] ?? '').length >= fence.length) {
      cur.closed = true;
      cur = undefined;
    } else {
      cur.lines.push(line);
    }
  }
  return blocks;
}

function trimBlankEnds(lines: string[]): string[] {
  let s = 0;
  let e = lines.length;
  while (s < e && (lines[s] ?? '').trim() === '') s++;
  while (e > s && (lines[e - 1] ?? '').trim() === '') e--;
  return lines.slice(s, e);
}

// last complete fenced block, else whole text trimmed of fences
export function extractReplacement(text: string): string {
  const lines = splitText(text);
  const closed = parseBlocks(lines).filter((b) => b.closed);
  const lastBlock = closed[closed.length - 1];
  if (lastBlock) return lastBlock.lines.join('\n');
  const body = trimBlankEnds(lines);
  if (body.length > 0 && OPEN.test(body[0] ?? '')) {
    const rest = body.slice(1);
    if (rest.length > 0 && CLOSE.test(rest[rest.length - 1] ?? '')) rest.pop();
    return rest.join('\n');
  }
  return body.join('\n');
}

// streaming-safe (inside an unterminated fence)
export function extractPartialReplacement(text: string): string {
  const blocks = parseBlocks(splitText(text));
  return blocks[0] ? blocks[0].lines.join('\n') : text;
}

export function matchIndentation(replacement: string, selection: string): string {
  const indent = (l: string): string => /^[ \t]*/.exec(l)![0];
  const selFirst = selection.split('\n').find((l) => l.trim() !== '');
  const base = selFirst === undefined ? '' : indent(selFirst);
  let lines = replacement.split('\n');
  const nonEmpty = lines.filter((l) => l.trim() !== '');
  if (nonEmpty.length > 0) {
    const min = Math.min(...nonEmpty.map((l) => indent(l).length));
    if (min < base.length) {
      const missing = base.slice(min);
      lines = lines.map((l) => (l.trim() === '' ? l : missing + l));
    }
  }
  const body = lines.join('\n').replace(/\n+$/, '');
  if (body === '') return '';
  return selection.endsWith('\n') ? `${body}\n` : body;
}
