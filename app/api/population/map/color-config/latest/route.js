import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

export async function GET() {
    try {
        const latestVersionResult = await sql`
      SELECT MAX(version_id) AS version_id
      FROM map_color_config
    `;

        const latestVersionId = latestVersionResult[0]?.version_id;

        if (!latestVersionId) {
            return NextResponse.json({
                success: true,
                colorNames: {}
            });
        }

        const rows = await sql`
      SELECT color_id, color_name
      FROM map_color_config
      WHERE version_id = ${latestVersionId}
    `;

        const colorNames = Object.fromEntries(
            rows.map((row) => [row.color_id, row.color_name])
        );

        return NextResponse.json({
            success: true,
            versionId: latestVersionId,
            colorNames
        });
    } catch (error) {
        console.error("DB Error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}