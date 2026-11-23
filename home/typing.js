// TuşLab — yazma motoru (İşçi E). Saf JS, ES modülü.
// Dışa açılan: mountTyper, ensureStyles, h, fingerName, fingerShort, trLower, trUpper,
// shuffle, fmtTime, loadAll, bumpProgress, normalizeText, matchStartKey, setText, kbPref, setKbPref, kbWanted, kbToggle
// mountTyper(host, { text, keyboard, onProgress, onFinish, sfx, stream?, onChunk?, statsHost? }) -> { destroy, focus, setKeyboard, stop, stats, item, expected }
//   statsHost: sayaç şeridi yazıcının içinde değil bu öğede durur (ör. başlık satırı).
//   stream(): sıradaki parça ({ text } ya da metin; null = bitti). onChunk({ item, index, done, stats }). stats.chunks = biten parça.
import * as LD from './data/lessons.js';

const FINGERS = LD.FINGERS || {};
const KEY_ROWS = LD.KEY_ROWS || [];

/* ------------------------------------------------------------------ yardımcılar */

const CSS_ID = 'tl-edu-css';
export function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(CSS_ID)) return;
  const link = document.createElement('link');
  link.id = CSS_ID;
  link.rel = 'stylesheet';
  link.href = new URL('./egitim.css', import.meta.url).href;
  document.head.appendChild(link);
}

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const trLower = (s) => String(s).toLocaleLowerCase('tr');
export const trUpper = (s) => String(s).toLocaleUpperCase('tr');

/** Ana ekrandan yazmayı başlatan ilk tuş: beklenen harfle büyük/küçük harf duyarsız (Türkçe i/İ, ı/I) eşleşiyorsa
 *  beklenen harfi döndürür (doğru sayılır), eşleşmiyorsa '' (hiç aktarılmaz, hata yazılmaz). */
export function matchStartKey(key, expected) {
  const k = String(key || '');
  const e = String(expected || '');
  if (!k || !e || Array.from(k).length !== 1) return '';
  if (k === e) return e;
  return trLower(k) === trLower(e) ? e : '';
}

/** Metni yalnız değiştiyse yazar; var olan metin düğümünün verisini günceller (düğüm değişimi yok → ucuz).
 *  Sık güncellenen sayaçlar için (tuş başına): textContent= yerine bunu kullanın. */
export function setText(el, v) {
  if (!el) return;
  const t = String(v);
  const n = el.firstChild;
  if (n && n.nodeType === 3 && !n.nextSibling) {
    if (n.data !== t) n.data = t;
  } else if (el.textContent !== t) el.textContent = t;
}

