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
