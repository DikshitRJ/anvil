import { afterEach, describe, expect, it, vi } from 'vitest';
import { HealthLoop } from '../../src/host/healthLoop';

afterEach(() => vi.useRealTimers());
describe('health loop disposal', () => {
  it('does not announce recovery after disposal during a pending check', async () => {
    let resolve!: (value: boolean) => void;
    const check = vi.fn(
      () =>
        new Promise<boolean>((done) => {
          resolve = done;
        }),
    );
    const onChange = vi.fn();
    const onUp = vi.fn();
    const loop = new HealthLoop(check, onChange, onUp);
    const pending = loop.tick();
    loop.dispose();
    resolve(true);
    await pending;
    await loop.tick();
    expect(check).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
    expect(onUp).not.toHaveBeenCalled();
  });
  it('starts at most one polling timer and removes it on dispose', async () => {
    vi.useFakeTimers();
    const check = vi.fn().mockResolvedValue(true);
    const loop = new HealthLoop(check, vi.fn(), vi.fn(), 100);
    loop.start();
    await Promise.resolve();
    loop.start();
    expect(vi.getTimerCount()).toBe(1);
    loop.dispose();
    expect(vi.getTimerCount()).toBe(0);
    loop.start();
    expect(vi.getTimerCount()).toBe(0);
  });
});
