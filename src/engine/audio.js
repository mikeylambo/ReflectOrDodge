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
}

let volume = 1;
export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (master) master.gain.value = AUDIO.MASTER_GAIN * volume;
}

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
  o.frequency.setValueAtTime(freq, when);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, when + dur);
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
  'room.clear': (_, w) => [N.D4, N.F4, N.A4, N.D5].forEach((f, i) => voice(f, 0.5, 'triangle', 0.1, null, w + i * 0.08)),
};

export function playEvent(ev) {
  if (!actx || !BANK[ev.type] || volume <= 0) return;
  const now = actx.currentTime;
  const when = Math.max(now, now - calibrationOffsetMs / 1000);
  BANK[ev.type](ev, when);
  stats.scheduled++;
}

export const audioDebug = () => ({ ...stats, ready: !!actx });
