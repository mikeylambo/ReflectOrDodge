// Brand (docs/ART.md: Typography, Wordmark). Fonts are self-hosted from
// public/fonts (OFL); every stack ends in a system fallback.
export const FONT = {
  display: '"Tektur", "Arial Narrow", sans-serif', // titles, room names
  mono: '"Doto", ui-monospace, Menlo, monospace', // numbers: reflects, par, timers
  ui: '"Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif', // menus, body
};
// canvas font shorthand: f('display', 600, 26)
export const f = (role, weight, px) => `${weight} ${px}px ${FONT[role]}`;

// The wordmark, concept 1 "Diamond O": single-stroke letters on a 4×6 grid
// with 45° cut corners; the O in DODGE is the reflect diamond.
const L = {
  R: 'M0 6V0H3L4 1V2L3 3H0M2 3L4 6', E: 'M4 0H0V6H4M0 3H3', F: 'M4 0H0V6M0 3H3', L: 'M0 0V6H4',
  C: 'M4 0H1L0 1V5L1 6H4', T: 'M0 0H4M2 0V6', D: 'M0 0H3L4 1V5L3 6H0Z', G: 'M4 1L3 0H1L0 1V5L1 6H3L4 5V3H2',
};
const GAP = 1.5, SW = 0.62, INK = '#efe7d8', AMBER = '#ffb347', ICE = '#7fd4ff';

export function wordmarkSVG({ title = 'REFLECT / DODGE' } = {}) {
  let paths = '', x = 0;
  const letter = (ch) => {
    if (ch === 'O') paths += `<path d="M2 0L4 3L2 6L0 3Z" transform="translate(${x} 0)" fill="none" stroke="${AMBER}" stroke-width="${SW}"/><path d="M2 1.9L3.27 3L2 4.1L.73 3Z" transform="translate(${x} 0)" fill="${ICE}"/>`;
    else paths += `<path d="${L[ch]}" transform="translate(${x} 0)" fill="none" stroke="${INK}" stroke-width="${SW}" stroke-linecap="square"/>`;
    x += 4 + GAP;
  };
  for (const ch of 'REFLECT') letter(ch);
  const sx = x - GAP + 2.2;
  x = sx + 3.4 + 2.2;
  for (const ch of 'DODGE') letter(ch);
  const w = x - GAP;
  return `<svg class="rd-wordmark" viewBox="-1 -1.5 ${w + 2} 9" role="img" aria-label="${title}" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="rd-sl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${AMBER}"/><stop offset="1" stop-color="${ICE}"/></linearGradient>
<filter id="rd-gl" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation=".35" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<g filter="url(#rd-gl)">${paths}</g><path d="M${sx} 6.8L${sx + 3.4} -0.8" stroke="url(#rd-sl)" stroke-width="${SW}" stroke-linecap="square"/></svg>`;
}
