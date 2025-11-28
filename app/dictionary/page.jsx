"use client";

import { useState } from "react";

export default function DictionaryPage() {
  const [word, setWord] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function search() {
    if (!word.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(`/api/dict?word=${encodeURIComponent(word)}`);
      const json = await res.json();
      if (json.error) setError(json.error);
      else setResult(json);
    } catch (err) {
      setError("Server error");
    }

    setLoading(false);
  }

  return (
    <div className="bg-style">
      <h1 className="text-3xl font-bold mb-4">Multi-Language Dictionary</h1>

      <div className="flex gap-2 mb-6">
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Enter English word..."
          className="border p-2 flex-1"
        />
        <button
          onClick={search}
          className="save-button"
        >
          Search
        </button>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}

      {result && (
        <div className="space-y-4">
          <div
            className="w-full h-6 my-6"
            style={{
              backgroundImage: "url(/images/divider.svg)",
              backgroundRepeat: "repeat-x",
              backgroundSize: "auto 35%",
              opacity: 0.8,
            }}
          />
          <div>
            <h3 className="font-bold">Meanings</h3>
            {result.meanings?.map((m, i) => (
              <div key={i} className="p-3 border rounded bg-gray-50">
                <p><strong>Part of Speech:</strong> {m.partOfSpeech}</p>
                <ul className="list-disc ml-6">
                  {m.definitions.map((d, j) => (
                    <li key={j}>{d}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div><div
            className="w-full h-6 my-6"
            style={{
              backgroundImage: "url(/images/divider.svg)",
              backgroundRepeat: "repeat-x",
              backgroundSize: "auto 35%",
              opacity: 0.8,
            }}
          />
          <div>
            <h3 className="font-bold">Translations</h3>
            <ul className="list-disc ml-6">
              <li><strong>中文:</strong> {result.translations?.zh || "-"}</li>
              <li><strong>日本語:</strong> {result.translations?.ja || "-"}</li>
              <li><strong>Français:</strong> {result.translations?.fr || "-"}</li>
              <li><strong>Deutsch:</strong> {result.translations?.de || "-"}</li>
              <li><strong>한국어:</strong> {result.translations?.ko || "-"}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
