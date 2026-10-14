import assert from 'node:assert/strict';
import test from 'node:test';
import { createJapaneseTranslator } from '../lib/prokerala-translation.mjs';
const source = { fortune: { overall: 'General text', love: 'Love text', work: 'Career text', health: 'Health text' } };
const japanese = { overall: '全体の運勢です。', love: '恋愛の運勢です。', work: '仕事の運勢です。', health: '健康の運勢です。' };

test('translates all categories in one call and caches concurrent requests', async () => {
  let calls = 0;
  const translate = createJapaneseTranslator(async params => {
    calls++;
    assert.equal(params.model, 'gemini-3.1-flash-lite');
    assert.deepEqual(JSON.parse(params.contents), source.fortune);
    assert.equal(params.config.responseMimeType, 'application/json');
    assert.equal(params.config.httpOptions.timeout, 12000);
    return { text: JSON.stringify(japanese) };
  });
  const [a,b] = await Promise.all([translate(source), translate(source)]);
  assert.deepEqual(a,japanese); assert.deepEqual(b,japanese);
  await translate(source);
  assert.equal(calls,1);
});

test('retries temporary model overload once and reports persistent overload', async () => {
  let calls = 0;
  const unavailable = () => Object.assign(new Error('Unavailable'), { status: 503 });
  const translate = createJapaneseTranslator(async () => {
    if (++calls === 1) throw unavailable();
    return { text: JSON.stringify(japanese) };
  });
  assert.deepEqual(await translate(source), japanese);
  assert.equal(calls, 2);
  const failing = createJapaneseTranslator(async () => { throw unavailable(); });
  await assert.rejects(failing(source), error => error.status === 503 && error.message.includes('混み合'));
});

test('rejects untranslated or incomplete output and allows retry', async () => {
  let calls = 0;
  const translate = createJapaneseTranslator(async () => ({text: JSON.stringify(++calls === 1 ? source.fortune : japanese)}));
  await assert.rejects(translate(source));
  assert.deepEqual(await translate(source),japanese);
  assert.equal(calls,2);
  await assert.rejects(createJapaneseTranslator(async () => ({text:'{}'}))(source));
});
