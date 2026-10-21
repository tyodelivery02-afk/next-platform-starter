import { NextResponse } from 'next/server';
import { isAuthenticated } from '../../../../lib/server-session';
import { listLineCodes } from '../../../../lib/line-ocr-store';

export async function GET(request) {
  const serverTime = new Date().toISOString();
  try {
    if (!await isAuthenticated(request)) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Math.min(10000, Number.parseInt(params.get('page'), 10) || 1));
    const search = (params.get('search') || '').normalize('NFKC').trim().toUpperCase();
    if (search && !/^[A-Z0-9]{1,12}$/.test(search)) return NextResponse.json({ error: '英数字12文字以内で検索してください' }, { status: 400 });
    const sinceValue = params.get('since');
    if (sinceValue && (sinceValue.length > 40 || !Number.isFinite(Date.parse(sinceValue)))) return NextResponse.json({ error: '開始日時が不正です' }, { status: 400 });
    const since = sinceValue ? new Date(sinceValue).toISOString() : null;
    const statusSort = params.get('statusSort') || 'default';
    if (!['default', 'asc', 'desc'].includes(statusSort)) return NextResponse.json({ error: '並び順が不正です' }, { status: 400 });
    return NextResponse.json({ ...await listLineCodes(page, search, since, statusSort), serverTime }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: '認識結果を読み込めませんでした' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
