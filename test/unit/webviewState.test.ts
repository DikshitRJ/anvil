import { describe, expect, it } from 'vitest';
import { MAX_NOTICES, MAX_RUNS, dismissNotice, hydrate, initialState, persistable, reduce } from '../../webview/state';
import { globalNoticeHtml } from '../../webview/render';
import type { HostToWebview } from '../../src/panel/protocol';

const run = (msgs: HostToWebview[]) => msgs.reduce(reduce, initialState());
const start: HostToWebview = { type: 'runStarted', runId: 'r1', prompt: 'hi' };
const text = (content: string): HostToWebview => ({
  type: 'text',
  runId: 'r1',
  messageId: 'm1',
  threadId: 'main',
  content,
});
const tool = (status: string, result?: string): HostToWebview => ({
  type: 'tool',
  runId: 'r1',
  call: { id: 'c1', threadId: 'main', tool: 'search_code', summary: 's', status, result },
});

describe('webview reducer', () => {
  it('starts a run and sets running', () => {
    const s = run([start]);
    expect(s.running).toBe(true);
    expect(s.runs[0]?.prompt).toBe('hi');
  });

  it('text updates are idempotent and replace content', () => {
    const s = run([start, text('a'), text('abc'), text('abc')]);
    expect(s.runs[0]?.entries).toHaveLength(1);
    expect(s.runs[0]?.entries[0]).toMatchObject({ kind: 'text', content: 'abc' });
  });

  it('tool cards update in place', () => {
    const s = run([start, tool('running'), text('x'), tool('done', 'out')]);
    const entries = s.runs[0]?.entries ?? [];
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ kind: 'tool', status: 'done', result: 'out' });
  });

  it('modelSwitch updates activeModel and adds an entry', () => {
    const s = run([
      { type: 'init', models: ['a', 'b'], activeModel: 'a', trueforgeUrl: 'u' },
      start,
      { type: 'modelSwitch', runId: 'r1', from: 'a', to: 'b', reason: '429' },
    ]);
    expect(s.activeModel).toBe('b');
    expect(s.runs[0]?.entries[0]).toMatchObject({ kind: 'modelSwitch', to: 'b' });
  });

  it('runFinished clears running and stores the footer data', () => {
    const s = run([start, { type: 'runFinished', runId: 'r1', status: 'error', model: 'm', error: 'boom' }]);
    expect(s.running).toBe(false);
    expect(s.runs[0]?.finished).toEqual({ status: 'error', model: 'm', error: 'boom' });
  });

  it('notices without runId are global; with runId go in the run', () => {
    const s = run([
      start,
      { type: 'notice', level: 'warn', message: 'g' },
      { type: 'notice', runId: 'r1', level: 'info', message: 'l', actions: ['x'] },
    ]);
    expect(s.notices).toHaveLength(1);
    expect(s.runs[0]?.entries[0]).toMatchObject({ kind: 'notice', message: 'l', actions: ['x'] });
  });

  it('approvals resolve in place', () => {
    const s = run([
      start,
      { type: 'approval', runId: 'r1', id: 'a', kind: 'command', title: 't', detail: 'ls' },
      { type: 'approvalResolved', runId: 'r1', id: 'a', outcome: 'allowed' },
    ]);
    expect(s.runs[0]?.entries[0]).toMatchObject({ kind: 'approval', outcome: 'allowed' });
  });

  it('threads, context, changes, health and mentions are stored', () => {
    const s = run([
      start,
      { type: 'thread', runId: 'r1', thread: { id: 't', title: 'T', status: 'running' } },
      { type: 'thread', runId: 'r1', thread: { id: 't', title: 'T', status: 'done' } },
      { type: 'context', runId: 'r1', items: [], budget: 10, used: 5, dropped: 2 },
      { type: 'changes', changes: [{ seq: 1, runId: 'r1', path: 'p', summary: 's', at: 1 }] },
      { type: 'health', trueforge: 'ok', bridge: 'ok', indexedFiles: 3 },
      { type: 'mentionResults', query: '@a', items: [] },
    ]);
    expect(s.runs[0]?.threads).toEqual([{ id: 't', title: 'T', status: 'done' }]);
    expect(s.runs[0]?.context).toMatchObject({ budget: 10, dropped: 2 });
    expect(s.changes).toHaveLength(1);
    expect(s.health?.indexedFiles).toBe(3);
    expect(s.mentions?.query).toBe('@a');
  });

  it('creates a run on demand for unknown runIds', () => {
    expect(run([text('x')]).runs).toHaveLength(1);
  });
});

