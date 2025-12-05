// app/api/uranai/panchang/route.js
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
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '';
    const latitude = searchParams.get('latitude') || '35.6762';
    const longitude = searchParams.get('longitude') || '139.6503';
    const timezone = searchParams.get('timezone') || 'Asia/Tokyo';

    console.log('Panchang API called:', { date, latitude, longitude, timezone });

    // 获取token
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host');
    const baseUrl = process.env.BASE_URL || `${protocol}://${host}`;
    
    const tokenRes = await fetch(`${baseUrl}/api/uranai/prokerala-token`);
    
    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error('Token fetch failed:', errorText);
      return NextResponse.json(
        { error: 'Token取得失敗', detail: errorText },
        { status: 500 }
      );
    }

    const tokenData = await tokenRes.json();
    
    if (!tokenData.access_token) {
      return NextResponse.json(
        { error: 'アクセストークンなし' },
        { status: 500 }
      );
    }

    console.log('Token obtained');

    // 构建日期时间
    let datetime;
    if (date) {
      datetime = `${date}T00:00:00`;
    } else {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      datetime = `${year}-${month}-${day}T00:00:00`;
    }
    
    // 添加时区
    if (timezone === 'Asia/Tokyo') {
      datetime += '+09:00';
    } else if (timezone === 'Asia/Shanghai') {
      datetime += '+08:00';
    } else {
      datetime += '+00:00';
    }
    
    // 调用API
    const url = new URL('https://api.prokerala.com/v2/astrology/panchang');
    url.searchParams.set('ayanamsa', '1');
    url.searchParams.set('coordinates', `${latitude},${longitude}`);
    url.searchParams.set('datetime', datetime);
    url.searchParams.set('la', 'ja');

    console.log('Calling Prokerala:', url.toString());

    const apiRes = await fetch(url.toString(), { 
      headers: { 
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      } 
    });

    const text = await apiRes.text();
    
    if (!apiRes.ok) {
      console.error('Panchang API Error:', text);
      return NextResponse.json(
        { error: 'Panchang APIエラー', detail: text, url: url.toString() },
        { status: apiRes.status }
      );
    }

    const data = JSON.parse(text);

    console.log('Panchang success');
    return NextResponse.json(data);

  } catch (err) {
    console.error('Panchang Error:', err);
    return NextResponse.json(
      { error: '内部エラー', message: err.message },
      { status: 500 }
    );
  }
}