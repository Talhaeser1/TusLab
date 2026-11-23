// home/typing.js akış kipi (stream/onChunk/stop) ve home/literature.js oturumu — küçük sahte DOM ile.
import test from 'node:test';
import assert from 'node:assert/strict';

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

const { mountTyper } = await import('../home/typing.js');
const { mountLiterature } = await import('../home/literature.js');

const typeInto = (host, s) => {
  const ta = host.find((e) => e.tagName === 'TEXTAREA');
  for (const ch of s) {
    ta.value = ch;
    ta.dispatch('input');
  }
  return ta;
};

test('typing akış kipi: parça bitince sıradaki hemen gelir, istatistik sürer, Esc ile biter', async () => {
  const items = [{ text: 'ab c', id: 1 }, { text: 'de', id: 2 }, { text: 'fg', id: 3 }];
  let i = 0;
  const chunks = [];
  let finished = null;
  const host = new El('div');
  const t = mountTyper(host, {
    text: '',
    keyboard: false,
    stream: () => items[i++] || null,
    onChunk: (c) => chunks.push([c.index, c.item.id, c.done && c.done.id]),
    onFinish: (s) => { finished = s; },
  });
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(chunks[0], [0, 1, null]);
  typeInto(host, 'ab c');
  assert.deepEqual(chunks[1], [1, 2, 1]);
  assert.equal(finished, null, 'parça bitince oturum bitmemeli');
  typeInto(host, 'dx'); // x hatalı
  const s = t.stats();
  assert.equal(s.typed, 5);
  assert.equal(s.chunks, 1);
  assert.equal(s.errors, 1);
  const ta = host.find((e) => e.tagName === 'TEXTAREA');
  const ev = ta.dispatch('keydown', { key: 'Escape' });
  assert.ok(ev.defaultPrevented, 'Esc ana sayfaya sızmamalı');
  assert.ok(finished, 'Esc oturumu bitirmeli');
  assert.equal(finished.chunks, 1);
  assert.equal(finished.typed, 5);
  t.destroy();
});

test('typing akış kipi: akış biterse oturum kendiliğinden biter; düz kip değişmedi', () => {
  let n = 0;
  let fin = null;
  const host = new El('div');
  mountTyper(host, { text: '', keyboard: false, stream: () => (n++ < 2 ? 'ab' : null), onFinish: (s) => { fin = s; } });
  typeInto(host, 'abab');
  assert.ok(fin);
  assert.equal(fin.chunks, 2);
  assert.equal(fin.total, 4);
  let plain = null;
  const h2 = new El('div');
  mountTyper(h2, { text: 'xy', keyboard: false, onFinish: (s) => { plain = s; } });
  typeInto(h2, 'xy');
  assert.equal(plain.typed, 2);
  assert.equal(plain.chunks, 0);
  assert.ok(!h2.find((e) => e.classList.contains('tl-typer-stop')), 'düz kipte Bitir düğmesi olmamalı');
});

test('Şiir & Atasözü: liste yok, her kategori tek düğme; oturum kesintisiz akar, Bitir sonrası tek özet', async () => {
  const saved = {};
  const host = new El('div');
  const ctx = { back() {}, sfx: {}, save: (o) => Object.assign(saved, o), load: () => saved, toast() {} };
  const m = mountLiterature(host, ctx);
  const cats = host.all().filter((e) => e.classList.contains('tl-lit-cat'));
  assert.equal(cats.length, 5);
  assert.ok(!host.find((e) => e.classList.contains('tl-item')), 'eski seçme listesi kalmamalı');
  cats.find((c) => c.dataset.cat === 'atasozu').dispatch('click');
  await new Promise((r) => setTimeout(r, 5));
  const textOf = () => host.find((e) => e.classList.contains('tl-typer-text')).textContent;
  const src = () => host.find((e) => e.classList.contains('tl-lit-src')).textContent;
  assert.match(src(), /Atasözü/);
  const seen = [];
  for (let k = 0; k < 3; k++) {
    const t = textOf();
    seen.push(t);
    typeInto(host, t);
  }
  assert.equal(new Set(seen).size, 3, 'aynı metin tekrar geldi');
  assert.ok(host.find((e) => e.classList.contains('tl-typer-text')), 'parçalar arasında özet ekranı çıkmamalı');
  assert.equal(host.all().filter((e) => e.tagName === 'LI').length, 3, 'son yazılanlar listesi');
  host.find((e) => e.classList.contains('tl-typer-stop')).dispatch('click');
  await new Promise((r) => setTimeout(r, 5));
  assert.match(host.textContent, /Oturum bitti/);
  assert.equal(saved.litStreams.atasozu.runs, 1);
  assert.equal(saved.litStreams.atasozu.items, 3);
  m.destroy();
});
