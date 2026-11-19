import { describe, expect, it } from 'vitest';
import { initialState, reduce } from '../../webview/state';
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
