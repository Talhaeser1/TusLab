import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as THREE from '../pvp/vendor/three.module.min.js';
import {createArena3D} from '../pvp/arena3d.js';

async function builder() {
  const module = await import('../pvp/stages3d.js').catch(() => ({}));
  assert.equal(typeof module.buildStage, 'function', 'stage factory exists');
  return module.buildStage;
}

function fixture({width = 1000, height = 500, stacked = false, dpr = 1, reduced = () => false} = {}) {
  const node = rect => ({rect, style: {}, children: [], clientLeft: 0, clientTop: 0,
    classList: {values: new Set(), add(x) { this.values.add(x); }, remove(x) { this.values.delete(x); }, contains(x) { return this.values.has(x); }},
    getBoundingClientRect() { const r = this.rect; return {...r, right: r.left + r.width, bottom: r.top + r.height}; },
    insertBefore(c) { this.children.push(c); c.remove = () => this.children.splice(this.children.indexOf(c), 1); },
    setAttribute() {}, addEventListener() {}, removeEventListener() {}});
  const root = node({left: 0, top: 0, width, height}), duel = node({...root.rect});
  const s1 = node({left: 10, top: 50, width: stacked ? width - 20 : width / 2 - 20, height: stacked ? 200 : 300});
  const s2 = node({left: stacked ? 10 : width / 2 + 10, top: stacked ? 300 : 50, width: s1.rect.width, height: s1.rect.height});
  root.querySelector = () => duel;
  duel.querySelector = s => s.includes('"1"') ? s1 : s2;
  let clock = 1000;
  const doc = {createElement: () => ({...node(root.rect), getContext: () => null}), addEventListener() {}, removeEventListener() {}};
  const env = {document: doc, devicePixelRatio: dpr, performance: {now: () => clock}, advance: ms => { clock += ms; }};
  const renderer = {setSize() {}, setPixelRatio() {}, render() {}, dispose() {}};
  return {root, duel, s1, s2, env, async build() {
    const arena = await createArena3D({root, env, THREE, isReduced: reduced, createRenderer: () => renderer, loadTexture: async () => new THREE.Texture()});
    await arena.ready;
    return arena;
  }};
}

test('stages33: all stages build, update, stay within twelve draws and release every owned resource', async () => {
  const buildStage = await builder();
  for (const id of ['colosseum', 'skyforge', 'runegarden', 'harbor']) {
    const scene = new THREE.Scene(), sentinel = new THREE.Group();
    scene.add(sentinel);
    const fog = new THREE.Fog(0, 1, 2); scene.fog = fog;
    const stage = buildStage(THREE, {id, quality: 'high', parent: scene});
    const resources = new Set(), released = new Set();
    let draws = 0;
    stage.group.traverse(o => {
      if (o.isMesh || o.isPoints || o.isLine) draws++;
      if (o.geometry) resources.add(o.geometry);
      if (o.isInstancedMesh) resources.add(o);
      for (const m of [].concat(o.material || [])) {
        resources.add(m);
        for (const value of Object.values(m)) if (value?.isTexture) resources.add(value);
        for (const value of Object.values(m.uniforms || {})) if (value?.value?.isTexture) resources.add(value.value);
      }
    });
    for (const resource of resources) resource.addEventListener('dispose', () => released.add(resource));
    assert.ok(draws <= 12, `${id}: ${draws} draws`);
    if (id !== 'colosseum') {
      assert.notEqual(scene.fog, fog);
      assert.ok(stage.ambient.length > 0);
    }
    stage.update(0.016, 1);
    stage.applyQuality('low'); stage.update(0.016, 2);
    stage.dispose(); stage.dispose();
    assert.deepEqual(scene.children, [sentinel]);
    assert.equal(scene.fog, fog);
    assert.equal(released.size, resources.size, `${id}: all resources disposed`);
  }
});

test('stages33: weather counts, high-only harbor lights and reduced motion stay bounded', async () => {
  const buildStage = await builder();
  for (const [id, name, high, low] of [['skyforge', 'pvp33-sparks', 300, 120], ['harbor', 'pvp33-rain', 1200, 500], ['runegarden', 'pvp33-fireflies', 200, 80]]) {
    let quiet = false;
    const scene = new THREE.Scene();
    const stage = buildStage(THREE, {id, parent: scene, isReduced: () => quiet});
    try {
      const particles = stage.group.getObjectByName(name);
      assert.ok(particles);
      assert.equal(particles.geometry.drawRange.count, high);
      stage.applyQuality('low');
      assert.equal(particles.geometry.drawRange.count, low);
      const lights = [];
      stage.group.traverse(o => { if (o.isPointLight) lights.push(o); });
      assert.ok(lights.every(o => !o.visible));
      stage.applyQuality('high');
      assert.ok(lights.every(o => o.visible));
      quiet = true; stage.update(0.016, 5);
      assert.equal(particles.visible, false);
      assert.equal(particles.geometry.drawRange.count, 0);
      assert.equal(stage.flash?.visible ?? false, false);
      quiet = false; stage.update(0.016, 6);
      assert.equal(particles.visible, true);
      assert.equal(particles.geometry.drawRange.count, high);
    } finally { stage.dispose(); }
  }
});

