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
import { heroPose, drawHero } from './hero.js';
import { f } from './brand.js';
import { scenery, drawLayer, DEPTH, vine, rgba } from './scenery.js';
import { OBJECT_LOOKS, PROJECTILE_LOOKS } from './looks.js';

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

// per-tile deterministic noise for stage dressing (0..1)
const tn = (tx, ty, k) => { const h = Math.sin(tx * 127.1 + ty * 311.7 + k * 74.7) * 43758.5453; return h - Math.floor(h); };
const tileRng = (tx, ty) => { let i = 0; return () => tn(tx, ty, i++); };

function drawTiles(ctx, room, theme, camera) {
  if (!tileCache || tileCache.room !== room || tileCache.solid !== room.solid || tileCache.theme !== theme) {
    const back = document.createElement('canvas');
    back.width = ROOM.W; back.height = ROOM.H;
    let g = back.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, ROOM.H);
    grad.addColorStop(0, theme.bg1); grad.addColorStop(1, theme.bg0);
    g.fillStyle = grad; g.fillRect(0, 0, ROOM.W, ROOM.H);
    // depth: a soft chapter-tinted haze in the upper middle of the room
    if (theme.haze) {
      const hz = g.createRadialGradient(ROOM.W * 0.5, ROOM.H * 0.35, 0, ROOM.W * 0.5, ROOM.H * 0.35, ROOM.W * 0.65);
      hz.addColorStop(0, theme.haze); hz.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = hz; g.fillRect(0, 0, ROOM.W, ROOM.H);
    }
    drawMotif(g, theme);
    g.strokeStyle = theme.grid; g.lineWidth = 1;
    for (let x = 0; x <= ROOM.COLS; x++) { g.beginPath(); g.moveTo(x * T + 0.5, 0); g.lineTo(x * T + 0.5, ROOM.H); g.stroke(); }
    for (let y = 0; y <= ROOM.ROWS; y++) { g.beginPath(); g.moveTo(0, y * T + 0.5); g.lineTo(ROOM.W, y * T + 0.5); g.stroke(); }
    // the tiles go on their own layer, so stage scenery can sit between
    const c = document.createElement('canvas');
    c.width = ROOM.W; c.height = ROOM.H;
    g = c.getContext('2d');
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
      const open = (dx, dy) => { const nx = tx + dx, ny = ty + dy; return nx >= 0 && ny >= 0 && nx < ROOM.COLS && ny < ROOM.ROWS && !isSolid(room, nx, ny) && !isSpike(room, nx, ny); };
      // material: a faint diagonal hatch, so mass reads as mass, not as a hole
      if (theme.stage) {
        // stage blocks (title-card look): a soft top-lit body and panel seams
        const sh = g.createLinearGradient(0, y, 0, y + T);
        sh.addColorStop(0, open(0, -1) ? rgba(theme.accent, 0.07) : 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = sh; g.fillRect(x, y, T, T);
        g.fillStyle = rgba(theme.accent, 0.1);
        if (tx % 3 === 0 && !open(-1, 0)) g.fillRect(x, y, 1, T);
        if (ty % 2 === 0 && !open(0, -1)) g.fillRect(x, y, T, 1);
        // an inset line parallel to each exposed face: the block's top/side face, as on the cards
        g.fillStyle = rgba(theme.accent, 0.16);
        if (open(0, -1)) g.fillRect(x, y + 7, T, 1);
        if (open(-1, 0)) g.fillRect(x + 7, y, 1, T);
        if (open(1, 0)) g.fillRect(x + T - 8, y, 1, T);
      } else if (theme.hatch) {
        g.save(); g.beginPath(); g.rect(x, y, T, T); g.clip();
        g.strokeStyle = theme.hatch; g.lineWidth = 1;
        for (let k = -T; k < T; k += 8) { g.beginPath(); g.moveTo(x + k, y + T); g.lineTo(x + k + T, y); g.stroke(); }
        g.restore();
      }
      // inner shade on exposed faces gives each block a bevel
      if (theme.tileShade) {
        g.fillStyle = theme.tileShade;
        if (open(0, 1)) g.fillRect(x, y + T - 6, T, 6);
        if (open(-1, 0)) g.fillRect(x, y, 4, T);
        if (open(1, 0)) g.fillRect(x + T - 4, y, 4, T);
      }
      g.fillStyle = theme.tileEdge;
      if (open(0, 1)) g.fillRect(x, y + T - 2, T, 2);
      if (open(-1, 0)) g.fillRect(x, y, 2, T);
      if (open(1, 0)) g.fillRect(x + T - 2, y, 2, T);
      // walkable tops are lit: a bright rim and a short glow above it
      if (open(0, -1)) {
        if (theme.floorGlow) {
          const fg = g.createLinearGradient(0, y - 10, 0, y);
          fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, theme.floorGlow);
          g.fillStyle = fg; g.fillRect(x, y - 10, T, 10);
        }
        g.fillStyle = theme.tileTop || theme.tileEdge; g.fillRect(x, y, T, 2);
      }
    }
    // Ground (Chapter 3): moss on lit tops, vines draping down faces and
    // hanging from ceilings, climbing walls from the floor. Moss rises at most
    // 2 px above a top, so the walkable line never looks moved.
    if (theme.stage === 'ground') {
      const sol = (tx, ty) => tx >= 0 && ty >= 0 && tx < ROOM.COLS && ty < ROOM.ROWS && isSolid(room, tx, ty);
      const air = (tx, ty) => tx >= 0 && ty >= 0 && tx < ROOM.COLS && ty < ROOM.ROWS && !isSolid(room, tx, ty) && !isSpike(room, tx, ty);
      for (let ty = 0; ty < ROOM.ROWS; ty++) for (let tx = 0; tx < ROOM.COLS; tx++) {
        if (!sol(tx, ty)) continue;
        const x = tx * T, y = ty * T, r = tileRng(tx, ty);
        if (air(tx, ty - 1)) {
          g.save(); g.shadowColor = theme.accent; g.shadowBlur = 5;
          g.fillStyle = rgba(theme.accent, 0.7);
          for (let k = 0; k < 5; k++) if (r() < 0.7) { g.beginPath(); g.ellipse(x + 3 + r() * (T - 6), y + 1, 2 + r() * 3.5, 1 + r() * 1.2, 0, Math.PI, 0); g.fill(); }
          // moss creeping over the front edge
          g.fillStyle = rgba(theme.accent, 0.3);
          for (let k = 0; k < 3; k++) if (r() < 0.6) { g.beginPath(); g.ellipse(x + 3 + r() * (T - 6), y + 3, 2 + r() * 4, 1.5 + r() * 2.5, 0, 0, Math.PI); g.fill(); }
          g.restore();
          if (r() < 0.45) vine(g, x + 4 + r() * (T - 8), y + 2, 8 + r() * 22, 1, theme.accent, 0.55, r);
        }
        if (air(tx, ty + 1) && ty > 0 && r() < 0.15) vine(g, x + 4 + r() * (T - 8), y + T, 10 + r() * 24, 1, theme.accent, 0.4, r);
        for (const s of [-1, 1]) {
          if (air(tx + s, ty) && sol(tx + s, ty + 1) && r() < 0.35) vine(g, s < 0 ? x + 2 : x + T - 2, y + T, 12 + r() * 30, -1, theme.accent, 0.45, r);
        }
      }
    }
    // Echo (Chapter 4): every walkable surface is a dark mirror. The room
    // above (back, scenery, tiles) is flipped into the solid below each top,
    // faint and fading with depth. The hero's own reflection is drawn live.
    if (theme.stage === 'echo') {
      const sc = scenery(room, theme);
      const comp = document.createElement('canvas');
      comp.width = ROOM.W; comp.height = ROOM.H;
      const k = comp.getContext('2d');
      k.drawImage(back, 0, 0);
      if (sc) { drawLayer(k, sc.far, DEPTH.far, null); drawLayer(k, sc.mid, DEPTH.mid, null); }
      k.drawImage(c, 0, 0);
      const top = (tx, ty) => isSolid(room, tx, ty) && ty > 0 && !isSolid(room, tx, ty - 1) && !isSpike(room, tx, ty - 1);
      for (let ty = 1; ty < ROOM.ROWS; ty++) for (let tx = 0; tx < ROOM.COLS; tx++) {
        if (!top(tx, ty)) continue;
        let d = 1;
        while (d < 3 && ty + d < ROOM.ROWS && isSolid(room, tx, ty + d)) d++;
        const y = ty * T, depth = d * T;
        g.save();
        g.beginPath(); g.rect(tx * T, y + 2, T, depth - 2); g.clip();
        g.globalAlpha = 0.3;
        g.translate(0, 2 * y); g.scale(1, -1);
        g.drawImage(comp, 0, 0);
        g.restore();
        const fade = g.createLinearGradient(0, y, 0, y + depth);
        fade.addColorStop(0, 'rgba(18,22,34,0)'); fade.addColorStop(1, 'rgba(18,22,34,1)');
        g.fillStyle = fade; g.fillRect(tx * T, y + 2, T, depth - 2);
      }
    }
    // hazards cast a low rose light
    if (theme.lights) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let ty = 0; ty < ROOM.ROWS; ty++) for (let tx = 0; tx < ROOM.COLS; tx++) {
        if (!isSpike(room, tx, ty)) continue;
        const cx = (tx + 0.5) * T, cy = (ty + 0.8) * T;
        const rg = g.createRadialGradient(cx, cy, 0, cx, cy, 34);
        rg.addColorStop(0, theme.spikeLight); rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg; g.fillRect(cx - 34, cy - 34, 68, 68);
      }
      g.restore();
    }
    tileCache = { room, solid: room.solid, theme, back, canvas: c };
  }
  ctx.drawImage(tileCache.back, 0, 0);
  const sc = scenery(room, theme);
  if (sc) { drawLayer(ctx, sc.far, DEPTH.far, camera); drawLayer(ctx, sc.mid, DEPTH.mid, camera); }
  ctx.drawImage(tileCache.canvas, 0, 0);
}
export const invalidateTiles = () => { tileCache = null; };

