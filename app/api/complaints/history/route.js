import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    
    const limit = 20; // 每页显示20个日期
    const offset = (page - 1) * limit;

    let countQuery;
    let dateQuery;

    // 构建查询条件
    if (startDate && endDate) {
      countQuery = sql`
        SELECT COUNT(DISTINCT date) as total 
        FROM complaint_records 
        WHERE date >= ${startDate} AND date <= ${endDate}
      `;
      dateQuery = sql`
        SELECT DISTINCT date 
        FROM complaint_records 
        WHERE date >= ${startDate} AND date <= ${endDate}
        ORDER BY date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (startDate) {
      countQuery = sql`
        SELECT COUNT(DISTINCT date) as total 
        FROM complaint_records 
        WHERE date >= ${startDate}
      `;
      dateQuery = sql`
        SELECT DISTINCT date 
        FROM complaint_records 
        WHERE date >= ${startDate}
        ORDER BY date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (endDate) {
      countQuery = sql`
        SELECT COUNT(DISTINCT date) as total 
        FROM complaint_records 
        WHERE date <= ${endDate}
      `;
      dateQuery = sql`
        SELECT DISTINCT date 
        FROM complaint_records 
        WHERE date <= ${endDate}
        ORDER BY date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      countQuery = sql`
        SELECT COUNT(DISTINCT date) as total 
        FROM complaint_records
      `;
      dateQuery = sql`
        SELECT DISTINCT date 
        FROM complaint_records 
        ORDER BY date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    // 获取总日期数
    const countResult = await countQuery;
    const totalDates = parseInt(countResult[0]?.total || 0);

    // 获取当前页的日期列表
    const dates = await dateQuery;
    
    // 如果没有日期数据,直接返回空结果
    if (dates.length === 0) {
      return NextResponse.json({
        data: {},
        totalPages: Math.ceil(totalDates / limit),
        currentPage: page
      });
    }

    // 获取这些日期的所有记录
    const dateList = dates.map(d => d.date);
    const dataQuery = sql`
      SELECT date, category, count, operator_ip, updated_at 
      FROM complaint_records 
      WHERE date = ANY(${dateList})
      ORDER BY date DESC, category
    `;

    const rows = await dataQuery;

    // 按日期分组
    const groupedData = {};
    rows.forEach(row => {
      const dateKey = row.date;
      if (!groupedData[dateKey]) groupedData[dateKey] = [];
      groupedData[dateKey].push({
        category: row.category,
        count: row.count,
        operatorIp: row.operator_ip,
        updatedAt: row.updated_at
      });
    });

    return NextResponse.json({
      data: groupedData,
      totalPages: Math.ceil(totalDates / limit),
      currentPage: page
    });

  } catch (error) {
    console.error("DB Error:", error);
    return NextResponse.json(
      { error: "履歴データ取得失敗" }, 
      { status: 500 }
    );
  }
}