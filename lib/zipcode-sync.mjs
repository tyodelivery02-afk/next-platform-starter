import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { from as copyFrom } from 'pg-copy-streams';
import { SOURCES, downloadPostalSource, parsePostalCSV, validatePostalCoverage, csvLine } from './zipcode-sync-data.mjs';
import { postalDatabase, failPostalSync } from './zipcode-sync-store.mjs';

export async function stageSource(client, kind, rows) {
  // Identifiers come exclusively from the fixed source schema, never from the request.
  const columns = SOURCES[kind].columns.join(',');
  const stage = `sync_${kind}`;
  await client.query(`CREATE TEMP TABLE ${stage} ON COMMIT DROP AS SELECT ${columns} FROM ${kind} WITH NO DATA`);
  await pipeline(Readable.from(rows.map(csvLine)), client.query(copyFrom(`COPY ${stage} (${columns}) FROM STDIN WITH (FORMAT csv)`)));
  await client.query(`ALTER TABLE ${stage} ADD COLUMN row_hash TEXT`);
  await client.query(`UPDATE ${stage} s SET row_hash=md5(ROW(${SOURCES[kind].columns.map(c => `s.${c}`).join(',')})::text)`);
  await client.query(`CREATE INDEX ON ${stage} (row_hash)`);
  await client.query(`ANALYZE ${stage}`);
}

export async function comparePostalSource(client, kind, apply = false) {
  const columns = SOURCES[kind].columns;
  const stage = `sync_${kind}`;
  const tuple = alias => `ROW(${columns.map(c => `${alias}.${c}`).join(',')})`;
  const oldMatch = `s.row_hash=md5(${tuple('t')}::text) AND ${tuple('s')} IS NOT DISTINCT FROM ${tuple('t')}`;
  const newMatch = `t.row_hash=s.row_hash AND ${tuple('t')} IS NOT DISTINCT FROM ${tuple('s')}`;
  // A temporary fingerprint of existing rows avoids per-row scans of the live tables.
  await client.query(`CREATE TEMP TABLE old_${kind} ON COMMIT DROP AS SELECT ${columns.join(',')}, md5(${tuple('t')}::text) AS row_hash FROM ${kind} t`);
  await client.query(`CREATE INDEX ON old_${kind} (row_hash)`);
  await client.query(`ANALYZE old_${kind}`);
  const removed = await client.query(`SELECT count(*)::int AS count FROM ${kind} t WHERE NOT EXISTS (SELECT 1 FROM ${stage} s WHERE ${oldMatch})`);
  const added = await client.query(`SELECT count(*)::int AS count FROM ${stage} s WHERE NOT EXISTS (SELECT 1 FROM old_${kind} t WHERE ${newMatch})`);
  if (apply) {
    await client.query(`DELETE FROM ${kind} t WHERE NOT EXISTS (SELECT 1 FROM ${stage} s WHERE ${oldMatch})`);
    await client.query(`INSERT INTO ${kind} (${columns.join(',')}) SELECT ${columns.map(c => `s.${c}`).join(',')} FROM ${stage} s WHERE NOT EXISTS (SELECT 1 FROM old_${kind} t WHERE ${newMatch})`);
  }
  return { total: +(await client.query(`SELECT count(*) AS count FROM ${stage}`)).rows[0].count, added: added.rows[0].count, removed: removed.rows[0].count };
}

export async function runPostalSync(runId, { dryRun = false } = {}) {
  const client = await postalDatabase();
  let transaction = false;
  try {
    if (!dryRun) {
      const claimed = await client.query(`UPDATE zipcode_sync_status SET worker_started_at=NOW()
        WHERE singleton AND run_id=$1 AND status='running' AND worker_started_at IS NULL RETURNING source_hashes`, [runId]);
      if (!claimed.rowCount) return null; // Includes duplicate delivery of a background job.
    }
    const sources = await Promise.all(Object.keys(SOURCES).map(async kind => [kind, await downloadPostalSource(kind)]));
    const hashes = Object.fromEntries(sources.map(([kind, source]) => [kind, source.hash]));
    const previous = (await client.query('SELECT source_hashes FROM zipcode_sync_status WHERE singleton')).rows[0]?.source_hashes;
    const unchanged = !dryRun && Object.keys(SOURCES).every(kind => previous?.[kind] === hashes[kind]);
    const summary = { unchanged, sources: Object.fromEntries(sources.map(([kind, source]) => [kind, { modified: source.modified }])) };
    const parsed = unchanged ? [] : await Promise.all(sources.map(async ([kind, source]) => [kind, await parsePostalCSV(source.buffer, kind)]));
    await client.query('BEGIN');
    transaction = true;
    await client.query("SET LOCAL statement_timeout='120s'");
    await client.query("SET LOCAL lock_timeout='15s'");
    const lock = await client.query('SELECT pg_try_advisory_xact_lock(791106, 1) AS locked');
    if (!lock.rows[0].locked) throw new Error('Another sync owns the database lock');
    for (const [kind, rows] of parsed) {
      const oldCount = +(await client.query(`SELECT count(*) AS count FROM ${kind}`)).rows[0].count;
      validatePostalCoverage(rows, kind, oldCount);
      await stageSource(client, kind, rows);
    }
    if (!dryRun) {
      const current = await client.query("SELECT run_id FROM zipcode_sync_status WHERE singleton AND run_id=$1 AND status='running' FOR UPDATE", [runId]);
      if (!current.rowCount) throw new Error('Sync ownership expired');
      if (!unchanged) await client.query('LOCK TABLE zipcode, jigyosyo_zipcode IN SHARE ROW EXCLUSIVE MODE');
    }
    for (const [kind] of parsed) summary[kind] = await comparePostalSource(client, kind, !dryRun);
    if (dryRun) {
      await client.query('ROLLBACK');
    } else {
      await client.query(`UPDATE zipcode_sync_status SET status='succeeded', finished_at=NOW(), source_hashes=$2, summary=$3, error=NULL
        WHERE singleton AND run_id=$1`, [runId, JSON.stringify(hashes), JSON.stringify(summary)]);
      await client.query('COMMIT');
    }
    transaction = false;
    return summary;
  } catch (error) {
    if (transaction) await client.query('ROLLBACK').catch(() => {});
    if (!dryRun) await failPostalSync(runId, '同期に失敗しました。既存データは保持されています。再実行してください。');
    throw error;
  } finally { await client.end(); }
}
