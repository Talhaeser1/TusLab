/**
 * Görev S — tek kanallı replik/anons kuyruğu (saf, DOM/WebAudio yok).
 * Aynı anda en fazla BİR replik ya da anons çalar; meşgulken gelenler öncelik sırasıyla (yüksek önce)
 * kısa bir kuyruğa girer, kuyruk dolarsa en düşük öncelik atılır, süresi geçen (bayat) öğe çalınmaz.
 * start(item, done) → true dönerse öğe çalıyordur ve bitince done() çağrılır; false → atlanır.
 */
export const VOICE_QUEUE = Object.freeze({maxQueue: 2, ttlMs: 1600});

export function createVoiceQueue({now = () => Date.now(), start, maxQueue = VOICE_QUEUE.maxQueue, ttlMs = VOICE_QUEUE.ttlMs} = {}) {
  let busy = false;
  let queue = [];
  let epoch = 0; // clear() sonrası eski done() çağrıları yok sayılır
  let order = 0;

  function pump() {
    if (busy || typeof start !== 'function') return;
    const t = now();
    queue = queue.filter(item => t - item.at <= item.ttl);
    const item = queue.shift();
    if (!item) return;
    busy = true;
    const mine = epoch;
    let finished = false;
    const done = () => {
      if (finished || mine !== epoch) return;
      finished = true;
      busy = false;
      pump();
    };
    let ok = false;
    try { ok = Boolean(start(item, done)); } catch { ok = false; }
    if (!ok) done();
  }

  function push(item = {}) {
    if (!item.key) return false;
    queue.push({priority: 1, ...item, ttl: Number(item.ttlMs) > 0 ? Number(item.ttlMs) : ttlMs, at: now(), order: order++});
    queue.sort((a, b) => b.priority - a.priority || a.order - b.order);
    if (queue.length > maxQueue) queue.length = maxQueue;
    pump();
    return true;
  }

  function clear() { epoch++; busy = false; queue = []; }

  return {push, clear, state: () => ({busy, queued: queue.map(i => i.key)})};
}
