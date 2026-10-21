import { getStore } from '@netlify/blobs';
import { NextResponse } from 'next/server';
import { requirePopulationSession } from './server-session';
import { createExtensionReleaseStore } from './extension-releases.mjs';

export const releaseStore = () => createExtensionReleaseStore(getStore({ name: 'caution-bot-releases', consistency: 'strong' }));
export const noCache = { 'Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store' };
export async function releaseResponse(work) {
  try { const data = await work(); return data instanceof Response ? data : NextResponse.json(data, { headers: noCache }); }
  catch (error) { console.error('Extension update:', error.message); return NextResponse.json({ error: error.status === 400 ? error.message : '更新情報を処理できませんでした。' }, { status: error.status === 400 ? 400 : 503, headers: noCache }); }
}
export async function adminReleaseResponse(request, work) {
  return releaseResponse(async () => {
    const denied = await requirePopulationSession(request);
    if (denied) { for (const [key, value] of Object.entries(noCache)) denied.headers.set(key, value); return denied; }
    return work();
  });
}
