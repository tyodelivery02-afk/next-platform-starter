import { NextResponse } from "next/server";
import { google } from 'googleapis';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.redirect(new URL('/?error=no_code', request.url));
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL}/api/google-drive/callback`;

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // 获取令牌
    const { tokens } = await oauth2Client.getToken(code);
    
    // 这里应该将tokens保存到数据库或安全存储中
    // 简化处理:仅在环境变量中设置(实际生产环境不应该这样做)
    console.log('Refresh Token:', tokens.refresh_token);
    console.log('Access Token:', tokens.access_token);

    // 提示用户将refresh_token设置到环境变量
    // 在实际应用中,应该保存到数据库或session中
    
    return NextResponse.redirect(new URL('/?google_auth=success', request.url));
  } catch (err) {
    console.error("GET /api/google-drive/callback error:", err);
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url));
  }
}