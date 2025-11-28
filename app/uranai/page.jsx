"use client"

import React, { useState, useEffect } from 'react';

export default function DailyDivination() {
  const ZODIAC = [
    { id: 'aries', name: '牡羊座', emoji: '♈', dates: '3/21-4/19' },
    { id: 'taurus', name: '牡牛座', emoji: '♉', dates: '4/20-5/20' },
    { id: 'gemini', name: '双子座', emoji: '♊', dates: '5/21-6/21' },
    { id: 'cancer', name: '蟹座', emoji: '♋', dates: '6/22-7/22' },
    { id: 'leo', name: '獅子座', emoji: '♌', dates: '7/23-8/22' },
    { id: 'virgo', name: '乙女座', emoji: '♍', dates: '8/23-9/22' },
    { id: 'libra', name: '天秤座', emoji: '♎', dates: '9/23-10/23' },
    { id: 'scorpio', name: '蠍座', emoji: '♏', dates: '10/24-11/21' },
    { id: 'sagittarius', name: '射手座', emoji: '♐', dates: '11/22-12/21' },
    { id: 'capricorn', name: '山羊座', emoji: '♑', dates: '12/22-1/19' },
    { id: 'aquarius', name: '水瓶座', emoji: '♒', dates: '1/20-2/18' },
    { id: 'pisces', name: '魚座', emoji: '♓', dates: '2/19-3/20' }
  ];

  const [activeTab, setActiveTab] = useState('horoscope');
  const [sign, setSign] = useState('aries');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [horoscope, setHoroscope] = useState(null);
  const [tarotCount, setTarotCount] = useState(3);
  const [tarotDraw, setTarotDraw] = useState(null);

  useEffect(() => {
    const today = new Date();
    const formatted = today.toISOString().split('T')[0];
    setDate(formatted);
  }, []);

  const fetchHoroscope = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ sign, timezone: 'Asia/Tokyo' });
      if (date) q.set('date', date);
      const res = await fetch(`/api/uranai/daily-horoscope?${q.toString()}`);
      const text = await res.text();
      if (!res.ok) throw new Error(text || 'APIエラー');
      const json = JSON.parse(text);
      setHoroscope(json.data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
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

  const renderStars = (rating) => {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-yellow-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-2 text-purple-800">
          ✨ 毎日の占い ✨
        </h1>
        <p className="text-center text-gray-600 mb-6">あなたの運勢を今日も見守ります</p>

        {/* タブ切り替え */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('horoscope')}
            className={`flex-1 py-3 rounded-lg font-semibold transition ${
              activeTab === 'horoscope'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            🌟 星座運勢
          </button>
          <button
            onClick={() => setActiveTab('tarot')}
            className={`flex-1 py-3 rounded-lg font-semibold transition ${
              activeTab === 'tarot'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            🔮 タロット占い
          </button>
        </div>

        {/* 星座運勢 */}
        {activeTab === 'horoscope' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-2xl font-bold mb-4 text-purple-700">あなたの星座を選択</h2>
              
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-6">
                {ZODIAC.map((z) => (
                  <button
                    key={z.id}
                    onClick={() => setSign(z.id)}
                    className={`p-4 rounded-xl transition transform hover:scale-105 ${
                      sign === z.id
                        ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className="text-3xl mb-1">{z.emoji}</div>
                    <div className="text-sm font-semibold">{z.name}</div>
                    <div className="text-xs opacity-75">{z.dates}</div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3 mb-4">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="flex-1 border-2 border-purple-200 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={fetchHoroscope}
                  disabled={loading}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-2 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50"
                >
                  {loading ? '占い中...' : '運勢を見る'}
                </button>
              </div>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}
            </div>

            {/* 運勢結果 */}
            {horoscope && (
              <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
                <div className="text-center border-b pb-4">
                  <h3 className="text-3xl font-bold text-purple-800 mb-2">
                    {horoscope.signName} の運勢
                  </h3>
                  <p className="text-gray-600">{horoscope.date}</p>
                  <div className="text-3xl text-yellow-500 mt-2">
                    {renderStars(horoscope.overallRating)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <span className="font-semibold text-purple-700">支配星:</span> {horoscope.rulingPlanet}
                  </div>
                  <div className="bg-pink-50 p-3 rounded-lg">
                    <span className="font-semibold text-pink-700">ラッキーカラー:</span> {horoscope.luckyColor}
                  </div>
                  <div className="bg-yellow-50 p-3 rounded-lg">
                    <span className="font-semibold text-yellow-700">ラッキーナンバー:</span> {horoscope.luckyNumber}
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <span className="font-semibold text-blue-700">エレメント:</span> {horoscope.element}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg">
                    <h4 className="font-bold text-purple-700 mb-2">💫 総合運</h4>
                    <p className="text-gray-700">{horoscope.fortune.overall}</p>
                  </div>

                  <div className="bg-gradient-to-r from-red-50 to-pink-50 p-4 rounded-lg">
                    <h4 className="font-bold text-red-700 mb-2">❤️ 恋愛運</h4>
                    <p className="text-gray-700">{horoscope.fortune.love}</p>
                  </div>

                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-lg">
                    <h4 className="font-bold text-blue-700 mb-2">💼 仕事運</h4>
                    <p className="text-gray-700">{horoscope.fortune.work}</p>
                  </div>

                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-4 rounded-lg">
                    <h4 className="font-bold text-yellow-700 mb-2">💰 金運</h4>
                    <p className="text-gray-700">{horoscope.fortune.money}</p>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-teal-50 p-4 rounded-lg">
                    <h4 className="font-bold text-green-700 mb-2">🍀 健康運</h4>
                    <p className="text-gray-700">{horoscope.fortune.health}</p>
                  </div>

                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg border-2 border-purple-200">
                    <h4 className="font-bold text-indigo-700 mb-2">✨ 今日のアドバイス</h4>
                    <p className="text-gray-700">{horoscope.advice}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* タロット占い */}
        {activeTab === 'tarot' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-2xl font-bold mb-4 text-purple-700">タロットカードを引く</h2>
              
              <div className="flex gap-4 items-center mb-4">
                <label className="font-semibold text-gray-700">枚数:</label>
                <select
                  value={tarotCount}
                  onChange={(e) => setTarotCount(parseInt(e.target.value))}
                  className="border-2 border-purple-200 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                >
                  <option value={1}>1枚引き（今日の運勢）</option>
                  <option value={3}>3枚引き（過去・現在・未来）</option>
                  <option value={5}>5枚引き（詳細占い）</option>
                  <option value={10}>10枚引き（ケルト十字）</option>
                </select>
                <button
                  onClick={drawTarot}
                  disabled={loading}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-2 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50"
                >
                  {loading ? 'シャッフル中...' : 'カードを引く'}
                </button>
              </div>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}
            </div>

            {/* タロット結果 */}
            {tarotDraw && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-xl p-6">
                  <h3 className="text-2xl font-bold text-purple-800 mb-4 text-center">
                    🔮 あなたのカード
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tarotDraw.draw.map((card, i) => (
                      <div
                        key={i}
                        className={`p-6 rounded-xl shadow-lg transform transition hover:scale-105 ${
                          card.reversed
                            ? 'bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-gray-400'
                            : 'bg-gradient-to-br from-purple-100 to-pink-100 border-2 border-purple-300'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <span className="text-sm font-semibold text-gray-600">
                              カード {card.position}
                            </span>
                            <h4 className="text-xl font-bold text-purple-800">
                              {card.name}
                            </h4>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-semibold ${
                              card.reversed
                                ? 'bg-gray-200 text-gray-700'
                                : 'bg-purple-200 text-purple-700'
                            }`}
                          >
                            {card.interpretation}
                          </span>
                        </div>
                        <p className="text-gray-700 leading-relaxed">{card.meaning}</p>
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