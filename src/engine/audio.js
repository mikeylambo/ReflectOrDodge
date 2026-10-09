// Reactive Web Audio layer (from Living Loop engine/audio.js). Sound exists
// only because a semantic sim event exists — never tempo-locked (GDD law 5).
// The sim emits events (`projectile.reflect`, `emitter.fire`, `switch.hit`…);
// this file alone decides what they sound like.
import { AUDIO } from '../../config/tunables.js';

let actx = null;
let master = null;
let calibrationOffsetMs = 0;
let voiceWindows = [];
let stats = { scheduled: 0, capped: 0, peak: 0 };

export function initAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  actx = new AC();
  master = actx.createGain();
  master.gain.value = AUDIO.MASTER_GAIN * volume;
  const comp = actx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 6; comp.ratio.value = 12;
  comp.attack.value = 0.003; comp.release.value = 0.15;
  master.connect(comp);
  comp.connect(actx.destination);
  actx.resume();
  loadSamples();
}

// Recorded sounds (src/assets/sfx/<event>.ogg, see docs/SFX-PROMPTS.md) replace
// the synth for their event. A type-specific file wins over the plain one:
// `projectile.destroy.charge.ogg` before `projectile.destroy.ogg`. The app
// passes the file URLs (engine code stays bundler-free for the Node tests).
const SAMPLES = {};
let sampleUrls = {};
export function registerSamples(urls) { sampleUrls = urls; if (actx) loadSamples(); }
function loadSamples() {
  for (const [name, url] of Object.entries(sampleUrls)) {
    if (SAMPLES[name]) continue;
    SAMPLES[name] = 'loading';
    fetch(url).then((r) => r.arrayBuffer()).then((b) => actx.decodeAudioData(b)).then((buf) => { SAMPLES[name] = buf; }).catch(() => { delete SAMPLES[name]; });
  }
}
// variant names beyond the projectile type: a heavy wall, a Charge turning lethal
const VARIANT = { 'wall.break': (ev) => ev.heavy && 'wall.break.heavy', 'charge.bounce': (ev) => ev.bounces >= 3 && 'charge.hot' };
function sampleFor(ev) {
  const v = VARIANT[ev.type] && VARIANT[ev.type](ev);
  if (v && SAMPLES[v] && SAMPLES[v] !== 'loading') return SAMPLES[v];
  const a = ev.ptype && SAMPLES[`${ev.type}.${ev.ptype}`];
  const b = SAMPLES[ev.type];
  const s = a && a !== 'loading' ? a : b;
  return s && s !== 'loading' ? s : null;
}
// play a recorded sound; rate shifts pitch (the chapter key, a reflect's direction)
function sample(buf, when, { rate = 1, gain = 0.9 } = {}) {
  const n = overlapCount(when);
  stats.peak = Math.max(stats.peak, n + 1);
  if (n >= AUDIO.VOICE_CAP) { stats.capped++; return; }
  voiceWindows.push({ start: when, stop: when + buf.duration / rate });
  const src = actx.createBufferSource(), g = actx.createGain();
  src.buffer = buf; src.playbackRate.value = rate * keyRatio;
  g.gain.value = gain / Math.sqrt(1 + n * AUDIO.DENSITY_ATTEN);
  src.connect(g); g.connect(master);
  src.start(when);
}
// how a recorded sound is varied per event (pitch only; the file is the timbre)
const SAMPLE_RATE = {
  'projectile.reflect': ({ dir }) => ({ up: 1.26, right: 1.12, neutral: 1, left: 0.94, down: 0.84 }[dir] || 1),
  'charge.bounce': ({ bounces }) => 1 + 0.12 * ((bounces || 1) - 1),
};

let volume = 1;
export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (master) master.gain.value = AUDIO.MASTER_GAIN * volume;
}

export const getAudioContext = () => actx;

// Event sounds transpose with the chapter's key so they stay consonant with
// that chapter's ambient bed (engine/music.js).
let keyRatio = 1;
export function setKeyRatio(r) { keyRatio = r; }

// Calibration (GDD: Audio). Positive = sounds earlier. Reactive events can't be
// played before they happen, so "earlier" is honoured where the future is
// known: emitter shots are on fixed clocks, so the app schedules them ahead
// via playPredicted() and the reactive copy is skipped. Everything else can
// only be delayed (negative offsets).
export function getCalibrationOffset() { return calibrationOffsetMs; }
export function playPredicted(ev, inSec) {
  if (!actx || volume <= 0) return;
  const now = actx.currentTime;
  play(ev, Math.max(now, now + inSec - calibrationOffsetMs / 1000));
}
function play(ev, when) {
  const buf = sampleFor(ev);
  if (buf) sample(buf, when, { rate: SAMPLE_RATE[ev.type] ? SAMPLE_RATE[ev.type](ev) : 1 });
  else if (BANK[ev.type]) BANK[ev.type](ev, when);
  else return;
  stats.scheduled++;
}
export const PREDICTED = new Set(['emitter.fire']);

export function setCalibrationOffset(ms) {
  calibrationOffsetMs = Math.max(AUDIO.OFFSET_MIN, Math.min(AUDIO.OFFSET_MAX, ms));
}

function overlapCount(when) {
  voiceWindows = voiceWindows.filter((v) => v.stop > actx.currentTime);
  let n = 0;
  for (const v of voiceWindows) if (v.start <= when && v.stop > when) n++;
  return n;
}

