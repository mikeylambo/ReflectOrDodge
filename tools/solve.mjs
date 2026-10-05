#!/usr/bin/env node
// Solver CLI for room authoring.
//
//   node tools/solve.mjs                 every room: fewest reflects the solver finds
//   node tools/solve.mjs c1-04 c1-05     just these rooms
//   node tools/solve.mjs c1-04 --write   also store the solver's run as the room's
//                                        solution and set par to its reflect count
//   --hz N                               decision rate (default 5)
//
// Budgets are tried in order 0, 1, 2… A budget that ends "exhausted" proves no
// solution with that many reflects exists at this decision rate; "cap" means
// the search gave up, which proves nothing.
import { writeFileSync } from 'node:fs';
import { loadRooms, LEVELS_DIR } from '../test/levels-node.mjs';
import { solve } from '../test/solver.mjs';
import { encodeLog } from '../src/sim/input.js';
import { formatRoom } from '../src/sim/format.js';

const args = process.argv.slice(2);
const write = args.includes('--write');
const hzAt = args.indexOf('--hz');
const hz = hzAt >= 0 ? Number(args[hzAt + 1]) : 5;
const ids = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--hz');

for (const { file, room } of loadRooms()) {
  if (ids.length && !ids.includes(room.id)) continue;
  const notes = [];
  let found = null;
  const t0 = Date.now();
  for (let b = 0; b <= 4 && !found; b++) {
    const r = solve(room, { decisionHz: hz, mode: 'any', maxReflects: b });
    if (r.solvable) found = r;
    else notes.push(`${b}:${r.reason.startsWith('state cap') ? 'cap' : 'exhausted'}`);
  }
  const ms = Date.now() - t0;
  if (!found) { console.log(`✗ ${room.id}: no solution (${notes.join(' ')}) ${ms}ms`); process.exitCode = 1; continue; }
  const flag = found.reflects < room.par ? '  ⚑ under par' : found.reflects > room.par ? '  ⚠ over par' : '';
  console.log(`✓ ${room.id}: ◇${found.reflects} (par ${room.par}) in ${found.seconds}s  [${notes.join(' ') || 'first budget'}] ${ms}ms${flag}`);
  if (write) {
    room.solution = encodeLog(found.masks);
    room.par = found.reflects;
    writeFileSync(LEVELS_DIR + file, formatRoom(room));
    console.log(`  wrote solution + par ${found.reflects}`);
  }
}
