import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

function formatVersionName(versionName) {
  return String(versionName || "").split("_")[0]?.trim() || "UNKNOWN";
}

export async function GET() {
  try {
    const rows = await sql`
      SELECT DISTINCT
        mv.version_name,
        z.zip_code,
        mcc.color_name,
        z.prefecture_kanji,
        z.city_kanji
      FROM zipcode z
      JOIN map_edit_data med
        ON z.local_government_code = med.area_code
      JOIN map_color_config mcc
        ON med.color_id = mcc.color_id
       AND med.version_id = mcc.version_id
      JOIN map_versions mv
        ON mv.version_id = mcc.version_id
      ORDER BY mv.version_name, z.zip_code
    `;

    const result = {};

    for (const r of rows) {
      const versionKey = formatVersionName(r.version_name);

      if (!result[versionKey]) {
        result[versionKey] = [];
      }

      result[versionKey].push({
        zipcode: r.zip_code,
        delivery_company: r.color_name,
        level1: r.prefecture_kanji,
        level2: r.city_kanji,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("DB Error:", error);
    return NextResponse.json(
      { success: false, error: "DB query failed" },
      { status: 500 }
    );
  }
}