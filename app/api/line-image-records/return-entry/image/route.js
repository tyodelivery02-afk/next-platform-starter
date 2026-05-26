import { NextResponse } from "next/server";
// import { neon } from "@netlify/neon";
import { sql } from "@/app/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// const sql = neon();

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const id = Number(searchParams.get("id"));

        if (!Number.isFinite(id) || id <= 0) {
            return NextResponse.json(
                { success: false, error: "invalid id" },
                { status: 400 }
            );
        }

        const rows = await sql`
      SELECT
        image_base64,
        image_mime_type
      FROM line_image_records
      WHERE id = ${id}
      LIMIT 1
    `;

        const row = rows[0];

        if (!row?.image_base64) {
            return NextResponse.json(
                { success: false, error: "image not found" },
                { status: 404 }
            );
        }

        const imageBuffer = Buffer.from(row.image_base64, "base64");
        const mimeType = row.image_mime_type || "image/jpeg";

        return new NextResponse(imageBuffer, {
            status: 200,
            headers: {
                "Content-Type": mimeType,
                "Cache-Control": "private, max-age=300",
            },
        });
    } catch (error) {
        console.error("Return entry image GET error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "画像取得失敗",
                detail: error.message,
            },
            { status: 500 }
        );
    }
}