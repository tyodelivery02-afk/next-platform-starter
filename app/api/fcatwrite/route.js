// app/api/fcatwrite/route.js
import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

// 获取客户端IP地址
function getClientIP(req) {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIP = req.headers.get("x-real-ip");
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  return req.headers.get("x-client-ip") || "unknown";
}

// 获取预测记录
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit')) || 100;
    const offset = parseInt(searchParams.get('offset')) || 0;

    let records;
    let total = 0;

    if (date) {
      // 获取指定日期的记录
      records = await sql`
        SELECT * FROM forecast_records 
        WHERE date = ${date}
      `;
      total = records.length;
    } else if (startDate && endDate) {
      // 获取日期范围内的记录总数
      const countResult = await sql`
        SELECT COUNT(*) as count FROM forecast_records
        WHERE date >= ${startDate} AND date <= ${endDate}
      `;
      total = parseInt(countResult[0].count);

      // 获取日期范围内的分页记录
      records = await sql`
        SELECT * FROM forecast_records 
        WHERE date >= ${startDate} AND date <= ${endDate}
        ORDER BY date DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (startDate) {
      // 只有开始日期
      const countResult = await sql`
        SELECT COUNT(*) as count FROM forecast_records
        WHERE date >= ${startDate}
      `;
      total = parseInt(countResult[0].count);

      records = await sql`
        SELECT * FROM forecast_records 
        WHERE date >= ${startDate}
        ORDER BY date DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (endDate) {
      // 只有结束日期
      const countResult = await sql`
        SELECT COUNT(*) as count FROM forecast_records
        WHERE date <= ${endDate}
      `;
      total = parseInt(countResult[0].count);

      records = await sql`
        SELECT * FROM forecast_records 
        WHERE date <= ${endDate}
        ORDER BY date DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      // 获取记录总数
      const countResult = await sql`
        SELECT COUNT(*) as count FROM forecast_records
      `;
      total = parseInt(countResult[0].count);

      // 获取分页记录
      records = await sql`
        SELECT * FROM forecast_records 
        ORDER BY date DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
    }
    
    return NextResponse.json({ 
      success: true, 
      data: records,
      total: total,
      limit: limit,
      offset: offset
    });
  } catch (error) {
    console.error("DB Error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch forecast records" }, { status: 500 });
  }
}

// 保存或更新预测记录
export async function POST(req) {
  try {
    const data = await req.json();
    const {
      date,
      cainiao_kix_tokyo_forecast,
      cainiao_kix_osaka_forecast,
      cainiao_kix_tokyo_actual,
      cainiao_kix_osaka_actual,
      cn_center,
      trolley_count,
      box_count,
      box_unit,
      delivery_count
    } = data;

    if (!date) {
      return NextResponse.json({ success: false, error: "日付が必要です" }, { status: 400 });
    }

    // 获取客户端IP
    const clientIP = getClientIP(req);

    // 使用 UPSERT (ON CONFLICT)
    const result = await sql`
      INSERT INTO forecast_records (
        date, 
        cainiao_kix_tokyo_forecast,
        cainiao_kix_osaka_forecast,
        cainiao_kix_tokyo_actual,
        cainiao_kix_osaka_actual,
        cn_center,
        trolley_count,
        box_count,
        box_unit,
        delivery_count,
        operator_ip,
        updated_at
      )
      VALUES (
        ${date},
        ${cainiao_kix_tokyo_forecast || 0},
        ${cainiao_kix_osaka_forecast || 0},
        ${cainiao_kix_tokyo_actual || 0},
        ${cainiao_kix_osaka_actual || 0},
        ${cn_center || 0},
        ${trolley_count || 0},
        ${box_count || 0},
        ${box_unit || 0},
        ${delivery_count || 0},
        ${clientIP},
        NOW()
      )
      ON CONFLICT (date) 
      DO UPDATE SET
        cainiao_kix_tokyo_forecast = EXCLUDED.cainiao_kix_tokyo_forecast,
        cainiao_kix_osaka_forecast = EXCLUDED.cainiao_kix_osaka_forecast,
        cainiao_kix_tokyo_actual = EXCLUDED.cainiao_kix_tokyo_actual,
        cainiao_kix_osaka_actual = EXCLUDED.cainiao_kix_osaka_actual,
        cn_center = EXCLUDED.cn_center,
        trolley_count = EXCLUDED.trolley_count,
        box_count = EXCLUDED.box_count,
        box_unit = EXCLUDED.box_unit,
        delivery_count = EXCLUDED.delivery_count,
        operator_ip = EXCLUDED.operator_ip,
        updated_at = NOW()
      RETURNING *
    `;

    return NextResponse.json({ 
      success: true, 
      message: "保存成功",
      data: result[0]
    });
  } catch (error) {
    console.error("DB Error:", error);
    return NextResponse.json({ success: false, error: "保存に失敗しました" }, { status: 500 });
  }
}