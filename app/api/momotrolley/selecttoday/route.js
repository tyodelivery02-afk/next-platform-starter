import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

export async function GET() {
  try {
    // 获取服务器时间
    const timeRes = await fetch(`${process.env.URL}/api/servertime`);
    const { serverTime } = await timeRes.json();
    const today = serverTime.split("T")[0]; // 仅取日期部分

    // 查询当天所有记录（包含 updater）
    const result = await sql`
      SELECT DISTINCT trolley_id, status, am_pm, updater
      FROM momo_trolley_records
      WHERE date = ${today};
    `;

    // 生成数据结构
    // data: { 1: { trolley_id: status }, 2: { trolley_id: status } }
    // updaters: { 1: "updater_name", 2: "updater_name" }
    const formatted = { 1: {}, 2: {} };
    const updaters = { 1: null, 2: null };
    
    result.forEach((r) => {
      formatted[r.am_pm][r.trolley_id] = r.status;
      // 记录每个时间段的更新者（取第一个非空的）
      if (!updaters[r.am_pm] && r.updater) {
        updaters[r.am_pm] = r.updater;
      }
    });

    return NextResponse.json({ 
      date: today, 
      data: formatted,
      updaters: updaters  // 新增返回更新者信息
    });
  } catch (err) {
    console.error("selecttoday error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}