// Draws one frame from sim state + presentation fx. Reads, never writes, sim state.
//
// view options (all presentation-only; none can change room logic):
//   theme       THEME or HIGH_CONTRAST
//   shake       false disables screen shake
//   flashes     false = reduced flashing (no white flashes, softer glows)
//   preview     { mask } while Reflect is held → outgoing path per direction
//   ghost       a second sim state drawn translucent (hint ghost / solution)
//   hud         { par: number|null, hint: bool, phase, timer: {room, run}|null } or false
import { ROOM, PLAYER, REFLECT, PROJECTILE, FEEL } from '../../config/tunables.js';
import { THEME } from './theme.js';
import { PROJECTILES } from '../projectiles/index.js';
import { OBJECTS } from '../objects/index.js';
import { isSolid, isSpike } from '../sim/room.js';
import { circleRect } from '../sim/geom.js';

const T = ROOM.TILE;
const lerp = (a, b, t) => a + (b - a) * t;
const DIR_ANGLE = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

let tileCache = null;

// Background motif per chapter: faint, static, behind everything (GDD: Art
// direction — "nothing decorative competing with gameplay readability").
function drawMotif(g, theme) {
  if (!theme.motif || theme.motif === 'none') return;
  g.save();
  g.strokeStyle = theme.motifInk;
  g.lineWidth = 2;
  if (theme.motif === 'rings') {
    for (let r = 60; r < 900; r += 70) { g.beginPath(); g.arc(ROOM.W * 0.72, ROOM.H * 0.38, r, 0, Math.PI * 2); g.stroke(); }
  } else if (theme.motif === 'strata') {
    for (let y = 40; y < ROOM.H; y += 46) { g.lineWidth = 2 + ((y / 46) % 3) * 2; g.beginPath(); g.moveTo(0, y); g.lineTo(ROOM.W, y + 18); g.stroke(); }
  } else if (theme.motif === 'tendrils') {
    for (let k = 0; k < 9; k++) {
      g.beginPath();
      let x = 60 + k * 110, y = ROOM.H;
      g.moveTo(x, y);
      for (let i = 0; i < 6; i++) { x += ((k + i) % 2 ? 22 : -18); y -= 70; g.quadraticCurveTo(x + 30, y + 35, x, y); }
      g.stroke();
    }
  }
  g.restore();
}

function drawTiles(ctx, room, theme) {
  if (!tileCache || tileCache.room !== room || tileCache.solid !== room.solid || tileCache.theme !== theme) {
    const c = document.createElement('canvas');
    c.width = ROOM.W; c.height = ROOM.H;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, ROOM.H);
    grad.addColorStop(0, theme.bg1); grad.addColorStop(1, theme.bg0);
    g.fillStyle = grad; g.fillRect(0, 0, ROOM.W, ROOM.H);
    drawMotif(g, theme);
    g.strokeStyle = theme.grid; g.lineWidth = 1;
    for (let x = 0; x <= ROOM.COLS; x++) { g.beginPath(); g.moveTo(x * T + 0.5, 0); g.lineTo(x * T + 0.5, ROOM.H); g.stroke(); }
    for (let y = 0; y <= ROOM.ROWS; y++) { g.beginPath(); g.moveTo(0, y * T + 0.5); g.lineTo(ROOM.W, y * T + 0.5); g.stroke(); }
    for (let ty = 0; ty < ROOM.ROWS; ty++) for (let tx = 0; tx < ROOM.COLS; tx++) {
      const x = tx * T, y = ty * T;
      if (isSpike(room, tx, ty)) {
        // three teeth on a base plate — reads as "hazard" by silhouette alone
        g.fillStyle = theme.spikeBase; g.fillRect(x + 2, y + T - 5, T - 4, 5);
        g.fillStyle = theme.spike;
        for (let k = 0; k < 3; k++) {
          const bx = x + 3 + k * ((T - 6) / 3), w = (T - 6) / 3;
          g.beginPath(); g.moveTo(bx, y + T - 4); g.lineTo(bx + w / 2, y + 12); g.lineTo(bx + w, y + T - 4); g.closePath(); g.fill();
        }
        continue;
      }
      if (!isSolid(room, tx, ty)) continue;
      g.fillStyle = theme.tile; g.fillRect(x, y, T, T);
      g.fillStyle = theme.tileEdge;
      const open = (dx, dy) => { const nx = tx + dx, ny = ty + dy; return nx >= 0 && ny >= 0 && nx < ROOM.COLS && ny < ROOM.ROWS && !isSolid(room, nx, ny); };
      if (open(0, -1)) g.fillRect(x, y, T, 2);
      if (open(0, 1)) g.fillRect(x, y + T - 2, T, 2);
      if (open(-1, 0)) g.fillRect(x, y, 2, T);
      if (open(1, 0)) g.fillRect(x + T - 2, y, 2, T);
    }
    tileCache = { room, solid: room.solid, theme, canvas: c };
  }
  ctx.drawImage(tileCache.canvas, 0, 0);
}
export const invalidateTiles = () => { tileCache = null; };

