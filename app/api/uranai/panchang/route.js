// pages/api/uranai/panchang.js
// 获取每日Panchang（吉凶时辰）
export default async function handler(req, res) {
  // 设置CORS头部（如果需要）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { 
      date = '',  // YYYY-MM-DD格式
      latitude = '35.6762',  // 东京默认坐标
      longitude = '139.6503',
      timezone = 'Asia/Tokyo'
    } = req.query;

    console.log('Panchang API called with date:', date);

    // 获取token
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
    
    console.log('Fetching token from:', `${baseUrl}/api/uranai/prokerala-token`);

    const tokenRes = await fetch(`${baseUrl}/api/uranai/prokerala-token`);
    
    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error('Token fetch failed:', errorText);
      return res.status(500).json({ 
        error: 'Token取得失敗', 
        detail: errorText 
      });
    }

    const tokenData = await tokenRes.json();
    
    if (!tokenData.access_token) {
      return res.status(500).json({ error: 'アクセストークンなし' });
    }

    console.log('Token obtained, calling Prokerala API...');

    // 构建Panchang API请求
    const url = new URL('https://api.prokerala.com/v2/astrology/panchang');
    url.searchParams.set('ayanamsa', '1'); // Lahiri ayanamsa
    url.searchParams.set('coordinates', `${latitude},${longitude}`);
    
    // 构建datetime参数 (ISO 8601格式)
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
    
    // 添加时区偏移
    if (timezone === 'Asia/Tokyo') {
      datetime += '+09:00';
    } else if (timezone === 'Asia/Shanghai') {
      datetime += '+08:00';
    } else {
      datetime += '+00:00';
    }
    
    url.searchParams.set('datetime', datetime);
    url.searchParams.set('la', 'ja'); // 日语

    console.log('Calling Prokerala:', url.toString());

    const apiRes = await fetch(url.toString(), { 
      headers: { 
        'Authorization': `Bearer ${tokenData.access_token}` 
      } 
    });

    const text = await apiRes.text();
    
    if (!apiRes.ok) {
      console.error('Panchang API Error:', text);
      return res.status(apiRes.status).json({ 
        error: 'Panchang APIエラー', 
        detail: text,
        url: url.toString()
      });
    }

    let data;
    try { 
      data = JSON.parse(text); 
    } catch (e) { 
      console.error('JSON parse error:', e);
      return res.status(500).json({ 
        error: 'Panchang JSON解析失敗', 
        raw: text 
      }); 
    }

    console.log('Panchang API success');
    return res.status(200).json(data);

  } catch (err) {
    console.error('Panchang Error:', err);
    return res.status(500).json({ 
      error: '内部サーバーエラー',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}