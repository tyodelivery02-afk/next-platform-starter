import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCargoIssue,registerCargoIssue,CargoIssueError,cargoIssuesUrl} from '../lib/line-cargo.mjs';
const code='E00013226533';
const response=(tracks)=>({errcode:0,result:{hawbNo:code,trackVos:tracks}});
const track={orderTrackType:8,failReason:'住所不明',remark:'転居',createTime:'2026-10-20T02:31:09.000+0000'};
test('maps provided example and chooses latest type 8 in Japan time',()=>{
  assert.deepEqual(buildCargoIssue(code,response([{...track,createTime:'2026-10-19T01:00:00.000+0000'},track,{...track,orderTrackType:2,createTime:'2026-10-21T00:00:00Z'}])),{projectValue:code,issue:'住所不明',returnStatus:'返品済',issueDetails:'転居',warehouseArrivalDate:'2026-10-20',project:0});
  assert.equal(buildCargoIssue(code,response([{...track,createTime:'2026-10-20T16:00:00Z',remark:null}])).warehouseArrivalDate,'2026-10-21');
});
test('rejects missing track, bad date, missing reason and mismatched order',()=>{
  for(const item of [response([]),response([{...track,createTime:'bad'}]),response([{...track,failReason:null}]),{errcode:0,result:{hawbNo:'E00000000000',trackVos:[track]}}]) assert.throws(()=>buildCargoIssue(code,item));
});
test('creates exactly the mapped payload and marks registered',async()=>{
  const calls=[];
  const result=await registerCargoIssue(code,{claim:async()=>({state:'claimed',token:'a'}),exists:async()=>false,loadOrder:async()=>response([track]),create:async p=>calls.push(p),finish:async(...args)=>calls.push(args)});
  assert.equal(result.alreadyRegistered,false);assert.equal(calls[0].projectValue,code);assert.deepEqual(calls[1],[code,'a','registered']);
});
test('does not create duplicate registrations',async()=>{
  assert.equal((await registerCargoIssue(code,{claim:async()=>({state:'registered'})})).alreadyRegistered,true);
  await assert.rejects(registerCargoIssue(code,{claim:async()=>({state:'processing'})}),e=>e.status===409);
});
test('keeps uncertain external POST failures locked for manual verification',async()=>{
  let state;
  await assert.rejects(registerCargoIssue(code,{claim:async()=>({state:'claimed',token:'a'}),exists:async()=>false,loadOrder:async()=>response([track]),create:async()=>{throw new CargoIssueError('timeout',502,true);},finish:async(_c,_t,s)=>state=s}),e=>e.uncertain===true);
  assert.equal(state,'unknown');
});
test('allows retry after known read or business validation failure',async()=>{
  let state;
  await assert.rejects(registerCargoIssue(code,{claim:async()=>({state:'claimed',token:'a'}),exists:async()=>false,loadOrder:async()=>response([]),finish:async(_c,_t,s)=>state=s}));
  assert.equal(state,'failed');
});

test('filtered link contains all requested search parameters',()=>{
  assert.equal(cargoIssuesUrl('E00013363350'),'https://www.console.espoirer.com/customer-service/cargo-issues?hawbNos=E00013363350&searchDateType=warehouseArrivalDateList&searchTimeType=createTimeList&searchType=hawbNos');
});
test('existing external registration skips order loading and creation',async()=>{
  let state;
  const result=await registerCargoIssue(code,{claim:async()=>({state:'claimed',token:'a'}),exists:async value=>{assert.equal(value,code);return true;},loadOrder:async()=>assert.fail('must skip order query'),create:async()=>assert.fail('must skip create'),finish:async(_c,_t,value)=>state=value});
  assert.equal(result.alreadyRegistered,true);assert.equal(state,'registered');assert.equal(result.redirectUrl,cargoIssuesUrl(code));
});
test('failed existing-record lookup blocks creation and permits safe retry',async()=>{
  let state;
  await assert.rejects(registerCargoIssue(code,{claim:async()=>({state:'claimed',token:'a'}),exists:async()=>{throw new CargoIssueError('lookup failed');},create:async()=>assert.fail('must not create'),finish:async(_c,_t,value)=>state=value}));
  assert.equal(state,'failed');
});
