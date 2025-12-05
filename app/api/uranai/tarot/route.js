// pages/api/uranai/tarot.js
const TAROT_CARDS = [
  // --- 大アルカナ (Major Arcana) ---
  { id: 0, name: '愚者', upright: '新しい始まり、自由、無限の可能性、旅立ち', reversed: '無謀、軽率、衝動的行動、優柔不断' },
  { id: 1, name: '魔術師', upright: '創造、意志力、機会、自信、技術', reversed: '無気力、スランプ、悪意、機会の損失' },
  { id: 2, name: '女教皇', upright: '直感、秘密、知恵、内なる声、神秘', reversed: '感情的、ヒステリー、秘密の露呈、無視された直感' },
  { id: 3, name: '女帝', upright: '豊穣、母性、繁栄、愛情、美しさ', reversed: '浪費、依存、過保護、空回り、不仲' },
  { id: 4, name: '皇帝', upright: '支配、権威、安定、リーダーシップ、行動力', reversed: '独裁的、傲慢、未熟、力の濫用、硬直' },
  { id: 5, name: '法王', upright: '伝統、慈悲、精神的指導、助言、道徳', reversed: '束縛、型破り、独善的、不信感、古い価値観' },
  { id: 6, name: '恋人', upright: '愛、選択、調和、結びつき、人生の岐路', reversed: '不調和、誤った選択、別れ、誘惑、価値観の不一致' },
  { id: 7, name: '戦車', upright: '勝利、前進、意志、突進力、克服', reversed: '暴走、挫折、方向性の喪失、コントロール不能' },
  { id: 8, name: '力', upright: '内なる強さ、勇気、忍耐、優しさ、自制心', reversed: '弱気、自己不信、権威の濫用、無力感' },
  { id: 9, name: '隠者', upright: '内省、探求、思慮深い、助言者、孤独', reversed: '引きこもり、閉鎖的、孤独、誤解、闇雲な行動' },
  { id: 10, name: '運命の輪', upright: '転機、チャンス到来、幸運、変化のサイクル', reversed: '不運、停滞、状況の悪化、抵抗、予期せぬ展開' },
  { id: 11, name: '正義', upright: '公正、バランス、誠実、結果、法的な問題', reversed: '不正、不公平、偏見、誤解、不誠実' },
  { id: 12, name: '吊られた男', upright: '試練、新しい視点、自己犠牲、修行、待機', reversed: '報われない努力、無駄な犠牲、停滞、優柔不断' },
  { id: 13, name: '死神', upright: '終焉と再生、根本的変化、区切り、手放す', reversed: '変化への抵抗、停滞、延期、再出発の失敗' },
  { id: 14, name: '節制', upright: '調和、バランス、平和的解決、柔軟性、中庸', reversed: '不均衡、不節制、過剰、焦り、事なかれ主義' },
  { id: 15, name: '悪魔', upright: '束縛、誘惑、執着、物質主義、中毒', reversed: '解放、立ち直り、克服、自制心、真実の直視' },
  { id: 16, name: '塔', upright: '崩壊、突然の変化、事故、解放、大改革', reversed: '災難の回避、隠された問題、内部崩壊、予期せぬ変化への抵抗' },
  { id: 17, name: '星', upright: '希望、インスピレーション、可能性、輝く未来', reversed: '絶望、無気力、信念の喪失、期待はずれ' },
  { id: 18, name: '月', upright: '不安、幻想、曖昧さ、潜在意識、直感', reversed: '混乱の解消、真実の露呈、不安の克服、漠然とした恐れ' },
  { id: 19, name: '太陽', upright: '成功、喜び、活力、達成、明るい未来', reversed: '失敗、悲観、エネルギーの欠如、空回り、延期' },
  { id: 20, name: '審判', upright: '復活、再生、許し、内なる声、結論', reversed: '自己批判、後悔、チャンスの逃失、決断の遅れ' },
  { id: 21, name: '世界', upright: '完成、達成、統合、完全な幸福、目標達成', reversed: '未完成、遅延、物足りなさ、限界、手抜き' },

  // --- 小アルカナ：ワンド (棒：火/情熱・直観) ---
  { id: 22, name: 'ワンドのエース', upright: '情熱的な始まり、創造的な火花、インスピレーション、活力', reversed: '後退、自信過剰、エネルギーの停滞、期待はずれ' },
  { id: 23, name: 'ワンドの2', upright: '計画、決断、未来の展望、支配、個人の力', reversed: '優柔不断、恐れ、計画の欠如、無力感、準備不足' },
  { id: 24, name: 'ワンドの3', upright: '拡大、先見の明、協力、リーダーシップ、航海', reversed: '計画の失敗、視野の狭さ、遅延、協調性の欠如' },
  { id: 25, name: 'ワンドの4', upright: '祝福、調和、家庭の安定、お祝い、安堵', reversed: '不和、移行、家庭の問題、不安定、未完成' },
  { id: 26, name: 'ワンドの5', upright: '競争、対立、闘争、切磋琢磨、努力', reversed: '対立の回避、内なる葛藤、妥協、解決、和解' },
  { id: 27, name: 'ワンドの6', upright: '勝利、成功、公的な認知、自信、凱旋', reversed: '失敗、遅延、プライドの欠如、中途半端、悪い知らせ' },
  { id: 28, name: 'ワンドの7', upright: '挑戦、競争、防御、勇敢、踏ん張り', reversed: '圧倒される、諦め、自信の欠如、不安、逃避' },
  { id: 29, name: 'ワンドの8', upright: '迅速な行動、変化、進展、旅行、通信', reversed: '遅延、欲求不満、内なる葛藤、計画の頓挫' },
  { id: 30, name: 'ワンドの9', upright: '回復力、勇気、最後の努力、防御的態度、警戒', reversed: '疲労、頑固、防御的態度、不信感、健康問題' },
  { id: 31, name: 'ワンドの10', upright: '重い負担、責任、義務、燃え尽き、プレッシャー', reversed: '負担を下ろす、委任、休息、解放、現実逃避' },
  { id: 32, name: 'ワンドのペイジ', upright: '熱意、探求、発見、新しいアイデア、メッセンジャー', reversed: '不安定、散漫、悪いニュース、未熟、計画不足' },
  { id: 33, name: 'ワンドのナイト', upright: '行動、冒険、情熱、変化、迅速さ', reversed: '衝動性、無謀、遅延、怒り、中断' },
  { id: 34, name: 'ワンドのクイーン', upright: '自信、独立、決断力、カリスマ、魅力', reversed: '支配的、嫉妬、自己中心的、わがまま、不安定' },
  { id: 35, name: 'ワンドのキング', upright: 'リーダーシップ、ビジョン、起業家精神、権威、誠実', reversed: '独裁的、傲慢、寛容さの欠如、残酷、支配的' },

  // --- 小アルカナ：カップ (聖杯：水/感情・愛) ---
  { id: 36, name: 'カップのエース', upright: '新しい愛、感情の始まり、創造性、喜び、幸福', reversed: '感情の抑制、愛の喪失、創造性の停滞、不満' },
  { id: 37, name: 'カップの2', upright: 'パートナーシップ、愛、相互理解、調和、協力', reversed: '不均衡、緊張、別れ、意見の不一致、自己中心的' },
  { id: 38, name: 'カップの3', upright: '祝福、友情、コミュニティ、お祝い、豊穣', reversed: '過剰、孤独、グループからの排除、不倫、ゴシップ' },
  { id: 39, name: 'カップの4', upright: '瞑想、熟考、無関心、退屈、不満', reversed: '新しい機会、動機、再評価、興味の復活、歓迎' },
  { id: 40, name: 'カップの5', upright: '喪失、後悔、失望、悲しみ、一部の成功', reversed: '許し、受け入れ、前進、回復、立ち直り' },
  { id: 41, name: 'カップの6', upright: 'ノスタルジア、思い出、無邪気さ、過去からの贈り物', reversed: '過去にとらわれる、前進できない、未熟、自立の欠如' },
  { id: 42, name: 'カップの7', upright: '選択、幻想、空想、夢、迷い', reversed: '現実的な選択、幻想の解消、集中、意志力、目標設定' },
  { id: 43, name: 'カップの8', upright: '放棄、撤退、探求、目的のある旅、限界', reversed: '戻る、放浪、目的の喪失、留まることへの恐れ' },
  { id: 44, name: 'カップの9', upright: '満足、幸福、願いの実現、自己満足', reversed: '不満、物質主義、傲慢、誤解、喜びの欠如' },
  { id: 45, name: 'カップの10', upright: '幸せ、調和、家族の絆、永遠の喜び、共同体', reversed: '不調和、家族の問題、価値観の不一致、家庭の崩壊' },
  { id: 46, name: 'カップのペイジ', upright: '創造的な機会、好奇心、新しいアイデア、夢、感受性', reversed: '感情的な未熟さ、不安定、悪いニュース、依存' },
  { id: 47, name: 'カップのナイト', upright: 'ロマンス、魅力、想像力、提案、芸術的', reversed: '非現実的、嫉妬、気分屋、幻想、遅延' },
  { id: 48, name: 'カップのクイーン', upright: '思いやり、直感、愛情、受容、夢想', reversed: '感情の不安定、依存、過保護、操作、自己陶酔' },
  { id: 49, name: 'カップのキング', upright: '感情のコントロール、外交、バランス、安定、知恵', reversed: '感情の抑制、操作、冷淡、不正直、依存' },

  // --- 小アルカナ：ソード (剣：風/知性・言葉) ---
  { id: 50, name: 'ソードのエース', upright: '明晰さ、真実、新しいアイデア、突破口、勝利', reversed: '混乱、残酷、誤った情報、力の濫用、思考停止' },
  { id: 51, name: 'ソードの2', upright: '優柔不断、選択、行き詰まり、対立の回避', reversed: '決断、真実の露呈、対立の終結、解放、情報公開' },
  { id: 52, name: 'ソードの3', upright: '心痛、悲しみ、拒絶、裏切り、孤独', reversed: '回復、許し、前進、痛みの克服、和解' },
  { id: 53, name: 'ソードの4', upright: '休息、回復、熟考、一時的な撤退、静養', reversed: '燃え尽き、休息の拒否、活動再開、不眠、警戒' },
  { id: 54, name: 'ソードの5', upright: '対立、敗北、不名誉、損失、屈辱', reversed: '和解、許し、プライドの克服、敗北からの学び' },
  { id: 55, name: 'ソードの6', upright: '移行、変化、前進、旅、より良い場所へ', reversed: '抵抗、停滞、情緒不安定、船出の遅れ、難しさ' },
  { id: 56, name: 'ソードの7', upright: '欺瞞、裏切り、戦略、盗難、秘密の行動', reversed: '誠実さ、真実の露呈、良心、情報開示、正直さ' },
  { id: 57, name: 'ソードの8', upright: '制限、孤立、無力感、自己規制、被害者意識', reversed: '自由、力の取り戻し、解放、自己否定の克服' },
  { id: 58, name: 'ソードの9', upright: '不安、恐れ、悪夢、深い悩み、精神的苦痛', reversed: '回復、希望、不安の解消、克服、最悪の事態の回避' },
  { id: 59, name: 'ソードの10', upright: '終わり、喪失、裏切り、どん底、悲劇', reversed: '回復、再生、抵抗、好転、避けることのできた危機' },
  { id: 60, name: 'ソードのペイジ', upright: '好奇心、警戒、新しいアイデア、探求、鋭敏さ', reversed: 'おしゃべり、スパイ、秘密、衝動、計画不足' },
  { id: 61, name: 'ソードのナイト', upright: '野心、行動、衝動性、迅速な行動、目標達成', reversed: '無謀、攻撃性、考えなしの行動、遅延、暴走' },
  { id: 62, name: 'ソードのクイーン', upright: '独立、公正さ、洞察力、知性、悲嘆', reversed: '冷淡、残酷、無情、感情の欠如、意地悪' },
  { id: 63, name: 'ソードのキング', upright: '権威、知性、真実、論理、明晰な思考', reversed: '操作、残酷、暴君的、感情の欠如、不公正' },

  // --- 小アルカナ：ペンタクル (金貨：地/現実・安定) ---
  { id: 64, name: 'ペンタクルのエース', upright: '新しい機会、繁栄、安全、具体的な始まり、現実的成功', reversed: '機会の喪失、経済的不安、浪費、計画不足' },
  { id: 65, name: 'ペンタクルの2', upright: 'バランス、適応、時間管理、柔軟性、両立', reversed: '不均衡、圧倒される、優先順位の混乱、浪費' },
  { id: 66, name: 'ペンタクルの3', upright: 'チームワーク、協力、技能、学習、努力の成果', reversed: '不調和、競争、単独作業、品質の低下、凡庸' },
  { id: 67, name: 'ペンタクルの4', upright: '安全、所有、執着、倹約、安定', reversed: '貪欲、物質主義、自己中心性、手放すこと、開放' },
  { id: 68, name: 'ペンタクルの5', upright: '経済的損失、貧困、孤立、困難、喪失', reversed: '回復、改善、寛大さ、希望、困難からの脱却' },
  { id: 69, name: 'ペンタクルの6', upright: '寛大さ、慈善、共有、贈り物、公正', reversed: '負債、不公平、一方的な関係、借金、物欲' },
  { id: 70, name: 'ペンタクルの7', upright: '忍耐、投資、長期的視点、収穫を待つ、再評価', reversed: '焦り、遅延、努力の欠如、無駄な投資、中断' },
  { id: 71, name: 'ペンタクルの8', upright: '勤勉、献身、技能の向上、集中、職人技', reversed: '完璧主義、燃え尽き、品質の低下、怠惰、無駄な努力' },
  { id: 72, name: 'ペンタクルの9', upright: '豊かさ、贅沢、自給自足、洗練、独立', reversed: '過剰な支出、不安、孤独、失敗、不安定' },
  { id: 73, name: 'ペンタクルの10', upright: '富、遺産、家族、安定、究極の成功', reversed: '経済的損失、家族の問題、孤独、崩壊、不安定' },
  { id: 74, name: 'ペンタクルのペイジ', upright: '野心、勤勉、新しいアイデア、学習、経済的機会', reversed: '先延ばし、学習の困難、経済的不安、悪い知らせ' },
  { id: 75, name: 'ペンタクルのナイト', upright: '効率、ルーティン、保守主義、責任感、堅実', reversed: '怠惰、完璧主義、効率の欠如、停滞、無気力' },
  { id: 76, name: 'ペンタクルのクイーン', upright: '実用性、快適さ、安全、育む、現実的な女性', reversed: '自己中心性、嫉妬、物質主義、不安定、過干渉' },
  { id: 77, name: 'ペンタクルのキング', upright: '成功、豊かさ、リーダーシップ、安定、信頼性', reversed: '貪欲、物質主義、経済的な不安定、強欲、腐敗' }
];

// CORS 設定
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// OPTIONS
export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

// GET
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const count = Math.min(Math.max(parseInt(searchParams.get("count") || "3", 10), 1), 10);

    const pool = [...TAROT_CARDS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const draw = [];
    for (let k = 0; k < count; k++) {
      const card = pool[k];
      const reversed = Math.random() < 0.5;

      draw.push({
        ...card,
        reversed,
        position: k + 1,
        meaning: reversed ? card.reversed : card.upright,
        interpretation: reversed ? "逆位置" : "正位置",
      });
    }

    return Response.json(
      {
        status: "ok",
        draw,
        count: draw.length,
        timestamp: new Date().toISOString(),
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    return Response.json(
      { error: "タロット生成失敗", message: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST（GET と同じ動作にしたい場合）
export async function POST(request) {
  return GET(request);
}