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
import { loadRooms, loadIndex } from './levels-node.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { validateRoom, compileRoom } from '../src/sim/room.js';
import { runLog } from '../src/sim/world.js';
import { decodeLog, encodeLog } from '../src/sim/input.js';
import { PROJECTILES } from '../src/projectiles/index.js';
import { OBJECTS } from '../src/objects/index.js';
import { validateProjectileType } from '../src/projectiles/_projectile.js';
import { validateObjectType } from '../src/objects/_object.js';
import { runUnit } from './unit.mjs';
import { runSpeedrunTests } from './speedrun.mjs';
import { runSteamTests } from './steam.mjs';
import { cachedSolve, saveSolveCache, cacheStats } from './solve-cache.mjs';

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
for (const [ok, label, detail] of runSpeedrunTests()) report(ok, label, detail);
for (const [ok, label, detail] of await runSteamTests()) report(ok, label, detail);

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

console.log('── content: chapter index + ideas catalogue ──');
{
  const index = loadIndex();
  const byId = new Set(rooms.map((r) => r.room.id));
  const ideas = readFileSync(new URL('../src/content/ideas.md', import.meta.url), 'utf8');
  const rowsById = new Map();
  for (const line of ideas.split('\n')) {
    const m = /^\| ([a-z0-9-]+) [^|]*\| [^|]*\| ([^|]+)\| *(✓?) *\|/.exec(line);
    if (m) rowsById.set(m[1], { idea: m[2].trim(), pass: m[3] === '✓' });
  }
  const indexed = index.chapters.flatMap((c) => c.rooms);
  const missing = indexed.filter((id) => !byId.has(id));
  report(missing.length === 0, 'index.json: every listed room exists', missing.join(', '));
  report(new Set(indexed).size === indexed.length, 'index.json: no room listed twice');
  const mirrorIds = new Set(rooms.filter((r) => r.room.mirrorOf).map((r) => r.room.id)); // mirrors share their original's idea
  const noIdea = [...byId].filter((id) => !rowsById.has(id) && !mirrorIds.has(id));
  report(noIdea.length === 0, 'ideas.md: every room has an idea entry', noIdea.join(', '));
  const sentences = [...rowsById.values()].map((r) => r.idea.toLowerCase());
  report(new Set(sentences).size === sentences.length, 'ideas.md: no idea repeats');
  for (const c of index.chapters) {
    if (c.scored === false) continue;
    const pass = c.rooms.filter((id) => rowsById.get(id) && rowsById.get(id).pass).length;
    report(pass * 4 >= c.rooms.length, `${c.id}: let-it-pass quota (≥ 1 in 4)`, `${pass}/${c.rooms.length}`);
  }
}

