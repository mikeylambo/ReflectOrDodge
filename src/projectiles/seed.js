// Seed — diamond. Reflectable. Where it strikes a surface (tile, door, wall)
// it sticks and becomes a one-way platform for SEED.LIFE seconds, then
// expires. A stuck Seed is harmless and can't be reflected. Switches and
// emitters still consume it like an Orb. (GDD: Projectiles — "Reflecting
// builds your route")
import { SEED, TIMESTEP } from '../../config/tunables.js';
import { DIRS } from '../sim/input.js';

export const type = 'seed';
export const reflectable = true;
export const lethal = true;
export const tunables = { ...SEED };

const LIFE_F = Math.round(SEED.LIFE * TIMESTEP.HZ);

export function spawn({ x, y, dir, speed = SEED.SPEED }) {
  const [dx, dy] = DIRS[dir];
  return { type, x, y, px: x, py: y, r: SEED.RADIUS, vx: dx * speed, vy: dy * speed, reflected: false, age: 0 };
}

export function step(s, dt) {
  if (s.stuck) {
    if (s.life <= 1) return { state: null, events: [{ type: 'seed.expire', x: s.x, y: s.y }] };
    return { state: { ...s, px: s.x, py: s.y, life: s.life - 1 }, events: [] };
  }
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

const STICKS_TO = new Set(['tile', 'wall', 'door']); // solid tiles, breakable walls, closed doors

// Platform rect from the face it struck. Horizontal flight → a ledge jutting
// out of the wall at the seed's height; vertical → a slab on the face.
function platformFor(s, rect) {
  const W = SEED.PLATFORM_W, H = SEED.PLATFORM_H;
  if (Math.abs(s.vx) >= Math.abs(s.vy)) {
    const face = s.vx > 0 ? rect.x : rect.x + rect.w;
    return { x: s.vx > 0 ? face - W : face, y: s.y - H / 2, w: W, h: H };
  }
  const face = s.vy > 0 ? rect.y : rect.y + rect.h;
  return { x: s.x - W / 2, y: s.vy > 0 ? face - H : face, w: W, h: H };
}

export function onHit(s, object) {
  if (!STICKS_TO.has(object.kind) || !object.rect) {
    return { state: null, events: [{ type: 'projectile.destroy', ptype: type, x: s.x, y: s.y, on: object.kind }] };
  }
  const plat = platformFor(s, object.rect);
  return {
    state: { ...s, stuck: true, life: LIFE_F, plat, vx: 0, vy: 0, x: plat.x + plat.w / 2, y: plat.y + plat.h / 2, px: s.x, py: s.y },
    events: [{ type: 'seed.stick', x: plat.x + plat.w / 2, y: plat.y }],
  };
}

export const platforms = (s) => (s.stuck ? [s.plat] : []);

export function render(ctx, s, alpha, theme) {
  ctx.save();
  if (s.stuck) {
    const p = s.plat;
    const blinkF = SEED.BLINK * TIMESTEP.HZ;
    if (s.life < blinkF && Math.floor(s.life / 8) % 2 === 0) ctx.globalAlpha = 0.35;
    ctx.fillStyle = theme.seedPlatform;
    ctx.shadowColor = theme.seed;
    ctx.shadowBlur = 8;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.shadowBlur = 0;
    ctx.fillStyle = theme.seed;
    ctx.fillRect(p.x, p.y, p.w, 2);
    // life bar under the slab
    ctx.globalAlpha *= 0.6;
    ctx.fillRect(p.x, p.y + p.h + 2, p.w * (s.life / LIFE_F), 1.5);
    ctx.restore();
    return;
  }
  const x = s.px + (s.x - s.px) * alpha;
  const y = s.py + (s.y - s.py) * alpha;
  const r = s.r + 1.5;
  ctx.shadowColor = theme.seed;
  ctx.shadowBlur = 12;
  ctx.fillStyle = theme.flash ? '#ffffff' : (s.reflected ? theme.orbReflected : theme.seed);
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
  ctx.fill();
  ctx.restore();
}
