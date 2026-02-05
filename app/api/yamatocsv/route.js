import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

// === 获取CSV规则 ===
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");
  const city = searchParams.get("city");
  const type = searchParams.get("type");

  if (!mode || !city || !type) {
    return NextResponse.json(
      { error: "Missing required parameters: mode, city, type" },
      { status: 400 }
    );
  }

  try {
    const result = await sql`
      SELECT id, mode, city, type, rules, created_at, updated_at
      FROM csv_rules
      WHERE mode = ${mode} AND city = ${city} AND type = ${type}
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    if (result.length === 0) {
      return NextResponse.json({ rules: [] });
    }

    // rules字段已经是JSONB类型,会自动解析为JavaScript对象/数组
    const rules = typeof result[0].rules === 'string' 
      ? JSON.parse(result[0].rules) 
      : result[0].rules;

    return NextResponse.json({
      rules: rules || []
    });
  } catch (err) {
    console.error("GET /api/yamatocsv error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// === 保存CSV规则 ===
export async function POST(request) {
  try {
    const body = await request.json();
    const { mode, city, type, rules } = body;

    if (!mode || !city || !type) {
      return NextResponse.json(
        { error: "Missing required fields: mode, city, type" },
        { status: 400 }
      );
    }

    if (!Array.isArray(rules)) {
      return NextResponse.json(
        { error: "Rules must be an array" },
        { status: 400 }
      );
    }

    // 将规则数组转换为JSON字符串
    const rulesJson = JSON.stringify(rules);

    // 检查是否已存在记录
    const existing = await sql`
      SELECT id FROM csv_rules
      WHERE mode = ${mode} AND city = ${city} AND type = ${type}
    `;

    let result;
    if (existing.length > 0) {
      // 更新现有记录
      result = await sql`
        UPDATE csv_rules
        SET rules = ${rulesJson}::jsonb,
            updated_at = NOW()
        WHERE mode = ${mode} AND city = ${city} AND type = ${type}
        RETURNING id, mode, city, type, rules, updated_at
      `;
    } else {
      // 插入新记录
      result = await sql`
        INSERT INTO csv_rules (mode, city, type, rules)
        VALUES (${mode}, ${city}, ${type}, ${rulesJson}::jsonb)
        RETURNING id, mode, city, type, rules, created_at, updated_at
      `;
    }

    // 返回结果,确保rules字段被正确解析
    const savedData = result[0];
    const parsedRules = typeof savedData.rules === 'string' 
      ? JSON.parse(savedData.rules) 
      : savedData.rules;

    return NextResponse.json({
      ...savedData,
      rules: parsedRules
    });
  } catch (err) {
    console.error("POST /api/yamatocsv error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// === 删除CSV规则 ===
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");
  const city = searchParams.get("city");
  const type = searchParams.get("type");

  if (!mode || !city || !type) {
    return NextResponse.json(
      { error: "Missing required parameters: mode, city, type" },
      { status: 400 }
    );
  }

  try {
    const result = await sql`
      DELETE FROM csv_rules
      WHERE mode = ${mode} AND city = ${city} AND type = ${type}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "No rules found to delete" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Rules deleted successfully",
      id: result[0].id
    });
  } catch (err) {
    console.error("DELETE /api/yamatocsv error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}