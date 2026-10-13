import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getPasswordHash, isAuthenticated, isSameOrigin } from '../../../lib/server-session';
import { createSessionToken, SESSION_COOKIE, SESSION_SECONDS } from '../../../lib/session-token.mjs';

export async function POST(request) {
  try {
    const { password } = await request.json();
    if (typeof password !== 'string' || !password || password.length > 256) return NextResponse.json({ success: false }, { status: 400 });
    if (!isSameOrigin(request)) return NextResponse.json({ success: false }, { status: 403 });
    const hashedPassword = await getPasswordHash();

    if (await bcrypt.compare(password, hashedPassword)) {
      const res = NextResponse.json({ success: true, token: 'authenticated' });
      res.cookies.set(SESSION_COOKIE, createSessionToken(hashedPassword), {
        httpOnly: true,
        secure: request.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https' || new URL(request.url).protocol === 'https:',
        sameSite: 'lax', path: '/', maxAge: SESSION_SECONDS,
      });
      return res;
    }

    return NextResponse.json({ success: false });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false });
  }
}

// GET 用于验证 token
export async function GET(request) {
  try {
    return NextResponse.json({ loggedIn: await isAuthenticated(request) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ loggedIn: false }, { status: 503 });
  }
}
