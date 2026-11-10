#!/usr/bin/env node
/**
 * TuşLab PvP / paket 32 — karakter GLB optimizasyonu (bağımlılıksız).
 *
 *   node scripts/optimize-characters.mjs            # assets/characters-src → assets/characters
 *   node scripts/optimize-characters.mjs --check    # yalnız boyutları raporla
 *
 * Kaynak: assets/characters-src/{Barbarian,Knight,Mage,Rogue}.glb (KayKit Adventurers 1.0, CC0).
 * Her savaşçı için:
 *   1. Yalnız gereken ~14 animasyon klibi kalır (76 → ~14); sabit ölçek kanalları atılır,
 *      sabit kanallar tek anahtara iner, doğrusal ara anahtarlar (tolerans içinde) silinir.
 *   2. Kullanılmayan silah/aksesuar mesh'leri (ör. Knight'ın 4 kalkanından 3'ü) sökülür.
 *   3. Renk atlası 512² boyutuna küçültülür ve savaşçının paletine göre yeniden tonlanır
 *      (vargr kızıl-turuncu, sira mor-gölge, doran çelik-mavi, nyx rün-camgöbeği):
 *      doygun "vurgu" pikselleri hedef tona döner, griler hafifçe renk alır, ten/deri tonları korunur.
 *   4. Kullanılmayan accessor/bufferView'ler atılır, ikili tampon yeniden paketlenir.
 * Çıktı: assets/characters/<fighterId>.glb (hedef ≤ 1 200 000 bayt).
 *
 * npm kayıt defterine erişim olmadığından @gltf-transform yerine küçük, yerleşik bir GLB
 * okuyucu/yazıcı ve PNG çözücü/kodlayıcı (node:zlib) kullanılır.
 */
import {readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync} from 'node:fs';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inflateSync, deflateSync} from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets', 'characters-src');
const OUT = join(ROOT, 'assets', 'characters');
export const MAX_BYTES = 1_200_000;

/** Ortak klipler (her savaşçı): bekleme, isabet, savunma, KO, zafer, kaçış, zıplama. */
export const COMMON_CLIPS = Object.freeze([
  'Idle', '2H_Melee_Idle', 'Hit_A', 'Hit_B', 'Block', 'Blocking', 'Block_Hit',
  'Death_A', 'Cheer', 'Dodge_Forward', 'Dodge_Backward', 'Jump_Start', 'Jump_Land',
]);

/**
 * Savaşçı başına kaynak, beceri klipleri, tutulacak mesh'ler ve palet tonu (derece).
 * keepMeshes: iskelete bağlı olmayan (silah/aksesuar) mesh düğümlerinden KALANLAR.
 */
export const CHARACTER_BUILDS = Object.freeze({
  vargr: {
    source: 'Barbarian', hue: 14, neutralTint: 0.10,
    clips: ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Spin', '2H_Melee_Attack_Spinning'],
    keepMeshes: ['2H_Axe', 'Barbarian_Hat', 'Barbarian_Cape'],
  },
  sira: {
    source: 'Rogue', hue: 278, neutralTint: 0.14,
    clips: ['Throw', 'Dualwield_Melee_Attack_Stab', 'Dodge_Left'],
    keepMeshes: ['Knife', 'Knife_Offhand', 'Rogue_Cape'],
  },
  doran: {
    source: 'Knight', hue: 212, neutralTint: 0.12,
    clips: ['1H_Melee_Attack_Chop', 'Block_Attack', '1H_Melee_Attack_Slice_Horizontal'],
    keepMeshes: ['1H_Sword', 'Round_Shield', 'Knight_Helmet', 'Knight_Cape'],
  },
  nyx: {
    source: 'Mage', hue: 186, neutralTint: 0.12,
    clips: ['Spellcast_Shoot', 'Spellcast_Raise', 'Spellcast_Long'],
    keepMeshes: ['2H_Staff', 'Mage_Hat', 'Mage_Cape'],
  },
});

// ------------------------------------------------------------------ GLB I/O

export function readGlb(buffer) {
  if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error('GLB değil');
  const jsonLen = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLen).toString('utf8'));
  const binHeader = 20 + jsonLen;
  const binLen = buffer.readUInt32LE(binHeader);
  const bin = buffer.subarray(binHeader + 8, binHeader + 8 + binLen);
  return {json, bin};
}

