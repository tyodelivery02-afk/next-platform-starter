import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

export async function GET() {
  try {
    const rows = await sql`
      WITH latest_versions AS (
        SELECT DISTINCT ON (split_part(version_name, '_', 1))
          version_id,
          version_name,
          updated_at
        FROM map_versions
        ORDER BY
          split_part(version_name, '_', 1),
          updated_at DESC,
          version_id DESC
      )
      SELECT DISTINCT
        split_part(lv.version_name, '_', 1) AS version_key,
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
      JOIN latest_versions lv
        ON med.version_id = lv.version_id
      ORDER BY version_key, z.zip_code
    `;

    const result = {};

    for (const r of rows) {
      const versionKey = r.version_key || "UNKNOWN";

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

    return NextResponse.json(result, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("DB Error:", error);
    return NextResponse.json(
      { success: false, error: "DB query failed" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}