test('stages33: harbor lightning uses simulation time, random 6–12 second gaps and a 120ms flash', async () => {
  const buildStage = await builder();
  let quiet = false;
  const stage = buildStage(THREE, {id: 'harbor', parent: new THREE.Scene(), random: () => 0, isReduced: () => quiet});
  try {
    for (let i = 0; i < 59; i++) stage.update(0.1, 1000);
    assert.equal(stage.flash.visible, false);
    stage.update(0.1, 1000);
    assert.equal(stage.flash.visible, true);
    stage.update(0.1, 1000);
    assert.equal(stage.flash.visible, true);
    stage.update(0.021, 1000);
    assert.equal(stage.flash.visible, false);
    quiet = true;
    for (let i = 0; i < 70; i++) stage.update(0.1, 1000);
    assert.equal(stage.flash.visible, false);
  } finally { stage.dispose(); }
});

test('stages33: setStage normalizes ids, is a no-op for the same stage, keeps seats and survives clear', async () => {
  const f = fixture(), arena = await f.build();
  try {
    assert.equal(typeof arena.setStage, 'function');
    const homes = [1, 2].map(s => arena.api.seatGround(s).toArray());
    for (const id of ['skyforge', 'runegarden', 'harbor', 'colosseum']) {
      arena.setStage(id);
      assert.equal(arena.api.stage(), id);
      const objects = arena.api.scene.children.slice();
      arena.setStage(id);
      assert.deepEqual(arena.api.scene.children, objects);
      arena.clear();
      assert.equal(arena.api.stage(), id);
      assert.deepEqual([1, 2].map(s => arena.api.seatGround(s).toArray()), homes);
      f.env.advance(16); arena._debug.tick();
    }
    arena.setStage('harbor'); arena.setStage('__proto__');
    assert.equal(arena.api.stage(), 'colosseum');
    assert.ok(arena.api.scene.getObjectByName('pvp26-environment'));
  } finally { arena.destroy(); }
  assert.equal(arena.api.scene.children.length, 0);
});

test('stages33: active weather advances with arena slow motion and stops under the root reduced class', async () => {
  const f = fixture(), arena = await f.build();
  try {
    assert.equal(typeof arena.setStage, 'function');
    arena.setStage('skyforge');
    const sparks = arena.api.scene.getObjectByName('pvp33-sparks');
    const time = sparks.material.uniforms.uTime;
    f.env.advance(16); arena._debug.tick();
    arena.api.slowMo(0.25, 1000);
    f.env.advance(100); arena._debug.tick();
    f.env.advance(100); arena._debug.tick(); // existing 120ms slowMo ease-in is complete
    const before = time.value;
    f.env.advance(16); arena._debug.tick();
    assert.ok(Math.abs(time.value - before - 0.004) < 1e-6);
    f.root.classList.add('pvp4-reduced');
    f.env.advance(16); arena._debug.tick();
    assert.equal(sparks.visible, false);
  } finally { arena.destroy(); }
});

test('stages33: switching the real colosseum and themed stages disposes resources exactly once', async () => {
  const f = fixture(), arena = await f.build();
  const watched = new Map();
  function watch(group) {
    const resources = new Set();
    group.traverse(o => {
      if (o.isInstancedMesh) resources.add(o);
      if (o.geometry) resources.add(o.geometry);
      for (const material of [].concat(o.material || [])) {
        resources.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
        for (const value of Object.values(material.uniforms || {})) if (value?.value?.isTexture) resources.add(value.value);
      }
    });
    for (const resource of resources) {
      watched.set(resource, 0);
      resource.addEventListener('dispose', () => watched.set(resource, watched.get(resource) + 1));
    }
  }
  try {
    watch(arena.api.scene.getObjectByName('pvp26-environment'));
    for (const id of ['skyforge', 'runegarden', 'harbor', 'colosseum']) {
      arena.setStage(id);
      for (const count of watched.values()) assert.equal(count, 1);
      watch(arena.api.scene.getObjectByName(id === 'colosseum' ? 'pvp26-environment' : `pvp33-stage-${id}`));
    }
  } finally { arena.destroy(); }
  for (const count of watched.values()) assert.equal(count, 1);
});

