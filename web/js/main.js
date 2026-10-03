// The page: a transport, a seek bar, a level, the track list and a meter,
// all driving the Player in js/player.js.

import { Player } from './player.js';
import { TUNES, TUNE_NAMES } from './tunes.js';
import { compose } from './compose.js';

const MODES = [
  { mode: 'all', label: 'Repeat all' },
  { mode: 'one', label: 'Repeat one' },
  { mode: 'shuffle', label: 'Shuffle' },
];

const $ = id => document.getElementById(id);
// The playlist: the tunes in order, each worked out into notes the first
// time it is asked for.
const songs = new Map();
const playlist = {
  names: TUNE_NAMES,
  song(name) {
    if (!songs.has(name)) songs.set(name, compose(TUNES[name]));
    return songs.get(name);
  },
};
const player = new Player(playlist);

const ui = {
  title: $('title'), meta: $('meta'), about: $('about'), section: $('section'), temper: $('temper'),
  play: $('play'), prev: $('prev'), next: $('next'), mode: $('mode'),
  seek: $('seek'), time: $('time'), total: $('total'),
  level: $('level'), list: $('list'), meter: $('meter'),
};

function clock(s) {
  s = Math.floor(s);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// The settings that are only a convenience, remembered in this browser.
function load(key, fallback) {
  try { return localStorage.getItem('synth.' + key) ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem('synth.' + key, value); } catch { /* not kept */ }
}

// The track list.
const rows = new Map();
TUNE_NAMES.forEach((name, i) => {
  const info = TUNES[name];
  const li = document.createElement('li');
  li.innerHTML = `
    <button type="button">
      <span class="num">${i + 1}</span>
      <span class="name">${name}</span>
      <span class="spec">${info.bpm} bpm · ${info.key}</span>
      <span class="len">${clock(playlist.song(name).length)}</span>
    </button>`;
  li.querySelector('button').addEventListener('click', () => player.select(name));
  ui.list.append(li);
  rows.set(name, li);
});

function showTune() {
  const name = player.name || TUNE_NAMES[0];
  const info = TUNES[name];
  ui.title.textContent = name;
  ui.meta.textContent = `${info.bpm} bpm · ${info.key}`;
  ui.about.textContent = info.about;
  showTemper();
  for (const [n, li] of rows) li.classList.toggle('on', n === name);
  ui.play.classList.toggle('playing', !player.paused);
  ui.play.setAttribute('aria-label', player.paused ? 'Play' : 'Pause');
  document.title = player.paused ? 'Synthdeck' : `${name} - Synthdeck`;
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: name, artist: 'Synthdeck' });
    navigator.mediaSession.playbackState = player.paused ? 'paused' : 'playing';
  }
}

// A tune with a temperament of its own can be heard in equal temperament
// instead, to compare.
function showTemper() {
  const song = playlist.song(player.name || TUNE_NAMES[0]);
  const name = song.temperament;
  ui.temper.hidden = !name;
  if (!name) return;
  const label = name[0].toUpperCase() + name.slice(1);
  ui.temper.textContent = player.equal ? 'Tuning: equal' : `Tuning: ${label}`;
  ui.temper.toggleAttribute('data-equal', player.equal);
}

function toggleTemper() {
  if (ui.temper.hidden) return;
  player.equal = !player.equal;
  showTemper();
}

function showMode() {
  const m = MODES.find(m => m.mode === player.mode);
  ui.mode.textContent = m.label;
  ui.mode.dataset.mode = m.mode;
}

// The screen kept awake while the music plays, since on a phone a locked
// screen stops it. The browser lets the lock go whenever the page is
// hidden, so it is asked for again on coming back.
let wake = null, asking = false;
async function keepAwake() {
  const want = () => !player.paused && document.visibilityState === 'visible';
  if (want() && !wake && !asking && navigator.wakeLock) {
    asking = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { if (wake === lock) wake = null; });
      wake = lock;
    } catch { /* refused: low battery, or not allowed here */ }
    asking = false;
  }
  // Paused, or hidden, while it was being asked for.
  if (!want() && wake) {
    const lock = wake;
    wake = null;
    lock.release().catch(() => {});
  }
}
document.addEventListener('visibilitychange', keepAwake);

player.onChange = () => {
  showTune();
  keepAwake();
};

