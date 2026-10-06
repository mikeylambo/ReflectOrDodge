#!/usr/bin/env node
// Builds mirror rooms (GDD: Mirror rooms): same geometry, exactly one changed
// property, and the change must require a different solution. For each core
// room, candidate single-property changes are tried in order of how much they
// change the puzzle — move the exit, reverse an emitter, move a switch, shift a
// phase — and the first one that (1) validates, (2) the original solution no
// longer clears, and (3) the solver can clear is written as `<id>-m.json` with
// the solver's run as its solution and par.
//
//   node tools/make-mirrors.mjs c1-01 c1-02 …     (skips rooms whose mirror exists; --force to redo)
//
// A candidate is also rejected when it makes the room EASIER: if a solution
// with fewer reflects than the core room's par exists, or if the mirror can be
// cleared without changing the room at all (no switch fired, no wall broken)
// while the original needed that — e.g. an exit moved past every door.
import { writeFileSync, existsSync } from 'node:fs';
import { loadRooms, LEVELS_DIR } from '../test/levels-node.mjs';
import { validateRoom, compileRoom, tileRows } from '../src/sim/room.js';
import { runLog, createState, step } from '../src/sim/world.js';
import { decodeLog, encodeLog } from '../src/sim/input.js';
import { solve } from '../test/solver.mjs';
import { formatRoom } from '../src/sim/format.js';
import { ROOM } from '../config/tunables.js';

const args = process.argv.slice(2);
const force = args.includes('--force');
const ids = args.filter((a) => !a.startsWith('--'));
const clone = (o) => JSON.parse(JSON.stringify(o));
const OPP = { left: 'right', right: 'left', up: 'down', down: 'up' };

function* candidates(room) {
  const rows = tileRows(room.tiles);
  const free = (x, y) => rows[y] && rows[y][x] === '.';
  // 1. exit moved to the mirrored column (same row), standing on something
  if (room.exit) {
    const [ex, ey] = room.exit, mx = ROOM.COLS - 1 - ex;
    if (mx !== ex && free(mx, ey)) yield { what: `exit moved to column ${mx}`, apply: (r) => { r.exit = [mx, ey]; } };
  }
  // 2. an emitter reversed: moved to the mirrored column and facing the other way
  for (let i = 0; i < room.emitters.length; i++) {
    const e = room.emitters[i];
    if (e.dir !== 'left' && e.dir !== 'right') continue;
    const mx = ROOM.COLS - 1 - e.at[0];
    yield { what: `emitter ${i} reversed (column ${mx}, firing ${OPP[e.dir]})`, apply: (r) => { r.emitters[i].at = [mx, e.at[1]]; r.emitters[i].dir = OPP[e.dir]; } };
  }
  // 3. a switch moved to the mirrored column
  for (let i = 0; i < room.objects.length; i++) {
    const o = room.objects[i];
    if (o.kind !== 'switch') continue;
    const mx = ROOM.COLS - 1 - o.at[0];
    if (mx !== o.at[0] && free(mx, o.at[1])) yield { what: `switch ${i} moved to column ${mx}`, apply: (r) => { r.objects[i].at = [mx, o.at[1]]; } };
  }
  // 4. a phase shifted by half a period (last resort: same idea, new timing)
  for (let i = 0; i < room.emitters.length; i++) {
    const e = room.emitters[i];
    yield { what: `emitter ${i} phase shifted half a period`, apply: (r) => { r.emitters[i].phase = +(((e.phase || 0) + e.period / 2) % e.period).toFixed(3); } };
  }
  // 5. a vertical emitter moved to the mirrored column
  for (let i = 0; i < room.emitters.length; i++) {
    const e = room.emitters[i];
    if (e.dir !== 'up' && e.dir !== 'down') continue;
    const mx = ROOM.COLS - 1 - e.at[0];
    if (mx !== e.at[0]) yield { what: `emitter ${i} moved to column ${mx}`, apply: (r) => { r.emitters[i].at = [mx, e.at[1]]; } };
  }
  // 6. an emitter's period a quarter shorter, then a quarter longer
  for (let i = 0; i < room.emitters.length; i++) {
    const e = room.emitters[i];
    for (const f of [0.75, 1.25]) {
      const p = +(e.period * f).toFixed(2);
      if (p > 0.6) yield { what: `emitter ${i} period ${e.period} → ${p} s`, apply: (r) => { r.emitters[i].period = p; } };
    }
  }
  // 7. the spawn moved to the mirrored column (standing on something)
  {
    const [sx, sy] = room.spawn, mx = ROOM.COLS - 1 - sx;
    const solid = (x, y) => rows[y] && rows[y][x] === '#';
    if (mx !== sx && free(mx, sy) && solid(mx, sy + 1)) yield { what: `spawn moved to column ${mx}`, apply: (r) => { r.spawn = [mx, sy]; } };
  }
}

// how many times a run changes the room (switches fired, walls broken)
function roomChanges(data, masks) {
  const r = compileRoom(data), s = createState(r);
  let n = 0;
  for (let i = 0; i < masks.length && s.status === 'play'; i++) {
    for (const e of step(s, r, masks[i])) if (e.type === 'switch.hit' || e.type === 'wall.break') n++;
  }
  return n;
}

for (const { room } of loadRooms()) {
  if (ids.length && !ids.includes(room.id)) continue;
  if (room.mirrorOf || room.goal === 'cores') continue;
  const mid = `${room.id}-m`;
  if (existsSync(`${LEVELS_DIR}${mid}.json`) && !force) { console.log(`· ${mid} exists`); continue; }
  const orig = decodeLog(room.solution);
  let done = false;
  for (const c of candidates(room)) {
    const m = clone(room);
    c.apply(m);
    Object.assign(m, { id: mid, name: `${room.name} ⇋`, mirrorOf: room.id, solution: null });
    if (validateRoom(m).length) continue;
    const { state } = runLog(compileRoom(m), orig);
    if (state.status === 'clear') { console.log(`  ${mid}: ${c.what} — original still clears, next`); continue; }
    let r = null;
    for (const hz of [5, 4]) { r = solve(m, { mode: 'any', decisionHz: hz, maxReflects: Math.max(room.par + 1, 2) }); if (r.solvable) break; }
    if (!r.solvable) { console.log(`  ${mid}: ${c.what} — solver found no clear, next`); continue; }
    if (r.reflects < room.par) { console.log(`  ${mid}: ${c.what} — easier than the original (◇${r.reflects} < ${room.par}), next`); continue; }
    if (room.par > 0) {
      const cheaper = solve(m, { mode: 'any', decisionHz: 5, maxReflects: room.par - 1, stateCap: 150000 });
      if (cheaper.solvable) { console.log(`  ${mid}: ${c.what} — clears with ◇${cheaper.reflects}, easier than par ${room.par}, next`); continue; }
    }
    if (roomChanges(room, orig) > 0 && roomChanges(m, r.masks) === 0) { console.log(`  ${mid}: ${c.what} — clears without touching the room's machinery, next`); continue; }
    m.solution = encodeLog(r.masks);
    m.par = r.reflects;
    writeFileSync(`${LEVELS_DIR}${mid}.json`, formatRoom(m));
    console.log(`✓ ${mid}: ${c.what} · ◇${r.reflects} (core par ${room.par}) in ${r.seconds}s`);
    done = true;
    break;
  }
  if (!done) { console.log(`✗ ${mid}: no candidate worked`); process.exitCode = 1; }
}
