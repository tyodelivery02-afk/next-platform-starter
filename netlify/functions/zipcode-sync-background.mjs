import { runPostalSync } from '../../lib/zipcode-sync.mjs';

export default async function handler(request) {
  if (request.method !== 'POST') return;
  const body = await request.json().catch(() => null);
  if (!/^[0-9a-f-]{36}$/i.test(body?.runId || '')) return;
  // The unguessable run ID is created by the authenticated Next.js route and is never returned to browsers.
  // The database also admits only one worker for a current run.
  try { await runPostalSync(body.runId); }
  catch { console.error('Postal sync failed; previous data retained.'); }
}
