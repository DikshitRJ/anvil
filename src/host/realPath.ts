// Symlink-escape guard (node-only, unit-tested).
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { PathError } from '../core/paths';

/** Throws PathError when the nearest existing ancestor of `abs` resolves (through symlinks) outside `root`. */
export async function assertRealPathInside(root: string, abs: string): Promise<void> {
  const realRoot = await fs.realpath(root);
  let cur = abs;
  for (;;) {
    try {
      const real = await fs.realpath(cur);
      const rel = path.relative(realRoot, real);
      if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
        throw new PathError(`Path escapes the workspace via symlink: ${abs}`);
      }
      return;
    } catch (e) {
      if (e instanceof PathError) throw e;
      const parent = path.dirname(cur);
      if (parent === cur) return;
      cur = parent;
    }
  }
}
