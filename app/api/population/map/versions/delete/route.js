import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const versionId = searchParams.get('versionId');

    if (!versionId || versionId === '1') {
      return NextResponse.json(
        { success: false, error: '作業中バージョンは削除できません' },
        { status: 400 }
      );
    }

    await sql`DELETE FROM map_versions WHERE version_id = ${versionId}`;

    return NextResponse.json({
      success: true,
      message: 'バージョンを削除しました'
    });

  } catch (error) {
    console.error('DB Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}