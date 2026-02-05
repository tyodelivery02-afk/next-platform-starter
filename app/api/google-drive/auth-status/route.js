import { NextResponse } from "next/server";
import { google } from 'googleapis';

export async function GET(request) {
  try {
    // 从环境变量获取凭证
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL}/api/google-drive/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { authorized: false, error: "Google credentials not configured" },
        { status: 200 }
      );
    }

    // 检查是否有存储的令牌
    // 这里简化处理,实际应该从数据库或session中获取
    const hasToken = !!process.env.GOOGLE_REFRESH_TOKEN;

    return NextResponse.json({ authorized: hasToken });
  } catch (err) {
    console.error("GET /api/google-drive/auth-status error:", err);
    return NextResponse.json({ authorized: false }, { status: 200 });
  }
}