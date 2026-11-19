// Regex symbol extraction (D-009). Python/Ruby are indentation based, Markdown/RST
// are heading based, brace languages live in symbolsBrace.ts. Python symbols start at
// their first decorator line.
import { extractBrace, isBraceLanguage } from './symbolsBrace';
import type { SymbolInfo } from './types';

export type { SymbolInfo } from './types';

const MAX_LEN = 400;

function extOf(path: string): string {
  const i = path.lastIndexOf('.');
  return i < 0 ? '' : path.slice(i).toLowerCase();
}

function indentOf(l: string): number {
  return l.length - l.trimStart().length;
}

// Index of the line that ends the signature (python: line ending with ':', max 5 lines).
function signatureEnd(lines: string[], i: number): number {
  for (let j = i; j < Math.min(lines.length, i + 5); j++) {
    if (
      lines[j]!.replace(/\s*#.*$/, '')
        .trimEnd()
        .endsWith(':')
    )
      return j;
  }
  return i;
}

// Last body line of an indented block that starts after `from`.
function indentEnd(lines: string[], from: number, indent: number, isComment: (l: string) => boolean): number {
  let last = from;
  for (let j = from + 1; j < Math.min(lines.length, from + MAX_LEN); j++) {
    const l = lines[j]!;
    if (l.trim() === '' || isComment(l.trim())) continue;
    if (indentOf(l) <= indent) break;
    last = j;
  }
  return last;
}

function pythonStart(lines: string[], i: number): number {
  let s = i;
  while (s > 0 && /^\s*@/.test(lines[s - 1]!)) s--;
  return s;
}

function extractPython(path: string, lines: string[]): SymbolInfo[] {
  const out: SymbolInfo[] = [];
  const stack: { indent: number; name: string; isClass: boolean }[] = [];
  const re = /^(\s*)(?:async\s+)?(def|class)\s+(\w+)/;
  lines.forEach((line, i) => {
    const m = line.match(re);
    if (!m) return;
    const indent = m[1]!.length;
    while (stack.length && stack[stack.length - 1]!.indent >= indent) stack.pop();
    const parent = stack[stack.length - 1];
    const isClass = m[2]! === 'class';
    stack.push({ indent, name: m[3]!, isClass });
    if (parent && !parent.isClass) return; // nested function
    const sigEnd = signatureEnd(lines, i);
    const sig = lines
      .slice(i, sigEnd + 1)
      .map((l) => l.trim())
      .join(' ');
    out.push({
      name: m[3]!,
      kind: isClass ? 'class' : parent ? 'method' : 'function',
      path,
      line: pythonStart(lines, i) + 1,
      endLine: indentEnd(lines, sigEnd, indent, (t) => t.startsWith('#')) + 1,
      container: parent?.name,
      signature: sig,
    });
  });
  return out;
}

function extractRuby(path: string, lines: string[]): SymbolInfo[] {
  const out: SymbolInfo[] = [];
  const stack: { indent: number; name: string }[] = [];
  lines.forEach((line, i) => {
    const m = line.match(/^(\s*)(def|class|module)\s+(?:self\.)?([\w:]+[?!=]?)/);
    if (!m) return;
    while (stack.length && stack[stack.length - 1]!.indent >= m[1]!.length) stack.pop();
    const parent = stack[stack.length - 1];
    let end = indentEnd(lines, i, m[1]!.length, (t) => t.startsWith('#'));
    if (lines[end + 1]?.trim() === 'end' && indentOf(lines[end + 1]!) === m[1]!.length) end++;
    if (m[2]! !== 'def') stack.push({ indent: m[1]!.length, name: m[3]! });
    out.push({
      name: m[3]!,
      kind: m[2]! === 'def' ? (parent ? 'method' : 'function') : m[2]! === 'class' ? 'class' : 'module',
      path,
      line: i + 1,
      endLine: end + 1,
      container: parent?.name,
      signature: line.trim(),
    });
  });
  return out;
}

function withFences(lines: string[]): boolean[] {
  let fenced = false;
  return lines.map((l) => {
    if (/^\s*(```|~~~)/.test(l)) {
      fenced = !fenced;
      return true;
    }
    return fenced;
  });
}

// Fills endLine of headings: until the line before the next heading of same or higher level.
function closeHeadings(heads: { sym: SymbolInfo; level: number }[], total: number): SymbolInfo[] {
  heads.forEach((h, idx) => {
    const next = heads.slice(idx + 1).find((n) => n.level <= h.level);
    h.sym.endLine = Math.min(next ? next.sym.line - 1 : total, h.sym.line + MAX_LEN - 1);
  });
  return heads.map((h) => h.sym);
}

function heading(path: string, name: string, line: number, sig: string): SymbolInfo {
  return { name, kind: 'heading', path, line, endLine: line, signature: sig };
}

function extractMarkdown(path: string, lines: string[]): SymbolInfo[] {
  const fenced = withFences(lines);
  const heads: { sym: SymbolInfo; level: number }[] = [];
  lines.forEach((l, i) => {
    const m = !fenced[i] && l.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (m && m[2]!) heads.push({ sym: heading(path, m[2]!, i + 1, l.trim()), level: m[1]!.length });
  });
  return closeHeadings(heads, lines.length);
}

const RST_CHARS = '=-~^"\'`#*+';

function underlineChar(l: string): string | undefined {
  const t = l.trimEnd();
  return t.length >= 2 && RST_CHARS.includes(t[0]!) && t === t[0]!.repeat(t.length) ? t[0] : undefined;
}

function extractRst(path: string, lines: string[]): SymbolInfo[] {
  const order: string[] = [];
  const heads: { sym: SymbolInfo; level: number }[] = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    const text = lines[i]!.trim();
    const u = underlineChar(lines[i + 1]!);
    if (!text || underlineChar(lines[i]!) || !u || lines[i + 1]!.trimEnd().length < text.length) continue;
    if (!order.includes(u)) order.push(u);
    heads.push({ sym: heading(path, text, i + 1, text), level: order.indexOf(u) + 1 });
    i++;
  }
  return closeHeadings(heads, lines.length);
}

export function extractSymbols(path: string, content: string): SymbolInfo[] {
  const ext = extOf(path);
  const lines = content.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  let syms: SymbolInfo[] = [];
  if (ext === '.py') syms = extractPython(path, lines);
  else if (ext === '.rb') syms = extractRuby(path, lines);
  else if (ext === '.md') syms = extractMarkdown(path, lines);
  else if (ext === '.rst') syms = extractRst(path, lines);
  else if (isBraceLanguage(ext)) syms = extractBrace(path, ext, lines);
  for (const s of syms) s.endLine = Math.max(s.line, Math.min(s.endLine, s.line + MAX_LEN - 1));
  return syms;
}
