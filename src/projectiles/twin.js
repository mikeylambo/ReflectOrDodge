// Twin — a linked pair, fired side by side. Reflectable. Reflecting one
// mirrors the reflection onto its twin: the twin takes the mirror image of the
// new direction across the pair's original line of travel (reflect the lower
// one up, the upper one goes down; send one back, both come back). One answer,
// two outcomes. Each is destroyed by what it hits, like an Orb; a lone twin
// carries on unlinked. (GDD: Projectiles)
//
// The engine links the pair: spawn() returns both, the engine gives them a
// shared `group`, and after a reflect it calls onLinkedReflect on the partner.
import { TWIN } from '../../config/tunables.js';
import { DIRS } from '../sim/input.js';

export const type = 'twin';
export const reflectable = true;
export const lethal = true;
export const tunables = { ...TWIN };

export function spawn({ x, y, dir, speed = TWIN.SPEED }) {
  const [dx, dy] = DIRS[dir];
  const ox = -dy * (TWIN.GAP / 2), oy = dx * (TWIN.GAP / 2); // perpendicular offset
  const one = (sx, sy, side) => ({ type, x: sx, y: sy, px: sx, py: sy, r: TWIN.RADIUS, vx: dx * speed, vy: dy * speed, reflected: false, age: 0, axis: [dx, dy], side });
  return [one(x + ox, y + oy, 1), one(x - ox, y - oy, -1)];
}

export function step(s, dt) {
  return { state: { ...s, px: s.x, py: s.y, x: s.x + s.vx * dt, y: s.y + s.vy * dt, age: s.age + 1 }, events: [] };
}

export function onReflect(s, dir) {
  let vx, vy;
  if (dir === 'neutral') { vx = -s.vx; vy = -s.vy; } else {
    const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    const [dx, dy] = DIRS[dir];
    vx = dx * speed; vy = dy * speed;
  }
  return [{ ...s, vx, vy, reflected: true }];
}

// The partner of a reflected twin takes the mirror image of its new velocity
// across the pair's axis: v' = 2(v·a)a − v.
export function onLinkedReflect(s, partner) {
  const [ax, ay] = s.axis;
  const d = partner.vx * ax + partner.vy * ay;
  return { ...s, vx: 2 * d * ax - partner.vx, vy: 2 * d * ay - partner.vy, reflected: true };
}

export function onHit(s, object) {
  return { state: null, events: [{ type: 'projectile.destroy', ptype: type, x: s.x, y: s.y, on: object.kind }] };
}

export function render(ctx, s, alpha, theme) {
  const x = s.px + (s.x - s.px) * alpha;
  const y = s.py + (s.y - s.py) * alpha;
  ctx.save();
  ctx.shadowColor = theme.twin;
  ctx.shadowBlur = 12;
  ctx.fillStyle = theme.flash ? '#ffffff' : theme.twin;
  ctx.beginPath();
  ctx.arc(x, y, s.r, 0, Math.PI * 2);
  ctx.fill();
  // a stub of the link toward where the partner flies (shape cue for "paired")
  // the partner was spawned on the other side of the line of travel
  const [ax, ay] = s.axis, L = TWIN.GAP / 2 - 2;
  ctx.strokeStyle = theme.twin;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + ay * s.side * L, y - ax * s.side * L);
  ctx.stroke();
  ctx.restore();
}
