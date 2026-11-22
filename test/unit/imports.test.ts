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

describe('multiline python imports', () => {
  it('resolves parenthesized names with aliases and inline comments', () => {
    const source = 'from pkg import (\n    alpha as a, # local alias\n    beta,\n)';
    expect(resolve('main.py', source, ['pkg/__init__.py', 'pkg/alpha.py', 'pkg/beta.py'])).toEqual([
      'pkg/__init__.py',
      'pkg/alpha.py',
      'pkg/beta.py',
    ]);
  });
  it('resolves backslash-continued module imports', () => {
    const source = 'import alpha, ' + String.fromCharCode(92) + '\n    beta as b';
    expect(resolve('main.py', source, ['alpha.py', 'beta.py'])).toEqual(['alpha.py', 'beta.py']);
  });
  it('does not treat words in an import comment as modules', () => {
    expect(resolve('main.py', 'from pkg import alpha # beta', ['pkg/alpha.py', 'pkg/beta.py'])).toEqual([
      'pkg/alpha.py',
    ]);
  });
});
