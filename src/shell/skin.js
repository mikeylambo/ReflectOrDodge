// UI skin (docs/ART.md: UI). The Web Shell's DOMGameUI renders plain, escaped
// text; after each render, decorate() adds the game's own look on top:
// icons on every choice, shortcut keys, sliders and toggles in settings,
// chapter cards, and the animated results reveal. Nothing here changes what a
// choice does — ids, order and focus all stay the shell's.
import { FONT } from '../present/brand.js';
import ch1 from '../assets/title-cards/ch1.webp';
import ch2 from '../assets/title-cards/ch2.webp';
import ch3 from '../assets/title-cards/ch3.webp';
import ch4 from '../assets/title-cards/ch4.webp';

// painted chapter cards (docs/art-ref/title-card-ch*.jpg); menu only, never behind play
const CARD_ART = { 1: ch1, 2: ch2, 3: ch3, 4: ch4 };

const svg = (body, cls = 'rd-ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const S = 'fill="none" stroke="currentColor" stroke-width="1.7"';
export const ICON = {
  reflect: svg(`<path d="M12 3 21 12 12 21 3 12Z" ${S}/><path d="M12 8 16 12 12 16 8 12Z" fill="currentColor"/>`),
  gold: svg('<path d="M12 2.5 14.8 8.9 21.6 9.5 16.4 14 18 20.7 12 17.1 6 20.7 7.6 14 2.4 9.5 9.2 8.9Z" fill="currentColor"/>'),
  silver: svg('<path d="M12 3 20 12 12 21 4 12Z" fill="currentColor"/>'),
  bronze: svg('<circle cx="12" cy="12" r="7.5" fill="currentColor"/>'),
  none: svg('<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 3"/>'),
  lock: svg(`<rect x="5" y="10.5" width="14" height="10" rx="1.5" ${S}/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14v3" ${S}/>`),
  mirror: svg(`<path d="M12 3v18" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 2"/><path d="M9 7 4 12l5 5Z M15 7l5 5-5 5Z" ${S} stroke-linejoin="round"/>`),
  examiner: svg(`<path d="M12 2.5 20.2 7.25v9.5L12 21.5 3.8 16.75v-9.5Z" ${S}/><circle cx="12" cy="12" r="3" fill="currentColor"/>`),
  hint: svg(`<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" ${S}/><circle cx="12" cy="12" r="2.6" fill="currentColor"/>`),
  reset: svg('<path d="M19 12a7 7 0 1 1-2.05-4.95" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M17.5 3.5v4h-4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>'),
  play: svg('<path d="M7 4.5 19 12 7 19.5Z" fill="currentColor"/>'),
  map: svg(`<g ${S}><rect x="3.5" y="4" width="4.5" height="4.5"/><rect x="9.75" y="4" width="4.5" height="4.5"/><rect x="16" y="4" width="4.5" height="4.5"/><rect x="3.5" y="10.5" width="4.5" height="4.5"/><rect x="9.75" y="10.5" width="4.5" height="4.5"/></g><path d="M8 18.5h8" ${S}/><path d="M16 15.5 20.5 18.5 16 21.5Z" fill="currentColor"/>`),
  settings: svg(`<path d="M4 7h9M17 7h3M4 17h3M11 17h9" ${S} stroke-linecap="round"/><circle cx="15" cy="7" r="2.2" ${S}/><circle cx="9" cy="17" r="2.2" ${S}/>`),
  assist: svg(`<circle cx="12" cy="12" r="8.5" ${S}/><circle cx="12" cy="12" r="3.5" ${S}/><path d="M12 3.5v5M12 15.5v5M3.5 12h5M15.5 12h5" ${S}/>`),
  next: svg('<path d="M5 12h12M12 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  watch: svg(`<rect x="3.5" y="5" width="17" height="14" rx="1.5" ${S}/><path d="M10 9.5v5l4.5-2.5Z" fill="currentColor"/>`),
  death: svg('<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>'),
  timer: svg(`<circle cx="12" cy="13.5" r="7.5" ${S}/><path d="M12 13.5V9.5M10 3h4" ${S} stroke-linecap="round"/>`),
  audio: svg(`<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" ${S} stroke-linecap="round"/>`),
  music: svg(`<path d="M9 17.5V5.5l10-2v12" ${S}/><circle cx="6.8" cy="17.5" r="2.4" fill="currentColor"/><circle cx="16.8" cy="15.5" r="2.4" fill="currentColor"/>`),
  eye: svg(`<circle cx="12" cy="12" r="8.5" ${S}/><path d="M12 3.5a8.5 8.5 0 0 0 0 17Z" fill="currentColor"/>`),
  flash: svg('<path d="M13 2.5 5.5 13.5H11L10 21.5 18.5 10H13Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>'),
  shake: svg(`<rect x="7" y="5" width="10" height="14" ${S}/><path d="M4 8v8M20 8v8M1.5 10v4M22.5 10v4" ${S} stroke-linecap="round"/>`),
  full: svg(`<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" ${S}/>`),
  data: svg(`<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" ${S}/>`),
  export: svg(`<path d="M12 3v12M7 10l5 5 5-5M4 20h16" ${S} stroke-linecap="round" stroke-linejoin="round"/>`),
  speed: svg(`<path d="M4 17a8 8 0 1 1 16 0" ${S}/><path d="M12 17l4-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),
  shield: svg(`<path d="M12 3 19 6v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6Z" ${S}/>`),
};
export const MEDAL_ICON = [ICON.none, ICON.bronze, ICON.silver, ICON.gold];
export const MEDAL_COLOR = ['rgba(232,244,255,.35)', '#d9905f', '#d6e2f0', '#ffd166'];
const MEDAL_NAME = ['', 'Bronze', 'Silver', 'Gold'];

const CHOICE_ICON = {
  play: 'reflect', settings: 'settings', credits: 'eye',
  resume: 'play', reset: 'reset', hint: 'hint', assists: 'assist', map: 'map',
  next: 'next', 'next-chapter': 'next', retry: 'reset', watch: 'watch', 'export-run': 'export',
  sfx: 'audio', music: 'music', 'offset-up': 'timer', 'offset-down': 'timer', contrast: 'eye', flashing: 'flash',
  shake: 'shake', fullscreen: 'full', speedrun: 'timer', telemetry: 'data', export: 'export',
  speed: 'speed', window: 'reflect', preview: 'hint', invincible: 'shield',
};

// shortcut keys shown on the right of a choice, per device family
const PAD = (fam) => fam && fam !== 'keyboard-mouse' && fam !== 'touch';
const KEYS = {
  pause: { resume: ['Esc', '☰'], reset: ['R', 'Y'], hint: ['H', null] },
  results: { next: ['⏎', 'A'], retry: ['R', null] },
};

const pct = (v) => Math.round(v * 100);

// ctx: { family, results, chapters: [{ accent, motif, done, total, gold, beaten, examiner, locked }], settings }
export function decorate(root, id, ctx = {}) {
  const screen = root.querySelector(`[data-screen-id="${id}"]`);
  if (!screen) return;
  screen.classList.add('rd-skin');
  const pad = PAD(ctx.family);
  for (const b of screen.querySelectorAll('.slu-choice')) {
    const cid = b.dataset.choiceId;
    const label = b.querySelector('.slu-choice-label');
    if (!label || b.dataset.rd) continue;
    b.dataset.rd = '1';
    // toggles: "Name: On|Off" → name + switch
    const tog = label.textContent.match(/^(.*): (On|Off)$/);
    // sliders: "Sound: 75%" → name + bar + value
    const sl = label.textContent.match(/^(Sound|Music|Game speed): (\d+)%$/);
    if (tog) {
      label.textContent = tog[1];
      b.insertAdjacentHTML('beforeend', `<span class="rd-toggle" data-on="${tog[2] === 'On'}"><i></i></span>`);
    } else if (sl) {
      label.textContent = sl[1];
      const v = Number(sl[2]);
      b.insertAdjacentHTML('beforeend', `<span class="rd-slider"><i style="width:${v}%"></i><b style="left:${v}%"></b></span><span class="rd-val">${v}%</span>`);
      b.classList.add('rd-has-slider');
    }
    const ic = CHOICE_ICON[cid];
    if (ic && id !== 'chapters') b.insertAdjacentHTML('afterbegin', ICON[ic]);
    const k = KEYS[id] && KEYS[id][cid];
    const key = k && (pad ? k[1] : k[0]);
    if (key) b.insertAdjacentHTML('beforeend', `<kbd class="rd-key">${key}</kbd>`);
  }
  if (id === 'chapters' && ctx.chapters) chapterCards(screen, ctx.chapters);
  if (id === 'results' && ctx.results) resultsReveal(screen, ctx.results);
}

function chapterCards(screen, chapters) {
  const list = screen.querySelector('.slu-choices');
  list.classList.add('rd-cards');
  screen.querySelectorAll('.slu-choice').forEach((b, i) => {
    const c = chapters[i];
    if (!c) return;
    const label = b.querySelector('.slu-choice-label');
    const name = label.textContent.replace(/^🔒 /, '').replace(/^\d+ · /, '');
    b.style.setProperty('--acc', c.accent);
    b.classList.add(`rd-motif-${c.motif || 'none'}`);
    if (CARD_ART[i]) { b.classList.add('rd-art'); b.style.setProperty('--art', `url("${CARD_ART[i]}")`); }
    const desc = b.querySelector('.slu-choice-desc');
    if (desc) desc.remove();
    const stats = c.locked ? ICON.lock
      : `<span>${c.done}/${c.total}</span>${c.scored ? `<span class="rd-gold">${ICON.gold}${c.gold}</span>` : ''}${c.examiner ? `<span class="${c.beaten ? 'rd-beaten' : ''}">${ICON.examiner}${c.beaten ? '' : ''}</span>` : ''}`;
    label.innerHTML = `<span class="rd-num">${String(i).padStart(2, '0')}</span><span class="rd-name">${name}</span><span class="rd-stats">${stats}</span><span class="rd-bar"><i style="width:${c.total ? (100 * c.done) / c.total : 0}%"></i></span>`;
  });
}

function resultsReveal(screen, r) {
  const header = screen.querySelector('.slu-header');
  if (!header) return;
  if (r.examiner) {
    header.innerHTML = `<div class="rd-res"><span class="rd-medal" style="color:#ffe36e">${ICON.examiner}</span><h1 class="rd-res-name" style="color:#ffe36e">Examiner</h1></div>`;
    return;
  }
  const m = r.scored ? r.medal : 0;
  const t = r.timeMs != null ? fmtTime(r.timeMs) : null;
  header.innerHTML = `<div class="rd-res">
    <span class="rd-medal" style="color:${r.scored ? MEDAL_COLOR[m] : '#efe7d8'}">${r.scored ? MEDAL_ICON[m] : ICON.reflect}</span>
    <h1 class="rd-res-name" style="color:${r.scored ? MEDAL_COLOR[m] : '#efe7d8'}">${r.scored ? MEDAL_NAME[m] : 'Clear'}</h1>
    ${r.scored ? `<div class="rd-res-stats">
      <span class="rd-st rd-st-ref">${ICON.reflect}<b data-count="${r.reflects}">${r.reflects}</b><small>/ ${r.par}</small></span>
      <span class="rd-st">${ICON.death}<b>${r.deaths}</b></span>
      ${t ? `<span class="rd-st">${ICON.timer}<b>${t}</b></span>` : ''}
    </div>
    ${r.underPar ? `<div class="rd-under">${ICON.gold} under par</div>` : ''}
    ${r.medalUp ? `<div class="rd-up">new best</div>` : ''}` : ''}
  </div>`;
  // the reflect count ticks up to its value
  const el = header.querySelector('[data-count]');
  if (el && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const n = Number(el.dataset.count), t0 = performance.now() + 260;
    el.textContent = '0';
    const tick = (now) => {
      const k = Math.max(0, Math.min(1, (now - t0) / 420));
      el.textContent = String(Math.round(n * k));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

function fmtTime(ms) {
  const s = ms / 1000, m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(2).padStart(5, '0')}`;
}

export const SKIN_CSS = `
.rd-skin .slu-choice { display: flex !important; align-items: center; gap: 14px; text-align: left; }
.rd-skin .slu-choice .slu-choice-label { flex: 1; }
.rd-skin .slu-choice .slu-choice-desc { display: none; }
.rd-skin .slu-choice[data-focused="true"] .slu-choice-desc, .rd-skin .slu-choice:focus-visible .slu-choice-desc { display: block; position: absolute; left: 0; right: 0; top: 100%; margin-top: 4px; font-size: 13px; opacity: .7; pointer-events: none; }
.rd-skin .slu-choice { position: relative; }
.rd-ic { width: 20px; height: 20px; flex: none; opacity: .75; }
.rd-skin .slu-choice[data-focused="true"] .rd-ic { opacity: 1; color: #7fd4ff; filter: drop-shadow(0 0 6px rgba(127,212,255,.7)); }
.rd-key { font: 700 12px/1 ${FONT.ui}; border: 1.5px solid currentColor; padding: 4px 7px; min-width: 14px; text-align: center; opacity: .65; }
.rd-toggle { width: 38px; height: 20px; border-radius: 10px; border: 1.5px solid rgba(232,244,255,.45); position: relative; flex: none; }
.rd-toggle i { position: absolute; top: 3px; left: 3px; width: 11px; height: 11px; border-radius: 50%; background: rgba(232,244,255,.5); transition: left .15s; }
.rd-toggle[data-on="true"] { background: #7fd4ff; border-color: #7fd4ff; }
.rd-toggle[data-on="true"] i { left: 21px; background: #07080d; }
.rd-slider { flex: 1.2; height: 4px; background: rgba(232,244,255,.15); position: relative; }
.rd-slider i { position: absolute; inset: 0 auto 0 0; background: #7fd4ff; }
.rd-slider b { position: absolute; top: 50%; width: 11px; height: 11px; background: #efe7d8; transform: translate(-50%,-50%) rotate(45deg); box-shadow: 0 0 8px rgba(127,212,255,.8); }
.rd-val { font: 800 16px/1 ${FONT.mono}; width: 48px; text-align: right; }
.rd-has-slider .slu-choice-label { flex: none; width: 34%; }
/* chapter cards */
[data-screen-id="chapters"] .slu-panel { max-width: min(94vw, 880px) !important; width: min(94vw, 880px); }
.rd-cards { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)) !important; }
.rd-cards .slu-choice { min-height: 168px; align-items: stretch; padding: 14px 12px !important; overflow: hidden; }
.rd-cards .slu-choice::before { content: ""; position: absolute; inset: 0; opacity: .55; pointer-events: none; }
.rd-motif-rings::before { background: repeating-radial-gradient(circle at 80% 20%, transparent 0 18px, color-mix(in srgb, var(--acc) 30%, transparent) 18px 19px); }
.rd-motif-strata::before { background: repeating-linear-gradient(-8deg, transparent 0 16px, color-mix(in srgb, var(--acc) 28%, transparent) 16px 19px); }
.rd-motif-tendrils::before { background: repeating-linear-gradient(80deg, transparent 0 20px, color-mix(in srgb, var(--acc) 26%, transparent) 20px 21px); }
.rd-cards .rd-art::before { opacity: 1; background: linear-gradient(180deg, rgba(7,8,13,.15) 0%, rgba(7,8,13,.35) 45%, rgba(7,8,13,.92) 100%), var(--art) center 38% / cover no-repeat !important; transition: transform .35s ease, filter .35s ease; filter: saturate(.85) brightness(.85); }
.rd-cards .rd-art[data-focused="true"]::before, .rd-cards .rd-art:hover::before { transform: scale(1.04); filter: saturate(1) brightness(1); }
.rd-cards .rd-art:disabled::before { filter: grayscale(.9) brightness(.5); }
.rd-motif-none::before { background: linear-gradient(160deg, color-mix(in srgb, var(--acc) 18%, transparent), transparent 60%); }
.rd-cards .slu-choice-label { display: grid !important; grid-template-rows: auto 1fr auto auto; gap: 8px; position: relative; width: 100%; }
.rd-num { font: 800 15px/1 ${FONT.mono}; opacity: .6; }
.rd-name { font: 600 18px/1.1 ${FONT.display}; text-transform: uppercase; letter-spacing: .03em; align-self: center; }
.rd-stats { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; font: 800 14px/1 ${FONT.mono}; opacity: .85; }
.rd-stats svg { width: 13px; height: 13px; vertical-align: -2px; margin-right: 2px; }
.rd-stats .rd-ic { opacity: 1; }
.rd-gold { color: #ffd166; }
.rd-beaten { color: #ffe36e; }
.rd-bar { height: 3px; background: rgba(255,255,255,.12); display: block; }
.rd-bar i { display: block; height: 100%; background: var(--acc); }
.rd-cards .slu-choice[data-focused="true"] { border-color: var(--acc) !important; background: color-mix(in srgb, var(--acc) 12%, rgba(9,11,18,.9)) !important; box-shadow: 0 0 0 1px var(--acc) inset; }
.rd-cards .slu-choice:disabled { opacity: .4; }
/* results */
.rd-res { display: grid; justify-items: center; gap: 10px; margin-bottom: 18px; }
.rd-medal { width: 84px; height: 84px; display: block; filter: drop-shadow(0 0 18px currentColor); }
.rd-medal svg { width: 100%; height: 100%; }
.rd-res-name { margin: 0 !important; font: 600 40px/1 ${FONT.display} !important; text-transform: uppercase; letter-spacing: .05em !important; }
.rd-res-stats { display: flex; gap: 26px; font: 800 22px/1 ${FONT.mono}; }
.rd-st { display: flex; align-items: center; gap: 7px; }
.rd-st svg { width: 18px; height: 18px; opacity: .7; }
.rd-st-ref svg { color: #7fd4ff; opacity: 1; }
.rd-st small { font-size: 15px; opacity: .55; }
.rd-under { display: flex; align-items: center; gap: 6px; color: #ffd166; font: 700 14px/1 ${FONT.ui}; }
.rd-under svg, .rd-up svg { width: 14px; height: 14px; }
.rd-up { color: #9be37a; font: 700 13px/1 ${FONT.ui}; text-transform: uppercase; letter-spacing: .12em; }
@media (prefers-reduced-motion: no-preference) {
  .rd-medal { animation: rd-strike .5s cubic-bezier(.2,1.6,.4,1) both; }
  .rd-res-name { animation: rd-in .3s .18s both; }
  .rd-res-stats { animation: rd-in .3s .26s both; }
  .rd-under, .rd-up { animation: rd-in .3s .72s both; }
  @keyframes rd-strike { from { transform: scale(2.4) rotate(-25deg); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes rd-in { from { transform: translateY(6px); opacity: 0; } to { transform: none; opacity: 1; } }
}

/* ── full-screen layouts (playtest 2: "looked simple") ── */
.rd-skin.slu-screen { --rd-acc: var(--rd-accent, #7fd4ff); }
.rd-skin .slu-panel { transition: none; }
/* title + credits: wordmark large on the left over the live demo room */
.slu-screen.rd-skin[data-screen-id="title"], .slu-screen.rd-skin[data-screen-id="credits"] {
  background: linear-gradient(90deg, rgba(4,5,8,.9) 0%, rgba(4,5,8,.6) 42%, rgba(4,5,8,0) 72%) !important; place-items: center start !important; }
[data-screen-id="title"] .slu-panel, [data-screen-id="credits"] .slu-panel {
  background: none !important; border: 0 !important; clip-path: none !important; box-shadow: none !important;
  width: min(620px, 52vw) !important; max-width: none !important; margin-left: 6vw; padding: 0 !important; }
[data-screen-id="title"] .slu-choices, [data-screen-id="credits"] .slu-choices { gap: 2px !important; margin-top: 18px; }
[data-screen-id="title"] .slu-choice, [data-screen-id="credits"] .slu-choice, [data-screen-id="pause"] .slu-choice,
[data-screen-id="settings"] .slu-choice, [data-screen-id="assists"] .slu-choice {
  background: none !important; border: 0 !important; clip-path: none !important; box-shadow: none !important; padding: 10px 4px !important; min-height: 40px; }
[data-screen-id="title"] .slu-choice-label { font: 600 24px/1.1 ${FONT.display} !important; text-transform: uppercase; letter-spacing: .05em; opacity: .55; transition: opacity .12s, transform .12s; }
[data-screen-id="title"] .slu-choice .rd-ic { width: 22px; height: 22px; opacity: 0; transition: opacity .12s; }
[data-screen-id="title"] .slu-choice[data-focused="true"] .slu-choice-label { opacity: 1; transform: translateX(6px); }
[data-screen-id="title"] .slu-choice[data-focused="true"] .rd-ic { opacity: 1; }
[data-screen-id="title"] .slu-back, [data-screen-id="credits"] .slu-back, [data-screen-id="pause"] .slu-back, [data-screen-id="settings"] .slu-back, [data-screen-id="assists"] .slu-back, [data-screen-id="chapters"] .slu-back { background: none !important; border: 0 !important; clip-path: none !important; padding-left: 4px !important; }
/* pause, settings, assists: a slim panel at the right; the room stays visible */
.slu-screen.rd-skin[data-screen-id="pause"], .slu-screen.rd-skin[data-screen-id="settings"], .slu-screen.rd-skin[data-screen-id="assists"] {
  background: linear-gradient(270deg, rgba(4,5,8,.94) 0, rgba(4,5,8,.82) 360px, rgba(4,5,8,.15) 70%) !important; place-items: stretch end !important; padding: 0 !important; }
[data-screen-id="pause"] .slu-panel, [data-screen-id="settings"] .slu-panel, [data-screen-id="assists"] .slu-panel {
  background: none !important; clip-path: none !important; border: 0 !important; border-left: 1px solid color-mix(in srgb, var(--rd-acc) 45%, transparent) !important;
  width: min(440px, 92vw) !important; max-width: none !important; height: 100vh; box-sizing: border-box; padding: 40px 34px !important;
  display: flex; flex-direction: column; justify-content: center; overflow-y: auto; }
[data-screen-id="settings"] .slu-panel { width: min(560px, 92vw) !important; justify-content: flex-start; }
[data-screen-id="pause"] .slu-choice-label, [data-screen-id="settings"] .slu-choice-label, [data-screen-id="assists"] .slu-choice-label { opacity: .65; font-size: 17px !important; }
[data-screen-id="pause"] .slu-choice[data-focused="true"], [data-screen-id="settings"] .slu-choice[data-focused="true"], [data-screen-id="assists"] .slu-choice[data-focused="true"] {
  background: linear-gradient(90deg, color-mix(in srgb, var(--rd-acc) 16%, transparent), transparent) !important; }
[data-screen-id="pause"] .slu-choice[data-focused="true"] .slu-choice-label, [data-screen-id="settings"] .slu-choice[data-focused="true"] .slu-choice-label, [data-screen-id="assists"] .slu-choice[data-focused="true"] .slu-choice-label { opacity: 1; }
[data-screen-id="pause"] .slu-header h1, [data-screen-id="settings"] .slu-header h1, [data-screen-id="assists"] .slu-header h1 { font-size: 30px !important; margin-bottom: 18px !important; }
/* results: no box, centred over the frozen room */
.slu-screen.rd-skin[data-screen-id="results"] { background: radial-gradient(circle at 50% 45%, rgba(4,5,8,.7), rgba(4,5,8,.9)) !important; }
[data-screen-id="results"] .slu-panel { background: none !important; border: 0 !important; clip-path: none !important; width: min(520px, 92vw) !important; }
[data-screen-id="results"] .slu-choices { display: flex !important; flex-wrap: wrap; justify-content: center; gap: 10px !important; }
[data-screen-id="results"] .slu-choice { width: auto !important; flex: 0 0 auto; padding: 10px 18px !important; }
/* chapters: full width */
.slu-screen.rd-skin[data-screen-id="chapters"] { background: rgba(4,5,8,.84) !important; }
[data-screen-id="chapters"] .slu-panel { background: none !important; border: 0 !important; clip-path: none !important; width: min(94vw, 1240px) !important; max-width: none !important; }
[data-screen-id="chapters"] .rd-cards { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)) !important; gap: 14px !important; }
[data-screen-id="chapters"] .rd-cards .slu-choice { min-height: 300px; }
[data-screen-id="chapters"] .rd-name { font-size: 24px; }
/* screen entry: a wipe in the chapter colour */
@media (prefers-reduced-motion: no-preference) {
  .rd-enter .slu-panel { animation: rd-reveal .28s cubic-bezier(.2,.8,.2,1) both; }
  .rd-enter::after { content: ""; position: fixed; top: 0; bottom: 0; width: 3px; left: 0; background: var(--rd-acc); box-shadow: 0 0 18px var(--rd-acc); animation: rd-sweep .32s cubic-bezier(.4,0,.2,1) both; pointer-events: none; }
  @keyframes rd-reveal { from { clip-path: inset(0 100% 0 0); opacity: .3; } to { clip-path: inset(0 0 0 0); opacity: 1; } }
  @keyframes rd-sweep { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100vw); opacity: 0; } }
}
`;

