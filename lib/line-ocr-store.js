import { neon } from '@netlify/neon';
import { randomUUID } from 'node:crypto';

function database() { return neon(); }

export async function claimLineEvent(event) {
  const sql = database();
  const token = randomUUID();
  const timestamp = Number(event.timestamp);
  const received = new Date(Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now()).toISOString();
  const rows = await sql`
    INSERT INTO line_ocr_events (event_id, received_at, lease_until, lease_token)
    VALUES (${event.webhookEventId}, ${received}, NOW() + INTERVAL '90 seconds', ${token})
    ON CONFLICT (event_id) DO UPDATE SET
      lease_until = NOW() + INTERVAL '90 seconds', lease_token = EXCLUDED.lease_token
    WHERE NOT line_ocr_events.completed
      AND (line_ocr_events.lease_until IS NULL OR line_ocr_events.lease_until < NOW())
    RETURNING lease_token`;
  if (rows[0]) return token;
  const existing = await sql`SELECT completed FROM line_ocr_events WHERE event_id = ${event.webhookEventId}`;
  if (existing[0]?.completed) return null;
  // Return a retriable failure when another delivery is still processing this event.
  throw new Error('Event already processing');
}

export async function completeLineEvent(eventId, token, codes) {
  const sql = database();
  const rows = await sql`
    UPDATE line_ocr_events SET codes = ${codes}::text[], completed = TRUE, recognized_at = NOW(),
      lease_until = NULL, lease_token = NULL
    WHERE event_id = ${eventId} AND lease_token = ${token} AND NOT completed
    RETURNING event_id`;
  if (!rows.length) throw new Error('Event lease expired');
}
export async function releaseLineEvent(eventId, token) {
  const sql = database();
  await sql`UPDATE line_ocr_events SET lease_until = NULL, lease_token = NULL
    WHERE event_id = ${eventId} AND lease_token = ${token} AND NOT completed`;
}

export async function listLineCodes(page, search, since = null, statusSort = 'default') {
  const sql = database();
  const direction = statusSort === 'asc' ? 1 : statusSort === 'desc' ? -1 : 0;
  const rows = await sql`
    WITH entries AS (
      SELECT e.event_id || ':' || c.ordinality::text AS id, c.code, e.received_at
      FROM line_ocr_events e CROSS JOIN LATERAL unnest(e.codes) WITH ORDINALITY c(code, ordinality)
      WHERE e.completed AND (${search} = '' OR c.code LIKE '%' || ${search} || '%')
        AND (${since}::timestamptz IS NULL OR e.recognized_at >= ${since}::timestamptz)
    ), selected AS (
      SELECT entries.*, r.state AS registration_state FROM entries
      LEFT JOIN line_cargo_registrations r ON r.code = entries.code
      ORDER BY (CASE WHEN r.state = 'registered' THEN 1 ELSE 0 END) * ${direction},
        received_at DESC, id DESC LIMIT 50 OFFSET ${(page - 1) * 50}
    )
    SELECT (SELECT COUNT(*)::int FROM entries) AS total,
      COALESCE((SELECT json_agg(selected ORDER BY
        (CASE WHEN registration_state = 'registered' THEN 1 ELSE 0 END) * ${direction},
        received_at DESC, id DESC) FROM selected), '[]'::json) AS items`;
  return { items: rows[0]?.items || [], total: rows[0]?.total || 0, page, pageSize: 50 };
}
