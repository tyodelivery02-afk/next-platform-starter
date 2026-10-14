export const SIGNS = {
  aries: "牡羊座", taurus: "牡牛座", gemini: "双子座", cancer: "蟹座",
  leo: "獅子座", virgo: "乙女座", libra: "天秤座", scorpio: "蠍座",
  sagittarius: "射手座", capricorn: "山羊座", aquarius: "水瓶座", pisces: "魚座",
};
const TYPES = { general: "overall", love: "love", career: "work", health: "health" };

export class ProkeralaError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

export function normalizeHoroscope(json, sign, date) {
  if (json.status !== "ok") throw new ProkeralaError("運勢データを取得できませんでした。");
  const entry = json.data?.daily_predictions?.find(item => item.sign?.name?.toLowerCase() === sign);
  if (!entry) throw new ProkeralaError("対象の星座データがありません。");
  const fortune = {};
  for (const prediction of entry.predictions || []) {
    const key = TYPES[prediction.type?.toLowerCase()];
    if (key && typeof prediction.prediction === "string" && prediction.prediction.trim()) {
      fortune[key] = prediction.prediction.replace(/&#0*39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    }
  }
  if (Object.keys(TYPES).some(type => !fortune[TYPES[type]])) throw new ProkeralaError("運勢データが不足しています。");
  if (typeof json.data.datetime !== "string" || json.data.datetime.slice(0, 10) !== date) throw new ProkeralaError("運勢の日付が一致しません。");
  return { sign, signName: SIGNS[sign], date, source: "Prokerala", language: "en", fortune };
}

// Successful values and concurrent requests are shared within each server process.
export function createAsyncCache(limit = 64) {
  const values = new Map();
  const pending = new Map();
  return {
    async get(key, load, ttl = 8 * 60 * 60 * 1000) {
      const entry = values.get(key);
      if (entry && entry.expires > Date.now()) return entry.value;
      values.delete(key);
      if (pending.has(key)) return pending.get(key);
      const task = Promise.resolve().then(load).then(value => {
        if (values.size >= limit) values.delete(values.keys().next().value);
        values.set(key, { value, expires: Date.now() + (typeof ttl === "function" ? ttl(value) : ttl) });
        return value;
      }).finally(() => pending.delete(key));
      pending.set(key, task);
      return task;
    },
  };
}
