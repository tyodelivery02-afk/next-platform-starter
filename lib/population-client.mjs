const cache = new Map();
const TTL = 5 * 60 * 1000;

// Share successful responses and in-flight requests. Never cache failures.
export function fetchPopulationJSON(url) {
  const entry = cache.get(url);
  if (entry && entry.expires > Date.now()) return entry.promise;
  const promise = fetch(url).then(async response => {
    const data = await response.json();
    if (!response.ok || data.error || data.success === false) throw new Error(data.message || data.error || `HTTP ${response.status}`);
    return data;
  }).catch(error => {
    if (cache.get(url)?.promise === promise) cache.delete(url);
    throw error;
  });
  cache.set(url, { promise, expires: Date.now() + TTL });
  return promise;
}

export async function mapWithConcurrency(items, limit, callback) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await callback(items[index], index);
    }
  }));
  return results;
}

export async function loadPopulationSnapshot(selectedAreas = [], selectedPref = null) {
  const codes = [...new Set([
    ...selectedAreas.map(code => code.slice(0, 2)),
    ...(selectedPref ? [selectedPref] : []),
  ])];
  const [prefData, municipalities] = await Promise.all([
    fetchPopulationJSON('/api/population/estat?level=pref'),
    mapWithConcurrency(codes, 4, code => fetchPopulationJSON('/api/population/estat?level=muni&prefCode=' + code)),
  ]);
  const population = Object.fromEntries(prefData.records.map(record => [record.code, record.value]));
  const mapping = {};
  municipalities.forEach((data, index) => {
    const prefCode = codes[index];
    const records = data.records.filter(record => record.code.startsWith(prefCode) && !record.code.endsWith('000'));
    mapping[prefCode] = [...new Set(records.map(record => record.code))];
    records.forEach(record => { population[record.code] = record.value; });
  });
  const national = population['00000'] ?? prefData.records
    .filter(record => /^\d{2}000$/.test(record.code) && record.code !== '00000')
    .reduce((sum, record) => sum + record.value, 0);
  return { population, mapping, national };
}
