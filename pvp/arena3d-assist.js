/**
 * TuşLab PvP / paket 31 — 3B arena: partner desteği (assist) girişi.
 *
 *   const assist = createArena3DAssist(api);   // api = arena3d instance.api
 *   instance.registerPlugin(assist);
 *   instance.handle({type:'ASSIST_CAST', fromSeat, toSeat, partner});
 *
 * ASSIST_CAST geldiğinde partner (diğer karakter) saldıranın arkasından yarı saydam,
 * kendi renginde parlayan bir siluet olarak girer, rakibe atılır, vurur ve geri çekilir
 * (toplam ~700 ms). Tamamen kozmetiktir: HP'ye ve oyun durumuna dokunmaz; hasar
 * sayısı/darbe tepkisi sunucunun DAMAGE_APPLIED olayıyla ayrıca gelir.
 *
 * Performans: koltuk başına TEK düzlem (en fazla 2 geçici çizim çağrısı), yalnız efekt
 * sürerken görünür. Doku çekirdeğin gövde dokusudur (api.rigTexture) — yeniden yüklenmez
 * ve burada dispose EDİLMEZ; geometri ve malzemeler dispose() ile bırakılır.
 * isReduced() açıkken siluet yok, yalnız kısa bir flaş.
 *
 * Paket 32: partnerin 3B modeli yüklüyse (api.createFighterGhost) siluet artık o modelin
 * yarı saydam, partner renginde bir kopyasıdır ve partnerin Q klibini oynatır; model yoksa düzlem.
 */

export const ASSIST_FX = Object.freeze({
  totalMs: 700,
  dashEnd: 0.34,    // 0..dashEnd: arkadan girip rakibe atılır (~240 ms; hasar çözümüyle aynı an)
  strikeEnd: 0.54,  // dashEnd..strikeEnd: vuruş (kısa duruş + öne yüklenme)
  opacity: 0.72,
  flashMs: 90,
});
const TINT = Object.freeze({fire: 0xffb07a, rune: 0x9fd0ff});
const FLASH = Object.freeze({fire: 0xff6a1f, rune: 0x4aa8ff});
/** Rig düzlemi (arena3d.js RIG ile aynı): 2×3, ayak çizgisi v=0.92, göğüs v=0.36. */
const PLANE_W = 2, PLANE_H = 3, FEET_V = 0.92, CHEST_V = 0.36;
const SEATS = [1, 2];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeOutCubic = p => 1 - (1 - p) ** 3;
const easeInOutSine = p => 0.5 - 0.5 * Math.cos(Math.PI * p);
const isSeat = v => v === 1 || v === 2;

