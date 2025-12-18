import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();
const PAGE_SIZE = 10;

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const offset = (page - 1) * PAGE_SIZE;

    const items = await sql`
        SELECT *
        FROM monitored_items
        ORDER BY published_at DESC NULLS LAST
        LIMIT ${PAGE_SIZE}
        OFFSET ${offset}
    `;

    const totalRows = await sql`
        SELECT COUNT(*)::int AS count
        FROM monitored_items
    `;

    return NextResponse.json({
        items,
        page,
        pageSize: PAGE_SIZE,
        total: totalRows[0].count
    });
}
