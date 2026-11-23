import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {roundEndText, vsModel, attachCinematic, CIN_TIMES} from '../pvp/cinematic.js';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const players = [{seat: 1, name: 'Savaşçı', character: 'fire'}, {seat: 2, name: 'Bot', character: 'rune'}];

test('cinematic: raund sonu bandı yazıları', () => {
  assert.deepEqual(roundEndText({reason: 'KO', winnerSeat: 2, round: 3, players}), {title: 'K.O.!', sub: 'Bot kazandı', tone: 'ko'});
  assert.equal(roundEndText({reason: 'TIME', winnerSeat: 1, round: 2, players}).title, 'SÜRE!');
  assert.equal(roundEndText({reason: 'ALL_DONE', winnerSeat: 1, round: 4, players}).title, 'RAUND 4 BİTTİ');
  assert.equal(roundEndText({reason: 'TIME', winnerSeat: null, round: 1, players}).title, 'BERABERE');
});

test('cinematic: VS modeli oyuncu ve karakteri eşler', () => {
  const [a, b] = vsModel({players});
  assert.equal(a.side, 'fire'); assert.equal(b.side, 'rune');
  assert.equal(a.name, 'Savaşçı'); assert.equal(b.character, 'Doran');
  assert.equal(b.title, 'Demir Sur');
  assert.match(a.image, /\.webp$/);
  assert.equal(vsModel({}).length, 2, 'eksik veride de iki taraf');
});

function fakeEnv({duelHeight = 400} = {}) {
  const listeners = {}, docListeners = {};
  const mk = () => {
    const cls = new Set(); const kids = [];
    return {hidden: false, isConnected: true, className: '', style: {setProperty() {}}, children: kids,
      classList: {add: c => cls.add(c), remove: (...c) => c.forEach(x => cls.delete(x)), contains: c => cls.has(c)},
      setAttribute() {}, append(...k) { kids.push(...k); }, replaceChildren(...k) { kids.length = 0; kids.push(...k); }, remove() {}};
  };
  const rootCls = new Set();
  const root = {
    classList: {add: c => rootCls.add(c), remove: (...c) => c.forEach(x => rootCls.delete(x)), contains: c => rootCls.has(c)},
    appendChild(n) { this.layer = n; },
    querySelector: s => (s === '.pvp2-duel' ? {getBoundingClientRect: () => ({top: 400, left: 30, width: 1800, height: duelHeight})} : null),
    addEventListener: (t, f) => { listeners[t] = f; }, removeEventListener: t => { delete listeners[t]; },
    emit: (t, detail) => listeners[t]?.({detail})
  };
  const doc = {createElement: mk, addEventListener: (t, f) => { docListeners[t] = f; }, removeEventListener: t => { delete docListeners[t]; }};
  const timers = new Map(); let id = 0;
  const scheduler = {setTimeout: (f, ms) => { timers.set(++id, f); return id; }, clearTimeout: k => timers.delete(k), flush() { for (const [k, f] of [...timers]) { timers.delete(k); f(); } }};
  return {root, doc, scheduler, listeners, docListeners, rootCls};
}

test('cinematic: geri sayımda tam ekran VS; aynı maçın başında ikinci kez oynamaz', () => {
  const e = fakeEnv();
  attachCinematic({root: e.root, doc: e.doc, scheduler: e.scheduler});
  e.root.emit('tuslab:pvp-cinematic', {type: 'COUNTDOWN', match: {players}});
  assert.match(e.root.layer.className, /cin-vs/);
  assert.doesNotMatch(e.root.layer.className, /cin-boxed/, 'geri sayımda tam ekran');
  e.scheduler.flush();
  assert.equal(e.root.layer.hidden, true);
  e.root.emit('tuslab:pvp-cinematic', {type: 'MATCH_START', match: {players}});
  assert.equal(e.root.layer.hidden, true, 'geri sayımdan hemen sonra MATCH_START yeniden VS açmaz');
});

test('cinematic: geri sayımsız başlangıçta VS yalnız arenada (yazma paneli açık); arena yoksa hiç oynamaz', () => {
  const e = fakeEnv();
  attachCinematic({root: e.root, doc: e.doc, scheduler: e.scheduler});
  e.root.emit('tuslab:pvp-cinematic', {type: 'MATCH_START', match: {players}});
  assert.match(e.root.layer.className, /cin-boxed/);
  const small = fakeEnv({duelHeight: 80});
  attachCinematic({root: small.root, doc: small.doc, scheduler: small.scheduler});
  small.root.emit('tuslab:pvp-cinematic', {type: 'MATCH_START', match: {players}});
  assert.equal(small.root.layer, undefined, 'arena görünmüyorsa yazı alanını kapatmamak için oynatılmaz');
});

