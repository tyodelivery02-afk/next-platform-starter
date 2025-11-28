// pages/api/uranai/prokerala-token.js
export default async function handler(req, res) {
  // 允许所有HTTP方法
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(200).json({ message: 'Method allowed' });
  }

  try {
    const clientId = process.env.NEXT_PUBLIC_PROKERALA_CLIENT_ID;
    const clientSecret = process.env.PROKERALA_CLIENT_SECRET;
    
    console.log('Token API called');
    console.log('Client ID exists:', !!clientId);
    console.log('Client Secret exists:', !!clientSecret);
    
    if (!clientId || !clientSecret) {
      return res.status(500).json({ 
        error: 'Prokeralaクライアント情報未設定',
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret
      });
    }

    // Token缓存
    if (!global.__prokerala_token_cache) {
      global.__prokerala_token_cache = {};
    }
    const cache = global.__prokerala_token_cache;

    // 检查token是否还有效（提前30秒过期）
    if (cache.access_token && cache.expires_at && Date.now() < cache.expires_at - 30000) {
      console.log('Returning cached token');
      return res.status(200).json({ 
        access_token: cache.access_token,
        cached: true 
      });
    }

    console.log('Fetching new token from Prokerala...');

    // 获取新token
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
    console.log('Prokerala response status:', tokenRes.status);
    
    if (!tokenRes.ok) {
      console.error('Token Error:', text);
      return res.status(500).json({ 
        error: 'Token取得失敗', 
        status: tokenRes.status,
        detail: text 
      });
    }

    let json;
    try { 
      json = JSON.parse(text); 
    } catch (e) { 
      console.error('JSON parse error:', e);
      return res.status(500).json({ 
        error: 'Token JSON解析失敗', 
        raw: text 
      }); 
    }

    if (!json.access_token) {
      return res.status(500).json({ 
        error: 'アクセストークンなし',
        response: json
      });
    }

    // 保存到缓存
    cache.access_token = json.access_token;
    cache.expires_at = Date.now() + (json.expires_in || 3600) * 1000;

    console.log('Token obtained successfully');

    return res.status(200).json({ 
      access_token: json.access_token,
      expires_in: json.expires_in,
      cached: false
    });

  } catch (err) {
    console.error('Token API Error:', err);
    return res.status(500).json({ 
      error: '内部サーバーエラー', 
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}