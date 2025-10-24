import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

// === 按日期获取当天任务 ===
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "Missing date" }, { status: 400 });
  }

  try {
    const result = await sql`
      SELECT date, daily_task
      FROM daily_task
      WHERE date = ${date}
    `;
    return NextResponse.json(result[0] || null); // 返回当天任务或 null
  } catch (err) {
    console.error("GET /api/dailytask/by-date error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
