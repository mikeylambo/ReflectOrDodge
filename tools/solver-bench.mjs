#!/usr/bin/env node
// Solver benchmark: the CI gate's workload per room, uncached —
//   at-par    5 Hz search within par (the solvability gate)
//   under-par 5 Hz search with par − 1 reflects (the under-par diagnostic)
// both at the default state cap. Prints a table and writes JSON for before /
// after comparisons.
//
//   node tools/solver-bench.mjs c3-ex3 c1-20 … [--out file.json]
import { writeFileSync } from 'node:fs';
import { loadRooms } from '../test/levels-node.mjs';
import { solve } from '../test/solver.mjs';

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const out = outAt >= 0 ? args[outAt + 1] : null;
const ids = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
const byId = Object.fromEntries(loadRooms().map(({ room }) => [room.id, room]));
const res = {};
const show = (r) => (r.solvable ? `◇${r.reflects}` : r.reason.startsWith('state cap') ? 'capped' : 'exhausted');

for (const id of ids) {
  const room = byId[id];
  const row = {};
  for (const [name, budget] of [['atPar', room.par], ['underPar', room.par - 1]]) {
    if (budget < 0) continue;
    const t0 = process.hrtime.bigint();
    const r = solve(room, { mode: 'any', decisionHz: 5, maxReflects: budget });
    row[name] = { ms: Number(process.hrtime.bigint() - t0) / 1e6, explored: r.explored, result: show(r) };
  }
  res[id] = row;
  const f = (x) => (x ? `${(x.ms / 1000).toFixed(1)} s, ${x.explored} st, ${x.result}` : '—');
  console.log(`${id.padEnd(8)} at-par: ${f(row.atPar).padEnd(34)} under-par: ${f(row.underPar)}`);
}
if (out) writeFileSync(out, `${JSON.stringify(res, null, 1)}\n`);
