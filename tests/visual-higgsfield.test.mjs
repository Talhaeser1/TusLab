import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync, existsSync} from 'node:fs';
import vm from 'node:vm';

const dir = new URL('../assets/higgsfield/final/', import.meta.url);
const css = readFileSync(new URL('../visual-enrich.css', import.meta.url), 'utf8');
const js = readFileSync(new URL('../visual-enrich.js', import.meta.url), 'utf8');

test('higgsfield: css ve js yalnız var olan, boyut sınırındaki webp dosyalarına bağlanır', () => {
  const names = new Set([...css.matchAll(/higgsfield\/final\/([a-z-]+)\.webp/g)].map(m => m[1]));
  for (const side of ['ates', 'run']) for (const kind of ['vurus', 'kivilcim', 'ulti']) names.add(`efekt-${side}-${kind}`);
  assert.ok(names.size >= 20, `bağlanan görsel sayısı: ${names.size}`);
  for (const name of names) {
    const file = new URL(`${name}.webp`, dir);
    assert.ok(existsSync(file), `${name}.webp var`);
    const limit = name.startsWith('portre') ? 150 : name.startsWith('efekt') ? 90 : 300;
    assert.ok(statSync(file).size <= limit * 1024, `${name} ≤ ${limit} KB`);
  }
});

test('higgsfield: ham deneme görselleri yayına girmez, sahne arka planları eşlenir', () => {
  const build = readFileSync(new URL('../cloudflare/build-assets.mjs', import.meta.url), 'utf8');
  assert.ok(build.includes('higgsfield[\\\\/]deneme'), 'deneme klasörü yayın filtresinde');
  const stages = readFileSync(new URL('../pvp/stages3d.js', import.meta.url), 'utf8');
  for (const id of ['colosseum', 'skyforge', 'runegarden', 'harbor']) assert.match(stages, new RegExp(`${id}: 'arena-`));
});

test('higgsfield: vuruş görseli seçimi kademeye ve tarafa göre', () => {
  const listeners = {};
  const sandbox = {window: {}, document: {addEventListener: (type, fn) => { listeners[type] = fn; }}, Image: class {}, setTimeout};
  vm.runInNewContext(js, sandbox);
  const pick = sandbox.window.__veImpactPick;
  assert.equal(pick({fromSeat: 1, amount: 40}).file, 'efekt-ates-vurus');
  assert.equal(pick({fromSeat: 2, amount: 40}).file, 'efekt-run-vurus');
  assert.equal(pick({fromSeat: 2, skill: 'r', amount: 140}).file, 'efekt-run-ulti');
  assert.equal(pick({fromSeat: 1, blocked: true, amount: 0}).file, 'efekt-ates-kivilcim');
  assert.ok(pick({fromSeat: 1, critical: true, amount: 60}).size > pick({fromSeat: 1, amount: 60}).size);
  assert.equal(pick({fromSeat: 1, amount: 0}), null);
  assert.ok(listeners['tuslab:pvp-impact'], 'vuruş olayı dinleniyor');
});
