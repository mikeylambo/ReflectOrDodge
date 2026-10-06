// Content-addressed cache for solver results (pattern from Living Loop's
// test/solve-cache.mjs). A solve is a pure function of (room data, sim +
// solver code), so results are keyed by both hashes. Any change to the sim,
// projectiles, objects, tunables or solver changes SOLVER_VERSION and drops the
// whole cache; editing one room only re-solves that room. The file is
// committed so CI only pays for what changed. A stale entry can never match —
// worst case is a recompute, never a wrong pass.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { solve } from './solver.mjs';

const CACHE_FILE = new URL('./.solve-cache.json', import.meta.url);
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 16);
const ROOT = new URL('../', import.meta.url);

function solverVersion() {
  const files = ['config/tunables.js', 'test/solver.mjs'];
  for (const dir of ['src/sim/', 'src/projectiles/', 'src/objects/']) {
    for (const f of readdirSync(new URL(dir, ROOT)).sort()) if (f.endsWith('.js')) files.push(dir + f);
  }
  return sha(files.map((f) => `${f}\n${readFileSync(new URL(f, ROOT), 'utf8')}`).join('\n'));
}

// only the fields that can change a solve (not name, solution, par, mirrorOf)
const roomHash = (r) => sha(JSON.stringify({ t: r.tiles, s: r.spawn, x: r.exit, e: r.emitters, o: r.objects }));

export const SOLVER_VERSION = solverVersion();
let cache = { version: SOLVER_VERSION, entries: {} };
if (existsSync(CACHE_FILE)) {
  try {
    const c = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    if (c.version === SOLVER_VERSION) cache = c;
  } catch { /* corrupt → start fresh */ }
}
let hits = 0, misses = 0, dirty = false;

// Returns a compact result (no input log) — the log is only needed by tools/solve.mjs.
export function cachedSolve(room, opts) {
  const k = `${roomHash(room)}:${opts.mode}:${opts.decisionHz}:${opts.maxReflects}${opts.stateCap ? `:${opts.stateCap}` : ''}`;
  if (cache.entries[k]) { hits++; return cache.entries[k]; }
  misses++;
  const r = solve(room, opts);
  const out = r.solvable
    ? { solvable: true, reflects: r.reflects, seconds: r.seconds, explored: r.explored }
    : { solvable: false, reason: r.reason, explored: r.explored };
  cache.entries[k] = out;
  dirty = true;
  saveSolveCache(); // after every solve: a long run that is cut short keeps its progress
  return out;
}

export function saveSolveCache() {
  if (!dirty) return;
  writeFileSync(CACHE_FILE, `${JSON.stringify(cache, null, 1)}\n`);
}
export const cacheStats = () => ({ hits, misses });
