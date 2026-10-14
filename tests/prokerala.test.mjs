import assert from 'node:assert/strict';
import test from 'node:test';
import { createAsyncCache, normalizeHoroscope } from '../lib/prokerala-model.mjs';

const date = '2026-10-14';
const fixture = () => ({ status: 'ok', data: { datetime: `${date}T12:00:00+09:00`, daily_predictions: [{ sign: { name: 'Aries' }, predictions: ['General', 'Love', 'Career', 'Health'].map(type => ({ type, prediction: `${type} provider&#039;s text` })) }] } });

test('maps all four provider predictions without fabricated fields', () => {
  const data = normalizeHoroscope(fixture(), 'aries', date);
  assert.equal(data.source, 'Prokerala');
  assert.equal(data.fortune.work, "Career provider's text");
  assert.deepEqual(Object.keys(data.fortune).sort(), ['health', 'love', 'overall', 'work']);
  for (const key of ['overallRating', 'luckyColor', 'luckyNumber', 'advice']) assert.equal(key in data, false);
});

test('rejects missing categories, wrong sign and wrong date', () => {
  const data = fixture(); data.data.daily_predictions[0].predictions.pop();
  assert.throws(() => normalizeHoroscope(data, 'aries', date));
  assert.throws(() => normalizeHoroscope(fixture(), 'taurus', date));
  assert.throws(() => normalizeHoroscope(fixture(), 'aries', '2026-10-15'));
});

test('coalesces concurrent requests and reuses successes', async () => {
  const cache = createAsyncCache(); let calls = 0;
  const load = async () => { calls++; return 42; };
  assert.deepEqual(await Promise.all([cache.get('key', load), cache.get('key', load)]), [42, 42]);
  assert.equal(await cache.get('key', load), 42);
  assert.equal(calls, 1);
});

test('does not cache failures; expired entries reload', async () => {
  const cache = createAsyncCache();
  await assert.rejects(cache.get('fail', () => { throw Error('upstream'); }));
  assert.equal(await cache.get('fail', () => 1), 1);
  await cache.get('expired', () => 1, -1);
  assert.equal(await cache.get('expired', () => 2), 2);
});

test('direct request flow shares tokens and results, and surfaces provider failures', async () => {
  const originalFetch = globalThis.fetch;
  const originalId = process.env.PROKERALA_CLIENT_ID;
  const originalSecret = process.env.PROKERALA_CLIENT_SECRET;
  process.env.PROKERALA_CLIENT_ID = 'test-client';
  process.env.PROKERALA_CLIENT_SECRET = 'test-secret';
  const calls = [];
  let failed = false;
  globalThis.fetch = async (url, options) => {
    calls.push(String(url));
    assert.ok(options.signal);
    if (String(url).endsWith('/token')) return Response.json({ access_token: 'test-token', expires_in: 3600 });
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    const target = new URL(url);
    assert.equal(target.pathname, '/v2/horoscope/daily/advanced');
    assert.equal(target.searchParams.get('type'), 'all');
    assert.equal(target.searchParams.get('datetime'), `${date}T12:00:00+09:00`);
    if (target.searchParams.get('sign') === 'gemini') return Response.json({ errors: [{ title: 'Client Error', detail: 'Your account does not have sufficient credit balance to execute this request.' }] }, { status: 403 });
    if (target.searchParams.get('sign') === 'taurus' && !failed) { failed = true; return Response.json({}, { status: 429 }); }
    const data = fixture();
    data.data.daily_predictions[0].sign.name = target.searchParams.get('sign') === 'taurus' ? 'Taurus' : 'Aries';
    return Response.json(data);
  };
  try {
    const { getDailyHoroscope } = await import('../lib/prokerala-server.js');
    await Promise.all([getDailyHoroscope('aries', date), getDailyHoroscope('aries', date)]);
    await getDailyHoroscope('aries', date);
    assert.equal(calls.length, 2);
    await assert.rejects(getDailyHoroscope('taurus', date), error => error.status === 429);
    await getDailyHoroscope('taurus', date);
    assert.equal(calls.filter(url => url.endsWith('/token')).length, 1);
    assert.equal(calls.length, 4);
    await assert.rejects(getDailyHoroscope('gemini', date), error => error.status === 402 && error.message.includes('残高'));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalId === undefined) delete process.env.PROKERALA_CLIENT_ID; else process.env.PROKERALA_CLIENT_ID = originalId;
    if (originalSecret === undefined) delete process.env.PROKERALA_CLIENT_SECRET; else process.env.PROKERALA_CLIENT_SECRET = originalSecret;
  }
});
