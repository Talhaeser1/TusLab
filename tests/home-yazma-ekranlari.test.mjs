// Hoca (24 Kas 2026): üç yazma ekranı (Yazma, Klavye Dersleri, Şiir & Atasözü) ortak düzeni, ders haritası, sonuç
// ekranları, ekran klavyesi tercihi ve tuş başına maliyet kuralları.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const js = read('home/home.js');
const css = read('home/home.css');
const edu = read('home/egitim.css');
const typing = read('home/typing.js');
const lessons = read('home/lessons.js');
const lit = read('home/literature.js');

// --- küçük sahte DOM (statsHost ve klavye için) ---
class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attrs = {};
    this.style = {};
    this.dataset = {};
    this.listeners = {};
    this.value = '';
    this.hidden = false;
    this._text = '';
    this.offsetLeft = 0; this.offsetTop = 0; this.offsetWidth = 10; this.offsetHeight = 20;
    const cls = new Set();
    this.classList = {
      add: (...c) => c.forEach((x) => cls.add(x)), remove: (...c) => c.forEach((x) => cls.delete(x)),
      toggle: (c, on) => ((on ?? !cls.has(c)) ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c),
    };
    Object.defineProperty(this, 'className', { get: () => [...cls].join(' '), set: (v) => { cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => cls.add(x)); } });
  }
  get nodeType() { return 1; }
  get firstChild() { return this.children[0] || null; }
  set textContent(v) { this.children = []; this._text = String(v); }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  append(...k) { k.forEach((c) => { if (c.parentNode) c.remove(); c.parentNode = this; this.children.push(c); }); }
  appendChild(c) { this.append(c); return c; }
  replaceChildren(...k) { this.children.forEach((c) => { c.parentNode = null; }); this.children = []; this._text = ''; this.append(...k); }
  remove() { if (this.parentNode) { this.parentNode.children = this.parentNode.children.filter((c) => c !== this); this.parentNode = null; } }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter((x) => x !== f); }
  dispatch(t, ev = {}) { const e = { type: t, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...ev }; (this.listeners[t] || []).forEach((f) => f(e)); return e; }
  focus() {}
  scrollIntoView() {}
  all() { return [this, ...this.children.flatMap((c) => (c.all ? c.all() : []))]; }
  find(pred) { return this.all().find(pred); }
}
class Txt { constructor(t) { this.data = t; this.parentNode = null; } get nodeType() { return 3; } get textContent() { return this.data; } remove() { if (this.parentNode) { this.parentNode.children = this.parentNode.children.filter((c) => c !== this); this.parentNode = null; } } }
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.document = {
  createElement: (t) => new El(t), createTextNode: (t) => new Txt(t), getElementById: () => ({}), head: new El('head'),
  addEventListener() {}, removeEventListener() {}, activeElement: null,
};
globalThis.window = { innerWidth: 1440, innerHeight: 900, addEventListener() {}, removeEventListener() {} };
globalThis.getComputedStyle = () => ({ lineHeight: '30px', fontSize: '16px' });
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);

const T = await import('../home/typing.js');

test('ekran klavyesi tercihi: kalıcı (tuslab-home-kb), yoksa geniş ekranda açık, dar/kısa ekranda hiç', () => {
  store.clear();
  assert.equal(T.kbPref(), null);
  assert.equal(T.kbWanted(), true, 'tercih yokken geniş ekranda açık');
  T.setKbPref(false);
  assert.equal(store.get('tuslab-home-kb'), '0');
  assert.equal(T.kbWanted(), false);
  T.setKbPref(true);
  assert.equal(T.kbWanted(), true);
  window.innerWidth = 390; window.innerHeight = 844;
  assert.equal(T.kbWanted(), false, 'telefonda ekran klavyesi yok');
  window.innerWidth = 1280; window.innerHeight = 600;
  assert.equal(T.kbWanted(), false, '620 px altı yükseklikte yok');
  window.innerWidth = 1280; window.innerHeight = 720;
  assert.equal(T.kbWanted(), true, '1280×720 klavye sığar');
  window.innerWidth = 1440; window.innerHeight = 900;
});

test('kbToggle: düğme etiketi ve aria-pressed tercihi izler, tıklama kaydeder ve yazıcıya uygular', () => {
  store.clear();
  const got = [];
  const b = T.kbToggle((on) => got.push(on));
  assert.equal(b.textContent, 'Klavye: açık');
  assert.equal(b.getAttribute('aria-pressed'), 'true');
  b.dispatch('click');
  assert.equal(store.get('tuslab-home-kb'), '0');
  assert.equal(b.textContent, 'Klavye: kapalı');
  assert.equal(b.getAttribute('aria-pressed'), 'false');
  b.dispatch('click');
  assert.deepEqual(got, [false, true]);
});

