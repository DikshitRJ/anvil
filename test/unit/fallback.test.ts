import { describe, expect, it } from 'vitest';
import { ModelRelay, classifyFailure } from '../../src/core/agent/fallback';

describe('classifyFailure', () => {
  it('stall is transient', () => {
    expect(classifyFailure({ phase: 'stall' })).toBe('transient');
  });
  it('client cancel is cancelled', () => {
    expect(classifyFailure({ phase: 'turn', message: 'turn cancelled: client-cancelled' })).toBe('cancelled');
  });
  it('connect errors', () => {
    expect(classifyFailure({ phase: 'connect', message: 'fetch failed' })).toBe('harness-down');
    expect(classifyFailure({ phase: 'connect', code: 'ECONNREFUSED' })).toBe('harness-down');
    expect(classifyFailure({ phase: 'connect', statusCode: 503, message: 'x' })).toBe('transient');
    expect(classifyFailure({ phase: 'connect', statusCode: 429, message: 'x' })).toBe('transient');
    expect(classifyFailure({ phase: 'connect', statusCode: 400, message: 'bad' })).toBe('unknown');
  });
  it('turn errors', () => {
    expect(classifyFailure({ phase: 'turn', message: 'Invalid API key provided (401)' })).toBe('model-fatal');
    expect(classifyFailure({ phase: 'turn', message: 'model foo not found' })).toBe('model-fatal');
    expect(classifyFailure({ phase: 'turn', message: 'Rate limit exceeded' })).toBe('transient');
    expect(classifyFailure({ phase: 'turn', message: 'upstream 502 bad gateway' })).toBe('transient');
    expect(classifyFailure({ phase: 'turn', message: 'something odd' })).toBe('unknown');
  });
});

describe('ModelRelay', () => {
  const policy = { models: ['a', 'b'], retriesPerModel: 2, backoffMs: [10, 20] };

  it('rejects an empty model list', () => {
    expect(() => new ModelRelay({ ...policy, models: [] })).toThrow(/No models configured/);
  });

  it('retries transient failures with backoff, then switches, then gives up', () => {
    const r = new ModelRelay(policy);
    expect(r.onFailure('transient', 'x')).toEqual({ action: 'retry', model: 'a', delayMs: 10 });
    expect(r.onFailure('unknown', 'x')).toEqual({ action: 'retry', model: 'a', delayMs: 20 });
    expect(r.onFailure('transient', 'x')).toEqual({ action: 'switch', from: 'a', model: 'b' });
    expect(r.current()).toBe('b');
    expect(r.onFailure('transient', 'x')).toMatchObject({ action: 'retry', model: 'b', delayMs: 10 });
    r.onFailure('transient', 'x');
    expect(r.onFailure('transient', 'last')).toEqual({
      action: 'give-up',
      reason: 'All configured models failed. Last error: last',
    });
  });

  it('switches immediately on model-fatal', () => {
    const r = new ModelRelay(policy);
    expect(r.onFailure('model-fatal', 'x')).toEqual({ action: 'switch', from: 'a', model: 'b' });
  });

  it('gives up on cancelled and harness-down', () => {
    const r = new ModelRelay(policy);
    expect(r.onFailure('cancelled', '')).toEqual({ action: 'give-up', reason: 'cancelled' });
    expect(r.onFailure('harness-down', '')).toEqual({ action: 'give-up', reason: 'TrueForge is not reachable' });
  });

  it('reuses the last backoff entry and resets', () => {
    const r = new ModelRelay({ models: ['a'], retriesPerModel: 3, backoffMs: [5] });
    r.onFailure('transient', '');
    expect(r.onFailure('transient', '')).toMatchObject({ delayMs: 5 });
    r.reset();
    expect(r.current()).toBe('a');
  });
});

describe('relay policy edge cases', () => {
  it('uses default backoff when none is provided and resets after a switch', () => {
    const relay = new ModelRelay({ models: ['first', 'second'], retriesPerModel: 2, backoffMs: [] });
    expect(relay.onFailure('transient', 'busy')).toEqual({ action: 'retry', model: 'first', delayMs: 500 });
    expect(relay.onFailure('transient', 'busy')).toEqual({ action: 'retry', model: 'first', delayMs: 1500 });
    expect(relay.onFailure('transient', 'busy')).toMatchObject({ action: 'switch', model: 'second' });
    relay.reset();
    expect(relay.current()).toBe('first');
    expect(relay.onFailure('transient', 'busy')).toEqual({ action: 'retry', model: 'first', delayMs: 500 });
  });
  it('switches without retry when the retry allowance is zero', () => {
    const relay = new ModelRelay({ models: ['first', 'second'], retriesPerModel: 0, backoffMs: [10] });
    expect(relay.onFailure('unknown', 'first failure')).toEqual({ action: 'switch', from: 'first', model: 'second' });
    expect(relay.onFailure('transient', 'last failure')).toEqual({
      action: 'give-up',
      reason: 'All configured models failed. Last error: last failure',
    });
  });
});
