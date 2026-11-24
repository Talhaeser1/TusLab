// docs/20-pvp-tus-turu.md — Kâşif turunda (her düğme/tuş gerçek kullanımla) düzeltilen PvP sorunlarının bekçi testleri.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PICK_AUTO_LOCK_MS} from '../pvp/rounds-ui.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(resolve(ROOT, f), 'utf8');

test('Maç sürerken açılan lobi: "Maça dön" düğmesi ve Esc maça döndürür', () => {
  const net = read('pvp/network.js');
  assert.match(net, /class="sc-friend sc-back" data-lobby-action="back" data-sc-back hidden/);
  assert.match(net, /matchLive\(\)\{return \['running','paused'\]\.includes\(this\.match\?\.status\);\}/);
  assert.match(net, /panel\.querySelector\('\[data-sc-back\]'\)\?\.toggleAttribute\('hidden',!this\.matchLive\(\)\)/);
  // Esc: çekmece/alt sayfa yoksa ve maç sürüyorsa lobi kapanır
  assert.match(net, /if\(e\.key==='Escape'&&this\.matchLive\(\)\)\{e\.preventDefault\(\);this\.open=false;this\.render\(\);this\.returnToMatch\(\);return;\}/);
  assert.match(net, /if\(action==='toggle'\)\{this\.open=!this\.open;this\.render\(\);if\(!this\.open\)this\.returnToMatch\(\);return;\}/);
  assert.match(net, /dispatchEvent\?\.\(new CustomEvent\('tuslab:pvp-lobby-closed'\)\)/);
  assert.match(net, /if\(action==='back'\)\{if\(this\.open&&this\.matchLive\(\)\)\{this\.open=false;this\.render\(\);this\.returnToMatch\(\);\}return;\}/);
  // bot maçı sürerken "Enter ile de başlar" ipucu gizli (Enter yeniden başlatmaz)
  assert.match(net, /querySelector\('\.sc-start-hint'\)\?\.toggleAttribute\('hidden',Boolean\(this\.practice\)\)/);
  const main = read('pvp/pvp-main.js');
  assert.match(main, /addEventListener\('tuslab:pvp-lobby-closed',\(\)=>focusTypingWhenReady\(\)\)/);
});

