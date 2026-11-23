// TuşLab — Edebiyat ile yazma: şiir, atasözü, deyim, tekerleme, özdeyiş (İşçi E).
// Her kategori tek düğmedir: basınca o kategorinin metinleri, önce zor olanlar, karışık ve tekrarsız
// biçimde ara ekran olmadan art arda gelir. Oturum yalnız "Bitir" ya da Esc ile biter; sonra tek özet.
import { mountTyper, ensureStyles, h, fmtTime, loadAll, bumpProgress } from './typing.js';
import { createStream, itemsFor } from './arena.js';
import * as T from './data/texts.js';

const POEMS = T.POEMS || [];
const PROVERBS = T.PROVERBS || [];

const cleanLine = (s) => String(s == null ? '' : s).replace(/\s*\/\s*$/, '').replace(/\s+/g, ' ').trim();

export const CATEGORIES = [
  { id: 'atasozu', label: 'Atasözleri', icon: '🧿', desc: 'Önce uzun, noktalamalı ve zincirli atasözleri.' },
  { id: 'deyim', label: 'Deyimler', icon: '💬', desc: 'Deyim ve anlamı birlikte, art arda.' },
  { id: 'tekerleme', label: 'Tekerlemeler', icon: '🌀', desc: 'Dil ve parmak döndüren cümleler.' },
  { id: 'ozdeyis', label: 'Özdeyişler', icon: '✨', desc: 'Yunus Emre, Hacı Bektaş, Atatürk ve diğerleri.' },
  { id: 'siir', label: 'Şiirler', icon: '🪶', desc: 'Kıta kıta: İstiklal Marşı, Yunus Emre, halk şiiri.' },
];

// Kategori başına oturumlar arası süren akış: yeni oturum kaldığı yerden, tekrarsız devam eder.
const STREAMS = new Map();
function streamOf(cat) {
  if (!STREAMS.has(cat)) STREAMS.set(cat, createStream(cat));
  return STREAMS.get(cat);
}
let kbOn = false;

/* ------------------------------------------------------------------ günün satırı */

