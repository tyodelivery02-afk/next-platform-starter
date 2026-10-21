import { NextResponse } from 'next/server';
export async function PUT() { return NextResponse.json({ error: 'ZIP は Google Drive にアップロードしてください。' }, { status: 410, headers: { 'Cache-Control': 'no-store' } }); }
