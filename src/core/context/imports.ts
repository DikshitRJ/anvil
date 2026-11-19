// Import extraction and resolution (Python, TS/JS) used for the 1-hop import graph.
import * as path from 'node:path';

const JS_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

export interface ImportSpec {
  dots: number; // python relative level; 0 = absolute
  module: string; // dotted python module, or the JS specifier
  names: string[]; // python `from m import a, b`
}

export function extractImports(rel: string, content: string): ImportSpec[] {
  if (rel.endsWith('.py')) return pythonImports(content);
  if (JS_EXT.some((e) => rel.endsWith(e))) return jsImports(content);
  return [];
}

function pythonImports(content: string): ImportSpec[] {
  const out: ImportSpec[] = [];
  for (const line of content.split('\n')) {
    const f = line.match(/^\s*from\s+(\.*)([\w.]*)\s+import\s+(.+)$/);
    if (f) {
      const names = f[3]!.replace(/[()\\]/g, '').split(',');
      out.push({
        dots: f[1]!.length,
        module: f[2]!,
        names: names.map((n) => n.trim().split(/\s+/)[0] ?? '').filter(Boolean),
      });
      continue;
    }
    const i = line.match(/^\s*import\s+([\w.,\s]+)/);
    if (!i) continue;
    for (const mod of i[1]!.split(',')) out.push({ dots: 0, module: mod.trim().split(/\s+/)[0] ?? '', names: [] });
  }
  return out;
}

function jsImports(content: string): ImportSpec[] {
  const out: ImportSpec[] = [];
  const re = /(?:from\s+|import\s*\(?\s*|require\(\s*)['"](\.[^'"]*)['"]/g;
  for (const m of content.matchAll(re)) out.push({ dots: 0, module: m[1]!, names: [] });
  return out;
}

function pythonCandidates(rel: string, s: ImportSpec): string[] {
  const parts = s.module ? s.module.split('.') : [];
  const dirs = s.dots > 0 ? [path.posix.join(path.posix.dirname(rel), ...Array(s.dots - 1).fill('..'))] : ['', 'src'];
  const out: string[] = [];
  for (const d of dirs) {
    const base = path.posix.join(d, ...parts);
    out.push(`${base}.py`, `${base}/__init__.py`);
    for (const n of s.names) out.push(`${base}/${n}.py`, `${base}/${n}/__init__.py`);
  }
  return out.map((p) => path.posix.normalize(p));
}

function jsCandidates(rel: string, s: ImportSpec): string[] {
  const base = path.posix.join(path.posix.dirname(rel), s.module);
  const hasExt = JS_EXT.some((e) => base.endsWith(e));
  return [...(hasExt ? [base] : []), ...JS_EXT.map((e) => base + e), ...JS_EXT.map((e) => `${base}/index${e}`)];
}

// Indexed files that `rel` imports.
export function resolveImports(rel: string, specs: ImportSpec[], known: ReadonlySet<string>): string[] {
  const py = rel.endsWith('.py');
  const out = new Set<string>();
  for (const s of specs) {
    const cands = py ? pythonCandidates(rel, s) : jsCandidates(rel, s);
    for (const c of cands) if (known.has(c) && c !== rel) out.add(c);
  }
  return [...out];
}
