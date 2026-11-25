import { neon } from '@netlify/neon';

const keys = ['executed','registered','replaced','appended','skipped','failed','cancelled','interrupted','batches','completedBatches'];
const countsOf = source => Object.fromEntries(keys.map(key => [key, Number(source?.[key] ?? 0)]));
export const validAccountId = value => typeof value === 'string' && /^\d{1,32}$/.test(value);
export const todayInJapan = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export function validateSnapshots(body, today = todayInJapan()) {
  const {accountId, installationId, days} = body ?? {};
  if (!validAccountId(accountId) ||
      typeof installationId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(installationId) ||
      !Array.isArray(days) || days.length > 200) return null;
  const seen = new Set();
  const snapshots = [];
  for (const row of days) {
    const {day,counts} = row ?? {};
    if (typeof day !== 'string' || !/^20\d\d-\d\d-\d\d$/.test(day) || day > today || seen.has(day)) return null;
    const date = new Date(day + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== day || !counts || typeof counts !== 'object' || Array.isArray(counts)) return null;
    if (keys.some(key => !Number.isInteger(counts[key] ?? 0) || (counts[key] ?? 0) < 0 || (counts[key] ?? 0) > 2147483647)) return null;
    seen.add(day);
    snapshots.push({day,counts:countsOf(counts)});
  }
  return {accountId,installationId,snapshots};
}

export async function saveSnapshots({accountId, installationId, snapshots}) {
  if (!snapshots.length) return;
  const sql = neon();
  await sql`
    INSERT INTO caution_stat_accounts (account_id) VALUES (${accountId})
    ON CONFLICT DO NOTHING
  `;
  await sql`
    INSERT INTO caution_daily_statistics AS stored (account_id, installation_id, day, counts)
    SELECT ${accountId}, ${installationId}::uuid, item.day, item.counts
      FROM jsonb_to_recordset(${JSON.stringify(snapshots)}::jsonb) AS item(day date, counts jsonb)
      ORDER BY item.day
    ON CONFLICT (account_id, installation_id, day)
    DO UPDATE SET counts = (
      SELECT jsonb_object_agg(incoming.key, greatest(incoming.value::bigint, coalesce((stored.counts->>incoming.key)::bigint,0)))
      FROM jsonb_each_text(EXCLUDED.counts) AS incoming
    )
  `;
}

export async function getStatistics(accountId, day = todayInJapan()) {
  const sql = neon();
  const [row] = await sql`
    SELECT jsonb_object_agg(metric, total) AS totals, jsonb_object_agg(metric, for_today) AS today
    FROM (
      SELECT metric.key AS metric, SUM(metric.value::bigint) AS total,
             COALESCE(SUM(metric.value::bigint) FILTER (WHERE daily.day = ${day}::date), 0) AS for_today
      FROM caution_daily_statistics daily
      CROSS JOIN LATERAL jsonb_each_text(daily.counts) metric
      WHERE daily.account_id = ${accountId}
      GROUP BY metric.key
    ) AS sums
  `;
  return {day,totals:countsOf(row?.totals),today:countsOf(row?.today)};
}

export async function listStatisticsAccounts() {
  return (await neon()`SELECT account_id FROM caution_stat_accounts ORDER BY account_id`).map(row => row.account_id);
}
