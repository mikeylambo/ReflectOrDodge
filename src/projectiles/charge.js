// Charge — ring. Reflectable. It bounces off solid tiles, 25% faster each time
// (up to MAX_BOUNCES gains), and only kills once it's at full speed: reflect it
// early, or let it ricochet into danger. A reflect keeps its speed. Anything
// that isn't a solid tile ends it like an Orb (switches fire, doors stop it).
// It fizzles after LIFE seconds so a room can't fill with ricochets.
// (GDD: Projectiles)
import { CHARGE, TIMESTEP } from '../../config/tunables.js';
import { DIRS } from '../sim/input.js';

export const type = 'charge';
export const reflectable = true;
export const tunables = { ...CHARGE };
// state-dependent: harmless until it has gained full speed
export const lethal = (s) => s.bounces >= CHARGE.MAX_BOUNCES;

const LIFE_F = Math.round(CHARGE.LIFE * TIMESTEP.HZ);

export function spawn({ x, y, dir, speed = CHARGE.SPEED }) {
  const [dx, dy] = DIRS[dir];
  return { type, x, y, px: x, py: y, r: CHARGE.RADIUS, vx: dx * speed, vy: dy * speed, reflected: false, age: 0, bounces: 0, life: LIFE_F };
}

export function step(s, dt) {
  if (s.life <= 1) return { state: null, events: [{ type: 'projectile.destroy', ptype: type, x: s.x, y: s.y, on: 'fizzle' }] };
  return { state: { ...s, px: s.x, py: s.y, x: s.x + s.vx * dt, y: s.y + s.vy * dt, age: s.age + 1, life: s.life - 1 }, events: [] };
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

// Which face did it come through? Decided from where it was the step before,
// so a corner hit flips both axes. It's put back where it was (outside the
// tile) with the new velocity.
export function onHit(s, object) {
  if (object.kind !== 'tile' || !object.rect) {
    return { state: null, events: [{ type: 'projectile.destroy', ptype: type, x: s.x, y: s.y, on: object.kind }] };
  }
  const r = object.rect;
  const fromSide = s.px + s.r <= r.x || s.px - s.r >= r.x + r.w;
  const fromEnd = s.py + s.r <= r.y || s.py - s.r >= r.y + r.h;
  const flipX = fromSide || !fromEnd, flipY = fromEnd || !fromSide;
  const gain = s.bounces < CHARGE.MAX_BOUNCES ? CHARGE.GAIN : 1;
  const vx = (flipX ? -s.vx : s.vx) * gain, vy = (flipY ? -s.vy : s.vy) * gain;
  return {
    state: { ...s, x: s.px, y: s.py, vx, vy, bounces: Math.min(s.bounces + 1, CHARGE.MAX_BOUNCES) },
    events: [{ type: 'charge.bounce', x: s.x, y: s.y, bounces: Math.min(s.bounces + 1, CHARGE.MAX_BOUNCES) }],
  };
}

// solver key: speed tier changes what the projectile can do
export const keyOf = (s) => `b${s.bounces}`;

export function render(ctx, s, alpha, theme) {
  const x = s.px + (s.x - s.px) * alpha;
  const y = s.py + (s.y - s.py) * alpha;
  const hot = lethal(s);
  ctx.save();
  ctx.shadowColor = hot ? theme.chargeHot : theme.charge;
  ctx.shadowBlur = hot ? 18 : 8;
  ctx.strokeStyle = theme.flash ? '#ffffff' : hot ? theme.chargeHot : theme.charge;
  ctx.lineWidth = hot ? 4 : 2.5;
  ctx.beginPath();
  ctx.arc(x, y, s.r, 0, Math.PI * 2);
  ctx.stroke();
  // one tick per gained speed tier (shape, not just colour)
  ctx.fillStyle = ctx.strokeStyle;
  for (let i = 0; i < s.bounces; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / CHARGE.MAX_BOUNCES;
    ctx.fillRect(x + Math.cos(a) * (s.r + 4) - 1.5, y + Math.sin(a) * (s.r + 4) - 1.5, 3, 3);
  }
  ctx.restore();
}
