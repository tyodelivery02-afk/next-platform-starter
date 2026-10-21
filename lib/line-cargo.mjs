export const ESPOIRER_ORIGIN = 'https://www.console.espoirer.com';
export const CARGO_ISSUES_URL = `${ESPOIRER_ORIGIN}/customer-service/cargo-issues`;
export function cargoIssuesUrl(code) {
  return `${CARGO_ISSUES_URL}?${new URLSearchParams({ hawbNos: code, searchDateType: 'warehouseArrivalDateList', searchTimeType: 'createTimeList', searchType: 'hawbNos' })}`;
}
export class CargoIssueError extends Error {
  constructor(message, status = 502, uncertain = false) { super(message); this.status = status; this.uncertain = uncertain; }
}

export function buildCargoIssue(code, response) {
  if (![0, '0'].includes(response?.errcode) || !response?.result) throw new CargoIssueError('注文情報を取得できませんでした。');
  const order = response.result;
  if (order.hawbNo !== code) throw new CargoIssueError('注文番号が一致しません。', 409);
  const tracks = Array.isArray(order.trackVos) ? order.trackVos.filter(track => Number(track.orderTrackType) === 8) : [];
  if (!tracks.length) throw new CargoIssueError('返品完了（種別8）の履歴がありません。', 422);
  if (tracks.some(track => typeof track.createTime !== 'string' || !Number.isFinite(Date.parse(track.createTime)))) throw new CargoIssueError('返品履歴の日付を確認できません。', 422);
  const track = [...tracks].sort((a,b) => Date.parse(b.createTime) - Date.parse(a.createTime))[0];
  if (typeof track.failReason !== 'string' || !track.failReason.trim()) throw new CargoIssueError('返品理由がないため登録できません。', 422);
  return {
    projectValue: code,
    issue: track.failReason,
    returnStatus: '返品済',
    issueDetails: typeof track.remark === 'string' ? track.remark : '',
    warehouseArrivalDate: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(track.createTime)),
    project: 0,
  };
}

export async function registerCargoIssue(code, deps) {
  const claim = await deps.claim(code);
  if (claim.state === 'registered') return { alreadyRegistered: true, redirectUrl: cargoIssuesUrl(code) };
  if (claim.state !== 'claimed') throw new CargoIssueError('登録済みか処理中です。異常貨物画面で結果を確認してください。', 409, true);
  let submitted = false;
  try {
    if (await deps.exists(code)) {
      await deps.finish(code, claim.token, 'registered');
      return { alreadyRegistered: true, redirectUrl: cargoIssuesUrl(code) };
    }
    const payload = buildCargoIssue(code, await deps.loadOrder(code));
    submitted = true;
    await deps.create(payload);
    await deps.finish(code, claim.token, 'registered');
    return { alreadyRegistered: false, redirectUrl: cargoIssuesUrl(code), payload };
  } catch (error) {
    const uncertain = submitted && !(error instanceof CargoIssueError && !error.uncertain);
    try { await deps.finish(code, claim.token, uncertain ? 'unknown' : 'failed'); }
    catch { throw new CargoIssueError('登録結果を保存できませんでした。異常貨物画面で確認してください。', 503, true); }
    if (uncertain) throw new CargoIssueError('登録結果を確認できませんでした。重複登録を避けるため、異常貨物画面で確認してください。', 409, true);
    throw error;
  }
}
