import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const period = searchParams.get("period") || "today";
        
        const today = new Date();
        let startDate;
        
        if (period === "today") {
            startDate = today.toISOString().split("T")[0];
        } else if (period === "month") {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
        } else if (period === "year") {
            startDate = new Date(today.getFullYear(), 0, 1).toISOString().split("T")[0];
        }
        
        const endDate = today.toISOString().split("T")[0];
        
        const rows = await sql`
            SELECT category, SUM(count) as total
            FROM complaint_records
            WHERE date >= ${startDate} AND date <= ${endDate}
            GROUP BY category
        `;

        const data = {};
        rows.forEach(row => {
            data[row.category] = parseInt(row.total);
        });

        return NextResponse.json({ data });
    } catch (error) {
        console.error("DB Error:", error);
        return NextResponse.json({ error: "統計データ取得失敗" }, { status: 500 });
    }
}