ui.play.addEventListener('click', () => player.toggle());
ui.prev.addEventListener('click', () => player.previous());
ui.next.addEventListener('click', () => player.next());
ui.temper.addEventListener('click', toggleTemper);
ui.mode.addEventListener('click', () => {
  const i = MODES.findIndex(m => m.mode === player.mode);
  player.mode = MODES[(i + 1) % MODES.length].mode;
  save('mode', player.mode);
  showMode();
});

// The seek bar follows the tune, except while it is being dragged.
let dragging = false;
ui.seek.addEventListener('input', () => {
  dragging = true;
  ui.time.textContent = clock(ui.seek.value * player.duration);
});
ui.seek.addEventListener('change', () => {
  dragging = false;
  player.seek(ui.seek.value * player.duration);
});

ui.level.addEventListener('input', () => {
  player.setLevel(+ui.level.value);
  save('level', ui.level.value);
});

document.addEventListener('keydown', e => {
  // Leave the browser's own shortcuts, Ctrl+P and the like, to the browser.
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest('input') && e.key !== ' ') return;
  if (e.key === ' ' || e.key === 'k') { e.preventDefault(); player.toggle(); }
  else if (e.key === 'ArrowRight') player.seek(player.position + 5);
  else if (e.key === 'ArrowLeft') player.seek(player.position - 5);
  else if (e.key === 'n') player.next();
  else if (e.key === 'p') player.previous();
  else if (e.key === 't') toggleTemper();
  else return;
  e.target.blur?.();
});

if ('mediaSession' in navigator) {
  const ms = navigator.mediaSession;
  ms.setActionHandler('play', () => player.play());
  ms.setActionHandler('pause', () => player.pause());
  ms.setActionHandler('previoustrack', () => player.previous());
  ms.setActionHandler('nexttrack', () => player.next());
}

// The meter: the spectrum as bars on a log scale of frequency, drawn every
// frame, with the clock and seek bar brought up to date alongside.
const ctx2d = ui.meter.getContext('2d');
const BARS = 48;
let bins = null;
const heights = new Float32Array(BARS);

function frame() {
  requestAnimationFrame(frame);
  const dur = player.duration;
  if (dur) {
    if (!dragging) {
      ui.seek.value = player.position / dur;
      ui.time.textContent = clock(player.position);
    }
    ui.total.textContent = clock(dur);
  }
  const label = player.section?.label ?? '';
  if (ui.section.textContent !== label) ui.section.textContent = label;

  const c = ui.meter;
  const w = c.clientWidth * devicePixelRatio, h = c.clientHeight * devicePixelRatio;
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  ctx2d.clearRect(0, 0, w, h);
  const a = player.analyser;
  if (a) {
    if (!bins) bins = new Uint8Array(a.frequencyBinCount);
    a.getByteFrequencyData(bins);
  }
  const nyquist = (player.ctx ? player.ctx.sampleRate : 48000) / 2;
  const gap = w / BARS * 0.25, bw = w / BARS - gap;
  const grad = ctx2d.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0, '#2de0c0');
  grad.addColorStop(0.55, '#ff9a3d');
  grad.addColorStop(1, '#ff4f5e');
  ctx2d.fillStyle = grad;
  for (let i = 0; i < BARS; i++) {
    let v = 0;
    if (bins && !player.paused) {
      const lo = 40 * (16000 / 40) ** (i / BARS), hi = 40 * (16000 / 40) ** ((i + 1) / BARS);
      const from = Math.floor(lo / nyquist * bins.length);
      const to = Math.max(from + 1, Math.ceil(hi / nyquist * bins.length));
      for (let k = from; k < to; k++) v = Math.max(v, bins[k]);
      v /= 255;
    }
    heights[i] = Math.max(v, heights[i] * 0.9);
    const bh = Math.max(2 * devicePixelRatio, heights[i] * h);
    ctx2d.fillRect(i * (bw + gap) + gap / 2, h - bh, bw, bh);
  }
}

player.mode = MODES.some(m => m.mode === load('mode')) ? load('mode') : 'all';
ui.level.value = load('level', 0.8);
player.setLevel(+ui.level.value);
showMode();
showTune();
ui.total.textContent = clock(playlist.song(TUNE_NAMES[0]).length);
frame();

if (!window.AudioWorkletNode) {
  ui.about.textContent = 'This browser has no audio worklets, so the synth cannot play here.';
  ui.play.disabled = ui.prev.disabled = ui.next.disabled = true;
}
