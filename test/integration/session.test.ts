import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelRelay } from '../../src/core/agent/fallback';
import { createClient } from '../../src/trueforge/client';
import { AnvilSession, type RunHooks } from '../../src/trueforge/session';
import { loadAgentDefinitions } from '../../src/trueforge/spec';
import { E, MockTrueForge, emit, type Recorded } from '../helpers/mockTrueForge';

let mock: MockTrueForge;
let url: string;
let session: AnvilSession | undefined;

beforeEach(async () => {
  mock = new MockTrueForge();
  url = await mock.start();
});
afterEach(async () => {
  session?.dispose();
  await mock.stop();
});

function make(models = ['a'], stallTimeoutMs = 5000, baseUrl = url): AnvilSession {
  const relay = new ModelRelay({ models, retriesPerModel: 1, backoffMs: [5] });
  const client = createClient(baseUrl);
  session = new AnvilSession({ client, agent: loadAgentDefinitions().coder, relay, stallTimeoutMs, baseUrl });
  return session;
}

const allow: RunHooks = { onApproval: () => Promise.resolve({ allow: true }) };
const answers = (): Recorded[] => mock.find('POST', '/events');
const simple = (out = 'ok') => ({ steps: [emit(E.created()), emit(E.message('m', out)), emit(E.done(out))] });

// scenario: model asks for approval of `call`, pauses, then finishes after the answer
function approvalScenario(call: object, thread = 'main') {
  return {
    steps: [
      emit(E.created()),
      emit(E.message('m1', null, [call], thread)),
      emit(E.approvalRequired('c1', 'm1', thread)),
      emit(E.paused()),
      'pause' as const,
      emit(E.running()),
      emit(E.toolResponse('c1', 'edited', thread)),
      emit(E.message('m2', 'all done')),
      emit(E.done('all done')),
    ],
  };
}

