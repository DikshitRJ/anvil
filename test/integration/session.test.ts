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

function make(models = ['a'], stallTimeoutMs = 5000, baseUrl = url, isBusy?: () => boolean): AnvilSession {
  const relay = new ModelRelay({ models, retriesPerModel: 1, backoffMs: [5] });
  const client = createClient(baseUrl);
  session = new AnvilSession({ client, agent: loadAgentDefinitions().coder, relay, stallTimeoutMs, baseUrl, isBusy });
  return session;
}

const RETRY_NOTE =
  '[Anvil] The previous attempt failed and any file changes it made were reverted. Re-read files before editing.\n\n';
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

  it('tells the model when the user dismissed ask_user_question', async () => {
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
    const res = await make().run('go', { ...allow, onQuestion: () => Promise.resolve('') });
    expect(res.status).toBe('done');
    expect(answers()[0]?.body.events[0].content).toBe('The user dismissed the question without answering.');
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
    expect(inputs).toEqual(['task', RETRY_NOTE + 'task']);
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

  it('does not stall-abort while the host is busy', async () => {
    mock.push({ steps: [emit(E.created()), 'hang'] });
    const onRetry = vi.fn();
    const s = make(['a'], 100, url, () => true);
    const p = s.run('go', { ...allow, onRetry });
    await new Promise((r) => setTimeout(r, 450));
    expect(onRetry).not.toHaveBeenCalled();
    expect(mock.find('POST', '/cancel')).toHaveLength(0);
    await s.cancel();
    expect((await p).status).toBe('cancelled');
  });

  it('does not stall-abort while TrueForge is compacting history', async () => {
    mock.push({
      steps: [
        emit(E.created()),
        emit({
          type: 'thread.context_compaction_started',
          id: 'cmp-1',
          thread_id: 'main',
          created_at: new Date().toISOString(),
          trigger: { type: 'context_threshold_exceeded', context_tokens: 13500, threshold_tokens: 13107 },
        }),
        'hang',
      ],
    });
    const onRetry = vi.fn();
    const s = make(['a'], 100);
    const p = s.run('go', { ...allow, onRetry });
    await new Promise((r) => setTimeout(r, 450));
    expect(onRetry).not.toHaveBeenCalled();
    expect(mock.find('POST', '/cancel')).toHaveLength(0);
    await s.cancel();
    expect((await p).status).toBe('cancelled');
  });

  it('stall-aborts when idle even with an isBusy hook', async () => {
    mock.push({ steps: [emit(E.created()), 'hang'] }, simple('after stall'));
    const res = await make(['a'], 100, url, () => false).run('go', allow);
    expect(res).toMatchObject({ status: 'done', output: 'after stall' });
    expect(mock.find('POST', '/cancel').length).toBeGreaterThanOrEqual(1);
  });

  it('resets the relay each run and switches the session back to the primary', async () => {
    mock.push(
      { steps: [emit(E.created()), emit(E.error('Invalid API key (401)'))] },
      simple('on b'),
      simple('on a again'),
    );
    const s = make(['a', 'b']);
    expect((await s.run('one', allow)).model).toBe('b');
    const res = await s.run('two', allow);
    expect(res).toMatchObject({ status: 'done', model: 'a' });
    const patches = mock.find('PATCH', '/sessions/').map((r) => r.body.agent?.spec.model.name);
    expect(patches).toEqual(['b', 'a']);
    const inputs = mock.find('POST', '/turns').map((r) => r.body.input[0].content);
    expect(inputs[2]).toBe('two');
  });

  it('announces a model switch only after the session update succeeds', async () => {
    mock.failNext.patch = 1;
    const bad = { steps: [emit(E.created()), emit(E.error('Invalid API key (401)'))] };
    mock.push(bad, bad, simple('x'));
    const onModelSwitch = vi.fn();
    const res = await make(['a', 'b', 'c']).run('go', { ...allow, onModelSwitch });
    expect(onModelSwitch).toHaveBeenCalledTimes(1);
    expect(onModelSwitch).toHaveBeenCalledWith('b', 'c', expect.any(String));
    expect(res.model).toBe('c');
  });

  it('feeds a failed switch update back into the relay', async () => {
    mock.failNext.patch = 1;
    mock.push({ steps: [emit(E.created()), emit(E.error('Invalid API key (401)'))] });
    const onModelSwitch = vi.fn();
    const onRetry = vi.fn();
    const res = await make(['a', 'b']).run('go', { ...allow, onModelSwitch, onRetry });
    expect(onModelSwitch).not.toHaveBeenCalled();
    expect(onRetry).toHaveBeenCalledWith('b', 1, 5, expect.stringContaining('bad spec'));
    expect(res.status).toBe('done');
  });

  it('prefixes the input on a plain retry too', async () => {
    mock.push({ httpFail: { status: 503, message: 'down' }, steps: [] }, simple('ok'));
    await make().run('go', allow);
    const inputs = mock.find('POST', '/turns').map((r) => r.body.input[0].content);
    expect(inputs).toEqual(['go', RETRY_NOTE + 'go']);
  });

  it('closes the subscription when answering a pause fails', async () => {
    mock.failNext.events = 1;
    mock.push(approvalScenario(E.mcpCall('c1', 'edit_file', { path: 'a.ts' })), simple('recovered'));
    const onRetry = vi.fn();
    const res = await make(['a']).run('edit', { ...allow, onRetry });
    expect(onRetry).toHaveBeenCalledWith('a', 1, 5, expect.stringContaining('bad events'));
    expect(res).toMatchObject({ status: 'done', output: 'recovered' });
    expect(mock.find('GET', '/subscribe').length).toBeGreaterThanOrEqual(1);
  });
});

