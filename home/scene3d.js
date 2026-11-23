/* TuşLab ana ekran 3B sahnesi: yüzen ada üstünde Nyx ve Konyalı (boss yok), yörüngede harf tuşları,
 * yıldızlar ve parlayan parçacıklar. WebGL yoksa / three yüklenemezse host'taki CSS degrade yedek olarak kalır.
 * mountScene(host) → { destroy(), pulse(kind), setPaused(bool) } */
const THREE_URL = new URL('../pvp/vendor/three.module.min.js', import.meta.url).href;
const GLTF_URL = new URL('../pvp/vendor/GLTFLoader.js', import.meta.url).href;
// Boss yok: adada iki karakter kameraya dönük durur (ada altlarında döner, onlar dönmez).
const MODELS = [
  { url: new URL('../assets/models/nyx/nyx.glb', import.meta.url).href, h: 2.05, x: 0.9, z: 0.2, yaw: -0.35 },
  { url: new URL('../assets/models/konyali/konyali.glb', import.meta.url).href, h: 1.9, x: -0.9, z: 0.35, yaw: 0.4 },
];
const LETTERS = ['Ö', 'Ğ', 'Ş', 'Ç', 'Ü', 'İ', 'A', 'S', 'D', 'F', 'J', 'K', 'L'];
const ACCENTS = ['#3fe0ff', '#ff7a2f', '#8b5cff', '#ffc861'];
const ISLAND_TOP = 0.18;

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

function isReduced() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    || document.documentElement.classList.contains('reduced-motion');
}

function letterTexture(THREE, ch, accent) {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, s);
  bg.addColorStop(0, '#222a63');
  bg.addColorStop(1, '#0d1130');
  g.fillStyle = bg;
  g.fillRect(0, 0, s, s);
  g.strokeStyle = accent;
  g.lineWidth = 10;
  g.shadowColor = accent;
  g.shadowBlur = 24;
  g.strokeRect(14, 14, s - 28, s - 28);
  g.shadowBlur = 30;
  g.fillStyle = '#ffffff';
  g.font = '700 150px "Segoe UI", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(ch, s / 2, s / 2 + 8);
  g.shadowBlur = 0;
  g.fillStyle = accent;
  g.globalAlpha = 0.9;
  g.fillText(ch, s / 2, s / 2 + 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function dotTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.25, 'rgba(255,255,255,.8)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roundedKeyGeometry(THREE, size, depth, radius) {
  const h = size / 2;
  const sh = new THREE.Shape();
  sh.moveTo(-h + radius, -h);
  sh.lineTo(h - radius, -h);
  sh.quadraticCurveTo(h, -h, h, -h + radius);
  sh.lineTo(h, h - radius);
  sh.quadraticCurveTo(h, h, h - radius, h);
  sh.lineTo(-h + radius, h);
  sh.quadraticCurveTo(-h, h, -h, h - radius);
  sh.lineTo(-h, -h + radius);
  sh.quadraticCurveTo(-h, -h, -h + radius, -h);
  const geo = new THREE.ExtrudeGeometry(sh, {
    depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 6,
  });
  geo.center();
  return geo;
}