function mix(n) {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

export function dailyLine() {
  const d = new Date();
  const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  const poems = POEMS.filter((p) => p && Array.isArray(p.lines) && p.lines.some((l) => cleanLine(l)));
  const hard = PROVERBS.filter((p) => p && p.text && (Number(p.level) || 0) >= 3);
  const poemLine = () => {
    const p = poems[mix(day) % poems.length];
    const lines = p.lines.map(cleanLine).filter(Boolean);
    // Ardışık iki dize (beyit) — tek dize günlük yazma için çok kısa kalıyordu.
    const i = mix(day * 31 + 7) % Math.max(1, lines.length - 1);
    const pair = lines.slice(i, i + 2).join(', ').replace(/[,;:]\s*,/g, ',');
    return {
      text: pair,
      source: [p.author, p.title].filter(Boolean).join(' — ') || 'Şiir',
    };
  };
  const proverb = () => ({ text: hard[mix(day * 17 + 3) % hard.length].text, source: 'Atasözü' });
  if (day % 2 === 0) {
    if (poems.length) return poemLine();
    if (hard.length) return proverb();
  } else {
    if (hard.length) return proverb();
    if (poems.length) return poemLine();
  }
  return { text: 'Damlaya damlaya göl olur.', source: 'Atasözü' };
}

/* ------------------------------------------------------------------ ana modül */

export function mountLiterature(host, ctx) {
  ensureStyles();
  let typer = null;
  let alive = true;
  let session = null; // { cat, recent: [], startedAt }
  const root = h('div', { class: 'tl-edu tl-page tl-lit' });
  host.replaceChildren(root);

  const clearTyper = () => {
    if (typer) {
      typer.destroy();
      typer = null;
    }
  };
  const voice = (n) => {
    try {
      const s = ctx && ctx.sfx;
      if (s && s.voice) s.voice(n);
    } catch (e) {
      /* yoksay */
    }
  };
  const scrollTop = () => {
    try {
      root.scrollIntoView({ block: 'start' });
    } catch (e) {
      /* yoksay */
    }
  };

  // Esc: oturum açıkken ana sayfaya dönmek yerine oturumu bitirir (home.js defaultPrevented'a bakar).
  const onKey = (e) => {
    if (e.key !== 'Escape' || !session || !typer) return;
    e.preventDefault();
    typer.stop();
  };
  document.addEventListener('keydown', onKey, true);

  function topbar(extra) {
    return h('div', { class: 'tl-top' },
      h('button', { class: 'tl-btn is-ghost tl-modback', type: 'button', onclick: () => ctx && ctx.back && ctx.back() }, '← Ana Sayfa'),
      extra || null);
  }

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
        if (typer) {
          typer.setKeyboard(kbOn);
          typer.focus();
        }
      },
    }, label());
    return b;
  }

  /* ---------------------------------------------------------- kategori menüsü */

  function renderMenu() {
    clearTyper();
    session = null;
    const all = loadAll(ctx);
    const recs = all.litStreams || {};
    const grid = h('div', { class: 'tl-lit-cats' });
    CATEGORIES.forEach((c) => {
      const n = itemsFor(c.id).length;
      const r = recs[c.id];
      grid.append(h('button', {
        class: 'tl-lit-cat',
        type: 'button',
        dataset: { cat: c.id },
        onclick: () => startSession(c.id),
      },
      h('span', { class: 'tl-lit-cat-ic', 'aria-hidden': 'true' }, c.icon),
      h('b', null, c.label),
      h('small', null, c.desc),
      h('span', { class: 'tl-lit-cat-meta' }, n + ' metin' + (r && r.best ? ' · en iyi ' + r.best.wpm + ' WPM' : ''), h('i', null, 'Başla →'))));
    });
    root.replaceChildren(topbar(),
      h('header', { class: 'tl-head' },
        h('div', null, h('h1', { class: 'tl-h1' }, 'Edebiyatla Yaz'),
          h('p', { class: 'tl-lead' }, 'Bir kategori seç ve durmadan yaz: metinler önce zor olanlardan başlayarak, tekrar etmeden art arda gelir. Bitirmek için “Bitir” ya da Esc.'))),
      grid);
  }

  /* ---------------------------------------------------------- kesintisiz oturum */

  function startSession(cat) {
    const c = CATEGORIES.find((x) => x.id === cat) || CATEGORIES[0];
    const stream = streamOf(c.id);
    clearTyper();
    session = { cat: c.id, recent: [] };
    const srcEl = h('p', { class: 'tl-lit-src', 'aria-live': 'polite' }, '');
    const recentEl = h('ol', { class: 'tl-lit-recent', 'aria-label': 'Son yazılanlar' });
    const tHost = h('div', { class: 'tl-typer-host' });
    root.replaceChildren(
      topbar(h('button', { class: 'tl-btn is-ghost', type: 'button', onclick: () => renderMenu() }, 'Kategoriler')),
      h('section', { class: 'tl-lesson tl-lit-session', dataset: { cat: c.id } },
        h('header', { class: 'tl-head' },
          h('div', null, h('p', { class: 'tl-eyebrow' }, c.icon + ' Kesintisiz yazma'), h('h1', { class: 'tl-h1' }, c.label), srcEl),
          h('div', { class: 'tl-pills' }, kbButton())),
        tHost, recentEl));
    scrollTop();
    const show = (it) => {
      srcEl.textContent = it && it.source ? '— ' + it.source : '';
    };
    typer = mountTyper(tHost, {
      text: '',
      keyboard: kbOn,
      sfx: ctx && ctx.sfx,
      stream: () => stream.next(),
      onChunk: ({ item, done }) => {
        show(item);
        if (done) {
          session.recent.unshift(done.text);
          if (session.recent.length > 3) session.recent.length = 3;
          recentEl.replaceChildren(...session.recent.map((t) => h('li', null, t)));
        }
      },
      onFinish: (st) => {
        if (!alive) return;
        later(() => summary(c, st));
      },
    });
    show(typer.item);
  }

  const later = (fn) => setTimeout(() => alive && fn(), 0);

  function statGrid(st) {
    const cell = (v, l) => h('div', { class: 'tl-res-cell' }, h('b', null, String(v)), h('span', null, l));
    return h('div', { class: 'tl-res-grid is-5' },
      cell(st.wpm, 'WPM'), cell(Math.round(st.acc) + '%', 'Doğruluk'), cell(st.chunks || 0, 'Metin'),
      cell(st.errors, 'Hata'), cell(fmtTime(st.elapsedMs), 'Süre'));
  }

  function summary(c, st) {
    clearTyper();
    session = null;
    if (!st || !(st.typed > 0)) {
      renderMenu();
      return;
    }
    let isBest = false;
    const res = bumpProgress(ctx, st.wpm, st.acc, (all) => {
      const recs = Object.assign({}, all.litStreams || {});
      const r = Object.assign({ runs: 0, items: 0 }, recs[c.id] || {});
      r.runs += 1;
      r.items += st.chunks || 0;
      r.last = { wpm: st.wpm, acc: st.acc, ms: st.elapsedMs, n: st.chunks || 0 };
      if ((st.chunks || 0) >= 1 && st.acc >= 85 && (!r.best || st.wpm > r.best.wpm)) {
        r.best = r.last;
        isBest = true;
      }
      recs[c.id] = r;
      all.litStreams = recs;
    });
    if (res.record || isBest) voice('record');
    else if (st.acc >= 97) voice('great');
    else voice('lesson');
    root.replaceChildren(topbar(),
      h('section', { class: 'tl-lesson' },
        h('div', { class: 'tl-result tl-panel is-pass', role: 'status' },
          h('p', { class: 'tl-eyebrow' }, c.icon + ' ' + c.label),
          h('h2', null, 'Oturum bitti'),
          isBest ? h('div', { class: 'tl-badge' }, 'Bu kategoride en iyi hızın!') : res.record ? h('div', { class: 'tl-badge' }, 'Yeni kişisel rekor!') : null,
          statGrid(st),
          h('div', { class: 'tl-res-actions' },
            h('button', { class: 'tl-btn is-primary', type: 'button', onclick: () => startSession(c.id) }, 'Devam et (yeni metinler)'),
            h('button', { class: 'tl-btn', type: 'button', onclick: () => renderMenu() }, 'Kategoriler')))));
    scrollTop();
  }

  // Ana ekrandaki tür çipi ctx.intent = { cat: 'deyim' } gönderir: kategori menüsü atlanır, o türün akışı hemen başlar.
  const startCat = ctx && ctx.intent && typeof ctx.intent.cat === 'string' ? ctx.intent.cat : '';
  if (CATEGORIES.some((c) => c.id === startCat)) startSession(startCat);
  else renderMenu();

  return {
    destroy() {
      alive = false;
      document.removeEventListener('keydown', onKey, true);
      clearTyper();
      root.remove();
    },
  };
}
