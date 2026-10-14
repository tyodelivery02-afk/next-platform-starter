import test from 'node:test';
import assert from 'node:assert/strict';
import {requestCharacter} from '../lib/character-request.mjs';
test('uses primary and falls back on provider overload',async()=>{
  const calls=[];
  const result=await requestCharacter(async p=>{calls.push(p.model);if(calls.length===1)throw Object.assign(Error('busy'),{status:503});return {text:'ok'};},{contents:'test'},100);
  assert.equal(result.text,'ok');
  assert.deepEqual(calls,['gemini-3.5-flash-lite','gemini-2.5-flash']);
});
test('hard deadline switches a stalled primary to fallback',async()=>{
  let calls=0;
  const result=await requestCharacter(async()=>++calls===1?new Promise(()=>{}):{text:'ok'},{},20);
  assert.equal(result.text,'ok');assert.equal(calls,2);
});
test('does not retry authentication errors',async()=>{
  let calls=0;
  await assert.rejects(requestCharacter(async()=>{calls++;throw Object.assign(Error('key'),{status:401});},{},100));
  assert.equal(calls,1);
});
