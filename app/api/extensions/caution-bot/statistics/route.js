import { NextResponse } from 'next/server';
import { isAuthenticated } from 'lib/server-session';
import { getStatistics, listStatisticsAccounts, saveSnapshots, validAccountId, validateSnapshots } from 'lib/caution-statistics.mjs';

export const dynamic = 'force-dynamic';
const json = (data,status=200) => NextResponse.json(data,{status,headers:{'Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store'}});

async function respond(request, work) {
  try {
    if (!await isAuthenticated(request)) return json({error:'ログインしてください。'},401);
    return await work();
  } catch {
    return json({error:'統計を取得または保存できませんでした。'},503);
  }
}

export async function POST(request) {
  const origin = request.headers.get('origin') || '';
  if (!/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) return json({error:'送信元を確認できません。'},403);
  return respond(request,async()=>{
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
  return respond(request,async()=>{
    const accountId = request.nextUrl.searchParams.get('accountId');
    if (accountId === null) return json({accounts:await listStatisticsAccounts()});
    if (!validAccountId(accountId)) return json({error:'アカウント ID が不正です。'},400);
    return json(await getStatistics(accountId));
  });
}
