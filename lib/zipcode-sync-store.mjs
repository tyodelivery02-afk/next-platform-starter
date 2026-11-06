import pg from 'pg';
import { randomUUID } from 'node:crypto';

export async function postalDatabase() {
  const connectionString = process.env.NETLIFY_DATABASE_URL_UNPOOLED || process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Database configuration unavailable');
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 12000 });
  await client.connect();
  return client;
}

export function publicSyncStatus(row) {
  if (!row) throw new Error('Sync migration missing');
  const expired = row.status === 'running' && Date.now() - new Date(row.started_at).getTime() > 20 * 60000;
  return {
    status: expired ? 'failed' : row.status, startedAt: row.started_at, finishedAt: row.finished_at,
    summary: row.summary, error: expired ? '同期が中断されました。再実行してください。' : row.error,
  };
}

export async function getPostalSyncStatus() {
  const client = await postalDatabase();
  try { return publicSyncStatus((await client.query('SELECT * FROM zipcode_sync_status WHERE singleton')).rows[0]); }
  finally { await client.end(); }
}

export async function claimPostalSync() {
  const client = await postalDatabase();
  const runId = randomUUID();
  try {
    const result = await client.query(`UPDATE zipcode_sync_status SET run_id=$1, status='running', started_at=NOW(),
      worker_started_at=NULL, finished_at=NULL, summary=NULL, error=NULL
      WHERE singleton AND (status <> 'running' OR started_at < NOW() - INTERVAL '20 minutes') RETURNING run_id`, [runId]);
    return result.rows[0]?.run_id || null;
  } finally { await client.end(); }
}

export async function failPostalSync(runId, message) {
  const client = await postalDatabase();
  try {
    await client.query(`UPDATE zipcode_sync_status SET status='failed', finished_at=NOW(), error=$2 WHERE singleton AND run_id=$1 AND status='running'`, [runId, message]);
  } finally { await client.end(); }
}
