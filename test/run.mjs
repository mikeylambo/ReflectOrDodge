#!/usr/bin/env node
// `npm test` — every gate the GDD lists for M0:
//   1. contracts + room schema validation (links resolve, objects don't overlap)
//   2. determinism: a room's solution replayed twice → identical final state
//   3. solution check: the stored solution clears the room within par
//   4. browser smoke (skip with --no-browser): boots, renders, input works,
//      reflect works, editor boots, Node and Chromium replays agree bit for bit,
//      zero console errors
// Any room added to src/content/rooms/ is covered automatically.
import { createHash } from 'node:crypto';
import { loadRooms } from './levels-node.mjs';
import { validateRoom, compileRoom } from '../src/sim/room.js';
import { runLog } from '../src/sim/world.js';
import { decodeLog, encodeLog } from '../src/sim/input.js';
import { PROJECTILES } from '../src/projectiles/index.js';
import { OBJECTS } from '../src/objects/index.js';
import { validateProjectileType } from '../src/projectiles/_projectile.js';
import { validateObjectType } from '../src/objects/_object.js';
import { runUnit } from './unit.mjs';

let failures = 0;
const report = (ok, label, detail = '') => {
  failures += ok ? 0 : 1;
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

console.log('── contracts ──');
for (const mod of Object.values(PROJECTILES)) {
  try { validateProjectileType(mod); report(true, `projectile "${mod.type}" satisfies the contract`); } catch (e) { report(false, e.message); }
}
for (const mod of Object.values(OBJECTS)) {
  try { validateObjectType(mod); report(true, `object "${mod.kind}" satisfies the contract`); } catch (e) { report(false, e.message); }
}

console.log('── determinism guard ──');
{
  // the simulation must never read randomness or a clock
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const walk = (d) => readdirSync(d).flatMap((f) => (statSync(d + f).isDirectory() ? walk(`${d + f}/`) : [d + f]));
  const banned = /Math\.random|Date\.now|new Date|performance\.now|requestAnimationFrame|setTimeout|setInterval/;
  const sim = new URL('../src/sim/', import.meta.url).pathname;
  const code = (f) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // comments may name what's banned
  const hits = walk(sim).filter((f) => f.endsWith('.js')).filter((f) => banned.test(code(f)));
  report(hits.length === 0, 'src/sim uses no randomness, clocks or timers', hits.join(', '));
}

console.log('── unit ──');
for (const [ok, label, detail] of runUnit()) report(ok, label, detail);

const rooms = loadRooms();
console.log('── room schema ──');
const ids = new Set();
for (const { file, room } of rooms) {
  const errs = validateRoom(room);
  if (`${room.id}.json` !== file) errs.push(`file name ${file} does not match id ${room.id}`);
  if (ids.has(room.id)) errs.push('duplicate id');
  ids.add(room.id);
  if (!room.solution) errs.push('no recorded solution');
  report(errs.length === 0, `${file}: well formed`, errs.join('; '));
}

console.log('── determinism ──');
const nodeHashes = {};
for (const { room } of rooms) {
  if (!room.solution) continue;
  const compiled = compileRoom(room);
  const masks = decodeLog(room.solution);
  const a = JSON.stringify(runLog(compiled, masks).state);
  const b = JSON.stringify(runLog(compileRoom(room), decodeLog(room.solution)).state);
  const roundTrip = encodeLog(masks) === room.solution;
  nodeHashes[room.id] = hash(a);
  report(a === b && roundTrip, `${room.id}: replay twice → identical end state`, `${hash(a)}${roundTrip ? '' : ' (log does not round-trip)'}`);
}

console.log('── solution within par ──');
for (const { room } of rooms) {
  if (!room.solution) continue;
  const { state } = runLog(compileRoom(room), decodeLog(room.solution));
  const ok = state.status === 'clear' && state.stats.reflects <= room.par;
  report(ok, `${room.id}: solution clears`, `status ${state.status}, ◇${state.stats.reflects}/${room.par}, ${(state.tick / 120).toFixed(2)}s`);
}

if (!process.argv.includes('--no-browser')) {
  console.log('── browser smoke ──');
  const { runBrowser } = await import('./smoke.mjs');
  try {
    for (const [ok, label, detail] of await runBrowser(nodeHashes, hash)) report(ok, label, detail);
  } catch (e) {
    report(false, 'browser smoke crashed', e.stack || String(e));
  }
}

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