export function writeGlb(json, bin) {
  const pad = (b, fill) => {
    const extra = (4 - (b.length % 4)) % 4;
    return extra ? Buffer.concat([b, Buffer.alloc(extra, fill)]) : b;
  };
  const jsonBuf = pad(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
  const binBuf = pad(bin, 0);
  const total = 12 + 8 + jsonBuf.length + 8 + binBuf.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(jsonBuf.length, 0);
  jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(binBuf.length, 0);
  bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jh, jsonBuf, bh, binBuf]);
}

const COMPONENTS = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16};

/** Float32 accessor → Float32Array (sıkı paket ya da byteStride'lı). */
function readFloatAccessor(json, bin, index) {
  const acc = json.accessors[index];
  if (acc.componentType !== 5126) throw new Error('yalnız float accessor okunur');
  const view = json.bufferViews[acc.bufferView];
  const n = COMPONENTS[acc.type];
  const stride = view.byteStride || n * 4;
  const base = (view.byteOffset || 0) + (acc.byteOffset || 0);
  const out = new Float32Array(acc.count * n);
  for (let i = 0; i < acc.count; i++) {
    for (let c = 0; c < n; c++) out[i * n + c] = bin.readFloatLE(base + i * stride + c * 4);
  }
  return out;
}

// --------------------------------------------------------- keyframe reduction

const lerp = (a, b, k) => a + (b - a) * k;

/**
 * Doğrusal (LINEAR) örnekleyici için ara anahtar azaltma: komşu tutulan anahtarlardan
 * doğrusal enterpolasyonla tolerans içinde üretilebilen anahtarlar silinir.
 * Sabit kanal → tek anahtar.
 */
export function reduceKeys(times, values, n, tolerance) {
  const count = times.length;
  const same = (i, j) => {
    for (let c = 0; c < n; c++) if (Math.abs(values[i * n + c] - values[j * n + c]) > tolerance) return false;
    return true;
  };
  let constant = true;
  for (let i = 1; i < count && constant; i++) constant = same(0, i);
  if (constant) return {times: Float32Array.of(times[0]), values: values.slice(0, n)};
  const keep = [0];
  for (let i = 1; i < count - 1; i++) {
    const prev = keep[keep.length - 1];
    const next = i + 1;
    // i'yi atarsak prev..next arası doğrusal: prev ile next arasındaki her anahtar (prev+1..i) toleransta mı?
    let ok = true;
    for (let k = prev + 1; k <= i && ok; k++) {
      const u = (times[k] - times[prev]) / Math.max(1e-9, times[next] - times[prev]);
      for (let c = 0; c < n; c++) {
        const guess = lerp(values[prev * n + c], values[next * n + c], u);
        if (Math.abs(guess - values[k * n + c]) > tolerance) { ok = false; break; }
      }
    }
    if (!ok) keep.push(i);
  }
  keep.push(count - 1);
  const t = new Float32Array(keep.length);
  const v = new Float32Array(keep.length * n);
  keep.forEach((src, i) => {
    t[i] = times[src];
    for (let c = 0; c < n; c++) v[i * n + c] = values[src * n + c];
  });
  return {times: t, values: v};
}

// ---------------------------------------------------------------- PNG + tint

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** 8 bit RGB/RGBA, taramasız PNG → {width, height, data: RGBA}. */
export function decodePng(buf) {
  let pos = 8;
  let width = 0, height = 0, ctype = 0, depth = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; ctype = data[9];
      if (depth !== 8 || data[12] !== 0 || (ctype !== 6 && ctype !== 2)) throw new Error('desteklenmeyen PNG');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const bpp = ctype === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = Buffer.alloc(width * height * 4);
  const prev = Buffer.alloc(stride);
  const cur = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    raw.copy(cur, 0, y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = cur[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      out[o] = cur[x * bpp]; out[o + 1] = cur[x * bpp + 1]; out[o + 2] = cur[x * bpp + 2];
      out[o + 3] = bpp === 4 ? cur[x * bpp + 3] : 255;
    }
    cur.copy(prev);
  }
  return {width, height, data: out};
}

/** RGB (alfa yok: atlas tamamen opak) PNG kodla; satır filtresi "Sub". */
export function encodePng({width, height, data}) {
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 1; // Sub
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 3; c++) {
        const v = data[(y * width + x) * 4 + c];
        const left = x > 0 ? data[(y * width + x - 1) * 4 + c] : 0;
        raw[y * (stride + 1) + 1 + x * 3 + c] = (v - left) & 255;
      }
    }
  }
  const chunk = (type, body) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const tb = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(tb));
    return Buffer.concat([len, tb, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, {level: 9})), chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Kutu filtresiyle tam sayı oranında küçültme. */
