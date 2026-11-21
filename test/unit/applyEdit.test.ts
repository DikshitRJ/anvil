import { describe, expect, it } from 'vitest';
import { EditError, simulateEdit } from '../../src/core/edits/applyEdit';
import type { EditErrorCode } from '../../src/core/edits/applyEdit';

const rep = (current: string | null, oldString: string, newString: string, replaceAll?: boolean): string =>
  simulateEdit(current, { kind: 'replace', path: 'f.ts', oldString, newString, replaceAll });
const code = (fn: () => unknown): EditErrorCode | undefined => {
  try {
    fn();
  } catch (e) {
    return (e as EditError).code;
  }
  return undefined;
};

describe('write', () => {
  it('creates and overwrites', () => {
    expect(simulateEdit(null, { kind: 'write', path: 'f', content: 'x' })).toBe('x');
    expect(simulateEdit('a', { kind: 'write', path: 'f', content: 'b' })).toBe('b');
  });
  it('NO_CHANGE on identical content', () => {
    expect(code(() => simulateEdit('a', { kind: 'write', path: 'f', content: 'a' }))).toBe('NO_CHANGE');
  });
});

describe('replace exact', () => {
  it('replaces unique match', () => expect(rep('a b c', 'b', 'X')).toBe('a X c'));
  it('treats $ in newString literally', () => expect(rep('a b', 'b', '$&')).toBe('a $&'));
  it('errors', () => {
    expect(code(() => rep(null, 'a', 'b'))).toBe('FILE_NOT_FOUND');
    expect(code(() => rep('a', '', 'b'))).toBe('INVALID');
    expect(code(() => rep('a a', 'a', 'b'))).toBe('AMBIGUOUS');
    expect(code(() => rep('a', 'a', 'a'))).toBe('NO_CHANGE');
  });
  it('AMBIGUOUS message states count', () => {
    expect(() => rep('a a a', 'a', 'b')).toThrow(/3 places.*surrounding/);
  });
  it('replaceAll', () => expect(rep('a a a', 'a', 'b', true)).toBe('b b b'));
  it('handles CRLF files', () => {
    expect(rep('x\r\ny\r\nz\r\n', 'x\ny', 'p\nq')).toBe('p\r\nq\r\nz\r\n');
  });
});

describe('replace fuzzy', () => {
  it('matches ignoring indentation and re-indents', () => {
    const cur = 'function f() {\n    if (a) {\n        go();\n    }\n}\n';
    const out = rep(cur, 'if (a) {\n    go();\n}', 'if (b) {\n    stop();\n}');
    expect(out).toBe('function f() {\n    if (b) {\n        stop();\n    }\n}\n');
  });
  it('ignores leading/trailing blank lines in old_string', () => {
    expect(rep('  a\n  b\n', '\na\nb\n\n', 'c')).toBe('  c\n');
  });
  it('NOT_FOUND quotes first line and hints', () => {
    expect(() => rep('abc\n', 'zzz\nyyy', 'q')).toThrow(
      /"zzz".*read_file the region first; old_string must match exactly/,
    );
    expect(code(() => rep('abc\n', 'zzz', 'q'))).toBe('NOT_FOUND');
  });
  it('AMBIGUOUS when multiple windows', () => {
    expect(code(() => rep('  a\nb\n    a\nb\n', 'a\n b', 'x'))).toBe('AMBIGUOUS');
  });
  it('NO_CHANGE when fuzzy result equals current', () => {
    expect(code(() => rep('  a\n', 'a', 'a'))).toBe('NO_CHANGE');
  });
  it('keeps CRLF', () => {
    expect(rep('  a\r\n  b\r\n', 'a\nb', 'c\nd')).toBe('  c\r\n  d\r\n');
  });
});

describe('literal replacement payloads', () => {
  it.each(['$&', '$1', '$`', "$'", '$$', '🙂', '\\path'])(
    'preserves replacement %s in single and replace-all modes',
    (replacement) => {
      expect(rep('old tail', 'old', replacement)).toBe(`${replacement} tail`);
      expect(rep('old old', 'old', replacement, true)).toBe(`${replacement} ${replacement}`);
    },
  );
  it('does not recursively replace text introduced by the replacement', () => {
    expect(rep('a a', 'a', 'aa', true)).toBe('aa aa');
  });
  it('treats regular-expression characters in the search string literally', () => {
    expect(rep('before a.*[b] after', 'a.*[b]', 'done')).toBe('before done after');
  });
});

describe('fuzzy indentation boundaries', () => {
  it('preserves tab-indented context while adding relative indentation', () => {
    expect(rep('outer\n\told\n\tvalue\nend', 'old\nvalue', 'new\n  nested')).toBe('outer\n\tnew\n\t  nested\nend');
  });
  it('removes excess indentation without removing replacement content', () => {
    expect(rep('  old\n  value', '    old\n    value', '    new\n      nested')).toBe('  new\n    nested');
  });
  it('refuses ambiguous fuzzy replacements even when replace-all is requested', () => {
    expect(code(() => rep('  a\n  b\n    a\n    b', 'a\nb', 'x', true))).toBe('AMBIGUOUS');
  });
  it('rejects blank-only fuzzy needles instead of inventing a match', () => {
    expect(code(() => rep('content', '\n \n', 'replacement'))).toBe('NOT_FOUND');
  });
});

describe('replacement newline and deletion contracts', () => {
  it.each(['\n', '\r\n'])('normalizes replacement newlines to the file convention %j', (eol) => {
    const current = ['before', 'old', 'value', 'after', ''].join(eol);
    expect(rep(current, 'old\r\nvalue', 'new\nline')).toBe(['before', 'new', 'line', 'after', ''].join(eol));
  });
  it('deletes a unique multiline region without leaving replacement blank lines', () => {
    expect(rep('before\nold\nvalue\nafter\n', 'old\nvalue\n', '')).toBe('before\nafter\n');
  });
  it('supports an empty whole-file write while distinguishing an already-empty file', () => {
    expect(simulateEdit(null, { kind: 'write', path: 'empty', content: '' })).toBe('');
    expect(code(() => simulateEdit('', { kind: 'write', path: 'empty', content: '' }))).toBe('NO_CHANGE');
  });
});
