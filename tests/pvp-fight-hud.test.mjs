import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFightHud, superValue, callFor, CALLS, HUD_TIMES, MAX_PENDING_CALLS} from '../pvp/fight-hud.js';

// ---- Sahte DOM -------------------------------------------------------------
function classList(el) {
  const set = () => new Set(String(el.className || '').split(/\s+/).filter(Boolean));
  const write = s => { el.className = [...s].join(' '); };
  return {
    add(...c) { const s = set(); c.forEach(x => s.add(x)); write(s); },
    remove(...c) { const s = set(); c.forEach(x => s.delete(x)); write(s); },
    contains(c) { return set().has(c); },
    toggle(c, on) { const s = set(); const v = on === undefined ? !s.has(c) : on; v ? s.add(c) : s.delete(c); write(s); return v; },
  };
}
function fakeEl(tag, doc) {
  const el = {
    tagName: tag.toUpperCase(), ownerDocument: doc, parentNode: null, children: [], className: '', hidden: false,
    attrs: {}, props: {}, _text: '',
    style: {setProperty(k, v) { el.props[k] = v; }},
    get textContent() { return el._text + el.children.map(c => c.textContent).join(''); },
    set textContent(v) { el._text = String(v); el.children = []; },
    get isConnected() { let n = el; while (n.parentNode) n = n.parentNode; return n === doc.body; },
    setAttribute(k, v) { el.attrs[k] = String(v); },
    appendChild(child) { child.parentNode?.removeChild(child); child.parentNode = el; el.children.push(child); return child; },
    append(...nodes) { nodes.forEach(n => el.appendChild(n)); },
    replaceChildren(...nodes) { [...el.children].forEach(c => el.removeChild(c)); el.append(...nodes); },
    removeChild(child) { el.children = el.children.filter(c => c !== child); child.parentNode = null; return child; },
    remove() { el.parentNode?.removeChild(el); },
    getBoundingClientRect() { return el.rect || {top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0}; },
    querySelector() { return null; },
  };
  el.classList = classList(el);
  return el;
}
function all(el) { return el.children.flatMap(c => [c, ...all(c)]); }
function fakeRoot({stages = true} = {}) {
  const doc = {createElement: tag => fakeEl(tag, doc)};
  doc.body = fakeEl('body', doc);
  const root = fakeEl('section', doc);
  root._listeners = new Map();
  root.addEventListener = (type, fn) => root._listeners.set(type, fn);
  root.removeEventListener = type => root._listeners.delete(type);
  doc.body.appendChild(root);
  const stage = {1: fakeEl('div', doc), 2: fakeEl('div', doc)};
  root.appendChild(stage[1]); root.appendChild(stage[2]);
  const duel = fakeEl('div', doc);
  duel.rect = {top: 300, left: 40, width: 1800, height: 480, bottom: 780, right: 1840};
  root.querySelector = sel => {
    if (sel === '.pvp2-duel') return duel;
    const m = /data-seat="(\d)"\] \.pvp2-stage/.exec(sel);
    if (m && stages) return stage[m[1]];
    if (sel.startsWith('.rui-intro')) return root._ruiIntro || null;
    return null;
  };
  return {doc, root, stage};
}
function fakeScheduler() {
  let now = 0, next = 1; const pending = new Map();
  const scheduler = {
    setTimeout(fn, ms) { const id = next++; pending.set(id, {fn, at: now + ms}); return id; },
    clearTimeout(id) { pending.delete(id); },
  };
  function runTo(ms) {
    while (true) {
      const item = [...pending.entries()].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!item || item[1].at > ms) break;
      pending.delete(item[0]); now = item[1].at; item[1].fn();
    }
    now = ms;
  }
  return {scheduler, pending, runTo, advance: ms => runTo(now + ms), now: () => now};
}
function setup(opts = {}) {
  const dom = fakeRoot(opts);
  const clock = fakeScheduler();
  const calls = [];
  const api = {superFreeze: (...a) => calls.push(['superFreeze', ...a]), slowMo: (...a) => calls.push(['slowMo', ...a]),
    introSweep: (...a) => calls.push(['introSweep', ...a])};
  const hud = createFightHud({root: dom.root, scheduler: clock.scheduler, isReduced: opts.isReduced || (() => false),
    getArenaApi: opts.noApi ? () => null : () => api});
  return {...dom, clock, hud, calls};
}
const layers = root => root.children.filter(c => String(c.className).includes('fhud-layer'));
const callText = root => layers(root).map(l => l.textContent).join('|');
const hit = (extra = {}) => ({type: 'DAMAGE_APPLIED', fromSeat: 1, toSeat: 2, skill: 'q', amount: 100, blocked: false, bonusTags: [], ...extra});
const players = [{seat: 1, name: 'Savaşçı', character: 'fire', playerId: 'me'}, {seat: 2, name: 'Bot', character: 'rune', playerId: 'bot'}];

