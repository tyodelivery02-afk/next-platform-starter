import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET() { return NextResponse.json({ error: 'ZIP は Google Drive から直接取得してください。' }, { status: 410, headers: { 'Cache-Control': 'no-store' } }); }
