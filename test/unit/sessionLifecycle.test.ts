import type { TrueForge } from '@truefoundry/trueforge-sdk';
import { expect, it, vi } from 'vitest';
import { ModelRelay } from '../../src/core/agent/fallback';
import { AnvilSession } from '../../src/trueforge/session';
import { loadAgentDefinitions } from '../../src/trueforge/spec';

it('does not launch a turn when session creation completes after cancellation', async () => {
  let finishCreate!: (value: { data: { id: string } }) => void;
  const create = vi.fn(
    () =>
      new Promise<{ data: { id: string } }>((resolve) => {
        finishCreate = resolve;
      }),
  );
  const createTurnStream = vi.fn(async function* () {
    yield { type: 'turn.done', state: { status: 'done', output: { content: 'late' } } };
  });
  const client = {
    sessions: { create, createTurnStream, cancel: vi.fn().mockResolvedValue(undefined) },
  } as unknown as TrueForge;
  const session = new AnvilSession({
    client,
    agent: loadAgentDefinitions().coder,
    relay: new ModelRelay({ models: ['a'], retriesPerModel: 0, backoffMs: [] }),
    stallTimeoutMs: 100,
  });
  const result = session.run('task', { onApproval: async () => ({ allow: true }) });
  await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  await session.cancel();
  finishCreate({ data: { id: 'late-session' } });
  expect(await result).toMatchObject({ status: 'cancelled' });
  expect(createTurnStream).not.toHaveBeenCalled();
});
