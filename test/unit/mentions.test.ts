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
