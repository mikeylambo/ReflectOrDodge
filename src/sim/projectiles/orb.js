// Orb — circle. Reflectable. Destroyed by anything it hits, triggering it.
// The baseline routing primitive (GDD: Projectiles).
import { PROJECTILE } from '../../config/tunables.js';
import { DIRS } from '../input.js';

export const type = 'orb';
export const reflectable = true;
export const lethal = true;
export const tunables = { RADIUS: 6, SPEED: PROJECTILE.BASE_SPEED };

export function spawn({ x, y, dir, speed = tunables.SPEED }) {
  const [dx, dy] = DIRS[dir];
  return { type, x, y, px: x, py: y, r: tunables.RADIUS, vx: dx * speed, vy: dy * speed, reflected: false, age: 0 };
}

export function step(s, dt) {
  return {
    state: { ...s, px: s.x, py: s.y, x: s.x + s.vx * dt, y: s.y + s.vy * dt, age: s.age + 1 },
    events: [],
  };
}

export function onReflect(s, dir) {
  let vx, vy;
  if (dir === 'neutral') {
    vx = -s.vx; vy = -s.vy; // return to sender, straight back along its path
  } else {
    const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    const [dx, dy] = DIRS[dir];
    vx = dx * speed; vy = dy * speed;
  }
  return [{ ...s, vx, vy, reflected: true }];
}

export function onHit(s, object) {
  return { state: null, events: [{ type: 'projectile.destroy', ptype: type, x: s.x, y: s.y, on: object.kind }] };
}

export function render(ctx, s, alpha, theme) {
  const x = s.px + (s.x - s.px) * alpha;
  const y = s.py + (s.y - s.py) * alpha;
  ctx.save();
  ctx.shadowColor = theme.orbGlow;
  ctx.shadowBlur = 14;
  ctx.fillStyle = theme.flash ? '#ffffff' : theme.orb;
  ctx.beginPath();
  ctx.arc(x, y, s.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = theme.orbCore;
  ctx.beginPath();
  ctx.arc(x, y, s.r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
