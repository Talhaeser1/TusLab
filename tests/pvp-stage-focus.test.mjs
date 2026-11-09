import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {attachStageFocus, FOCUS_CLASS, FOCUS_OUT_CLASS, INTER_CLASS, FLIP_MS} from '../pvp/stage-focus.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// Sahte kök: sınıf listesi, olaylar, arena kutusu (odakta yukarıda, normalde aşağıda), animate kaydı.
function fakeRoot() {
  const cls = new Set();
  const listeners = {};
  const anims = [];
  let observer = null;
  const duel = {
    getBoundingClientRect: () => ({top: cls.has(FOCUS_CLASS) && !cls.has(INTER_CLASS) ? 112 : 356}),
    animate(frames, opts) {
      let res;
      const a = {frames, opts, cancelled: false, finishedCalled: false, finished: new Promise(r => { res = r; }),
        cancel() { this.cancelled = true; }, finish() { this.finishedCalled = true; res(); }};
      anims.push(a);
      return a;
    }
  };
  const notify = attr => observer?.cb([{attributeName: attr}]);
  const root = {
    dataset: {},
    classList: {
      contains: c => cls.has(c),
      add: (...c) => { c.forEach(x => cls.add(x)); notify('class'); },
      remove: (...c) => { c.forEach(x => cls.delete(x)); notify('class'); },
      toggle: (c, on) => { if (on) cls.add(c); else cls.delete(c); notify('class'); }
    },
    querySelector: s => (s === '.pvp2-duel' ? duel : null),
    addEventListener: (t, f) => { (listeners[t] ||= []).push(f); },
    removeEventListener: (t, f) => { listeners[t] = (listeners[t] || []).filter(x => x !== f); },
    emit: (t, detail) => (listeners[t] || []).forEach(f => f({detail})),
    setPhase: p => { if (p === undefined) delete root.dataset.arenaPhase; else root.dataset.arenaPhase = p; notify('data-arena-phase'); }
  };
  class Obs { constructor(cb) { this.cb = cb; observer = this; } observe() {} disconnect() { observer = null; } }
  const timers = [];
  const scheduler = {setTimeout: (fn, ms) => { timers.push({fn, ms}); return timers.length; }, clearTimeout: id => { if (timers[id - 1]) timers[id - 1].fn = () => {}; }};
  return {root, cls, anims, Obs, scheduler, timers};
}

test('odaktan çıkış: arena aşağı kayarken yazma paneli gizli (HP panellerine binmez), süre dolunca görünür', () => {
  const f = fakeRoot();
  attachStageFocus({root: f.root, scheduler: f.scheduler, observe: f.Obs});
  f.root.emit('tuslab:pvp-round', {type: 'EXCHANGE_RESOLVE'});
  assert.ok(f.cls.has(FOCUS_CLASS));
  assert.ok(!f.cls.has(FOCUS_OUT_CLASS), 'odağa girerken yazma paneli zaten katlı');
  f.root.emit('tuslab:pvp-round', {type: 'EXCHANGE_START'});
  assert.ok(!f.cls.has(FOCUS_CLASS));
  assert.ok(f.cls.has(FOCUS_OUT_CLASS), 'kayma sürerken yazma paneli gizli');
  const a = f.anims.at(-1);
  assert.equal(a.frames[0].transform, 'translateY(-244px)');
  // Kare çizilmese bile (takılan animasyon) zamanlayıcı kaymayı bitirip paneli gösterir.
  const t = f.timers.findLast(x => x.ms === FLIP_MS + 280);
  assert.ok(t);
  t.fn();
  assert.ok(a.finishedCalled, 'takılı kayma sona sarılır');
  assert.ok(!f.cls.has(FOCUS_OUT_CLASS));
});

test('tur arası paneli açılınca odak FLIP ile kapanır (panel yüzer moda geçip kaymaz)', () => {
  const f = fakeRoot();
  attachStageFocus({root: f.root, scheduler: f.scheduler, observe: f.Obs});
  f.root.emit('tuslab:pvp-round', {type: 'ROUND_RESOLVE'});
  assert.ok(f.cls.has(FOCUS_CLASS));
  f.root.classList.add(INTER_CLASS); // rounds-ui.js paneli açar
  assert.ok(!f.cls.has(FOCUS_CLASS), 'panel açıkken odak kalkar');
  const a = f.anims.at(-1);
  assert.equal(a.frames[0].transform, 'translateY(-244px)', 'arena önceki (odak) konumundan yumuşakça iner');
  const css = read('pvp/cinematic.css');
  assert.match(css, /#pvp-root\.stage-focus\.rui-inter-open \.tt\{display:grid\}/, 'panel açıkken yazma paneli kutusu yerinde');
  assert.match(css, /#pvp-root\.stage-focus-out \.tt\{opacity:0;pointer-events:none/);
});

test('raund arena: çözüm fazı odak açar, diğer fazlar kapatır; sınıf değişimi tek başına odağı bozmaz', () => {
  const f = fakeRoot();
  attachStageFocus({root: f.root, scheduler: f.scheduler, observe: f.Obs});
  // Klasik: odak olayla açılır; ilgisiz sınıf değişimleri (gözlemci 'class' kaydı) odağı kapatmamalı.
  f.root.emit('tuslab:pvp-round', {type: 'EXCHANGE_RESOLVE'});
  f.root.classList.add('cin-shake');
  assert.ok(f.cls.has(FOCUS_CLASS), 'sınıf kaydı odağı bozmaz');
  f.root.emit('tuslab:pvp-round', {type: 'EXCHANGE_START'});
  // Arena: faz kaydı
  f.root.setPhase('resolve');
  assert.ok(f.cls.has(FOCUS_CLASS));
  f.root.setPhase('summary');
  assert.ok(!f.cls.has(FOCUS_CLASS));
  f.root.setPhase(undefined);
  assert.ok(!f.cls.has(FOCUS_CLASS));
});

test('yüzer tur arası paneli eski satır içi konumu ezer; arena etiketi odak dışında görünmez', () => {
  assert.match(read('pvp/rounds-ui.css'), /\.rui-inter\.is-floating\{top:72px!important;left:50%!important/);
  const rsv = read('pvp/resolve-ui.css');
  assert.match(rsv, /#pvp-root:not\(\.stage-focus\) \.pvp2-duel>\.rsv-banner\{display:none\}/);
  assert.match(rsv, /#pvp-root:has\(\.pvp15-backdrop:not\(\[hidden\]\)\) \.rsv-banner\{display:none\}/);
  assert.match(read('pvp/howto.css'), /#pvp-root \.htp-panel\[hidden\]\{display:none\}/, '✕ ile kapanan panel ekranda kalmaz');
});
