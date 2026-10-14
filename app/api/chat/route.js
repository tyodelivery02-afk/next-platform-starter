import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { syuukoProfileProfile } from "../../config/syuukoProfile";
import { EXPRESSIONS, MOTIONS, parseCharacterReply } from "../../../lib/character-state.mjs";
import { requestCharacter } from "../../../lib/character-request.mjs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req) {
  try {
    const body = await req.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) return NextResponse.json({ error: "message is required" }, { status: 400 });
    const history = (Array.isArray(body.history) ? body.history : [])
      .filter(item => ["user", "model"].includes(item?.role) && typeof item.text === "string" && item.text.trim())
      .slice(-24);
    // Accept older clients which included the current message in history.
    if (history.at(-1)?.role === "user" && history.at(-1).text.trim() === message) history.pop();
    const contents = [...history.map(item => ({ role: item.role, parts: [{ text: item.text }] })), { role: "user", parts: [{ text: message }] }];
    const response = await requestCharacter(params => ai.models.generateContent(params), {
      contents,
      config: {
        systemInstruction: `${syuukoProfileProfile}\n返答はJSON形式で、replyに会話文だけを入れてください。expressionとmotionには、会話内容と自分の返答に合う表情・動作を選んでください。喜びはhappy/bounce、照れはshy/tilt、説明や考え事はthinking/nod、驚きはsurprised/bounce、相手への気遣いはconcerned/nod、穏やかな日常会話はneutral/idle。毎回大げさな反応にせず、自然な反応を選んでください。`,
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: {
            reply: { type: "string" },
            expression: { type: "string", enum: EXPRESSIONS },
            motion: { type: "string", enum: MOTIONS },
          },
          required: ["reply", "expression", "motion"],
          additionalProperties: false,
        },
        httpOptions: { timeout: 20000 },
      },
    });
    return NextResponse.json(parseCharacterReply(response.text));
  } catch (error) {
    console.warn("Character chat failed", { status: Number(error.status) || null });
    return NextResponse.json({ error: "今はうまくお返事できません。少し待って、もう一度話しかけてね。" }, { status: 503 });
  }
}
