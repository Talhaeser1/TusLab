// Nişancı (docs/27): PvP son düzeltmeler — hasar sayısı yuvaları, 768 px üst şerit, lobi portresi, ortak ses anahtarı,
// geri tuşu koruması, onay beklerken tuş tamponu, quote-bubble'ın boşa yüklenmemesi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDamageNumbers, estimateBox, placeNumber, RISE_PX } from '../pvp/fx-damage.js';
import { readMasterSound, writeMasterSound, watchMasterSound, MASTER_SOUND_KEY, LEGACY_SFX_MUTED_KEY } from '../pvp/master-sound.js';
import { createBackGuard, BACK_GUARD_STATE } from '../pvp/back-guard.js';
import { createPendingBuffer, pendingKeyAction, splitReplay } from '../pvp/pending-buffer.js';
import { createDynamicScore } from '../pvp/music23.js';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const overlap = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
const rect = (cx, cy, w, h) => ({ l: cx - w / 2, r: cx + w / 2, t: cy - h / 2, b: cy + h / 2 });

// ---- 1. Hasar sayıları -----------------------------------------------------
const BOUNDS_1440 = { left: 340, right: 340, up: 524 * 0.34 - RISE_PX - 4, down: 160 };
const num = text => [{ text, cls: 'pxd-main pxd-num' }];

test('yuva: aynı karede gelen "-200" ve "-10" yan yana, kutuları kesişmez ("-20010" okunmaz)', () => {
  const a = estimateBox(num('-200'), 1440, { impact: 1.6 });
  const b = estimateBox(num('-10'), 1440, { impact: 1.03 });
  const pa = placeNumber(a, [], { bounds: BOUNDS_1440 });
  assert.deepEqual(pa, { dx: 0, dy: 0 });
  const pb = placeNumber(b, [{ cx: 0, cy: 0, w: a.w, h: a.h, rise: 0 }], { bounds: BOUNDS_1440 });
  assert.ok(pb);
  assert.equal(overlap(rect(0, 0, a.w, a.h), rect(pb.dx, pb.dy, b.w, b.h)), false);
  assert.equal(pb.dy, 0, 'aynı satırda (yatay kaçış dikeyden önce)');
});

test('yuva: 1440 px sahnede 6 sayılık toplu temas üst üste binmez; yer bitince null (en eski solar)', () => {
  const placed = [];
  for (let i = 0; i < 6; i++) {
    const box = estimateBox(num('-200'), 1440, { impact: 1.6 });
    const p = placeNumber({ ...box, scale: 1.2 }, placed.map(o => ({ ...o, scale: 1.2 })), { bounds: BOUNDS_1440 });
    assert.ok(p, `sayı ${i}`);
    placed.push({ cx: p.dx, cy: p.dy, w: box.w, h: box.h, rise: 0 });
  }
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    const A = placed[i], B = placed[j];
    assert.equal(overlap(rect(A.cx, A.cy, A.w, A.h), rect(B.cx, B.cy, B.w, B.h)), false, `${i}/${j}`);
  }
  // Sahne dışına taşmaz (yükselme payı dahil üstte).
  for (const p of placed) {
    assert.ok(Math.abs(p.cx) + p.w / 2 <= 340);
    assert.ok(p.cy - p.h / 2 >= -BOUNDS_1440.up - 1);
  }
  const box = estimateBox(num('-200'), 1440, { impact: 1.6 });
  assert.equal(placeNumber({ ...box, scale: 1.2 }, placed.map(o => ({ ...o, scale: 1.2 })), { bounds: BOUNDS_1440 }), null);
});

test('yuva: yükselmekte olan eski sayının üstüne konan yeni sayı, eskinin yükselişi kadar pay bırakır', () => {
  const box = estimateBox(num('-120'), 1440, { impact: 1.3 });
  // Eski sayı çapada ve 40 px yükselmiş; yanları dolu (yeni sayı üst satıra gitmek zorunda).
  const others = [
    { cx: 0, cy: 0, w: box.w, h: box.h, rise: 40 },
    { cx: 220, cy: 0, w: 200, h: box.h, rise: 0 },
    { cx: -220, cy: 0, w: 200, h: box.h, rise: 0 },
  ];
  const p = placeNumber(box, others, { bounds: { left: 330, right: 330, up: 400, down: 0 } });
  assert.ok(p);
  // Eskinin ömür boyu kapladığı alan: [cy - h/2 - rise, cy + h/2]
  assert.ok(p.dy + box.h / 2 <= -box.h / 2 - 40, `dy=${p.dy}`);
});