test('Lobi maçın üstündeyken dövüş HUD katmanları lobinin üstüne çizilmez; odak gizli kutuya çalınmaz', () => {
  const css = read('pvp/lobby-v3.css');
  assert.match(css, /#pvp-root:has\(\[data-lobby-panel\]:not\(\[hidden\]\)\) > :is\(\.fhud2,\.mi,\.pvp-combo-counter,\.cin\)\{visibility:hidden!important\}/);
  const main = read('pvp/pvp-main.js');
  assert.match(main, /dialog\[open\], \[data-lobby-panel\]:not\(\[hidden\]\)'\)\)return;/);
});

test('Esc çıkış onayı: kutu aynı tuşun içinde açılmaz (Chrome kapatma isteği kutuyu hemen kapatıyordu); yazma kutusunda da çalışır', () => {
  const main = read('pvp/pvp-main.js');
  assert.match(main, /event\.key==='Escape'&&\(!\['TEXTAREA','INPUT'\]\.includes\(document\.activeElement\?\.tagName\)\|\|document\.activeElement\?\.matches\?\.\('\[data-tt-input\]'\)\)/);
  assert.match(main, /event\.preventDefault\(\);\s*setTimeout\(\(\)=>\{\s*if\(!\['running','paused'\]\.includes\(network\.match\?\.status\)\|\|document\.querySelector\('dialog\[open\]'\)\)return;\s*void askConfirm\(root,\{title:'Maçtan çık\?'/);
});

test('Odak yazma kutusunda değilken basılan harf kutuya yönlenir (panel/lobi/kutu açıkken değil)', () => {
  const main = read('pvp/pvp-main.js');
  assert.match(main, /function redirectTypingKey\(e\)\{/);
  assert.match(main, /if\(roundsUi\?\.handleKey\(event\)\)return;\s*redirectTypingKey\(event\);/);
  const body = main.slice(main.indexOf('function redirectTypingKey(e){'), main.indexOf('// PvP captures game shortcuts'));
  assert.match(body, /e\.key===' '/);                                // boşluk düğmeyi etkinleştirmeye devam eder
  assert.match(body, /\[data-pvp16-panel\]:not\(\[hidden\]\), \[data-pvp17-panel\]:not\(\[hidden\]\), \.htp-panel:not\(\[hidden\]\)/);
  assert.match(body, /input\.focus\(\{preventScroll:true\}\)/);
});

test('"Efektleri azalt" tercihi kalıcı', () => {
  const main = read('pvp/pvp-main.js');
  assert.match(main, /const REDUCED_FX_KEY='tuslab-pvp-reduced-fx';/);
  assert.match(main, /localStorage\.getItem\(REDUCED_FX_KEY\)==='on'/);
  assert.match(main, /if\(reducedEffects\)localStorage\.setItem\(REDUCED_FX_KEY,'on'\);else localStorage\.removeItem\(REDUCED_FX_KEY\);/);
});

test('Maç bitince tam ekran düzen kalır (sonuç kartı açılırken eski 2B paneller görünmez)', () => {
  const main = read('pvp/pvp-main.js');
  assert.match(main, /function fullscreenLayoutSync\(\)\{[\s\S]{0,700}const running=\['running','paused','ended'\]\.includes\(network\.match\?\.status\);/);
});

test('Profil ve Arkadaşlar panelleri görüntü alanına sabit, 40 px çubuğa göre ezilmez; açıkken HUD gizli', () => {
  const css = read('pvp/phase16-ui.css');
  assert.match(css, /#pvp-root \.pvp16-modal,\s*#pvp-root \.pvp17-modal\{position:fixed;top:56px;bottom:auto;max-height:calc\(100dvh - 72px\)\}/);
  assert.match(css, /#pvp-root:has\(\.pvp16-modal:not\(\[hidden\]\),\.pvp17-modal:not\(\[hidden\]\)\) > :is\(\.fhud2,\.mi,\.pvp-combo-counter\)\{visibility:hidden!important\}/);
});

test('Tur arası: seçili ama kilitlenmemiş süre becerisi süre dolmadan kendiliğinden kilitlenir', () => {
  assert.equal(PICK_AUTO_LOCK_MS, 700);
  const ui = read('pvp/rounds-ui.js');
  assert.match(ui, /if\(state\.selected&&!state\.pending&&nextRoundAt-t<=PICK_AUTO_LOCK_MS&&nextRoundAt-t>0\)\{\s*const pm=roundSkillPickerModel\(match,state\.myId\);if\(pm\.visible&&!pm\.locked\)lockPick\(state\.selected\);/);
});

test('3B dövüşçü: duruş klibi ilk kareden önce uygulanır (T-poz görünmez)', () => {
  const rig = read('pvp/fighters3d.js');
  assert.match(rig, /goIdle\(0\);\s*\/\/[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*try \{ mixer\.update\(0\); \} catch/);
});

test('Yükleyici: ?pvp= adresinde modül inmezse sayfa bir kez yenilenir (dakikada en çok bir)', async () => {
  const {createPvpLoader, RELOAD_KEY} = await import('../pvp/index.js');
  const store = new Map();
  let reloads = 0;
  const win = {sessionStorage: {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v))},
    location: {reload: () => { reloads++; }}, setTimeout() {}, addEventListener() {}};
  const doc = {readyState: 'complete', getElementById: () => ({hidden: false}), addEventListener() {}, head: {appendChild() {}}, createElement: () => ({})};
  const origError = console.error; console.error = () => {};
  try {
    const fail = async () => { throw new Error('ERR_CONNECTION_REFUSED'); };
    createPvpLoader({doc, win, search: '?pvp=lobby', importMain: fail, mainUrl: 'x'});
    await new Promise(r => setImmediate(r));
    assert.equal(reloads, 1);
    assert.ok(Number(store.get(RELOAD_KEY)) > 0);
    createPvpLoader({doc, win, search: '?pvp=lobby', importMain: fail, mainUrl: 'x'}); // aynı dakika: döngü yok
    await new Promise(r => setImmediate(r));
    assert.equal(reloads, 1);
    // ana sayfadan (tuslab:pvp-enter) açılışta yenileme yok: ipucu gizlenir, sonraki tık yeniden dener
    store.clear();
    createPvpLoader({doc: {...doc, addEventListener: (t, fn) => fn()}, win, search: '', importMain: fail, mainUrl: 'x'});
    await new Promise(r => setImmediate(r));
    assert.equal(reloads, 1);
  } finally { console.error = origError; }
});

test('Oda koduna katıl: hata yazısı gerçek nedeni söyler; davet bağlantısı yapıştırılabilir', async () => {
  const {roomCodeProblem} = await import('../pvp/network.js');
  assert.equal(roomCodeProblem(''), 'Oda kodunu yaz ya da davet bağlantısını yapıştır.');
  assert.equal(roomCodeProblem('ABC'), 'Oda kodu 16 karakter olmalı (şu an 3).');
  assert.equal(roomCodeProblem('ABCDEF1234567890'), 'Oda kodunda yalnız harf ve 2–9 rakamları olur (0 ve 1 yok).');
  const net = read('pvp/network.js');
  assert.match(net, /const normalized=\(\/pvpRoom=\/i\.test\(raw\)&&invitedRoom\(raw\)\)\|\|raw\.replace\(\/\[\\s-\]\/g,''\)\.toUpperCase\(\);/);
});
