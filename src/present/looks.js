// Presentation-only looks that replace a type's own render() in the game
// view. They live here, not in src/objects/ or src/projectiles/, because those
// files key the solver cache (test/solve-cache.mjs): a drawing change there
// would make CI re-solve every room. render.js calls LOOKS[kind] first.
import { ROOM, SEED, TIMESTEP } from '../../config/tunables.js';

const T = ROOM.TILE;
const LIFE_F = Math.round(SEED.LIFE * TIMESTEP.HZ);

// Examiner body (docs/art-ref/examiner-ch1.jpg). Built, not outlined: a
// thick chamfered shell with an inset rim, bolts, a top tab and a bottom
// connector, side vents; a deep glow inside; an iris of tilted rings, a
// rotating tick ring and a glowing pupil that follows you. One rim light per
// core goes dark as each core breaks, and the iris turns faster as it loses.
// view: { look, collapse, time, cores: { n, broken } }
const RAD = Math.PI / 180;
function octagon(ctx, x, y, w, h, c) {
  ctx.beginPath();
  ctx.moveTo(x + c, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c); ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h); ctx.lineTo(x + c, y + h); ctx.lineTo(x, y + h - c); ctx.lineTo(x, y + c); ctx.closePath();
}
function body(ctx, s, theme, view = {}) {
  const x = s.tx * T, y = s.ty * T, w = s.w * T, h = s.h * T;
  const c = Math.min(w, h) * 0.28; // chamfer
  const cx = x + w / 2, cy = y + h / 2;
  const t = view.time || 0;
  const cores = view.cores || { n: 0, broken: 0 };
  const hurt = cores.n ? cores.broken / cores.n : 0;
  const fade = view.collapse ? Math.max(0, 1 - view.collapse) : 1;
  const E = theme.examiner;
  ctx.save();
  ctx.globalAlpha = fade;
  // where you are, from its centre
  let lx = 0, ly = 0;
  if (view.look) {
    const dx = view.look[0] - cx, dy = view.look[1] - cy, d = Math.hypot(dx, dy) || 1;
    lx = dx / d; ly = dy / d;
  }
  // diagram marks: an axis through it with end nodes, a faint dashed outline
  ctx.save();
  ctx.strokeStyle = E; ctx.fillStyle = E; ctx.lineWidth = 1;
  ctx.globalAlpha = fade * 0.3; ctx.setLineDash([2, 4]);
  ctx.beginPath(); ctx.moveTo(cx, y - 30); ctx.lineTo(cx, y - 8); ctx.moveTo(cx, y + h + 8); ctx.lineTo(cx, y + h + 30); ctx.stroke();
  ctx.globalAlpha = fade * 0.13;
  ctx.beginPath(); ctx.ellipse(cx, cy, w / 2 + 24, h / 2 + 24, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = fade * 0.6;
  for (const ny of [y - 30, y + h + 30]) { ctx.beginPath(); ctx.arc(cx, ny, 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  // top tab and bottom connector plates
  ctx.fillStyle = theme.examinerBody; ctx.strokeStyle = E; ctx.lineWidth = 1.5;
  for (const [py, dir] of [[y, -1], [y + h, 1]]) {
    const pw = Math.min(64, w * 0.22);
    ctx.beginPath();
    ctx.moveTo(cx - pw / 2, py); ctx.lineTo(cx - pw / 2 + 6, py + dir * 8); ctx.lineTo(cx + pw / 2 - 6, py + dir * 8); ctx.lineTo(cx + pw / 2, py);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // shell: deep glow inside, a breathing outer rim
  octagon(ctx, x, y, w, h, c);
  const fill = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.6);
  fill.addColorStop(0, '#2b1436'); fill.addColorStop(0.6, '#1a0f22'); fill.addColorStop(1, '#110a17');
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = E; ctx.lineWidth = 2.5;
  ctx.shadowColor = E; ctx.shadowBlur = 12 + 5 * Math.sin(t * 1.6) + hurt * 8;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // inset rim, bolts at the inner corners
  const k = 7, ck = c * 0.82;
  octagon(ctx, x + k, y + k, w - 2 * k, h - 2 * k, ck);
  ctx.globalAlpha = fade * 0.5; ctx.lineWidth = 1; ctx.stroke();
  ctx.globalAlpha = fade * 0.8; ctx.fillStyle = E;
  for (const [bx, by] of [[x + k + ck, y + k], [x + w - k - ck, y + k], [x + k + ck, y + h - k], [x + w - k - ck, y + h - k]]) { ctx.beginPath(); ctx.arc(bx, by + (by < cy ? 4 : -4), 1.6, 0, Math.PI * 2); ctx.fill(); }
  // side vents
  ctx.globalAlpha = fade * 0.55; ctx.lineWidth = 1.5; ctx.strokeStyle = E;
  for (const sx of [x + 3, x + w - 3]) for (let i = -1; i <= 1; i++) {
    ctx.beginPath(); ctx.moveTo(sx + (sx < cx ? 3 : -3), cy + i * 8); ctx.lineTo(sx + (sx < cx ? 11 : -11), cy + i * 8); ctx.stroke();
  }
  // rim lights along the top: one per core, dark once that core is broken
  if (cores.n) {
    const gap = 14, x0 = cx - ((cores.n - 1) * gap) / 2;
    for (let i = 0; i < cores.n; i++) {
      const lit = i >= cores.broken;
      ctx.globalAlpha = fade * (lit ? 0.95 : 0.35);
      ctx.fillStyle = lit ? theme.examinerCore : theme.examinerDim;
      ctx.shadowColor = theme.examinerCore; ctx.shadowBlur = lit ? 6 : 0;
      ctx.beginPath(); ctx.arc(x0 + i * gap, y + k + 7, 2.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = fade;
  // the iris, clipped to the inner plate
  ctx.save();
  octagon(ctx, x + k, y + k, w - 2 * k, h - 2 * k, ck); ctx.clip();
  const spin = t * (0.25 + hurt * 0.9);
  ctx.strokeStyle = E; ctx.lineWidth = 1.4;
  for (let i = 1; i <= 3; i++) {
    ctx.globalAlpha = fade * (0.42 - i * 0.08);
    const sx = (w / 2) * (0.2 + 0.24 * i), sy = (h / 2) * (0.16 + 0.15 * i);
    ctx.beginPath(); ctx.ellipse(cx + lx * i * 3, cy + ly * i * 2, sx, sy, lx * 0.32 + Math.sin(spin + i) * 0.05, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  const er = Math.min(w, h) * 0.16;
  // tick ring around the eye, turning
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(spin);
  ctx.strokeStyle = E; ctx.globalAlpha = fade * 0.55; ctx.lineWidth = 1;
  for (let i = 0; i < 36; i++) {
    const a = i * 10 * RAD, r0 = er * 1.35, r1 = er * (i % 3 ? 1.48 : 1.62);
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke();
  }
  ctx.rotate(-2 * spin);
  ctx.setLineDash([6, 8]); ctx.globalAlpha = fade * 0.35;
  ctx.beginPath(); ctx.arc(0, 0, er * 1.85, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  // the eye: ring, halo, pupil, a highlight
  const ex = lx * er * 0.45, ey = ly * er * 0.45;
  ctx.strokeStyle = E; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, er, 0, Math.PI * 2); ctx.stroke();
  const pr = er * (0.42 + hurt * 0.1);
  const halo = ctx.createRadialGradient(cx + ex, cy + ey, 0, cx + ex, cy + ey, pr * 2.6);
  halo.addColorStop(0, E); halo.addColorStop(0.4, 'rgba(255,143,216,0.35)'); halo.addColorStop(1, 'rgba(255,143,216,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(cx + ex, cy + ey, pr * 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = E; ctx.shadowBlur = 14;
  ctx.fillStyle = '#ffd9f1';
  ctx.beginPath(); ctx.arc(cx + ex, cy + ey, pr, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff'; ctx.globalAlpha = fade * 0.85;
  ctx.beginPath(); ctx.arc(cx + ex - pr * 0.35, cy + ey - pr * 0.35, pr * 0.22, 0, Math.PI * 2); ctx.fill();
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
