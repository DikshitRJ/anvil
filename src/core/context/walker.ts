// Async workspace walk honouring default ignores and root/nested .gitignore files.
// Binary detection (NUL byte in the first 8 KB) happens at read time in CodeIndex to avoid
// reading each file twice; the walker only filters by name, extension and size.
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import ignore, { type Ignore } from 'ignore';

const MAX_FILES = 20000;
const DIRS = new Set(
  (
    '.git node_modules dist build out .venv venv env __pycache__ .mypy_cache .pytest_cache .ruff_cache ' +
    '.tox coverage htmlcov .next .nuxt target vendor .idea .vscode-test .claude'
  ).split(' '),
);
const LOCKS = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'poetry.lock', 'Cargo.lock', 'uv.lock']);
const BINARY = new Set(
  (
    'png jpg jpeg gif ico svg webp pdf zip gz tgz tar bz2 xz 7z woff woff2 ttf otf eot mp3 mp4 mov avi so ' +
    'dylib dll exe bin class jar pyc pyo o a db sqlite'
  ).split(' '),
);

interface Scoped {
  dir: string; // POSIX path of the .gitignore's directory relative to the root ('' for root)
  ig: Ignore;
}

function skipName(name: string, isDir: boolean): boolean {
  if (isDir) return DIRS.has(name) || name.endsWith('.egg-info');
  if (LOCKS.has(name) || name.endsWith('.min.js') || name.endsWith('.map')) return true;
  return BINARY.has(name.slice(name.lastIndexOf('.') + 1).toLowerCase()) && name.includes('.');
}

function gitIgnored(rel: string, isDir: boolean, scopes: Scoped[]): boolean {
  for (const s of scopes) {
    const sub = s.dir ? rel.slice(s.dir.length + 1) : rel;
    if (s.ig.ignores(isDir ? `${sub}/` : sub)) return true;
  }
  return false;
}

async function loadIgnore(abs: string, rel: string, scopes: Scoped[]): Promise<Scoped[]> {
  try {
    const text = await fs.readFile(path.join(abs, '.gitignore'), 'utf8');
    return [...scopes, { dir: rel, ig: ignore().add(text) }];
  } catch {
    return scopes;
  }
}

async function walkDir(
  root: string,
  rel: string,
  scopesIn: Scoped[],
  o: { max: number; extra: Ignore },
  out: string[],
): Promise<void> {
  const abs = path.join(root, rel);
  const scopes = await loadIgnore(abs, rel, scopesIn);
  let entries;
  try {
    entries = await fs.readdir(abs, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const e of entries) {
    if (out.length >= MAX_FILES) return;
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    const isDir = e.isDirectory();
    if (!isDir && !e.isFile()) continue;
    if (skipName(e.name, isDir) || gitIgnored(childRel, isDir, scopes) || o.extra.ignores(childRel)) continue;
    if (isDir) await walkDir(root, childRel, scopes, o, out);
    else if ((await fs.stat(path.join(root, childRel))).size <= o.max) out.push(childRel);
  }
}

export async function walkWorkspace(
  root: string,
  opts?: { maxFileBytes?: number; extraIgnores?: string[] },
): Promise<string[]> {
  const extra = ignore().add(opts?.extraIgnores ?? []);
  const out: string[] = [];
  await walkDir(root, '', [], { max: opts?.maxFileBytes ?? 512 * 1024, extra }, out);
  return out.sort();
}
