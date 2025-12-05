"use client";

import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function DictionaryPage() {
  const [word, setWord] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [customEntry, setCustomEntry] = useState({
    word: "",
    meanings: [{ partOfSpeech: "", definitions: [""] }],
    translations: { zh: "", ja: "", fr: "", de: "", ko: "" }
  });
  const [topEntries, setTopEntries] = useState([]);

  // 词性选项
  const partOfSpeechOptions = [
    { value: "", label: "選択してください" },
    { value: "noun", label: "名詞 (noun)" },
    { value: "verb", label: "動詞 (verb)" },
    { value: "adjective", label: "形容詞 (adjective)" },
    { value: "adverb", label: "副詞 (adverb)" },
    { value: "pronoun", label: "代名詞 (pronoun)" },
    { value: "preposition", label: "前置詞 (preposition)" },
    { value: "conjunction", label: "接続詞 (conjunction)" },
    { value: "interjection", label: "感嘆詞 (interjection)" },
    { value: "article", label: "冠詞 (article)" }
  ];

  useEffect(() => {
    loadTopEntries();
  }, []);

  async function loadTopEntries() {
    try {
      const res = await fetch("/api/dict/top?limit=10");
      const data = await res.json();
      setTopEntries(data.entries || []);
    } catch (e) {
      console.error("Error loading top entries:", e);
    }
  }

  async function searchDatabase(searchWord) {
    try {
      const res = await fetch(`/api/dict/myword?word=${encodeURIComponent(searchWord)}`);
      if (res.ok) {
        const data = await res.json();
        await loadTopEntries();
        return data;
      }
      return null;
    } catch (e) {
      console.error("Error searching database:", e);
      return null;
    }
  }

  async function search() {
    if (!word.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setShowCustomForm(false);
    setIsEditing(false);

    try {
      // 先搜索数据库中的自定义词条
      const dbResult = await searchDatabase(word.trim());
      
      if (dbResult) {
        setResult(dbResult);
      } else {
        // 如果数据库没有，则调用外部API
        const res = await fetch(`/api/dict?word=${encodeURIComponent(word)}`);
        const json = await res.json();
        if (json.error) {
          setError(json.error);
        } else {
          setResult({ ...json, isCustom: false });
        }
      }
    } catch (err) {
      setError("No results");
    }

    setLoading(false);
  }

  function openCustomForm() {
    setShowCustomForm(true);
    if (result && result.isCustom) {
      setIsEditing(true);
      setCustomEntry({
        word: result.word,
        meanings: result.meanings || [{ partOfSpeech: "", definitions: [""] }],
        translations: result.translations || { zh: "", ja: "", fr: "", de: "", ko: "" }
      });
    } else {
      setIsEditing(false);
      setCustomEntry({
        word: word.trim(),
        meanings: [{ partOfSpeech: "", definitions: [""] }],
        translations: { zh: "", ja: "", fr: "", de: "", ko: "" }
      });
    }
  }

  async function saveCustomEntry() {
    if (!customEntry.word.trim()) {
      alert("単語を入力してください");
      return;
    }

    const payload = {
      word: customEntry.word,
      meanings: customEntry.meanings.filter(m => 
        m.partOfSpeech && m.definitions.some(d => d.trim())
      ).map(m => ({
        ...m,
        definitions: m.definitions.filter(d => d.trim())
      })),
      translations: customEntry.translations
    };

    try {
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch("/api/dict/myword", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "保存に失敗しました");
        return;
      }

      // 重新搜索以获取更新后的数据
      const updatedResult = await searchDatabase(customEntry.word);
      if (updatedResult) {
        setResult(updatedResult);
      }
      
      setShowCustomForm(false);
      await loadTopEntries();
      alert("保存されました！");
    } catch (e) {
      console.error("Error saving entry:", e);
      alert("保存失敗しました");
    }
  }

  function addMeaning() {
    setCustomEntry({
      ...customEntry,
      meanings: [...customEntry.meanings, { partOfSpeech: "", definitions: [""] }]
    });
  }

  function updateMeaning(index, field, value) {
    const newMeanings = [...customEntry.meanings];
    newMeanings[index][field] = value;
    setCustomEntry({ ...customEntry, meanings: newMeanings });
  }

  function addDefinition(meaningIndex) {
    const newMeanings = [...customEntry.meanings];
    newMeanings[meaningIndex].definitions.push("");
    setCustomEntry({ ...customEntry, meanings: newMeanings });
  }

  function updateDefinition(meaningIndex, defIndex, value) {
    const newMeanings = [...customEntry.meanings];
    newMeanings[meaningIndex].definitions[defIndex] = value;
    setCustomEntry({ ...customEntry, meanings: newMeanings });
  }

  function updateTranslation(lang, value) {
    setCustomEntry({
      ...customEntry,
      translations: { ...customEntry.translations, [lang]: value }
    });
  }

  return (
    <div className="min-h-screen bg-gray-100 text-black">
      <div className="max-w-5xl mx-auto p-8">
        <div className="bg-white rounded-sm shadow-sm p-8 mb-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-6 font-mono font-bold text-2xl">
            <span>What does</span>
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && search()}
              // placeholder="単語を入力..."
              className="border border-gray-300 p-3 flex-1 rounded-sm focus:outline-none focus:border-gray-500"
            />
            <button
              onClick={search}
              className="bg-gray-700 text-white text-xl px-8 py-3 rounded-sm hover:bg-black transition-all tracking-wide"
            >
              mean?
            </button>
          </div>

          {loading && <p className="text-yellow-600 font-bold">Searching</p>}
          {error && <p className="text-red-800 font-bold">{error}</p>}

          {(result || error) && (
            <div className="flex items-center gap-2 mt-4 font-mono font-bold text-xl">
              <span>To</span>
              <button
                onClick={openCustomForm}
                className="bg-gray-700 text-white px-6 py-2 rounded-sm hover:bg-black transition-all"
              >
                {result && result.isCustom ? "modify" : "expand"}
              </button>
              <span>the meaning of {word || "a word"}</span>
            </div>
          )}
        </div>

        {showCustomForm && (
          <div className="bg-white rounded-sm shadow-sm p-8 mb-6 border border-gray-200">
            <h2 className="text-3xl font-light mb-6">
              {isEditing ? "編集" : "新規"}
            </h2>
            
            <div className="mb-6">
              <label className="block font-normal mb-2 text-gray-700">単語</label>
              <input
                value={customEntry.word}
                onChange={(e) => setCustomEntry({ ...customEntry, word: e.target.value })}
                className="border border-gray-300 p-3 w-full rounded-sm focus:outline-none focus:border-gray-500"
                disabled={isEditing}
              />
            </div>

            <div className="mb-6">
              <label className="block font-normal mb-2">意味</label>
              {customEntry.meanings.map((m, i) => (
                <div key={i} className="border border-gray-300 p-4 rounded-sm mb-3 bg-gray-50">
                  <select
                    value={m.partOfSpeech}
                    onChange={(e) => updateMeaning(i, "partOfSpeech", e.target.value)}
                    className="border border-gray-300 p-3 w-full rounded-sm mb-2 bg-white focus:outline-none focus:border-gray-500"
                  >
                    {partOfSpeechOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {m.definitions.map((def, j) => (
                    <input
                      key={j}
                      value={def}
                      onChange={(e) => updateDefinition(i, j, e.target.value)}
                      placeholder={`定義 ${j + 1}`}
                      className="border border-gray-300 p-3 w-full rounded-sm mb-2 bg-white focus:outline-none focus:border-gray-500"
                    />
                  ))}
                  <button
                    onClick={() => addDefinition(i)}
                    className="text-sm text-gray-600 hover:text-black font-light"
                  >
                    + 定義を追加
                  </button>
                </div>
              ))}
              <button
                onClick={addMeaning}
                className="text-gray-600 hover:text-black font-light"
              >
                + 意味を追加
              </button>
            </div>

            <div className="mb-6">
              <label className="block font-normal mb-2">翻訳</label>
              <div className="space-y-2">
                <input
                  value={customEntry.translations.zh}
                  onChange={(e) => updateTranslation("zh", e.target.value)}
                  placeholder="中文"
                  className="border border-gray-300 p-3 w-full rounded-sm bg-white focus:outline-none focus:border-gray-500"
                />
                <input
                  value={customEntry.translations.ja}
                  onChange={(e) => updateTranslation("ja", e.target.value)}
                  placeholder="日本語"
                  className="border border-gray-300 p-3 w-full rounded-sm bg-white focus:outline-none focus:border-gray-500"
                />
                <input
                  value={customEntry.translations.fr}
                  onChange={(e) => updateTranslation("fr", e.target.value)}
                  placeholder="Français"
                  className="border border-gray-300 p-3 w-full rounded-sm bg-white focus:outline-none focus:border-gray-500"
                />
                <input
                  value={customEntry.translations.de}
                  onChange={(e) => updateTranslation("de", e.target.value)}
                  placeholder="Deutsch"
                  className="border border-gray-300 p-3 w-full rounded-sm bg-white focus:outline-none focus:border-gray-500"
                />
                <input
                  value={customEntry.translations.ko}
                  onChange={(e) => updateTranslation("ko", e.target.value)}
                  placeholder="한국어"
                  className="border border-gray-300 p-3 w-full rounded-sm bg-white focus:outline-none focus:border-gray-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={saveCustomEntry}
                className="bg-gray-800 text-white px-8 py-3 rounded-sm hover:bg-black transition font-normal"
              >
                保存
              </button>
              <button
                onClick={() => setShowCustomForm(false)}
                className="bg-gray-400 text-white px-8 py-3 rounded-sm hover:bg-gray-500 transition font-normal"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            {result.isCustom && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  カスタムエントリ | 閲覧数: {result.visits || 0} | 作成者IP: {result.creatorIP} | 
                  最終更新: {new Date(result.updatedAt).toLocaleString('ja-JP')}
                </p>
              </div>
            )}

            <h2 className="text-2xl font-bold mb-4">{result.word}</h2>
            
            <div className="border-t-2 border-indigo-200 my-4"></div>

            <div className="mb-6">
              <h3 className="text-xl font-bold mb-3">意味</h3>
              {result.meanings?.map((m, i) => (
                <div key={i} className="p-4 border-2 border-indigo-100 rounded-lg bg-indigo-50 mb-3">
                  <p className="font-semibold text-indigo-700 mb-2">{m.partOfSpeech}</p>
                  <ul className="list-disc ml-6 space-y-1">
                    {m.definitions.map((d, j) => (
                      <li key={j} className="text-gray-700">{d}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="border-t-2 border-indigo-200 my-4"></div>

            <div>
              <h3 className="text-xl font-bold mb-3">翻訳</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded">
                  <strong>中文:</strong> {result.translations?.zh || "-"}
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <strong>日本語:</strong> {result.translations?.ja || "-"}
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <strong>Français:</strong> {result.translations?.fr || "-"}
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <strong>Deutsch:</strong> {result.translations?.de || "-"}
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <strong>한국어:</strong> {result.translations?.ko || "-"}
                </div>
              </div>
            </div>
          </div>
        )}

        {topEntries.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4 text-indigo-900">閲覧数トップ10のエントリ</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topEntries}>
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="visits" fill="#4f46e5" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}