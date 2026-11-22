import { describe, expect, it } from 'vitest';
import type { TurnView } from '../../src/core/agent/events';
import { parseMentions } from '../../src/core/context/mentions';
import { CappedOutput } from '../../src/host/cappedOutput';
import {
  checkTruncation,
  diffTurn,
  emptySnapshot,
  fileScore,
  isIgnoredPath,
  matchMentions,
  reviewOutcome,
  summarizeTool,
} from '../../src/host/panelEvents';

const view = (over: Partial<TurnView> = {}): TurnView => ({
  status: 'running',
  messages: [],
  toolCalls: [],
  threads: [],
  pending: [],
  ...over,
});

describe('summarizeTool', () => {
  it('formats common tools', () => {
    expect(summarizeTool('search_code', { query: 'flask cli' })).toBe('search_code "flask cli"');
    expect(summarizeTool('read_file', { path: 'a.py', start_line: 1, end_line: 400 })).toBe('read_file a.py:1-400');
    expect(summarizeTool('read_file', { path: 'a.py' })).toBe('read_file a.py');
    expect(summarizeTool('edit_file', { path: 'a.py', old_string: 'x' })).toBe('edit_file a.py');
    expect(summarizeTool('run_command', { command: 'npm test' })).toBe('run_command "npm test"');
    expect(summarizeTool('mystery', {})).toBe('mystery');
  });
  it('truncates long arguments', () => {
    expect(summarizeTool('grep', { pattern: 'x'.repeat(200) }).length).toBeLessThan(100);
  });
});

describe('diffTurn', () => {
  it('posts only changed entries', () => {
    const snap = emptySnapshot();
    const v1 = view({
      messages: [{ id: 'm1', threadId: 't', content: 'hel' }],
      toolCalls: [{ id: 'c1', threadId: 't', tool: 'read_file', input: { path: 'a' }, status: 'running' }],
      threads: [{ id: 't', title: 'main', status: 'running' }],
    });
    expect(diffTurn('r', snap, v1).map((m) => m.type)).toEqual(['thread', 'text', 'tool']);
    expect(diffTurn('r', snap, v1)).toEqual([]);
    const v2 = view({
      ...v1,
      messages: [{ id: 'm1', threadId: 't', content: 'hello' }],
      toolCalls: [{ id: 'c1', threadId: 't', tool: 'read_file', input: { path: 'a' }, status: 'done', result: 'ok' }],
    });
    const out = diffTurn('r', snap, v2);
    expect(out.map((m) => m.type)).toEqual(['text', 'tool']);
    expect(out[0]).toMatchObject({ content: 'hello', runId: 'r' });
  });
  it('caps result previews at 1500 chars', () => {
    const v = view({
      toolCalls: [{ id: 'c', threadId: 't', tool: 'grep', input: {}, status: 'done', result: 'y'.repeat(5000) }],
    });
    const m = diffTurn('r', emptySnapshot(), v)[0];
    expect(m?.type === 'tool' && m.call.result?.length).toBe(1500);
  });
});

describe('mentions', () => {
  const files = ['src/flask/cli.py', 'docs/cli.rst', 'src/app.py', 'tests/test_cli.py'];
  it('prefers basename prefix', () => {
    expect(fileScore('src/flask/cli.py', 'cli')).toBe(0);
    expect(fileScore('tests/test_cli.py', 'cli')).toBe(1);
    expect(fileScore('a/cli/x.py', 'cli')).toBe(2);
    expect(fileScore('src/app.py', 'zzz')).toBe(-1);
  });
  it('ranks files then symbols', () => {
    const items = matchMentions(
      'cli',
      files,
      () => [{ name: 'cli_cmd', kind: 'function', path: 'src/flask/cli.py', line: 3, endLine: 5, signature: '' }],
      20,
    );
    expect(items[0]?.insert).toMatch(/^@.*cli\.(py|rst)$/);
    expect(items.at(-1)).toMatchObject({ kind: 'symbol', insert: '@#cli_cmd' });
  });
  it('limits results', () => {
    const many = Array.from({ length: 50 }, (_, i) => `f${i}.ts`);
    expect(matchMentions('', many, () => [], 20)).toHaveLength(20);
  });
});

describe('misc helpers', () => {
  it('ignores default-ignored segments', () => {
    expect(isIgnoredPath('node_modules/x/y.js')).toBe(true);
    expect(isIgnoredPath('src/dist/a.ts')).toBe(true);
    expect(isIgnoredPath('src/a.ts')).toBe(false);
  });
  it('describes review outcomes', () => {
    expect(reviewOutcome(2, 3, true)).toBe('accepted 2/3 hunks');
    expect(reviewOutcome(0, 3, false)).toBe('rejected');
  });
  it('caps command output keeping head and tail', () => {
    const o = new CappedOutput();
    o.push('H'.repeat(16 * 1024));
    o.push('m'.repeat(200 * 1024));
    o.push('TAILEND');
    const s = o.toString();
    expect(s.startsWith('HHH')).toBe(true);
    expect(s.endsWith('TAILEND')).toBe(true);
    expect(s).toContain('truncated');
    expect(s.length).toBeLessThan(66 * 1024);
  });
});

describe('checkTruncation', () => {
  const ev = (inputTokens: number) => ({ type: 'model.message', usage: { inputTokens, outputTokens: 1 } });
  it('warns once when the model saw under half of the prompt', () => {
    const st = { sentTokens: 10000, done: false };
    const w = checkTruncation(st, ev(2000));
    expect(w).toContain('only received 2000 of ~10000');
    expect(w).toContain('num_ctx');
    expect(checkTruncation(st, ev(100))).toBeUndefined();
  });
  it('stays quiet when usage is adequate, and only judges the first call', () => {
    const st = { sentTokens: 10000, done: false };
    expect(checkTruncation(st, ev(6000))).toBeUndefined();
    expect(checkTruncation(st, ev(10))).toBeUndefined();
  });
  it('ignores other events, missing usage and snake_case usage', () => {
    const st = { sentTokens: 1000, done: false };
    expect(checkTruncation(st, { type: 'model.message.delta' })).toBeUndefined();
    expect(checkTruncation(st, { type: 'model.message' })).toBeUndefined();
    expect(checkTruncation(st, { type: 'model.message', usage: { input_tokens: 10 } })).toContain('only received 10');
  });
});

describe('file mention autocomplete round trips', () => {
  it.each(['docs/setup guide.md', 'docs/a "quoted" file.md', "docs/riza's guide.md", 'docs/alert!', 'src/plain.ts'])(
    'inserts a resolvable mention for %s',
    (path) => {
      const item = matchMentions('', [path], () => [])[0]!;
      expect(parseMentions(item.insert, new Set([path])).mentions).toEqual([
        { kind: 'file', value: path, raw: item.insert },
      ]);
    },
  );
});
