// app/api/announcements/route.js
import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon(process.env.NETLIFY_DATABASE_URL);

function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

export async function GET() {
  try {
    const result = await sql`
      SELECT id, content, created_at, updated_at, created_ip, updated_ip
      FROM announcements
      WHERE state = 1
      ORDER BY created_at DESC
    `;

    const rows = Array.isArray(result) ? result : (result?.rows ?? []);
    
    const serializable = rows.map((r) => ({
      id: r.id,
      content: r.content || "",
      created_at: r.created_at,
      updated_at: r.updated_at,
      created_ip: r.created_ip || "未記録",
      updated_ip: r.updated_ip || "未記録",
    }));

    return NextResponse.json(serializable);
  } catch (err) {
    console.error("❌ GET /api/announcements error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { id, content } = body;
    const ip = getClientIp(request);

    if (!content || !content.trim()) {
      return NextResponse.json({ 
        success: false, 
        error: "内容不能为空" 
      }, { status: 400 });
    }

    const trimmedContent = content.trim();

    if (id) {
      // 更新现有公告
      await sql`
        UPDATE announcements 
        SET content = ${trimmedContent}, 
            updated_at = CURRENT_TIMESTAMP,
            updated_ip = ${ip}
        WHERE id = ${id}
      `;
      
      return NextResponse.json({ success: true, id });
    } else {
      // 插入新公告
      const result = await sql`
        INSERT INTO announcements (content, created_ip, updated_ip, state)
        VALUES (${trimmedContent}, ${ip}, ${ip}, 1)
        RETURNING id
      `;
      
      const newId = result[0]?.id;
      return NextResponse.json({ success: true, id: newId });
    }
  } catch (err) {
    console.error("❌ POST /api/announcements error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: "缺少公告 ID" 
      }, { status: 400 });
    }

    // 逻辑删除：将 state 设置为 0
    await sql`
      UPDATE announcements 
      SET state = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ DELETE /api/announcements error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}