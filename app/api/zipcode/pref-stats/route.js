import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";
const sql = neon();

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const prefCode = searchParams.get("prefCode");           // "13"
  const selectedCodes = (searchParams.get("selectedCodes") || "")
    .split(",").filter(Boolean);                           // ["13101", "13102", ...]

  if (!prefCode) {
    return NextResponse.json({ error: "prefCode は必須です" }, { status: 400 });
  }

  // 県内の全郵便番号数（住所 + 事務所）
  const [prefTotal] = await sql`
    SELECT COUNT(DISTINCT zip_code) AS cnt
    FROM (
      SELECT zip_code FROM zipcode
        WHERE local_government_code LIKE ${prefCode + "%"}
      UNION ALL
      SELECT zip_code FROM jigyosyo_zipcode
        WHERE local_government_code LIKE ${prefCode + "%"}
    ) t
  `;

  // 全国の全郵便番号数
  const [nationalTotal] = await sql`
    SELECT COUNT(DISTINCT zip_code) AS cnt
    FROM (
      SELECT zip_code FROM zipcode
      UNION ALL
      SELECT zip_code FROM jigyosyo_zipcode
    ) t
  `;

  // 選択エリアの郵便番号数
  let selectedCount = 0;
  if (selectedCodes.length > 0) {
    const [selected] = await sql`
      SELECT COUNT(DISTINCT zip_code) AS cnt
      FROM (
        SELECT zip_code FROM zipcode
          WHERE local_government_code = ANY(${selectedCodes})
        UNION ALL
        SELECT zip_code FROM jigyosyo_zipcode
          WHERE local_government_code = ANY(${selectedCodes})
      ) t
    `;
    selectedCount = Number(selected.cnt);
  }

  return NextResponse.json({
    selectedZipcodes: selectedCount,
    prefTotalZipcodes: Number(prefTotal.cnt),
    nationalTotalZipcodes: Number(nationalTotal.cnt),
  });
}