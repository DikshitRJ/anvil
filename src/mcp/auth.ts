// Bearer-token and Origin checks for the local MCP bridge.
import { timingSafeEqual } from 'node:crypto';

export function checkBearer(header: string | undefined, token: string): boolean {
  if (!header || !token) return false;
  const m = /^Bearer (.+)$/.exec(header);
  if (!m) return false;
  const given = Buffer.from(m[1] ?? '');
  const expected = Buffer.from(token);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

const LOOPBACK_ORIGIN = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;

// Non-browser clients send no Origin; browsers must come from loopback only.
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (origin === undefined || origin === '') return true;
  return LOOPBACK_ORIGIN.test(origin);
}
