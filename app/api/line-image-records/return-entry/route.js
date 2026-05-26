import { NextResponse } from "next/server";
// import { neon } from "@netlify/neon";
import { sql } from "@/app/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// const sql = neon();

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);

        const limit = Math.min(
            50,
            Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
        );

        const rows = await sql`
      SELECT
        id,
        message_time,
        e_number,
        image_mime_type,
        states,
        created_at,
        CASE
          WHEN image_base64 IS NULL OR image_base64 = '' THEN false
          ELSE true
        END AS has_image
      FROM line_image_records
      WHERE states = 0
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

        return NextResponse.json({
            success: true,
            records: rows.map(row => ({
                id: row.id,
                messageTime: row.message_time,
                eNumber: row.e_number,
                imageMimeType: row.image_mime_type || "image/jpeg",
                hasImage: row.has_image,
                states: row.states,
                createdAt: row.created_at,
            })),
        });
    } catch (error) {
        console.error("Return entry GET error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "return entry取得失敗",
                detail: error.message,
            },
            { status: 500 }
        );
    }
}

export async function PATCH(req) {
    try {
        const body = await req.json();
        const id = Number(body.id);

        if (!Number.isFinite(id) || id <= 0) {
            return NextResponse.json(
                { success: false, error: "invalid id" },
                { status: 400 }
            );
        }

        const rows = await sql`
      UPDATE line_image_records
      SET states = 1
      WHERE id = ${id}
      RETURNING id, e_number, states
    `;

        return NextResponse.json({
            success: true,
            data: rows[0] || null,
        });
    } catch (error) {
        console.error("Return entry PATCH error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "return entry更新失敗",
                detail: error.message,
            },
            { status: 500 }
        );
    }
}