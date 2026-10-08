// Anchor — heavy square. Not reflectable: it kills on contact, so it forces a
// jump. Slower than an Orb and unstoppable: it smashes breakable walls (heavy
// ones too) and triggers switches without stopping. Solid tiles, closed doors
// and emitters still end it. (GDD: Projectiles)
import { ANCHOR } from '../../config/tunables.js';
import { DIRS } from '../sim/input.js';

export const type = 'anchor';
export const reflectable = false;
export const lethal = true;
export const tunables = { ...ANCHOR };

export function spawn({ x, y, dir, speed = ANCHOR.SPEED }) {
  const [dx, dy] = DIRS[dir];
  return { type, x, y, px: x, py: y, r: ANCHOR.HALF, vx: dx * speed, vy: dy * speed, reflected: false, age: 0 };
}

export function step(s, dt) {
  return { state: { ...s, px: s.x, py: s.y, x: s.x + s.vx * dt, y: s.y + s.vy * dt, age: s.age + 1 }, events: [] };
}

// never called by the engine (reflectable is false); kept for the contract
export const onReflect = (s) => [{ ...s }];

export function onHit(s, object) {
  // breakable walls (smashed by the wall module) and switches don't stop it;
  // solid tiles, closed doors and emitters do
  if (object.kind === 'wall' || object.kind === 'switch') return { state: s, events: [] };
  return { state: null, events: [{ type: 'projectile.destroy', ptype: type, x: s.x, y: s.y, on: object.kind }] };
}

export function render(ctx, s, alpha, theme) {
  const x = s.px + (s.x - s.px) * alpha;
  const y = s.py + (s.y - s.py) * alpha;
  const h = s.r;
  ctx.save();
  ctx.shadowColor = theme.anchor;
  ctx.shadowBlur = 10;
  ctx.fillStyle = theme.anchorBody;
  ctx.fillRect(x - h, y - h, h * 2, h * 2);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = theme.anchor;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x - h + 1, y - h + 1, h * 2 - 2, h * 2 - 2);
  // heavy cross-brace: reads as "weight", not as a target
  ctx.beginPath();
  ctx.moveTo(x - h + 3, y - h + 3); ctx.lineTo(x + h - 3, y + h - 3);
  ctx.moveTo(x + h - 3, y - h + 3); ctx.lineTo(x - h + 3, y + h - 3);
  ctx.stroke();
  ctx.restore();
}