console.log('── mirror rooms: one property changed, original solution defeated ──');
{
  const byId = Object.fromEntries(rooms.map((r) => [r.room.id, r.room]));
  for (const { room: m } of rooms) {
    if (!m.mirrorOf) continue;
    const o = byId[m.mirrorOf];
    if (!o) { report(false, `${m.id}: mirrorOf "${m.mirrorOf}" exists`); continue; }
    // count changed properties: tiles, spawn, exit, goal, each emitter, each object
    const changes = [];
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    for (const k of ['tiles', 'spawn', 'exit', 'goal']) if (!same(o[k], m[k])) changes.push(k);
    const n = Math.max(o.emitters.length, m.emitters.length);
    for (let i = 0; i < n; i++) if (!same(o.emitters[i], m.emitters[i])) changes.push(`emitter ${i}`);
    const k2 = Math.max(o.objects.length, m.objects.length);
    for (let i = 0; i < k2; i++) if (!same(o.objects[i], m.objects[i])) changes.push(`object ${i}`);
    report(changes.length === 1, `${m.id}: changes exactly one property of ${o.id}`, changes.join(', '));
    const { state } = runLog(compileRoom(m), decodeLog(o.solution));
    report(state.status !== 'clear', `${m.id}: ${o.id}'s solution does not clear it`, state.status);
  }
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

// The solver gates and diagnostics (GDD: Testing). Decision rates model a
// human: 5 Hz = an input change every 0.2 s.
const SOLVE_HZ = 5;
const COMFORT_HZ = [4, 3];
const FAST_PROJQ = 32; // px: coarse projectile buckets for the first solvability search
const DEEP_CAP = 2500000; // last-resort search for rooms the default cap can't prove
// input changes per second, worst 1 s window (a human-rate check for recorded runs)
function changesPerSecond(masks) {
  const ch = [];
  for (let i = 1; i < masks.length; i++) if ((masks[i] & ~32) !== (masks[i - 1] & ~32)) ch.push(i);
  let worst = 0;
  for (let a = 0, b = 0; b < ch.length; b++) { while (ch[b] - ch[a] >= 120) a++; worst = Math.max(worst, b - a + 1); }
  return worst;
}
const diag = (label, detail) => console.log(`⚑ ${label}${detail ? ` — ${detail}` : ''}`);

// Projectile fixtures (test/fixtures): minimal rooms for the Chapter 5–7
// types, outside the campaign. Each recorded solution replays to a clear within
// par, and the solver proves the room both solvable at par and not under it.
{
  console.log('── projectile fixtures (Splitter, Charge, Twin) ──');
  const FX = new URL('./fixtures/', import.meta.url);
  for (const f of readdirSync(FX).filter((n) => n.startsWith('fx-') && n.endsWith('.json')).sort()) {
    const fx = JSON.parse(readFileSync(new URL(f, FX), 'utf8'));
    const errs = validateRoom(fx);
    if (errs.length) { report(false, `${fx.id}: valid`, errs.join('; ')); continue; }
    const { state } = runLog(compileRoom(fx), decodeLog(fx.solution));
    report(state.status === 'clear' && state.stats.reflects <= fx.par, `${fx.id}: recorded solution clears within par`, `${state.status} ◇${state.stats.reflects}/${fx.par}`);
    const r = cachedSolve(fx, { mode: 'any', decisionHz: SOLVE_HZ, maxReflects: fx.par });
    report(r.solvable, `${fx.id}: solver clears within par`, r.solvable ? `◇${r.reflects} in ${r.explored} states` : r.reason);
    if (fx.par > 0) {
      const u = cachedSolve(fx, { mode: 'any', decisionHz: SOLVE_HZ, maxReflects: fx.par - 1 });
      report(!u.solvable && !u.reason.startsWith('state cap'), `${fx.id}: needs its rule (no clear under par)`, u.solvable ? `◇${u.reflects}` : u.reason);
    }
  }
}

console.log(`── solvability: solver finds a clear within par (${SOLVE_HZ} Hz) ──`);
for (const { room } of rooms) {
  // any successful solve proves the room; coarser rates search a smaller space,
  // so a room the 5 Hz search caps on can still be proven at 4 or 3 Hz
  // first a fast search with coarse projectile buckets (it only has to FIND
  // a clear); if it doesn't, the exact searches below decide
  let hz = SOLVE_HZ;
  let r = cachedSolve(room, { mode: 'any', decisionHz: hz, maxReflects: room.par, projQ: FAST_PROJQ });
  if (!r.solvable) for (hz of [SOLVE_HZ, ...COMFORT_HZ]) {
    r = cachedSolve(room, { mode: 'any', decisionHz: hz, maxReflects: room.par });
    if (r.solvable) break;
  }
  // multi-answer rooms (Examiner phases) can need a deeper search to prove.
  // Only they get it: a 2.5M-state search costs ~4 GB and half an hour, and an
  // ordinary room that caps there (c3-08) falls back to its recorded solution
  // below anyway — running it anyway ran CI out of memory.
  const multiAnswer = (room.objects || []).some((o) => o.kind === 'core');
  for (const deepHz of [COMFORT_HZ[0], SOLVE_HZ]) {
    if (!multiAnswer || r.solvable || !r.reason.startsWith('state cap')) break;
    hz = deepHz;
    r = cachedSolve(room, { mode: 'any', decisionHz: hz, maxReflects: room.par, stateCap: DEEP_CAP });
  }
  if (!r.solvable && r.reason.startsWith('state cap') && room.solution) {
    // GDD fallback for rooms too deep to search: the recorded solution, at a
    // human decision rate, clears within par (comfort still reports below)
    const { state } = runLog(compileRoom(room), decodeLog(room.solution));
    const ok = state.status === 'clear' && state.stats.reflects <= room.par && changesPerSecond(decodeLog(room.solution)) <= SOLVE_HZ;
    report(ok, `${room.id}: recorded solution clears within par (search capped)`, `◇${state.stats.reflects}/${room.par}, ${state.status}`);
    if (ok) diag(`${room.id}: proven by its recorded solution, not by search`, 'deep room — review by hand');
    continue;
  }
  report(r.solvable, `${room.id}: solver clears within par`, r.solvable ? `◇${r.reflects}/${room.par} in ${r.seconds}s at ${hz} Hz, ${r.explored} states` : `${r.reason} (${r.explored} states)`);
}

console.log('── under-par search (diagnostic: a cheaper solution than the designer\'s) ──');
for (const { room } of rooms) {
  if (room.par === 0) continue;
  const r = cachedSolve(room, { mode: 'any', decisionHz: SOLVE_HZ, maxReflects: room.par - 1 });
  if (r.solvable) diag(`${room.id}: solvable with ◇${r.reflects} (par ${room.par})`, 'expression or a bypass — review');
  else console.log(`· ${room.id}: none with ◇≤${room.par - 1} (${r.reason.startsWith('state cap') ? 'search capped — unproven' : 'exhausted'})`);
}

console.log(`── comfort (diagnostic: still solvable at ${COMFORT_HZ.join(' / ')} Hz) ──`);
for (const { room } of rooms) {
  const cells = COMFORT_HZ.map((hz) => {
    const r = cachedSolve(room, { mode: 'any', decisionHz: hz, maxReflects: room.par });
    return r.solvable ? `${hz}Hz ${r.seconds}s` : `${hz}Hz FAIL`;
  });
  const ok = !cells.some((c) => c.endsWith('FAIL'));
  (ok ? (l, d) => console.log(`· ${l} — ${d}`) : diag)(`${room.id}: comfort`, cells.join(' · '));
}
saveSolveCache();
{ const { hits, misses } = cacheStats(); console.log(`  (solver cache: ${hits} hit, ${misses} solved)`); }

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
