// Unified input (extends Living Loop engine/input.js): keyboard, gamepad and
// touch all fold into one 6-bit mask per sim step (see sim/input.js), plus
// edge-triggered meta actions (reset, editor toggles) delivered as callbacks.
//
// Deviation from the GDD controls table, deliberately: W / Up do NOT jump.
// Up is the reflect-aim direction, and if it also jumped you could never aim a
// grounded reflect upward. Jump is Space (and gamepad A); W/Up/S/Down aim.
import { BTN } from '../sim/input.js';

const KEYMAP = {
  a: BTN.L, arrowleft: BTN.L,
  d: BTN.R, arrowright: BTN.R,
  w: BTN.U, arrowup: BTN.U,
  s: BTN.D, arrowdown: BTN.D,
  ' ': BTN.JUMP,
  j: BTN.REFLECT, k: BTN.REFLECT, shift: BTN.REFLECT,
};

export function createInput({ target = window, touchRoot = null, onMeta = () => {} } = {}) {
  const keys = new Set();
  let keyMask = 0;
  let touchMask = 0;
  let padMask = 0;
  // Bits pressed since the last sample. A tap whose keydown and keyup both land
  // between two sim steps would otherwise never be seen by the simulation.
  let tapLatch = 0;
  let padPrev = { reset: false, pause: false };
  let enabled = true;
  let lastDevice = 'keyboard';

  const recompute = () => { keyMask = 0; for (const k of keys) keyMask |= KEYMAP[k] || 0; };

  target.addEventListener('keydown', (e) => {
    if (!enabled) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    lastDevice = 'keyboard';
    if (e.ctrlKey || e.metaKey) { onMeta(k, e); return; } // shortcuts (e.g. editor Ctrl+S), never gameplay
    if (KEYMAP[k] !== undefined) {
      e.preventDefault();
      keys.add(k);
      recompute();
      tapLatch |= KEYMAP[k];
      return;
    }
    if (!e.repeat) onMeta(k, e);
  });
  target.addEventListener('keyup', (e) => {
    keys.delete(e.key.toLowerCase());
    recompute();
  });
  const clear = () => { keys.clear(); keyMask = 0; touchMask = 0; tapLatch = 0; };
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });

  // Touch: a left thumb pad (4 directions) + jump / reflect / reset buttons.
  // Mobile control design is an open question in the GDD — this is a
  // functional placeholder, not the answer.
  if (touchRoot) {
    const held = new Map(); // pointerId → bit
    const update = () => { touchMask = 0; for (const b of held.values()) touchMask |= b; };
    touchRoot.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('[data-btn]');
      if (!el) return;
      e.preventDefault();
      lastDevice = 'touch';
      if (el.dataset.btn === 'reset') { onMeta('r', e); return; }
      if (el.dataset.btn === 'pause') { onMeta('escape', e); return; }
      held.set(e.pointerId, BTN[el.dataset.btn]);
      tapLatch |= BTN[el.dataset.btn];
      update();
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
      touchRoot.addEventListener(ev, (e) => { held.delete(e.pointerId); update(); });
    }
  }

  function pollPad() {
    padMask = 0;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      const DZ = 0.5;
      let m = 0;
      if (ax < -DZ || b(14)) m |= BTN.L;
      if (ax > DZ || b(15)) m |= BTN.R;
      if (ay < -DZ || b(12)) m |= BTN.U;
      if (ay > DZ || b(13)) m |= BTN.D;
      if (b(0)) m |= BTN.JUMP;
      if (b(2) || b(5)) m |= BTN.REFLECT; // X / Square, or RB
      if (m) lastDevice = 'gamepad';
      padMask |= m;
      const reset = b(8) || b(3); // Back / Select, or Y / Triangle (thumb-reachable)
      const pause = b(9); // Start / Options
      if (reset && !padPrev.reset) onMeta('r');
      if (pause && !padPrev.pause) onMeta('escape');
      padPrev = { reset, pause };
    }
  }

  return {
    // called once per sim step
    sample() {
      if (!enabled) return 0;
      pollPad();
      const m = keyMask | touchMask | padMask | tapLatch;
      tapLatch = 0;
      return m;
    },
    clear,
    setEnabled(v) { enabled = v; if (!v) clear(); },
    get device() { return lastDevice; },
  };
}
