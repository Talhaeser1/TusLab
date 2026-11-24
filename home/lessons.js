// TuşLab — Klavye dersleri + Serbest Alıştırma (İşçi E).
import {
  mountTyper, ensureStyles, h, fingerName, fingerShort, trLower, trUpper, shuffle, fmtTime, loadAll, bumpProgress, kbWanted, kbToggle,
} from './typing.js';
import * as WD from './data/words.js';
import * as LD from './data/lessons.js';
import { lessonRec, lessonUnlocked, intentLessonIndex } from './ders-kilit.js';

const WORDS = WD.WORDS || [];
const UNITS = LD.UNITS || [];
const LESSONS = LD.LESSONS || [];
const FINGERS = LD.FINGERS || {};

// Oturum boyunca gösterilen kelimeler (sayfa yenilenene kadar).
const SEEN_FREE = new Set();
const SEEN_WEAK = new Set();
const SEEN_DRILL = new Set();
// Ünite renkleri (harita): sırayla, ana ekran kutu ailesinin vurgu renkleri.
const UNIT_ACC = ['#ffc861', '#3fe0ff', '#b9a3ff', '#ff7a2f', '#45e39a', '#ff8fc7', '#3fb5ff', '#ffd23f'];

/* ------------------------------------------------------------------ kelime seçimi */

// Havuzdan hedef uzunluğa kadar, tekrarsız, daha önce gösterilmemiş kelimeler seçer.
// Havuz tükenirse bu havuzun "görüldü" kayıtları sıfırlanır.
function pickFromPool(pool, targetLen, seen, score) {
  const out = [];
  const local = new Set();
  let len = 0;
  const order = (list) => {
    const s = shuffle(list);
    if (score) s.sort((a, b) => score(a) - score(b)); // sona en yüksek puan; pop() ondan alır
    return s;
  };
  let fresh = order(pool.filter((w) => !seen.has(w)));
  let recycled = false;
  while (len < targetLen) {
    if (!fresh.length) {
      if (recycled) break;
      recycled = true;
      pool.forEach((w) => seen.delete(w));
      fresh = order(pool.filter((w) => !local.has(w)));
      if (!fresh.length) break;
    }
    const w = fresh.pop();
    out.push(w);
    local.add(w);
    seen.add(w);
    len += w.length + (out.length > 1 ? 1 : 0);
  }
  return out.join(' ');
}

function fallbackDrill(lesson) {
  const keys = new Set((lesson.keys || []).map(trLower));
  let pool = keys.size ? WORDS.filter((w) => Array.from(w).every((c) => keys.has(c))) : WORDS;
  if (pool.length < 5) pool = WORDS;
  return pickFromPool(pool, lesson.length || 150, SEEN_DRILL) || 'a s d f g h j k l';
}

function makeDrill(lesson, last) {
  let t = '';
  for (let i = 0; i < 6; i++) {
    try {
      t = LD.buildDrill(lesson, WORDS, Math.random) || '';
    } catch (e) {
      t = '';
    }
    if (t && t !== last) return t;
  }
  return t || fallbackDrill(lesson);
}

// Hata yapılan harflerden kelime alıştırması; harf yoksa null.
function weakText(lesson, weak, len) {
  const letters = Object.entries(weak || {})
    .filter(([c]) => /\p{L}/u.test(c))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([c]) => trLower(c));
  if (!letters.length) return null;
  const set = new Set(letters);
  const count = (w) => Array.from(w).reduce((n, c) => n + (set.has(c) ? 1 : 0), 0);
  let pool = WORDS.filter((w) => count(w) > 0);
  const allowed = new Set(((lesson && lesson.keys) || []).map(trLower));
  if (allowed.size) {
    const r = pool.filter((w) => Array.from(w).every((c) => allowed.has(c)));
    if (r.length >= 8) pool = r;
  }
  if (pool.length < 3) return null;
  return { text: pickFromPool(pool, len || 120, SEEN_WEAK, count), letters };
}

/* ------------------------------------------------------------------ derecelendirme */

// Yıldızlar (orta zorluk): 1 = hedef hız + hedef doğruluk; 2 = hedefin 1,3 katı hız ve en az %97 doğruluk;
// 3 = hedefin 1,6 katı hız ve en az %99 doğruluk.
/** Biten denemenin olay kaydı (ana sayfa makeCtx.save okur, depoya yazmaz): görev, gün serisi, geçmiş ve zayıf tuşlar
 *  ders tekrarında ve alıştırmalarda da sayılsın diye. Yalnız yıldız artışına bakmak tekrarları saymıyordu. */
export const resultEvent = (st, extra) => (all) => {
  all.last = Object.assign({ wpm: st.wpm, acc: st.acc, t: Date.now(), weak: st.weakKeys || null }, extra);
};

