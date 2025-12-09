"use client"

import React, { useState, useEffect } from 'react';
import { X } from "phosphor-react";
import {
  TbZodiacAries,
  TbZodiacTaurus,
  TbZodiacGemini,
  TbZodiacCancer,
  TbZodiacLeo,
  TbZodiacVirgo,
  TbZodiacLibra,
  TbZodiacScorpio,
  TbZodiacSagittarius,
  TbZodiacCapricorn,
  TbZodiacAquarius,
  TbZodiacPisces
} from 'react-icons/tb';

// マップを作成してアイコンコンポーネントをルックアップできるようにする
const ZodiacIconMap = {
  Aries: TbZodiacAries,
  Taurus: TbZodiacTaurus,
  Gemini: TbZodiacGemini,
  Cancer: TbZodiacCancer,
  Leo: TbZodiacLeo,
  Virgo: TbZodiacVirgo,
  Libra: TbZodiacLibra,
  Scorpio: TbZodiacScorpio,
  Sagittarius: TbZodiacSagittarius,
  Capricorn: TbZodiacCapricorn,
  Aquarius: TbZodiacAquarius,
  Pisces: TbZodiacPisces
};


// 運勢の星表示関数 (Star Rating Function)
const renderStars = (rating) => {
  const validRating = Math.max(1, Math.min(5, Number(rating) || 0));
  return '★'.repeat(validRating) + '☆'.repeat(5 - validRating);
};

