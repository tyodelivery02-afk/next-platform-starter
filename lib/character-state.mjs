export const EXPRESSIONS = ['neutral', 'happy', 'shy', 'thinking', 'surprised', 'concerned'];
export const MOTIONS = ['idle', 'nod', 'bounce', 'tilt', 'shake'];

export function normalizeCharacterState(value = {}) {
  return {
    expression: EXPRESSIONS.includes(value.expression) ? value.expression : 'neutral',
    motion: MOTIONS.includes(value.motion) ? value.motion : 'idle',
  };
}

export function parseCharacterReply(text) {
  const parsed = JSON.parse(text);
  if (typeof parsed.reply !== 'string' || !parsed.reply.trim()) throw new Error('Missing character reply');
  return { reply: parsed.reply.trim(), ...normalizeCharacterState(parsed) };
}
