import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";

const sql = neon();

// 获取客户端真实IP的辅助函数
function getClientIP(request) {
    // 优先从 x-forwarded-for 获取（适用于代理/负载均衡环境）
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }
    
    // 其他常见的IP头
    const realIP = request.headers.get("x-real-ip");
    if (realIP) {
        return realIP;
    }
    
    // Cloudflare
    const cfIP = request.headers.get("cf-connecting-ip");
    if (cfIP) {
        return cfIP;
    }
    
    // 最后尝试从请求中获取
    return request.headers.get("x-forwarded-for") || 
           request.headers.get("remote-addr") || 
           "unknown";
}

export async function POST(req) {
    try {
        const records = await req.json();
        const operatorIP = getClientIP(req);
        
        for (const r of records) {
            await sql`
                INSERT INTO complaint_records (date, category, count, operator_ip)
                VALUES (${r.date}, ${r.category}, ${r.count}, ${operatorIP})
                ON CONFLICT (date, category)
                DO UPDATE SET
                    count = EXCLUDED.count,
                    operator_ip = EXCLUDED.operator_ip,
                    updated_at = NOW()
            `;
        }

        return NextResponse.json({ message: "OK" });
    } catch (error) {
        console.error("DB Error:", error);
        return NextResponse.json({ error: "保存失敗" }, { status: 500 });
    }
}