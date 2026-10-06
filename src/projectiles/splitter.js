// Splitter — triangle. Reflectable. A reflect sends it on as TWO, at ±45° of
// the outgoing direction; each half is a Splitter too. Destroyed by anything
// it hits, triggering it, like an Orb. Power with a price: one answer, two
// projectiles to account for. (GDD: Projectiles)
import { SPLITTER } from '../../config/tunables.js';
import { DIRS } from '../sim/input.js';

export const type = 'splitter';
export const reflectable = true;
export const lethal = true;
export const tunables = { ...SPLITTER };

export function spawn({ x, y, dir, speed = SPLITTER.SPEED }) {
  const [dx, dy] = DIRS[dir];
  return { type, x, y, px: x, py: y, r: SPLITTER.RADIUS, vx: dx * speed, vy: dy * speed, reflected: false, age: 0, gen: 0 };
}

export function step(s, dt) {
  return { state: { ...s, px: s.x, py: s.y, x: s.x + s.vx * dt, y: s.y + s.vy * dt, age: s.age + 1 }, events: [] };
}

// ±45° rotation with an exact constant (no trig): replays stay bit-identical
// across runtimes.
const H = Math.SQRT1_2;
export function onReflect(s, dir) {
  const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
  let ux, uy;
  if (dir === 'neutral') { ux = -s.vx / speed; uy = -s.vy / speed; } else [ux, uy] = DIRS[dir];
  const a = { ...s, vx: (ux - uy) * H * speed, vy: (ux + uy) * H * speed, reflected: true, gen: s.gen + 1 };
  const b = { ...s, vx: (ux + uy) * H * speed, vy: (uy - ux) * H * speed, reflected: true, gen: s.gen + 1 };
  return [a, b];
}

export function onHit(s, object) {
  return { state: null, events: [{ type: 'projectile.destroy', ptype: type, x: s.x, y: s.y, on: object.kind }] };
}

export function render(ctx, s, alpha, theme) {
  const x = s.px + (s.x - s.px) * alpha;
  const y = s.py + (s.y - s.py) * alpha;
  const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy) || 1;
  const ux = s.vx / sp, uy = s.vy / sp, r = s.r + 2;
  ctx.save();
  ctx.shadowColor = theme.splitter;
  ctx.shadowBlur = 12;
  ctx.fillStyle = theme.flash ? '#ffffff' : theme.splitter;
  // triangle pointing along its travel
  ctx.beginPath();
  ctx.moveTo(x + ux * r, y + uy * r);
  ctx.lineTo(x - ux * r * 0.7 - uy * r * 0.85, y - uy * r * 0.7 + ux * r * 0.85);
  ctx.lineTo(x - ux * r * 0.7 + uy * r * 0.85, y - uy * r * 0.7 - ux * r * 0.85);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
