import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('2D rig has a static aura without an animated filter or permanent layer hints', () => {
  const css = source('pvp/character-motion.css');
  const rig = css.match(/\.pvp3-rig\{([^}]*)\}/)?.[1];
  assert.ok(rig);
  assert.doesNotMatch(rig, /filter:|will-change:/);
  assert.match(css, /\.pvp3-rig::before\{[^}]*radial-gradient/);
  assert.match(css, /\.pvp3-rig-rune::before\{[^}]*radial-gradient/);
  assert.doesNotMatch(css.match(/\.pvp3-model\{([^}]*)\}/)?.[1] || '', /will-change:/);
  assert.doesNotMatch(css.match(/\.pvp3-weapon\{([^}]*)\}/)?.[1] || '', /will-change:/);
});

test('typing focus uses explicit classes, with no relational focus selector', () => {
  assert.match(source('pvp/pvp.css'), /\.pvp2-typebox\.is-input-focused\{/);
  assert.doesNotMatch(source('pvp/pvp.css'), /\.pvp2-typebox:has\(/);
  assert.match(source('pvp/typing-top.css'), /\.tt\.is-input-focused\{/);
  assert.doesNotMatch(source('pvp/typing-top.css'), /\.tt:has\(/);
  const js = source('pvp/index.js');
  assert.match(js, /addEventListener\('focusin'/);
  assert.match(js, /addEventListener\('focusout'/);
  assert.match(js, /classList\.add\('is-input-focused'\)/);
  assert.match(js, /classList\.remove\('is-input-focused'\)/);
});

test('word state changes and typing focus avoid paint-property transitions', () => {
  const word = source('pvp/rounds-ui.css').match(/\.rui-word\{([^}]*)\}/)?.[1];
  assert.ok(word);
  assert.doesNotMatch(word, /transition:/);
  const top = source('pvp/typing-top.css').match(/\.tt\{([^}]*)\}/)?.[1];
  assert.ok(top);
  assert.doesNotMatch(top, /transition:[^}]*border-color/);
  const bar = source('pvp/typing-top.css').match(/\.tt-bar i\{([^}]*)\}/)?.[1];
  assert.doesNotMatch(bar || '', /transition:width/);
});

test('audio is prepared in the first pointer gesture and focus needs user activation', () => {
  const js = source('pvp/index.js');
  assert.match(js, /addEventListener\('pointerdown',prepareTypingAudio/);
  assert.match(js, /navigator\.userActivation\?\.isActive\)prepareTypingAudio\(\)/);
  assert.match(js, /pvpAudio\.unlock\(\)/);
  assert.match(js, /pvpMusic\.unlock\(\)/);
});
