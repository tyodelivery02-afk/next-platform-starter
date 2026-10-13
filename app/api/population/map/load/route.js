import { NextResponse } from 'next/server';
import { neon } from '@netlify/neon';
import { requirePopulationSession } from '../../../../../lib/server-session';

const sql = neon();

export async function GET(req) {
  try {
    const denied = await requirePopulationSession(req);
    if (denied) return denied;
    const requested = new URL(req.url).searchParams.get('versionId');
    const versionId = Number(requested || 1);
    if (!Number.isSafeInteger(versionId) || versionId < 1) return NextResponse.json({ success: false, error: 'Invalid version' }, { status: 400 });
    // All records come from the same database snapshot and one network request.
    const rows = await sql`
      SELECT
        (SELECT version_name FROM map_versions WHERE version_id = ${versionId}) AS version_name,
        EXISTS(SELECT 1 FROM map_versions WHERE version_id = ${versionId}) AS exists,
        COALESCE((SELECT jsonb_object_agg(color_id, color_name) FROM map_color_config WHERE version_id = ${versionId}), '{}'::jsonb) AS color_names,
        COALESCE((SELECT jsonb_object_agg(area_code, color_id) FROM map_edit_data WHERE version_id = ${versionId}), '{}'::jsonb) AS area_colors,
        COALESCE((SELECT value FROM map_metadata WHERE version_id = ${versionId} AND key = 'config'), '{}'::jsonb) AS metadata
    `;
    const row = rows[0];
    if (requested && !row.exists) return NextResponse.json({ success: false, error: 'バージョンが見つかりません' }, { status: 404 });
    const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
    return NextResponse.json({ success: true, data: {
      versionId: row.exists ? versionId : null, versionName: row.version_name || '',
      selectedAreas: Object.keys(row.area_colors), areaColors: row.area_colors, colorNames: row.color_names,
      selectedPref: metadata.selectedPref || null, prefMuniMapping: metadata.prefMuniMapping || {},
    } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Map load failed:', error);
    return NextResponse.json({ success: false, error: '地図データを読み込めませんでした' }, { status: 500 });
  }
}
