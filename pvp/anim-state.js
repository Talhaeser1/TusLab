// Şerit G: saf animasyon durum makinesi (three.js/DOM bağımsız). fighters3d.js rig.play() karar verir.
// Öncelik: knockdown/defeat > victory > hit > block > attack > idle. Victory/defeat sonrası klip kilitlenir.

/** Mantıksal durum adı → durum türü. */
export const ANIM_KIND = Object.freeze({
  idle: 'idle', q: 'attack', e: 'attack', r: 'attack',
  hit: 'hit', block: 'block', blockHit: 'block',
  walkBack: 'return',   // Görev 4: kombo sonu eve dönüş yürüyüşü
  ko: 'knockdown', defeat: 'knockdown', win: 'victory', victory: 'victory',
});

export const ANIM_PRIORITY = Object.freeze({idle: 0, attack: 1, return: 1, block: 2, hit: 3, victory: 4, knockdown: 5});

/** Crossfade süreleri (ms). */
export const FADE_MS = Object.freeze({
  idleToAttack: 100, attackToIdle: 180, toHit: 50, toBlock: 60, toKnockdown: 40, toVictory: 250,
  attackCut: 80,      // temas geçtikten sonra yeni saldırıya kısa kesin geçiş (<= 0.08 s)
  toIdle: 180,
  toReturn: 140,      // Görev 4: son vuruştan eve dönüş yürüyüşüne geçiş
});

/** Vuruş durması (ms): hafif 50, ağır 90, ulti 120. */
export const HITSTOP_MS = Object.freeze({light: 50, heavy: 90, ulti: 120});

export const MAX_ATTACK_QUEUE = 1;

/** Şerit H: saldırı klibi hız sınırı (1 doğal; görsel kuyruk baskısında en fazla 1,2). */
export const ATTACK_SPEED = Object.freeze({min: 0.8, normal: 1, max: 1.2});
export const clampAttackSpeed = v => Math.min(ATTACK_SPEED.max, Math.max(ATTACK_SPEED.min, Number(v) || ATTACK_SPEED.normal));

const kindOf = name => ANIM_KIND[name] || 'idle';
const isLocked = kind => kind === 'knockdown' || kind === 'victory';

/** from → to için crossfade süresi (ms). */
export function fadeMs(fromName, toName) {
  const from = kindOf(fromName), to = kindOf(toName);
  if (to === 'knockdown') return FADE_MS.toKnockdown;
  if (to === 'victory') return FADE_MS.toVictory;
  if (to === 'hit') return FADE_MS.toHit;
  if (to === 'block') return FADE_MS.toBlock;
  if (to === 'return') return from === 'attack' ? FADE_MS.toReturn : FADE_MS.toIdle;
  if (to === 'idle') return from === 'attack' ? FADE_MS.attackToIdle : FADE_MS.toIdle;
  if (to === 'attack') return from === 'attack' ? FADE_MS.attackCut : FADE_MS.idleToAttack;
  return FADE_MS.idleToAttack;
}

/** Hasar olayı kademesi → hitstop süresi (reduced-motion: 0). */
export function hitstopFor(tier, reduced = false) {
  if (reduced) return 0;
  return tier === 'large' || tier === 'ulti' ? HITSTOP_MS.ulti
    : tier === 'medium' || tier === 'heavy' ? HITSTOP_MS.heavy : HITSTOP_MS.light;
}

export function createAnimState() {
  const s = {name: 'idle', kind: 'idle', elapsedMs: 0, contactMs: 0, queued: null, queuedOpts: null, locked: false};
  const decision = {accept: false, action: 'drop', fade: 0, name: 'idle'};
  const out = (accept, action, fade, name) => {
    decision.accept = accept; decision.action = action; decision.fade = fade; decision.name = name;
    return decision;
  };

  /** Temas karesi geçti mi? (contactMs 0/yok → saldırı başlar başlamaz "geçmiş" sayılmaz). */
  const contactPassed = () => s.kind === 'attack' && s.contactMs > 0 && s.elapsedMs >= s.contactMs - 1;

  /**
   * İstek: dönen nesne yeniden kullanılır (kare başına tahsis yok).
   * action: 'play' | 'queue' | 'drop'. force: kilidi aşar (reset).
   */
  function request(name, {contactMs = 0, force = false} = {}) {
    const kind = kindOf(name);
    if (name === 'idle') {
      if (s.locked && !force) return out(false, 'drop', 0, name);
      return commit(name, kind, 0, FADE_MS.toIdle);
    }
    // Knockdown her şeyi keser: zafer kilidini de aşar; diğer her şey kilitliyken düşer.
    if (s.locked && !force && !(s.kind === 'victory' && kind === 'knockdown')) return out(false, 'drop', 0, name);
    const curP = ANIM_PRIORITY[s.kind], newP = ANIM_PRIORITY[kind];
    if (kind === 'attack' && s.kind === 'attack') {
      if (contactPassed()) return commit(name, kind, contactMs, FADE_MS.attackCut);
      s.queued = name; s.queuedOpts = contactMs; // en fazla 1 kuyruk: yenisi eskinin yerini alır
      return out(true, 'queue', 0, name);
    }
    if (newP < curP) return out(false, 'drop', 0, name);
    return commit(name, kind, contactMs, fadeMs(s.name, name));
  }

  function commit(name, kind, contactMs, fade) {
    s.name = name; s.kind = kind; s.elapsedMs = 0; s.contactMs = contactMs || 0;
    s.queued = null; s.queuedOpts = null;
    s.locked = isLocked(kind);
    return out(true, 'play', fade, name);
  }

  /** Klip bitti: kuyruktaki saldırıyı döndür (yoksa null) ve durumu idle'a çek. */
  function finish() {
    if (s.locked) return null;
    const q = s.queued, qc = s.queuedOpts;
    if (q) { commit(q, 'attack', qc, FADE_MS.idleToAttack); return q; }
    commit('idle', 'idle', 0, FADE_MS.attackToIdle);
    return null;
  }

  function tick(dtMs) { s.elapsedMs += Math.max(0, Number(dtMs) || 0); }
  function reset() { s.name = 'idle'; s.kind = 'idle'; s.elapsedMs = 0; s.contactMs = 0; s.queued = null; s.queuedOpts = null; s.locked = false; }

  return {state: s, request, finish, tick, reset, contactPassed};
}
