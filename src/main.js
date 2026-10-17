import * as THREE from 'three';
import config from './config.js';
import { requestAll, isInAppBrowser } from './permissions.js';
import { showCamera } from './camera.js';
import { OrientationControls } from './orientation.js';
import { createWorld } from './world.js';
import { createPetals } from './petals.js';
import { createFireflies } from './fireflies.js';
import { createBlooms, createHeart, createSparks, createLanterns } from './flowers.js';
import { createPortal } from './portal.js';
import { fadeInMusic, fadeOutMusic, setMuted, isMuted, portalSound, tinkle, wishSound, gustSound } from './audio.js';
import * as ui from './ui.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const DIRECT_WORLD = params.has('world'); // dev shortcut: skip the portal

// Any failure shows up on screen instead of silently leaving a blank page.
window.addEventListener('error', (e) => ui.showNote('Something went wrong: ' + (e.message || 'unknown')));
window.addEventListener('unhandledrejection', (e) => ui.showNote('Something went wrong: ' + ((e.reason && e.reason.message) || e.reason)));

// ---------- renderer / scene ----------
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
const controls = new OrientationControls(camera, canvas);

const world = createWorld(scene);
const petals = createPetals(world.group);
const fireflies = createFireflies(world.group, 24);
const blooms = createBlooms(world.group);
const sparks = createSparks(world.group);
const lanterns = createLanterns(world.group);
const heart = createHeart(world.group);
const HEART_BASE = new THREE.Vector3(Math.sin(0.7) * 3.4, 0.35, -Math.cos(0.7) * 3.4);
heart.position.copy(HEART_BASE);
const portal = createPortal(scene, config.colors);

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

// ---------- state machine ----------
// start -> scan -> portal -> step -> world -> (exit) -> portal ...
let state = 'start';
let stepT = 0;
let worldT = 0;
let lookT = 0;
let msgShown = false;
let msgOpen = false;
let caught = 0;
const timers = [];
const STEP_DUR = 2.2;
const fwd = new THREE.Vector3();
const tmp = new THREE.Vector3();

function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
function clearTimers() { while (timers.length) clearTimeout(timers.pop()); }

function spawnPortal() {
  camera.getWorldDirection(fwd);
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
  fwd.normalize();
  portal.spawn(fwd);
  world.load().then((tex) => portal.setMap(tex)).catch(() => {});
  state = 'portal';
  ui.setMood(true);
  ui.showHint(config.hintPortal);
}

function startStep() {
  if (state !== 'portal') return;
  state = 'step';
  stepT = 0;
  ui.hideHint();
  world.load().catch(() => {});
  fadeInMusic(3.5);
  portalSound();
}

// Gentle onboarding: one idea at a time, each shown for a few seconds.
function scheduleHints() {
  const seq = [
    [2500, config.hintBloom],
    [9500, config.hintFireflies],
    [16500, config.hintGust],
    [23500, config.hintWish],
    [31000, config.hintHeart],
  ];
  seq.forEach(([ms, text]) => {
    later(() => { if (state === 'world' && !msgOpen) ui.showHint(text); }, ms);
    later(() => ui.hideHint(), ms + 5000);
  });
}

function enterWorld(direct = false) {
  camera.position.set(0, 0, 0);
  world.group.rotation.y = direct ? 0 : portal.yawRot; // the pagoda ends up where the door was
  portal.hideNow();
  world.setFade(1);
  blooms.clear();
  lanterns.clear();
  ui.setMood(false);
  state = 'world';
  worldT = 0;
  lookT = 0;
  msgShown = false;
  msgOpen = false;
  caught = 0;
  ui.setCaught(0);
  ui.showWorldControls(true);
  if (direct) fadeInMusic(3);
  later(() => ui.flash(false), 150);
  scheduleHints();
}

function showMsg() {
  if (msgShown) return;
  msgShown = true;
  msgOpen = true;
  ui.hideHint();
  ui.showMessage(config.message, config.signedBy, config.herName);
}

function exitWorld() {
  if (state !== 'world') return;
  state = 'exiting';
  clearTimers();
  ui.hideMessage();
  ui.hideHint();
  ui.showWorldControls(false);
  fadeOutMusic(1.6);
  world.hide();
  later(() => { blooms.clear(); lanterns.clear(); spawnPortal(); }, 2000);
}

function ahead(dist, y) {
  camera.getWorldDirection(fwd);
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
  fwd.normalize();
  return new THREE.Vector3(fwd.x * dist, y, fwd.z * dist);
}
function releaseLantern() {
  if (state !== 'world') return;
  lanterns.launch(ahead(4.2, -1.3));
  wishSound();
  ui.hideHint();
  ui.showHint('Your wish is on its way');
  later(() => ui.hideHint(), 3500);
}

// ---------- taps and holds ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1.4); // ground 1.4 m below the eyes
const hit = new THREE.Vector3();
let downX = 0, downY = 0, downT = 0, holdTimer = 0, holdFired = false;

canvas.addEventListener('pointerdown', (e) => {
  downX = e.clientX; downY = e.clientY; downT = performance.now(); holdFired = false;
  clearTimeout(holdTimer);
  if (state === 'world') {
    holdTimer = setTimeout(() => {
      holdFired = true;
      petals.gust();
      gustSound();
    }, 480);
  }
});
window.addEventListener('pointermove', (e) => {
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 12) clearTimeout(holdTimer);
});
canvas.addEventListener('pointerup', (e) => {
  clearTimeout(holdTimer);
  if (holdFired) return;
  const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
  if (moved > 12 || performance.now() - downT > 480) return; // a drag, not a tap
  onTap(e.clientX, e.clientY);
});

