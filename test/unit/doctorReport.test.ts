import { describe, expect, it } from 'vitest';
import { formatReport, OUTBOUND_HINT, TRUEFORGE_DOWN_FIX } from '../../src/host/doctor';

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

  it('includes the loopback allowlist hint in the fix text', () => {
    const out = formatReport([{ name: 'm', ok: false, detail: 'bad', fix: `Run setup. ${OUTBOUND_HINT}` }]);
    expect(out).toContain('OUTBOUND_URL_ALLOWED_HOSTS=\'["127.0.0.1","localhost"]\'');
  });

  it('tells the user to start TrueForge with HOST=localhost', () => {
    expect(TRUEFORGE_DOWN_FIX).toContain('HOST=localhost');
    expect(TRUEFORGE_DOWN_FIX).toContain('OUTBOUND_URL_ALLOWED_HOSTS');
  });
});
