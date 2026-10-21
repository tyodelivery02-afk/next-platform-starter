'use client';
import { useEffect, useState } from 'react';

const api = '/api/extensions/caution-bot';
const card = 'backdrop-blur-md bg-white/10 border border-sky-300 shadow-md rounded-xl p-8 w-full max-w-7xl transition-all duration-500 hover:shadow-yellow-200 hover:scale-101';
async function result(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '処理に失敗しました。'); return data;
}
export default function ExtensionUpdatesPage() {
  const [message, setMessage] = useState('');
  const [data, setData] = useState({}), [checking, setChecking] = useState(false), [sending, setSending] = useState(false);
  const [checkStatus, setCheckStatus] = useState(''), [noticeStatus, setNoticeStatus] = useState('');
  const refresh = () => fetch(`${api}/latest`, { cache: 'no-store' }).then(result).then(setData);
  useEffect(() => { refresh().catch(error => setCheckStatus(error.message)); }, []);
  const post = body => fetch(`${api}/admin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(result);
  async function registerLatest(event) {
    event.preventDefault(); if (checking) return;
    setChecking(true); setCheckStatus('');
    try {
      setCheckStatus('確認中…'); const release = await post({ action: 'refresh' });
      setData(previous => ({ ...previous, release }));
      setCheckStatus('最新版を登録しました。');
    } catch (error) { setCheckStatus(error.message); } finally { setChecking(false); }
  }
  async function notify(event) {
    event.preventDefault(); if (sending) return; setSending(true); setNoticeStatus('');
    try { await post({ action: 'notify', message }); await refresh(); setMessage(''); setNoticeStatus('送信しました。'); }
    catch (error) { setNoticeStatus(error.message); } finally { setSending(false); }
  }
  return <main className="bg-style">
    <h2 className="relative text-x2 font-bold text-black text-shadow mb-6">プラグイン更新</h2>
    <div className="w-full max-w-3xl space-y-6 text-black">
      <form onSubmit={registerLatest} className={card}>
        <h3 className="text-lg font-bold mb-4">Google Drive</h3>
        <a className="inline-block mb-4 text-sky-700" href="https://drive.google.com/drive/folders/1niAGjrFlmJjPZMphQfvZ8U2bZorgRymR" target="_blank" rel="noreferrer">保存先を開く</a>
        <div className="flex items-center justify-between gap-4"><span>{data.release ? `v${data.release.version}` : '未登録'}</span><button type="submit" className="save-button disabled:opacity-50" disabled={checking || sending}>{checking ? '確認中…' : '最新版を確認'}</button></div>
        {data.release?.source === 'google-drive' && <a className="inline-block mt-3 text-sky-700" href={data.release.downloadUrl}>ZIP をダウンロード</a>}
        <p role="status" className="mt-3 text-sm">{checkStatus}</p>
      </form>
      <form onSubmit={notify} className={card}>
        <h3 className="text-lg font-bold mb-4">更新通知</h3>
        <textarea value={message} onChange={event => setMessage(event.target.value)} aria-label="更新内容" maxLength={3000} rows={5} className="textarea-item w-full p-3 mb-4" />
        <div className="flex justify-end"><button type="submit" className="send-button disabled:opacity-50" disabled={!message.trim() || sending || checking}>{sending ? '送信中…' : '送信'}</button></div>
        <p role="status" className="mt-3 text-sm">{noticeStatus}</p>
        {data.notification && <p className="mt-3 text-sm whitespace-pre-wrap break-words">{data.notification.message}</p>}
      </form>
    </div>
  </main>;
}
