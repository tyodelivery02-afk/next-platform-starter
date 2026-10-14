import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCharacterState, parseCharacterReply } from '../lib/character-state.mjs';
test('accepts model reaction and rejects unsupported animation values', () => {
  assert.deepEqual(normalizeCharacterState({expression:'shy',motion:'tilt'}),{expression:'shy',motion:'tilt'});
  assert.deepEqual(normalizeCharacterState({expression:'arbitrary-css',motion:'arbitrary-css'}),{expression:'neutral',motion:'idle'});
});
test('keeps reply separate from animation metadata', () => {
  assert.deepEqual(parseCharacterReply('{"reply":"ありがとう。","expression":"happy","motion":"bounce"}'),{reply:'ありがとう。',expression:'happy',motion:'bounce'});
  assert.throws(()=>parseCharacterReply('{"reply":""}'));
  assert.throws(()=>parseCharacterReply('not JSON'));
});
