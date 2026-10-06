#!/usr/bin/env node
// Builds the projectile fixture rooms in test/fixtures (not campaign content):
// minimal rooms that each prove one rule of a new projectile type end to end
// through the solver. Writes them without solutions; tools/solve-fixtures.mjs
// solves them and records the search time.
import { writeFileSync, mkdirSync } from 'node:fs';
import { emptyTiles, validateRoom } from '../src/sim/room.js';
import { formatRoom } from '../src/sim/format.js';

const DIR = new URL('../test/fixtures/', import.meta.url);
mkdirSync(DIR, { recursive: true });

function room(id, name, { spawn, exit, emitters = [], objects = [], par, fill = [] }) {
  const t = emptyTiles().map((r) => r.split(''));
  for (const [x0, x1, y0, y1, ch = '#'] of fill) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) t[y][x] = ch;
  return { id, name, tiles: t.map((r) => r.join('')), spawn, exit, emitters, objects, par, solution: null, mirrorOf: null };
}

const FIXTURES = [
  // Splitter: one reflect, two halves, two switches — each half opens one of
  // the two doors in front of the exit. No single straight shot hits both.
  room('fx-splitter-fork', 'Fork', {
    spawn: [6, 15], exit: [27, 15], par: 1,
    emitters: [{ type: 'splitter', at: [14, 1], dir: 'down', period: 2.4, phase: 0 }],
    objects: [
      { kind: 'switch', at: [8, 9], links: ['d1'] }, { kind: 'switch', at: [20, 9], links: ['d2'] },
      { kind: 'door', id: 'd1', at: [23, 13], h: 3 }, { kind: 'door', id: 'd2', at: [25, 13], h: 3 },
    ],
  }),
  // Splitter: every reflect of a Splitter is diagonal, and the switch behind
  // the pillar is only on a 45° line from the lane; jump into the lane to answer.
  room('fx-splitter-angle', 'Angle', {
    spawn: [8, 15], exit: [27, 15], par: 1,
    emitters: [{ type: 'splitter', at: [28, 13], dir: 'left', period: 2.4, phase: 0 }],
    objects: [{ kind: 'switch', at: [20, 6], links: ['d1'] }, { kind: 'door', id: 'd1', at: [25, 14], h: 2 }],
    fill: [[22, 22, 1, 10]],
  }),
  // Charge: answer it early (while it's still harmless) up into the switch
  // under the slab; there's no other way to open the door.
  room('fx-charge-early', 'Early', {
    spawn: [4, 15], exit: [27, 15], par: 1,
    emitters: [{ type: 'charge', at: [22, 15], dir: 'left', period: 6, phase: 0 }],
    objects: [{ kind: 'switch', at: [12, 8], links: ['d1'] }, { kind: 'door', id: 'd1', at: [24, 13], h: 3 }],
    fill: [[3, 20, 7, 7]],
  }),
  // Charge: slow, it passes through you harmlessly; let it, and it reaches the
  // switch on the far wall that opens the door.
  room('fx-charge-pass', 'Pass', {
    spawn: [14, 15], exit: [27, 15], par: 0,
    emitters: [{ type: 'charge', at: [22, 15], dir: 'left', period: 8, phase: 0 }],
    objects: [{ kind: 'switch', at: [1, 15], links: ['d1'] }, { kind: 'door', id: 'd1', at: [24, 13], h: 3 }],
  }),
  // Twin: answer the low twin up into the high switch and the high twin is
  // mirrored down onto the floor switch below it — step out of its way.
  room('fx-twin-mirror', 'Mirror', {
    spawn: [18, 15], exit: [28, 15], par: 1,
    emitters: [{ type: 'twin', at: [1, 13], dir: 'right', period: 3, phase: 0 }],
    objects: [
      { kind: 'switch', at: [14, 6], links: ['d1'] }, { kind: 'switch', at: [14, 15], links: ['d2'] },
      { kind: 'door', id: 'd1', at: [24, 13], h: 3 }, { kind: 'door', id: 'd2', at: [26, 13], h: 3 },
    ],
  }),
  // Twin: send one home and both come home — onto the two switches that flank
  // their emitter (the pair is too wide to shut the emitter itself).
  room('fx-twin-home', 'Home', {
    spawn: [12, 11], exit: [28, 15], par: 1,
    emitters: [{ type: 'twin', at: [1, 10], dir: 'right', period: 3, phase: 0 }],
    objects: [
      { kind: 'switch', at: [1, 9], links: ['d1'] }, { kind: 'switch', at: [1, 11], links: ['d2'] },
      { kind: 'door', id: 'd1', at: [24, 13], h: 3 }, { kind: 'door', id: 'd2', at: [26, 13], h: 3 },
    ],
    fill: [[8, 16, 12, 12]],
  }),
];

for (const f of FIXTURES) {
  const errs = validateRoom(f);
  if (errs.length) { console.log(`✗ ${f.id}: ${errs.join('; ')}`); process.exitCode = 1; continue; }
  writeFileSync(new URL(`${f.id}.json`, DIR), formatRoom(f));
  console.log(`✓ ${f.id}`);
}
