import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon(); // 自动使用 NETLIFY_DATABASE_URL

export async function GET() {
  try {
    const result = await sql`
      SELECT DISTINCT ON (trolley_id)
        trolley_id, status
      FROM momo_trolley_records
      ORDER BY trolley_id, date DESC, am_pm ASC;
    `;

    // 这里 result 直接是数组，不是 { rows }
    const statusMap = {};
    result.forEach((r) => {
      statusMap[r.trolley_id] = r.status;
    });

    return NextResponse.json(statusMap);
  } catch (err) {
    console.error("DB Error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
