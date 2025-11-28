import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const word = searchParams.get("word");

  if (!word) {
    return NextResponse.json({ error: "word parameter missing" }, { status: 400 });
  }

  try {
    // 获取 dictionaryapi.dev 定义
    const apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`;
    const res = await fetch(apiUrl);
    if (!res.ok) {
      return NextResponse.json({ error: "Word not found" }, { status: 404 });
    }
    const json = await res.json();
    const entry = json[0];

    // 解析 meanings
    const meanings = entry.meanings.map((m) => ({
      partOfSpeech: m.partOfSpeech,
      definitions: m.definitions.map((d) => d.definition),
    }));

    // 翻译
    const translations = await fetchMultiTranslations(word);

    return NextResponse.json({
      word: entry.word,
      phonetic: entry.phonetic || "",
      meanings,
      translations,
    });
  } catch (err) {
    return NextResponse.json({ error: "Server error", details: err.message }, { status: 500 });
  }
}

// 使用 MyMemory API 翻译
async function fetchMultiTranslations(word) {
  const langs = ["zh", "ja", "fr", "de", "ko"];
  const translations = {};

  await Promise.all(
    langs.map(async (lang) => {
      translations[lang] = await translateWord(word, lang);
    })
  );

  return translations;
}

async function translateWord(word, lang) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|${lang}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    return json?.responseData?.translatedText || "";
  } catch {
    return "";
  }
}
