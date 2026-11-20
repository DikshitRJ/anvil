import { describe, expect, it } from 'vitest';
import { CodeIndex } from '../../src/core/context/codeIndex';
import { Bm25Index } from '../../src/core/context/bm25';

describe('retrieval result limits', () => {
  it.each([0, -1, -100])('returns no results for limit %i', (limit) => {
    const index = new CodeIndex('/virtual');
    index.updateFile('a.txt', 'needle\nneedle');
    const bm25 = new Bm25Index();
    bm25.add('a', ['needle']);
    bm25.add('b', ['needle']);
    expect(index.search('needle', limit)).toEqual([]);
    expect(index.grep('needle', { limit })).toEqual([]);
    expect(index.grepTruncated).toBe(false);
    expect(bm25.search(['needle'], limit)).toEqual([]);
  });
  it('still caps positive limits while preserving ranked results', () => {
    const index = new CodeIndex('/virtual');
    for (let i = 0; i < 4; i++) index.updateFile(`${i}.txt`, 'needle\nneedle');
    expect(index.search('needle', 2)).toHaveLength(2);
    expect(index.grep('needle', { limit: 3 })).toHaveLength(3);
  });
});
