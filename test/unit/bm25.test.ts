import { describe, expect, it } from 'vitest';
import { Bm25Index } from '../../src/core/context/bm25';

describe('Bm25Index', () => {
  const build = (): Bm25Index => {
    const idx = new Bm25Index();
    idx.add('a', ['flask', 'cli', 'command', 'command']);
    idx.add('b', ['flask', 'config']);
    idx.add('c', ['database', 'schema']);
    return idx;
  };

  it('ranks documents with more matching terms higher and reports matched tokens', () => {
    const r = build().search(['command', 'flask', 'flask'], 10);
    expect(r.map((x) => x.id)).toEqual(['a', 'b']);
    expect(r[0]?.matched.sort()).toEqual(['command', 'flask']);
    expect(r[0]?.score).toBeGreaterThan(r[1]?.score ?? 0);
  });

  it('respects k and returns nothing for unknown tokens', () => {
    const idx = build();
    expect(idx.search(['flask'], 1)).toHaveLength(1);
    expect(idx.search(['zzz'], 5)).toEqual([]);
  });

  it('removes documents and re-adding replaces them', () => {
    const idx = build();
    idx.remove('a');
    expect(idx.size()).toBe(2);
    expect(idx.search(['command'], 5)).toEqual([]);
    idx.add('b', ['command']);
    expect(idx.size()).toBe(2);
    expect(idx.search(['command'], 5).map((x) => x.id)).toEqual(['b']);
    expect(idx.search(['config'], 5)).toEqual([]);
  });
});

describe('bm25 corpus statistics', () => {
  it('matches a clean rebuild after replacements and removals', () => {
    const incremental = new Bm25Index();
    incremental.add('a', ['needle', 'needle', 'old']);
    incremental.add('b', ['needle', 'extra']);
    incremental.add('c', ['obsolete']);
    incremental.add('a', ['needle']);
    incremental.remove('c');
    incremental.remove('missing');
    const rebuilt = new Bm25Index();
    rebuilt.add('a', ['needle']);
    rebuilt.add('b', ['needle', 'extra']);
    expect(incremental.search(['needle', 'extra'], 10)).toEqual(rebuilt.search(['needle', 'extra'], 10));
    expect(incremental.search(['obsolete', 'old'], 10)).toEqual([]);
  });
  it('uses deterministic ties independent of insertion order and deduplicates query terms', () => {
    const index = new Bm25Index();
    for (const id of ['z', 'b', 'a']) index.add(id, ['needle']);
    expect(index.search(['needle'], 10).map((r) => r.id)).toEqual(['a', 'b', 'z']);
    expect(index.search(['needle', 'needle'], 10)).toEqual(index.search(['needle'], 10));
  });
  it('keeps scores finite in a corpus containing empty documents', () => {
    const index = new Bm25Index();
    index.add('empty', []);
    index.add('match', ['needle']);
    expect(Number.isFinite(index.search(['needle'], 1)[0]?.score)).toBe(true);
    index.remove('match');
    expect(index.search(['needle'], 1)).toEqual([]);
  });
});
