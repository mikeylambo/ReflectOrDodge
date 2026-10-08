// Examiner core — a target on the Examiner's body. Only a REFLECTED projectile
// breaks it: the Examiner is defeated by your answers, never by its own fire
// (GDD: The Examiner). A room with goal "cores" clears when every core is broken.
import { ROOM } from '../../config/tunables.js';

const T = ROOM.TILE;
export const kind = 'core';
const PAD = 4;

export function create(def) {
  return { kind, id: def.id || null, tx: def.at[0], ty: def.at[1], broken: false };
}

export const step = (s) => ({ state: s, events: [], spawns: [] });

export function onProjectileHit(s, p) {
  if (s.broken || !p.reflected) return { state: s, events: [] };
  return { state: { ...s, broken: true }, events: [{ type: 'examiner.core', x: (s.tx + 0.5) * T, y: (s.ty + 0.5) * T }] };
}

// unreflected fire still strikes (and is absorbed by) an intact core
export const hitRect = (s) => (s.broken ? null : { x: s.tx * T + PAD, y: s.ty * T + PAD, w: T - 2 * PAD, h: T - 2 * PAD });
export const solids = () => [];

export function render(ctx, s, theme) {
  const cx = (s.tx + 0.5) * T, cy = (s.ty + 0.5) * T;
  ctx.save();
  if (s.broken) {
    ctx.strokeStyle = theme.examinerDim;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    return;
  }
  // hexagonal core: a target only an answer can reach
  ctx.shadowColor = theme.examinerCore;
  ctx.shadowBlur = 14;
  ctx.fillStyle = theme.examinerCore;
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    ctx[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * 11, cy + Math.sin(a) * 11);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = theme.bg0;
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
