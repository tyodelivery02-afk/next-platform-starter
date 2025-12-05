// app/api/uranai/prokerala-token/route.js
import { NextResponse } from 'next/server';

export async function GET(request) {
  return handleRequest(request);
}

export async function POST(request) {
  return handleRequest(request);
}

export async function OPTIONS(request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

async function handleRequest(request) {
  try {
    const clientId = process.env.PROKERALA_CLIENT_ID;
    const clientSecret = process.env.PROKERALA_CLIENT_SECRET;
    
    console.log('Token API called');
    
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { 
          error: 'クライアント情報未設定',
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret
        },
        { status: 500 }
      );
    }

    // Token缓存
    if (!global.__prokerala_token_cache) {
      global.__prokerala_token_cache = {};
    }
    const cache = global.__prokerala_token_cache;

    // 检查缓存(提前30秒过期)
    if (cache.access_token && cache.expires_at && Date.now() < cache.expires_at - 30000) {
      console.log('Returning cached token');
      return NextResponse.json({ 
        access_token: cache.access_token,
        cached: true 
      });
    }

    console.log('Fetching new token...');

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    const tokenRes = await fetch('https://api.prokerala.com/token', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString(),
    });

    const text = await tokenRes.text();
    
    if (!tokenRes.ok) {
      console.error('Token fetch error:', text);
      return NextResponse.json(
        { error: 'Token取得失敗', detail: text },
        { status: 500 }
      );
    }

    const json = JSON.parse(text);

    if (!json.access_token) {
      return NextResponse.json(
        { error: 'アクセストークンなし', response: json },
        { status: 500 }
      );
    }

    // 保存缓存
    cache.access_token = json.access_token;
    cache.expires_at = Date.now() + (json.expires_in || 3600) * 1000;

    console.log('Token obtained successfully');

    return NextResponse.json({ 
      access_token: json.access_token,
      expires_in: json.expires_in,
      cached: false
    });

  } catch (err) {
    console.error('Token API Error:', err);
    return NextResponse.json(
      { error: '内部エラー', message: err.message },
      { status: 500 }
    );
  }
}