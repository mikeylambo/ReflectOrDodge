// Switch — any projectile hit fires its links. mode "once" (default) fires on
// the first hit only; "toggle" fires on every hit. The player touching it does
// nothing, and it is not solid to the player: law 1 made visible.
import { ROOM } from '../../config/tunables.js';

const T = ROOM.TILE;
export const kind = 'switch';
const PAD = 6; // target is a little smaller than its tile

export function create(def) {
  return { kind, id: def.id || null, tx: def.at[0], ty: def.at[1], links: def.links || [], mode: def.mode || 'once', hits: 0 };
}

export const step = (s) => ({ state: s, events: [], spawns: [] });

export function onProjectileHit(s, p) {
  const fire = s.mode === 'toggle' || s.hits === 0;
  const events = [{ type: 'switch.hit', x: (s.tx + 0.5) * T, y: (s.ty + 0.5) * T, links: fire ? s.links : [], ptype: p.type }];
  return { state: { ...s, hits: s.hits + 1 }, events };
}

export const hitRect = (s) => ({ x: s.tx * T + PAD, y: s.ty * T + PAD, w: T - 2 * PAD, h: T - 2 * PAD });
export const solids = () => [];

export function render(ctx, s, theme) {
  const cx = (s.tx + 0.5) * T, cy = (s.ty + 0.5) * T;
  const lit = s.hits > 0 && (s.mode === 'once' || s.hits % 2 === 1);
  const rr = T / 2 - PAD;
  ctx.save();
  ctx.strokeStyle = theme.switch;
  ctx.lineWidth = 2;
  // diamond-in-square target silhouette
  ctx.strokeRect(cx - rr, cy - rr, rr * 2, rr * 2);
  ctx.beginPath();
  ctx.moveTo(cx, cy - rr + 3); ctx.lineTo(cx + rr - 3, cy); ctx.lineTo(cx, cy + rr - 3); ctx.lineTo(cx - rr + 3, cy); ctx.closePath();
  if (s.mode === 'toggle') {
    // toggle switches carry a ring: "this one flips back" (shape, not colour)
    ctx.beginPath();
    ctx.arc(cx, cy, rr + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - rr + 3); ctx.lineTo(cx + rr - 3, cy); ctx.lineTo(cx, cy + rr - 3); ctx.lineTo(cx - rr + 3, cy); ctx.closePath();
  }
  if (lit) {
    ctx.fillStyle = theme.switch;
    ctx.shadowColor = theme.switch;
    ctx.shadowBlur = 12;
    ctx.fill();
  } else ctx.stroke();
  ctx.restore();
}
