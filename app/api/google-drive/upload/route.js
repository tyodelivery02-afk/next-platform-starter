import { NextResponse } from "next/server";
import { google } from 'googleapis';
import { Readable } from 'stream';

export async function POST(request) {
  try {
    const body = await request.json();
    const { fileName, fileData, mimeType } = body;

    if (!fileName || !fileData) {
      return NextResponse.json(
        { error: "Missing fileName or fileData" },
        { status: 400 }
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL}/api/google-drive/callback`;

    if (!clientId || !clientSecret || !refreshToken) {
      return NextResponse.json(
        { error: "Google credentials not configured" },
        { status: 500 }
      );
    }

    // 设置OAuth2客户端
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // 将Base64转换为Buffer
    const buffer = Buffer.from(fileData, 'base64');
    
    // 创建可读流
    const bufferStream = new Readable();
    bufferStream.push(buffer);
    bufferStream.push(null);

    // 上传文件到Google Drive
    const fileMetadata = {
      name: fileName,
    };

    const media = {
      mimeType: mimeType || 'text/csv',
      body: bufferStream,
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink',
    });

    return NextResponse.json({
      fileId: response.data.id,
      fileName: response.data.name,
      webViewLink: response.data.webViewLink,
    });
  } catch (err) {
    console.error("POST /api/google-drive/upload error:", err);
    return NextResponse.json(
      { error: err.message || 'Upload failed' },
      { status: 500 }
    );
  }
}