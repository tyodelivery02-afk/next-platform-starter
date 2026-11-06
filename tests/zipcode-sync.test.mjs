import test from 'node:test';
import assert from 'node:assert/strict';
import iconv from 'iconv-lite';
import { SOURCES, parsePostalCSV, validatePostalCoverage, csvLine } from '../lib/zipcode-sync-data.mjs';
import { publicSyncStatus } from '../lib/zipcode-sync-store.mjs';

const address = ['01101', '060', '0600000', 'ホッカイドウ', 'サッポロシチュウオウク', 'イカニケイサイガナイバアイ', '北海道', '札幌市中央区', '以下に掲載がない場合', '0', '0', '0', '0', '0', '0'];
const office = ['01101', 'テスト', 'テスト株式会社', '北海道', '札幌市中央区', '大通', '１－２', '0608799', '060', '札幌中央', '0', '0', '0'];

test('UTF-8 records preserve leading zeroes, quoted commas and distinct towns sharing a postcode', async () => {
  const second = [...address]; second[8] = '町名,"別名"';
  const rows = await parsePostalCSV(Buffer.from('\uFEFF' + csvLine(address) + csvLine(second) + csvLine(address)), 'zipcode');
  assert.equal(rows.length, 2);
  assert.equal(rows[0][0], '01101');
  assert.equal(rows[0][2], '0600000');
  assert.equal(rows[1][8], second[8]);
});

test('business CSV uses Shift-JIS and retains office address fields', async () => {
  const rows = await parsePostalCSV(iconv.encode(csvLine(office), 'shift_jis'), 'jigyosyo_zipcode');
  assert.deepEqual(rows[0], office);
});

test('malformed postcode, column count and flags stop an import', async () => {
  const bad = [...address]; bad[2] = '600000';
  await assert.rejects(parsePostalCSV(Buffer.from(csvLine(bad)), 'zipcode'));
  await assert.rejects(parsePostalCSV(Buffer.from('01101,060\n'), 'zipcode'));
  bad[2] = address[2]; bad[9] = '7';
  await assert.rejects(parsePostalCSV(Buffer.from(csvLine(bad)), 'zipcode'));
});

test('coverage checks reject partial national files and abnormal shrinkage', () => {
  const rows = Array.from({ length: SOURCES.zipcode.minimum }, (_, i) => [`${String(i % 47 + 1).padStart(2, '0')}001`]);
  assert.doesNotThrow(() => validatePostalCoverage(rows, 'zipcode'));
  assert.throws(() => validatePostalCoverage(rows.slice(0, 50), 'zipcode'));
  assert.throws(() => validatePostalCoverage(rows, 'zipcode', 180000));
});

test('public job status hides the worker credential and expires abandoned runs', () => {
  const status = publicSyncStatus({ run_id: 'private-token', status: 'running', started_at: new Date(Date.now() - 21 * 60000) });
  assert.equal(status.status, 'failed');
  assert.equal('run_id' in status, false);
});
