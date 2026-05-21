import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        success: true,
        message: "LINE webhook API is alive. Please use POST for LINE webhook."
    });
}

export async function POST(req) {
    try {
        const rawBody = await req.text();

        console.log("LINE webhook received");
        console.log("rawBody:", rawBody);
        console.log("signature:", req.headers.get("x-line-signature"));

        return NextResponse.json({
            success: true,
            message: "Webhook received"
        });
    } catch (error) {
        console.error("Webhook test error:", error);

        return NextResponse.json(
            { error: "Webhook test failed" },
            { status: 500 }
        );
    }
}