// ---- Saf yardımcılar -------------------------------------------------------
test('superValue: classic r/5, rounds streak/7, arena gizli', () => {
  assert.equal(superValue({mode: 'classic'}, {skillCharge: {r: 3}}), 0.6);
  assert.equal(superValue({mode: 'rounds'}, {streak: 7}), 1);
  assert.equal(superValue({mode: 'rounds'}, {streak: 10}), 1);
  assert.equal(superValue({mode: 'rounds'}, {streak: 0}), 0);
  assert.equal(superValue({mode: 'arena'}, {combo: 4}), null);
  assert.equal(superValue({mode: 'classic'}, {}), null);
});

test('callFor eşlemesi', () => {
  assert.equal(callFor(hit({bonusTags: ['Kızıl Öfke']})).text, CALLS.crit);
  assert.equal(callFor(hit()), null);
  assert.equal(callFor(hit({blocked: true, bonusTags: ['x']})), null);
  assert.equal(callFor(hit({arena: true, bonusTags: ['KOMBO'], tags: ['KOMBO']})), null);
  assert.equal(callFor(hit({arena: true, tags: ['FİNAL']})).text, CALLS.crit);
  assert.equal(callFor({type: 'PARRY_TRIGGERED', seat: 2}).text, CALLS.parry);
  assert.equal(callFor({type: 'COUNTERATTACK_CAST', fromSeat: 1}).text, CALLS.counter);
  assert.equal(callFor({type: 'SHIELD_BROKEN', seat: 2}).text, CALLS.shieldBreak);
  assert.deepEqual(callFor({type: 'SKILL_CAST', skill: 'r', fromSeat: 2}), {text: CALLS.ultimate, seat: 2});
  assert.equal(callFor({type: 'SKILL_CAST', skill: 'q', fromSeat: 2}), null);
  assert.equal(callFor({type: 'KNOCKOUT'}).text, CALLS.knockout);
});

// ---- Giriş -----------------------------------------------------------------
test('giriş: RAUND 1 → SAVAŞ! (VS yok), ≤ 2.2 sn, sonra katman kalmaz', () => {
  const {root, clock, hud, calls} = setup();
  hud.matchStart({players, mode: 'classic'});
  clock.advance(HUD_TIMES.startDelay);
  assert.equal(callText(root), 'RAUND 1');
  assert.doesNotMatch(callText(root), /VS|Savaşçı|Doran/);
  assert.deepEqual(calls[0], ['introSweep', HUD_TIMES.sweep]);
  clock.advance(HUD_TIMES.round);
  assert.match(callText(root), /SAVAŞ!/);
  clock.advance(HUD_TIMES.fight);
  assert.equal(layers(root).length, 0);
  assert.ok(HUD_TIMES.startDelay + HUD_TIMES.round + HUD_TIMES.fight <= 2200);
  assert.equal('vs' in HUD_TIMES, false, 'VS süresi kalmadı');
});

test('giriş: başka sinematik oynarken bekler, sonra RAUND/SAVAŞ gelir', () => {
  const {root, clock, hud} = setup();
  root.classList.add('cin-playing');
  hud.matchStart({players, mode: 'classic'});
  clock.advance(500);
  assert.equal(layers(root).length, 0);
  root.classList.remove('cin-playing');
  clock.advance(HUD_TIMES.busyPoll);
  assert.equal(callText(root), 'RAUND 1');
  clock.advance(HUD_TIMES.round + HUD_TIMES.fight);
  assert.equal(layers(root).length, 0);
});

test('giriş: VS ekranı tamamen kaldırıldı (cinematic dinleyicisi yok)', () => {
  const {root, clock, hud, calls} = setup();
  assert.equal(root._listeners.has('tuslab:pvp-cinematic'), false);
  hud.matchStart({players, mode: 'classic'});
  clock.advance(HUD_TIMES.startDelay);
  assert.equal(callText(root), 'RAUND 1');
  assert.doesNotMatch(callText(root), /VS|Savaşçı|Doran/);
});

