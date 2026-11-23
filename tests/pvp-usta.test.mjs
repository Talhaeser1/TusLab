// docs/17-pvp-kalanlar.md — Usta turunda düzeltilen PvP sorunlarının bekçi testleri.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {roundsResultModel} from '../pvp/rounds-ui.js';
import {resultCardHTML, defenseLine} from '../pvp/phase15-results.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(resolve(ROOT, f), 'utf8');

test('Lobide yalnız oyuncunun seçili dövüşçüsü ön ısınır; seçim değişince yenisi yüklenir', () => {
  const main = read('pvp/pvp-main.js');
  // maç yokken iki varsayılan (Vargr + Doran) yerine yalnız seçili dövüşçü, arketipinin koltuğunda
  assert.match(main, /function lobbyFighterMap\(\)\{\s*const id=isFighterId\(network\.fighter\)\?network\.fighter:null;/);
  assert.match(main, /return \{\[FIGHTERS\[id\]\.archetype==='rune'\?2:1\]:id\};/);
  assert.match(main, /function arena3dSyncFighters\(\)\{\s*if\(!network\.match\)\{\s*const map=lobbyFighterMap\(\);/);
  assert.match(main, /addEventListener\('tuslab:pvp-fighter',\(\)=>\{if\(!network\.match\)arena3dSyncFighters\(\);\}\)/);
  const net = read('pvp/network.js');
  assert.match(net, /selectFighter\(id\)\{[\s\S]{0,400}dispatchEvent\?\.\(new CustomEvent\('tuslab:pvp-fighter',\{detail:\{fighter:id\}\}\)\)/);
});

test('Maç açılışı: efekt provası koltuk başına ayrı karede; provası yapılmış koltuk atlanır', () => {
  const a = read('pvp/arena3d.js');
  assert.match(a, /for \(const seat of SEATS\) warmQueue\.push\(\{rehearse: true, seat\}\)/);
  assert.match(a, /function rehearseFx\(only = null\) \{\s*const seats = SEATS\.filter\(s => \(only === null \|\| s === only\) && fighters\.get\(s\)\?\.fighterId\);\s*if \(!seats\.length\) return;/);
  assert.match(a, /rehearseFx\(job\.seat \?\? null\)/);
});

const baseResult = (extra = {}) => ({mode: 'rounds', totalRounds: 7, endReason: 'SURRENDER', winnerSeat: 2,
  finalHp: {1: 6000, 2: 6000}, rounds: [],
  players: [{seat: 1, playerId: 'me', name: 'Savaşçı'}, {seat: 2, playerId: 'bot', name: 'Bot'}], ...extra});

test('Teslim sonucu: kalan can / oynanmamış raund yerine kim hangi raundda çekildi', () => {
  const mine = roundsResultModel(baseResult(), 'me');
  assert.equal(mine.scoreline, "Teslim · Raund 1/7'de çekildin");
  assert.equal(mine.surrender, true);
  assert.equal(mine.lengthLabel, '7 raundluk maç · 0 raund oynandı');
  const opp = roundsResultModel(baseResult({winnerSeat: 1, rounds: [{round: 1, scores: []}, {round: 2, scores: []}]}), 'me');
  assert.equal(opp.scoreline, "Teslim · Rakip Raund 3/7'de çekildi");
  const watcher = roundsResultModel(baseResult(), 'izleyici');
  assert.equal(watcher.scoreline, "Teslim · Savaşçı Raund 1/7'de çekildi");
  const sudden = roundsResultModel(baseResult({rounds: Array.from({length: 7}, (_, i) => ({round: i + 1, scores: []}))}), 'me');
  assert.equal(sudden.scoreline, 'Teslim · ani ölümde çekildin');
  // teslim dışı sonuçlar değişmedi
  const ko = roundsResultModel(baseResult({endReason: 'KNOCKOUT', finalHp: {1: 1240, 2: 0}}), 'me');
  assert.equal(ko.scoreline, '1.240 – 0 · NAKAVT');
  assert.ok(!ko.surrender);
  const ui = read('pvp/rounds-ui.js');
  assert.match(ui, /cls:`rui-res-line\$\{model\.surrender\?' is-surrender':''\}`/);
  assert.match(read('pvp/rounds-ui.css'), /\.rui-res-line\.is-surrender\{font-size:clamp\(18px,/);
  assert.match(read('pvp/rounds-ui.css'), /\.rui-res-score:has\(\.rui-res-line\.is-surrender\)\{[^}]*grid-template-areas:"n1 n2" "line line"/);
});

test('Sonuç kartı: kalkan kuran dövüşçüde "Toplam iyileşme: +0" yok; can dövüşçüsünde aynen var', () => {
  const card = (fighter, character, extra = {}) => resultCardHTML({seat: 1, name: 'A', character, fighter, wpm: 40, accuracy: 95, damageDealt: 900,
    skillCasts: {q: 1, e: 1, h: 2, r: 0}, healDone: 0, correctWords: 10, wrongWords: 1, maxCombo: 4, ...extra}, 1, null);
  for (const id of ['sira', 'doran']) {
    const html = card(id, id === 'sira' ? 'fire' : 'rune');
    assert.doesNotMatch(html, /Toplam iyileşme/, id);
    assert.match(html, /Q \/ W \/ E \/ R: 1 \/ 1 \/ 2 \/ 0/, id);
  }
  for (const [id, ch] of [['vargr', 'fire'], ['nyx', 'rune'], ['konyali', 'rune']]) {
    assert.match(card(id, ch, {healDone: 300}), /Toplam iyileşme: \+300/, id);
  }
  // motor ileride kalkan toplamı verirse doğru etiketle yazılır
  assert.equal(defenseLine({fighter: 'doran', character: 'rune', shieldDone: 600}), '<span>Toplam kalkan: 600</span>');
});

test('Kalkan kurulunca kalkan sesi çalar (DEVIR-PVP 8)', () => {
  const main = read('pvp/pvp-main.js');
  assert.match(main, /action\.type==='HEAL_APPLIED'&&action\.kind==='shield'\)\{[\s\S]{0,400}if\(Number\(action\.shieldAdded\)>0\)pvpAudio\.play\('shield',/);
});

test('Lobi arena kartları 800×450 küçük görselleri kullanır (tam 1600×900 görseller lobide inmez)', () => {
  const css = read('pvp/lobby-v3.css');
  for (const n of ['arena-neon-kolezyum', 'arena-gok-demirhanesi', 'arena-run-bahcesi', 'arena-firtina-limani']) {
    const file = `assets/higgsfield/final/${n}-kart.webp`;
    assert.ok(existsSync(resolve(ROOT, file)), file);
    assert.ok(statSync(resolve(ROOT, file)).size < 30 * 1024, `${file} < 30 KB`);
    assert.doesNotMatch(css, new RegExp(`url\\('[^']*${n}\\.webp'\\)`), `${n}.webp lobi CSS'inde kalmadı`);
  }
  // 3B sahne tam görseli kullanmaya devam eder
  assert.match(read('pvp/stages3d.js'), /colosseum: 'arena-neon-kolezyum'/);
});

test('Telefon yatay: yazma paneli dövüşçülerin arasına sığacak kadar dar', () => {
  const css = read('pvp/fight-hud.css');
  assert.match(css, /@media \(orientation:landscape\) and \(max-height:500px\) and \(min-width:600px\)\{\s*html #pvp-root\.fhud-on\[data-layout="fullscreen"\] \.pvp2-shell>\.tt\{width:clamp\(300px,calc\(100vw - 520px\),520px\)\}\s*\}/);
});

test('761–1100 px: beceri rayları alt köşelerde (üst HUD örtülmez); ad kelime ortasından kırılmaz', () => {
  const css = read('pvp/fight-hud.css');
  assert.match(css, /@media \(min-width:761px\) and \(max-width:1100px\) and \(min-height:501px\)\{\s*html #pvp-root\.fhud-on \.fhud2 \.fhud2-rail\{bottom:14px\}\s*\}/);
  assert.match(css, /#pvp-root \.fhud2 \.fhud2-name\{overflow-wrap:break-word\}/);
});

test('Lobi açıkken (maç yok) 3B sahne opak lobinin arkasında çizilmez; ön-ısıtma kuyruğu yine çizer', () => {
  const a = read('pvp/arena3d.js');
  assert.match(a, /isOccluded = \(\) => false,/);
  assert.match(a, /if \(!warmQueue\.length && safeCall\(\(\) => isOccluded\(\)\) === true\) return;\s*renderFrame\(\);/);
  const main = read('pvp/pvp-main.js');
  assert.match(main, /function arena3dOccluded\(\)\{const panel=document\.getElementById\('pvp-lobby-panel'\);return Boolean\(panel&&!panel\.hidden&&!network\.match\);\}/);
  assert.match(main, /createArena3D\(\{root,isReduced:fx24Reduced,onImpact:playImpactFeedback,isOccluded:arena3dOccluded\}\)/);
});
