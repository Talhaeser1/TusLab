import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTyping, isTypingPayload, foldWord, wordsMatch, charScore, DEFAULT_TYPING} from '../pvp/shared/typing-rules.js';
import {createMatch, submitWord, publicMatch} from '../pvp/shared/match.js';
import {createArenaMatch, arenaPublicMatch} from '../pvp/shared/arena.js';

const players = [
  {seat: 1, playerId: 'a', name: 'Ada', character: 'fire'},
  {seat: 2, playerId: 'b', name: 'Bora', character: 'rune'},
];

test('typing rules: defaults are strict (case + punctuation count)', () => {
  assert.deepEqual(normalizeTyping(), {caseSensitive: true, punctuation: true});
  assert.deepEqual(normalizeTyping({caseSensitive: false, junk: 1}), {caseSensitive: false, punctuation: true});
  assert.deepEqual(DEFAULT_TYPING, {caseSensitive: true, punctuation: true});
  assert.equal(wordsMatch('güçlü', 'Güçlü'), false);
  assert.equal(wordsMatch('savaşçı', 'savaşçı,'), false);
  assert.equal(wordsMatch('Güçlü', 'Güçlü'), true);
});

test('typing rules: case-insensitive uses Turkish casing (I/ı, İ/i)', () => {
  const loose = {caseSensitive: false, punctuation: true};
  assert.equal(wordsMatch('güçlü', 'Güçlü', loose), true);
  assert.equal(wordsMatch('ılık', 'ILIK', loose), true);
  assert.equal(wordsMatch('istanbul', 'İSTANBUL', loose), true);
  assert.equal(wordsMatch('ilik', 'ILIK', loose), false, 'dotted i is not dotless ı');
  assert.equal(wordsMatch('kalem', 'kalem,', loose), false, 'punctuation still required');
});

test('typing rules: punctuation off ignores . , ! ? … on both sides', () => {
  const noPunct = {caseSensitive: true, punctuation: false};
  assert.equal(wordsMatch('savaşçı', 'savaşçı,', noPunct), true);
  assert.equal(wordsMatch('doğru.', 'doğru', noPunct), true);
  assert.equal(wordsMatch('Evet', 'evet!', noPunct), false, 'case still counts');
  assert.equal(foldWord('“Merhaba…”', noPunct), 'Merhaba');
  assert.deepEqual(charScore('savasçı', 'savaşçı,', noPunct), {correct: 6, total: 7});
});

test('typing rules: wire payload validation', () => {
  assert.equal(isTypingPayload({caseSensitive: false}), true);
  assert.equal(isTypingPayload({punctuation: true, caseSensitive: true}), true);
  for (const bad of [null, [], {}, {caseSensitive: 'no'}, {caseSensitive: false, extra: true}, 'x']) {
    assert.equal(isTypingPayload(bad), false, JSON.stringify(bad));
  }
});

test('classic engine honours the match typing rules and exposes them publicly', () => {
  const strict = createMatch(players, 0, 'm1', {exchangeMs: 10000});
  assert.deepEqual(publicMatch(strict).typing, {caseSensitive: true, punctuation: true});
  const word = strict.participants[0].currentWord;
  const variant = word.toLocaleUpperCase('tr-TR') === word ? word.toLocaleLowerCase('tr-TR') : word.toLocaleUpperCase('tr-TR');
  const strictResult = submitWord(strict, {playerId: 'a', matchId: 'm1', wordIndex: 0, text: variant}, 1000);
  assert.equal(strictResult.result.correct, false, 'case mismatch rejected when case-sensitive');

  const loose = createMatch(players, 0, 'm2', {exchangeMs: 10000, typing: {caseSensitive: false, punctuation: false}});
  assert.deepEqual(publicMatch(loose).typing, {caseSensitive: false, punctuation: false});
  const looseWord = loose.participants[0].currentWord;
  const typed = foldWord(looseWord, {punctuation: false}).toLocaleUpperCase('tr-TR') || looseWord;
  const looseResult = submitWord(loose, {playerId: 'a', matchId: 'm2', wordIndex: 0, text: typed}, 1000);
  assert.equal(looseResult.result.correct, true, 'case + punctuation ignored');
});

test('arena engine stores and publishes typing rules', () => {
  const m = createArenaMatch(players, 0, 'ar', {seed: 1, typing: {punctuation: false}});
  assert.deepEqual(m.typing, {caseSensitive: true, punctuation: false});
  assert.deepEqual(arenaPublicMatch(m, 1).typing, {caseSensitive: true, punctuation: false});
});
