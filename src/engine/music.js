// Reactive ambient bed (adapted from Living Loop engine/music.js).
//
// The rule: audible voices = live emitters in the room. Zero → a low drone;
// each live emitter fades in one interlocking voice, so the mix tells you how
// much machinery is running — the same read the room asks for. Shut an
// emitter off and its voice fades out.
//
// Never beat-locked (GDD law 5): every voice loops on its own period, so the
// cells phase against each other. One modal centre per chapter; the event
// sounds (engine/audio.js) transpose with it, so a busy room sounds composed.
// Synth placeholders: real stems drop into the same voice slots later.
import { getAudioContext } from './audio.js';

// Chapter roots (minor pentatonic cells), low register beneath the SFX.
export const CHAPTER_KEYS = { 0: 36.71, 1: 36.71, 2: 41.2, 3: 43.65 }; // D1, D1, E1, F1
let rootHz = CHAPTER_KEYS[1];
const hz = (semis) => rootHz * Math.pow(2, semis / 12);
const MUSIC_CEIL = 0.45;
const FADE = 1.6; // s crossfade as the live-emitter count changes

const SPECS = [
  { period: 9.0, type: 'sine', gain: 0.55, pan: 0, vib: false, notes: [{ at: 0, n: 0, dur: 9.2, g: 1 }, { at: 0, n: 7, dur: 9.2, g: 0.55 }] },
  { period: 6.0, type: 'triangle', gain: 0.3, pan: -0.35, vib: false, notes: [{ at: 0, n: 24, dur: 1.8, g: 1 }, { at: 0.34, n: 31, dur: 1.8, g: 0.9 }, { at: 0.67, n: 34, dur: 2, g: 0.8 }] },
  { period: 6.7, type: 'sine', gain: 0.22, pan: 0.42, vib: true, notes: [{ at: 0.1, n: 36, dur: 1.6, g: 0.8 }, { at: 0.48, n: 43, dur: 1.8, g: 0.7 }, { at: 0.8, n: 39, dur: 1.6, g: 0.7 }] },
  { period: 7.3, type: 'triangle', gain: 0.26, pan: -0.52, vib: true, notes: [{ at: 0.05, n: 12, dur: 2.4, g: 0.9 }, { at: 0.55, n: 19, dur: 2.2, g: 0.8 }] },
  { period: 8.1, type: 'sine', gain: 0.16, pan: 0.58, vib: true, notes: [{ at: 0.3, n: 48, dur: 2.6, g: 0.6 }, { at: 0.74, n: 46, dur: 2.4, g: 0.5 }] },
];

let ctx = null, master = null, verbIn = null;
let vibDepth = null;
let voices = [];
let timer = null;
let volume = 0.8;
let started = false;

function makeReverb(a) {
  const input = a.createGain();
  const delay = a.createDelay(1.0); delay.delayTime.value = 0.29;
  const fb = a.createGain(); fb.gain.value = 0.42;
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
  const out = a.createGain(); out.gain.value = 0.9;
  input.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(out);
  return { input, out };
}

function scheduleCell(v, t0) {
  for (const nt of v.spec.notes) {
    const when = t0 + nt.at * v.spec.period;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = o2.type = v.spec.type;
    o.frequency.value = hz(nt.n); o2.frequency.value = hz(nt.n) * 1.004;
    if (v.spec.vib && vibDepth) { vibDepth.connect(o.detune); vibDepth.connect(o2.detune); }
    const peak = nt.g * v.spec.gain;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + Math.min(0.6, nt.dur * 0.4));
    g.gain.exponentialRampToValueAtTime(0.0001, when + nt.dur);
    o.connect(g); o2.connect(g); g.connect(v.voiceGain);
    o.start(when); o2.start(when); o.stop(when + nt.dur + 0.1); o2.stop(when + nt.dur + 0.1);
  }
}

function tick() {
  if (!ctx) return;
  const until = ctx.currentTime + 0.35;
  for (const v of voices) while (v.nextTime < until) { scheduleCell(v, v.nextTime); v.nextTime += v.spec.period; }
}

// Call inside a user gesture, after initAudio. Idempotent.
export function initMusic() {
  if (started) return;
  ctx = getAudioContext();
  if (!ctx) return;
  started = true;
  master = ctx.createGain(); master.gain.value = MUSIC_CEIL * volume;
  const verb = makeReverb(ctx); verbIn = verb.input;
  verb.out.connect(master); master.connect(ctx.destination);
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.18;
  vibDepth = ctx.createGain(); vibDepth.gain.value = 7;
  lfo.connect(vibDepth); lfo.start();
  voices = SPECS.map((spec, i) => {
    const layerGain = ctx.createGain(); layerGain.gain.value = i === 0 ? 1 : 0;
    const voiceGain = ctx.createGain();
    const pan = ctx.createStereoPanner(); pan.pan.value = spec.pan;
    voiceGain.connect(pan); pan.connect(layerGain); layerGain.connect(master); layerGain.connect(verbIn);
    return { spec, layerGain, voiceGain, nextTime: ctx.currentTime + 0.15 };
  });
  timer = setInterval(tick, 90);
  tick();
}

let lastCount = -1;
export function setMusicLayers(activeCount) {
  if (!started || activeCount === lastCount) return;
  lastCount = activeCount;
  const now = ctx.currentTime;
  voices.forEach((v, i) => {
    const target = i === 0 ? 1 : i <= activeCount ? 1 : 0;
    v.layerGain.gain.cancelScheduledValues(now);
    v.layerGain.gain.setValueAtTime(Math.max(0.0001, v.layerGain.gain.value), now);
    v.layerGain.gain.linearRampToValueAtTime(target, now + FADE);
  });
}

// Switch tonal centre at a room boundary (takes effect on the next cells).
export function setMusicChapter(ci) { if (CHAPTER_KEYS[ci]) rootHz = CHAPTER_KEYS[ci]; }

export function setMusicVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (master) master.gain.setTargetAtTime(MUSIC_CEIL * volume, ctx.currentTime, 0.05);
}

export const musicDebug = () => ({ started, volume, layers: voices.map((v) => +v.layerGain.gain.value.toFixed(2)), periods: SPECS.map((s) => s.period) });
