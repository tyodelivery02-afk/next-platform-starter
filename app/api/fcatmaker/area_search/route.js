import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon(); // 自动使用环境变量 NETLIFY_DATABASE_URL

// 获取全部地区
export async function GET() {
    const rows = await sql`SELECT * FROM area_search ORDER BY region_name`;

    const serializedRows = rows.map(row => ({
        id: Number(row.id),
        region_name: row.region_name,
        keywords: row.keywords
    }));

    return NextResponse.json(serializedRows);
}

export async function POST(request) {
    const data = await request.json();

    // 清空再插入
    await sql`TRUNCATE TABLE area_search RESTART IDENTITY`;

    for (const { region_name, keywords } of data) {
        await sql`
      INSERT INTO area_search (region_name, keywords)
      VALUES (${region_name}, ${JSON.stringify(keywords)}::jsonb)
    `;
    }

    return NextResponse.json({ ok: true });
}