function drawExit(ctx, room, t, theme) {
  if (!room.exit) return; // Examiner phases have no exit
  const [ex, ey] = room.exit;
  const x = ex * T, y = ey * T;
  ctx.save();
  ctx.strokeStyle = theme.exit;
  ctx.shadowColor = theme.exit;
  ctx.shadowBlur = 10 + 6 * Math.sin(t * 3);
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 5, y + 2, T - 10, T - 2);
  ctx.globalAlpha = 0.18 + 0.08 * Math.sin(t * 3);
  ctx.fillStyle = theme.exit;
  ctx.fillRect(x + 5, y + 2, T - 10, T - 2);
  ctx.restore();
}

// March a path from (x,y) along (vx,vy) until it would hit something.
export function pathEnd(state, room, x, y, vx, vy, maxLen = PROJECTILE.GHOST_LEN) {
  const sp = Math.sqrt(vx * vx + vy * vy) || 1;
  const ux = vx / sp, uy = vy / sp;
  let d = 0;
  for (; d < maxLen; d += 4) {
    const px = x + ux * d, py = y + uy * d;
    if (isSolid(room, Math.floor(px / T), Math.floor(py / T))) break;
    let blocked = false;
    for (const o of state.objects) {
      const r = OBJECTS[o.kind].hitRect(o);
      if (r && circleRect(px, py, 1, r)) { blocked = true; break; }
    }
    if (blocked) break;
  }
  return [x + ux * d, y + uy * d];
}

function drawShape(ctx, shape, x, y, s) {
  ctx.beginPath();
  if (shape === 'circle') ctx.arc(x, y, s, 0, Math.PI * 2);
  else if (shape === 'ring') { ctx.arc(x, y, s, 0, Math.PI * 2); ctx.stroke(); return; }
  else if (shape === 'square') ctx.rect(x - s, y - s, s * 2, s * 2);
  else if (shape === 'diamond') { ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); }
  else { ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s); ctx.lineTo(x - s, y + s); ctx.closePath(); }
  ctx.fill();
}

