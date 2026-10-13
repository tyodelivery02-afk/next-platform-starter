import { NextResponse } from 'next/server';
import { neon } from '@netlify/neon';
import { requirePopulationSession } from '../../../../../lib/server-session';
import { colorPalette } from '../../../../../lib/population-model.mjs';

const sql = neon();

export async function POST(req) {
  try {
    const denied = await requirePopulationSession(req);
    if (denied) return denied;
    const { selectedAreas, areaColors, colorNames, selectedPref, prefMuniMapping, versionId, versionName } = await req.json();
    const name = typeof versionName === 'string' ? versionName.trim() : '';
    if (!name || name.length > 200 || !Array.isArray(selectedAreas) || selectedAreas.length > 10000 ||
        !areaColors || !colorNames || !prefMuniMapping ||
        (selectedPref != null && !/^(0[1-9]|[1-3]\d|4[0-7])$/.test(selectedPref)) ||
        (versionId != null && (!Number.isSafeInteger(Number(versionId)) || Number(versionId) < 1))) {
      return NextResponse.json({ success: false, error: '保存データが不正です' }, { status: 400 });
    }
    const areas = [...new Set(selectedAreas)];
    if (areas.some(code => typeof code !== 'string' || !/^\d{5}$/.test(code) || !colorPalette[areaColors[code]])) {
      return NextResponse.json({ success: false, error: 'エリアまたは色が不正です' }, { status: 400 });
    }
    const colors = Object.keys(colorPalette).map(color_id => ({
      color_id, color_name: String(colorNames[color_id] || color_id).slice(0, 200), color_hex: colorPalette[color_id],
    }));
    const edits = areas.map(area_code => ({ area_code, color_id: areaColors[area_code], area_type: area_code.endsWith('000') ? 'pref' : 'muni' }));
    const mapping = Object.fromEntries(Object.entries(prefMuniMapping).filter(([key, codes]) =>
      /^(0[1-9]|[1-3]\d|4[0-7])$/.test(key) && Array.isArray(codes)).map(([key, codes]) =>
      [key, [...new Set(codes.filter(code => typeof code === 'string' && /^\d{5}$/.test(code) && code.startsWith(key) && !code.endsWith('000')))]]));
    const metadata = JSON.stringify({ selectedPref: selectedPref || null, prefMuniMapping: mapping });
    // One HTTP transaction: serialize writers, select/create target, replace all data in bulk.
    const target = versionId != null
      ? sql`WITH updated AS (
          UPDATE map_versions SET version_name = ${name}, updated_at = NOW()
          WHERE version_id = ${Number(versionId)} RETURNING version_id
        ) INSERT INTO population_save_target SELECT version_id FROM updated`
      : sql`WITH created AS (
          INSERT INTO map_versions (version_name, created_at, updated_at)
          SELECT ${name}, NOW(), NOW()
          WHERE (SELECT COUNT(*) FROM map_versions WHERE version_id != 1) < 50
          RETURNING version_id
        ) INSERT INTO population_save_target SELECT version_id FROM created`;
    const results = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(734201)`,
      sql`CREATE TEMP TABLE population_save_target (version_id bigint) ON COMMIT DROP`,
      target,
      sql`DELETE FROM map_edit_data WHERE version_id IN (SELECT version_id FROM population_save_target)`,
      sql`DELETE FROM map_color_config WHERE version_id IN (SELECT version_id FROM population_save_target)`,
      sql`DELETE FROM map_metadata WHERE version_id IN (SELECT version_id FROM population_save_target)`,
      sql`INSERT INTO map_color_config (version_id, color_id, color_name, color_hex, updated_at)
          SELECT t.version_id, c.color_id, c.color_name, c.color_hex, NOW()
          FROM population_save_target t CROSS JOIN jsonb_to_recordset(${JSON.stringify(colors)}::jsonb)
          AS c(color_id text, color_name text, color_hex text)`,
      sql`INSERT INTO map_edit_data (version_id, area_code, color_id, area_type, updated_at)
          SELECT t.version_id, e.area_code, e.color_id, e.area_type, NOW()
          FROM population_save_target t CROSS JOIN jsonb_to_recordset(${JSON.stringify(edits)}::jsonb)
          AS e(area_code text, color_id text, area_type text)`,
      sql`INSERT INTO map_metadata (version_id, key, value, updated_at)
          SELECT version_id, 'config', ${metadata}::jsonb, NOW() FROM population_save_target`,
      sql`SELECT version_id FROM population_save_target`,
    ]);
    const savedId = results.at(-1)[0]?.version_id;
    if (savedId == null) return NextResponse.json({
      success: false, error: versionId != null ? 'バージョンが見つかりません' : 'バージョン数が上限（50）に達しました',
    }, { status: versionId != null ? 404 : 400 });
    return NextResponse.json({ success: true, versionId: savedId });
  } catch (error) {
    console.error('Map save failed:', error);
    return NextResponse.json({ success: false, error: '保存に失敗しました。元のデータは保持されています。' }, { status: 500 });
  }
}
