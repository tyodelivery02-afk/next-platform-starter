import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon(); // 自动使用环境变量 NETLIFY_DATABASE_URL

// === 保存任务表 ===
export async function POST(request) {
  const { date, data } = await request.json();
  try {
    await sql`
      INSERT INTO daily_task (date, daily_task)
      VALUES (${date}, ${JSON.stringify(data)})
      ON CONFLICT (date)
      DO UPDATE SET daily_task = ${JSON.stringify(data)}, update_at = NOW();
    `;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/dailytask error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const result = await sql`
      SELECT date, daily_task
      FROM daily_task
      ORDER BY date DESC
    `;
    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/dailytask error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }


}

