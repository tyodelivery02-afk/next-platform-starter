import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'sessionToken';
export const SESSION_SECONDS = 12 * 60 * 60;
const sign = (payload, secret) => createHmac('sha256', secret).update(`delivery-session:${payload}`).digest('base64url');

export function createSessionToken(secret, now = Date.now()) {
  const payload = `${Math.floor(now / 1000) + SESSION_SECONDS}.${randomBytes(24).toString('base64url')}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 256) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || !/^\d+$/.test(parts[0]) || !/^[\w-]{32}$/.test(parts[1])) return false;
  const expires = Number(parts[0]);
  if (expires <= Math.floor(now / 1000) || expires > Math.floor(now / 1000) + SESSION_SECONDS) return false;
  const actual = Buffer.from(parts[2]);
  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`, secret));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
