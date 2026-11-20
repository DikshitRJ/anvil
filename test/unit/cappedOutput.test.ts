import { describe, expect, it } from 'vitest';
import { CappedOutput } from '../../src/host/cappedOutput';

describe('capped output partition invariance', () => {
  const head = 16 * 1024;
  const tail = 48 * 1024;
  it.each([1, 7, 1024, 17000, 100000])('keeps the same head and tail with chunk size %i', (size) => {
    const text = 'h'.repeat(head) + 'middle'.repeat(9000) + 't'.repeat(tail);
    const out = new CappedOutput();
    for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
    expect(out.toString()).toBe('h'.repeat(head) + '\n... [54000 chars truncated] ...\n' + 't'.repeat(tail));
    expect(out.toString()).toBe(out.toString());
  });
  it.each([0, 1, head, head + tail])('preserves output at the %i character boundary', (length) => {
    const out = new CappedOutput();
    out.push('');
    out.push('x'.repeat(length));
    expect(out.toString()).toBe('x'.repeat(length));
  });
});
