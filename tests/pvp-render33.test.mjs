import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../pvp/vendor/three.module.min.js';
import {createArena3D} from '../pvp/arena3d.js';
import {createArenaBloom} from '../pvp/arena3d-bloom.js';
import {createArena3DFx} from '../pvp/arena3d-fx.js';
import {createSkillFx} from '../pvp/fighters3d.js';
import {readGlb} from '../scripts/optimize-characters.mjs';

function fixture(dpr) {
  const rect = {left: 0, top: 0, width: 3840, height: 2160};
  const node = r => ({style: {}, children: [], classList: {add() {}, remove() {}, contains() { return false; }},
    getBoundingClientRect: () => ({...r, right: r.left + r.width, bottom: r.top + r.height}),
    insertBefore(c) { this.children.push(c); c.remove = () => this.children.splice(this.children.indexOf(c), 1); },
    setAttribute() {}, addEventListener() {}, removeEventListener() {}});
  const duel = node(rect), root = node(rect);
  const stages = [node({...rect, width: 1800}), node({...rect, left: 2040, width: 1800})];
  root.querySelector = () => duel;
  duel.querySelector = s => stages[s.includes('"1"') ? 0 : 1];
  const doc = {createElement: () => ({...node(rect), getContext: () => null}), addEventListener() {}, removeEventListener() {}};
  let clock = 1000;
  const env = {document: doc, devicePixelRatio: dpr, performance: {now: () => clock}, advance: ms => { clock += ms; }};
  const renderer = {ratio: null, setPixelRatio(r) { this.ratio = r; }, setSize() {}, render() {}, dispose() {}};
  return {root, env, renderer};
}

test('render33: explicit high retains device resolution on a large canvas; low is exactly one', async () => {
  for (const [dpr, expected] of [[3, 2], [1.25, 1.25], [0.8, 0.8]]) {
    const {root, env, renderer} = fixture(dpr);
    const arena = await createArena3D({root, env, THREE, createRenderer: () => renderer, loadTexture: async () => new THREE.Texture()});
    try {
      arena.setQuality('high');
      assert.equal(renderer.ratio, expected);
      arena.setQuality('low');
      assert.equal(renderer.ratio, 1);
    } finally { arena.destroy(); }
  }
});

test('render33: bloom source equals the full backing store with four WebGL2 samples', () => {
  const renderer = {capabilities: {isWebGL2: true}, setRenderTarget() {}, getRenderTarget() { return null; }, render() {}};
  const bloom = createArenaBloom({THREE, renderer});
  try {
    bloom.setSize(3840, 2160, 1.25);
    assert.deepEqual(bloom.size(), {width: 4800, height: 2700});
    assert.equal(bloom.target.samples, 4);
  } finally { bloom.dispose(); }
});

test('render33: direct rendering requests antialiasing when WebGL2 bloom is unavailable', async () => {
  const {root, env, renderer} = fixture(1);
  let options;
  const localThree = {...THREE, WebGLRenderer: function(config) { options = config; return renderer; }};
  const arena = await createArena3D({root, env, THREE: localThree, loadTexture: async () => new THREE.Texture()});
  try { assert.equal(options.antialias, true); } finally { arena.destroy(); }
});

test('render33: auto starts at full resolution and only slow frame windows can lower quality', async () => {
  const {root, env, renderer} = fixture(2);
  const arena = await createArena3D({root, env, THREE, createRenderer: () => renderer, loadTexture: async () => new THREE.Texture()});
  try {
    await arena.ready;
    assert.equal(renderer.ratio, 2);
    for (let i = 0; i < 160; i++) { env.advance(16); arena._debug.tick(); }
    assert.equal(renderer.ratio, 2);
    assert.equal(arena.api.quality(), 'high');
    for (let i = 0; i < 280; i++) { env.advance(30); arena._debug.tick(); }
    assert.equal(arena.api.quality(), 'low');
    assert.equal(renderer.ratio, 1);
  } finally { arena.destroy(); }
});

test('render33: all shipped Meshy GLBs fit 1.2 MiB and contain texture data', () => {
  for (const id of ['vargr', 'sira', 'doran', 'nyx']) {
    const bytes = readFileSync(new URL(`../assets/models/${id}/${id}.glb`, import.meta.url));
    assert.ok(bytes.length <= 1.2 * 1024 * 1024, `${id}: ${bytes.length} bytes`);
    const {json, bin} = readGlb(bytes);
    for (const image of json.images) {
      const view = json.bufferViews[image.bufferView];
      const data = bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
      assert.ok(data.length > 1000, `${id} texture data`);
      assert.ok(['image/png','image/webp'].includes(image.mimeType), `${id} texture type`);
    }
  }
});

test('render33: particle sprite is 128px and is released with the effects', () => {
  const context = {createRadialGradient: () => ({addColorStop() {}}), fillRect() {}};
  const document = {createElement: () => ({width: 0, height: 0, getContext: () => context})};
  const scene = new THREE.Scene();
  const fx = createArena3DFx({THREE, scene, renderer: {domElement: {ownerDocument: document}}, camera: new THREE.PerspectiveCamera()});
  const particles = scene.getObjectByName('arena3d-fx-particles');
  const sprite = particles.material.uniforms.uSprite?.value;
  try {
    assert.ok(sprite?.isTexture);
    assert.equal(sprite.image.width, 128);
    assert.equal(sprite.image.height, 128);
    let disposed = 0;
    sprite.addEventListener('dispose', () => disposed++);
    fx.dispose();
    assert.equal(disposed, 1);
  } finally { fx.dispose(); }
});

test('render33: character projectiles keep a distinct opaque core and a 24 segment trail', () => {
  const scene = new THREE.Scene(), fx = createSkillFx(THREE, scene);
  try {
    for (const kind of ['spear', 'dagger', 'rune', 'meteor']) {
      fx.spawn({kind, from: new THREE.Vector3(-2, 1, 0), to: new THREE.Vector3(2, 1, 0)});
      fx.update(0.016);
      const group = scene.getObjectByName(`pvp32-fx-${kind}`);
      const core = group.getObjectByName('pvp33-projectile-core');
      assert.ok(core?.isMesh && core.material.opacity >= 0.9, kind);
      const trail = scene.getObjectByName(`pvp33-trail-${kind}`);
      assert.ok(trail?.geometry.getAttribute('position').count >= 25, kind);
    }
  } finally { fx.dispose(); }
  assert.equal(scene.children.length, 0);
});

test('render33: fallback projectiles draw continuous 24 segment trails and clear them with the pool', () => {
  const scene = new THREE.Scene();
  const api = {THREE, scene, camera: new THREE.PerspectiveCamera(),
    seatAnchor: seat => new THREE.Vector3(seat === 1 ? -2 : 2, 1, 0),
    seatGround: seat => new THREE.Vector3(seat === 1 ? -2 : 2, 0, 0),
    seatScale: () => 1, facing: seat => seat === 1 ? 1 : -1};
  const fx = createArena3DFx(api);
  try {
    fx.handle({type: 'SKILL_CAST', fromSeat: 1, toSeat: 2, character: 'fire', skill: 'q'});
    fx.update(0.016);
    const trail = scene.getObjectByName('arena3d-fx-trail-fire');
    assert.ok(trail?.isLine);
    assert.equal(trail.geometry.getAttribute('position').count, 25);
    assert.equal(trail.visible, true);
    const positions = trail.geometry.getAttribute('position').array;
    assert.ok(positions[0] > positions[72], 'head follows the projectile and tail stays behind');
    fx.clear();
    assert.equal(trail.visible, false);
  } finally { fx.dispose(); }
});
