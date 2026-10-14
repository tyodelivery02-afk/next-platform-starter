import { createAsyncCache, normalizeHoroscope, ProkeralaError } from "./prokerala-model.mjs";
import { translateHoroscope } from "./prokerala-translation.mjs";

const tokenCache = createAsyncCache(1);
const horoscopeCache = createAsyncCache();
const errors = {
  credentials: "Prokeralaの接続設定を確認してください。",
  quota: "Prokeralaの利用上限に達しました。",
  balance: "Prokeralaのクレジット残高が不足しています。残高を確認してください。",
  unavailable: "Prokeralaに接続できませんでした。再試行してください。",
  permission: "Prokeralaの運勢APIへのアクセス権限を確認してください。",
};

async function fetchJSON(url, options, signal) {
  let response;
  try { response = await fetch(url, { ...options, cache: "no-store", signal }); }
  catch { throw new ProkeralaError(errors.unavailable, signal.aborted ? 504 : 502); }
  if (!response.ok) {
    // Prokerala also returns 403 for insufficient credits, rather than 402.
    const body = await response.json().catch(() => null);
    const insufficientBalance = Array.isArray(body?.errors) && body.errors.some(error =>
      typeof error.detail === "string" && /(?:insufficient|not have sufficient) credit balance/i.test(error.detail));
    if (insufficientBalance) throw new ProkeralaError(errors.balance, 402);
    const quotaExceeded = response.status === 429 || response.status === 402;
    const message = quotaExceeded ? errors.quota
      : response.status === 401 ? errors.credentials
      : response.status === 403 ? errors.permission
      : errors.unavailable;
    throw new ProkeralaError(message, quotaExceeded ? 429 : 502);
  }
  try { return await response.json(); }
  catch { throw new ProkeralaError(errors.unavailable); }
}

export async function getProkeralaToken(signal = AbortSignal.timeout(8000)) {
  const clientId = process.env.PROKERALA_CLIENT_ID;
  const clientSecret = process.env.PROKERALA_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new ProkeralaError(errors.credentials, 503);
  const cached = await tokenCache.get(clientId, async () => {
    const json = await fetchJSON("https://api.prokerala.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
    }, signal);
    if (!json.access_token || !Number.isFinite(Number(json.expires_in)) || Number(json.expires_in) < 60) throw new ProkeralaError(errors.credentials);
    return { access_token: json.access_token, expires_at: Date.now() + Number(json.expires_in) * 1000 };
  }, token => Math.max(1, token.expires_at - Date.now() - 30000));
  if (cached.expires_at <= Date.now() + 30000) throw new ProkeralaError(errors.credentials);
  return cached;
}

export function getDailyHoroscope(sign, date) {
  return horoscopeCache.get(`${date}:${sign}`, async () => {
    // One deadline covers token acquisition and the prediction request.
    const signal = AbortSignal.timeout(15000);
    const token = await getProkeralaToken(signal);
    const url = new URL("https://api.prokerala.com/v2/horoscope/daily/advanced");
    url.search = new URLSearchParams({ sign, type: "all", datetime: `${date}T12:00:00+09:00` }).toString();
    const json = await fetchJSON(url, { headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" } }, signal);
    return normalizeHoroscope(json, sign, date);
  });
}

export async function getJapaneseDailyHoroscope(sign, date) {
  // Keep provider data cached even if translation fails, avoiding another paid request.
  return translateHoroscope(await getDailyHoroscope(sign, date));
}
