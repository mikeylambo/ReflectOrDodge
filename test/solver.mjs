// Headless solver (adapted from Living Loop test/solvable.mjs to the reflect
// action space). Runs the SAME sim the game runs, so a solution here is a real
// input log that clears the room.
//
// Search: best-first by sim tick over decision windows. Each window the bot
//   picks a move (L / none / R) × jump held (yes / no), or — only when a
//   reflectable projectile could reach the zone during the reflect window — a
//   reflect press whose aim is HELD for the whole reflect window, so "the held
//   direction at the moment of contact" is the one chosen.
// Pruning: visited set keyed on world clock + bucketed player + reflect state
//   + full projectile and object state + reflects used.
// Par: solve with a reflect budget of 0, 1, 2… — the first budget that clears is
//   the solver-minimal reflect count at this decision granularity.
import { BTN } from '../src/sim/input.js';
import { compileRoom } from '../src/sim/room.js';
import { createState, step } from '../src/sim/world.js';
import { PROJECTILES } from '../src/projectiles/index.js';
import { PLAYER, REFLECT, TIMESTEP } from '../config/tunables.js';

const { L, R, U, D, JUMP, REFLECT: RF } = BTN;

const MOVES = [0, L, R];
const BASIC = [];
for (const m of MOVES) for (const j of [0, JUMP]) BASIC.push({ mask: m | j, reflect: false });
// reflect aims: [aim bits, allowed move bits]
const AIMS = [
  ...[0, L, R].map((m) => ({ aim: U, move: m })),
  ...[0, L, R].map((m) => ({ aim: D, move: m })),
  { aim: 0, move: L }, // left
  { aim: 0, move: R }, // right
  { aim: 0, move: 0 }, // neutral
];
const REFLECTS = [];
for (const a of AIMS) for (const j of [0, JUMP]) REFLECTS.push({ mask: a.aim | a.move | j, reflect: true });
// (aim is held for the whole decision window; contact happens inside it)
const ALL = [...BASIC, ...REFLECTS];
const BASIC_NOJUMP = BASIC.filter((a) => !(a.mask & JUMP));
const ALL_NOJUMP = ALL.filter((a) => !(a.mask & JUMP));

function clone(s) {
  return {
    ...s,
    player: { ...s.player },
    reflect: { ...s.reflect, hitIds: s.reflect.hitIds.slice() },
    projectiles: s.projectiles.map((p) => ({ ...p })),
    objects: s.objects.slice(),
    stats: { ...s.stats },
  };
}

const q = (v, n) => Math.round(v / n);

function key(s, posQ, velQ, K) {
  const p = s.player;
  // Time enters the key only as each emitter's phase (+ shots left when the
  // emitter has a count), so a state revisited a cycle later dedupes — the
  // search is ordered by tick, so the first visit is always the earliest.
  let k = '';
  // Phases bucket to the decision window: hitstop shifts the world clock off
  // the decision grid, and exact phases would multiply the space ~8×.
  for (const o of s.objects) if (o.kind === 'emitter') k += `${o.on ? q((s.frame - o.phaseF + o.periodF * 64) % o.periodF, K) : 'x'}${o.count ? `/${o.count - o.fired}` : ''},`;
  if (!k) k = 'static,';
  k += `|${q(p.x, posQ)},${q(p.y, posQ)},${q(p.vy, velQ)},${p.grounded ? 1 : 0}${p.coyote > 0 ? 1 : 0}${p.rising ? 1 : 0}${p.jumpBuf > 0 ? 1 : 0}${s.prevInput & JUMP ? 1 : 0}`;
  k += `|${q(s.reflect.window, 6)},${q(s.reflect.cooldown, 6)},${s.hitstop > 0 ? 1 : 0},${s.stats.reflects}`;
  for (const pr of s.projectiles) {
    k += `|${pr.type}${q(pr.x, posQ)},${q(pr.y, posQ)},${Math.sign(pr.vx)}${Math.sign(pr.vy)}${pr.reflected ? 'r' : ''}${pr.grace ? 'g' : ''}`;
    if (pr.stuck) k += `s${q(pr.life, K)}`;
  }
  for (const o of s.objects) {
    if (o.kind === 'emitter') continue;
    else if (o.kind === 'door') k += `|d${o.open ? 1 : 0}`;
    else if (o.kind === 'switch') k += `|s${o.mode === 'toggle' ? o.hits % 2 : Math.min(o.hits, 1)}`;
    else if (o.kind === 'wall') k += `|w${o.broken ? 1 : 0}`;
    else if (o.kind === 'core') k += `|c${o.broken ? 1 : 0}`;
  }
  return k;
}

