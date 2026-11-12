// J2 — PvP lobi: mod şeridi (içerik modları dahil), karakter ikonları + bilgi kartı, MAÇ AYARLARI, arena karuseli,
// "Maç kuralları" paneli yok, seçilen karakter üç modda maça geçer, ?fighter2= botu, HUD etiketi = model.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPracticeSession, practiceFighters, BOT_ID, HUMAN_ID} from '../pvp/practice.js';
import {FIGHTERS, FIGHTER_IDS} from '../pvp/shared/fighters.js';
import {CONTENT_MODES} from '../pvp/shared/content-modes.js';
import {modePickDecision} from '../pvp/arena-ui.js';
import {PvPNetworkConsole, networkConsoleHTML, fighterRosterHTML, fighterInfoHTML, botFighterFromUrl, fighterFromUrl} from '../pvp/network.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(resolve(ROOT, f), 'utf8');
const html = networkConsoleHTML();

function clock() {
  let at = 1_700_000_000_000, id = 0; const timers = new Map();
  const add = (fn, ms, repeat) => { const key = ++id; timers.set(key, {fn, at: at + ms, ms, repeat}); return key; };
  return {now: () => at, active: () => timers.size, scheduler: {setTimeout: (fn, ms) => add(fn, ms, false), clearTimeout: k => timers.delete(k), setInterval: (fn, ms) => add(fn, ms, true), clearInterval: k => timers.delete(k)}};
}
const open = (mode, o = {}) => { const t = clock(); let n = 0; const s = createPracticeSession({mode, now: t.now, scheduler: t.scheduler, rng: () => 0.5, createId: () => `j2-${++n}`, onPacket() {}, ...o}); s.start(); return s; };

test('J2: mod şeridinde klasik/raund/arena + Atasözü/Şiir/Osmanlıca; içerik modları içerik moduyla aynı kimlikler', () => {
  const strip = html.match(/data-mode-picker="practice"[\s\S]*?<\/div><small class="rui-picker-note"/)[0];
  const ids = [...strip.matchAll(/data-mode="(\w+)"/g)].map(m => m[1]);
  assert.deepEqual(ids, ['classic', 'rounds', 'arena', 'atasozu', 'siir', 'osmanlica']);
  for (const c of ['atasozu', 'siir', 'osmanlica']) assert.ok(CONTENT_MODES.includes(c), `${c} içerik modu`);
  // Şerit mod seçiciden ÖNCE gelir (EN ÜSTTE) ve yatay kaydırma + scroll-snap CSS'i var.
  assert.ok(html.indexOf('class="j2-modes"') < html.indexOf('id="lb3-hero-title"'));
  const css = read('pvp/lobby-v3.css');
  assert.match(css, /\.j2-modes \.aui-modes \.rui-seg\{[^}]*overflow-x:auto[^}]*scroll-snap-type:x mandatory/s);
  assert.match(css, /\.j2-modes \.aui-modes \.rui-seg button\{[^}]*scroll-snap-align:center/s);
});

test('J2: içerik modu seçimi bot oturumuna içerik olarak geçer (lobi seçimi = ?icerik= ile aynı yol)', () => {
  for (const c of ['atasozu', 'siir', 'osmanlica']) {
    const s = open('rounds', {content: c});
    assert.equal(s.snapshot().content, c, c);
    s.dispose();
  }
  // Lobi düğmesi → karar: içerik modu = raund modu + içerik (network.js click gövdesi bunu practiceMode/practiceContent'e yazar).
  for (const c of ['atasozu', 'siir', 'osmanlica']) assert.deepEqual(modePickDecision({scope: 'practice', value: c}), {store: 'rounds', content: c});
  assert.deepEqual(modePickDecision({scope: 'practice', value: 'arena'}), {store: 'arena'});
  assert.match(read('pvp/network.js'), /content:this\.practiceMode==='rounds'\?this\.practiceContent:'kelime'/);
});

