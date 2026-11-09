/**
 * TuşLab PvP / paket 28 — 3B arena: karakterlerin başı üstünde can barı.
 *
 *   const bars = createArena3DHpBars(api);   // api = arena3d instance.api
 *   instance.registerPlugin(bars);
 *   instance.handle({type:'HP_SYNC', players:[{seat, hp, maxHp, shield}]});
 *
 * Yan paneldeki HP barı zaten karakterin hemen üstünde durur; bu bar yalnız karakter
 * kendi yerinden uzaklaştığında (ultimate çekme/fırlatma) yumuşakça belirir, böylece
 * can bilgisi uçan karakterle birlikte gider ve panelin arkasında kalmaz.
 * Her koltuk için kameraya dönük (billboard) dört katmanlı bir bar çizer:
 *   arka plan · "hayalet" iz (yenen hasar, gecikmeyle erir) · dolgu · kalkan şeridi.
 * Değerler YALNIZ sunucudan gelen HP_SYNC ve DAMAGE_APPLIED.hpAfter ile değişir;
 * bu modül HP hesaplamaz. Düşük canda (<%30) dolgu kırmızıya döner ve nabız atar;
 * isabette bar kısa bir sarsıntı yapar. isReduced() açıkken animasyonsuz çalışır.
 */

export const HPBAR_TIMING = Object.freeze({
  ghostDelayMs: 260,   // hayalet iz bu kadar bekler, sonra erir
  ghostRate: 0.9,      // saniyede erime (oran birimi, 1 = tam bar)
  fillRate: 6,         // dolgunun hedefe yaklaşma hızı (üstel)
  shakeMs: 240,
});
export const LOW_HP_RATIO = 0.3;

const PALETTE = Object.freeze({
  1: Object.freeze({fill: 0xff6a3d, ghost: 0xffe2a4, edge: 0xffb27a}),
  2: Object.freeze({fill: 0x36b1e4, ghost: 0xc4f0ff, edge: 0x8fdcff}),
});
const LOW_FILL = 0xf03a5c;
const SHIELD = 0x9fe9ff;
const BACK = 0x14091f;

/** Crown height relative to chest height (from RIG: (0.92-0.03)/(0.92-0.36)). */
const CROWN_PER_CHEST = 0.89 / 0.56;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const SEATS = [1, 2];
/** Fade-in band, in chest heights of ultimate travel away from the seat (lunges never travel). */
const SHOW_FROM = 0.12;
const SHOW_FULL = 0.4;

