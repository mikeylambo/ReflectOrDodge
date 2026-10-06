// Fast layer only: contracts + rule tests (no solver, no browser). `npm run test:unit`
import { runUnit } from './unit.mjs';
import { runSpeedrunTests } from './speedrun.mjs';
import { runSteamTests } from './steam.mjs';
import { PROJECTILES } from '../src/projectiles/index.js';
import { OBJECTS } from '../src/objects/index.js';
import { validateProjectileType } from '../src/projectiles/_projectile.js';
import { validateObjectType } from '../src/objects/_object.js';

let fail = 0;
const rep = (ok, l, d = '') => { fail += ok ? 0 : 1; console.log(`${ok ? '✓' : '✗'} ${l}${d ? ` — ${d}` : ''}`); };
for (const m of Object.values(PROJECTILES)) { try { validateProjectileType(m); rep(true, `projectile ${m.type} contract`); } catch (e) { rep(false, e.message); } }
for (const m of Object.values(OBJECTS)) { try { validateObjectType(m); rep(true, `object ${m.kind} contract`); } catch (e) { rep(false, e.message); } }
for (const [ok, l, d] of runUnit()) rep(ok, l, d);
for (const [ok, l, d] of runSpeedrunTests()) rep(ok, l, d);
for (const [ok, l, d] of await runSteamTests()) rep(ok, l, d);
console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
