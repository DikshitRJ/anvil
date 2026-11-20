// Candidate generation and weighted Reciprocal Rank Fusion for context assembly.
import type { CodeIndex } from './codeIndex';
import { tokenize } from './tokenize';
import type { Chunk, ContextSignals } from './types';

const RRF_K = 60;

// Multiplier for paths that are rarely the right edit target (changelogs, data fixtures, tooling).
export function pathPrior(path: string): number {
  const base = path.slice(path.lastIndexOf('/') + 1);
  if (/^(CHANGES|CHANGELOG|HISTORY)([._-].*)?$/i.test(base)) return 0.3;
  if (/(^|\/)\.(devcontainer|github|circleci)\//.test(path)) return 0.5;
  if (/(^|\/)(tests?|static)\//.test(path) && /\.(json|toml|ya?ml|cfg|ini)$/i.test(path)) return 0.5;
  if (/(^|\/)(examples?|samples)\//i.test(path)) return 0.6;
  if (!path.includes('/') && /^\.[\w.-]*(config|rc|ignore)\b/i.test(base)) return 0.5;
  return 1;
}

export interface Candidate {
  chunk: Chunk;
  score: number;
  reasons: string[];
}
interface Entry {
  chunk: Chunk;
  reason: string;
}

// Relevance of a chunk to the query tokens (distinct matches, symbol-name matches count double).
export function chunkRelevance(c: Chunk, q: Set<string>): number {
  const body = new Set(tokenize(c.text));
  const sym = new Set(c.symbol ? tokenize(c.symbol) : []);
  let n = 0;
  for (const t of q) n += (body.has(t) ? 1 : 0) + (sym.has(t) ? 2 : 0);
  return n;
}

export function rankedChunks(index: CodeIndex, path: string, q: Set<string>): Chunk[] {
  return index
    .chunksOf(path)
    .map((c, i) => ({ c, r: chunkRelevance(c, q), i }))
    .sort((a, b) => b.r - a.r || a.i - b.i)
    .map((x) => x.c);
}

function bestChunk(index: CodeIndex, path: string, q: Set<string>): Chunk | undefined {
  return rankedChunks(index, path, q)[0];
}

export function chunkAt(index: CodeIndex, path: string, line: number): Chunk | undefined {
  return index.chunksOf(path).find((c) => c.startLine <= line && line <= c.endLine);
}

export function identifiers(query: string): string[] {
  const quoted = [...query.matchAll(/`([^`\s]+)`/g)].map((m) => m[1]!);
  const words = query
    .split(/[^\w]+/)
    .filter((w) => /^[A-Za-z_]\w*$/.test(w) && (w.includes('_') || /[a-z][A-Z]/.test(w)));
  return [...new Set([...quoted, ...words])];
}

const COMMON_PATH_TOKEN = 0.1;
const MIN_FILES_FOR_CUTOFF = 50; // the 10% cutoff is meaningless on tiny repos; IDF still applies

// Path-match signal: query tokens weighted by IDF over path tokens; tokens in >10% of paths are ignored.
function pathMatches(index: CodeIndex, q: Set<string>): { path: string; terms: string[] }[] {
  const toks = new Map(index.files().map((f) => [f, new Set(tokenize(f))]));
  const df = new Map<string, number>();
  for (const set of toks.values()) for (const t of set) df.set(t, (df.get(t) ?? 0) + 1);
  const n = toks.size;
  const rare = (t: string): boolean => n < MIN_FILES_FOR_CUTOFF || (df.get(t) ?? n) / n <= COMMON_PATH_TOKEN;
  const scored: { path: string; terms: string[]; s: number }[] = [];
  for (const [path, set] of toks) {
    const terms = [...q].filter((t) => set.has(t) && rare(t));
    const s = terms.reduce((a, t) => a + Math.log(1 + n / df.get(t)!), 0);
    if (terms.length) scored.push({ path, terms, s });
  }
  return scored.sort((a, b) => b.s - a.s || (a.path < b.path ? -1 : 1)).slice(0, 20);
}

function editorFiles(s: ContextSignals): { path: string; reason: string }[] {
  const out: { path: string; reason: string }[] = [];
  if (s.activeFile) out.push({ path: s.activeFile, reason: 'active editor' });
  for (const f of s.openFiles) out.push({ path: f, reason: 'open editor' });
  for (const f of s.recentFiles) out.push({ path: f, reason: 'recently edited' });
  return out;
}

class Fusion {
  private map = new Map<string, Candidate>();

  addList(list: Entry[], weight: number): void {
    list.forEach((e, i) => {
      const cur = this.map.get(e.chunk.id) ?? { chunk: e.chunk, score: 0, reasons: [] };
      cur.score += weight / (RRF_K + i + 1);
      if (!cur.reasons.includes(e.reason)) cur.reasons.push(e.reason);
      this.map.set(e.chunk.id, cur);
    });
  }

  sorted(): Candidate[] {
    const fused = [...this.map.values()].map((c) => ({ ...c, score: c.score * pathPrior(c.chunk.path) }));
    return fused.sort((a, b) => b.score - a.score || (a.chunk.id < b.chunk.id ? -1 : 1));
  }

  topFiles(n: number): string[] {
    return [...new Set(this.sorted().map((c) => c.chunk.path))].slice(0, n);
  }
}

function symbolEntries(index: CodeIndex, query: string): Entry[] {
  const out: Entry[] = [];
  for (const name of identifiers(query)) {
    for (const s of index.findSymbol(name).filter((x) => x.name.toLowerCase() === name.toLowerCase())) {
      const chunk = chunkAt(index, s.path, s.line);
      if (chunk) out.push({ chunk, reason: `symbol match: ${name}` });
    }
  }
  return out;
}

function filesToEntries(index: CodeIndex, files: { path: string; reason: string }[], q: Set<string>): Entry[] {
  const out: Entry[] = [];
  for (const f of files) {
    const chunk = bestChunk(index, f.path, q);
    if (chunk) out.push({ chunk, reason: f.reason });
  }
  return out;
}

export function rankCandidates(index: CodeIndex, s: ContextSignals): Candidate[] {
  const q = new Set(tokenize(s.query));
  const fusion = new Fusion();
  fusion.addList(
    index.search(s.query, 30).map((h) => ({ chunk: h.chunk, reason: `bm25: "${h.matched.join(' ')}"` })),
    1.0,
  );
  fusion.addList(symbolEntries(index, s.query), 1.0);
  const paths = pathMatches(index, q).map((m) => ({ path: m.path, reason: `path match: ${m.terms.join(' ')}` }));
  fusion.addList(filesToEntries(index, paths, q), 0.6);
  fusion.addList(filesToEntries(index, editorFiles(s), q), 0.5);
  const neighbours: { path: string; reason: string }[] = [];
  for (const top of fusion.topFiles(3)) {
    for (const n of index.neighbors(top)) neighbours.push({ path: n, reason: `imports/imported by ${top}` });
  }
  fusion.addList(filesToEntries(index, neighbours.slice(0, 15), q), 0.4);
  return fusion.sorted();
}
