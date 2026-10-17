import config from './config.js';

const $ = (id) => document.getElementById(id);

const svg = (inner) =>
  `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
export const ICONS = {
  volume: svg('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/>'),
  mute: svg('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  lantern: svg('<path d="M9 3.5h6M10.5 3.5v2M13.5 3.5v2"/><path d="M8.5 7c0-.9 1.5-1.5 3.5-1.5s3.5.6 3.5 1.5l1 7.5c0 2-2 3.5-4.5 3.5s-4.5-1.5-4.5-3.5L8.5 7z"/><path d="M10.5 18v2.5M13.5 18v2.5"/>'),
  spark: svg('<path d="M12 3.5l1.7 6.8 6.8 1.7-6.8 1.7L12 20.5l-1.7-6.8L3.5 12l6.8-1.7L12 3.5z"/>'),
};

export function initStartScreen(onTap) {
  $('title').innerHTML = `For <em>${config.herName}</em>`;
  $('from').textContent = `From ${config.fromName}`;
  $('sub').textContent = config.startSub;
  $('startBtn').textContent = config.startText;
  $('startBtn').addEventListener('click', onTap, { once: true });
}
export function setStartLoading() {
  const b = $('startBtn');
  b.disabled = true;
  b.textContent = 'Opening';
}
export function hideStart() {
  const s = $('start');
  s.classList.add('hidden');
  setTimeout(() => (s.style.display = 'none'), 1100);
}

export function showHint(text) {
  const h = $('hint');
  h.textContent = text;
  h.classList.add('show');
}
export function hideHint() {
  $('hint').classList.remove('show');
}

export function showNote(text) {
  const n = $('note');
  n.textContent = text;
  n.style.display = 'block';
  clearTimeout(showNote._t);
  showNote._t = setTimeout(() => (n.style.display = 'none'), 6000);
}

export function showSoftBackground() {
  $('bg').style.display = 'block';
}
/** Dim and vignette the camera a little while the door is showing, so the door glows. */
export function setMood(on) {
  document.body.classList.toggle('mood', on);
}

export function showInAppWarning() {
  const el = $('inapp');
  el.style.display = 'flex';
  el.classList.remove('hidden');
  $('start').style.display = 'none';
  $('copyBtn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      $('copyBtn').textContent = 'Copied';
    } catch (e) {
      $('copyBtn').textContent = location.href;
    }
  });
}

export function debugEl() {
  return $('debug');
}

export function initControls({ onMute, onExit, onWish }) {
  $('mute').innerHTML = ICONS.volume;
  $('mute').addEventListener('click', () => {
    $('mute').innerHTML = onMute() ? ICONS.mute : ICONS.volume;
  });
  $('exit').innerHTML = ICONS.close + '<span>Exit</span>';
  $('exit').addEventListener('click', onExit);
  $('wish').innerHTML = ICONS.lantern + '<span>Wish</span>';
  $('wish').addEventListener('click', onWish);
  $('count').innerHTML = ICONS.spark + '<b id="countN">0</b>';
}
export function showWorldControls(show) {
  const d = show ? 'flex' : 'none';
  ['mute', 'exit', 'count', 'wish'].forEach((id) => ($(id).style.display = d));
}
export function setCaught(n) {
  $('countN').textContent = n;
}

export function flash(on) {
  const f = $('flash');
  if (on) {
    f.classList.remove('slow');
    f.classList.add('on');
  } else {
    f.classList.add('slow');
    f.classList.remove('on');
  }
}

let typer = null;
export function showMessage(text, signedBy, name) {
  const card = $('msg');
  $('msgName').textContent = name;
  $('msgSig').textContent = signedBy;
  $('msgSig').style.opacity = 0;
  const t = $('msgText');
  t.textContent = '';
  card.classList.add('show');
  clearInterval(typer);
  let i = 0;
  typer = setInterval(() => {
    i++;
    t.textContent = text.slice(0, i);
    if (i >= text.length) {
      clearInterval(typer);
      $('msgSig').style.opacity = 1;
    }
  }, 40);
}
export function hideMessage() {
  clearInterval(typer);
  $('msg').classList.remove('show');
}
export function onMessageTap(cb) {
  $('msg').addEventListener('click', cb);
}
