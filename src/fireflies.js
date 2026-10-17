import * as THREE from 'three';

const VERT = /* glsl */ `
  uniform float uPR;
  attribute float aAlpha;
  attribute float aScale;
  varying float vA;
  void main() {
    vA = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aScale * uPR / max(0.6, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */ `
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = pow(smoothstep(0.5, 0.0, d), 1.6) * vA;
    float core = smoothstep(0.1, 0.0, d);
    vec3 col = mix(vec3(1.0, 0.8, 0.42), vec3(1.0, 0.97, 0.88), core);
    gl_FragColor = vec4(col * 1.5, a);
    #include <colorspace_fragment>
  }
`;

/** Fireflies live on the CPU so they can be tapped. A caught one fades, then a new one appears elsewhere. */
export function createFireflies(parent, count = 24) {
  const pos = new Float32Array(count * 3);
  const alpha = new Float32Array(count);
  const scale = new Float32Array(count);
  const fl = [];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  g.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
  const u = { uPR: { value: Math.min(window.devicePixelRatio || 1, 1.5) } };
  const pts = new THREE.Points(
    g,
    new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  pts.frustumCulled = false;
  pts.renderOrder = 3;
  parent.add(pts);

  function respawn(f) {
    f.ang = Math.random() * Math.PI * 2;
    f.rad = 2.4 + Math.random() * 5;
    f.y0 = -0.9 + Math.random() * 3.0;
    f.sp = 0.7 + Math.random() * 0.8;
    f.ph = Math.random() * 40;
    f.caught = -1;
  }
  for (let i = 0; i < count; i++) {
    const f = {};
    respawn(f);
    fl.push(f);
  }

  const v = new THREE.Vector3();
  const w = new THREE.Vector3();

  function localPos(f, t, out) {
    return out.set(
      Math.cos(f.ang) * f.rad + Math.sin(t * 0.25 * f.sp + f.ph) * 0.7,
      f.y0 + Math.sin(t * 0.33 * f.sp + f.ph * 2.0) * 0.35,
      Math.sin(f.ang) * f.rad + Math.cos(t * 0.21 * f.sp + f.ph * 1.3) * 0.7
    );
  }

  let lastT = 0;
  return {
    update(t, fade, dt) {
      lastT = t;
      for (let i = 0; i < count; i++) {
        const f = fl[i];
        let a;
        if (f.caught >= 0) {
          f.caught += dt;
          a = 0;
          if (f.caught > 5) respawn(f); // a new one drifts in
        } else {
          a = (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * (1.2 + f.sp) + f.ph * 7.0))) * fade;
        }
        localPos(f, t, v);
        pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
        alpha[i] = a;
        scale[i] = 130 + 45 * f.sp;
      }
      g.attributes.position.needsUpdate = true;
      g.attributes.aAlpha.needsUpdate = true;
      g.attributes.aScale.needsUpdate = true;
    },
    /** Nearest catchable firefly to a screen tap, or -1. Returns {index, world}. */
    pick(px, py, camera, width, height, radius = 54) {
      let best = -1, bd = radius;
      for (let i = 0; i < count; i++) {
        if (fl[i].caught >= 0) continue;
        localPos(fl[i], lastT, v);
        w.copy(v).applyMatrix4(parent.matrixWorld).project(camera);
        if (w.z > 1) continue;
        const sx = (w.x * 0.5 + 0.5) * width, sy = (-w.y * 0.5 + 0.5) * height;
        const d = Math.hypot(sx - px, sy - py);
        if (d < bd) { bd = d; best = i; }
      }
      if (best < 0) return null;
      localPos(fl[best], lastT, v);
      return { index: best, world: v.clone().applyMatrix4(parent.matrixWorld) };
    },
    catchIt(i) { fl[i].caught = 0; },
    setPixelRatio(pr) { u.uPR.value = pr; },
  };
}
