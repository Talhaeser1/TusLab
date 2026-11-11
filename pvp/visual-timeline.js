// Şerit H: görsel zaman çizelgesi (saf mantık; three.js/DOM/ağ bağımsız).
// Sunucu/motor olayları geldiği an değil, sıraya alınıp oynatılır: her saldırı =
// yolculuk + klip(temasa kadar) + toparlanma + dönüş. Hasar hesabı DEĞİŞMEZ: yalnız
// hasarın GÖSTERİMİ (vuruş efekti, sarsıntı, hasar sayısı) temas karesine ertelenir.
//
//   const tl = createVisualTimeline({now, isReduced});
//   tl.enqueue({seat, estimateMs, start(ctx) → {contactMs, durationMs}, onContact(), onEnd(), complete(forced)});
//   tl.tick(dtMs)         // her kare, rig ile AYNI simülasyon dt'si (hitstop'ta 0)
//   tl.drain(1500)        // KO/raund sonu: kuyruk en geç 1,5 s'de boşalır
//   tl.flush()            // raund geçişi: son durumu anında uygula
//   tl.isBusy() / tl.remainingMs() / tl.whenIdle(maxWaitMs)    // okuma API'si
//
// ctx (start'a verilir): {compress, skipReturn, backlogMs} — kuyruk birikimi.
// Tavan aşılırsa bekleyen eski sahneler temas üretmeden tamamlanır.

export const VISUAL_QUEUE = Object.freeze({
  maxBacklogMs: 2500,   // birikim bu değeri aşarsa sıkıştırma
  drainMs: 1500,        // KO/raund sonu boşalma üst sınırı
  idleWaitMs: 3000,     // whenIdle varsayılan üst bekleme
  maxItems: 12,         // koruma: daha fazlasında en eskiler anında tamamlanır
});

export function createVisualTimeline({now = () => Date.now(), isReduced = () => false, setTimer = null, clearTimer = null} = {}) {
  const queue = [];
  let active = null;
  let clock = 0;            // simülasyon saati (ms)
  let drainUntil = Infinity; // clock bu değere varınca kalan her şey anında tamamlanır
  const waiters = [];
  const stats = {started: 0, completed: 0, compressed: 0, skippedReturns: 0, forced: 0, maxBacklogMs: 0, lastLagMs: 0};
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

  function safe(fn, arg) { try { return fn?.(arg); } catch { return undefined; /* kozmetik katman */ } }

  function finish(item, forced) {
    if (item.done) return;
    item.done = true;
    if (!item.contactFired && !forced) { item.contactFired = true; safe(item.onContact, {forced}); }
    if (forced) { stats.forced++; safe(item.complete, true); }
    safe(item.onEnd, {forced});
    stats.completed++;
    if (active === item) active = null;
  }

  function startNext() {
    while (!active && queue.length) {
      const item = queue.shift();
      const backlog = (item.estimateMs || 0) + queue.reduce((s, q) => s + (q.estimateMs || 0), 0);
      const compress = backlog > VISUAL_QUEUE.maxBacklogMs;
      const skipReturn = false;
      if (compress) stats.compressed++;
      if (skipReturn) stats.skippedReturns++;
      stats.lastLagMs = backlog;
      stats.maxBacklogMs = Math.max(stats.maxBacklogMs, backlog);
      const plan = safe(item.start, {compress, skipReturn, backlogMs: backlog}) || {};
      item.elapsed = 0;
      item.contactMs = Math.max(0, Number(plan.contactMs) || 0);
      item.durationMs = Math.max(item.contactMs, Number(plan.durationMs) || item.contactMs);
      item.contactFired = false;
      item.done = false;
      active = item;
      stats.started++;
      if (item.durationMs <= 0) finish(item, false);
    }
  }

  function flush() {
    // Raund geçişi / sahne temizliği: son durumu anında uygula.
    if (active) finish(active, true);
    while (queue.length) {
      const item = queue.shift();
      item.contactFired = false; item.done = false;
      finish(item, true);
    }
    settle();
  }

  return {
    stats, VISUAL_QUEUE,
    /** Sıraya ekle. Çok birikirse en eskiler anında tamamlanır (sınırsız backlog yok). */
    enqueue(item) {
      if (!item || typeof item.start !== 'function') return null;
      const entry = {seat: item.seat, estimateMs: Number(item.estimateMs) || 0, start: item.start, onContact: item.onContact,
        onEnd: item.onEnd, complete: item.complete, enqueuedAt: clock, elapsed: 0, done: false, contactFired: false, meta: item.meta};
      if (isReduced()) {                // azaltılmış hareket: sıra yok, anında
        entry.contactFired = false;
        safe(entry.start, {compress: true, skipReturn: false, backlogMs: 0});
        finish(entry, false);
        return entry;
      }
      queue.push(entry);
      while (queue.length > VISUAL_QUEUE.maxItems || (queue.length > 1 && remainingMs() > VISUAL_QUEUE.maxBacklogMs)) {
        const old = queue.shift(); finish(old, true);
      }
      if (!active) startNext();
      return entry;
    },
    tick(dtMs) {
      const dt = Math.max(0, Number(dtMs) || 0);
      clock += dt;
      if (active) {
        active.elapsed += dt;
        if (!active.contactFired && active.elapsed >= active.contactMs) { active.contactFired = true; safe(active.onContact, {forced: false}); }
        if (active.elapsed >= active.durationMs) finish(active, false);
      }
      if (clock >= drainUntil && isBusy()) { flush(); return; }
      startNext();
      settle();
    },
    /** KO / raund sonu / zafer: kuyruk en geç budgetMs içinde boşalır, HP son değere oturur. */
    drain(budgetMs = VISUAL_QUEUE.drainMs) {
      const budget = Math.max(0, Number(budgetMs) || 0);
      if (!isBusy()) return;
      drainUntil = Math.min(drainUntil, clock + budget);
    },
    flush,
    clear() { queue.length = 0; active = null; drainUntil = Infinity; settle(); },
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
    snapshot: () => ({busy: isBusy(), remainingMs: remainingMs(), queued: queue.length, active: Boolean(active),
      activeSeat: active?.seat ?? null, clock, ...stats}),
  };
}
