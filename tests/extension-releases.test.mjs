import test from 'node:test';
import assert from 'node:assert/strict';
import { DRIVE_FOLDER_ID, createExtensionReleaseStore, createDriveReleaseReader, driveReleaseMetadata, compareVersions } from '../lib/extension-releases.mjs';
const file = { id: '1mPTRNIFryKHIzsYTqlk-_yBYVphrAGuh', name: 'caution-bot-2.20.0.zip', size: '8492164', parents: [DRIVE_FOLDER_ID], sha256Checksum: 'a'.repeat(64), capabilities: { canDownload: true } };
function storage() { const values = new Map(); return { values, async get(key) { assert.ok(!key.startsWith('files/') && !key.startsWith('uploads/')); return structuredClone(values.get(key) || null); }, async setJSON(key, value) { assert.ok(JSON.stringify(value).length < 10000); values.set(key, structuredClone(value)); }, async list({ prefix }) { return { blobs: [...values.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })) }; } }; }
test('Drive メタデータだけを保存し、通知は独立している', async () => {
  const store = storage(); let metadata = driveReleaseMetadata(file);
  const service = createExtensionReleaseStore(store, { readDrive: async () => metadata });
  const first = await service.refresh(); assert.equal(first.version, '2.20.0'); assert.equal(first.source, 'google-drive'); assert.ok(first.downloadUrl.startsWith('https://drive.google.com/'));
  assert.equal((await service.latest()).notification, null); assert.equal((await service.refresh()).id, first.id);
  const notification = await service.notify({ message: '更新しました。' });
  metadata = driveReleaseMetadata({ ...file, id: 'different_drive_file_id', name: 'caution-bot-2.20.1.zip' });
  await service.refresh(); assert.equal((await service.latest()).notification.id, notification.id);
  metadata = { ...metadata, sha256: 'b'.repeat(64) }; await assert.rejects(service.refresh(), /同じ版数/);
  metadata = driveReleaseMetadata(file); await assert.rejects(service.refresh(), /古い版/);
});
test('公開フォルダーから数字順に最新版を選び、ZIP 本体を要求しない', async () => {
  const calls = [];
  const reader = createDriveReleaseReader({ apiKey: () => 'test-key', request: async (url, options) => {
    calls.push(new URL(url)); assert.equal(options.redirect, 'error'); assert.equal(calls.at(-1).hostname, 'www.googleapis.com'); assert.equal(calls.at(-1).searchParams.has('alt'), false);
    if (calls.length === 1) return Response.json({ files: [{ id: 'old_123456789', name: 'caution-bot-2.9.9.zip' }, { id: file.id, name: file.name, resourceKey: '0-key' }, { id: 'other', name: 'notes.txt' }] });
    assert.equal(options.headers['X-Goog-Drive-Resource-Keys'], file.id + '/0-key'); return Response.json({ ...file, resourceKey: '0-key' });
  } });
  const release = await reader(); assert.equal(release.version, '2.20.0'); assert.equal(calls.length, 2); assert.ok(release.downloadUrl.includes('resourcekey=0-key'));
});
test('共有権限、所属、版数、チェックサムと設定不足を検証する', async () => {
  assert.throws(() => driveReleaseMetadata({ ...file, parents: ['other'] }), /フォルダー/);
  assert.throws(() => driveReleaseMetadata({ ...file, capabilities: { canDownload: false } }), /ダウンロード/);
  assert.throws(() => driveReleaseMetadata({ ...file, sha256Checksum: undefined }), /SHA-256/);
  assert.throws(() => driveReleaseMetadata({ ...file, name: 'caution-bot-99999.zip' }), /形式/);
  const reader = createDriveReleaseReader({ apiKey: () => '', request: () => { throw new Error('request must not run'); } }); await assert.rejects(reader(), /GOOGLE_DRIVE_API_KEY/);
  const duplicate = createDriveReleaseReader({ apiKey: () => 'test', request: async () => Response.json({ files: [{ ...file }, { ...file, id: 'other_file_1234' }] }) }); await assert.rejects(duplicate(), /複数/);
  const service = createExtensionReleaseStore(storage(), { readDrive: async () => driveReleaseMetadata(file) });
  assert.equal((await service.notify({ message: 'お知らせ' })).version, null); await assert.rejects(service.notify({ message: ' ' }));
  assert.ok(compareVersions('2.20', '2.9') > 0);
});
