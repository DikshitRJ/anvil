import { describe, expect, it } from 'vitest';
import { CodeIndex } from '../../src/core/context/codeIndex';

describe('incremental index lifecycle', () => {
  it('replaces content, chunks, symbols, and search postings together', () => {
    const index = new CodeIndex('/virtual');
    index.updateFile('mod.py', 'def old_handler():\n    return "obsolete"');
    expect(index.findSymbol('old_handler')).toHaveLength(1);
    index.updateFile('mod.py', 'def new_handler():\n    return "current"');
    expect(index.findSymbol('old_handler')).toEqual([]);
    expect(index.search('obsolete')).toEqual([]);
    expect(index.findSymbol('new_handler')).toHaveLength(1);
    expect(index.search('current')[0]?.chunk.text).toContain('new_handler');
    expect(
      index
        .chunksOf('mod.py')
        .map((c) => c.text)
        .join(''),
    ).not.toContain('old_handler');
  });
  it('removes every representation and tolerates repeated removal', () => {
    const index = new CodeIndex('/virtual');
    index.updateFile('mod.py', 'def handler():\n    return "needle"');
    index.removeFile('mod.py');
    index.removeFile('mod.py');
    expect(index.files()).toEqual([]);
    expect(index.getContent('mod.py')).toBeUndefined();
    expect(index.chunksOf('mod.py')).toEqual([]);
    expect(index.symbolsOf('mod.py')).toEqual([]);
    expect(index.search('needle')).toEqual([]);
    expect(index.grep('needle')).toEqual([]);
    expect(index.repoMap()).toContain('(0 files)');
  });
});

describe('cached import graph invalidation', () => {
  it('refreshes inbound and outbound neighbours when imports change', () => {
    const index = new CodeIndex('/virtual');
    index.updateFile('a.ts', 'import "./b";');
    index.updateFile('b.ts', 'export const value = 1;');
    index.updateFile('c.ts', 'export const value = 2;');
    expect(index.neighbors('a.ts')).toEqual(['b.ts']);
    expect(index.neighbors('b.ts')).toEqual(['a.ts']);
    index.updateFile('a.ts', 'import "./c";');
    expect(index.neighbors('a.ts')).toEqual(['c.ts']);
    expect(index.neighbors('b.ts')).toEqual([]);
    expect(index.neighbors('c.ts')).toEqual(['a.ts']);
    index.removeFile('c.ts');
    expect(index.neighbors('a.ts')).toEqual([]);
  });
  it('discovers imports when their previously missing target is added', () => {
    const index = new CodeIndex('/virtual');
    index.updateFile('a.ts', 'import "./later.js";');
    expect(index.neighbors('a.ts')).toEqual([]);
    index.updateFile('later.ts', 'export const ready = true;');
    expect(index.neighbors('a.ts')).toEqual(['later.ts']);
    expect(index.neighbors('later.ts')).toEqual(['a.ts']);
  });
});
