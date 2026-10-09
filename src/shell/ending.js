// The ending: the final line alone on the dark, then the credits rise and rest centred.
// Any key, click, tap or gamepad button skips the line, then the credits;
// both also end by themselves. Used after the final Examiner (line + credits)
// and from the title's Credits (credits only).
import { FONT, wordmarkSVG } from '../present/brand.js';

const LINE_HOLD = 6; //  s the line stays before the credits start
const SCROLL = 7; //     s for the credits to rise to the centre
const HOLD = 8; //       s they rest there before the ending closes
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function playEnding({ line = null, credits, accent = '#7fd4ff', onDone }) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = document.createElement('div');
  el.className = 'rd-ending';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Ending');
  el.innerHTML = `<style>
.rd-ending { position: fixed; inset: 0; z-index: 60; background: #07080d; color: #f3ece0; overflow: hidden; cursor: pointer; }
.rd-ending .line { position: absolute; inset: 0; display: grid; place-items: center; padding: 0 12vw; text-align: center;
  font: 500 clamp(20px, 3.2vw, 38px)/1.35 ${FONT.display}; letter-spacing: .02em; opacity: 0; transition: opacity 2.4s ease; }
.rd-ending .line.on { opacity: 1; }
.rd-ending .roll { position: absolute; left: 0; right: 0; top: 100%; text-align: center; font: 400 18px/1.5 ${FONT.ui}; }
.rd-ending .roll.go { transition: transform ${SCROLL}s cubic-bezier(.2,.6,.3,1); }
.rd-ending .mark { margin: 0 auto 48px; width: min(560px, 70vw); }
.rd-ending .mark svg { width: 100%; height: auto; display: block; }
.rd-ending .role { font: 600 12px/1.2 ${FONT.ui}; letter-spacing: .14em; text-transform: uppercase; opacity: .55; margin-top: 22px; }
.rd-ending .name { font: 500 22px/1.3 ${FONT.display}; }
.rd-ending .skip { position: absolute; right: 18px; bottom: 14px; font: 600 12px/1 ${FONT.ui}; opacity: .35; letter-spacing: .1em; }
</style>
<div class="line" aria-live="polite"></div>
<div class="roll"><div class="mark">${wordmarkSVG()}</div>${credits.map((c) => `<div class="role">${esc(c[0])}</div><div class="name">${esc(c[1])}</div>`).join('')}</div>
<div class="skip">skip ›</div>`;
  document.body.appendChild(el);
  const lineEl = el.querySelector('.line'), roll = el.querySelector('.roll');
  let stage = line ? 'line' : 'roll', timer = 0, raf = 0, done = false;

  const finish = () => {
    if (done) return;
    done = true; clearTimeout(timer); cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey, true); el.remove();
    onDone && onDone();
  };
  const startRoll = () => {
    stage = 'roll'; clearTimeout(timer);
    lineEl.classList.remove('on');
    if (still) { roll.style.top = '50%'; roll.style.transform = 'translateY(-50%)'; timer = setTimeout(finish, (SCROLL + HOLD) * 1000); return; }
    roll.getBoundingClientRect(); // commit the start position before the transition
    roll.classList.add('go');
    roll.style.transform = `translateY(-${(innerHeight + roll.scrollHeight) / 2}px)`; // rise, and rest centred
    timer = setTimeout(finish, (SCROLL + HOLD) * 1000);
  };
  const advance = () => { if (stage === 'line') startRoll(); else finish(); };
  const onKey = (e) => { e.preventDefault(); e.stopPropagation(); if (!e.repeat) advance(); };
  addEventListener('keydown', onKey, true);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); advance(); });
  // gamepads: any button, on its press edge
  let held = true; // a button still held from the last hit doesn't count
  const poll = () => {
    const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
    const any = [...pads].some((p) => p && p.buttons.some((b) => b.pressed));
    if (any && !held) advance();
    held = any;
    if (!done) raf = requestAnimationFrame(poll);
  };
  raf = requestAnimationFrame(poll);

  if (stage === 'line') {
    lineEl.textContent = line;
    requestAnimationFrame(() => lineEl.classList.add('on'));
    timer = setTimeout(startRoll, LINE_HOLD * 1000);
  } else startRoll();
  return { skip: advance, finish };
}