export function mountScene(host) {
  let destroyed = false;
  let paused = false;
  let raf = 0;
  let api = null;           // hazır olunca iç işlevler
  const noop = { destroy() { destroyed = true; api?.destroy(); }, pulse(k) { api?.pulse(k); }, setPaused(p) { paused = !!p; api?.sync(); } };
  if (!host) return noop;
  host.classList.add('tlh-scene--fallback');
  if (!hasWebGL()) return noop;

  (async () => {
    let THREE;
    try { THREE = await import(THREE_URL); } catch (err) {
      try { console.warn('[home-scene] three.js yüklenemedi:', err?.message || err); } catch { /* yok */ }
      return;
    }
    if (destroyed) return;

    let renderer;
    const canvas = document.createElement('canvas');
    canvas.className = 'tlh-scene-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'default' });
    } catch (err) {
      try { console.warn('[home-scene] WebGL açılamadı:', err?.message || err); } catch { /* yok */ }
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    host.appendChild(canvas);
    host.classList.remove('tlh-scene--fallback');
    host.classList.add('tlh-scene--ready');

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x080b1a, 0.028);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    const camBase = new THREE.Vector3(0, 1.5, 9);
    const lookAt = new THREE.Vector3(0, 1, 0);

    scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x1a0f2e, 1.2));
    const keyLight = new THREE.DirectionalLight(0xffd9bd, 2.1);
    keyLight.position.set(3, 6, 5);
    scene.add(keyLight);
    const rim = new THREE.DirectionalLight(0x3fe0ff, 2.4);
    rim.position.set(-5, 3, -4);
    scene.add(rim);

    // Ada
    const world = new THREE.Group();
    scene.add(world);
    const island = new THREE.Group();
    world.add(island);
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.1, 0.36, 48),
      new THREE.MeshStandardMaterial({ color: 0x1b2155, roughness: 0.55, metalness: 0.25, emissive: 0x0a1040, emissiveIntensity: 0.6 }),
    );
    island.add(top);
    const under = new THREE.Mesh(
      new THREE.ConeGeometry(2.1, 2.4, 9),
      new THREE.MeshStandardMaterial({ color: 0x141838, roughness: 0.9, flatShading: true, emissive: 0x2a0f05, emissiveIntensity: 0.5 }),
    );
    under.rotation.x = Math.PI;
    under.position.y = -1.38;
    island.add(under);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.42, 0.035, 8, 120),
      new THREE.MeshBasicMaterial({ color: 0x3fe0ff, transparent: true, opacity: 0.9 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = ISLAND_TOP;
    island.add(ring);
    const dot = dotTexture(THREE);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 3.2),
      new THREE.MeshBasicMaterial({ map: dot, color: 0xff7a2f, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = ISLAND_TOP + 0.01;
    island.add(glow);
    const emberLight = new THREE.PointLight(0xff7a2f, 9, 7, 1.6);
    emberLight.position.set(0, -1.2, 0);
    island.add(emberLight);
    const rockGeo = new THREE.IcosahedronGeometry(0.22, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x1d2350, roughness: 0.9, flatShading: true });
    const rocks = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(rockGeo, rockMat);
      const a = (i / 7) * Math.PI * 2 + 0.4;
      m.position.set(Math.cos(a) * (2.9 + (i % 2) * 0.5), -0.9 - (i % 3) * 0.45, Math.sin(a) * (2.9 + (i % 2) * 0.5));
      m.scale.setScalar(0.6 + ((i * 37) % 10) / 12);
      m.userData.phase = i * 1.3;
      island.add(m);
      rocks.push(m);
    }

    // Tuşlar
    const keyGeo = roundedKeyGeometry(THREE, 0.62, 0.26, 0.12);
    const keys = LETTERS.map((ch, i) => {
      const accent = ACCENTS[i % ACCENTS.length];
      const tex = letterTexture(THREE, ch, accent);
      // ExtrudeGeometry kapak UV'leri şekil koordinatı (-0.31..0.31): 0..1'e taşı.
      tex.repeat.set(1 / 0.62, 1 / 0.62);
      tex.offset.set(0.5, 0.5);
      const cap = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.1 });
      const side = new THREE.MeshStandardMaterial({ color: 0x161b42, roughness: 0.45, metalness: 0.35, emissive: new THREE.Color(accent), emissiveIntensity: 0.18 });
      const mesh = new THREE.Mesh(keyGeo, [cap, side]);
      mesh.userData = {
        angle: (i / LETTERS.length) * Math.PI * 2,
        radius: 3.5 + (i % 3) * 0.45,
        y: 0.9 + Math.sin(i * 1.7) * 1.0,
        phase: i * 0.9,
        bump: 0, delay: -1, cap, side,
      };
      world.add(mesh);
      return mesh;
    });

    // Yıldızlar
    const STAR_N = 900;
    const starPos = new Float32Array(STAR_N * 3);
    for (let i = 0; i < STAR_N; i++) {
      const r = 35 + Math.random() * 50;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      starPos[i * 3 + 1] = r * Math.cos(ph) * 0.7 + 6;
      starPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th) - 15;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      map: dot, size: 0.55, sizeAttenuation: true, color: 0xcfd8ff, transparent: true, opacity: 0.85, depthWrite: false, fog: false,
    }));
    scene.add(stars);

    // Kor/camgöbeği parçacıklar (yükselen)
    const SPARK_N = 140;
    const sparkPos = new Float32Array(SPARK_N * 3);
    const sparkCol = new Float32Array(SPARK_N * 3);
    const cA = new THREE.Color(0x3fe0ff), cB = new THREE.Color(0xff7a2f);
    for (let i = 0; i < SPARK_N; i++) {
      const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 5;
      sparkPos[i * 3] = Math.cos(a) * r;
      sparkPos[i * 3 + 1] = -2 + Math.random() * 6;
      sparkPos[i * 3 + 2] = Math.sin(a) * r;
      const c = Math.random() < 0.5 ? cA : cB;
      sparkCol[i * 3] = c.r; sparkCol[i * 3 + 1] = c.g; sparkCol[i * 3 + 2] = c.b;
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
    const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
      map: dot, size: 0.16, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    world.add(sparks);

    // Zafer patlaması
    const BURST_N = 220;
    const burstPos = new Float32Array(BURST_N * 3);
    const burstVel = new Float32Array(BURST_N * 3);
    const burstGeo = new THREE.BufferGeometry();
    burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));
    const burstMat = new THREE.PointsMaterial({
      map: dot, size: 0.22, color: 0xffc861, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const burst = new THREE.Points(burstGeo, burstMat);
    burst.visible = false;
    burst.frustumCulled = false;
    world.add(burst);
    let burstLife = 0;

    // Modeller
    const mixers = [];
    let loader = null;
    const cast = new THREE.Group();   // karakterler: adayla birlikte süzülür ama dönmez
    world.add(cast);
    const holders = [];
    async function loadModels() {
      try {
        const { GLTFLoader } = await import(GLTF_URL);
        loader = new GLTFLoader();
      } catch (err) {
        try { console.warn('[home-scene] GLTFLoader yüklenemedi:', err?.message || err); } catch { /* yok */ }
        return;
      }
      for (const def of MODELS) {
        if (destroyed) return;
        try {
          const gltf = await loader.loadAsync(def.url);
          if (destroyed || !gltf?.scene) { if (gltf?.scene) disposeTree(gltf.scene); return; }
          const model = gltf.scene;
          model.updateMatrixWorld(true);
          let box = new THREE.Box3().setFromObject(model, true);
          const size = box.getSize(new THREE.Vector3());
          model.scale.multiplyScalar(def.h / Math.max(size.y, 0.001));
          model.updateMatrixWorld(true);
          box = new THREE.Box3().setFromObject(model, true);
          const c = box.getCenter(new THREE.Vector3());
          model.position.x -= c.x;
          model.position.z -= c.z;
          model.position.y -= box.min.y;
          const holder = new THREE.Group();
          holder.add(model);
          holder.position.set(def.x, ISLAND_TOP, def.z);
          holder.rotation.y = def.yaw;
          holder.userData = { yaw: def.yaw, phase: holders.length * 1.7 };
          cast.add(holder);
          holders.push(holder);
          const clips = gltf.animations || [];
          const clip = clips.find(k => /idle|stance/i.test(k.name)) || clips[0];
          if (clip) {
            const mixer = new THREE.AnimationMixer(model);
            mixer.clipAction(clip).play();
            mixer.update(Math.random() * Math.min(1, clip.duration || 1));
            mixers.push(mixer);
          }
          if (reduced || paused) renderOnce();
        } catch (err) {
          try { console.warn('[home-scene] model yüklenemedi:', def.url, err?.message || err); } catch { /* yok */ }
        }
      }
    }

    // Kamera paralaks
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    function onPointer(e) {
      const w = window.innerWidth || 1, h = window.innerHeight || 1;
      pointer.tx = (e.clientX / w) * 2 - 1;
      pointer.ty = (e.clientY / h) * 2 - 1;
    }
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerdown', onPointer, { passive: true });

    let wide = false;
    function fit() {
      const w = Math.max(1, host.clientWidth || window.innerWidth), h = Math.max(1, host.clientHeight || window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      wide = camera.aspect > 1.25 && w > 860;
      world.position.x = 0;
      // Geniş ekranda sahne sağ sütunun ortasına kaydırılır (sol taraf yazma alanı).
      if (wide) camera.setViewOffset(w, h, -Math.round(w * 0.3), Math.round(h * 0.02), w, h);
      else camera.clearViewOffset();
      camBase.z = wide ? 11.5 : camera.aspect < 0.8 ? 12.5 : camera.aspect < 1.1 ? 10.5 : 9;
      camera.updateProjectionMatrix();
    }

    let reduced = isReduced();
    const clock = new THREE.Clock();
    let t = 0;
    const tmp = new THREE.Vector3();

    function step(dt) {
      t += dt;
      island.rotation.y += dt * 0.12;
      island.position.y = Math.sin(t * 0.8) * 0.12;
      rocks.forEach(r => { r.position.y += Math.sin(t * 1.1 + r.userData.phase) * 0.0025; r.rotation.x += dt * 0.3; r.rotation.y += dt * 0.2; });
      ring.material.opacity = 0.7 + Math.sin(t * 2.2) * 0.2;
      glow.material.opacity = 0.45 + Math.sin(t * 1.4) * 0.12;
      mixers.forEach(m => m.update(dt));
      cast.position.y = island.position.y;
      holders.forEach(hd => { hd.rotation.y = hd.userData.yaw + Math.sin(t * 0.4 + hd.userData.phase) * 0.18; });

      keys.forEach(k => {
        const u = k.userData;
        if (u.delay >= 0) { u.delay -= dt; if (u.delay < 0) { u.bump = 1; u.delay = -1; } }
        u.angle += dt * 0.14;
        const bumpE = u.bump > 0 ? Math.sin(u.bump * Math.PI) : 0;
        k.position.set(Math.cos(u.angle) * u.radius, u.y + Math.sin(t * 1.2 + u.phase) * 0.14 + bumpE * 0.55, Math.sin(u.angle) * u.radius);
        k.updateMatrixWorld();
        k.lookAt(camera.position);   // hedef dünya koordinatında
        k.rotateZ(Math.sin(t * 0.9 + u.phase) * 0.12);
        k.rotateX(-0.15 + bumpE * 0.4);
        u.cap.emissiveIntensity = 0.55 + bumpE * 1.5;
        u.side.emissiveIntensity = 0.18 + bumpE * 0.9;
        if (u.bump > 0) u.bump = Math.max(0, u.bump - dt * 1.8);
      });

      const sp = sparkGeo.attributes.position.array;
      for (let i = 0; i < SPARK_N; i++) {
        sp[i * 3 + 1] += dt * (0.25 + (i % 5) * 0.06);
        if (sp[i * 3 + 1] > 4.5) sp[i * 3 + 1] = -2.5;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      stars.rotation.y += dt * 0.004;

      if (burstLife > 0) {
        burstLife -= dt;
        const bp = burstGeo.attributes.position.array;
        for (let i = 0; i < BURST_N * 3; i += 3) {
          burstVel[i + 1] -= dt * 2.2;
          bp[i] += burstVel[i] * dt; bp[i + 1] += burstVel[i + 1] * dt; bp[i + 2] += burstVel[i + 2] * dt;
        }
        burstGeo.attributes.position.needsUpdate = true;
        burstMat.opacity = Math.max(0, Math.min(1, burstLife / 0.8));
        if (burstLife <= 0) burst.visible = false;
      }

      pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3);
      pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3);
      camera.position.set(
        camBase.x + pointer.x * 0.7 + Math.sin(t * 0.25) * 0.15,
        camBase.y - pointer.y * 0.4 + Math.sin(t * 0.33) * 0.08,
        camBase.z,
      );
      camera.lookAt(lookAt.x + world.position.x * 0.55, lookAt.y, lookAt.z);
    }

    function renderOnce() {
      if (destroyed) return;
      if (reduced) {
        camera.position.copy(camBase);
        camera.lookAt(lookAt.x + world.position.x * 0.55, lookAt.y, lookAt.z);
        keys.forEach(k => {
          const u = k.userData;
          k.position.set(Math.cos(u.angle) * u.radius, u.y, Math.sin(u.angle) * u.radius);
          k.updateMatrixWorld(); k.lookAt(camera.position);
        });
      }
      renderer.render(scene, camera);
    }

    function loop() {
      raf = 0;
      if (destroyed || paused || reduced || document.hidden) return;
      step(Math.min(clock.getDelta(), 0.1));
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    }

    function sync() {
      if (destroyed) return;
      const run = !paused && !reduced && !document.hidden;
      if (run && !raf) { clock.getDelta(); raf = requestAnimationFrame(loop); }
      if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
      if (!run && !paused && !document.hidden) renderOnce();
    }

    const onVis = () => sync();
    document.addEventListener('visibilitychange', onVis);
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const onMq = () => { reduced = isReduced(); sync(); };
    mq?.addEventListener?.('change', onMq);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { fit(); if (reduced || paused) renderOnce(); }) : null;
    ro?.observe(host);
    const onResize = () => { fit(); if (reduced || paused) renderOnce(); };
    window.addEventListener('resize', onResize);

    function pulse(kind) {
      if (destroyed || reduced) return;
      if (kind === 'win') {
        keys.forEach((k, i) => { k.userData.delay = i * 0.06; });
        const bp = burstGeo.attributes.position.array;
        for (let i = 0; i < BURST_N * 3; i += 3) {
          const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), sp = 2 + Math.random() * 3.5;
          bp[i] = 0; bp[i + 1] = 1.4; bp[i + 2] = 0;
          burstVel[i] = Math.sin(ph) * Math.cos(th) * sp;
          burstVel[i + 1] = Math.abs(Math.cos(ph)) * sp + 1.2;
          burstVel[i + 2] = Math.sin(ph) * Math.sin(th) * sp;
        }
        burstGeo.attributes.position.needsUpdate = true;
        burstMat.color.set(Math.random() < 0.5 ? 0xffc861 : 0x3fe0ff);
        burstMat.opacity = 1;
        burst.visible = true;
        burstLife = 2;
      } else {
        const k = keys[(Math.random() * keys.length) | 0];
        if (k.userData.bump <= 0.3) k.userData.bump = 1;
      }
    }

    function disposeTree(root) {
      root.traverse(o => {
        o.geometry?.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach(m => {
          for (const key in m) { const v = m[key]; if (v && v.isTexture) v.dispose(); }
          m.dispose?.();
        });
      });
    }

    function destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      mq?.removeEventListener?.('change', onMq);
      ro?.disconnect();
      mixers.forEach(m => m.stopAllAction());
      disposeTree(scene);
      dot.dispose();
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* yok */ }
      canvas.remove();
      host.classList.remove('tlh-scene--ready');
    }

    api = { destroy, pulse, sync };
    fit();
    sync();
    if (reduced || paused) renderOnce();
    loadModels();
  })();

  return noop;
}
