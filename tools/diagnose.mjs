#!/usr/bin/env node
// Runs the two solver diagnostics from `npm test` on every room, through the
// shared solve cache, and writes a resumable results file:
//   under-par  is there a clear with fewer reflects than par? (5 Hz, budget par−1)
//   comfort    is the room still solvable at 4 Hz and at 3 Hz within par?
// Rooms are never modified. Results accumulate in test/diagnostics.json, so a
// run cut short resumes where it stopped.
//
//   node tools/diagnose.mjs              all rooms
//   node tools/diagnose.mjs c2-01 c3-08  just these
//   node tools/diagnose.mjs --table      print the markdown table from the results file
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { loadRooms } from '../test/levels-node.mjs';
import { cachedSolve, SOLVER_VERSION } from '../test/solve-cache.mjs';

const OUT = new URL('../test/diagnostics.json', import.meta.url);
const args = process.argv.slice(2);
const ids = args.filter((a) => !a.startsWith('--'));
const roomHash = (r) => JSON.stringify({ t: r.tiles, s: r.spawn, x: r.exit, e: r.emitters, o: r.objects, p: r.par });

let results = {};
if (existsSync(OUT)) { try { results = JSON.parse(readFileSync(OUT, 'utf8')); } catch { results = {}; } }
const save = () => writeFileSync(OUT, `${JSON.stringify(results, null, 1)}\n`);

const verdict = (r) => (r.solvable ? `◇${r.reflects}` : r.reason.startsWith('state cap') ? 'capped' : 'exhausted');

if (!args.includes('--table')) {
  for (const { room } of loadRooms()) {
    if (ids.length && !ids.includes(room.id)) continue;
    const key = `${SOLVER_VERSION}:${roomHash(room)}`;
    if (results[room.id] && results[room.id].key === key) continue;
    const t0 = Date.now();
    const under = room.par === 0 ? null : cachedSolve(room, { mode: 'any', decisionHz: 5, maxReflects: room.par - 1 });
    const c4 = cachedSolve(room, { mode: 'any', decisionHz: 4, maxReflects: room.par });
    const c3 = cachedSolve(room, { mode: 'any', decisionHz: 3, maxReflects: room.par });
    results[room.id] = {
      key, par: room.par,
      underPar: under ? verdict(under) : 'n/a',
      comfort4: c4.solvable ? 'pass' : verdict(c4),
      comfort3: c3.solvable ? 'pass' : verdict(c3),
      ms: Date.now() - t0,
    };
    save();
    const r = results[room.id];
    console.log(`${room.id.padEnd(8)} par ${r.par}  under-par ${r.underPar.padEnd(9)}  4Hz ${r.comfort4.padEnd(9)}  3Hz ${r.comfort3.padEnd(9)}  ${(r.ms / 1000).toFixed(1)}s`);
  }
}

// markdown table
const rows = Object.entries(results).sort(([a], [b]) => a.localeCompare(b));
const lines = ['| Room | Par | Under-par search | Comfort 4 Hz | Comfort 3 Hz |', '|---|---|---|---|---|'];
for (const [id, r] of rows) lines.push(`| ${id} | ${r.par} | ${r.underPar} | ${r.comfort4} | ${r.comfort3} |`);
if (args.includes('--table')) console.log(lines.join('\n'));