// The player: the kid from docs/art/character-turnaround.jpg, drawn as
// vector shapes inside the 14×22 collision box. At this size the read is a
// beanie on a cream body, so detail is limited to what survives: hat and cuff,
// hair, face, one lens, sweatshirt, legs, shoes. Pure presentation; collision
// stays the box.
//
// Poses (docs/ART.md): idle, run, jump, fall, land (squash), and reflect ×5
// while the latest reflect arc lives: an open palm toward left/right/up/down,
// and for neutral the glasses push with a lens glint (the pose sheet's idea).
// Drawn in local space: origin at the feet, +x = the way the player faces.
const SH = -10; // shoulder height
const HIP = -5.5;
function playerPose(p, fx) {
  const arc = fx && fx.arcs.length ? fx.arcs[fx.arcs.length - 1] : null;
  if (arc) return { kind: 'reflect', dir: arc.dir, k: arc.t / (FEEL.ARC_TIME * (arc.strong ? 1.6 : 1)) };
  if (!p.grounded) return { kind: p.vy < 0 ? 'jump' : 'fall' };
  return { kind: Math.abs(p.x - p.px) > 0.05 ? 'run' : 'idle' };
}
function limbs(pose, p, f, s) {
  // → { front, back } hands and { a, b } feet, local coords
  const L = { front: [3.4, -6.2], back: [-3.2, -6.2], a: [-2, 0], b: [2, 0] };
  if (pose.kind === 'run') {
    L.front = [1 + 4 * s, -6.8]; L.back = [-1 - 4 * s, -6.8];
    L.a = [-1.5 + 3.5 * s, -Math.max(0, -s) * 1.4]; L.b = [1.5 - 3.5 * s, -Math.max(0, s) * 1.4];
  } else if (pose.kind === 'jump') {
    L.front = [4, -14.5]; L.back = [-4, -14.5]; L.a = [-2, -2.5]; L.b = [2.2, -1.5];
  } else if (pose.kind === 'fall') {
    L.front = [6.5, -11]; L.back = [-6.5, -11]; L.a = [-3, -0.5]; L.b = [3, -1.5];
  } else if (pose.kind === 'reflect') {
    const d = pose.dir;
    if (d === 'left' || d === 'right') {
      const side = (d === 'right' ? 1 : -1) * f; // +1 = in front
      if (side > 0) { L.front = [9.5, -10.3]; L.back = [-3.5, -7.5]; } else { L.back = [-9.5, -10.3]; L.front = [3.5, -7.5]; }
      if (p.grounded) { L.a = [-4.2, 0]; L.b = [4.2, 0]; }
    } else if (d === 'up') { L.front = [2.5, -23]; L.back = [-3.5, -7]; }
    else if (d === 'down') { L.front = [7, -2]; L.back = [-3.5, -9]; }
    else L.front = [3.6, -14.8]; // neutral: hand to the glasses
    if (!p.grounded && d !== 'left' && d !== 'right') { L.a = [-2.5, -1]; L.b = [2.5, -2]; }
  }
  return L;
}
function drawPlayer(ctx, p, alpha, theme, fx, ghost) {
  const px = lerp(p.px, p.x, alpha), py = lerp(p.py, p.y, alpha);
  const cx = px + PLAYER.W / 2;
  const sq = fx && !ghost ? fx.squash : 0;
  const f = p.facing;
  const pose = playerPose(p, ghost ? null : fx);
  const L = limbs(pose, p, f, Math.sin(px * 0.22));
  const one = ghost ? theme.ghostReflected : null; // the hint ghost is a single-tint silhouette
  const C = {
    hat: one || theme.playerHat, cuff: one || theme.playerHatCuff, hair: one || theme.playerHair,
    skin: one || theme.playerSkin, cloth: one || theme.playerCloth, shoe: one || theme.playerShoe, frame: one || theme.playerFrame,
  };
  ctx.save();
  ctx.translate(cx, py + PLAYER.H);
  ctx.scale(f * (1 + sq), 1 - sq);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (ghost) ctx.globalAlpha = 0.4; else { ctx.shadowColor = theme.playerGlow; ctx.shadowBlur = 5; }
  const rr = (x, y, w, h, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); };
  const limb = (x0, y0, [x1, y1], w, c) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  // legs and shoes
  for (const [ft, hx] of [[L.a, -1.4], [L.b, 1.4]]) {
    limb(hx, HIP, ft, 2.7, C.cloth);
    rr(ft[0] - 1.4, ft[1] - 1.5, 3.8, 1.7, 0.8, C.shoe);
  }
  // back arm, torso, front arm
  limb(-2.6, SH, L.back, 2.1, C.cloth);
  rr(-4, -11.2, 8, 6.6, 2.2, C.cloth);
  if (pose.kind === 'reflect' && pose.dir === 'neutral') {
    ctx.strokeStyle = C.cloth; ctx.lineWidth = 2.1;
    ctx.beginPath(); ctx.moveTo(2.6, SH); ctx.lineTo(6, -11.5); ctx.lineTo(L.front[0], L.front[1]); ctx.stroke();
  } else limb(2.6, SH, L.front, 2.1, C.cloth);
  // head: hair behind, face forward, then the beanie over both
  rr(-5.2, -16.8, 4.6, 4.8, 1.6, C.hair);
  rr(-2.2, -16.6, 6.8, 5.2, 1.8, C.skin);
  ctx.shadowBlur = 0;
  rr(-2.4, -17, 7, 1.3, 0.6, C.hair); // fringe under the cuff
  // one round lens on the near side, with the eye inside (a full-width frame line reads as sunglasses)
  ctx.strokeStyle = C.frame; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.arc(2.6, -14.2, 1.35, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = C.frame; ctx.fillRect(2.4, -14.5, 0.8, 0.8);
  ctx.fillStyle = C.hat;
  ctx.beginPath(); ctx.ellipse(0.2, -18.6, 5.6, 3.6, 0, Math.PI, 0); ctx.lineTo(5.8, -17.4); ctx.lineTo(-5.4, -17.4); ctx.closePath(); ctx.fill();
  rr(-6, -18.6, 12.4, 2.4, 1, C.cuff);
  if (!ghost && pose.kind === 'reflect') {
    const behind = (pose.dir === 'left' || pose.dir === 'right') && (pose.dir === 'right' ? 1 : -1) * f < 0;
    const [hx, hy] = pose.dir === 'neutral' ? [2.6, -14.2] : behind ? L.back : L.front;
    // palm spark, or the lens glint for neutral: a small four-point star
    const r = (pose.dir === 'neutral' ? 4 : 3) * (0.6 + 0.4 * pose.k);
    ctx.globalAlpha = Math.min(1, pose.k * 1.5);
    ctx.fillStyle = theme.arc; ctx.shadowColor = theme.arc; ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(hx, hy - r); ctx.lineTo(hx + r * 0.25, hy - r * 0.25); ctx.lineTo(hx + r, hy); ctx.lineTo(hx + r * 0.25, hy + r * 0.25);
    ctx.lineTo(hx, hy + r); ctx.lineTo(hx - r * 0.25, hy + r * 0.25); ctx.lineTo(hx - r, hy); ctx.lineTo(hx - r * 0.25, hy - r * 0.25);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  return [cx, py + PLAYER.H / 2];
}

function drawPreview(ctx, state, room, cx, cy, theme) {
  // GDD assist: while Reflect is held, draw where each projectile in (or about
  // to enter) the zone would go for every direction. Render-only.
  const reach = REFLECT.RADIUS + 24;
  ctx.save();
  ctx.lineWidth = 1.5;
  for (const s of state.projectiles) {
    const mod = PROJECTILES[s.type];
    if (!mod.reflectable) continue;
    const dx = s.x - cx, dy = s.y - cy;
    if (dx * dx + dy * dy > reach * reach) continue;
    for (const dir of ['up', 'down', 'left', 'right', 'neutral']) {
      for (const out of mod.onReflect(s, dir)) {
        const [ex, ey] = pathEnd(state, room, s.x, s.y, out.vx, out.vy, 600);
        ctx.strokeStyle = dir === 'neutral' ? theme.arc : theme.ghostReflected;
        ctx.globalAlpha = 0.55;
        ctx.setLineDash(dir === 'neutral' ? [2, 3] : [6, 4]);
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = theme.arc;
        ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.restore();
}

export function render(ctx, {
  state, room, alpha, fx, time, hud = { par: null, hint: false }, editorOverlay = null,
  theme = THEME, shake = true, flashes = true, preview = null, ghost = null,
}) {
  ctx.save();
  if (fx && shake && fx.shake > 0) ctx.translate(Math.sin(time * 90) * FEEL.SHAKE_PX, Math.cos(time * 70) * FEEL.SHAKE_PX);
  drawTiles(ctx, room, theme);
  drawExit(ctx, room, time, theme);

  // switch → door links: faint, but always visible from room start (GDD:
  // "Readable at a glance"). Fades once the switch has fired, if one-shot.
  ctx.save();
  ctx.setLineDash([2, 5]);
  ctx.lineWidth = 1;
  for (const sw of state.objects) {
    if (sw.kind !== 'switch') continue;
    const spent = sw.mode !== 'toggle' && sw.hits > 0;
    ctx.strokeStyle = theme.door;
    ctx.globalAlpha = spent ? 0.12 : 0.35;
    for (const id of sw.links) {
      const d = state.objects.find((o) => o.kind === 'door' && o.id === id);
      if (!d) continue;
      ctx.beginPath();
      ctx.moveTo((sw.tx + 0.5) * T, (sw.ty + 0.5) * T);
      ctx.lineTo((d.tx + 0.5) * T, (d.ty + d.h / 2) * T);
      ctx.stroke();
    }
  }
  ctx.restore();

  const objView = { look: [state.player.x + PLAYER.W / 2, state.player.y + PLAYER.H / 2], collapse: fx && fx.collapse ? fx.collapse.k : 0 };
  for (const o of state.objects) OBJECTS[o.kind].render(ctx, o, theme, objView);

  // door light trails
  if (fx) for (const tr of fx.trails) {
    const k = tr.t / tr.max;
    ctx.save();
    ctx.globalAlpha = k * 0.8;
    const g = ctx.createLinearGradient(tr.x, tr.y - 60, tr.x, tr.y + 60);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, theme.door); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(tr.x - 2 - 8 * (1 - k), tr.y - 60, 4 + 16 * (1 - k), 120);
    ctx.restore();
  }
  // target pulses
  if (fx) for (const pu of fx.pulses) {
    const k = 1 - pu.t / pu.max;
    ctx.save();
    ctx.strokeStyle = theme[pu.color];
    ctx.globalAlpha = 1 - k;
    ctx.lineWidth = 3;
    const r = 12 + 14 * k;
    ctx.strokeRect(pu.x - r, pu.y - r, r * 2, r * 2);
    ctx.restore();
  }

  // ghost lines
  ctx.save();
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = 1.5;
  for (const s of state.projectiles) {
    const [gx, gy] = pathEnd(state, room, s.x, s.y, s.vx, s.vy);
    ctx.strokeStyle = s.reflected ? theme.ghostReflected : theme.ghost;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(gx, gy); ctx.stroke();
  }
  ctx.restore();

  // short motion trails (presentation): where each projectile was a moment ago
  ctx.save();
  ctx.lineCap = 'round';
  for (const s of state.projectiles) {
    if (s.stuck) continue;
    const sp = Math.hypot(s.vx, s.vy);
    if (!sp) continue;
    const len = Math.min(26, sp * 0.12);
    const g = ctx.createLinearGradient(s.x, s.y, s.x - (s.vx / sp) * len, s.y - (s.vy / sp) * len);
    const col = s.reflected ? theme.orbReflected : theme[s.type] || theme.orb;
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.strokeStyle = g;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = s.r * 1.4;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - (s.vx / sp) * len, s.y - (s.vy / sp) * len); ctx.stroke();
  }
  ctx.restore();

  for (const s of state.projectiles) {
    const th = { ...theme, flash: flashes && fx && fx.flashIds.has(s.id), orb: s.reflected ? theme.orbReflected : theme.orb, orbGlow: s.reflected ? theme.orbReflected : theme.orbGlow };
    PROJECTILES[s.type].render(ctx, s, alpha, th);
  }

  // hint ghost / solution ghost
  if (ghost && ghost.status !== 'dead') {
    const [gx, gy] = drawPlayer(ctx, ghost.player, alpha, theme, null, true);
    if (ghost.reflect.window > 0) {
      ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = theme.arc; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(gx, gy, REFLECT.RADIUS, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    ctx.save(); ctx.globalAlpha = 0.45;
    for (const s of ghost.projectiles) if (s.reflected) PROJECTILES[s.type].render(ctx, s, alpha, { ...theme, orb: theme.orbReflected, orbGlow: theme.orbReflected });
    ctx.restore();
  }

  // player
  const p = state.player;
  if (fx) for (const a of fx.afterimages) {
    ctx.globalAlpha = (a.t / FEEL.AFTERIMAGE) * 0.35;
    ctx.fillStyle = theme.playerGlow;
    ctx.fillRect(a.x, a.y, PLAYER.W, PLAYER.H);
    ctx.globalAlpha = 1;
  }
  const cx = lerp(p.px, p.x, alpha) + PLAYER.W / 2, cy = lerp(p.py, p.y, alpha) + PLAYER.H / 2;
  if (state.reflect.window > 0) {
    ctx.fillStyle = theme.zone;
    ctx.beginPath(); ctx.arc(cx, cy, REFLECT.RADIUS, 0, Math.PI * 2); ctx.fill();
  }
  if (state.status !== 'dead') drawPlayer(ctx, p, alpha, theme, fx, false);
  if (preview) drawPreview(ctx, state, room, cx, cy, theme);

  // reflect arcs on the held side (neutral = full ring)
  if (fx) for (const a of fx.arcs) {
    const k = a.t / (FEEL.ARC_TIME * (a.strong ? 1.6 : 1));
    ctx.save();
    ctx.strokeStyle = theme.arc;
    ctx.shadowColor = theme.arc;
    ctx.shadowBlur = flashes ? (a.strong ? 18 : 8) : 0;
    ctx.globalAlpha = k * (a.strong ? 1 : 0.6);
    ctx.lineWidth = a.strong ? 4 : 2;
    ctx.beginPath();
    if (a.dir === 'neutral') ctx.arc(cx, cy, REFLECT.RADIUS, 0, Math.PI * 2);
    else { const c = DIR_ANGLE[a.dir]; ctx.arc(cx, cy, REFLECT.RADIUS, c - 0.9, c + 0.9); }
    ctx.stroke();
    ctx.restore();
  }

  if (fx) for (const r of fx.rings) {
    const k = 1 - r.t / r.max;
    ctx.save();
    ctx.strokeStyle = theme[r.color] || theme.arc;
    ctx.globalAlpha = 1 - k;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(r.x, r.y, 6 + 26 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  if (fx) for (const pt of fx.particles) {
    ctx.save();
    ctx.globalAlpha = pt.t / pt.max;
    ctx.fillStyle = ctx.strokeStyle = theme[pt.color] || theme.player;
    ctx.lineWidth = 1.5;
    drawShape(ctx, pt.shape, pt.x, pt.y, pt.size);
    ctx.restore();
  }

  if (fx && fx.clearGlow > 0 && fx.clearAt) {
    const k = 1 - fx.clearGlow / 0.6;
    ctx.save();
    ctx.strokeStyle = theme.exit;
    ctx.globalAlpha = 1 - k;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(fx.clearAt.x, fx.clearAt.y, 20 + k * 700, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // Examiner defeated: light runs along every path your reflections took
  if (fx && fx.collapse) {
    const k = fx.collapse.k;
    ctx.save();
    ctx.strokeStyle = theme.examinerCore;
    ctx.shadowColor = theme.examinerCore;
    ctx.shadowBlur = flashes ? 16 : 0;
    ctx.lineWidth = 3;
    ctx.globalAlpha = Math.min(1, k * 3) * (1 - Math.max(0, k - 0.6) / 0.4);
    for (const pth of fx.collapse.paths) {
      const len = 1200 * Math.min(1, k * 1.6);
      ctx.beginPath(); ctx.moveTo(pth.x, pth.y); ctx.lineTo(pth.x + pth.dx * len, pth.y + pth.dy * len); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();

  // reset wipe: a dark band sweeps across as the room restarts
  if (fx && fx.wipe > 0) {
    const k = 1 - fx.wipe / FEEL.DEATH_FLASH;
    ctx.fillStyle = 'rgba(7,8,13,0.55)';
    ctx.fillRect(k * ROOM.W - 120, 0, 120, ROOM.H);
  }
  if (fx && flashes && fx.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(fx.flash / FEEL.DEATH_FLASH) * 0.12})`;
    ctx.fillRect(0, 0, ROOM.W, ROOM.H);
  }

  if (hud) {
    ctx.save();
    ctx.font = '600 14px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = theme.hudDim;
    ctx.fillText(room.name.toUpperCase(), 12, 9);
    if (hud.par !== null && hud.par !== undefined) {
      ctx.fillStyle = state.stats.reflects <= hud.par ? theme.hud : theme.emitter;
      ctx.textAlign = 'right';
      ctx.fillText(`◇ ${state.stats.reflects} / ${hud.par}`, ROOM.W - 12, 9);
    }
    if (hud.phase) {
      // Examiner phase pips: filled = beaten
      for (let k = 0; k < hud.phase.n; k++) {
        const px = ROOM.W - 20 - (hud.phase.n - 1 - k) * 18, py = 16;
        ctx.beginPath();
        for (let v = 0; v < 6; v++) { const a = (v / 6) * Math.PI * 2 + Math.PI / 6; ctx[v ? 'lineTo' : 'moveTo'](px + Math.cos(a) * 6, py + Math.sin(a) * 6); }
        ctx.closePath();
        ctx.fillStyle = theme.examinerCore; ctx.strokeStyle = theme.examinerCore; ctx.lineWidth = 1.5;
        if (k < hud.phase.i) ctx.fill(); else ctx.stroke();
      }
    }
    if (hud.timer) {
      // speedrun timer (opt-in): room time, and the run's when one is going
      ctx.textAlign = 'center';
      ctx.fillStyle = theme.hud;
      ctx.fillText(hud.timer.run ? `${hud.timer.room}  ·  ${hud.timer.run}` : hud.timer.room, ROOM.W / 2, 9);
      ctx.textAlign = 'left';
    }
    if (hud.hint) {
      // hint glyph: a small eye-like lens, pulsing gently
      const hx = ROOM.W - (hud.par !== null && hud.par !== undefined ? 92 : 22), hy = 16;
      ctx.globalAlpha = 0.6 + 0.3 * Math.sin(time * 4);
      ctx.strokeStyle = theme.hud; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(hx, hy, 9, 5, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(hx, hy, 2.2, 0, Math.PI * 2); ctx.fillStyle = theme.hud; ctx.fill();
    }
    ctx.restore();
  }
  if (editorOverlay) editorOverlay(ctx);
}
