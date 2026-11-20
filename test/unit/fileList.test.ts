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
