import { neon } from '@netlify/neon';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from './session-token.mjs';

let passwordCache;
export async function getPasswordHash() {
  if (!passwordCache || passwordCache.expires <= Date.now()) {
    const promise = neon()`SELECT value FROM sys_config WHERE key = 'password'`.then(rows => {
      if (!rows[0]?.value) throw new Error('Login configuration unavailable');
      return rows[0].value;
    }).catch(error => { passwordCache = null; throw error; });
    passwordCache = { promise, expires: Date.now() + 60000 };
  }
  return passwordCache.promise;
}

export async function isAuthenticated(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  return verifySessionToken(token, await getPasswordHash());
}

export function isSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const source = new URL(origin);
    const target = new URL(request.url);
    // Netlify dev forwards localhost:8888 to Next on :3000.
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0].trim();
    const host = forwardedHost || request.headers.get('host') || target.host;
    const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() || target.protocol.replace(':', '');
    return source.host === host && source.protocol === protocol + ':';
  } catch { return false; }
}

export async function requirePopulationSession(request) {
  // Same-origin writes also protect against cross-site form submissions.
  if (!['GET', 'HEAD'].includes(request.method)) {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ success: false, error: 'Forbidden origin' }, { status: 403 });
    }
  }
  if (!await isAuthenticated(request)) return NextResponse.json({ success: false, error: 'ログインしてください' }, { status: 401 });
  return null;
}
