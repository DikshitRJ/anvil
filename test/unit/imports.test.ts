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

describe('python import graph contracts', () => {
  it('resolves aliased modules in flat and src layouts', () => {
    expect(resolve('app.py', 'import alpha as a, beta', ['alpha.py', 'src/beta/__init__.py'])).toEqual([
      'alpha.py',
      'src/beta/__init__.py',
    ]);
  });
  it('resolves relative siblings and parent packages without self edges', () => {
    expect(
      resolve('pkg/sub/main.py', 'from .. import helpers\nfrom . import main', ['pkg/helpers.py', 'pkg/sub/main.py']),
    ).toEqual(['pkg/helpers.py']);
  });
  it('includes package initializers and imported child modules only once', () => {
    expect(
      resolve('app.py', 'from pkg import child as alias\nimport pkg', ['pkg/__init__.py', 'pkg/child.py']),
    ).toEqual(['pkg/__init__.py', 'pkg/child.py']);
  });
  it('ignores comment-only imports and unsupported file types', () => {
    expect(extractImports('a.py', '# import fake\n# from fake import nope')).toEqual([]);
    expect(extractImports('a.txt', 'import fake')).toEqual([]);
  });
});
