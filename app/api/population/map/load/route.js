import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const versionId = searchParams.get('versionId') || '1'; // 默认加载工作版本

    // 获取颜色配置
    const colors = await sql`
      SELECT color_id, color_name FROM map_color_config
      WHERE version_id = ${versionId}
    `;

    const colorNames = {};
    colors.forEach(row => {
      colorNames[row.color_id] = row.color_name;
    });

    // 获取地区编辑记录
    const edits = await sql`
      SELECT area_code, color_id FROM map_edit_data
      WHERE version_id = ${versionId}
    `;

    const selectedAreas = [];
    const areaColors = {};
    edits.forEach(row => {
      selectedAreas.push(row.area_code);
      areaColors[row.area_code] = row.color_id;
    });

    // 获取元数据
    const metadataResult = await sql`
      SELECT value FROM map_metadata 
      WHERE version_id = ${versionId} AND key = 'config'
    `;

    let selectedPref = null;
    let prefMuniMapping = {};

    if (metadataResult.length > 0) {
      const metadata = metadataResult[0].value;
      selectedPref = metadata.selectedPref || null;
      prefMuniMapping = metadata.prefMuniMapping || {};
    }

    return NextResponse.json({
      success: true,
      data: {
        selectedAreas,
        areaColors,
        colorNames,
        selectedPref,
        prefMuniMapping
      }
    });

  } catch (error) {
    console.error('DB Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}