// Camera (presentation only): { x, y, z } = room-space centre and zoom. The
// world draws through it; the HUD and screen effects don't.
export function applyCamera(ctx, cam) {
  // snap the scroll to whole device pixels, so thin lines don't shimmer as it moves
  const s = ctx.getTransform().a * cam.z;
  ctx.translate(ROOM.W / 2, ROOM.H / 2);
  ctx.scale(cam.z, cam.z);
  ctx.translate(-Math.round(cam.x * s) / s, -Math.round(cam.y * s) / s);
}
// room point → screen point under a camera
export const toScreen = (cam, x, y) => (cam ? [(x - cam.x) * cam.z + ROOM.W / 2, (y - cam.y) * cam.z + ROOM.H / 2] : [x, y]);

// the reflect diamond: an outline with a filled core (the game's one symbol)
export function drawDiamond(ctx, x, y, r, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.stroke();
  const c = r * 0.45;
  ctx.beginPath(); ctx.moveTo(x, y - c); ctx.lineTo(x + c, y); ctx.lineTo(x, y + c); ctx.lineTo(x - c, y); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ── light (presentation only) ──
// Additive light pools under every luminous actor: the player, projectiles,
// charging emitters, the exit. Pure decoration over the diagram; off in high
// contrast, halved under reduced flashing.
function pool(ctx, x, y, r, color, a) {
  if (a <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = a;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function drawLights(ctx, state, room, alpha, time, theme, k) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const p = state.player;
  if (state.status !== 'dead') pool(ctx, lerp(p.px, p.x, alpha) + PLAYER.W / 2, lerp(p.py, p.y, alpha) + PLAYER.H / 2, 110, theme.playerGlow, 0.13 * k);
  for (const s of state.projectiles) {
    const col = s.reflected ? theme.orbReflected : theme[s.type] || theme.orb;
    pool(ctx, s.x, s.y, s.stuck ? 30 : 56, col, (s.stuck ? 0.1 : 0.22) * k);
  }
  for (const o of state.objects) {
    if (o.kind === 'switch' && o.hits > 0 && (o.mode === 'once' || o.hits % 2 === 1)) pool(ctx, (o.tx + 0.5) * T, (o.ty + 0.5) * T, 60, theme.switch, 0.16 * k);
    if (o.kind === 'door' && o.slide < 1) pool(ctx, (o.tx + 0.5) * T, (o.ty + (o.h * (1 - o.slide)) / 2) * T, 24 + 14 * o.h, theme.door, 0.08 * k);
    if (o.kind === 'emitter' && o.on && o.charge > 0) pool(ctx, (o.tx + 0.5) * T, (o.ty + 0.5) * T, 40 + 40 * o.charge, theme.emitter, 0.25 * o.charge * k);
  }
  if (room.exit) pool(ctx, (room.exit[0] + 0.5) * T, (room.exit[1] + 0.5) * T, 80, theme.exit, (0.08 + 0.03 * Math.sin(time * 3)) * k);
  ctx.restore();
}

// Dust motes: slow, faint, rising — the room breathes. Deterministic in time.
const MOTES = 46;
function drawMotes(ctx, time, theme) {
  ctx.save();
  ctx.fillStyle = theme.mote;
  for (let i = 0; i < MOTES; i++) {
    const h1 = Math.sin(i * 127.1) * 43758.5453, h2 = Math.sin(i * 311.7) * 24634.6345;
    const fx = h1 - Math.floor(h1), fy = h2 - Math.floor(h2);
    const sp = 6 + fx * 10;
    const x = (fx * ROOM.W + Math.sin(time * 0.3 + i) * 14 + ROOM.W) % ROOM.W;
    const y = ROOM.H - ((fy * ROOM.H + time * sp) % ROOM.H);
    ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(time * 0.8 + i * 1.7));
    ctx.fillRect(x, y, fx > 0.8 ? 2 : 1.2, fx > 0.8 ? 2 : 1.2);
  }
  ctx.restore();
}

let vignette = null;
function drawVignette(ctx) {
  if (!vignette) {
    const c = document.createElement('canvas');
    c.width = ROOM.W; c.height = ROOM.H;
    const g = c.getContext('2d');
    const v = g.createRadialGradient(ROOM.W / 2, ROOM.H / 2, ROOM.H * 0.45, ROOM.W / 2, ROOM.H / 2, ROOM.W * 0.62);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.42)');
    g.fillStyle = v; g.fillRect(0, 0, ROOM.W, ROOM.H);
    vignette = c;
  }
  ctx.drawImage(vignette, 0, 0);
}

