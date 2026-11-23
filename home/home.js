/* TuşLab ana sayfa kabuğu (klasik defer betik). Diğer home/ modüllerini dinamik import ile yükler.
 * Açılış ekranı "Merkez": solda karşılama + gerçek sayılar, sağda 2×2 bölüm kartı. 3B sahne yok (düz CSS arka plan).
 * "Yazma" kendi görünümüdür (#yazma): atasözü/şiir/deyim/tekerleme/özdeyiş kesintisiz akar, Kelime tek metindir.
 * ?pvp= varsa açılmaz, yalnız PvP kapanınca temiz adrese (Merkez) yönlendirir; #pvp-root görünür olunca veya tuslab:pvp-enter olayında gizlenir. */
(() => {
  'use strict';
  if (window.__tlHomeLoaded) return;
  window.__tlHomeLoaded = true;
  let pvpQuery = false;
  try { pvpQuery = new URLSearchParams(location.search).has('pvp'); } catch { /* yok */ }
  // Eski tek sayfalık uygulama (#app, "eski arena") bu betik çalıştığı sürece hiç görünmez/tıklanmaz:
  // ana sayfa ya da PvP her zaman üstte; ikisi de kapalıyken bile alttaki eski site açığa çıkmaz (home.css: html.tlh-app-off).
  document.documentElement.classList.add('tlh-app-off');
  const guardApp = () => { const a = document.getElementById('app'); if (a) a.setAttribute('aria-hidden', 'true'); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guardApp, { once: true }); else guardApp();
  if (pvpQuery) {
    // ?pvp= ile açıldı: ana sayfa kurulmaz; PvP görünür→gizli olunca (çıkış/ayrıl) temiz adrese git → yeni ana sayfa.
    const goHome = () => { try { location.replace(location.pathname); } catch { location.href = location.pathname; } };
    let seen = false, observing = false;
    const attach = () => {
      const p = document.getElementById('pvp-root');
      if (!p || observing) return !!p;
      observing = true;
      if (!p.hidden) seen = true;
      new MutationObserver(() => { if (!p.hidden) seen = true; else if (seen) goHome(); })
        .observe(p, { attributes: true, attributeFilter: ['hidden'] });
      return true;
    };
    if (!attach()) {
      const mo = new MutationObserver(() => { if (attach()) mo.disconnect(); });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    }
    // PvP hiç açılmadıysa (yükleme hatası) eski sitede takılma
    setTimeout(() => { const p = document.getElementById('pvp-root'); if (!seen && (!p || p.hidden)) goHome(); }, 20000);
    return;
  }

  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || new URL('home/home.js', document.baseURI).href;
  const BASE = new URL('./', SCRIPT_SRC).href;           // …/home/
  const ROOT = new URL('../', BASE).href;                // site kökü
  const loadMod = (file) => import(BASE + file);
  const KEY = 'tuslab-home-v1';
  const VIEW_IDS = ['yazma', 'egitim', 'edebiyat', 'performans'];

  /* ---------- yardımcılar ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
  const dayKey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const today = () => dayKey(new Date());
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    || document.documentElement.classList.contains('reduced-motion');

  /* ---------- depolama (her yazımda yeniden oku → başka modüllerin yazdıklarını ezme) ---------- */
  function readStore() {
    let d = {};
    try { d = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { d = {}; }
    if (typeof d !== 'object' || Array.isArray(d)) d = {};
    if (!d.sec || typeof d.sec !== 'object') d.sec = {};
    if (!d.badges || typeof d.badges !== 'object') d.badges = {};
    if (!d.stats || typeof d.stats !== 'object') d.stats = {};
    if (!Array.isArray(d.history)) d.history = [];
    if (!d.weak || typeof d.weak !== 'object') d.weak = {};
    return d;
  }
  let data = readStore();
  function update(fn) {
    data = readStore();
    fn(data);
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* kota / gizli sekme */ }
  }

  function lessonStars(d = data) {
    const e = d.sec.egitim || {};
    const fromMap = (m) => Object.values(m).reduce((a, x) => a + Math.min(3, typeof x === 'number' ? x : num(x && x.stars)), 0);
    if (typeof e.totalStars === 'number') return e.totalStars;
    if (typeof e.stars === 'number') return e.stars;
    if (e.stars && typeof e.stars === 'object') return fromMap(e.stars);
    for (const k of ['lessons', 'progress', 'results', 'done']) if (e[k] && typeof e[k] === 'object') return fromMap(e[k]);
    return 0;
  }
  function bestWpm(d = data) {
    let b = num(d.bestWpm);
    for (const s of Object.values(d.sec)) if (s && typeof s === 'object') b = Math.max(b, num(s.bestWpm));
    return Math.round(b);
  }
  function streakNow(d = data) {
    const s = d.streak;
    if (!s || !s.last) return 0;
    return s.last === today() || s.last === yesterday() ? num(s.count) : 0;
  }
  function touchStreak(d) {
    const t = today();
    const s = d.streak && typeof d.streak === 'object' ? d.streak : { count: 0, last: '' };
    if (s.last === t) return;
    s.count = s.last === yesterday() ? num(s.count) + 1 : 1;
    s.last = t;
    d.streak = s;
  }
  function xpOf(d = data) {
    return lessonStars(d) * 15 + num(d.stats.finished) * 10 + num(d.stats.quests) * 25 + Object.keys(d.badges).length * 30;
  }
  const levelOf = (xp) => 1 + Math.floor(Math.sqrt(xp / 60));
  const levelXp = (lv) => (lv - 1) * (lv - 1) * 60;

  /* ---------- görevler ve rozetler ---------- */
  const QUESTS = {
    lesson: { icon: '🎓', text: 'Bugün 1 ders bitir' },
    acc98: { icon: '🎯', text: 'Bir metni %98 doğrulukla yaz' },
    daily: { icon: '⌨️', text: 'Yazma bölümünde 2 metin bitir', need: 2 },
    wpm35: { icon: '⚡', text: '35+ WPM hıza ulaş' },
    lit: { icon: '🪶', text: 'Şiir & Atasözü köşesinde bir metin bitir' },
    arena: { icon: '🧿', text: 'Atasözü modunda bir metin bitir' },
  };
  function todaysQuestIds() {
    const rot = ['daily', 'wpm35', 'lit', 'arena'];
    const t = today();
    let h = 0;
    for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
    return ['lesson', 'acc98', rot[h % rot.length]];
  }
  function questState(d = data) {
    const t = today();
    return d.quests && d.quests.date === t ? d.quests : { date: t, done: {}, count: {} };
  }
  const BADGES = [
    { id: 'ilk', icon: '🌱', name: 'İlk Adım', test: d => num(d.stats.finished) >= 1 },
    { id: 'seri3', icon: '🔥', name: '3 Gün Seri', test: d => streakNow(d) >= 3 },
    { id: 'seri7', icon: '🌋', name: '7 Gün Seri', test: d => streakNow(d) >= 7 },
    { id: 'hiz40', icon: '⚡', name: '40 WPM', test: d => bestWpm(d) >= 40 },
    { id: 'hiz60', icon: '🚀', name: '60 WPM', test: d => bestWpm(d) >= 60 },
    { id: 'kusursuz', icon: '💎', name: 'Kusursuz', test: d => num(d.stats.perfect) >= 1 },
    { id: 'yildiz10', icon: '⭐', name: '10 Yıldız', test: d => lessonStars(d) >= 10 },
    { id: 'gorev', icon: '🏅', name: 'Görev Avcısı', test: d => num(d.stats.allQuests) >= 1 },
  ];

  /* ---------- ses cephesi (modül yüklenene kadar sessiz) ---------- */
  let S = null;
  const sfx = {
    key() { S?.key(); }, error() { S?.error(); }, win() { S?.win(); }, chime() { S?.chime?.(); },
    voice(n) { S?.voice(n); }, setEnabled(on) { S?.setEnabled(on); },
    get enabled() { return S ? S.enabled : data.sound !== false; },
  };

  /* ---------- DOM ---------- */
  const NAV = [
    { id: 'yazma', icon: '⌨️', label: 'Yazma' },
    { id: 'egitim', icon: '🎓', label: 'Klavye Dersleri' },
    { id: 'edebiyat', icon: '🪶', label: 'Şiir & Atasözü' },
    { id: 'pvp', icon: '⚔️', label: 'PvP Düello' },
    { id: 'performans', icon: '📈', label: 'Performans' },
  ];
  // Kokpit (24 Kas 2026): solda metrikler, ortada Yazma (ana odak) + altında Atasözü/Deyim/Şiir/Tekerleme şeridi,
  // sağda Klavye Dersleri + PvP girişi. Şerit çipleri Şiir & Atasözü akışını o türle doğrudan açar (intent.cat).
  const LIT = [
    { id: 'atasozu', icon: '🧿', label: 'Atasözleri', unit: 'atasözü' },
    { id: 'deyim', icon: '💬', label: 'Deyimler', unit: 'deyim' },
    { id: 'siir', icon: '🪶', label: 'Şiirler', unit: 'şiir' },
    { id: 'tekerleme', icon: '🌀', label: 'Tekerlemeler', unit: 'tekerleme' },
  ];
  const litChipHTML = (c) => `
        <li><button type="button" class="tlh-lit-chip tlh-lit--${c.id}" data-lit="${c.id}">
          <span class="tlh-lit-ic" aria-hidden="true">${c.icon}</span>
          <span class="tlh-lit-t"><b>${esc(c.label)}</b><small data-s="lit-${c.id}">…</small></span>
          <span class="tlh-lit-go" aria-hidden="true">→</span>
        </button></li>`;

  const root = document.createElement('div');
  root.id = 'tl-home';
  root.tabIndex = -1;
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'TuşLab ana sayfa');
  root.innerHTML = `
<div class="tlh-bg" aria-hidden="true"><i></i><i></i><i></i></div>
<header class="tlh-top">
  <a class="tlh-logo" href="${esc(location.pathname)}" data-nav="hub" aria-current="page" aria-label="TuşLab — Merkez">
    <img src="${esc(ROOT)}favicon.svg" alt="" width="34" height="34" /><span>Tuş<b>Lab</b></span>
  </a>
  <nav class="tlh-nav" aria-label="Bölümler">
    ${NAV.map(n => n.id === 'pvp'
      ? `<a class="tlh-nav-btn" href="?pvp=lobby" data-nav="pvp"><span aria-hidden="true">${n.icon}</span><em>${esc(n.label)}</em></a>`
      : `<button type="button" class="tlh-nav-btn" data-nav="${n.id}"><span aria-hidden="true">${n.icon}</span><em>${esc(n.label)}</em></button>`).join('')}
  </nav>
  <button type="button" class="tlh-sound" aria-pressed="true" aria-label="Sesi kapat"><span aria-hidden="true">🔊</span></button>
</header>
<div class="tlh-menu">
  <main class="tlh-hub" aria-labelledby="tlh-hub-h">
    <h1 id="tlh-hub-h" class="tlh-sr">TuşLab Merkez — Türkçe klavye eğitimi</h1>
    <section class="tlh-k tlh-k-write" aria-labelledby="tlh-pw-h">
      <header class="tlh-k-head">
        <div>
          <p class="tlh-eyebrow">NEON ARENA · HEMEN YAZ</p>
          <h2 id="tlh-pw-h" class="tlh-k-title">Yazma <span>Arenası</span></h2>
        </div>
        <span class="tlh-pw-last" data-s="card-yazma">Kesintisiz akış</span>
      </header>
      <button type="button" class="tlh-pw" data-tlh="write" aria-describedby="tlh-pw-tip">
        <span class="tlh-pw-bar" aria-hidden="true"><i>WPM <b>0</b></i><i>Doğruluk <b>%100</b></i><i data-s="pwmode">Atasözü</i></span>
        <span class="tlh-pw-text"><span class="tlh-pw-caret" aria-hidden="true"></span><span data-s="pwtext">Damlaya damlaya göl olur.</span></span>
        <span class="tlh-pw-src" data-s="pwsrc">— Atasözü</span>
      </button>
      <div class="tlh-modes tlh-modes--hub" role="radiogroup" aria-label="Yazma türü"></div>
      <div class="tlh-pw-foot">
        <p id="tlh-pw-tip" class="tlh-pw-tip"><kbd>A</kbd><kbd>Ş</kbd><kbd>İ</kbd> Herhangi bir harfe bas, hemen başla</p>
        <button type="button" class="tlh-btn tlh-btn--primary tlh-btn--lg" data-tlh="write"><span aria-hidden="true">▶</span> Yazmaya başla</button>
      </div>
    </section>
    <section class="tlh-k tlh-k-lit" aria-labelledby="tlh-lit-h">
      <header class="tlh-k-head">
        <h2 id="tlh-lit-h" class="tlh-k-h">Atasözü · Deyim · Şiir · Tekerleme</h2>
        <button type="button" class="tlh-k-more" data-tlh="lit-all">Tüm türler <span aria-hidden="true">→</span></button>
      </header>
      <ul class="tlh-lit-chips" aria-label="İçerik türleri">${LIT.map(litChipHTML).join('')}
      </ul>
    </section>
    <aside class="tlh-k tlh-k-met" aria-labelledby="tlh-met-h">
      <header class="tlh-k-head"><h2 id="tlh-met-h" class="tlh-k-h"><span aria-hidden="true">📊</span> Eğitim metriklerin</h2></header>
      <ul class="tlh-stats" aria-label="Senin sayıların">
        <li class="tlh-stat tlh-stat--wpm"><b data-s="wpm">0</b><small>en iyi WPM</small></li>
        <li class="tlh-stat tlh-stat--acc"><b data-s="acc">—</b><small>ort. doğruluk</small></li>
        <li class="tlh-stat tlh-stat--star"><b><span data-s="stars">0</span><em>/<span data-s="starmax">—</span></em></b><small>ders yıldızı</small></li>
        <li class="tlh-stat tlh-stat--streak"><b data-s="streak">0</b><small>gün seri</small></li>
      </ul>
      <div class="tlh-met-slot" data-slot="metrik-grafik">
        <p class="tlh-met-cap">Son yazışların · hız</p>
        <div class="tlh-spark" data-s-spark></div>
      </div>
      <button type="button" class="tlh-quest-strip" data-tlh="quests"><span aria-hidden="true">🗓️</span> Günlük görevler <b data-s="qcount">0/3</b><span class="tlh-quest-strip-go" aria-hidden="true">→</span></button>
      <button type="button" class="tlh-k-more tlh-met-perf" data-tlh="perf"><span aria-hidden="true">📈</span> Performans ayrıntıları <span aria-hidden="true">→</span></button>
    </aside>
    <section class="tlh-k tlh-k-edu" aria-labelledby="tlh-edu-h">
      <header class="tlh-k-head">
        <div>
          <p class="tlh-eyebrow tlh-eyebrow--gold">ON PARMAK · EĞİTİM</p>
          <h2 id="tlh-edu-h" class="tlh-k-title">Klavye <span>Dersleri</span></h2>
        </div>
      </header>
      <div class="tlh-edu-row">
        <p class="tlh-edu-sum" data-s="card-egitim">47 ders · 8 ünite</p>
        <button type="button" class="tlh-k-more" data-tlh="lessons" aria-label="Tüm dersler">Tümü <span aria-hidden="true">→</span></button>
      </div>
      <p class="tlh-edu-unit" data-s="unit">Ünite 1 · Temel Sıra</p>
      <span class="tlh-edu-bar" aria-hidden="true"><i data-s="lessonbar"></i></span>
      <ol class="tlh-path" aria-label="Ders yolu"></ol>
      <div class="tlh-edu-btns">
        <button type="button" class="tlh-btn tlh-btn--gold tlh-resume" data-tlh="resume"><span aria-hidden="true">🎓</span><span class="tlh-resume-t" data-s="resume">İlk derse başla</span></button>
      </div>
    </section>
    <a class="tlh-k tlh-k-pvp" href="?pvp=lobby" data-card="pvp">
      <span class="tlh-pvp-kicker">⚔️ DÜELLO</span>
      <span class="tlh-pvp-title">PvP Düello</span>
      <span class="tlh-pvp-desc">Yazarak dövüş · bot ya da arkadaş</span>
      <span class="tlh-pvp-go" aria-hidden="true">Lobiye git →</span>
    </a>
  </main>
</div>
<section class="tlh-view tlh-write" hidden aria-labelledby="tlh-write-h">
  <header class="tlh-view-top">
    <button type="button" class="tlh-btn tlh-btn--ghost tlh-back" data-tlh="back" aria-label="Merkeze dön">← Merkez</button>
    <h2 id="tlh-write-h" class="tlh-view-title"><span aria-hidden="true">⌨️</span> Yazma <b>Arenası</b></h2>
    <div class="tlh-combo" aria-hidden="true"><b data-s="combo">0</b><small>KOMBO</small></div>
  </header>
  <div class="tlh-write-body">
    <div class="tlh-arena">
      <div class="tlh-modes" role="radiogroup" aria-label="Metin türü"></div>
      <div class="tlh-arena-typer"><div class="tlh-loading">Yükleniyor…</div></div>
      <div class="tlh-arena-foot">
        <span class="tlh-src" data-s="src"></span>
        <span class="tlh-hint" data-s="hint"></span>
        <button type="button" class="tlh-next" data-tlh="next">↻ Yeni metin</button>
      </div>
    </div>
    <div class="tlh-result" hidden></div>
  </div>
</section>
<section class="tlh-view tlh-module" hidden aria-labelledby="tlh-view-h">
  <header class="tlh-view-top">
    <button type="button" class="tlh-btn tlh-btn--ghost tlh-back" data-tlh="back" aria-label="Merkeze dön">← Merkez</button>
    <h2 id="tlh-view-h" class="tlh-view-title"></h2>
  </header>
  <div class="tlh-view-body"></div>
</section>
<div class="tlh-toasts" aria-live="polite" aria-atomic="false"></div>`;

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.id = 'tl-home-fab';
  fab.hidden = true;
  fab.innerHTML = '<span aria-hidden="true">⌂</span> Ana Sayfa';

  const $ = (sel) => root.querySelector(sel);
  const menuEl = $('.tlh-menu');
  const writeEl = $('.tlh-write');
  const viewEl = $('.tlh-module');
  const viewBody = $('.tlh-view-body');
  const viewTitle = $('#tlh-view-h');
  const toastHost = $('.tlh-toasts');
  const soundBtn = $('.tlh-sound');
  const arenaHost = $('.tlh-arena-typer');
  const resultEl = $('.tlh-result');
  const modesEl = $('.tlh-write .tlh-modes');
  const hubModesEl = $('.tlh-modes--hub');
  const pathEl = $('.tlh-path');
  const sparkEl = $('[data-s-spark]');
  const comboEl = $('.tlh-combo');
  const nextBtn = $('.tlh-next');

  /* ---------- toast + konfeti ---------- */
  function toast(msg) {
    if (!msg) return;
    const el = document.createElement('div');
    el.className = 'tlh-toast';
    el.textContent = String(msg);
    toastHost.appendChild(el);
    while (toastHost.children.length > 3) toastHost.firstElementChild.remove();
    setTimeout(() => { el.classList.add('is-out'); setTimeout(() => el.remove(), 400); }, 3200);
  }

  function confetti() {
    if (reduced()) return;
    const c = document.createElement('canvas');
    c.className = 'tlh-confetti';
    c.setAttribute('aria-hidden', 'true');
    root.appendChild(c);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = window.innerWidth, h = window.innerHeight;
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext('2d');
    if (!g) { c.remove(); return; }
    g.scale(dpr, dpr);
    const colors = ['#ff7a2f', '#ffc861', '#3fe0ff', '#8b5cff', '#45e39a', '#eef1ff'];
    const parts = Array.from({ length: 160 }, () => ({
      x: w * 0.35 + (Math.random() - 0.5) * w * 0.3, y: h * 0.5,
      vx: (Math.random() - 0.5) * 15, vy: -8 - Math.random() * 12,
      s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      col: colors[(Math.random() * colors.length) | 0],
    }));
    const t0 = performance.now();
    (function tick(now) {
      const k = (now - t0) / 1900;
      g.clearRect(0, 0, w, h);
      parts.forEach(p => {
        p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.globalAlpha = Math.max(0, 1 - k); g.translate(p.x, p.y); g.rotate(p.r);
        g.fillStyle = p.col; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore();
      });
      if (k < 1) requestAnimationFrame(tick); else c.remove();
    })(t0);
  }

  /* ---------- durum çizimi ---------- */
  let lessonData = null;   // { LESSONS, UNITS, lessonUnlocked } — data/lessons.js + lessons.js yüklenince
  let litCounts = null;    // { atasozu: n, siir: n, … } — arena.js yüklenince
  const setAll = (k, v) => root.querySelectorAll(`[data-s="${k}"]`).forEach(el => { el.textContent = v; });

  /** Klavye Dersleri: biten ders sayısı ve sıradaki açık ders (lessons.js "Kaldığın yerden devam et" kuralıyla aynı). */
  function lessonInfo(d = data) {
    if (!lessonData) return null;
    const { LESSONS, lessonUnlocked } = lessonData;
    const all = d.sec.egitim && typeof d.sec.egitim === 'object' ? d.sec.egitim : {};
    const recs = all.lessons && typeof all.lessons === 'object' ? all.lessons : {};
    const starOf = (l) => num(recs[l.id] && recs[l.id].stars);
    const done = LESSONS.filter(l => starOf(l) > 0).length;
    let idx = LESSONS.findIndex((l, i) => lessonUnlocked(all, i) && !(starOf(l) > 0));
    if (idx < 0) idx = Math.max(0, LESSONS.length - 1);
    return { idx, lesson: LESSONS[idx], done, total: LESSONS.length, started: Object.keys(recs).length > 0 };
  }
  /** Son 10 sonucun ortalama doğruluğu (geçmiş boşsa null → "—"). */
  function avgAcc(d = data) {
    const last = d.history.slice(-10).filter(x => num(x.acc) > 0);
    return last.length ? Math.round(last.reduce((a, x) => a + num(x.acc), 0) / last.length) : null;
  }

  /** Sağ sütun ders yolu: kaldığın dersin bir öncesi + kendisi + sonraki ikisi (biten / şimdi / açık / kilitli). */
  function renderPath(li) {
    if (!pathEl || !lessonData) return;
    const { LESSONS, lessonUnlocked } = lessonData;
    const all = data.sec.egitim && typeof data.sec.egitim === 'object' ? data.sec.egitim : {};
    const recs = all.lessons && typeof all.lessons === 'object' ? all.lessons : {};
    const start = Math.max(0, Math.min(li.idx - 1, LESSONS.length - 4));
    const html = LESSONS.slice(start, start + 4).map((l, k) => {
      const i = start + k;
      const stars = Math.min(3, num(recs[l.id] && recs[l.id].stars));
      const st = stars > 0 ? 'done' : i === li.idx ? 'now' : lessonUnlocked(all, i) ? 'open' : 'lock';
      const mark = st === 'done' ? `<span class="tlh-step-s" aria-label="${stars} yıldız">${'★'.repeat(stars)}<em>${'★'.repeat(3 - stars)}</em></span>`
        : st === 'now' ? '<span class="tlh-step-s">sıradaki</span>'
        : st === 'lock' ? '<span class="tlh-step-s" aria-label="kilitli">🔒</span>' : '<span class="tlh-step-s">açık</span>';
      const inner = `<span class="tlh-step-n">${i + 1}</span><span class="tlh-step-t">${esc(l.title)}</span>${mark}`;
      return `<li class="tlh-step is-${st}">${st === 'lock' ? `<span class="tlh-step-b">${inner}</span>`
        : `<button type="button" class="tlh-step-b" data-lesson="${i}"${st === 'now' ? ' aria-current="step"' : ''}>${inner}</button>`}</li>`;
    }).join('');
    if (pathEl.innerHTML !== html) pathEl.innerHTML = html;
  }

  /** Sol sütundaki küçük hız grafiği (son 12 sonuç). "Metrik" ajanı bu yuvayı (data-slot="metrik-grafik") geliştirecek. */
  function renderSpark() {
    if (!sparkEl) return;
    const hist = data.history.slice(-12).filter(x => num(x.wpm) > 0);
    if (!hist.length) {
      sparkEl.innerHTML = '<p class="tlh-empty">Bir oturum bitir, hızın burada çizilsin.</p>';
      return;
    }
    const max = Math.max(20, ...hist.map(x => num(x.wpm)));
    sparkEl.innerHTML = `<div class="tlh-spark-bars" role="img" aria-label="Son ${hist.length} sonucun hızı, en yüksek ${Math.round(max)} WPM">${hist.map(x =>
      `<i style="height:${Math.max(6, Math.round(num(x.wpm) / max * 100))}%"></i>`).join('')}</div>`;
  }

  /* ---------- Yazma önizlemesi (Merkez ortası) ----------
   * Önizlemedeki satır akışın ilk parçasıdır (peek): "Yazmaya başla" ya da bir harfe basınca aynı satır yazılır,
   * basılan ilk harf de kaybolmaz (pendingKeys → yazıcıya aktarılır). */
  let peek = null;          // { mode, chunk }
  let pendingKeys = '';
  function ensurePeek() {
    if (!arenaMod) return null;
    if (!peek || peek.mode !== mode) {
      let chunk = null;
      try { chunk = isStream(mode) ? arenaMod.nextChunk(mode) : arenaMod.pickText(mode); } catch { chunk = null; }
      peek = chunk && chunk.text ? { mode, chunk } : null;
    }
    return peek;
  }
  function takePeek(m) {
    const p = peek && peek.mode === m ? peek.chunk : null;
    peek = null;
    return p;
  }
  function renderPreview() {
    const p = ensurePeek();
    if (!p) return;
    const mm = arenaMod.MODES.find(x => x.id === mode);
    setAll('pwmode', mm ? mm.label : '');
    setAll('pwtext', p.chunk.text);
    setAll('pwsrc', p.chunk.source ? '— ' + p.chunk.source : '');
  }
  function renderModeButtons(host) {
    if (!host || !arenaMod) return;
    host.innerHTML = arenaMod.MODES.map(m => `
        <button type="button" class="tlh-mode${m.id === mode ? ' is-on' : ''}" role="radio" aria-checked="${m.id === mode}" data-mode="${m.id}" title="${esc(m.hint)}">
          <span aria-hidden="true">${m.icon}</span>${esc(m.label)}</button>`).join('');
  }

  function renderStats() {
    const xp = xpOf();
    const lv = levelOf(xp);
    const a = levelXp(lv), b = levelXp(lv + 1);
    setAll('lv', 'Sv. ' + lv);
    root.querySelectorAll('[data-s="xp"]').forEach(el => { el.style.width = Math.round(((xp - a) / Math.max(1, b - a)) * 100) + '%'; });
    setAll('xptext', `${Math.max(0, Math.round(xp - a))} / ${Math.max(1, b - a)} XP`);
    setAll('wpm', String(bestWpm()));
    const acc = avgAcc();
    setAll('acc', acc == null ? '—' : '%' + acc);
    setAll('stars', String(lessonStars()));
    setAll('streak', String(streakNow()));

    const li = lessonInfo();
    if (li) {
      setAll('starmax', String(li.total * 3));
      setAll('resume', li.started && li.lesson ? `Kaldığın ders: ${li.idx + 1} · ${li.lesson.title}` : 'İlk derse başla');
      const units = lessonData.UNITS.length;
      setAll('card-egitim', `${li.total} ders${units ? ' · ' + units + ' ünite' : ''} · ${li.done} bitti`);
      const bar = root.querySelector('[data-s="lessonbar"]');
      if (bar) bar.style.width = Math.round((li.done / Math.max(1, li.total)) * 100) + '%';
      const ui = li.lesson ? lessonData.UNITS.findIndex(u => u.id === li.lesson.unit) : -1;
      setAll('unit', ui >= 0 ? `Ünite ${ui + 1}/${units} · ${lessonData.UNITS[ui].title}` : '');
      renderPath(li);
    }
    if (litCounts) for (const c of LIT) if (litCounts[c.id]) setAll('lit-' + c.id, `${litCounts[c.id]} ${c.unit}`);
    const last = data.history[data.history.length - 1];
    setAll('card-yazma', last && num(last.wpm) ? `Son yazışın ${num(last.wpm)} WPM` : 'Kesintisiz akış');
    renderSpark();

    const ids = todaysQuestIds();
    const q = questState();
    const done = ids.filter(id => q.done[id]).length;
    setAll('qcount', `${done}/${ids.length}`);
    const ql = $('.tlh-quest-list');
    if (ql) ql.innerHTML = ids.map(id => {
      const need = QUESTS[id].need;
      const cnt = need && !q.done[id] ? ` <small>${Math.min(need, num(q.count && q.count[id]))}/${need}</small>` : '';
      return `
      <li class="tlh-quest${q.done[id] ? ' is-done' : ''}">
        <span class="tlh-quest-icon" aria-hidden="true">${QUESTS[id].icon}</span>
        <span class="tlh-quest-text">${esc(QUESTS[id].text)}${cnt}</span>
        <span class="tlh-quest-mark">${q.done[id] ? '<span aria-hidden="true">✓</span><span class="tlh-sr">tamamlandı</span>' : '<span class="tlh-sr">bekliyor</span>'}</span>
      </li>`;
    }).join('');
    const bl = $('.tlh-badges');
    if (bl) bl.innerHTML = BADGES.map(bd => {
      const got = !!data.badges[bd.id];
      return `<li class="tlh-badge${got ? ' is-got' : ''}" title="${esc(bd.name)}${got ? '' : ' (kilitli)'}"><span class="tlh-badge-ic" aria-hidden="true">${bd.icon}</span><small>${esc(bd.name)}</small>${got ? '' : '<span class="tlh-sr"> (kilitli)</span>'}</li>`;
    }).join('');

    soundBtn.setAttribute('aria-pressed', String(sfx.enabled));
    soundBtn.setAttribute('aria-label', sfx.enabled ? 'Sesi kapat' : 'Sesi aç');
    soundBtn.firstElementChild.textContent = sfx.enabled ? '🔊' : '🔇';
  }

  /** İlerleme olaylarını işler: görevler, seri, rozetler, geçmiş, zayıf tuşlar. */
  function progress({ quests = [], finished = false, wpm = 0, acc = 0, mode = '', weak = null } = {}) {
    const msgs = [];
    let record = false;
    update(d => {
      if (finished) {
        d.stats.finished = num(d.stats.finished) + 1;
        if (acc >= 100) d.stats.perfect = num(d.stats.perfect) + 1;
        touchStreak(d);
        if (wpm > 0) {
          d.history.push({ t: Date.now(), wpm: Math.round(wpm), acc: Math.round(acc * 10) / 10, m: mode });
          if (d.history.length > 40) d.history = d.history.slice(-40);
        }
      }
      if (weak && typeof weak === 'object') {
        for (const [k, v] of Object.entries(weak)) if (k.trim()) d.weak[k] = num(d.weak[k]) + num(v);
      }
      if (wpm > 0) {
        if (wpm > num(d.bestWpm) && wpm > bestWpm(d) && num(d.stats.finished) > 1) record = true;
        d.bestWpm = Math.max(num(d.bestWpm), Math.round(wpm));
      }
      if (wpm >= 35) quests.push('wpm35');
      if (acc >= 98) quests.push('acc98');
      const ids = todaysQuestIds();
      const q = questState(d);
      if (!q.count || typeof q.count !== 'object') q.count = {};
      for (const id of quests) {
        if (!ids.includes(id) || q.done[id]) continue;
        const need = QUESTS[id].need || 1;
        q.count[id] = num(q.count[id]) + 1;
        if (q.count[id] >= need) {
          q.done[id] = true;
          d.stats.quests = num(d.stats.quests) + 1;
          msgs.push('Görev tamamlandı: ' + QUESTS[id].text);
        }
      }
      if (ids.every(id => q.done[id]) && !q.allCounted) { q.allCounted = true; d.stats.allQuests = num(d.stats.allQuests) + 1; }
      d.quests = q;
      for (const bd of BADGES) {
        if (!d.badges[bd.id] && bd.test(d)) { d.badges[bd.id] = today(); msgs.push(`Yeni rozet: ${bd.icon} ${bd.name}`); }
      }
    });
    if (record) { toast('Yeni rekor! ' + Math.round(wpm) + ' WPM'); setTimeout(() => sfx.voice('record'), 900); }
    msgs.forEach((m, i) => setTimeout(() => { toast(m); sfx.chime(); }, 300 + i * 700));
    renderStats();
    return { record };
  }

  /** Alt bölümün kaydettiği nesneden tamamlanmış bir sonuç (wpm/acc) çıkarmaya çalışır. */
  function findResult(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const isRes = (o) => o && typeof o === 'object' && typeof o.wpm === 'number' && typeof o.acc === 'number';
    if (isRes(obj)) return obj;
    for (const v of Object.values(obj)) if (isRes(v)) return v;
    return null;
  }
  const normAcc = (a) => { a = num(a); return a > 0 && a <= 1 ? a * 100 : a; };

  /* ---------- Performans (yerel görünüm; günlük görevler, seviye ve rozetler de burada) ---------- */
  function mountPerf(host) {
    const d = readStore();
    const hist = d.history.slice(-20);
    const last10 = d.history.slice(-10);
    const avg = (arr, k) => arr.length ? Math.round(arr.reduce((a, x) => a + num(x[k]), 0) / arr.length) : 0;
    const maxW = Math.max(40, ...hist.map(x => num(x.wpm)));
    const weak = Object.entries(d.weak).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const maxWeak = weak.length ? weak[0][1] : 1;
    const MODE_NAME = { atasozu: 'Atasözü', siir: 'Şiir', deyim: 'Deyim', tekerleme: 'Tekerleme', ozdeyis: 'Özdeyiş', kelime: 'Kelime' };
    const tiles = [
      ['⚡', 'En iyi hız', bestWpm(d) + ' WPM', 'var(--tl-gold)'],
      ['📊', 'Son 10 ortalama', avg(last10, 'wpm') + ' WPM', 'var(--tl-cyan)'],
      ['🎯', 'Ortalama doğruluk', last10.length ? '%' + avg(last10, 'acc') : '—', 'var(--tl-ok)'],
      ['✅', 'Biten metin', String(num(d.stats.finished)), 'var(--tl-violet-ink)'],
      ['🔥', 'Günlük seri', streakNow(d) + ' gün', 'var(--tl-ember)'],
      ['⭐', 'Ders yıldızı', String(lessonStars(d)), 'var(--tl-gold)'],
    ];
    host.innerHTML = `
      <div class="tlh-perf">
        <div class="tlh-perf-tiles">${tiles.map(([i, l, v, c]) => `<div class="tlh-perf-tile" style="--acc:${c}"><span aria-hidden="true">${i}</span><b>${esc(v)}</b><small>${esc(l)}</small></div>`).join('')}</div>
        <div class="tlh-perf-row tlh-perf-goals">
          <section class="tlh-panel tlh-quests" aria-labelledby="tlh-quests-h">
            <div class="tlh-panel-head"><h3 id="tlh-quests-h">🗓️ Günlük Görevler</h3><span class="tlh-quest-count" data-s="qcount"></span></div>
            <ul class="tlh-quest-list"></ul>
          </section>
          <section class="tlh-panel tlh-level" aria-labelledby="tlh-level-h">
            <div class="tlh-panel-head"><h3 id="tlh-level-h">Seviye ve rozetler</h3><b class="tlh-level-badge" data-s="lv">Sv. 1</b></div>
            <div class="tlh-level-xp"><span class="tlh-xp"><i data-s="xp"></i></span><small data-s="xptext"></small></div>
            <ul class="tlh-badges" aria-label="Rozetler"></ul>
          </section>
        </div>
        <div class="tlh-perf-row">
          <section class="tlh-panel tlh-perf-chart"><h3>Son ${hist.length || ''} metin · hız</h3>
            ${hist.length ? `<div class="tlh-bars">${hist.map(x => `<i style="--h:${Math.round(num(x.wpm) / maxW * 100)}%" title="${num(x.wpm)} WPM · %${num(x.acc)}${x.m ? ' · ' + esc(MODE_NAME[x.m] || x.m) : ''}"><b>${num(x.wpm)}</b></i>`).join('')}</div>`
              : '<p class="tlh-empty">Henüz sonuç yok. Yazma bölümünde bir oturum bitir, grafik burada belirsin.</p>'}
          </section>
          <section class="tlh-panel tlh-perf-weak"><h3>En çok zorlandığın tuşlar</h3>
            ${weak.length ? `<ul>${weak.map(([k, v]) => `<li><kbd>${esc(k.toLocaleUpperCase('tr'))}</kbd><span class="tlh-weak-bar"><i style="width:${Math.round(v / maxWeak * 100)}%"></i></span><small>${v} hata</small></li>`).join('')}</ul>`
              : '<p class="tlh-empty">Hata yaptıkça zayıf tuşların burada listelenir.</p>'}
          </section>
        </div>
      </div>`;
    renderStats();
    return { destroy() { host.innerHTML = ''; } };
  }

  /* ---------- bölümler ---------- */
  const VIEWS = {
    yazma: { title: '⌨️ Yazma Arenası', write: true },
    egitim: { title: '🎓 Klavye Dersleri', file: 'lessons.js', fn: 'mountLessons' },
    edebiyat: { title: '🪶 Şiir & Atasözü Yazma', file: 'literature.js', fn: 'mountLiterature' },
    performans: { title: '📈 Performans', local: mountPerf },
  };
  let view = null;     // { id, inst, intent }
  let cssInjected = false;
  function ensureEgitimCss() {
    if (cssInjected) return;
    cssInjected = true;
    if (document.querySelector('link[data-tlh-css]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = BASE + 'egitim.css';
    l.dataset.tlhCss = '1';
    document.head.appendChild(l);
  }

  function makeCtx(id, intent) {
    let lastSig = '';
    return {
      section: id,
      intent: intent || null,
      sfx,
      toast,
      back: () => closeView(),
      load() { return Object.assign({}, readStore().sec[id] || {}); },
      save(obj) {
        if (!obj || typeof obj !== 'object') return;
        const before = lessonStars();
        update(d => { d.sec[id] = Object.assign({}, d.sec[id] || {}, obj); });
        const quests = [];
        let finished = false, wpm = 0, acc = 0;
        if (id === 'egitim' && lessonStars() > before) { quests.push('lesson'); finished = true; }
        const r = findResult(obj);
        if (r) {
          const sig = [r.wpm, r.acc, r.elapsedMs, r.total].join('|');
          if (sig !== lastSig) {
            lastSig = sig;
            wpm = num(r.wpm); acc = normAcc(r.acc);
            if (id === 'edebiyat') { quests.push('lit'); finished = true; }
          }
        }
        if (quests.length || wpm || finished) progress({ quests, finished, wpm, acc, mode: id });
        else renderStats();
      },
    };
  }

  function errorCard(msg) {
    return `<div class="tlh-error" role="alert"><p class="tlh-error-title">Hay aksi!</p><p>${esc(msg)}</p>
      <button type="button" class="tlh-btn tlh-btn--ghost" data-tlh="retry">Tekrar dene</button></div>`;
  }

  /** Seçili bölümü işaretler. 'hub' = Merkez: o zaman logo aria-current="page" olur, sekmelerin hiçbiri seçili değildir. */
  function setNav(id) {
    root.querySelectorAll('[data-nav]').forEach(b => {
      if (b.dataset.nav === 'pvp') return;
      const on = b.dataset.nav === id;
      if (b.classList.contains('tlh-nav-btn')) b.classList.toggle('is-on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  async function openView(id, { push = true, intent = null } = {}) {
    const v = VIEWS[id];
    if (!v) return;
    if (view && view.id === id) return;
    const switching = !!view;   // bölümden bölüme geçiş: geçmişe yeni kayıt ekleme (Merkez tek geri adımla dönsün)
    closeView({ silent: true });
    ensureEgitimCss();
    const token = { id, inst: null, intent };
    view = token;
    setNav(id);
    menuEl.setAttribute('aria-hidden', 'true');
    menuEl.inert = true;
    if (push && location.hash !== '#' + id) {
      try {
        if (switching && history.state && history.state.tlh) history.replaceState({ tlh: id }, '', '#' + id);
        else history.pushState({ tlh: id }, '', '#' + id);
      } catch { /* yok */ }
    }
    if (v.write) {
      writeEl.hidden = false;
      if (arenaMod) newText(); else mountArena();
      return;
    }
    viewTitle.textContent = v.title;
    viewEl.hidden = false;
    viewBody.innerHTML = '<div class="tlh-loading">Yükleniyor…</div>';
    viewEl.querySelector('.tlh-back').focus({ preventScroll: true });
    try {
      viewBody.innerHTML = '';
      const host = document.createElement('div');
      host.className = 'tlh-view-host';
      viewBody.appendChild(host);
      let inst;
      if (v.local) inst = v.local(host);
      else {
        viewBody.firstChild.innerHTML = '<div class="tlh-loading">Yükleniyor…</div>';
        const m = await loadMod(v.file);
        if (view !== token) return;
        if (typeof m[v.fn] !== 'function') throw new Error(v.fn + ' yok');
        host.innerHTML = '';
        inst = m[v.fn](host, makeCtx(id, intent));
        if (inst && typeof inst.then === 'function') inst = await inst;
      }
      if (view !== token) { try { inst?.destroy?.(); } catch { /* yok */ } return; }
      token.inst = inst || null;
    } catch (err) {
      if (view !== token) return;
      try { console.warn('[home] bölüm yüklenemedi:', id, err); } catch { /* yok */ }
      viewBody.innerHTML = errorCard('Bu bölüm şu an yüklenemedi. Biraz sonra tekrar dene.');
    }
  }

  function closeView({ silent = false, fromPop = false } = {}) {
    if (!view) return;
    if (view.id === 'yazma') closeWrite();
    else {
      try { view.inst?.destroy?.(); } catch (err) { try { console.warn('[home] destroy hatası', err); } catch { /* yok */ } }
      viewBody.innerHTML = '';
      viewEl.hidden = true;
    }
    view = null;
    menuEl.removeAttribute('aria-hidden');
    menuEl.inert = false;
    setNav('hub');
    pendingKeys = '';
    renderPreview();
    if (!silent && !fromPop && VIEW_IDS.includes(location.hash.slice(1))) {
      if (history.state && history.state.tlh) history.back();
      else clearHash();
    }
    if (!silent || fromPop) setTimeout(() => { if (!view && !root.hidden) root.focus({ preventScroll: true }); }, 30);
  }

  function clearHash() {
    if (!location.hash) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch { /* yok */ }
  }

  /* ---------- gizle / göster (yalnız PvP için) ---------- */
  const pvpRoot = () => document.getElementById('pvp-root');
  const pvpVisible = () => { const p = pvpRoot(); return !!p && !p.hidden; };
  function updateFab() { fab.hidden = !root.hidden || pvpVisible(); }
  function hideHome() {
    if (root.hidden) { updateFab(); return; }
    closeView({ silent: true });
    clearHash();
    root.hidden = true;
    document.documentElement.classList.remove('tlh-lock');
    if (root.contains(document.activeElement)) document.activeElement.blur();
    updateFab();
  }
  function showHome() {
    if (pvpVisible()) return;
    root.hidden = false;
    document.documentElement.classList.add('tlh-lock');
    data = readStore();
    renderStats();
    updateFab();
    root.focus({ preventScroll: true });
  }

  /* ---------- Yazma (kendi görünümü) ---------- */
  let arenaMod = null;
  let mountTyperFn = null;
  let arenaCtl = null;
  let arenaP = null;
  let current = null;           // { text, source, mode } — akış kipinde metin/kaynak her parçada güncellenir
  let mode = typeof data.mode === 'string' ? data.mode : 'atasozu';
  let combo = 0, lastTyped = 0, lastErr = 0, bestCombo = 0;
  const typerSfx = { key: () => sfx.key(), error: () => sfx.error(), win: () => {}, voice: (n) => sfx.voice(n), get enabled() { return sfx.enabled; } };
  const wantKeyboard = () => window.innerHeight >= 800 && window.innerWidth >= 1000;
  const isStream = (m) => !!(arenaMod && arenaMod.isStreamMode?.(m));

  /** arena.js + typing.js bir kez yüklenir (Merkez açılışında önden; Yazma açılınca hazır olsun). */
  function loadArena() {
    if (arenaP) return arenaP;
    const p = Promise.all([loadMod('arena.js'), loadMod('typing.js')]).then(([am, typing]) => {
      if (typeof am.pickText !== 'function' || typeof typing.mountTyper !== 'function') throw new Error('arabirim eksik');
      arenaMod = am;
      mountTyperFn = typing.mountTyper;
      if (!am.MODES.some(m => m.id === mode)) mode = am.MODES[0].id;
      renderModeButtons(modesEl);
      renderModeButtons(hubModesEl);
      if (typeof am.itemsFor === 'function') {
        litCounts = {};
        for (const m of am.MODES) { try { litCounts[m.id] = am.itemsFor(m.id).length; } catch { /* yok */ } }
      }
      renderPreview();
      renderStats();
      return am;
    });
    arenaP = p;
    p.catch(() => { if (arenaP === p) arenaP = null; });
    return p;
  }

  async function mountArena() {
    arenaHost.innerHTML = '<div class="tlh-loading">Yükleniyor…</div>';
    try {
      await loadArena();
      if (view && view.id === 'yazma') newText();
    } catch (err) {
      try { console.warn('[home] yazma alanı yüklenemedi:', err); } catch { /* yok */ }
      arenaHost.innerHTML = errorCard('Yazma alanı şu an yüklenemedi.');
    }
  }

  function closeWrite() {
    try { arenaCtl?.destroy?.(); } catch { /* yok */ }
    arenaCtl = null;
    arenaHost.innerHTML = '';
    resultEl.hidden = true;
    resultEl.innerHTML = '';
    writeEl.hidden = true;
  }

  function setMode(id) {
    const inWrite = !!(view && view.id === 'yazma');
    if (!arenaMod || id === mode) { if (inWrite) arenaCtl?.focus?.(); return; }
    mode = id;
    update(d => { d.mode = id; });
    root.querySelectorAll('.tlh-mode').forEach(b => {
      const on = b.dataset.mode === id;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
    if (inWrite) newText(); else renderPreview();   // Merkez'de yalnız önizleme satırı değişir
  }

  function setSource(src) { setAll('src', src ? '— ' + src : ''); }

  function newText(same = false) {
    if (!arenaMod) return;
    if (!same || !current || current.mode !== mode) {
      const pk = takePeek(mode);   // Merkez önizlemesindeki satır: kullanıcı gördüğü metni yazar
      firstChunk = arenaMod.isStreamMode?.(mode) ? pk : null;
      current = arenaMod.isStreamMode?.(mode) ? { text: '', source: '', mode } : Object.assign(pk || arenaMod.pickText(mode), { mode });
    }
    const streamOn = isStream(current.mode);
    nextBtn.hidden = streamOn;   // akışta metin kendiliğinden ilerler; "Yeni metin" yalnız Kelime kipinde
    setAll('hint', streamOn ? 'Kesintisiz akış · bitirmek için Bitir ya da Esc' : 'Tek metin · bitince sonuç');
    setSource(current.source);
    startTyper();
  }

  function setCombo(n) {
    combo = n;
    bestCombo = Math.max(bestCombo, n);
    const b = comboEl.querySelector('b');
    b.textContent = String(n);
    comboEl.classList.toggle('is-hot', n >= 25);
    comboEl.classList.toggle('is-on', n > 0);
    if (n > 0 && n % 25 === 0 && !reduced()) {
      comboEl.classList.remove('is-pop'); void comboEl.offsetWidth; comboEl.classList.add('is-pop');
    }
  }

  let firstChunk = null;
  function takeFirst() { const f = firstChunk; firstChunk = null; return f; }
  /** Merkez'de basılan harf(ler)i yeni açılan yazıcıya aktarır ve odağı hemen yazma alanına verir. */
  function flushPending() {
    const ta = arenaHost.querySelector('textarea');
    if (!ta) return;
    try { ta.focus({ preventScroll: true }); } catch { ta.focus(); }
    if (!pendingKeys) return;
    ta.value = pendingKeys;
    pendingKeys = '';
    ta.dispatchEvent(new Event('input'));
  }

  function startTyper() {
    try { arenaCtl?.destroy?.(); } catch { /* yok */ }
    arenaCtl = null;
    arenaHost.innerHTML = '';
    resultEl.hidden = true;
    resultEl.innerHTML = '';
    lastTyped = 0; lastErr = 0; bestCombo = 0;
    setCombo(0);
    try {
      arenaCtl = mountTyperFn(arenaHost, {
        text: arenaMod.isStreamMode?.(current.mode) ? '' : current.text,
        stream: arenaMod.isStreamMode?.(current.mode) ? () => takeFirst() || arenaMod.nextChunk(current.mode) : null,
        keyboard: wantKeyboard(),
        sfx: typerSfx,
        // Akış: her yeni parça geldiğinde kaynak satırı güncellenir; biten her parça günlük "metin bitir" görevine sayılır.
        // Parçalar arasında sonuç kartı yok; özet yalnız Bitir/Esc ile (onFinish) gelir.
        onChunk(c) {
          const it = c && c.item;
          if (it) { current.text = it.text || ''; current.source = it.source || ''; setSource(current.source); }
          if (c && c.done) progress({ quests: current.mode === 'atasozu' ? ['daily', 'arena'] : ['daily'] });
        },
        onProgress(s) {
          const typed = num(s && s.typed), errs = num(s && s.errors);
          if (errs > lastErr) setCombo(0);
          else if (typed > lastTyped) setCombo(combo + (typed - lastTyped));
          lastTyped = typed; lastErr = errs;
        },
        onFinish(s) { finishArena(s || {}); },
      });
      flushPending();
    } catch (err) {
      try { console.warn('[home] yazma alanı açılamadı:', err); } catch { /* yok */ }
      arenaHost.innerHTML = errorCard('Yazma alanı açılamadı.');
    }
  }

  function rankOf(wpm, acc) {
    if (acc >= 97 && wpm >= 60) return ['ŞİMŞEK', 'var(--tl-cyan)'];
    if (acc >= 95 && wpm >= 45) return ['ALEV', 'var(--tl-ember)'];
    if (acc >= 92 && wpm >= 30) return ['USTA', 'var(--tl-gold)'];
    return ['ÇIRAK', 'var(--tl-violet-ink)'];
  }

  function finishArena(s) {
    // Hiç yazmadan Bitir/Esc: boş özet ve sahte sonuç yok, Merkez'e dön.
    if (!num(s.typed)) { closeView(); return; }
    const streamOn = isStream(current?.mode);
    const wpm = Math.round(num(s.wpm));
    const acc = Math.round(normAcc(s.acc));
    const secs = Math.round(num(s.elapsedMs) / 1000);
    const quests = [];
    if (!streamOn) { quests.push('daily'); if (current && current.mode === 'atasozu') quests.push('arena'); }
    const { record } = progress({ quests, finished: true, wpm, acc, mode: current?.mode, weak: s.weakKeys });
    const [rank, col] = rankOf(wpm, acc);
    resultEl.hidden = false;
    resultEl.style.setProperty('--rk', col);
    resultEl.innerHTML = `
      <div class="tlh-result-card" role="status">
        <p class="tlh-rank">${record ? '🏆 YENİ REKOR' : rank}</p>
        <p class="tlh-big"><b>${wpm}</b><small>WPM</small></p>
        <div class="tlh-result-nums">
          <span><b>%${acc}</b> doğruluk</span><span><b>${secs}</b> sn</span>
          ${streamOn ? `<span><b>${num(s.chunks)}</b> tamamlanan metin</span>` : ''}
          <span><b>${bestCombo}</b> en uzun kombo</span>
        </div>
        <div class="tlh-result-btns">
          <button type="button" class="tlh-btn tlh-btn--primary" data-tlh="next">${streamOn ? 'Yeni oturum' : 'Sonraki metin'} <kbd>Enter</kbd></button>
          ${streamOn ? '' : '<button type="button" class="tlh-btn tlh-btn--ghost" data-tlh="again">Aynısını tekrar</button>'}
          <button type="button" class="tlh-btn tlh-btn--ghost" data-tlh="back">Merkeze dön</button>
        </div>
      </div>`;
    resultEl.querySelector('[data-tlh="next"]').focus({ preventScroll: true });
    confetti();
    sfx.win();
    if (acc >= 98) setTimeout(() => sfx.voice('great'), 1100);
  }

  /* ---------- olaylar ---------- */
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tlh],[data-nav],[data-mode],[data-card],[data-lit],[data-lesson]');
    if (!t || !root.contains(t)) return;
    if (t.dataset.mode && t.classList.contains('tlh-mode')) { setMode(t.dataset.mode); return; }
    if (t.dataset.card) return;   // PvP kartı ?pvp=lobby bağlantısı: lobi açılır, maç kendiliğinden başlamaz
    if (t.dataset.lit) { openView('edebiyat', { intent: { cat: t.dataset.lit } }); return; }
    if (t.dataset.lesson) {
      const i = Number(t.dataset.lesson);
      const l = lessonData && lessonData.LESSONS[i];
      openView('egitim', { intent: l ? { lesson: l.id, index: i } : null });
      return;
    }
    const nav = t.dataset.nav;
    if (nav) {
      if (nav === 'pvp') return;            // bağlantı ?pvp=lobby adresine gider: PvP lobisi açılır, maç kendiliğinden başlamaz
      if (nav === 'hub') {                  // logo = Merkez (sayfayı yeniden yüklemeden)
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
        e.preventDefault();
        closeView();
        return;
      }
      openView(nav);
      return;
    }
    const act = t.dataset.tlh;
    if (act === 'back') { closeView(); return; }
    if (act === 'write') { openView('yazma'); return; }
    if (act === 'quests' || act === 'perf') { openView('performans'); return; }
    if (act === 'lit-all') { openView('edebiyat'); return; }
    if (act === 'lessons') { openView('egitim'); return; }
    if (act === 'resume') {
      const li = lessonInfo();
      openView('egitim', { intent: li && li.lesson ? { lesson: li.lesson.id, index: li.idx } : null });
      return;
    }
    if (act === 'next') { newText(); return; }
    if (act === 'again') { newText(true); return; }
    if (act === 'retry') {
      if (t.closest('.tlh-arena')) mountArena();
      else if (view) { const id = view.id, intent = view.intent; view = null; openView(id, { push: false, intent }); }
    }
  });

  soundBtn.addEventListener('click', () => {
    const on = !sfx.enabled;
    sfx.setEnabled(on);
    update(d => { d.sound = on; });
    renderStats();
    if (on) sfx.chime();
  });

  // Klavye: Escape → Merkez (akışta önce oturumu bitirir: typing.js Esc'yi kendisi işler); sonuçta Enter → yeni metin/oturum.
  // Merkez'de herhangi bir harfe basmak Yazma'yı açar; basılan harf (ve yazıcı kurulana dek basılanlar) kaybolmaz.
  const isField = (t) => !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  function typeToStart(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return false;
    if (typeof e.key !== 'string' || e.key.length !== 1 || e.key === ' ' || isField(e.target)) return false;
    if (root.hidden || pvpVisible()) return false;
    if (!view) { e.preventDefault(); pendingKeys = e.key; openView('yazma'); return true; }
    if (view.id === 'yazma' && !arenaCtl && resultEl.hidden) { e.preventDefault(); pendingKeys += e.key; return true; }
    return false;
  }
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && view && !e.defaultPrevented) { e.preventDefault(); closeView(); }
    if (e.key === 'Enter' && view && view.id === 'yazma' && !resultEl.hidden && !e.target.closest?.('button,a')) { e.preventDefault(); newText(); }
    typeToStart(e);
    if (!isField(e.target)) e.stopPropagation();
  });
  // Odak sayfa gövdesindeyken (ör. boş alana tıklanınca) de harfle başlasın.
  document.addEventListener('keydown', (e) => {
    if (e.target !== document.body && e.target !== document.documentElement) return;
    // (eski site / PvP dinleyicileri Esc'yi önceden preventDefault edebiliyor; Merkez görünürken gövdedeki Esc bizimdir)
    if (e.key === 'Escape' && view && !root.hidden && !pvpVisible()) { e.preventDefault(); closeView(); return; }
    typeToStart(e);
  });

  window.addEventListener('popstate', () => {
    if (root.hidden) return;
    const id = location.hash.slice(1);
    if (VIEW_IDS.includes(id)) openView(id, { push: false });
    else closeView({ fromPop: true, silent: true });
  });

  let resizeT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { try { arenaCtl?.setKeyboard?.(wantKeyboard()); } catch { /* yok */ } }, 200);
  });

  fab.addEventListener('click', () => showHome());
  document.addEventListener('tuslab:pvp-enter', () => {
    hideHome();
    // PvP açılmadıysa (iptal/hata) "ana sayfa gizli + PvP gizli" durumunda kalma
    setTimeout(() => { if (!pvpVisible()) showHome(); }, 4000);
  });

  function watchPvp() {
    const p = pvpRoot();
    if (!p) return false;
    // PvP kapanınca eski sayfada kalma: ana sayfaya dön.
    new MutationObserver(() => { if (!p.hidden) hideHome(); else showHome(); }).observe(p, { attributes: true, attributeFilter: ['hidden'] });
    if (!p.hidden) hideHome();
    return true;
  }

  /* ---------- başlat ---------- */
  function boot() {
    document.body.appendChild(root);
    document.body.appendChild(fab);
    document.documentElement.classList.add('tlh-lock');   // ana sayfa açıkken alttaki eski sayfa kaymasın
    if (!watchPvp()) {
      // #pvp-root sonradan eklenirse yakala
      const mo = new MutationObserver(() => { if (watchPvp()) mo.disconnect(); });
      mo.observe(document.body, { childList: true });
    }
    renderStats();
    if (!root.hidden) root.focus({ preventScroll: true });

    loadMod('sfx.js').then(m => {
      S = m.sfx;
      S.setEnabled(data.sound !== false);
      renderStats();
    }).catch(err => { try { console.warn('[home] ses modülü yüklenemedi:', err); } catch { /* yok */ } });

    // Merkez'deki gerçek sayılar: ders listesi (kaldığın ders, yıldız üst sınırı) ve metin havuzu (kart sayıları).
    Promise.all([loadMod('data/lessons.js'), loadMod('lessons.js')]).then(([ld, lm]) => {
      if (!Array.isArray(ld.LESSONS) || typeof lm.lessonUnlocked !== 'function') return;
      lessonData = { LESSONS: ld.LESSONS, UNITS: Array.isArray(ld.UNITS) ? ld.UNITS : [], lessonUnlocked: lm.lessonUnlocked };
      renderStats();
    }).catch(err => { try { console.warn('[home] ders verisi yüklenemedi:', err); } catch { /* yok */ } });
    loadArena().catch(err => { try { console.warn('[home] yazma modülü yüklenemedi:', err); } catch { /* yok */ } });

    const id = location.hash.slice(1);
    if (VIEW_IDS.includes(id) && !root.hidden) openView(id, { push: false });
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot, { once: true });
})();