export function downscale(img, size) {
  const f = Math.max(1, Math.round(img.width / size));
  const w = Math.floor(img.width / f), h = Math.floor(img.height / f);
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const acc = [0, 0, 0, 0];
    for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) {
      const o = ((y * f + dy) * img.width + (x * f + dx)) * 4;
      for (let c = 0; c < 4; c++) acc[c] += img.data[o + c];
    }
    for (let c = 0; c < 4; c++) out[(y * w + x) * 4 + c] = Math.round(acc[c] / (f * f));
  }
  return {width: w, height: h, data: out};
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const conv = t => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [conv(h + 1 / 3) * 255, conv(h) * 255, conv(h - 1 / 3) * 255];
}

/**
 * Palet tonlaması, renk HÜCRESİ başına (KayKit atlası 8×4 dikey degrade hücresidir):
 * hücrenin ortalama tonu/doygunluğu sınıflandırılır, böylece bir degrade parçalanmaz.
 *   - vurgu hücresi (doygunluk ≥ 0.32, ten/deri/altın 16°–52° dışı): tüm pikseller hedef
 *     tona kaydırılır (hücre içi ton farkı korunur)
 *   - nötr hücre (doygunluk < 0.22: metal, gri kumaş): hedef tondan hafif renk alır
 *   - diğerleri (ten, deri, saç, altın): değişmez
 */
export function classifyCell(meanHue, meanSat) {
  const skinLike = meanHue >= 16 && meanHue <= 52;
  if (meanSat >= 0.32 && !skinLike) return 'accent';
  if (meanSat < 0.22) return 'neutral';
  return 'keep';
}

export function tintImage(img, {hue, neutralTint}, {cols = 8, rows = 4} = {}) {
  const data = Buffer.from(img.data);
  const cw = Math.floor(img.width / cols), chh = Math.floor(img.height / rows);
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    let sx = 0, sy = 0, ss = 0, n = 0;
    const px = [];
    for (let y = cy * chh; y < (cy + 1) * chh; y++) for (let x = cx * cw; x < (cx + 1) * cw; x++) {
      const o = (y * img.width + x) * 4;
      const hsl = rgbToHsl(data[o], data[o + 1], data[o + 2]);
      px.push([o, hsl]);
      const w = hsl[1];
      sx += Math.cos(hsl[0] * Math.PI / 180) * w; sy += Math.sin(hsl[0] * Math.PI / 180) * w;
      ss += hsl[1]; n++;
    }
    const meanHue = ((Math.atan2(sy, sx) * 180 / Math.PI) + 360) % 360;
    const meanSat = ss / Math.max(1, n);
    const kind = classifyCell(meanHue, meanSat);
    if (kind === 'keep') continue;
    for (const [o, [h, s, l]] of px) {
      let rgb;
      if (kind === 'accent') rgb = hslToRgb(h + (hue - meanHue), Math.min(1, s * 1.05), l);
      else rgb = hslToRgb(hue, Math.min(1, s + neutralTint * (1 - Math.abs(2 * l - 1))), l);
      data[o] = Math.round(rgb[0]); data[o + 1] = Math.round(rgb[1]); data[o + 2] = Math.round(rgb[2]);
    }
  }
  return {...img, data};
}

// ------------------------------------------------------------------ optimize

/**
 * Bir kaynak GLB'den savaşçı GLB'si üret. Döner: {glb: Buffer, stats}.
 */