test('J2: karakterler yalnız ikon; bilgi kartı silah + Q/E/R adı/açıklaması fighters.js\'ten gelir', () => {
  const roster = fighterRosterHTML('sira');
  assert.deepEqual([...roster.matchAll(/data-fighter="(\w+)" data-side/g)].map(m => m[1]), ['vargr', 'sira', 'doran', 'nyx', 'konyali']);
  assert.equal(FIGHTER_IDS.length, 5);
  assert.doesNotMatch(roster.replace(/<template[\s\S]*?<\/template>/g, ''), /lb3-f-skill|lb3-f-blurb/, 'kartın kendisinde açıklama yok, yalnız portre + ad');
  assert.match(roster, /data-fighter-info/);
  for (const id of FIGHTER_IDS) {
    const f = FIGHTERS[id], info = fighterInfoHTML(id);
    assert.ok(roster.includes(`<template data-fighter-card="${id}">${info}</template>`), `${id} şablonu`);
    assert.ok(f.weapon && info.includes(f.weapon.replace('&', '&amp;')), `${id} silahı`);
    for (const k of ['q', 'e', 'r']) { assert.ok(info.includes(f.skills[k].name), `${id}.${k} adı`); assert.ok(info.includes(f.skills[k].desc), `${id}.${k} açıklama`); }
  }
  const css = read('pvp/lobby-v3.css');
  for (const id of ['vargr', 'sira', 'doran', 'nyx']) assert.match(css, new RegExp(`portre-${id}\\.webp`));
  assert.match(css, /assets\/models\/konyali\/portre-konyali\.webp/);
  // Tek satır / telefonda 3 sütun
  assert.match(css, /\.j2-chars\{display:grid;grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css, /@media \(max-width:560px\)\{[^@]*\.j2-chars\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

test('J2: "Maç kuralları" paneli yok; MAÇ AYARLARI bot zorluğu + maç uzunluğu + raund biçimi segment düğmeleri', () => {
  assert.doesNotMatch(html, /Maç kuralları/);
  assert.doesNotMatch(html, /data-typing-box|data-typing-key|data-assist-scope/);
  const settings = html.match(/<section class="j2-settings"[\s\S]*?<\/section>/)[0];
  assert.match(settings, /MAÇ AYARLARI/);
  assert.equal((settings.match(/data-lobby-action="difficulty"/g) || []).length, 3);
  assert.match(settings, /data-rounds-picker="practice"/);
  assert.match(settings, /data-style-picker="practice"/);
  assert.doesNotMatch(settings, /<select/);
  const click = read('pvp/network.js');
  assert.match(click, /action==='difficulty'/);
});

test('J2: arena karuseli CSS 3B (perspective + rotateY/translateZ), seçili önde; hareket azaltma uyumlu; cam efekti yok', () => {
  const css = read('pvp/lobby-v3.css'), j2 = css.slice(css.indexOf('J2 — PvP LOBİ'));
  assert.match(j2, /\.j2-arena \.lb3-stage-strip\{[^}]*perspective:900px/s);
  assert.match(j2, /rotateY\(calc\(var\(--o,0\)\*-34deg\)\)/);
  assert.match(j2, /translateZ\(calc\(var\(--a,0\)\*-110px\)\)/);
  assert.match(j2, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(j2, /backdrop-filter|blur\(|drop-shadow\(/);
  for (const m of j2.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)) assert.ok(Number(m[1]) >= 12, `yazı ≥ 12 px: ${m[0]}`);
  const net = read('pvp/network.js');
  assert.match(net, /style\?\.setProperty\?\.\('--o'/);
  assert.match(net, /stepStage\(scope,dir\)/);
});

test('J2: ok tuşları belge yakalayıcısı sonrası lobi yönlendiricisinden geçer (kök dinleyicisine ulaşmaz)', () => {
  const idx = read('pvp/index.js');
  assert.match(idx, /event\.stopImmediatePropagation\(\);\s*if\(network\.lobbyKey\?\.\(event\)\)return;/);
  const net = Object.create(PvPNetworkConsole.prototype), calls = [];
  net.fighterKey = () => calls.push('f'); net.stageKey = () => calls.push('s'); net.modeKey = e => { calls.push('m'); e.defaultPrevented = true; };
  assert.equal(net.lobbyKey({defaultPrevented: false}), true);
  assert.deepEqual(calls, ['f', 's', 'm']);
});

test('J2: seçilen karakter classic / rounds / arena üç modda maça geçer (5 karakterin hepsi)', () => {
  for (const mode of ['classic', 'rounds', 'arena']) {
    for (const id of FIGHTER_IDS) {
      const s = open(mode, {fighter: id});
      const me = s.snapshot().players.find(p => p.playerId === HUMAN_ID), bot = s.snapshot().players.find(p => p.playerId === BOT_ID);
      assert.equal(me.fighter, id, `${mode}/${id}: oyuncu karakteri`);
      assert.equal(me.character, FIGHTERS[id].archetype);
      assert.notEqual(bot.character, me.character, 'bot karşı arketip');
      assert.equal(FIGHTERS[bot.fighter].archetype, bot.character);
      s.dispose();
    }
  }
});

test('J2: fighter2 botu — kök neden: lobi başlatma yolu botFighter\'ı oturuma hiç iletmiyordu (bot hep rastgele)', () => {
  assert.equal(botFighterFromUrl('http://x/?pvp=practice&fighter2=NYX'), 'nyx');
  assert.equal(botFighterFromUrl('http://x/?fighter2=ejder'), null);
  assert.equal(botFighterFromUrl('http://x/'), null);
  assert.equal(fighterFromUrl('http://x/?karakter=konyali&fighter2=sira'), 'konyali', 'fighter2 insan karakterini değiştirmez');
  // Eski davranış: botFighter verilmezse havuzdan RASTGELE (fighterRng) seçilir → URL'deki karakter tutmuyordu.
  assert.equal(practiceFighters({fighter: 'konyali', fighterRng: () => 0}).botFighter, 'vargr');
  assert.equal(practiceFighters({fighter: 'konyali', fighterRng: () => 0.99}).botFighter, 'sira');
  // Düzeltme: PvPNetworkConsole.startPractice botFighter'ı (parametre ya da ?fighter2=) oturuma verir.
  const store = new Map();
  globalThis.localStorage = {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v))};
  const make = () => {
    const net = Object.create(PvPNetworkConsole.prototype), packets = [];
    Object.assign(net, {practiceDifficulty: 'orta', character: 'fire', fighter: 'vargr', rune: 'none', practiceRounds: 3, practiceRoundStyle: 'timed', practiceRoundWords: 10,
      practiceMode: 'classic', practiceContent: 'kelime', practiceTyping: undefined, practiceAssist: true, practiceStage: 'colosseum', myId: null, practice: null,
      disconnect() {}, readName: () => 'Test', log() {}, receive: p => packets.push(p)});
    return {net, packets};
  };
  for (const mode of ['classic', 'rounds', 'arena']) {
    for (const [fighter, bot] of [['vargr', 'nyx'], ['sira', 'doran'], ['doran', 'sira'], ['nyx', 'vargr'], ['konyali', 'sira'], ['vargr', 'konyali']]) {
      const {net} = make();
      net.practiceMode = mode;
      net.startPractice({fighter, botFighter: bot});
      assert.equal(net.practice.botFighter, bot, `${mode}: ${fighter} vs ${bot}`);
      const players = net.practice.snapshot().players;
      assert.equal(players.find(p => p.playerId === BOT_ID).fighter, bot, `${mode}: HUD etiketi (match.players[].fighter) bot=${bot}`);
      assert.equal(players.find(p => p.playerId === HUMAN_ID).fighter, fighter);
      net.practice.dispose();
    }
  }
  // URL yolu: lobi düğmesi (parametresiz startPractice) de ?fighter2= değerini kullanır.
  globalThis.location = {href: 'http://127.0.0.1/index.html?fighter2=konyali', search: '?fighter2=konyali', hostname: '127.0.0.1'};
  try {
    const {net} = make();
    net.startPractice({fighter: 'vargr'});
    assert.equal(net.practice.botFighter, 'konyali');
    net.practice.dispose();
  } finally { delete globalThis.location; delete globalThis.localStorage; }
});

test('J2: HUD etiketi ile 3B model aynı kaynaktan (match.players[].fighter); URL zorlaması yalnız arketip uyuşunca', () => {
  const idx = read('pvp/index.js');
  assert.match(idx, /if\(isFighterId\(forced\)&&\(!p\|\|FIGHTERS\[forced\]\.archetype===side\)\)return forced;/);
  assert.match(idx, /return normalizeFighter\(p\?\.fighter,side\);/);
  // Beceri çubuğu adları da aynı alandan: applyFighterNames(section, player.fighter)
  assert.match(read('pvp/skillbar.js'), /applyFighterNames\(section,player\.fighter\)/);
});

test('J2: maça girişte 2B/eski model parlaması yok — yükleniyor sınıfı + 2B rig gizli + gösterge', () => {
  const idx = read('pvp/index.js'), css = read('pvp/arena3d.css'), a3 = read('pvp/arena3d.js');
  assert.match(idx, /root\.classList\.add\('pvp-models-pending'\)/);
  assert.match(idx, /root\?\.classList\.remove\('pvp-models-pending'\)/);
  assert.match(css, /#pvp-root\.pvp-models-pending \.pvp3-rig\{visibility:hidden\}/);
  assert.match(css, /#pvp-root\.pvp-models-pending:has\(#pvp-lobby-panel\[hidden\]\)::after\{content:'Savaşçılar hazırlanıyor…'/);
  assert.match(a3, /setPlaneVisible\(fighter, false\); fighter\.actor\.visible = false;/);
  assert.match(a3, /fighter\.actor\.visible = !fighter\.fighterId \|\| Boolean\(fighter\.model\) \|\| fighter\.modelFailed;/);
});
