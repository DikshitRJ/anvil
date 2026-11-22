import { describe, expect, it } from 'vitest';
import { parseMentions } from '../../src/core/context/mentions';

const known = new Set([
  'src/flask/cli.py',
  'src/flask/helpers.py',
  'tests/test_cli.py',
  'docs/cli.rst',
  'a/util.py',
  'b/util.py',
]);

describe('parseMentions', () => {
  it('resolves exact paths and unique basenames', () => {
    const r = parseMentions('see @src/flask/cli.py and @helpers.py.', known);
    expect(r.mentions).toEqual([
      { kind: 'file', value: 'src/flask/cli.py', raw: '@src/flask/cli.py' },
      { kind: 'file', value: 'src/flask/helpers.py', raw: '@helpers.py' },
    ]);
    expect(r.cleaned).toBe('see src/flask/cli.py and helpers.py.');
  });

  it('treats ambiguous basenames as symbols or ignores them', () => {
    expect(parseMentions('@util.py', known).mentions[0]?.kind).toBe('symbol');
    expect(parseMentions('@some/missing/path.py', known).mentions).toEqual([]);
  });

  it('parses symbols with and without #', () => {
    const r = parseMentions('fix @FlaskGroup, and @#get_debug_flag!', known);
    expect(r.mentions.map((m) => [m.kind, m.value])).toEqual([
      ['symbol', 'FlaskGroup'],
      ['symbol', 'get_debug_flag'],
    ]);
    expect(r.cleaned).toBe('fix FlaskGroup, and get_debug_flag!');
  });

  it('does not match emails', () => {
    const r = parseMentions('mail me@example.com or (@docs/cli.rst)', known);
    expect(r.mentions).toEqual([{ kind: 'file', value: 'docs/cli.rst', raw: '@docs/cli.rst' }]);
  });
});

describe('mention boundaries and resolution priority', () => {
  it('prefers an exact root path over another file with the same basename', () => {
    const result = parseMentions('@util.py', new Set(['util.py', 'nested/util.py']));
    expect(result.mentions).toEqual([{ kind: 'file', value: 'util.py', raw: '@util.py' }]);
  });
  it('preserves punctuation and unresolved references in cleaned text', () => {
    const result = parseMentions('(@helpers.py), @missing/path.py! and @#handler?', known);
    expect(result.cleaned).toBe('(helpers.py), @missing/path.py! and handler?');
    expect(result.mentions.map((m) => m.value)).toEqual(['src/flask/helpers.py', 'handler']);
  });
  it('does not consume embedded at signs or empty symbol markers', () => {
    const text = 'prefix@helpers.py @# @';
    expect(parseMentions(text, known)).toEqual({ mentions: [], cleaned: text });
  });
});

describe('quoted file paths', () => {
  const paths = new Set(['docs/setup guide.md', 'src/my module.ts', 'docs/alert!.md']);
  it('pins double-quoted paths containing spaces and preserves punctuation', () => {
    const result = parseMentions('read @"docs/setup guide.md", please', paths);
    expect(result.mentions).toEqual([{ kind: 'file', value: 'docs/setup guide.md', raw: '@"docs/setup guide.md"' }]);
    expect(result.cleaned).toBe('read "docs/setup guide.md", please');
  });
  it('supports single quotes without stripping punctuation inside a filename', () => {
    expect(parseMentions('@\'src/my module.ts\' @"docs/alert!.md"', paths).mentions.map((m) => m.value)).toEqual([
      'src/my module.ts',
      'docs/alert!.md',
    ]);
  });
  it('leaves unresolved quoted paths unchanged', () => {
    const text = '@"missing file.ts"';
    expect(parseMentions(text, paths)).toEqual({ mentions: [], cleaned: text });
  });
});
