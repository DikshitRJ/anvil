// In-memory code index: file contents, symbols, chunks, BM25, import graph, grep, repo map.
// Binary files (NUL byte in the first 8 KB) are skipped here, at read time.
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import picomatch from 'picomatch';
import { estimateTokens } from './assemble';
import { Bm25Index } from './bm25';
import { chunkFile } from './chunker';
import { extractImports, resolveImports, type ImportSpec } from './imports';
import { extractSymbols } from './symbols';
import { tokenize } from './tokenize';
import type { Chunk, SearchHit, SymbolInfo } from './types';
import { walkWorkspace } from './walker';

const CONCURRENCY = 32;
const MAX_PER_FILE = 3;

function isIdentifierLike(w: string): boolean {
  return /^[A-Za-z_]\w*$/.test(w) && (w.includes('_') || /[a-z][A-Z]|^[A-Z][a-z]+[A-Z]/.test(w));
}

function lastSegment(name: string): string {
  return name.slice(name.lastIndexOf('.') + 1);
}

export class CodeIndex {
  private contents = new Map<string, string>();
  private syms = new Map<string, SymbolInfo[]>();
  private chunks = new Map<string, Chunk[]>();
  private chunkById = new Map<string, Chunk>();
  private pathTokens = new Map<string, Set<string>>();
  private specs = new Map<string, ImportSpec[]>();
  private graph: { out: Map<string, Set<string>>; in: Map<string, Set<string>> } | undefined;
  private bm25 = new Bm25Index();

  constructor(protected root: string) {}

