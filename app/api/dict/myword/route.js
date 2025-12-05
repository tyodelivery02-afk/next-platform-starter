import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

// 获取客户端真实IP
function getClientIP(req) {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIP = req.headers.get("x-real-ip");
  
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  return "unknown";
}

// GET - 搜索词条（支持模糊搜索）
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const word = searchParams.get("word");

    if (!word || !word.trim()) {
      return NextResponse.json(
        { error: "Word parameter is required" },
        { status: 400 }
      );
    }

    const wordLower = word.trim().toLowerCase();

    // 先尝试精确匹配
    const exactMatch = await sql`
      SELECT * FROM dictionary_entries 
      WHERE word_lower = ${wordLower}
      LIMIT 1
    `;

    if (exactMatch.length > 0) {
      const entry = exactMatch[0];
      
      // 增加访问次数
      await sql`
        UPDATE dictionary_entries 
        SET visits = visits + 1 
        WHERE id = ${entry.id}
      `;

      return NextResponse.json({
        word: entry.word,
        meanings: entry.meanings,
        translations: entry.translations,
        isCustom: entry.is_custom,
        creatorIP: entry.creator_ip,
        updaterIP: entry.updater_ip,
        visits: entry.visits + 1,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at
      });
    }

    // 如果没有精确匹配，返回未找到
    return NextResponse.json(
      { error: "Word not found" },
      { status: 404 }
    );

  } catch (error) {
    console.error("DB Error:", error);
    return NextResponse.json(
      { error: "Failed to search dictionary" },
      { status: 500 }
    );
  }
}

// POST - 创建自定义词条
export async function POST(req) {
  try {
    const body = await req.json();
    const { word, meanings, translations } = body;

    if (!word || !word.trim()) {
      return NextResponse.json(
        { error: "Word is required" },
        { status: 400 }
      );
    }

    const wordLower = word.trim().toLowerCase();
    const clientIP = getClientIP(req);

    // 检查词条是否已存在
    const existing = await sql`
      SELECT id FROM dictionary_entries 
      WHERE word_lower = ${wordLower}
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Word already exists. Use PUT to update." },
        { status: 409 }
      );
    }

    // 插入新词条
    const result = await sql`
      INSERT INTO dictionary_entries 
      (word, word_lower, meanings, translations, creator_ip, updater_ip, is_custom)
      VALUES (
        ${word.trim()},
        ${wordLower},
        ${JSON.stringify(meanings)},
        ${JSON.stringify(translations)},
        ${clientIP},
        ${clientIP},
        true
      )
      RETURNING *
    `;

    const entry = result[0];

    return NextResponse.json({
      success: true,
      entry: {
        word: entry.word,
        meanings: entry.meanings,
        translations: entry.translations,
        isCustom: entry.is_custom,
        creatorIP: entry.creator_ip,
        visits: entry.visits,
        createdAt: entry.created_at
      }
    }, { status: 201 });

  } catch (error) {
    console.error("DB Error:", error);
    return NextResponse.json(
      { error: "Failed to create entry" },
      { status: 500 }
    );
  }
}

// PUT - 更新自定义词条
export async function PUT(req) {
  try {
    const body = await req.json();
    const { word, meanings, translations } = body;

    if (!word || !word.trim()) {
      return NextResponse.json(
        { error: "Word is required" },
        { status: 400 }
      );
    }

    const wordLower = word.trim().toLowerCase();
    const clientIP = getClientIP(req);

    // 检查词条是否存在
    const existing = await sql`
      SELECT id, is_custom FROM dictionary_entries 
      WHERE word_lower = ${wordLower}
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Word not found" },
        { status: 404 }
      );
    }

    if (!existing[0].is_custom) {
      return NextResponse.json(
        { error: "Cannot update non-custom entries" },
        { status: 403 }
      );
    }

    // 更新词条
    const result = await sql`
      UPDATE dictionary_entries 
      SET 
        meanings = ${JSON.stringify(meanings)},
        translations = ${JSON.stringify(translations)},
        updater_ip = ${clientIP},
        updated_at = CURRENT_TIMESTAMP
      WHERE word_lower = ${wordLower}
      RETURNING *
    `;

    const entry = result[0];

    return NextResponse.json({
      success: true,
      entry: {
        word: entry.word,
        meanings: entry.meanings,
        translations: entry.translations,
        isCustom: entry.is_custom,
        updaterIP: entry.updater_ip,
        visits: entry.visits,
        updatedAt: entry.updated_at
      }
    });

  } catch (error) {
    console.error("DB Error:", error);
    return NextResponse.json(
      { error: "Failed to update entry" },
      { status: 500 }
    );
  }
}