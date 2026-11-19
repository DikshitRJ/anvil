// Budgeted Context Pack: pins, RRF-ranked chunks, then a repo-map outline (D-008).
import type { CodeIndex } from './codeIndex';
import { chunkAt, rankCandidates, rankedChunks, type Candidate } from './rank';
import { tokenize } from './tokenize';
import { windowChunk } from './window';
import type { Chunk, ContextItem, ContextPack, ContextSignals } from './types';

export type { ContextItem, ContextPack, ContextSignals } from './types';

const PIN_SHARE = 0.5;
const WHOLE_FILE_SHARE = 0.35;
const REPO_MAP_SHARE = 0.1;
const MAX_PER_FILE = 3;
const CHUNK_CAP_SHARE = 0.12;

// Math.ceil(chars / 4)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function item(c: Chunk, kind: ContextItem['kind'], reason: string, score: number): ContextItem {
  return {
    path: c.path,
    startLine: c.startLine,
    endLine: c.endLine,
    kind,
    reason,
    score,
    tokens: estimateTokens(c.text),
    text: c.text,
  };
}

function overlaps(items: ContextItem[], path: string, a: number, b: number): boolean {
  return items.some((i) => i.path === path && (i.startLine ?? 0) <= b && (i.endLine ?? 0) >= a);
}

function wholeFile(index: CodeIndex, path: string): Chunk {
  const text = index.getContent(path) ?? '';
  return { id: path, path, startLine: 1, endLine: text.split('\n').length, text };
}

function fileMention(index: CodeIndex, path: string, q: Set<string>, budget: number): ContextItem[] {
  const whole = wholeFile(index, path);
  const reason = 'pinned: @mention';
  if (estimateTokens(whole.text) <= budget * WHOLE_FILE_SHARE) return [item(whole, 'pinned', reason, 1)];
  const top = rankedChunks(index, path, q).slice(0, 3);
  return top.sort((a, b) => a.startLine - b.startLine).map((c) => item(c, 'pinned', reason, 1));
}

function symbolMention(index: CodeIndex, name: string): ContextItem[] {
  const sym = index.findSymbol(name)[0];
  if (!sym) return [];
  const chunk = chunkAt(index, sym.path, sym.line);
  if (chunk) return [item(chunk, 'symbol', `pinned: @symbol ${name}`, 1)];
  const lines = (index.getContent(sym.path) ?? '').split('\n');
  const start = Math.max(1, sym.line - 5);
  const end = Math.min(lines.length, sym.endLine);
  const text = lines.slice(start - 1, end).join('\n');
  return [
    item({ id: '', path: sym.path, startLine: start, endLine: end, text }, 'symbol', `pinned: @symbol ${name}`, 1),
  ];
}

function selectionItem(s: ContextSignals, cap: number): ContextItem[] {
  if (!s.selection) return [];
  const sel = s.selection;
  const text = sel.text.length > cap * 4 ? sel.text.slice(0, cap * 4) : sel.text;
  const c: Chunk = { id: '', path: sel.path, startLine: sel.startLine, endLine: sel.endLine, text };
  return [item(c, 'selection', 'pinned: current selection', 1)];
}

function collectPins(
  index: CodeIndex,
  s: ContextSignals,
  budget: number,
): { pins: ContextItem[]; dropped: ContextPack['dropped'] } {
  const cap = Math.floor(budget * PIN_SHARE);
  const q = new Set(tokenize(s.query));
  const wanted = [...selectionItem(s, cap)];
  for (const m of s.mentions) {
    if (m.kind === 'file' && index.getContent(m.value) !== undefined)
      wanted.push(...fileMention(index, m.value, q, budget));
    if (m.kind === 'symbol') wanted.push(...symbolMention(index, m.value));
  }
  const pins: ContextItem[] = [];
  const dropped: ContextPack['dropped'] = [];
  let used = 0;
  for (const p of wanted) {
    if (overlaps(pins, p.path, p.startLine ?? 0, p.endLine ?? 0)) continue;
    if (used + p.tokens > cap) dropped.push({ path: p.path, reason: 'over budget' });
    else {
      pins.push(p);
      used += p.tokens;
    }
  }
  return { pins, dropped };
}

function repoMapItem(index: CodeIndex, focus: string[], reserve: number): ContextItem | undefined {
  let text = index.repoMap({ maxTokens: reserve, focus });
  if (estimateTokens(text) > reserve) text = text.slice(0, reserve * 4);
  if (!text) return undefined;
  return { path: '.', kind: 'repo-map', reason: 'repository outline', score: 0, tokens: estimateTokens(text), text };
}

function packRanked(
  cands: Candidate[],
  pins: ContextItem[],
  room: number,
  dropped: ContextPack['dropped'],
  q: Set<string>,
  cap: number,
): ContextItem[] {
  const out: ContextItem[] = [];
  let left = room;
  for (const cand of cands) {
    const c = windowChunk(cand.chunk, q, cap);
    const same = [...pins, ...out].filter((i) => i.path === c.path);
    if (same.length >= MAX_PER_FILE || overlaps(same, c.path, c.startLine, c.endLine)) continue;
    const it = item(c, 'chunk', cand.reasons.join('; '), cand.score);
    if (it.tokens > left) dropped.push({ path: c.path, reason: 'over budget' });
    else {
      out.push(it);
      left -= it.tokens;
    }
  }
  return out;
}

export function assembleContext(index: CodeIndex, s: ContextSignals, budget: number): ContextPack {
  const { pins, dropped } = collectPins(index, s, budget);
  const pinned = pins.reduce((a, i) => a + i.tokens, 0);
  const cands = rankCandidates(index, s);
  const focusFiles = [...new Set([...pins.map((i) => i.path), ...cands.map((c) => c.chunk.path)])].slice(0, 5);
  const map = repoMapItem(index, focusFiles, Math.floor(budget * REPO_MAP_SHARE));
  const room = budget - pinned - (map?.tokens ?? 0);
  const ranked = packRanked(
    cands,
    pins,
    room,
    dropped,
    new Set(tokenize(s.query)),
    Math.floor(budget * CHUNK_CAP_SHARE),
  );
  const items = [...pins, ...ranked, ...(map ? [map] : [])];
  return { items, budget, used: items.reduce((a, i) => a + i.tokens, 0), dropped };
}

function attr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// <anvil_context …> block placed in the user message
export function renderContextPack(p: ContextPack): string {
  const head = `<anvil_context budget="${p.budget}" used="${p.used}" note="Files pre-selected by Anvil; each item says why.">`;
  const body = p.items.map((i) => {
    const lines = i.startLine !== undefined ? ` lines="${i.startLine}-${i.endLine}"` : '';
    return `<item path="${attr(i.path)}"${lines} kind="${i.kind}" reason="${attr(i.reason)}">\n${i.text}\n</item>`;
  });
  return [head, ...body, '</anvil_context>'].join('\n');
}
