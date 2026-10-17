import * as THREE from 'three';

function petalTexture() {
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.translate(S / 2, S / 2);
  const gr = g.createLinearGradient(0, -26, 0, 26);
  gr.addColorStop(0, '#ffffff');
  gr.addColorStop(1, '#ffb3c6');
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(0, -26);
  g.bezierCurveTo(22, -18, 20, 14, 0, 26);
  g.bezierCurveTo(-20, 14, -22, -18, 0, -26);
  g.fill();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const VERT = /* glsl */ `
  uniform float uTime, uFall, uGust, uSize, uPR;
  attribute vec4 aSeed;
  varying float vRot;
  varying float vTint;
  void main() {
    float fall = 0.18 + aSeed.x * 0.28;
    vec3 p;
    p.x = (aSeed.y - 0.5) * 11.0 + sin(uTime * 0.45 + aSeed.z * 6.28) * 0.9;
    p.z = (aSeed.z - 0.5) * 11.0 + cos(uTime * 0.33 + aSeed.w * 6.28) * 0.9;
    p.y = 5.0 - mod(aSeed.w * 6.5 + uFall * fall * 2.0, 6.5);
    // gust: petals sweep sideways in long curls
    p.x += uGust * (sin(uTime * 1.4 + aSeed.w * 6.28) * 2.6 + 1.6);
    p.z += uGust * cos(uTime * 1.1 + aSeed.x * 6.28) * 2.0;
    vRot = aSeed.y * 6.28 + uTime * (0.5 + aSeed.z) * (1.0 + uGust * 1.5);
    vTint = aSeed.x;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * uPR * (0.55 + aSeed.x) * (1.0 + 0.3 * uGust) / max(0.6, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uFade;
  varying float vRot;
  varying float vTint;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float s = sin(vRot), co = cos(vRot);
    c = vec2(co * c.x - s * c.y, s * c.x + co * c.y) + 0.5;
    vec4 t = texture2D(uMap, c);
    if (t.a < 0.02) discard;
    vec3 col = t.rgb * mix(vec3(1.0), vec3(1.0, 0.86, 0.9), vTint);
    gl_FragColor = vec4(col, t.a * 0.92 * uFade);
    #include <colorspace_fragment>
  }
`;

export function createPetals(parent, max = 340) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
  const seed = new Float32Array(max * 4);
  for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const u = {
    uTime: { value: 0 }, uFall: { value: 0 }, uGust: { value: 0 }, uFade: { value: 0 }, uSize: { value: 62 },
    uPR: { value: Math.min(window.devicePixelRatio || 1, 1.5) }, uMap: { value: petalTexture() },
  };
  const pts = new THREE.Points(
    g,
    new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false })
  );
  pts.frustumCulled = false;
  pts.renderOrder = 4;
  parent.add(pts);

  let base = 180;
  let gustLeft = 0;
  const GUST = 3.6;
  g.setDrawRange(0, base);

  return {
    update(t, fade, dt) {
      u.uTime.value = t;
      u.uFade.value = fade;
      let env = 0;
      if (gustLeft > 0) {
        gustLeft = Math.max(0, gustLeft - dt);
        env = Math.sin(Math.PI * (1 - gustLeft / GUST));
      }
      u.uGust.value = env;
      u.uFall.value += dt * (1 + env * 2.2);
      g.setDrawRange(0, Math.min(max, Math.round(base + env * 150)));
    },
    gust() { gustLeft = GUST; },
    setPixelRatio(pr) { u.uPR.value = pr; },
    thin() { base = 100; },
  };
}
