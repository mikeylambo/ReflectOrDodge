// The simulation. One call to step() = one fixed 1/120 s tick.
//
// State is plain JSON data (no classes, no closures) so a room can be stepped
// headless, snapshotted, and compared bit-for-bit across replays. No
// Math.random, no wall clock, no variable dt — ever (GDD: Determinism).
//
// Tick order:
//   hitstop → player move/jump → reflect window → objects (emitters fire)
//   → projectiles move + collide → reflect → grace → player contact → exit
import { PLAYER, REFLECT, ROOM, SPIKES, TIMESTEP, frames } from '../../config/tunables.js';
import { BTN, heldDir } from './input.js';
import { PROJECTILES } from '../projectiles/index.js';
import { OBJECTS } from '../objects/index.js';
import { isSolid, isSpike } from './room.js';
import { circleRect, rectsOverlap } from './geom.js';

const T = ROOM.TILE;
const DT = TIMESTEP.STEP;
// Launch speed for the apex in tunables. The + g·dt/2 term cancels the height
// semi-implicit Euler loses at 120 Hz, so the tuned number is the real apex.
const JUMP_V = Math.sqrt(2 * PLAYER.GRAVITY * PLAYER.JUMP_APEX) + (PLAYER.GRAVITY * DT) / 2;

export function createState(room, opts = {}) {
  const [sx, sy] = room.spawn;
  const x = sx * T + T / 2 - PLAYER.W / 2;
  const y = (sy + 1) * T - PLAYER.H;
  const objects = [
    ...room.emitters.map((d) => OBJECTS.emitter.create(d)),
    ...room.objects.map((d) => OBJECTS[d.kind].create(d)),
  ];
  return {
    roomId: room.id,
    opts: { invincible: !!opts.invincible, windowMult: opts.windowMult || 1 },
    frame: 0, // world clock: emitters read this; frozen during hitstop
    tick: 0, // every sim step, hitstop included
    status: 'play', // 'play' | 'dead' | 'clear'
    prevInput: 0,
    latch: 0, // presses that landed during hitstop, delivered after it
    hitstop: 0,
    player: {
      x, y, px: x, py: y, vx: 0, vy: 0,
      grounded: false, coyote: 0, jumpBuf: 0, rising: false, facing: 1,
    },
    reflect: { window: 0, cooldown: 0, connected: false, hitIds: [] },
    projectiles: [],
    nextId: 1,
    objects,
    stats: { reflects: 0 },
  };
}

// ── collision helpers ──────────────────────────────────────────────

function solidRectsNear(state, room, box) {
  const out = [];
  const x0 = Math.floor(box.x / T), x1 = Math.floor((box.x + box.w) / T);
  const y0 = Math.floor(box.y / T), y1 = Math.floor((box.y + box.h) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (isSolid(room, tx, ty)) out.push({ x: tx * T, y: ty * T, w: T, h: T });
  }
  for (const o of state.objects) for (const r of OBJECTS[o.kind].solids(o)) if (rectsOverlap(r, box)) out.push(r);
  return out;
}

function movePlayer(state, room) {
  const p = state.player;
  // horizontal
  if (p.vx !== 0) {
    let nx = p.x + p.vx * DT;
    const box = { x: nx, y: p.y, w: PLAYER.W, h: PLAYER.H };
    for (const r of solidRectsNear(state, room, box)) {
      if (!rectsOverlap(r, { x: nx, y: p.y, w: PLAYER.W, h: PLAYER.H })) continue;
      nx = p.vx > 0 ? Math.min(nx, r.x - PLAYER.W) : Math.max(nx, r.x + r.w);
    }
    p.x = nx;
  }
  // vertical
  let ny = p.y + p.vy * DT;
  let landed = false;
  const box = { x: p.x, y: ny, w: PLAYER.W, h: PLAYER.H };
  for (const r of solidRectsNear(state, room, box)) {
    if (!rectsOverlap(r, { x: p.x, y: ny, w: PLAYER.W, h: PLAYER.H })) continue;
    if (p.vy > 0) { ny = Math.min(ny, r.y - PLAYER.H); landed = true; } else if (p.vy < 0) { ny = Math.max(ny, r.y + r.h); }
  }
  if (p.vy > 0) {
    const top = landOnPlatforms(state, p, ny);
    if (top !== null && top - PLAYER.H <= ny) { ny = top - PLAYER.H; landed = true; }
  }
  if (ny !== p.y + p.vy * DT) { p.vy = 0; p.rising = false; }
  p.y = ny;
  return landed;
}

const playerBox = (p) => ({ x: p.x, y: p.y, w: PLAYER.W, h: PLAYER.H });
const playerCenter = (p) => [p.x + PLAYER.W / 2, p.y + PLAYER.H / 2];

// First solid tile the projectile overlaps (its rect), or null.
function projectileHitsWall(room, s) {
  const x0 = Math.floor((s.x - s.r) / T), x1 = Math.floor((s.x + s.r) / T);
  const y0 = Math.floor((s.y - s.r) / T), y1 = Math.floor((s.y + s.r) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const rect = { x: tx * T, y: ty * T, w: T, h: T };
    if (isSolid(room, tx, ty) && circleRect(s.x, s.y, s.r, rect)) return rect;
  }
  return null;
}

