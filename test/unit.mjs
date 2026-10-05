// Rule-level checks against the GDD, run headless on tiny synthetic rooms.
import { compileRoom, emptyTiles } from '../src/sim/room.js';
import { createState, step } from '../src/sim/world.js';
import { BTN, encodeLog, decodeLog, heldDir } from '../src/sim/input.js';
import { PROJECTILES } from '../src/projectiles/index.js';
import { PLAYER, REFLECT, frames } from '../config/tunables.js';

const { L, R, U, D, JUMP, REFLECT: RF } = BTN;

function room(extra = {}) {
  return compileRoom({ id: 'unit', tiles: emptyTiles(), spawn: [10, 15], exit: [28, 1], emitters: [], objects: [], par: 0, solution: null, mirrorOf: null, ...extra });
}
const settle = (s, r, n = 10) => { for (let i = 0; i < n; i++) step(s, r, 0); };
// put an orb at an offset from the player centre, moving toward it
function orbAt(s, dx, dy, vx, vy) {
  const p = s.player;
  const o = PROJECTILES.orb.spawn({ x: p.x + PLAYER.W / 2 + dx, y: p.y + PLAYER.H / 2 + dy, dir: 'left' });
  o.vx = vx; o.vy = vy; o.id = s.nextId++;
  s.projectiles.push(o);
  return o.id;
}
const near = (a, b, eps) => Math.abs(a - b) <= eps;

