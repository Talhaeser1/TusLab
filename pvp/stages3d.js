import {normalizeStage} from './shared/stages.js';

const TAU = Math.PI * 2;
const THEMES = {
  skyforge: {fog: 0x6e251d, density: 0.027, top: 0x240919, horizon: 0xf37535, ambient: 0xffa16b},
  runegarden: {fog: 0x171330, density: 0.035, top: 0x07091c, horizon: 0x3b3273, ambient: 0x81e2da},
  harbor: {fog: 0x0a192c, density: 0.033, top: 0x030b1b, horizon: 0x193a59, ambient: 0x719bbc},
};

const SKY_VERTEX = `varying vec3 vSky;
  void main(){ vSky=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const SKY_FRAGMENT = `uniform vec3 uTop; uniform vec3 uHorizon; uniform float uFlash; varying vec3 vSky;
  void main(){ float k=pow(clamp(normalize(vSky).y,0.0,1.0),0.65);
    gl_FragColor=vec4(mix(uHorizon,uTop,k)+vec3(0.48,0.58,0.7)*uFlash,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const UV_VERTEX = `varying vec2 vUv;
  void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const LAVA_FRAGMENT = `uniform float uTime; varying vec2 vUv;
  void main(){ vec2 p=vUv+vec2(0.0,uTime*0.18);
    float flow=0.5+0.5*sin(p.y*36.0+sin(p.x*13.0)*2.4);
    vec3 color=mix(vec3(0.8,0.04,0.01),vec3(2.2,0.75,0.09),flow);
    gl_FragColor=vec4(color,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const SEA_VERTEX = `uniform float uTime; varying vec2 vUv; varying float vWave;
  void main(){ vUv=uv; vec3 p=position;
    vWave=sin(p.x*1.4+uTime*1.1)*0.12+sin(p.y*0.85-uTime*0.7)*0.09;
    p.z+=vWave; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`;
const SEA_FRAGMENT = `uniform float uFlash; varying vec2 vUv; varying float vWave;
  void main(){ vec3 color=mix(vec3(0.015,0.065,0.11),vec3(0.05,0.25,0.32),clamp(vWave*2.5+0.25,0.0,1.0));
    color+=vec3(0.3,0.4,0.5)*uFlash;
    gl_FragColor=vec4(color,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const PARTICLE_VERTEX = `uniform float uTime; uniform float uMode; varying float vAlpha;
  void main(){ vec3 p=position;
    if(uMode<0.5){p.y=mod(p.y+uTime*(0.55+fract(position.x)*0.5),7.0);p.x+=sin(uTime+position.z)*0.12;}
    else{p.x+=sin(uTime*0.6+position.z)*0.45;p.y+=sin(uTime*0.9+position.x)*0.28;p.z+=cos(uTime*0.4+position.x)*0.32;}
    vec4 mv=modelViewMatrix*vec4(p,1.0);
    gl_Position=projectionMatrix*mv;
    gl_PointSize=clamp(90.0/max(1.0,-mv.z),2.0,7.0);
    vAlpha=0.55+0.25*sin(position.x*4.0+uTime);
  }`;
const PARTICLE_FRAGMENT = `uniform vec3 uColor; varying float vAlpha;
  void main(){float d=length(gl_PointCoord-0.5)*2.0;if(d>1.0)discard;
    gl_FragColor=vec4(uColor,(1.0-d)*(1.0-d)*vAlpha);
    #include <colorspace_fragment>
  }`;
const RAIN_VERTEX = `uniform float uTime;
  void main(){vec3 p=position;float base=floor(p.y);float tip=fract(p.y);
    p.y=mod(base-uTime*13.0,12.0)-1.0+tip;p.x-=mod(uTime*1.1,24.0);
    p.x=mod(p.x+12.0,24.0)-12.0;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`;

/** Four cosmetic environments. Colosseum geometry remains in arena3d.js;
 * `legacy` wraps that builder without copying its content here. */
export function buildStage(THREE, {id, quality = 'high', parent, legacy = null,
  isReduced = () => false, document = globalThis.document, random = Math.random} = {}) {
  id = normalizeStage(id);
  const group = id === 'colosseum' && legacy ? legacy.group : new THREE.Group();
  if (!legacy || id !== 'colosseum') group.name = `pvp33-stage-${id}`;
  parent?.add(group);
  let scene = parent;
  while (scene && !scene.isScene) scene = scene.parent;
  const previousFog = scene?.fog;
  const theme = THEMES[id];
  const fog = theme ? new THREE.FogExp2(theme.fog, theme.density) : legacy?.fog || previousFog;
  if (scene && fog) scene.fog = fog;
  const ambient = legacy?.ambient || [];
  const uTime = {value: 0}, uFlash = {value: 0};
  const weather = [];
  const pointLights = [];
  let disposed = false, level = quality === 'low' ? 'low' : 'high', clock = 0;
  let flash = null, flashUntil = 0, lightningAt = 6 + random() * 6;
  let floating = null, runeMaterial = null;
  const dummy = new THREE.Object3D();

  function mesh(geometry, material, name, x = 0, y = 0, z = 0) {
    const object = new THREE.Mesh(geometry, material);
    object.name = name; object.position.set(x, y, z); group.add(object);
    return object;
  }
  function standard(color, extra = {}) { return new THREE.MeshStandardMaterial({color, roughness: 0.85, ...extra}); }
  function instances(geometry, material, name, positions) {
    const object = new THREE.InstancedMesh(geometry, material, positions.length);
    object.name = name;
    positions.forEach(([x, y, z, scale = 1], i) => {
      dummy.position.set(x, y, z); dummy.rotation.set(0, i * 1.37, 0); dummy.scale.setScalar(scale);
      dummy.updateMatrix(); object.setMatrixAt(i, dummy.matrix);
    });
    group.add(object); return object;
  }
  function particles(name, high, low, mode, color) {
    const positions = new Float32Array(high * 3);
    for (let i = 0; i < high; i++) {
      positions[i * 3] = Math.sin(i * 2.39996) * (2 + i % 9);
      positions[i * 3 + 1] = 0.4 + (i % 23) / 5;
      positions[i * 3 + 2] = -1 - (i % 37) / 3;
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.ShaderMaterial({vertexShader: PARTICLE_VERTEX, fragmentShader: PARTICLE_FRAGMENT,
      uniforms: {uTime, uMode: {value: mode}, uColor: {value: new THREE.Color(color)}},
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending});
    const object = new THREE.Points(geometry, material); object.name = name; object.frustumCulled = false;
    group.add(object); weather.push({object, high, low});
  }
  function syncWeather() {
    const quiet = Boolean(isReduced());
    for (const {object, high, low} of weather) {
      object.visible = !quiet;
      object.geometry.setDrawRange(0, quiet ? 0 : level === 'low' ? low : high);
    }
    if (quiet && flash) { flash.visible = false; flashUntil = 0; uFlash.value = 0; }
  }

  if (theme) {
    mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT,
      uniforms: {uTop: {value: new THREE.Color(theme.top)}, uHorizon: {value: new THREE.Color(theme.horizon)}, uFlash},
    }), 'pvp33-sky').renderOrder = -10;
    const fill = new THREE.HemisphereLight(theme.ambient, theme.fog, 1.15);
    const key = new THREE.DirectionalLight(0xffeedc, 1.8); key.position.set(2, 7, 6);
    group.add(fill, key);
    ambient.push(...[fill, key].map(light => ({light, base: light.intensity})));
  }

  if (id === 'skyforge') {
    mesh(new THREE.CylinderGeometry(4.5, 3.7, 1.5, 48), standard(0x38262b), 'pvp33-island', 0, -0.75);
    const rocks = Array.from({length: 16}, (_, i) => [Math.cos(i * TAU / 16) * 4.25, -0.35, Math.sin(i * TAU / 16) * 4.25, 0.55 + (i % 3) * 0.12]);
    instances(new THREE.DodecahedronGeometry(0.9, 0), standard(0x482e37), 'pvp33-rock-ring', rocks);
    floating = instances(new THREE.DodecahedronGeometry(1, 0), standard(0x502934), 'pvp33-floating-rocks', [[-7, 3.5, -9, 1.4], [0, 5, -14, 1.1], [7, 2.8, -10, 1.7]]);
    const lava = new THREE.ShaderMaterial({vertexShader: UV_VERTEX, fragmentShader: LAVA_FRAGMENT, uniforms: {uTime}});
    const channel = new THREE.PlaneGeometry(0.32, 7.5);
    for (const x of [-1.9, 1.9]) mesh(channel, lava, 'pvp33-lava-channel', x, 0.008).rotation.x = -Math.PI / 2;
    particles('pvp33-sparks', 300, 120, 0, 0xffa251);
  } else if (id === 'runegarden') {
    mesh(new THREE.CylinderGeometry(4.6, 4.9, 0.5, 48), standard(0x243936), 'pvp33-grass-stone', 0, -0.25);
    instances(new THREE.CylinderGeometry(0.65, 0.75, 0.025, 7), standard(0x59606b), 'pvp33-stepping-stones',
      Array.from({length: 12}, (_, i) => [Math.cos(i * 2.4) * (i % 4 + 0.5), 0.013, Math.sin(i * 2.4) * (i % 4 + 0.5)]));
    runeMaterial = standard(0x393055, {emissive: 0x40e9cf, emissiveIntensity: 0.8, metalness: 0.25});
    instances(new THREE.OctahedronGeometry(0.42, 0).scale(0.7, 1.8, 0.7), runeMaterial, 'pvp33-rune-stones',
      Array.from({length: 8}, (_, i) => [Math.cos(i * TAU / 8) * 5, 0.5, Math.sin(i * TAU / 8) * 5]));
    const trees = [[-7, 0, -6], [-4.8, 0, -9], [4.8, 0, -9], [7, 0, -6]];
    instances(new THREE.CylinderGeometry(0.12, 0.24, 3, 7).translate(0, 1.2, 0), standard(0x111727), 'pvp33-tree-trunks', trees);
    instances(new THREE.ConeGeometry(1.4, 4, 7).translate(0, 3.5, 0), standard(0x0d202b), 'pvp33-tree-crowns', trees);
    particles('pvp33-fireflies', 200, 80, 1, 0x74ffe1);
  } else if (id === 'harbor') {
    let wood = null;
    try {
      const canvas = document?.createElement?.('canvas');
      if (canvas) {
        canvas.width = canvas.height = 512;
        const ctx = canvas.getContext?.('2d');
        if (ctx) {
          ctx.fillStyle = '#493b35'; ctx.fillRect(0, 0, 512, 512);
          for (let y = 0; y < 512; y += 32) {
            ctx.fillStyle = y % 64 ? '#55453c' : '#403834'; ctx.fillRect(0, y, 512, 29);
            ctx.fillStyle = '#211e24'; ctx.fillRect(0, y + 29, 512, 3);
            for (let x = 10; x < 512; x += 64) ctx.fillRect(x, y + 8 + (x % 3), 42, 1);
          }
          wood = new THREE.CanvasTexture(canvas); wood.colorSpace = THREE.SRGBColorSpace; wood.anisotropy = 4;
        }
      }
    } catch { /* Solid planks remain visible if canvas textures are unavailable. */ }
    mesh(new THREE.BoxGeometry(10, 0.35, 7), standard(wood ? 0xffffff : 0x493b35, {map: wood}), 'pvp33-dock', 0, -0.175);
    const sea = mesh(new THREE.PlaneGeometry(100, 80, 64, 48), new THREE.ShaderMaterial({
      vertexShader: SEA_VERTEX, fragmentShader: SEA_FRAGMENT, uniforms: {uTime, uFlash}, side: THREE.DoubleSide,
    }), 'pvp33-sea', 0, -0.6, -24); sea.rotation.x = -Math.PI / 2;
    instances(new THREE.CylinderGeometry(0.07, 0.13, 3.6, 8).translate(0, 1.8, 0), standard(0x242d38), 'pvp33-lamp-posts', [[-4.4, 0, -2], [4.4, 0, -2]]);
    instances(new THREE.BoxGeometry(0.35, 0.5, 0.35), standard(0xffbf78, {emissive: 0xffad53, emissiveIntensity: 2}), 'pvp33-lanterns', [[-4.4, 3.4, -2], [4.4, 3.4, -2]]);
    for (const x of [-4.4, 4.4]) {
      const light = new THREE.PointLight(0xffb76c, 3, 7, 2); light.position.set(x, 3.3, -1.8);
      group.add(light); pointLights.push(light);
    }
    const positions = new Float32Array(600 * 6);
    for (let i = 0; i < 600; i++) {
      const x = Math.sin(i * 2.4) * 12, y = i % 12, z = -12 + (i % 43) * 0.45;
      positions.set([x, y, z, x - 0.045, y + 0.38, z], i * 6);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const rain = new THREE.LineSegments(geometry, new THREE.ShaderMaterial({vertexShader: RAIN_VERTEX,
      fragmentShader: `void main(){gl_FragColor=vec4(0.55,0.72,0.9,0.28);}`, uniforms: {uTime}, transparent: true, depthWrite: false}));
    rain.name = 'pvp33-rain'; rain.frustumCulled = false; group.add(rain); weather.push({object: rain, high: 1200, low: 500});
    flash = new THREE.AmbientLight(0xb6d6ff, 2.3); flash.name = 'pvp33-lightning'; flash.visible = false; group.add(flash);
  }

  function applyQuality(next) {
    if (disposed) return;
    level = next === 'low' ? 'low' : 'high';
    legacy?.applyQuality?.(level);
    for (const light of pointLights) light.visible = level === 'high';
    syncWeather();
  }
  function update(dt, t) {
    if (disposed) return;
    syncWeather();
    const quiet = Boolean(isReduced());
    const step = Math.max(0, Number(dt) || 0);
    if (!quiet) clock += step;
    uTime.value = clock;
    legacy?.update?.(step, clock, quiet);
    if (floating && !quiet) {
      [[-7, 3.5, -9, 1.4], [0, 5, -14, 1.1], [7, 2.8, -10, 1.7]].forEach(([x, y, z, scale], i) => {
        dummy.position.set(x, y + Math.sin(clock * 0.4 + i * 2) * 0.35, z);
        dummy.rotation.set(0.12, clock * 0.06 + i, 0.15); dummy.scale.setScalar(scale); dummy.updateMatrix(); floating.setMatrixAt(i, dummy.matrix);
      });
      floating.instanceMatrix.needsUpdate = true;
    }
    if (runeMaterial) runeMaterial.emissiveIntensity = quiet ? 0.8 : 0.8 + Math.sin(clock * 1.6) * 0.28;
    if (flash && !quiet) {
      if (clock + 1e-6 >= lightningAt) { flashUntil = clock + 0.12; lightningAt = clock + 6 + random() * 6; }
      flash.visible = clock < flashUntil;
      uFlash.value = flash.visible ? 0.7 : 0;
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    const geometries = new Set(), materials = new Set(), textures = new Set();
    group.traverse(object => {
      if (object.isInstancedMesh || object.isLight) object.dispose?.();
      if (object.geometry) geometries.add(object.geometry);
      for (const material of [].concat(object.material || [])) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
        for (const uniform of Object.values(material.uniforms || {})) if (uniform?.value?.isTexture) textures.add(uniform.value);
      }
    });
    for (const item of geometries) item.dispose();
    for (const item of materials) item.dispose();
    for (const item of textures) item.dispose();
    legacy?.dispose?.({geometries, materials, textures});
    group.removeFromParent(); group.clear();
    if (scene && scene.fog === fog) scene.fog = previousFog;
  }
  applyQuality(level);
  return {group, fog, ambient, flash, update, applyQuality, dispose};
}
