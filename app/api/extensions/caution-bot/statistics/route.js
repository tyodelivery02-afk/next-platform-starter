import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isAuthenticated } from 'lib/server-session';
import { getStatistics, listStatisticsAccounts, saveSnapshots, validAccountId, validateSnapshots } from 'lib/caution-statistics.mjs';

export const dynamic = 'force-dynamic';
const json = (data,status=200) => NextResponse.json(data,{status,headers:{'Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store'}});

async function respond(work) {
  try { return await work(); }
  catch { return json({error:'統計を取得または保存できませんでした。'},503); }
}

export async function POST(request) {
  const key = process.env.CAUTION_STATISTICS_API_KEY;
  if (!/^[a-f0-9]{64}$/.test(key || '')) return json({error:'統計同期のキーが設定されていません。'},503);
  const authorization = request.headers.get('authorization') || '';
  const supplied = authorization.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];
  if (!supplied || !timingSafeEqual(Buffer.from(supplied),Buffer.from(key))) {
    return json({error:'統計同期のキーが一致しません。'},401);
  }
  return respond(async()=>{
    if (!request.headers.get('content-type')?.startsWith('application/json')) return json({error:'統計データが不正です。'},400);
    const raw = await request.text();
    if (raw.length > 100000) return json({error:'統計データが大きすぎます。'},413);
    let input;
    try { input = validateSnapshots(JSON.parse(raw)); } catch {}
    if (!input) return json({error:'統計データが不正です。'},400);
    await saveSnapshots(input);
    return json(await getStatistics(input.accountId));
  });
}

export async function GET(request) {
  return respond(async()=>{
    if (!await isAuthenticated(request)) return json({error:'ログインしてください。'},401);
    const accountId = request.nextUrl.searchParams.get('accountId');
    if (accountId === null) return json({accounts:await listStatisticsAccounts()});
    if (!validAccountId(accountId)) return json({error:'アカウント ID が不正です。'},400);
    return json(await getStatistics(accountId));
  });
}