  async build(onProgress?: (done: number, total: number) => void): Promise<void> {
    const rels = await walkWorkspace(this.root);
    let next = 0;
    let done = 0;
    const worker = async (): Promise<void> => {
      while (next < rels.length) {
        const rel = rels[next++]!;
        const buf = await fs.readFile(path.join(this.root, rel)).catch(() => undefined);
        if (buf && !buf.subarray(0, 8192).includes(0)) this.updateFile(rel, buf.toString('utf8'));
        onProgress?.(++done, rels.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rels.length) }, worker));
  }

  updateFile(rel: string, content: string): void {
    this.removeFile(rel);
    const symbols = extractSymbols(rel, content);
    const chunks = chunkFile(rel, content, symbols);
    const pathToks = tokenize(rel);
    this.contents.set(rel, content);
    this.syms.set(rel, symbols);
    this.chunks.set(rel, chunks);
    this.pathTokens.set(rel, new Set(pathToks));
    this.specs.set(rel, extractImports(rel, content));
    for (const c of chunks) {
      this.chunkById.set(c.id, c);
      const symToks = c.symbol ? tokenize(c.symbol) : [];
      const toks = [...pathToks, ...pathToks, ...symToks, ...symToks, ...symToks, ...tokenize(c.text)];
      this.bm25.add(c.id, toks);
    }
    this.graph = undefined;
  }

  removeFile(rel: string): void {
    for (const c of this.chunks.get(rel) ?? []) {
      this.bm25.remove(c.id);
      this.chunkById.delete(c.id);
    }
    for (const m of [this.contents, this.syms, this.chunks, this.pathTokens, this.specs]) m.delete(rel);
    this.graph = undefined;
  }

  files(): string[] {
    return [...this.contents.keys()].sort();
  }

  getContent(rel: string): string | undefined {
    return this.contents.get(rel);
  }

  symbolsOf(rel: string): SymbolInfo[] {
    return this.syms.get(rel) ?? [];
  }

  chunksOf(rel: string): Chunk[] {
    return this.chunks.get(rel) ?? [];
  }

  search(query: string, k = 10): SearchHit[] {
    const q = tokenize(query);
    const idents = new Set(query.split(/[^\w]+/).filter(isIdentifierLike));
    const scored = this.bm25.search(q, Math.max(k * 8, 60)).map((h) => {
      const chunk = this.chunkById.get(h.id) as Chunk;
      let score = h.score;
      if (q.some((t) => this.pathTokens.get(chunk.path)?.has(t))) score *= 1.25;
      if (chunk.symbol && idents.has(lastSegment(chunk.symbol))) score *= 1.4;
      return { chunk, score, matched: h.matched };
    });
    scored.sort((a, b) => b.score - a.score || (a.chunk.id < b.chunk.id ? -1 : 1));
    const perFile = new Map<string, number>();
    const out: SearchHit[] = [];
    for (const h of scored) {
      const n = perFile.get(h.chunk.path) ?? 0;
      if (n >= MAX_PER_FILE) continue;
      perFile.set(h.chunk.path, n + 1);
      out.push(h);
      if (out.length >= k) break;
    }
    return out;
  }

  findSymbol(name: string, kind?: string): SymbolInfo[] {
    const all = [...this.syms.values()].flat().filter((s) => !kind || s.kind === kind);
    const lower = name.toLowerCase();
    const qual = (s: SymbolInfo): string => (s.container ? `${s.container}.${s.name}` : s.name);
    const stages: ((s: SymbolInfo) => boolean)[] = [
      (s) => s.name === name,
      (s) => s.name.toLowerCase() === lower,
      (s) => qual(s) === name || qual(s).endsWith(`.${name}`) || qual(s).toLowerCase().endsWith(lower),
      (s) => s.name.toLowerCase().startsWith(lower),
      (s) => s.name.toLowerCase().includes(lower),
    ];
    const seen = new Set<SymbolInfo>();
    for (const test of stages) {
      for (const s of all) if (test(s)) seen.add(s);
      if (seen.size >= 20) break;
    }
    return [...seen].slice(0, 20);
  }

  grep(
    pattern: string,
    opts?: { glob?: string; limit?: number; ignoreCase?: boolean },
  ): { path: string; line: number; text: string }[] {
    const flags = opts?.ignoreCase ? 'i' : '';
    let re: RegExp;
    try {
      re = new RegExp(pattern, flags);
    } catch {
      re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    }
    const glob = opts?.glob;
    const match = glob ? picomatch(glob, { dot: true, basename: !glob.includes('/') }) : () => true;
    const limit = opts?.limit ?? 100;
    const out: { path: string; line: number; text: string }[] = [];
    for (const rel of this.files()) {
      if (!match(rel)) continue;
      const lines = (this.contents.get(rel) as string).split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (!re.test(lines[i]!)) continue;
        out.push({ path: rel, line: i + 1, text: lines[i]!.trim().slice(0, 200) });
        if (out.length >= limit) return out;
      }
    }
    return out;
  }

  // 1-hop import graph (both directions)
  neighbors(rel: string): string[] {
    const g = this.importGraph();
    return [...new Set([...(g.out.get(rel) ?? []), ...(g.in.get(rel) ?? [])])].sort();
  }

  private importGraph(): { out: Map<string, Set<string>>; in: Map<string, Set<string>> } {
    if (this.graph) return this.graph;
    const known = new Set(this.contents.keys());
    const g = { out: new Map<string, Set<string>>(), in: new Map<string, Set<string>>() };
    for (const [rel, specs] of this.specs) {
      for (const target of resolveImports(rel, specs, known)) {
        if (!g.out.has(rel)) g.out.set(rel, new Set());
        if (!g.in.has(target)) g.in.set(target, new Set());
        g.out.get(rel)?.add(target);
        g.in.get(target)?.add(rel);
      }
    }
    return (this.graph = g);
  }

  repoMap(opts?: { maxTokens?: number; focus?: string[] }): string {
    const max = opts?.maxTokens ?? 1500;
    const lines = [`# Repository map (${this.contents.size} files)`, ...this.dirLines()];
    const focus = (opts?.focus?.length ? opts.focus : this.topBySymbols(10)).filter((f) => this.contents.has(f));
    for (const f of focus) {
      lines.push(f);
      for (const s of this.symbolsOf(f)) if (!s.container) lines.push(`  ${s.signature.slice(0, 120)}`);
    }
    const out: string[] = [];
    let used = 0;
    for (const l of lines) {
      used += estimateTokens(l + '\n');
      if (used > max) break;
      out.push(l);
    }
    return out.join('\n');
  }

  private topBySymbols(n: number): string[] {
    return this.files()
      .map((f) => ({ f, n: this.symbolsOf(f).filter((s) => !s.container).length }))
      .sort((a, b) => b.n - a.n || (a.f < b.f ? -1 : 1))
      .slice(0, n)
      .map((x) => x.f);
  }

  // Directory tree, top two levels, with file counts.
  private dirLines(): string[] {
    const counts = new Map<string, number>();
    const bump = (k: string): void => void counts.set(k, (counts.get(k) ?? 0) + 1);
    for (const f of this.contents.keys()) {
      const dirs = f.split('/').slice(0, -1);
      if (dirs.length === 0) bump('.');
      for (let d = 1; d <= Math.min(2, dirs.length); d++) bump(dirs.slice(0, d).join('/'));
    }
    return [...counts.keys()].sort().map((d) => {
      const depth = d === '.' ? 0 : d.split('/').length - 1;
      return `${'  '.repeat(depth)}${d}/ (${counts.get(d)} files)`;
    });
  }
}
