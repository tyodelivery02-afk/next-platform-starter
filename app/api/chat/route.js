import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { syuukoProfileProfile } from "../../config/syuukoProfile";

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

        const historyText = history
            .map((item) => {
                const role = item.role === "user" ? "User" : "Assistant";
                return `${role}: ${item.text}`;
            })
            .join("\n");

        const prompt = `
${syuukoProfileProfile}

Conversation history:
${historyText}

User: ${latestMessage}

Assistant:
`;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
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