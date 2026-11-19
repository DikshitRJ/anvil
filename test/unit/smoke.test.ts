import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/core/config';

describe('smoke', () => {
  it('has sane defaults', () => {
    expect(DEFAULT_CONFIG.mcpPort).toBe(7801);
    expect(DEFAULT_CONFIG.trueforgeUrl).toBe('http://localhost:8790');
  });
});
