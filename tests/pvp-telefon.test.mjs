// Telefoncu (docs/24): telefon / dar ekran — ekran klavyesi, dokunma, yığılma bağlamı, cihaz kalite kademesi.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {keyboardLayout, isTypingPanelTap, installPhoneViewport, KB_MIN_PX, KB_TIGHT_PX, KB_SHORT_PX,
  KB_OPEN_CLASS, KB_TIGHT_CLASS, KB_SHORT_CLASS} from '../pvp/phone-viewport.js';
import {deviceStartStep, readDeviceHints} from '../pvp/perf-governor.js';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const block = (file, marker) => { const css = read(file); const i = css.indexOf(marker); assert.ok(i > 0, `${file}: ${marker}`); return css.slice(i); };

test('klavye kararı: yalnız yazarken ve görsel alan ≥ 120 px küçülünce açık; 440 / 300 eşikleri', () => {
  assert.equal(keyboardLayout({fullHeight: 844, vvHeight: 470, typing: false}).open, false);
  assert.equal(keyboardLayout({fullHeight: 844, vvHeight: 844 - KB_MIN_PX + 1, typing: true}).open, false, 'adres çubuğu oynaması');
  const kb = keyboardLayout({fullHeight: 844, vvHeight: 470.4, vvTop: 12.6, typing: true});
  assert.deepEqual(kb, {open: true, tight: false, short: false, top: 13, height: 470});
  assert.equal(keyboardLayout({fullHeight: 667, vvHeight: KB_SHORT_PX - 60, typing: true}).short, true);
  const land = keyboardLayout({fullHeight: 390, vvHeight: 190, typing: true});
  assert.equal(land.open && land.tight && land.short, true);
  assert.ok(KB_TIGHT_PX < KB_SHORT_PX);
  assert.equal(keyboardLayout({fullHeight: 0, vvHeight: 300, typing: true}).open, false);
});

test('yazma paneline dokunma: kelime alanı evet; düğme, giriş, panel dışı hayır', () => {
  const el = (inside, interactive) => ({closest: sel => (sel === '.tt' ? inside : interactive)});
  assert.equal(isTypingPanelTap(el({}, null)), true);
  assert.equal(isTypingPanelTap(el({}, {})), false, 'düğme/giriş');
  assert.equal(isTypingPanelTap(el(null, null)), false, 'panel dışı');
  assert.equal(isTypingPanelTap({parentElement: el({}, null)}), true, 'metin düğümü');
  assert.equal(isTypingPanelTap(null), false);
});

function fakeDom({coarse = true} = {}) {
  const listeners = {};
  const on = target => (type, fn) => { (listeners[`${target}:${type}`] ||= []).push(fn); };
  const off = target => (type, fn) => { listeners[`${target}:${type}`] = (listeners[`${target}:${type}`] || []).filter(f => f !== fn); };
  const fire = (key, ev = {}) => (listeners[key] || []).forEach(f => f(ev));
  const classes = new Set();
  const props = new Map();
  const input = {disabled: false, focused: 0, getClientRects: () => [1], focus() { this.focused++; doc.activeElement = input; }, matches: s => s.includes('input')};
  const doc = {body: {}, activeElement: null};
  const root = {
    ownerDocument: doc, scrollTop: 40,
    classList: {toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), remove: (...c) => c.forEach(x => classes.delete(x)), contains: c => classes.has(c)},
    style: {setProperty: (k, v) => props.set(k, v), removeProperty: k => props.delete(k)},
    contains: n => n === input, querySelector: s => (s === '#tt-input' ? input : null),
    addEventListener: on('root'), removeEventListener: off('root'),
  };
  const vv = {height: 844, offsetTop: 0, addEventListener: on('vv'), removeEventListener: off('vv')};
  const env = {visualViewport: vv, innerWidth: 390, innerHeight: 844, matchMedia: () => ({matches: coarse}),
    addEventListener: on('win'), removeEventListener: off('win'), setTimeout: () => 0, document: doc};
  return {root, vv, env, input, doc, classes, props, fire};
}

test('installPhoneViewport: klavye açılınca kök görsel alana oturur, kapanınca geri döner; dokununca odak', () => {
  const d = fakeDom();
  const h = installPhoneViewport(d.root, d.env);
  d.input.focus(); d.fire('root:focusin');
  d.vv.height = 470; d.vv.offsetTop = 0; d.fire('vv:resize');
  assert.ok(d.classes.has(KB_OPEN_CLASS));
  assert.equal(d.classes.has(KB_TIGHT_CLASS), false);
  assert.equal(d.props.get('--pvp-vv-h'), '470px');
  assert.equal(d.root.scrollTop, 0, 'kök başa kayar');
  d.vv.height = 380; d.fire('vv:resize');
  assert.ok(d.classes.has(KB_SHORT_CLASS));
  d.doc.activeElement = d.doc.body; d.vv.height = 844; d.fire('root:focusout');
  assert.equal(d.classes.has(KB_OPEN_CLASS), false);
  assert.equal(d.props.has('--pvp-vv-h'), false);
  // panele dokun → odak
  const before = d.input.focused;
  d.fire('root:click', {target: {closest: s => (s === '.tt' ? {} : null)}});
  assert.equal(d.input.focused, before + 1);
  d.fire('root:click', {target: {closest: () => ({})}}); // düğmeye dokunma
  assert.equal(d.input.focused, before + 1);
  h.destroy();
  assert.equal(d.classes.size, 0);
});

