#!/usr/bin/env node
// Authors the designer solution for each sample room. A plan is a small
// reactive policy — "walk right; when an orb is D px away, neutral-reflect" —
// swept over a couple of parameters. The policy drives the real simulation and
// its per-frame input masks are recorded; the recorded log is what ships in
// the room's `solution` field (the policy itself never runs in-game or in CI).
//
//   node tools/author-solutions.mjs
import { writeFileSync } from 'node:fs';
import { loadRooms, LEVELS_DIR } from '../test/levels-node.mjs';
import { compileRoom } from '../src/sim/room.js';
import { createState, step } from '../src/sim/world.js';
import { BTN, encodeLog } from '../src/sim/input.js';
import { formatRoom } from '../src/sim/format.js';
import { PLAYER } from '../src/config/tunables.js';

const { L, R, U, JUMP, REFLECT } = BTN;
const MAX_FRAMES = 120 * 30;

// nearest incoming projectile's horizontal distance to the player centre
function nearestOrb(s) {
  const cx = s.player.x + PLAYER.W / 2;
  let best = null;
  for (const p of s.projectiles) {
    if (p.reflected) continue;
    const d = Math.abs(p.x - cx);
    if (best === null || d < best.d) best = { d, p };
  }
  return best;
}

const PLANS = {
  // hop over the orb when it's D px out, let it fly on into the switch,
  // then walk out through the open door
  'p0-01': function* () {
    for (let D = 20; D < 120; D += 2) yield (s, mem) => {
      const door = s.objects.find((o) => o.kind === 'door');
      if (door.open) return L;
      const n = nearestOrb(s);
      if (!mem.jumped && n && n.d < D && n.p.x > s.player.x) { mem.jumped = s.tick; return JUMP; }
      if (mem.jumped && s.tick - mem.jumped < 30) return JUMP;
      return 0;
    };
  },
  // stand at spawn, reflect up as the orb arrives, then walk out
  'p0-02': function* () {
    for (let D = 30; D < 120; D += 2) yield (s, mem) => {
      const door = s.objects.find((o) => o.kind === 'door');
      if (door.open) return L;
      const n = nearestOrb(s);
      if (!mem.r && n && n.d < D) { mem.r = 1; return U | REFLECT; }
      return mem.r ? U : 0;
    };
  },
  // from the tunnel mouth: neutral-reflect one orb home, hop the orbs
  // already in flight, then walk the dead tunnel to the exit
  'p0-03': function* () {
    for (let D = 30; D < 60; D += 2) for (let J = 20; J < 80; J += 4) yield (s, mem) => {
      const emitter = s.objects.find((o) => o.kind === 'emitter');
      const n = nearestOrb(s);
      if (!emitter.on && !n) return R;
      if (mem.jumped !== undefined && s.tick - mem.jumped < 30) return JUMP;
      if (!n) return 0;
      if (!mem.pressed && n.d < D) { mem.pressed = 1; return REFLECT; }
      if (mem.pressed && s.reflect.window === 0 && n.d < J && s.player.grounded) { mem.jumped = s.tick; return JUMP; }
      return 0;
    };
  },
};

let failed = false;
for (const { file, room } of loadRooms()) {
  const plan = PLANS[room.id];
  if (!plan) continue;
  const compiled = compileRoom(room);
  let best = null;
  for (const policy of plan()) {
    const s = createState(compiled);
    const mem = {};
    const masks = [];
    while (s.status === 'play' && masks.length < MAX_FRAMES) {
      const m = policy(s, mem);
      masks.push(m);
      step(s, compiled, m);
    }
    if (s.status === 'clear' && s.stats.reflects <= room.par && (!best || masks.length < best.length)) best = masks;
  }
  if (!best) { console.log(`✗ ${room.id}: no plan candidate cleared within par ${room.par}`); failed = true; continue; }
  room.solution = encodeLog(best);
  writeFileSync(LEVELS_DIR + file, formatRoom(room));
  console.log(`✓ ${room.id}: ${best.length} frames (${(best.length / 120).toFixed(2)}s) → ${room.solution}`);
}
if (failed) process.exitCode = 1;
