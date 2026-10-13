const responses = new Map();
const TTL = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 128;

// Different county filters share the same national source request.
export function fetchEstat(url) {
  const entry = responses.get(url);
  if (entry && entry.expires > Date.now()) return entry.promise;
  const promise = fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(20000) }).then(async response => {
    if (!response.ok) throw new Error('e-Stat service unavailable');
    const json = await response.json();
    if (Number(json.GET_STATS_DATA?.RESULT?.STATUS) !== 0) throw new Error('e-Stat data unavailable');
    if (!json.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE) throw new Error('e-Stat returned no data');
    return json;
  }).catch(error => {
    if (responses.get(url)?.promise === promise) responses.delete(url);
    throw error;
  });
  responses.delete(url);
  if (responses.size >= MAX_ENTRIES) responses.delete(responses.keys().next().value);
  responses.set(url, { promise, expires: Date.now() + TTL });
  return promise;
}
