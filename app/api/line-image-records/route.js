import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);

        const page = parseInt(searchParams.get("page") || "1", 10);
        const eNumber = searchParams.get("eNumber");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        const limit = 50;
        const offset = (page - 1) * limit;

        let rows;
        let countRows;

        if (eNumber && startDate && endDate) {
            countRows = await sql`
        SELECT COUNT(*) AS total
        FROM line_image_records
        WHERE e_number = ${eNumber}
          AND message_time >= ${startDate}
          AND message_time <= ${endDate}
      `;

            rows = await sql`
        SELECT
          id,
          message_time,
          e_number,
          image_info,
          line_message_id,
          group_id,
          user_id,
          created_at
        FROM line_image_records
        WHERE e_number = ${eNumber}
          AND message_time >= ${startDate}
          AND message_time <= ${endDate}
        ORDER BY message_time DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
        } else if (eNumber) {
            countRows = await sql`
        SELECT COUNT(*) AS total
        FROM line_image_records
        WHERE e_number = ${eNumber}
      `;

            rows = await sql`
        SELECT
          id,
          message_time,
          e_number,
          image_info,
          line_message_id,
          group_id,
          user_id,
          created_at
        FROM line_image_records
        WHERE e_number = ${eNumber}
        ORDER BY message_time DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
        } else if (startDate && endDate) {
            countRows = await sql`
        SELECT COUNT(*) AS total
        FROM line_image_records
        WHERE message_time >= ${startDate}
          AND message_time <= ${endDate}
      `;

            rows = await sql`
        SELECT
          id,
          message_time,
          e_number,
          image_info,
          line_message_id,
          group_id,
          user_id,
          created_at
        FROM line_image_records
        WHERE message_time >= ${startDate}
          AND message_time <= ${endDate}
        ORDER BY message_time DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
        } else {
            countRows = await sql`
        SELECT COUNT(*) AS total
        FROM line_image_records
      `;

            rows = await sql`
        SELECT
          id,
          message_time,
          e_number,
          image_info,
          line_message_id,
          group_id,
          user_id,
          created_at
        FROM line_image_records
        ORDER BY message_time DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
        }

        const total = parseInt(countRows[0]?.total || 0, 10);

        return NextResponse.json({
            success: true,
            records: rows.map((row) => ({
                id: row.id,
                messageTime: row.message_time,
                eNumber: row.e_number,
                imageInfo: row.image_info,
                lineMessageId: row.line_message_id,
                groupId: row.group_id,
                userId: row.user_id,
                createdAt: row.created_at,
            })),
            totalPages: Math.ceil(total / limit),
            currentPage: page,
        });
    } catch (error) {
        console.error("Line Image Records GET Error:", error);

        return NextResponse.json(
            { error: "画像記録取得失敗" },
            { status: 500 }
        );
    }
}