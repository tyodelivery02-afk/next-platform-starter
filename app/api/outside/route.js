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
),
all_zipcodes AS (
  SELECT
    COALESCE(z.zip_code, jz.zip_code) AS zip_code,
    COALESCE(z.local_government_code, jz.local_government_code) AS local_government_code,
    COALESCE(z.prefecture_kanji, jz.office_name_kanji) AS prefecture_kanji,
    COALESCE(z.city_kanji, jz.city_kanji) AS city_kanji
  FROM zipcode z
  FULL OUTER JOIN jigyosyo_zipcode jz
    ON z.zip_code = jz.zip_code
   AND z.local_government_code = jz.local_government_code
)
SELECT DISTINCT
  split_part(lv.version_name, '_', 1) AS version_key,
  az.zip_code,
  mcc.color_name,
  az.prefecture_kanji,
  az.city_kanji
FROM all_zipcodes az
JOIN map_edit_data med
  ON az.local_government_code = med.area_code
JOIN map_color_config mcc
  ON med.color_id = mcc.color_id
 AND med.version_id = mcc.version_id
JOIN latest_versions lv
  ON med.version_id = lv.version_id
ORDER BY version_key, az.zip_code
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