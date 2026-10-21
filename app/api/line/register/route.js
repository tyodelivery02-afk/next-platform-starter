import { NextResponse } from 'next/server';
import { isAuthenticated, isSameOrigin } from '../../../../lib/server-session';
import { CODE_PATTERN } from '../../../../lib/line-ocr.mjs';
import { CargoIssueError, registerCargoIssue } from '../../../../lib/line-cargo.mjs';
import { claimCargoRegistration, finishCargoRegistration } from '../../../../lib/line-cargo-store';
import { loadEspoirerOrder, createEspoirerIssue, espoirerIssueExists } from '../../../../lib/line-cargo-api';

export const maxDuration = 60;
export async function POST(request) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    if (request.headers.get('sec-fetch-site') === 'cross-site' || !isSameOrigin(request)) return NextResponse.json({ error: 'Forbidden origin' }, { status: 403, headers });
    if (!await isAuthenticated(request)) return NextResponse.json({ error: 'ログインしてください' }, { status: 401, headers });
    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'リクエスト形式が不正です。' }, { status: 400, headers }); }
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!CODE_PATTERN.test(code)) return NextResponse.json({ error: '番号が不正です。' }, { status: 400, headers });
    const result = await registerCargoIssue(code, {
      claim: claimCargoRegistration, finish: finishCargoRegistration,
      exists: espoirerIssueExists,
      loadOrder: loadEspoirerOrder, create: createEspoirerIssue,
    });
    return NextResponse.json({ success: true, ...result }, { headers });
  } catch (error) {
    const known = error instanceof CargoIssueError;
    return NextResponse.json({ error: known ? error.message : '登録処理に失敗しました。異常貨物画面で状況を確認してください。', uncertain: known ? error.uncertain : true }, { status: known ? error.status : 503, headers });
  }
}