export function rate(lesson, st) {
  const gW = lesson.goalWpm || 0;
  const gA = lesson.goalAcc || 0;
  const pass = st.acc >= gA && st.wpm >= gW;
  let stars = 0;
  if (pass) {
    stars = 1;
    if (st.wpm >= gW * 1.3 && st.acc >= Math.max(97, gA + 1)) stars = 2;
    if (st.wpm >= gW * 1.6 && st.acc >= 99) stars = 3;
  }
  return { pass, stars };
}

function starsEl(n) {
  const el = h('span', { class: 'tl-stars', role: 'img', 'aria-label': n + ' yıldız' });
  for (let i = 0; i < 3; i++) el.append(h('i', { class: i < n ? 'on' : '', 'aria-hidden': 'true' }, '★'));
  return el;
}

// Bir üst yıldız için gereken hız/doğruluk (rate() eşikleriyle aynı); 3 yıldızda null.
export function nextStarGoal(lesson, stars) {
  const gW = lesson.goalWpm || 0;
  const gA = lesson.goalAcc || 0;
  if (stars >= 3) return null;
  if (stars <= 0) return { stars: 1, wpm: gW, acc: gA };
  if (stars === 1) return { stars: 2, wpm: Math.ceil(gW * 1.3), acc: Math.max(97, gA + 1) };
  return { stars: 3, wpm: Math.ceil(gW * 1.6), acc: 99 };
}

// Kilit kuralları ders-kilit.js'te (ana ekran yalnız onu yükler); buradan da dışa verilir (testler, eski çağıranlar).
export { lessonUnlocked, intentLessonIndex };

function keyLabel(k) {
  return k === ' ' ? 'boşluk' : trUpper(k);
}

/* ------------------------------------------------------------------ ana modül */

