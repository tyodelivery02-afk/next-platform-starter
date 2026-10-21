import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as model from '../lib/extension-releases.mjs';
import * as tokens from '../lib/session-token.mjs';

test('実際の API ルートで認証、Drive メタデータ、通知、旧配信の停止を確認する', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), values = new Map();
  const storage = {
    async get(key, options) { assert.ok(!key.startsWith('files/') && !key.startsWith('uploads/')); const data = values.get(key); return data == null ? null : options?.type === 'json' ? structuredClone(data) : Buffer.from(data); },
    async set(key, value) { values.set(key, Buffer.from(value)); }, async setJSON(key, value) { values.set(key, structuredClone(value)); },
    async list({ prefix }) { return { blobs: [...values.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })) }; },
  };
  const context = vm.createContext({ Response, Request, Headers, ReadableStream, Buffer, console, URL, Date });
  const modules = new Map();
  function synthetic(name, exports) {
    const module = new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }, { context, identifier: name });
    modules.set(name, module); return module;
  }
  synthetic('next/server', { NextResponse: { json: (data, init) => Response.json(data, init) } });
  synthetic('@netlify/blobs', { getStore: options => { assert.equal(options.name, 'caution-bot-releases'); assert.equal(options.consistency, 'strong'); return storage; } });
  synthetic('@netlify/neon', { neon: () => async () => [{ value: 'test-password-hash' }] });
  synthetic(path.join(root, 'lib/extension-releases.mjs'), model);
  synthetic(path.join(root, 'lib/session-token.mjs'), tokens);
  async function load(name) {
    if (modules.has(name)) return modules.get(name);
    const module = new vm.SourceTextModule(await fs.readFile(name, 'utf8'), { context, identifier: name }); modules.set(name, module);
    await module.link(async (specifier, parent) => {
      if (!specifier.startsWith('.')) return modules.get(specifier);
      const base = path.resolve(path.dirname(parent.identifier), specifier);
      for (const suffix of ['', '.js', '.mjs']) { try { await fs.access(base + suffix); return load(base + suffix); } catch {} }
      throw new Error('Module not found: ' + base);
    }); return module;
  }
  async function route(relative) { const module = await load(path.join(root, 'app/api/extensions/caution-bot', relative, 'route.js')); if (module.status !== 'evaluated') await module.evaluate(); return module.namespace; }
  function request(method, body, { auth = true, origin = 'https://deliverylove.netlify.app', binary = false } = {}) {
    const req = new Request('https://deliverylove.netlify.app/api/extensions/caution-bot/admin', { method, headers: { origin, 'Content-Type': binary ? 'application/octet-stream' : 'application/json' }, body: body == null ? undefined : binary ? body : JSON.stringify(body) });
    req.cookies = { get: name => auth && name === tokens.SESSION_COOKIE ? { value: tokens.createSessionToken('test-password-hash') } : undefined }; return req;
  }

  const previousFetch=globalThis.fetch,previousKey=process.env.GOOGLE_DRIVE_API_KEY,calls=[];
  process.env.GOOGLE_DRIVE_API_KEY='test-only-api-key';
  const file={id:'1mPTRNIFryKHIzsYTqlk-_yBYVphrAGuh',name:'caution-bot-2.20.0.zip',size:'8492164',sha256Checksum:'a'.repeat(64),parents:[model.DRIVE_FOLDER_ID],capabilities:{canDownload:true}};
  globalThis.fetch=async url=>{const u=new URL(url);calls.push(u);assert.equal(u.hostname,'www.googleapis.com');assert.equal(u.searchParams.has('alt'),false);return Response.json(u.pathname.endsWith('/files')?{files:[{id:file.id,name:file.name}]}:file);};
  try {
    const admin=await route('admin'),latest=await route('latest');
    assert.equal((await admin.POST(request('POST',{action:'refresh'},{auth:false}))).status,401);
    assert.equal((await admin.POST(request('POST',{action:'refresh'},{origin:'https://other.example'}))).status,403);
    assert.equal(values.size,0);assert.equal(calls.length,0);
    assert.equal((await admin.POST(request('POST',{action:'notify',message:'お知らせ'}))).status,200);
    values.set('files/old-binary',Buffer.from('old zip content'));
    const registered=await admin.POST(request('POST',{action:'refresh'}));assert.equal(registered.status,200);assert.equal(calls.length,2);
    const release=await registered.json();assert.equal(release.source,'google-drive');assert.equal(release.version,'2.20.0');assert.ok(release.downloadUrl.startsWith('https://drive.google.com/'));
    const before=await(await latest.GET()).json();assert.equal(before.notification.version,null);
    assert.equal((await admin.POST(request('POST',{action:'notify',message:'新版です。'}))).status,200);
    const response=await latest.GET();assert.equal(response.headers.get('Cache-Control'),'no-store');const data=await response.json();
    assert.equal(data.notification.version,'2.20.0');assert.equal(calls.length,2);assert.ok(!JSON.stringify(data).includes('test-only-api-key'));
    assert.equal((await admin.POST(request('POST',{action:'begin',size:20,fileName:'old.zip'}))).status,400);
    const download=await route('files/[id]');const downloadResponse=await download.GET();assert.equal(downloadResponse.status,410);assert.ok(downloadResponse.headers.get('Content-Type').includes('application/json'));
    const part=await route('files/[id]/parts/[index]');assert.equal((await part.GET()).status,410);
    const upload=await route('uploads/[id]/[index]');assert.equal((await upload.PUT()).status,410);
    assert.equal(calls.length,2);
  } finally {globalThis.fetch=previousFetch;if(previousKey===undefined)delete process.env.GOOGLE_DRIVE_API_KEY;else process.env.GOOGLE_DRIVE_API_KEY=previousKey;}
});
