import config from './config.js';

// Music is routed through the shared AudioContext so volume fades work on iOS too
// (iOS ignores HTMLMediaElement.volume).
const TARGET_VOLUME = 0.7;
let el = null;
let gain = null;
let ctx = null;
let muted = false;
let active = false; // true once the world has asked for music

/** Call inside the user's tap, right after the AudioContext is created/resumed. */
export function primeMusic(audioCtx) {
  if (el || !audioCtx) return;
  try {
    ctx = audioCtx;
    el = new Audio();
    el.src = config.music;
    el.loop = true;
    el.preload = 'auto';
    el.setAttribute('playsinline', '');
    gain = ctx.createGain();
    gain.gain.value = 0; // silent until the world fades it in
    ctx.createMediaElementSource(el).connect(gain).connect(ctx.destination);
    // Starting playback inside the gesture is what unlocks it on iOS. It is silent (gain 0).
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {
    el = null;
  }
}

function ramp(to, seconds) {
  if (!gain || !ctx) return;
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(to, t + seconds);
}

export function fadeInMusic(seconds = 3) {
  if (!el) return;
  active = true;
  try { if (ctx.state === 'suspended') ctx.resume(); } catch (e) {}
  el.currentTime = 0;
  el.play().catch(() => {});
  ramp(muted ? 0 : TARGET_VOLUME, seconds);
}

export function fadeOutMusic(seconds = 1.5) {
  active = false;
  ramp(0, seconds);
}

export function setMuted(m) {
  muted = m;
  if (active) ramp(m ? 0 : TARGET_VOLUME, 0.4);
}
export function isMuted() {
  return muted;
}

// Pause when the app goes to the background, resume when back.
document.addEventListener('visibilitychange', () => {
  if (!el) return;
  if (document.hidden) {
    el.pause();
  } else if (active) {
    try { if (ctx.state === 'suspended') ctx.resume(); } catch (e) {}
    el.play().catch(() => {});
  }
});

/** Soft whoosh (filtered noise sweep) followed by a little rising chime. Generated, so no asset to download. */
export function portalSound() {
  if (!ctx || muted) return;
  try {
    const t = ctx.currentTime;
    const len = (ctx.sampleRate * 1.8) | 0;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(250, t);
    bp.frequency.exponentialRampToValueAtTime(3200, t + 1.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 1.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(t);
    src.stop(t + 1.9);
    [1046.5, 1318.5, 1568].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = ctx.createGain();
      const s = t + 1.2 + i * 0.14;
      og.gain.setValueAtTime(0.0001, s);
      og.gain.exponentialRampToValueAtTime(0.07, s + 0.03);
      og.gain.exponentialRampToValueAtTime(0.0001, s + 1.4);
      o.connect(og).connect(ctx.destination);
      o.start(s);
      o.stop(s + 1.5);
    });
  } catch (e) {}
}

const NOTES = [783.99, 880.0, 1046.5, 1174.66, 1318.5, 1568.0]; // soft pentatonic

/** Tiny glass-bell note, rising with each firefly caught. */
export function tinkle(i = 0) {
  if (!ctx || muted) return;
  try {
    const t = ctx.currentTime;
    const f = NOTES[i % NOTES.length] * (i >= NOTES.length ? 2 : 1);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 1.4);
  } catch (e) {}
}

/** Warm two-note swell for releasing a lantern. */
export function wishSound() {
  if (!ctx || muted) return;
  try {
    const t = ctx.currentTime;
    [523.25, 783.99].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      const s = t + i * 0.18;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.06, s + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 2.2);
      o.connect(g).connect(ctx.destination);
      o.start(s);
      o.stop(s + 2.3);
    });
  } catch (e) {}
}

/** Soft breath of wind for the petal gust. */
export function gustSound() {
  if (!ctx || muted) return;
  try {
    const t = ctx.currentTime;
    const len = (ctx.sampleRate * 3.4) | 0;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.linearRampToValueAtTime(1500, t + 1.4);
    lp.frequency.linearRampToValueAtTime(300, t + 3.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 1.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.3);
    src.connect(lp).connect(g).connect(ctx.destination);
    src.start(t);
    src.stop(t + 3.4);
  } catch (e) {}
}