// Regression: issue #78, global notices stacked forever, could not be dismissed and survived reloads / New Chat.
describe('global notice lifecycle', () => {
  const doctor = (message: string, level: 'info' | 'warn' = 'info'): HostToWebview => ({
    type: 'notice',
    id: 'doctor',
    level,
    message,
  });
  const ok = doctor('Anvil Doctor: all checks passed');

  it('a repeated singleton notice replaces the earlier one instead of stacking', () => {
    const s = run([ok, ok, ok]);
    expect(s.notices).toHaveLength(1);
    expect(s.notices[0]).toMatchObject({ id: 'doctor', message: 'Anvil Doctor: all checks passed' });
  });

  it('a singleton notice is replaced even when its level and message change', () => {
    const s = run([ok, doctor('Anvil Doctor: 1 problem(s) — bridge', 'warn')]);
    expect(s.notices).toEqual([
      expect.objectContaining({ id: 'doctor', level: 'warn', message: expect.stringMatching(/1 problem/) }),
    ]);
  });

  it('identical notices without an id are deduplicated; different ones are kept', () => {
    const busy: HostToWebview = { type: 'notice', level: 'warn', message: 'A run is already in progress.' };
    const other: HostToWebview = { type: 'notice', level: 'error', message: 'No models', actions: ['Open Settings'] };
    const s = run([busy, other, busy, ok]);
    expect(s.notices.map((n) => n.message)).toEqual([
      'No models',
      'A run is already in progress.',
      'Anvil Doctor: all checks passed',
    ]);
  });

  it('a replacement gets a fresh key so the banner re-renders at the end', () => {
    const s1 = run([ok]);
    const s2 = reduce(s1, ok);
    expect(s2.notices[0]?.key).not.toBe(s1.notices[0]?.key);
  });

  it('caps the number of distinct global banners, dropping the oldest', () => {
    const many: HostToWebview[] = Array.from({ length: MAX_NOTICES + 3 }, (_, i) => ({
      type: 'notice',
      level: 'error',
      message: `e${i}`,
    }));
    const s = run(many);
    expect(s.notices).toHaveLength(MAX_NOTICES);
    expect(s.notices.at(-1)?.message).toBe(`e${MAX_NOTICES + 2}`);
    expect(s.notices[0]?.message).toBe('e3');
  });

  it('dismissNotice removes only the dismissed banner', () => {
    const s = run([ok, { type: 'notice', level: 'warn', message: 'other' }]);
    const key = s.notices[0]?.key ?? '';
    const after = dismissNotice(s, key);
    expect(after.notices.map((n) => n.message)).toEqual(['other']);
    expect(dismissNotice(after, 'missing')).toBe(after);
  });

  it('chatReset (New Chat) clears global notices but keeps the transcript', () => {
    const s = run([
      start,
      ok,
      { type: 'notice', runId: 'r1', level: 'info', message: 'in-run' },
      { type: 'chatReset' },
    ]);
    expect(s.notices).toEqual([]);
    expect(s.runs[0]?.entries).toHaveLength(1);
  });

  it('notices are not persisted to, nor rehydrated from, webview state', () => {
    const s = run([start, ok]);
    const saved = persistable(s);
    expect(saved.notices).toEqual([]);
    expect(saved.runs).toHaveLength(1);
    // A state saved by an older build (with notices inside) must not bring them back.
    const restored = hydrate({ state: { ...s, running: true } });
    expect(restored.notices).toEqual([]);
    expect(restored.running).toBe(false);
    expect(restored.runs).toHaveLength(1);
    expect(restored.noticeSeq).toBe(s.noticeSeq);
  });

  it('hydrate falls back to a fresh state for missing or malformed saved state', () => {
    expect(hydrate(undefined)).toEqual(initialState());
    expect(hydrate({ state: { runs: 'nope' } })).toEqual(initialState());
  });

  it('persistable keeps only the most recent runs', () => {
    const msgs: HostToWebview[] = Array.from({ length: MAX_RUNS + 2 }, (_, i) => ({
      type: 'runStarted',
      runId: `r${i}`,
      prompt: 'p',
    }));
    const saved = persistable(run(msgs));
    expect(saved.runs).toHaveLength(MAX_RUNS);
    expect(saved.runs[0]?.runId).toBe('r2');
  });

  it('global banners render a dismiss button carrying the notice key', () => {
    const html = globalNoticeHtml({ key: 'n:7', level: 'info', message: 'hi <b>', actions: ['Run Doctor'] });
    expect(html).toContain('data-action="dismiss-notice"');
    expect(html).toContain('data-notice="n:7"');
    expect(html).toContain('aria-label="Dismiss notice"');
    expect(html).toContain('data-action="notice-action" data-value="Run Doctor"');
    expect(html).toContain('hi &lt;b&gt;');
  });
});
