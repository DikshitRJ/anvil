import { describe, expect, it } from 'vitest';
import { windowChunk } from '../../src/core/context/window';
import type { Chunk } from '../../src/core/context/types';

const chunk = (text: string): Chunk => ({ id: 'a#10-20', path: 'a', startLine: 10, endLine: 20, text });

describe('query line windows', () => {
  it('includes adjacent lines that exactly fill the character budget', () => {
    const result = windowChunk(chunk('aaa\nhit\nbbbbbbbb'), new Set(['hit']), 1.75);
    expect(result).toMatchObject({ text: 'aaa\nhit', startLine: 10, endLine: 11 });
  });
});

describe('window boundary contracts', () => {
  it('keeps original chunk identity when no trimming is needed', () => {
    const original = chunk('tiny');
    expect(windowChunk(original, new Set(), 1)).toBe(original);
  });
  it('centers on the strongest matching line and preserves absolute locations', () => {
    const result = windowChunk(
      chunk('noise'.repeat(20) + '\nmatch\nmatch match\n' + 'tail'.repeat(20)),
      new Set(['match']),
      3,
    );
    expect(result).toMatchObject({ text: 'match match', startLine: 12, endLine: 12 });
  });
  it('truncates a single oversized matching line within budget', () => {
    const result = windowChunk(chunk('prefix\nmatch ' + 'x'.repeat(100)), new Set(['match']), 4);
    expect(result.text).toBe('match ' + 'x'.repeat(10));
    expect(result.startLine).toBe(11);
    expect(result.endLine).toBe(11);
  });
  it('returns empty text for a zero budget', () => {
    expect(windowChunk(chunk('match'), new Set(['match']), 0).text).toBe('');
  });
});
