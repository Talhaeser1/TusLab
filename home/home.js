/* TuşLab ana sayfa kabuğu (klasik defer betik). Diğer home/ modüllerini dinamik import ile yükler.
 * Açılış ekranı "Merkez" = Sahne (docs/18): solda başlık + canlı satır + sayılar, sağda 5 kartlık bento. 3B sahne yok (düz CSS arka plan).
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
  // need: kilitliyken gösterilen koşul; cur: koşula doğru ilerleme (Performans rozet vitrini), goal: hedef sayı.
  const BADGES = [
    { id: 'ilk', icon: '🌱', name: 'İlk Adım', need: 'İlk metnini bitir', goal: 1, cur: d => num(d.stats.finished) },
    { id: 'seri3', icon: '🔥', name: '3 Gün Seri', need: '3 gün üst üste yaz', goal: 3, cur: d => streakNow(d) },
    { id: 'seri7', icon: '🌋', name: '7 Gün Seri', need: '7 gün üst üste yaz', goal: 7, cur: d => streakNow(d) },
    { id: 'hiz40', icon: '⚡', name: '40 WPM', need: '40 WPM hıza ulaş', goal: 40, cur: d => bestWpm(d) },
    { id: 'hiz60', icon: '🚀', name: '60 WPM', need: '60 WPM hıza ulaş', goal: 60, cur: d => bestWpm(d) },
    { id: 'kusursuz', icon: '💎', name: 'Kusursuz', need: 'Bir metni hatasız bitir', goal: 1, cur: d => num(d.stats.perfect) },
    { id: 'yildiz10', icon: '⭐', name: '10 Yıldız', need: 'Derslerde 10 yıldız topla', goal: 10, cur: d => lessonStars(d) },
    { id: 'gorev', icon: '🏅', name: 'Görev Avcısı', need: 'Bir günün 3 görevini bitir', goal: 1, cur: d => num(d.stats.allQuests) },
  ];
  const badgeOk = (bd, d) => bd.cur(d) >= bd.goal;

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
  // Sahne (24 Kas 2026, docs/18): solda kahraman alanı (başlık, iki düğme, kendi kendine yazılan canlı satır, 4 sayı),
  // sağda 5 kartlık bento (Yazma · Dersler · Şiir & Atasözü · PvP · Performans). Tür çipleri Şiir & Atasözü akışını
  // o türle doğrudan açar (intent.cat); kartın geri kalanı tür menüsünü açar. Sıra tür menüsüyle (literature.js) aynı.
  const LIT = [
    { id: 'atasozu', label: 'Atasözleri', short: 'Atasözü', unit: 'atasözü' },
    { id: 'deyim', label: 'Deyimler', short: 'Deyim', unit: 'deyim' },
    { id: 'siir', label: 'Şiirler', short: 'Şiir', unit: 'şiir' },
    { id: 'tekerleme', label: 'Tekerlemeler', short: 'Tekerleme', unit: 'tekerleme' },
    { id: 'ozdeyis', label: 'Özdeyişler', short: 'Özdeyiş', unit: 'özdeyiş' },
  ];
  // Yazma kartındaki tür çipleri: Yazma'yı o kiple açar (arena.js MODES ile aynı kimlikler; Kelime havuzu ilk seçimde iner).
  const WMODES = [['atasozu', 'Atasözü'], ['siir', 'Şiir'], ['deyim', 'Deyim'], ['tekerleme', 'Tekerleme'], ['ozdeyis', 'Özdeyiş'], ['kelime', 'Kelime']];
  const litChipHTML = (c) => `<li><button type="button" class="tlh-chip tlh-lit--${c.id}" data-lit="${c.id}" aria-label="${esc(c.label)}, başla"><span class="tlh-chip-ic" aria-hidden="true"></span>${esc(c.short)}<b data-s="litn-${c.id}"></b></button></li>`;

  /** Yazma kartının klavye görseli: elle SVG (Türkçe Q), her tuşun --i sırası üzerine gelince soldan sağa parlama dalgası verir. */
  const KB_SVG = (() => {
    const rows = [['QWERTYUIOPĞÜ', 0], ['ASDFGHJKLŞİ', 14], ['ZXCVBNMÖÇ', 36]];
    const K = 40, G = 6;
    let keys = '';
    rows.forEach(([letters, off], r) => {
      Array.from(letters).forEach((ch, c) => {
        const x = off + c * (K + G), y = r * (K + G);
        const home = r === 1 && (ch === 'F' || ch === 'J');
        const lit = ch === 'T' || ch === 'U' || ch === 'Ş';   // Tuş(Lab): üç tuş hep yanık
        keys += `<g class="tlh-kk${r === 1 ? ' is-home' : ''}${lit ? ' is-lit' : ''}" style="--i:${c + r}"><rect x="${x}" y="${y}" width="${K}" height="${K}" rx="8"/><text x="${x + K / 2}" y="${y + 26}">${ch}</text>${home ? `<rect class="tlh-kk-bump" x="${x + 14}" y="${y + 32}" width="12" height="2.5" rx="1"/>` : ''}</g>`;
      });
    });
    keys += `<g class="tlh-kk is-space" style="--i:7"><rect x="150" y="${3 * (K + G)}" width="252" height="${K}" rx="8"/></g>`;
    return `<svg class="tlh-cw-kb" viewBox="-4 -4 560 190" aria-hidden="true" focusable="false">${keys}</svg>`;
  })();

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
    <section class="tlh-stage" aria-labelledby="tlh-hub-h">
      <div class="tlh-stage-deco" aria-hidden="true"><span>ğ</span><span>ü</span><span>ş</span><span>i</span><span>ö</span><span>ç</span></div>
      <p class="tlh-stage-kicker"><span class="tlh-stage-dot" aria-hidden="true"></span>NEON ARENA · TÜRKÇE KLAVYE</p>
      <h1 id="tlh-hub-h" class="tlh-stage-h">Parmakların <span>ışık hızında</span></h1>
      <p class="tlh-stage-sub">On parmak öğren; atasözleri, şiirler ve deyimlerle hızlan, hazır olunca düelloya çık.</p>
      <div class="tlh-stage-btns">
        <button type="button" class="tlh-btn tlh-btn--primary tlh-btn--lg" data-tlh="write"><span aria-hidden="true">▶</span> Yazmaya başla</button>
        <button type="button" class="tlh-btn tlh-btn--line tlh-btn--lg tlh-resume" data-tlh="resume"><span aria-hidden="true">🎓</span><span class="tlh-resume-t" data-s="resume">İlk derse başla</span></button>
      </div>
      <button type="button" class="tlh-live" data-tlh="write" aria-describedby="tlh-live-tip">
        <span class="tlh-live-bar" aria-hidden="true"><i class="tlh-live-rec"></i><i data-s="pwmode">Atasözü</i><i class="tlh-live-src" data-s="pwsrc"></i></span>
        <span class="tlh-live-text"><span class="tlh-live-typed" aria-hidden="true">&#8203;</span><span class="tlh-live-caret" aria-hidden="true"></span><span class="tlh-live-rest" aria-hidden="true">Damlaya damlaya göl olur.</span><span class="tlh-sr" data-s="pwtext">Damlaya damlaya göl olur.</span></span>
      </button>
      <p id="tlh-live-tip" class="tlh-live-tip"><kbd>A</kbd><kbd>Ş</kbd><kbd>İ</kbd> Herhangi bir harfe bas, bu satırla hemen başla</p>
      <ul class="tlh-hero-stats" aria-label="Senin sayıların">
        <li class="tlh-hs tlh-hs--wpm"><b data-s="wpm">0</b><small>en iyi WPM</small></li>
        <li class="tlh-hs tlh-hs--acc"><b data-s="acc">—</b><small>ort. doğruluk</small></li>
        <li class="tlh-hs tlh-hs--star"><b><span data-s="stars">0</span><em>/<span data-s="starmax">—</span></em></b><small>ders yıldızı</small></li>
        <li class="tlh-hs tlh-hs--streak"><b data-s="streak">0</b><small>gün seri</small></li>
      </ul>
    </section>
    <div class="tlh-bento">
      <section class="tlh-c tlh-c-write" data-tlh="write" aria-labelledby="tlh-cw-h">
        <p class="tlh-c-kick">HEMEN YAZ</p>
        <h2 id="tlh-cw-h" class="tlh-c-title">Yazma <span>Arenası</span></h2>
        <p id="tlh-cw-d" class="tlh-c-desc"><span>Kesintisiz akış</span> · <span data-s="card-yazma">metinler durmadan akar</span></p>
        <ul class="tlh-cw-tags" aria-label="Metin türüyle başla">${WMODES.map(([id, l]) => `<li><button type="button" class="tlh-cw-tag" data-wmode="${id}" aria-label="${esc(l)} ile yazmaya başla">${esc(l)}</button></li>`).join('')}</ul>
        <ul class="tlh-cw-me" aria-label="Senin sayıların"><li class="tlh-cw-pill is-last"><small>Son yazış</small><b data-s="cw-last">—</b></li><li class="tlh-cw-pill is-best"><small>Rekor</small><b data-s="cw-best">—</b></li><li class="tlh-cw-pill is-n"><small>Bugün</small><b data-s="cw-n">0 yazış</b></li></ul>
        <button type="button" class="tlh-c-go" data-tlh="write" aria-label="Yazma Arenası: yazmaya başla" aria-describedby="tlh-cw-d">Yazmaya başla <span aria-hidden="true">→</span></button>
        ${KB_SVG}
      </section>
      <section class="tlh-c tlh-c-edu" data-tlh="resume" aria-labelledby="tlh-ce-h">
        <p class="tlh-c-kick">ON PARMAK · EĞİTİM</p>
        <h2 id="tlh-ce-h" class="tlh-c-title">Klavye <span>Dersleri</span></h2>
        <div class="tlh-edu-top">
          <span class="tlh-ring" aria-hidden="true"><svg viewBox="0 0 64 64" focusable="false"><circle class="tlh-ring-bg" cx="32" cy="32" r="27" pathLength="100"/><circle class="tlh-ring-fg" data-s-ring cx="32" cy="32" r="27" pathLength="100"/></svg><b data-s="ldone">0</b></span>
          <div class="tlh-edu-txt">
            <p class="tlh-edu-sum" data-s="card-egitim">47 ders · 8 ünite</p>
            <p class="tlh-edu-unit" data-s="unit">Ünite 1 · Temel Sıra</p>
          </div>
        </div>
        <ol class="tlh-path" aria-label="Sıradaki dersler"></ol>
        <button type="button" class="tlh-c-link" data-tlh="lessons">Ders haritası <span aria-hidden="true">→</span></button>
      </section>
      <section class="tlh-c tlh-c-lit" data-tlh="lit-all" aria-labelledby="tlh-cl-h">
        <header class="tlh-c-head"><h2 id="tlh-cl-h" class="tlh-c-h">Şiir &amp; Atasözü</h2><button type="button" class="tlh-c-link tlh-c-link--ic" data-tlh="lit-all" aria-label="Tüm türler" title="Tüm türler"><span aria-hidden="true">→</span></button></header>
        <figure class="tlh-quote"><blockquote data-s="quote">Damlaya damlaya göl olur.</blockquote><figcaption><span>Günün sözü</span><span data-s="quotesrc"></span></figcaption></figure>
        <ul class="tlh-chips" aria-label="Edebiyat türleri">${LIT.map(litChipHTML).join('')}</ul>
      </section>
      <a class="tlh-c tlh-c-pvp" href="?pvp=lobby" data-card="pvp" aria-label="PvP Düello: yazarak dövüş, bot ya da arkadaşla. Lobiye git">
        <span class="tlh-c-kick"><span aria-hidden="true">⚔️</span> DÜELLO</span>
        <span class="tlh-c-title">PvP Düello</span>
        <span class="tlh-pvp-desc">Yazarak dövüş · bot ya da arkadaş</span>
        <span class="tlh-c-go">Lobiye git <span aria-hidden="true">→</span></span>
      </a>
      <section class="tlh-c tlh-c-perf" data-tlh="perf" aria-labelledby="tlh-cp-h">
        <header class="tlh-c-head"><h2 id="tlh-cp-h" class="tlh-c-h">Performans</h2><button type="button" class="tlh-c-link tlh-c-link--ic" data-tlh="perf" aria-label="Performans ayrıntıları" title="Performans ayrıntıları"><span aria-hidden="true">→</span></button></header>
        <div class="tlh-met-slot" data-slot="metrik-grafik"></div>
        <div class="tlh-mq-box">
          <p class="tlh-mq-cap">Günlük görevler <b data-s="qcount">0/3</b></p>
          <ul class="tlh-mq" data-s-mq></ul>
        </div>
      </section>
    </div>
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
      <div class="tlh-arena-head">
        <div class="tlh-modes" role="radiogroup" aria-label="Metin türü"></div>
        <div class="tlh-arena-acts tl-edu"></div>
      </div>
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
  const pathEl = $('.tlh-path');
  const metEl = $('[data-slot="metrik-grafik"]');
  const mqEl = $('[data-s-mq]');
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
    const parts = Array.from({ length: 70 }, () => ({
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
  let litInfo = null;      // { atasozu: { n, ex }, … } — arena.js yüklenince bir kez (boşta) hesaplanır
  // yalnız değişince yazar: renderStats açılışta 4–5 kez çağrılır, aynı metni yeniden yazmak düğüm değiştirip stil hesabı tetikliyordu
  const setAll = (k, v) => root.querySelectorAll(`[data-s="${k}"]`).forEach(el => { if (el.textContent !== v) el.textContent = v; });

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

  /** Dersler kartı: kaldığın ders + sonraki ikisi (biten / şimdi / açık / kilitli). */
  function renderPath(li) {
    if (!pathEl || !lessonData) return;
    const { LESSONS, lessonUnlocked } = lessonData;
    const all = data.sec.egitim && typeof data.sec.egitim === 'object' ? data.sec.egitim : {};
    const recs = all.lessons && typeof all.lessons === 'object' ? all.lessons : {};
    const start = Math.max(0, Math.min(li.idx, LESSONS.length - 3));
    const html = LESSONS.slice(start, start + 3).map((l, k) => {
      const i = start + k;
      const stars = Math.min(3, num(recs[l.id] && recs[l.id].stars));
      const st = stars > 0 ? 'done' : i === li.idx ? 'now' : lessonUnlocked(all, i) ? 'open' : 'lock';
      const mark = st === 'done' ? `<span class="tlh-step-s" aria-label="${stars} yıldız">${'★'.repeat(stars)}<em>${'★'.repeat(3 - stars)}</em></span>`
        : st === 'now' ? '<span class="tlh-step-s">sıradaki</span>'
        : st === 'lock' ? '<span class="tlh-step-s" aria-label="kilitli">🔒</span>' : '<span class="tlh-step-s">açık</span>';
      const inner = `<span class="tlh-step-n">${i + 1}</span><span class="tlh-step-t">${esc(l.title)}</span>${mark}`;
      return `<li class="tlh-step is-${st}">${st === 'lock' ? `<span class="tlh-step-b">${inner}</span>`
        : `<button type="button" class="tlh-step-b" data-lesson="${i}"${st === 'now' ? ' aria-current="step"' : ''} aria-label="Ders ${i + 1}: ${esc(l.title)}, ${st === 'done' ? stars + ' yıldız' : st === 'now' ? 'sıradaki' : 'açık'}">${inner}</button>`}</li>`;
    }).join('');
    if (pathEl.innerHTML !== html) pathEl.innerHTML = html;
  }

  /* ---------- Metrik paneli (Merkez solu) ve Performans: aynı bileşenler, iki boy ----------
   * Tüm sayılar tek geçişte computeMetrics() ile çıkar; grafikler elle SVG (viewBox 0–100, preserveAspectRatio none,
   * çizgiler non-scaling-stroke) + HTML etiket/nokta (yüzde konumlu → yeniden boyutlanınca JS gerekmez).
   * Çıktı dizgesi önbellekle karşılaştırılır: veri değişmedikçe DOM'a yazılmaz (gereksiz yeniden çizim yok). */
  const MODE_NAME = { atasozu: 'Atasözü', siir: 'Şiir', deyim: 'Deyim', tekerleme: 'Tekerleme', ozdeyis: 'Özdeyiş', kelime: 'Kelime', edebiyat: 'Şiir & Atasözü', egitim: 'Ders' };
  const DAY_SHORT = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];
  const MONTH_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const shortDate = (t) => { const d = new Date(t); return d.getDate() + ' ' + MONTH_SHORT[d.getMonth()]; };
  const QUEST_SHORT = { lesson: '1 ders bitir', acc98: '%98 doğrulukla yaz', daily: '2 metin bitir', wpm35: '35+ WPM hıza ulaş', lit: 'Şiir köşesinde 1 metin', arena: 'Atasözü modunda 1 metin' };

  /** Saf hesap (DOM yok): son n yazış, ortalamalar, 7 günlük etkinlik (seriyle tutarlı), zayıf tuşlar. */
  function computeMetrics(d = data, n = 12) {
    const all = d.history.filter(x => x && typeof x === 'object' && num(x.wpm) > 0);
    const hist = all.slice(-n);
    const wpms = hist.map(x => num(x.wpm));
    const accHist = hist.filter(x => num(x.acc) > 0);
    const mean = (a) => a.length ? Math.round(a.reduce((s, v) => s + v, 0) / a.length) : null;
    // gün başına biten metin: geçmiş + günlük sayaç (d.days); seri sürüyorsa serinin günleri en az "etkin"
    const counts = {};
    for (const x of all) if (num(x.t) > 0) { const k = dayKey(new Date(x.t)); counts[k] = (counts[k] || 0) + 1; }
    if (d.days && typeof d.days === 'object') for (const [k, v] of Object.entries(d.days)) counts[k] = Math.max(counts[k] || 0, num(v));
    const run = new Set();
    const sc = streakNow(d);
    if (sc > 0 && d.streak && d.streak.last) {
      const [y, mo, da] = String(d.streak.last).split('-').map(Number);
      for (let i = 0; i < Math.min(sc, 60); i++) run.add(dayKey(new Date(y, mo - 1, da - i)));
    }
    // son 30 gün (Performans ısı şeridi); son 7'si haftalık görünüm
    const month = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const k = dayKey(dt);
      const c = counts[k] || 0;
      month.push({ key: k, label: DAY_SHORT[dt.getDay()], dn: dt.getDate(), date: dt.getDate() + ' ' + MONTH_SHORT[dt.getMonth()], count: c, on: c > 0 || run.has(k), today: i === 0 });
    }
    const week = month.slice(-7);
    const weak = Object.entries(d.weak).filter(([k, v]) => k.trim() && num(v) > 0).sort((a, b) => b[1] - a[1]);
    const accs = accHist.map(x => num(x.acc));
    return {
      hist, wpms, total: all.length,
      avgW: mean(wpms), maxW: wpms.length ? Math.max(...wpms) : 0, lastW: wpms.length ? wpms[wpms.length - 1] : 0,
      accHist, accs, avgA: mean(accs),
      week, month, activeDays: week.filter(w => w.on).length, weak, streak: sc,
    };
  }

  const niceMax = (v) => { const step = v > 100 ? 20 : 10; return Math.max(step * 2, Math.ceil(v / step) * step); };
  const pct = (v) => Math.round(v * 10) / 10;

  /** Çizgi/alan grafiği. vals: sayılar; lo/hi: dikey aralık; ticks: eksen değerleri; refs: [{ v, cls }] yatay çizgiler. */
  function lineChart({ vals, lo, hi, ticks, refs = [], cls, uid, aria, fmt = String, titles = [], xl = null, showVals = false }) {
    const n = vals.length;
    const X = (i) => n === 1 ? 50 : pct(i / (n - 1) * 100);
    const Y = (v) => pct(100 - (Math.min(hi, Math.max(lo, v)) - lo) / Math.max(1, hi - lo) * 100);
    const xy = vals.map((v, i) => X(i) + ',' + Y(v));
    const svg = n > 1
      ? `<path class="tlh-ch-area" fill="url(#${uid})" d="M${X(0)},100 L${xy.join(' L')} L${X(n - 1)},100 Z"/>`
        + refs.map(r => `<line class="tlh-ch-ref ${r.cls}" x1="0" x2="100" y1="${Y(r.v)}" y2="${Y(r.v)}" vector-effect="non-scaling-stroke"/>`).join('')
        + `<polyline class="tlh-ch-ln" points="${xy.join(' ')}" vector-effect="non-scaling-stroke"/>`
      : '';
    const dots = vals.map((v, i) => `<i class="tlh-ch-dot${i === n - 1 ? ' is-last' : ''}" style="left:${X(i)}%;top:${Y(v)}%"${titles[i] ? ` title="${esc(titles[i])}"` : ''}>${showVals || i === n - 1 ? `<b>${esc(fmt(v))}</b>` : ''}</i>`).join('');
    return `<div class="tlh-ch ${cls}" role="img" aria-label="${esc(aria)}">
          <div class="tlh-ch-y" aria-hidden="true">${ticks.map(t => `<span style="top:${Y(t)}%">${esc(fmt(t))}</span>`).join('')}</div>
          <div class="tlh-ch-plot" aria-hidden="true">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false"><defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="tlh-ch-g0"/><stop offset="1" class="tlh-ch-g1"/></linearGradient></defs>${ticks.map(t => `<line class="tlh-ch-grid" x1="0" x2="100" y1="${Y(t)}" y2="${Y(t)}" vector-effect="non-scaling-stroke"/>`).join('')}${svg}</svg>
            ${dots}
          </div>
          ${xl ? `<div class="tlh-ch-x" aria-hidden="true"><span>${esc(xl[0])}</span><span>${esc(xl[1])}</span></div>` : ''}
        </div>`;
  }

  const histTitle = (x) => `${num(x.wpm)} WPM · %${num(x.acc)}${x.m ? ' · ' + (MODE_NAME[x.m] || x.m) : ''}${num(x.t) ? ' · ' + shortDate(x.t) : ''}`;

  /** Hız grafiği (+ ort./en iyi çizgileri ve lejant). Boşken davetkâr boş durum, tek kayıtta tek nokta. */
  function speedHTML(m, big) {
    const n = m.hist.length;
    if (!n) {
      return `<div class="tlh-ch-empty">
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" focusable="false"><polyline points="0,34 16,28 32,30 48,20 64,22 80,12 100,8" vector-effect="non-scaling-stroke"/></svg>
          <p><b>Hız eğrin burada çizilecek.</b><span>Her bitirdiğin metin bir nokta olur.</span></p>
          <button type="button" class="tlh-btn tlh-btn--primary tlh-ch-cta" data-tlh="write"><span aria-hidden="true">▶</span> İlk yazını yap</button>
        </div>`;
    }
    const hi = niceMax(m.maxW * 1.12);
    const first = m.hist[0];
    const chart = lineChart({
      vals: m.wpms, lo: 0, hi, ticks: [0, hi / 2, hi], cls: 'tlh-ch--wpm', uid: big ? 'tlh-gw-p' : 'tlh-gw-h',
      refs: n > 1 ? [{ v: m.avgW, cls: 'is-avg' }, { v: m.maxW, cls: 'is-best' }] : [],
      aria: n > 1 ? `Son ${n} yazışın hızı: ortalama ${m.avgW}, en iyi ${m.maxW}, son ${m.lastW} WPM` : `İlk yazışın: ${m.lastW} WPM`,
      titles: m.hist.map(histTitle), showVals: big && n <= 24,
      xl: n > 1 ? [num(first.t) ? shortDate(first.t) : n + ' yazış önce', 'son'] : null,
    });
    const legend = n > 1
      ? `<p class="tlh-ch-lg"><span class="is-avg">ort. <b>${m.avgW}</b></span><span class="is-best">en iyi <b>${m.maxW}</b></span>${big ? `<span class="is-last">son <b>${m.lastW}</b></span>` : ''}</p>`
      : `<p class="tlh-ch-lg tlh-ch-lg--one"><span>Bir yazış daha: eğilim çizilsin.</span></p>`;
    return chart + legend;
  }

  /** Günlük görev satırları. Bitmeyen görev bir düğmedir (o işi açar: data-quest). */
  function questRows(big) {
    const ids = todaysQuestIds();
    const q = questState();
    return ids.map(id => {
      const Q = QUESTS[id];
      const need = Q.need || 1;
      const done = !!q.done[id];
      const have = done ? need : Math.min(need, num(q.count && q.count[id]));
      const text = big ? Q.text : (QUEST_SHORT[id] || Q.text);
      const inner = `<span class="tlh-mq-ic" aria-hidden="true">${Q.icon}</span><span class="tlh-mq-t">${esc(text)}</span>`
        + `<span class="tlh-mq-c">${done ? '<span aria-hidden="true">✓</span><span class="tlh-sr">tamamlandı</span>' : `${have}/${need}<span class="tlh-sr"> bekliyor</span>`}</span>`
        + `<span class="tlh-mq-bar" aria-hidden="true"><i style="width:${Math.round(have / need * 100)}%"></i></span>`;
      return `<li class="tlh-mq-i${done ? ' is-done' : ''}">${done ? `<span class="tlh-mq-b" title="${esc(Q.text)}">${inner}</span>`
        : `<button type="button" class="tlh-mq-b" data-quest="${id}" title="${esc(Q.text)} — başla" aria-label="${esc(Q.text)}: ${have}/${need}, başla">${inner}</button>`}</li>`;
    }).join('');
  }

  /** Merkez Performans kartındaki mini pano: yalnız hız eğrisi (küçük hâl). 7 gün, doğruluk, zayıf tuşlar Performans'ta. */
  let metHtml = '', mqHtml = '';
  function renderMetrics() {
    if (!metEl) return;
    const m = computeMetrics(data, 12);
    const n = m.hist.length;
    const html = `
        <p class="tlh-met-cap"><span>${n > 1 ? `Son ${n} yazış · hız` : 'Hız eğrin'}</span><em>WPM</em></p>
        ${speedHTML(m, false)}`;
    metEl.classList.toggle('is-empty', !n);
    if (html !== metHtml) { metHtml = html; metEl.innerHTML = html; }
    if (mqEl) { const r = questRows(false); if (r !== mqHtml) { mqHtml = r; mqEl.innerHTML = r; } }
  }

  /* ---------- Yazma önizlemesi (Merkez ortası) ----------
   * Önizlemedeki satır akışın ilk parçasıdır (peek): "Yazmaya başla" ya da bir harfe basınca aynı satır yazılır,
   * basılan ilk harf de kaybolmaz (pendingKeys → yazıcıya aktarılır). */
  let peek = null;          // { mode, chunk }
  let pendingKeys = '';
  /** Kelime kipi kelime havuzunu ister (arena.js loadWords, açılışta inmez). Hazır değilse yükler, sonra fn'i çağırır; true döner. */
  function needWords(m, fn) {
    if (m !== 'kelime' || !arenaMod || typeof arenaMod.loadWords !== 'function' || arenaMod.wordsReady()) return false;
    arenaMod.loadWords().then(() => fn(), (err) => {
      try { console.warn('[home] kelime havuzu yüklenemedi:', err); } catch { /* yok */ }
      if (view && view.id === 'yazma' && mode === 'kelime') arenaHost.innerHTML = errorCard('Kelime havuzu şu an yüklenemedi.');
    });
    return true;
  }
  function ensurePeek() {
    if (!arenaMod) return null;
    if (needWords(mode, renderPreview)) return null;
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
    liveRun();
  }

  /* ---------- Canlı satır (Sahne): önizleme satırı harf harf kendiliğinden yazılır ----------
   * ≈14 harf/sn; bitince 3 sn bekler, akıştaki sıradaki parçaya geçer (peek yenilenir → harfe basınca yazılan satır
   * her an ekrandakiyle aynı). Yalnız Merkez görünürken çalışır; azaltılmış harekette satır hazır yazılmış durur.
   * Her adımda yalnız iki metin düğümünün verisi değişir (setText kuralı: düğüm değiştirme yok → ucuz stil hesabı). */
  const LIVE_MAX = 120;
  const liveTyped = $('.tlh-live-typed');
  const liveRest = $('.tlh-live-rest');
  const liveBox = $('.tlh-live-text');
  const liveCaret = $('.tlh-live-caret');
  let liveT = 0, liveChunk = null, liveChars = [], liveI = 0;
  const liveData = (el, v) => { if (el.firstChild && el.firstChild.nodeType === 3) { if (el.firstChild.data !== v) el.firstChild.data = v; } else el.textContent = v; };
  const liveCut = (t) => (t.length <= LIVE_MAX ? t : t.slice(0, LIVE_MAX).replace(/\s+\S*$/, '') + ' …');
  function livePaint() {
    liveData(liveTyped, liveChars.slice(0, liveI).join('') || '​');
    liveData(liveRest, liveChars.slice(liveI).join(''));
    // kısa ekranda satır tek satırdır (home.css): imleç görünür kalsın diye satır yatayda kaydırılır
    const x = liveBox.scrollWidth > liveBox.clientWidth + 1 ? Math.max(0, Math.round(liveCaret.offsetLeft - liveBox.clientWidth * 0.72)) : 0;
    if (liveBox.scrollLeft !== x) liveBox.scrollLeft = x;
    if (liveBox.classList.contains('is-shift') !== x > 0) liveBox.classList.toggle('is-shift', x > 0);
  }
  function liveRun() {
    clearTimeout(liveT);
    liveT = 0;
    if (!arenaMod || view || root.hidden || document.hidden) return;
    const p = ensurePeek();
    if (!p) return;
    if (p.chunk !== liveChunk) {
      liveChunk = p.chunk;
      liveChars = Array.from(liveCut(p.chunk.text));
      liveI = 0;
      setAll('pwtext', p.chunk.text);
      const mm = arenaMod.MODES.find(x => x.id === mode);
      setAll('pwsrc', p.chunk.source && (!mm || p.chunk.source !== mm.label) ? p.chunk.source : '');
    }
    if (reduced()) { liveI = liveChars.length; livePaint(); return; }
    if (liveI < liveChars.length) {
      liveI++;
      livePaint();
      const ch = liveChars[liveI - 1];
      liveT = setTimeout(liveRun, ch === ' ' ? 95 : /[,.;!?]/.test(ch) ? 180 : 52 + Math.random() * 38);
    } else {
      livePaint();
      liveT = setTimeout(() => { if (peek && peek.chunk === liveChunk) peek = null; liveRun(); }, 3000);
    }
  }
  // Sekmeye dönünce: gün değişmiş olabilir (görevler/seri yenilenir) ya da başka sekmede ilerleme kaydedilmiş olabilir.
  let visDay = today();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (visDay !== today() || !view) { visDay = today(); data = readStore(); renderStats(); }
    liveRun();
  });
  function renderModeButtons(host) {
    if (!host || !arenaMod) return;
    host.innerHTML = arenaMod.MODES.map(m => `
        <button type="button" class="tlh-mode${m.id === mode ? ' is-on' : ''}" role="radio" aria-checked="${m.id === mode}" data-mode="${m.id}" title="${esc(m.hint)}">
          <span aria-hidden="true">${m.icon}</span>${esc(m.label)}</button>`).join('');
  }

  /* ---------- Şiir & Atasözü kartı ----------
   * Tür sayıları + "Günün sözü": itemsFor() tür başına bir kez, ilk boyamadan sonra boşta çalışır (açılışı geciktirmez).
   * Söz her açılışta rastgele bir atasözü ya da özdeyiş; karta sığsın diye kısa olanlardan seçilir. */
  const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 200));
  function litSample(items) {
    if (!items.length) return null;
    const short = items.filter(it => it.text.length <= 72 && it.text.length >= 18);
    const pool = short.length ? short : items;
    const it = pool[Math.floor(Math.random() * pool.length)];
    return { text: it.text, source: it.source || '' };
  }
  function computeLit(am) {
    const out = {};
    for (const c of LIT) {
      let items = [];
      try { items = am.itemsFor(c.id) || []; } catch { items = []; }
      out[c.id] = { n: items.length, ex: c.id === 'atasozu' || c.id === 'ozdeyis' ? litSample(items) : null };
    }
    const pick = [out.atasozu.ex, out.ozdeyis.ex].filter(Boolean);
    out.quote = pick.length ? pick[Math.floor(Math.random() * pick.length)] : null;
    return out;
  }
  let quoteOn = false;
  function renderLit() {
    const recs = (data.sec && data.sec.edebiyat && data.sec.edebiyat.litStreams) || {};
    if (litInfo && litInfo.quote && !quoteOn) {
      quoteOn = true;
      setAll('quote', litInfo.quote.text);
      setAll('quotesrc', litInfo.quote.source ? '— ' + litInfo.quote.source : '');
    }
    for (const c of LIT) {
      const info = litInfo && litInfo[c.id];
      const r = recs[c.id] || {};
      const items = Math.max(0, num(r.items));
      if (info) setAll('litn-' + c.id, String(info.n));
      const btn = root.querySelector(`[data-lit="${c.id}"]`);
      if (btn) {
        const best = r.best && num(r.best.wpm);
        btn.title = `${c.label}: kesintisiz yaz${items ? ` · ${items} metin yazdın` : ''}${best ? ` · en iyi ${best} WPM` : ''}`;
        btn.setAttribute('aria-label', `${c.label}, başla${info ? ` (${info.n} ${c.unit})` : ''}${items ? `, ${items} metin yazdın` : ''}${best ? `, en iyi ${best} WPM` : ''}`);
      }
    }
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
      setAll('resume', li.started && li.lesson ? `Kaldığın ders: ${li.idx + 1}` : 'İlk derse başla');
      const rb = root.querySelector('.tlh-stage .tlh-resume');
      if (rb && li.lesson) rb.title = `Ders ${li.idx + 1} · ${li.lesson.title}`;
      const units = lessonData.UNITS.length;
      setAll('card-egitim', `${li.total} ders${units ? ' · ' + units + ' ünite' : ''}`);
      setAll('ldone', String(li.done));
      const ring = root.querySelector('[data-s-ring]');
      if (ring) ring.style.strokeDasharray = `${Math.round((li.done / Math.max(1, li.total)) * 100)} 100`;
      const ui = li.lesson ? lessonData.UNITS.findIndex(u => u.id === li.lesson.unit) : -1;
      setAll('unit', `${li.done}/${li.total} ders bitti${ui >= 0 ? ` · Ünite ${ui + 1}: ${lessonData.UNITS[ui].title}` : ''}`);
      renderPath(li);
    }
    renderLit();
    const last = data.history[data.history.length - 1];
    // Yazma kartı rozetleri: son yazış · rekor · bugün biten metin (veri yoksa "—")
    setAll('cw-last', last && num(last.wpm) ? `${num(last.wpm)} WPM` : '—');
    setAll('cw-best', bestWpm() ? `${bestWpm()} WPM` : '—');
    setAll('cw-n', `${num(data.days && data.days[today()])} yazış`);
    renderMetrics();

    const ids = todaysQuestIds();
    const q = questState();
    const done = ids.filter(id => q.done[id]).length;
    setAll('qcount', `${done}/${ids.length}`);
    const ql = $('.tlh-quest-list');   // yalnız Performans açıkken var
    if (ql) ql.innerHTML = questRows(true);
    const bl = $('.tlh-pf-bd');
    if (bl) bl.innerHTML = badgesHTML(data);

    soundBtn.setAttribute('aria-pressed', String(sfx.enabled));
    soundBtn.setAttribute('aria-label', sfx.enabled ? 'Sesi kapat' : 'Sesi aç');
    soundBtn.firstElementChild.textContent = sfx.enabled ? '🔊' : '🔇';
  }

  /** İlerleme olaylarını işler: görevler, seri, rozetler, geçmiş, zayıf tuşlar.
   *  finished: bir METİN bitti (biten metin sayacı, gün sayacı, seri). hist: hız geçmişine yaz (varsayılan finished;
   *  metin bitmeden ≥ 20 harflik Yazma denemesi yalnız hız olarak kaydedilir). accOk: "%98 doğrulukla bir metin" görevine
   *  sayılabilir mi (metin bitmediyse hayır). */
  function progress({ quests = [], finished = false, wpm = 0, acc = 0, mode = '', weak = null, hist = finished, accOk = true } = {}) {
    const msgs = [];
    let record = false;
    update(d => {
      if (finished) {
        d.stats.finished = num(d.stats.finished) + 1;
        if (acc >= 100) d.stats.perfect = num(d.stats.perfect) + 1;
        touchStreak(d);
        // gün başına biten metin (haftalık etkinlik); 60 günden eskisi atılır
        const days = d.days && typeof d.days === 'object' && !Array.isArray(d.days) ? d.days : {};
        days[today()] = num(days[today()]) + 1;
        const cut = new Date(); cut.setDate(cut.getDate() - 60);
        for (const k of Object.keys(days)) if (k < dayKey(cut)) delete days[k];
        d.days = days;
      }
      if (hist && wpm > 0) {
        d.history.push({ t: Date.now(), wpm: Math.round(wpm), acc: Math.round(acc * 10) / 10, m: mode });
        if (d.history.length > 40) d.history = d.history.slice(-40);
      }
      if (weak && typeof weak === 'object') {
        for (const [k, v] of Object.entries(weak)) if (k.trim()) d.weak[k] = num(d.weak[k]) + num(v);
      }
      if (wpm > 0) {
        if (wpm > num(d.bestWpm) && wpm > bestWpm(d) && num(d.stats.finished) > 1) record = true;
        d.bestWpm = Math.max(num(d.bestWpm), Math.round(wpm));
      }
      if (wpm >= 35) quests.push('wpm35');
      if (acc >= 98 && accOk) quests.push('acc98');
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
      if (ids.every(id => q.done[id]) && !q.allCounted) {
        q.allCounted = true;
        d.stats.allQuests = num(d.stats.allQuests) + 1;
        msgs.push(`Bugünün ${ids.length} görevi tamam! Yarın yenileri gelir.`);
      }
      d.quests = q;
      for (const bd of BADGES) {
        if (!d.badges[bd.id] && badgeOk(bd, d)) { d.badges[bd.id] = today(); msgs.push(`Yeni rozet: ${bd.icon} ${bd.name}`); }
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

  /* ---------- Performans görünümü (Terazi, 24 Kas): pano ----------
   * Üstte özet (seviye + 4 sayı, Ders Haritası başlığıyla aynı aile), solda büyük hız/doğruluk grafiği (tür süzgeci),
   * sağda günlük görevler ve 7/30 günlük etkinlik şeridi, altta zorlanılan tuşlar (ekran klavyesi ısı haritası),
   * son yazışlar tablosu ve rozet vitrini. Hepsi elle HTML/SVG; süzgeç ve şerit seçimi yalnız ilgili kutuyu yeniden çizer. */
  const two = (v) => String(v).padStart(2, '0');
  const timeOf = (t) => { const d = new Date(t); return two(d.getHours()) + ':' + two(d.getMinutes()); };
  const modeOf = (x) => (x && MODE_NAME[x.m] ? x.m : 'diger');
  const modeLabel = (id) => MODE_NAME[id] || 'Diğer';
  /** Zaman ekseni etiketleri (Hakem, docs/25): hepsi aynı gündeyse saat; değilse tarih, art arda aynı tarih tekrar yazılmaz. */
  const xLabels = (ts) => {
    let ds = ts.map(t => (t ? shortDate(t) : ''));
    if (ts.length > 1 && ts.every(t => t) && ds.every(d => d === ds[0])) ds = ts.map(timeOf);
    return ds.map((d, j) => (j && d === ds[j - 1] ? '' : d));
  };
  const isoDate = (k) => { const [y, mo, da] = String(k).split('-').map(Number); return y && mo && da ? da + ' ' + MONTH_SHORT[mo - 1] : ''; };

  /** Büyük grafik: hız (sol eksen, WPM, alan + çizgi + ortalama) ve doğruluk (sağ eksen, %) aynı zaman ekseninde.
   *  SVG yüzde ölçekli (yeniden boyutlanınca JS yok); değer kutusu tek dinleyiciyle (üzerine gelince / ok tuşları). */
  function perfChartHTML(list) {
    const n = list.length;
    if (!n) {
      return `<div class="tlh-ch-empty tlh-pc-empty">
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" focusable="false"><polyline points="0,34 16,28 32,30 48,20 64,22 80,12 100,8" vector-effect="non-scaling-stroke"/></svg>
          <p><b>Hız eğrin burada çizilecek.</b><span>Her bitirdiğin metin bir nokta olur; doğruluğun yanında yeşil çizgiyle görünür.</span></p>
          <button type="button" class="tlh-btn tlh-btn--primary tlh-ch-cta" data-tlh="write"><span aria-hidden="true">▶</span> İlk yazını yap</button>
        </div>`;
    }
    const w = list.map(x => num(x.wpm));
    const accs = list.map(x => num(x.acc)).filter(v => v > 0);
    const hi = niceMax(Math.max(...w) * 1.12);
    const lo = accs.length ? Math.max(0, Math.min(90, Math.floor((Math.min(...accs) - 2) / 5) * 5)) : 90;
    const X = (i) => (n === 1 ? 50 : pct(i / (n - 1) * 100));
    const YW = (v) => pct(100 - Math.min(hi, Math.max(0, v)) / hi * 100);
    const YA = (v) => pct(100 - (Math.min(100, Math.max(lo, v)) - lo) / Math.max(1, 100 - lo) * 100);
    const parts = hi % 4 === 0 ? 4 : hi % 3 === 0 ? 3 : 2;
    const wt = Array.from({ length: parts + 1 }, (_, i) => Math.round(hi / parts * i));
    const at = [lo, Math.round((lo + 100) / 2), 100];
    const avg = Math.round(w.reduce((a, v) => a + v, 0) / n);
    const pw = w.map((v, i) => X(i) + ',' + YW(v));
    const pa = list.map((x, i) => (num(x.acc) > 0 ? X(i) + ',' + YA(num(x.acc)) : '')).filter(Boolean);
    const xi = n === 1 ? [0] : [...new Set([0, Math.round((n - 1) / 4), Math.round((n - 1) / 2), Math.round((n - 1) * 3 / 4), n - 1])];
    const svg = (n > 1 ? `<path class="tlh-ch-area" fill="url(#tlh-pc-g)" d="M${X(0)},100 L${pw.join(' L')} L${X(n - 1)},100 Z"/>`
      + `<line class="tlh-ch-ref is-avg" x1="0" x2="100" y1="${YW(avg)}" y2="${YW(avg)}" vector-effect="non-scaling-stroke"/>`
      + (pa.length > 1 ? `<polyline class="tlh-pc-acc" points="${pa.join(' ')}" vector-effect="non-scaling-stroke"/>` : '')
      + `<polyline class="tlh-ch-ln" points="${pw.join(' ')}" vector-effect="non-scaling-stroke"/>` : '');
    // tek kayıtta noktaların yanında değerleri yazılı (eğri yok, yalnız iki nokta)
    const lab = (v) => (n === 1 ? `<b>${esc(v)}</b>` : '');
    const dots = list.map((x, i) => `<i class="tlh-pc-d is-w" style="left:${X(i)}%;top:${YW(num(x.wpm))}%">${lab(num(x.wpm) + ' WPM')}</i>`
      + (num(x.acc) > 0 ? `<i class="tlh-pc-d is-a" style="left:${X(i)}%;top:${YA(num(x.acc))}%">${lab('%' + Math.round(num(x.acc)))}</i>` : '')).join('');
    return `<div class="tlh-pc">
        <div class="tlh-pc-y" aria-hidden="true">${wt.map(t => `<span style="top:${YW(t)}%">${t}</span>`).join('')}</div>
        <div class="tlh-pc-plot" tabindex="0" role="group" aria-roledescription="grafik"
          aria-label="Hız ve doğruluk: ${n} yazış, ortalama ${avg} WPM. Tek tek okumak için sol ve sağ ok tuşları.">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><defs><linearGradient id="tlh-pc-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="tlh-ch-g0"/><stop offset="1" class="tlh-ch-g1"/></linearGradient></defs>${wt.map(t => `<line class="tlh-ch-grid" x1="0" x2="100" y1="${YW(t)}" y2="${YW(t)}" vector-effect="non-scaling-stroke"/>`).join('')}${svg}</svg>
          <div class="tlh-pc-dots" aria-hidden="true">${dots}</div>
          <span class="tlh-pc-guide" aria-hidden="true" hidden></span>
          <div class="tlh-pc-tip" role="status" hidden></div>
          ${n === 1 ? '<p class="tlh-pc-one">Bir yazış daha: eğilim çizilsin.</p>' : ''}
        </div>
        <div class="tlh-pc-y is-acc" aria-hidden="true">${at.map(t => `<span style="top:${YA(t)}%">%${t}</span>`).join('')}</div>
        <div class="tlh-pc-x" aria-hidden="true">${xLabels(xi.map(i => num(list[i].t))).map((l, j) => `<span style="left:${X(xi[j])}%">${esc(l)}</span>`).join('')}</div>
      </div>
      <p class="tlh-ch-lg tlh-pc-lg"><span class="is-w">son hız <b>${w[n - 1]}</b> WPM</span><span class="is-acc">doğruluk${accs.length ? ` <b>%${Math.round(accs[accs.length - 1])}</b>` : ''}</span>${n > 1 ? `<span class="is-avg">ort. <b>${avg}</b> WPM</span>` : ''}</p>`;
  }

  /** Etkinlik ısı şeridi: 7 gün (geniş hücre, sayı ve gün adı) ya da 30 gün (ince şerit). Seri günleri en az 1. düzey. */
  function heatStripHTML(days, span) {
    const list = days.slice(-span);
    const max = Math.max(1, ...list.map(x => x.count));
    const on = list.filter(x => x.on).length;
    const sum = list.reduce((a, x) => a + x.count, 0);
    return `<ol class="tlh-hm is-${span}" aria-label="Son ${span} gün: ${on} gün etkin, ${sum} metin">${list.map((x, i) => {
      const lv = x.count ? Math.max(1, Math.ceil(x.count / max * 4)) : x.on ? 1 : 0;
      const what = x.count ? `${x.count} metin` : x.on ? 'etkin' : 'boş';
      const lab = x.today ? 'Bugün' : span === 7 ? x.label : i % 7 === 1 ? String(x.dn) : '';
      return `<li class="tlh-hm-c lv-${lv}${x.today ? ' is-today' : ''}" title="${esc(x.date)} · ${what}"><span class="tlh-hm-b" aria-hidden="true">${span === 7 && x.count ? x.count : ''}</span><small aria-hidden="true">${lab}</small><span class="tlh-sr">${esc(x.date)}: ${what}</span></li>`;
    }).join('')}</ol>`;
  }

  /** Zorlanılan tuşlar: ilk 5 (metin listesi; ısı haritası klavyesi ayrıca typing.js heatKeyboard ile gelir). */
  function weakListHTML(weak) {
    const list = weak.slice(0, 5);
    if (!list.length) return '<p class="tlh-empty">Hata yaptıkça zorlandığın tuşlar klavyede kızarır.</p>';
    const max = list[0][1];
    return `<ol class="tlh-pf-wk" aria-label="En çok hata yapılan tuşlar">${list.map(([k, v]) => `<li><kbd>${esc(k.toLocaleUpperCase('tr'))}</kbd><span class="tlh-weak-bar" aria-hidden="true"><i style="width:${Math.round(v / max * 100)}%"></i></span><small>${v} hata</small></li>`).join('')}</ol>`;
  }

  /** Rozet vitrini: kazanılan parlak (+ tarih), kazanılmayan kilitli + koşulu ve ilerlemesi. */
  function badgesHTML(d) {
    return BADGES.map(bd => {
      const got = !!d.badges[bd.id];
      const cur = Math.min(bd.goal, Math.max(0, bd.cur(d)));
      const when = got && typeof d.badges[bd.id] === 'string' ? isoDate(d.badges[bd.id]) : '';
      return `<li class="tlh-pf-b${got ? ' is-got' : ''}"><span class="tlh-pf-b-ic" aria-hidden="true">${bd.icon}</span>`
        + `<b>${esc(bd.name)}</b><small>${got ? `Kazanıldı${when ? ' · ' + esc(when) : ''}` : esc(bd.need)}</small>`
        + (got ? '' : `<span class="tlh-pf-b-bar" aria-hidden="true"><i style="width:${Math.round(cur / bd.goal * 100)}%"></i></span><span class="tlh-pf-b-n"><span aria-hidden="true">🔒 </span>${cur}/${bd.goal}</span>`)
        + `<span class="tlh-sr">${got ? ' (kazanıldı)' : ' (kilitli)'}</span></li>`;
    }).join('');
  }

  /** Son yazışlar (yeniden eskiye, en çok 8). */
  function recentRows(list, best) {
    if (!list.length) return '<tr><td colspan="4" class="tlh-pf-none">Henüz yazış yok. Bir metin bitirince burada listelenir.</td></tr>';
    const max = Math.max(1, ...list.map(x => num(x.wpm)));
    return list.slice(-8).reverse().map(x => {
      const wv = num(x.wpm);
      return `<tr><td>${num(x.t) ? `${esc(shortDate(x.t))} <small>${timeOf(x.t)}</small>` : '—'}</td><td>${esc(modeLabel(modeOf(x)))}</td>`
        + `<td class="is-num"><span class="tlh-pf-wb" aria-hidden="true"><i style="width:${Math.round(wv / max * 100)}%"></i></span><b>${wv}</b>${wv && wv >= best ? '<em title="Rekor">★<span class="tlh-sr"> rekor</span></em>' : ''}</td>`
        + `<td class="is-num">${num(x.acc) ? '%' + Math.round(num(x.acc)) : '—'}</td></tr>`;
    }).join('');
  }

  function mountPerf(host) {
    const d = readStore();
    data = d;
    const m = computeMetrics(d, 40);
    const all = m.hist;   // geçmişin tamamı (en çok 40 kayıt)
    const best = bestWpm(d);
    const acc = avgAcc(d);
    const todayN = num(d.days && d.days[today()]);
    const types = [...new Set(all.map(modeOf))];
    let filter = 'all', span = 30;
    const tile = (v, l, c) => `<div class="tl-map-tile ${c}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`;
    const typeChips = types.length > 1 ? `<div class="tlh-pf-filter" role="group" aria-label="Türe göre süz">${['all', ...types].map(t => {
      const cnt = t === 'all' ? all.length : all.filter(x => modeOf(x) === t).length;
      return `<button type="button" class="tl-chip${t === filter ? ' is-on' : ''}" data-pf="${t}" aria-pressed="${t === filter}">${esc(t === 'all' ? 'Tümü' : modeLabel(t))} <small>${cnt}</small></button>`;
    }).join('')}</div>` : '';
    host.innerHTML = `
      <div class="tl-edu tlh-pf">
        <header class="tl-box tlh-pf-hero">
          <div class="tlh-pf-id">
            <p class="tl-eyebrow">Performans · <span data-s="lv">Sv. 1</span></p>
            <h1 class="tl-h1">Gelişimin</h1>
            <div class="tlh-pf-lv"><span class="tl-bar" aria-hidden="true"><i data-s="xp"></i></span><small data-s="xptext"></small></div>
          </div>
          <div class="tlh-pf-tiles">
            ${tile(best ? best + ' WPM' : '—', 'en iyi hız', 'is-gold')}
            ${tile(acc == null ? '—' : '%' + acc, 'ort. doğruluk · son 10', 'is-ok')}
            ${tile(String(num(d.stats.finished)), todayN ? `biten metin · bugün ${todayN}` : 'biten metin', 'is-cyan')}
            ${tile(m.streak + ' gün', 'gün serisi', 'is-ember')}
          </div>
        </header>
        <section class="tl-box tlh-pf-p tlh-pf-chart" aria-labelledby="tlh-pf-ch">
          <div class="tlh-pf-head"><h2 id="tlh-pf-ch">Hız ve doğruluk</h2><small class="tlh-pf-note" data-pf-note></small>${typeChips}</div>
          <div class="tlh-pf-chartbox" data-pf-chart></div>
        </section>
        <section class="tl-box tlh-pf-p tlh-pf-quests" aria-labelledby="tlh-pf-qh">
          <div class="tlh-pf-head"><h2 id="tlh-pf-qh">Günlük görevler</h2><b class="tlh-pf-count" data-s="qcount"></b></div>
          <ul class="tlh-quest-list tlh-mq tlh-mq--big"></ul>
          <p class="tlh-pf-foot">Bir göreve tıkla, o iş hemen açılsın. Görevler her gün yenilenir.</p>
        </section>
        <section class="tl-box tlh-pf-p tlh-pf-act" aria-labelledby="tlh-pf-ah">
          <div class="tlh-pf-head"><h2 id="tlh-pf-ah">Etkinlik</h2>
            <div class="tlh-pf-seg" role="group" aria-label="Dönem">${[7, 30].map(n => `<button type="button" class="tl-chip${n === span ? ' is-on' : ''}" data-span="${n}" aria-pressed="${n === span}">${n} gün</button>`).join('')}</div></div>
          <div class="tlh-pf-hmbox" data-pf-act></div>
          <p class="tlh-pf-foot" data-pf-actnote></p>
        </section>
        <section class="tl-box tlh-pf-p tlh-pf-keys" aria-labelledby="tlh-pf-kh">
          <div class="tlh-pf-head"><h2 id="tlh-pf-kh">Zorlandığın tuşlar</h2>${m.weak.length ? `<small class="tlh-pf-note">toplam <b>${m.weak.reduce((a, x) => a + num(x[1]), 0)}</b> hata · ${m.weak.length} tuş</small>` : ''}</div>
          <div class="tlh-pf-kbrow"><div class="tlh-pf-kb" data-pf-kb></div>${weakListHTML(m.weak)}</div>
        </section>
        <section class="tl-box tlh-pf-p tlh-pf-recent" aria-labelledby="tlh-pf-rh">
          <div class="tlh-pf-head"><h2 id="tlh-pf-rh">Son yazışlar</h2><small class="tlh-pf-note" data-pf-rnote></small></div>
          <table class="tlh-pf-tbl"><thead><tr><th scope="col">Tarih</th><th scope="col">Tür</th><th scope="col" class="is-num">WPM</th><th scope="col" class="is-num">Doğruluk</th></tr></thead><tbody data-pf-rows></tbody></table>
        </section>
        <section class="tl-box tlh-pf-p tlh-pf-badges" aria-labelledby="tlh-pf-bh">
          <div class="tlh-pf-head"><h2 id="tlh-pf-bh">Rozetler</h2><small class="tlh-pf-note"><b>${BADGES.filter(bd => d.badges[bd.id]).length}</b>/${BADGES.length} kazanıldı</small></div>
          <ul class="tlh-pf-bd" aria-label="Rozetler"></ul>
        </section>
      </div>`;
    const q = (sel) => host.querySelector(sel);
    const chartBox = q('[data-pf-chart]');
    let shown = all;
    let sel = -1;
    function paintChart() {
      shown = filter === 'all' ? all : all.filter(x => modeOf(x) === filter);
      sel = -1;
      chartBox.innerHTML = perfChartHTML(shown);
      q('[data-pf-note]').textContent = shown.length > 1 ? `son ${shown.length} yazış` : '';
      q('[data-pf-rows]').innerHTML = recentRows(shown, best);
      q('[data-pf-rnote]').textContent = filter === 'all' ? (all.length > 8 ? `son 8 / ${all.length}` : '') : modeLabel(filter);
    }
    function paintAct() {
      const list = m.month.slice(-span);
      q('[data-pf-act]').innerHTML = heatStripHTML(m.month, span);
      const on = list.filter(x => x.on).length;
      q('[data-pf-actnote]').innerHTML = `<b>${on}</b>/${span} gün etkin · <b>${list.reduce((a, x) => a + x.count, 0)}</b> metin · seri <b>${m.streak}</b> gün`;
    }
    paintChart();
    paintAct();
    renderStats();
    // ısı haritası: ekran klavyesi bileşeni (typing.js; Merkez açılışında zaten inmiş olur)
    loadMod('typing.js').then(t => {
      const slot = q('[data-pf-kb]');
      if (slot && typeof t.heatKeyboard === 'function') slot.replaceChildren(t.heatKeyboard(d.weak));
    }).catch(() => { /* klavye görseli olmadan da liste var */ });

    // değer kutusu: üzerine gelince / ok tuşlarıyla en yakın yazış (tek dinleyici; nokta başına düğme yok)
    const isPlot = (el) => !!(el && el.classList && el.classList.contains('tlh-pc-plot'));
    function pick(i) {
      const plot = q('.tlh-pc-plot');
      if (!plot || !shown.length) return;
      const tip = plot.querySelector('.tlh-pc-tip');
      const guide = plot.querySelector('.tlh-pc-guide');
      plot.querySelectorAll('.tlh-pc-d.is-sel').forEach(e => e.classList.remove('is-sel'));
      if (i < 0) { sel = -1; tip.hidden = true; guide.hidden = true; return; }
      sel = Math.max(0, Math.min(shown.length - 1, i));
      const x = shown[sel];
      const left = shown.length === 1 ? 50 : sel / (shown.length - 1) * 100;
      guide.hidden = false;
      guide.style.left = left + '%';
      tip.hidden = false;
      tip.style.left = left + '%';
      tip.classList.toggle('is-r', left > 72);
      tip.classList.toggle('is-l', left < 28);
      tip.innerHTML = `<b>${num(x.wpm)} WPM</b><span>doğruluk %${Math.round(num(x.acc))}</span><small>${esc(modeLabel(modeOf(x)))}${num(x.t) ? ' · ' + esc(shortDate(x.t)) + ' ' + timeOf(x.t) : ''}</small>`;
      const dots = plot.querySelectorAll('.tlh-pc-d.is-w');
      if (dots[sel]) dots[sel].classList.add('is-sel');
    }
    const onMove = (e) => {
      const plot = e.target.closest && e.target.closest('.tlh-pc-plot');
      if (!plot) return;
      const r = plot.getBoundingClientRect();
      const f = r.width ? (e.clientX - r.left) / r.width : 0;
      const i = shown.length === 1 ? 0 : Math.round(Math.max(0, Math.min(1, f)) * (shown.length - 1));
      if (i !== sel) pick(i);
    };
    const onOut = (e) => {
      const plot = e.target.closest && e.target.closest('.tlh-pc-plot');
      if (plot && !plot.contains(e.relatedTarget) && document.activeElement !== plot) pick(-1);
    };
    const onKey = (e) => {
      if (!isPlot(e.target)) return;
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'Home' || k === 'End') {
        e.preventDefault();
        pick(k === 'Home' ? 0 : k === 'End' ? shown.length - 1 : sel < 0 ? shown.length - 1 : sel + (k === 'ArrowLeft' ? -1 : 1));
      }
    };
    const onFocus = (e) => { if (isPlot(e.target) && sel < 0) pick(shown.length - 1); };
    const onBlur = (e) => { if (isPlot(e.target)) pick(-1); };
    const onClick = (e) => {
      const f = e.target.closest('[data-pf]');
      if (f && f.dataset.pf !== filter) {
        filter = f.dataset.pf;
        host.querySelectorAll('[data-pf]').forEach(b => { const on = b.dataset.pf === filter; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
        paintChart();
        return;
      }
      const s2 = e.target.closest('[data-span]');
      if (s2 && Number(s2.dataset.span) !== span) {
        span = Number(s2.dataset.span);
        host.querySelectorAll('[data-span]').forEach(b => { const on = Number(b.dataset.span) === span; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
        paintAct();
      }
    };
    const evs = [['pointermove', onMove], ['pointerout', onOut], ['keydown', onKey], ['focusin', onFocus], ['focusout', onBlur], ['click', onClick]];
    evs.forEach(([t, f]) => host.addEventListener(t, f));
    return {
      destroy() {
        evs.forEach(([t, f]) => host.removeEventListener(t, f));
        host.innerHTML = '';
      },
    };
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
        // last: dersin / Şiir & Atasözü oturumunun biten denemesi (lessons.js resultEvent, literature.js summary).
        // Depoya yazılmaz; yalnız bu çağrıda görev, gün serisi, geçmiş ve zayıf tuşlar için okunur.
        const L = obj.last && typeof obj.last === 'object' && typeof obj.last.wpm === 'number' ? obj.last : null;
        const rest = Object.assign({}, obj);
        delete rest.last;
        update(d => { d.sec[id] = Object.assign({}, d.sec[id] || {}, rest); delete d.sec[id].last; });
        const quests = [];
        let finished = false, wpm = 0, acc = 0, weak = null, mode = id;
        if (L) {
          const sig = String(L.t) + '|' + L.wpm + '|' + L.acc;
          if (sig !== lastSig) {
            lastSig = sig;
            wpm = num(L.wpm); acc = normAcc(L.acc);
            weak = L.weak && typeof L.weak === 'object' ? L.weak : null;
            if (id === 'egitim') { finished = true; if (L.pass) quests.push('lesson'); }
            if (id === 'edebiyat') {
              if (typeof L.cat === 'string' && MODE_NAME[L.cat]) mode = L.cat;
              // "bir metin bitir": en az bir parça bitmiş olmalı; hiç parça bitmeden kapatılan oturum yalnız hız/zayıf tuş sayar
              if (num(L.n) >= 1) { finished = true; quests.push('lit'); }
              else { wpm = 0; acc = 0; }   // hiç metin bitmedi: hız/rekor sayılmaz (zayıf tuşlar yine işlenir)
            }
          }
          if (quests.length || wpm || finished) progress({ quests, finished, wpm, acc, mode, weak });
          else renderStats();
          return;
        }
        if (id === 'egitim' && lessonStars() > before) { quests.push('lesson'); finished = true; }
        const r = findResult(rest);
        if (r) {
          const sig = [r.wpm, r.acc, r.elapsedMs, r.total].join('|');
          if (sig !== lastSig) {
            lastSig = sig;
            wpm = num(r.wpm); acc = normAcc(r.acc);
            if (id === 'edebiyat') { quests.push('lit'); finished = true; }
          }
        }
        if (quests.length || wpm || finished) progress({ quests, finished, wpm, acc, mode });
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
    root.classList.add('tlh-in-view');   // home.css: Merkez ve arka plan bulutları görünüm altındayken boyanmaz/durur
    if (push && location.hash !== '#' + id) {
      try {
        // Bölümden bölüme geçişte geçmiş kaydı değiştirilir (Merkez tek geri adımla dönsün). Adresle doğrudan açılan
        // bölümde (#performans, state yok) de değiştirilir: yoksa "← Merkez"/Esc geri adımla önceki BÖLÜME dönüyordu.
        // pushed: bu kaydı biz ekledik → kapatırken history.back() Merkez'e döner; eklemediysek adres temizlenir.
        const cur = location.hash.slice(1);
        if (switching && (VIEW_IDS.includes(cur) || (history.state && history.state.tlh))) {
          history.replaceState({ tlh: id, pushed: !!(history.state && history.state.pushed) }, '', '#' + id);
        } else history.pushState({ tlh: id, pushed: true }, '', '#' + id);
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
    root.classList.remove('tlh-in-view');
    setNav('hub');
    pendingKeys = '';
    renderPreview();
    if (!silent && !fromPop && VIEW_IDS.includes(location.hash.slice(1))) {
      if (history.state && history.state.tlh && history.state.pushed) history.back();
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
    liveRun();
  }

  /* ---------- Yazma (kendi görünümü) ---------- */
  let arenaMod = null;
  let mountTyperFn = null;
  let matchStartFn = null;   // typing.js matchStartKey: Merkez'den başlatan ilk tuş
  let arenaCtl = null;
  let arenaP = null;
  let current = null;           // { text, source, mode } — akış kipinde metin/kaynak her parçada güncellenir
  let mode = typeof data.mode === 'string' ? data.mode : 'atasozu';
  let combo = 0, lastTyped = 0, lastErr = 0, bestCombo = 0;
  const typerSfx = { key: () => sfx.key(), error: () => sfx.error(), win: () => {}, voice: (n) => sfx.voice(n), get enabled() { return sfx.enabled; } };
  // Ekran klavyesi: üç yazma ekranında ortak, kalıcı tercih (typing.js kbWanted; tercih yoksa geniş ekranda açık).
  let kbWantedFn = null;
  const wantKeyboard = () => (kbWantedFn ? kbWantedFn() : window.innerHeight >= 620 && window.innerWidth >= 700);
  const isStream = (m) => !!(arenaMod && arenaMod.isStreamMode?.(m));

  /** arena.js + typing.js bir kez yüklenir (Merkez açılışında önden; Yazma açılınca hazır olsun). */
  function loadArena() {
    if (arenaP) return arenaP;
    const p = Promise.all([loadMod('arena.js'), loadMod('typing.js')]).then(([am, typing]) => {
      if (typeof am.pickText !== 'function' || typeof typing.mountTyper !== 'function') throw new Error('arabirim eksik');
      arenaMod = am;
      mountTyperFn = typing.mountTyper;
      if (typeof typing.matchStartKey === 'function') matchStartFn = typing.matchStartKey;
      if (typeof typing.kbWanted === 'function') kbWantedFn = typing.kbWanted;
      const acts = $('.tlh-arena-acts');
      if (acts && typeof typing.kbToggle === 'function' && !acts.firstChild) {
        acts.appendChild(typing.kbToggle((on) => { try { arenaCtl?.setKeyboard?.(on); arenaCtl?.focus?.(); } catch { /* yok */ } }));
      }
      if (!am.MODES.some(m => m.id === mode)) mode = am.MODES[0].id;
      renderModeButtons(modesEl);
      if (typeof am.itemsFor === 'function') idle(() => { litInfo = computeLit(am); renderLit(); });
      renderStats();
      // Canlı satırın ilk çizimi (satır ölçümü = sayfanın ilk tam düzeni, ≈45 ms) ilk boyamadan sonraya ertelenir.
      // (Gizli sekmede rAF gelmez: 250 ms'lik yedek zamanlayıcı yine de türü/önizlemeyi hazırlar; satır sekme görünür olunca yazılır.)
      let liveKick = false;
      const kick = () => { if (liveKick) return; liveKick = true; const t1 = performance.now(); renderPreview(); measure('tlh-live', t1); };
      requestAnimationFrame(() => setTimeout(kick, 0));
      setTimeout(kick, 250);
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
    if (needWords(mode, () => { if (view && view.id === 'yazma') newText(same); })) {
      try { arenaCtl?.destroy?.(); } catch { /* yok */ }
      arenaCtl = null;
      resultEl.hidden = true;
      arenaHost.innerHTML = '<div class="tlh-loading">Yükleniyor…</div>';
      return;
    }
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

  // Kombo her tuşta güncellenir: yalnız değişince, metin düğümünün verisi yazılır (textContent= düğüm değiştirir →
  // sayfa genelinde pahalı stil hesabı; ölçüm: ~6 ms → ~0,6 ms). Sınıflar yalnız durum değişince dokunulur.
  const comboB = comboEl.querySelector('b');
  function setCombo(n) {
    if (n === combo && comboB.firstChild) return;
    combo = n;
    bestCombo = Math.max(bestCombo, n);
    const t = String(n);
    if (comboB.firstChild && comboB.firstChild.nodeType === 3) comboB.firstChild.data = t; else comboB.textContent = t;
    if (comboEl.classList.contains('is-hot') !== (n >= 25)) comboEl.classList.toggle('is-hot', n >= 25);
    if (comboEl.classList.contains('is-on') !== (n > 0)) comboEl.classList.toggle('is-on', n > 0);
    if (n > 0 && n % 25 === 0 && !reduced()) {
      comboEl.classList.remove('is-pop'); void comboEl.offsetWidth; comboEl.classList.add('is-pop');
    }
  }

  let firstChunk = null;
  function takeFirst() { const f = firstChunk; firstChunk = null; return f; }
  /** Merkez'de basılan harf(ler)i yeni açılan yazıcıya aktarır ve odağı hemen yazma alanına verir.
   *  İlk tuş beklenen harfle büyük/küçük harf duyarsız eşleşirse (a → "Armut") doğru sayılır; eşleşmezse
   *  basılanların hiçbiri aktarılmaz (hata yazılmaz). Yazma içindeki kurallar değişmez. */
  function flushPending() {
    const ta = arenaHost.querySelector('textarea');
    if (!ta) return;
    try { ta.focus({ preventScroll: true }); } catch { ta.focus(); }
    if (!pendingKeys) return;
    const keys = Array.from(pendingKeys);
    pendingKeys = '';
    const first = matchStartFn ? matchStartFn(keys[0], arenaCtl && arenaCtl.expected) : keys[0];
    if (!first) return;
    ta.value = first + keys.slice(1).join('');
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
    // Metin bitti mi: akışta en az bir parça, Kelime'de metnin sonuna kadar (Esc ile yarıda bırakılan Kelime metni bitmemiştir).
    const complete = streamOn ? num(s.chunks) >= 1 : num(s.total) > 0 && num(s.typed) >= num(s.total);
    const quests = [];
    if (!streamOn && complete) { quests.push('daily'); if (current && current.mode === 'atasozu') quests.push('arena'); }
    const prevBest = bestWpm();
    // Hiç metin bitmeden ve 20 harfe varmadan Bitir/Esc: kısa deneme. Sonuç gösterilir ama rekora, geçmişe ve
    // görevlere sayılmaz (birkaç harflik hızlı başlangıç "en iyi WPM"i şişiriyordu).
    const short = !complete && num(s.typed) < 20;
    // Metin bitmeden ≥ 20 harf: hız geçmişe ve rekora yazılır, ama "biten metin", gün serisi ve metin görevleri artmaz.
    const { record } = short ? { record: false } : progress({ quests, finished: complete, hist: true, accOk: complete, wpm, acc, mode: current?.mode, weak: s.weakKeys });
    const [rank, col] = rankOf(wpm, acc);
    // Yazma'da ders hedefi yok: kişisel rekora göre durum.
    const vs = short ? 'Kısa deneme: en az 20 harf ya da bir metin yazınca kaydedilir'
      : !complete ? 'Metin bitmedi: hızın kaydedildi, biten metne sayılmadı'
      : record ? `Önceki rekorun <b>${prevBest}</b> WPM idi`
      : prevBest > 0 ? (wpm >= prevBest ? `Rekorunla aynı: <b>${prevBest}</b> WPM` : `Rekorun <b>${prevBest}</b> WPM · <b>${prevBest - wpm}</b> WPM geride`) : 'İlk sonucun kaydedildi';
    resultEl.hidden = false;
    resultEl.style.setProperty('--rk', col);
    resultEl.innerHTML = `
      <div class="tl-edu tlh-result-wrap"><div class="tlh-result-card tl-box" role="status">
        <p class="tlh-rank">${record ? '🏆 YENİ REKOR' : rank}</p>
        <p class="tlh-big"><b>${wpm}</b><small>WPM</small></p>
        <p class="tlh-res-vs">${vs}</p>
        <div class="tlh-result-nums">
          <span><b>%${acc}</b> doğruluk</span><span><b>${num(s.errors)}</b> hata</span><span><b>${secs}</b> sn</span>
          ${streamOn ? `<span><b>${num(s.chunks)}</b> metin</span>` : ''}
          <span><b>${bestCombo}</b> en uzun kombo</span>
        </div>
        <div class="tlh-result-btns">
          <button type="button" class="tlh-btn tlh-btn--primary" data-tlh="next">${streamOn ? 'Yeni oturum' : 'Sonraki metin'} <kbd>Enter</kbd></button>
          ${streamOn ? '' : '<button type="button" class="tlh-btn tlh-btn--ghost" data-tlh="again">Aynısını tekrar</button>'}
          <button type="button" class="tlh-btn tlh-btn--ghost" data-tlh="back">Merkez <kbd>Esc</kbd></button>
        </div>
      </div></div>`;
    resultEl.querySelector('[data-tlh="next"]').focus({ preventScroll: true });
    // Kutlama abartısız: konfeti yalnız rekorda ya da USTA ve üstü derecede (azaltılmış harekette hiç).
    if (!short && (record || (acc >= 92 && wpm >= 30))) confetti();
    sfx.win();
    if (acc >= 98) setTimeout(() => sfx.voice('great'), 1100);
  }

  /** Görev satırı: o görevi yapılacak yere götürür. */
  function startQuest(id) {
    if (id === 'lesson') {
      const li = lessonInfo();
      openView('egitim', { intent: li && li.lesson ? { lesson: li.lesson.id, index: li.idx } : null });
    } else if (id === 'lit') openView('edebiyat');
    else {
      if (id === 'arena' && arenaMod && arenaMod.MODES.some(x => x.id === 'atasozu')) setMode('atasozu');
      if (!(view && view.id === 'yazma')) openView('yazma');
    }
  }

  /* ---------- olaylar ---------- */
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tlh],[data-nav],[data-mode],[data-wmode],[data-card],[data-lit],[data-lesson],[data-quest]');
    if (!t || !root.contains(t)) return;
    if (t.dataset.wmode) {               // Yazma kartındaki tür çipi: o kiple Yazma
      if (arenaMod) { if (arenaMod.MODES.some(x => x.id === t.dataset.wmode)) setMode(t.dataset.wmode); }
      else mode = t.dataset.wmode;     // modül henüz inmediyse kip yüklenince kullanılır (loadArena geçersizse düzeltir)
      openView('yazma');
      return;
    }
    if (t.dataset.mode && t.classList.contains('tlh-mode')) { setMode(t.dataset.mode); return; }
    if (t.dataset.card) return;   // PvP kartı ?pvp=lobby bağlantısı: lobi açılır, maç kendiliğinden başlamaz
    if (t.dataset.lit) { openView('edebiyat', { intent: { cat: t.dataset.lit } }); return; }
    if (t.dataset.quest) { startQuest(t.dataset.quest); return; }
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

  // Dersler (lessons.js + kelime havuzu) ve Kelime kipi açılışta inmez; fare/odak oraya gelince önden yüklenir.
  let preLessons = false, preWords = false;
  const prefetch = (e) => {
    const t = e.target && e.target.closest ? e.target : null;
    if (!t) return;
    if (!preLessons && t.closest('.tlh-c-edu,[data-tlh="resume"],[data-nav="egitim"],[data-quest="lesson"]')) {
      preLessons = true;
      loadMod('lessons.js').catch(() => { preLessons = false; });
    }
    if (!preWords && arenaMod && t.closest('[data-mode="kelime"],[data-wmode="kelime"]')) { preWords = true; arenaMod.loadWords?.().catch(() => { preWords = false; }); }
  };
  root.addEventListener('pointerover', prefetch, { passive: true });
  root.addEventListener('focusin', prefetch);

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
    if (typeof e.key !== 'string' || e.key.length !== 1 || isField(e.target)) return false;
    if (root.hidden || pvpVisible()) return false;
    // Boşluk Merkez'de başlatmaz; düğme/bağlantı üstündeyken de o öğeyi çalıştırsın (aşağıda yazıcıya yönlendirilmez).
    const space = e.key === ' ';
    if (space && (!view || (e.target.closest && e.target.closest('button,a,[role="button"],[role="radio"],summary')))) return false;
    if (!view) { e.preventDefault(); pendingKeys = e.key; openView('yazma'); return true; }
    if (view.id === 'yazma' && !arenaCtl && resultEl.hidden) { if (space && !pendingKeys) return false; e.preventDefault(); pendingKeys += e.key; return true; }
    // Odak yazma alanından çıkmışsa (tür düğmesine / boş yere tıklandı) harf kaybolmasın: odağı açık yazıcıya geri ver,
    // tuş varsayılan davranışıyla oraya düşer (preventDefault yok). Ders ve Şiir & Atasözü yazıcıları için de geçerli.
    const ta = view.id === 'yazma' ? (resultEl.hidden ? arenaHost.querySelector('textarea.tl-typer-input') : null)
      : viewBody.querySelector('textarea.tl-typer-input');
    if (ta && !ta.readOnly && document.activeElement !== ta) { try { ta.focus({ preventScroll: true }); } catch { ta.focus(); } }
    return false;
  }
  /** Esc: Yazma'da yazı sürüyorsa önce oturumu bitirip sonuç kartını gösterir (akış ve Kelime aynı); sonuçta ya da
   *  başka görünümde Merkez'e döner. Hiç yazılmadıysa finishArena kendisi Merkez'e döner. */
  function escView() {
    if (view && view.id === 'yazma' && arenaCtl && resultEl.hidden) {
      const c = arenaCtl;
      try { c.stop?.(); } catch { /* yok */ }
      if (view && view.id === 'yazma' && arenaCtl === c && resultEl.hidden) closeView();
      return;
    }
    closeView();
  }
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && view && !e.defaultPrevented) { e.preventDefault(); escView(); }
    if (e.key === 'Enter' && view && view.id === 'yazma' && !resultEl.hidden && !e.target.closest?.('button,a')) { e.preventDefault(); newText(); }
    typeToStart(e);
    if (!isField(e.target)) e.stopPropagation();
  });
  // Odak sayfa gövdesindeyken (ör. boş alana tıklanınca) de harfle başlasın.
  document.addEventListener('keydown', (e) => {
    if (e.target !== document.body && e.target !== document.documentElement) return;
    // (eski site / PvP dinleyicileri Esc'yi önceden preventDefault edebiliyor; Merkez görünürken gövdedeki Esc bizimdir)
    if (e.key === 'Escape' && view && !root.hidden && !pvpVisible()) { e.preventDefault(); escView(); return; }
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
  // Açılış ölçümü (DevTools Performance / performance.getEntriesByType('measure')): tlh-boot = Merkez'in kurulup ilk kez
  // boyanmaya hazır olması, tlh-arena = yazma modülleri + önizleme. Ölçüm yoksa (eski tarayıcı) sessiz geçer.
  const measure = (name, start) => { try { performance.measure(name, { start }); } catch { /* yok */ } };
  function boot() {
    const t0 = performance.now();
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
    measure('tlh-boot', t0);

    // Ses modülü açılışta inmez (tarayıcı sesi zaten ilk dokunuş/tuştan önce çalmaz): ilk etkileşimde yüklenir → açılışta bir istek az.
    let sfxP = null;
    const loadSfx = () => {
      if (sfxP) return;
      sfxP = loadMod('sfx.js').then(m => {
        S = m.sfx;
        S.setEnabled(data.sound !== false);
        renderStats();
      }).catch(err => { sfxP = null; try { console.warn('[home] ses modülü yüklenemedi:', err); } catch { /* yok */ } });
    };
    for (const t of ['pointerdown', 'keydown']) window.addEventListener(t, loadSfx, { capture: true, once: true, passive: true });

    // Merkez'deki gerçek sayılar: ders listesi (kaldığın ders, yıldız üst sınırı) ve metin havuzu (kart sayıları).
    Promise.all([loadMod('data/lessons.js'), loadMod('ders-kilit.js')]).then(([ld, lm]) => {
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