export function createArena3DAssist(api) {
  if (!api || !api.THREE || !api.scene) throw new TypeError('arena3d-assist: api.THREE ve api.scene gerekli');
  const {THREE, scene} = api;
  const reduced = () => typeof api.isReduced === 'function' && Boolean(api.isReduced());
  let disposed = false;
  let casts = 0;

  // Ayak çizgisi y=0'da olacak şekilde kaydırılmış tek düzlem geometrisi (iki koltuk paylaşır).
  const geometry = new THREE.PlaneGeometry(PLANE_W, PLANE_H).translate(0, (FEET_V - 0.5) * PLANE_H, 0);
  const slots = new Map(); // seat -> {mesh, material, active, age, toSeat, from, to}

  function slotFor(seat) {
    let slot = slots.get(seat);
    if (slot) return slot;
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, alphaTest: 0.02, side: THREE.DoubleSide,
      depthWrite: false, toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `pvp31-assist-${seat}`;
    mesh.visible = false;
    mesh.renderOrder = 6;
    mesh.frustumCulled = false;
    scene.add(mesh);
    slot = {mesh, material, active: false, age: 0, toSeat: seat === 1 ? 2 : 1,
      from: new THREE.Vector3(), to: new THREE.Vector3(), scale: 1, face: 1};
    slots.set(seat, slot);
    return slot;
  }

  function flashOnly(partner, strength = 0.12) {
    if (typeof api.flash === 'function') api.flash(FLASH[partner] ?? 0xffffff, strength, ASSIST_FX.flashMs);
  }

  /** Paket 32: partner koltuğunun 3B modelinden siluet (koltuk başına önbellekli) ya da null. */
  function ghostFor(slot, partnerSeat, fromSeat, partner) {
    const info = typeof api.fighterModel === 'function' ? api.fighterModel(partnerSeat) : null;
    if (!info || typeof api.createFighterGhost !== 'function') return null;
    if (slot.ghost && slot.ghostId === info.fighterId) return slot.ghost;
    disposeGhost(slot);
    let ghost = null;
    try {
      ghost = api.createFighterGhost(partnerSeat, {color: TINT[partner] ?? 0xffffff, opacity: ASSIST_FX.opacity, asSeat: fromSeat});
    } catch {
      ghost = null;
    }
    if (!ghost?.object) return null;
    ghost.object.visible = false;
    ghost.object.traverse?.(o => { o.renderOrder = 6; });
    scene.add(ghost.object);
    slot.ghost = ghost;
    slot.ghostId = info.fighterId;
    return ghost;
  }
  function disposeGhost(slot) {
    if (!slot.ghost) return;
    try { slot.ghost.dispose(); } catch { /* kozmetik */ }
    scene.remove(slot.ghost.object);
    slot.ghost = null;
    slot.ghostId = null;
  }

  function start(fromSeat, toSeat, partner) {
    casts++;
    if (reduced()) { flashOnly(partner); return; }
    // Partner = diğer karakter: görseli karşı koltuğun modeli ya da gövde dokusudur (ayna çevrilir).
    const partnerSeat = fromSeat === 1 ? 2 : 1;
    const texture = typeof api.rigTexture === 'function' ? api.rigTexture(partnerSeat) : null;
    const hasModel = typeof api.fighterModel === 'function' && Boolean(api.fighterModel(partnerSeat));
    if (!texture && !hasModel) { flashOnly(partner); return; } // dokular henüz yüklenmedi (ya da 2B yedek): yalnız flaş
    const slot = slotFor(fromSeat);
    const ghost = hasModel ? ghostFor(slot, partnerSeat, fromSeat, partner) : null;
    if (!ghost && !texture) { flashOnly(partner); return; }
    slot.useGhost = Boolean(ghost);
    const face = typeof api.facing === 'function' ? api.facing(fromSeat) : (fromSeat === 2 ? -1 : 1);
    const home = (typeof api.seatHome === 'function' ? api.seatHome(fromSeat) : api.seatGround(fromSeat));
    const target = (typeof api.seatHome === 'function' ? api.seatHome(toSeat) : api.seatGround(toSeat));
    const anchor = api.seatAnchor(fromSeat), ground = api.seatGround(fromSeat);
    const chestH = Math.max(0.2, anchor.y - ground.y);
    const scale = chestH / ((FEET_V - CHEST_V) * PLANE_H);
    const reach = Math.abs(target.x - home.x) || 5 * scale;
    // Saldıranın arkasından başlar; rakibin bir adım önünde durur.
    slot.from.set(home.x - face * reach * 0.34, 0, home.z + 0.22 * scale);
    slot.to.set(target.x - face * reach * 0.2, 0, target.z + 0.22 * scale);
    slot.scale = scale * 0.94; slot.face = face;
    slot.toSeat = toSeat; slot.partner = partner;
    slot.age = 0; slot.active = true; slot.struck = false;
    if (ghost) {
      slot.mesh.visible = false;
      ghost.play('q');
      place(slot, 0);
      ghost.object.visible = true;
      return;
    }
    slot.material.map = texture;
    slot.material.color.setHex(TINT[partner] ?? 0xffffff);
    slot.material.needsUpdate = true;
    slot.mesh.rotation.set(0, face * 0.2, 0);
    place(slot, 0);
    slot.mesh.visible = true;
  }

  /** p = 0..1 ilerleme: konum, ölçek, eğim ve saydamlık. */
  function place(slot, p) {
    const {dashEnd, strikeEnd, opacity} = ASSIST_FX;
    let k, alpha, lean = 0, lift = 0;
    if (p < dashEnd) {
      const q = p / dashEnd;
      k = easeOutCubic(q);
      alpha = Math.min(1, q * 3);
      lean = 0.22 * (1 - q);
      lift = Math.sin(q * Math.PI) * 0.12;
    } else if (p < strikeEnd) {
      const q = (p - dashEnd) / (strikeEnd - dashEnd);
      k = 1 + 0.06 * Math.sin(q * Math.PI); // vuruşta kısa öne yüklenme
      alpha = 1;
      lean = -0.16 * Math.sin(q * Math.PI);
    } else {
      const q = (p - strikeEnd) / (1 - strikeEnd);
      k = 1 - easeInOutSine(q);
      alpha = 1 - q * q;
      lean = 0.12 * q;
      lift = Math.sin(q * Math.PI) * 0.08;
    }
    const s = slot.scale;
    if (slot.useGhost && slot.ghost) {
      const g = slot.ghost.object;
      g.position.set(slot.from.x + (slot.to.x - slot.from.x) * k, lift * s, slot.from.z + (slot.to.z - slot.from.z) * k);
      g.scale.setScalar(s);
      g.rotation.z = -slot.face * lean;
      slot.ghost.setOpacity(clamp(alpha, 0, 1) * opacity);
      slot.material.opacity = clamp(alpha, 0, 1) * opacity; // stats() için
      return;
    }
    slot.mesh.position.set(
      slot.from.x + (slot.to.x - slot.from.x) * k,
      lift * s,
      slot.from.z + (slot.to.z - slot.from.z) * k,
    );
    // Karşı koltuğun dokusu ters yöne bakar: x ölçeği eksi → saldıranın yönüne döner.
    slot.mesh.scale.set(-s, s, s);
    slot.mesh.rotation.z = -slot.face * lean;
    slot.material.opacity = clamp(alpha, 0, 1) * opacity;
  }

  function handle(event) {
    if (disposed || !event || typeof event !== 'object') return;
    if (event.type !== 'ASSIST_CAST' || !isSeat(event.fromSeat)) return;
    const toSeat = isSeat(event.toSeat) ? event.toSeat : (event.fromSeat === 1 ? 2 : 1);
    const partner = event.partner === 'fire' || event.partner === 'rune' ? event.partner : (event.fromSeat === 1 ? 'rune' : 'fire');
    start(event.fromSeat, toSeat, partner);
  }

  function update(dt) {
    if (disposed) return;
    let step = Number(dt);
    if (!Number.isFinite(step) || step <= 0) return;
    if (step > 2) step /= 1000;
    step = Math.min(step, 0.05);
    for (const slot of slots.values()) {
      if (!slot.active) continue;
      if (reduced()) { stop(slot); continue; }
      slot.age += step * 1000;
      const p = slot.age / ASSIST_FX.totalMs;
      if (p >= 1) { stop(slot); continue; }
      if (!slot.struck && p >= ASSIST_FX.dashEnd) {
        slot.struck = true;
        flashOnly(slot.partner, 0.16);
      }
      if (slot.useGhost && slot.ghost) slot.ghost.update(step);
      place(slot, p);
    }
  }

  function stop(slot) {
    slot.active = false;
    slot.mesh.visible = false;
    slot.material.opacity = 0;
    if (slot.ghost) slot.ghost.object.visible = false;
  }

  function clear() {
    for (const slot of slots.values()) stop(slot);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const slot of slots.values()) {
      disposeGhost(slot);
      scene.remove(slot.mesh);
      slot.material.map = null; // doku çekirdeğe ait: yalnız bağlantı kesilir
      slot.material.dispose();
    }
    slots.clear();
    geometry.dispose();
  }

  /** Test/debug: koltuk başına durum + toplam sayılar. */
  function stats() {
    const out = {casts, meshes: slots.size, active: 0, disposed, seats: {}};
    for (const seat of SEATS) {
      const slot = slots.get(seat);
      if (!slot) continue;
      if (slot.active) out.active++;
      out.seats[seat] = {active: slot.active, visible: slot.mesh.visible || Boolean(slot.ghost?.object.visible),
        ghost: Boolean(slot.useGhost && slot.ghost), opacity: slot.material.opacity,
        x: slot.mesh.position.x, progress: clamp(slot.age / ASSIST_FX.totalMs, 0, 1)};
    }
    return out;
  }

  return {handle, update, clear, dispose, stats};
}