function drawExit(ctx, room, t, theme) {
  if (!room.exit) return; // Examiner phases have no exit
  const [ex, ey] = room.exit;
  const x = ex * T, y = ey * T;
  ctx.save();
  // a doorway of light: a bright floor, a column fading upward, rising sparks
  const g = ctx.createLinearGradient(0, y + T, 0, y + 2);
  g.addColorStop(0, theme.exit); g.addColorStop(1, 'rgba(245,247,255,0)');
  ctx.globalAlpha = 0.28 + 0.08 * Math.sin(t * 3);
  ctx.fillStyle = g;
  ctx.fillRect(x + 5, y + 2, T - 10, T - 2);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = theme.exit;
  for (let k = 0; k < 4; k++) {
    const ph = (t * 0.7 + k / 4) % 1;
    ctx.globalAlpha = 0.8 * (1 - ph);
    ctx.fillRect(x + 8 + ((k * 7) % (T - 18)), y + T - 4 - ph * (T - 6), 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = theme.exit;
  ctx.shadowColor = theme.exit;
  ctx.shadowBlur = 10 + 6 * Math.sin(t * 3);
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 5, y + 2, T - 10, T - 2);
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

// The hero (src/present/hero.js), drawn inside the 14×22 collision box.
function drawPlayer(ctx, p, alpha, theme, fx, ghost) {
  const px = lerp(p.px, p.x, alpha), py = lerp(p.py, p.y, alpha);
  const moving = Math.abs(p.x - p.px) > 0.05;
  const stride = moving && p.grounded ? Math.sin(px * 0.22) : 0;
  const reflect = fx && !ghost && fx.reflectPose ? fx.reflectPose : null;
  const pose = heroPose(p, moving, stride, reflect);
  const f = pose.dir === 'left' ? -1 : pose.dir === 'right' ? 1 : p.facing;
  drawHero(ctx, px, py, f, pose, theme, { sq: fx && !ghost ? fx.squash : 0, ghost });
  // Echo's mirror floor: the hero's reflection, upside down below the surface
  if (theme.stage === 'echo' && !ghost && p.grounded) {
    const fy = py + PLAYER.H;
    ctx.save();
    ctx.beginPath(); ctx.rect(px - 10, fy + 2, PLAYER.W + 20, 30); ctx.clip();
    ctx.globalAlpha = 0.28;
    ctx.translate(0, 2 * fy); ctx.scale(1, -1);
    drawHero(ctx, px, py, f, pose, theme, { ghost: false });
    ctx.restore();
  }
  return [px + PLAYER.W / 2, py + PLAYER.H / 2];
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

// Examiner tethers: each core hangs from the body on a short strut and a line
// (docs/art-ref/examiner-ch1.jpg), so you can see what the cores belong to.
// A broken core's tether goes dim and dashed.
function drawTethers(ctx, state, theme, collapse) {
  const bodies = state.objects.filter((o) => o.kind === 'body');
  if (!bodies.length) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - collapse);
  for (const c of state.objects) {
    if (c.kind !== 'core') continue;
    const cx = (c.tx + 0.5) * T, cy = (c.ty + 0.5) * T;
    // nearest body, and the nearest point on its edge
    let best = null;
    for (const b of bodies) {
      const x0 = b.tx * T, y0 = b.ty * T, x1 = x0 + b.w * T, y1 = y0 + b.h * T;
      const px = Math.max(x0, Math.min(x1, cx)), py = Math.max(y0, Math.min(y1, cy));
      const d = Math.hypot(cx - px, cy - py);
      if (!best || d < best.d) best = { px, py, d };
    }
    if (!best || best.d > 8 * T) continue;
    const ux = (cx - best.px) / (best.d || 1), uy = (cy - best.py) / (best.d || 1);
    const end = c.broken ? 8 : 12;
    ctx.strokeStyle = c.broken ? theme.examinerDim : theme.examiner;
    ctx.globalAlpha = Math.max(0, 1 - collapse) * (c.broken ? 0.5 : 0.75);
    if (c.broken) ctx.setLineDash([2, 3]);
    ctx.lineWidth = 1.2;
    // a pair of thin rails, then a dashed ring around the core
    for (const o of [-2, 2]) {
      ctx.beginPath();
      ctx.moveTo(best.px - uy * o, best.py + ux * o);
      ctx.lineTo(cx - ux * end - uy * o, cy - uy * end + ux * o);
      ctx.stroke();
    }
    if (!c.broken) {
      ctx.fillStyle = theme.examinerBody;
      ctx.strokeStyle = theme.examiner;
      ctx.beginPath(); ctx.rect(best.px - 5 - Math.abs(uy) * 2, best.py - 5 - Math.abs(ux) * 2, 10 + Math.abs(uy) * 4, 10 + Math.abs(ux) * 4); ctx.fill(); ctx.stroke();
      ctx.globalAlpha *= 0.45;
      ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  ctx.restore();
}

export function render(ctx, {
  state, room, alpha, fx, time, hud = { par: null, hint: false }, editorOverlay = null,
  theme = THEME, shake = true, flashes = true, preview = null, ghost = null, camera = null,
}) {
  ctx.save();
  if (fx && shake && fx.shake > 0) ctx.translate(Math.sin(time * 90) * FEEL.SHAKE_PX, Math.cos(time * 70) * FEEL.SHAKE_PX);
  if (camera) applyCamera(ctx, camera);
  drawTiles(ctx, room, theme, camera);
  if (theme.mote) drawMotes(ctx, time, theme);
  if (theme.lights) drawLights(ctx, state, room, alpha, time, theme, flashes ? 1 : 0.5);
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

  drawTethers(ctx, state, theme, fx && fx.collapse ? fx.collapse.k : 0);
  const coreObjs = state.objects.filter((o) => o.kind === 'core');
  const objView = {
    look: [state.player.x + PLAYER.W / 2, state.player.y + PLAYER.H / 2], collapse: fx && fx.collapse ? fx.collapse.k : 0,
    time, cores: { n: coreObjs.length, broken: coreObjs.filter((o) => o.broken).length },
  };
  for (const o of state.objects) (OBJECT_LOOKS[o.kind] || OBJECTS[o.kind].render)(ctx, o, theme, objView);

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
    const len = Math.min(44, sp * 0.2);
    const g = ctx.createLinearGradient(s.x, s.y, s.x - (s.vx / sp) * len, s.y - (s.vy / sp) * len);
    const col = s.reflected ? theme.orbReflected : theme[s.type] || theme.orb;
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.strokeStyle = g;
    ctx.globalAlpha = 0.6;
    ctx.globalCompositeOperation = theme.lights ? 'lighter' : 'source-over';
    ctx.lineWidth = s.r * 1.6;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - (s.vx / sp) * len, s.y - (s.vy / sp) * len); ctx.stroke();
  }
  ctx.restore();

  for (const s of state.projectiles) {
    const th = { ...theme, flash: flashes && fx && fx.flashIds.has(s.id), orb: s.reflected ? theme.orbReflected : theme.orb, orbGlow: s.reflected ? theme.orbReflected : theme.orbGlow };
    const own = PROJECTILES[s.type].render, look = PROJECTILE_LOOKS[s.type];
    if (look) look(ctx, s, alpha, th, own); else own(ctx, s, alpha, th);
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
  // jump afterimage: a fading ghost of the hero where the jump began
  if (fx) for (const a of fx.afterimages) {
    ctx.save();
    ctx.globalAlpha = (a.t / FEEL.AFTERIMAGE) * 0.3;
    drawHero(ctx, a.x, a.y, a.f || 1, heroPose({ grounded: true, vy: 0 }, false, 0, null), theme, { ghost: true });
    ctx.restore();
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
  if (theme.lights) drawVignette(ctx);

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
    ctx.font = f('display', 600, 15);
    ctx.textBaseline = 'top';
    ctx.fillStyle = theme.hudDim;
    ctx.fillText(room.name.toUpperCase(), 12, 9);
    ctx.font = f('mono', 800, 18);
    if (hud.par !== null && hud.par !== undefined) {
      const col = state.stats.reflects <= hud.par ? theme.hud : theme.emitter;
      ctx.fillStyle = col;
      ctx.textAlign = 'right';
      const txt = `${state.stats.reflects} / ${hud.par}`;
      ctx.fillText(txt, ROOM.W - 12, 8);
      drawDiamond(ctx, ROOM.W - 12 - ctx.measureText(txt).width - 12, 17, 6, col);
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