test('giriş: azaltılmış harekette tek sade kart, kısa', () => {
  const {root, clock, hud, calls} = setup({isReduced: () => true});
  hud.matchStart({players, mode: 'classic'});
  clock.advance(HUD_TIMES.startDelay);
  assert.equal(layers(root).length, 1);
  assert.match(layers(root)[0].className, /fhud-reduced/);
  assert.match(callText(root), /RAUND 1 · SAVAŞ!/);
  assert.equal(calls.length, 0);
  clock.advance(HUD_TIMES.reducedIntro);
  assert.equal(layers(root).length, 0);
});

// ---- Kombo -----------------------------------------------------------------
test('kombo: 2. isabette "N VURUŞ" + toplam hasar, 1.4 sn sonra kaybolur', () => {
  const {stage, clock, hud} = setup();
  hud.handle(hit({amount: 100}));
  assert.equal(stage[1].children.length, 0);
  hud.handle(hit({amount: 150}));
  const combo = stage[1].children.find(c => c.className.includes('fhud-combo'));
  assert.ok(combo);
  assert.equal(combo.textContent, '2VURUŞ250 HASAR');
  const cls1 = combo.className;
  hud.handle(hit({amount: 50}));
  assert.equal(combo.textContent, '3VURUŞ300 HASAR');
  assert.notEqual(combo.className, cls1, 'zıplama animasyonu yeniden başlar');
  clock.advance(HUD_TIMES.comboWindow - 1);
  assert.ok(combo.parentNode);
  clock.advance(1 + HUD_TIMES.comboOut);
  assert.equal(combo.parentNode, null);
});

test('kombo: bloklanan vuruş ya da rakip isabeti sayacı sıfırlar', () => {
  const {stage, hud} = setup();
  hud.handle(hit()); hud.handle(hit());
  assert.equal(stage[1].children.length, 1);
  hud.handle(hit({fromSeat: 2, toSeat: 1}));
  hud.handle(hit()); // yeniden 1. vuruş: görünmez
  assert.equal(stage[1].children.filter(c => !c.className.includes('fhud-out')).length, 0);
  hud.handle(hit()); hud.handle(hit({blocked: true}));
  assert.equal(stage[1].children.filter(c => !c.className.includes('fhud-out')).length, 0);
});

// ---- Süper bar -------------------------------------------------------------
test('süper bar: classic r/5, dolunca SÜPER HAZIR, arenada gizli', () => {
  const {stage, hud} = setup();
  const match = {mode: 'classic', status: 'running', players: players.map((p, i) => ({...p, skillCharge: {r: i ? 5 : 2}}))};
  hud.update(match, 'me');
  const bar1 = stage[1].children.find(c => c.className.includes('fhud-super'));
  const bar2 = stage[2].children.find(c => c.className.includes('fhud-super'));
  assert.equal(bar1.hidden, false);
  assert.equal(all(bar1).find(c => c.className === 'fhud-super-fill').props.transform, 'scaleX(0.4)');
  assert.equal(all(bar1).find(c => c.className === 'fhud-super-label').textContent, 'SÜPER');
  assert.equal(all(bar2).find(c => c.className === 'fhud-super-label').textContent, 'SÜPER HAZIR');
  assert.match(bar2.className, /fhud-ready/);
  hud.update({...match, mode: 'arena'}, 'me');
  assert.equal(bar1.hidden, true);
  hud.update({...match, status: 'ended'}, 'me');
  assert.equal(bar2.hidden, true);
});

test('süper bar: ULTİ anında dolu parlar ve superFreeze çağrılır', () => {
  const {stage, clock, hud, calls, root} = setup();
  hud.update({mode: 'classic', status: 'running', players: players.map(p => ({...p, skillCharge: {r: 0}}))}, 'me');
  hud.handle({type: 'SKILL_CAST', skill: 'r', fromSeat: 1});
  const bar = stage[1].children.find(c => c.className.includes('fhud-super'));
  assert.match(bar.className, /fhud-ready/);
  assert.deepEqual(calls.at(-1), ['superFreeze', 1, HUD_TIMES.freeze]);
  assert.equal(callText(root), CALLS.ultimate);
  clock.advance(HUD_TIMES.superFlash);
  assert.doesNotMatch(bar.className, /fhud-ready/);
});

