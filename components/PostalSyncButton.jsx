"use client";
import { useEffect, useRef, useState } from 'react';

export function usePostalSync(onSynced) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pollRevision, setPollRevision] = useState(0);
  const starting = useRef(false);
  const watching = useRef(false);
  const lastFinished = useRef(null);
  const onSyncedRef = useRef(onSynced);
  useEffect(() => { onSyncedRef.current = onSynced; }, [onSynced]);

  useEffect(() => {
    let active = true;
    let timer;
    const controller = new AbortController();
    const check = async () => {
      try {
        const response = await fetch('/api/zipcode/sync', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!active) return;
        setStatus(data);
        setError('');
        watching.current = data.status === 'running';
        if (data.status === 'succeeded' && data.finishedAt !== lastFinished.current) {
          lastFinished.current = data.finishedAt;
          onSyncedRef.current?.();
        }
      } catch {
        if (active) setError('同期状態を取得できませんでした。');
      } finally { if (active && watching.current) timer = setTimeout(check, 5000); }
    };
    check();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [pollRevision]);

  const start = async () => {
    if (starting.current || status?.status === 'running') return;
    starting.current = true;
    watching.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/zipcode/sync', { method: 'POST', signal: AbortSignal.timeout(25000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '同期を開始できませんでした。');
      watching.current = true;
      setStatus(data);
    } catch (e) { setError(e.name === 'TimeoutError' ? '開始結果を確認中です。しばらくお待ちください。' : e.message); }
    finally { setBusy(false); starting.current = false; setPollRevision(value => value + 1); }
  };

  return { status, busy, error, start };
}

export default function PostalSyncButton({ sync }) {
  const { status, busy, error, start } = sync;
  const summary = status?.summary;
  return <>
    <button type="button" className="orther-button" disabled={busy || status?.status === 'running'} onClick={start}>
      {busy || status?.status === 'running' ? '郵便番号同期中…' : '郵便番号同期'}
    </button>
    <span role="status" className="text-sm">
      {error || (status?.status === 'failed' ? status.error : status?.status === 'succeeded' ? summary?.unchanged ? '郵便番号は最新です。' : `同期完了：住所 ${summary?.zipcode?.total ?? 0}件／事務所 ${summary?.jigyosyo_zipcode?.total ?? 0}件` : '')}
    </span>
  </>;
}
