import { describe, expect, it } from 'vitest';
import { filterFiles } from '../../src/core/fileList';

const files = ['src/a.ts', 'src/deep/b.ts', 'src/c.md', 'lib/d.ts', 'README.md'];

describe('filterFiles', () => {
  it('matches the glob against the full workspace-relative path when dir is given', () => {
    expect(filterFiles(files, 'src', 'src/**/*.ts')).toEqual(['src/a.ts', 'src/deep/b.ts']);
  });
  it('still supports basename globs and plain dir listing', () => {
    expect(filterFiles(files, 'src', '*.ts')).toEqual(['src/a.ts', 'src/deep/b.ts']);
    expect(filterFiles(files, 'lib')).toEqual(['lib/d.ts']);
    expect(filterFiles(files, '', '**/*.md', 1)).toEqual(['src/c.md']);
  });
});

describe('file list result limits', () => {
  it.each([0, -1, -10])('returns no files for limit %i', (limit) => {
    expect(filterFiles(files, '', undefined, limit)).toEqual([]);
  });
  it('filters before applying the result limit', () => {
    expect(filterFiles(files, 'src', '*.ts', 1)).toEqual(['src/a.ts']);
  });
});

describe('directory filtering boundaries', () => {
  it('does not confuse sibling directory prefixes', () => {
    const paths = ['src/a.ts', 'src-extra/b.ts', 'src2/c.ts'];
    expect(filterFiles(paths, 'src')).toEqual(['src/a.ts']);
  });
  it('accepts dot-prefixed and windows-style directory separators', () => {
    expect(filterFiles(files, './src/')).toEqual(filterFiles(files, 'src'));
    expect(filterFiles(files, 'src\\deep')).toEqual(['src/deep/b.ts']);
    expect(filterFiles(files, '.')).toEqual(files);
  });
  it('matches dotfiles and leaves caller ordering untouched', () => {
    const paths = ['src/.hidden.ts', 'src/z.ts', 'src/a.ts'];
    const original = [...paths];
    expect(filterFiles(paths, 'src', '*.ts', 2)).toEqual(['src/.hidden.ts', 'src/z.ts']);
    expect(paths).toEqual(original);
  });
});
