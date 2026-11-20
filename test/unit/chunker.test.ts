import { describe, expect, it } from 'vitest';
import { chunkFile } from '../../src/core/context/chunker';
import { extractSymbols } from '../../src/core/context/symbols';

const chunks = (path: string, text: string) => chunkFile(path, text, extractSymbols(path, text));

describe('chunkFile', () => {
  it('chunks at top-level symbols and keeps a header gap chunk', () => {
    const src = [
      'import os',
      'import sys',
      'X = 1',
      'Y = 2',
      '',
      'def a():',
      '    pass',
      '',
      'def b():',
      '    pass',
    ].join('\n');
    const c = chunks('m.py', src);
    expect(c.map((x) => [x.id, x.symbol])).toEqual([
      ['m.py#1-5', undefined],
      ['m.py#6-7', 'a'],
      ['m.py#9-10', 'b'],
    ]);
    expect(c[1]?.text).toBe('def a():\n    pass');
  });

  it('splits a big class into header and per-method chunks', () => {
    const body = Array.from({ length: 50 }, (_, i) => `    def m${i}(self):\n        return ${i}\n\n`).join('');
    const c = chunks('m.py', `class Big:\n    """Doc."""\n    a = 1\n    b = 2\n\n${body}`);
    expect(c[0]).toMatchObject({ symbol: 'Big', startLine: 1 });
    expect(c.length).toBeGreaterThan(20);
    expect(c.some((x) => x.symbol === 'Big.m5')).toBe(true);
  });

  it('uses overlapping windows for files without symbols', () => {
    const text = Array.from({ length: 130 }, (_, i) => `line ${i}`).join('\n');
    const c = chunks('notes.txt', text);
    expect(c.map((x) => [x.startLine, x.endLine])).toEqual([
      [1, 60],
      [51, 110],
      [101, 130],
    ]);
  });

  it('splits chunks over 150 lines into 120-line windows', () => {
    const text = `def huge():\n${Array.from({ length: 200 }, (_, i) => `    x${i} = ${i}`).join('\n')}\n`;
    const c = chunks('h.py', text);
    expect(c.map((x) => x.endLine - x.startLine + 1)).toEqual([120, 81]);
    expect(c.every((x) => x.symbol === 'huge')).toBe(true);
  });

  it('returns nothing for empty content', () => {
    expect(chunks('e.py', '')).toEqual([]);
  });
});

describe('large class inter-method content', () => {
  it('retains significant class-level statements between methods', () => {
    const lines = Array.from({ length: 130 }, () => '');
    lines[0] = 'class Big:';
    lines[1] = '    doc = 1';
    lines[2] = '    setting = 2';
    lines[3] = '    def first(self):';
    lines[4] = '        return 1';
    lines[5] = '    alpha = 1';
    lines[6] = '    beta = 2';
    lines[7] = '    gamma = 3';
    lines[128] = '    def last(self):';
    lines[129] = '        return 2';
    const result = chunks('big.py', lines.join('\n'));
    expect(result.some((c) => c.text.includes('alpha = 1') && c.text.includes('gamma = 3'))).toBe(true);
    expect(result.filter((c) => c.symbol === 'Big.first')).toHaveLength(1);
    expect(result.filter((c) => c.symbol === 'Big.last')).toHaveLength(1);
    const ordered = [...result].sort((a, b) => a.startLine - b.startLine);
    for (let i = 1; i < ordered.length; i++) expect(ordered[i]!.startLine).toBeGreaterThan(ordered[i - 1]!.endLine);
  });
});
