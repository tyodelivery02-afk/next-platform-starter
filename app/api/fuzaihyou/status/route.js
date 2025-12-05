// app/api/inventory/status/route.js
import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

export async function GET() {
  try {
    const result = await sql`
      SELECT current_count, last_updated 
      FROM inventory_status 
      LIMIT 1
    `;
    
    return NextResponse.json(result[0] || { current_count: 0, last_updated: null });
  } catch (error) {
    console.error("DB Error:", error);
    return NextResponse.json({ error: "Failed to fetch inventory status" }, { status: 500 });
  }
}