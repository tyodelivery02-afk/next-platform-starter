import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon(); // 自动使用环境变量 NETLIFY_DATABASE_URL

export async function POST(req) {
    try {
        const records = await req.json();

        for (const r of records) {
            await sql`
        INSERT INTO momo_trolley_records (date, trolley_id, am_pm, status, updater)
        VALUES (${r.date}, ${r.trolley_id}, ${r.am_pm}, ${r.status}, ${r.updater})
        ON CONFLICT (date, trolley_id, am_pm)
        DO UPDATE SET
          status = EXCLUDED.status,
          updater = EXCLUDED.updater,
          updated_at = NOW();
      `;
        }

        return NextResponse.json({ message: "OK" });
    } catch (error) {
        console.error("DB Error:", error);
        return NextResponse.json({ error: "DB insert failed" }, { status: 500 });
    }
}
