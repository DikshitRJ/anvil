import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PathError } from '../../src/core/paths';
import { assertRealPathInside } from '../../src/host/realPath';

describe('assertRealPathInside', () => {
  const base = mkdtempSync(join(tmpdir(), 'anvil-rp-'));
  const root = join(base, 'ws');
  const outside = join(base, 'outside');
  mkdirSync(root);
  mkdirSync(outside);
  writeFileSync(join(outside, 'secret.txt'), 's');
  writeFileSync(join(root, 'ok.txt'), 'o');
  symlinkSync(outside, join(root, 'link'));

  it('allows normal and not-yet-existing files', async () => {
    await expect(assertRealPathInside(root, join(root, 'ok.txt'))).resolves.toBeUndefined();
    await expect(assertRealPathInside(root, join(root, 'new/dir/f.ts'))).resolves.toBeUndefined();
  });
  it('rejects symlink escapes, including for new files under the link', async () => {
    await expect(assertRealPathInside(root, join(root, 'link/secret.txt'))).rejects.toBeInstanceOf(PathError);
    await expect(assertRealPathInside(root, join(root, 'link/new.txt'))).rejects.toBeInstanceOf(PathError);
  });
});
