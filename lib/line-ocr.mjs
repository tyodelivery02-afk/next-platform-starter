import { createHmac, timingSafeEqual } from 'node:crypto';

export const CODE_PATTERN = /^E[A-Z0-9]{11}$/;
export function extractCodes(values) {
  if (!Array.isArray(values)) throw new Error('Invalid OCR response');
  return [...new Set(values.filter(value => typeof value === 'string').map(value => value.normalize('NFKC').trim().toUpperCase()).filter(value => CODE_PATTERN.test(value)))];
}
export function verifyLineSignature(body, signature, secret) {
  if (!secret || typeof signature !== 'string') return false;
  const expected = createHmac('sha256', secret).update(body).digest('base64');
  const actual = Buffer.from(signature);
  const target = Buffer.from(expected);
  return actual.length === target.length && timingSafeEqual(actual, target);
}
export function isGroupImage(event) {
  return event?.type === 'message' && ['group', 'room'].includes(event.source?.type)
    && event.message?.type === 'image' && /^\d+$/.test(event.message.id)
    && typeof event.webhookEventId === 'string' && event.webhookEventId.length > 0;
}

export async function processImageEvent(event, dependencies) {
  const claimed = await dependencies.claim(event);
  if (!claimed) return;
  try {
    const codes = extractCodes(await dependencies.recognize(event.message.id));
    await dependencies.complete(event.webhookEventId, claimed, codes);
  } catch (error) {
    await dependencies.release(event.webhookEventId, claimed);
    throw error;
  }
}
