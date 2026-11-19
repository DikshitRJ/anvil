import { describe, expect, it } from 'vitest';
import { TurnReducer } from '../../src/core/agent/events';

const mcpCall = (id: string, input: object) => ({
  id,
  type: 'function',
  function: { name: 'edit_file', arguments: JSON.stringify(input) },
  toolInfo: { type: 'mcp', name: 'edit_file', serverName: 'anvil-editor', serverId: 's' },
});

describe('TurnReducer', () => {
  it('tracks turn id, deltas and completion', () => {
    const r = new TurnReducer();
    r.apply({ type: 'turn.created', id: 'e1', turnId: 't1' });
    r.apply({ type: 'model.message.delta', id: 'm1', threadId: 'main', content: 'Hel' });
    expect(r.view().messages).toEqual([{ id: 'm1', threadId: 'main', content: 'Hel' }]);
    r.apply({ type: 'model.message.delta', id: 'm1', threadId: 'main', content: 'lo' });
    expect(r.view().messages[0]?.content).toBe('Hello');
    r.apply({ type: 'model.message', id: 'm1', threadId: 'main', content: 'Hello', createdAt: 'x' });
    r.apply({
      type: 'turn.done',
      id: 'e9',
      state: { status: 'done', output: { content: 'Hello' }, metrics: { totalTokens: 5 } },
    });
    const v = r.view();
    expect(v).toMatchObject({
      turnId: 't1',
      status: 'done',
      output: 'Hello',
      lastEventId: 'e9',
      metrics: { totalTokens: 5 },
    });
  });

  it('streams tool calls then marks running', () => {
    const r = new TurnReducer();
    r.apply({
      type: 'model.message.delta',
      id: 'm',
      threadId: 'main',
      toolCalls: [
        {
          index: 0,
          id: 'c1',
          function: { name: 'edit_file', arguments: '{"a":' },
          toolInfo: mcpCall('c1', {}).toolInfo,
        },
      ],
    });
    expect(r.view().toolCalls[0]).toMatchObject({ id: 'c1', status: 'streaming', input: {} });
    r.apply({ type: 'model.message', id: 'm', threadId: 'main', createdAt: 'x', toolCalls: [mcpCall('c1', { a: 1 })] });
    expect(r.view().toolCalls[0]).toMatchObject({ status: 'running', input: { a: 1 }, server: 'anvil-editor' });
  });

  it('handles the approval flow and clears pending', () => {
    const r = new TurnReducer();
    r.apply({ type: 'model.message', id: 'm', threadId: 'sub1', createdAt: 'x', toolCalls: [mcpCall('c1', { p: 1 })] });
    r.apply({
      type: 'tool.approval_required',
      id: 'e',
      threadId: 'sub1',
      toolCalls: [{ id: 'c1', sourceEventId: 'm' }],
    });
    r.apply({ type: 'turn.update', id: 'e2', state: { status: 'paused' } });
    let v = r.view();
    expect(v.status).toBe('paused');
    expect(v.toolCalls[0]?.status).toBe('awaiting-approval');
    expect(v.pending).toEqual([
      { callId: 'c1', threadId: 'sub1', server: 'anvil-editor', tool: 'edit_file', input: { p: 1 } },
    ]);
    r.apply({
      type: 'user.tool_approval',
      id: 'e3',
      threadId: 'sub1',
      toolCallId: 'c1',
      approval: { status: 'deny', reason: 'no' },
    });
    v = r.view();
    expect(v.pending).toEqual([]);
    expect(v.toolCalls[0]?.status).toBe('denied');
  });

  it('truncates tool results and ends with error / cancel', () => {
    const r = new TurnReducer();
    r.apply({ type: 'model.message', id: 'm', threadId: 'main', createdAt: 'x', toolCalls: [mcpCall('c1', {})] });
    r.apply({ type: 'tool.response', id: 'e', threadId: 'main', toolCallId: 'c1', content: 'x'.repeat(5000) });
    expect(r.view().toolCalls[0]?.result).toHaveLength(2000);
    expect(r.view().toolCalls[0]?.status).toBe('done');
    r.apply({ type: 'turn.done', id: 'z', state: { status: 'error', message: 'boom' } });
    expect(r.view()).toMatchObject({ status: 'error', error: 'boom' });
    r.reset();
    r.apply({ type: 'turn.done', id: 'z', state: { status: 'cancelled', reason: 'client-cancelled' } });
    expect(r.view()).toMatchObject({ status: 'cancelled', error: 'client-cancelled' });
  });

  it('tracks threads, snapshot isolation and reset', () => {
    const r = new TurnReducer();
    r.apply({ type: 'thread.created', id: 'a', threadId: 't2', title: 'Scout' });
    const v1 = r.view();
    r.apply({ type: 'thread.done', id: 'b', threadId: 't2', title: 'Scout', state: { status: 'done' } });
    expect(v1.threads[0]?.status).toBe('running');
    expect(r.view().threads[0]?.status).toBe('done');
    r.reset();
    expect(r.view()).toMatchObject({ status: 'running', messages: [], threads: [], pending: [] });
    expect(r.toolCall('nope')).toBeUndefined();
  });
});
