// Door — a vertical bar `h` tiles tall growing down from `at`. Blocks the
// player and projectiles while closed. Driven only by linked switches.
import { ROOM } from '../../config/tunables.js';

const T = ROOM.TILE;
export const kind = 'door';

export function create(def) {
  const open = !!def.open;
  return { kind, id: def.id, tx: def.at[0], ty: def.at[1], h: def.h || 3, open, slide: open ? 1 : 0 };
}

export function trigger(s) {
  return { state: { ...s, open: !s.open }, events: [{ type: s.open ? 'door.close' : 'door.open', x: (s.tx + 0.5) * T, y: (s.ty + s.h / 2) * T }] };
}

// slide is presentation-only interpolation; collision follows `open` instantly
export function step(s) {
  const target = s.open ? 1 : 0;
  if (s.slide === target) return { state: s, events: [], spawns: [] };
  const slide = s.open ? Math.min(1, s.slide + 1 / 18) : Math.max(0, s.slide - 1 / 18);
  return { state: { ...s, slide }, events: [], spawns: [] };
}

export const onProjectileHit = (s) => ({ state: s, events: [] });
export const hitRect = (s) => (s.open ? null : { x: s.tx * T, y: s.ty * T, w: T, h: s.h * T });
export const solids = (s) => (s.open ? [] : [hitRect(s)]);

export function render(ctx, s, theme) {
  const x = s.tx * T, y = s.ty * T, H = s.h * T;
  const shown = H * (1 - s.slide);
  ctx.save();
  ctx.strokeStyle = theme.door;
  ctx.globalAlpha = 0.35;
  ctx.setLineDash([3, 4]);
  ctx.strokeRect(x + 6.5, y + 0.5, T - 13, H - 1);
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  if (shown > 0.5) {
    ctx.fillStyle = theme.doorFill;
    ctx.fillRect(x + 6, y, T - 12, shown);
    ctx.fillStyle = theme.door;
    for (let yy = y + 6; yy < y + shown - 2; yy += 10) ctx.fillRect(x + 9, yy, T - 18, 3);
    ctx.shadowColor = theme.door;
    ctx.shadowBlur = 8;
    ctx.fillRect(x + 6, y + shown - 2, T - 12, 2);
  }
  ctx.restore();
}
