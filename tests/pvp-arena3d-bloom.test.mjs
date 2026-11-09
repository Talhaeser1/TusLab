import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../pvp/vendor/three.module.min.js';
import {createArenaBloom} from '../pvp/arena3d-bloom.js';

function setup() {
  const calls = [];
  const renderer = {
    setRenderTarget(target) { calls.push(['target', target]); },
    getRenderTarget() { return null; },
    render(scene, camera) { calls.push(['render', scene, camera]); },
  };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  return {renderer, scene, camera, calls};
}

test('bloom composites bright scene in high quality and releases its target', () => {
  const {renderer, scene, camera, calls} = setup();
  const bloom = createArenaBloom({THREE, renderer});
  assert.ok(bloom);
  bloom.setSize(500, 300, 2);
  assert.equal(bloom.size().width, 1000);
  assert.equal(bloom.size().height, 600);
  const target = bloom.target;
  let disposed = 0;
  target.addEventListener('dispose', () => disposed++);
  bloom.render(scene, camera);
  assert.equal(calls.filter(([kind]) => kind === 'render').length, 2);
  assert.equal(calls[0][1], target);
  assert.equal(calls[1][1], scene);
  assert.equal(calls.at(-1)[1], null);
  bloom.dispose();
  assert.equal(disposed, 1);
});

test('bloom degrades to direct rendering without render target support', () => {
  const renderer = {render() {}};
  assert.equal(createArenaBloom({THREE, renderer}), null);
});

test('a silent composite shader link error fails bloom and restores renderer diagnostics', () => {
  const {renderer, scene, camera, calls} = setup();
  let priorCalls = 0;
  const priorHandler = () => { priorCalls++; };
  renderer.debug = {checkShaderErrors: true, onShaderError: priorHandler};
  renderer.render = (drawScene, drawCamera) => {
    calls.push(['render', drawScene, drawCamera]);
    if (drawScene !== scene) renderer.debug.onShaderError('gl', 'program', 'vertex', 'fragment');
  };
  const bloom = createArenaBloom({THREE, renderer});
  assert.throws(() => bloom.render(scene, camera), /bloom shader/i);
  assert.equal(priorCalls, 1, 'existing diagnostic handler still receives the error');
  assert.equal(renderer.debug.onShaderError, priorHandler, 'diagnostic handler is restored');
  assert.equal(calls.at(-1)[1], null, 'original render target is restored');
  bloom.dispose();
});

test('a scene shader error alone does not disable bloom', () => {
  const {renderer, scene, camera} = setup();
  let priorCalls = 0;
  const priorHandler = () => { priorCalls++; };
  renderer.debug = {checkShaderErrors: true, onShaderError: priorHandler};
  renderer.render = drawScene => {
    if (drawScene === scene) renderer.debug.onShaderError('gl', 'program', 'vertex', 'fragment');
  };
  const bloom = createArenaBloom({THREE, renderer});
  assert.doesNotThrow(() => bloom.render(scene, camera));
  assert.equal(priorCalls, 1);
  assert.equal(renderer.debug.onShaderError, priorHandler);
  bloom.dispose();
});