export function runUnit() {
  const out = [];
  const check = (label, fn) => {
    try { const r = fn(); out.push([r === true || (r && r.ok), label, r && r.detail ? r.detail : '']); } catch (e) { out.push([false, label, e.message]); }
  };

  check('input log encode/decode round-trips', () => {
    const m = [0, 0, 0, 3, 3, 63, 0, 1];
    return encodeLog(m) === '1:0*3,3*2,1r,0,1' && JSON.stringify(decodeLog(encodeLog(m))) === JSON.stringify(m);
  });

  check('reflect direction: vertical beats horizontal, opposing horizontals → neutral', () =>
    heldDir(U | R) === 'up' && heldDir(D | L) === 'down' && heldDir(L | R) === 'neutral' && heldDir(0) === 'neutral' && heldDir(L) === 'left');

  check(`run speed ≈ ${PLAYER.RUN} px/s`, () => {
    const r = room(); const s = createState(r); settle(s, r);
    const x0 = s.player.x; for (let i = 0; i < 120; i++) step(s, r, R);
    const v = s.player.x - x0;
    return { ok: near(v, PLAYER.RUN, 0.5), detail: `${v.toFixed(2)} px in 1 s` };
  });

  check(`jump apex ≈ ${PLAYER.JUMP_APEX} px (full hold)`, () => {
    const r = room(); const s = createState(r); settle(s, r);
    const y0 = s.player.y; let minY = y0;
    for (let i = 0; i < 120; i++) { step(s, r, JUMP); minY = Math.min(minY, s.player.y); }
    const h = y0 - minY;
    return { ok: near(h, PLAYER.JUMP_APEX, 1.5), detail: `${h.toFixed(2)} px` };
  });

  check('variable jump: releasing early cuts the jump', () => {
    const r = room(); const s = createState(r); settle(s, r);
    const y0 = s.player.y; let minY = y0;
    for (let i = 0; i < 120; i++) { step(s, r, i < 6 ? JUMP : 0); minY = Math.min(minY, s.player.y); }
    const h = y0 - minY;
    return { ok: h < PLAYER.JUMP_APEX * 0.6, detail: `${h.toFixed(2)} px` };
  });

  check('jump buffer: a press shortly before landing still jumps', () => {
    const r = room(); const s = createState(r); settle(s, r);
    for (let i = 0; i < 6; i++) step(s, r, JUMP); // small hop
    while (s.player.vy <= 0) step(s, r, 0); // until falling
    let jumped = false;
    // wait until ~buffer/2 before landing, press, then idle
    while (!s.player.grounded) {
      const t = s.player.y;
      const ground = 15 * 32 + 32 - PLAYER.H;
      const framesLeft = (ground - t) / (s.player.vy / 120);
      if (framesLeft < frames(PLAYER.JUMP_BUFFER) / 2 && !jumped) { step(s, r, JUMP); jumped = true; } else step(s, r, jumped ? JUMP : 0);
    }
    for (let i = 0; i < 3; i++) step(s, r, JUMP);
    return { ok: s.player.vy < 0, detail: `vy ${s.player.vy.toFixed(1)}` };
  });

  check('coyote time: a jump just after walking off a ledge still works', () => {
    const tiles = emptyTiles();
    tiles[12] = `#${'#'.repeat(10)}${'.'.repeat(18)}#`; // ledge cols 1..10 at row 12
    const r = room({ tiles, spawn: [9, 11] }); const s = createState(r); settle(s, r);
    while (s.player.grounded) step(s, r, R);
    for (let i = 0; i < frames(PLAYER.COYOTE) - 2; i++) step(s, r, R);
    step(s, r, R | JUMP);
    return { ok: s.player.vy < 0, detail: `vy ${s.player.vy.toFixed(1)}` };
  });

  check('unreflected orb kills on contact', () => {
    const r = room(); const s = createState(r); settle(s, r);
    orbAt(s, 40, 0, -140, 0);
    for (let i = 0; i < 60 && s.status === 'play'; i++) step(s, r, 0);
    return s.status === 'dead';
  });

  // [held, dir, orb offset+velocity in, expected velocity out]. Horizontal aims use a falling orb.
  // Orbs start just inside the zone so the reflect resolves on the press frame
  // (holding a direction also runs, which would otherwise move the player away).
  for (const [mask, dir, inc, vx, vy] of [
    [0, 'neutral', [27, 0, -140, 0], 140, 0], [U, 'up', [27, 0, -140, 0], 0, -140], [D, 'down', [27, 0, -140, 0], 0, 140],
    [L, 'left', [0, -27, 0, 140], -140, 0], [R, 'right', [0, -27, 0, 140], 140, 0],
  ]) {
    check(`reflect ${dir}: redirects at current speed, no death`, () => {
      const r = room(); const s = createState(r); settle(s, r);
      const id = orbAt(s, ...inc);
      step(s, r, mask | RF);
      const o = s.projectiles.find((p) => p.id === id);
      for (let i = 0; i < 60; i++) step(s, r, mask); // (a down-reflected Orb dies in the floor)
      return { ok: s.status === 'play' && o && o.reflected && near(o.vx, vx, 1e-9) && near(o.vy, vy, 1e-9), detail: o ? `v=(${o.vx},${o.vy})` : `not reflected, status ${s.status}` };
    });
  }

  check('reflect in midair does not alter momentum', () => {
    const r = room(); const s = createState(r); settle(s, r);
    for (let i = 0; i < 10; i++) step(s, r, JUMP | R);
    const a = createState(r); Object.assign(a, JSON.parse(JSON.stringify(s)));
    step(s, r, JUMP | R | RF); step(a, r, JUMP | R);
    return s.player.vx === a.player.vx && s.player.vy === a.player.vy && s.player.y === a.player.y;
  });

  check('one press reflects several projectiles, counts as one reflect', () => {
    const r = room(); const s = createState(r); settle(s, r);
    orbAt(s, 30, 0, -140, 0); orbAt(s, -30, 0, 140, 0);
    step(s, r, U | RF);
    for (let i = 0; i < 30; i++) step(s, r, U);
    return { ok: s.status === 'play' && s.projectiles.every((p) => p.reflected && p.vy < 0) && s.stats.reflects === 1, detail: `reflects ${s.stats.reflects}` };
  });

  check('cooldown: pressing again right after the window does not reopen it', () => {
    const r = room(); const s = createState(r); settle(s, r);
    step(s, r, RF);
    for (let i = 0; i < frames(REFLECT.WINDOW) + 2; i++) step(s, r, 0);
    step(s, r, RF);
    const blocked = s.reflect.window === 0;
    for (let i = 0; i < frames(REFLECT.COOLDOWN) + 2; i++) step(s, r, 0);
    step(s, r, RF);
    return blocked && s.reflect.window > 0;
  });

  check(`hitstop freezes the world clock for ${REFLECT.HITSTOP}s`, () => {
    const r = room(); const s = createState(r); settle(s, r);
    orbAt(s, 27, 0, -140, 0);
    step(s, r, RF);
    const f0 = s.frame;
    for (let i = 0; i < frames(REFLECT.HITSTOP); i++) step(s, r, 0);
    const frozen = s.frame === f0;
    step(s, r, 0);
    return frozen && s.frame === f0 + 1;
  });

  check('a reflected orb that comes back can still kill', () => {
    const r = room(); const s2 = createState(r); settle(s2, r);
    const id = orbAt(s2, 27, 0, -140, 0);
    step(s2, r, RF);
    for (let i = 0; i < 60; i++) step(s2, r, 0);
    const o = s2.projectiles.find((p) => p.id === id);
    o.vx = -o.vx; // simulate it returning (Orbs don't bounce; Charge will)
    for (let i = 0; i < 120 && s2.status === 'play'; i++) step(s2, r, 0);
    return s2.status === 'dead';
  });

  check('law 1: walking into a switch does nothing and passes through', () => {
    const r = room({ objects: [{ kind: 'switch', at: [12, 15], links: ['d1'] }, { kind: 'door', id: 'd1', at: [20, 13], h: 3 }] });
    const s = createState(r); settle(s, r);
    for (let i = 0; i < 60; i++) step(s, r, R);
    const door = s.objects.find((o) => o.kind === 'door');
    return s.player.x > 12 * 32 + 32 && !door.open;
  });

  check('switch hit opens linked door; closed door blocks the player', () => {
    const r = room({ objects: [{ kind: 'switch', at: [10, 5], links: ['d1'] }, { kind: 'door', id: 'd1', at: [14, 13], h: 3 }] });
    const s = createState(r); settle(s, r);
    for (let i = 0; i < 120; i++) step(s, r, R);
    const blocked = s.player.x + PLAYER.W <= 14 * 32;
    const id = s.nextId++;
    s.projectiles.push({ ...PROJECTILES.orb.spawn({ x: 10.5 * 32, y: 8 * 32, dir: 'up' }), id });
    for (let i = 0; i < 120; i++) step(s, r, 0);
    const door = s.objects.find((o) => o.kind === 'door');
    for (let i = 0; i < 60; i++) step(s, r, R);
    return { ok: blocked && door.open && s.player.x > 15 * 32, detail: `blocked ${blocked}, open ${door.open}` };
  });

  check('emitter: shut off by a reflected hit, not by a plain one', () => {
    const r = room({ emitters: [{ type: 'orb', at: [20, 10], dir: 'left', period: 1, phase: 0 }] });
    const s = createState(r); settle(s, r);
    const e = () => s.objects.find((o) => o.kind === 'emitter');
    const plain = { ...PROJECTILES.orb.spawn({ x: 18 * 32, y: 10.5 * 32, dir: 'right' }), id: s.nextId++ };
    s.projectiles.push(plain);
    for (let i = 0; i < 60; i++) step(s, r, 0);
    const stillOn = e().on;
    const back = { ...PROJECTILES.orb.spawn({ x: 18 * 32, y: 10.5 * 32, dir: 'right' }), reflected: true, id: s.nextId++ };
    s.projectiles.push(back);
    for (let i = 0; i < 60; i++) step(s, r, 0);
    return stillOn && !e().on;
  });

  check('emitter: telegraph precedes every shot, first shot at phase + period', () => {
    const r = room({ emitters: [{ type: 'orb', at: [20, 10], dir: 'left', period: 1.5, phase: 0.25 }] });
    const s = createState(r);
    const ev = [];
    for (let i = 0; i < 600; i++) for (const e of step(s, r, 0)) if (e.type.startsWith('emitter.')) ev.push([s.frame - 1, e.type]);
    const fires = ev.filter((e) => e[1] === 'emitter.fire').map((e) => e[0]);
    const teles = ev.filter((e) => e[1] === 'emitter.telegraph').map((e) => e[0]);
    const ok = fires[0] === 210 && fires[1] === 390 && teles.every((t, i) => fires[i] - t === 60);
    return { ok, detail: `fires ${fires.slice(0, 3)} teles ${teles.slice(0, 3)}` };
  });

  check('spikes kill on contact; projectiles pass over them', () => {
    const tiles = emptyTiles();
    tiles[15] = `#${'.'.repeat(14)}^${'.'.repeat(13)}#`;
    const r = room({ tiles }); const s = createState(r); settle(s, r);
    const o = { ...PROJECTILES.orb.spawn({ x: 18 * 32, y: 15.5 * 32, dir: 'left' }), id: s.nextId++ };
    s.projectiles.push(o);
    for (let i = 0; i < 100; i++) step(s, r, 0); // orb crosses the spike tile
    const orbAlive = s.projectiles.some((p) => p.id === o.id && p.x < 15 * 32);
    s.projectiles = []; // only the spikes may kill from here
    for (let i = 0; i < 120 && s.status === 'play'; i++) step(s, r, R);
    return { ok: orbAlive && s.status === 'dead', detail: `orb passed ${orbAlive}, status ${s.status}` };
  });

  check('jumping over a spike tile is safe', () => {
    const tiles = emptyTiles();
    tiles[15] = `#${'.'.repeat(11)}^${'.'.repeat(16)}#`;
    const r = room({ tiles }); const s = createState(r); settle(s, r);
    for (let i = 0; i < 120 && s.status === 'play'; i++) step(s, r, R | (i < 40 ? JUMP : 0));
    return { ok: s.status === 'play' && s.player.x > 13 * 32, detail: `x ${s.player.x.toFixed(0)}, status ${s.status}` };
  });

  check('light wall: blocks the player, breaks to an Orb; heavy wall shrugs Orbs off', () => {
    const r = room({ objects: [{ kind: 'wall', at: [13, 13], h: 3 }, { kind: 'wall', at: [20, 13], h: 3, heavy: true }] });
    const s = createState(r); settle(s, r);
    for (let i = 0; i < 90; i++) step(s, r, R);
    const blocked = s.player.x + PLAYER.W <= 13 * 32;
    s.projectiles.push({ ...PROJECTILES.orb.spawn({ x: 12 * 32, y: 14.5 * 32, dir: 'right' }), id: s.nextId++ });
    s.projectiles.push({ ...PROJECTILES.orb.spawn({ x: 19 * 32, y: 14.5 * 32, dir: 'right' }), id: s.nextId++ });
    for (let i = 0; i < 60; i++) step(s, r, 0);
    const [light, heavy] = s.objects.filter((o) => o.kind === 'wall');
    return { ok: blocked && light.broken && !heavy.broken && s.projectiles.length === 0, detail: `blocked ${blocked} light ${light.broken} heavy ${heavy.broken}` };
  });

  // ── Anchor ──
  const shot = (s, type, x, y, dir) => { const o = { ...PROJECTILES[type].spawn({ x, y, dir }), id: s.nextId++ }; s.projectiles.push(o); return o.id; };

  check('anchor: cannot be reflected — the window opens and it still kills', () => {
    const r = room(); const s = createState(r); settle(s, r);
    shot(s, 'anchor', s.player.x + PLAYER.W / 2 + 27, s.player.y + PLAYER.H / 2, 'left');
    step(s, r, U | RF);
    for (let i = 0; i < 60 && s.status === 'play'; i++) step(s, r, U);
    return { ok: s.status === 'dead' && s.stats.reflects === 0, detail: `status ${s.status}, reflects ${s.stats.reflects}` };
  });

  check('anchor: smashes a heavy wall and a switch without stopping; a closed door ends it', () => {
    const r = room({ spawn: [3, 15], objects: [{ kind: 'wall', at: [14, 13], h: 3, heavy: true }, { kind: 'switch', at: [18, 15], links: ['d1'] }, { kind: 'door', id: 'd1', at: [25, 13], h: 3 }, { kind: 'door', id: 'd2', at: [22, 13], h: 3 }] });
    const s = createState(r); settle(s, r);
    const id = shot(s, 'anchor', 11 * 32, 15.5 * 32, 'right');
    let alivePastSwitch = false;
    for (let i = 0; i < 1000; i++) { step(s, r, 0); const a = s.projectiles.find((p) => p.id === id); if (a && a.x > 19 * 32) alivePastSwitch = true; }
    const wall = s.objects.find((o) => o.kind === 'wall'), d1 = s.objects.find((o) => o.id === 'd1');
    return { ok: wall.broken && d1.open && alivePastSwitch && !s.projectiles.some((p) => p.id === id), detail: `wall ${wall.broken} door ${d1.open} past ${alivePastSwitch}` };
  });

  check(`anchor: travels at ${PROJECTILES.anchor.tunables.SPEED} px/s`, () => {
    const r = room(); const s = createState(r);
    const id = shot(s, 'anchor', 400, 200, 'right');
    for (let i = 0; i < 120; i++) step(s, r, 0);
    const a = s.projectiles.find((p) => p.id === id);
    return { ok: a && near(a.x - 400, PROJECTILES.anchor.tunables.SPEED, 0.01), detail: a ? `${(a.x - 400).toFixed(2)} px` : 'gone' };
  });

  // ── Seed ──
  check('seed: sticks to a wall as a ledge the player can stand on, then expires', () => {
    const r = room(); const s = createState(r); settle(s, r);
    const id = shot(s, 'seed', 20 * 32, 13 * 32 + 16, 'right');
    for (let i = 0; i < 500; i++) step(s, r, 0);
    const sd = s.projectiles.find((p) => p.id === id);
    if (!sd || !sd.stuck) return { ok: false, detail: 'did not stick' };
    const geom = sd.plat.x + sd.plat.w === 29 * 32;
    s.player.x = sd.plat.x + 8; s.player.y = sd.plat.y - PLAYER.H - 20; s.player.vy = 0; s.player.grounded = false;
    for (let i = 0; i < 30; i++) step(s, r, 0);
    const standing = s.player.grounded && Math.abs(s.player.y + PLAYER.H - sd.plat.y) < 0.01;
    for (let i = 0; i < 600; i++) step(s, r, 0);
    const expired = !s.projectiles.some((p) => p.id === id);
    return { ok: geom && standing && expired, detail: `geom ${geom} standing ${standing} expired ${expired}` };
  });

  check('seed: the platform is one-way — you jump up through it', () => {
    const r = room(); const s = createState(r); settle(s, r);
    const id = shot(s, 'seed', 3 * 32, 14 * 32 + 4, 'left');
    for (let i = 0; i < 200; i++) step(s, r, 0);
    const sd = s.projectiles.find((p) => p.id === id);
    s.player.x = 1 * 32 + 6; s.player.y = 16 * 32 - PLAYER.H; s.player.vy = 0;
    settle(s, r, 2);
    let minFeet = s.player.y + PLAYER.H;
    for (let i = 0; i < 60; i++) { step(s, r, JUMP); minFeet = Math.min(minFeet, s.player.y + PLAYER.H); }
    return { ok: !!sd && sd.stuck && minFeet < sd.plat.y, detail: sd ? `feet reached ${minFeet.toFixed(0)}, plat ${sd.plat.y.toFixed(0)}` : 'no seed' };
  });

  check('seed: reflectable in flight; once stuck it is harmless and can\'t be reflected', () => {
    const r = room(); const s = createState(r); settle(s, r);
    const id = shot(s, 'seed', s.player.x + PLAYER.W / 2 + 27, s.player.y + PLAYER.H / 2, 'left');
    step(s, r, U | RF);
    const reflected = !!s.projectiles.find((p) => p.id === id)?.reflected;
    const s2 = createState(r); settle(s2, r);
    const id2 = shot(s2, 'seed', 13 * 32, 15 * 32 + 26, 'down'); // sticks on the floor ahead
    for (let i = 0; i < 10; i++) step(s2, r, 0);
    const st = s2.projectiles.find((p) => p.id === id2);
    for (let i = 0; i < 90; i++) step(s2, r, R | (i === 20 ? RF : 0)); // walk over it, press reflect on it
    return { ok: reflected && !!st && st.stuck && s2.status === 'play' && s2.stats.reflects === 0, detail: `reflected ${reflected} stuck ${st && st.stuck} status ${s2.status} reflects ${s2.stats.reflects}` };
  });

  return out;
}