test('cinematic: raund sonu sıralaması bant bitince kalkar, tur arası paneli açılabilir', () => {
  const e = fakeEnv();
  attachCinematic({root: e.root, doc: e.doc, scheduler: e.scheduler});
  e.root.emit('tuslab:pvp-round', {type: 'ROUND_END', payload: {reason: 'KO', winnerSeat: 2, round: 1, match: {players}}});
  assert.ok(e.rootCls.has('cin-round-end'));
  e.scheduler.flush();
  assert.ok(!e.rootCls.has('cin-round-end'), 'bant kapanışı sıralama zamanlayıcısını silmemeli');
  e.root.emit('tuslab:pvp-round', {type: 'ROUND_START', payload: {round: 2}});
  assert.ok(e.rootCls.has('cin-round-start'));
});

test('cinematic: tuşa basmak sinematiği kapatır ama tuşu engellemez', () => {
  const e = fakeEnv();
  attachCinematic({root: e.root, doc: e.doc, scheduler: e.scheduler});
  e.root.emit('tuslab:pvp-arena', {type: 'ARENA_ROUND_START', payload: {round: 2}});
  let stopped = false;
  e.docListeners.keydown?.({stopPropagation() { stopped = true; }, preventDefault() { stopped = true; }});
  assert.equal(stopped, false);
  e.scheduler.flush();
  assert.equal(e.root.layer.hidden, true);
});

test('cinematic: bağlantılar ve performans kuralları', () => {
  const css = read('pvp/cinematic.css');
  assert.doesNotMatch(css, /infinite|backdrop-filter|filter:blur/);
  assert.doesNotMatch(css, /font:[^;}]*\binherit\b/, 'font kısaltmasında inherit geçersiz (yazılar küçülüyordu)');
  assert.match(css, /prefers-reduced-motion/);
  assert.match(read('pvp/pvp-main.js'), /attachCinematic\(\{root,isReduced:/);
  assert.match(read('index.html'), /pvp\/cinematic\.css/);
  const net = read('pvp/network.js');
  assert.match(net, /'tuslab:pvp-cinematic',\{detail:\{type:'COUNTDOWN'/);
  assert.match(net, /'tuslab:pvp-cinematic',\{detail:\{type:'MATCH_START'/);
  assert.ok(CIN_TIMES.vsLite < CIN_TIMES.vs);
  // tuslab:pvp-match her maç güncellemesinde gider ve 7 dinleyicisi var: sinematik ona bağlanmaz, ona yazmaz.
  assert.doesNotMatch(read('pvp/cinematic.js'), /addEventListener\('tuslab:pvp-match'/);
  assert.doesNotMatch(net, /'tuslab:pvp-match',\{detail:\{type:/);
});

test('index.html satır içi betik içermez (CSP script-src self engelliyordu)', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/);
  assert.match(html, /<script src="\.\/pvp\/loading-hint\.js"><\/script>/);
});

test('cinematic: güçlü vuruş efekti ve sesler (ayarlara bağlı), sarsıntı show() sonrası kurulur', async () => {
  const {CIN_SFX, attachCinematic: attach} = await import('../pvp/cinematic.js');
  const {SFX_NAMES} = await import('../pvp/sound.js');
  for (const list of Object.values(CIN_SFX)) for (const [name] of list) assert.ok(SFX_NAMES.includes(name), `${name} ses dosyası var`);
  const e = fakeEnv(); const played = [];
  attach({root: e.root, doc: e.doc, scheduler: e.scheduler, sfx: (n, g) => played.push([n, g])});
  e.root.emit('tuslab:pvp-round', {type: 'ROUND_END', payload: {reason: 'KO', winnerSeat: 1, round: 2, match: {players}}});
  assert.ok(e.root.layer.children.some(c => /cin-impact/.test(c.className)), 'şok dalgası/kıvılcım katmanı');
  e.scheduler.flush(); e.scheduler.flush(); // iç içe kurulan zamanlayıcılar (sarsıntı kaldırma) ikinci turda
  assert.deepEqual(played.map(p => p[0]), ['shatter', 'critical']);
  assert.ok(!e.rootCls.has('cin-shake'), 'sarsıntı kendiliğinden kalkar');
  assert.match(read('pvp/pvp-main.js'), /sfx:\(name,gain\)=>pvpAudio\.play\(name,\{character:'center',gain\}\)/);
  const css = read('pvp/cinematic.css');
  assert.match(css, /#pvp-root\.cin-shake \.pvp2-shell\{animation:cin-shake/);
  assert.doesNotMatch(css, /infinite/);
});
