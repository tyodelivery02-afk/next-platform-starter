"use client"

import React, { useState } from 'react';

export default function APIDebugTool() {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});

  const testAPI = async (name, url) => {
    setLoading(prev => ({ ...prev, [name]: true }));
    try {
      const res = await fetch(url);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
      setResults(prev => ({
        ...prev,
        [name]: {
          status: res.status,
          ok: res.ok,
          data: data,
          error: null
        }
      }));
    } catch (err) {
      setResults(prev => ({
        ...prev,
        [name]: {
          status: 'ERROR',
          ok: false,
          data: null,
          error: err.message
        }
      }));
    }
    setLoading(prev => ({ ...prev, [name]: false }));
  };

  const tests = [
    {
      name: 'Token API',
      url: '/api/uranai/prokerala-token',
      description: 'Prokerala APIのトークンを取得'
    },
    {
      name: 'Panchang API',
      url: '/api/uranai/panchang?date=2024-11-18',
      description: '今日の吉凶時刻を取得'
    },
    {
      name: 'Horoscope API',
      url: '/api/uranai/daily-horoscope?sign=aries',
      description: '牡羊座の運勢を取得'
    },
    {
      name: 'Tarot API',
      url: '/api/uranai/tarot?count=3',
      description: 'タロットカード3枚を引く'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">🔧 API デバッグツール</h1>
        
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <h2 className="font-bold text-yellow-800 mb-2">⚠️ チェックポイント</h2>
          <ul className="list-disc list-inside text-yellow-700 space-y-1 text-sm">
            <li>環境変数 (.env) が正しく設定されているか</li>
            <li>API ファイルが pages/api/uranai/ に配置されているか</li>
            <li>開発サーバーが起動しているか (npm run dev)</li>
            <li>Prokerala の Client ID と Client Secret が有効か</li>
          </ul>
        </div>

        <div className="grid gap-4">
          {tests.map((test) => (
            <div key={test.name} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{test.name}</h3>
                  <p className="text-sm text-gray-600">{test.description}</p>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-1 inline-block">
                    {test.url}
                  </code>
                </div>
                <button
                  onClick={() => testAPI(test.name, test.url)}
                  disabled={loading[test.name]}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                >
                  {loading[test.name] ? 'テスト中...' : 'テスト実行'}
                </button>
              </div>

              {results[test.name] && (
                <div className="mt-4">
                  <div className={`flex items-center gap-2 mb-3 ${
                    results[test.name].ok ? 'text-green-600' : 'text-red-600'
                  }`}>
                    <span className="text-2xl">
                      {results[test.name].ok ? '✅' : '❌'}
                    </span>
                    <span className="font-bold">
                      ステータス: {results[test.name].status}
                      {results[test.name].ok ? ' (成功)' : ' (失敗)'}
                    </span>
                  </div>

                  {results[test.name].error && (
                    <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
                      <p className="text-red-800 font-semibold">エラー:</p>
                      <p className="text-red-700 text-sm mt-1">{results[test.name].error}</p>
                    </div>
                  )}

                  <details className="bg-gray-50 rounded p-3">
                    <summary className="cursor-pointer font-semibold text-gray-700 hover:text-gray-900">
                      レスポンス詳細を表示
                    </summary>
                    <pre className="mt-3 text-xs bg-gray-900 text-green-400 p-4 rounded overflow-x-auto">
                      {JSON.stringify(results[test.name].data, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">📋 環境変数チェック</h2>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="font-semibold text-gray-700 w-48">NEXT_PUBLIC_BASE_URL:</span>
              <code className="bg-gray-100 px-2 py-1 rounded flex-1">
                {typeof window !== 'undefined' && window.location.origin}
              </code>
            </div>
            <p className="text-gray-600 text-xs mt-3">
              ⚠️ Client ID と Client Secret は .env ファイルで確認してください（セキュリティ上、ブラウザには表示されません）
            </p>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4">
          <h3 className="font-bold text-blue-800 mb-2">💡 トラブルシューティング</h3>
          <div className="text-sm text-blue-700 space-y-2">
            <p><strong>Token API が失敗する場合:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Client ID と Client Secret が正しいか確認</li>
              <li>.env ファイルが .env.local になっているか確認</li>
              <li>開発サーバーを再起動 (Ctrl+C → npm run dev)</li>
            </ul>
            
            <p className="mt-3"><strong>Panchang/Horoscope API が失敗する場合:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Token API が成功しているか先に確認</li>
              <li>NEXT_PUBLIC_BASE_URL が正しく設定されているか</li>
              <li>ネットワーク接続を確認</li>
            </ul>

            <p className="mt-3"><strong>すべてのAPIが404エラーの場合:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>ファイルパスを確認: pages/api/uranai/*.js</li>
              <li>Next.js のルーティング設定を確認</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}