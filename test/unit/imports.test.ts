import { describe, expect, it } from 'vitest';
import { extractImports, resolveImports } from '../../src/core/context/imports';

const resolve = (file: string, source: string, known: string[]) =>
  resolveImports(file, extractImports(file, source), new Set(known));

describe('typescript source import resolution', () => {
  it('resolves emitted javascript paths to their typescript sources', () => {
    expect(resolve('src/main.ts', 'import { helper } from "./helper.js";', ['src/helper.ts'])).toEqual([
      'src/helper.ts',
    ]);
    expect(resolve('src/main.tsx', 'import view from "./view.jsx";', ['src/view.tsx'])).toEqual(['src/view.tsx']);
  });
  it('prefers an indexed exact path and never invents unresolved targets', () => {
    expect(resolve('src/main.ts', 'import "./helper.js";', ['src/helper.ts', 'src/helper.js'])).toEqual([
      'src/helper.js',
    ]);
    expect(resolve('src/main.ts', 'import "./missing.js";', [])).toEqual([]);
  });
});

describe('explicit esm and commonjs typescript imports', () => {
  it.each([
    ['mts', 'mjs'],
    ['cts', 'cjs'],
  ])('extracts and resolves %s imports', (source, emitted) => {
    expect(resolve(`src/main.${source}`, `import value from './helper.${emitted}';`, [`src/helper.${source}`])).toEqual(
      [`src/helper.${source}`],
    );
    expect(resolve(`src/main.${source}`, "import './helper';", [`src/helper.${source}`])).toEqual([
      `src/helper.${source}`,
    ]);
    expect(resolve(`src/main.${source}`, "import './folder';", [`src/folder/index.${source}`])).toEqual([
      `src/folder/index.${source}`,
    ]);
  });
});
