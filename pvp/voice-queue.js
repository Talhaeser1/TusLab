/**
 * Görev S / KESINYAP iş 5 — tek kanallı konuşma kuyruğu (saf, DOM/WebAudio yok).
 * TÜM konuşmalı sesler (spiker, seri anonsu, süre uyarısı, karakter replikleri) buradan SIRAYLA çalar:
 *  - aynı anda en fazla BİR konuşma çalar;
 *  - meşgulken gelenler öncelik sırasıyla (yüksek önce) en çok 2 öğelik kuyruğa girer, dolarsa en düşük öncelik atılır;
 *  - 2,5 sn'den uzun bekleyen (bayat) öğe çalınmaz;
 *  - aynı anahtar cooldownMs içinde (başlatıldığından ya da sıraya girdiğinden beri) tekrar kabul edilmez;
 *  - aynı anahtar zaten kuyruktaysa ikinci kez eklenmez.
 * start(item, done) → true dönerse öğe çalıyordur ve bitince done() çağrılır; false → atlanır.
 */
export const VOICE_QUEUE = Object.freeze({maxQueue: 2, ttlMs: 2500, staleMs: 2500, cooldownMs: 0});

export function createVoiceQueue({now = () => Date.now(), start, maxQueue = VOICE_QUEUE.maxQueue, ttlMs = VOICE_QUEUE.ttlMs, staleMs = VOICE_QUEUE.staleMs} = {}) {
  let busy = false;
  let current = null;
  let queue = [];
  let epoch = 0; // clear() sonrası eski done() çağrıları yok sayılır
  let order = 0;
  const last = new Map(); // anahtar → son kabul zamanı (cooldown)

  function pump() {
    if (busy || typeof start !== 'function') return;
    const t = now();
    queue = queue.filter(item => t - item.at <= item.ttl);
    const item = queue.shift();
    if (!item) return;
    busy = true;
    current = item.key;
    const mine = epoch;
    let finished = false;
    const done = () => {
      if (finished || mine !== epoch) return;
      finished = true;
      busy = false;
      current = null;
      pump();
    };
    let ok = false;
    try { ok = Boolean(start(item, done)); } catch { ok = false; }
    if (!ok) done();
  }

  function push(item = {}) {
    if (!item.key) return false;
    const t = now();
    const cooldown = Number(item.cooldownMs) > 0 ? Number(item.cooldownMs) : VOICE_QUEUE.cooldownMs;
    if (cooldown > 0 && last.has(item.key) && t - last.get(item.key) < cooldown) return false;
    if (queue.some(q => q.key === item.key) || (busy && current === item.key)) return false;
    last.set(item.key, t);
    // Bekleme ömrü bayatlık sınırını (2,5 sn) aşamaz — bitiş spikeri (noStale) hariç: maç sonu repliğini bekleyebilir.
    const ttl = item.noStale && Number(item.ttlMs) > 0 ? Number(item.ttlMs) : Math.min(Number(item.ttlMs) > 0 ? Number(item.ttlMs) : ttlMs, staleMs);
    queue.push({priority: 1, ...item, ttl, at: t, order: order++});
    queue.sort((a, b) => b.priority - a.priority || a.order - b.order);
    if (queue.length > maxQueue) queue.length = maxQueue;
    pump();
    return true;
  }

  function clear() { epoch++; busy = false; current = null; queue = []; last.clear(); }
  /** Maç sonu: bekleyenler atılır (çalan konuşma kesilmez). */
  function dropQueued() { queue = []; }

  return {push, clear, dropQueued, state: () => ({busy, current, queued: queue.map(i => i.key)})};
}
