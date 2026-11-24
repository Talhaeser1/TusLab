// TuşLab — Edebiyat ile yazma: şiir, atasözü, deyim, tekerleme, özdeyiş (İşçi E; Edip cilası 24 Kas 2026).
// Her kategori tek düğmedir: basınca o kategorinin metinleri, önce zor olanlar, karışık ve tekrarsız
// biçimde ara ekran olmadan art arda gelir. Oturum yalnız "Bitir" ya da Esc ile biter; sonra tek özet.
// Şiirde yazılan dize kıta kutusunda vurgulanır; deyimde kalıp ve anlamı ayrı kutuda görünür.
import { mountTyper, ensureStyles, h, fmtTime, loadAll, bumpProgress, kbWanted, kbToggle } from './typing.js';
import { createStream, itemsFor, dailyQuote } from './arena.js';
import * as T from './data/texts.js';

const POEMS = T.POEMS || [];

const cleanLine = (s) => String(s == null ? '' : s).replace(/\s*\/\s*$/, '').replace(/\s+/g, ' ').trim();

// Sıra ve renkler ana ekrandaki "Edebiyatla yaz" kartlarıyla aynı (home.css .tlh-lit--<id>: --acc rengi, --motif SVG'si).
const CATEGORIES = [
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

// Tür menüsü (Derleyici, 24 Kas 2026): tür başına öğeler bir kez hesaplanır (5 tür ≈ 6 ms); örnek satır her açılışta rastgele.
const ITEMS = new Map();
function itemsOf(cat) {
  if (!ITEMS.has(cat)) {
    let list = [];
    try { list = itemsFor(cat) || []; } catch (e) { list = []; }
    ITEMS.set(cat, list);
  }
  return ITEMS.get(cat);
}
// Karttaki örnek satır yalnız var olan içerikten: şiirde ilk iki dize, deyimde kalıp + anlam, diğerlerinde kısa bir metin.
function sampleOf(cat) {
  const list = itemsOf(cat);
  if (!list.length) return null;
  const short = list.filter((it) => it.text.length <= 96);
  const it = (short.length ? short : list)[Math.floor(Math.random() * (short.length || list.length))];
  if (cat === 'siir') {
    const ls = POEM_LINES.get(it.id);
    return { text: ls && ls.length > 1 ? ls.slice(0, 2).join(' / ') : it.text, by: it.source || '' };
  }
  if (cat === 'deyim') {
    const k = it.text.indexOf(': ');
    return k > 0 ? { head: it.text.slice(0, k), text: it.text.slice(k + 2) } : { text: it.text };
  }
  return { text: it.text, by: cat === 'ozdeyis' ? it.source || '' : '' };
}
const DAY = 86400000;
function whenText(t) {
  if (!t) return '';
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const diff = Math.floor((d0.getTime() - new Date(t).setHours(0, 0, 0, 0)) / DAY);
  return diff <= 0 ? 'bugün' : diff === 1 ? 'dün' : diff + ' gün önce';
}

// Kategori başına oturumlar arası süren akış: yeni oturum kaldığı yerden, tekrarsız devam eder.
const STREAMS = new Map();
function streamOf(cat) {
  if (!STREAMS.has(cat)) STREAMS.set(cat, createStream(cat));
  return STREAMS.get(cat);
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
    if (!session && !sumFor && menuGrid && menuGrid.isConnected && /^(Arrow(Up|Down|Left|Right)|Home|End)$/.test(e.key)
      && !e.altKey && !e.ctrlKey && !e.metaKey && (root.contains(e.target) || e.target === document.body)
      && !(e.target && e.target.closest && e.target.closest('input,textarea,select'))) {
      if (menuMove(e.key)) e.preventDefault();
      return;
    }
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

  // Ekran klavyesi tercihi üç yazma ekranında ortak ve kalıcı (typing.js kbToggle).
  function kbButton() {
    return kbToggle((on) => {
      if (typer) {
        typer.setKeyboard(on);
        typer.focus();
      }
    });
  }

  const recOf = (id) => {
    const r = (loadAll(ctx).litStreams || {})[id] || {};
    return { items: Number(r.items) || 0, best: (r.best && Number(r.best.wpm)) || 0 };
  };

  /* ---------------------------------------------------------- tür menüsü */

  // Tür menüsü (Derleyici, 24 Kas 2026; docs/26): geniş ekranda sayfayı dolduran bento. Üstte başlık + "Günün sözü"
  // şeridi, ortada 2 büyük + 3 orta tür kartı (örnek satır, sayı, ilerleme, en iyi hız, "Başla"), altta "Son yazdıkların"
  // ya da kısa ipucu. ≤900 px iki sütun, ≤600 px tek sütun (home.css .tl-litm). Ok tuşları kartlar arasında gezinir.
  let menuGrid = null;
  function renderMenu(focusCat) {
    clearTyper();
    session = null;
    sumFor = '';
    const recs = loadAll(ctx).litStreams || {};
    const grid = h('div', { class: 'tl-litm-grid', role: 'group', 'aria-label': 'Edebiyat türleri (ok tuşlarıyla seç, Enter ile başla)' });
    let total = 0;
    const cards = [];
    CATEGORIES.forEach((c, i) => {
      const n = itemsOf(c.id).length;
      total += n;
      const { items, best } = recOf(c.id);
      const pct = items ? Math.max(4, Math.min(100, Math.round((items / Math.max(1, n)) * 100))) : 0;
      const ex = sampleOf(c.id);
      const exId = 'tl-litm-ex-' + c.id;
      const card = h('button', {
        class: 'tl-lit-cat tl-litm-card tlh-lit-chip tlh-lit--' + c.id + (i < 2 ? ' is-big' : ''),
        type: 'button',
        dataset: { cat: c.id },
        'aria-label': c.label + ', başla (' + n + ' ' + c.unit + (items ? ', ' + items + ' metin yazdın' : '') + (best ? ', en iyi ' + best + ' WPM' : '') + ')',
        'aria-describedby': ex ? exId : null,
        onclick: () => startSession(c.id),
      },
      h('span', { class: 'tlh-lit-row' }, motif(), h('b', { class: 'tlh-lit-name' }, c.label), h('span', { class: 'tl-litm-n' }, n + ' ' + c.unit)),
      h('span', { class: 'tlh-lit-ex tl-lit-desc' }, c.desc),
      ex ? h('span', { class: 'tl-litm-ex', id: exId },
        ex.head ? h('b', null, ex.head) : null, ex.head ? ' — ' : null, ex.text,
        ex.by ? h('small', null, ' — ' + ex.by) : null) : null,
      h('span', { class: 'tlh-lit-foot' },
        h('span', { class: 'tlh-lit-bar', 'aria-hidden': 'true' }, h('i', { style: 'width:' + pct + '%' })),
        h('span', { class: 'tl-litm-go-row' },
          h('span', { class: 'tl-litm-stats' },
            h('span', null, h('b', null, String(items)), ' metin yazdın'),
            h('span', null, h('b', null, best ? best + ' WPM' : '—'), ' en iyi hız')),
          h('span', { class: 'tlh-lit-go' }, 'Başla ', h('span', { 'aria-hidden': 'true' }, '→')))));
      cards.push(card);
      grid.append(card);
    });
    menuGrid = grid;

    // Günün sözü: ana ekran kartındakiyle aynı söz (arena.js dailyQuote, gün içinde sabit); düğme o türü açar.
    let q = null;
    try { q = dailyQuote(); } catch (e) { q = null; }
    const qCat = CATEGORIES.find((c) => q && c.id === q.mode) || CATEGORIES[0];
    const quote = q ? h('figure', { class: 'tl-litm-quote tlh-lit--' + qCat.id },
      h('p', { class: 'tl-lit-cap' }, 'Günün sözü'),
      h('blockquote', null, q.text),
      h('figcaption', null,
        h('span', null, q.source ? '— ' + q.source : ''),
        h('button', { class: 'tl-btn is-ghost tl-litm-qgo', type: 'button', onclick: () => startSession(qCat.id) },
          qCat.label + ' yaz ', h('span', { 'aria-hidden': 'true' }, '→')))) : null;

    // Son yazdıkların: her türün son oturumu (summary kaydeder: zaman, hız, bitirilen son metinler), en yeni 3'ü.
    const last = CATEGORIES.map((c) => ({ c, r: recs[c.id] || {} }))
      .filter((x) => x.r.last && typeof x.r.last.wpm === 'number')
      .sort((a, b) => (Number(b.r.last.t) || 0) - (Number(a.r.last.t) || 0))
      .slice(0, 3);
    const foot = last.length
      ? h('section', { class: 'tl-litm-foot', 'aria-label': 'Son yazdıkların' },
        h('p', { class: 'tl-lit-cap' }, 'Son yazdıkların'),
        h('ul', { class: 'tl-litm-recent' }, last.map(({ c, r }) => {
          const txt = Array.isArray(r.recent) && r.recent[0] ? r.recent[0] : (r.last.n || 0) + ' metin';
          const when = whenText(r.last.t);
          return h('li', null, h('button', {
            class: 'tl-litm-rec tlh-lit--' + c.id, type: 'button', onclick: () => startSession(c.id),
            'aria-label': c.label + ': ' + txt + ', ' + r.last.wpm + ' WPM' + (when ? ', ' + when : '') + '. Devam et',
          },
          h('span', { class: 'tl-litm-rec-k' }, c.label),
          h('span', { class: 'tl-litm-rec-t' }, txt),
          h('span', { class: 'tl-litm-rec-s' }, r.last.wpm + ' WPM' + (when ? ' · ' + when : ''))));
        })))
      : h('p', { class: 'tl-litm-foot tl-litm-tip' },
        h('b', null, 'İpucu: '), 'ok tuşlarıyla tür seç, ', h('kbd', null, 'Enter'), ' ile başla. Yazarken ',
        h('kbd', null, 'Esc'), ' oturumu bitirir ve özeti gösterir; her tür kaldığın yerden, tekrar etmeden devam eder.');

    root.replaceChildren(topbar(),
      h('section', { class: 'tl-litm' },
        h('div', { class: 'tl-litm-top' },
          h('header', { class: 'tl-litm-intro' },
            h('p', { class: 'tl-eyebrow' }, 'Şiir & Atasözü · 5 tür · ' + total + ' metin'),
            h('h1', { class: 'tl-h1' }, 'Edebiyatla Yaz'),
            h('p', { class: 'tl-lead' }, 'Bir tür seç ve durmadan yaz: metinler zordan başlayarak, tekrar etmeden art arda gelir. Bitirmek için “Bitir” ya da Esc.')),
          quote),
        grid,
        foot));
    const want = cards.find((el) => el.dataset.cat === focusCat) || cards[0];
    setTimeout(() => {
      if (alive && menuGrid === grid && want && want.isConnected) {
        try { want.focus({ preventScroll: true }); } catch (e) { /* yoksay */ }
      }
    }, 0);
  }

  // Ok tuşları: kartlar arasında ekrandaki konuma göre gezinir (bento, iki sütun, tek sütun aynı kural); Home/End ilk/son.
  function menuMove(key) {
    const cards = menuGrid ? Array.from(menuGrid.children || []) : [];
    if (!cards.length) return false;
    const cur = cards.indexOf(document.activeElement);
    let to = null;
    if (cur < 0 || key === 'Home') to = cards[0];
    else if (key === 'End') to = cards[cards.length - 1];
    else {
      const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
      const a = box(cards[cur]);
      let bestScore = Infinity;
      cards.forEach((el, i) => {
        if (i === cur) return;
        const b = box(el);
        const dx = b.x - a.x, dy = b.y - a.y;
        let sc = Infinity;
        if (key === 'ArrowRight' && dx > 4) sc = dx + 3 * Math.abs(dy);
        else if (key === 'ArrowLeft' && dx < -4) sc = -dx + 3 * Math.abs(dy);
        else if (key === 'ArrowDown' && dy > 4) sc = dy + 2 * Math.abs(dx);
        else if (key === 'ArrowUp' && dy < -4) sc = -dy + 2 * Math.abs(dx);
        if (sc < bestScore) { bestScore = sc; to = el; }
      });
      if (!to) to = cards[cur + (key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1)] || null;
    }
    if (!to) return true;
    try { to.focus(); } catch (e) { /* yoksay */ }
    return true;
  }

  /* ---------------------------------------------------------- kesintisiz oturum */

  function startSession(cat) {
    const c = CATEGORIES.find((x) => x.id === cat) || CATEGORIES[0];
    const stream = streamOf(c.id);
    clearTyper();
    sumFor = '';
    session = { cat: c.id, recent: [] };
    const recentTexts = session.recent;
    const srcEl = h('p', { class: 'tl-lit-src', 'aria-live': 'polite' }, '');
    const recentEl = h('ol', { class: 'tl-lit-recent', 'aria-label': 'Son yazılanlar' });
    // Hakem (docs/25): kutu baştan görünür (boş ipucuyla); yoksa geniş ekranda sağ sütun boş kalıyordu (Atasözü, Tekerleme…).
    recentEl.append(h('li', { class: 'tl-lit-empty' }, 'Bitirdiğin metinler burada birikir.'));
    const recentBox = h('section', { class: 'tl-lit-box tl-lit-recentbox is-empty' }, h('p', { class: 'tl-lit-cap' }, 'Son yazdıkların'), recentEl);
    // Şiirde kıta kutusu (dize dize, yazılan dize vurgulu); deyimde kalıp + anlam kutusu.
    const ctxEl = h('section', { class: 'tl-lit-box tl-lit-ctx', hidden: true });
    const tHost = h('div', { class: 'tl-typer-host' });
    const statsHost = h('div', { class: 'tl-ws-stats' });
    // Ortak yazma ekranı düzeni: başlık satırı (tür · sayaç şeridi · eylemler), solda yazıcı + klavye, sağda kıta/anlam ve
    // son yazılanlar (geniş ekranda yan sütun, dar ekranda altta).
    root.replaceChildren(
      topbar(),
      h('section', { class: 'tl-ws tl-ws--lit tl-lesson tl-lit-session tlh-lit--' + c.id, dataset: { cat: c.id } },
        h('header', { class: 'tl-ws-head' },
          h('div', { class: 'tl-ws-id tl-lit-title' }, motif(),
            h('div', null, h('p', { class: 'tl-eyebrow' }, 'Şiir & Atasözü · kesintisiz yazma'), h('h1', { class: 'tl-h1' }, c.label), srcEl)),
          statsHost,
          h('div', { class: 'tl-ws-acts' }, kbButton(),
            h('button', { class: 'tl-btn is-ghost', type: 'button', onclick: () => renderMenu(c.id) }, 'Tüm türler'))),
        h('div', { class: 'tl-ws-main' },
          tHost,
          h('aside', { class: 'tl-lit-below' }, ctxEl, recentBox)),
        h('p', { class: 'tl-ws-foot' }, h('span', null, c.desc),
          h('span', { class: 'tl-ws-keys' }, h('kbd', null, 'Esc'), ' bitir ve özet'))));
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
      keyboard: kbWanted(),
      statsHost,
      sfx: ctx && ctx.sfx,
      stream: () => stream.next(),
      onChunk: ({ item, done, stats }) => {
        chunkBase = stats && stats.typed ? stats.typed : 0;
        show(item);
        if (done) {
          session.recent.unshift(done.text);
          if (session.recent.length > 3) session.recent.length = 3;
          recentEl.replaceChildren(...session.recent.map((t) => h('li', null, t)));
          recentBox.classList.remove('is-empty');
        }
      },
      onProgress: (st) => markDize(Math.max(0, ((st && st.typed) || 0) - chunkBase)),
      onFinish: (st) => {
        if (!alive) return;
        later(() => summary(c, st, recentTexts));
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

  function summary(c, st, recentTexts) {
    clearTyper();
    session = null;
    if (!st || !(st.typed > 0)) {
      // Hiç yazmadan Esc/Bitir: ana ekrandaki karttan gelindiyse ana ekrana dön, yoksa tür menüsü.
      if (fromHome && ctx && ctx.back) ctx.back();
      else renderMenu();
      return;
    }
    let isBest = false;
    const prevBest = recOf(c.id).best;
    // Hiç metin bitmeden kapatılan kısa oturum rekor sayılmaz (birkaç harflik hızlı başlangıç "en iyi WPM"i şişiriyordu)
    const res = bumpProgress(ctx, (st.chunks || 0) >= 1 ? st.wpm : 0, st.acc, (all) => {
      // olay kaydı: ana sayfa (makeCtx.save) görev/seri/geçmiş için okur, depoya yazmaz
      all.last = { wpm: st.wpm, acc: st.acc, t: Date.now(), weak: st.weakKeys || null, kind: 'lit', cat: c.id, n: st.chunks || 0 };
      const recs = Object.assign({}, all.litStreams || {});
      const r = Object.assign({ runs: 0, items: 0 }, recs[c.id] || {});
      r.runs += 1;
      r.items += st.chunks || 0;
      r.last = { wpm: st.wpm, acc: st.acc, ms: st.elapsedMs, n: st.chunks || 0, t: Date.now() };
      // Tür menüsünün "Son yazdıkların" şeridi için bu oturumda bitirilen son 3 metin (yalnız metin bittiyse güncellenir).
      if (Array.isArray(recentTexts) && recentTexts.length) r.recent = recentTexts.slice(0, 3).map((x) => String(x).slice(0, 400));
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
    // Şiir & Atasözü'nde ders hedefi yok: bu türdeki en iyi hızla karşılaştırılır.
    const vs = !isBest && prevBest ? 'Bu türde en iyin ' + prevBest + ' WPM' + (st.wpm < prevBest ? ' · bu oturum ' + (prevBest - st.wpm) + ' WPM geride' : '') : '';
    root.replaceChildren(topbar(),
      h('section', { class: 'tl-ws tl-lesson tl-lit-sum tlh-lit--' + c.id },
        h('div', { class: 'tl-result tl-box is-pass', role: 'status' },
          motif(),
          h('p', { class: 'tl-eyebrow' }, c.label + ' · oturum özeti'),
          h('h2', null, 'Oturum bitti · ' + (st.chunks || 0) + ' metin'),
          isBest ? h('div', { class: 'tl-badge' }, 'Bu türde en iyi hızın!') : res.record ? h('div', { class: 'tl-badge' }, 'Yeni kişisel rekor!') : null,
          vs ? h('p', { class: 'tl-res-tip' }, vs) : null,
          statGrid(st),
          h('p', { class: 'tl-lit-saved' }, 'Kaydedildi · bu türde toplam ' + rec.items + ' metin' + (rec.best ? ' · en iyi ' + rec.best + ' WPM' : '')),
          h('div', { class: 'tl-res-actions' },
            next,
            h('button', { class: 'tl-btn', type: 'button', onclick: () => renderMenu(c.id) }, 'Tüm türler'),
            ctx && ctx.back ? h('button', { class: 'tl-btn is-ghost', type: 'button', onclick: () => ctx.back() }, '← Ana Sayfa') : null),
          h('p', { class: 'tl-lit-keys' }, 'Enter: devam · Esc: Ana Sayfa'))));
    sumFor = c.id;
    scrollTop();
    setTimeout(() => {
      if (alive && sumFor === c.id) {
        try {
          next.focus({ preventScroll: true });
        } catch (e) {
          /* yoksay */
        }
      }
    }, 0);
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
