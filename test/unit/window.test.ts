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
