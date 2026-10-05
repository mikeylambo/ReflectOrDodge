#!/usr/bin/env node
// Prints the key events of a room's run so a designer can see HOW it was
// solved: the stored solution by default, or the solver's own run (--solve N
// = reflect budget N), e.g. to understand a bypass the under-par search found.
//   node tools/trace.mjs c1-08 [--solve 0] [--hz 5]
import { loadRooms } from '../test/levels-node.mjs';
import { compileRoom } from '../src/sim/room.js';
import { createState, step } from '../src/sim/world.js';
import { decodeLog, heldDir, BTN } from '../src/sim/input.js';
import { solve } from '../test/solver.mjs';

const [id, ...rest] = process.argv.slice(2);
const opt = (k, d) => { const i = rest.indexOf(k); return i >= 0 ? Number(rest[i + 1]) : d; };
const { room: data } = loadRooms().find((r) => r.room.id === id);
let masks;
if (rest.includes('--solve')) {
  const r = solve(data, { mode: 'any', decisionHz: opt('--hz', 5), maxReflects: opt('--solve', 0) });
  if (!r.solvable) { console.log('no solution:', r.reason); process.exit(1); }
  masks = r.masks;
} else masks = decodeLog(data.solution);
const room = compileRoom(data);
const s = createState(room);
const col = (x) => (x / 32).toFixed(1);
let lastMove = null;
for (let i = 0; i < masks.length && s.status === 'play'; i++) {
  const m = masks[i];
  const mv = `${m & BTN.L ? 'L' : ''}${m & BTN.R ? 'R' : ''}${m & BTN.JUMP ? ' jump' : ''}`;
  if (mv !== lastMove) { console.log(`${(i / 120).toFixed(2)}s  input ${mv || 'idle'}  @col ${col(s.player.x + 7)}`); lastMove = mv; }
  for (const e of step(s, room, m)) {
    if (/telegraph|land|reflect.open|destroy/.test(e.type)) continue;
    const extra = e.type === 'projectile.reflect' ? ` ${heldDir(m)}` : '';
    console.log(`${(i / 120).toFixed(2)}s  ${e.type}${extra}  @col ${col(e.x ?? 0)}  player col ${col(s.player.x + 7)}`);
  }
}
console.log(`${s.status} in ${(s.tick / 120).toFixed(2)}s, ◇${s.stats.reflects}`);
