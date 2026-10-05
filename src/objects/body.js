// Examiner body — the large geometric presence. Solid to the player and to
// projectiles. Pure mass and presentation: its "voice" is the emitters placed
// around it, and it is beaten through its cores (GDD: The Examiner).
import { ROOM } from '../../config/tunables.js';

const T = ROOM.TILE;
export const kind = 'body';

export function create(def) {
  return { kind, id: def.id || null, tx: def.at[0], ty: def.at[1], w: def.w, h: def.h };
}

export const step = (s) => ({ state: s, events: [], spawns: [] });
export const onProjectileHit = (s) => ({ state: s, events: [] });
export const hitRect = (s) => ({ x: s.tx * T, y: s.ty * T, w: s.w * T, h: s.h * T });
export const solids = (s) => [hitRect(s)];

export function render(ctx, s, theme, view = {}) {
  const x = s.tx * T, y = s.ty * T, w = s.w * T, h = s.h * T;
  const c = Math.min(w, h) * 0.28; // chamfer
  const cx = x + w / 2, cy = y + h / 2;
  ctx.save();
  if (view.collapse) ctx.globalAlpha = Math.max(0, 1 - view.collapse);
  const poly = () => {
    ctx.beginPath();
    ctx.moveTo(x + c, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c); ctx.lineTo(x + w, y + h - c);
    ctx.lineTo(x + w - c, y + h); ctx.lineTo(x + c, y + h); ctx.lineTo(x, y + h - c); ctx.lineTo(x, y + c); ctx.closePath();
  };
  poly();
  ctx.fillStyle = theme.examinerBody;
  ctx.fill();
  ctx.strokeStyle = theme.examiner;
  ctx.lineWidth = 2;
  ctx.shadowColor = theme.examiner;
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // inner rings
  ctx.globalAlpha *= 0.35;
  for (let k = 1; k <= 2; k++) {
    ctx.beginPath(); ctx.ellipse(cx, cy, (w / 2) * (0.3 + 0.25 * k), (h / 2) * (0.3 + 0.25 * k), 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = view.collapse ? Math.max(0, 1 - view.collapse) : 1;
  // the eye watches you (presentation only)
  const er = Math.min(w, h) * 0.16;
  let ex = 0, ey = 0;
  if (view.look) {
    const dx = view.look[0] - cx, dy = view.look[1] - cy, d = Math.hypot(dx, dy) || 1;
    ex = (dx / d) * er * 0.45; ey = (dy / d) * er * 0.45;
  }
  ctx.strokeStyle = theme.examiner;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, er, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = theme.examiner;
  ctx.beginPath(); ctx.arc(cx + ex, cy + ey, er * 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
