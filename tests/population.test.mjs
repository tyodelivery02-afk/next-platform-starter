import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrefStats, collapsePrefecture, sumSelectedPopulation } from '../lib/population-model.mjs';
import { createSessionToken, verifySessionToken, SESSION_SECONDS } from '../lib/session-token.mjs';
import { fetchPopulationJSON, mapWithConcurrency, loadPopulationSnapshot } from '../lib/population-client.mjs';
import { fetchEstat } from '../lib/estat-cache.mjs';
import { isMunicipalityCode, numericStat } from '../lib/estat-model.mjs';

const mapping = { '13': ['13101', '13102'] };
const population = { '13000': 300, '13101': 100, '13102': 200, '14101': 50 };
const area = { '13101': 10, '13102': 20, '14101': 5 };

test('municipality statistics exclude overlapping city aggregates and tolerate suppressed values', () => {
  assert.equal(isMunicipalityCode('13100'), false);
  assert.equal(isMunicipalityCode('01100'), false);
  assert.equal(isMunicipalityCode('13000'), false);
  assert.equal(isMunicipalityCode('13101'), true);
  assert.equal(numericStat('-'), 0);
  assert.equal(numericStat('123.45'), 123.45);
});

test('whole prefecture has full area, population and municipality codes for downstream statistics', () => {
  const stats = buildPrefStats('13', ['13000'], population, mapping, area, 1000, 35);
  assert.equal(stats.selectedPop, 300);
  assert.equal(stats.selectedArea, 30);
  assert.equal(stats.selectedAreaCount, 2);
  assert.deepEqual(stats.prefSelectedCodes, ['13101', '13102']);
  assert.equal(stats.nationalArea, 35);
});

test('partial selection updates statistics without counting other prefectures', () => {
  const stats = buildPrefStats('13', ['13101', '14101'], population, mapping, area, 1000, 35);
  assert.equal(stats.selectedPop, 100);
  assert.equal(stats.selectedArea, 10);
  assert.equal(stats.totalPrefPop, 300);
  assert.equal(stats.totalAreaCount, 2);
  assert.equal(buildPrefStats('13', [], population, mapping, area, 1000, 35).selectedPop, 0);
});

test('mixed colors survive return to national map', () => {
  const selected = ['13101', '13102', '14101'];
  const colors = { '13101': 'color1', '13102': 'color2', '14101': 'color3' };
  const result = collapsePrefecture('13', selected, colors, mapping['13']);
  assert.deepEqual(result.selectedAreas, selected);
  assert.deepEqual(result.areaColors, colors);
});

test('same colors collapse without altering other prefectures or the input', () => {
  const selected = ['13101', '13102', '14101'];
  const colors = { '13101': 'color1', '13102': 'color1', '14101': 'color2' };
  const result = collapsePrefecture('13', selected, colors, mapping['13']);
  assert.deepEqual(result.selectedAreas, ['14101', '13000']);
  assert.deepEqual(result.areaColors, { '13000': 'color1', '14101': 'color2' });
  assert.deepEqual(selected, ['13101', '13102', '14101']);
});

test('partial selection and missing mapping never collapse', () => {
  assert.deepEqual(collapsePrefecture('13', ['13101'], { '13101': 'color1' }, mapping['13']).selectedAreas, ['13101']);
  assert.deepEqual(collapsePrefecture('13', ['13101'], { '13101': 'color1' }, []).selectedAreas, ['13101']);
});

test('population across multiple prefectures is complete and never double-counts whole prefecture overlap', () => {
  const result = sumSelectedPopulation(['13000', '13101', '14101'], population, { '13000': 'color1', '13101': 'color2', '14101': 'color3' });
  assert.equal(result.total, 350);
  assert.deepEqual(result.colors, { color1: 300, color3: 50 });
});

