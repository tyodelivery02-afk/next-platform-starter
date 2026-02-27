import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

export async function POST(req) {
  try {
    const {
      selectedAreas,
      areaColors,
      colorNames,
      selectedPref,
      prefMuniMapping,
      versionId,    // 如果有这个参数，更新指定版本
      versionName   // 版本名称
    } = await req.json();

    const colorPalette = {
      color1: "#FF5733",
      color2: "#28C76F",
      color3: "#FFCC00",
      color4: "#9B59B6",
      color5: "#E91E63",
      color6: "#F39C12",
      color7: "#34495E",
      color8: "#E67E22",
      color9: "#C0392B",
      color10: "#A3CB38",
      color11: "#0047AB",
      color12: "#2b94eb",
      color13: "#30D5C8",
    };

    let targetVersionId;

    // 如果提供了 versionId，更新该版本
    if (versionId) {
      targetVersionId = versionId;

      // 更新版本名称和时间戳
      await sql`
        UPDATE map_versions 
        SET version_name = ${versionName}, updated_at = NOW() 
        WHERE version_id = ${versionId}
      `;
    } else {
      // 创建新版本
      const versionCount = await sql`SELECT COUNT(*) as count FROM map_versions`;
      if (versionCount[0].count >= 50) {
        return NextResponse.json(
          { success: false, error: 'バージョン数が上限（50）に達しました' },
          { status: 400 }
        );
      }

      const versionResult = await sql`
        INSERT INTO map_versions (version_name, created_at, updated_at)
        VALUES (${versionName}, NOW(), NOW())
        RETURNING version_id
      `;
      targetVersionId = versionResult[0].version_id;
    }

    // 清空该版本的旧数据
    await sql`DELETE FROM map_edit_data WHERE version_id = ${targetVersionId}`;
    await sql`DELETE FROM map_color_config WHERE version_id = ${targetVersionId}`;
    await sql`DELETE FROM map_metadata WHERE version_id = ${targetVersionId}`;

    // 保存颜色配置
    for (const [colorId, colorName] of Object.entries(colorNames)) {
      await sql`
        INSERT INTO map_color_config (version_id, color_id, color_name, color_hex, updated_at)
        VALUES (${targetVersionId}, ${colorId}, ${colorName}, ${colorPalette[colorId]}, NOW())
      `;
    }

    // 保存地区编辑记录
    for (const areaCode of selectedAreas) {
      const colorId = areaColors[areaCode];
      const areaType = areaCode.endsWith('000') ? 'pref' : 'muni';

      await sql`
        INSERT INTO map_edit_data (version_id, area_code, color_id, area_type, updated_at)
        VALUES (${targetVersionId}, ${areaCode}, ${colorId}, ${areaType}, NOW())
      `;
    }

    // 保存元数据
    await sql`
      INSERT INTO map_metadata (version_id, key, value, updated_at)
      VALUES (${targetVersionId}, 'config', ${JSON.stringify({ selectedPref, prefMuniMapping })}, NOW())
    `;

    return NextResponse.json({
      success: true,
      message: versionId ? '保存成功' : '新しいバージョンを保存しました',
      versionId: targetVersionId
    });

  } catch (error) {
    console.error('DB Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}