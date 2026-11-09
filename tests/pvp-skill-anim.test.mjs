import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFightMotion, strikeAt} from '../pvp/fight-motion.js';
import {createProjectileDirector} from '../pvp/projectiles.js';

function clock() {
  let time = 0, id = 0;
  const jobs = new Map();
  const scheduler = {
    setTimeout(fn, ms) { const key = ++id; jobs.set(key, {fn, at: time + ms}); return key; },
    clearTimeout(key) { jobs.delete(key); }
  };
  function advance(to) {
    for (;;) {
      const next = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > to) break;
      jobs.delete(next[0]); time = next[1].at; next[1].fn();
    }
    time = to;
  }
  return {scheduler, advance, now: () => time};
}

function element(name, log, children = {}) {
  return {
    name, children, classList: {contains: () => false, add() {}, remove() {}},
    querySelector: q => children[q] || null,
    animate(frames, options) {
      const listeners = {};
      const animation = {
        addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
        cancel() { for (const fn of listeners.cancel || []) fn(); }
      };
      log.push({name, frames, options});
      return animation;
    }
  };
}

test('resolved attack reads attacker, brace, impact in that order', () => {
  const c = clock(), log = [];
  const rig1 = element('attacker', log), rig2 = element('defender', log);
  const root = element('root', log, {
    '.pvp2-side[data-seat="1"]': element('side1', log, {'.pvp3-rig': rig1}),
    '.pvp2-side[data-seat="2"]': element('side2', log, {'.pvp3-rig': rig2}),
    '.pvp2-duel': element('duel', log)
  });
  const motion = createFightMotion({root, scheduler: c.scheduler});
  motion.handle({type: 'SKILL_CAST', fromSeat: 1, toSeat: 2, skill: 'q', turn: 1, resolve: true, defenderAction: 'brace'});
  motion.handle({type: 'DAMAGE_APPLIED', fromSeat: 1, toSeat: 2, skill: 'q', amount: 90, turn: 1, resolve: true});
  assert.deepEqual(log.map(x => x.name), ['attacker']);
  // Kalkan vuruştan 120 ms önce kalkar, darbe tam vuruş anında gelir (hamle v2 zamanlaması).
  c.advance(strikeAt('q') - 120);
  assert.deepEqual(log.map(x => x.name).filter(n => n !== 'attacker'), ['defender']);
  c.advance(strikeAt('q')); // advance() mutlak zaman alır
  assert.equal(log.filter(x => x.name === 'defender').length, 2, 'impact replaces the brace');
  assert.ok(log.findLast(x => x.name === 'defender').frames.some(x => parseFloat(x.translate) > 5));
  motion.destroy();
});

test('projectiles retain a bounded lifetime and skill identity', () => {
  const c = clock(), children = [];
  const board = {ownerDocument: {createElement: () => ({dataset: {}, setAttribute() {}, remove() {children.splice(children.indexOf(this), 1);}})}, appendChild(x) {children.push(x);}};
  const director = createProjectileDirector({root: {querySelector: () => board}, scheduler: c.scheduler});
  for (const [skill, character] of [['q','fire'], ['e','rune'], ['r','fire']]) director.launch({skill, character});
  assert.deepEqual(children.map(x => x.className), ['pvp10-projectile pvp10-fire pvp10-q', 'pvp10-projectile pvp10-rune pvp10-e', 'pvp10-projectile pvp10-fire pvp10-r']);
  c.advance(520);
  assert.equal(children.length, 1, 'Q and E clear after their short travel');
  director.dispose();
  assert.equal(children.length, 0);
});

test('skill silhouettes and reduced effects have CSS coverage', () => {
  const css = readFileSync(new URL('../pvp/choreography21.css', import.meta.url), 'utf8');
  for (const kind of ['fire', 'rune']) for (const skill of ['q', 'e', 'r']) assert.match(css, new RegExp(`pvp10-${kind}\\.pvp10-${skill}`));
  assert.match(css, /pvpH-fire-storm/);
  assert.match(css, /pvpH-rune-seal/);
  assert.match(css, /pvp4-reduced \.pvp10-projectile/);
});

