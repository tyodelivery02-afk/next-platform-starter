import { NextResponse } from 'next/server';
import { neon } from '@netlify/neon';
import { requirePopulationSession } from '../../../../../../lib/server-session';
const sql = neon();

export async function GET(req) {
  try {
    const denied = await requirePopulationSession(req);
    if (denied) return denied;
    const rows = await sql`
      SELECT color_id, color_name, version_id FROM map_color_config
      WHERE version_id = (SELECT MAX(version_id) FROM map_color_config)
    `;
    return NextResponse.json({
      success: true, versionId: rows[0]?.version_id ?? null,
      colorNames: Object.fromEntries(rows.map(row => [row.color_id, row.color_name])),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Color configuration load failed:', error);
    return NextResponse.json({ success: false, error: '色の設定を読み込めませんでした' }, { status: 500 });
  }
}