// ---- Anonslar --------------------------------------------------------------
test('anons: aynı anda tek, en fazla 2 bekleyen, 700 ms', () => {
  const {root, clock, hud} = setup();
  hud.handle({type: 'PARRY_TRIGGERED', seat: 2});
  hud.handle({type: 'COUNTERATTACK_CAST', fromSeat: 2});
  hud.handle({type: 'SHIELD_BROKEN', seat: 1});
  hud.handle(hit({bonusTags: ['x']})); // kuyruk dolu: düşer
  assert.equal(MAX_PENDING_CALLS, 2);
  assert.equal(layers(root).length, 1);
  assert.equal(callText(root), CALLS.parry);
  clock.advance(HUD_TIMES.call);
  assert.equal(callText(root), CALLS.counter);
  clock.advance(HUD_TIMES.call);
  assert.equal(callText(root), CALLS.shieldBreak);
  clock.advance(HUD_TIMES.call);
  assert.equal(layers(root).length, 0);
});

test('anons katmanı arena alanına oturur, yazma kutusuna taşmaz, tıklamayı engellemez (CSS)', () => {
  const {root, hud} = setup();
  hud.handle({type: 'PARRY_TRIGGERED', seat: 1});
  const layer = layers(root)[0];
  assert.equal(layer.props.top, '300px');
  assert.ok(parseInt(layer.props.height) <= 480);
  // Yazma kutusu düello alanına taşıyorsa katman onun altından başlar.
  const {root: root2, hud: hud2} = setup();
  const type = {getBoundingClientRect: () => ({top: 100, bottom: 360, height: 260, left: 0, width: 900})};
  const q = root2.querySelector;
  root2.querySelector = sel => (sel.startsWith('.tt-type') ? type : q(sel));
  hud2.handle({type: 'PARRY_TRIGGERED', seat: 1});
  assert.equal(layers(root2)[0].props.top, '368px');
  assert.equal(layer.attrs['aria-hidden'], 'true');
  const css = readFileSync(new URL('../pvp/fight-hud.css', import.meta.url), 'utf8');
  assert.match(css, /\.fhud-layer\{[^}]*pointer-events:none/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /#pvp-root\.pvp4-reduced \.fhud-layer/);
  for (const m of css.matchAll(/font:[^;}]*?(\d+)px/g)) assert.ok(Number(m[1]) >= 12, m[0]);
  for (const m of css.matchAll(/font(?:-size)?:[^;}]*?clamp\((\d+)px/g)) assert.ok(Number(m[1]) >= 12, m[0]);
});

test('metin textContent ile yazılır (HTML yorumlanmaz)', () => {
  const {root, clock, hud} = setup();
  hud.matchStart({players: [{seat: 1, name: '<img src=x onerror=alert(1)>', character: 'fire'}, players[1]]});
  clock.advance(HUD_TIMES.startDelay + HUD_TIMES.round + HUD_TIMES.fight);
  hud.matchEnd({winnerSeat: 1, reason: 'TIME'});
  const word = all(layers(root)[0]).find(c => String(c.className).includes('fhud-call-text'));
  assert.equal(word.textContent, '<img src=x onerror=alert(1)> KAZANDI');
  assert.equal(word.innerHTML, undefined);
});

// ---- Maç sonu --------------------------------------------------------------
test('maç sonu: NAKAVT! (slowMo) sonra ZAFER / YENİLGİ myId\'ye göre', () => {
  const {root, clock, hud, calls} = setup();
  hud.update({mode: 'classic', status: 'running', players}, 'me');
  hud.matchEnd({winnerSeat: 1, reason: 'KNOCKOUT'});
  assert.deepEqual(calls.at(-1), ['slowMo', HUD_TIMES.slowRate, HUD_TIMES.slowMs]);
  assert.equal(callText(root), CALLS.knockout + CALLS.victory);
  clock.advance(HUD_TIMES.final);
  assert.equal(layers(root).length, 0);

  const b = setup();
  b.hud.update({mode: 'classic', status: 'running', players}, 'bot');
  b.hud.matchEnd({winnerSeat: 1, reason: 'TIME'});
  assert.equal(callText(b.root), CALLS.defeat);
});

test('maç sonucu penceresi açılınca anons hemen çekilir', () => {
  const {root, clock, hud} = setup();
  hud.update({mode: 'classic', status: 'running', players}, 'me');
  hud.matchEnd({winnerSeat: 1, reason: 'KNOCKOUT'});
  assert.equal(callText(root), CALLS.knockout + CALLS.victory);
  const q = root.querySelector;
  root.querySelector = sel => (sel.startsWith('.pvp15-backdrop') ? {hidden: false} : q(sel));
  clock.advance(100);
  assert.equal(layers(root).length, 0);
  clock.advance(3000);
  assert.equal(layers(root).length, 0);
});

