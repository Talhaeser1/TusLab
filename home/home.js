/* TuşLab yeni ana sayfa kabuğu (klasik defer betik). Diğer home/ modüllerini dinamik import ile yükler.
 * ?pvp= varsa hiç açılmaz; #pvp-root görünür olunca veya tuslab:pvp-enter olayında gizlenir. */
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
  const VIEW_IDS = ['egitim', 'edebiyat'];

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
    acc98: { icon: '🎯', text: 'Bir atasözünü ya da dizeyi %98 doğrulukla yaz' },
    daily: { icon: '📜', text: 'Günün Dizesini yaz' },
    wpm35: { icon: '⚡', text: '35+ WPM hıza ulaş' },
    lit: { icon: '🪶', text: 'Şiir & Atasözü köşesinde bir metin bitir' },
    arena: { icon: '🏟️', text: 'Hız Arenası\'na uğra' },
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
    return d.quests && d.quests.date === t ? d.quests : { date: t, done: {} };
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
  const CARDS = [
    { id: 'egitim', icon: '🎓', kicker: 'Eğitim', title: 'Klavye Dersleri', desc: 'F-J\'den Ğ, Ş, Ç, İ\'ye adım adım. Her derste yıldız topla.', acc: 'var(--tl-cyan)' },
    { id: 'edebiyat', icon: '🪶', kicker: 'Edebiyat', title: 'Şiir & Atasözü', desc: 'Ustaların dizeleri, zorlu atasözleri ve dil döndüren tekerlemeler.', acc: 'var(--tl-violet)' },
    { id: 'arena', icon: '🏟️', kicker: 'Hız', title: 'Hız Arenası', desc: 'Klasik hız testi, maceralar ve rekor avı.', acc: 'var(--tl-gold)' },
    { id: 'pvp', icon: '⚔️', kicker: 'Düello', title: 'PvP Düello', desc: 'Yazarak dövüş: antrenman ya da çevrimiçi rakip.', acc: 'var(--tl-ember)' },
    { id: 'analytics', icon: '📈', kicker: 'Analiz', title: 'Performans', desc: 'Hız, doğruluk ve zayıf tuş haritan.', acc: 'var(--tl-ok)' },
  ];

  const root = document.createElement('div');
  root.id = 'tl-home';
  root.tabIndex = -1;
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'TuşLab ana sayfa');
  root.innerHTML = `
<div class="tlh-scene tlh-scene--fallback" aria-hidden="true"></div>
<div class="tlh-shade" aria-hidden="true"></div>
<div class="tlh-menu">
  <header class="tlh-top">
    <a class="tlh-logo" href="${esc(location.pathname)}" aria-label="TuşLab ana sayfa">
      <img src="${esc(ROOT)}favicon.svg" alt="" width="34" height="34" /><span>Tuş<b>Lab</b></span>
    </a>
    <div class="tlh-stats" aria-label="Oyuncu durumu">
      <span class="tlh-chip tlh-chip--lv" title="Seviye"><b data-s="lv">Sv. 1</b><i class="tlh-xp"><i data-s="xp"></i></i></span>
      <span class="tlh-chip" title="Toplam ders yıldızı">⭐ <b data-s="stars">0</b></span>
      <span class="tlh-chip" title="En iyi hız">⚡ <b data-s="wpm">0</b><small> WPM</small></span>
      <span class="tlh-chip" title="Günlük seri">🔥 <b data-s="streak">0</b><small> gün</small></span>
    </div>
    <button type="button" class="tlh-sound" aria-pressed="true" aria-label="Sesi kapat"><span aria-hidden="true">🔊</span></button>
  </header>
  <main class="tlh-main">
    <section class="tlh-hero">
      <p class="tlh-eyebrow">NEON ARENA · TÜRKÇE KLAVYE</p>
      <h1 class="tlh-title">Parmakların <span>ışık hızında</span></h1>
      <p class="tlh-slogan">Ders ders öğren, şiirle ısın, düelloda rakibini yazarak yen. Her gün biraz daha hızlı.</p>
      <div class="tlh-cta">
        <button type="button" class="tlh-btn tlh-btn--primary" data-tlh="start">Hemen Başla <span aria-hidden="true">→</span></button>
        <button type="button" class="tlh-btn tlh-btn--ghost" data-tlh="to-daily">Günün Dizesi</button>
      </div>
    </section>
    <section class="tlh-cards" aria-label="Menü">
      ${CARDS.map((c, i) => `
      <article class="tlh-card" data-card="${c.id}" style="--acc:${c.acc};--i:${i}">
        ${c.id === 'pvp'
          ? `<a class="tlh-card-main" href="?pvp=practice&amp;mode=classic" data-card-main="${c.id}">`
          : `<button type="button" class="tlh-card-main" data-card-main="${c.id}">`}
          <span class="tlh-card-icon" aria-hidden="true">${c.icon}</span>
          <span class="tlh-card-kicker">${esc(c.kicker)}</span>
          <span class="tlh-card-title">${esc(c.title)}</span>
          <span class="tlh-card-desc">${esc(c.desc)}</span>
          <span class="tlh-card-go" aria-hidden="true">${c.id === 'pvp' ? 'Antrenman →' : 'Aç →'}</span>
        ${c.id === 'pvp' ? '</a>' : '</button>'}
        ${c.id === 'pvp' ? '<button type="button" class="tlh-card-alt" data-tlh="pvp-online">🌐 Çevrimiçi lobi</button>' : ''}
      </article>`).join('')}
    </section>
    <div class="tlh-row">
      <section class="tlh-panel tlh-daily" id="tlh-daily" aria-labelledby="tlh-daily-h">
        <div class="tlh-panel-head">
          <h2 id="tlh-daily-h">📜 Günün Dizesi</h2>
          <span class="tlh-daily-src" data-s="src"></span>
        </div>
        <div class="tlh-daily-typer"><div class="tlh-loading">Yükleniyor…</div></div>
        <div class="tlh-daily-result" hidden></div>
      </section>
      <section class="tlh-panel tlh-quests" aria-labelledby="tlh-quests-h">
        <div class="tlh-panel-head"><h2 id="tlh-quests-h">🗓️ Günlük Görevler</h2><span class="tlh-quest-count" data-s="qcount"></span></div>
        <ul class="tlh-quest-list"></ul>
        <h3 class="tlh-sub">Rozetler</h3>
        <ul class="tlh-badges"></ul>
      </section>
    </div>
    <footer class="tlh-foot">TuşLab · Türkçe Q klavye için kişisel koç</footer>
  </main>
</div>
<section class="tlh-view" hidden aria-labelledby="tlh-view-h">
  <header class="tlh-view-top">
    <button type="button" class="tlh-btn tlh-btn--ghost tlh-back" data-tlh="back" aria-label="Ana menüye dön">← Ana Menü</button>
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
  const dailyHost = $('.tlh-daily-typer');
  const dailyResult = $('.tlh-daily-result');

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
    const parts = Array.from({ length: 150 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3, y: h * 0.55,
      vx: (Math.random() - 0.5) * 14, vy: -8 - Math.random() * 12,
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
    set('stars', lessonStars());
    set('wpm', bestWpm());
    set('streak', streakNow());

    const ids = todaysQuestIds();
    const q = questState();
    const done = ids.filter(id => q.done[id]).length;
    set('qcount', `${done}/${ids.length}`);
    $('.tlh-quest-list').innerHTML = ids.map(id => `
      <li class="tlh-quest${q.done[id] ? ' is-done' : ''}">
        <span class="tlh-quest-icon" aria-hidden="true">${QUESTS[id].icon}</span>
        <span class="tlh-quest-text">${esc(QUESTS[id].text)}</span>
        <span class="tlh-quest-mark">${q.done[id] ? '<span aria-hidden="true">✓</span><span class="tlh-sr">tamamlandı</span>' : '<span class="tlh-sr">bekliyor</span>'}</span>
      </li>`).join('');
    $('.tlh-badges').innerHTML = BADGES.map(bd => {
      const got = !!data.badges[bd.id];
      return `<li class="tlh-badge${got ? ' is-got' : ''}" title="${esc(bd.name)}${got ? '' : ' (kilitli)'}"><span aria-hidden="true">${bd.icon}</span><small>${esc(bd.name)}</small>${got ? '' : '<span class="tlh-sr"> kilitli</span>'}</li>`;
    }).join('');

    const started = lessonStars() > 0 || !!(data.sec.egitim && Object.keys(data.sec.egitim).length);
    const startBtn = root.querySelector('[data-tlh="start"]');
    if (startBtn) startBtn.firstChild.textContent = started ? 'Kaldığın Yerden Devam ' : 'Hemen Başla ';
    soundBtn.setAttribute('aria-pressed', String(sfx.enabled));
    soundBtn.setAttribute('aria-label', sfx.enabled ? 'Sesi kapat' : 'Sesi aç');
    soundBtn.firstElementChild.textContent = sfx.enabled ? '🔊' : '🔇';
  }

  /** İlerleme olaylarını işler: görevler, seri, rozetler. */
  function progress({ quests = [], finished = false, wpm = 0, acc = 0 } = {}) {
    const msgs = [];
    let record = false;
    update(d => {
      if (finished) {
        d.stats.finished = num(d.stats.finished) + 1;
        if (acc >= 100) d.stats.perfect = num(d.stats.perfect) + 1;
        touchStreak(d);
      }
      if (wpm > 0) {
        if (wpm > num(d.bestWpm) && wpm > bestWpm(d) && num(d.stats.finished) > 1) record = true;
        d.bestWpm = Math.max(num(d.bestWpm), Math.round(wpm));
      }
      if (wpm >= 35) quests.push('wpm35');
      if (acc >= 98) quests.push('acc98');
      const ids = todaysQuestIds();
      const q = questState(d);
      for (const id of quests) {
        if (ids.includes(id) && !q.done[id]) {
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

  /* ---------- alt bölümler ---------- */
  const VIEWS = {
    egitim: { title: '🎓 Klavye Dersleri', file: 'lessons.js', fn: 'mountLessons' },
    edebiyat: { title: '🪶 Şiir & Atasözü Yazma', file: 'literature.js', fn: 'mountLiterature' },
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
        if (quests.length || wpm || finished) progress({ quests, finished, wpm, acc });
        else renderStats();
      },
    };
  }

  function errorCard(msg) {
    return `<div class="tlh-error" role="alert"><p class="tlh-error-title">Hay aksi!</p><p>${esc(msg)}</p>
      <button type="button" class="tlh-btn tlh-btn--ghost" data-tlh="retry">Tekrar dene</button></div>`;
  }

  async function openView(id, { push = true, intent = null } = {}) {
    const v = VIEWS[id];
    if (!v) return;
    if (view && view.id === id) return;
    closeView({ silent: true });
    ensureEgitimCss();
    const token = { id, inst: null, intent };
    view = token;
    viewTitle.textContent = v.title;
    viewEl.hidden = false;
    menuEl.setAttribute('aria-hidden', 'true');
    menuEl.inert = true;
    scene?.setPaused?.(true);
    if (push && location.hash !== '#' + id) {
      try { history.pushState({ tlh: id }, '', '#' + id); } catch { /* yok */ }
    }
    viewBody.innerHTML = '<div class="tlh-loading">Yükleniyor…</div>';
    $('.tlh-back').focus({ preventScroll: true });
    try {
      const m = await loadMod(v.file);
      if (view !== token) return;
      if (typeof m[v.fn] !== 'function') throw new Error(v.fn + ' yok');
      viewBody.innerHTML = '';
      const host = document.createElement('div');
      host.className = 'tlh-view-host';
      viewBody.appendChild(host);
      let inst = m[v.fn](host, makeCtx(id, intent));
      if (inst && typeof inst.then === 'function') inst = await inst;
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
    if (!root.hidden) scene?.setPaused?.(false);
    if (!silent && !fromPop && VIEW_IDS.includes(location.hash.slice(1))) {
      if (history.state && history.state.tlh) history.back();
      else clearHash();
    }
    if (!silent) root.querySelector('.tlh-card-main')?.focus({ preventScroll: true });
  }

  function clearHash() {
    if (!location.hash) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch { /* yok */ }
  }

  /* ---------- gizle / göster ---------- */
  const pvpRoot = () => document.getElementById('pvp-root');
  const pvpVisible = () => { const p = pvpRoot(); return !!p && !p.hidden; };
  function updateFab() { fab.hidden = !root.hidden || pvpVisible(); }
  function hideHome() {
    if (root.hidden) { updateFab(); return; }
    closeView({ silent: true });
    clearHash();
    root.hidden = true;
    scene?.setPaused?.(true);
    if (root.contains(document.activeElement)) document.activeElement.blur();
    updateFab();
  }
  function showHome() {
    if (pvpVisible()) return;
    root.hidden = false;
    scene?.setPaused?.(false);
    data = readStore();
    renderStats();
    updateFab();
    root.focus({ preventScroll: true });
  }

  function clickAppNav(mode) {
    let b = document.querySelector(`[data-action="nav"][data-mode="${mode}"]`);
    if (b) { b.click(); return; }
    // Uygulamanın tıklama dinleyicisi document üzerinde ve navigate(mode)'u çağırır: geçici düğme yeterli.
    b = document.createElement('button');
    b.type = 'button';
    b.hidden = true;
    b.dataset.action = 'nav';
    b.dataset.mode = mode;
    document.body.appendChild(b);
    try { b.click(); } finally { b.remove(); }
  }

  /* ---------- Günün Dizesi ---------- */
  let dailyCtl = null;
  let dailyLine = null;
  let mountTyperFn = null;
  const typerSfx = { key: () => sfx.key(), error: () => sfx.error(), win: () => {}, voice: (n) => sfx.voice(n), get enabled() { return sfx.enabled; } };

  async function mountDaily() {
    dailyHost.innerHTML = '<div class="tlh-loading">Yükleniyor…</div>';
    dailyResult.hidden = true;
    try {
      ensureEgitimCss();
      const [lit, typing] = await Promise.all([loadMod('literature.js'), loadMod('typing.js')]);
      if (typeof lit.dailyLine !== 'function' || typeof typing.mountTyper !== 'function') throw new Error('arabirim eksik');
      dailyLine = lit.dailyLine();
      if (!dailyLine || !dailyLine.text) throw new Error('dize yok');
      mountTyperFn = typing.mountTyper;
      const src = root.querySelector('[data-s="src"]');
      if (src) src.textContent = dailyLine.source || '';
      startDaily();
    } catch (err) {
      try { console.warn('[home] Günün Dizesi yüklenemedi:', err); } catch { /* yok */ }
      dailyHost.innerHTML = errorCard('Günün Dizesi şu an yüklenemedi.');
    }
  }

  function startDaily() {
    try { dailyCtl?.destroy?.(); } catch { /* yok */ }
    dailyCtl = null;
    dailyHost.innerHTML = '';
    dailyResult.hidden = true;
    let lastTyped = 0;
    let lastPulse = 0;
    try {
      dailyCtl = mountTyperFn(dailyHost, {
        text: dailyLine.text,
        keyboard: false,
        sfx: typerSfx,
        onProgress(s) {
          const typed = num(s && s.typed);
          const now = performance.now();
          if (typed > lastTyped && now - lastPulse > 90) { scene?.pulse('key'); lastPulse = now; }
          lastTyped = typed;
        },
        onFinish(s) { finishDaily(s || {}); },
      });
    } catch (err) {
      try { console.warn('[home] yazma alanı açılamadı:', err); } catch { /* yok */ }
      dailyHost.innerHTML = errorCard('Yazma alanı açılamadı.');
    }
  }

  function finishDaily(s) {
    const wpm = Math.round(num(s.wpm));
    const acc = Math.round(normAcc(s.acc));
    dailyResult.hidden = false;
    dailyResult.innerHTML = `
      <div class="tlh-result-nums"><span><b>${wpm}</b> WPM</span><span><b>%${acc}</b> doğruluk</span></div>
      <p class="tlh-result-msg">${acc >= 98 ? 'Kusursuza yakın! 🎉' : wpm >= 35 ? 'Harika hız! 🔥' : 'Güzel! Bir tur daha?'}</p>
      <button type="button" class="tlh-btn tlh-btn--ghost" data-tlh="daily-again">Tekrar yaz</button>`;
    confetti();
    sfx.win();
    if (acc >= 98) setTimeout(() => sfx.voice('great'), 1100);
    scene?.pulse('win');
    progress({ quests: ['daily'], finished: true, wpm, acc });
  }

  /* ---------- olaylar ---------- */
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tlh],[data-card-main]');
    if (!t || !root.contains(t)) return;
    const act = t.dataset.tlh;
    const card = t.dataset.cardMain;
    if (act === 'start') { sfx.voice('lesson'); openView('egitim', { intent: 'continue' }); return; }
    if (act === 'to-daily') {
      $('#tlh-daily').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
      setTimeout(() => dailyCtl?.focus?.(), reduced() ? 0 : 450);
      return;
    }
    if (act === 'back') { closeView(); return; }
    if (act === 'daily-again') { startDaily(); setTimeout(() => dailyCtl?.focus?.(), 30); return; }
    if (act === 'retry') {
      if (t.closest('.tlh-daily')) mountDaily();
      else if (view) { const id = view.id, intent = view.intent; view = null; openView(id, { push: false, intent }); }
      return;
    }
    if (act === 'pvp-online') { hideHome(); document.dispatchEvent(new CustomEvent('tuslab:pvp-enter')); return; }
    if (card === 'egitim' || card === 'edebiyat') { openView(card); return; }
    if (card === 'arena') { hideHome(); clickAppNav('arena'); progress({ quests: ['arena'] }); return; }
    if (card === 'analytics') { hideHome(); clickAppNav('analytics'); return; }
    // pvp: bağlantı varsayılan davranışıyla ?pvp=practice&mode=classic adresine gider.
  });

  soundBtn.addEventListener('click', () => {
    const on = !sfx.enabled;
    sfx.setEnabled(on);
    update(d => { d.sound = on; });
    renderStats();
    if (on) sfx.chime();
  });

  // Kartlar: ok tuşlarıyla gezinme
  const cardMains = () => Array.from(root.querySelectorAll('.tlh-card-main'));
  $('.tlh-cards').addEventListener('keydown', (e) => {
    const list = cardMains();
    const i = list.indexOf(document.activeElement);
    if (i < 0) return;
    let n = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % list.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + list.length) % list.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = list.length - 1;
    if (n >= 0) { e.preventDefault(); list[n].focus(); }
  });

  // Kartlar: fareyle 3B eğilme + parlama
  root.querySelectorAll('.tlh-card').forEach(card => {
    card.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || reduced()) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--rx', ((0.5 - y) * 12).toFixed(2) + 'deg');
      card.style.setProperty('--ry', ((x - 0.5) * 14).toFixed(2) + 'deg');
      card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
    });
    card.addEventListener('pointerleave', () => {
      card.style.removeProperty('--rx'); card.style.removeProperty('--ry');
    });
  });

  // Klavye: Escape → menü; tuşları alttaki uygulamaya sızdırma (uygulama girdi alanlarını zaten yok sayar).
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && view && !e.defaultPrevented) { e.preventDefault(); closeView(); }
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

  fab.addEventListener('click', () => showHome());
  document.addEventListener('tuslab:pvp-enter', () => hideHome());

  function watchPvp() {
    const p = pvpRoot();
    if (!p) return false;
    new MutationObserver(() => { if (!p.hidden) hideHome(); else updateFab(); }).observe(p, { attributes: true, attributeFilter: ['hidden'] });
    if (!p.hidden) hideHome();
    return true;
  }

  /* ---------- başlat ---------- */
  let scene = null;
  function boot() {
    document.body.appendChild(root);
    document.body.appendChild(fab);
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

    mountDaily();

    const id = location.hash.slice(1);
    if (VIEW_IDS.includes(id) && !root.hidden) openView(id, { push: false });
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot, { once: true });
})();
