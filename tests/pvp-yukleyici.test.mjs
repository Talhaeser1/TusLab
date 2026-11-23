// PvP yükleyicisi (docs/12-pvp-gecikmeli-yukleme.md): ana sayfada pvp-main.js ve ~60 bağımlılığı inmez.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPvpLoader, wantsPvp, warmAllowed, PVP_MAIN, WARM_DELAY_MS} from '../pvp/index.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

function fakeEnv({readyState = 'complete', connection} = {}) {
  const listeners = {};
  const timers = [];
  const idles = [];
  const head = [];
  const hint = {hidden: false};
  const doc = {
    readyState,
    head: {appendChild: el => head.push(el)},
    createElement: tag => ({tag}),
    getElementById: id => (id === 'pvp-loading' ? hint : null),
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
  };
  const winListeners = {};
  const win = {
    navigator: {connection},
    setTimeout: (fn, ms) => { timers.push({fn, ms}); return timers.length; },
    requestIdleCallback: fn => { idles.push(fn); return idles.length; },
    addEventListener: (type, fn) => { (winListeners[type] ||= []).push(fn); },
  };
  const fire = type => (listeners[type] || []).forEach(fn => fn({type}));
  return {doc, win, timers, idles, head, hint, fire, winListeners};
}

const tick = () => new Promise(r => setImmediate(r));

test('index.js küçük bir yükleyici: pvp-main.js ve bağımlılıklarını statik import etmez', () => {
  const src = read('pvp/index.js');
  assert.doesNotMatch(src, /^\s*import\s/m, 'statik import yok');
  assert.match(src, /import\(PVP_MAIN\)/);
  assert.equal(PVP_MAIN, './pvp-main.js');
  assert.ok(src.length < 8000, 'yükleyici küçük kalır');
  // index.html değişmedi: aynı giriş betiği
  assert.match(read('index.html'), /<script type="module" src="\.\/pvp\/index\.js"><\/script>/);
});

test('pvp-main.js eski gövdeyi taşır ve yükleyicinin açma kancasını dışa aktarır', () => {
  const main = read('pvp/pvp-main.js');
  assert.match(main, /import \{createPvPStore,PvPView\} from '\.\/state\.js';/);
  assert.match(main, /document\.addEventListener\('tuslab:pvp-enter',\(\)=>store\.dispatch\(\{type:'PVP_OPEN'\}\)\)/);
  assert.match(main, /export function openPvp\(\)\{store\.dispatch\(\{type:'PVP_OPEN'\}\);\}/);
});

test('wantsPvp: ?pvp= ve ?pvpRoom= PvP açar; diğerleri açmaz', () => {
  assert.equal(wantsPvp('?pvp=lobby'), true);
  assert.equal(wantsPvp('?pvp=practice&mode=rounds'), true);
  assert.equal(wantsPvp('?pvpRoom=ABC123'), true);
  assert.equal(wantsPvp(''), false);
  assert.equal(wantsPvp('?debug=1'), false);
  assert.equal(wantsPvp(undefined), false);
});

test('?pvp= adresinde pvp-main hemen yüklenir; ön ısıtma kurulmaz', async () => {
  const env = fakeEnv();
  let calls = 0;
  const loader = createPvpLoader({doc: env.doc, win: env.win, search: '?pvp=lobby', importMain: async () => { calls++; return {}; }, mainUrl: 'x'});
  assert.equal(calls, 1);
  await tick();
  assert.equal(loader.state().ready, true);
  assert.equal(env.timers.length, 0);
});

test('ana sayfada pvp-main inmez; tuslab:pvp-enter ilk kez gelince yüklenir ve PvP açılır', async () => {
  const env = fakeEnv();
  let calls = 0, opened = 0;
  const loader = createPvpLoader({doc: env.doc, win: env.win, search: '', importMain: async () => { calls++; return {openPvp: () => opened++}; }, mainUrl: 'x'});
  assert.equal(calls, 0, 'açılışta indirilmez');
  env.fire('tuslab:pvp-enter');
  env.fire('tuslab:pvp-enter'); // yükleme sürerken ikinci tık: tek import, tek açılış
  assert.equal(calls, 1);
  await tick();
  assert.equal(opened, 1);
  assert.equal(loader.state().ready, true);
  env.fire('tuslab:pvp-enter'); // artık pvp-main'in kendi dinleyicisi işler
  await tick();
  assert.equal(calls, 1);
  assert.equal(opened, 1);
});

test('yükleme hatasında ipucu gizlenir ve sonraki denemede yeniden yüklenir', async () => {
  const env = fakeEnv();
  let calls = 0;
  const origError = console.error; console.error = () => {};
  try {
    createPvpLoader({doc: env.doc, win: env.win, search: '', importMain: async () => { calls++; if (calls === 1) throw new Error('ağ'); return {openPvp() {}}; }, mainUrl: 'x'});
    env.fire('tuslab:pvp-enter');
    await tick();
    assert.equal(env.hint.hidden, true);
    env.fire('tuslab:pvp-enter');
    await tick();
    assert.equal(calls, 2);
  } finally { console.error = origError; }
});

test('ön ısıtma: yüklemeden ≥4 sn sonra boşta modulepreload; modül çalıştırılmaz', () => {
  const env = fakeEnv({readyState: 'loading'});
  let calls = 0;
  createPvpLoader({doc: env.doc, win: env.win, search: '', importMain: async () => { calls++; return {}; }, mainUrl: 'http://h/pvp/pvp-main.js'});
  assert.equal(env.timers.length, 0, 'load olayından önce zamanlayıcı yok');
  env.winListeners.load[0]();
  assert.equal(env.timers.length, 1);
  assert.ok(env.timers[0].ms >= 4000 && WARM_DELAY_MS >= 4000, 'ilk 3,5 sn ölçümüne girmez');
  env.timers[0].fn();
  assert.equal(env.head.length, 0, 'boşta olana kadar beklenir');
  env.idles[0]();
  assert.equal(env.head.length, 1);
  assert.equal(env.head[0].rel, 'modulepreload');
  assert.equal(env.head[0].href, 'http://h/pvp/pvp-main.js');
  assert.equal(calls, 0, 'modül çalıştırılmadı');
});

test('ön ısıtma veri tasarrufunda ve yavaş bağlantıda yapılmaz', () => {
  assert.equal(warmAllowed({}), true);
  assert.equal(warmAllowed({connection: {effectiveType: '4g'}}), true);
  assert.equal(warmAllowed({connection: {saveData: true, effectiveType: '4g'}}), false);
  assert.equal(warmAllowed({connection: {effectiveType: '3g'}}), false);
  assert.equal(warmAllowed({connection: {effectiveType: 'slow-2g'}}), false);
  const env = fakeEnv({connection: {saveData: true}});
  createPvpLoader({doc: env.doc, win: env.win, search: '', importMain: async () => ({}), mainUrl: 'x'});
  env.timers[0].fn(); env.idles[0]();
  assert.equal(env.head.length, 0);
});
