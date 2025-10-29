import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

export async function GET() {
  try {
    // 获取服务器时间
    const timeRes = await fetch(`${process.env.URL}/api/servertime`);
    const { serverTime } = await timeRes.json();
    const today = serverTime.split("T")[0]; // 仅取日期部分

    // 查询当天所有记录
    const result = await sql`
      SELECT trolley_id, status, am_pm
      FROM momo_trolley_records
      WHERE date = ${today};
    `;

    // 生成数据结构 { 1: { trolley_id: status }, 2: { trolley_id: status } }
    const formatted = { 1: {}, 2: {} };
    result.forEach((r) => {
      formatted[r.am_pm][r.trolley_id] = r.status;
    });

    return NextResponse.json({ date: today, data: formatted });
  } catch (err) {
    console.error("selecttoday error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
