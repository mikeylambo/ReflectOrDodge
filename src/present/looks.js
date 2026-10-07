// Presentation-only looks that replace a type's own render() in the game
// view. They live here, not in src/objects/ or src/projectiles/, because those
// files key the solver cache (test/solve-cache.mjs): a drawing change there
// would make CI re-solve every room. render.js calls LOOKS[kind] first.
import { ROOM, SEED, TIMESTEP } from '../../config/tunables.js';

const T = ROOM.TILE;
const LIFE_F = Math.round(SEED.LIFE * TIMESTEP.HZ);

// Examiner body (docs/art-ref/examiner-ch1.jpg): chamfered octagon, diagram
// marks, inner rings that tilt toward you, a glowing pupil that follows you.
function body(ctx, s, theme, view = {}) {
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
  const base = view.collapse ? Math.max(0, 1 - view.collapse) : 1;
  // where you are, from its centre (presentation only)
  let lx = 0, ly = 0;
  if (view.look) {
    const dx = view.look[0] - cx, dy = view.look[1] - cy, d = Math.hypot(dx, dy) || 1;
    lx = dx / d; ly = dy / d;
  }
  // diagram marks (docs/art-ref/examiner-ch1.jpg): a vertical axis through the
  // eye with end nodes, and a faint dashed circle around the body
  ctx.save();
  ctx.lineWidth = 1;
  ctx.globalAlpha = base * 0.3;
  ctx.setLineDash([2, 4]);
  ctx.beginPath(); ctx.moveTo(cx, y - 26); ctx.lineTo(cx, y + 4); ctx.moveTo(cx, y + h - 4); ctx.lineTo(cx, y + h + 26); ctx.stroke();
  ctx.globalAlpha = base * 0.14;
  ctx.beginPath(); ctx.ellipse(cx, cy, w / 2 + 22, h / 2 + 22, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = base * 0.6;
  ctx.fillStyle = theme.examiner;
  for (const ny of [y - 26, y + h + 26]) { ctx.beginPath(); ctx.arc(cx, ny, 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  // inner rings: they tilt and lean toward you, like an iris following
  ctx.save();
  poly(); ctx.clip();
  ctx.lineWidth = 1.5;
  const tilt = lx * 0.32;
  for (let k = 1; k <= 3; k++) {
    ctx.globalAlpha = base * (0.42 - k * 0.08);
    const sx = (w / 2) * (0.22 + 0.24 * k), sy = (h / 2) * (0.16 + 0.14 * k);
    ctx.beginPath(); ctx.ellipse(cx + lx * k * 3, cy + ly * k * 2, sx, sy, tilt, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = base;
  // the eye watches you: a ring, a halo, and a glowing pupil
  const er = Math.min(w, h) * 0.16;
  const ex = lx * er * 0.45, ey = ly * er * 0.45;
  ctx.strokeStyle = theme.examiner;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, er, 0, Math.PI * 2); ctx.stroke();
  const pr = er * 0.42;
  const halo = ctx.createRadialGradient(cx + ex, cy + ey, 0, cx + ex, cy + ey, pr * 2.4);
  halo.addColorStop(0, theme.examiner); halo.addColorStop(0.4, 'rgba(255,143,216,0.35)'); halo.addColorStop(1, 'rgba(255,143,216,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(cx + ex, cy + ey, pr * 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = theme.examiner; ctx.shadowBlur = 12;
  ctx.fillStyle = '#ffd9f1';
  ctx.beginPath(); ctx.arc(cx + ex, cy + ey, pr, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// A planted Seed as the Chapter 3 card draws it. Falls back to the type's own
// render while the seed is still flying.
function seed(ctx, s, alpha, theme, own) {
  if (!s.stuck) return own(ctx, s, alpha, theme);
  ctx.save();
  const p = s.plat;
  const blinkF = SEED.BLINK * TIMESTEP.HZ;
  if (s.life < blinkF && Math.floor(s.life / 8) % 2 === 0) ctx.globalAlpha = 0.35;
  // a cut lens (docs/art-ref/title-card-ch3.jpg): flat lit top where you
  // stand, a shallow faceted keel below, a node at its point
  const cx = p.x + p.w / 2, keel = p.y + p.h + 5;
  ctx.fillStyle = theme.seedPlatform;
  ctx.shadowColor = theme.seed;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(p.x - 2, p.y); ctx.lineTo(p.x + p.w + 2, p.y); ctx.lineTo(p.x + p.w - 3, p.y + 4); ctx.lineTo(cx, keel); ctx.lineTo(p.x + 3, p.y + 4); ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = theme.seed; ctx.lineWidth = 1;
  ctx.globalAlpha *= 0.55;
  ctx.beginPath(); ctx.moveTo(p.x + 3, p.y + 4); ctx.lineTo(p.x + p.w - 3, p.y + 4); ctx.moveTo(cx, p.y); ctx.lineTo(cx, keel); ctx.stroke();
  ctx.globalAlpha /= 0.55;
  ctx.fillStyle = theme.seed;
  ctx.fillRect(p.x - 2, p.y, p.w + 4, 2);
  ctx.beginPath(); ctx.arc(cx, keel, 1.6, 0, Math.PI * 2); ctx.fill();
  // life bar under the keel
  ctx.globalAlpha *= 0.6;
  ctx.fillRect(p.x, keel + 4, p.w * (s.life / LIFE_F), 1.5);
  ctx.restore();
}

export const OBJECT_LOOKS = { body };
export const PROJECTILE_LOOKS = { seed };
