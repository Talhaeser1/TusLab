/** Small, bounded bright-pass bloom for the arena. The scene is rendered once
 * into a target, then composited in one full-screen pass. Low quality and
 * reduced-motion paths in the caller render the scene directly. */
export function createArenaBloom({THREE, renderer}) {
  if (!THREE?.WebGLRenderTarget || !THREE?.ShaderMaterial ||
      typeof renderer?.setRenderTarget !== 'function' ||
      typeof renderer?.getRenderTarget !== 'function') return null;

  const target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.texture.name = 'arena3d-bloom-source';
  const uniforms = {
    tScene: {value: target.texture},
    texel: {value: new THREE.Vector2(1, 1)},
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
      varying vec2 vUv;
      vec3 bright(vec2 offset) {
        vec3 rgb = texture2D(tScene, vUv + offset * texel).rgb;
        float peak = max(max(rgb.r, rgb.g), rgb.b);
        return rgb * smoothstep(0.58, 1.1, peak);
      }
      void main() {
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
        gl_FragColor = vec4(base + glow * 0.55, 1.0);
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
    size: () => ({width, height}),
    setSize(cssWidth, cssHeight, ratio) {
      if (disposed) return;
      const scale = Math.min(1, 1600 / Math.max(cssWidth * ratio, cssHeight * ratio),
        Math.sqrt(1_500_000 / (cssWidth * cssHeight * ratio * ratio)));
      width = Math.max(1, Math.round(cssWidth * ratio * scale));
      height = Math.max(1, Math.round(cssHeight * ratio * scale));
      target.setSize(width, height);
      uniforms.texel.value.set(1 / width, 1 / height);
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
