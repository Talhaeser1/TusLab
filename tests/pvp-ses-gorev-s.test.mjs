// Görev S — ses bağlama: dosya adı sözleşmesi, sessiz mod, anons kuyruğu, konyali mp3 yolu, müzik yedeği.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,statSync} from 'node:fs';
import {BASE_FIGHTER_IDS as FIGHTER_IDS} from '../pvp/shared/fighters.js';
import {createPvPAudio,VOICE_KEYS,EXTRA_NAMES,ANNOUNCE_NAMES,fighterSfxFile,weaponSfx} from '../pvp/sound.js';
import {createDynamicScore} from '../pvp/music23.js';
import {createVoiceQueue} from '../pvp/voice-queue.js';

test('dosya adı sözleşmesi: 5 karakter x 6 replik + efekt/anons dosyaları diskte, <=40 KB', () => {
  assert.equal(FIGHTER_IDS.length, 5);
  for (const id of FIGHTER_IDS) for (const k of VOICE_KEYS) {
    const f = `assets/sfx/replik/${id}-${k}.mp3`; assert.ok(existsSync(f), f); assert.ok(statSync(f).size <= 40 * 1024, f);
  }
  for (const n of EXTRA_NAMES) { const f = `assets/sfx/extra/${n}.mp3`; assert.ok(existsSync(f), f); assert.ok(statSync(f).size <= 40 * 1024, f); }
  for (const n of ANNOUNCE_NAMES) { const f = `assets/sfx/anons/${n}.mp3`; assert.ok(existsSync(f), f); assert.ok(statSync(f).size <= 40 * 1024, f); }
  for (const k of ['q', 'e', 'r']) assert.ok(existsSync(`assets/sfx/konyali-${k}.mp3`));
  assert.ok(existsSync('assets/music/anadolu.mp3'));
});

test('konyali: q/e/r mp3 yolu, hit/ko için dosya yok (istek atılmaz)', () => {
  assert.equal(fighterSfxFile('konyali', 'q'), 'konyali-q.mp3');
  assert.equal(fighterSfxFile('konyali', 'r'), 'konyali-r.mp3');
  assert.equal(fighterSfxFile('konyali', 'hit'), null);
  assert.equal(fighterSfxFile('konyali', 'ko'), null);
  assert.equal(fighterSfxFile('vargr', 'q'), 'vargr-q.mp3');
  assert.equal(weaponSfx('konyali', 'q'), null);
  for (const id of FIGHTER_IDS) if (id !== 'konyali') assert.ok(weaponSfx(id, 'q'));
});

function harness({muted = false} = {}) {
  const counts = {source: 0, fetch: []};
  class Node { connect() {} disconnect() {} }
  class Source extends Node { constructor() { super(); counts.source++; this.buffer = null; } start() {} stop() {} }
  class Context {
    constructor() { this.state = 'suspended'; this.destination = new Node(); this.currentTime = 0; }
    async resume() { this.state = 'running'; } async close() {}
    createGain() { const n = new Node(); n.gain = {value: 1}; return n; }
    createStereoPanner() { const n = new Node(); n.pan = {value: 0}; return n; }
    createDynamicsCompressor() { const n = new Node(); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = {value: 0}; return n; }
    createBufferSource() { return new Source(); }
    async decodeAudioData(b) { return {duration: 1, length: b.byteLength}; }
  }
  const data = new Map(muted ? [['tuslab-pvp-sfx-muted', 'true']] : []);
  const storage = {getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v))};
  const fetcher = async url => { counts.fetch.push(url); return {ok: true, arrayBuffer: async () => new Uint8Array(4).buffer}; };
  return {counts, data, storage, make: () => createPvPAudio({storage, AudioContextClass: Context, fetcher})};
}

test('sessiz mod: hiçbir play/kaynak/istek yok; tercih localStorage da kalır', async () => {
  const h = harness({muted: true});
  const a = h.make();
  await a.unlock(); void a.preloadVoices(['vargr', 'konyali']);
  assert.equal(a.speak('vargr', 'q'), false); assert.equal(a.announce('seri-2'), false);
  assert.equal(a.playExtra('balta'), false); assert.equal(a.startCrowd(), false); assert.equal(a.cheer(), false);
  assert.equal(a.play('hit'), false);
  assert.equal(h.counts.source, 0); assert.equal(h.counts.fetch.length, 0);
  const b = h.make(); assert.equal(b.getState().muted, true);
  b.setMuted(false); assert.equal(h.data.get('tuslab-pvp-sfx-muted'), 'false');
  b.setMuted(true); assert.equal(h.data.get('tuslab-pvp-sfx-muted'), 'true');
});

