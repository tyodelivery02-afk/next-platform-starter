import assert from 'node:assert/strict';
import { postalDatabase } from '../lib/zipcode-sync-store.mjs';
import { SOURCES } from '../lib/zipcode-sync-data.mjs';
import { stageSource, comparePostalSource } from '../lib/zipcode-sync.mjs';

// Session-local temporary fixtures shadow the real table names. No live postal rows or sequences are modified.
const client = await postalDatabase();
try {
  const fixtures = {};
  for (const kind of Object.keys(SOURCES)) {
    const row = (await client.query(`SELECT * FROM public.${kind} LIMIT 1`)).rows[0];
    assert.ok(row);
    const columns = SOURCES[kind].columns;
    fixtures[kind] = columns.map(column => row[column] ?? '');
    await client.query(`CREATE TEMP TABLE ${kind} AS SELECT * FROM public.${kind} WITH NO DATA`);
    await client.query(`INSERT INTO ${kind} (id,${columns.join(',')}) VALUES (1,${columns.map((_, i) => `$${i + 1}`).join(',')})`, fixtures[kind]);
  }
  const incoming = {};
  for (const kind of Object.keys(SOURCES)) {
    const second = [...fixtures[kind]];
    second[SOURCES[kind].columns.indexOf('town_kanji')] = '同期テスト';
    incoming[kind] = [fixtures[kind], second];
  }
  await client.query('BEGIN');
  for (const kind of Object.keys(SOURCES)) await stageSource(client, kind, incoming[kind]);
  for (const kind of Object.keys(SOURCES)) {
    const result = await comparePostalSource(client, kind, true);
    assert.deepEqual(result, { total: 2, added: 1, removed: 0 });
    assert.equal(+(await client.query(`SELECT count(*) AS count FROM ${kind}`)).rows[0].count, 2);
    assert.equal(+(await client.query(`SELECT count(*) AS count FROM ${kind} WHERE id=1`)).rows[0].count, 1);
  }
  await client.query('ROLLBACK');
  for (const kind of Object.keys(SOURCES)) assert.equal(+(await client.query(`SELECT count(*) AS count FROM ${kind}`)).rows[0].count, 1);

  await client.query('BEGIN');
  await stageSource(client, 'zipcode', [incoming.zipcode[1]]);
  const changes = await comparePostalSource(client, 'zipcode', true);
  assert.deepEqual(changes, { total: 1, added: 1, removed: 1 });
  await assert.rejects(client.query("INSERT INTO jigyosyo_zipcode (type_flag) VALUES ('invalid')"));
  await client.query('ROLLBACK');
  const restored = (await client.query('SELECT town_kanji FROM zipcode')).rows;
  assert.equal(restored.length, 1);
  assert.equal(restored[0].town_kanji, fixtures.zipcode[SOURCES.zipcode.columns.indexOf('town_kanji')]);
  console.log('Temporary-table integration checks passed: both-source writes, shared-postcode preservation, stable existing ID, deletion and atomic rollback. Live postal tables unchanged.');
} finally { await client.end(); }