export function mountLessons(host, ctx) {
  ensureStyles();
  let typer = null;
  let alive = true;
  let boot = null;
  let mapFocus = null; // haritada odaklanacak geçerli ders düğmesi
  let curStats = null; // ders ekranının başlık satırındaki sayaç yuvası
  const timers = [];
  const view = { name: 'map', idx: 0, preview: false, last: '', sel: new Set(), custom: [], len: 120 };
  const root = h('div', { class: 'tl-edu tl-page tl-lessons' });
  host.replaceChildren(root);

  const later = (fn, ms) => {
    timers.push(setTimeout(() => alive && fn(), ms));
  };
  const clearTyper = () => {
    if (typer) {
      typer.destroy();
      typer = null;
    }
  };
  const toast = (m) => {
    try {
      if (ctx && ctx.toast) ctx.toast(m);
    } catch (e) {
      /* yoksay */
    }
  };

  function isUnlocked(i) {
    return lessonUnlocked(loadAll(ctx), i);
  }

  function celebrate(pass, stars, record) {
    const s = ctx && ctx.sfx;
    if (!s) return;
    try {
      if (record) s.voice && s.voice('record');
      else if (stars >= 3) s.voice && s.voice('great');
      else if (pass) s.voice && s.voice('lesson');
      if (pass && s.win) s.win();
    } catch (e) {
      /* yoksay */
    }
  }

  function go(name, extra) {
    Object.assign(view, { name }, extra || {});
    render(true);
  }

  function render(scroll) {
    clearTyper();
    boot = null;
    mapFocus = null;
    let body;
    if (view.name === 'lesson') body = renderLesson();
    else if (view.name === 'free') body = renderFree();
    else body = renderMap();
    root.classList.toggle('is-ws', view.name !== 'map');
    root.replaceChildren(topbar(), body);
    if (scroll) {
      try {
        root.scrollIntoView({ block: 'start' });
      } catch (e) {
        /* yoksay */
      }
    }
    if (mapFocus) {
      const b = mapFocus;
      mapFocus = null;
      // Geçerli derse kaydır (ekranın dışındaysa ortala) ve odakla: Enter dersi başlatır. Tek düzen okuması, yalnız haritada.
      later(() => {
        try {
          const r = b.getBoundingClientRect();
          if (r.bottom > window.innerHeight - 40) b.scrollIntoView({ block: 'center' });
          b.focus({ preventScroll: true });
        } catch (e) {
          /* yoksay */
        }
      }, 0);
    }
    if (boot) {
      const b = boot;
      boot = null;
      b();
    }
  }

  function topbar() {
    // Kabuk kendi "← Merkez" düğmesini gösterir; bu düğme yalnız kabuksuz kullanımda görünür (egitim.css .tl-modback).
    return h('div', { class: 'tl-top' },
      h('button', { class: 'tl-btn is-ghost tl-modback', type: 'button', onclick: () => ctx && ctx.back && ctx.back() }, '← Ana Sayfa'));
  }

  /* ---------------------------------------------------------- ders haritası */

  function unitOf(l) {
    const i = UNITS.findIndex((u) => u.id === l.unit);
    return { unit: UNITS[i] || null, no: i + 1 };
  }

  function renderMap() {
    const all = loadAll(ctx);
    const wrap = h('div', { class: 'tl-map' });
    let done = 0;
    let starSum = 0;
    LESSONS.forEach((l) => {
      const r = lessonRec(all, l.id);
      if (r.stars > 0) done++;
      starSum += r.stars || 0;
    });
    let resumeIdx = LESSONS.findIndex((l, i) => isUnlocked(i) && !(lessonRec(all, l.id).stars > 0));
    if (resumeIdx < 0) resumeIdx = Math.max(0, LESSONS.length - 1);
    const resume = LESSONS[resumeIdx];
    const pct = LESSONS.length ? Math.round((done / LESSONS.length) * 100) : 0;

    const tile = (v, l, cls) => h('div', { class: 'tl-map-tile ' + (cls || '') }, h('b', null, v), h('span', null, l));
    const hero = h('header', { class: 'tl-map-hero tl-box' },
      h('div', { class: 'tl-map-hero-id' },
        h('p', { class: 'tl-eyebrow' }, 'Klavye Dersleri · Türkçe Q'),
        h('h1', { class: 'tl-h1' }, 'Ders Haritası'),
        h('p', { class: 'tl-lead' }, 'Parmaklarını klavyeye alıştır: ders ders ilerle, yıldız topla. Her ders bir öncekini geçince açılır.'),
        h('div', { class: 'tl-map-prog', role: 'img', 'aria-label': 'Genel ilerleme yüzde ' + pct },
          h('span', { class: 'tl-bar' }, h('i', { style: 'transform:scaleX(' + pct / 100 + ')' })),
          h('small', null, '%' + pct))),
      h('div', { class: 'tl-map-tiles' },
        tile(done + '/' + LESSONS.length, 'ders', 'is-gold'),
        tile(starSum + '/' + LESSONS.length * 3, 'yıldız', 'is-cyan'),
        tile(all.bestWpm ? String(all.bestWpm) : '—', 'rekor WPM', 'is-ok'),
        tile(all.streak ? String(all.streak) : '—', 'gün seri', 'is-ember')),
      h('div', { class: 'tl-map-cta' },
        resume
          ? h('button', { class: 'tl-btn is-primary tl-map-resume', type: 'button', onclick: () => go('lesson', { idx: resumeIdx, preview: false, last: '' }) },
            h('span', null, done ? 'Kaldığın yerden devam et' : 'İlk derse başla'), h('small', null, 'Ders ' + (resumeIdx + 1) + ' · ' + resume.title))
          : null,
        h('button', { class: 'tl-btn', type: 'button', onclick: () => go('free') }, 'Serbest Alıştırma (Ö Ğ Ş Ç Ü İ)')));
    wrap.append(hero);

    if (!LESSONS.length) {
      wrap.append(h('div', { class: 'tl-panel' }, 'Ders verisi yüklenemedi.'));
      return wrap;
    }

    const unitIds = UNITS.map((u) => u.id);
    const groups = UNITS.map((u) => ({ unit: u, items: [] }));
    const extra = { unit: { id: '_', title: 'Diğer dersler', desc: '' }, items: [] };
    LESSONS.forEach((l, i) => {
      const gi = unitIds.indexOf(l.unit);
      (gi >= 0 ? groups[gi] : extra).items.push({ l, i });
    });
    if (extra.items.length) groups.push(extra);

    // Ünite kısayolları (atlama çipleri)
    const jump = h('nav', { class: 'tl-map-jump', 'aria-label': 'Üniteler' });
    wrap.append(jump);

    const nodes = []; // { btn, ui, li }
    let curBtn = null;
    groups.forEach((g, gi) => {
      if (!g.items.length) return;
      const acc = UNIT_ACC[gi % UNIT_ACC.length];
      let uDone = 0;
      let uStars = 0;
      g.items.forEach(({ l }) => {
        const r = lessonRec(all, l.id);
        if (r.stars > 0) uDone++;
        uStars += r.stars || 0;
      });
      const uid = 'tl-unit-' + g.unit.id;
      const route = h('ol', { class: 'tl-route', 'aria-label': g.unit.title + ' dersleri' });
      g.items.forEach(({ l, i }, li) => {
        const n = lessonNode(all, l, i, resumeIdx);
        const k = nodes.length;
        n.btn.addEventListener('keydown', (e) => mapKey(e, k));
        nodes.push({ btn: n.btn, ui: gi, li });
        if (i === resumeIdx) curBtn = n.btn;
        route.append(n.el);
      });
      const uPct = Math.round((uDone / g.items.length) * 100);
      const full = uDone === g.items.length;
      const sec = h('section', { class: 'tl-unit tl-box' + (full ? ' is-done' : ''), id: uid, style: '--acc:' + acc, 'aria-labelledby': uid + '-h' },
        h('div', { class: 'tl-unit-head' },
          h('span', { class: 'tl-unit-no', 'aria-hidden': 'true' }, full ? '✓' : String(gi + 1)),
          h('div', { class: 'tl-unit-id' },
            h('h2', { id: uid + '-h' }, h('small', null, 'Ünite ' + (gi + 1)), g.unit.title),
            g.unit.desc ? h('p', null, g.unit.desc) : null),
          h('div', { class: 'tl-unit-sum' },
            h('span', null, h('b', null, uDone + '/' + g.items.length), ' ders · ', h('b', null, '★ ' + uStars), '/' + g.items.length * 3),
            h('span', { class: 'tl-bar', 'aria-hidden': 'true' }, h('i', { style: 'transform:scaleX(' + uPct / 100 + ')' })))),
        route);
      wrap.append(sec);
      jump.append(h('button', {
        class: 'tl-chip tl-jump' + (full ? ' is-done' : ''), type: 'button', style: '--acc:' + acc,
        onclick: () => {
          const first = nodes.find((x) => x.ui === gi);
          try {
            sec.scrollIntoView({ block: 'start' });
          } catch (e) {
            /* yoksay */
          }
          if (first) focusNode(first.btn, true);
        },
      }, h('b', null, String(gi + 1)), h('span', null, g.unit.title), h('small', null, uDone + '/' + g.items.length)));
    });

    // Klavye: harita tek sekme durağıdır (geçerli ders); ←/→ dersler arasında, ↑/↓ üniteler arasında, Home/End ilk/son ders.
    function focusNode(btn, noScroll) {
      nodes.forEach((x) => x.btn.setAttribute('tabindex', x.btn === btn ? '0' : '-1'));
      try {
        btn.focus({ preventScroll: true });
        if (!noScroll) btn.scrollIntoView({ block: 'nearest' });
      } catch (e) {
        /* yoksay */
      }
    }
    function mapKey(e, k) {
      const cur = nodes[k];
      if (!cur) return;
      let to = -1;
      if (e.key === 'ArrowRight') to = Math.min(nodes.length - 1, k + 1);
      else if (e.key === 'ArrowLeft') to = Math.max(0, k - 1);
      else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = nodes.length - 1;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const ui = cur.ui + (e.key === 'ArrowDown' ? 1 : -1);
        const inU = nodes.filter((x) => x.ui === ui);
        to = inU.length ? nodes.indexOf(inU[Math.min(cur.li, inU.length - 1)]) : k;
      } else return;
      e.preventDefault();
      if (to !== k) focusNode(nodes[to].btn);
    }
    if (curBtn) {
      nodes.forEach((x) => x.btn.setAttribute('tabindex', x.btn === curBtn ? '0' : '-1'));
      mapFocus = curBtn;
    }
    return wrap;
  }

  function lessonNode(all, l, i, resumeIdx) {
    const rec = lessonRec(all, l.id);
    const locked = !isUnlocked(i);
    const stars = rec.stars || 0;
    const cur = i === resumeIdx && !locked && !(stars > 0);
    const state = locked ? 'is-locked' : stars >= 3 ? 'is-gold' : stars > 0 ? 'is-done' : cur ? 'is-cur' : 'is-open';
    const keys = h('span', { class: 'tl-node-keys', 'aria-hidden': 'true' });
    (l.newKeys || []).slice(0, 4).forEach((k) => {
      const f = FINGERS[k];
      keys.append(h('kbd', { class: f ? 'f-' + f : '' }, keyLabel(k)));
    });
    const prev = LESSONS[i - 1];
    const label = 'Ders ' + (i + 1) + ': ' + l.title + ', ' +
      (locked ? 'kilitli, önizle (önce "' + (prev ? prev.title : 'önceki ders') + '" geçilmeli)'
        : stars > 0 ? stars + ' yıldız' + (rec.bestWpm ? ', en iyi ' + rec.bestWpm + ' WPM' : '')
          : (cur ? 'sıradaki ders, ' : '') + 'hedef ' + (l.goalWpm || '?') + ' WPM');
    const btn = h('button', {
      class: 'tl-node-btn',
      type: 'button',
      'aria-label': label,
      'aria-current': cur ? 'step' : null,
      dataset: { idx: String(i) },
      onclick: () => {
        if (locked) toast('Önizleme: önce "' + (prev ? prev.title : 'önceki dersi') + '" dersini geç, bu ders açılsın.');
        go('lesson', { idx: i, preview: locked, last: '' });
      },
    },
    h('span', { class: 'tl-node-dot', 'aria-hidden': 'true' }, locked ? '\u{1F512}︎' : stars > 0 ? '✓' : String(i + 1)),
    h('span', { class: 'tl-node-body' },
      h('span', { class: 'tl-node-no' }, 'Ders ' + (i + 1) + (cur ? ' · Sıradaki' : '')),
      h('span', { class: 'tl-node-title' }, l.title),
      keys,
      h('span', { class: 'tl-node-meta' }, starsEl(stars),
        h('small', null, rec.bestWpm ? rec.bestWpm + ' WPM' : 'Hedef ' + (l.goalWpm || '?')))));
    return { el: h('li', { class: 'tl-node ' + state }, btn), btn };
  }

  /* ---------------------------------------------------------- ders ekranı */

  function kbButton() {
    return kbToggle((on) => {
      if (typer) {
        typer.setKeyboard(on);
        typer.focus();
      }
    });
  }

  // Ortak yazma ekranı iskeleti (Yazma ve Şiir & Atasözü ile aynı düzen): başlık satırı (kimlik · yeni tuşlar · sayaç
  // şeridi · eylemler), sahne (yazıcı ya da sonuç), alt bilgi.
  function renderLesson() {
    const lesson = LESSONS[view.idx];
    if (!lesson) {
      view.name = 'map';
      return renderMap();
    }
    const { unit, no } = unitOf(lesson);
    const stage = h('div', { class: 'tl-stage' });
    const statsHost = h('div', { class: 'tl-ws-stats' });
    const nk = lesson.newKeys || [];
    const newKeys = nk.length
      ? h('div', { class: 'tl-ws-new', role: 'list', 'aria-label': 'Bu dersin yeni tuşları' },
        nk.slice(0, 4).map((k) => {
          const f = FINGERS[k];
          return h('div', { class: 'tl-newkey' + (f ? ' f-' + f : ''), role: 'listitem' },
            h('kbd', null, keyLabel(k)),
            h('span', { title: f ? fingerName(f) : null }, h('strong', null, 'Yeni'), f ? fingerShort(f) : ''));
        }))
      : null;
    const g3 = Math.ceil((lesson.goalWpm || 0) * 1.6);
    const head = h('header', { class: 'tl-ws-head' },
      h('div', { class: 'tl-ws-id' },
        h('p', { class: 'tl-eyebrow', title: unit ? 'Ünite ' + no + ': ' + unit.title : null }, (unit ? unit.title + ' · ' : '') + 'Ders ' + (view.idx + 1) + '/' + LESSONS.length),
        h('h1', { class: 'tl-h1' }, lesson.title),
        h('p', { class: 'tl-ws-goal' },
          'Hedef ', h('b', null, (lesson.goalWpm || '?') + ' WPM'), ' · ', h('b', null, '%' + (lesson.goalAcc || '?')),
          h('span', { title: '2 yıldız: hedef hızın 1,3 katı ve en az %97 doğruluk. 3 yıldız: 1,6 katı ve en az %99.' },
            ' · ★★★ ', h('b', null, g3 + ' WPM'), ' %99'))),
      newKeys,
      statsHost,
      h('div', { class: 'tl-ws-acts' },
        kbButton(),
        h('button', { class: 'tl-btn is-ghost', type: 'button', onclick: () => go('map') }, 'Ders Haritası')));
    const sec = h('section', { class: 'tl-ws tl-ws--lesson tl-lesson' }, head);
    if (view.preview) {
      const prev = LESSONS[view.idx - 1];
      sec.append(h('div', { class: 'tl-banner' }, 'Önizleme: bu ders kilitli, sonucun kaydedilmez. Açmak için önce "' + (prev ? prev.title : 'önceki ders') + '" dersini geç.'));
    }
    sec.append(stage, h('p', { class: 'tl-ws-foot' }, lesson.desc ? h('span', null, lesson.desc) : null,
      h('span', { class: 'tl-ws-keys' }, h('kbd', null, 'Backspace'), ' düzelt · ', h('kbd', null, 'Esc'), ' Merkez')));
    boot = () => startAttempt(lesson, stage, {});
    curStats = statsHost;
    return sec;
  }

  function startAttempt(lesson, stage, opt) {
    clearTyper();
    const text = opt.text || makeDrill(lesson, view.last);
    if (!opt.text) view.last = text;
    const tHost = h('div', { class: 'tl-typer-host' });
    // replaceChildren(null) "null" yazısı ekler: not yoksa yalnız yazıcı
    if (opt.note) stage.replaceChildren(h('div', { class: 'tl-banner' }, opt.note), tHost);
    else stage.replaceChildren(tHost);
    typer = mountTyper(tHost, {
      text,
      keyboard: kbWanted(),
      statsHost: curStats,
      sfx: ctx && ctx.sfx,
      onFinish: (st) => later(() => finishLesson(lesson, stage, st, opt), 350),
    });
  }

  // Sonuç kutucukları; goal verilirse kutucuğun altında hedefe göre durum (✓ / ✗).
  function statGrid(st, goal) {
    const cell = (v, l, sub, ok) => h('div', { class: 'tl-res-cell' + (ok === true ? ' is-ok' : ok === false ? ' is-bad' : '') },
      h('b', null, String(v)), h('span', null, l), sub ? h('small', null, sub) : null);
    const okW = goal ? st.wpm >= goal.wpm : undefined;
    const okA = goal ? st.acc >= goal.acc : undefined;
    return h('div', { class: 'tl-res-grid' },
      cell(st.wpm, 'WPM', goal ? (okW ? '✓ hedef ' : '✗ hedef ') + goal.wpm : null, okW),
      cell('%' + Math.round(st.acc), 'Doğruluk', goal ? (okA ? '✓ hedef %' : '✗ hedef %') + goal.acc : null, okA),
      cell(st.errors, 'Hata'), cell(fmtTime(st.elapsedMs), 'Süre'));
  }

  function weakChips(st) {
    const ent = Object.entries(st.weakKeys || {}).slice(0, 6);
    if (!ent.length) return h('p', { class: 'tl-muted tl-weak' }, 'Hiç hata yapmadın, harika.');
    const row = h('div', { class: 'tl-chip-row' });
    ent.forEach(([k, n]) => row.append(h('span', { class: 'tl-chip is-weak' }, h('b', null, keyLabel(k)), ' ×' + n)));
    return h('div', { class: 'tl-weak' }, h('p', { class: 'tl-muted' }, 'Zorlandığın tuşlar'), row);
  }

  const backBtn = () => (ctx && ctx.back ? h('button', { class: 'tl-btn is-ghost', type: 'button', onclick: () => ctx.back() }, 'Merkez') : null);
  // Sonuç kartı açılınca birincil düğme odaklanır: Enter onu çalıştırır, Esc Merkez'e döner (kabuk).
  const focusFirst = (el) => later(() => {
    const b = el.querySelector && el.querySelector('.tl-res-actions .tl-btn.is-primary:not(:disabled)');
    if (b) b.focus({ preventScroll: true });
  }, 0);

  function finishLesson(lesson, stage, st, opt) {
    clearTyper();
    const weakBtnFor = (len) => weakText(lesson, st.weakKeys, len);
    const eyebrow = h('p', { class: 'tl-eyebrow' }, 'Ders ' + (view.idx + 1) + ' · ' + lesson.title);

    // Zayıf tuş alıştırması: ders puanını etkilemez.
    if (opt.weak) {
      const res = bumpProgress(ctx, st.wpm, st.acc, resultEvent(st, { kind: 'weak' }));
      celebrate(false, 0, res.record);
      const w = weakBtnFor(120);
      const acts = h('div', { class: 'tl-res-actions' },
        w ? h('button', { class: 'tl-btn is-primary', type: 'button',
          onclick: () => startAttempt(lesson, stage, { text: w.text, weak: true, note: 'Zayıf tuş alıştırması: ' + w.letters.map(trUpper).join(' ') }) }, 'Yeni zayıf tuş alıştırması') : null,
        h('button', { class: 'tl-btn' + (w ? '' : ' is-primary'), type: 'button', onclick: () => startAttempt(lesson, stage, {}) }, 'Derse dön'),
        backBtn());
      const card = h('div', { class: 'tl-result tl-box', role: 'status' },
        eyebrow, h('h2', null, 'Zayıf tuş alıştırması bitti'),
        res.record ? h('div', { class: 'tl-badge' }, 'Yeni rekor!') : null,
        statGrid(st), weakChips(st), acts);
      stage.replaceChildren(card);
      focusFirst(card);
      return;
    }

    const r = rate(lesson, st);
    let record = false;
    let first = false;
    let best = 0;
    if (!view.preview) {
      let old;
      const res = bumpProgress(ctx, st.wpm, st.acc, (all) => {
        resultEvent(st, { kind: 'lesson', pass: r.pass, lesson: lesson.id })(all);
        const recs = Object.assign({}, all.lessons || {});
        old = recs[lesson.id] || { stars: 0, bestWpm: 0, bestAcc: 0 };
        recs[lesson.id] = {
          stars: Math.max(old.stars || 0, r.stars),
          bestWpm: Math.max(old.bestWpm || 0, st.wpm),
          bestAcc: Math.max(old.bestAcc || 0, st.acc),
        };
        best = recs[lesson.id].stars;
        all.lessons = recs;
      });
      record = res.record;
      first = r.stars > 0 && !(old.stars > 0);
    }
    celebrate(r.pass, r.stars, record);

    const nextIdx = view.idx + 1;
    const hasNext = nextIdx < LESSONS.length;
    const nextOpen = hasNext && !view.preview && isUnlocked(nextIdx);
    const acts = h('div', { class: 'tl-res-actions' });
    if (hasNext) {
      acts.append(h('button', {
        class: 'tl-btn' + (r.pass && nextOpen ? ' is-primary' : ''),
        type: 'button',
        disabled: nextOpen ? null : 'disabled',
        title: nextOpen ? '' : 'Önce hedefi geç',
        onclick: () => go('lesson', { idx: nextIdx, preview: false, last: '' }),
      }, 'Sonraki ders →'));
    }
    acts.append(h('button', { class: 'tl-btn' + (r.pass && nextOpen ? '' : ' is-primary'), type: 'button', onclick: () => startAttempt(lesson, stage, {}) }, 'Tekrar'));
    const w = weakBtnFor(120);
    if (w) {
      acts.append(h('button', {
        class: 'tl-btn', type: 'button',
        onclick: () => startAttempt(lesson, stage, { text: w.text, weak: true, note: 'Zayıf tuş alıştırması: ' + w.letters.map(trUpper).join(' ') }),
      }, 'Zayıf tuşlarımı çalış'));
    }
    acts.append(h('button', { class: 'tl-btn is-ghost', type: 'button', onclick: () => go('map') }, 'Ders Haritası'), backBtn());

    const msg = r.pass
      ? (r.stars >= 3 ? 'Mükemmel! Üç yıldız.' : first && !view.preview ? 'Ders geçildi, yenisi açıldı!' : 'Ders geçildi.')
      : 'Hedefe az kaldı';
    const goal = { wpm: lesson.goalWpm || 0, acc: lesson.goalAcc || 0 };
    const nx = nextStarGoal(lesson, r.stars);
    const tip = !r.pass
      ? 'Geçmek için ' + goal.wpm + ' WPM ve %' + goal.acc + ' doğruluk gerekli. Önce doğruluk, hız sonra gelir.'
      : nx ? nx.stars + ' yıldız için: ' + nx.wpm + ' WPM ve %' + nx.acc + ' doğruluk.' : 'Bu dersin bütün yıldızlarını topladın.';
    const card = h('div', { class: 'tl-result tl-box' + (r.pass ? ' is-pass' : ' is-fail') + (r.stars >= 3 ? ' is-gold' : ''), role: 'status' },
      eyebrow,
      starsEl(r.stars),
      h('h2', null, msg),
      record ? h('div', { class: 'tl-badge' }, 'Yeni kişisel rekor!') : null,
      h('p', { class: 'tl-res-tip' }, tip, best > r.stars ? ' Kayıtlı en iyin: ' + best + ' yıldız.' : ''),
      view.preview ? h('p', { class: 'tl-muted' }, 'Önizleme olduğu için kaydedilmedi.') : null,
      statGrid(st, goal), weakChips(st), acts);
    stage.replaceChildren(card);
    focusFirst(card);
  }

  /* ---------------------------------------------------------- serbest alıştırma */

  const SINGLES = ['ö', 'ğ', 'ş', 'ç', 'ü', 'ı', 'i'];
  const COMBOS = ['ğı', 'şç', 'öğ', 'çö', 'üğ', 'şı', 'ığ', 'öç', 'üş', 'çı', 'ğü', 'ış'];

  const poolFor = (tokens) => (tokens.length ? WORDS.filter((w) => tokens.some((t) => w.includes(t))) : []);

  function renderFree() {
    const sum = h('p', { class: 'tl-muted tl-free-sum' });
    const startBtn = h('button', { class: 'tl-btn is-primary', type: 'button' }, 'Başla');
    const stage = h('div', { class: 'tl-stage' });
    const opts = h('div', { class: 'tl-box tl-free-opts' });
    const chipEls = new Map();

    const tokens = () => Array.from(view.sel);
    function updateSummary() {
      const n = poolFor(tokens()).length;
      sum.textContent = view.sel.size
        ? n + ' kelime bulundu' + (n < 4 ? ' (çok az, başka seçim ekle)' : '.')
        : 'Bir ya da daha fazla harf veya kombinasyon seç.';
      startBtn.disabled = n < 4;
    }
    function chip(t) {
      if (chipEls.has(t)) return chipEls.get(t);
      const n = poolFor([t]).length;
      const b = h('button', {
        class: 'tl-chip' + (view.sel.has(t) ? ' is-on' : ''),
        type: 'button',
        'aria-pressed': String(view.sel.has(t)),
        disabled: n ? null : 'disabled',
        title: n + ' kelime',
        onclick: () => {
          if (view.sel.has(t)) view.sel.delete(t);
          else view.sel.add(t);
          b.classList.toggle('is-on', view.sel.has(t));
          b.setAttribute('aria-pressed', String(view.sel.has(t)));
          updateSummary();
        },
      }, h('b', null, trUpper(t)));
      chipEls.set(t, b);
      return b;
    }
    const row = (title, list) => h('div', { class: 'tl-free-group' }, h('p', { class: 'tl-muted' }, title), h('div', { class: 'tl-chip-row' }, list.map(chip)));
    const customRow = h('div', { class: 'tl-chip-row' }, view.custom.map(chip));
    const input = h('input', { class: 'tl-field', type: 'text', maxlength: '4', placeholder: 'ör. şö', 'aria-label': 'Kendi kombinasyonun', autocomplete: 'off', spellcheck: 'false' });
    const addCustom = () => {
      const t = trLower(input.value.trim());
      if (!/^[a-zçğıöşü]{1,4}$/.test(t)) {
        toast('1-4 harflik bir kombinasyon yaz (yalnız Türkçe harfler).');
        return;
      }
      if (!SINGLES.includes(t) && !COMBOS.includes(t) && !view.custom.includes(t)) {
        view.custom.push(t);
        customRow.append(chip(t));
      }
      view.sel.add(t);
      const c = chip(t);
      c.classList.add('is-on');
      c.setAttribute('aria-pressed', 'true');
      input.value = '';
      updateSummary();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCustom();
      }
    });

    const lenRow = h('div', { class: 'tl-chip-row' });
    [['Kısa', 60], ['Orta', 120], ['Uzun', 200]].forEach(([label, n]) => {
      const b = h('button', {
        class: 'tl-chip' + (view.len === n ? ' is-on' : ''),
        type: 'button',
        'aria-pressed': String(view.len === n),
        onclick: () => {
          view.len = n;
          lenRow.querySelectorAll('.tl-chip').forEach((x) => {
            x.classList.remove('is-on');
            x.setAttribute('aria-pressed', 'false');
          });
          b.classList.add('is-on');
          b.setAttribute('aria-pressed', 'true');
        },
      }, h('b', null, label));
      lenRow.append(b);
    });

    const freeRun = () => {
      clearTyper();
      const toks = tokens();
      const score = (w) => toks.reduce((n, t) => n + (w.includes(t) ? 1 : 0), 0);
      const text = pickFromPool(poolFor(toks), view.len, SEEN_FREE, score);
      if (!text) {
        toast('Bu seçim için kelime bulunamadı.');
        return;
      }
      opts.hidden = true;
      runFree(stage, opts, text, toks);
    };
    startBtn.addEventListener('click', freeRun);

    opts.append(
      h('p', { class: 'tl-lead' }, 'Zorlandığın harfleri seç; sadece onları içeren kelimelerle çalış. Aynı kelime tükenene kadar tekrar gelmez.'),
      row('Harfler', SINGLES), row('Kombinasyonlar', COMBOS),
      h('div', { class: 'tl-free-group' }, h('p', { class: 'tl-muted' }, 'Kendi kombinasyonun'),
        customRow,
        h('div', { class: 'tl-free-add' }, input, h('button', { class: 'tl-btn', type: 'button', onclick: addCustom }, 'Ekle'))),
      h('div', { class: 'tl-free-group' }, h('p', { class: 'tl-muted' }, 'Uzunluk'), lenRow),
      sum, h('div', { class: 'tl-res-actions' }, startBtn));
    updateSummary();

    return h('section', { class: 'tl-ws tl-free' },
      h('header', { class: 'tl-ws-head' },
        h('div', { class: 'tl-ws-id' }, h('p', { class: 'tl-eyebrow' }, 'Klavye Dersleri · Ö Ğ Ş Ç Ü İ'), h('h1', { class: 'tl-h1' }, 'Serbest Alıştırma')),
        h('div', { class: 'tl-ws-acts' }, kbButton(), h('button', { class: 'tl-btn is-ghost', type: 'button', onclick: () => go('map') }, 'Ders Haritası'))),
      opts, stage);
  }

  function runFree(stage, opts, text, toks) {
    clearTyper();
    const tHost = h('div', { class: 'tl-typer-host' });
    stage.replaceChildren(h('div', { class: 'tl-banner' }, 'Seçimin: ' + toks.map(trUpper).join(' · ')), tHost);
    typer = mountTyper(tHost, {
      text,
      keyboard: kbWanted(),
      sfx: ctx && ctx.sfx,
      onFinish: (st) => later(() => {
        clearTyper();
        const res = bumpProgress(ctx, st.wpm, st.acc, resultEvent(st, { kind: 'free' }));
        celebrate(false, 0, res.record);
        const again = () => {
          const score = (w) => toks.reduce((n, t) => n + (w.includes(t) ? 1 : 0), 0);
          const t2 = pickFromPool(poolFor(toks), view.len, SEEN_FREE, score);
          runFree(stage, opts, t2 || text, toks);
        };
        const w = weakText(null, st.weakKeys, view.len);
        const acts = h('div', { class: 'tl-res-actions' },
          h('button', { class: 'tl-btn is-primary', type: 'button', onclick: again }, 'Yeni kelimeler'),
          w ? h('button', { class: 'tl-btn', type: 'button', onclick: () => runFree(stage, opts, w.text, w.letters) }, 'Zayıf tuşlarımı çalış') : null,
          h('button', { class: 'tl-btn', type: 'button', onclick: () => { stage.replaceChildren(); opts.hidden = false; } }, 'Seçimi değiştir'),
          backBtn());
        const card = h('div', { class: 'tl-result tl-box', role: 'status' },
          h('p', { class: 'tl-eyebrow' }, 'Serbest Alıştırma · ' + toks.map(trUpper).join(' ')),
          h('h2', null, 'Alıştırma bitti'),
          res.record ? h('div', { class: 'tl-badge' }, 'Yeni kişisel rekor!') : null,
          statGrid(st), weakChips(st), acts);
        stage.replaceChildren(card);
        focusFirst(card);
      }, 350),
    });
  }

  // Ana ekrandan belirli bir ders istendiyse harita yerine doğrudan o dersi aç.
  const startIdx = intentLessonIndex(ctx && ctx.intent, loadAll(ctx));
  if (startIdx >= 0) Object.assign(view, { name: 'lesson', idx: startIdx, preview: false, last: '' });
  render(false);

  return {
    destroy() {
      alive = false;
      timers.forEach(clearTimeout);
      clearTyper();
      root.remove();
    },
  };
}
