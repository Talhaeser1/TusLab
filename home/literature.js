// TuşLab — Edebiyat ile yazma: şiir, atasözü, deyim, tekerleme, özdeyiş (İşçi E; Edip cilası 24 Kas 2026).
// Her kategori tek düğmedir: basınca o kategorinin metinleri, önce zor olanlar, karışık ve tekrarsız
// biçimde ara ekran olmadan art arda gelir. Oturum yalnız "Bitir" ya da Esc ile biter; sonra tek özet.
// Şiirde yazılan dize kıta kutusunda vurgulanır; deyimde kalıp ve anlamı ayrı kutuda görünür.
import { mountTyper, ensureStyles, h, fmtTime, loadAll, bumpProgress } from './typing.js';
import { createStream, itemsFor } from './arena.js';
import * as T from './data/texts.js';

const POEMS = T.POEMS || [];
const PROVERBS = T.PROVERBS || [];

const cleanLine = (s) => String(s == null ? '' : s).replace(/\s*\/\s*$/, '').replace(/\s+/g, ' ').trim();

// Sıra ve renkler ana ekrandaki "Edebiyatla yaz" kartlarıyla aynı (home.css .tlh-lit--<id>: --acc rengi, --motif SVG'si).
export const CATEGORIES = [
  { id: 'atasozu', label: 'Atasözleri', unit: 'atasözü', desc: 'Önce uzun, noktalamalı ve zincirli atasözleri.' },
  { id: 'deyim', label: 'Deyimler', unit: 'deyim', desc: 'Deyim ve anlamı birlikte, art arda.' },
  { id: 'siir', label: 'Şiirler', unit: 'şiir', desc: 'Kıta kıta: İstiklal Marşı, Yunus Emre, halk şiiri.' },
  { id: 'tekerleme', label: 'Tekerlemeler', unit: 'tekerleme', desc: 'Dil ve parmak döndüren cümleler.' },
  { id: 'ozdeyis', label: 'Özdeyişler', unit: 'özdeyiş', desc: 'Yunus Emre, Hacı Bektaş, Atatürk ve diğerleri.' },
];
const motif = () => h('span', { class: 'tlh-lit-ic', 'aria-hidden': 'true' });

