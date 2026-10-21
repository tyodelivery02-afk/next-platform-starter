import { randomUUID } from 'node:crypto';

export const DRIVE_FOLDER_ID = '1niAGjrFlmJjPZMphQfvZ8U2bZorgRymR';
export const DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}`;
export const MAX_ZIP_SIZE = 16 * 1024 * 1024;
const VERSION_PATTERN = /^(0|[1-9]\d{0,4})(\.(0|[1-9]\d{0,4})){0,3}$/;
export function compareVersions(a, b) {
  const left = a.split('.').map(Number), right = b.split('.').map(Number);
  for (let i = 0; i < 4; i++) if ((left[i] || 0) !== (right[i] || 0)) return (left[i] || 0) - (right[i] || 0);
  return 0;
}
function assert(condition, message) { if (!condition) throw Object.assign(new Error(message), { status: 400 }); }
export function driveDownloadUrl(fileId, resourceKey) {
  const url = new URL('https://drive.google.com/uc');
  url.searchParams.set('export', 'download'); url.searchParams.set('id', fileId);
  if (resourceKey) url.searchParams.set('resourcekey', resourceKey);
  return url.href;
}
export function driveReleaseMetadata(file) {
  assert(typeof file.id === 'string' && /^[A-Za-z0-9_-]{10,200}$/.test(file.id), 'Drive のファイル ID が不正です。');
  const match = /^caution-bot-(.+)\.zip$/i.exec(file.name || ''), version = match?.[1];
  assert(version && VERSION_PATTERN.test(version) && version.split('.').every(n => Number(n) <= 65535) && /[1-9]/.test(version), 'ZIP 名を caution-bot-2.20.1.zip の形式にしてください。');
  assert(!file.trashed && file.parents?.includes(DRIVE_FOLDER_ID), '指定フォルダー内の ZIP を選択してください。');
  assert(file.capabilities?.canDownload !== false, 'Drive のダウンロードを許可してください。');
  const size = Number(file.size);
  assert(Number.isInteger(size) && size > 0 && size <= MAX_ZIP_SIZE, 'ZIP は16MB以内にしてください。');
  assert(typeof file.sha256Checksum === 'string' && /^[a-fA-F0-9]{64}$/.test(file.sha256Checksum), 'Drive の SHA-256 を取得できません。しばらく待って確認し直してください。');
  assert(!file.resourceKey || /^[A-Za-z0-9_-]{1,200}$/.test(file.resourceKey), 'Drive のリソースキーが不正です。');
  return { source: 'google-drive', driveFileId: file.id, driveFolderId: DRIVE_FOLDER_ID, resourceKey: file.resourceKey || null,
    fileName: file.name, version, size, sha256: file.sha256Checksum.toLowerCase(), downloadUrl: driveDownloadUrl(file.id, file.resourceKey), modifiedAt: file.modifiedTime || null };
}
export function createDriveReleaseReader({ request = fetch, apiKey = () => process.env.GOOGLE_DRIVE_API_KEY } = {}) {
  async function metadata(path, params, resource) {
    const key = apiKey(); if (!key) throw Object.assign(new Error('Netlify に GOOGLE_DRIVE_API_KEY を設定してください。'), { status: 400 });
    const url = new URL(`https://www.googleapis.com/drive/v3/${path}`);
    for (const [name, value] of Object.entries({ ...params, key })) if (value) url.searchParams.set(name, value);
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 9000);
    try {
      const headers = { Accept: 'application/json' };
      if (resource?.resourceKey) headers['X-Goog-Drive-Resource-Keys'] = `${resource.id}/${resource.resourceKey}`;
      const response = await request(url.href, { headers, redirect: 'error', cache: 'no-store', signal: controller.signal });
      assert(response.ok, response.status === 403 ? 'Drive API の設定と共有権限を確認してください。' : 'Drive のファイル情報を取得できません。');
      return await response.json();
    } catch (error) { throw Object.assign(new Error(error.status ? error.message : 'Drive の確認に失敗しました。時間をおいて再試行してください。'), { status: 400 }); }
    finally { clearTimeout(timer); }
  }
  return async () => {
    const files = []; let pageToken;
    do {
      const page = await metadata('files', { q: `'${DRIVE_FOLDER_ID}' in parents and trashed = false`, pageSize: '1000', fields: 'nextPageToken,files(id,name,resourceKey)', pageToken });
      assert(Array.isArray(page.files), 'Drive の応答が不正です。'); files.push(...page.files); pageToken = page.nextPageToken;
      assert(files.length <= 10000, 'フォルダー内のファイルが多すぎます。');
    } while (pageToken);
    const candidates = files.map(file => ({ ...file, version: /^caution-bot-(.+)\.zip$/i.exec(file.name || '')?.[1] }))
      .filter(file => file.version && VERSION_PATTERN.test(file.version) && file.version.split('.').every(n => Number(n) <= 65535) && /[1-9]/.test(file.version));
    assert(candidates.length, '指定フォルダーに caution-bot-版数.zip が見つかりません。');
    candidates.sort((a, b) => compareVersions(b.version, a.version));
    assert(!candidates[1] || compareVersions(candidates[0].version, candidates[1].version) !== 0, '同じ版数の ZIP が複数あります。一つだけ残してください。');
    assert(/^[A-Za-z0-9_-]{10,200}$/.test(candidates[0].id), 'Drive のファイル ID が不正です。');
    const selected = candidates[0];
    const details = await metadata(`files/${selected.id}`, { fields: 'id,name,mimeType,size,sha256Checksum,parents,trashed,resourceKey,modifiedTime,capabilities(canDownload)' }, selected);
    assert(details.id === selected.id, 'Drive のファイル情報が一致しません。');
    // parents が省略された場合は、フォルダー指定の一覧取得で確認した所属を使う。
    return driveReleaseMetadata({ ...details, parents: details.parents === undefined ? [DRIVE_FOLDER_ID] : details.parents });
  };
}
export function createExtensionReleaseStore(store, { now = () => new Date(), uuid = randomUUID, readDrive = createDriveReleaseReader() } = {}) {
  const json = key => store.get(key, { type: 'json' });
  async function latest() {
    const [entries, notification] = await Promise.all([store.list({ prefix: 'drive-releases/' }), json('notification')]);
    const releases = (await Promise.all(entries.blobs.map(blob => json(blob.key)))).filter(Boolean);
    releases.sort((a, b) => compareVersions(b.version, a.version) || b.createdAt.localeCompare(a.createdAt));
    return { release: releases[0] || null, notification: notification || null, folderUrl: DRIVE_FOLDER_URL };
  }
  return {
    latest,
    async refresh() {
      const metadata = await readDrive(), current = (await latest()).release;
      if (current) {
        const comparison = compareVersions(metadata.version, current.version);
        assert(comparison >= 0, '登録済みより古い版です。');
        if (comparison === 0) {
          assert(metadata.driveFileId === current.driveFileId && metadata.sha256 === current.sha256 && metadata.size === current.size, '同じ版数のファイルが変更されています。版数を上げて公開してください。');
          return current;
        }
      }
      const release = { id: uuid(), ...metadata, createdAt: now().toISOString() };
      await store.setJSON(`drive-releases/${release.id}`, release); return release;
    },
    async notify({ message }) {
      assert(typeof message === 'string' && message.trim().length > 0 && message.trim().length <= 3000, '通知内容を入力してください（3000文字以内）。');
      const release = (await latest()).release;
      const notification = { id: uuid(), message: message.trim(), version: release?.version || null, releaseId: release?.id || null, createdAt: now().toISOString() };
      await store.setJSON('notification', notification); return notification;
    },
  };
}
