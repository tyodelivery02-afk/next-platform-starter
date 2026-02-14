import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon(); // 自动读取 NETLIFY_DATABASE_URL

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);

        const prefName = searchParams.get("prefName");
        const cityName = searchParams.get("cityName");

        if (!prefName || !cityName) {
            return NextResponse.json(
                { error: "prefName と cityName は必須です" },
                { status: 400 }
            );
        }

        // 查询这个区下的所有邮编
        const rows = await sql`
            SELECT DISTINCT zipcode, town_name, flag
            FROM zipcodes
            WHERE pref_name = ${prefName}
                AND city_name = ${cityName}
            ORDER BY flag, zipcode
        `;

        return NextResponse.json({
            success: true,
            zipcodes: rows.map(r => ({
                zipcode: r.zipcode,
                town: r.town_name,
                flag: r.flag
            }))
        });

    } catch (error) {
        console.error("DB Error:", error);
        return NextResponse.json(
            { success: false, error: "DB query failed" },
            { status: 500 }
        );
    }
}