test('signed sessions reject old constant tokens, tampering, wrong keys and expiry', () => {
  const now = 1700000000000;
  const token = createSessionToken('test-only-signing-key', now);
  assert.equal(verifySessionToken(token, 'test-only-signing-key', now), true);
  assert.equal(verifySessionToken('loggedin', 'test-only-signing-key', now), false);
  assert.equal(verifySessionToken(token, 'other-key', now), false);
  assert.equal(verifySessionToken(token + 'x', 'test-only-signing-key', now), false);
  assert.equal(verifySessionToken(token, 'test-only-signing-key', now + SESSION_SECONDS * 1000), false);
  assert.equal(verifySessionToken(token, 'test-only-signing-key', now - 1000), false);
});

test('bounded parallel fetch preserves order and limits concurrency', async () => {
  let active = 0;
  let peak = 0;
  const results = await mapWithConcurrency([0, 1, 2, 3, 4, 5], 3, async value => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return value * 2;
  });
  assert.equal(peak, 3);
  assert.deepEqual(results, [0, 2, 4, 6, 8, 10]);
});

test('restoring a county view loads all selected prefectures and global totals, including empty maps', async () => {
  const original = globalThis.fetch;
  const requests = [];
  const fixtures = {
    '/api/population/estat?level=pref': { records: [{ code: '00000', value: 1000 }, { code: '13000', value: 300 }, { code: '14000', value: 700 }] },
    '/api/population/estat?level=muni&prefCode=13': { records: [{ code: '13101', value: 100 }] },
    '/api/population/estat?level=muni&prefCode=14': { records: [{ code: '14101', value: 50 }] },
  };
  try {
    globalThis.fetch = async url => {
      requests.push(url);
      assert.ok(fixtures[url], 'unexpected request');
      return { ok: true, json: async () => fixtures[url] };
    };
    const snapshot = await loadPopulationSnapshot(['13101', '14101'], '13');
    assert.equal(snapshot.population['13101'] + snapshot.population['14101'], 150);
    assert.equal(snapshot.population['13000'], 300);
    assert.equal(snapshot.national, 1000);
    assert.deepEqual(snapshot.mapping, { '13': ['13101'], '14': ['14101'] });
    assert.equal(requests.length, 3);
    const empty = await loadPopulationSnapshot();
    assert.equal(empty.population['13000'], 300);
    assert.equal(empty.national, 1000);
    assert.deepEqual(empty.mapping, {});
    assert.equal(requests.length, 3);
  } finally { globalThis.fetch = original; }
});

test('client deduplicates in-flight requests and retries HTTP and application errors', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ records: [] }) }; };
    await Promise.all(Array.from({ length: 20 }, () => fetchPopulationJSON('/test/shared')));
    await fetchPopulationJSON('/test/shared');
    assert.equal(calls, 1);
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ error: 'upstream failed' }) });
    await assert.rejects(fetchPopulationJSON('/test/retry'), /upstream failed/);
    globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ records: [1] }) }; };
    assert.deepEqual((await fetchPopulationJSON('/test/retry')).records, [1]);
    globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
    await assert.rejects(fetchPopulationJSON('/test/auth'), /401/);
  } finally { globalThis.fetch = original; }
});

test('server cache deduplicates e-Stat source requests and rejects failed responses', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      return { ok: true, json: async () => ({ GET_STATS_DATA: { RESULT: { STATUS: 0 }, STATISTICAL_DATA: { DATA_INF: { VALUE: [1] } } } }) };
    };
    await Promise.all(Array.from({ length: 47 }, () => fetchEstat('https://test.invalid/shared-source')));
    assert.equal(calls, 1);
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ GET_STATS_DATA: { RESULT: { STATUS: 100 } } }) });
    await assert.rejects(fetchEstat('https://test.invalid/retry'), /unavailable/);
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ GET_STATS_DATA: { RESULT: { STATUS: 0 }, STATISTICAL_DATA: { DATA_INF: { VALUE: [2] } } } }) });
    assert.ok(await fetchEstat('https://test.invalid/retry'));
  } finally { globalThis.fetch = original; }
});