describe('AnvilSession', () => {
  it('streams deltas and resolves done', async () => {
    mock.push({
      steps: [
        emit(E.created()),
        emit(E.delta('m1', 'Hel')),
        { delay: 20 },
        emit(E.delta('m1', 'lo')),
        emit(E.message('m1', 'Hello')),
        emit(E.done('Hello')),
      ],
    });
    const seen: string[] = [];
    const s = make();
    const res = await s.run('hi', { ...allow, onEvent: (_e, v) => seen.push(v.messages[0]?.content ?? '') });
    expect(res).toMatchObject({ status: 'done', output: 'Hello', model: 'a', sessionId: 'sess_1' });
    expect(seen).toContain('Hel');
    expect(seen).toContain('Hello');
    expect(mock.find('POST', '/turns')[0]?.body).toMatchObject({
      input: [{ type: 'user.message', content: 'hi' }],
      stream: true,
    });
    expect(mock.find('POST', '/sessions')[0]?.body.agent.spec.model.name).toBe('a');
  });

  it('asks for approval of a preloaded MCP call, then allows', async () => {
    mock.push(approvalScenario(E.mcpCall('c1', 'edit_file', { path: 'a.ts' })));
    const onApproval = vi.fn().mockResolvedValue({ allow: true });
    const res = await make().run('edit', { onApproval });
    expect(res.status).toBe('done');
    expect(onApproval.mock.calls[0]?.[0].call).toEqual({
      callId: 'c1',
      threadId: 'main',
      server: 'anvil-editor',
      tool: 'edit_file',
      input: { path: 'a.ts' },
    });
    expect(answers()[0]?.body.events).toEqual([
      { type: 'user.tool_approval', thread_id: 'main', tool_call_id: 'c1', approval: { status: 'allow' } },
    ]);
    const order = mock.requests.map((r) => `${r.method} ${r.path.split('/').slice(-1)[0]}`);
    expect(order.indexOf('GET subscribe')).toBeLessThan(order.indexOf('POST events'));
  });

  it('sends the deny reason', async () => {
    mock.push(approvalScenario(E.mcpCall('c1', 'edit_file', {})));
    const res = await make().run('edit', {
      onApproval: () => Promise.resolve({ allow: false, reason: 'rejected hunks' }),
    });
    expect(res.status).toBe('done');
    expect(answers()[0]?.body.events[0].approval).toEqual({ status: 'deny', reason: 'rejected hunks' });
  });

  it('denies with "Review failed" when onApproval rejects', async () => {
    mock.push(approvalScenario(E.mcpCall('c1', 'edit_file', {})));
    await make().run('edit', { onApproval: () => Promise.reject(new Error('boom')) });
    expect(answers()[0]?.body.events[0].approval).toEqual({ status: 'deny', reason: 'Review failed' });
  });

  it('resolves deferred call_tool wrappers', async () => {
    mock.push(approvalScenario(E.deferredCall('c1', 'write_file', { path: 'n.ts', content: 'x' })));
    const onApproval = vi.fn().mockResolvedValue({ allow: true });
    await make().run('go', { onApproval });
    expect(onApproval.mock.calls[0]?.[0].call).toMatchObject({
      server: 'anvil-editor',
      tool: 'write_file',
      input: { path: 'n.ts', content: 'x' },
    });
  });

  it('echoes the subagent thread id on approvals', async () => {
    mock.push(approvalScenario(E.mcpCall('c1', 'edit_file', {}), 'sub1'));
    await make().run('go', allow);
    expect(answers()[0]?.body.events[0]).toMatchObject({ thread_id: 'sub1', tool_call_id: 'c1' });
  });

  it('answers ask_user_question via onQuestion', async () => {
    mock.push({
      steps: [
        emit(E.created()),
        emit(E.message('m1', null, [E.askCall('c1', 'Which?', ['x', 'y'])])),
        emit(E.responseRequired('c1', 'm1')),
        emit(E.paused()),
        'pause',
        emit(E.running()),
        emit(E.done('fine')),
      ],
    });
    const onQuestion = vi.fn().mockResolvedValue('x');
    const res = await make().run('go', { ...allow, onQuestion });
    expect(res.status).toBe('done');
    expect(onQuestion).toHaveBeenCalledWith('Which?', ['x', 'y']);
    expect(answers()[0]?.body.events[0]).toEqual({
      type: 'user.tool_response',
      thread_id: 'main',
      tool_call_id: 'c1',
      content: 'x',
    });
  });

  it('cancels a hanging turn promptly', async () => {
    mock.push({ steps: [emit(E.created()), 'hang'] });
    const s = make();
    const p = s.run('go', allow);
    await vi.waitFor(() => expect(mock.find('POST', '/turns').length).toBe(1));
    const t0 = Date.now();
    await s.cancel();
    const res = await p;
    expect(res).toMatchObject({ status: 'cancelled', model: 'a' });
    expect(Date.now() - t0).toBeLessThan(500);
    expect(mock.find('POST', '/cancel')).toHaveLength(1);
  });

  it('rejects concurrent runs', async () => {
    mock.push({ steps: [emit(E.created()), 'hang'] });
    const s = make();
    const p = s.run('go', allow);
    await expect(s.run('again', allow)).rejects.toThrow('A run is already in progress');
    await s.cancel();
    await p;
  });

  it('switches model on a fatal turn error and replays the same input', async () => {
    mock.push({ steps: [emit(E.created()), emit(E.error('Invalid API key provided (401)'))] }, simple('second'));
    const beforeRetry = vi.fn().mockResolvedValue(undefined);
    const onModelSwitch = vi.fn();
    const res = await make(['a', 'b']).run('task', { ...allow, beforeRetry, onModelSwitch });
    expect(res).toMatchObject({ status: 'done', output: 'second', model: 'b' });
    expect(beforeRetry).toHaveBeenCalledTimes(1);
    expect(onModelSwitch).toHaveBeenCalledWith('a', 'b', expect.stringContaining('401'));
    expect(mock.find('PATCH', '/sessions/')[0]?.body.agent.spec.model.name).toBe('b');
    const inputs = mock.find('POST', '/turns').map((r) => r.body.input[0].content);
    expect(inputs).toEqual(['task', 'task']);
  });

  it('retries after a 503 on the turn request', async () => {
    mock.push({ httpFail: { status: 503, message: 'down' }, steps: [] }, simple('recovered'));
    const onRetry = vi.fn();
    const res = await make().run('go', { ...allow, onRetry });
    expect(res).toMatchObject({ status: 'done', output: 'recovered' });
    expect(onRetry).toHaveBeenCalledWith('a', 1, 5, expect.any(String));
  });

  it('treats a stalled stream as transient and retries', async () => {
    mock.push({ steps: [emit(E.created()), 'hang'] }, simple('after stall'));
    const onRetry = vi.fn();
    const res = await make(['a'], 300).run('go', { ...allow, onRetry });
    expect(res).toMatchObject({ status: 'done', output: 'after stall' });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(mock.find('POST', '/cancel').length).toBeGreaterThanOrEqual(1);
  });

  it('reports an unreachable harness', async () => {
    const dead = new MockTrueForge();
    const deadUrl = await dead.start();
    await dead.stop();
    const res = await make(['a'], 5000, deadUrl).run('go', allow);
    expect(res.status).toBe('error');
    expect(res.error).toContain(`TrueForge is not reachable at ${deadUrl}`);
  });

  it('gives up with the last error when all models fail', async () => {
    mock.push(
      { steps: [emit(E.created()), emit(E.error('Invalid API key for a (401)'))] },
      { steps: [emit(E.created()), emit(E.error('model b does not exist'))] },
    );
    const res = await make(['a', 'b']).run('go', allow);
    expect(res.status).toBe('error');
    expect(res.error).toContain('All configured models failed');
    expect(res.error).toContain('model b does not exist');
  });
});
