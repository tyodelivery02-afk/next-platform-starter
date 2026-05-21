import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";
import crypto from "crypto";
import { createWorker } from "tesseract.js";

export const runtime = "nodejs";

const sql = neon();

function verifyLineSignature(rawBody, signature) {
    if (!signature) return false;

    const hash = crypto
        .createHmac("SHA256", process.env.LINE_CHANNEL_SECRET)
        .update(rawBody)
        .digest("base64");

    return hash === signature;
}

async function downloadLineImage(messageId) {
    const res = await fetch(
        `https://api-data.line.me/v2/bot/message/${messageId}/content`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
            },
        }
    );

    if (!res.ok) {
        throw new Error(`LINE画像ダウンロード失敗: ${res.status}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

async function ocrImage(imageBuffer) {
    const worker = await createWorker("eng");

    try {
        const result = await worker.recognize(imageBuffer);
        return result?.data?.text || "";
    } finally {
        await worker.terminate();
    }
}

function extractENumbers(text) {
    if (!text) return [];

    const normalized = text
        .replace(/\s+/g, "")
        .replace(/－/g, "-")
        .replace(/—/g, "-")
        .replace(/-/g, "");

    const matches = normalized.match(/E\d{11}/g) || [];

    return [...new Set(matches)];
}

function formatLineTimestamp(timestamp) {
    return new Date(timestamp).toISOString();
}

async function saveLineImageRecord({
    messageTime,
    eNumber,
    imageInfo,
    lineMessageId,
    groupId,
    userId,
}) {
    const rows = await sql`
    INSERT INTO line_image_records (
      message_time,
      e_number,
      image_info,
      line_message_id,
      group_id,
      user_id
    )
    VALUES (
      ${messageTime},
      ${eNumber},
      ${imageInfo || ""},
      ${lineMessageId || null},
      ${groupId || null},
      ${userId || null}
    )
    ON CONFLICT (line_message_id, e_number)
    DO UPDATE SET
      message_time = EXCLUDED.message_time,
      image_info = EXCLUDED.image_info,
      group_id = EXCLUDED.group_id,
      user_id = EXCLUDED.user_id
    RETURNING id, message_time, e_number
  `;

    return rows[0];
}

async function replyToLine(replyToken, text) {
    if (!replyToken) return;

    const res = await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            replyToken,
            messages: [
                {
                    type: "text",
                    text,
                },
            ],
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        console.error("LINE Reply Error:", res.status, body);
    }
}

export async function POST(req) {
    try {
        const rawBody = await req.text();
        const signature = req.headers.get("x-line-signature");

        if (!verifyLineSignature(rawBody, signature)) {
            return NextResponse.json(
                { error: "Invalid LINE signature" },
                { status: 401 }
            );
        }

        const body = JSON.parse(rawBody);
        const events = body.events || [];

        for (const event of events) {
            if (event.type !== "message" || event.message?.type !== "image") {
                continue;
            }

            const messageId = event.message.id;
            const messageTime = formatLineTimestamp(event.timestamp);
            const groupId = event.source?.groupId || event.source?.roomId || null;
            const userId = event.source?.userId || null;

            const imageBuffer = await downloadLineImage(messageId);
            const imageInfo = await ocrImage(imageBuffer);
            const eNumbers = extractENumbers(imageInfo);

            if (eNumbers.length === 0) {
                await replyToLine(
                    event.replyToken,
                    [
                        "图片已识别，但没有找到E开头12位号码。",
                        "",
                        "识别文字：",
                        imageInfo || "未识别到文字",
                    ].join("\n")
                );
                continue;
            }

            for (const eNumber of eNumbers) {
                await saveLineImageRecord({
                    messageTime,
                    eNumber,
                    imageInfo,
                    lineMessageId: messageId,
                    groupId,
                    userId,
                });
            }

            await replyToLine(
                event.replyToken,
                [
                    "图片信息已保存。",
                    `发送时间：${messageTime}`,
                    `E番号：${eNumbers.join(", ")}`,
                    "",
                    "识别文字：",
                    imageInfo || "未识别到文字",
                ].join("\n")
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("LINE Webhook Error:", error);

        return NextResponse.json(
            { error: "LINE webhook処理失敗" },
            { status: 500 }
        );
    }
}