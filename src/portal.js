import * as THREE from 'three';

const W = 1.25; // door width (m)
const H = 2.4; // door height (m)
const DIST = 3.3; // distance in front of her
const FLOOR = -1.3; // door bottom relative to eye height

function archShape(w, h, y0 = 0, Ctor = THREE.Shape) {
  const r = w / 2;
  const s = new Ctor();
  s.moveTo(-r, y0);
  s.lineTo(-r, y0 + h - r);
  s.absarc(0, y0 + h - r, r, Math.PI, 0, true);
  s.lineTo(r, y0);
  s.closePath();
  return s;
}
function ringShape(w, h, t) {
  const outer = archShape(w + t * 2, h + t);
  outer.holes.push(archShape(w, h - t, t, THREE.Path));
  return outer;
}

const VERT = /* glsl */ `
  varying vec3 vP;
  void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// Inside of the door: a peek of the blossom world, softly veiled by a pink/lavender swirl.
const INNER_FRAG = /* glsl */ `
  uniform float uTime, uHasMap, uOpacity, uW, uH;
  uniform sampler2D uMap;
  uniform vec3 uBlush, uLav, uGold;
  varying vec3 vP;
  const float PI = 3.14159265;
  void main() {
    vec2 q = vec2(vP.x / (uW * 0.5), (vP.y - uH * 0.5) / (uH * 0.5));
    float r = length(q);
    float a = atan(q.y, q.x);

    vec3 dir = normalize(vec3(vP.x * 0.9, (vP.y - uH * 0.5) * 0.5, -1.0));
    vec2 uv = vec2(atan(dir.x, -dir.z) / (2.0 * PI) + 0.5, asin(clamp(dir.y, -1.0, 1.0)) / PI + 0.5);
    vec3 pano = texture2D(uMap, uv).rgb;
    pano *= vec3(1.08, 0.96, 0.97);
    pano = mix(pano, uBlush, 0.12);

    float s = 0.5 + 0.5 * sin(a * 3.0 + r * 6.0 - uTime * 1.6);
    vec3 sw = mix(uBlush, uLav, s);
    sw = mix(sw, uGold, smoothstep(0.6, 1.0, 0.5 + 0.5 * sin(r * 9.0 - uTime * 2.0)) * 0.35);

    vec3 col = mix(sw, pano, uHasMap * 0.84);
    float swirlVeil = 0.08 + 0.06 * sin(a * 2.0 - uTime * 1.0 + r * 4.0);
    col = mix(col, sw, swirlVeil);
    float edge = smoothstep(0.55, 1.0, max(abs(q.x), r * 0.92));
    col = mix(col, vec3(1.0, 0.95, 0.9), edge * 0.35);

    gl_FragColor = vec4(col, uOpacity);
    #include <colorspace_fragment>
  }
`;

const RIM_FRAG = /* glsl */ `
  uniform float uTime, uOpacity;
  uniform vec3 uBlush, uGold;
  varying vec3 vP;
  void main() {
    float k = 0.5 + 0.5 * sin(vP.y * 1.6 + uTime * 0.9);
    vec3 col = mix(uGold, vec3(1.0, 0.96, 0.88), k * 0.6) * (0.92 + 0.08 * sin(uTime * 1.6));
    gl_FragColor = vec4(col, uOpacity * 0.95);
    #include <colorspace_fragment>
  }
