// Workspace path guard. Symlink realpath checks are done by the host (vscode side), not here.
import * as path from 'node:path';

export class PathError extends Error {}

// absolute; throws PathError on escape/absolute-outside/NUL
export function resolveInWorkspace(root: string, p: string): string {
  if (p.includes('\0')) throw new PathError(`Invalid path (NUL character): ${JSON.stringify(p)}`);
  let q = p.replace(/\\/g, '/');
  while (q.startsWith('./')) q = q.slice(2);
  if (q === '' || q === '.') return path.resolve(root);
  const abs = path.resolve(root, q);
  const rel = path.relative(path.resolve(root), abs);
  if (rel === '..' || rel.startsWith('../') || path.isAbsolute(rel)) {
    throw new PathError(`Path escapes the workspace: ${p}`);
  }
  return abs;
}

// POSIX separators
export function toRelative(root: string, abs: string): string {
  const rel = path.relative(root, abs).split(path.sep).join('/');
  return rel === '' ? '.' : rel;
}
