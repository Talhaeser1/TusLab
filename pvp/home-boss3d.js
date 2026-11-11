/* Ana ekran boss'u: Harf Muhafızı GLB'si, küçük tek canvas. Yüklenene/hata/WebGL yokken yuvadaki
 * mevcut görsel (arena-king.webp) görünür kalır. Sekme gizliyken render durur; reduced-motion'da tek kare. */
const MODEL_URL = './assets/models/harf-muhafizi/harf-muhafizi.glb';
const THREE_URL = './vendor/three.module.min.js';
const GLTF_URL = './vendor/GLTFLoader.js';

let state = null;      // {THREE, renderer, scene, camera, mixer, pivot, model, base, canvas}
let loading = null;    // yükleme sözü (tek sefer)
let failed = false;
let host = null;
let raf = 0;
let clock = null;
let ro = null;
let visHandler = null;
let rmQuery = null;
let rmHandler = null;

const reduced = () => !!(rmQuery && rmQuery.matches)
  || document.documentElement.classList.contains('reduced-motion')
  || document.documentElement.classList.contains('effects-reduced');

function fit() {
  if (!state || !host) return;
  const w = Math.max(1, state.canvas.clientWidth || host.clientWidth), h = Math.max(1, state.canvas.clientHeight || host.clientHeight);
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  state.renderer.setSize(w, h, false);
  state.camera.aspect = w / h;
  state.camera.updateProjectionMatrix();
}

function frame(still = false) {
  if (!state) return;
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  if (!still) {
    state.mixer?.update(dt);
    state.pivot.rotation.y = Math.sin(t * 0.35) * 0.45;           // yavaş dönme
    state.model.scale.setScalar(state.base * (1 + Math.sin(t * 1.6) * 0.012)); // nefes
  }
  state.renderer.render(state.scene, state.camera);
}

function loop() {
  raf = 0;
  if (!state || !host || document.hidden || reduced()) return;
  frame();
  raf = requestAnimationFrame(loop);
}

function start() {
  if (raf || !state || !host) return;
  if (document.hidden) return;
  clock.getDelta();
  if (reduced()) { frame(true); return; }
  raf = requestAnimationFrame(loop);
}

function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

async function load() {
  if (state || failed) return state;
  if (loading) return loading;
  loading = (async () => {
    try {
      const probe = document.createElement('canvas');
      if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('WebGL yok');
      const THREE = await import(THREE_URL);
      const {GLTFLoader} = await import(GLTF_URL);
      const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
      if (!gltf?.scene) throw new Error('model yok');
      const canvas = document.createElement('canvas');
      canvas.className = 'home-boss3d-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      const renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true, powerPreference: 'low-power'});
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x30204a, 1.6));
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(2, 4, 3);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x75eaff, 1.4);
      rim.position.set(-3, 2, -2);
      scene.add(rim);
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      const pivot = new THREE.Group();
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      // İskeletli Meshy modelinde (Armature ölçeği 0,01) kaba kutu yanlış çıkar: köşe köşe (skinning dahil) ölç.
      const box = new THREE.Box3().setFromObject(model, true);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const base = 2 / Math.max(size.y, 0.001);
      model.position.sub(center);
      pivot.add(model);
      model.scale.setScalar(base);
      scene.add(pivot);
      camera.position.set(0, 0.1, 6.2);
      camera.lookAt(0, 0, 0);
      let mixer = null;
      const clips = gltf.animations || [];
      const clip = clips.find(c => /^idle$/i.test(c.name)) || clips.find(c => /idle|stance/i.test(c.name)) || clips[0];
      if (clip) {
        mixer = new THREE.AnimationMixer(model);
        mixer.clipAction(clip).play();
        if (reduced()) mixer.setTime(Math.min(0.4, clip.duration * 0.1));
      }
      clock = new THREE.Clock();
      state = {THREE, renderer, scene, camera, mixer, pivot, model, base, canvas};
      return state;
    } catch (err) {
      failed = true;
      try { console.warn('[home-boss3d] 3D boss yüklenemedi, görsel kullanılıyor:', err?.message || err); } catch { /* yok */ }
      return null;
    }
  })();
  return loading;
}

function release() {
  stop();
  ro?.disconnect(); ro = null;
  if (visHandler) document.removeEventListener('visibilitychange', visHandler);
  visHandler = null;
  if (rmQuery && rmHandler) rmQuery.removeEventListener?.('change', rmHandler);
  rmHandler = null;
  if (state?.canvas?.parentNode) state.canvas.parentNode.classList.remove('home-boss3d-ready');
  state?.canvas?.remove();
  host = null;
}

/** Yuvaya (ör. .arena-backdrop) bağlar; önceki yuva bırakılır. Dönen işlev bağı koparır. */
export async function mountHomeBoss(el) {
  if (!el || failed) return () => {};
  if (host === el && state?.canvas?.parentNode === el) return () => release();
  release();
  host = el;
  const s = await load();
  if (!s || host !== el || !el.isConnected) return () => {};
  el.appendChild(s.canvas);
  el.classList.add('home-boss3d-ready');
  rmQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') || null;
  rmHandler = () => { stop(); start(); };
  rmQuery?.addEventListener?.('change', rmHandler);
  ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { fit(); if (reduced()) frame(true); }) : null;
  ro?.observe(el);
  visHandler = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', visHandler);
  fit();
  start();
  return () => { if (host === el) release(); };
}

export function unmountHomeBoss() { release(); }