`;

function glowTexture() {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,205,225,0.95)');
  gr.addColorStop(0.5, 'rgba(255,170,205,0.35)');
  gr.addColorStop(1, 'rgba(255,170,205,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function starTexture() {
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,230,190,0.9)');
  gr.addColorStop(1, 'rgba(255,210,125,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fillRect(S / 2 - 1, 6, 2, S - 12);
  g.fillRect(6, S / 2 - 1, S - 12, 2);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createPortal(scene, colors) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const U = {
    uTime: { value: 0 }, uMap: { value: null }, uHasMap: { value: 0 }, uOpacity: { value: 0 },
    uW: { value: W }, uH: { value: H },
    uBlush: { value: new THREE.Color(colors.blush) },
    uLav: { value: new THREE.Color(colors.lavender) },
    uGold: { value: new THREE.Color(colors.gold) },
  };

  const inner = new THREE.Mesh(
    new THREE.ShapeGeometry(archShape(W, H), 24),
    new THREE.ShaderMaterial({
      uniforms: U, vertexShader: VERT, fragmentShader: INNER_FRAG,
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    })
  );
  inner.renderOrder = 11;
  group.add(inner);

  const rim = new THREE.Mesh(
    new THREE.ShapeGeometry(ringShape(W, H, 0.045), 24).translate(0, 0, 0.004),
    new THREE.ShaderMaterial({
      uniforms: U, vertexShader: VERT, fragmentShader: RIM_FRAG,
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    })
  );
  rim.renderOrder = 12;
  group.add(rim);

  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTexture(), transparent: true, opacity: 0, depthTest: false, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(W * 3.4, H * 1.7), glowMat);
  glow.position.set(0, H * 0.5, -0.03);
  glow.renderOrder = 9;
  group.add(glow);

  // sparkles drifting around the rim
  const N = 26;
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    seed[i * 3] = Math.random() * Math.PI * 2;
    seed[i * 3 + 1] = 0.15 + Math.random() * 0.35;
    seed[i * 3 + 2] = Math.random() * 6.28;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sparkMat = new THREE.PointsMaterial({
    map: starTexture(), size: 0.085, sizeAttenuation: true, transparent: true, opacity: 0,
    depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xfff0d8,
  });
  const sparkles = new THREE.Points(sg, sparkMat);
  sparkles.frustumCulled = false;
  sparkles.renderOrder = 13;
  group.add(sparkles);

  let o = 0;
  let target = 0;
  const center = new THREE.Vector3();
  let yawRot = 0;

  function spawn(fwd) {
    group.position.set(fwd.x * DIST, FLOOR, fwd.z * DIST);
    group.lookAt(0, FLOOR, 0); // +Z of the door faces her
    center.set(fwd.x * DIST, 0, fwd.z * DIST);
    yawRot = Math.atan2(-fwd.x, -fwd.z);
    group.visible = true;
    target = 1;
  }

  function update(dt, t) {
    if (!group.visible) return;
    o += (target - o) * Math.min(1, dt * 2.6);
    if (target === 0 && o < 0.004) { o = 0; group.visible = false; }
    U.uTime.value = t;
    U.uOpacity.value = o;
    glowMat.opacity = 0.32 * o * (0.85 + 0.15 * Math.sin(t * 2));
    sparkMat.opacity = o;
    group.scale.setScalar(0.88 + 0.12 * o);
    const cy = H * 0.5;
    for (let i = 0; i < N; i++) {
      const th = seed[i * 3] + t * seed[i * 3 + 1];
      const rx = W * 0.5 + 0.18 + 0.22 * Math.sin(t * 0.9 + seed[i * 3 + 2]);
      const ry = H * 0.5 + 0.18 + 0.22 * Math.sin(t * 0.7 + seed[i * 3 + 2] * 2.0);
      pos[i * 3] = Math.cos(th) * rx;
      pos[i * 3 + 1] = Math.max(0.02, cy + Math.sin(th) * ry);
      pos[i * 3 + 2] = 0.05 + 0.12 * Math.sin(seed[i * 3 + 2] + t);
    }
    sg.attributes.position.needsUpdate = true;
  }

  return {
    group, inner, center,
    get yawRot() { return yawRot; },
    get visible() { return group.visible; },
    spawn, update,
    setMap(tex) { U.uMap.value = tex; U.uHasMap.value = 1; },
    hide() { target = 0; },
    hideNow() { target = 0; o = 0; U.uOpacity.value = 0; group.visible = false; },
  };
}
