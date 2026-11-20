import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApprovalLedger, canonicalKey, scopedKey, stableStringify } from '../../src/core/ledger';

const entry = { finalContent: 'x', totalHunks: 1, feedback: '' };

describe('stableStringify', () => {
  it('sorts keys recursively and matches JSON for primitives', () => {
    expect(stableStringify({ b: 1, a: { d: [1, null, 'x'], c: true } })).toBe(
      '{"a":{"c":true,"d":[1,null,"x"]},"b":1}',
    );
    expect(stableStringify({ a: undefined, b: 2 })).toBe('{"b":2}');
    expect(stableStringify('q"')).toBe('"q\\""');
    expect(stableStringify(null)).toBe('null');
  });
});

describe('canonicalKey', () => {
  it('is order-independent and tool-sensitive', () => {
    expect(canonicalKey('t', { a: 1, b: 2 })).toBe(canonicalKey('t', { b: 2, a: 1 }));
    expect(canonicalKey('t', {})).not.toBe(canonicalKey('u', {}));
    expect(canonicalKey('t', {})).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('ApprovalLedger', () => {
  afterEach(() => vi.useRealTimers());
  it('take returns and deletes', () => {
    const l = new ApprovalLedger();
    l.put('k', entry);
    expect(l.size()).toBe(1);
    expect(l.take('k')).toEqual(entry);
    expect(l.take('k')).toBeUndefined();
    expect(l.size()).toBe(0);
  });
  it('purges entries older than 10 minutes on put', () => {
    vi.useFakeTimers();
    const l = new ApprovalLedger();
    l.put('old', entry);
    vi.advanceTimersByTime(11 * 60 * 1000);
    l.put('new', entry);
    expect(l.size()).toBe(1);
    expect(l.take('old')).toBeUndefined();
  });
  it('clear empties', () => {
    const l = new ApprovalLedger();
    l.put('a', entry);
    l.clear();
    expect(l.size()).toBe(0);
  });
});

describe('scopedKey', () => {
  it('differs across runs and is stable within one', () => {
    expect(scopedKey('r1', 't', { a: 1, b: 2 })).toBe(scopedKey('r1', 't', { b: 2, a: 1 }));
    expect(scopedKey('r1', 't', {})).not.toBe(scopedKey('r2', 't', {}));
    expect(scopedKey(undefined, 't', {})).toBe(`|${canonicalKey('t', {})}`);
  });
});

describe('ApprovalLedger TTL on take (issue 46)', () => {
  afterEach(() => vi.useRealTimers());
  it('returns undefined for an entry older than 10 minutes', () => {
    vi.useFakeTimers();
    const l = new ApprovalLedger();
    l.put('k', { finalContent: 'x', totalHunks: 1, feedback: '' });
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    expect(l.take('k')).toBeUndefined();
    l.put('k2', { finalContent: 'x', totalHunks: 1, feedback: '' });
    vi.advanceTimersByTime(60 * 1000);
    expect(l.take('k2')?.finalContent).toBe('x');
  });
});
