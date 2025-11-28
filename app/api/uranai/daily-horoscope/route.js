// pages/api/uranai/daily-horoscope.js
// 基于星座和日期生成每日运势

// 星座配置
const ZODIAC_CONFIG = {
  aries: { name: '牡羊座', dates: '3/21-4/19', element: '火', planet: '火星', color: '赤' },
  taurus: { name: '牡牛座', dates: '4/20-5/20', element: '地', planet: '金星', color: '緑' },
  gemini: { name: '双子座', dates: '5/21-6/21', element: '風', planet: '水星', color: '黄' },
  cancer: { name: '蟹座', dates: '6/22-7/22', element: '水', planet: '月', color: '銀' },
  leo: { name: '獅子座', dates: '7/23-8/22', element: '火', planet: '太陽', color: '金' },
  virgo: { name: '乙女座', dates: '8/23-9/22', element: '地', planet: '水星', color: '茶' },
  libra: { name: '天秤座', dates: '9/23-10/23', element: '風', planet: '金星', color: '青' },
  scorpio: { name: '蠍座', dates: '10/24-11/21', element: '水', planet: '冥王星', color: '黒' },
  sagittarius: { name: '射手座', dates: '11/22-12/21', element: '火', planet: '木星', color: '紫' },
  capricorn: { name: '山羊座', dates: '12/22-1/19', element: '地', planet: '土星', color: '灰' },
  aquarius: { name: '水瓶座', dates: '1/20-2/18', element: '風', planet: '天王星', color: '水色' },
  pisces: { name: '魚座', dates: '2/19-3/20', element: '水', planet: '海王星', color: '白' }
};

// 运势模板
const FORTUNE_TEMPLATES = {
  love: [
    '素晴らしい出会いの予感があります。',
    '恋愛運が高まっています。積極的に行動しましょう。',
    '大切な人との絆が深まる日です。',
    '新しい恋の始まりを感じるでしょう。',
    '恋人との関係に注意が必要です。コミュニケーションを大切に。'
  ],
  work: [
    '仕事運絶好調！大きな成果が期待できます。',
    'チームワークが成功の鍵となります。',
    '新しいプロジェクトに挑戦するチャンスです。',
    '慎重な判断が必要な日です。焦らず進めましょう。',
    '努力が認められる時期です。自信を持って。'
  ],
  money: [
    '金運上昇中！臨時収入の可能性も。',
    '無駄遣いに注意。計画的な支出を心がけて。',
    '投資のチャンスがあるかもしれません。',
    '貯蓄に最適な日です。',
    '金銭面での判断は慎重に。'
  ],
  health: [
    '体調良好！エネルギーに満ち溢れています。',
    '適度な運動とバランスの取れた食事を心がけて。',
    'リラックスする時間を作りましょう。',
    '疲れが溜まっているかもしれません。休息を。',
    '新しい健康習慣を始めるのに良い日です。'
  ],
  overall: [
    '全体的に良い運気に恵まれています。',
    '小さな幸せを見つけられる一日になりそうです。',
    '挑戦する勇気が幸運を呼び込みます。',
    '周囲の人々とのつながりを大切にしましょう。',
    '直感を信じて行動すると良い結果が得られます。'
  ]
};

// 日付とサインからシード値を生成
function generateSeed(sign, date) {
  const signValue = Object.keys(ZODIAC_CONFIG).indexOf(sign);
  const dateValue = new Date(date).getDate();
  return signValue * 31 + dateValue;
}

// シード値から再現可能なランダム値を生成
function seededRandom(seed, index) {
  const x = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// 运势を生成
function generateHoroscope(sign, date) {
  const config = ZODIAC_CONFIG[sign];
  if (!config) {
    throw new Error('Invalid zodiac sign');
  }

  const seed = generateSeed(sign, date);
  
  // 各カテゴリーのインデックスを生成
  const loveIndex = Math.floor(seededRandom(seed, 1) * FORTUNE_TEMPLATES.love.length);
  const workIndex = Math.floor(seededRandom(seed, 2) * FORTUNE_TEMPLATES.work.length);
  const moneyIndex = Math.floor(seededRandom(seed, 3) * FORTUNE_TEMPLATES.money.length);
  const healthIndex = Math.floor(seededRandom(seed, 4) * FORTUNE_TEMPLATES.health.length);
  const overallIndex = Math.floor(seededRandom(seed, 5) * FORTUNE_TEMPLATES.overall.length);
  
  // ラッキーナンバーとカラー
  const luckyNumber = Math.floor(seededRandom(seed, 6) * 99) + 1;
  const luckyRating = Math.floor(seededRandom(seed, 7) * 5) + 1; // 1-5星

  return {
    sign: sign,
    signName: config.name,
    date: date,
    element: config.element,
    rulingPlanet: config.planet,
    luckyColor: config.color,
    luckyNumber: luckyNumber,
    overallRating: luckyRating,
    fortune: {
      overall: FORTUNE_TEMPLATES.overall[overallIndex],
      love: FORTUNE_TEMPLATES.love[loveIndex],
      work: FORTUNE_TEMPLATES.work[workIndex],
      money: FORTUNE_TEMPLATES.money[moneyIndex],
      health: FORTUNE_TEMPLATES.health[healthIndex]
    },
    advice: '今日のあなたは' + config.planet + 'のエネルギーを受けています。' + config.color + '色のアイテムを身につけると運気がアップします。'
  };
}

export default async function handler(req, res) {
  // 设置CORS头部
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { 
      sign = 'aries',
      date,
      timezone = 'Asia/Tokyo' 
    } = req.query;

    console.log('Horoscope API called for sign:', sign, 'date:', date);

    // 日付処理
    let targetDate;
    if (date) {
      targetDate = date;
    } else {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      targetDate = `${year}-${month}-${day}`;
    }

    // 运势生成
    const horoscope = generateHoroscope(sign, targetDate);

    // Panchangデータも取得（オプション）
    try {
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host;
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
      
      const panchangRes = await fetch(
        `${baseUrl}/api/uranai/panchang?date=${targetDate}&timezone=${timezone}`
      );
      
      if (panchangRes.ok) {
        const panchangData = await panchangRes.json();
        horoscope.panchang = {
          auspicious: panchangData.data?.auspicious_period || [],
          inauspicious: panchangData.data?.inauspicious_period || []
        };
      }
    } catch (e) {
      console.log('Panchang data not available:', e.message);
    }

    console.log('Horoscope generated successfully');

    return res.status(200).json({
      status: 'ok',
      data: horoscope,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Horoscope Error:', err);
    return res.status(500).json({ 
      error: '運勢生成エラー',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}