// TuşLab — Edebiyat ile yazma: şiir, atasözü, deyim, tekerleme, özdeyiş (İşçi E).
import { mountTyper, ensureStyles, h, shuffle, fmtTime, loadAll, bumpProgress } from './typing.js';
import * as T from './data/texts.js';

const POEMS = T.POEMS || [];
const PROVERBS = T.PROVERBS || [];
const IDIOMS = T.IDIOMS || [];
const TWISTERS = T.TWISTERS || [];
const QUOTES = T.QUOTES || [];

// Oturum boyunca gösterilen metinler (aynı metin tekrar gelmesin).
const SEEN = new Set();
let kbOn = false;
let levels = new Set([3, 4]); // varsayılan: ZOR
let lastTab = 'poem';

const TABS = [
  { id: 'poem', label: 'Şiirler' },
  { id: 'proverb', label: 'Atasözleri' },
  { id: 'idiom', label: 'Deyimler' },
  { id: 'twister', label: 'Tekerlemeler' },
  { id: 'quote', label: 'Özdeyişler' },
];
const KIND_LABEL = { poem: 'Şiir', proverb: 'Atasözü', idiom: 'Deyim', twister: 'Tekerleme', quote: 'Özdeyiş' };

const cleanLine = (s) => String(s == null ? '' : s).replace(/\s*\/\s*$/, '').replace(/\s+/g, ' ').trim();

function itemsFor(tab) {
  switch (tab) {
    case 'poem':
      return POEMS.filter((p) => p && Array.isArray(p.lines)).map((p) => ({
        id: 'poem:' + (p.id != null ? p.id : p.title),
        kind: 'poem',
        label: p.title || 'Şiir',
        sub: p.author || '',
        lines: p.lines.map(cleanLine).filter(Boolean),
        source: [p.author, p.title].filter(Boolean).join(' — '),
      })).filter((p) => p.lines.length);
    case 'proverb':
      return PROVERBS.filter((p) => p && p.text && levels.has(Number(p.level) || 1)).map((p) => ({
        id: 'pv:' + p.text, kind: 'proverb', label: p.text, text: p.text, level: Number(p.level) || 1,
      }));
    case 'idiom':
      return IDIOMS.filter((p) => p && p.text).map((p) => ({ id: 'id:' + p.text, kind: 'idiom', label: p.text, text: p.text, meaning: p.meaning || '' }));
    case 'twister':
      return TWISTERS.filter(Boolean).map((t) => ({ id: 'tw:' + t, kind: 'twister', label: t, text: t }));
    case 'quote':
      return QUOTES.filter((q) => q && q.text).map((q) => ({ id: 'qt:' + q.text, kind: 'quote', label: q.text, text: q.text, sub: q.author || '', source: q.author || '' }));
    default:
      return [];
  }
}