function fakeDom(layerRect = { left: 16, top: 136, width: 688, height: 524 }) {
  const doc = { documentElement: { clientWidth: 1440 }, createElement: tag => el(tag) };
  function el(tag) {
    const node = { tagName: tag.toUpperCase(), children: [], className: '', dataset: {}, props: {}, parentNode: null, textContent: '',
      style: { setProperty(k, v) { node.props[k] = v; } },
      setAttribute() {}, appendChild(c) { c.parentNode = node; node.children.push(c); return c; },
      removeChild(c) { node.children = node.children.filter(x => x !== c); }, remove() { node.parentNode?.removeChild(node); },
      querySelector() { return null; } };
    return node;
  }
  const layers = { 1: el('div'), 2: el('div') };
  for (const l of Object.values(layers)) l.getBoundingClientRect = () => ({ ...layerRect, right: layerRect.left + layerRect.width, bottom: layerRect.top + layerRect.height });
  const root = el('section');
  root.ownerDocument = doc;
  root.querySelector = sel => { const m = /data-seat="(\d)"/.exec(sel); if (!m) return null; const st = el('div'); st.querySelector = () => layers[m[1]]; return st; };
  let t = 0; const timers = new Map(); let id = 0;
  const scheduler = { setTimeout(fn, ms) { timers.set(++id, { fn, at: t + ms }); return id; }, clearTimeout(k) { timers.delete(k); } };
  return { root, layers, scheduler, now: () => t, tick(ms) { t += ms; for (const [k, v] of [...timers]) if (v.at <= t) { timers.delete(k); v.fn(); } } };
}

test('modül: raund sonu çözümündeki gibi aynı karede 4 vuruş — değerler ve süreler aynı, kutular kesişmez', () => {
  const d = fakeDom();
  const fx = createDamageNumbers({ root: d.root, scheduler: d.scheduler, now: d.now, random: () => 0.5 });
  const amounts = [200, 10, 210, 180];
  for (const amount of amounts) fx.handle({ type: 'DAMAGE_APPLIED', fromSeat: 2, toSeat: 1, amount, skill: 'q', arena: true, tags: [] });
  const floats = d.layers[1].children.filter(n => n.className.includes('pxd-float') && !n.className.includes('pxd-leaving'));
  assert.deepEqual(floats.map(n => n.dataset.text), amounts.map(a => `-${a}`));
  // Süre kuralı değişmedi: ağır vuruş 1100 ms, normal 820 ms.
  assert.deepEqual(floats.map(n => n.props['--pxd-dur']), ['1100ms', '820ms', '1100ms', '1100ms']);
  const boxes = floats.map((n, i) => {
    const impact = Number(n.props['--pxd-impact-scale']);
    const b = estimateBox(num(`-${amounts[i]}`), 1440, { impact });
    return rect(parseFloat(n.props['--pxd-lx']) + parseFloat(n.props['--pxd-x']), parseFloat(n.props['--pxd-ly']) + parseFloat(n.props['--pxd-y']), b.w, b.h);
  });
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.equal(overlap(boxes[i], boxes[j]), false, `${i}/${j}`);
  // Yer kalmayınca en eski hızla solar (pxd-leaving), sonra DOM'dan çıkar.
  for (let i = 0; i < 6; i++) fx.handle({ type: 'DAMAGE_APPLIED', fromSeat: 2, toSeat: 1, amount: 200, skill: 'q', arena: true, tags: [] });
  assert.ok(d.layers[1].children.some(n => n.className.includes('pxd-leaving')));
  d.tick(200);
  assert.equal(d.layers[1].children.some(n => n.className.includes('pxd-leaving')), false);
  assert.ok(fx.liveCount(1) <= 6);
  fx.clear();
  assert.equal(d.layers[1].children.length, 0);
});

test('CSS: hızlı solma yalnız opaklık; renk paletleri (kritik/kalkan) yerinde', () => {
  const css = read('pvp/fx-damage.css');
  assert.match(css, /\.pxd-float\.pxd-leaving \.pxd-body \{ animation: none; opacity: 0; transition: opacity 140ms linear; \}/);
  const js = read('pvp/fx-damage.js');
  for (const k of ['crit:', 'shatter:', 'block:', 'counter:']) assert.ok(js.includes(k), k);
});

// ---- 2. 768 px üst şerit ---------------------------------------------------
test('601–1023 px: ad ve alt başlık tek satır + üç nokta; 900 px altında alt başlık gizli', () => {
  const css = read('pvp/fight-hud.css');
  const at = css.lastIndexOf('@media (min-width:601px) and (max-width:1023.98px)');
  assert.ok(at > 0);
  const block = css.slice(at, css.indexOf('\n}', at));
  assert.match(block, /\.fhud2-name\{[^}]*white-space:nowrap;overflow:hidden;text-overflow:ellipsis/);
  assert.match(block, /\.fhud2-char\{[^}]*white-space:nowrap;overflow:hidden;text-overflow:ellipsis/);
  const narrow = css.slice(css.lastIndexOf('@media (min-width:601px) and (max-width:899.98px)'));
  assert.match(narrow, /\.fhud2-char\{display:none\}/);
});

