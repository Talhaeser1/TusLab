// Şerit H / Görev 4: görsel zaman çizelgesi (saf mantık; three.js/DOM/ağ bağımsız).
// Sunucu/motor olayları geldiği an değil, sıraya alınıp oynatılır. Hasar hesabı DEĞİŞMEZ:
// yalnız hasarın GÖSTERİMİ (vuruş efekti, sarsıntı, hasar sayısı) temas karesine ertelenir.
//
//   const tl = createVisualTimeline({now, isReduced});
//   tl.enqueue({seat, estimateMs, keep, start(ctx, entry) → {contacts?, contactMs?, durationMs},
//               onContact(), onEnd(), complete(forced)});
//   tl.tick(dtMs)         // her kare, rig ile AYNI simülasyon dt'si (hitstop'ta 0)
//   tl.drain(1500)        // KO/raund sonu: kuyruk en geç 1,5 s'de boşalır
//   tl.flush()            // raund geçişi: son durumu anında uygula
//   tl.isBusy() / tl.remainingMs() / tl.whenIdle(maxWaitMs)    // okuma API'si
//
// SIRA (Görev 4 + İş 1): aynı anda tek koltuk oynar. Saldıran değişince iki taraf idle ve
// evdeyken TURN.breathMs (~1,2 sn; baskıda ≥ 0,6 sn) ara bırakılır; aynı koltuğun yeni yaklaşması
// yalnız kısa oturma payı bekler. Görsel kuyruk boş beklediyse ara zaten dolmuştur (gecikme yok).
//
// Çoklu temas (kombo): start {contacts: [{ms, fn}]} döndürebilir; her temas kendi fn'sini
// kendi karesinde çağırır. Eski tekli sözleşme (contactMs + onContact) aynen çalışır.
// Girdi tutamacı (enqueue dönen nesne): aktifken süre uzatılabilir, yeni tema eklenebilir:
//   entry.extend(ms) · entry.addContact({ms, fn}) · entry.reestimate(ms)
// Bekleyen girdiler birikirse eskiler themesiz tamamlanır; `keep: true` girdileri (kombo)
// yalnız maxItems sınırında düşer — baskı yerine arena katmanı komboyu SIKIŞTIRIR.

export const VISUAL_QUEUE = Object.freeze({
  // İş 1, 3. tur: okunur sahne ~4,5 sn → birikim eşiği ~1,5 sahne (bunun üstünde sıkıştırma ×1,25 ve zincirleme/katlama).
  maxBacklogMs: 6000,   // bekleyen sıradan sahnelere ilişkin birikim eşiği (keep:true hariç)
  drainMs: 1500,        // KO/raund sonu boşalma üst sınırı
  idleWaitMs: 3000,     // whenIdle varsayılan üst bekleme (raund özeti tavanı ~3 sn)
  maxItems: 12,         // koruma: daha fazlasında en eskiler anında tamamlanır
});

/** İş 1 (dövüş temposu): saldıran DEĞİŞİRKEN iki taraf idle beklerken geçen ara (ms).
 *  breathMs varsayılan ara; kuyruk baskısında orantılı kısalır ama minMs'in altına inmez.
 *  Ara yalnız iki dövüşçü YERLEŞİKKEN (idle + evde; isSettled) sayılır; tepki klibi takılırsa
 *  settleCapMs sonra yine sayılmaya başlar (kilitlenme yok).
 *  createVisualTimeline'da varsayılan KAPALIdır (breathMs: 0) — arena3d açar. */
// İş 1, 3. tur: ara 1,3 sn; baskıda bile 1,0 sn altına inmez (kullanıcı: "1–2 saniye sonra diğeri saldırsın").
export const TURN = Object.freeze({breathMs: 1300, minMs: 1000, maxMs: 2000, settleCapMs: 700, sameSeatMs: 300});

/** Saf: bekleyen kuyruk süresine göre saldıran değişimi arası (ms). draining → en kısa ara. */
export function turnGapMs(backlogMs = 0, {base = TURN.breathMs, min = TURN.minMs, pressureMs = VISUAL_QUEUE.maxBacklogMs, draining = false} = {}) {
  const b = Math.max(0, Number(base) || 0);
  if (b <= 0) return 0;
  const floor = Math.min(b, Math.max(0, Number(min) || 0));
  if (draining) return floor;
  const backlog = Math.max(0, Number(backlogMs) || 0);
  if (backlog <= pressureMs) return b;
  return Math.max(floor, Math.round(b * pressureMs / backlog));
}

