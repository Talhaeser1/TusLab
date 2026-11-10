/** Small, bounded bright-pass bloom for the arena. The scene is rendered once
 * into a target, then composited in one full-screen pass. Low quality and
 * reduced-motion paths in the caller render the scene directly.
 *
 * Paket 33 (netlik): the source target used to be capped at 1600 px / 1.5 MP,
 * 8-bit and without MSAA. On a 1920-wide arena it was drawn at ~69 % size and
 * stretched back up (soft, stair-stepped edges), linear 8-bit stored the dark
 * scene in a handful of levels (banding) and additive effects clipped to flat
 * white. Now the target matches the canvas backing store 1:1, uses 4× MSAA on
 * WebGL2 and half-float HDR when the GPU can render to it, so ACES tone mapping
 * in the composite compresses bright effects instead of clipping them. */

/** Bloom tap spread in canvas pixels per unit of render ratio. */
export const BLOOM_SPREAD = 1.4;
/** MSAA sample count for the scene target (WebGL2 only). */
export const BLOOM_SAMPLES = 4;

function hdrSupported(renderer) {
  try {
    const ext = renderer?.extensions;
    if (typeof ext?.has !== 'function') return false;
    return Boolean(renderer.capabilities?.isWebGL2) &&
      (ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float'));
  } catch {
    return false;
  }
}

export function createArenaBloom({THREE, renderer}) {
  if (!THREE?.WebGLRenderTarget || !THREE?.ShaderMaterial ||
      typeof renderer?.setRenderTarget !== 'function' ||
      typeof renderer?.getRenderTarget !== 'function') return null;

  const hdr = hdrSupported(renderer) && Boolean(THREE.HalfFloatType);
  const msaa = Boolean(renderer?.capabilities?.isWebGL2) ? BLOOM_SAMPLES : 0;
  const target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
    ...(hdr ? {type: THREE.HalfFloatType} : {}),
    ...(msaa ? {samples: msaa} : {}),
  });
  target.texture.name = 'arena3d-bloom-source';
  const uniforms = {
    tScene: {value: target.texture},
    texel: {value: new THREE.Vector2(1, 1)},
    spread: {value: BLOOM_SPREAD},
  };
  const material = new THREE.ShaderMaterial({
    name: 'arena3d-bloom-composite',
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D tScene;
      uniform vec2 texel;
      uniform float spread;
      varying vec2 vUv;
      vec3 bright(vec2 offset) {
        // HDR values are clamped so a stack of additive layers cannot flood the glow.
        vec3 rgb = min(texture2D(tScene, vUv + offset * texel * spread).rgb, vec3(3.0));
        float peak = max(max(rgb.r, rgb.g), rgb.b);
        return rgb * smoothstep(0.62, 1.25, peak);
      }
      void main() {
        // The base sample sits exactly on a texel centre (target = backing store 1:1): no resampling blur.
        vec3 base = texture2D(tScene, vUv).rgb;
        vec3 glow = bright(vec2(0.0)) * 0.16;
        glow += bright(vec2( 3.0, 0.0)) * 0.11;
        glow += bright(vec2(-3.0, 0.0)) * 0.11;
        glow += bright(vec2(0.0,  3.0)) * 0.11;
        glow += bright(vec2(0.0, -3.0)) * 0.11;
        glow += bright(vec2( 6.0,  6.0)) * 0.10;
        glow += bright(vec2(-6.0,  6.0)) * 0.10;
        glow += bright(vec2( 6.0, -6.0)) * 0.10;
        glow += bright(vec2(-6.0, -6.0)) * 0.10;
        gl_FragColor = vec4(base + glow * 0.5, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const passScene = new THREE.Scene();
  passScene.add(quad);
  const passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let width = 1;
  let height = 1;
  let disposed = false;

  return {
    target,
    hdr,
    samples: msaa,
    size: () => ({width, height}),
    setSize(cssWidth, cssHeight, ratio) {
      if (disposed) return;
      const r = Number(ratio) > 0 ? Number(ratio) : 1;
      // Same rounding as WebGLRenderer.setSize → the target equals the drawing buffer.
      width = Math.max(1, Math.floor(cssWidth * r));
      height = Math.max(1, Math.floor(cssHeight * r));
      target.setSize(width, height);
      uniforms.texel.value.set(1 / width, 1 / height);
      uniforms.spread.value = BLOOM_SPREAD * Math.max(1, r);
    },
    render(scene, camera) {
      if (disposed) return;
      const previous = renderer.getRenderTarget();
      try {
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
        renderer.setRenderTarget(previous);
        // Three.js reports shader link failures through this callback without
        // throwing. Watch only the composite pass so scene shader diagnostics
        // do not disable bloom by mistake.
        const debug = renderer.debug;
        const oldHandler = debug?.onShaderError;
        const oldCheck = debug?.checkShaderErrors;
        let shaderFailed = false;
        if (debug) {
          debug.checkShaderErrors = true;
          debug.onShaderError = (...args) => {
            shaderFailed = true;
            oldHandler?.(...args);
          };
        }
        try {
          renderer.render(passScene, passCamera);
          if (shaderFailed) throw new Error('Bloom shader failed to link');
        } finally {
          if (debug) {
            debug.onShaderError = oldHandler;
            debug.checkShaderErrors = oldCheck;
          }
        }
      } finally {
        renderer.setRenderTarget(previous);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      target.dispose();
      quad.geometry.dispose();
      material.dispose();
    },
  };
}
