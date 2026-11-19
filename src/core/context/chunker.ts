// Splits a file into retrieval chunks aligned with symbol boundaries.
import type { Chunk, SymbolInfo } from './types';

export type { Chunk } from './types';

const BIG_CLASS = 120;
const MAX_CHUNK = 150;
const WINDOW = 120;
const PLAIN_WINDOW = 60;
const PLAIN_OVERLAP = 10;
const MIN_GAP_LINES = 3;

type Lines = string[];

function make(path: string, lines: Lines, start: number, end: number, symbol?: string): Chunk {
  return {
    id: `${path}#${start}-${end}`,
    path,
    startLine: start,
    endLine: end,
    text: lines.slice(start - 1, end).join('\n'),
    symbol,
  };
}

function nonEmpty(lines: Lines, start: number, end: number): number {
  return lines.slice(start - 1, end).filter((l) => l.trim() !== '').length;
}

// One chunk for the range, or fixed windows when it is too long.
function range(path: string, lines: Lines, start: number, end: number, symbol?: string): Chunk[] {
  if (end < start || nonEmpty(lines, start, end) === 0) return [];
  if (end - start + 1 <= MAX_CHUNK) return [make(path, lines, start, end, symbol)];
  const out: Chunk[] = [];
  for (let s = start; s <= end; s += WINDOW) out.push(make(path, lines, s, Math.min(end, s + WINDOW - 1), symbol));
  return out;
}

function gap(path: string, lines: Lines, start: number, end: number, symbol?: string): Chunk[] {
  return nonEmpty(lines, start, end) >= MIN_GAP_LINES ? range(path, lines, start, end, symbol) : [];
}

function qualified(s: SymbolInfo): string {
  return s.container ? `${s.container}.${s.name}` : s.name;
}

function bigClass(path: string, lines: Lines, cls: SymbolInfo, methods: SymbolInfo[]): Chunk[] {
  const out = gap(path, lines, cls.line, methods[0]!.line - 1, cls.name);
  for (const m of methods) out.push(...range(path, lines, m.line, m.endLine, qualified(m)));
  const last = methods[methods.length - 1]!;
  return out.concat(gap(path, lines, last.endLine + 1, cls.endLine, cls.name));
}

function windows(path: string, lines: Lines): Chunk[] {
  const out: Chunk[] = [];
  const step = PLAIN_WINDOW - PLAIN_OVERLAP;
  for (let s = 1; s <= lines.length; s += step) {
    const e = Math.min(lines.length, s + PLAIN_WINDOW - 1);
    if (nonEmpty(lines, s, e) > 0) out.push(make(path, lines, s, e));
    if (e === lines.length) break;
  }
  return out;
}

// Headings become flat sections ending right before the next heading.
function flatten(symbols: SymbolInfo[]): SymbolInfo[] {
  const sorted = [...symbols].sort((a, b) => a.line - b.line);
  return sorted.map((s, i) =>
    s.kind === 'heading' && sorted[i + 1]! ? { ...s, endLine: Math.max(s.line, sorted[i + 1]!.line - 1) } : s,
  );
}

function topLevel(symbols: SymbolInfo[]): SymbolInfo[] {
  const tops: SymbolInfo[] = [];
  for (const s of symbols) {
    const prev = tops[tops.length - 1];
    if (!prev || s.line > prev.endLine) tops.push(s);
  }
  return tops;
}

export function chunkFile(path: string, content: string, symbols: SymbolInfo[]): Chunk[] {
  const lines = content.split('\n');
  if (lines[lines.length - 1]! === '') lines.pop();
  if (symbols.length === 0) return windows(path, lines);
  const all = flatten(symbols);
  const out: Chunk[] = [];
  let cursor = 1;
  for (const top of topLevel(all)) {
    out.push(...gap(path, lines, cursor, top.line - 1));
    const methods = all.filter(
      (s) => s !== top && s.line > top.line && s.endLine <= top.endLine && s.kind === 'method',
    );
    const big = top.endLine - top.line + 1 > BIG_CLASS && top.kind === 'class' && methods.length > 0;
    out.push(
      ...(big ? bigClass(path, lines, top, methods) : range(path, lines, top.line, top.endLine, qualified(top))),
    );
    cursor = top.endLine + 1;
  }
  return out.concat(gap(path, lines, cursor, lines.length));
}
