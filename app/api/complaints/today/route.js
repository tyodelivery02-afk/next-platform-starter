import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

export async function GET() {
    try {
        const today = new Date().toISOString().split("T")[0];
        
        const rows = await sql`
            SELECT category, count, operator_ip, updated_at
            FROM complaint_records
            WHERE date = ${today}
        `;

        const data = {};
        const operators = {};
        rows.forEach(row => {
            data[row.category] = row.count;
            operators[row.category] = {
                ip: row.operator_ip,
                updatedAt: row.updated_at
            };
        });

        return NextResponse.json({ data, operators });
    } catch (error) {
        console.error("DB Error:", error);
        return NextResponse.json({ error: "データ取得失敗" }, { status: 500 });
    }
}