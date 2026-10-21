"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { cargoIssuesUrl } from '../../lib/line-cargo.mjs';
import { createAutoRegistrationQueue } from '../../lib/line-auto-registration.mjs';

export default function LineImagesPage() {
  const [data, setData] = useState({ items: [], total: 0, pageSize: 50 });
  const [page, setPage] = useState(1);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [searchApplied, setSearchApplied] = useState(false);
  const [statusSort, setStatusSort] = useState('default');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [registrations, setRegistrations] = useState({});
  const [autoSince, setAutoSince] = useState(null);
  const [autoSwitching, setAutoSwitching] = useState(false);
  const [autoError, setAutoError] = useState('');
  const [autoRegistrationError, setAutoRegistrationError] = useState('');
  const [pollSeconds, setPollSeconds] = useState(5);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [pollInput, setPollInput] = useState('5');
  const pollInputRef = useRef(null);
  const autoPollRef = useRef(null);
  const autoEnabledRef = useRef(false);
  const registrationRequests = useRef(new Set());
  const controllerRef = useRef(null);
  const pageLoadRef = useRef(null);

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
        const res = await fetch(`/api/line/results?${new URLSearchParams({ page: String(page), search, statusSort })}`, { cache: 'no-store', signal: controller.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '読み込みに失敗しました');
        if (active) { setData(json); setError(''); }
      } catch (e) {
        if (active) setError(e.name === 'AbortError' ? '読み込みがタイムアウトしました' : e.message);
      } finally {
        clearTimeout(timeout);
        running = false;
        if (active) setLoading(false);
      }
    };
    pageLoadRef.current = load;
    load();
    return () => { active = false; controllerRef.current?.abort(); pageLoadRef.current = null; };
  }, [page, search, refresh, statusSort]);

  useEffect(() => {
    if (!autoRefresh) return;
    pageLoadRef.current?.();
    const interval = setInterval(() => pageLoadRef.current?.(), pollSeconds * 1000);
    const onVisibility = () => { if (!document.hidden) pageLoadRef.current?.(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisibility); };
  }, [autoRefresh, pollSeconds]);

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const register = useCallback(async (code, { automatic = false } = {}) => {
    if (registrationRequests.current.has(code)) return false;
    registrationRequests.current.add(code);
    const orderUrl = `https://www.console.espoirer.com/delivery/orders/${encodeURIComponent(code)}`;
    let popup = null;
    if (!automatic) {
      try {
        popup = window.open('about:blank', '_blank');
        if (popup) { popup.opener = null; popup.location.href = orderUrl; }
      } catch { /* Registration remains available when browser popups are blocked. */ }
    }
    setRegistrations(values => ({ ...values, [code]: { state: 'processing' } }));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const res = await fetch('/api/line/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }), signal: controller.signal,
      });
      const result = await res.json();
      if (!res.ok) {
        setRegistrations(values => ({ ...values, [code]: { state: result.uncertain ? 'unknown' : 'failed', error: result.error || '登録に失敗しました。' } }));
        if (automatic) setAutoRegistrationError(`${code}：${result.error || '自動登録に失敗しました。手動で確認してください。'}`);
        return;
      }
      setRegistrations(values => ({ ...values, [code]: { state: 'registered' } }));
      if (popup && !popup.closed) {
        try { popup.location.href = cargoIssuesUrl(code); } catch { /* Result button remains available below. */ }
      }
      setRefresh(value => value + 1);
    } catch {
      setRegistrations(values => ({ ...values, [code]: { state: 'unknown', error: '登録結果を確認できません。異常貨物画面で確認してください。' } }));
      if (automatic) setAutoRegistrationError(`${code}：登録結果を確認できません。異常貨物画面で確認してください。`);
    } finally { clearTimeout(timeout); registrationRequests.current.delete(code); }
  }, []);

  const toggleAutoRegistration = async () => {
    if (autoEnabledRef.current) {
      autoEnabledRef.current = false;
      setAutoSince(null);
      setAutoError('');
      return;
    }
    setAutoSwitching(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      // The server clock defines the boundary; existing numbers are not bulk-submitted.
      const res = await fetch('/api/line/results?page=1', { cache: 'no-store', signal: controller.signal });
      const json = await res.json();
      if (!res.ok || !json.serverTime) throw new Error(json.error || '自動登録を開始できませんでした');
      autoEnabledRef.current = true;
      setAutoSince(json.serverTime);
      setAutoError('');
      setAutoRegistrationError('');
    } catch { setAutoError('自動登録を開始できませんでした。再試行してください。'); }
    finally { clearTimeout(timeout); setAutoSwitching(false); }
  };

  useEffect(() => {
    if (!autoSince) return;
    let active = true;
    let polling = false;
    let controller;
    const queue = createAutoRegistrationQueue(code => register(code, { automatic: true }), () => active && autoEnabledRef.current);
    const poll = async () => {
      if (polling || !active || !autoEnabledRef.current) return;
      polling = true;
      try {
        let nextPage = 1;
        let lastPage = 1;
        do {
          controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12000);
          let json;
          try {
            const res = await fetch(`/api/line/results?${new URLSearchParams({ page: String(nextPage), since: autoSince })}`, { cache: 'no-store', signal: controller.signal });
            json = await res.json();
            if (!res.ok) throw new Error(json.error);
          } finally { clearTimeout(timeout); }
          if (!active || !autoEnabledRef.current) break;
          void queue.add(json.items);
          lastPage = Math.max(1, Math.ceil(json.total / json.pageSize));
          nextPage++;
        } while (active && autoEnabledRef.current && nextPage <= lastPage);
        if (active) setAutoError('');
      } catch { if (active) setAutoError('新着番号を取得できませんでした。自動で再取得します。'); }
      finally { polling = false; }
    };
    autoPollRef.current = poll;
    poll();
    return () => { active = false; queue.stop(); controller?.abort(); autoPollRef.current = null; };
  }, [autoSince, register]);

  useEffect(() => {
    if (!autoSince) return;
    // Changing the interval must not recreate the registration queue or its deduplication state.
    const interval = setInterval(() => autoPollRef.current?.(), pollSeconds * 1000);
    return () => clearInterval(interval);
  }, [autoSince, pollSeconds]);
  return (
    <main className="bg-style text-black">
      <div className="mb-6 pr-16"><h1 className="text-2xl font-bold">返品登録</h1></div>
      <div className="table-div mb-4">
        <form className="flex flex-wrap items-center gap-3" onSubmit={e => {
          e.preventDefault();
          setPage(1);
          if (searchApplied) { setInput(''); setSearch(''); }
          else setSearch(input.trim());
          setSearchApplied(value => !value);
        }}>
          <input className="input-item" value={input} onChange={e => setInput(e.target.value)} maxLength={12} placeholder="Eから始まる番号" aria-label="番号を検索" />
          <button type="submit" className={searchApplied ? 'clear-button' : 'select-button'} formNoValidate>{searchApplied ? 'クリア' : '検索'}</button>
        </form>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <button type="button" className="orther-button" disabled={loading} onClick={() => setRefresh(value => value + 1)}>更新</button>
          <button type="button" className={autoRefresh ? 'orther-button' : 'clear-button'} aria-pressed={autoRefresh} onClick={() => setAutoRefresh(value => !value)}>自動更新：{autoRefresh ? 'ON' : 'OFF'}</button>
          <button type="button" className={autoSince ? 'orther-button' : 'clear-button'} disabled={autoSwitching} aria-pressed={Boolean(autoSince)} onClick={toggleAutoRegistration}>自動登録：{autoSince ? 'ON' : 'OFF'}</button>
          {autoRefresh && <>
          <label className="flex items-center gap-3">更新間隔（秒）
            <input ref={pollInputRef} className="input-item" type="number" min="5" max="3600" step="1" required value={pollInput} onChange={e => setPollInput(e.target.value)} aria-label="更新間隔（5～3600秒）" />
          </label>
          <button type="button" className="select-button" onClick={() => {
            if (pollInputRef.current?.reportValidity()) setPollSeconds(Number(pollInput));
          }}>適用</button>
          </>}
        </div>
        {error && <p role="alert" className="text-red-600 mt-3">{error}</p>}
        {autoError && <p role="alert" className="text-red-600 mt-3">{autoError}</p>}
        {autoRegistrationError && <p role="alert" className="text-red-600 mt-3">{autoRegistrationError}</p>}
      </div>
      <details className="table-details" open>
        <summary className="table-details-content text-lg">全{data.total}件のデータ (ページ {page}/{pages})</summary>
        <div className="p-3"><div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead><tr><th className="p-2 table-title whitespace-nowrap">番号</th><th className="p-2 table-title whitespace-nowrap">受信日時</th><th className="w-px p-2 table-title whitespace-nowrap" aria-sort={statusSort === 'default' ? 'none' : statusSort === 'asc' ? 'ascending' : 'descending'}>
            <button type="button" onClick={() => {
              setStatusSort(value => value === 'default' ? 'asc' : value === 'asc' ? 'desc' : 'default');
              setPage(1);
            }}>ステータス{statusSort === 'asc' ? ' ↑' : statusSort === 'desc' ? ' ↓' : ''}</button>
          </th></tr></thead>
          <tbody>{data.items.map(item => {
            const registration = registrations[item.code];
            const state = item.registration_state === 'registered' ? 'registered' : registration?.state || item.registration_state;
            const blocked = state === 'processing';
            return <tr key={item.id} className="table-hover">
              <td className="border p-2 whitespace-nowrap">{item.code}</td>
              <td className="border p-2 whitespace-nowrap">{new Date(item.received_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</td>
              <td className="border p-2 whitespace-nowrap">
                <button type="button" className={state === 'registered' ? 'clear-button' : 'save-button'} disabled={blocked} onClick={() => {
                  if (state === 'registered' || state === 'unknown') window.open(cargoIssuesUrl(item.code), '_blank', 'noopener,noreferrer');
                  else register(item.code);
                }}>{state === 'registered' ? '登録済' : state === 'processing' ? '登録中…' : state === 'unknown' ? '要確認' : '登録'}</button>
                {registration?.error && state !== 'registered' && <p role="alert" className="text-red-600 mt-2">{registration.error}</p>}
              </td>
            </tr>;
          })}</tbody>
        </table>
        {!data.items.length && <p className="text-center py-8">{loading ? '読み込み中…' : error ? '認識結果を表示できません' : '認識結果はまだありません'}</p>}
        </div></div>
      </details>
      <div className="flex items-center justify-center gap-4 mt-4">
        <button type="button" className="clear-button" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>前へ</button>
        <span>{page} / {pages}</span>
        <button type="button" className="select-button" disabled={page >= pages || loading} onClick={() => setPage(value => value + 1)}>次へ</button>
      </div>
    </main>
  );
}
