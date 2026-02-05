import { NextResponse } from "next/server";
import { google } from 'googleapis';

export async function GET(request) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.BASE_URL2}/api/google-drive/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Google credentials not configured" },
        { status: 500 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // 生成授权URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file'],
      prompt: 'consent'
    });

    return NextResponse.json({ authUrl });
  } catch (err) {
    console.error("GET /api/google-drive/authorize error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}