test('üç ekran aynı tercihi kullanır (Yazma, dersler, Şiir & Atasözü)', () => {
  assert.match(lessons, /keyboard: kbWanted\(\)/);
  assert.match(lit, /keyboard: kbWanted\(\)/);
  assert.doesNotMatch(lessons, /let kbOn/);
  assert.doesNotMatch(lit, /let kbOn/);
  assert.match(js, /kbWantedFn = typing\.kbWanted/);
  assert.match(js, /typing\.kbToggle\(/);
  assert.match(js, /class="tlh-arena-acts tl-edu"/);
});

test('yazıcı: statsHost verilirse sayaç şeridi başlık satırına taşınır, destroy ile kalkar', () => {
  const host = new El('div');
  const sh = new El('div');
  const t = T.mountTyper(host, { text: 'ab', keyboard: false, statsHost: sh });
  assert.ok(sh.children[0] && sh.children[0].classList.contains('tl-typer-stats'));
  assert.ok(!host.find((e) => e !== sh.children[0] && e.classList.contains('tl-typer-stats')), 'şerit iki yerde olmamalı');
  assert.ok(host.find((e) => e.classList.contains('has-ext-stats')));
  t.destroy();
  assert.equal(sh.children.length, 0);
});

test('ekran klavyesi: Türkçe Q, rakam sırası parmak renkli, Shift işaretleri ve serçe renkli Shift', () => {
  store.clear();
  const host = new El('div');
  const t = T.mountTyper(host, { text: 'Ali!', keyboard: true });
  const keys = host.all().filter((e) => e.classList.contains('tl-key'));
  const label = (k) => k.children.find((c) => c.nodeType === 3)?.data ?? k._text;
  const byLabel = (s) => keys.find((k) => label(k) === s);
  // Türkçe Q sıraları
  const rows = host.all().filter((e) => e.classList.contains('tl-kb-row'));
  assert.equal(rows[1].children.map(label).join(''), 'QWERTYUIOPĞÜ');
  assert.equal(rows[2].children.map(label).join(''), 'ASDFGHJKLŞİ,');
  assert.equal(rows[3].children.map(label).join(''), '<ZXCVBNMÖÇ.');
  // rakamlar parmak renginde, Shift işareti köşede
  assert.ok(byLabel('1').classList.contains('f-L5'));
  assert.ok(byLabel('8').classList.contains('f-R3'));
  assert.equal(byLabel('1').children.find((c) => c.classList && c.classList.contains('tl-key-s')).textContent, '!');
  // "A": büyük harf → a tuşu + karşı el (sağ) Shift; Shift serçe renginde
  const next = keys.filter((k) => k.classList.contains('is-next'));
  assert.deepEqual(next.map(label).sort(), ['A', 'Shift ⇧'].sort());
  assert.ok(next.find((k) => label(k) === 'Shift ⇧').classList.contains('f-R5'));
  t.destroy();
});

test('tuş başına: geri bildirim için düzen okuması yok (offsetWidth ile animasyon yeniden başlatma kaldırıldı)', () => {
  const flash = typing.slice(typing.indexOf('function flashKey('), typing.indexOf('function setKeyboard('));
  assert.doesNotMatch(flash, /offsetWidth|getBoundingClientRect|offsetHeight/);
  const hc = typing.slice(typing.indexOf('function handleChar('), typing.indexOf('function backspace('));
  assert.doesNotMatch(hc, /void root\.offsetWidth/);
  assert.match(hc, /shakeT = setTimeout/);
  // metin tuş başına yeniden çizilmez: renderText yalnız kurulum ve yeni parçada
  assert.equal((typing.match(/renderText\(\)/g) || []).length, 3, 'tanım + kurulum + akışta yeni parça');
});

test('ders yıldız eşikleri: bir üst yıldız için gereken hız/doğruluk rate() ile aynı', async () => {
  const L = await import('../home/lessons.js');
  const lesson = { goalWpm: 20, goalAcc: 95 };
  assert.deepEqual(L.nextStarGoal(lesson, 0), { stars: 1, wpm: 20, acc: 95 });
  const g2 = L.nextStarGoal(lesson, 1);
  assert.deepEqual(g2, { stars: 2, wpm: 26, acc: 97 });
  assert.equal(L.rate(lesson, { wpm: g2.wpm, acc: g2.acc }).stars, 2);
  const g3 = L.nextStarGoal(lesson, 2);
  assert.equal(L.rate(lesson, { wpm: g3.wpm, acc: g3.acc }).stars, 3);
  assert.equal(L.nextStarGoal(lesson, 3), null);
});

test('ders haritası: yol görünümü, durumlar, geçerli derse kaydırma ve klavyeyle gezinme', () => {
  assert.match(lessons, /class: 'tl-route'/);
  assert.match(lessons, /'is-locked' : stars >= 3 \? 'is-gold' : stars > 0 \? 'is-done' : cur \? 'is-cur' : 'is-open'/);
  assert.match(lessons, /'aria-current': cur \? 'step' : null/);
  // tek sekme durağı + oklar/Home/End
  assert.match(lessons, /setAttribute\('tabindex', x\.btn === btn \? '0' : '-1'\)/);
  for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End']) assert.ok(lessons.includes("'" + k + "'"), k);
  assert.match(lessons, /b\.scrollIntoView\(\{ block: 'center' \}\)/);
  assert.match(lessons, /tl-map-jump/);
  assert.match(edu, /\.tl-edu \.tl-node\.is-cur \.tl-node-dot \{/);
  assert.match(edu, /\.tl-edu \.tl-node-btn:focus-visible \{ outline: 3px solid var\(--acc\)/);
  // eski kart ızgarası kalmadı
  assert.doesNotMatch(edu + lessons, /tl-lcard|tl-lgrid/);
});

test('sonuç ekranları: hedefe göre durum, sonraki/tekrar/Merkez, birincil düğme odakta', () => {
  assert.match(lessons, /'✓ hedef ' : '✗ hedef '/);
  assert.match(lessons, /'Sonraki ders →'/);
  assert.match(lessons, /'Tekrar'/);
  assert.match(lessons, /'Merkez'\)/);
  assert.match(lessons, /focusFirst\(card\)/);
  assert.match(lit, /'Merkez'\) : null/);
  assert.match(lit, /next\.focus\(\{ preventScroll: true \}\)/);
  assert.match(js, /Rekorun <b>\$\{prevBest\}<\/b> WPM/);
  assert.match(js, /data-tlh="back">Merkez <kbd>Esc<\/kbd>/);
  // kutlama abartısız
  assert.match(js, /if \(!short && \(record \|\| \(acc >= 92 && wpm >= 30\)\)\) confetti\(\);/);
  assert.match(js, /Array\.from\(\{ length: 70 \}/);
  assert.match(edu, /@keyframes tl-star-in/);
});

test('ortak düzen CSS: kutu ailesi, kaydırmasız ölçek, telefonda klavye gizli, azaltılmış hareket', () => {
  assert.match(edu, /\.tl-edu \.tl-box,\s*\.tl-edu \.tl-typer-box,\s*\.tl-edu \.tl-kb \{/);
  assert.match(edu, /\.tl-edu \.tl-box::before, \.tl-edu \.tl-typer-box::before \{/);
  assert.match(edu, /--u: clamp\(26px, 5\.2vh, 54px\)/);
  assert.match(edu, /@media \(max-width: 699px\) \{\s*\.tl-edu\.tl-typer \.tl-kb-wrap, \.tl-edu \.tl-kbtoggle \{ display: none; \}/);
  assert.match(edu, /@media \(max-height: 619px\) \{\s*\.tl-edu\.tl-typer \.tl-kb-wrap \{ display: none; \}/);
  assert.match(edu, /\.tl-edu \.tl-ws:has\(\.tl-typer\.is-focused\) \.tl-ws-new/);
  assert.match(edu, /@media \(prefers-reduced-motion: reduce\) \{[^}]*animation: none !important;[^}]*\}\s*\.tl-edu \.tl-node-btn:hover \.tl-node-body/);
  assert.match(css, /#tl-home \.tlh-view-host:has\(\.tl-ws\) \{/);
  // görünüm katmanında backdrop-filter yok (altı durağan)
  const view = css.slice(css.indexOf('#tl-home .tlh-view {'), css.indexOf('#tl-home .tlh-view-top {'));
  assert.doesNotMatch(view, /backdrop-filter/);
  // görünür yazı ≥ 12 px: egitim.css'te 12 px altı sabit yazı yok
  for (const m of edu.matchAll(/font-size: (\d+(?:\.\d+)?)px/g)) assert.ok(Number(m[1]) >= 12, 'font-size ' + m[1] + 'px');
  assert.doesNotMatch(edu, /font-size: \.(?:[0-6]\d*|7[0-4]?)rem/);
});
