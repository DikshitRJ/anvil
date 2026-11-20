import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CodeIndex } from '../../src/core/context/codeIndex';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function workspace() {
  const root = await mkdtemp(join(tmpdir(), 'anvil-index-'));
  roots.push(root);
  return root;
}

describe('disk index build', () => {
  it('indexes text while excluding binary data, build output, and ignored files', async () => {
    const root = await workspace();
    await mkdir(join(root, 'dist'));
    await writeFile(join(root, 'dist', 'generated.ts'), 'generated needle');
    await writeFile(join(root, '.gitignore'), 'ignored.txt\n');
    await writeFile(join(root, 'ignored.txt'), 'ignored needle');
    await writeFile(join(root, 'binary.dat'), Buffer.from([65, 0, 66]));
    await writeFile(join(root, 'source.py'), 'def handler():\n    return "needle"');
    const progress: number[] = [];
    const index = new CodeIndex(root);
    await index.build((done) => progress.push(done));
    expect(index.files()).toEqual(['.gitignore', 'source.py']);
    expect(index.search('needle').map((h) => h.chunk.path)).toEqual(['source.py']);
    expect(progress).toEqual([1, 2, 3]);
  });
  it('builds an empty directory without progress callbacks', async () => {
    const index = new CodeIndex(await workspace());
    const progress: number[] = [];
    await index.build((done) => progress.push(done));
    expect(index.files()).toEqual([]);
    expect(progress).toEqual([]);
  });
});
