'use client';

import { useEffect, useState } from 'react';

const api = '/api/extensions/caution-bot/statistics';
const labels = [['registered','新規登録'],['replaced','置換'],['appended','追加'],['skipped','既存'],['failed','エラー']];
const format = new Intl.NumberFormat('ja-JP');
const writes = counts => counts.registered + counts.replaced + counts.appended;

async function get(url, signal) {
  const response = await fetch(url,{cache:'no-store',signal});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '統計を取得できませんでした。');
  return data;
}

export default function CautionStatisticsPage() {
  const [accounts,setAccounts] = useState([]);
  const [account,setAccount] = useState('');
  const [stats,setStats] = useState(null);
  const [status,setStatus] = useState('読み込み中…');

  useEffect(()=>{
    const controller = new AbortController();
    get(api,controller.signal).then(({accounts})=>{
      setAccounts(accounts);
      setAccount(accounts[0] || '');
      setStatus(accounts.length ? '' : '統計データはまだありません。');
    }).catch(error=>{if (!controller.signal.aborted) setStatus(error.message);});
    return ()=>controller.abort();
  },[]);

  useEffect(()=>{
    if (!account) return;
    const controller = new AbortController();
    const refresh = () => get(api+'?accountId='+encodeURIComponent(account),controller.signal)
      .then(data=>{if (!controller.signal.aborted) {setStats({account,data});setStatus('');}})
      .catch(error=>{if (!controller.signal.aborted) setStatus(error.message);});
    void refresh();
    const timer = setInterval(refresh,30000);
    return ()=>{controller.abort();clearInterval(timer);};
  },[account]);

  const data = stats?.account===account ? stats.data : null;
  return <main className="bg-style">
    <h2 className="relative text-x2 font-bold text-black text-shadow mb-6">配送注意事項の登録統計</h2>
    <section className="w-full max-w-3xl rounded-xl border border-sky-300 bg-white/10 p-8 text-black shadow-md backdrop-blur-md">
      {accounts.length > 0 && <label className="flex flex-wrap items-center gap-3">
        Chrome アカウント ID
        <select className="input" value={account} onChange={event=>{setAccount(event.target.value);setStatus('読み込み中…');}}>
          {accounts.map(id=><option value={id} key={id}>{id}</option>)}
        </select>
      </label>}
      {status && <p className="mt-3" role="status">{status}</p>}
      {data && <>
        <div className="my-4">
          <p>今日の登録成功件数 <strong>{format.format(writes(data.today))}</strong> 件</p>
          <p>累計登録件数 <strong>{format.format(writes(data.totals))}</strong> 件</p>
          <p className="text-sm">{data.day.replaceAll('-','/')}（日本時間）</p>
        </div>
        <table className="w-full border-collapse text-sm">
          <thead><tr className="border-b border-sky-200 text-left"><th className="py-2" scope="col">項目</th><th className="py-2 text-right" scope="col">累計</th><th className="py-2 text-right" scope="col">今日</th></tr></thead>
          <tbody>{labels.map(([key,label])=><tr className="border-b border-sky-200" key={key}>
            <th className="py-2 text-left font-normal" scope="row">{label}</th>
            <td className="py-2 text-right">{format.format(data.totals[key])}</td>
            <td className="py-2 text-right">{format.format(data.today[key])}</td>
          </tr>)}</tbody>
        </table>
      </>}
    </section>
  </main>;
}