// ---- 3. Lobi portresi ------------------------------------------------------
test('lobi: giden portre anında kaybolur, gelen 200 ms ile belirir; 5 portre boşta önden yüklenir', async () => {
  const css = read('pvp/lobby-v3.css');
  const off = css.indexOf('#pvp-root .lb3.sc .sc-face{transition:none}');
  assert.ok(off > css.indexOf('#pvp-root .lb3.sc .sc-face{position:absolute'), 'eski geçiş kuralından sonra');
  assert.match(css.slice(off), /\[data-face="konyali"\]\{transition:opacity 200ms ease-out,transform 200ms ease-out\}/);
  const { preloadLobbyPortraits } = await import('../pvp/network.js').catch(() => ({}));
  if (!preloadLobbyPortraits) { assert.match(read('pvp/network.js'), /this\.open=true;this\.render\(\);preloadLobbyPortraits\(\);/); return; }
  const made = [];
  class FakeImage { constructor() { made.push(this); } decode() { return Promise.resolve(); } }
  const win = { setTimeout: fn => fn() };
  preloadLobbyPortraits({ win, ImageClass: FakeImage });
  preloadLobbyPortraits({ win, ImageClass: FakeImage });
  assert.equal(made.length, 5, 'bir kez, 5 portre');
  assert.ok(made.every(i => /portre-.*\.webp$/.test(i.src)));
});

// ---- 4. Ortak ses anahtarı -------------------------------------------------
function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { m, getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
}

test("ortak ses: 'tuslab-ses' önce okunur; yoksa eski PvP anahtarından taşınır; yazma on/off", () => {
  assert.equal(MASTER_SOUND_KEY, 'tuslab-ses');
  const fresh = memStorage();
  assert.equal(readMasterSound(fresh), true);
  assert.equal(fresh.m.get('tuslab-ses'), 'on');
  const legacy = memStorage({ [LEGACY_SFX_MUTED_KEY]: 'true' });
  assert.equal(readMasterSound(legacy), false);
  assert.equal(legacy.m.get('tuslab-ses'), 'off', 'eski değer taşındı');
  const both = memStorage({ 'tuslab-ses': 'on', [LEGACY_SFX_MUTED_KEY]: 'true' });
  assert.equal(readMasterSound(both), true, 'ortak anahtar önce gelir');
  writeMasterSound(both, false);
  assert.equal(both.m.get('tuslab-ses'), 'off');
});

test('ortak ses: storage olayında ve sayfa görünür olunca yeniden okunur', () => {
  const st = memStorage({ 'tuslab-ses': 'on' });
  const L = new Map();
  const target = () => ({ addEventListener: (t, f) => L.set(t, f), removeEventListener: t => L.delete(t) });
  const win = target(), doc = { hidden: false, ...target() };
  doc.addEventListener = (t, f) => L.set('doc:' + t, f);
  const seen = [];
  const w = watchMasterSound({ win, doc, storage: st, onChange: on => seen.push(on), initial: true });
  st.m.set('tuslab-ses', 'off');
  L.get('storage')({ key: 'başka' });
  assert.deepEqual(seen, []);
  L.get('storage')({ key: 'tuslab-ses' });
  assert.deepEqual(seen, [false]);
  st.m.set('tuslab-ses', 'on');
  L.get('doc:visibilitychange')();
  assert.deepEqual(seen, [false, true]);
  w.note(false); L.get('pageshow')();
  assert.deepEqual(seen, [false, true, true]);
  w.stop();
});

test('ortak ses: müzik ana kapıda susar ama kendi ayarı yazılmaz; pvp-main açılışta ve aç/kapa düğmesinde ortak anahtarı kullanır', () => {
  const st = memStorage();
  const music = createDynamicScore({ storage: st, AudioContextClass: undefined, fetcher: undefined });
  assert.equal(music.setMasterMuted(true), true);
  assert.equal(music.getState().masterOff, true);
  assert.equal(music.getState().muted, false);
  assert.equal(st.m.has('tuslab-pvp-music-muted'), false, 'müzik ayarı yazılmadı');
  music.setMasterMuted(false);
  assert.equal(music.getState().masterOff, false);
  const main = read('pvp/pvp-main.js');
  assert.match(main, /import \{readMasterSound,writeMasterSound,watchMasterSound\} from '\.\/master-sound\.js';/);
  assert.match(main, /\{const on=readMasterSound\(\);masterSoundWatch\.note\(on\);applyMasterSound\(on\);\}/);
  assert.match(main, /writeMasterSound\(undefined,!next\);masterSoundWatch\.note\(!next\);pvpMusic\.setMasterMuted\?\.\(next\);/);
  assert.doesNotMatch(main, /SESSİZ MOD: tek düğme müziği de keser/);
});

