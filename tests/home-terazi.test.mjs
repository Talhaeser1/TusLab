// Terazi turu (23. iş, 24 Kas 2026): Performans panosu, kalan davranışlar (biten metin sayımı, Kelime'de Esc,
// sekme gizlenince süre durur) ve home/ temizliği. Küçük sahte DOM ile (home-typing-akis.test.mjs'teki gibi).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const js = read('home/home.js');
const css = read('home/home.css');

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attrs = {};
    this.style = { setProperty(k, v) { this[k] = String(v); } };
    this.dataset = {};
    this.listeners = {};
    this.value = '';
    this.readOnly = false;
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
  blur() {}
  scrollIntoView() {}
  all() { return [this, ...this.children.flatMap((c) => (c.all ? c.all() : []))]; }
  find(pred) { return this.all().find(pred); }
}
class Txt { constructor(t) { this.t = t; this.parentNode = null; } get nodeType() { return 3; } get textContent() { return this.t; } remove() { if (this.parentNode) { this.parentNode.children = this.parentNode.children.filter((c) => c !== this); this.parentNode = null; } } }

const docListeners = {};
globalThis.document = {
  hidden: false,
  createElement: (t) => new El(t),
  createTextNode: (t) => new Txt(t),
  getElementById: () => ({}), // stil zaten var say
  head: new El('head'),
  addEventListener: (t, f) => { (docListeners[t] ||= []).push(f); },
  removeEventListener: (t, f) => { docListeners[t] = (docListeners[t] || []).filter((x) => x !== f); },
};
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.getComputedStyle = () => ({ lineHeight: '30px', fontSize: '16px' });
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);

const { mountTyper, heatKeyboard } = await import('../home/typing.js');
const typeInto = (host, s) => {
  const ta = host.find((e) => e.tagName === 'TEXTAREA');
  for (const ch of s) { ta.value = ch; ta.dispatch('input'); }
};
const fireVis = (hidden) => { document.hidden = hidden; (docListeners.visibilitychange || []).forEach((f) => f({ type: 'visibilitychange' })); };

test('sekme gizlenince yazıcının süresi durur, dönünce kaldığı yerden sürer (WPM haksız düşmez)', () => {
  let T = 1000;
  const realNow = performance.now.bind(performance);
  Object.defineProperty(performance, 'now', { value: () => T, configurable: true, writable: true });
  try {
    const host = new El('div');
    const t = mountTyper(host, { text: 'abcdefghij', keyboard: false });
    typeInto(host, 'abc');
    T += 3000;
    fireVis(true);
    assert.equal(t.paused, true);
    T += 60000;   // sekme bir dakika gizli
    assert.equal(t.stats().elapsedMs, 3000, 'gizliyken süre artmamalı');
    fireVis(false);
    assert.equal(t.paused, false);
    T += 1000;
    assert.equal(t.stats().elapsedMs, 4000);
    typeInto(host, 'defghij');
    assert.equal(t.stats().elapsedMs, 4000, 'bitince süre donar');
    t.destroy();
    assert.equal((docListeners.visibilitychange || []).length, 0, 'destroy dinleyiciyi kaldırmalı');
  } finally {
    Object.defineProperty(performance, 'now', { value: realNow, configurable: true, writable: true });
    document.hidden = false;
  }
});

test('gizliyken gelen tuş duraklatmayı kaldırır; başlamamış yazıcı duraklamaz', () => {
  const host = new El('div');
  const t = mountTyper(host, { text: 'abcd', keyboard: false });
  fireVis(true);
  assert.equal(t.paused, false, 'yazı başlamadan süre yok');
  fireVis(false);
  typeInto(host, 'a');
  fireVis(true);
  assert.equal(t.paused, true);
  typeInto(host, 'b');
  assert.equal(t.paused, false);
  t.destroy();
  document.hidden = false;
});

test('ısı haritası klavyesi: aynı tuş dizilimi, hatalı tuş is-heat + --heat; Shift işareti kendi tuşuna yazılır', () => {
  const kb = heatKeyboard({ 'ş': 4, a: 2, '!': 1, ' ': 9 });
  assert.ok(kb.classList.contains('tl-kb') && kb.classList.contains('tl-kb--heat'));
  assert.equal(kb.getAttribute('aria-hidden'), 'true');
  const heat = kb.all().filter((e) => e.classList.contains('tl-key') && e.classList.contains('is-heat'));
  const label = (e) => e.textContent;
  assert.deepEqual(heat.map(label).sort(), ['1', 'A', 'Ş'].sort());
  assert.equal(heat.find((e) => label(e) === 'Ş').style['--heat'], '1');
  assert.equal(heat.find((e) => label(e) === 'A').style['--heat'], '0.5');
  assert.equal(heatKeyboard({}).all().filter((e) => e.classList.contains('is-heat')).length, 0);
});