export function createVisualTimeline({now = () => Date.now(), isReduced = () => false, setTimer = null, clearTimer = null, breathMs = 0,
  isSettled = () => true, settleCapMs = TURN.settleCapMs, minBreathMs = TURN.minMs} = {}) {
  const queue = [];
  let active = null;
  let clock = 0;             // simülasyon saati (ms)
  let drainUntil = Infinity; // clock bu değere varınca kalan her şey anında tamamlanır
  let lastSeat = null;       // son BAŞLATILAN girdinin koltuğu (nefes hesabı)
  let lastEndClock = -Infinity; // son girdinin bittiği an
  let quietMs = Infinity;    // son girdiden beri iki taraf yerleşikken geçen süre (ara bunu sayar)
  let breathLeft = 0;        // kalan ara (ms; snapshot için)
  const waiters = [];
  const stats = {started: 0, completed: 0, compressed: 0, skippedReturns: 0, forced: 0, maxBacklogMs: 0, lastLagMs: 0, breaths: 0};
  const timer = setTimer || ((fn, ms) => globalThis.setTimeout?.(fn, ms));
  const untimer = clearTimer || (id => globalThis.clearTimeout?.(id));

  const activeRemaining = () => (active ? Math.max(0, active.durationMs - active.elapsed) : 0);
  function remainingMs() {
    let sum = activeRemaining();
    for (const item of queue) sum += item.estimateMs || 0;
    return sum;
  }
  const isBusy = () => Boolean(active) || queue.length > 0;

  function settle() {
    if (isBusy()) return;
    drainUntil = Infinity;
    for (const w of waiters.splice(0)) { untimer(w.timer); w.resolve(true); }
  }

  function safe(fn, arg, extra) { try { return fn?.(arg, extra); } catch { return undefined; /* kozmetik katman */ } }

  /** Temas noktalarını ateşle (ms küçükten büyüğe; her biri bir kez). */
  function pumpContacts(item) {
    if (!item || item.done) return;
    for (const c of item.contacts) {
      if (c.fired || item.elapsed < c.ms) continue;
      c.fired = true;
      safe(c.fn, {forced: false, ms: c.ms});
    }
  }

  function finish(item, forced) {
    if (item.done) return;
    item.done = true;
    if (!forced) pumpContacts(item); // sıfır süreli girdi temasını yine de verir
    if (forced) { stats.forced++; safe(item.complete, true); }
    safe(item.onEnd, {forced});
    stats.completed++;
    if (active === item) { active = null; lastEndClock = clock; quietMs = 0; }
  }

  /** start planından temas listesi: yeni çoklu sözleşme + eski tekli sözleşme. */
  function buildContacts(item, plan) {
    const list = [];
    if (Array.isArray(plan?.contacts)) {
      for (const c of plan.contacts) {
        if (c && typeof c.fn === 'function') list.push({ms: Math.max(0, Number(c.ms) || 0), fn: c.fn, fired: false});
      }
      list.sort((a, b) => a.ms - b.ms);
    }
    if (typeof item.onContact === 'function') {
      list.push({ms: Math.max(0, Number(plan?.contactMs) || 0), fn: item.onContact, fired: false});
    }
    return list;
  }

  function startNext() {
    while (!active && queue.length) {
      const next = queue[0];
      // Ara (yalnız breathMs > 0 isteyen katman): saldıran değişince iki taraf yerleşik halde
      // turnGapMs kadar bekler. Kuyruk boş beklediyse ara zaten dolmuştur (gecikme yok).
      // Aynı koltuk (kombo devamı) arasız başlar.
      const draining = drainUntil !== Infinity;
      if (breathMs > 0 && next.seat !== undefined && lastSeat !== null) {
        const backlogAll = queue.reduce((s, q) => s + (q.estimateMs || 0), 0);
        const full = turnGapMs(backlogAll, {base: breathMs, min: minBreathMs, draining});
        // Aynı koltuğun yeni yaklaşması: yalnız yerine oturma payı (kısa); saldıran değişimi: tam ara.
        const gap = next.seat !== lastSeat ? full : Math.min(TURN.sameSeatMs, full);
        if (quietMs < gap) {
          if (breathLeft <= 0) stats.breaths++;
          breathLeft = gap - quietMs;
          return;
        }
      }
      const item = queue.shift();
      breathLeft = 0; // bir girdi başladı: bekleyen ara artık geçerli değil
      const backlog = (item.estimateMs || 0) + queue.reduce((s, q) => s + (q.estimateMs || 0), 0);
      // Sıkıştırma: birikim eşiği aşıldıysa ya da raund sonu boşaltması sürüyorsa yürüyüş/ara kısalır.
      const compress = backlog > VISUAL_QUEUE.maxBacklogMs || draining;
      const skipReturn = false;
      if (compress) stats.compressed++;
      stats.lastLagMs = backlog;
      stats.maxBacklogMs = Math.max(stats.maxBacklogMs, backlog);
      item.elapsed = 0;
      item.done = false;
      const plan = safe(item.start, {compress, skipReturn, backlogMs: backlog}, item) || {};
      item.contacts = buildContacts(item, plan);
      item.returnStartMs = Number.isFinite(Number(plan.returnStartMs)) ? Number(plan.returnStartMs) : null;
      item.contactMs = item.contacts.length ? item.contacts[0].ms : Math.max(0, Number(plan.contactMs) || 0);
      item.durationMs = Math.max(item.contactMs, item.contacts.length ? item.contacts[item.contacts.length - 1].ms : 0,
        Number(plan.durationMs) || item.contactMs);
      active = item;
      stats.started++;
      pumpContacts(item); // ms=0 temasları aynı karede
      if (item.durationMs <= 0 && !item.contacts.length) finish(item, false);
      else if (item.elapsed >= item.durationMs) finish(item, false);
      lastSeat = item.seat ?? lastSeat;
    }
  }

  function flush() {
    // Raund geçişi / sahne temizliği: son durumu anında uygula.
    if (active) finish(active, true);
    while (queue.length) {
      const item = queue.shift();
      finish(item, true);
    }
    // Sahne temizliği/raund geçişi: son durum uygulandı → yeni sahne ara beklemeden başlayabilir.
    lastSeat = null; quietMs = Infinity; breathLeft = 0;
    settle();
  }

  /** Girdi tutamacı: kombo denetleyicisi aktif girdiyi canlı uzatır/besler. */
  function makeHandle(entry) {
    return {
      get elapsed() { return entry.elapsed; },
      get done() { return entry.done; },
      get durationMs() { return entry.durationMs; },
      set durationMs(ms) { if (!entry.done) entry.durationMs = Math.max(0, Number(ms) || 0); },
      set returnStartMs(ms) { if (!entry.done) entry.returnStartMs = Number.isFinite(Number(ms)) ? Number(ms) : null; },
      extend(ms) { if (!entry.done) entry.durationMs += Math.max(0, Number(ms) || 0); },
      reestimate(ms) { entry.estimateMs = Math.max(0, Number(ms) || 0); },
      /** Henüz başlamamış girdiyi sessizce sıradan çıkar (içeriği başka sahneye katlandı). */
      cancel() {
        if (entry.done || active === entry) return false;
        const i = queue.indexOf(entry);
        if (i < 0) return false;
        queue.splice(i, 1);
        entry.done = true;
        stats.completed++;
        safe(entry.onEnd, {forced: false, cancelled: true});
        settle();
        return true;
      },
      addContact({ms, fn} = {}) {
        if (entry.done || typeof fn !== 'function') return null;
        const c = {ms: Math.max(0, Number(ms) || 0), fn, fired: false};
        entry.contacts.push(c);
        entry.durationMs = Math.max(entry.durationMs, c.ms);
        if (active === entry) pumpContacts(entry);
        return c;
      },
    };
  }

  function enqueue(item) {
    if (!item || typeof item.start !== 'function') return null;
    const entry = {seat: item.seat, estimateMs: Number(item.estimateMs) || 0, keep: Boolean(item.keep),
      start: item.start, onContact: item.onContact, onEnd: item.onEnd, complete: item.complete,
      enqueuedAt: clock, elapsed: 0, done: false, contacts: [], contactMs: 0, durationMs: 0, meta: item.meta};
    entry.handle = makeHandle(entry);
    if (isReduced()) {                // azaltılmış hareket: sıra yok, anında (animasyonsuz)
      const plan = safe(entry.start, {compress: true, skipReturn: false, backlogMs: 0}, entry) || {};
      entry.contacts = buildContacts(entry, plan);
      entry.done = true;
      for (const c of entry.contacts) { c.fired = true; safe(c.fn, {forced: false, ms: c.ms}); }
      safe(entry.onEnd, {forced: false});
      stats.completed++;
      return entry.handle;
    }
    queue.push(entry);
    while (queue.length > VISUAL_QUEUE.maxItems) { const old = queue.shift(); finish(old, true); }
    while (queue.length > 1 && remainingMs() > VISUAL_QUEUE.maxBacklogMs) {
      const i = queue.findIndex(q => !q.keep);   // kombo (keep) düşürülmez: arena katmanı sıkıştırır
      if (i < 0) break;
      const [old] = queue.splice(i, 1); finish(old, true);
    }
    if (!active) startNext();
    return entry.handle;
  }

  function tick(dtMs) {
    const dt = Math.max(0, Number(dtMs) || 0);
    clock += dt;
    // Ara sayacı: girdi yokken ve iki taraf yerleşikken (ya da tepki tavanı dolduysa) ilerler.
    if (!active && quietMs !== Infinity) {
      let settled = true;
      if (breathMs > 0 && clock - lastEndClock < settleCapMs) { try { settled = isSettled() !== false; } catch { settled = true; } }
      if (settled) quietMs += dt;
    }
    if (active) {
      active.elapsed += dt;
      pumpContacts(active);
      if (active.elapsed >= active.durationMs) finish(active, false);
    }
    if (clock >= drainUntil && isBusy()) {
      // Süre doldu: başlamamış girdiler tamamlanır; OYNAYAN sahne kesilmez (yarım animasyon/sıçrama
      // yok), en geç kendi süresi kadar sürer. Aktif yoksa her şey anında biter (eski davranış).
      if (!active) { flush(); return; }
      while (queue.length) finish(queue.shift(), true);
      settle();
      return;
    }
    startNext();
    settle();
  }

  function drain(budgetMs = VISUAL_QUEUE.drainMs) {
    const budget = Math.max(0, Number(budgetMs) || 0);
    if (!isBusy()) return;
    drainUntil = Math.min(drainUntil, clock + budget);
  }

  function clear() {
    queue.length = 0; active = null; drainUntil = Infinity; breathLeft = 0;
    lastSeat = null; lastEndClock = -Infinity; quietMs = Infinity;
    settle();
  }

  return {
    stats, VISUAL_QUEUE, TURN,
    enqueue,
    tick,
    /** KO / raund sonu / zafer: kuyruk en geç budgetMs içinde boşalır, HP son değere oturur. */
    drain,
    flush,
    clear,
    isBusy, remainingMs,
    /** Kuyruk boşalınca (ya da en fazla maxWaitMs sonra) çözülen Promise: true = boşaldı, false = zaman aşımı. */
    whenIdle(maxWaitMs = VISUAL_QUEUE.idleWaitMs) {
      if (!isBusy()) return Promise.resolve(true);
      return new Promise(resolve => {
        const w = {resolve, timer: null};
        w.timer = timer(() => {
          const i = waiters.indexOf(w);
          if (i >= 0) waiters.splice(i, 1);
          resolve(false);
        }, Math.max(0, Number(maxWaitMs) || 0));
        waiters.push(w);
      });
    },
    /** phase: approach | strike | return | idle · comboIndex: ateşlenen temas sayısı (aktif girdide). */
    snapshot: () => {
      const a = active;
      let phase = 'idle', comboIndex = 0;
      if (a) {
        comboIndex = a.contacts.filter(c => c.fired).length;
        const firstMs = a.contacts.length ? a.contacts[0].ms : a.contactMs;
        const retMs = Number.isFinite(a.returnStartMs) ? a.returnStartMs : null;
        phase = a.elapsed < firstMs ? 'approach' : retMs !== null && a.elapsed >= retMs ? 'return' : 'strike';
      }
      return {busy: isBusy(), remainingMs: remainingMs(), queued: queue.length, active: Boolean(a),
        activeSeat: a?.seat ?? null, phase, comboIndex, lastSeat, clock, gapLeftMs: a ? 0 : Math.max(0, breathLeft), ...stats};
    },
  };
}
