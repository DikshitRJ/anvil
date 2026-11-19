import { describe, expect, it } from 'vitest';
import {
  buildInlinePrompt,
  extractPartialReplacement,
  extractReplacement,
  matchIndentation,
} from '../../src/core/inline/prompt';

const req = {
  path: 'src/a.ts',
  languageId: 'typescript',
  before: Array.from({ length: 100 }, (_, i) => `b${i}`).join('\n'),
  selection: 'let x = 1;',
  after: Array.from({ length: 50 }, (_, i) => `a${i}`).join('\n'),
  instruction: 'rename x to y',
};

describe('buildInlinePrompt', () => {
  it('has all sections and limits context', () => {
    const p = buildInlinePrompt(req);
    expect(p).toContain('File: src/a.ts (typescript)');
    expect(p).toContain('Instruction: rename x to y');
    expect(p).toContain('SELECTION (rewrite this):\n```typescript\nlet x = 1;\n```');
    expect(p).toContain('b99');
    expect(p).toContain('b40');
    expect(p).not.toContain('b39\n');
    expect(p).toContain('a29');
    expect(p).not.toContain('a30');
    expect(p).not.toContain('Related definitions:');
    expect(p.split('\n').pop()).toBe(
      'Reply with exactly one fenced code block containing the full replacement for the SELECTION only — no explanation.',
    );
  });
  it('includes related definitions', () => {
    expect(buildInlinePrompt({ ...req, context: 'function y() {}' })).toContain(
      'Related definitions:\nfunction y() {}',
    );
  });
});

describe('extractReplacement', () => {
  it('takes the last complete block', () => {
    expect(extractReplacement('Here:\n```ts\nfirst\n```\nor\n```ts\n  second\n  line\n```\nbye')).toBe(
      '  second\n  line',
    );
  });
  it('supports tilde and indented fences', () => {
    expect(extractReplacement('  ~~~\nx\n  ~~~')).toBe('x');
  });
  it('strips an unterminated fence', () => {
    expect(extractReplacement('```js\nconst a = 1;\nconst b = 2;')).toBe('const a = 1;\nconst b = 2;');
  });
  it('falls back to trimmed text keeping inner indentation', () => {
    expect(extractReplacement('\n\n  a\n    b\n\n')).toBe('  a\n    b');
  });
  it('never includes fence lines', () => {
    expect(extractReplacement('```\nx\n```')).not.toContain('`');
  });
});

describe('extractPartialReplacement', () => {
  it('returns content inside an unterminated fence', () => {
    expect(extractPartialReplacement('intro\n```ts\nfoo\nba')).toBe('foo\nba');
  });
  it('stops at the closing fence of the first block', () => {
    expect(extractPartialReplacement('```\nA\n```\n```\nB\n```')).toBe('A');
  });
  it('returns text as is without fence', () => {
    expect(extractPartialReplacement('plain')).toBe('plain');
  });
});

describe('matchIndentation', () => {
  it('re-adds stripped indentation', () => {
    expect(matchIndentation('a();\n  b();', '    x();')).toBe('    a();\n      b();');
    expect(matchIndentation('a();\n\nb();', '\tx();')).toBe('\ta();\n\n\tb();');
  });
  it('leaves already indented text', () => {
    expect(matchIndentation('    a();', '  x();')).toBe('    a();');
    expect(matchIndentation('  a();', '  x();')).toBe('  a();');
  });
  it('matches trailing newline of selection', () => {
    expect(matchIndentation('a\n', 'x')).toBe('a');
    expect(matchIndentation('a', 'x\n')).toBe('a\n');
    expect(matchIndentation('', 'x\n')).toBe('');
  });
});