test('stages33: system reduced-motion preference disables sparks and lightning even without a custom predicate', async () => {
  const f = fixture();
  const preference = {matches: true};
  let queries = 0;
  f.env.matchMedia = query => { assert.equal(query, '(prefers-reduced-motion: reduce)'); queries++; return preference; };
  const arena = await f.build();
  try {
    arena.setStage('skyforge'); f.env.advance(16); arena._debug.tick();
    assert.equal(arena.api.scene.getObjectByName('pvp33-sparks').visible, false);
    arena.setStage('harbor'); f.env.advance(16); arena._debug.tick();
    assert.equal(arena.api.scene.getObjectByName('pvp33-rain').visible, false);
    assert.equal(arena.api.scene.getObjectByName('pvp33-lightning').visible, false);
    assert.equal(queries, 1, 'reuse the live preference instead of allocating queries every frame');
    preference.matches = false;
    f.env.advance(16); arena._debug.tick();
    assert.equal(arena.api.scene.getObjectByName('pvp33-rain').visible, true);
  } finally { arena.destroy(); }
});

test('stages33: vertically stacked boxes project both fighters side by side inside the duel at 375px', async () => {
  const f = fixture({width: 375, height: 650, stacked: true}), arena = await f.build();
  try {
    arena._debug.tick();
    arena.api.camera.updateMatrixWorld(true);
    const pixels = [1, 2].map(s => {
      const p = arena.api.seatGround(s).project(arena.api.camera);
      return {x: (p.x + 1) * 375 / 2, y: (1 - p.y) * 650 / 2};
    });
    assert.ok(pixels[0].x < 187.5 && pixels[1].x > 187.5);
    assert.ok(Math.abs(pixels[0].y - pixels[1].y) < 2);
    for (const p of pixels) assert.ok(p.x >= 0 && p.x <= 375 && p.y >= 0 && p.y <= 650, JSON.stringify(p));
    assert.equal(arena.canvas.style.width, '375px');
    assert.equal(arena.canvas.style.height, '650px');
  } finally { arena.destroy(); }
});

test('stages33: growing stage boxes increases fighter scale without moving feet above the floor', async () => {
  const f = fixture(), arena = await f.build();
  try {
    const actor = arena.api.scene.getObjectByName('pvp26-fighter-1');
    assert.ok(actor);
    const before = actor.scale.x;
    f.duel.rect.height = 900;
    f.s1.rect.height = f.s2.rect.height = 650;
    arena.resize();
    assert.ok(actor.scale.x > before);
    assert.equal(arena.api.seatGround(1).y, 0);
  } finally { arena.destroy(); }
});

test('stages33: index forwards match stage and limits the URL override to local development', () => {
  const source = readFileSync(new URL('../pvp/pvp-main.js', import.meta.url), 'utf8');
  const sync = source.match(/function arena3dSyncStage\(\)\{([\s\S]*?)\n\}/);
  assert.ok(sync, 'stage synchronizer exists');
  for (const [hostname, search, expected] of [['localhost', '?stage=skyforge', 'skyforge'], ['127.0.0.1', '?stage=harbor', 'harbor'], ['tuslab.example', '?stage=skyforge', 'runegarden'], ['localhost.example', '?stage=harbor', 'runegarden'], ['localhost', '', 'runegarden']]) {
    const seen = [];
    vm.runInNewContext(`(${sync[0]})()`, {location: {hostname, search}, URLSearchParams, network: {match: {stage: 'runegarden'}}, arena3d: {instance: {setStage: id => seen.push(id)}}});
    assert.deepEqual(seen, [expected]);
  }
  const listener = source.match(/root\?\.addEventListener\('tuslab:pvp-match',\(\)=>\{\n  const m=network.match;\n  if\(m\?\.status==='running'[\s\S]*?\n\}\);/);
  assert.ok(listener, 'match listener exists');
  let onMatch, syncs = 0;
  const context = {root: {addEventListener: (type, fn) => { assert.equal(type, 'tuslab:pvp-match'); onMatch = fn; }},
    network: {match: {status: 'waiting'}}, arena3dSyncFighters() {}, arena3dSyncStage() { syncs++; }};
  vm.runInNewContext(listener[0], context);
  onMatch(); onMatch();
  assert.equal(syncs, 2, 'every match update synchronizes the stage');
});
