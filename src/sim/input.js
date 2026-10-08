// One frame of input is a 6-bit mask. The simulation only ever sees masks, so a
// recorded run is just the mask sequence from room start (or the last reset).

export const BTN = { L: 1, R: 2, U: 4, D: 8, JUMP: 16, REFLECT: 32 };

// Reflect direction from held input. Vertical beats horizontal because the
// player is often still holding a run direction when they decide to aim
// up/down; opposing horizontals cancel to neutral. Four directions + neutral
// only (GDD law 9).
export function heldDir(mask) {
  if (mask & BTN.U) return 'up';
  if (mask & BTN.D) return 'down';
  const l = mask & BTN.L, r = mask & BTN.R;
  if (l && !r) return 'left';
  if (r && !l) return 'right';
  return 'neutral';
}

export const DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

// Compact log: "1:" + runs of "<mask>*<count>" in base 36, comma-separated.
// A run with count 1 drops the "*1". e.g. "1:0*2s,2*1e,22,2*9".
export function encodeLog(masks) {
  const runs = [];
  let i = 0;
  while (i < masks.length) {
    const m = masks[i];
    let n = 1;
    while (i + n < masks.length && masks[i + n] === m) n++;
    runs.push(n === 1 ? m.toString(36) : `${m.toString(36)}*${n.toString(36)}`);
    i += n;
  }
  return `1:${runs.join(',')}`;
}

export function decodeLog(str) {
  if (typeof str !== 'string' || !str.startsWith('1:')) throw new Error('input log: missing "1:" version prefix');
  const body = str.slice(2);
  const out = [];
  if (!body) return out;
  for (const run of body.split(',')) {
    const [ms, ns] = run.split('*');
    const m = parseInt(ms, 36);
    const n = ns === undefined ? 1 : parseInt(ns, 36);
    if (!Number.isInteger(m) || m < 0 || m > 63 || !Number.isInteger(n) || n < 1) {
      throw new Error(`input log: bad run "${run}"`);
    }
    for (let k = 0; k < n; k++) out.push(m);
  }
  return out;
}
