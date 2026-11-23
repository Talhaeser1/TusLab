// Açılış yükü (docs/6-acilis-hizlandirma.md): ana sayfa açılırken PvP portreleri ve eski site görselleri inmez.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {attachCinematic} from '../pvp/cinematic.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

function withGlobals(fn) {
  const saved = {Image: globalThis.Image, MO: globalThis.MutationObserver, ric: globalThis.requestIdleCallback, cic: globalThis.cancelIdleCallback};
  const made = [];
  const observers = [];
  globalThis.Image = class { constructor() { made.push(this); } };
  globalThis.MutationObserver = class {
    constructor(cb) { this.cb = cb; this.on = false; observers.push(this); }
    observe() { this.on = true; }
    disconnect() { this.on = false; }
  };
  const idles = [];
  globalThis.requestIdleCallback = cb => { idles.push(cb); return idles.length; };
  globalThis.cancelIdleCallback = () => {};
  try { return fn({made, observers, idles}); } finally {
    globalThis.Image = saved.Image; globalThis.MutationObserver = saved.MO;
    globalThis.requestIdleCallback = saved.ric; globalThis.cancelIdleCallback = saved.cic;
  }
}
const fakeRoot = hidden => ({hidden, addEventListener() {}, removeEventListener() {}, classList: {contains: () => false, add() {}, remove() {}}, appendChild() {}});
const doc = {createElement: () => ({setAttribute() {}, append() {}, classList: {add() {}, remove() {}}, style: {}})};
const sched = {setTimeout: () => 0, clearTimeout() {}};

test('gizli #pvp-root: VS portreleri ana sayfada önden indirilmez, PvP görünür olunca boşta ısınır', () => {
  withGlobals(({made, observers, idles}) => {
    const root = fakeRoot(true);
    const cin = attachCinematic({root, doc, scheduler: sched});
    assert.equal(idles.length, 0, 'gizliyken boşta-ısınma kurulmaz');
    assert.equal(made.length, 0);
    assert.equal(observers.length, 1);
    observers[0].cb([]); // hâlâ gizli
    assert.equal(idles.length, 0);
    root.hidden = false; observers[0].cb([]);
    assert.equal(observers[0].on, false, 'gözlemci bir kez çalışıp kapanır');
    assert.equal(idles.length, 1);
    idles[0]();
    assert.ok(made.length >= 5, 'portreler PvP açılınca ısınır');
    cin.destroy();
  });
});

test('görünür kökle (ör. ?pvp=lobby sonrası) ısınma eskisi gibi hemen boşta kurulur; destroy gözlemciyi kapatır', () => {
  withGlobals(({observers, idles}) => {
    attachCinematic({root: fakeRoot(false), doc, scheduler: sched});
    assert.equal(observers.length, 0);
    assert.equal(idles.length, 1);
  });
  withGlobals(({observers}) => {
    const cin = attachCinematic({root: fakeRoot(true), doc, scheduler: sched});
    cin.destroy();
    assert.equal(observers[0].on, false);
  });
});

test('eski site (#app) görselleri ana sayfa açılışında inmez; davranış sınıfla geri açılabilir', () => {
  const css = read('exact-ui.css');
  assert.match(css, /html:not\(\.tlh-legacy\) body\{background-image:none!important\}/);
  assert.match(css, /html:not\(\.tlh-legacy\) #app \*,html:not\(\.tlh-legacy\) #app \*::before,html:not\(\.tlh-legacy\) #app \*::after\{background-image:none!important\}/);
  assert.match(css, /html:not\(\.tlh-legacy\) #app img\[loading="lazy"\]\{display:none!important\}/);
  const app = read('app.js');
  const imgs = app.match(/<img [^>]*>/g) || [];
  assert.ok(imgs.length >= 3);
  for (const tag of imgs) assert.match(tag, /loading="lazy"/, tag);
});

test('index.html değişmedi: PvP girişi hâlâ tek modül betiği', () => {
  const html = read('index.html');
  assert.match(html, /<script type="module" src="\.\/pvp\/index\.js"><\/script>/);
});
