import { NextResponse } from 'next/server';
import { verifyLineSignature, isGroupImage, processImageEvent } from '../../../../lib/line-ocr.mjs';
import { claimLineEvent, completeLineEvent, releaseLineEvent } from '../../../../lib/line-ocr-store';
import { recognizeLineImage } from '../../../../lib/line-ocr-image';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return NextResponse.json({ error: 'LINE configuration missing' }, { status: 503 });
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 1024 * 1024) return new Response(null, { status: 413 });
  if (!verifyLineSignature(raw, request.headers.get('x-line-signature'), secret)) return new Response(null, { status: 401 });
  let payload;
  try { payload = JSON.parse(raw); } catch { return new Response(null, { status: 400 }); }
  if (!Array.isArray(payload.events)) return new Response(null, { status: 400 });
  const events = payload.events.filter(isGroupImage);
  if (!events.length) return NextResponse.json({ ok: true }); // LINE's Verify request has no events.
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN || !process.env.GEMINI_API_KEY) return new Response(null, { status: 503 });
  const signal = AbortSignal.timeout(45000);
  let failed = false;
  let index = 0;
  // Await processing before acknowledgment: a failure can be retried by LINE redelivery.
  await Promise.all(Array.from({ length: Math.min(2, events.length) }, async () => {
    while (index < events.length) {
      const event = events[index++];
      try {
        if (signal.aborted) throw new Error('Webhook deadline exceeded');
        await processImageEvent(event, {
          claim: claimLineEvent, complete: completeLineEvent, release: releaseLineEvent,
          recognize: id => recognizeLineImage(id, signal),
        });
      } catch {
        failed = true;
        // Do not log images, identifiers, message bodies, credentials or source identities.
        console.warn('LINE image processing failed');
      }
    }
  }));
  return NextResponse.json({ ok: !failed }, { status: failed ? 503 : 200 });
}