// Şiir öğesi (arena.js itemsFor: id = 'p:' + (id || başlık)) → özgün dizeler; kıta kutusu bunları dize dize gösterir.
const POEM_LINES = new Map();
for (const p of POEMS) {
  if (p && Array.isArray(p.lines)) POEM_LINES.set('p:' + (p.id || p.title), p.lines.map(cleanLine).filter(Boolean));
}
// Yazılan tek satırda her dizenin başladığı konum (arena.js joinLines ile aynı kural: noktalamasız dize sonuna virgül).
export function lineStarts(lines) {
  const out = [];
  let off = 0;
  lines.forEach((l, i) => {
    out.push(off);
    const add = i < lines.length - 1 && !/[.,;:!?…]$/.test(l) ? 1 : 0;
    off += Array.from(l).length + add + 1;
  });
  return out;
}
// Konumdaki dize sırası.
export function lineAt(starts, pos) {
  let k = 0;
  while (k + 1 < starts.length && starts[k + 1] <= pos) k++;
  return k;
}

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
  let session = null; // { cat, recent: [] }
  let sumFor = ''; // sonuç ekranındaki tür (Enter = aynı türde devam)
  const root = h('div', { class: 'tl-edu tl-page tl-lit' });
  host.replaceChildren(root);

  // Ana ekrandaki tür kartı ctx.intent = { cat: 'deyim' } gönderir: tür menüsü atlanır, o türün akışı hemen başlar.
  const startCat = ctx && ctx.intent && typeof ctx.intent.cat === 'string' ? ctx.intent.cat : '';
  const fromHome = CATEGORIES.some((c) => c.id === startCat);

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
  // Sonuç ekranında Enter: aynı türde devam (odak bir düğmedeyse düğmenin kendisi çalışır).
  const onKey = (e) => {
    if (e.key === 'Enter' && !session && sumFor && !(e.target && e.target.closest && e.target.closest('button,a,input,textarea'))) {
      e.preventDefault();
      startSession(sumFor);
      return;
    }
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

  const recOf = (id) => {
    const r = (loadAll(ctx).litStreams || {})[id] || {};
    return { items: Number(r.items) || 0, best: (r.best && Number(r.best.wpm)) || 0 };
  };

  /* ---------------------------------------------------------- tür menüsü */

  function renderMenu() {
    clearTyper();
    session = null;
    sumFor = '';
    const grid = h('div', { class: 'tl-lit-cats' });
    CATEGORIES.forEach((c) => {
      const n = itemsFor(c.id).length;
      const { items, best } = recOf(c.id);
      const pct = items ? Math.max(4, Math.min(100, Math.round((items / Math.max(1, n)) * 100))) : 0;
      grid.append(h('button', {
        class: 'tl-lit-cat tlh-lit-chip tlh-lit--' + c.id,
        type: 'button',
        dataset: { cat: c.id },
        'aria-label': c.label + ', başla (' + n + ' ' + c.unit + (items ? ', ' + items + ' metin yazdın' : '') + (best ? ', en iyi ' + best + ' WPM' : '') + ')',
        onclick: () => startSession(c.id),
      },
      h('span', { class: 'tlh-lit-row' }, motif(), h('span', { class: 'tlh-lit-go' }, 'Başla ', h('span', { 'aria-hidden': 'true' }, '→'))),
      h('b', { class: 'tlh-lit-name' }, c.label),
      h('span', { class: 'tlh-lit-ex tl-lit-desc' }, c.desc),
      h('span', { class: 'tlh-lit-foot' },
        h('span', { class: 'tlh-lit-bar', 'aria-hidden': 'true' }, h('i', { style: 'width:' + pct + '%' })),
        h('span', { class: 'tlh-lit-p' }, n + ' ' + c.unit + (items ? ' · ' + items + ' yazdın' : '') + (best ? ' · en iyi ' + best + ' WPM' : '')))));
    });
    root.replaceChildren(topbar(),
      h('header', { class: 'tl-head' },
        h('div', null, h('h1', { class: 'tl-h1' }, 'Edebiyatla Yaz'),
          h('p', { class: 'tl-lead' }, 'Bir tür seç ve durmadan yaz: metinler önce zor olanlardan başlayarak, tekrar etmeden art arda gelir. Bitirmek için “Bitir” ya da Esc.'))),
      grid);
  }

  /* ---------------------------------------------------------- kesintisiz oturum */

  function startSession(cat) {
    const c = CATEGORIES.find((x) => x.id === cat) || CATEGORIES[0];
    const stream = streamOf(c.id);
    clearTyper();
    sumFor = '';
    session = { cat: c.id, recent: [] };
    const srcEl = h('p', { class: 'tl-lit-src', 'aria-live': 'polite' }, '');
    const recentEl = h('ol', { class: 'tl-lit-recent', 'aria-label': 'Son yazılanlar' });
    const recentBox = h('section', { class: 'tl-lit-box tl-lit-recentbox', hidden: true }, h('p', { class: 'tl-lit-cap' }, 'Son yazdıkların'), recentEl);
    // Şiirde kıta kutusu (dize dize, yazılan dize vurgulu); deyimde kalıp + anlam kutusu.
    const ctxEl = h('section', { class: 'tl-lit-box tl-lit-ctx', hidden: true });
    const tHost = h('div', { class: 'tl-typer-host' });
    root.replaceChildren(
      topbar(h('button', { class: 'tl-btn is-ghost', type: 'button', onclick: () => renderMenu() }, 'Tüm türler')),
      h('section', { class: 'tl-lesson tl-lit-session tlh-lit--' + c.id, dataset: { cat: c.id } },
        h('header', { class: 'tl-head' },
          h('div', { class: 'tl-lit-title' }, motif(),
            h('div', null, h('p', { class: 'tl-eyebrow' }, 'Kesintisiz yazma'), h('h1', { class: 'tl-h1' }, c.label), srcEl)),
          h('div', { class: 'tl-pills' }, kbButton())),
        tHost,
        h('div', { class: 'tl-lit-below' }, ctxEl, recentBox)));
    scrollTop();

    let chunkBase = 0;
    let dizeEls = [];
    let starts = [];
    let curDize = -1;
    const markDize = (pos) => {
      if (!dizeEls.length) return;
      const k = lineAt(starts, pos);
      if (k === curDize) return;
      dizeEls.forEach((el, j) => {
        el.classList.toggle('is-done', j < k);
        el.classList.toggle('is-cur', j === k);
      });
      curDize = k;
    };
    const showCtx = (it) => {
      dizeEls = [];
      starts = [];
      curDize = -1;
      const lines = c.id === 'siir' && it ? POEM_LINES.get(it.id) : null;
      if (lines && lines.length > 1) {
        starts = lineStarts(lines);
        dizeEls = lines.map((l) => h('span', { class: 'tl-lit-dize' }, l));
        ctxEl.replaceChildren(h('p', { class: 'tl-lit-cap' }, 'Kıta · ' + lines.length + ' dize'), h('div', { class: 'tl-lit-kita' }, dizeEls));
        ctxEl.hidden = false;
        markDize(0);
        return;
      }
      const k = c.id === 'deyim' && it && it.text ? it.text.indexOf(': ') : -1;
      if (k > 0) {
        ctxEl.replaceChildren(
          h('p', { class: 'tl-lit-cap' }, 'Deyim'), h('p', { class: 'tl-lit-deyim' }, it.text.slice(0, k)),
          h('p', { class: 'tl-lit-cap' }, 'Anlamı'), h('p', { class: 'tl-lit-anlam' }, it.text.slice(k + 2)));
        ctxEl.hidden = false;
        return;
      }
      ctxEl.hidden = true;
      ctxEl.replaceChildren();
    };
    const show = (it) => {
      srcEl.textContent = it && it.source ? it.source : '';
      showCtx(it);
    };
    typer = mountTyper(tHost, {
      text: '',
      keyboard: kbOn,
      sfx: ctx && ctx.sfx,
      stream: () => stream.next(),
      onChunk: ({ item, done, stats }) => {
        chunkBase = stats && stats.typed ? stats.typed : 0;
        show(item);
        if (done) {
          session.recent.unshift(done.text);
          if (session.recent.length > 3) session.recent.length = 3;
          recentEl.replaceChildren(...session.recent.map((t) => h('li', null, t)));
          recentBox.hidden = false;
        }
      },
      onProgress: (st) => markDize(Math.max(0, ((st && st.typed) || 0) - chunkBase)),
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
      // Hiç yazmadan Esc/Bitir: ana ekrandaki karttan gelindiyse ana ekrana dön, yoksa tür menüsü.
      if (fromHome && ctx && ctx.back) ctx.back();
      else renderMenu();
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
    const rec = recOf(c.id);
    const next = h('button', { class: 'tl-btn is-primary tl-lit-next', type: 'button', onclick: () => startSession(c.id) }, 'Devam et (yeni metinler)');
    root.replaceChildren(topbar(),
      h('section', { class: 'tl-lesson tl-lit-sum tlh-lit--' + c.id },
        h('div', { class: 'tl-result tl-panel is-pass', role: 'status' },
          motif(),
          h('p', { class: 'tl-eyebrow' }, c.label),
          h('h2', null, 'Oturum bitti'),
          isBest ? h('div', { class: 'tl-badge' }, 'Bu türde en iyi hızın!') : res.record ? h('div', { class: 'tl-badge' }, 'Yeni kişisel rekor!') : null,
          statGrid(st),
          h('p', { class: 'tl-lit-saved' }, 'Kaydedildi · bu türde toplam ' + rec.items + ' metin' + (rec.best ? ' · en iyi ' + rec.best + ' WPM' : '')),
          h('div', { class: 'tl-res-actions' },
            next,
            h('button', { class: 'tl-btn', type: 'button', onclick: () => renderMenu() }, 'Tüm türler'),
            ctx && ctx.back ? h('button', { class: 'tl-btn is-ghost', type: 'button', onclick: () => ctx.back() }, 'Ana ekran') : null),
          h('p', { class: 'tl-lit-keys' }, 'Enter: devam · Esc: ana ekran'))));
    sumFor = c.id;
    scrollTop();
  }

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
