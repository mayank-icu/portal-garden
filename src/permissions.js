import { primeMusic } from './audio.js';

// Everything here must be kicked off synchronously inside the tap handler (iOS rule).
let audioCtx = null;

export function getAudioContext() {
  return audioCtx;
}

function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    // play a silent buffer to fully unlock on iOS
    const buf = audioCtx.createBuffer(1, 1, 22050);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start(0);
    primeMusic(audioCtx);
    return true;
  } catch (e) {
    return false;
  }
}

function requestMotion() {
  const DOE = window.DeviceOrientationEvent;
  if (!DOE) return Promise.resolve('unsupported');
  if (typeof DOE.requestPermission === 'function') {
    return DOE.requestPermission().then(
      (r) => (r === 'granted' ? 'granted' : 'denied'),
      () => 'denied'
    );
  }
  return Promise.resolve('granted'); // Android / desktop: no prompt
}

function requestCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return Promise.resolve({ ok: false, error: 'unsupported' });
  }
  return navigator.mediaDevices
    .getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    })
    .then(
      (stream) => ({ ok: true, stream }),
      (err) => ({ ok: false, error: err && err.name ? err.name : 'error' })
    );
}

const timeout = (p, ms, fallback) =>
  Promise.race([p, new Promise((res) => setTimeout(() => res(fallback), ms))]);

/** Call directly from a click handler. Starts all requests in the same gesture.
 *  Each request is capped so a dismissed or hung prompt can never freeze the start screen. */
export function requestAll() {
  const audio = unlockAudio();
  const motionP = timeout(requestMotion(), 15000, 'denied');
  const cameraP = timeout(requestCamera(), 15000, { ok: false, error: 'timeout' });
  return Promise.all([motionP, cameraP]).then(([motion, camera]) => ({ audio, motion, camera }));
}

export function isInAppBrowser() {
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly|Twitter|LinkedInApp/i.test(ua);
}
