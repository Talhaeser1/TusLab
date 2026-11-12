// KESINYAP iş 12 — raund/pencere sonu çözüm zaman çizelgesi (SAF; motor, sunucu ve görsel kuyruk AYNI sabitleri kullanır).
// Motor (match.js / arena.js) bekleyen vuruşları SAHNELERE böler: her sahne tek saldıran, tek yaklaşma, en çok
// RESOLVE_SCENE.maxChain vuruş; sahne başlarken sahnedeki tüm vuruşlar çözülür (görsel katman temas karesinde gösterir).
// Sahne süreleri görsel sahnenin (fighters3d SCENE + visual-timeline TURN) ÜST SINIRIdır → görsel hiç birikmez,
// raund arası kartı son sahne bitip iki dövüşçü yerine dönünce açılır. Toplam süre maxMs'i aşacaksa önce zincir
// uzar (1 → maxChain), yine aşıyorsa kalan vuruşlar koltuk başına TEK "toplu vuruş" sahnesinde toplanır.

/** Görsel kuyruğun ara sabitleri (pvp/visual-timeline.js TURN bunları içe aktarır → motor planı ile görsel ayrışamaz). */
export const VISUAL_TURN = Object.freeze({breathMs: 1300, sameSeatMs: 300, settlePadMs: 200, sameSeatPadMs: 150});

export const RESOLVE_SCENE = Object.freeze({
  leadMs: 500,       // raund/pencere kapanışı → ilk sahne ("RAUND BİTTİ · vuruşlar oynuyor")
  meleeMs: 4600,     // tek vuruşlu yakın sahne: telegraf 350 + gidiş 1100 + vuruş ≤ 1500 + duruş/dönüş ~1600
  strikeMs: 1400,    // aynı yaklaşmada eklenen her vuruş
  ultMs: 4200,       // ulti sahnesi (zirve ≤ 1800 + vuruş 160 + eve dönüş 1120) + pay
  turnMs: VISUAL_TURN.breathMs + VISUAL_TURN.settlePadMs,       // saldıran değişimi arası (1500)
  sameSeatMs: VISUAL_TURN.sameSeatMs + VISUAL_TURN.sameSeatPadMs, // aynı saldıranın yeni yaklaşması (450)
  tailMs: 600,       // son sahne → iki dövüşçü idle (kart açılmadan önce)
  maxMs: 20000,      // raund sonu çözümünün üst sınırı (ulti katlanmaz: 2. ulti kendi süresini ekleyebilir)
  exchangeMaxMs: 14000, // klasik pencere sonu (yazma süresinden yemesin)
  maxChain: 3,       // tek yaklaşmada en çok vuruş (fighters3d SCENE.maxStrikes)
  counterMs: 6100,   // klasik karşı saldırı: ek sahne (meleeMs + turnMs) — sonraki vuruşlar bu kadar kayar
});

const isUlt = a => a?.skill === 'r';
const isAssist = a => Boolean(a?.assist);

/** Saf: bir sahnenin süresi (ms). kind: melee | ult | fold. */
export function sceneMs(scene) {
  if (!scene) return 0;
  if (scene.kind === 'ult') return RESOLVE_SCENE.ultMs;
  if (scene.kind === 'fold') return RESOLVE_SCENE.meleeMs;
  const strikes = scene.items.filter(a => !isAssist(a)).length;
  return RESOLVE_SCENE.meleeMs + Math.max(0, Math.min(strikes, RESOLVE_SCENE.maxChain) - 1) * RESOLVE_SCENE.strikeMs;
}

function totalOf(scenes) {
  if (!scenes.length) return 0;
  let sum = RESOLVE_SCENE.leadMs + RESOLVE_SCENE.tailMs;
  scenes.forEach((s, i) => {
    sum += sceneMs(s);
    if (i > 0) sum += s.seat === scenes[i - 1].seat ? RESOLVE_SCENE.sameSeatMs : RESOLVE_SCENE.turnMs;
  });
  return sum;
}

/** Sıradaki (sıralı) saldırılardan sahneler: koltuklar dönüşümlü, her dönüşte en çok `chain` ardışık q/e (ulti tek başına). */
function buildScenes(ordered, chain) {
  const queues = new Map();
  const seats = [];
  for (const a of ordered) {
    if (!queues.has(a.fromSeat)) { queues.set(a.fromSeat, []); seats.push(a.fromSeat); }
    queues.get(a.fromSeat).push(a);
  }
  // Destek (assist) vuruşu kendi sahnesini açmaz: koltuğun ilk sahnesine katlanır.
  const assists = new Map();
  for (const s of seats) {
    const q = queues.get(s);
    assists.set(s, q.filter(isAssist));
    queues.set(s, q.filter(a => !isAssist(a)));
  }
  const scenes = [];
  let guard = 0;
  while (seats.some(s => queues.get(s).length) && guard++ < 10000) {
    for (const seat of seats) {
      const q = queues.get(seat);
      if (!q.length) continue;
      if (isUlt(q[0])) { scenes.push({seat, kind: 'ult', items: [q.shift()]}); continue; }
      const items = [];
      while (q.length && items.length < chain && !isUlt(q[0])) items.push(q.shift());
      scenes.push({seat, kind: 'melee', items});
    }
  }
  for (const seat of seats) {
    const extra = assists.get(seat);
    if (!extra.length) continue;
    const host = scenes.find(s => s.seat === seat && s.kind === 'melee');
    if (host) host.items.push(...extra);
    else scenes.push({seat, kind: 'melee', items: extra});
  }
  return scenes;
}