export function optimizeCharacter(sourceBuffer, fighterId, build, {textureSize = 512} = {}) {
  const {json: src, bin} = readGlb(sourceBuffer);
  const json = JSON.parse(JSON.stringify(src));
  const wanted = new Set([...COMMON_CLIPS, ...build.clips]);

  // --- 1. Aksesuar mesh'lerini sök (iskeletsiz mesh düğümleri; tutulanlar hariç).
  const keepMesh = new Set(build.keepMeshes);
  const removedNodes = new Set();
  json.nodes.forEach((node, i) => {
    if (node.mesh !== undefined && node.skin === undefined && !keepMesh.has(node.name)) {
      removedNodes.add(i);
    }
  });
  for (const node of json.nodes) {
    if (node.children) node.children = node.children.filter(c => !removedNodes.has(c));
    if (node.children && !node.children.length) delete node.children;
  }
  for (const i of removedNodes) {
    delete json.nodes[i].mesh;
    json.nodes[i].name = `${json.nodes[i].name}__removed`;
  }

  // --- 2. Animasyonlar: seç, kanal azalt.
  const scaleConstant = new Map(); // node → tüm kliplerde ölçek 1 mi
  const newAnimData = []; // {name, channels:[{node, path, times, values, n}]}
  const missing = [...wanted].filter(name => !src.animations.some(a => a.name === name));
  if (missing.length) throw new Error(`${fighterId}: kaynakta eksik klip ${missing.join(', ')}`);
  for (const anim of src.animations) {
    if (!wanted.has(anim.name)) continue;
    const channels = [];
    for (const ch of anim.channels) {
      const sampler = anim.samplers[ch.sampler];
      const times = readFloatAccessor(src, bin, sampler.input);
      const values = readFloatAccessor(src, bin, sampler.output);
      const n = COMPONENTS[src.accessors[sampler.output].type];
      const path = ch.target.path;
      if (sampler.interpolation && sampler.interpolation !== 'LINEAR') throw new Error('yalnız LINEAR');
      const tol = path === 'rotation' ? 4e-4 : path === 'translation' ? 4e-4 : 1e-3;
      const reduced = reduceKeys(times, values, n, tol);
      if (path === 'scale') {
        let one = true;
        for (const v of values) if (Math.abs(v - 1) > 1e-3) { one = false; break; }
        const prev = scaleConstant.get(ch.target.node);
        scaleConstant.set(ch.target.node, (prev ?? true) && one);
      }
      channels.push({node: ch.target.node, path, n, ...reduced});
    }
    newAnimData.push({name: anim.name, channels});
  }

  // --- 3. Yeni ikili tampon: mesh/skin accessor'ları kopyala, animasyon + doku yeniden yaz.
  const chunks = [];
  let offset = 0;
  const newViews = [];
  const newAccessors = [];
  const pushView = (buffer, extra = {}) => {
    const pad = (4 - (offset % 4)) % 4;
    if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
    newViews.push({buffer: 0, byteOffset: offset, byteLength: buffer.length, ...extra});
    chunks.push(buffer);
    offset += buffer.length;
    return newViews.length - 1;
  };
  const viewMap = new Map();
  const accessorMap = new Map();
  const copyAccessor = index => {
    if (accessorMap.has(index)) return accessorMap.get(index);
    const acc = {...src.accessors[index]};
    if (acc.bufferView !== undefined) {
      if (!viewMap.has(acc.bufferView)) {
        const v = src.bufferViews[acc.bufferView];
        const data = bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
        const extra = {};
        if (v.byteStride) extra.byteStride = v.byteStride;
        if (v.target) extra.target = v.target;
        viewMap.set(acc.bufferView, pushView(Buffer.from(data), extra));
      }
      acc.bufferView = viewMap.get(acc.bufferView);
    }
    newAccessors.push(acc);
    accessorMap.set(index, newAccessors.length - 1);
    return newAccessors.length - 1;
  };

  // Mesh'ler: yalnız düğümlerin hâlâ başvurduğu mesh'ler, yeniden numaralanır.
  const usedMeshes = [...new Set(json.nodes.filter(n => n.mesh !== undefined).map(n => n.mesh))].sort((a, b) => a - b);
  const meshMap = new Map(usedMeshes.map((m, i) => [m, i]));
  json.meshes = usedMeshes.map(m => {
    const mesh = JSON.parse(JSON.stringify(src.meshes[m]));
    for (const prim of mesh.primitives) {
      for (const key of Object.keys(prim.attributes)) prim.attributes[key] = copyAccessor(prim.attributes[key]);
      if (prim.indices !== undefined) prim.indices = copyAccessor(prim.indices);
      if (prim.targets) prim.targets = prim.targets.map(t => Object.fromEntries(Object.entries(t).map(([k, a]) => [k, copyAccessor(a)])));
    }
    mesh.name = (mesh.name || '').replace(/^(Barbarian|Knight|Mage|Rogue)/, fighterId);
    return mesh;
  });
  for (const node of json.nodes) if (node.mesh !== undefined) node.mesh = meshMap.get(node.mesh);
  for (const node of json.nodes) if (node.name) node.name = node.name.replace(/^(Barbarian|Knight|Mage|Rogue)_/, `${fighterId}_`);
  for (const skin of json.skins || []) {
    if (skin.inverseBindMatrices !== undefined) skin.inverseBindMatrices = copyAccessor(skin.inverseBindMatrices);
  }

  // Animasyonlar: tüm anahtar verisi TEK bufferView'de (accessor byteOffset ile) → JSON küçülür.
  const animChunks = [];
  let animOffset = 0;
  const animView = newViews.length; // döngü sonunda pushView ile bu sıraya yazılır
  newViews.push(null);
  const floatAccessor = (arr, type, withBounds) => {
    animChunks.push(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength));
    const acc = {bufferView: animView, byteOffset: animOffset, componentType: 5126, count: arr.length / COMPONENTS[type], type};
    animOffset += arr.byteLength;
    if (!acc.byteOffset) delete acc.byteOffset;
    if (withBounds) {
      let min = Infinity, max = -Infinity;
      for (const v of arr) { if (v < min) min = v; if (v > max) max = v; }
      acc.min = [min]; acc.max = [max];
    }
    newAccessors.push(acc);
    return newAccessors.length - 1;
  };
  const typeOf = n => (n === 4 ? 'VEC4' : n === 3 ? 'VEC3' : 'SCALAR');
  let keyCount = 0;
  const inputCache = new Map(); // aynı zaman dizisi tüm kliplerde tek accessor
  json.animations = newAnimData.map(anim => {
    const samplers = [];
    const channels = [];
    // Klip süresi en uzun kanaldan gelir; reduceKeys sabit olmayan kanalların son anahtarını korur.
    for (const ch of anim.channels) {
      if (ch.path === 'scale' && scaleConstant.get(ch.node)) continue;
      if (removedNodes.has(ch.node)) continue;
      const key = Array.from(ch.times).join(',');
      let input = inputCache.get(key);
      if (input === undefined) {
        input = floatAccessor(ch.times, 'SCALAR', true);
        inputCache.set(key, input);
      }
      const output = floatAccessor(ch.values, typeOf(ch.n), false);
      keyCount += ch.times.length;
      samplers.push({input, output}); // varsayılan LINEAR
      channels.push({sampler: samplers.length - 1, target: {node: ch.node, path: ch.path}});
    }
    return {name: anim.name, samplers, channels};
  });
  {
    const pad = (4 - (offset % 4)) % 4;
    if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
    const data = Buffer.concat(animChunks);
    newViews[animView] = {buffer: 0, byteOffset: offset, byteLength: data.length};
    chunks.push(data);
    offset += data.length;
  }

  // Doku: küçült + palet tonla.
  const imgView = src.bufferViews[src.images[0].bufferView];
  const png = bin.subarray(imgView.byteOffset || 0, (imgView.byteOffset || 0) + imgView.byteLength);
  const tinted = tintImage(downscale(decodePng(png), textureSize), build);
  const pngOut = encodePng(tinted);
  const imageView = pushView(pngOut);
  json.images = [{bufferView: imageView, mimeType: 'image/png', name: `${fighterId}_atlas`}];
  json.materials = json.materials.map(m => ({...m, name: `${fighterId}_mat`}));

  json.accessors = newAccessors;
  json.bufferViews = newViews;
  const out = Buffer.concat(chunks);
  json.buffers = [{byteLength: out.length}];
  json.asset = {
    version: '2.0',
    generator: 'TusLab optimize-characters.mjs',
    copyright: 'Model: KayKit Adventurers 1.0 by Kay Lousberg (CC0). Tonlama/kırpma: TuşLab.',
    extras: {fighter: fighterId, source: build.source},
  };
  const glb = writeGlb(json, out);
  return {
    glb,
    stats: {
      fighter: fighterId, bytes: glb.length, clips: json.animations.map(a => a.name),
      keys: keyCount, meshes: json.meshes.length, texture: `${tinted.width}x${tinted.height}`, png: pngOut.length,
    },
  };
}

// ---------------------------------------------------------------------- CLI

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const check = process.argv.includes('--check');
  mkdirSync(OUT, {recursive: true});
  let failed = false;
  for (const [id, build] of Object.entries(CHARACTER_BUILDS)) {
    const source = readFileSync(join(SRC, `${build.source}.glb`));
    const {glb, stats} = optimizeCharacter(source, id, build);
    const kb = (stats.bytes / 1024).toFixed(1);
    const ok = stats.bytes <= MAX_BYTES;
    if (!ok) failed = true;
    console.log(`${ok ? 'OK ' : 'BÜYÜK'} ${id}.glb ${kb} KB (kaynak ${(source.length / 1024).toFixed(0)} KB) · ${stats.clips.length} klip · ${stats.keys} anahtar · ${stats.meshes} mesh · doku ${stats.texture} (${(stats.png / 1024).toFixed(1)} KB)`);
    if (!check) writeFileSync(join(OUT, `${id}.glb`), glb);
  }
  const license = join(SRC, 'LICENSE-KayKit.txt');
  if (!check && existsSync(license)) copyFileSync(license, join(OUT, 'LICENSE-KayKit.txt'));
  if (failed) process.exitCode = 1;
}
