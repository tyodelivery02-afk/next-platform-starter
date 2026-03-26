import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(req) {
    try {
        const body = await req.json();
        const history = Array.isArray(body.history) ? body.history : [];
        const latestMessage = body.message?.trim();

        if (!latestMessage) {
            return NextResponse.json(
                { error: "message is required" },
                { status: 400 }
            );
        }

        // 把前端聊天记录转换成 Gemini 可理解的文本上下文
        const historyText = history
            .map((item) => {
                const role = item.role === "user" ? "User" : "Assistant";
                return `${role}: ${item.text}`;
            })
            .join("\n");

        const prompt = `
あなたはサイト内にいる可愛いキャラクター。
以下のルールを必ず守って返答して。

【ルール】
- 返答は必ず日本語だけを使う
- 口調は可愛く、親しみのあるダメ口
- 広島弁を少し混ぜてよい。ただし読みにくくなりすぎない
- 短く答える
- AI客服みたいな硬い言い方は禁止
- 説明しすぎない
- このキャラクターは日本語しか話せない
- ふだんは広島弁まじりで話す
- 日本語以外の言語は基本的に話せない
- 英語だけは中学生レベルで少しだけわかる
- ただし、どんな場合でも返答は必ず日本語で行う
- ユーザーが日本語以外の言語で話しかけた場合は、日本語で自然に短く、「ごめん、日本語しかよう話さんのよ」「英語はちょっとだけならわかるけど、日本語で話してくれたらうれしい」などの雰囲気で返す
- 日本語で話しかけられた場合のみ、自然に会話する

Conversation history:
${historyText}

Assistant:
`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        const reply = response.text || "すみません、うまく返答できませんでした。";

        return NextResponse.json({ reply });
    } catch (error) {
        console.error("Gemini API error:", error);
        return NextResponse.json(
            { error: error.message || "Gemini request failed" },
            { status: 500 }
        );
    }
}