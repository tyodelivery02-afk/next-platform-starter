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
      prefMuniMapping 
    } = await req.json();

    // 1. 清空旧数据
    await sql`DELETE FROM map_edit_data`;
    await sql`DELETE FROM map_color_config`;

    // 2. 保存颜色配置
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
    };

    for (const [colorId, colorName] of Object.entries(colorNames)) {
      await sql`
        INSERT INTO map_color_config (color_id, color_name, color_hex, updated_at)
        VALUES (${colorId}, ${colorName}, ${colorPalette[colorId]}, NOW())
      `;
    }

    // 3. 保存地区编辑记录
    for (const areaCode of selectedAreas) {
      const colorId = areaColors[areaCode];
      const areaType = areaCode.endsWith('000') ? 'pref' : 'muni';
      
      await sql`
        INSERT INTO map_edit_data (area_code, color_id, area_type, updated_at)
        VALUES (${areaCode}, ${colorId}, ${areaType}, NOW())
      `;
    }

    // 4. 保存元数据
    await sql`
      INSERT INTO map_metadata (key, value, updated_at)
      VALUES ('config', ${JSON.stringify({ selectedPref, prefMuniMapping })}, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;

    return NextResponse.json({
      success: true,
      message: '保存成功'
    });

  } catch (error) {
    console.error('DB Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}