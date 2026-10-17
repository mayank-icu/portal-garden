import * as THREE from 'three';
import config from './config.js';

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Equirectangular lookup done by hand so mapping, tripod patch and colour grade are all in one place.
// Texture centre (u = 0.5) is straight ahead (-Z), which is where the pagoda sits.
const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uFade;
  uniform vec3 uBlush;
  uniform vec3 uCream;
  uniform vec3 uGround;
  varying vec3 vDir;
  const float PI = 3.14159265;

  void main() {
    vec3 d = normalize(vDir);
    vec2 uv = vec2(atan(d.x, -d.z) / (2.0 * PI) + 0.5, asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5);
    float vt = 1.0 - uv.y; // 0 at the top of the photo, 1 at the bottom

    // 1) Remove the thin tripod-pole shadow: clone grass from just to its right.
    float t = clamp((vt - 0.59) / 0.31, 0.0, 1.0);
    float cx = mix(0.5348, 0.5373, t);
    float hw = mix(0.0032, 0.0065, smoothstep(0.0, 0.8, t));
    float m = (1.0 - smoothstep(hw, hw + 0.0025, abs(uv.x - cx))) * smoothstep(0.585, 0.60, vt);
    vec3 a = texture2D(uMap, uv).rgb;
    vec3 b = texture2D(uMap, vec2(uv.x + hw + 0.0065, uv.y)).rgb;
    vec3 c = mix(a, b, m);

    // 2) Colour grade: warmer, softly pink, a little dreamy glow. Cooler blues are lifted toward blush.
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c *= vec3(1.08, 0.96, 0.97);
    c += uBlush * 0.10 * (1.0 - l);
    c = mix(c * 1.12, uCream, 0.07);

    // 3) Fade the ground toward soft pink; a flower patch sits on top of the very bottom.
    float nf = 1.0 - smoothstep(-0.85, -0.50, d.y);
    c = mix(c, uGround, nf * 0.78);

    gl_FragColor = vec4(c, uFade);
    #include <colorspace_fragment>
  }
`;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Procedural flower-covered ground patch with a soft round edge (no image file needed). */
function makeFlowerPatch() {
  const S = 512, R = S / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const rnd = mulberry32(7);

  const base = g.createRadialGradient(R, R, 0, R, R, R);
  base.addColorStop(0, '#f6cfd6');
  base.addColorStop(1, '#ebc3c5');
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);

  const cols = ['#ffffff', '#FFD1DC', '#fbb6c8', '#CDB4FF', '#fff6e5'];
  function flower(x, y, r) {
    const col = cols[(rnd() * cols.length) | 0];
    const rot = rnd() * Math.PI * 2;
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.fillStyle = col;
    g.shadowColor = 'rgba(232,93,117,0.25)';
    g.shadowBlur = r * 0.5;
    for (let i = 0; i < 5; i++) {
      g.rotate((Math.PI * 2) / 5);
      g.beginPath();
      g.ellipse(0, -r * 0.55, r * 0.42, r * 0.62, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.shadowBlur = 0;
    g.fillStyle = '#FFD27D';
    g.beginPath();
    g.arc(0, 0, r * 0.28, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // dense near the centre, sparser outward
  for (let i = 0; i < 420; i++) {
    const ang = rnd() * Math.PI * 2;
    const rad = Math.sqrt(rnd()) * R * 0.95;
    const size = 6 + rnd() * 9;
    flower(R + Math.cos(ang) * rad, R + Math.sin(ang) * rad, size);
  }
  // soft round edge
  g.globalCompositeOperation = 'destination-in';
  const mask = g.createRadialGradient(R, R, R * 0.35, R, R, R);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mask;
  g.fillRect(0, 0, S, S);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWorld(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const c = config.colors;
  const uniforms = {
    uMap: { value: null },
    uFade: { value: 0 },
    uBlush: { value: new THREE.Color(c.blush) },
    uCream: { value: new THREE.Color(c.cream) },
    uGround: { value: new THREE.Color('#EBC3C5') },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(60, 48, 32),
    new THREE.ShaderMaterial({
      uniforms, vertexShader: VERT, fragmentShader: FRAG,
      side: THREE.BackSide, transparent: true, depthWrite: false, depthTest: false,
    })
  );
  sky.renderOrder = 0;
  group.add(sky);

  const patchMat = new THREE.MeshBasicMaterial({
    map: makeFlowerPatch(), transparent: true, opacity: 0, depthWrite: false, color: 0xfff3f3,
  });
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), patchMat);
  patch.rotation.x = -Math.PI / 2;
  patch.position.y = -1.6;
  patch.renderOrder = 1;
  group.add(patch);

  let target = 0;
  let loadPromise = null;

  function loadTexture(url) {
    return new Promise((res, rej) => new THREE.TextureLoader().load(url, res, undefined, rej));
  }

  /** Start loading the panorama (call early, e.g. while she looks at the portal). */
  function load() {
    if (loadPromise) return loadPromise;
    const fallback = config.panorama.replace(/\.webp$/, '.jpg');
    loadPromise = loadTexture(config.panorama)
      .catch(() => loadTexture(fallback))
      .then((tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = false; // no seam line at the wrap, less memory
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        uniforms.uMap.value = tex;
        return tex;
      });
    return loadPromise;
  }

  async function show() {
    await load();
    group.visible = true;
    target = 1;
  }
  function hide() {
    target = 0;
  }

  function update(dt) {
    const cur = uniforms.uFade.value;
    if (cur === target) return;
    const next = cur + Math.sign(target - cur) * Math.min(Math.abs(target - cur), dt / 1.8);
    uniforms.uFade.value = next;
    patchMat.opacity = next;
    if (next === 0) group.visible = false;
  }

  function dispose() {
    sky.geometry.dispose(); sky.material.dispose();
    patch.geometry.dispose(); patchMat.map.dispose(); patchMat.dispose();
    if (uniforms.uMap.value) uniforms.uMap.value.dispose();
    scene.remove(group);
  }

  function setFade(v) {
    uniforms.uFade.value = v;
    patchMat.opacity = v;
    target = v;
    group.visible = v > 0;
  }

  return {
    group, load, show, hide, update, dispose, setFade,
    get visible() { return group.visible; },
    get fade() { return uniforms.uFade.value; },
    get ready() { return !!uniforms.uMap.value; },
  };
}