test('açıkken replik çalar; sessize alınca seyirci ve kuyruk kesilir, açınca seyirci döner', async () => {
  const h = harness(); const a = h.make();
  await a.unlock(); await a.preloadVoices(['vargr']);
  assert.ok(h.counts.fetch.some(u => u.endsWith('replik/vargr-q.mp3')));
  assert.equal(a.startCrowd(), true); assert.equal(a.getState().crowd, true);
  assert.equal(a.speak('vargr', 'q'), true); assert.ok(h.counts.source >= 2);
  a.setMuted(true); assert.equal(a.getState().crowd, false);
  const before = h.counts.source; assert.equal(a.speak('vargr', 'e'), false); assert.equal(h.counts.source, before);
  a.setMuted(false); assert.equal(a.getState().crowd, true, 'seyirci isteği hatırlanır');
  await a.dispose();
});

test('eksik dosya: 404 bir kez denenir, döngü yok', async () => {
  const reqs = [];
  class Node { connect() {} disconnect() {} }
  class Context {
    constructor() { this.state = 'running'; this.destination = new Node(); }
    async resume() {} async close() {}
    createGain() { const n = new Node(); n.gain = {value: 1}; return n; }
    createBufferSource() { const n = new Node(); n.start = () => {}; n.stop = () => {}; return n; }
    async decodeAudioData() { return {duration: 1}; }
  }
  const a = createPvPAudio({storage: null, AudioContextClass: Context, fetcher: async u => { reqs.push(u); return {ok: false, status: 404}; }});
  await a.unlock(); await a.preloadVoices(['nyx']); const n = reqs.length;
  for (let i = 0; i < 5; i++) { a.speak('nyx', 'q'); a.playExtra('isik'); }
  await new Promise(r => setTimeout(r, 10));
  assert.equal(reqs.length, n, 'ek istek yok');
  assert.equal(reqs.filter(u => u.endsWith('replik/nyx-q.mp3')).length, 1);
  await a.dispose();
});

test('anons kuyruğu: aynı anda tek ses, öncelik sırası, bayat öğe atılır', () => {
  let t = 0; const started = []; const dones = [];
  const q = createVoiceQueue({now: () => t, start: (item, done) => { started.push(item.key); dones.push(done); return true; }});
  q.push({key: 'a', priority: 1}); q.push({key: 'b', priority: 2}); q.push({key: 'c', priority: 3}); q.push({key: 'd', priority: 1});
  assert.deepEqual(started, ['a'], 'meşgulken ikinci ses başlamaz');
  assert.deepEqual(q.state().queued, ['c', 'b'], 'en fazla 2, yüksek öncelik önce, düşük atıldı');
  dones[0](); assert.deepEqual(started, ['a', 'c']);
  t = 5000; dones[1](); assert.deepEqual(started, ['a', 'c'], 'bayat öğe (ttl) çalınmaz');
  q.push({key: 'e', priority: 1}); assert.deepEqual(started, ['a', 'c', 'e']);
  q.clear(); dones[2](); q.push({key: 'f'}); assert.deepEqual(started, ['a', 'c', 'e', 'f'], 'clear sonrası eski done yok sayılır');
});

test('anons kuyruğu: başlatılamayan öğe atlanır, sıradaki çalar', () => {
  const started = [];
  const q = createVoiceQueue({start: item => { started.push(item.key); return item.key !== 'bad'; }});
  q.push({key: 'bad'}); q.push({key: 'ok'});
  assert.deepEqual(started, ['bad', 'ok']);
});

test('müzik: anadolu.mp3 yoksa sahne .wav yedeğine düşer', async () => {
  class Node { connect() {} disconnect() {} }
  class Context {
    constructor() { this.state = 'suspended'; this.destination = new Node(); this.currentTime = 0; }
    async resume() { this.state = 'running'; } async close() {}
    createGain() { const n = new Node(); n.gain = {value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {}}; return n; }
    createBufferSource() { const n = new Node(); n.start = () => {}; n.stop = () => {}; return n; }
    async decodeAudioData(b) { return {length: b.byteLength}; }
  }
  const fetched = [];
  const s = createDynamicScore({storage: null, AudioContextClass: Context, fetcher: async u => {
    const f = u.split('/').pop(); fetched.push(f);
    return f.endsWith('.mp3') ? {ok: false} : {ok: true, arrayBuffer: async () => new Uint8Array(4).buffer};
  }});
  await s.preload();
  assert.ok(fetched.includes('lobby.mp3') && fetched.includes('combat.mp3'), 'önce küçük mp3 denenir');
  assert.ok(fetched.includes('lobby.wav') && fetched.includes('combat.wav'));
  assert.equal(fetched.filter(f => f === 'anadolu.mp3').length, 1, 'yedeğe düşünce yeniden denemez');
  await s.dispose();
});
