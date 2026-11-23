// TuşLab — Klavye dersleri + Serbest Alıştırma (İşçi E).
import {
  mountTyper, ensureStyles, h, fingerName, trLower, trUpper, shuffle, fmtTime, loadAll, bumpProgress,
} from './typing.js';
import * as WD from './data/words.js';
import * as LD from './data/lessons.js';

const WORDS = WD.WORDS || [];
const UNITS = LD.UNITS || [];
const LESSONS = LD.LESSONS || [];
const FINGERS = LD.FINGERS || {};

// Oturum boyunca gösterilen kelimeler (sayfa yenilenene kadar).
const SEEN_FREE = new Set();
const SEEN_WEAK = new Set();
const SEEN_DRILL = new Set();
let kbOn = true;

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

function rate(lesson, st) {
  const gW = lesson.goalWpm || 0;
  const gA = lesson.goalAcc || 0;
  const pass = st.acc >= gA && st.wpm >= gW;
  let stars = 0;
  if (pass) {
    stars = 1;
    if (st.wpm >= gW * 1.25) stars = 2;
    if (st.acc >= 98 && st.wpm >= gW * 1.5) stars = 3;
  }
  return { pass, stars };
}

function starsEl(n) {
  const el = h('span', { class: 'tl-stars', role: 'img', 'aria-label': n + ' yıldız' });
  for (let i = 0; i < 3; i++) el.append(h('i', { class: i < n ? 'on' : '' }, '★'));
  return el;
}

function lessonRec(all, id) {
  return (all.lessons && all.lessons[id]) || { stars: 0, bestWpm: 0, bestAcc: 0 };
}

function keyLabel(k) {
  return k === ' ' ? 'boşluk' : trUpper(k);
}

/* ------------------------------------------------------------------ ana modül */