// =======================================================
// CardView コンポーネント (CardView Component)
// =======================================================
const CardView = ({ sign, isSelected, horoscope, onSelect, onReset }) => {
  const { id, name, icon, dates } = sign;
  const isFlipped = isSelected && horoscope;

  // 動的にアイコンコンポーネントを取得 (TbZodiac...)
  const IconComponent = ZodiacIconMap[icon];

  return (
    <div
      className={`relative w-full perspective-1000 cursor-pointer transition-transform duration-500 ease-in-out ${isFlipped ? 'h-[32rem] sm:w-[30rem]' : 'h-48 sm:h-64'
        }`}
      onClick={() => !isFlipped && onSelect(id)}
    >
      <div
        className={`absolute w-full h-full transform preserve-3d transition-transform duration-1000 ${isFlipped ? 'rotate-y-180 scale-100' : 'scale-95 hover:scale-100 hover:shadow-2xl'
          } shadow-purple-900/50`}
      >
        {/* カードの表面 (Front Face) */}
        <div
          className={`absolute w-full h-full backface-hidden rounded-2xl p-4 flex flex-col justify-center items-center text-center
             bg-gradient-to-br from-gray-900 to-black text-white shadow-2xl border-2 border-purple-600 transition duration-500 hover:border-yellow-400`}
        >
          {/* Tabler Icon SVG をレンダリング (線画・黄色) */}
          <div className="mb-4 font-bold text-yellow-400">
            {IconComponent ? (
              // サイズ64px、黄色で表示
              <IconComponent size={64} className="text-yellow-400" />
            ) : (
              <span className="text-6xl text-yellow-400">{name.charAt(0)}</span>
            )}
          </div>

          <div className="text-2xl font-bold text-yellow-400">{name}</div>
          <div className="text-sm opacity-60 mt-1 text-white">{dates}</div>
          <div className="mt-4 text-sm font-sans text-purple-400">タップして今日の運勢を占う</div>
        </div>

        {/* カードの裏面 (Back Face) - ... (変更なし) */}
        <div
          className={`absolute w-full h-full backface-hidden rounded-2xl bg-white/5 text-white shadow-2xl border-2 border-yellow-400 transform rotate-y-180 relative backdrop-blur-sm`}
        >
          {horoscope && (
            <div className="h-full flex flex-col">
              {/* === X 閉じるボタン (リセット) === */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReset();
                }}
                className="absolute top-3 right-3 p-1 text-gray-300 hover:text-yellow-400 transition bg-black/50 rounded-full z-30 shadow-md border border-purple-800"
                aria-label="リセットして閉じる"
              >
                <X size={20} weight="bold" />
              </button>

              {/* 内部スクロールコンテンツコンテナ */}
              <div className="p-5 flex-grow overflow-y-auto">
                <div className="h-full flex flex-col space-y-4">
                  {/* 1. タイトルと概要 (Title and Summary) */}
                  <div className="text-center pb-3 border-b border-purple-600">
                    <h4 className="text-3xl font-serif font-bold text-yellow-400">{horoscope.signName}</h4>
                    <p className="text-sm text-gray-400">{horoscope.date} の運勢</p>
                    <div className="text-4xl text-yellow-400 mt-2 font-mono">
                      {renderStars(horoscope.overallRating)}
                    </div>
                  </div>

                  {/* 2. 詳細予言コンテンツ (Detailed Prophecy Content) */}
                  <div className="flex-grow space-y-4 pt-2">
                    {/* 幸運要素 (Lucky Elements) */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-black/40 p-3 rounded-lg border border-purple-700">
                        <span className="font-semibold text-purple-400 block">支配星:</span> <span className='text-white'>{horoscope.rulingPlanet}</span>
                      </div>
                      <div className="bg-black/40 p-3 rounded-lg border border-purple-700">
                        <span className="font-semibold text-purple-400 block">ラッキーカラー:</span> <span className='text-white'>{horoscope.luckyColor}</span>
                      </div>
                      <div className="bg-black/40 p-3 rounded-lg border border-purple-700">
                        <span className="font-semibold text-purple-400 block">ラッキーナンバー:</span> <span className='text-white'>{horoscope.luckyNumber}</span>
                      </div>
                      <div className="bg-black/40 p-3 rounded-lg border border-purple-700">
                        <span className="font-semibold text-purple-400 block">エレメント:</span> <span className='text-white'>{horoscope.element}</span>
                      </div>
                    </div>

                    {/* 各項運勢 (Individual Fortunes) */}
                    <div className="space-y-4">
                      {/* 全体運 (Overall) */}
                      <div className="bg-black/40 p-4 rounded-lg text-sm border-l-4 border-yellow-400">
                        <h4 className="font-bold text-yellow-400 mb-1">全体運</h4>
                        <p className="text-gray-300">{horoscope.fortune.overall}</p>
                      </div>
                      {/* 恋愛運 (Love) */}
                      <div className="bg-black/40 p-4 rounded-lg text-sm border-l-4 border-purple-400">
                        <h4 className="font-bold text-purple-400 mb-1">恋愛運</h4>
                        <p className="text-gray-300">{horoscope.fortune.love}</p>
                      </div>
                      {/* 仕事運 (Work) */}
                      <div className="bg-black/40 p-4 rounded-lg text-sm border-l-4 border-purple-400">
                        <h4 className="font-bold text-purple-400 mb-1">仕事運</h4>
                        <p className="text-gray-300">{horoscope.fortune.work}</p>
                      </div>
                      {/* 金運 (Money) */}
                      <div className="bg-black/40 p-4 rounded-lg text-sm border-l-4 border-purple-400">
                        <h4 className="font-bold text-purple-400 mb-1">金運</h4>
                        <p className="text-gray-300">{horoscope.fortune.money}</p>
                      </div>
                      {/* 健康運 (Health) */}
                      <div className="bg-black/40 p-4 rounded-lg text-sm border-l-4 border-purple-400">
                        <h4 className="font-bold text-purple-400 mb-1">健康運</h4>
                        <p className="text-gray-300">{horoscope.fortune.health}</p>
                      </div>
                    </div>

                    {/* アドバイス (Advice/Message) */}
                    <div className="bg-purple-900/50 p-4 mb-6 rounded-lg border-2 border-yellow-400/50 text-sm">
                      <h4 className="font-bold text-yellow-400 mb-1">星からのメッセージ</h4>
                      <p className="text-white">{horoscope.advice}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


export default function DailyDivination() {
  const ZODIAC = [
    { id: 'aries', name: '牡羊座', icon: 'Aries', dates: '3/21-4/19' },
    { id: 'taurus', name: '牡牛座', icon: 'Taurus', dates: '4/20-5/20' },
    { id: 'gemini', name: '双子座', icon: 'Gemini', dates: '5/21-6/21' },
    { id: 'cancer', name: '蟹座', icon: 'Cancer', dates: '6/22-7/22' },
    { id: 'leo', name: '獅子座', icon: 'Leo', dates: '7/23-8/22' },
    { id: 'virgo', name: '乙女座', icon: 'Virgo', dates: '8/23-9/22' },
    { id: 'libra', name: '天秤座', icon: 'Libra', dates: '9/23-10/23' },
    { id: 'scorpio', name: '蠍座', icon: 'Scorpio', dates: '10/24-11/21' },
    { id: 'sagittarius', name: '射手座', icon: 'Sagittarius', dates: '11/22-12/21' },
    { id: 'capricorn', name: '山羊座', icon: 'Capricorn', dates: '12/22-1/19' },
    { id: 'aquarius', name: '水瓶座', icon: 'Aquarius', dates: '1/20-2/18' },
    { id: 'pisces', name: '魚座', icon: 'Pisces', dates: '2/19-3/20' }
  ];

  const [activeTab, setActiveTab] = useState('horoscope');
  const [selectedSign, setSelectedSign] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [horoscope, setHoroscope] = useState(null);
  const [tarotCount, setTarotCount] = useState(3);
  const [tarotDraw, setTarotDraw] = useState(null);

  useEffect(() => {
    if (selectedSign) {
      setHoroscope(null);
      setError(null);
    }
  }, [selectedSign]);


  const fetchHoroscope = async (signId) => {
    const signToFetch = signId || selectedSign;
    if (!signToFetch) return;

    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ sign: signToFetch, timezone: 'Asia/Tokyo' });

      const res = await fetch(`/api/uranai/daily-horoscope?${q.toString()}`);
      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || 'APIリクエストに失敗しました');
      }

      const json = JSON.parse(text);

      setHoroscope(json.data);

    } catch (e) {
      console.error("運勢の取得エラー:", e);
      setError(e.message || '運勢データの取得中にエラーが発生しました');
      setHoroscope(null);
    }
    setLoading(false);
  };

  const handleSignSelect = (signId) => {
    if (selectedSign === signId && horoscope) return;

    setSelectedSign(signId);
    fetchHoroscope(signId);
  };

  const handleReset = () => {
    setSelectedSign(null);
    setHoroscope(null);
    setError(null);
  };


  const drawTarot = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/uranai/tarot?count=${tarotCount}`);
      const text = await res.text();
      if (!res.ok) throw new Error(text || 'タロットAPIエラー');
      const json = JSON.parse(text);
      setTarotDraw(json);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="bg-gradient-to-br from-black via-gray-900 to-indigo-950 min-h-screen pt-12 pb-20 text-white">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-4xl font-serif font-bold text-center mb-2 text-yellow-400 drop-shadow-lg shadow-black">
          運命の先へ
        </h1>
        <p className="text-center text-gray-400 mb-8 font-sans">星々の導き、神秘の啓示</p>

        {/* Tab 切替 */}
        <div className="flex gap-2 mb-8 p-1 bg-black/50 rounded-xl border border-purple-800">
          <button
            onClick={() => setActiveTab('horoscope')}
            className={`flex-1 py-3 rounded-lg font-semibold transition text-lg ${activeTab === 'horoscope'
              ? 'bg-purple-800 text-yellow-400 shadow-xl border border-yellow-400'
              : 'bg-transparent text-gray-300 hover:bg-black'
              }`}
          >
            星占い
          </button>
          <button
            onClick={() => setActiveTab('tarot')}
            className={`flex-1 py-3 rounded-lg font-semibold transition text-lg ${activeTab === 'tarot'
              ? 'bg-purple-800 text-yellow-400 shadow-xl border border-yellow-400'
              : 'bg-transparent text-gray-300 hover:bg-black'
              }`}
          >
            タロット
          </button>
        </div>

        {/* 星座運勢 Tab */}
        {activeTab === 'horoscope' && (
          <div className="space-y-8">
            <div className="bg-black/50 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border-2 border-purple-800">

              <div className="flex gap-3 items-center justify-center mb-6 text-gray-200">
                <div className="border border-purple-500 rounded-lg px-4 py-2 bg-black text-white">
                  {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>

              {/* 星座カードグリッドコンテナ (Zodiac Card Grid Container) */}
              <div
                className={`relative transition-all duration-1000 ${selectedSign
                  ? 'flex justify-center items-center h-[35rem]'
                  : 'grid grid-cols-3 sm:grid-cols-4 gap-4'
                  }`}
              >
                {ZODIAC.map((z) => {
                  const isCurrent = z.id === selectedSign;

                  let cardClasses = 'col-span-1 transition-all duration-700';

                  if (selectedSign) {
                    if (isCurrent) {
                      cardClasses += ' z-20';
                    } else {
                      cardClasses += ' opacity-0 scale-50 absolute pointer-events-none';
                    }
                  } else {
                    cardClasses += ' opacity-100 scale-100';
                  }

                  return (
                    <div
                      key={z.id}
                      className={cardClasses}
                    >
                      <CardView
                        sign={z}
                        isSelected={isCurrent}
                        horoscope={isCurrent ? horoscope : null}
                        onSelect={handleSignSelect}
                        onReset={handleReset}
                      />
                    </div>
                  );
                })}
              </div>

              {/* ロード/エラーメッセージ (Load/Error Message) */}
              <div className='text-center mt-6 h-10'>
                {loading && <p className="text-yellow-400 font-semibold">運命のメッセージを読み込み中...</p>}
                {error && (
                  <div className="bg-purple-900/50 border border-yellow-600 text-yellow-300 px-4 py-3 rounded-lg">
                    エラー: {error}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* タロット占い Tab (Tarot Tab) */}
        {activeTab === 'tarot' && (
          <div className="space-y-8">
            <div className="bg-black/50 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border-2 border-purple-800">

              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center mb-4 text-gray-200">
                <label className="font-semibold text-white">スプレッド:</label>
                <select
                  value={tarotCount}
                  onChange={(e) => setTarotCount(parseInt(e.target.value))}
                  className="border border-purple-500 rounded-lg px-4 py-2 focus:outline-none focus:border-yellow-400 bg-black text-white"
                >
                  <option value={1}>1枚引き(今日の運勢)</option>
                  <option value={3}>3枚引き(過去・現在・未来)</option>
                  <option value={5}>5枚引き(詳細占い)</option>
                  <option value={10}>10枚引き(ケルト十字)</option>
                </select>
                <button
                  onClick={drawTarot}
                  disabled={loading}
                  className="bg-gradient-to-r from-purple-700 to-indigo-700 text-yellow-400 px-8 py-2 rounded-lg font-bold hover:from-purple-800 hover:to-indigo-800 transition disabled:opacity-50 border-2 border-yellow-400/50"
                >
                  {loading ? 'シャッフル中...' : '引く'}
                </button>
              </div>

              {error && (
                <div className="bg-purple-900/50 border border-yellow-600 text-yellow-300 px-4 py-3 rounded-lg mt-4">
                  エラー: {error}
                </div>
              )}
            </div>

            {/* タロット結果 (Tarot Results) */}
            {tarotDraw && (
              <div className="space-y-4">
                <div className="bg-black/50 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border-2 border-purple-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {tarotDraw.draw.map((card, i) => (
                      <div
                        key={i}
                        className={`p-6 rounded-xl shadow-lg transform transition ${card.reversed
                          ? 'bg-gradient-to-br from-gray-900 to-black border-2 border-gray-700 text-gray-300'
                          : 'bg-gradient-to-br from-purple-900 to-black border-2 border-yellow-400 text-white'
                          }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <span className="text-sm font-semibold text-purple-400 block">
                              【{card.position}】
                            </span>
                            <h4 className="text-xl font-bold text-yellow-400">
                              {card.name}
                            </h4>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-semibold ${card.reversed
                              ? 'bg-gray-700 text-white'
                              : 'bg-yellow-400 text-black'
                              }`}
                          >
                            {card.interpretation}
                          </span>
                        </div>
                        <p className="leading-relaxed text-sm mt-2">{card.meaning}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}