describe('compaction state across runs', () => {
  it('restores stall detection after cancelling a compacting run', async () => {
    mock.push({
      steps: [
        emit(E.created()),
        emit({
          type: 'thread.context_compaction_started',
          id: 'compact',
          thread_id: 'main',
          created_at: new Date().toISOString(),
          trigger: { type: 'context_threshold_exceeded', context_tokens: 10, threshold_tokens: 9 },
        }),
        'hang',
      ],
    });
    const s = make(['a'], 100);
    let compacting = false;
    const first = s.run('first', {
      ...allow,
      onEvent: (event) => {
        if ((event as { type: string }).type === 'thread.context_compaction_started') compacting = true;
      },
    });
    await vi.waitFor(() => expect(compacting).toBe(true));
    await s.cancel();
    expect((await first).status).toBe('cancelled');
    mock.push({ steps: [emit(E.created()), 'hang'] }, simple('recovered'));
    let result: Awaited<ReturnType<AnvilSession['run']>> | undefined;
    const second = s.run('second', allow).then((value) => {
      result = value;
    });
    try {
      await vi.waitFor(() => expect(result?.status).toBe('done'), { timeout: 1500 });
      expect(result?.output).toBe('recovered');
    } finally {
      await s.cancel();
      await second;
    }
  });
});

describe('model synchronization failures', () => {
  it('retries a failed switch before starting a turn with the requested model', async () => {
    mock.failNext.patch = 1;
    mock.push({ steps: [emit(E.created()), emit(E.error('Invalid API key (401)'))] }, simple('on b'));
    const result = await make(['a', 'b']).run('task', allow);
    expect(result).toMatchObject({ status: 'done', model: 'b' });
    const patches = mock.find('PATCH', '/sessions/');
    expect(patches).toHaveLength(2);
    expect(patches.every((request) => request.body.agent.spec.model.name === 'b')).toBe(true);
    const requests = mock.requests.map((request) => `${request.method} ${request.path.split('/').at(-1)}`);
    expect(requests.lastIndexOf('PATCH sess_1')).toBeLessThan(requests.lastIndexOf('POST turns'));
  });
  it('retries primary-model synchronization on a follow-up instead of silently using the fallback', async () => {
    mock.push(
      { steps: [emit(E.created()), emit(E.error('Invalid API key (401)'))] },
      simple('fallback'),
      simple('primary'),
    );
    const s = make(['a', 'b']);
    await s.run('first', allow);
    mock.failNext.patch = 1;
    const result = await s.run('follow-up', allow);
    expect(result).toMatchObject({ status: 'done', model: 'a' });
    expect(mock.find('PATCH', '/sessions/').map((request) => request.body.agent.spec.model.name)).toEqual([
      'b',
      'a',
      'a',
    ]);
  });
});