test('installPhoneViewport: fare/masaüstünde (pointer: fine) klavye düzeni hiç açılmaz', () => {
  const d = fakeDom({coarse: false});
  installPhoneViewport(d.root, d.env);
  d.input.focus(); d.vv.height = 300; d.fire('vv:resize');
  assert.equal(d.classes.has(KB_OPEN_CLASS), false);
});

test('cihaz kademesi: telefon bloom kapalı başlar, zayıf telefon çözünürlüğü de düşük; masaüstü 0', () => {
  assert.equal(deviceStartStep({coarse: true, shortSide: 390, cores: 8, memoryGb: 8}), 1);
  assert.equal(deviceStartStep({coarse: true, shortSide: 360, cores: 4, memoryGb: 0}), 2);
  assert.equal(deviceStartStep({coarse: true, shortSide: 390, cores: 8, memoryGb: 3}), 2);
  assert.equal(deviceStartStep({coarse: true, shortSide: 768, cores: 8, memoryGb: 8}), 0, 'tablet');
  assert.equal(deviceStartStep({coarse: false, shortSide: 390, cores: 2}), 1, 'çok zayıf');
  assert.equal(deviceStartStep({coarse: false, shortSide: 1080, cores: 12, memoryGb: 8}), 0);
  assert.equal(deviceStartStep(), 0);
  assert.deepEqual(readDeviceHints({}), {coarse: false, shortSide: 0, cores: 0, memoryGb: 0});
  assert.deepEqual(readDeviceHints({navigator: {hardwareConcurrency: 6, deviceMemory: 4}, screen: {width: 390, height: 844}, matchMedia: () => ({matches: true})}),
    {coarse: true, shortSide: 390, cores: 6, memoryGb: 4});
  const a3 = read('pvp/arena3d.js');
  assert.match(a3, /deviceStartStep\(readDeviceHints\(env\)\)/);
  assert.match(a3, /mode === 'auto'\) governor\.setStep\(softwareRenderer \? AUTO_QUALITY\.lowStep : deviceStep\)/, "elle 'auto'ya dönüş cihaz kademesine");
});

test('CSS: alt sayfa yığılma düzeltmesi, yatay lobi, sonuç kartları, dokunma ve klavye kuralları', () => {
  const lobby = block('pvp/lobby-v3.css', 'TELEFONCU (docs/24)');
  assert.match(lobby, /\[data-sheet="skills"\] \.j2-info\{animation:none\}/);
  assert.match(lobby, /orientation:landscape\) and \(max-height:500px\)/);
  const res = block('pvp/results-v2.css', 'TELEFONCU (docs/24)');
  assert.match(res, /\.pvp15-scorecards\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  const ch = block('pvp/compact-height.css', 'TELEFONCU (docs/24)');
  assert.match(ch, /#pvp-root\{overscroll-behavior:none;touch-action:manipulation/);
  assert.match(ch, /#pvp17-input[^}]*\{font-size:16px\}/);
  assert.match(ch, /#pvp-root\.pvp-kb-open\{top:var\(--pvp-vv-top,0px\);bottom:auto;height:var\(--pvp-vv-h,100%\)/);
  assert.match(ch, /min-height:44px;height:44px;min-width:44px/);
  for (const css of [lobby, res, ch]) {
    assert.doesNotMatch(css, /backdrop-filter|infinite|will-change/);
    for (const m of css.matchAll(/font-size:(\d+)px/g)) assert.ok(Number(m[1]) >= 12, m[0]);
  }
});

test('pvp-main: telefon modülü kurulur; yazma kutusunda otomatik büyük harf/düzeltme kapalı', () => {
  const main = read('pvp/pvp-main.js');
  assert.match(main, /import \{installPhoneViewport\} from '\.\/phone-viewport\.js'/);
  assert.match(main, /installPhoneViewport\(root\);/);
  const tag = main.match(/<input class="tt-input"[^>]*>/)?.[0] || '';
  for (const a of ['spellcheck="false"', 'autocomplete="off"', 'autocorrect="off"', 'autocapitalize="off"', 'enterkeyhint="send"']) assert.ok(tag.includes(a), a);
});