// ---- 5. Padişah kalıntısı: quote-bubble boşa yüklenmez ---------------------
test('quote-bubble.js statik içe aktarılmaz; yalnız sözü olan dövüşçü konuşunca dinamik yüklenir', () => {
  const sound = read('pvp/sound.js');
  assert.doesNotMatch(sound, /^import [^\n]*quote-bubble/m);
  assert.match(sound, /if\(text\)void import\('\.\/quote-bubble\.js'\)\.then\(m=>m\.showQuote\(fighterId,key,text\)\)/);
  for (const f of ['pvp/pvp-main.js', 'pvp/network.js', 'pvp/index.js']) assert.doesNotMatch(read(f), /^import [^\n]*quote-bubble/m, f);
});

// ---- 6. Geri tuşu koruması --------------------------------------------------
function fakeWin() {
  const L = new Map();
  const stack = [{ state: null }];
  let idx = 0;
  const history = {
    get state() { return stack[idx].state; },
    pushState(state) { stack.splice(idx + 1); stack.push({ state }); idx++; },
    back() { if (idx > 0) { idx--; queueMicrotask(() => fire()); } },
  };
  function fire() { let stopped = false; const e = { stopImmediatePropagation() { stopped = true; } }; L.get('popstate')?.(e); return stopped; }
  return { history, addEventListener: (t, f, cap) => { assert.equal(cap, true, 'yakalama aşaması'); L.set(t, f); }, removeEventListener: t => L.delete(t),
    userBack() { idx--; return fire(); }, depth: () => idx };
}

test('geri tuşu: canlı maçta onay kutusu açılır, koruma yeniden kurulur; maç bitince koruma geri alınır', async () => {
  const win = fakeWin();
  let live = true, asked = 0;
  const g = createBackGuard({ win, isLive: () => live, onBack: () => { asked++; } });
  g.sync();
  assert.equal(win.depth(), 1);
  assert.equal(win.history.state[BACK_GUARD_STATE], true);
  const stopped = win.userBack();
  assert.equal(asked, 1);
  assert.equal(stopped, true, 'ana sayfa yönlendiricisine ulaşmaz');
  assert.equal(win.depth(), 1, 'ikinci geri basış için yeniden kuruldu');
  live = false; g.sync();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(win.depth(), 0, 'koruma kaydı geri alındı');
  assert.equal(asked, 1, 'geri alma onay sormaz');
  // Maç yokken hiç kurulmaz.
  g.sync(); assert.equal(win.depth(), 0);
  const main = read('pvp/pvp-main.js');
  assert.match(main, /root\?\.addEventListener\('tuslab:pvp-match',\(\)=>backGuard\.sync\(\)\);/);
  assert.match(main, /store\.subscribe\(state=>\{if\(state\.view===PvPView\.CLOSED\)backGuard\.disarm\(\);\}\);/);
});

// ---- 7. Onay beklerken tuş tamponu -----------------------------------------
test('tampon: onay beklerken basılan harfler sırayla verilir; boşlukta yalnız ilk kelime gider', () => {
  assert.equal(pendingKeyAction({ key: 'a' }), 'char');
  assert.equal(pendingKeyAction({ key: 'ş' }), 'char');
  assert.equal(pendingKeyAction({ key: 'Backspace' }), 'backspace');
  assert.equal(pendingKeyAction({ key: 'a', ctrlKey: true }), null);
  assert.equal(pendingKeyAction({ key: 'Enter' }), null);
  assert.equal(pendingKeyAction({ key: 'a', isComposing: true }), null);
  assert.deepEqual(splitReplay('kale yol'), { now: 'kale ', rest: 'yol' });
  const b = createPendingBuffer();
  for (const k of [' ', 'k', 'a', 'x', 'Backspace', 'l', 'e', ' ', 'y', 'o']) b.push(k);
  assert.equal(b.value, 'kale yo', 'baştaki boşluk atıldı, Backspace uygulandı');
  assert.equal(b.takeChunk(), 'kale ');
  assert.equal(b.value, 'yo');
  assert.equal(b.takeChunk(), 'yo');
  assert.equal(b.size, 0);
  const main = read('pvp/pvp-main.js');
  assert.match(main, /if\(capturePendingKey\(event\)\)return;\s*redirectTypingKey\(event\);/);
  // Onayın geldiği üç yolda (anlık görüntü, kabul, ret) tampon boşaltılır; maç değişince ve kurtarmada temizlenir.
  assert.ok((main.match(/replayPendingKeys\((?:id|ownId)\)/g) || []).length >= 3);
  assert.ok((main.match(/pendingKeys\.clear\(\)/g) || []).length >= 2);
});