test('Yazma: metin bitmeden çıkış "biten metin" ve metin görevlerini artırmaz; hız ≥ 20 harfle kaydedilir', () => {
  assert.match(js, /const complete = streamOn \? num\(s\.chunks\) >= 1 : num\(s\.total\) > 0 && num\(s\.typed\) >= num\(s\.total\);/);
  assert.match(js, /if \(!streamOn && complete\) \{ quests\.push\('daily'\);/);
  assert.match(js, /progress\(\{ quests, finished: complete, hist: true, accOk: complete, wpm, acc, mode: current\?\.mode, weak: s\.weakKeys \}\)/);
  // geçmiş artık "finished"ten bağımsız; %98 görevi bitmiş metin ister
  assert.match(js, /if \(hist && wpm > 0\) \{\s*d\.history\.push/);
  assert.match(js, /if \(acc >= 98 && accOk\) quests\.push\('acc98'\);/);
  assert.match(js, /'Metin bitmedi: hızın kaydedildi, biten metne sayılmadı'/);
});

test("Esc: Yazma'da yazı sürüyorsa (Kelime dahil) önce sonuç kartı, sonra Merkez", () => {
  assert.match(js, /function escView\(\) \{\s*if \(view && view\.id === 'yazma' && arenaCtl && resultEl\.hidden\) \{/);
  assert.match(js, /if \(e\.key === 'Escape' && view && !e\.defaultPrevented\) \{ e\.preventDefault\(\); escView\(\); \}/);
  assert.match(js, /if \(e\.key === 'Escape' && view && !root\.hidden && !pvpVisible\(\)\) \{ e\.preventDefault\(\); escView\(\); return; \}/);
});

test('Performans panosu: 12 sütun, kutu ailesi (.tl-box), boş/tek kayıt durumları, telefon tek sütun', () => {
  assert.match(js, /<div class="tl-edu tlh-pf">/);
  for (const c of ['tlh-pf-hero', 'tlh-pf-chart', 'tlh-pf-quests', 'tlh-pf-act', 'tlh-pf-keys', 'tlh-pf-recent', 'tlh-pf-badges']) {
    assert.match(js, new RegExp(`class="tl-box (?:tlh-pf-p )?${c}"`), c);
    assert.match(css, new RegExp(`#tl-home \\.${c} \\{`), c + ' CSS');
  }
  assert.match(css, /#tl-home \.tlh-pf \{ display: grid; grid-template-columns: repeat\(12, minmax\(0, 1fr\)\);/);
  assert.match(js, /Hız eğrin burada çizilecek\./);          // boş
  assert.match(js, /Bir yazış daha: eğilim çizilsin\./);     // tek kayıt
  assert.match(js, /Henüz yazış yok\./);
  assert.match(css, /#tl-home \.tlh-pf > \* \{ grid-column: 1 \/ -1 !important; grid-row: auto !important; \}/);
  // eski Performans parçaları kalmadı
  assert.doesNotMatch(js + css, /tlh-perf-|tlh-panel\b|tlh-badges|tlh-level-|weekHTML|accHTML|weakHTML/);
});

test('dört görünüm aynı başlık satırı ve içerik genişliği (1272 px); kaydırma çubuğu ortayı kaydırmaz', () => {
  assert.match(css, /padding: 10px max\(24px, calc\(\(100% - 1272px\) \/ 2\)\);/);
  assert.match(css, /#tl-home \.tlh-view-host \{ max-width: 1320px; margin: 0 auto; padding: 20px 24px 40px; \}/);
  assert.match(css, /scrollbar-gutter: stable both-edges;/);
  assert.doesNotMatch(css, /\.tlh-write \.tlh-view-top \{ padding-left/);
});

test('temizlik: kullanılmayan dosyalar ana koddan çıktı', () => {
  assert.ok(!existsSync(new URL('../home/scene3d.js', import.meta.url)), 'scene3d.js _to_delete/ altına taşınmalı');
  for (const f of ['kart-yazma.svg', 'kart-edebiyat.svg']) assert.ok(!existsSync(new URL('../assets/home/' + f, import.meta.url)), f);
});
