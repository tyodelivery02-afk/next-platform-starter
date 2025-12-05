// app/api/inventory/update/route.js
import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

export async function POST(req) {
  try {
    const { operationType, value } = await req.json();
    
    if (!['add', 'reset'].includes(operationType)) {
      return NextResponse.json({ error: "Invalid operation type" }, { status: 400 });
    }

    if (value === undefined || value === null || value < 0) {
      return NextResponse.json({ error: "Invalid value" }, { status: 400 });
    }

    const current = await sql`SELECT current_count FROM inventory_status LIMIT 1`;
    const previousCount = current[0]?.current_count || 0;
    
    let newCount, changeAmount;
    if (operationType === 'add') {
      newCount = previousCount + value;
      changeAmount = value;
    } else {
      newCount = value;
      changeAmount = value - previousCount;
    }

    await sql`
      UPDATE inventory_status 
      SET current_count = ${newCount}, 
          last_updated = NOW()
    `;

    await sql`
      INSERT INTO inventory_history (operation_type, previous_count, change_amount, new_count, operation_date)
      VALUES (${operationType}, ${previousCount}, ${changeAmount}, ${newCount}, CURRENT_DATE)
    `;

    return NextResponse.json({ 
      message: "Inventory updated", 
      operation_type: operationType,
      previous_count: previousCount,
      new_count: newCount 
    });
  } catch (error) {
    console.error("DB Error:", error);
    return NextResponse.json({ error: "Failed to update inventory" }, { status: 500 });
  }
}