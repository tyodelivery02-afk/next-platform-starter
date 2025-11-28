// pages/api/uranai/tarot.js
// 完整的78张塔罗牌数据

const TAROT_CARDS = [
  // 大阿尔卡那 (Major Arcana) 0-21
  { id: 0, name: '愚者', upright: '新しい始まり、冒険、純粋さ', reversed: '無謀、軽率、方向性の喪失' },
  { id: 1, name: '魔術師', upright: '創造力、意志の力、実現', reversed: '操作、欺瞞、才能の浪費' },
  { id: 2, name: '女教皇', upright: '直感、神秘、内なる知恵', reversed: '秘密、隠された真実、無視された直感' },
  { id: 3, name: '女帝', upright: '豊穣、母性、自然の恵み', reversed: '依存、過保護、創造性の停滞' },
  { id: 4, name: '皇帝', upright: '権威、構造、安定', reversed: '支配、硬直、独裁' },
  { id: 5, name: '法王', upright: '伝統、精神的指導、教え', reversed: '反抗、型破り、自由の追求' },
  { id: 6, name: '恋人', upright: '愛、調和、選択', reversed: '不調和、誤った選択、価値観の不一致' },
  { id: 7, name: '戦車', upright: '勝利、意志、前進', reversed: '敗北、方向性の喪失、コントロールの欠如' },
  { id: 8, name: '力', upright: '内なる強さ、勇気、忍耐', reversed: '弱さ、自己不信、乱暴さ' },
  { id: 9, name: '隠者', upright: '内省、孤独、精神的な探求', reversed: '孤立、引きこもり、拒絶' },
  { id: 10, name: '運命の輪', upright: '変化、運命、サイクル', reversed: '不運、抵抗、停滞' },
  { id: 11, name: '正義', upright: '公正、真実、バランス', reversed: '不公平、不誠実、偏見' },
  { id: 12, name: '吊られた男', upright: '犠牲、新しい視点、待機', reversed: '無駄な犠牲、停滞、優柔不断' },
  { id: 13, name: '死神', upright: '終わりと始まり、変容、手放す', reversed: '変化への抵抗、停滞、恐れ' },
  { id: 14, name: '節制', upright: 'バランス、調和、中庸', reversed: '不均衡、過剰、焦り' },
  { id: 15, name: '悪魔', upright: '束縛、誘惑、物質主義', reversed: '解放、自由、真実の直視' },
  { id: 16, name: '塔', upright: '突然の変化、破壊、啓示', reversed: '災難の回避、恐れ、変化への抵抗' },
  { id: 17, name: '星', upright: '希望、インスピレーション、平和', reversed: '絶望、信念の喪失、不安' },
  { id: 18, name: '月', upright: '幻想、不安、直感', reversed: '混乱の解消、真実の露呈、不安の克服' },
  { id: 19, name: '太陽', upright: '成功、喜び、活力', reversed: '失敗、悲観、エネルギーの欠如' },
  { id: 20, name: '審判', upright: '再生、許し、内なる呼びかけ', reversed: '自己批判、後悔、判断の遅れ' },
  { id: 21, name: '世界', upright: '完成、達成、統合', reversed: '未完成、遅延、目標の欠如' },

  // 小阿尔卡那 - ワンド (Wands) 22-35
  { id: 22, name: 'ワンドのエース', upright: '新しい情熱、創造的な火花、インスピレーション', reversed: '遅延、創造性の欠如、エネルギーの停滞' },
  { id: 23, name: 'ワンドの2', upright: '計画、決断、未来の展望', reversed: '優柔不断、恐れ、計画の欠如' },
  { id: 24, name: 'ワンドの3', upright: '拡大、先見の明、リーダーシップ', reversed: '計画の失敗、視野の狭さ、遅延' },
  { id: 25, name: 'ワンドの4', upright: '祝福、調和、家庭の安定', reversed: '不和、移行、家庭の問題' },
  { id: 26, name: 'ワンドの5', upright: '競争、対立、闘争', reversed: '対立の回避、内なる葛藤、妥協' },
  { id: 27, name: 'ワンドの6', upright: '勝利、成功、公的な認知', reversed: '失敗、遅延、プライドの欠如' },
  { id: 28, name: 'ワンドの7', upright: '挑戦、競争、防御', reversed: '圧倒される、諦め、自信の欠如' },
  { id: 29, name: 'ワンドの8', upright: '迅速な行動、変化、進展', reversed: '遅延、欲求不満、内なる葛藤' },
  { id: 30, name: 'ワンドの9', upright: '回復力、勇気、最後の努力', reversed: '疲労、固執、防御的態度' },
  { id: 31, name: 'ワンドの10', upright: '重い負担、責任、燃え尽き', reversed: '負担を下ろす、委任、休息' },
  { id: 32, name: 'ワンドのペイジ', upright: '熱意、探求、発見', reversed: '不安定、散漫、悪いニュース' },
  { id: 33, name: 'ワンドのナイト', upright: '行動、冒険、情熱', reversed: '衝動性、無謀、遅延' },
  { id: 34, name: 'ワンドのクイーン', upright: '自信、独立、決断力', reversed: '支配的、嫉妬、自己中心的' },
  { id: 35, name: 'ワンドのキング', upright: 'リーダーシップ、ビジョン、起業家精神', reversed: '独裁的、傲慢、寛容さの欠如' },

  // カップ (Cups) 36-49
  { id: 36, name: 'カップのエース', upright: '新しい愛、感情の始まり、創造性', reversed: '感情の抑制、愛の喪失、創造性の停滞' },
  { id: 37, name: 'カップの2', upright: 'パートナーシップ、愛、相互理解', reversed: '不均衡、緊張、別れ' },
  { id: 38, name: 'カップの3', upright: '祝福、友情、コミュニティ', reversed: '過剰、孤独、グループからの排除' },
  { id: 39, name: 'カップの4', upright: '瞑想、熟考、無関心', reversed: '新しい機会、動機、再評価' },
  { id: 40, name: 'カップの5', upright: '喪失、後悔、失望', reversed: '許し、受け入れ、前進' },
  { id: 41, name: 'カップの6', upright: 'ノスタルジア、思い出、無邪気さ', reversed: '過去にとらわれる、前進できない、未熟' },
  { id: 42, name: 'カップの7', upright: '選択、幻想、空想', reversed: '現実的な選択、幻想の解消、集中' },
  { id: 43, name: 'カップの8', upright: '放棄、撤退、探求', reversed: '戻る、放浪、目的の喪失' },
  { id: 44, name: 'カップの9', upright: '満足、幸福、願いの実現', reversed: '不満、物質主義、傲慢' },
  { id: 45, name: 'カップの10', upright: '幸せ、調和、家族の絆', reversed: '不調和、家族の問題、価値観の不一致' },
  { id: 46, name: 'カップのペイジ', upright: '創造的な機会、好奇心、新しいアイデア', reversed: '感情的な未熟さ、不安定、悪いニュース' },
  { id: 47, name: 'カップのナイト', upright: 'ロマンス、魅力、想像力', reversed: '非現実的、嫉妬、気分屋' },
  { id: 48, name: 'カップのクイーン', upright: '思いやり、直感、愛情', reversed: '感情の不安定、依存、過保護' },
  { id: 49, name: 'カップのキング', upright: '感情のコントロール、外交、バランス', reversed: '感情の抑制、操作、冷淡' },

  // ソード (Swords) 50-63
  { id: 50, name: 'ソードのエース', upright: '明晰さ、真実、新しいアイデア', reversed: '混乱、残酷、誤った情報' },
  { id: 51, name: 'ソードの2', upright: '優柔不断、選択、行き詰まり', reversed: '決断、真実の露呈、対立の終結' },
  { id: 52, name: 'ソードの3', upright: '心痛、悲しみ、拒絶', reversed: '回復、許し、前進' },
  { id: 53, name: 'ソードの4', upright: '休息、回復、熟考', reversed: '燃え尽き、休息の拒否、不眠' },
  { id: 54, name: 'ソードの5', upright: '対立、敗北、不名誉', reversed: '和解、許し、プライドの克服' },
  { id: 55, name: 'ソードの6', upright: '移行、変化、前進', reversed: '抵抗、停滞、情緒不安定' },
  { id: 56, name: 'ソードの7', upright: '欺瞞、裏切り、戦略', reversed: '誠実さ、真実の露呈、良心' },
  { id: 57, name: 'ソードの8', upright: '制限、孤立、無力感', reversed: '自由、力の取り戻し、解放' },
  { id: 58, name: 'ソードの9', upright: '不安、恐れ、悪夢', reversed: '回復、希望、不安の解消' },
  { id: 59, name: 'ソードの10', upright: '終わり、喪失、裏切り', reversed: '回復、再生、抵抗' },
  { id: 60, name: 'ソードのペイジ', upright: '好奇心、警戒、新しいアイデア', reversed: 'おしゃべり、スパイ、秘密' },
  { id: 61, name: 'ソードのナイト', upright: '野心、行動、衝動性', reversed: '無謀、攻撃性、考えなしの行動' },
  { id: 62, name: 'ソードのクイーン', upright: '独立、公正さ、洞察力', reversed: '冷淡、残酷、無情' },
  { id: 63, name: 'ソードのキング', upright: '権威、知性、真実', reversed: '操作、残酷、暴君的' },

  // ペンタクル (Pentacles) 64-77
  { id: 64, name: 'ペンタクルのエース', upright: '新しい機会、繁栄、安全', reversed: '機会の喪失、経済的不安、浪費' },
  { id: 65, name: 'ペンタクルの2', upright: 'バランス、適応、時間管理', reversed: '不均衡、圧倒される、優先順位の混乱' },
  { id: 66, name: 'ペンタクルの3', upright: 'チームワーク、協力、技能', reversed: '不調和、競争、単独作業' },
  { id: 67, name: 'ペンタクルの4', upright: '安全、所有、執着', reversed: '貪欲、物質主義、自己中心性' },
  { id: 68, name: 'ペンタクルの5', upright: '経済的損失、貧困、孤立', reversed: '回復、改善、寛大さ' },
  { id: 69, name: 'ペンタクルの6', upright: '寛大さ、慈善、共有', reversed: '負債、不公平、一方的な関係' },
  { id: 70, name: 'ペンタクルの7', upright: '忍耐、投資、長期的視点', reversed: '焦り、遅延、努力の欠如' },
  { id: 71, name: 'ペンタクルの8', upright: '勤勉、献身、技能の向上', reversed: '完璧主義、燃え尽き、品質の低下' },
  { id: 72, name: 'ペンタクルの9', upright: '豊かさ、贅沢、自給自足', reversed: '過剰な支出、不安、孤独' },
  { id: 73, name: 'ペンタクルの10', upright: '富、遺産、家族', reversed: '経済的損失、家族の問題、孤独' },
  { id: 74, name: 'ペンタクルのペイジ', upright: '野心、勤勉、新しいアイデア', reversed: '先延ばし、学習の困難、経済的不安' },
  { id: 75, name: 'ペンタクルのナイト', upright: '効率、ルーティン、保守主義', reversed: '怠惰、完璧主義、効率の欠如' },
  { id: 76, name: 'ペンタクルのクイーン', upright: '実用性、快適さ、安全', reversed: '自己中心性、嫉妬、物質主義' },
  { id: 77, name: 'ペンタクルのキング', upright: '成功、豊かさ、リーダーシップ', reversed: '貪欲、物質主義、経済的な不安定' }
];

export default function handler(req, res) {
  // 设置CORS头部
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const count = Math.min(Math.max(parseInt(req.query.count || '3', 10), 1), 10);
    
    console.log('Tarot API called, drawing', count, 'cards');
    
    // シャッフル
    const pool = [...TAROT_CARDS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    
    // カードを引く
    const draw = [];
    for (let k = 0; k < count; k++) {
      const card = pool[k];
      const reversed = Math.random() < 0.5;
      draw.push({
        ...card,
        reversed,
        position: k + 1,
        meaning: reversed ? card.reversed : card.upright,
        interpretation: reversed ? '逆位置' : '正位置'
      });
    }
    
    console.log('Tarot cards drawn successfully');
    
    return res.status(200).json({ 
      status: 'ok',
      draw, 
      count: draw.length,
      timestamp: new Date().toISOString() 
    });
    
  } catch (err) {
    console.error('Tarot Error:', err);
    return res.status(500).json({ 
      error: 'タロット生成失敗',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}