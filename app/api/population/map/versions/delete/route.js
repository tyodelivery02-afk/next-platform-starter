import { NextResponse } from 'next/server';
import { neon } from '@netlify/neon';
import { requirePopulationSession } from '../../../../../../lib/server-session';

const sql = neon();

export async function DELETE(req) {
  try {
    const denied = await requirePopulationSession(req);
    if (denied) return denied;
    const versionId = Number(new URL(req.url).searchParams.get('versionId'));
    if (!Number.isSafeInteger(versionId) || versionId <= 1) return NextResponse.json({ success: false, error: '作業中バージョンは削除できません' }, { status: 400 });
    const results = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(734201)`,
      sql`DELETE FROM map_edit_data WHERE version_id = ${versionId}`,
      sql`DELETE FROM map_color_config WHERE version_id = ${versionId}`,
      sql`DELETE FROM map_metadata WHERE version_id = ${versionId}`,
      sql`DELETE FROM map_versions WHERE version_id = ${versionId} RETURNING version_id`,
    ]);
    if (!results.at(-1).length) return NextResponse.json({ success: false, error: 'バージョンが見つかりません' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Map delete failed:', error);
    return NextResponse.json({ success: false, error: '削除に失敗しました' }, { status: 500 });
  }
}
