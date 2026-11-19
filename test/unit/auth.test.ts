import { describe, expect, it } from 'vitest';
import { checkBearer, isAllowedOrigin } from '../../src/mcp/auth';

describe('checkBearer', () => {
  it('accepts the exact token', () => expect(checkBearer('Bearer s3cret', 's3cret')).toBe(true));
  it('rejects wrong, short, long, missing and malformed', () => {
    expect(checkBearer('Bearer s3creT', 's3cret')).toBe(false);
    expect(checkBearer('Bearer s3', 's3cret')).toBe(false);
    expect(checkBearer('Bearer s3cret!', 's3cret')).toBe(false);
    expect(checkBearer(undefined, 's3cret')).toBe(false);
    expect(checkBearer('s3cret', 's3cret')).toBe(false);
    expect(checkBearer('Basic s3cret', 's3cret')).toBe(false);
  });
});

describe('isAllowedOrigin', () => {
  it('allows absent origin and loopback hosts', () => {
    for (const o of [
      undefined,
      '',
      'http://127.0.0.1',
      'http://127.0.0.1:7801',
      'https://localhost:3000',
      'http://localhost',
      'http://[::1]:80',
    ]) {
      expect(isAllowedOrigin(o)).toBe(true);
    }
  });
  it('rejects everything else', () => {
    for (const o of [
      'https://evil.com',
      'vscode-webview://abc',
      'http://localhost.evil.com',
      'http://127.0.0.1.evil.com',
      'null',
      'ftp://localhost',
    ]) {
      expect(isAllowedOrigin(o)).toBe(false);
    }
  });
});
