#!/usr/bin/env node
// Room lab: quick solver read on a draft room file before it joins the game.
//   node tools/room-lab.mjs path/to/room.json [--without <emitter index>] [--hz 5]
// Prints the fewest reflects found (budgets 0..3), and at 3 Hz within that.
// --without drops one emitter, to prove the room needs it.
import { readFileSync } from 'node:fs';
import { validateRoom } from '../src/sim/room.js';
import { solve } from '../test/solver.mjs';

const args = process.argv.slice(2);
const room = JSON.parse(readFileSync(args[0], 'utf8'));
const w = args.indexOf('--without');
if (w >= 0) room.emitters = room.emitters.filter((_, i) => i !== Number(args[w + 1]));
const hzAt = args.indexOf('--hz');
const hz = hzAt >= 0 ? Number(args[hzAt + 1]) : 5;
const v = validateRoom(room);
if (v && v.length) { console.log('INVALID', v); process.exit(1); }
const t0 = Date.now();
let found = null;
const notes = [];
for (let b = 0; b <= 3 && !found; b++) {
  const r = solve(room, { decisionHz: hz, mode: 'any', maxReflects: b });
  if (r.solvable) found = { b, r }; else notes.push(`${b}:${r.reason.startsWith('state cap') ? 'cap' : 'none'}`);
}
console.log(`${room.id}${w >= 0 ? ` without emitter ${args[w + 1]}` : ''} @${hz}Hz: ${found ? `◇${found.r.reflects}` : 'unsolvable ≤3'} [${notes.join(' ')}] ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (found) {
  const r3 = solve(room, { decisionHz: 3, mode: 'any', maxReflects: found.r.reflects });
  console.log(`  3Hz within ◇${found.r.reflects}: ${r3.solvable ? 'pass' : r3.reason.startsWith('state cap') ? 'capped' : 'FAIL'}`);
}
