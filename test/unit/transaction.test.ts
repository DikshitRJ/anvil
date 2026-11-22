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

describe('base snapshots (issue 45)', () => {
  it('revertRun restores the true base after undo-list eviction', async () => {
    const { fs, cp } = setup(2);
    fs.files.set('a', 'v4');
    rec(cp, 'r', 'a', 'v0', 'v1');
    rec(cp, 'r', 'a', 'v1', 'v2');
    rec(cp, 'r', 'a', 'v2', 'v3');
    rec(cp, 'r', 'a', 'v3', 'v4');
    expect(cp.list()).toHaveLength(2);
    const rep = await cp.revertRun('r');
    expect(rep.restored).toEqual(['a']);
    expect(fs.files.get('a')).toBe('v0');
  });
  it('keeps bases of recent runs when other runs evict undo entries', async () => {
    const { fs, cp } = setup(1);
    fs.files.set('a', 'a1');
    rec(cp, 'r1', 'a', 'a0', 'a1');
    for (let i = 0; i < 10; i++) rec(cp, 'r2', `x${i}`, null, 'x');
    rec(cp, 'r1', 'a', 'a1', 'a1');
    await cp.revertRun('r1');
    expect(fs.files.get('a')).toBe('a0');
  });
  it('caps retained base snapshots by run count', async () => {
    const fs = new MemStore();
    const capped = new CheckpointStore(fs, 10, 2);
    fs.files.set('a', 'n');
    capped.record({ runId: 'r1', path: 'a', before: 'orig', after: 'n', summary: 's' });
    capped.record({ runId: 'r2', path: 'b', before: null, after: 'n', summary: 's' });
    capped.record({ runId: 'r3', path: 'c', before: null, after: 'n', summary: 's' });
    await capped.revertRun('r1');
    expect(fs.files.get('a')).toBe('orig');
  });
});

describe('revertRun with fully evicted paths', () => {
  it('restores the base for a path whose undo entries were all evicted', async () => {
    const { fs, cp } = setup(2);
    fs.files.set('a', 'a1');
    rec(cp, 'r', 'a', 'a0', 'a1');
    rec(cp, 'r', 'b', null, 'b1');
    rec(cp, 'r', 'c', null, 'c1');
    expect(cp.forRun('r').map((e) => e.path)).toEqual(['b', 'c']);
    fs.files.set('b', 'b1');
    fs.files.set('c', 'c1');
    const rep = await cp.revertRun('r');
    expect(rep.restored.sort()).toEqual(['a', 'b', 'c']);
    expect(fs.files.get('a')).toBe('a0');
  });
  it('reports a conflict for an evicted path changed since, unless forced', async () => {
    const { fs, cp } = setup(1);
    fs.files.set('a', 'edited');
    rec(cp, 'r', 'a', 'a0', 'a1');
    rec(cp, 'r', 'b', null, 'b1');
    fs.files.set('b', 'b1');
    const rep = await cp.revertRun('r');
    expect(rep).toEqual({ restored: ['b'], conflicts: ['a'] });
    await cp.revertRun('r', { force: true });
    expect(fs.files.get('a')).toBe('a0');
  });
});

describe('undo followed by run cancellation', () => {
  it('does not report a conflict for a fully undone file', async () => {
    const { fs, cp } = setup();
    fs.files.set('a', 'new');
    const change = rec(cp, 'r', 'a', 'old', 'new');
    await cp.undo(change.seq);
    expect(await cp.revertRun('r')).toEqual({ restored: [], conflicts: [] });
    expect(fs.files.get('a')).toBe('old');
  });
  it('updates retained base expectations after undoing the last non-evicted change', async () => {
    const { fs, cp } = setup(1);
    rec(cp, 'r', 'a', 'original', 'middle');
    const latest = rec(cp, 'r', 'a', 'middle', 'latest');
    fs.files.set('a', 'latest');
    await cp.undo(latest.seq);
    expect(await cp.revertRun('r')).toEqual({ restored: ['a'], conflicts: [] });
    expect(fs.files.get('a')).toBe('original');
  });
});

describe('checkpoint storage failures', () => {
  it('retains undo history when restoration fails and allows retry', async () => {
    const { fs, cp } = setup();
    const change = rec(cp, 'r', 'a', 'before', 'after');
    fs.files.set('a', 'after');
    const write = vi.spyOn(fs, 'write').mockRejectedValueOnce(new Error('disk unavailable'));
    await expect(cp.undo(change.seq)).rejects.toThrow('disk unavailable');
    expect(cp.list()).toHaveLength(1);
    expect(fs.files.get('a')).toBe('after');
    await expect(cp.undo(change.seq)).resolves.toEqual({ restored: ['a'], conflicts: [] });
    expect(write).toHaveBeenCalledTimes(2);
  });
  it('retains a created-file checkpoint when deletion fails', async () => {
    const { fs, cp } = setup();
    const change = rec(cp, 'r', 'a', null, 'created');
    fs.files.set('a', 'created');
    vi.spyOn(fs, 'remove').mockRejectedValueOnce(new Error('busy'));
    await expect(cp.undo(change.seq)).rejects.toThrow('busy');
    expect(cp.list()).toHaveLength(1);
    await cp.undo(change.seq);
    expect(fs.files.has('a')).toBe(false);
  });
});

describe('run rollback retries', () => {
  it('retries only conflicted paths after the user restores expected content', async () => {
    const { fs, cp } = setup();
    rec(cp, 'r', 'a', 'a0', 'a1');
    rec(cp, 'r', 'b', 'b0', 'b1');
    fs.files.set('a', 'user edit');
    fs.files.set('b', 'b1');
    expect(await cp.revertRun('r')).toEqual({ restored: ['b'], conflicts: ['a'] });
    fs.files.set('a', 'a1');
    const write = vi.spyOn(fs, 'write');
    expect(await cp.revertRun('r')).toEqual({ restored: ['a'], conflicts: [] });
    expect(write).toHaveBeenCalledExactlyOnceWith('a', 'a0');
    expect(await cp.revertRun('r')).toEqual({ restored: [], conflicts: [] });
  });
  it('restores created files even with no visible undo capacity', async () => {
    const { fs, cp } = setup(0);
    rec(cp, 'r', 'new', null, 'content');
    fs.files.set('new', 'content');
    expect(cp.list()).toEqual([]);
    expect(await cp.revertRun('r')).toEqual({ restored: ['new'], conflicts: [] });
    expect(fs.files.has('new')).toBe(false);
  });
});

describe('undo expectations surviving later eviction', () => {
  it('keeps the latest restored content as the base expectation after remaining entries are evicted', async () => {
    const { fs, cp } = setup(2);
    rec(cp, 'r', 'a', 'original', 'middle');
    const latest = rec(cp, 'r', 'a', 'middle', 'latest');
    fs.files.set('a', 'latest');
    await cp.undo(latest.seq);
    rec(cp, 'other', 'b', null, 'b');
    rec(cp, 'other', 'c', null, 'c');
    expect(cp.forRun('r')).toEqual([]);
    expect(await cp.revertRun('r')).toEqual({ restored: ['a'], conflicts: [] });
    expect(fs.files.get('a')).toBe('original');
  });
});
