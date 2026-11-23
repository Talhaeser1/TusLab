// Osmanlı padişahları PvP dövüşçüleri (pvp/shared/padisahlar.js → fighters.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FIGHTERS, FIGHTER_IDS, BASE_FIGHTER_IDS, PADISAH_IDS, fighterBody, fighterQuote, fighterDefense, isFighterId} from '../pvp/shared/fighters.js';
import {PADISAH_DEFS} from '../pvp/shared/padisahlar.js';
import {voiceKey, fighterSfxFile, weaponSfx} from '../pvp/sound.js';
import {PORTRAITS, portraitFor} from '../pvp/portraits.js';
import {personaOf} from '../pvp/shared/bot-ai.js';
import {quoteText, showQuote} from '../pvp/quote-bubble.js';
import {fighterInfoHTML, fighterRosterHTML} from '../pvp/network.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORDER = ['osman', 'orhan', 'murad1', 'bayezid1', 'mehmed1', 'murad2', 'fatih', 'bayezid2', 'yavuz', 'kanuni'];
const NAMES = ['Osman Gazi', 'Orhan Gazi', 'I. Murad', 'Yıldırım Bayezid', 'Çelebi Mehmed', 'II. Murad', 'Fatih Sultan Mehmed', 'II. Bayezid', 'Yavuz Sultan Selim', 'Kanuni Sultan Süleyman'];

test('padişahlar: baştan ilk 10, saltanat sırasıyla kadroda; temel 5 karakter yerinde', () => {
  assert.deepEqual([...PADISAH_IDS], ORDER);
  assert.deepEqual([...BASE_FIGHTER_IDS], ['vargr', 'sira', 'doran', 'nyx', 'konyali']);
  assert.deepEqual([...FIGHTER_IDS], [...BASE_FIGHTER_IDS, ...ORDER]);
  PADISAH_IDS.forEach((id, i) => {
    const f = FIGHTERS[id];
    assert.equal(f.name, NAMES[i]);
    assert.equal(f.padisah, i + 1);
    assert.match(f.reign, /\d{4}–\d{4}/);
    assert.ok(f.blurb && f.tarih && f.title && f.weapon, id);
    assert.match(f.palette.main, /^#[0-9a-f]{6}$/);
    assert.equal(f.palette.hex, parseInt(f.palette.main.slice(1), 16));
  });
  // Bilinen saltanat uçları
  assert.equal(FIGHTERS.orhan.reign, '1324–1362');
  assert.equal(FIGHTERS.fatih.reign, '1444–1446, 1451–1481');
  assert.equal(FIGHTERS.kanuni.reign, '1520–1566');
  assert.equal(PADISAH_DEFS.length, 10);
});

test('padişahlar: gövde temel kadrodan; arketip, E savunması ve klipler gövdeyle aynı', () => {
  for (const id of PADISAH_IDS) {
    const f = FIGHTERS[id], b = FIGHTERS[f.body];
    assert.ok(BASE_FIGHTER_IDS.includes(f.body), id);
    assert.equal(fighterBody(id), f.body);
    assert.equal(f.archetype, b.archetype, id + ' arketip');
    assert.equal(f.model, b.model);
    assert.equal(fighterDefense(id), fighterDefense(f.body), id + ' E savunması');
    for (const k of ['q', 'w', 'e', 'r', 's']) {
      assert.equal(f.skills[k].clip, b.skills[k].clip, `${id}.${k} klip`);
      assert.deepEqual(f.skills[k].clips, b.skills[k].clips);
      assert.equal(f.skills[k].fx, b.skills[k].fx);
    }
    assert.equal(f.skills.e.short, b.skills.e.short, 'E kısa açıklaması mekaniği söyler (CAN/KALKAN)');
  }
  for (const id of BASE_FIGHTER_IDS) assert.equal(fighterBody(id), id);
  assert.equal(fighterBody('yok'), 'yok');
  // İki arketip de padişah alır
  assert.ok(PADISAH_IDS.some(id => FIGHTERS[id].archetype === 'fire'));
  assert.ok(PADISAH_IDS.some(id => FIGHTERS[id].archetype === 'rune'));
});

test('padişahlar: kendine özel beceri adları (hiçbir dövüşçüyle çakışmaz) ve açıklamalar', () => {
  const seen = new Map();
  for (const id of FIGHTER_IDS) for (const k of ['q', 'w', 'e', 'r', 's']) {
    const name = FIGHTERS[id].skills[k].name;
    assert.ok(name, `${id}.${k}`);
    if (PADISAH_IDS.includes(id)) {
      assert.ok(!seen.has(name), `${id}.${k} adı ${seen.get(name)} ile aynı: ${name}`);
      assert.ok(FIGHTERS[id].skills[k].desc && FIGHTERS[id].skills[k].desc !== FIGHTERS[FIGHTERS[id].body].skills[k].desc, `${id}.${k} kendi açıklaması`);
    }
    seen.set(name, id);
  }
});

test('padişahlar: sözler var, sesli replik yok (404 isteği yok), söz ekranda yazı olur', () => {
  for (const id of PADISAH_IDS) {
    for (const k of ['soz', 'e', 'r', 'savunma', 'zafer']) assert.ok(fighterQuote(id, k), `${id} sözü: ${k}`);
    assert.equal(voiceKey(id, 'zafer'), null);
  }
  assert.equal(voiceKey('vargr', 'zafer'), 'replik/vargr-zafer');
  assert.equal(fighterQuote('vargr', 'zafer'), '');
  assert.match(fighterQuote('fatih', 'soz'), /İstanbul.*\(atfedilen\)/);
  assert.equal(quoteText('fatih', 'Gemiler karadan yürüsün!'), 'Fatih Sultan Mehmed: «Gemiler karadan yürüsün!»');
  assert.equal(showQuote('fatih', 'r', 'x'), false, 'DOM yokken sessizce geçer');
});

test('padişahlar: ses dosyası, silah sesi, bot kişiliği gövdeden; madalyon portresi diskte', () => {
  for (const id of PADISAH_IDS) {
    const body = fighterBody(id);
    for (const k of ['q', 'e', 'r']) {
      const file = fighterSfxFile(id, k);
      assert.equal(file, fighterSfxFile(body, k));
      assert.ok(existsSync(join(root, 'assets/sfx', file)), `${id} → ${file}`);
      assert.equal(weaponSfx(id, k), weaponSfx(body, k));
    }
    assert.equal(personaOf(id), personaOf(body));
    assert.equal(PORTRAITS[id], `./assets/padisah/${id}.svg`);
    assert.ok(existsSync(join(root, 'assets/padisah', id + '.svg')), id);
    assert.equal(portraitFor({fighter: id}).url, PORTRAITS[id]);
    assert.ok(isFighterId(id), 'sunucu (room.js) da aynı listeyi kullanır');
  }
});

test('padişahlar: lobi kartı ad, saltanat ve söz gösterir', () => {
  const roster = fighterRosterHTML('fatih');
  for (const id of PADISAH_IDS) assert.match(roster, new RegExp(`data-fighter="${id}"`));
  assert.match(roster, /aria-checked="true" tabindex="0" class="lb3-fighter rune" data-lobby-action="fighter" data-fighter="fatih"/);
  const info = fighterInfoHTML('kanuni');
  assert.match(info, /Kanuni Sultan Süleyman/);
  assert.match(info, /10\. padişah ·<\/span><b>1520–1566/);
  assert.match(info, /class="j2-soz">«Halk içinde muteber/);
  assert.doesNotMatch(fighterInfoHTML('vargr'), /j2-soz|j2-reign/);
});
