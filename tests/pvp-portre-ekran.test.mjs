import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {vsModel} from '../pvp/cinematic.js';
import {PORTRAITS, portraitFor, PORTRAIT_FALLBACK} from '../pvp/portraits.js';
import {resultCardHTML} from '../pvp/phase15-results.js';
import {summaryPlayers} from '../pvp/rounds-ui.js';
import {FIGHTER_IDS, FIGHTERS} from '../pvp/shared/fighters.js';

const EXPECT = {
  vargr: 'assets/higgsfield/final/portre-vargr.webp',
  sira: 'assets/higgsfield/final/portre-sira.webp',
  doran: 'assets/higgsfield/final/portre-doran.webp',
  nyx: 'assets/higgsfield/final/portre-nyx.webp',
  konyali: 'assets/models/konyali/portre-konyali.webp'
};
const arch = id => FIGHTERS[id].archetype;
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('KESINYAP 7/8: tek eşleme 5 karakteri doğru dosyaya bağlar, dosyalar var', () => {
  assert.deepEqual([...FIGHTER_IDS].sort(), Object.keys(EXPECT).sort());
  for (const [id, file] of Object.entries(EXPECT)) {
    assert.equal(PORTRAITS[id], './' + file);
    assert.ok(existsSync(new URL('../' + file, import.meta.url)), file);
    assert.equal(portraitFor({fighter: id}).url, './' + file);
  }
  assert.equal(portraitFor({fighter: 'yok', character: 'rune'}).fallback, PORTRAIT_FALLBACK.rune);
});

test('VS: her karakter için iki tarafta o karakterin portresi (bot + çevrimiçi aynı model)', () => {
  const ids = Object.keys(EXPECT);
  for (const a of ids) for (const b of ids) {
    const [l, r] = vsModel({players: [{seat: 1, name: 'A', fighter: a, character: arch(a)}, {seat: 2, name: 'B', fighter: b, character: arch(b)}]});
    assert.equal(l.image, './' + EXPECT[a]); assert.equal(r.image, './' + EXPECT[b]);
    assert.equal(l.fighterId, a); assert.equal(r.fighterId, b);
    assert.match(l.fallback, /arena-king|rune-preview/);
  }
  // fighter yoksa arketipin varsayılan dövüşçüsü (eski kayıt) — yine bir portre
  const [x, y] = vsModel({players: [{seat: 1, character: 'fire'}, {seat: 2, character: 'rune'}]});
  assert.ok(Object.values(PORTRAITS).includes(x.image)); assert.ok(Object.values(PORTRAITS).includes(y.image));
});

test('sonuç kartı: oyuncunun kendi portresi, kazananda vurgu sınıfı', () => {
  for (const [id, file] of Object.entries(EXPECT)) {
    const html = resultCardHTML({seat: 1, name: 'X', fighter: id, character: arch(id), playerId: 'p'}, 1, null);
    assert.ok(html.includes(`src="./${file}"`), id);
    assert.ok(html.includes('pvp15-winner'));
  }
  assert.ok(!resultCardHTML({seat: 2, name: 'Y', fighter: 'sira'}, 1, null).includes('pvp15-winner'));
});

test('raund arası: summaryPlayers iki koltuğun dövüşçüsünü verir; kartta portre yuvası var', () => {
  const m = {players: [{seat: 1, fighter: 'sira', character: 'fire'}, {seat: 2, fighter: 'konyali', character: 'rune'}]};
  assert.deepEqual(summaryPlayers(m).map(p => p.fighter), ['sira', 'konyali']);
  assert.match(read('pvp/rounds-ui.js'), /portraitImg\(doc,model\.players\[i\],'m33-portrait'\)/);
  assert.match(read('pvp/arena-ui.js'), /players:summaryPlayers\(match\)/);
});

test('portre CSS: yarıyı doldurur (cover), yazı ≥ 12 px, süre sabitleri değişmedi', () => {
  assert.match(read('pvp/cinematic.css'), /\.cin-fighter\{[^}]*object-fit:cover/);
  assert.match(read('pvp/rounds-ui.css'), /\.m33-portrait\{[^}]*object-fit:cover/);
  assert.match(read('pvp/phase15-results.css'), /\.pvp15-portrait\{[^}]*object-fit:cover/);
});
