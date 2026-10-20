"use client";
import { useEffect, useRef, useState } from 'react';

export default function LineImagesPage() {
  const [data, setData] = useState({ items: [], total: 0, pageSize: 50 });
  const [page, setPage] = useState(1);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const controllerRef = useRef(null);

  useEffect(() => {
    let active = true;
    let running = false;
    const load = async () => {
      if (running || document.hidden) return;
      running = true;
      const controller = new AbortController();
      controllerRef.current = controller;
      const timeout = setTimeout(() => controller.abort(), 12000);
      setLoading(true);
      try {
        const res = await fetch(`/api/line/results?${new URLSearchParams({ page: String(page), search })}`, { cache: 'no-store', signal: controller.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '読み込みに失敗しました');
        if (active) { setData(json); setError(''); setUpdated(new Date()); }
      } catch (e) {
        if (active) setError(e.name === 'AbortError' ? '読み込みがタイムアウトしました' : e.message);
      } finally {
        clearTimeout(timeout);
        running = false;
        if (active) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 5000);
    const onVisibility = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { active = false; clearInterval(interval); controllerRef.current?.abort(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [page, search, refresh]);

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <main className="bg-style text-black">
      <div className="mb-6 pr-16"><h1 className="text-2xl font-bold">LINE画像認識</h1><p className="text-sm mt-2">グループトークの画像から認識した番号。画像は保存しません。</p></div>
      <div className="table-div mb-4">
        <form className="flex flex-wrap items-center gap-3" onSubmit={e => { e.preventDefault(); setPage(1); setSearch(input.trim()); }}>
          <input className="input-item" value={input} onChange={e => setInput(e.target.value)} maxLength={12} placeholder="Eから始まる番号" aria-label="番号を検索" />
          <button type="submit" className="select-button">検索</button>
          <button type="button" className="clear-button" onClick={() => { setInput(''); setSearch(''); setPage(1); }}>クリア</button>
          <button type="button" className="orther-button" disabled={loading} onClick={() => setRefresh(value => value + 1)}>更新</button>
        </form>
        <div className="flex flex-wrap gap-4 text-sm mt-3" role="status"><span>{data.total} 件</span><span>5秒ごとに自動更新</span>{updated && <span>最終更新：{updated.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo' })}</span>}</div>
        {error && <p role="alert" className="text-red-600 mt-3">{error}</p>}
      </div>
      <div className="table-div overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead><tr><th className="table-title px-4 py-3 text-left">番号</th><th className="table-title px-4 py-3 text-left">受信日時（日本時間）</th></tr></thead>
          <tbody>{data.items.map(item => <tr key={item.id}><td className="table-style1 px-4 py-3 font-mono">{item.code}</td><td className="table-style1 px-4 py-3">{new Date(item.received_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</td></tr>)}</tbody>
        </table>
        {!data.items.length && <p className="text-center py-8">{loading ? '読み込み中…' : error ? '認識結果を表示できません' : '認識結果はまだありません'}</p>}
      </div>
      <div className="flex items-center justify-center gap-4 mt-4">
        <button type="button" className="clear-button" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>前へ</button>
        <span>{page} / {pages}</span>
        <button type="button" className="select-button" disabled={page >= pages || loading} onClick={() => setPage(value => value + 1)}>次へ</button>
      </div>
    </main>
  );
}
