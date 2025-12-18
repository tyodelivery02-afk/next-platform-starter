import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();
const PAGE_SIZE = 10;

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const offset = (page - 1) * PAGE_SIZE;

    const logs = await sql`
        SELECT
            id,
            status,
            twitter_count,
            news_count,
            total_count,
            errors,
            duration_ms,
            triggered_by,
            created_at
        FROM cron_logs
        ORDER BY created_at DESC
        LIMIT ${PAGE_SIZE}
        OFFSET ${offset}
    `;

    const totalRows = await sql`
        SELECT COUNT(*)::int AS count
        FROM cron_logs
    `;

    const statsRows = await sql`
        SELECT
            COUNT(*) AS total_runs,
            COUNT(*) FILTER (WHERE status = 'success') AS success_count,
            COALESCE(SUM(total_count), 0) AS total_items_collected,
            COALESCE(AVG(duration_ms), 0) AS avg_duration_ms
        FROM cron_logs
    `;

    return NextResponse.json({
        logs,
        stats: statsRows[0] || null,
        page,
        pageSize: PAGE_SIZE,
        total: totalRows[0].count
    });
}