export function createArena3DHpBars(api) {
  if (!api || !api.THREE || !api.scene) throw new TypeError('arena3d-hpbars: api.THREE ve api.scene gerekli');
  const {THREE, scene, camera} = api;
  const reduced = () => typeof api.isReduced === 'function' && Boolean(api.isReduced());
  // Frame clock (ms) advanced by update(dt): pauses with the render loop, deterministic in tests.
  let clockMs = 0;
  const nowMs = () => clockMs;

  const geometries = new Set();
  const materials = new Set();
  // Unit quad anchored at its LEFT edge so scale.x shrinks it toward the left.
  const quadLeft = new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0);
  const quadCenter = new THREE.PlaneGeometry(1, 1);
  geometries.add(quadLeft);
  geometries.add(quadCenter);

  const basic = (color, opacity = 1) => {
    const m = new THREE.MeshBasicMaterial({color, transparent: true, opacity, depthTest: false, depthWrite: false, toneMapped: false});
    m.userData.baseOpacity = opacity;
    materials.add(m);
    return m;
  };

  function buildBar(seat) {
    const palette = PALETTE[seat];
    const group = new THREE.Group();
    group.name = `pvp28-hpbar-${seat}`;
    group.visible = false;
    group.renderOrder = 50;
    const layer = (geometry, material, order, z) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = 50 + order;
      mesh.position.z = z;
      mesh.frustumCulled = false;
      group.add(mesh);
      return mesh;
    };
    const frame = layer(quadCenter, basic(palette.edge, 0.85), 0, -0.002);
    const back = layer(quadCenter, basic(BACK, 0.92), 1, -0.001);
    const ghost = layer(quadLeft, basic(palette.ghost, 0.95), 2, 0);
    const fill = layer(quadLeft, basic(palette.fill, 1), 3, 0.001);
    const shine = layer(quadLeft, basic(0xffffff, 0.22), 4, 0.002);
    const shield = layer(quadCenter, basic(SHIELD, 0.9), 5, 0.003);
    shield.visible = false;
    scene.add(group);
    return {
      seat, palette, group, frame, back, ghost, fill, shine, shield,
      known: false, alpha: 0, target: 1, shown: 1, ghostRatio: 1, ghostHoldUntil: 0,
      shieldOn: false, shakeStart: -1e9, shakeAmp: 0, maxHp: 0,
    };
  }

  const bars = new Map(SEATS.map(seat => [seat, buildBar(seat)]));
  const tmp = new THREE.Vector3();
  const ground = new THREE.Vector3();

  function setHp(seat, hp, maxHp) {
    const bar = bars.get(seat);
    const max = Number(maxHp) > 0 ? Number(maxHp) : bar?.maxHp;
    if (!bar || !(max > 0) || !Number.isFinite(Number(hp))) return;
    const ratio = clamp(Number(hp) / max, 0, 1);
    bar.maxHp = max;
    if (!bar.known) {
      bar.known = true;
      bar.target = bar.shown = bar.ghostRatio = ratio;
      return;
    }
    if (ratio < bar.target - 1e-4) {
      // Damage: the ghost holds at the old value, then drains.
      bar.ghostRatio = Math.max(bar.ghostRatio, bar.shown);
      bar.ghostHoldUntil = nowMs() + HPBAR_TIMING.ghostDelayMs;
      bar.shakeStart = nowMs();
      bar.shakeAmp = clamp((bar.target - ratio) * 6, 0.25, 1);
    }
    bar.target = ratio;
    if (reduced()) bar.shown = ratio;
  }

  function handle(event) {
    if (!event || typeof event !== 'object') return;
    if (event.type === 'HP_SYNC' && Array.isArray(event.players)) {
      for (const p of event.players) {
        if (!p || !bars.has(p.seat)) continue;
        setHp(p.seat, p.hp, p.maxHp);
        const bar = bars.get(p.seat);
        bar.shieldOn = Boolean(p.shield);
      }
    } else if (event.type === 'DAMAGE_APPLIED' && bars.has(event.toSeat) && Number.isFinite(Number(event.hpAfter))) {
      setHp(event.toSeat, event.hpAfter, event.maxHp);
    } else if (event.type === 'SHIELD_BROKEN' && bars.has(event.seat)) {
      bars.get(event.seat).shieldOn = false;
    }
  }

  function update(dt, t) {
    const quiet = reduced();
    clockMs += Math.max(0, Number(dt) || 0) * 1000;
    const tNow = nowMs();
    for (const bar of bars.values()) {
      if (!bar.known) continue;
      // Size and position from the fighter's own scale (chest height → crown).
      const anchor = api.seatAnchor(bar.seat);
      ground.copy(api.seatGround(bar.seat));
      const chestH = Math.max(0.2, anchor.y - ground.y);
      const width = chestH * 0.95;
      const height = width * 0.085;
      tmp.set(anchor.x, ground.y + chestH * CROWN_PER_CHEST + height * 2.4, anchor.z);
      const away = (typeof api.travelOffset === 'function' ? Number(api.travelOffset(bar.seat)) || 0 : 0) / chestH;
      const want = clamp((away - SHOW_FROM) / (SHOW_FULL - SHOW_FROM), 0, 1);
      bar.alpha = quiet ? want : bar.alpha + (want - bar.alpha) * (1 - Math.exp(-14 * dt));
      bar.group.visible = bar.alpha > 0.01;

      // Fill eases to the target; the ghost waits, then drains to the fill.
      if (quiet) bar.shown = bar.target;
      else bar.shown += (bar.target - bar.shown) * (1 - Math.exp(-HPBAR_TIMING.fillRate * dt));
      if (quiet) bar.ghostRatio = bar.shown;
      else if (tNow >= bar.ghostHoldUntil) bar.ghostRatio = Math.max(bar.shown, bar.ghostRatio - HPBAR_TIMING.ghostRate * dt);
      if (bar.ghostRatio < bar.shown) bar.ghostRatio = bar.shown;

      // Hit shake (horizontal jitter, decays).
      const sp = (tNow - bar.shakeStart) / HPBAR_TIMING.shakeMs;
      if (!quiet && sp >= 0 && sp < 1) tmp.x += Math.sin(tNow * 0.09) * width * 0.025 * bar.shakeAmp * (1 - sp) * (1 - sp);

      bar.group.position.copy(tmp);
      if (camera) bar.group.quaternion.copy(camera.quaternion);

      const left = -width / 2;
      bar.frame.scale.set(width + height * 0.5, height * 1.5, 1);
      bar.back.scale.set(width, height, 1);
      for (const [mesh, ratio, h] of [[bar.ghost, bar.ghostRatio, height], [bar.fill, bar.shown, height], [bar.shine, bar.shown, height * 0.35]]) {
        mesh.visible = ratio > 0.0005;
        mesh.scale.set(Math.max(1e-4, width * ratio), h, 1);
        mesh.position.x = left;
      }
      bar.shine.position.y = height * 0.25;

      const low = bar.target < LOW_HP_RATIO && bar.target > 0;
      bar.fill.material.color.setHex(low ? LOW_FILL : bar.palette.fill);
      bar.fill.material.userData.baseOpacity = low && !quiet ? 0.78 + 0.22 * Math.sin(t * 9) : 1;
      bar.frame.material.color.setHex(low ? LOW_FILL : bar.palette.edge);

      bar.shield.visible = bar.shieldOn;
      if (bar.shieldOn) {
        bar.shield.scale.set(width, height * 0.3, 1);
        bar.shield.position.y = height * 0.95;
        bar.shield.material.userData.baseOpacity = quiet ? 0.9 : 0.65 + 0.3 * Math.sin(t * 6);
      }
      for (const mesh of [bar.frame, bar.back, bar.ghost, bar.fill, bar.shine, bar.shield]) {
        mesh.material.opacity = mesh.material.userData.baseOpacity * bar.alpha;
      }
    }
  }

  function clear() {
    for (const bar of bars.values()) {
      bar.known = false;
      bar.alpha = 0;
      bar.group.visible = false;
      bar.shieldOn = false;
      bar.target = bar.shown = bar.ghostRatio = 1;
      bar.shakeStart = -1e9;
    }
  }

  function dispose() {
    for (const bar of bars.values()) scene.remove(bar.group);
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    bars.clear();
  }

  /** Test/debug view of each bar. */
  function stats() {
    return Object.fromEntries([...bars.values()].map(b => [b.seat, {
      known: b.known, visible: b.group.visible, alpha: b.alpha, target: b.target, shown: b.shown, ghost: b.ghostRatio, shield: b.shieldOn,
      low: b.target < LOW_HP_RATIO && b.target > 0,
    }]));
  }

  return {handle, update, clear, dispose, stats};
}