function voice(freq, dur, type, gain, glideTo, when) {
  const n = overlapCount(when);
  stats.peak = Math.max(stats.peak, n + 1);
  if (n >= AUDIO.VOICE_CAP) { stats.capped++; return; }
  gain *= 1 / Math.sqrt(1 + n * AUDIO.DENSITY_ATTEN);
  voiceWindows.push({ start: when, stop: when + dur });
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq * keyRatio, when);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo * keyRatio, when + dur);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(gain, when + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g); g.connect(master);
  o.start(when); o.stop(when + dur + 0.03);
}

// D minor pentatonic-ish palette so a busy room sounds composed.
const N = { D3: 146.83, F3: 174.61, A3: 220, C4: 261.63, D4: 293.66, F4: 349.23, G4: 392, A4: 440, C5: 523.25, D5: 587.33, F5: 698.46, A5: 880 };
const REFLECT_PITCH = { up: N.A5, right: N.F5, neutral: N.D5, left: N.C5, down: N.A4 };

const BANK = {
  'projectile.reflect': ({ dir }, w) => { voice(REFLECT_PITCH[dir] || N.D5, 0.14, 'square', 0.1, null, w); voice((REFLECT_PITCH[dir] || N.D5) * 2, 0.08, 'sine', 0.08, null, w); },
  'reflect.open': (_, w) => voice(N.D4 * 4, 0.03, 'sine', 0.03, null, w),
  'emitter.telegraph': (_, w) => voice(N.D3, 0.5, 'triangle', 0.05, N.A3, w),
  'emitter.fire': (_, w) => voice(N.A3, 0.08, 'triangle', 0.08, N.D3, w),
  'emitter.off': (_, w) => voice(N.F3, 0.6, 'sawtooth', 0.08, N.D3 / 2, w),
  'switch.hit': (_, w) => { voice(N.D3, 0.4, 'sine', 0.16, null, w); voice(N.A3, 0.4, 'sine', 0.1, null, w); },
  'door.open': (_, w) => [N.D4, N.F4, N.A4].forEach((f, i) => voice(f, 0.35, 'triangle', 0.08, null, w + i * 0.04)),
  'door.close': (_, w) => [N.A4, N.F4, N.D4].forEach((f, i) => voice(f, 0.3, 'triangle', 0.08, null, w + i * 0.04)),
  'player.jump': (_, w) => voice(N.D4, 0.06, 'sine', 0.05, N.F4, w),
  'player.land': (_, w) => voice(N.D3, 0.05, 'sine', 0.05, null, w),
  'player.death': (_, w) => voice(N.F3, 0.18, 'sawtooth', 0.12, N.D3 / 2, w),
  // menus: a soft tick to move, a two-note rise to accept, a fall to go back
  'ui.move': (_, w) => voice(N.A4 * 2, 0.035, 'sine', 0.035, null, w),
  'ui.accept': (_, w) => { voice(N.D5, 0.07, 'triangle', 0.06, null, w); voice(N.A5, 0.1, 'triangle', 0.05, null, w + 0.05); },
  'ui.back': (_, w) => voice(N.A4, 0.09, 'triangle', 0.05, N.D4, w),
  'room.clear': (_, w) => [N.D4, N.F4, N.A4, N.D5].forEach((f, i) => voice(f, 0.5, 'triangle', 0.1, null, w + i * 0.08)),
  // placeholders until recorded sounds exist (docs/SFX-PROMPTS.md)
  'charge.bounce': ({ bounces = 1 }, w) => voice([N.D4, N.F4, N.A4][Math.min(2, bounces - 1)] * (bounces >= 3 ? 2 : 1), 0.07, bounces >= 3 ? 'square' : 'sine', bounces >= 3 ? 0.07 : 0.04, null, w),
  'projectile.mirror': (_, w) => { voice(N.A5, 0.12, 'sine', 0.05, null, w); voice(N.A5 * 1.5, 0.12, 'sine', 0.035, null, w + 0.02); },
  'examiner.core': (_, w) => { voice(N.D5, 0.9, 'sine', 0.12, null, w); voice(N.A5, 0.7, 'sine', 0.07, null, w + 0.01); voice(N.D5 * 2, 0.5, 'triangle', 0.04, null, w + 0.02); },
  'examiner.defeat': (_, w) => [N.D3, N.A3, N.D4, N.F4, N.A4, N.D5].forEach((f, i) => voice(f, 1.8 - i * 0.12, 'triangle', 0.09, null, w + i * 0.11)),
  'wall.break': ({ heavy }, w) => { voice(heavy ? N.D3 / 2 : N.D3, 0.22, 'sawtooth', 0.09, N.D3 / 4, w); voice(N.A3, 0.06, 'square', 0.04, N.D3, w); },
  'seed.stick': (_, w) => voice(N.G4, 0.12, 'triangle', 0.05, N.D4, w),
  'seed.expire': (_, w) => voice(N.D4, 0.25, 'sine', 0.03, N.A3, w),
};

export function playEvent(ev) {
  if (!actx || volume <= 0) return;
  if (calibrationOffsetMs > 0 && PREDICTED.has(ev.type)) return; // already scheduled ahead
  const now = actx.currentTime;
  play(ev, Math.max(now, now - calibrationOffsetMs / 1000));
}

export const audioDebug = () => ({ ...stats, ready: !!actx });
