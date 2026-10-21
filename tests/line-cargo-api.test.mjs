import test from 'node:test';
import assert from 'node:assert/strict';
import {loadEspoirerOrder,createEspoirerIssue,espoirerIssueExists} from '../lib/line-cargo-api.js';

test('uses server credentials and correct API paths and payload', async()=>{
  const original=globalThis.fetch;const token=process.env.ESPOIRER_ACCESS_TOKEN;
  process.env.ESPOIRER_ACCESS_TOKEN='test-token';
  const calls=[];
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json({errcode:0,result:{}});};
  try {
    await loadEspoirerOrder('E00013226533');
    const payload={projectValue:'E00013226533',issue:'住所不明',returnStatus:'返品済',issueDetails:'転居',warehouseArrivalDate:'2026-10-20',project:0};
    await createEspoirerIssue(payload);
    assert.equal(calls[0].url,'https://www.console.espoirer.com/prod/api/administrator/order/detail?hawbNo=E00013226533');
    assert.equal(calls[1].url,'https://www.console.espoirer.com/prod/goods/api/cargoIssues/create');
    assert.equal(calls[1].options.method,'POST');assert.deepEqual(JSON.parse(calls[1].options.body),payload);
    assert.equal(calls[1].options.headers.Authorization,'Bearer test-token');
    assert.equal(calls[1].options.headers.Cookie,'ESP_SYSTEM_TOKEN=Bearer%20test-token');
    assert.equal(calls[1].options.redirect,'error');
    globalThis.fetch=async(url,options)=>{
      assert.equal(url,'https://www.console.espoirer.com/prod/goods/api/cargoIssues/list');
      const body=JSON.parse(options.body).data;
      assert.deepEqual(body.hawbNos,['E00013363350']);assert.equal(body.searchType,'hawbNos');
      assert.equal(body.warehouseArrivalStartDate,null);assert.equal(body.pageSize,50);
      return Response.json({errcode:0,result:{totalNum:2,list:[{hawbNo:'E00013363350'},{hawbNo:'E00013363350'}]}});
    };
    assert.equal(await espoirerIssueExists('E00013363350'),true);
    globalThis.fetch=async()=>Response.json({errcode:0,result:{totalNum:0,list:[]}});
    assert.equal(await espoirerIssueExists('E00013363350'),false);
    globalThis.fetch=async()=>Response.json({errcode:0,result:{totalNum:1,list:[{hawbNo:'E00000000000'}]}});
    await assert.rejects(espoirerIssueExists('E00013363350'));
    globalThis.fetch=async()=>Response.json({errcode:0,result:{}});
    await assert.rejects(espoirerIssueExists('E00013363350'));
    globalThis.fetch=async()=>Response.json({}, {status:503});
    await assert.rejects(createEspoirerIssue(payload),e=>e.uncertain===true);
    globalThis.fetch=async()=>Response.json({}, {status:401});
    await assert.rejects(createEspoirerIssue(payload),e=>e.status===401 && !e.uncertain);
    globalThis.fetch=async()=>Response.json({errcode:1});
    await assert.rejects(createEspoirerIssue(payload),e=>e.status===422 && !e.uncertain);
  } finally {globalThis.fetch=original;if(token===undefined)delete process.env.ESPOIRER_ACCESS_TOKEN;else process.env.ESPOIRER_ACCESS_TOKEN=token;}
});