/**
 * Saf: çözüm planı. ordered = saldırılar sırayla (motorun dönüşümlü sırası; her biri {fromSeat, skill, assist?}).
 * Döner: {scenes:[{seat, kind, items, startMs, durationMs}], slots: Map(attack → {scene, slot, startMs, fold}), totalMs}.
 */
/** Koltuk başına en çok k yakın sahne; fazlası koltuğun k. sahnesine katlanır (görselde son temas karesinde toplu). */
function capScenes(scenes, k) {
  const count = new Map(), last = new Map(), out = [];
  for (const s of scenes) {
    if (s.kind !== 'melee') { out.push(s); continue; }
    const c = count.get(s.seat) || 0;
    if (c < k) { const copy = {...s, items: [...s.items]}; out.push(copy); last.set(s.seat, copy); count.set(s.seat, c + 1); }
    else last.get(s.seat).items.push(...s.items);
  }
  // Ardışık aynı koltuk sahneleri birleşmez (her biri ayrı yaklaşma); sıralama korunur.
  return out;
}

export function planResolve(ordered, {maxMs = RESOLVE_SCENE.maxMs} = {}) {
  const list = Array.isArray(ordered) ? ordered.filter(Boolean) : [];
  let scenes = [];
  for (let chain = 1; chain <= RESOLVE_SCENE.maxChain; chain++) {
    scenes = buildScenes(list, chain);
    if (totalOf(scenes) <= maxMs) break;
  }
  if (totalOf(scenes) > maxMs) {
    // 2. kademe: koltuk başına daha az yaklaşma; fazla vuruşlar koltuğun son yakın sahnesine katlanır (toplu temas).
    const perSeat = Math.max(1, ...[1, 2].map(seat => scenes.filter(s => s.seat === seat && s.kind === 'melee').length));
    for (let k = perSeat - 1; k >= 1; k--) {
      const capped = capScenes(scenes, k);
      if (totalOf(capped) <= maxMs) { scenes = capped; break; }
    }
  }
  if (totalOf(scenes) > maxMs) {
    // Son çare (koltuk başına tek yaklaşmada bile sığmıyorsa): sığan sahneler sırayla kalır; kalan q/e vuruşları koltuk
    // başına TEK toplu sahnede, o koltuğun ilk kesilen sahnesinin YERİNDE toplanır (sıra korunur; ulti kendi yerinde).
    // İlk sahne bile sığmıyorsa o da toplanır (eski "en az bir sahne" kuralı sınırı aşıyordu: 8 vuruş → 20,7 sn).
    const base = capScenes(scenes, 1);
    const kept = [], folds = new Map();
    let cut = false;
    base.forEach((s, idx) => {
      if (!cut) {
        const reserve = [], seen = new Set();
        for (const x of base.slice(idx + 1)) {
          if (x.kind === 'ult') reserve.push(x);
          else if (!seen.has(x.seat)) { seen.add(x.seat); reserve.push({seat: x.seat, kind: 'fold', items: []}); }
        }
        if (totalOf([...kept, s, ...reserve]) <= maxMs) { kept.push(s); return; }
        cut = true;
      }
      if (s.kind === 'ult') { kept.push(s); return; }
      const f = folds.get(s.seat);
      if (f) f.items.push(...s.items);
      else { const nf = {seat: s.seat, kind: 'fold', items: [...s.items]}; folds.set(s.seat, nf); kept.push(nf); }
    });
    scenes = kept;
  }
  const slots = new Map();
  let t = RESOLVE_SCENE.leadMs;
  scenes.forEach((s, i) => {
    if (i > 0) t += s.seat === scenes[i - 1].seat ? RESOLVE_SCENE.sameSeatMs : RESOLVE_SCENE.turnMs;
    s.startMs = t;
    s.durationMs = sceneMs(s);
    // fold: toplu sahnenin ilk dışı vuruşları ya da yakın sahnede zincir sınırını aşan q/e (son temasa katlanır).
    let strikes = 0;
    s.items.forEach((a, slot) => {
      const extra = s.kind === 'melee' && !isAssist(a) && ++strikes > RESOLVE_SCENE.maxChain;
      slots.set(a, {scene: i, slot, startMs: t, fold: (s.kind === 'fold' && slot > 0) || extra});
    });
    t += s.durationMs;
  });
  return {scenes, slots, totalMs: scenes.length ? t + RESOLVE_SCENE.tailMs : 0};
}

/** Saf: çözüm fazının süresi (ms) — sunucu = istemci. */
export function resolveDurationMs(ordered, opts) {
  return planResolve(ordered, opts).totalMs;
}
