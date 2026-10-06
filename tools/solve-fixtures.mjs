#!/usr/bin/env node
// Solves the projectile fixtures in test/fixtures, stores each solution, and
// records the solver's search time per fixture in test/fixtures/timings.json.
// Budgets 0, 1, … par are tried in order, so a fixture that clears under its
// designed par is reported (the rule it was built to prove isn't required).
//
//   node tools/solve-fixtures.mjs [--write] [ids…]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { solve } from '../test/solver.mjs';
import { encodeLog } from '../src/sim/input.js';
import { formatRoom } from '../src/sim/format.js';

const DIR = new URL('../test/fixtures/', import.meta.url);
const args = process.argv.slice(2);
const write = args.includes('--write');
const ids = args.filter((a) => !a.startsWith('--'));
const timings = {};
let bad = 0;

for (const f of readdirSync(DIR).filter((f) => f.startsWith('fx-') && f.endsWith('.json')).sort()) {
  const room = JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
  if (ids.length && !ids.includes(room.id)) continue;
  const t0 = Date.now();
  let found = null; const notes = [];
  for (let b = 0; b <= room.par && !found; b++) {
    const r = solve(room, { mode: 'any', decisionHz: 5, maxReflects: b });
    if (r.solvable) found = r; else notes.push(`${b}:${r.reason.startsWith('state cap') ? 'cap' : 'exhausted'}(${r.explored})`);
  }
  const ms = Date.now() - t0;
  const ok = found && found.reflects === room.par;
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} ${room.id}: ${found ? `◇${found.reflects} (par ${room.par}), ${found.explored} states` : 'no clear'}  [${notes.join(' ')}]  ${ms} ms`);
  timings[room.id] = { par: room.par, found: found ? found.reflects : null, ms, explored: found ? found.explored : null };
  if (write && ok) { room.solution = encodeLog(found.masks); writeFileSync(new URL(f, DIR), formatRoom(room)); }
}
if (write) writeFileSync(new URL('timings.json', DIR), `${JSON.stringify(timings, null, 1)}\n`);
process.exitCode = bad ? 1 : 0;
