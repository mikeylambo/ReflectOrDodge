// Presentation-only looks that replace a type's own render() in the game
// view. They live here, not in src/objects/ or src/projectiles/, because those
// files key the solver cache (test/solve-cache.mjs): a drawing change there
// would make CI re-solve every room. render.js calls LOOKS[kind] first.
import { ROOM, SEED, CHARGE, TIMESTEP } from '../../config/tunables.js';

const T = ROOM.TILE;
const LIFE_F = Math.round(SEED.LIFE * TIMESTEP.HZ);

// Examiner body — the Orrery (option B, docs/ART.md: Examiner). A dark
// housing marks the solid block; inside, three gimbal rings precess around
// the eye, back halves dim and front halves bright so they read in depth. One
// node per core rides the outer ring, gold while that core holds and dark
// once it breaks; the rings turn faster as the Examiner loses. The eye
// follows you. view: { look, collapse, time, cores: { n, broken } }
const TAU = Math.PI * 2;
function body(ctx, s, theme, view = {}) {
  const x = s.tx * T, y = s.ty * T, w = s.w * T, h = s.h * T;
  const cx = x + w / 2, cy = y + h / 2;
  const t = view.time || 0;
  const cores = view.cores || { n: 0, broken: 0 };
  const hurt = cores.n ? cores.broken / cores.n : 0;
  const fade = view.collapse ? Math.max(0, 1 - view.collapse) : 1;
  const E = theme.examiner;
  const spin = t * (0.5 + hurt * 1.4);
  let lx = 0, ly = 0;
  if (view.look) {
    const dx = view.look[0] - cx, dy = view.look[1] - cy, d = Math.hypot(dx, dy) || 1;
    lx = dx / d; ly = dy / d;
  }
  ctx.save();
  ctx.globalAlpha = fade;
  // diagram axis with end nodes
  ctx.strokeStyle = E; ctx.fillStyle = E; ctx.lineWidth = 1;
  ctx.globalAlpha = fade * 0.3; ctx.setLineDash([2, 4]);
  ctx.beginPath(); ctx.moveTo(cx, y - 34); ctx.lineTo(cx, y - 6); ctx.moveTo(cx, y + h + 6); ctx.lineTo(cx, y + h + 34); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = fade * 0.6;
  for (const ny of [y - 34, y + h + 34]) { ctx.beginPath(); ctx.arc(cx, ny, 2, 0, TAU); ctx.fill(); }
  // housing: the solid block
  ctx.globalAlpha = fade;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 18);
  const fill = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.55);
  fill.addColorStop(0, '#2a1434'); fill.addColorStop(1, '#130b19');
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = E; ctx.globalAlpha = fade * 0.5; ctx.lineWidth = 1.2; ctx.setLineDash([4, 5]); ctx.stroke(); ctx.setLineDash([]);
  ctx.globalAlpha = fade;
  // rings: [rx, ry, base tilt, width, precession speed]
  // A tilted ring is narrowed so it reaches at most 10 px above and below the
  // housing: the rings never cross the cores or suggest a bigger solid.
  const L = h / 2 + 10;
  const rings = [[w * 0.48, h * 0.22, 0, 3, 0.6], [w * 0.36, h * 0.3, 0.5, 2.5, -0.8], [w * 0.26, h * 0.36, -0.9, 2, 1.1]].map(([rx0, ry0, rot0, lw, sp], i) => {
    const ry = ry0 * (0.75 + 0.25 * Math.sin(spin * sp + i)), rot = rot0 + Math.sin(spin * sp * 0.5 + i * 2) * 0.12;
    const sn = Math.abs(Math.sin(rot)), cs = Math.cos(rot);
    const rx = sn > 0.01 ? Math.min(rx0, Math.sqrt(Math.max(0, L * L - ry * ry * cs * cs)) / sn) : rx0;
    return { rx, ry, rot, lw };
  });
  const half = (r, front) => {
    ctx.lineWidth = r.lw;
    ctx.strokeStyle = front ? E : 'rgba(255,143,216,0.3)';
    ctx.shadowColor = E; ctx.shadowBlur = front ? 8 + hurt * 6 : 0;
    ctx.beginPath(); ctx.ellipse(cx, cy, r.rx, r.ry, r.rot, front ? 0 : Math.PI, front ? Math.PI : TAU); ctx.stroke();
    ctx.shadowBlur = 0;
  };
  for (const r of rings) half(r, false);
  // the eye
  const er = Math.min(w, h) * 0.13;
  const ex = cx + lx * er * 0.5, ey = cy + ly * er * 0.5;
  const halo = ctx.createRadialGradient(ex, ey, 0, ex, ey, er * 2.6);
  halo.addColorStop(0, E); halo.addColorStop(0.4, 'rgba(255,143,216,0.35)'); halo.addColorStop(1, 'rgba(255,143,216,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(ex, ey, er * 2.6, 0, TAU); ctx.fill();
  ctx.shadowColor = E; ctx.shadowBlur = 16 + hurt * 10;
  ctx.fillStyle = '#ffd9f1'; ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff'; ctx.globalAlpha = fade * 0.85;
  ctx.beginPath(); ctx.arc(ex - er * 0.3, ey - er * 0.35, er * 0.22, 0, TAU); ctx.fill();
  ctx.globalAlpha = fade;
  for (const r of rings) half(r, true);
  // nodes on the outer ring: one per core, gold while it holds
  const o = rings[0];
  for (let k = 0; k < cores.n; k++) {
    const a = spin * 0.7 + (k * TAU) / cores.n;
    const px = cx + Math.cos(a) * o.rx * Math.cos(o.rot) - Math.sin(a) * o.ry * Math.sin(o.rot);
    const py = cy + Math.cos(a) * o.rx * Math.sin(o.rot) + Math.sin(a) * o.ry * Math.cos(o.rot);
    const lit = k >= cores.broken;
    ctx.globalAlpha = fade * (lit ? (Math.sin(a) > 0 ? 1 : 0.55) : 0.4);
    ctx.fillStyle = lit ? theme.examinerCore : theme.examinerDim;
    ctx.shadowColor = theme.examinerCore; ctx.shadowBlur = lit ? 8 : 0;
    ctx.beginPath(); ctx.arc(px, py, lit ? 4 : 3, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ── objects (approved in the objects mockup) ──
const A = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const DIR_ROT = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

// Emitter: a housing with a barrel on its firing side. Eight segments fill
// around the core as the shot charges (the telegraph, readable at a glance);
// limited emitters show shots left as pips (filled) and spent (hollow).
function emitter(ctx, s, theme) {
  const x = s.tx * T, y = s.ty * T, cx = x + T / 2, cy = y + T / 2;
  const live = s.on && !(s.count && s.fired >= s.count);
  const R = s.on ? theme.emitter : theme.emitterOff;
  const charge = live ? s.charge : 0;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(DIR_ROT[s.dir] || 0);
  ctx.fillStyle = '#2a1720'; ctx.fillRect(6, -5, 9, 10);
  ctx.strokeStyle = R; ctx.lineWidth = 1.5; ctx.strokeRect(6, -5, 9, 10);
  ctx.shadowColor = R; ctx.shadowBlur = live ? 4 + charge * 12 : 0;
  ctx.beginPath(); ctx.ellipse(15, 0, 1.8, 6, 0, 0, TAU); ctx.stroke();
  ctx.shadowBlur = 0;
  const hh = 12, c = 4.5;
  ctx.beginPath();
  ctx.moveTo(-hh + c, -hh); ctx.lineTo(hh - c, -hh); ctx.lineTo(hh, -hh + c); ctx.lineTo(hh, hh - c);
  ctx.lineTo(hh - c, hh); ctx.lineTo(-hh + c, hh); ctx.lineTo(-hh, hh - c); ctx.lineTo(-hh, -hh + c); ctx.closePath();
  const gr = ctx.createLinearGradient(0, -hh, 0, hh); gr.addColorStop(0, '#2b1820'); gr.addColorStop(1, '#160c11');
  ctx.fillStyle = gr; ctx.fill();
  ctx.strokeStyle = R; ctx.lineWidth = 2; ctx.shadowColor = R; ctx.shadowBlur = live ? 5 : 0; ctx.stroke(); ctx.shadowBlur = 0;
  ctx.fillStyle = R; for (const sy of [-1, 1]) ctx.fillRect(-hh - 2.5, sy * 6 - 1.5, 2.5, 3);
  for (let i = 0; i < 8; i++) {
    ctx.strokeStyle = i < Math.round(charge * 8) ? R : A(R, 0.25); ctx.lineWidth = 2;
    const a0 = -Math.PI / 2 + (i * Math.PI) / 4 + 0.08;
    ctx.beginPath(); ctx.arc(0, 0, 7.5, a0, a0 + Math.PI / 4 - 0.16); ctx.stroke();
  }
  const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 6);
  cg.addColorStop(0, live ? '#ffd0c8' : '#55505a'); cg.addColorStop(1, A(R, live ? 0.2 + charge * 0.6 : 0));
  ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, 3.5 + charge * 2, 0, TAU); ctx.fill();
  ctx.restore();
  if (s.count) {
    const left = s.count - s.fired;
    ctx.save();
    for (let k = 0; k < s.count; k++) {
      const px = cx - ((s.count - 1) * 5) / 2 + k * 5;
      ctx.beginPath(); ctx.arc(px, y + T + 2, 1.6, 0, TAU);
      if (k < left) { ctx.fillStyle = theme.emitter; ctx.fill(); } else { ctx.strokeStyle = theme.emitterOff; ctx.lineWidth = 1; ctx.stroke(); }
    }
    ctx.restore();
  }
}

// Switch: a faceted crystal in a bracketed socket; it lights when fired.
// Toggle switches keep their ring ("this one flips back").
function switchLook(ctx, s, theme) {
  const G = theme.switch, cx = (s.tx + 0.5) * T, cy = (s.ty + 0.5) * T;
  const lit = s.hits > 0 && (s.mode === 'once' || s.hits % 2 === 1);
  ctx.save();
  ctx.strokeStyle = G; ctx.lineWidth = 1.5;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ctx.beginPath(); ctx.moveTo(cx + sx * 12, cy + sy * 6); ctx.lineTo(cx + sx * 12, cy + sy * 12); ctx.lineTo(cx + sx * 6, cy + sy * 12); ctx.stroke();
  }
  if (s.mode === 'toggle') { ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(cx, cy, 15, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  const r = 8.5;
  const faces = [[[0, -r], [r, 0], 0.55], [[r, 0], [0, r], 0.3], [[0, r], [-r, 0], 0.45], [[-r, 0], [0, -r], 0.8]];
  if (lit) { ctx.shadowColor = G; ctx.shadowBlur = 14; }
  for (const [a, b, k] of faces) {
    ctx.fillStyle = lit ? A(G, 0.5 + k * 0.5) : A(G, k * 0.35);
    ctx.beginPath(); ctx.moveTo(cx + a[0], cy + a[1]); ctx.lineTo(cx + b[0], cy + b[1]); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath(); ctx.stroke();
  ctx.restore();
}

// Orb: a halo, a glowing body, a bright highlight and a thin outer ring.
// theme.orb is already the reflected colour when it's been reflected.
function orb(ctx, s, alpha, theme) {
  const x = s.px + (s.x - s.px) * alpha, y = s.py + (s.y - s.py) * alpha;
  const c = theme.flash ? '#ffffff' : theme.orb, r = s.r;
  ctx.save();
  const h = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
  h.addColorStop(0, A(theme.orb, 0.45)); h.addColorStop(1, A(theme.orb, 0));
  ctx.fillStyle = h; ctx.beginPath(); ctx.arc(x, y, r * 2, 0, TAU); ctx.fill();
  ctx.shadowColor = theme.orbGlow; ctx.shadowBlur = 10;
  ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = theme.orbCore; ctx.beginPath(); ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.42, 0, TAU); ctx.fill();
  ctx.strokeStyle = A(theme.orb, 0.6); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, TAU); ctx.stroke();
  ctx.restore();
}

// Splitter: a faceted arrowhead along its travel, with the line it splits on.
function splitter(ctx, s, alpha, theme) {
  const x = s.px + (s.x - s.px) * alpha, y = s.py + (s.y - s.py) * alpha;
  const sp = Math.hypot(s.vx, s.vy) || 1, ux = s.vx / sp, uy = s.vy / sp, r = s.r + 2;
  const P = (f, g2) => [x + ux * r * f - uy * r * g2, y + uy * r * f + ux * r * g2];
  const tip = P(1, 0), mid = P(-0.25, 0), l = P(-0.65, -0.85), rr = P(-0.65, 0.85);
  ctx.save();
  ctx.shadowColor = theme.splitter; ctx.shadowBlur = 10;
  ctx.fillStyle = theme.flash ? '#ffffff' : '#ffe49a';
  ctx.beginPath(); ctx.moveTo(...tip); ctx.lineTo(...l); ctx.lineTo(...mid); ctx.closePath(); ctx.fill();
  ctx.fillStyle = theme.flash ? '#ffffff' : '#e0a92e';
  ctx.beginPath(); ctx.moveTo(...tip); ctx.lineTo(...mid); ctx.lineTo(...rr); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#1b1406'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(...P(0.75, 0)); ctx.lineTo(...mid); ctx.stroke();
  ctx.restore();
}

// Charge: a ring with three energy arcs turning around it; pink and heavier
// once lethal. One tick per speed tier gained (information, not decoration).
function charge(ctx, s, alpha, theme, own, mod) {
  const x = s.px + (s.x - s.px) * alpha, y = s.py + (s.y - s.py) * alpha;
  const hot = mod.lethal(s), c = theme.flash ? '#ffffff' : hot ? theme.chargeHot : theme.charge;
  ctx.save();
  ctx.shadowColor = c; ctx.shadowBlur = hot ? 16 : 6;
  ctx.strokeStyle = c; ctx.lineWidth = hot ? 3.5 : 2.5;
  ctx.beginPath(); ctx.arc(x, y, s.r, 0, TAU); ctx.stroke();
  ctx.shadowBlur = 0; ctx.lineWidth = 1.2;
  const rot = s.age * (hot ? 0.18 : 0.08);
  for (let i = 0; i < 3; i++) { const a = rot + i * 2.1; ctx.beginPath(); ctx.arc(x, y, s.r + 4, a, a + 0.7); ctx.stroke(); }
  ctx.fillStyle = hot ? '#ffd0ea' : A(theme.charge, 0.5);
  ctx.beginPath(); ctx.arc(x, y, s.r * 0.35, 0, TAU); ctx.fill();
  ctx.fillStyle = c;
  for (let i = 0; i < s.bounces; i++) {
    const a = -Math.PI / 2 + (i * TAU) / CHARGE.MAX_BOUNCES;
    ctx.fillRect(x + Math.cos(a) * (s.r + 8) - 1.5, y + Math.sin(a) * (s.r + 8) - 1.5, 3, 3);
  }
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

export const OBJECT_LOOKS = { body, emitter, switch: switchLook };
export const PROJECTILE_LOOKS = { seed, orb, splitter, charge };
