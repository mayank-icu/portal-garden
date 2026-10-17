import * as THREE from 'three';

function drawFlower(petal, centre) {
  const S = 128, R = S / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.translate(R, R);
  g.shadowColor = 'rgba(232,93,117,0.35)';
  g.shadowBlur = 8;
  for (let i = 0; i < 6; i++) {
    g.rotate((Math.PI * 2) / 6);
    const gr = g.createLinearGradient(0, 0, 0, -50);
    gr.addColorStop(0, centre);
    gr.addColorStop(0.35, petal);
    gr.addColorStop(1, '#ffffff');
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(0, -30, 15, 26, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.shadowBlur = 0;
  g.fillStyle = '#FFD27D';
  g.beginPath();
  g.arc(0, 0, 10, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff3c9';
  g.beginPath();
  g.arc(-3, -3, 4, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowTex(stops) {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const easeOutBack = (x) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);

/** Tap-to-bloom flowers: a pooled set of billboard sprites that scale in with a sparkle. */
export function createBlooms(parent) {
  const mats = [
    ['#FFB3C6', '#E85D75'], ['#FFD1DC', '#f59ab1'], ['#CDB4FF', '#a98be8'], ['#FFE8A8', '#FFD27D'],
  ].map(([p, c]) => new THREE.SpriteMaterial({ map: drawFlower(p, c), transparent: true, depthTest: false, depthWrite: false }));
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex([[0, 'rgba(255,255,255,0.95)'], [0.4, 'rgba(255,214,150,0.5)'], [1, 'rgba(255,214,150,0)']]),
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });

  const N = 28;
  const pool = [];
  for (let i = 0; i < N; i++) {
    const f = new THREE.Sprite(mats[i % mats.length]);
    const gl = new THREE.Sprite(glowMat.clone());
    f.visible = gl.visible = false;
    f.renderOrder = 6;
    gl.renderOrder = 7;
    parent.add(f, gl);
    pool.push({ f, gl, t: -1, s: 1 });
  }
  let next = 0;
  const tmp = new THREE.Vector3();

  return {
    bloom(worldPos) {
      const it = pool[next++ % N];
      it.t = 0;
      it.s = 0.55 + Math.random() * 0.35;
      tmp.copy(worldPos);
      parent.worldToLocal(tmp);
      it.f.position.copy(tmp);
      it.gl.position.copy(tmp);
      it.f.material.rotation = (Math.random() - 0.5) * 0.8;
      it.f.visible = it.gl.visible = true;
      it.f.scale.setScalar(0.001);
    },
    update(dt) {
      for (const it of pool) {
        if (it.t < 0) continue;
        it.t += dt;
        it.f.scale.setScalar(it.s * easeOutBack(Math.min(1, it.t / 0.75)));
        const k = Math.min(1, it.t / 1.0);
        it.gl.scale.setScalar(it.s * (1.4 + 2.2 * k));
        it.gl.material.opacity = (1 - k) * 0.95;
        if (k >= 1) it.gl.visible = false;
      }
    },
    clear() {
      for (const it of pool) { it.t = -1; it.f.visible = it.gl.visible = false; }
    },
  };
}

/** Glowing floating heart that carries her message. */
export function createHeart(parent) {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.translate(S / 2, S / 2 + 6);
  g.shadowColor = 'rgba(255,120,160,0.95)';
  g.shadowBlur = 40;
  const gr = g.createLinearGradient(0, -70, 0, 80);
  gr.addColorStop(0, '#ffb3c6');
  gr.addColorStop(1, '#E85D75');
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(0, 70);
  g.bezierCurveTo(-95, 5, -70, -75, 0, -35);
  g.bezierCurveTo(70, -75, 95, 5, 0, 70);
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath();
  g.ellipse(-32, -30, 14, 8, -0.6, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const heart = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false }));
  heart.renderOrder = 8;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex([[0, 'rgba(255,170,200,0.7)'], [1, 'rgba(255,170,200,0)']]),
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  halo.scale.setScalar(3.2);
  halo.renderOrder = 7;
  heart.add(halo);
  parent.add(heart);
  return heart;
}

/** Little expanding glows: the "caught it" flash when a firefly is tapped. */
export function createSparks(parent) {
  const tex = glowTex([[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,224,150,0.7)'], [1, 'rgba(255,214,150,0)']]);
  const N = 12;
  const pool = [];
  for (let i = 0; i < N; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.visible = false;
    s.renderOrder = 7;
    parent.add(s);
    pool.push({ s, t: -1 });
  }
  let next = 0;
  const tmp = new THREE.Vector3();
  return {
    spark(worldPos) {
      const it = pool[next++ % N];
      it.t = 0;
      parent.worldToLocal(tmp.copy(worldPos));
      it.s.position.copy(tmp);
      it.s.visible = true;
    },
    update(dt) {
      for (const it of pool) {
        if (it.t < 0) continue;
        it.t += dt;
        const k = Math.min(1, it.t / 0.9);
        it.s.scale.setScalar(0.25 + 1.4 * k);
        it.s.material.opacity = (1 - k) * (1 - k);
        if (k >= 1) { it.s.visible = false; it.t = -1; }
      }
    },
  };
}

/** Wish lanterns: released from the ground in front of her, they drift up into the sky. */
export function createLanterns(parent) {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.translate(S / 2, S / 2);
  g.shadowColor = 'rgba(255,190,120,0.9)';
  g.shadowBlur = 16;
  const gr = g.createLinearGradient(0, -34, 0, 38);
  gr.addColorStop(0, '#FFE9B8');
  gr.addColorStop(0.6, '#FFC98A');
  gr.addColorStop(1, '#F2A0A8');
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(-17, -32);
  g.lineTo(17, -32);
  g.bezierCurveTo(30, -10, 30, 20, 19, 36);
  g.lineTo(-19, 36);
  g.bezierCurveTo(-30, 20, -30, -10, -17, -32);
  g.fill();
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(166,66,88,0.35)';
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(-17, -32); g.bezierCurveTo(-8, -8, -8, 20, -10, 36);
  g.moveTo(17, -32); g.bezierCurveTo(8, -8, 8, 20, 10, 36);
  g.moveTo(0, -32); g.lineTo(0, 36);
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath();
  g.ellipse(0, 22, 9, 6, 0, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const halo = glowTex([[0, 'rgba(255,200,130,0.65)'], [1, 'rgba(255,200,130,0)']]);

  const N = 12;
  const LIFE = 30;
  const pool = [];
  for (let i = 0; i < N; i++) {
    const body = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    body.visible = gl.visible = false;
    body.renderOrder = 6;
    gl.renderOrder = 5;
    parent.add(body, gl);
    pool.push({ body, gl, t: -1, x: 0, y: 0, z: 0, ph: 0 });
  }
  let next = 0;
  const tmp = new THREE.Vector3();
  return {
    launch(worldPos) {
      const it = pool[next++ % N];
      it.t = 0;
      it.ph = Math.random() * 6.28;
      parent.worldToLocal(tmp.copy(worldPos));
      it.x = tmp.x; it.y = tmp.y; it.z = tmp.z;
      it.body.visible = it.gl.visible = true;
    },
    update(dt, fade) {
      for (const it of pool) {
        if (it.t < 0) continue;
        it.t += dt;
        const k = it.t / LIFE;
        const rise = it.t * (0.5 + 0.25 * k);
        const x = it.x + Math.sin(it.t * 0.5 + it.ph) * 0.35 * Math.min(1, it.t / 6);
        const y = it.y + rise;
        const z = it.z - it.t * 0.06;
        it.body.position.set(x, y, z);
        it.gl.position.set(x, y, z);
        const a = Math.min(1, it.t / 1.2) * Math.min(1, (1 - k) * 5) * fade;
        const flick = 0.9 + 0.1 * Math.sin(it.t * 7 + it.ph);
        it.body.scale.setScalar(0.5);
        it.body.material.opacity = a;
        it.gl.scale.setScalar(1.9 * flick);
        it.gl.material.opacity = a * 0.9;
        if (k >= 1) { it.t = -1; it.body.visible = it.gl.visible = false; }
      }
    },
    clear() { for (const it of pool) { it.t = -1; it.body.visible = it.gl.visible = false; } },
  };
}
