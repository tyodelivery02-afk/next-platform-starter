import { CargoIssueError, ESPOIRER_ORIGIN } from './line-cargo.mjs';

async function requestEspoirer(path, options = {}, writing = false) {
  const token = process.env.ESPOIRER_ACCESS_TOKEN?.trim().replace(/^Bearer\s+/i, '');
  if (!token) throw new CargoIssueError('サーバーの ESPOIRER_ACCESS_TOKEN を設定してください。', 503);
  let response;
  try {
    response = await fetch(`${ESPOIRER_ORIGIN}${path}`, {
      ...options, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}`,
        Cookie: `ESP_SYSTEM_TOKEN=${encodeURIComponent(`Bearer ${token}`)}` },
    });
  } catch { throw new CargoIssueError('配送システムとの通信に失敗しました。', 502, writing); }
  if ([401,403].includes(response.status)) throw new CargoIssueError('配送システムの認証が切れています。サーバーのトークンを更新してください。', 401);
  if (!response.ok) throw new CargoIssueError('配送システムがエラーを返しました。', 502, writing && response.status >= 500);
  let json;
  try { json = await response.json(); }
  catch { throw new CargoIssueError('配送システムの応答を確認できません。', 502, writing); }
  if (!Object.hasOwn(json, 'errcode')) throw new CargoIssueError('配送システムの応答形式を確認できません。', 502, writing);
  if (![0, '0'].includes(json.errcode)) throw new CargoIssueError('配送システムで処理が拒否されました。登録内容または認証を確認してください。', 422);
  return json;
}
export const loadEspoirerOrder = code => requestEspoirer(`/prod/api/administrator/order/detail?${new URLSearchParams({ hawbNo: code })}`);
export const createEspoirerIssue = payload => requestEspoirer('/prod/goods/api/cargoIssues/create', { method: 'POST', body: JSON.stringify(payload) }, true);

export async function espoirerIssueExists(code) {
  const json = await requestEspoirer('/prod/goods/api/cargoIssues/list', {
    method: 'POST',
    body: JSON.stringify({ data: {
      belongTo: null, status: null, mawbNos: [], issue: null, returnStatus: null, startPort: null, targetPortList: [],
      createStartTime: null, createEndTime: null, warehouseArrivalStartDate: null, warehouseArrivalEndDate: null,
      sendingStartDate: null, sendingEndDate: null, destructionStartDate: null, destructionEndDate: null,
      returnStatusList: [], reminderType: null, updateStartTime: null, updateEndTime: null, subject: null,
      hawbNos: [code], returnNumbers: [], prepaidReturnNumbers: [], slipNumberList: [], slipNumberNewList: [],
      pageSize: 50, pageNum: 1, searchDateType: 'warehouseArrivalDateList', searchTimeType: 'createTimeList', searchType: 'hawbNos',
    } }),
  });
  const result = json.result;
  if (!Array.isArray(result?.list) || !Number.isInteger(Number(result.totalNum)) || Number(result.totalNum) < 0) throw new CargoIssueError('既存の登録情報を確認できません。新規登録を中止しました。');
  if (result.list.some(item => item.hawbNo === code)) return true;
  if (Number(result.totalNum) !== 0 || result.list.length) throw new CargoIssueError('検索結果の番号を確認できません。新規登録を中止しました。');
  return false;
}
