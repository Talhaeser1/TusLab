/* TuşLab ana sayfa kabuğu (klasik defer betik). Diğer home/ modüllerini dinamik import ile yükler.
 * Ana ekranın kalbi doğrudan yazma alanı (Yazma Arenası); metin türü üstteki çiplerden seçilir.
 * ?pvp= varsa hiç açılmaz; #pvp-root görünür olunca veya tuslab:pvp-enter olayında gizlenir.
 * Eski uygulama sayfalarına (Hız Arenası, Performans) artık hiçbir düğme götürmez. */
(() => {
  'use strict';
  if (window.__tlHomeLoaded) return;
  window.__tlHomeLoaded = true;
  try { if (new URLSearchParams(location.search).has('pvp')) return; } catch { /* yok */ }

  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || new URL('home/home.js', document.baseURI).href;
  const BASE = new URL('./', SCRIPT_SRC).href;           // …/home/
  const ROOT = new URL('../', BASE).href;                // site kökü
  const loadMod = (file) => import(BASE + file);
  const KEY = 'tuslab-home-v1';
  const VIEW_IDS = ['egitim', 'edebiyat', 'performans'];

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
    daily: { icon: '⌨️', text: 'Ana ekranda 2 metin bitir', need: 2 },
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
    { id: 'home', icon: '⌨️', label: 'Yazma' },
    { id: 'egitim', icon: '🎓', label: 'Klavye Dersleri' },
    { id: 'edebiyat', icon: '🪶', label: 'Şiir & Atasözü' },
    { id: 'pvp', icon: '⚔️', label: 'PvP Düello' },
    { id: 'performans', icon: '📈', label: 'Performans' },
  ];

  const root = document.createElement('div');
  root.id = 'tl-home';
  root.tabIndex = -1;
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'TuşLab ana sayfa');
  root.innerHTML = `
<div class="tlh-scene tlh-scene--fallback" aria-hidden="true"></div>
<div class="tlh-shade" aria-hidden="true"></div>
<div class="tlh-aurora" aria-hidden="true"><i></i><i></i><i></i></div>
<header class="tlh-top">
  <a class="tlh-logo" href="${esc(location.pathname)}" aria-label="TuşLab ana sayfa">
    <img src="${esc(ROOT)}favicon.svg" alt="" width="34" height="34" /><span>Tuş<b>Lab</b></span>
  </a>
  <nav class="tlh-nav" aria-label="Bölümler">
    ${NAV.map(n => n.id === 'pvp'
      ? `<a class="tlh-nav-btn" href="?pvp=practice&amp;mode=classic" data-nav="pvp"><span aria-hidden="true">${n.icon}</span><em>${esc(n.label)}</em></a>`
      : `<button type="button" class="tlh-nav-btn${n.id === 'home' ? ' is-on' : ''}" data-nav="${n.id}"${n.id === 'home' ? ' aria-current="page"' : ''}><span aria-hidden="true">${n.icon}</span><em>${esc(n.label)}</em></button>`).join('')}
  </nav>
  <div class="tlh-stats" aria-label="Oyuncu durumu">
    <span class="tlh-chip tlh-chip--lv" title="Seviye"><b data-s="lv">Sv. 1</b><i class="tlh-xp"><i data-s="xp"></i></i></span>
    <span class="tlh-chip" title="En iyi hız">⚡ <b data-s="wpm">0</b><small> WPM</small></span>
    <span class="tlh-chip" title="Günlük seri">🔥 <b data-s="streak">0</b><small> gün</small></span>
  </div>
  <button type="button" class="tlh-sound" aria-pressed="true" aria-label="Sesi kapat"><span aria-hidden="true">🔊</span></button>
</header>
<div class="tlh-menu">
  <main class="tlh-main">
    <section class="tlh-arena" aria-labelledby="tlh-arena-h">
      <div class="tlh-arena-head">
        <h1 id="tlh-arena-h" class="tlh-arena-title"><span class="tlh-arena-ic" aria-hidden="true">⌨️</span>Yazma <b>Arenası</b></h1>
        <div class="tlh-combo" aria-hidden="true"><b data-s="combo">0</b><small>KOMBO</small></div>
      </div>
      <div class="tlh-modes" role="radiogroup" aria-label="Metin türü"></div>
      <div class="tlh-arena-typer"><div class="tlh-loading">Yükleniyor…</div></div>
      <div class="tlh-arena-foot">
        <span class="tlh-src" data-s="src"></span>
        <button type="button" class="tlh-next" data-tlh="next">↻ Yeni metin</button>
      </div>
      <div class="tlh-result" hidden></div>
    </section>
    <aside class="tlh-side">
      <div class="tlh-hero">
        <p class="tlh-eyebrow">NEON ARENA · TÜRKÇE KLAVYE</p>
        <p class="tlh-title">Parmakların <span>ışık hızında</span></p>
      </div>
      <section class="tlh-panel tlh-quests" aria-labelledby="tlh-quests-h">
        <div class="tlh-panel-head"><h2 id="tlh-quests-h">🗓️ Günlük Görevler</h2><span class="tlh-quest-count" data-s="qcount"></span></div>
        <ul class="tlh-quest-list"></ul>
        <ul class="tlh-badges" aria-label="Rozetler"></ul>
      </section>
    </aside>
  </main>
</div>
<section class="tlh-view" hidden aria-labelledby="tlh-view-h">
  <header class="tlh-view-top">
    <button type="button" class="tlh-btn tlh-btn--ghost tlh-back" data-tlh="back" aria-label="Ana sayfaya dön">← Ana Sayfa</button>
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
  const sceneHost = $('.tlh-scene');
  const menuEl = $('.tlh-menu');
  const viewEl = $('.tlh-view');
  const viewBody = $('.tlh-view-body');
  const viewTitle = $('.tlh-view-title');
  const toastHost = $('.tlh-toasts');
  const soundBtn = $('.tlh-sound');
  const arenaHost = $('.tlh-arena-typer');
  const resultEl = $('.tlh-result');
  const modesEl = $('.tlh-modes');
  const comboEl = $('.tlh-combo');

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
  function renderStats() {
    const xp = xpOf();
    const lv = levelOf(xp);
    const a = levelXp(lv), b = levelXp(lv + 1);
    const set = (k, v) => { const el = root.querySelector(`[data-s="${k}"]`); if (el) el.textContent = v; };
    set('lv', 'Sv. ' + lv);
    const bar = root.querySelector('[data-s="xp"]');
    if (bar) bar.style.width = Math.round(((xp - a) / Math.max(1, b - a)) * 100) + '%';
    set('wpm', bestWpm());
    set('streak', streakNow());

    const ids = todaysQuestIds();
    const q = questState();
    const done = ids.filter(id => q.done[id]).length;
    set('qcount', `${done}/${ids.length}`);
    $('.tlh-quest-list').innerHTML = ids.map(id => {
      const need = QUESTS[id].need;
      const cnt = need && !q.done[id] ? ` <small>${Math.min(need, num(q.count && q.count[id]))}/${need}</small>` : '';
      return `
      <li class="tlh-quest${q.done[id] ? ' is-done' : ''}">
        <span class="tlh-quest-icon" aria-hidden="true">${QUESTS[id].icon}</span>
        <span class="tlh-quest-text">${esc(QUESTS[id].text)}${cnt}</span>
        <span class="tlh-quest-mark">${q.done[id] ? '<span aria-hidden="true">✓</span><span class="tlh-sr">tamamlandı</span>' : '<span class="tlh-sr">bekliyor</span>'}</span>
      </li>`;
    }).join('');
    $('.tlh-badges').innerHTML = BADGES.map(bd => {
      const got = !!data.badges[bd.id];
      return `<li class="tlh-badge${got ? ' is-got' : ''}" title="${esc(bd.name)}${got ? '' : ' (kilitli)'}"><span aria-hidden="true">${bd.icon}</span><span class="tlh-sr">${esc(bd.name)}${got ? '' : ' kilitli'}</span></li>`;
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

  /* ---------- Performans (yerel görünüm, eski sayfaya gitmez) ---------- */
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
      ['🎯', 'Ortalama doğruluk', '%' + avg(last10, 'acc'), 'var(--tl-ok)'],
      ['✅', 'Biten metin', String(num(d.stats.finished)), 'var(--tl-violet)'],
      ['🔥', 'Günlük seri', streakNow(d) + ' gün', 'var(--tl-ember)'],
      ['⭐', 'Ders yıldızı', String(lessonStars(d)), 'var(--tl-gold)'],
    ];
    host.innerHTML = `
      <div class="tlh-perf">
        <div class="tlh-perf-tiles">${tiles.map(([i, l, v, c]) => `<div class="tlh-perf-tile" style="--acc:${c}"><span aria-hidden="true">${i}</span><b>${esc(v)}</b><small>${esc(l)}</small></div>`).join('')}</div>
        <div class="tlh-perf-row">
          <section class="tlh-panel tlh-perf-chart"><h3>Son ${hist.length || ''} metin · hız</h3>
            ${hist.length ? `<div class="tlh-bars">${hist.map(x => `<i style="--h:${Math.round(num(x.wpm) / maxW * 100)}%" title="${num(x.wpm)} WPM · %${num(x.acc)}${x.m ? ' · ' + esc(MODE_NAME[x.m] || x.m) : ''}"><b>${num(x.wpm)}</b></i>`).join('')}</div>`
              : '<p class="tlh-empty">Henüz sonuç yok. Ana ekrandaki yazma alanında bir metin bitir, grafik burada belirsin.</p>'}
          </section>
          <section class="tlh-panel tlh-perf-weak"><h3>En çok zorlandığın tuşlar</h3>
            ${weak.length ? `<ul>${weak.map(([k, v]) => `<li><kbd>${esc(k.toLocaleUpperCase('tr'))}</kbd><span class="tlh-weak-bar"><i style="width:${Math.round(v / maxWeak * 100)}%"></i></span><small>${v} hata</small></li>`).join('')}</ul>`
              : '<p class="tlh-empty">Hata yaptıkça zayıf tuşların burada listelenir.</p>'}
          </section>
        </div>
      </div>`;
    return { destroy() { host.innerHTML = ''; } };
  }

  /* ---------- alt bölümler ---------- */
  const VIEWS = {
    egitim: { title: '🎓 Klavye Dersleri', file: 'lessons.js', fn: 'mountLessons' },
    edebiyat: { title: '🪶 Şiir & Atasözü Yazma', file: 'literature.js', fn: 'mountLiterature' },
    performans: { title: '📈 Performans', local: mountPerf },
  };
  let view = null;     // { id, inst }
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

  function setNav(id) {
    root.querySelectorAll('.tlh-nav-btn[data-nav]').forEach(b => {
      const on = b.dataset.nav === id;
      b.classList.toggle('is-on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  async function openView(id, { push = true, intent = null } = {}) {
    const v = VIEWS[id];
    if (!v) return;
    if (view && view.id === id) return;
    const switching = !!view;   // bölümden bölüme geçiş: geçmişe yeni kayıt ekleme (Ana Sayfa tek geri adımla dönsün)
    closeView({ silent: true });
    ensureEgitimCss();
    pauseArena();
    const token = { id, inst: null, intent };
    view = token;
    setNav(id);
    viewTitle.textContent = v.title;
    viewEl.hidden = false;
    menuEl.setAttribute('aria-hidden', 'true');
    menuEl.inert = true;
    scene?.setPaused?.(true);
    if (push && location.hash !== '#' + id) {
      try {
        if (switching && history.state && history.state.tlh) history.replaceState({ tlh: id }, '', '#' + id);
        else history.pushState({ tlh: id }, '', '#' + id);
      } catch { /* yok */ }
    }
    viewBody.innerHTML = '<div class="tlh-loading">Yükleniyor…</div>';
    $('.tlh-back').focus({ preventScroll: true });
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
    try { view.inst?.destroy?.(); } catch (err) { try { console.warn('[home] destroy hatası', err); } catch { /* yok */ } }
    view = null;
    viewBody.innerHTML = '';
    viewEl.hidden = true;
    menuEl.removeAttribute('aria-hidden');
    menuEl.inert = false;
    setNav('home');
    if (!root.hidden) scene?.setPaused?.(false);
    if (!silent && !fromPop && VIEW_IDS.includes(location.hash.slice(1))) {
      if (history.state && history.state.tlh) history.back();
      else clearHash();
    }
    if (!silent || fromPop) setTimeout(() => arenaCtl?.focus?.(), 30);
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
    pauseArena();
    root.hidden = true;
    document.documentElement.classList.remove('tlh-lock');
    scene?.setPaused?.(true);
    if (root.contains(document.activeElement)) document.activeElement.blur();
    updateFab();
  }
  function showHome() {
    if (pvpVisible()) return;
    root.hidden = false;
    document.documentElement.classList.add('tlh-lock');
    scene?.setPaused?.(false);
    data = readStore();
    renderStats();
    updateFab();
    root.focus({ preventScroll: true });
    setTimeout(() => arenaCtl?.focus?.(), 30);
  }

  /* ---------- Yazma Arenası ---------- */
  let arenaMod = null;
  let mountTyperFn = null;
  let arenaCtl = null;
  let current = null;           // { text, source, mode }
  let mode = typeof data.mode === 'string' ? data.mode : 'atasozu';
  let combo = 0, lastTyped = 0, lastErr = 0, lastPulse = 0, bestCombo = 0;
  const typerSfx = { key: () => sfx.key(), error: () => sfx.error(), win: () => {}, voice: (n) => sfx.voice(n), get enabled() { return sfx.enabled; } };
  const wantKeyboard = () => window.innerHeight >= 800 && window.innerWidth >= 1000;

  async function mountArena() {
    arenaHost.innerHTML = '<div class="tlh-loading">Yükleniyor…</div>';
    try {
      ensureEgitimCss();
      const [am, typing] = await Promise.all([loadMod('arena.js'), loadMod('typing.js')]);
      if (typeof am.pickText !== 'function' || typeof typing.mountTyper !== 'function') throw new Error('arabirim eksik');
      arenaMod = am;
      mountTyperFn = typing.mountTyper;
      if (!am.MODES.some(m => m.id === mode)) mode = am.MODES[0].id;
      modesEl.innerHTML = am.MODES.map(m => `
        <button type="button" class="tlh-mode${m.id === mode ? ' is-on' : ''}" role="radio" aria-checked="${m.id === mode}" data-mode="${m.id}" title="${esc(m.hint)}">
          <span aria-hidden="true">${m.icon}</span>${esc(m.label)}</button>`).join('');
      newText();
    } catch (err) {
      try { console.warn('[home] yazma alanı yüklenemedi:', err); } catch { /* yok */ }
      arenaHost.innerHTML = errorCard('Yazma alanı şu an yüklenemedi.');
    }
  }

  function setMode(id) {
    if (!arenaMod || id === mode) { arenaCtl?.focus?.(); return; }
    mode = id;
    update(d => { d.mode = id; });
    modesEl.querySelectorAll('.tlh-mode').forEach(b => {
      const on = b.dataset.mode === id;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
    newText();
  }

  function newText(same = false) {
    if (!arenaMod) return;
    if (!same || !current) current = Object.assign(arenaMod.pickText(mode), { mode });
    const src = root.querySelector('[data-s="src"]');
    if (src) src.textContent = current.source ? '— ' + current.source : '';
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
      scene?.pulse('key');
    }
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
        text: current.text,
        keyboard: wantKeyboard(),
        sfx: typerSfx,
        onProgress(s) {
          const typed = num(s && s.typed), errs = num(s && s.errors);
          if (errs > lastErr) setCombo(0);
          else if (typed > lastTyped) setCombo(combo + (typed - lastTyped));
          const now = performance.now();
          if (typed > lastTyped && now - lastPulse > 90) { scene?.pulse('key'); lastPulse = now; }
          lastTyped = typed; lastErr = errs;
        },
        onFinish(s) { finishArena(s || {}); },
      });
    } catch (err) {
      try { console.warn('[home] yazma alanı açılamadı:', err); } catch { /* yok */ }
      arenaHost.innerHTML = errorCard('Yazma alanı açılamadı.');
    }
  }

  function pauseArena() { try { document.activeElement?.blur?.(); } catch { /* yok */ } }

  function rankOf(wpm, acc) {
    if (acc >= 97 && wpm >= 60) return ['ŞİMŞEK', 'var(--tl-cyan)'];
    if (acc >= 95 && wpm >= 45) return ['ALEV', 'var(--tl-ember)'];
    if (acc >= 92 && wpm >= 30) return ['USTA', 'var(--tl-gold)'];
    return ['ÇIRAK', 'var(--tl-violet)'];
  }

  function finishArena(s) {
    const wpm = Math.round(num(s.wpm));
    const acc = Math.round(normAcc(s.acc));
    const secs = Math.round(num(s.elapsedMs) / 1000);
    const quests = ['daily'];
    if (current && current.mode === 'atasozu') quests.push('arena');
    const { record } = progress({ quests, finished: true, wpm, acc, mode: current?.mode, weak: s.weakKeys });
    const [rank, col] = rankOf(wpm, acc);
    resultEl.hidden = false;
    resultEl.style.setProperty('--rk', col);
    resultEl.innerHTML = `
      <div class="tlh-result-card" role="status">
        <p class="tlh-rank">${record ? '🏆 YENİ REKOR' : rank}</p>
        <p class="tlh-big"><b>${wpm}</b><small>WPM</small></p>
        <div class="tlh-result-nums">
          <span><b>%${acc}</b> doğruluk</span><span><b>${secs}</b> sn</span><span><b>${bestCombo}</b> en uzun kombo</span>
        </div>
        <div class="tlh-result-btns">
          <button type="button" class="tlh-btn tlh-btn--primary" data-tlh="next">Sonraki metin <kbd>Enter</kbd></button>
          <button type="button" class="tlh-btn tlh-btn--ghost" data-tlh="again">Aynısını tekrar</button>
        </div>
      </div>`;
    resultEl.querySelector('[data-tlh="next"]').focus({ preventScroll: true });
    confetti();
    sfx.win();
    if (acc >= 98) setTimeout(() => sfx.voice('great'), 1100);
    scene?.pulse('win');
  }

  /* ---------- olaylar ---------- */
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tlh],[data-nav],[data-mode]');
    if (!t || !root.contains(t)) return;
    if (t.dataset.mode && t.classList.contains('tlh-mode')) { setMode(t.dataset.mode); return; }
    const nav = t.dataset.nav;
    if (nav) {
      if (nav === 'pvp') return;            // bağlantı ?pvp=practice&mode=classic adresine gider (PvP'nin kendi ekranı)
      if (nav === 'home') { closeView(); return; }
      openView(nav);
      return;
    }
    const act = t.dataset.tlh;
    if (act === 'back') { closeView(); return; }
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

  // Klavye: Escape → ana sayfa; sonuç ekranında Enter → sonraki metin; tuşları alttaki uygulamaya sızdırma.
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && view && !e.defaultPrevented) { e.preventDefault(); closeView(); }
    if (e.key === 'Enter' && !view && !resultEl.hidden && !e.target.closest?.('button,a')) { e.preventDefault(); newText(); }
    const t = e.target;
    const field = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (!field) e.stopPropagation();
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
  document.addEventListener('tuslab:pvp-enter', () => hideHome());

  function watchPvp() {
    const p = pvpRoot();
    if (!p) return false;
    // PvP kapanınca eski sayfada kalma: ana sayfaya dön.
    new MutationObserver(() => { if (!p.hidden) hideHome(); else showHome(); }).observe(p, { attributes: true, attributeFilter: ['hidden'] });
    if (!p.hidden) hideHome();
    return true;
  }

  /* ---------- başlat ---------- */
  let scene = null;
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

    loadMod('scene3d.js').then(m => {
      scene = m.mountScene(sceneHost);
      if (root.hidden || view) scene.setPaused?.(true);
    }).catch(err => { try { console.warn('[home] 3B sahne yüklenemedi:', err); } catch { /* yok */ } });

    mountArena();

    const id = location.hash.slice(1);
    if (VIEW_IDS.includes(id) && !root.hidden) openView(id, { push: false });
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot, { once: true });
})();
