import { timingSafeEqual } from 'node:crypto';

export function cautionApiKeyError(request) {
  const key = process.env.CAUTION_STATISTICS_API_KEY;
  if (!/^[a-f0-9]{64}$/.test(key || '')) return 503;
  const supplied = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];
  if (!supplied || !timingSafeEqual(Buffer.from(supplied), Buffer.from(key))) return 401;
  return null;
}