test('dövüş hareketi v2: belirgin atılış (≥%40), geniş silah yayı (≥70°), okunur süre (≥0,7 sn)', async () => {
  const {FIGHT_MOVES} = await import('../pvp/fight-motion.js');
  const c = clock(), log = [];
  const weapon = element('weapon', log);
  const rig1 = element('attacker', log, {'.pvp3-weapon': weapon});
  const root = element('root', log, {
    '.pvp2-side[data-seat="1"]': element('side1', log, {'.pvp3-rig': rig1}),
    '.pvp2-side[data-seat="2"]': element('side2', log, {'.pvp3-rig': element('defender', log)}),
    '.pvp2-duel': element('duel', log)
  });
  const motion = createFightMotion({root, scheduler: c.scheduler});
  motion.handle({type: 'SKILL_CAST', fromSeat: 1, toSeat: 2, skill: 'q'});
  const body = log.find(x => x.name === 'attacker');
  const maxReach = Math.max(...body.frames.map(f => parseFloat(f.translate) || 0));
  assert.ok(maxReach >= 40, `atılış %${maxReach}`);
  const sw = log.find(x => x.name === 'weapon');
  assert.ok(sw, 'silah ayrı kanalda savrulur');
  const maxAngle = Math.max(...sw.frames.map(f => parseFloat(f.rotate) || 0));
  assert.ok(maxAngle >= 70, `silah ${maxAngle}°`);
  assert.ok(FIGHT_MOVES.q.ms >= 700 && FIGHT_MOVES.e.ms >= 900);
  assert.equal(strikeAt('e'), Math.round(FIGHT_MOVES.e.ms * FIGHT_MOVES.e.strike));
  motion.destroy();
});

test('her becerinin kendi hamlesi: 6 beceri en az 5 farklı kalıp, tepkiler de farklı', async () => {
  const {FIGHT_SKILLS, skillSpec, strikeAt: st} = await import('../pvp/fight-motion.js');
  const six = ['fire:q', 'fire:e', 'fire:r1', 'rune:q', 'rune:e', 'rune:r1'].map(k => FIGHT_SKILLS[k]);
  assert.ok(new Set(six.map(m => m.pattern)).size >= 5, 'kalıplar: ' + six.map(m => m.pattern));
  assert.ok(new Set(six.map(m => m.react)).size >= 3, 'tepkiler: ' + six.map(m => m.react));
  assert.equal(skillSpec('q', 'rune').pattern, 'thrust', 'Rün Kesişi geri çekilmeden dürter');
  assert.equal(skillSpec('e', 'fire').pattern, 'slam');
  assert.notEqual(st('q', 'fire'), st('q', 'rune'), 'vuruş anı karaktere göre');
});

test('aynı beceri art arda tıpatıp aynı oynamaz (mesafe/açı çeşitlemesi)', () => {
  const c = clock(), log = [];
  const rig1 = element('attacker', log, {'.pvp3-weapon': element('weapon', log)});
  const root = element('root', log, {
    '.pvp2-side[data-seat="1"]': element('side1', log, {'.pvp3-rig': rig1}),
    '.pvp2-side[data-seat="2"]': element('side2', log, {'.pvp3-rig': element('defender', log)}),
    '.pvp2-duel': element('duel', log)
  });
  const motion = createFightMotion({root, scheduler: c.scheduler});
  const reaches = [];
  for (let i = 0; i < 3; i++) {
    motion.handle({type: 'SKILL_CAST', fromSeat: 1, toSeat: 2, skill: 'q'});
    const body = log.filter(x => x.name === 'attacker').at(-1);
    reaches.push(Math.max(...body.frames.map(f => parseFloat(f.translate) || 0)).toFixed(2));
  }
  assert.equal(new Set(reaches).size, 3, 'mesafeler: ' + reaches);
  motion.destroy();
});