/* ------------------------------------------------------------------ ekran klavyesi tercihi (kalıcı) */
// Üç yazma ekranı (Yazma, Klavye Dersleri, Şiir & Atasözü) aynı tercihi paylaşır: 'tuslab-home-kb' = '1' | '0'.
// Kayıt yoksa geniş ekranda açık. Dar ekranda (telefon, < 700 px genişlik ya da < 620 px yükseklik) hiç gösterilmez.
const KB_KEY = 'tuslab-home-kb';
export function kbPref() {
  try {
    const v = globalThis.localStorage && globalThis.localStorage.getItem(KB_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch (e) {
    /* depolama kapalı */
  }
  return null;
}
export function setKbPref(on) {
  try {
    if (globalThis.localStorage) globalThis.localStorage.setItem(KB_KEY, on ? '1' : '0');
  } catch (e) {
    /* depolama kapalı */
  }
}
export function kbFits() {
  const w = typeof window !== 'undefined' && window.innerWidth;
  const hh = typeof window !== 'undefined' && window.innerHeight;
  if (!w || !hh) return true;
  return w >= 700 && hh >= 620;
}
/** Ekran klavyesi gösterilsin mi: tercih (yoksa açık) ve ekran yeterince büyük. */
export function kbWanted() {
  return kbPref() !== false && kbFits();
}
/** "Klavye: açık/kapalı" düğmesi; tercihi kaydeder, onChange(on) yazıcıya uygular. */
export function kbToggle(onChange) {
  const b = h('button', { class: 'tl-btn is-ghost tl-kbtoggle', type: 'button', title: 'Ekran klavyesini aç/kapat (tercih kaydedilir)' });
  const paint = () => {
    const on = kbPref() !== false;
    b.setAttribute('aria-pressed', String(on));
    b.textContent = 'Klavye: ' + (on ? 'açık' : 'kapalı');
  };
  b.addEventListener('click', () => {
    setKbPref(kbPref() === false);
    paint();
    if (onChange) onChange(kbWanted());
  });
  paint();
  return b;
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function fmtTime(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

export function normalizeText(t) {
  return String(t == null ? '' : t)
    .normalize('NFC')
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[\s ​]+/g, ' ')
    .trim();
}

const FNAME = { 5: 'serçe parmağı', 4: 'yüzük parmağı', 3: 'orta parmak', 2: 'işaret parmağı', 1: 'işaret parmağı' };
const FSHORT = { 5: 'serçe', 4: 'yüzük', 3: 'orta', 2: 'işaret', 1: 'işaret' };

export function fingerName(code) {
  if (!code) return '';
  if (code === 'T') return 'başparmak';
  return (code[0] === 'L' ? 'sol el ' : 'sağ el ') + (FNAME[code[1]] || 'parmağı');
}
export function fingerShort(code) {
  if (code === 'T') return 'Başparmak';
  return (code[0] === 'L' ? 'Sol ' : 'Sağ ') + (FSHORT[code[1]] || code);
}

/* İlerleme (ctx.save/ctx.load) ortak yardımcıları */
export function loadAll(ctx) {
  try {
    const o = ctx && ctx.load ? ctx.load() : null;
    return o && typeof o === 'object' ? o : {};
  } catch (e) {
    return {};
  }
}
function dayKey(offset) {
  const d = new Date();
  d.setDate(d.getDate() + (offset || 0));
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export function bumpStreak(all) {
  const today = dayKey(0);
  if (all.streakDay === today) return;
  all.streak = all.streakDay === dayKey(-1) ? (Number(all.streak) || 0) + 1 : 1;
  all.streakDay = today;
}
// Genel ilerleme: en iyi WPM + gün serisi. patch(all) ile ek alan yazılabilir. { record } döner.
export function bumpProgress(ctx, wpm, acc, patch) {
  const all = loadAll(ctx);
  const prev = Number(all.bestWpm) || 0;
  let record = false;
  if (acc >= 85 && wpm > prev) {
    all.bestWpm = wpm;
    record = prev > 0;
  }
  bumpStreak(all);
  if (typeof patch === 'function') patch(all);
  try {
    if (ctx && ctx.save) ctx.save(all);
  } catch (e) {
    /* depolama yoksa sessiz geç */
  }
  return { record, prevBest: prev };
}

/* ------------------------------------------------------------------ klavye eşlemesi */

// Türkçe Q: Shift ile gelen işaretler → tuş. (é: " tuşu, >: < tuşu)
const SHIFT_SYM = { '!': '1', "'": '2', '^': '3', '+': '4', '%': '5', '&': '6', '/': '7', '(': '8', ')': '9', '=': '0', '?': '*', _: '-', ';': ',', ':': '.', 'é': '"', '>': '<' };
const SHIFT_OF = Object.fromEntries(Object.entries(SHIFT_SYM).map(([a, b]) => [b, a]));
// Veride parmağı olmayan rakam sırası ve < tuşu için dokunarak yazma parmakları (yalnız renk).
const EXTRA_FINGERS = { '"': 'L5', 1: 'L5', 2: 'L4', 3: 'L3', 4: 'L2', 5: 'L2', 6: 'R2', 7: 'R2', 8: 'R3', 9: 'R4', 0: 'R5', '*': 'R5', '-': 'R5', '<': 'L5' };
const fingerOf = (k) => FINGERS[k] || EXTRA_FINGERS[k] || '';

function keyFor(ch) {
  if (ch === ' ') return { key: ' ', shift: false };
  const lo = ch.toLocaleLowerCase('tr');
  if (SHIFT_SYM[ch]) return { key: SHIFT_SYM[ch], shift: true };
  if (lo !== ch) return { key: lo, shift: true };
  return { key: ch, shift: false };
}

const FINGER_ORDER = ['L5', 'L4', 'L3', 'L2', 'L1', 'T', 'R1', 'R2', 'R3', 'R4', 'R5'];

/* ------------------------------------------------------------------ yazıcı */

export function mountTyper(host, opts = {}) {
  ensureStyles();
  const { onProgress, onFinish, onChunk, sfx } = opts;
  let showKb = opts.keyboard !== false;
  // Akış kipi: opts.stream() her çağrıda sıradaki parçayı ({ text, ... } ya da metin) verir.
  // Parça bitince sonraki hemen gelir; istatistikler sürer. Bitiş yalnız stop() / Esc / "Bitir" ile.
  const stream = typeof opts.stream === 'function' ? opts.stream : null;
  const pull = () => {
    let nx = null;
    try {
      nx = stream();
    } catch (e) {
      nx = null;
    }
    if (typeof nx === 'string') nx = { text: nx };
    return nx && normalizeText(nx.text) ? nx : null;
  };
  let item = null;
  if (stream && !normalizeText(opts.text)) item = pull();

  let chars = Array.from(normalizeText(item ? item.text : opts.text));
  let total = chars.length;
  let status = new Uint8Array(total); // 0 bekliyor, 1 doğru, 2 hata sonrası düzeltildi
  let doneChars = 0; // akış kipinde önceki parçalarda yazılan karakter
  let chunks = 0; // akış kipinde tamamlanan parça sayısı
  const weak = Object.create(null);

  let pos = 0;
  let wrong = false;
  let posErr = false;
  let errors = 0;
  let keystrokes = 0;
  let hits = 0;
  let started = false;
  let finished = false;
  let destroyed = false;
  let composing = false;
  let startT = 0;
  let endT = 0;
  let timer = 0;
  let lineH = 0;
  let shakeT = 0;

  /* --- DOM --- */
  const stEls = {
    wpm: h('b', null, '0'),
    acc: h('b', null, '100%'),
    err: h('b', null, '0'),
    time: h('b', null, '0:00'),
  };
  const stat = (label, b) => h('div', { class: 'tl-stat' }, b, h('span', null, label));
  const statsBar = h('div', { class: 'tl-typer-stats' }, stat('WPM', stEls.wpm), stat('Doğruluk', stEls.acc), stat('Hata', stEls.err), stat('Süre', stEls.time));
  if (stream) {
    stEls.cnt = h('b', null, '0');
    statsBar.classList.add('is-stream');
    statsBar.append(stat('Metin', stEls.cnt),
      h('button', { class: 'tl-btn tl-typer-stop', type: 'button', title: 'Oturumu bitir (Esc)', onclick: () => stop() }, 'Bitir', h('kbd', null, 'Esc')));
  }
  const prog = h('i');
  const progWrap = h('div', { class: 'tl-typer-progress' }, prog);
  const textEl = h('div', { class: 'tl-typer-text' });
  const caret = h('span', { class: 'tl-typer-caret' });
  textEl.append(caret);
  const view = h('div', { class: 'tl-typer-view' }, textEl);
  const hint = h('div', { class: 'tl-typer-hint' }, 'Yazmaya başlamak için buraya tıkla, sonra yaz');
  const ta = h('textarea', {
    class: 'tl-typer-input',
    rows: 1,
    autocomplete: 'off',
    autocapitalize: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    inputmode: 'text',
    enterkeyhint: 'done',
    'aria-label': 'Yazma alanı',
  });
  const box = h('div', { class: 'tl-typer-box' }, view, hint, ta);
  const kbWrap = h('div', { class: 'tl-kb-wrap' });
  const statsHost = opts.statsHost || null;
  const root = h('div', { class: 'tl-edu tl-typer' + (statsHost ? ' has-ext-stats' : '') }, statsHost ? null : statsBar, progWrap, box, kbWrap);
  if (statsHost) statsHost.replaceChildren(statsBar);

  let spans = [];
  function renderText() {
    spans = [];
    textEl.replaceChildren(caret);
    textEl.style.transform = '';
    let wordEl = null;
    for (let i = 0; i < total; i++) {
      const ch = chars[i];
      const s = h('span', { class: 'tl-ch' }, ch);
      spans.push(s);
      if (ch === ' ') {
        wordEl = null;
        textEl.append(s);
      } else {
        if (!wordEl) {
          wordEl = h('span', { class: 'tl-w' });
          textEl.append(wordEl);
        }
        wordEl.append(s);
      }
    }
  }
  renderText();

  /* --- klavye --- */
  let kbBuilt = false;
  const keyEls = new Map();
  let shiftL = null;
  let shiftR = null;
  let nextEls = [];

  function buildKeyboard() {
    kbBuilt = true;
    const kb = h('div', { class: 'tl-kb', 'aria-hidden': 'true' });
    KEY_ROWS.forEach((row, ri) => {
      const r = h('div', { class: 'tl-kb-row r' + ri });
      row.forEach((k) => {
        const f = fingerOf(k);
        // Shift ile gelen işaret küçük harfle tuşun üst köşesinde (Türkçe Q: 1/!, 2/', ,/; …)
        const el = h('span', { class: 'tl-key' + (f ? ' f-' + f : '') }, trUpper(k), SHIFT_OF[k] ? h('small', { class: 'tl-key-s' }, SHIFT_OF[k]) : null);
        keyEls.set(k, el);
        r.append(el);
      });
      kb.append(r);
    });
    // Shift'e serçe parmakları basar: renkleri de serçe rengi.
    shiftL = h('span', { class: 'tl-key tl-key-shift f-L5' }, '⇧ Shift');
    shiftR = h('span', { class: 'tl-key tl-key-shift f-R5' }, 'Shift ⇧');
    const space = h('span', { class: 'tl-key tl-key-space f-T' }, 'boşluk');
    keyEls.set(' ', space);
    kb.append(h('div', { class: 'tl-kb-row rb' }, shiftL, space, shiftR));

    const present = new Set(Object.values(FINGERS));
    present.add('T');
    const legend = h('div', { class: 'tl-kb-legend' });
    FINGER_ORDER.filter((c) => present.has(c)).forEach((c) => {
      legend.append(h('span', { class: 'tl-leg f-' + c }, h('i'), fingerShort(c)));
    });
    kbWrap.replaceChildren(kb, legend);
  }

  function updateHint() {
    if (!kbBuilt) return;
    nextEls.forEach((e) => e.classList.remove('is-next'));
    nextEls = [];
    if (finished || pos >= total) return;
    const { key, shift } = keyFor(chars[pos]);
    const el = keyEls.get(key);
    if (el) {
      el.classList.add('is-next');
      nextEls.push(el);
    }
    if (shift) {
      const f = fingerOf(key);
      const sh = f ? (f[0] === 'L' ? shiftR : shiftL) : shiftR;
      sh.classList.add('is-next');
      nextEls.push(sh);
    }
  }

  // Basılan tuşun kısa geri bildirimi (doğru: yeşil, yanlış: kırmızı + titreme). Düzen okuması yok (eskiden
  // animasyonu yeniden başlatmak için her tuşta offsetWidth okunuyordu): sınıf zaten varsa yalnız süre uzar.
  function flashKey(ch, bad) {
    if (!kbBuilt || !showKb) return;
    const el = keyEls.get(keyFor(ch).key);
    if (!el) return;
    const cls = bad ? 'is-bad' : 'is-press';
    const other = bad ? 'is-press' : 'is-bad';
    if (el.classList.contains(other)) el.classList.remove(other);
    if (!el.classList.contains(cls)) el.classList.add(cls);
    clearTimeout(el._tlT);
    el._tlT = setTimeout(() => el.classList.remove(cls), 190);
  }

  function setKeyboard(on) {
    showKb = !!on;
    if (showKb && !kbBuilt) buildKeyboard();
    kbWrap.hidden = !showKb;
    updateHint();
  }

  /* --- görüntü --- */
  function paintChar(i) {
    const s = spans[i];
    if (!s) return;
    let c = 'tl-ch';
    if (i < pos) c += status[i] === 2 ? ' is-ok is-fixed' : ' is-ok';
    else if (i === pos && !finished) c += wrong ? ' is-bad is-cur' : ' is-cur';
    s.className = c;
  }

  function getLineH() {
    if (lineH) return lineH;
    const cs = getComputedStyle(textEl);
    let v = parseFloat(cs.lineHeight);
    if (!isFinite(v)) v = parseFloat(cs.fontSize) * 1.8;
    lineH = v || 32;
    return lineH;
  }

  function placeCaret() {
    if (destroyed || !total) return;
    const s = spans[Math.min(pos, total - 1)];
    if (!s) return;
    const hgt = s.offsetHeight || 24;
    let x = s.offsetLeft;
    const y = s.offsetTop;
    if (pos >= total) x += s.offsetWidth;
    caret.style.height = hgt + 'px';
    caret.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    const lh = getLineH();
    const line = Math.round((y - (lh - hgt) / 2) / lh);
    textEl.style.transform = 'translateY(' + -Math.max(0, line - 1) * lh + 'px)';
  }

  function stats() {
    const now = performance.now();
    const elapsedMs = started ? (finished ? endT : now) - startT : 0;
    const mins = Math.max(elapsedMs, 1000) / 60000;
    const wpm = started ? Math.round((doneChars + pos) / 5 / mins) : 0;
    const acc = keystrokes ? Math.round((hits / keystrokes) * 1000) / 10 : 100;
    const weakKeys = {};
    Object.entries(weak)
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => {
        weakKeys[k] = v;
      });
    return { wpm, acc, errors, elapsedMs, typed: doneChars + pos, total: doneChars + total, weakKeys, keystrokes, hits, chunks };
  }

  // Sayaçlar her tuşta ve 250 ms'de bir yazılır: yalnız değişen değeri, metin düğümünün verisini değiştirerek yaz.
  // (textContent= düğümü değiştirir; sayfadaki yapısal seçiciler yüzünden tüm belgede ~6 ms stil hesabı tetikliyordu.)
  function paintStats(s) {
    setText(stEls.wpm, String(s.wpm));
    setText(stEls.acc, Math.round(s.acc) + '%');
    setText(stEls.err, String(s.errors));
    setText(stEls.time, fmtTime(s.elapsedMs));
    if (stEls.cnt) setText(stEls.cnt, String(s.chunks));
    const p = 'scaleX(' + (total ? Math.round((pos / total) * 1000) / 1000 : 0) + ')';
    if (prog.style.transform !== p) prog.style.transform = p;
  }

  function tick() {
    if (destroyed || finished) return;
    const s = stats();
    paintStats(s);
    if (onProgress) onProgress(s);
  }

  /* --- girdi --- */
  function sfxCall(name) {
    try {
      if (sfx && typeof sfx[name] === 'function') sfx[name]();
    } catch (e) {
      /* ses hatası yazmayı bozmasın */
    }
  }

  // Doğru basıldıysa true döner.
  function handleChar(ch) {
    if (finished || destroyed || ch === '\n' || ch === '\r') return true;
    if (ch === ' ' || ch === '\t') ch = ' ';
    if (!started) {
      started = true;
      startT = performance.now();
      timer = setInterval(tick, 250);
    }
    keystrokes++;
    const exp = chars[pos];
    if (ch === exp) {
      hits++;
      status[pos] = posErr ? 2 : 1;
      posErr = false;
      wrong = false;
      pos++;
      paintChar(pos - 1);
      paintChar(pos);
      sfxCall('key');
      flashKey(ch, false);
      placeCaret();
      updateHint();
      if (pos >= total) {
        if (stream) advance();
        else finish();
      } else tick();
      return true;
    }
    errors++;
    const wk = trLower(exp);
    if (wk.trim()) weak[wk] = (weak[wk] || 0) + 1;
    wrong = true;
    posErr = true;
    paintChar(pos);
    sfxCall('error');
    flashKey(ch, true);
    if (!root.classList.contains('is-shake')) root.classList.add('is-shake');
    clearTimeout(shakeT);
    shakeT = setTimeout(() => root.classList.remove('is-shake'), 200);
    tick();
    return false;
  }

  function backspace() {
    if (finished || destroyed) return;
    if (wrong) {
      wrong = false;
      paintChar(pos);
    } else if (pos > 0) {
      pos--;
      posErr = status[pos] === 2;
      status[pos] = 0;
      paintChar(pos);
      paintChar(pos + 1);
      placeCaret();
      updateHint();
    }
    paintStats(stats());
  }

  function flush() {
    const v = ta.value;
    ta.value = '';
    if (!v) return;
    for (const ch of Array.from(v.normalize('NFC'))) {
      if (!handleChar(ch)) break; // toplu girişte (IME/yapıştırma) ilk hatada kes
    }
  }

  ta.addEventListener('keydown', (e) => {
    if (e.isComposing || composing) return;
    if (e.key === 'Escape' && stream && !finished) {
      e.preventDefault();
      stop();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      backspace();
    } else if (e.key === 'Enter') {
      e.preventDefault();
    }
  });
  ta.addEventListener('beforeinput', (e) => {
    if (composing) return;
    if (e.inputType === 'deleteContentBackward' || e.inputType === 'deleteWordBackward') {
      e.preventDefault();
      backspace();
    }
  });
  ta.addEventListener('input', (e) => {
    if (e.isComposing || composing) return;
    flush();
  });
  ta.addEventListener('compositionstart', () => {
    composing = true;
  });
  ta.addEventListener('compositionend', () => {
    composing = false;
    flush();
  });
  ta.addEventListener('paste', (e) => e.preventDefault());
  ta.addEventListener('drop', (e) => e.preventDefault());
  // Telefonda sanal klavye açılınca metin kutusu görünür kalsın (odakta ve görünür alan küçülünce bir kez kaydır).
  const narrow = () => typeof window !== 'undefined' && window.innerWidth > 0 && window.innerWidth < 700;
  const reveal = () => {
    if (destroyed || !narrow() || document.activeElement !== ta) return;
    try {
      box.scrollIntoView({ block: 'nearest' });
    } catch (e) {
      /* yoksay */
    }
  };
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (vv && vv.addEventListener) vv.addEventListener('resize', reveal);
  ta.addEventListener('focus', () => {
    root.classList.add('is-focused');
    if (narrow()) setTimeout(reveal, 350);
  });
  ta.addEventListener('blur', () => root.classList.remove('is-focused'));
  box.addEventListener('click', () => focus());

  function focus() {
    try {
      ta.focus({ preventScroll: true });
    } catch (e) {
      ta.focus();
    }
  }

  // Akış kipi: parça bitti -> sayacı artır, sıradakini hemen yükle.
  function advance() {
    const prev = item;
    doneChars += total;
    chunks++;
    const nx = pull();
    if (!nx) {
      doneChars -= total; // son parça ekranda kalır; sayım çift olmasın
      finish();
      return;
    }
    item = nx;
    chars = Array.from(normalizeText(nx.text));
    total = chars.length;
    status = new Uint8Array(total);
    pos = 0;
    wrong = false;
    posErr = false;
    lineH = 0;
    renderText();
    paintChar(0);
    updateHint();
    placeCaret();
    const s = stats();
    paintStats(s);
    if (onProgress) onProgress(s);
    if (onChunk) {
      try {
        onChunk({ item, index: chunks, done: prev, stats: s });
      } catch (e) {
        /* yoksay */
      }
    }
  }

  // Oturumu bitirir (akış kipi için; düz kipte de çalışır). Hiç yazılmadıysa da onFinish çağrılır.
  function stop() {
    if (finished || destroyed) return;
    if (!started) {
      finished = true;
      ta.readOnly = true;
      if (onFinish) onFinish(stats());
      return;
    }
    finish();
  }

  function finish() {
    finished = true;
    endT = performance.now();
    clearInterval(timer);
    ta.readOnly = true;
    root.classList.add('is-done');
    paintChar(total - 1);
    updateHint();
    placeCaret();
    const s = stats();
    paintStats(s);
    if (onProgress) onProgress(s);
    if (onFinish) onFinish(s);
  }

  /* --- kurulum --- */
  host.replaceChildren(root);
  setKeyboard(showKb);
  paintChar(0);
  updateHint();
  if (stream && item && onChunk) {
    setTimeout(() => {
      if (!destroyed && chunks === 0) {
        try {
          onChunk({ item, index: 0, done: null, stats: stats() });
        } catch (e) {
          /* yoksay */
        }
      }
    }, 0);
  }
  let ro = null;
  const onResize = () => {
    lineH = 0;
    placeCaret();
  };
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(onResize);
    ro.observe(view);
  } else {
    window.addEventListener('resize', onResize);
  }
  requestAnimationFrame(() => {
    placeCaret();
    setTimeout(placeCaret, 120);
  });
  setTimeout(() => {
    if (!destroyed) focus();
  }, 0);

  if (!total) {
    setTimeout(() => {
      if (!destroyed && !finished) {
        finished = true;
        if (onFinish) onFinish(stats());
      }
    }, 0);
  }

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearInterval(timer);
      clearTimeout(shakeT);
      if (vv && vv.removeEventListener) vv.removeEventListener('resize', reveal);
      if (statsHost) statsBar.remove();
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', onResize);
      keyEls.forEach((el) => clearTimeout(el._tlT));
      root.remove();
    },
    focus,
    setKeyboard,
    stop,
    stats,
    get item() {
      return item;
    },
    /** Sıradaki beklenen karakter (bittiyse ''). */
    get expected() {
      return finished || destroyed ? '' : chars[pos] || '';
    },
  };
}
