import { neon } from '@netlify/neon';
import { randomUUID } from 'node:crypto';
import { CargoIssueError } from './line-cargo.mjs';

export async function claimCargoRegistration(code) {
  const sql = neon();
  const token = randomUUID();
  const rows = await sql`
    INSERT INTO line_cargo_registrations(code,state,attempt_token)
    SELECT ${code}, 'processing', ${token}
    WHERE EXISTS (SELECT 1 FROM line_ocr_events WHERE completed AND ${code} = ANY(codes))
    ON CONFLICT(code) DO UPDATE SET state = 'processing', attempt_token = EXCLUDED.attempt_token, updated_at = NOW()
      WHERE line_cargo_registrations.state = 'failed'
    RETURNING attempt_token`;
  if (rows.length) return { state: 'claimed', token };
  const existing = await sql`SELECT state FROM line_cargo_registrations WHERE code = ${code}`;
  if (!existing.length) throw new CargoIssueError('認識結果に存在しない番号です。', 404);
  return { state: existing[0].state };
}

export async function finishCargoRegistration(code, token, state) {
  if (!['registered','failed','unknown'].includes(state)) throw new Error('Invalid registration state');
  const sql = neon();
  const rows = await sql`UPDATE line_cargo_registrations SET state = ${state}, updated_at = NOW()
    WHERE code = ${code} AND attempt_token = ${token} AND state = 'processing' RETURNING code`;
  if (!rows.length) throw new Error('Registration state could not be saved');
}
