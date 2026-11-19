import { describe, expect, it } from 'vitest';
import { applyHunks, computeHunks, previewContent, splitLines, summarizeHunk } from '../../src/core/diff/hunks';
import type { HunkDecision } from '../../src/core/diff/hunks';

const roundTrip = (o: string, p: string): void => {
  const hunks = computeHunks(o, p);
  expect(applyHunks(o, hunks, new Set(hunks.map((h) => h.id)))).toBe(p);
  expect(applyHunks(o, hunks, new Set())).toBe(o);
  const pending = new Map<number, HunkDecision>(hunks.map((h) => [h.id, 'pending']));
  expect(previewContent(o, hunks, pending)).toBe(p);
};

describe('splitLines', () => {
  it('detects eol and trailing newline', () => {
    expect(splitLines('a\r\nb\r\n')).toEqual({ lines: ['a', 'b'], eol: '\r\n', trailingNewline: true });
    expect(splitLines('a\nb')).toEqual({ lines: ['a', 'b'], eol: '\n', trailingNewline: false });
    expect(splitLines('').lines).toEqual([]);
  });
});

describe('computeHunks / applyHunks', () => {
  it('merges removed+added into one replacement hunk', () => {
    const h = computeHunks('a\nb\nc\n', 'a\nB\nc\n');
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ origStart: 1, origLines: ['b'], newStart: 1, newLines: ['B'] });
  });
  it('round-trips simple cases', () => {
    roundTrip('a\nb\nc\n', 'a\nB\nc\n');
    roundTrip('a\nb\nc\n', 'a\nc\n');
    roundTrip('a\nb\n', 'x\na\nb\ny\n');
    roundTrip('', 'new\nfile\n');
    roundTrip('old\n', '');
    roundTrip('a\nb', 'a\nb\nc\n');
    roundTrip('a\nb\n', 'a\nb\nc');
  });
  it('handles CRLF', () => {
    roundTrip('a\r\nb\r\nc\r\n', 'a\r\nB\r\nc\r\nd\r\n');
    const h = computeHunks('a\r\nb\r\n', 'a\r\nX\r\n');
    expect(applyHunks('a\r\nb\r\n', h, new Set([0]))).toBe('a\r\nX\r\n');
  });
  it('keeps new-file eol when original empty', () => {
    roundTrip('', 'a\r\nb\r\n');
  });
  it('applies subsets with multiple hunks', () => {
    const o = '1\n2\n3\n4\n5\n6\n7\n';
    const p = '1\nB\n3\n4\n5\nF\n7\nEND\n';
    const h = computeHunks(o, p);
    expect(h).toHaveLength(3);
    expect(applyHunks(o, h, new Set([0]))).toBe('1\nB\n3\n4\n5\n6\n7\n');
    expect(applyHunks(o, h, new Set([1]))).toBe('1\n2\n3\n4\n5\nF\n7\n');
    expect(applyHunks(o, h, new Set([0, 2]))).toBe('1\nB\n3\n4\n5\n6\n7\nEND\n');
    const d = new Map<number, HunkDecision>([
      [0, 'rejected'],
      [1, 'accepted'],
    ]);
    expect(previewContent(o, h, d)).toBe('1\n2\n3\n4\n5\nF\n7\nEND\n');
  });
  it('uses proposed trailing newline only when the eof hunk is accepted', () => {
    const o = 'a\nb\nc';
    const p = 'A\nb\nC\n';
    const h = computeHunks(o, p);
    expect(h).toHaveLength(2);
    expect(applyHunks(o, h, new Set([0]))).toBe('A\nb\nc');
    expect(applyHunks(o, h, new Set([1]))).toBe('a\nb\nC\n');
  });
});

describe('summarizeHunk', () => {
  it('prints header and lines', () => {
    const [h] = computeHunks('a\nb\nc\n', 'a\nB\nc\n');
    expect(summarizeHunk(h!)).toBe('@@ -2,1 +2,1 @@\n-b\n+B');
  });
  it('truncates long hunks', () => {
    const big = Array.from({ length: 20 }, (_, i) => `l${i}`).join('\n') + '\n';
    const [h] = computeHunks('', big);
    const s = summarizeHunk(h!, 5);
    expect(s).toContain('@@ -0,0 +1,20 @@');
    expect(s).toContain('… (15 more lines)');
    expect(s.split('\n')).toHaveLength(1 + 5 + 1);
  });
});
