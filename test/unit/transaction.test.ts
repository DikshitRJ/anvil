import { describe, expect, it, vi } from 'vitest';
import { CheckpointStore } from '../../src/core/transaction';
import type { FileStore } from '../../src/core/transaction';

class MemStore implements FileStore {
  files = new Map<string, string>();
  async read(p: string): Promise<string | null> {
    return this.files.get(p) ?? null;
  }
  async write(p: string, c: string): Promise<void> {
    this.files.set(p, c);
  }
  async remove(p: string): Promise<void> {
    this.files.delete(p);
  }
}

const setup = (max?: number) => {
  const fs = new MemStore();
  return { fs, cp: new CheckpointStore(fs, max) };
};
const rec = (cp: CheckpointStore, runId: string, path: string, before: string | null, after: string) =>
  cp.record({ runId, path, before, after, summary: 's' });

describe('CheckpointStore.record', () => {
  it('assigns increasing seq and timestamp', () => {
    const { cp } = setup();
    const a = rec(cp, 'r', 'a', null, '1');
    const b = rec(cp, 'r', 'a', '1', '2');
    expect([a.seq, b.seq]).toEqual([1, 2]);
    expect(typeof a.at).toBe('number');
    expect(cp.list()).toHaveLength(2);
    expect(cp.forRun('r')).toHaveLength(2);
    expect(cp.forRun('x')).toHaveLength(0);
  });
  it('keeps at most maxEntries', () => {
    const { cp } = setup(3);
    for (let i = 0; i < 5; i++) rec(cp, 'r', 'a', null, String(i));
    expect(cp.list().map((e) => e.seq)).toEqual([3, 4, 5]);
  });
});

describe('undo', () => {
  it('restores before when current matches after', async () => {
    const { fs, cp } = setup();
    fs.files.set('a', 'new');
    const c = rec(cp, 'r', 'a', 'old', 'new');
    expect(await cp.undo(c.seq)).toEqual({ restored: ['a'], conflicts: [] });
    expect(fs.files.get('a')).toBe('old');
    expect(cp.list()).toHaveLength(0);
  });
  it('removes the file when before is null', async () => {
    const { fs, cp } = setup();
    fs.files.set('a', 'new');
    const c = rec(cp, 'r', 'a', null, 'new');
    await cp.undo(c.seq);
    expect(fs.files.has('a')).toBe(false);
  });
  it('conflicts when file changed, force overrides', async () => {
    const { fs, cp } = setup();
    fs.files.set('a', 'user edit');
    const c = rec(cp, 'r', 'a', 'old', 'new');
    expect(await cp.undo(c.seq)).toEqual({ restored: [], conflicts: ['a'] });
    expect(fs.files.get('a')).toBe('user edit');
    expect(cp.list()).toHaveLength(1);
    expect((await cp.undo(c.seq, { force: true })).restored).toEqual(['a']);
    expect(fs.files.get('a')).toBe('old');
  });
  it('unknown seq is a no-op', async () => {
    const { cp } = setup();
    expect(await cp.undo(99)).toEqual({ restored: [], conflicts: [] });
  });
});

describe('revertRun', () => {
  it('restores the earliest before per file with one write', async () => {
    const { fs, cp } = setup();
    fs.files.set('a', 'v3');
    fs.files.set('b', 'b1');
    rec(cp, 'r', 'a', 'v0', 'v1');
    rec(cp, 'r', 'b', null, 'b1');
    rec(cp, 'r', 'a', 'v1', 'v3');
    rec(cp, 'other', 'c', null, 'c');
    const write = vi.spyOn(fs, 'write');
    const rep = await cp.revertRun('r');
    expect(rep.conflicts).toEqual([]);
    expect(rep.restored.sort()).toEqual(['a', 'b']);
    expect(fs.files.get('a')).toBe('v0');
    expect(fs.files.has('b')).toBe(false);
    expect(write).toHaveBeenCalledTimes(1);
    expect(cp.list().map((e) => e.runId)).toEqual(['other']);
  });
  it('skips conflicting files only', async () => {
    const { fs, cp } = setup();
    fs.files.set('a', 'edited');
    fs.files.set('b', 'b1');
    rec(cp, 'r', 'a', 'v0', 'v1');
    rec(cp, 'r', 'b', 'b0', 'b1');
    const rep = await cp.revertRun('r');
    expect(rep).toEqual({ restored: ['b'], conflicts: ['a'] });
    expect(fs.files.get('a')).toBe('edited');
    expect(cp.list()).toHaveLength(1);
    await cp.revertRun('r', { force: true });
    expect(fs.files.get('a')).toBe('v0');
  });
});

describe('onChange', () => {
  it('fires on record/undo/revertRun and can unsubscribe', async () => {
    const { fs, cp } = setup();
    const fn = vi.fn();
    const off = cp.onChange(fn);
    fs.files.set('a', 'n');
    const c = rec(cp, 'r', 'a', 'o', 'n');
    await cp.undo(c.seq);
    await cp.revertRun('r');
    expect(fn).toHaveBeenCalledTimes(3);
    off();
    rec(cp, 'r', 'a', 'o', 'n');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