// One-way platforms some projectiles leave behind (a stuck Seed): the player
// lands on them from above and passes through from below or the side.
function landOnPlatforms(state, p, ny) {
  let best = null;
  const bottom0 = p.y + PLAYER.H, bottom1 = ny + PLAYER.H;
  for (const pr of state.projectiles) {
    const mod = PROJECTILES[pr.type];
    if (!mod.platforms) continue;
    for (const r of mod.platforms(pr)) {
      if (p.x + PLAYER.W <= r.x || p.x >= r.x + r.w) continue;
      if (bottom0 <= r.y + 0.001 && bottom1 >= r.y && (best === null || r.y < best)) best = r.y;
    }
  }
  return best;
}

// ── the tick ───────────────────────────────────────────────────────

export function step(state, room, input) {
  const events = [];
  if (state.status !== 'play') return events;
  state.tick++;

  let pressed = (input & ~state.prevInput) | state.latch;
  state.prevInput = input;

  if (state.hitstop > 0) {
    state.hitstop--;
    state.latch = pressed;
    state.player.px = state.player.x; state.player.py = state.player.y;
    for (const pr of state.projectiles) { pr.px = pr.x; pr.py = pr.y; }
    return events;
  }
  state.latch = 0;

  // ── player ──
  const p = state.player;
  p.px = p.x; p.py = p.y;
  const dirX = (input & BTN.R ? 1 : 0) - (input & BTN.L ? 1 : 0);
  p.vx = dirX * PLAYER.RUN;
  if (dirX) p.facing = dirX;

  if (pressed & BTN.JUMP) p.jumpBuf = frames(PLAYER.JUMP_BUFFER);
  else if (p.jumpBuf > 0) p.jumpBuf--;
  if (p.grounded) p.coyote = frames(PLAYER.COYOTE);
  else if (p.coyote > 0) p.coyote--;

  if (p.jumpBuf > 0 && p.coyote > 0) {
    p.vy = -JUMP_V;
    p.jumpBuf = 0;
    p.coyote = 0;
    p.grounded = false;
    p.rising = true;
    events.push({ type: 'player.jump', x: p.x + PLAYER.W / 2, y: p.y + PLAYER.H });
  }
  if (p.rising && !(input & BTN.JUMP) && p.vy < 0) { p.vy *= PLAYER.JUMP_CUT; p.rising = false; }
  if (p.vy >= 0) p.rising = false;
  p.vy = Math.min(p.vy + PLAYER.GRAVITY * DT, PLAYER.MAX_FALL);

  const wasGrounded = p.grounded;
  p.grounded = movePlayer(state, room);
  if (p.grounded && !wasGrounded) events.push({ type: 'player.land', x: p.x + PLAYER.W / 2, y: p.y + PLAYER.H });

  // ── reflect window ──
  const rf = state.reflect;
  if (rf.window > 0) {
    rf.window--;
    if (rf.window === 0) rf.cooldown = frames(REFLECT.COOLDOWN);
  } else if (rf.cooldown > 0) rf.cooldown--;
  if ((pressed & BTN.REFLECT) && rf.window === 0 && rf.cooldown === 0) {
    rf.window = Math.round(frames(REFLECT.WINDOW) * state.opts.windowMult);
    rf.connected = false;
    rf.hitIds = [];
    events.push({ type: 'reflect.open', dir: heldDir(input) });
  }

  // ── room objects (emitters fire) ──
  const world = { frame: state.frame, dt: DT };
  for (let i = 0; i < state.objects.length; i++) {
    const o = state.objects[i];
    const r = OBJECTS[o.kind].step(o, world);
    state.objects[i] = r.state;
    events.push(...r.events);
    for (const sp of r.spawns) {
      const s = PROJECTILES[sp.type].spawn(sp);
      s.id = state.nextId++;
      state.projectiles.push(s);
    }
  }

  // ── projectiles move + collide ──
  // A projectile that survives a hit (an Anchor through a wall, or a switch)
  // remembers the object in `passed` so it never re-triggers it. A stuck one
  // (a Seed platform) no longer collides at all. step() may return null to
  // remove the projectile (a platform expiring).
  const survivors = [];
  for (const pr of state.projectiles) {
    const mod = PROJECTILES[pr.type];
    const st = mod.step(pr, DT, world);
    events.push(...st.events);
    if (!st.state) continue;
    let s = st.state;
    s.id = pr.id;
    if (pr.grace) s.grace = true;
    if (pr.passed) s.passed = pr.passed;
    if (s.stuck) { survivors.push(s); continue; }

    let hit = null, hitIndex = -1;
    const tile = projectileHitsWall(room, s);
    if (tile) hit = { kind: 'tile', rect: tile };
    else {
      for (let i = 0; i < state.objects.length; i++) {
        if (s.passed && s.passed.includes(i)) continue;
        const o = state.objects[i];
        const om = OBJECTS[o.kind];
        const rect = om.hitRect(o);
        if (!rect || !circleRect(s.x, s.y, s.r, rect)) continue;
        const res = om.onProjectileHit(o, s);
        state.objects[i] = res.state;
        events.push(...res.events);
        for (const ev of res.events) if (ev.type === 'switch.hit') triggerLinks(state, ev.links, events);
        hit = { ...o, rect };
        hitIndex = i;
        break;
      }
    }
    if (hit) {
      const h = mod.onHit(s, hit);
      events.push(...h.events);
      if (!h.state) continue;
      s = { ...h.state, id: pr.id };
      if (pr.grace) s.grace = true;
      if (hitIndex >= 0 && !s.stuck) s.passed = [...(s.passed || []), hitIndex];
    }
    survivors.push(s);
  }
  state.projectiles = survivors;

  // ── reflect ──
  const [pcx, pcy] = playerCenter(p);
  if (rf.window > 0) {
    const dir = heldDir(input);
    const next = [];
    let any = false;
    for (const pr of state.projectiles) {
      const mod = PROJECTILES[pr.type];
      const dx = pr.x - pcx, dy = pr.y - pcy;
      if (!mod.reflectable || pr.stuck || rf.hitIds.includes(pr.id) || dx * dx + dy * dy > REFLECT.RADIUS * REFLECT.RADIUS) {
        next.push(pr);
        continue;
      }
      any = true;
      const out = mod.onReflect(pr, dir);
      out.forEach((s, k) => {
        const n = { ...s, id: k === 0 ? pr.id : state.nextId++, grace: true };
        rf.hitIds.push(n.id);
        next.push(n);
      });
      events.push({ type: 'projectile.reflect', dir, id: pr.id, ptype: pr.type, x: pr.x, y: pr.y });
    }
    state.projectiles = next;
    if (any) {
      state.hitstop = frames(REFLECT.HITSTOP);
      if (!rf.connected) { rf.connected = true; state.stats.reflects++; }
    }
  }

  // ── grace ends once a reflected projectile clears the zone ──
  const gr = REFLECT.RADIUS + REFLECT.GRACE_MARGIN;
  for (const pr of state.projectiles) {
    if (!pr.grace) continue;
    const dx = pr.x - pcx, dy = pr.y - pcy;
    if (dx * dx + dy * dy > gr * gr) delete pr.grace;
  }

  // ── lethal contact ──
  if (!state.opts.invincible) {
    const box = playerBox(p);
    for (const pr of state.projectiles) {
      const mod = PROJECTILES[pr.type];
      if (mod.lethal === false || pr.grace || pr.stuck) continue;
      if (circleRect(pr.x, pr.y, pr.r, box)) {
        state.status = 'dead';
        events.push({ type: 'player.death', ptype: pr.type, x: pcx, y: pcy });
        break;
      }
    }
  }

  // ── spikes (static hazard; projectiles pass over them) ──
  if (state.status === 'play' && touchesSpikes(room, playerBox(p))) {
    state.status = 'dead';
    events.push({ type: 'player.death', cause: 'spikes', ptype: null, x: pcx, y: pcy });
  }

  // ── exit ──
  if (state.status === 'play') {
    if (room.goal === 'cores') {
      // Examiner phase: cleared by breaking every core, not by an exit
      if (state.objects.every((o) => o.kind !== 'core' || o.broken)) {
        state.status = 'clear';
        events.push({ type: 'room.clear', reflects: state.stats.reflects, x: pcx, y: pcy });
      }
    } else if (rectsOverlap(playerBox(p), { x: room.exit[0] * T, y: room.exit[1] * T, w: T, h: T })) {
      state.status = 'clear';
      events.push({ type: 'room.clear', reflects: state.stats.reflects, x: (room.exit[0] + 0.5) * T, y: (room.exit[1] + 0.5) * T });
    }
  }

  state.frame++;
  return events;
}

