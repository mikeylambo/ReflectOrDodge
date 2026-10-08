// The projectile-type contract (GDD: Core interfaces) + validator.
//
// A projectile type is a module exporting:
//   type                                  string id used in room data
//   reflectable                           bool
//   tunables                              {name: value} — every knob exposed
//   spawn({x, y, dir, speed}) -> state | state[]
//                                         plain data; must include x, y, r, vx, vy.
//                                         An array fires several together (Twin);
//                                         the engine gives them a shared `group`
//   step(state, dt, world) -> { state, events[] }
//   onReflect(state, dir) -> state[]      array so Splitter can return two
//   onHit(state, object) -> { state | null, events[] }
//                                         object = { kind: 'tile' | object kind, rect, ... };
//                                         returning a state = it keeps going (or sticks)
//   platforms(state) -> Rect[]            optional: one-way platforms for the player
//   lethal                                bool, or (state) -> bool (Charge: only at full speed)
//   onLinkedReflect(state, partner) -> state
//                                         optional: a projectile in the same spawn group
//                                         as one just reflected takes this (Twin)
//   keyOf(state) -> string                optional: extra solver-key state (Charge: bounces)
//   (step may return { state: null } to remove the projectile, e.g. a platform expiring)
//   render(ctx, state, alpha, theme)
//
// Rules:
//   1. step/onReflect/onHit are PURE: same input, same output, never mutate.
//   2. No Math.random, no clocks. Anything that varies comes in via params.
//   3. A projectile never touches the player, the engine or another
//      projectile. The engine detects contact and calls onHit/onReflect.
//   4. State is plain JSON-serialisable data (headless stepping, replays).

export function validateProjectileType(mod) {
  const fail = (m) => { throw new Error(`projectile contract violation (${mod && mod.type}): ${m}`); };
  if (!mod || typeof mod !== 'object') fail('module is not an object');
  if (typeof mod.type !== 'string' || !mod.type) fail('type missing');
  if (typeof mod.reflectable !== 'boolean') fail('reflectable must be boolean');
  if (!mod.tunables || typeof mod.tunables !== 'object') fail('tunables missing');
  for (const f of ['spawn', 'step', 'onReflect', 'onHit', 'render']) {
    if (typeof mod[f] !== 'function') fail(`${f}() missing`);
  }

  const world = { dt: 1 / 120 };
  const spawned = mod.spawn({ x: 100, y: 100, dir: 'left', speed: 140 });
  if (Array.isArray(spawned) && !spawned.length) fail('spawn() returned an empty array');
  const s0 = Array.isArray(spawned) ? spawned[0] : spawned;
  if (!(typeof mod.lethal === 'boolean' || typeof mod.lethal === 'function')) fail('lethal must be a boolean or a function of state');
  for (const k of ['x', 'y', 'r', 'vx', 'vy']) if (!Number.isFinite(s0[k])) fail(`spawn() state.${k} not finite`);
  const frozen = JSON.stringify(s0);

  const a = mod.step(s0, world.dt, world);
  const b = mod.step(s0, world.dt, world);
  if (!a || !a.state || !Array.isArray(a.events)) fail('step() must return { state, events[] }');
  if (JSON.stringify(a) !== JSON.stringify(b)) fail('step() is not pure');
  if (JSON.stringify(s0) !== frozen) fail('step() mutated its input');

  for (const dir of ['up', 'down', 'left', 'right', 'neutral']) {
    const r = mod.onReflect(s0, dir);
    if (!Array.isArray(r) || r.length < 1) fail(`onReflect(${dir}) must return a non-empty array`);
    if (JSON.stringify(s0) !== frozen) fail('onReflect() mutated its input');
  }

  const h = mod.onHit(s0, { kind: 'tile', rect: { x: 0, y: 84, w: 32, h: 32 } });
  if (!h || !('state' in h) || !Array.isArray(h.events)) fail('onHit() must return { state | null, events[] }');
  if (JSON.stringify(JSON.parse(JSON.stringify(s0))) !== frozen) fail('state is not plain data');
  return mod;
}
