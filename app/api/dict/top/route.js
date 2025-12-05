import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    const topEntries = await sql`
      SELECT word, visits 
      FROM dictionary_entries 
      WHERE is_custom = true
      ORDER BY visits DESC 
      LIMIT ${limit}
    `;

    return NextResponse.json({
      entries: topEntries.map(entry => ({
        name: entry.word,
        visits: entry.visits
      }))
    });

  } catch (error) {
    console.error("DB Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch top entries" },
      { status: 500 }
    );
  }
}