function touchesSpikes(room, box) {
  const x0 = Math.floor(box.x / T), x1 = Math.floor((box.x + box.w) / T);
  const y0 = Math.floor(box.y / T), y1 = Math.floor((box.y + box.h) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (!isSpike(room, tx, ty)) continue;
    const r = { x: tx * T + SPIKES.INSET_X, y: ty * T + SPIKES.TOP, w: T - 2 * SPIKES.INSET_X, h: T - SPIKES.TOP };
    if (rectsOverlap(r, box)) return true;
  }
  return false;
}

function triggerLinks(state, links, events) {
  for (let i = 0; i < state.objects.length; i++) {
    const o = state.objects[i];
    if (o.kind !== 'door' || !links.includes(o.id)) continue;
    const r = OBJECTS.door.trigger(o);
    state.objects[i] = r.state;
    events.push(...r.events);
  }
}

// Headless run of an input log from room start. Returns the final state and
// the frame at which the room was cleared (or null).
export function runLog(room, masks, opts) {
  const state = createState(room, opts);
  const allEvents = [];
  for (let i = 0; i < masks.length && state.status === 'play'; i++) {
    const ev = step(state, room, masks[i]);
    if (opts && opts.collectEvents) allEvents.push(...ev);
  }
  return { state, events: allEvents };
}
