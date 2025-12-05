// app/api/delivery/route.js
import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

// 获取所有引渡记录
export async function GET() {
  try {
    const records = await sql`
      SELECT id, delivery_date, delivery_count, company, recipient, person, created_at
      FROM delivery_records
      ORDER BY delivery_date DESC, created_at DESC
    `;
    
    return NextResponse.json(records);
  } catch (error) {
    console.error("DB Error:", error);
    return NextResponse.json({ error: "Failed to fetch delivery records" }, { status: 500 });
  }
}

// 保存引渡记录
export async function POST(req) {
  try {
    const { deliveryDate, deliveryCount, company, recipient, person } = await req.json();
    
    if (!deliveryDate || !deliveryCount || !company) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (deliveryCount <= 0) {
      return NextResponse.json({ error: "Invalid delivery count" }, { status: 400 });
    }

    const current = await sql`SELECT current_count FROM inventory_status LIMIT 1`;
    const currentCount = current[0]?.current_count || 0;
    
    if (deliveryCount > currentCount) {
      return NextResponse.json({ error: "Insufficient inventory" }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO delivery_records (delivery_date, delivery_count, company, recipient, person)
      VALUES (${deliveryDate}, ${deliveryCount}, ${company}, ${recipient || null}, ${person || null})
      RETURNING id, delivery_date, delivery_count, company, recipient, person, created_at
    `;

    const newCount = currentCount - deliveryCount;
    await sql`
      UPDATE inventory_status 
      SET current_count = ${newCount}, 
          last_updated = NOW()
    `;

    return NextResponse.json({ 
      message: "Delivery record saved", 
      record: result[0],
      new_inventory_count: newCount
    });
  } catch (error) {
    console.error("DB Error:", error);
    return NextResponse.json({ error: "Failed to save delivery record" }, { status: 500 });
  }
}