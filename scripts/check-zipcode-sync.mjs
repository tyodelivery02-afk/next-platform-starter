import { readFile } from 'node:fs/promises';
import { postalDatabase } from '../lib/zipcode-sync-store.mjs';
import { runPostalSync } from '../lib/zipcode-sync.mjs';

try {
  if (process.argv.includes('--migrate')) {
    const client = await postalDatabase();
    try { await client.query(await readFile(new URL('../migrations/20261106_zipcode_sync.sql', import.meta.url), 'utf8')); }
    finally { await client.end(); }
    console.log('Postal sync metadata migration completed.');
  }
  if (process.argv.includes('--dry-run')) console.log(JSON.stringify(await runPostalSync(null, { dryRun: true }), null, 2));
} catch (e) {
  console.error('Postal sync check failed:', e.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]'));
  process.exitCode = 1;
}