export function mountLessons(host, ctx) {
  ensureStyles();
  let typer = null;
  let alive = true;
  let boot = null;
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
    if (i <= 0) return true;
    const prev = LESSONS[i - 1];
    return !!prev && lessonRec(loadAll(ctx), prev.id).stars >= 1;
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
    let body;
    if (view.name === 'lesson') body = renderLesson();
    else if (view.name === 'free') body = renderFree();
    else body = renderMap();
    root.replaceChildren(topbar(), body);
    if (scroll) {
      try {
        root.scrollIntoView({ block: 'start' });
      } catch (e) {
        /* yoksay */
      }
    }
    if (boot) {
      const b = boot;
      boot = null;
      b();
    }
  }

  function topbar() {
    const bar = h('div', { class: 'tl-top' },
      h('button', { class: 'tl-btn is-ghost tl-modback', type: 'button', onclick: () => ctx && ctx.back && ctx.back() }, '← Ana Sayfa'));
    if (view.name !== 'map') {
      bar.append(h('button', { class: 'tl-btn is-ghost', type: 'button', onclick: () => go('map') }, 'Ders Haritası'));
    }
    return bar;
  }

  /* ---------------------------------------------------------- ders haritası */

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

    const head = h('header', { class: 'tl-head' },
      h('div', null,
        h('h1', { class: 'tl-h1' }, 'Klavye Dersleri'),
        h('p', { class: 'tl-lead' }, 'Parmaklarını klavyeye alıştır: ders ders ilerle, yıldız topla.')),
      h('div', { class: 'tl-pills' },
        h('span', { class: 'tl-pill' }, h('b', null, done + '/' + LESSONS.length), ' ders'),
        h('span', { class: 'tl-pill' }, h('b', null, String(starSum)), ' yıldız'),
        all.bestWpm ? h('span', { class: 'tl-pill' }, 'Rekor ', h('b', null, String(all.bestWpm)), ' WPM') : null,
        all.streak ? h('span', { class: 'tl-pill' }, h('b', null, String(all.streak)), ' gün seri') : null));
    wrap.append(head);

    const actions = h('div', { class: 'tl-actions' },
      LESSONS.length
        ? h('button', { class: 'tl-btn is-primary', type: 'button', onclick: () => go('lesson', { idx: resumeIdx, preview: false, last: '' }) },
          done ? 'Kaldığın yerden devam et' : 'İlk dersi başlat')
        : null,
      h('button', { class: 'tl-btn', type: 'button', onclick: () => go('free') }, 'Serbest Alıştırma (Ö Ğ Ş Ç Ü İ)'));
    wrap.append(actions);

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

    groups.forEach((g) => {
      if (!g.items.length) return;
      const grid = h('div', { class: 'tl-lgrid' });
      g.items.forEach(({ l, i }) => grid.append(lessonCard(all, l, i)));
      wrap.append(h('section', { class: 'tl-unit' },
        h('div', { class: 'tl-unit-head' }, h('h2', null, g.unit.title), g.unit.desc ? h('p', null, g.unit.desc) : null),
        grid));
    });
    return wrap;
  }

  function lessonCard(all, l, i) {
    const rec = lessonRec(all, l.id);
    const locked = !isUnlocked(i);
    const cls = 'tl-lcard' + (locked ? ' is-locked' : '') + (rec.stars >= 3 ? ' is-gold' : rec.stars > 0 ? ' is-done' : '');
    const keys = h('span', { class: 'tl-lcard-keys' });
    (l.newKeys || []).slice(0, 6).forEach((k) => keys.append(h('kbd', null, trUpper(k))));
    const main = h('button', {
      class: 'tl-lcard-main',
      type: 'button',
      'aria-disabled': locked ? 'true' : null,
      onclick: () => {
        if (locked) {
          const prev = LESSONS[i - 1];
          toast('Kilitli: önce "' + (prev ? prev.title : 'önceki dersi') + '" dersini geç.');
        } else {
          go('lesson', { idx: i, preview: false, last: '' });
        }
      },
    },
    h('span', { class: 'tl-lcard-no' }, locked ? '\u{1F512}︎' : String(i + 1)),
    h('span', { class: 'tl-lcard-title' }, l.title),
    keys,
    h('span', { class: 'tl-lcard-meta' }, starsEl(rec.stars || 0),
      rec.bestWpm ? h('small', null, rec.bestWpm + ' WPM') : h('small', null, 'Hedef ' + (l.goalWpm || '?') + ' WPM')));
    const card = h('div', { class: cls }, main);
    if (locked) {
      card.append(h('button', { class: 'tl-link', type: 'button', onclick: () => go('lesson', { idx: i, preview: true, last: '' }) }, 'Önizle'));
    }
    return card;
  }

  /* ---------------------------------------------------------- ders ekranı */

  function kbButton() {
    const label = () => 'Klavye: ' + (kbOn ? 'açık' : 'kapalı');
    const b = h('button', {
      class: 'tl-btn is-ghost',
      type: 'button',
      'aria-pressed': String(kbOn),
      onclick: () => {
        kbOn = !kbOn;
        b.setAttribute('aria-pressed', String(kbOn));
        b.textContent = label();
        if (typer) typer.setKeyboard(kbOn);
      },
    }, label());
    return b;
  }

  function renderLesson() {
    const lesson = LESSONS[view.idx];
    if (!lesson) {
      view.name = 'map';
      return renderMap();
    }
    const stage = h('div', { class: 'tl-stage' });
    const head = h('header', { class: 'tl-head' },
      h('div', null,
        h('p', { class: 'tl-eyebrow' }, 'Ders ' + (view.idx + 1)),
        h('h1', { class: 'tl-h1' }, lesson.title),
        lesson.desc ? h('p', { class: 'tl-lead' }, lesson.desc) : null),
      h('div', { class: 'tl-pills' },
        h('span', { class: 'tl-pill' }, 'Hedef ', h('b', null, String(lesson.goalWpm || '?')), ' WPM'),
        h('span', { class: 'tl-pill' }, h('b', null, '%' + (lesson.goalAcc || '?')), ' doğruluk'),
        kbButton()));
    const sec = h('section', { class: 'tl-lesson' }, head);
    if (view.preview) {
      sec.append(h('div', { class: 'tl-banner' }, 'Önizleme: bu ders kilitli, sonuçların kaydedilmez. Açmak için önceki dersi geç.'));
    }
    const nk = lesson.newKeys || [];
    if (nk.length) {
      const list = h('div', { class: 'tl-newkeys' });
      nk.forEach((k) => {
        const f = FINGERS[k];
        list.append(h('div', { class: 'tl-newkey' + (f ? ' f-' + f : '') },
          h('kbd', null, trUpper(k)),
          h('div', null, h('strong', null, 'Yeni: ' + keyLabel(k)), f ? h('span', null, ' — ' + fingerName(f)) : null)));
      });
      sec.append(list);
    }
    sec.append(stage);
    boot = () => startAttempt(lesson, stage, {});
    return sec;
  }

  function startAttempt(lesson, stage, opt) {
    clearTyper();
    const text = opt.text || makeDrill(lesson, view.last);
    if (!opt.text) view.last = text;
    const tHost = h('div', { class: 'tl-typer-host' });
    stage.replaceChildren(opt.note ? h('div', { class: 'tl-banner' }, opt.note) : null, tHost);
    typer = mountTyper(tHost, {
      text,
      keyboard: kbOn,
      sfx: ctx && ctx.sfx,
      onFinish: (st) => later(() => finishLesson(lesson, stage, st, opt), 350),
    });
  }

  function statGrid(st) {
    const cell = (v, l) => h('div', { class: 'tl-res-cell' }, h('b', null, String(v)), h('span', null, l));
    return h('div', { class: 'tl-res-grid' },
      cell(st.wpm, 'WPM'), cell(Math.round(st.acc) + '%', 'Doğruluk'), cell(st.errors, 'Hata'), cell(fmtTime(st.elapsedMs), 'Süre'));
  }

  function weakChips(st) {
    const ent = Object.entries(st.weakKeys || {}).slice(0, 6);
    if (!ent.length) return h('p', { class: 'tl-muted' }, 'Hiç hata yapmadın, harika.');
    const row = h('div', { class: 'tl-chip-row' });
    ent.forEach(([k, n]) => row.append(h('span', { class: 'tl-chip is-weak' }, h('b', null, keyLabel(k)), ' ×' + n)));
    return h('div', { class: 'tl-weak' }, h('p', { class: 'tl-muted' }, 'Zorlandığın tuşlar'), row);
  }

  function finishLesson(lesson, stage, st, opt) {
    clearTyper();
    const weakBtnFor = (len) => {
      const w = weakText(lesson, st.weakKeys, len);
      return w;
    };

    // Zayıf tuş alıştırması: ders puanını etkilemez.
    if (opt.weak) {
      const res = bumpProgress(ctx, st.wpm, st.acc);
      celebrate(false, 0, res.record);
      const w = weakBtnFor(120);
      const acts = h('div', { class: 'tl-res-actions' },
        w ? h('button', { class: 'tl-btn is-primary', type: 'button',
          onclick: () => startAttempt(lesson, stage, { text: w.text, weak: true, note: 'Zayıf tuş alıştırması: ' + w.letters.map(trUpper).join(' ') }) }, 'Yeni zayıf tuş alıştırması') : null,
        h('button', { class: 'tl-btn', type: 'button', onclick: () => startAttempt(lesson, stage, {}) }, 'Derse dön'));
      stage.replaceChildren(h('div', { class: 'tl-result tl-panel' },
        h('h2', null, 'Zayıf tuş alıştırması bitti'),
        res.record ? h('div', { class: 'tl-badge' }, 'Yeni rekor!') : null,
        statGrid(st), weakChips(st), acts));
      return;
    }

    const r = rate(lesson, st);
    let record = false;
    let first = false;
    if (!view.preview) {
      let old;
      const res = bumpProgress(ctx, st.wpm, st.acc, (all) => {
        const recs = Object.assign({}, all.lessons || {});
        old = recs[lesson.id] || { stars: 0, bestWpm: 0, bestAcc: 0 };
        recs[lesson.id] = {
          stars: Math.max(old.stars || 0, r.stars),
          bestWpm: Math.max(old.bestWpm || 0, st.wpm),
          bestAcc: Math.max(old.bestAcc || 0, st.acc),
        };
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
        class: 'tl-btn' + (r.pass ? ' is-primary' : ''),
        type: 'button',
        disabled: nextOpen ? null : 'disabled',
        title: nextOpen ? '' : 'Önce hedefi geç',
        onclick: () => go('lesson', { idx: nextIdx, preview: false, last: '' }),
      }, 'Sonraki ders →'));
    }
    acts.append(h('button', { class: 'tl-btn' + (r.pass || !hasNext ? '' : ' is-primary'), type: 'button', onclick: () => startAttempt(lesson, stage, {}) }, 'Tekrar'));
    const w = weakBtnFor(120);
    if (w) {
      acts.append(h('button', {
        class: 'tl-btn', type: 'button',
        onclick: () => startAttempt(lesson, stage, { text: w.text, weak: true, note: 'Zayıf tuş alıştırması: ' + w.letters.map(trUpper).join(' ') }),
      }, 'Zayıf tuşlarımı çalış'));
    }

    const msg = r.pass
      ? (r.stars >= 3 ? 'Mükemmel! Üç yıldız.' : first && !view.preview ? 'Ders geçildi, yenisi açıldı!' : 'Ders geçildi.')
      : 'Hedefe az kaldı: ' + (lesson.goalWpm || 0) + ' WPM ve %' + (lesson.goalAcc || 0) + ' doğruluk gerekli.';
    stage.replaceChildren(h('div', { class: 'tl-result tl-panel' + (r.pass ? ' is-pass' : '') },
      h('h2', null, msg),
      starsEl(r.stars),
      record ? h('div', { class: 'tl-badge' }, 'Yeni kişisel rekor!') : null,
      view.preview ? h('p', { class: 'tl-muted' }, 'Önizleme olduğu için kaydedilmedi.') : null,
      statGrid(st), weakChips(st), acts));
  }

  /* ---------------------------------------------------------- serbest alıştırma */

  const SINGLES = ['ö', 'ğ', 'ş', 'ç', 'ü', 'ı', 'i'];
  const COMBOS = ['ğı', 'şç', 'öğ', 'çö', 'üğ', 'şı', 'ığ', 'öç', 'üş', 'çı', 'ğü', 'ış'];

  const poolFor = (tokens) => (tokens.length ? WORDS.filter((w) => tokens.some((t) => w.includes(t))) : []);

  function renderFree() {
    const sum = h('p', { class: 'tl-muted tl-free-sum' });
    const startBtn = h('button', { class: 'tl-btn is-primary', type: 'button' }, 'Başla');
    const stage = h('div', { class: 'tl-stage' });
    const opts = h('div', { class: 'tl-panel tl-free-opts' });
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
      h('h2', null, 'Serbest Alıştırma'),
      h('p', { class: 'tl-lead' }, 'Zorlandığın harfleri seç; sadece onları içeren kelimelerle çalış. Aynı kelime tükenene kadar tekrar gelmez.'),
      row('Harfler', SINGLES), row('Kombinasyonlar', COMBOS),
      h('div', { class: 'tl-free-group' }, h('p', { class: 'tl-muted' }, 'Kendi kombinasyonun'),
        customRow,
        h('div', { class: 'tl-free-add' }, input, h('button', { class: 'tl-btn', type: 'button', onclick: addCustom }, 'Ekle'))),
      h('div', { class: 'tl-free-group' }, h('p', { class: 'tl-muted' }, 'Uzunluk'), lenRow),
      sum, h('div', { class: 'tl-res-actions' }, startBtn));
    updateSummary();

    return h('section', { class: 'tl-free' },
      h('header', { class: 'tl-head' }, h('div', null, h('p', { class: 'tl-eyebrow' }, 'Ö Ğ Ş Ç Ü İ'), h('h1', { class: 'tl-h1' }, 'Serbest Alıştırma')), h('div', { class: 'tl-pills' }, kbButton())),
      opts, stage);
  }

  function runFree(stage, opts, text, toks) {
    clearTyper();
    const tHost = h('div', { class: 'tl-typer-host' });
    stage.replaceChildren(h('div', { class: 'tl-banner' }, 'Seçimin: ' + toks.map(trUpper).join(' · ')), tHost);
    typer = mountTyper(tHost, {
      text,
      keyboard: kbOn,
      sfx: ctx && ctx.sfx,
      onFinish: (st) => later(() => {
        clearTyper();
        const res = bumpProgress(ctx, st.wpm, st.acc);
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
          h('button', { class: 'tl-btn', type: 'button', onclick: () => { stage.replaceChildren(); opts.hidden = false; } }, 'Seçimi değiştir'));
        stage.replaceChildren(h('div', { class: 'tl-result tl-panel' },
          h('h2', null, 'Alıştırma bitti'),
          res.record ? h('div', { class: 'tl-badge' }, 'Yeni kişisel rekor!') : null,
          statGrid(st), weakChips(st), acts));
      }, 350),
    });
  }

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
