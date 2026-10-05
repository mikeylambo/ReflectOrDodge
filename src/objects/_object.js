// The room-object contract (GDD: Core interfaces) — same shape as projectiles.
//
//   kind                                         string id used in room data
//   create(def) -> state                         plain data from the room JSON entry
//   step(state, world) -> { state, events[], spawns[] }   spawns = projectile spawn params
//   onProjectileHit(state, proj) -> { state, events[] }   only called when hitRect() overlaps
//   hitRect(state) -> Rect | null                what projectiles collide with (null = pass through)
//   solids(state) -> Rect[]                      what the PLAYER collides with
//   render(ctx, state, theme, view)
//
// Targets react only to projectiles (GDD law 1): there is deliberately no
// onPlayerTouch. The exit is the single exception and is handled by the engine.

export function validateObjectType(mod) {
  const fail = (m) => { throw new Error(`object contract violation (${mod && mod.kind}): ${m}`); };
  if (!mod || typeof mod.kind !== 'string') fail('kind missing');
  for (const f of ['create', 'step', 'onProjectileHit', 'hitRect', 'solids', 'render']) {
    if (typeof mod[f] !== 'function') fail(`${f}() missing`);
  }
  return mod;
}