function onTap(x, y) {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);

  if (state === 'portal') {
    const onDoor = raycaster.intersectObject(portal.inner, false).length > 0;
    camera.getWorldDirection(fwd);
    tmp.copy(portal.center).setY(0).normalize();
    if (onDoor || fwd.angleTo(tmp) < 0.7) startStep();
    return;
  }

  if (state !== 'world') return;

  // 1. the heart opens the message
  heart.getWorldPosition(tmp).normalize();
  if (raycaster.ray.direction.angleTo(tmp) < 0.25) { showMsg(); return; }

  // 2. a firefly
  const f = fireflies.pick(x, y, camera, window.innerWidth, window.innerHeight);
  if (f) {
    fireflies.catchIt(f.index);
    sparks.spark(f.world);
    tinkle(caught);
    caught++;
    ui.setCaught(caught);
    if (caught % 10 === 0) {
      ui.hideHint();
      ui.showHint(`${caught} fireflies. Make a wish.`);
      lanterns.launch(ahead(4.2, -1.3));
      wishSound();
      later(() => ui.hideHint(), 4500);
    }
    return;
  }

  // 3. otherwise a flower blooms
  const dir = raycaster.ray.direction;
  if (dir.y < -0.08 && raycaster.ray.intersectPlane(plane, hit) && hit.length() < 9) blooms.bloom(hit);
  else blooms.bloom(tmp.copy(dir).multiplyScalar(4.2));
}

ui.initControls({
  onMute: () => { setMuted(!isMuted()); return isMuted(); },
  onExit: exitWorld,
  onWish: releaseLantern,
});
ui.onMessageTap(() => { ui.hideMessage(); msgOpen = false; });

// ---------- render loop ----------
let running = false;
let last = performance.now();
let frames = 0, fpsT = last, fps = 60, lowCount = 0, scaled = false;

function loop(now) {
  if (!running) return;
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  const t = now / 1000;

  controls.update();
  world.update(dt);
  portal.update(dt, t);

  if (state === 'step') {
    stepT += dt;
    const k = Math.min(stepT / STEP_DUR, 1);
    const e = k * k * (3 - 2 * k) * 0.55 + k * k * k * 0.45; // eases in, then rushes through
    camera.position.copy(portal.center).multiplyScalar(0.97 * e);
    if (k > 0.7) ui.flash(true);
    if (k >= 1 && world.ready) enterWorld();
  }

  if (world.visible) {
    const fade = world.fade;
    petals.update(t, fade, dt);
    fireflies.update(t, fade, dt);
    blooms.update(dt);
    sparks.update(dt);
    lanterns.update(dt, fade);
    heart.position.y = HEART_BASE.y + Math.sin(t * 1.4) * 0.09;
    heart.scale.setScalar(0.95 + 0.06 * Math.sin(t * 3.0));
    heart.material.opacity = fade;
  }

  if (state === 'world') {
    worldT += dt;
    heart.getWorldPosition(tmp).normalize();
    camera.getWorldDirection(fwd);
    lookT = fwd.angleTo(tmp) < 0.3 ? lookT + dt : 0;
    if (!msgShown && (lookT > 0.9 || worldT > 45)) showMsg();
  }

  renderer.render(scene, camera);

  // performance guard: if it stays slow for ~3 s, lower resolution and thin the petals
  frames++;
  if (now - fpsT > 500) {
    fps = Math.round((frames * 1000) / (now - fpsT));
    frames = 0; fpsT = now;
    lowCount = fps < 40 ? lowCount + 1 : 0;
    if (lowCount >= 6 && !scaled) {
      scaled = true;
      renderer.setPixelRatio(1);
      petals.setPixelRatio(1);
      fireflies.setPixelRatio(1);
      petals.thin();
    }
    if (DEBUG) {
      const el = ui.debugEl();
      el.style.display = 'block';
      const d = controls.device;
      el.textContent = `state ${state}  fps ${fps}${scaled ? ' (scaled)' : ''}\n` +
        `gyro ${controls.hasGyro}${controls._useAbsolute ? ' (abs)' : ''}\n` +
        `a ${d.alpha.toFixed(0)} b ${d.beta.toFixed(0)} g ${d.gamma.toFixed(0)}`;
    }
  }
}
function startLoop() {
  if (running) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(loop);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) running = false;
  else startLoop();
});

// ---------- boot ----------
async function onStart() {
  ui.setStartLoading();
  let result;
  try {
    result = await requestAll(); // permission calls start synchronously, inside the tap
  } catch (e) {
    result = { audio: false, motion: 'denied', camera: { ok: false, error: 'error' } };
  }

  ui.hideStart();

  if (result.camera.ok) {
    await showCamera(document.getElementById('video'), result.camera.stream);
  } else {
    ui.showSoftBackground();
    ui.showNote('No camera, that is fine. Drag to look around.');
  }

  controls.start();
  startLoop();
  state = 'scan';

  if (result.motion === 'granted') {
    const ok = await controls.waitForGyro();
    if (!ok) ui.showNote('Motion is not available. Drag to look around.');
  } else {
    ui.showNote('Motion is off. Drag to look around.');
  }

  if (DIRECT_WORLD) {
    await world.load();
    enterWorld(true);
    return;
  }

  ui.showHint(config.hintScan);
  later(() => { if (state === 'scan') spawnPortal(); }, 1800);
}

if (isInAppBrowser()) ui.showInAppWarning();
else ui.initStartScreen(onStart);

if (DEBUG) window.__yue = { controls, camera, scene, renderer, world, portal, fireflies, petals, showMsg, releaseLantern, get state() { return state; } };
