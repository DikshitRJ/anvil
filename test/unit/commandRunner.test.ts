import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  channel: { append: vi.fn(), appendLine: vi.fn(), dispose: vi.fn() },
}));
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }));
vi.mock('vscode', () => ({ window: { createOutputChannel: () => mocks.channel } }));
import { CommandRunner } from '../../src/host/commandRunner';

function childProcess() {
  return Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(),
  });
}

describe('CommandRunner', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  it('preserves utf8 characters split across stdout and stderr chunks independently', async () => {
    const child = childProcess();
    mocks.spawn.mockReturnValue(child);
    const runner = new CommandRunner();
    const result = runner.run('fixture', { cwd: '/workspace', timeoutMs: 1000 });
    const stdout = Buffer.from('🙂');
    const stderr = Buffer.from('€');
    child.stdout.write(stdout.subarray(0, 2));
    child.stderr.write(stderr.subarray(0, 1));
    child.stdout.write(stdout.subarray(2));
    child.stderr.write(stderr.subarray(1));
    child.emit('close', 0);
    expect(await result).toEqual({ output: '🙂€', exitCode: 0, timedOut: false });
    expect(mocks.channel.append.mock.calls.flat().join('')).toBe('🙂€');
    runner.dispose();
  });
  it('finalizes once when a spawn error is followed by close', async () => {
    const child = childProcess();
    mocks.spawn.mockReturnValue(child);
    const runner = new CommandRunner();
    const result = runner.run('missing', { cwd: '/workspace', timeoutMs: 1000 });
    child.emit('error', new Error('spawn failed'));
    child.emit('close', -1);
    expect(await result).toEqual({ output: 'spawn error: spawn failed', exitCode: null, timedOut: false });
    expect(mocks.channel.appendLine.mock.calls.filter(([line]) => line.startsWith('[exit'))).toEqual([['[exit null]']]);
    runner.dispose();
  });
});
