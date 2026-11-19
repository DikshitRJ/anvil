import { describe, expect, it } from 'vitest';
import { tokenize } from '../../src/core/context/tokenize';

describe('tokenize', () => {
  it('keeps whole snake_case identifiers and their parts', () => {
    expect(tokenize('get_debug_flag')).toEqual(['get_debug_flag', 'get', 'debug', 'flag']);
  });

  it('splits PascalCase and camelCase', () => {
    expect(tokenize('FlaskGroup')).toEqual(['flaskgroup', 'flask', 'group']);
    expect(tokenize('loadAppContext')).toEqual(['loadappcontext', 'load', 'app', 'context']);
  });

  it('drops stop words, short tokens and numbers', () => {
    expect(tokenize('def self return 42 x the value')).toEqual(['value']);
  });

  it('stems trailing s', () => {
    expect(tokenize('commands values class pass')).toEqual(['command', 'value', 'class']);
  });

  it('splits on punctuation', () => {
    expect(tokenize('src/flask/cli.py: run()')).toEqual(['src', 'flask', 'cli', 'py', 'run']);
  });
});
