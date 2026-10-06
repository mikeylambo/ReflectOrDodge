#!/usr/bin/env node
// Headless performance benchmark (GDD M3: performance pass at worst-case rooms).
//
// 1. Sim, in Node: replays every room's recorded solution REPS times and
//    reports per-step cost (mean, p99, worst) and the most projectiles alive.
//    The 120 Hz budget is 8.33 ms per step; a frame at 60 fps runs ~2 steps.
// 2. Browser (--browser): the worst rooms by projectile count, played back in
//    headless Chromium through the real game loop and renderer; reports frame
//    times from requestAnimationFrame. Headless software rendering is slower
//    than a GPU, so treat these as an upper bound, not a device measurement.
//
//   node tools/bench.mjs [--browser] [--reps N] [--top N]
import { performance } from 'node:perf_hooks';
import { loadRooms } from '../test/levels-node.mjs';
import { compileRoom } from '../src/sim/room.js';
import { createState, step } from '../src/sim/world.js';
import { decodeLog } from '../src/sim/input.js';
import { readdirSync, readFileSync } from 'node:fs';
import { emptyTiles } from '../src/sim/room.js';

const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : d; };
const REPS = opt('--reps', 20), TOP = opt('--top', 5);
const pct = (xs, p) => xs[Math.min(xs.length - 1, Math.floor((xs.length * p) / 100))];

// content rooms, the projectile fixtures, and a synthetic worst case: eight
// fast emitters of every type for 10 s with the player invincible (so the
// room never ends early) — far denser than any designed room.
const FX = new URL('../test/fixtures/', import.meta.url);
const fixtures = readdirSync(FX).filter((f) => f.startsWith('fx-') && f.endsWith('.json')).map((f) => JSON.parse(readFileSync(new URL(f, FX), 'utf8')));
const types = ['orb', 'splitter', 'charge', 'twin', 'seed', 'anchor', 'splitter', 'charge'];
const stress = {
  id: 'stress-8', tiles: emptyTiles(), spawn: [14, 15], exit: [28, 1], par: 0, mirrorOf: null,
  emitters: types.map((type, i) => ({ type, at: [i % 2 ? 28 : 1, 2 + i], dir: i % 2 ? 'left' : 'right', period: 0.6, phase: 0 })),
  objects: [], solution: `1:0*${(1200).toString(36)}`, opts: { invincible: true },
};
const rows = [];
for (const data of [...loadRooms().map((r) => r.room), ...fixtures, stress]) {
  if (!data.solution) continue;
  const room = compileRoom(data);
  const masks = decodeLog(data.solution);
  const times = [];
  let maxProj = 0;
  for (let r = 0; r < REPS; r++) {
    const s = createState(room, data.opts);
    for (let i = 0; i < masks.length && s.status === 'play'; i++) {
      const t0 = performance.now();
      step(s, room, masks[i]);
      const dt = performance.now() - t0;
      if (r > 1) times.push(dt); // first passes warm the JIT
      if (s.projectiles.length > maxProj) maxProj = s.projectiles.length;
    }
  }
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  rows.push({ id: data.id, steps: masks.length, maxProj, meanUs: mean * 1000, p99Us: pct(times, 99) * 1000, maxUs: times[times.length - 1] * 1000 });
}

rows.sort((a, b) => b.maxProj - a.maxProj || b.p99Us - a.p99Us);
console.log('## Sim (Node, per 1/120 s step)\n');
console.log('| Room | Steps | Max projectiles | Mean µs | p99 µs | Worst µs |');
console.log('|---|---|---|---|---|---|');
for (const r of rows.slice(0, Math.max(TOP * 2, 10))) console.log(`| ${r.id} | ${r.steps} | ${r.maxProj} | ${r.meanUs.toFixed(1)} | ${r.p99Us.toFixed(1)} | ${r.maxUs.toFixed(1)} |`);
const worst = rows.reduce((m, r) => Math.max(m, r.p99Us), 0);
console.log(`\nAll ${rows.length} rooms: worst p99 step ${worst.toFixed(1)} µs (budget 8333 µs per step).`);

if (args.includes('--browser')) {
  const { build, preview } = await import('vite');
  const { chromium } = await import('playwright');
  await build({ logLevel: 'error' });
  const server = await preview({ preview: { port: 4318, strictPort: false }, logLevel: 'error' });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(server.resolvedUrls.local[0]);
    await page.waitForFunction(() => window.__RD && window.__RD.state === 'title');
    console.log('\n## Browser (headless Chromium, real loop + renderer, solution replay)\n');
    console.log('| Room | Frames | Mean ms | p95 ms | p99 ms | Worst ms |');
    console.log('|---|---|---|---|---|---|');
    const inGame = await page.evaluate(() => window.__RD.rooms);
    for (const r of rows.filter((x) => inGame.includes(x.id)).slice(0, TOP)) {
      const f = await page.evaluate(async (id) => {
        window.__RD.enterRoom(id, { replay: true });
        const ts = [];
        await new Promise((done) => {
          let last = performance.now();
          const tick = (t) => {
            ts.push(t - last); last = t;
            if (ts.length < 600 && window.__RD.state === 'replay') requestAnimationFrame(tick); else done();
          };
          requestAnimationFrame(tick);
        });
        return ts.slice(5).sort((a, b) => a - b);
      }, r.id);
      const mean = f.reduce((a, b) => a + b, 0) / f.length;
      console.log(`| ${r.id} | ${f.length} | ${mean.toFixed(2)} | ${pct(f, 95).toFixed(2)} | ${pct(f, 99).toFixed(2)} | ${f[f.length - 1].toFixed(2)} |`);
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.httpServer.close(r));
  }
}
