import { NextResponse } from 'next/server';
import { requirePopulationSession } from '../../../../lib/server-session';
import { claimPostalSync, failPostalSync, getPostalSyncStatus } from '../../../../lib/zipcode-sync-store.mjs';

export const runtime = 'nodejs';
export const maxDuration = 30;
const respond = (data, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request) {
  try {
    const denied = await requirePopulationSession(request);
    if (denied) return denied;
    return respond({ success: true, ...await getPostalSyncStatus() });
  } catch { return respond({ success: false, error: '同期状態を取得できませんでした。' }, 503); }
}

export async function POST(request) {
  let runId;
  try {
    const denied = await requirePopulationSession(request);
    if (denied) return denied;
    runId = await claimPostalSync();
    if (!runId) return respond({ success: false, error: '郵便番号の同期は実行中です。' }, 409);
    // Use deployment configuration in production; local Netlify Dev forwards the public host.
    const incoming = new URL(request.url);
    const local = ['localhost', '127.0.0.1'].includes(incoming.hostname);
    const localHost = request.headers.get('x-forwarded-host')?.split(',')[0].trim() || request.headers.get('host') || incoming.host;
    const origin = local ? `${incoming.protocol}//${localHost}` : process.env.DEPLOY_PRIME_URL || process.env.URL || incoming.origin;
    const target = new URL('/.netlify/functions/zipcode-sync-background', origin);
    const res = await fetch(target, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId }),
      signal: AbortSignal.timeout(15000), redirect: 'error',
    });
    if (res.status !== 202) {
      await failPostalSync(runId, 'バックグラウンド処理を開始できませんでした。Netlify の設定を確認してください。');
      return respond({ success: false, error: 'バックグラウンド処理を開始できませんでした。' }, 503);
    }
    return respond({ success: true, ...await getPostalSyncStatus() }, 202);
  } catch {
    if (runId) {
      // A timed-out dispatch might still have started. Keep polling rather than incorrectly declaring failure.
      const status = await getPostalSyncStatus().catch(() => null);
      if (status?.status === 'running') return respond({ success: true, ...status }, 202);
      await failPostalSync(runId, '同期を開始できませんでした。再実行してください。').catch(() => {});
    }
    return respond({ success: false, error: '同期を開始できませんでした。' }, 503);
  }
}
