import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { extractCodes, verifyLineSignature, isGroupImage, processImageEvent } from '../lib/line-ocr.mjs';

test('validates original LINE body signature', () => {
  const body = '{"events":[],"text":"あ\\n"}';
  const signature = createHmac('sha256', 'secret').update(body).digest('base64');
  assert.equal(verifyLineSignature(body, signature, 'secret'), true);
  assert.equal(verifyLineSignature(body+' ', signature, 'secret'), false);
  assert.equal(verifyLineSignature(body, null, 'secret'), false);
  assert.equal(verifyLineSignature(body, signature, 'other'), false);
});
test('extracts only E plus eleven characters and deduplicates', () => {
  assert.deepEqual(extractCodes(['E20055855101', 'e20055855101', 'Ｅ２００５５８５５１０１', 'E1234567890A', 'E123', 'E200558551011', 'xE20055855101', null]), ['E20055855101', 'E1234567890A']);
  assert.throws(() => extractCodes('not an array'));
});
const event = { type: 'message', source: { type: 'group' }, webhookEventId: 'event1', message: { id: '123', type: 'image' } };
test('accepts only group/room image events', () => {
  assert.equal(isGroupImage(event), true);
  assert.equal(isGroupImage({...event, source:{type:'user'}}), false);
  assert.equal(isGroupImage({...event, message:{id:'123',type:'text'}}), false);
  assert.equal(isGroupImage({...event, message:{id:'../unsafe',type:'image'}}), false);
});
test('processes text only and skips completed redeliveries', async () => {
  let complete = false; let ocr = 0; let saved;
  const deps = {claim:async()=>complete?null:'lease', recognize:async()=>{ocr++;return ['E20055855101','E20055855101'];}, complete:async(id,token,codes)=>{complete=true;saved={id,token,codes};},release:async()=>assert.fail('unexpected release')};
  await processImageEvent(event,deps); await processImageEvent(event,deps);
  assert.equal(ocr,1);assert.deepEqual(saved,{id:'event1',token:'lease',codes:['E20055855101']});
});
test('releases failures for redelivery and marks zero-match events complete', async () => {
  let released=0;
  await assert.rejects(processImageEvent(event,{claim:async()=> 'lease',recognize:async()=>{throw Error('OCR unavailable');},release:async()=>released++}));
  assert.equal(released,1);
  let codes;
  await processImageEvent(event,{claim:async()=> 'lease',recognize:async()=>[],complete:async(_id,_token,value)=>codes=value});
  assert.deepEqual(codes,[]);
});