// is a reflectable projectile at the zone edge right now (about to enter)?
function inZone(s) {
  const cx = s.player.x + PLAYER.W / 2, cy = s.player.y + PLAYER.H / 2;
  const r = REFLECT.RADIUS + 3;
  for (const pr of s.projectiles) {
    if (!PROJECTILES[pr.type].reflectable || pr.grace || pr.stuck) continue;
    const dx = pr.x - cx, dy = pr.y - cy;
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

// could any reflectable projectile reach the zone during this decision window?
function reflectUseful(s, K) {
  const cx = s.player.x + PLAYER.W / 2, cy = s.player.y + PLAYER.H / 2;
  const reach = REFLECT.RADIUS + 3 + ((PLAYER.RUN + 160) * K) / TIMESTEP.HZ;
  for (const pr of s.projectiles) {
    if (!PROJECTILES[pr.type].reflectable || pr.stuck) continue;
    const dx = pr.x - cx, dy = pr.y - cy;
    if (dx * dx + dy * dy <= reach * reach) return true;
  }
  return false;
}

// 'any' mode: each change to the room (a switch fired, a wall broken) pulls the search forward, so multi-step rooms explore past each step
// instead of re-exploring everything before it. Not admissible — 'any' only
// promises a clear, not the earliest one.
const PROGRESS_BONUS = 360; // frames
function progress(st) {
  let n = 0;
  for (const o of st.objects) {
    if (o.kind === 'switch' && o.hits > 0) n++;
    else if ((o.kind === 'wall' || o.kind === 'core') && o.broken) n++;
  }
  return n;
}

/**
 * @param data room JSON
 * @param opts.decisionHz  input decisions per second (default 10)
 * @param opts.maxTime     simulated seconds before giving up
 * @param opts.maxReflects reflect budget (prunes states above it)
 * @param opts.stateCap    visited-state cap
 * @param opts.prefix      input masks replayed before the search starts (staged
 *                         solving by tools: the result's masks include them)
 * @param opts.until       (state) => bool — stop at this intermediate goal
 *                         instead of a clear (staged solving by tools)
 */
export function solve(data, {
  decisionHz = 10, maxTime = 30, maxReflects = 3, stateCap = 400000, posQ = 8, velQ = 120,
  mode = 'min', reflectPenalty = 240, _probe: opts_probe = null, prefix = null, until = null,
} = {}) {
  const room = compileRoom(data);
  const K = Math.max(1, Math.round(TIMESTEP.HZ / decisionHz));
  const maxTick = Math.round(maxTime * TIMESTEP.HZ);

  // Bucket queue ordered by (reflects used, tick): the whole cheaper-reflect
  // space is exhausted before any costlier state is expanded, so the first
  // clear found uses the fewest reflects, and among those clears earliest.
  //   mode 'min': exhaustive by (reflects, tick) — proves the minimum when it
  //               exhausts a budget level within the state cap.
  //   mode 'any': A*-style — tick + frames-to-exit at run speed (admissible) +
  //               a reflect penalty. Finds a clear fast; not minimal.
  const ex = room.exit ? (room.exit[0] + 0.5) * 32 : 480, FPX = TIMESTEP.HZ / PLAYER.RUN;
  const PRI = mode === 'min'
    ? (st) => st.stats.reflects * 1e7 + st.tick
    : (st) => st.tick + Math.round(Math.abs(st.player.x + PLAYER.W / 2 - ex) * FPX) + st.stats.reflects * reflectPenalty - progress(st) * PROGRESS_BONUS;
  const buckets = new Map();
  const push = (n) => { const t = PRI(n.s); if (!buckets.has(t)) buckets.set(t, []); buckets.get(t).push(n); };
  const seen = new Set();
  const s0 = createState(room);
  if (prefix) for (const m of prefix) step(s0, room, m);
  push({ s: s0, parent: null, masks: null });
  let explored = 0;

  while (buckets.size) {
    let t = Infinity;
    for (const b of buckets.keys()) if (b < t) t = b;
    const layer = buckets.get(t);
    buckets.delete(t);
    for (const node of layer) {
      const ns = node.s;
      // Jump only matters when it can start or extend a jump: grounded/coyote,
      // or rising with jump still held. While falling it's noise — prune it.
      const jumpMatters = ns.player.grounded || ns.player.coyote > 0 || (ns.player.rising && (ns.prevInput & JUMP));
      const canReflect = ns.reflect.window === 0 && ns.reflect.cooldown === 0 && ns.stats.reflects < maxReflects && reflectUseful(ns, K);
      const pool = jumpMatters ? (canReflect ? ALL : BASIC) : (canReflect ? ALL_NOJUMP : BASIC_NOJUMP);
      const acts = pool;
      for (const a of acts) {
        const s = clone(node.s);
        const masks = [];
        // A reflect action holds its aim and presses Reflect on the first frame
        // a projectile is at the zone edge — it never whiffs. If nothing comes
        // into reach this window, the action is dropped (it equals a basic one).
        let pressed = false;
        const r0 = s.stats.reflects;
        for (let i = 0; i < K; i++) {
          let m = a.mask;
          if (a.reflect && !pressed && inZone(s)) { m |= RF; pressed = true; }
          masks.push(m);
          step(s, room, m);
          if (s.status !== 'play') break;
        }
        if (a.reflect && s.stats.reflects === r0) continue;
        if (s.status === 'clear' || (until && s.status === 'play' && until(s))) {
          const out = [...masks];
          for (let p = node; p && p.masks; p = p.parent) out.unshift(...p.masks);
          if (prefix) out.unshift(...prefix);
          return { solvable: true, reflects: s.stats.reflects, masks: out, frames: out.length, seconds: +(out.length / TIMESTEP.HZ).toFixed(2), explored };
        }
        if (s.status === 'dead' || s.tick > maxTick || s.stats.reflects > maxReflects) continue;
        const k = key(s, posQ, velQ, K);
        if (seen.has(k)) continue;
        seen.add(k);
        if (opts_probe) opts_probe(s);
        if (++explored > stateCap) return { solvable: false, reason: `state cap ${stateCap} hit`, explored };
        push({ s, parent: node, masks });
      }
    }
  }
  return { solvable: false, reason: 'search exhausted', explored };
}

// Minimal-reflect solve. The single search above already orders by reflects,
// so this is just a solve with a generous budget.
export function solveMinReflects(data, opts = {}) {
  return solve(data, { maxReflects: 4, ...opts, mode: 'min' });
}

export function solveAny(data, opts = {}) {
  return solve(data, { maxReflects: 6, ...opts, mode: 'any' });
}
