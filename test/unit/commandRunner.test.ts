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

describe('command deadlines', () => {
  afterEach(() => vi.useRealTimers());

  it('escalates an unresponsive child from term to kill after the grace period', async () => {
    vi.useFakeTimers();
    const child = childProcess();
    mocks.spawn.mockReturnValue(child);
    const runner = new CommandRunner();
    const result = runner.run('slow', { cwd: '/workspace', timeoutMs: 100 });
    vi.advanceTimersByTime(99);
    expect(child.kill).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(child.kill.mock.calls).toEqual([['SIGTERM']]);
    vi.advanceTimersByTime(2000);
    expect(child.kill.mock.calls).toEqual([['SIGTERM'], ['SIGKILL']]);
    child.emit('close', null);
    expect(await result).toEqual({ output: '', exitCode: null, timedOut: true });
    runner.dispose();
  });

  it('cancels escalation when the child closes during the grace period', async () => {
    vi.useFakeTimers();
    const child = childProcess();
    mocks.spawn.mockReturnValue(child);
    const runner = new CommandRunner();
    const result = runner.run('slow', { cwd: '/workspace', timeoutMs: 100 });
    vi.advanceTimersByTime(100);
    child.emit('close', null);
    await result;
    vi.advanceTimersByTime(3000);
    expect(child.kill.mock.calls).toEqual([['SIGTERM']]);
    runner.dispose();
  });
});

describe('command cancellation bookkeeping', () => {
  afterEach(() => vi.useRealTimers());

  it('kills only active commands and preserves cancellation output', async () => {
    vi.useFakeTimers();
    const finished = childProcess();
    const active = childProcess();
    mocks.spawn.mockReturnValueOnce(finished).mockReturnValueOnce(active);
    const runner = new CommandRunner();
    const first = runner.run('first', { cwd: '/workspace', timeoutMs: 10000 });
    finished.emit('close', 0);
    await first;
    const second = runner.run('second', { cwd: '/workspace', timeoutMs: 10000 });
    active.stdout.write('partial output');
    runner.killAll();
    expect(finished.kill).not.toHaveBeenCalled();
    expect(active.kill).toHaveBeenCalledWith('SIGTERM');
    active.emit('close', null);
    expect(await second).toEqual({ output: 'partial output', exitCode: null, timedOut: false });
    vi.advanceTimersByTime(20000);
    expect(active.kill).toHaveBeenCalledTimes(1);
    runner.dispose();
  });
});