test('raund modu: yeni raundda "RAUND N"', () => {
  const {root, clock, hud} = setup();
  hud.matchStart({players, mode: 'rounds', round: 1});
  clock.advance(3000);
  const m = r => ({mode: 'rounds', status: 'running', round: {index: r, phase: 'round'}, players: players.map(p => ({...p, streak: 2}))});
  hud.update(m(1), 'me');
  assert.equal(layers(root).length, 0);
  hud.update({...m(2), round: {index: 2, phase: 'intermission'}}, 'me');
  assert.equal(layers(root).length, 0);
  hud.update(m(2), 'me');
  clock.advance(HUD_TIMES.startDelay + 40);
  assert.equal(callText(root), 'RAUND 2');
  // Başka modül raund yazısını gösteriyorsa tekrar yok.
  clock.advance(5000);
  root._ruiIntro = {hidden: false};
  hud.update(m(3), 'me');
  clock.advance(HUD_TIMES.startDelay + 40);
  assert.equal(layers(root).length, 0);
});

test('arena: giriş hazırlık evresini bekler, yazma raundunda SAVAŞ! gelir', () => {
  const {root, clock, hud} = setup();
  const m = phase => ({mode: 'arena', status: 'running', round: {index: 1, phase}, players});
  hud.matchStart({players, mode: 'arena', round: 1});
  hud.update(m('prep'), 'me');
  clock.advance(3000);
  assert.equal(layers(root).length, 0);
  hud.update(m('round'), 'me');
  clock.advance(HUD_TIMES.startDelay);
  assert.ok(layers(root).length === 1);
  assert.equal(root.children.filter(c => String(c.className).includes('fhud-super') && !c.hidden).length, 0);
});

test('API yoksa sessizce atlanır; clear/destroy her şeyi siler', () => {
  const {root, stage, clock, hud} = setup({noApi: true});
  assert.ok(root.classList.contains('fhud-on'));
  hud.matchStart({players});
  clock.advance(HUD_TIMES.startDelay);
  hud.handle({type: 'SKILL_CAST', skill: 'r', fromSeat: 1});
  hud.handle(hit()); hud.handle(hit());
  hud.update({mode: 'classic', status: 'running', players: players.map(p => ({...p, skillCharge: {r: 1}}))}, 'me');
  hud.clear();
  assert.equal(layers(root).length, 0);
  assert.equal(stage[1].children.length + stage[2].children.length, 0);
  hud.destroy();
  assert.equal(clock.pending.size, 0);
  assert.ok(!root.classList.contains('fhud-on'));
  assert.equal(hud.handle(hit()), false);
});

test('index.js entegrasyonu', () => {
  const src = readFileSync(new URL('../pvp/index.js', import.meta.url), 'utf8');
  assert.match(src, /import \{createFightHud\} from '\.\/fight-hud\.js'/);
  assert.match(src, /function playCombat\(action\)\{\n  fx24\.hud\?\.handle\(action\);/);
  assert.match(src, /getArenaApi:\(\)=>arena3d\.instance\?\.api/);
  assert.match(src, /hud\.matchEnd\(/);
});

// ---- Düzeltme turu 2 / D: KRİTİK yazısı DOM'da ölçülebilir ve arka planda ----------------------
test('KRİTİK: [data-crit-text] öğesi çıkar, katman fhud-layer-crit, bant yok, soluk CSS', () => {
  const {root, hud} = setup();
  hud.handle(hit({amount: 200, bonusTags: ['Kızıl Öfke']}));
  const crit = all(root).find(e => 'data-crit-text' in e.attrs);
  assert.ok(crit, 'data-crit-text öğesi DOM\'da');
  assert.equal(crit.textContent, CALLS.crit);
  assert.match(crit.className, /fhud-call-crit/);
  assert.ok(layers(root).some(l => String(l.className).includes('fhud-layer-crit')));
  const css = readFileSync(new URL('../pvp/arena3d.css', import.meta.url), 'utf8');
  assert.match(css, /\.fhud-call-text\.fhud-call-crit\{[^}]*opacity:\.3[^}]*pointer-events:none/);
});
