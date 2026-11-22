import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, mergeConfig } from '../../src/core/config';

describe('mergeConfig', () => {
  it('returns defaults for empty input and ignores undefined', () => {
    expect(mergeConfig({})).toEqual(DEFAULT_CONFIG);
    expect(mergeConfig({ mcpPort: undefined, models: undefined })).toEqual(DEFAULT_CONFIG);
  });
  it('overrides valid values', () => {
    const c = mergeConfig({ models: ['m'], cancelBehavior: 'keep', retriesPerModel: 3, trueforgeUrl: 'http://x' });
    expect(c).toMatchObject({ models: ['m'], cancelBehavior: 'keep', retriesPerModel: 3, trueforgeUrl: 'http://x' });
  });
  it('clamps numbers', () => {
    const lo = mergeConfig({
      retriesPerModel: -1,
      stallTimeoutSec: 0,
      contextBudget: 5,
      mcpPort: 80,
      commandTimeoutSec: 1,
    });
    expect(lo).toMatchObject({
      retriesPerModel: 0,
      stallTimeoutSec: 5,
      contextBudget: 1000,
      mcpPort: 1024,
      commandTimeoutSec: 5,
    });
    const hi = mergeConfig({
      retriesPerModel: 99,
      stallTimeoutSec: 9999,
      contextBudget: 1e9,
      mcpPort: 70000,
      commandTimeoutSec: 1e6,
    });
    expect(hi).toMatchObject({
      retriesPerModel: 5,
      stallTimeoutSec: 600,
      contextBudget: 200000,
      mcpPort: 65535,
      commandTimeoutSec: 1800,
    });
  });
  it('falls back to default for NaN', () => {
    expect(mergeConfig({ mcpPort: NaN }).mcpPort).toBe(DEFAULT_CONFIG.mcpPort);
  });
});

describe('configuration value isolation', () => {
  it('copies model lists so callers cannot mutate settings or defaults', () => {
    const models = ['provider/model'];
    const config = mergeConfig({ models });
    models.push('other/model');
    expect(config.models).toEqual(['provider/model']);
    config.models.push('local/change');
    expect(models).toEqual(['provider/model', 'other/model']);
    const defaults = mergeConfig({});
    defaults.models.push('test/model');
    expect(DEFAULT_CONFIG.models).toEqual([]);
  });
  it.each([NaN, Infinity, -Infinity])('rejects nonfinite numeric settings %s', (value) => {
    expect(
      mergeConfig({
        retriesPerModel: value,
        stallTimeoutSec: value,
        contextBudget: value,
        mcpPort: value,
        commandTimeoutSec: value,
      }),
    ).toEqual(DEFAULT_CONFIG);
  });
  it('rounds fractional values consistently before clamping', () => {
    expect(mergeConfig({ retriesPerModel: 1.6, mcpPort: 7801.4 })).toMatchObject({ retriesPerModel: 2, mcpPort: 7801 });
  });
});
