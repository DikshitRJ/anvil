import { describe, expect, it } from 'vitest';
import { formatReport } from '../../src/host/doctor';

describe('formatReport', () => {
  it('marks pass, warn and fail distinctly', () => {
    const out = formatReport([
      { name: 'a', ok: true, detail: 'fine' },
      { name: 'b', ok: true, warn: true, detail: 'elsewhere', fix: 'use other window' },
      { name: 'c', ok: false, detail: 'bad', fix: 'repair' },
    ]);
    expect(out).toContain('✓ a: fine');
    expect(out).toContain('⚠ b: elsewhere\n    hint: use other window');
    expect(out).toContain('✗ c: bad\n    fix: repair');
  });
});
