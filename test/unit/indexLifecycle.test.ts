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