// Görülmemiş rastgele öğe; hepsi görüldüyse bu liste için sıfırlanır.
function pickNext(items, avoidId) {
  if (!items.length) return null;
  let pool = items.filter((i) => !SEEN.has(i.id) && i.id !== avoidId);
  if (!pool.length) {
    items.forEach((i) => SEEN.delete(i.id));
    pool = items.filter((i) => i.id !== avoidId);
    if (!pool.length) pool = items;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function finalize(agg) {
  const wpm = agg.ms > 0 ? Math.round(agg.chars / 5 / (agg.ms / 60000)) : 0;
  const acc = agg.keys ? Math.round((agg.hits / agg.keys) * 1000) / 10 : 100;
  return { wpm, acc, errors: agg.errors, elapsedMs: agg.ms, chars: agg.chars, weakKeys: agg.weak };
}

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
  let boot = null;
  const timers = [];
  const view = { name: 'list', tab: lastTab, item: null, marathon: false };
  const root = h('div', { class: 'tl-edu tl-page tl-lit' });
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
  const voice = (n) => {
    try {
      const s = ctx && ctx.sfx;
      if (s && s.voice) s.voice(n);
    } catch (e) {
      /* yoksay */
    }
  };

  function go(patch) {
    Object.assign(view, patch);
    lastTab = view.tab;
    render(true);
  }

  function render(scroll) {
    clearTyper();
    boot = null;
    const body = view.name === 'practice' ? renderPractice() : renderList();
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
    if (view.name === 'practice') {
      bar.append(h('button', { class: 'tl-btn is-ghost', type: 'button', onclick: () => go({ name: 'list', marathon: false }) }, 'Listeye dön'));
    }
    return bar;
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
        if (typer) typer.setKeyboard(kbOn);
      },
    }, label());
    return b;
  }

  /* ---------------------------------------------------------- liste */

  function renderList() {
    const items = itemsFor(view.tab);
    const wrap = h('div', { class: 'tl-lit-list' });
    wrap.append(h('header', { class: 'tl-head' },
      h('div', null, h('h1', { class: 'tl-h1' }, 'Edebiyatla Yaz'),
        h('p', { class: 'tl-lead' }, 'Şiir, atasözü, deyim ve tekerlemelerle hem yaz hem öğren.'))));

    const tabs = h('div', { class: 'tl-tabs', role: 'tablist' });
    TABS.forEach((t) => {
      tabs.append(h('button', {
        class: 'tl-tab' + (t.id === view.tab ? ' is-on' : ''),
        type: 'button',
        role: 'tab',
        'aria-selected': String(t.id === view.tab),
        onclick: () => go({ tab: t.id }),
      }, t.label));
    });
    wrap.append(tabs);

    if (view.tab === 'proverb') {
      const chips = h('div', { class: 'tl-chip-row' });
      [1, 2, 3, 4].forEach((n) => {
        chips.append(h('button', {
          class: 'tl-chip' + (levels.has(n) ? ' is-on' : ''),
          type: 'button',
          'aria-pressed': String(levels.has(n)),
          onclick: () => {
            if (levels.has(n)) {
              if (levels.size > 1) levels.delete(n);
            } else {
              levels.add(n);
            }
            go({});
          },
        }, h('b', null, 'Zorluk ' + n)));
      });
      const preset = (label, set) => h('button', {
        class: 'tl-btn is-ghost', type: 'button',
        onclick: () => {
          levels = new Set(set);
          go({});
        },
      }, label);
      const best = (loadAll(ctx).marathon || {}).best;
      wrap.append(h('div', { class: 'tl-panel tl-filter' },
        h('div', { class: 'tl-filter-row' }, h('span', { class: 'tl-muted' }, 'Zorluk filtresi'), chips,
          preset('Zor (3-4)', [3, 4]), preset('Hepsi', [1, 2, 3, 4])),
        h('div', { class: 'tl-marathon' },
          h('div', null, h('h2', null, 'Atasözü Maratonu'),
            h('p', { class: 'tl-muted' }, '5 zor atasözü art arda. Toplam süre ve doğruluk sayılır.' +
              (best ? ' En iyi: ' + best.wpm + ' WPM, %' + Math.round(best.acc) + ', ' + fmtTime(best.ms) + '.' : ''))),
          h('button', { class: 'tl-btn is-primary', type: 'button', onclick: () => startMarathon() }, 'Maratonu başlat'))));
    }

    const seenCount = items.filter((i) => SEEN.has(i.id)).length;
    const controls = h('div', { class: 'tl-actions' },
      h('button', {
        class: 'tl-btn is-primary', type: 'button', disabled: items.length ? null : 'disabled',
        onclick: () => {
          const it = pickNext(items, null);
          if (it) startItem(it);
        },
      }, 'Rastgele seç'),
      h('span', { class: 'tl-muted' }, items.length + ' metin · ' + seenCount + ' yazıldı'));
    wrap.append(controls);

    if (!items.length) {
      wrap.append(h('div', { class: 'tl-panel' }, 'Bu bölümde gösterilecek metin yok.'));
      return wrap;
    }
    const grid = h('div', { class: 'tl-lit-grid' });
    items.forEach((it) => {
      const seen = SEEN.has(it.id);
      grid.append(h('button', {
        class: 'tl-item' + (seen ? ' is-seen' : ''),
        type: 'button',
        onclick: () => startItem(it),
      },
      h('span', { class: 'tl-item-text' }, it.label),
      h('small', null, it.kind === 'proverb' ? 'Zorluk ' + it.level : it.sub || KIND_LABEL[it.kind], seen ? ' · yazıldı' : '')));
    });
    wrap.append(grid);
    return wrap;
  }

  /* ---------------------------------------------------------- yazma */

  function startItem(item) {
    SEEN.add(item.id);
    go({ name: 'practice', item, marathon: false });
  }

  function startMarathon() {
    let pool = PROVERBS.filter((p) => p && p.text && (Number(p.level) || 0) >= 3);
    if (pool.length < 5) pool = PROVERBS.filter((p) => p && p.text).sort((a, b) => (b.level || 0) - (a.level || 0)).slice(0, 12);
    if (!pool.length) {
      toast('Atasözü verisi bulunamadı.');
      return;
    }
    let unseen = pool.filter((p) => !SEEN.has('pv:' + p.text));
    if (unseen.length < Math.min(5, pool.length)) {
      pool.forEach((p) => SEEN.delete('pv:' + p.text));
      unseen = pool;
    }
    const picks = shuffle(unseen).slice(0, 5);
    picks.forEach((p) => SEEN.add('pv:' + p.text));
    go({ name: 'practice', marathon: true, item: { kind: 'marathon', segs: picks.map((p) => p.text), label: 'Atasözü Maratonu' } });
  }

  function renderPractice() {
    const it = view.item;
    if (!it) {
      view.name = 'list';
      return renderList();
    }
    const stage = h('div', { class: 'tl-stage' });
    const title = it.kind === 'marathon' ? 'Atasözü Maratonu' : it.kind === 'poem' ? it.label : KIND_LABEL[it.kind];
    const sub = it.kind === 'poem' ? it.sub : it.kind === 'proverb' ? 'Zorluk ' + it.level + '/4' : it.kind === 'quote' && it.sub ? it.sub : it.kind === 'marathon' ? '5 zor atasözü, art arda' : '';
    const sec = h('section', { class: 'tl-lesson' },
      h('header', { class: 'tl-head' },
        h('div', null, h('p', { class: 'tl-eyebrow' }, it.kind === 'marathon' ? 'Maraton' : KIND_LABEL[it.kind]),
          h('h1', { class: 'tl-h1' }, title), sub ? h('p', { class: 'tl-lead' }, sub) : null),
        h('div', { class: 'tl-pills' }, kbButton())),
      stage);
    boot = () => runItem(stage, it);
    return sec;
  }

  // Ardışık parçaları (şiir dizeleri / maraton atasözleri) tek toplam süreyle yazdırır.
  function runSequence(stage, segs, labelFn, onDone) {
    const agg = { ms: 0, chars: 0, keys: 0, hits: 0, errors: 0, weak: {} };
    const bar = h('div', { class: 'tl-seq-bar' });
    const done = h('div', { class: 'tl-seq-done' });
    const tHost = h('div', { class: 'tl-typer-host' });
    stage.replaceChildren(bar, done, tHost);
    let i = 0;
    const show = (extra) => {
      bar.textContent = labelFn(Math.min(i, segs.length - 1), segs.length) + ' · Toplam süre ' + fmtTime(agg.ms + (extra || 0));
    };
    function step() {
      show(0);
      typer = mountTyper(tHost, {
        text: segs[i],
        keyboard: kbOn,
        sfx: ctx && ctx.sfx,
        onProgress: (st) => show(st.elapsedMs),
        onFinish: (st) => {
          agg.ms += st.elapsedMs;
          agg.chars += st.total;
          agg.keys += st.keystrokes;
          agg.hits += st.hits;
          agg.errors += st.errors;
          Object.entries(st.weakKeys || {}).forEach(([k, v]) => {
            agg.weak[k] = (agg.weak[k] || 0) + v;
          });
          done.append(h('div', { class: 'tl-seq-line' }, segs[i]));
          i++;
          later(() => {
            clearTyper();
            if (i < segs.length) step();
            else onDone(finalize(agg));
          }, 300);
        },
      });
    }
    if (!segs.length) {
      onDone(finalize(agg));
      return;
    }
    step();
  }

  function statGrid(st) {
    const cell = (v, l) => h('div', { class: 'tl-res-cell' }, h('b', null, String(v)), h('span', null, l));
    return h('div', { class: 'tl-res-grid' },
      cell(st.wpm, 'WPM'), cell(Math.round(st.acc) + '%', 'Doğruluk'), cell(st.errors, 'Hata'), cell(fmtTime(st.elapsedMs), 'Süre'));
  }

  function runItem(stage, it) {
    if (it.kind === 'marathon') {
      runSequence(stage, it.segs, (i, n) => 'Atasözü ' + (i + 1) + '/' + n, (st) => marathonDone(stage, st));
      return;
    }
    const segs = it.kind === 'poem' ? it.lines : [it.text];
    const label = it.kind === 'poem' ? (i, n) => 'Dize ' + (i + 1) + '/' + n : () => KIND_LABEL[it.kind];
    runSequence(stage, segs, label, (st) => itemDone(stage, it, st));
  }

  function itemDone(stage, it, st) {
    const res = bumpProgress(ctx, st.wpm, st.acc);
    if (res.record) voice('record');
    else if (st.acc >= 97) voice('great');
    else voice('lesson');
    const items = itemsFor(tabOf(it));
    const acts = h('div', { class: 'tl-res-actions' },
      h('button', {
        class: 'tl-btn is-primary', type: 'button',
        onclick: () => {
          const n = pickNext(items, it.id);
          if (n) startItem(n);
        },
      }, 'Sıradaki'),
      h('button', { class: 'tl-btn', type: 'button', onclick: () => go({ name: 'practice', item: it }) }, 'Tekrar yaz'),
      h('button', { class: 'tl-btn', type: 'button', onclick: () => go({ name: 'list', marathon: false }) }, 'Listeye dön'));
    const extra = [];
    if (it.kind === 'idiom' && it.meaning) {
      extra.push(h('div', { class: 'tl-meaning' }, h('b', null, 'Anlamı'), h('p', null, it.meaning)));
    }
    if (it.kind === 'quote' && it.sub) extra.push(h('p', { class: 'tl-muted' }, '— ' + it.sub));
    if (it.kind === 'poem' && it.source) extra.push(h('p', { class: 'tl-muted' }, it.source));
    stage.append(h('div', { class: 'tl-result tl-panel is-pass' },
      h('h2', null, 'Tamamlandı'),
      res.record ? h('div', { class: 'tl-badge' }, 'Yeni kişisel rekor!') : null,
      statGrid(st), extra, acts));
  }

  function tabOf(it) {
    return it.kind === 'poem' ? 'poem' : it.kind === 'proverb' ? 'proverb' : it.kind === 'idiom' ? 'idiom' : it.kind === 'twister' ? 'twister' : 'quote';
  }

  function marathonDone(stage, st) {
    const score = Math.round(st.wpm * (st.acc / 100) * 10) / 10;
    let isBest = false;
    let prevBest = null;
    const res = bumpProgress(ctx, st.wpm, st.acc, (all) => {
      const m = Object.assign({ runs: 0 }, all.marathon || {});
      prevBest = m.best || null;
      m.runs = (m.runs || 0) + 1;
      m.last = { wpm: st.wpm, acc: st.acc, ms: st.elapsedMs, score };
      if (!prevBest || score > (prevBest.score || 0)) {
        m.best = { wpm: st.wpm, acc: st.acc, ms: st.elapsedMs, score };
        isBest = true;
      }
      all.marathon = m;
    });
    if (isBest || res.record) voice('record');
    else if (st.acc >= 95) voice('great');
    else voice('lesson');
    const acts = h('div', { class: 'tl-res-actions' },
      h('button', { class: 'tl-btn is-primary', type: 'button', onclick: () => startMarathon() }, 'Yeni maraton'),
      h('button', { class: 'tl-btn', type: 'button', onclick: () => go({ name: 'list', marathon: false, tab: 'proverb' }) }, 'Listeye dön'));
    stage.append(h('div', { class: 'tl-result tl-panel is-pass' },
      h('h2', null, 'Maraton bitti'),
      h('p', { class: 'tl-lead' }, 'Skor: ' + score + (isBest ? ' (yeni en iyi!)' : prevBest ? ' (en iyi: ' + prevBest.score + ')' : '')),
      isBest ? h('div', { class: 'tl-badge' }, 'Yeni maraton rekoru!') : null,
      statGrid(st), acts));
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
