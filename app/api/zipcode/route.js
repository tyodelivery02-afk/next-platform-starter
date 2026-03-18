import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const localGovCode = searchParams.get("localGovCode");

        if (!localGovCode) {
            return NextResponse.json(
                { error: "localGovCode は必須です" },
                { status: 400 }
            );
        }

        // 住所郵便番号（zipcode テーブル）
        const residenceRows = await sql`
            SELECT DISTINCT zip_code, city_kanji, town_kanji
            FROM zipcode
            WHERE local_government_code = ${localGovCode}
            ORDER BY zip_code
        `;

        // 事務所郵便番号（jigyosyo_zipcode テーブル）
        const officeRows = await sql`
            SELECT DISTINCT zip_code, city_kanji, office_name_kanji, town_kanji, street_address_kanji
            FROM jigyosyo_zipcode
            WHERE local_government_code = ${localGovCode}
            ORDER BY zip_code
        `;

        const zipcodes = [
            ...residenceRows.map(r => ({
                zipcode: r.zip_code,
                city: r.city_kanji || "",
                town: r.town_kanji || "",
                flag: 1   // 住所
            })),
            ...officeRows.map(r => ({
                zipcode: r.zip_code,
                city: r.city_kanji || "",
                town: [r.office_name_kanji, r.town_kanji, r.street_address_kanji]
                    .filter(Boolean)
                    .join(" "),
                flag: 2   // 事務所
            }))
        ];

        return NextResponse.json({ success: true, zipcodes });

    } catch (error) {
        console.error("DB Error:", error);
        return NextResponse.json(
            { success: false, error: "DB query failed" },
            { status: 500 }
        );
    }
}