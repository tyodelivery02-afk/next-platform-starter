import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

export async function GET() {
  try {
    // 获取最近7天的所有记录，按日期倒序
    const result = await sql`
      SELECT 
        date, 
        trolley_id, 
        status, 
        am_pm, 
        updater,
        created_at
      FROM momo_trolley_records
      WHERE date >= CURRENT_DATE - INTERVAL '6 days'
      ORDER BY date DESC, am_pm DESC, trolley_id ASC;
    `;

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("selectrecent error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}