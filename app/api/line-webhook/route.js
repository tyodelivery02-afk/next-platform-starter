import { NextResponse } from "next/server";
import { neon } from "@netlify/neon";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
        const text = await res.text();
        throw new Error(`LINE画像ダウンロード失敗: ${res.status} ${text}`);
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await res.arrayBuffer();

    return {
        buffer: Buffer.from(arrayBuffer),
        contentType
    };
}

async function ocrImageWithOcrSpace(imageBuffer) {
    const base64Image = imageBuffer.toString("base64");

    const formData = new FormData();
    formData.append("apikey", process.env.OCR_SPACE_API_KEY || "helloworld");
    formData.append("language", "eng");
    formData.append("isOverlayRequired", "false");
    formData.append("scale", "true");
    formData.append("OCREngine", "2");
    formData.append("base64Image", `data:image/jpeg;base64,${base64Image}`);

    const res = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(`OCR.space HTTP Error: ${res.status}`);
    }

    if (data.IsErroredOnProcessing) {
        throw new Error(
            `OCR.space Error: ${data.ErrorMessage || data.ErrorDetails || "Unknown error"}`
        );
    }

    const parsedText =
        data.ParsedResults
            ?.map((item) => item.ParsedText)
            .filter(Boolean)
            .join("\n") || "";

    return parsedText;
}

function extractENumbers(text) {
    if (!text) return [];

    const normalized = text
        .replace(/\s+/g, "")
        .replace(/－/g, "")
        .replace(/—/g, "")
        .replace(/-/g, "")
        .replace(/Ｏ/g, "0")
        .replace(/O/g, "0")
        .replace(/Ｉ/g, "1")
        .replace(/I/g, "1");

    const matches = normalized.match(/E\d{11}/g) || [];

    return [...new Set(matches)];
}

function formatLineTimestamp(timestamp) {
    const date = timestamp ? new Date(timestamp) : new Date();

    const japanTime = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(date);

    return japanTime.replace(" ", "T") + "+09:00";
}

async function saveLineImageRecord({
    messageTime,
    eNumber,
    imageInfo,
    lineMessageId,
    groupId,
    userId,
    imageBase64,
    imageMimeType,
}) {
    const rows = await sql`
    INSERT INTO line_image_records (
      message_time,
      e_number,
      image_info,
      line_message_id,
      group_id,
      user_id,
      states,
      image_base64,
      image_mime_type
    )
    VALUES (
      ${messageTime},
      ${eNumber},
      ${imageInfo || ""},
      ${lineMessageId || null},
      ${groupId || null},
      ${userId || null},
      0,
      ${imageBase64 || null},
      ${imageMimeType || "image/jpeg"}
    )
    ON CONFLICT (line_message_id, e_number)
    DO UPDATE SET
      message_time = EXCLUDED.message_time,
      image_info = EXCLUDED.image_info,
      group_id = EXCLUDED.group_id,
      user_id = EXCLUDED.user_id,
      image_base64 = EXCLUDED.image_base64,
      image_mime_type = EXCLUDED.image_mime_type
    RETURNING id, message_time, e_number, states
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
            messages: [{ type: "text", text }],
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        console.error("LINE Reply Error:", res.status, body);
    }
}

export async function GET() {
    return NextResponse.json({
        success: true,
        message: "LINE webhook API is alive. Please use POST for LINE webhook.",
    });
}

export async function POST(req) {
    try {
        console.log("LINE webhook POST received");

        const rawBody = await req.text();
        const signature = req.headers.get("x-line-signature");

        console.log("signature exists:", !!signature);

        if (!verifyLineSignature(rawBody, signature)) {
            console.error("Invalid LINE signature");

            return NextResponse.json(
                { error: "Invalid LINE signature" },
                { status: 401 }
            );
        }

        const body = JSON.parse(rawBody);
        const events = body.events || [];

        console.log("events count:", events.length);

        for (const event of events) {
            console.log("event type:", event.type);
            console.log("message type:", event.message?.type);
            console.log("message id:", event.message?.id);
            console.log("timestamp:", event.timestamp);

            if (event.type !== "message" || event.message?.type !== "image") {
                continue;
            }

            const messageId = event.message.id;
            const messageTime = formatLineTimestamp(event.timestamp);
            const groupId = event.source?.groupId || event.source?.roomId || null;
            const userId = event.source?.userId || null;

            console.log("downloading image:", messageId);

            const downloadedImage = await downloadLineImage(messageId);
            const imageBuffer = downloadedImage.buffer;
            const imageMimeType = downloadedImage.contentType;
            const imageBase64 = imageBuffer.toString("base64");

            console.log("image downloaded. size:", imageBuffer.length);

            const imageInfo = await ocrImageWithOcrSpace(imageBuffer);

            console.log("OCR result:", imageInfo);

            const eNumbers = extractENumbers(imageInfo);

            console.log("extracted E numbers:", eNumbers);

            if (eNumbers.length === 0) {
                await replyToLine(
                    event.replyToken,
                    [
                        "画像を識別しましたが、Eから始まる12桁の番号は見つかりませんでした。",
                        "",
                        "識別文字：",
                        imageInfo || "文字を識別できませんでした。",
                    ].join("\n")
                );

                continue;
            }

            const savedRows = [];

            for (const eNumber of eNumbers) {
                const saved = await saveLineImageRecord({
                    messageTime,
                    eNumber,
                    imageInfo,
                    lineMessageId: messageId,
                    groupId,
                    userId,
                    imageBase64,
                    imageMimeType,
                });

                savedRows.push(saved);
            }

            console.log("saved records:", savedRows);

            await replyToLine(
                event.replyToken,
                eNumbers.map((eNumber) => `${eNumber}，OK`).join("\n")
            );
        }

        return NextResponse.json({
            success: true,
            message: "LINE webhook processed",
        });
    } catch (error) {
        console.error("LINE Webhook Error:", error);

        return NextResponse.json(
            {
                error: "LINE webhook処理失敗",
                detail: error.message,
            },
            { status: 500 }
        );
    }
}