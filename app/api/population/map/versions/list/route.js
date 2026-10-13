import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";
import { requirePopulationSession } from "../../../../../../lib/server-session";

const sql = neon();

export async function GET(req) {
  try {
    const denied = await requirePopulationSession(req);
    if (denied) return denied;
    // 获取除工作版本外的所有版本
    const versions = await sql`
      SELECT 
        version_id,
        version_name,
        created_at,
        updated_at
      FROM map_versions
      WHERE version_id != 1
      ORDER BY created_at DESC
      LIMIT 50
    `;

    return NextResponse.json({
      success: true,
      versions: versions.map(v => ({
        id: v.version_id,
        name: v.version_name,
        createdAt: v.created_at,
        updatedAt: v.updated_at
      }))
    }, { headers: { 'Cache-Control': 'no-store' } });

  } catch (error) {
    console.error('DB Error:', error);
    return NextResponse.json(
      { success: false, error: 'バージョンを読み込めませんでした' },
      { status: 500 }
    );
  }
}
