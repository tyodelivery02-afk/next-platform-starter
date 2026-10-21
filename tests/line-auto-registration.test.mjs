import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutoRegistrationQueue} from '../lib/line-auto-registration.mjs';
const first='E00013226533',second='E00013363350';

test('serializes submissions and deduplicates numbers across polls and images',async()=>{
  let active=0;let max=0;const calls=[];
  const queue=createAutoRegistrationQueue(async code=>{active++;max=Math.max(max,active);calls.push(code);await Promise.resolve();active--;},()=>true);
  await queue.add([{code:first},{code:first},{code:second}]);
  await queue.add([{code:first},{code:second}]);
  assert.deepEqual(calls,[first,second]);assert.equal(max,1);
});
test('skips registered, processing, uncertain and invalid entries',async()=>{
  const calls=[];const queue=createAutoRegistrationQueue(async code=>calls.push(code),()=>true);
  await queue.add([{code:first,registration_state:'registered'},{code:second,registration_state:'unknown'},{code:'E00000000001',registration_state:'processing'},{code:'bad'}]);
  assert.deepEqual(calls,[]);
});
test('OFF does not start new jobs; an existing job can finish',async()=>{
  let on=true;let release;const calls=[];
  const queue=createAutoRegistrationQueue(async code=>{calls.push(code);await new Promise(resolve=>release=resolve);},()=>on);
  const task=queue.add([{code:first},{code:second}]);
  on=false;release();await task;assert.deepEqual(calls,[first]);
  queue.stop();on=true;await queue.add([{code:second}]);assert.deepEqual(calls,[first]);
});
test('failed submissions are not repeated indefinitely',async()=>{
  let calls=0;const queue=createAutoRegistrationQueue(async()=>{calls++;throw Error('failed');},()=>true);
  await queue.add([{code:first}]);await queue.add([{code:first}]);assert.equal(calls,1);
});
test('a busy manual registration can be checked again on the next poll',async()=>{
  let calls=0;const queue=createAutoRegistrationQueue(async()=>{calls++;return calls===1?false:undefined;},()=>true);
  await queue.add([{code:first}]);await queue.add([{code:first}]);assert.equal(calls,2);
});
