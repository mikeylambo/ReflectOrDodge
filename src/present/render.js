// Draws one frame from sim state + presentation fx. Reads, never writes, sim state.
import { ROOM, PLAYER, REFLECT, PROJECTILE, FEEL } from '../../config/tunables.js';
import { THEME } from './theme.js';
import { PROJECTILES } from '../projectiles/index.js';
import { OBJECTS } from '../objects/index.js';
import { isSolid } from '../sim/room.js';
import { circleRect } from '../sim/geom.js';

const T = ROOM.TILE;
const lerp = (a, b, t) => a + (b - a) * t;

let tileCache = null; // { room, canvas }

function drawTiles(ctx, room) {
  if (!tileCache || tileCache.room !== room || tileCache.solid !== room.solid) {
    const c = document.createElement('canvas');
    c.width = ROOM.W; c.height = ROOM.H;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, ROOM.H);
    grad.addColorStop(0, THEME.bg1); grad.addColorStop(1, THEME.bg0);
    g.fillStyle = grad; g.fillRect(0, 0, ROOM.W, ROOM.H);
    g.strokeStyle = THEME.grid; g.lineWidth = 1;
    for (let x = 0; x <= ROOM.COLS; x++) { g.beginPath(); g.moveTo(x * T + 0.5, 0); g.lineTo(x * T + 0.5, ROOM.H); g.stroke(); }
    for (let y = 0; y <= ROOM.ROWS; y++) { g.beginPath(); g.moveTo(0, y * T + 0.5); g.lineTo(ROOM.W, y * T + 0.5); g.stroke(); }
    for (let ty = 0; ty < ROOM.ROWS; ty++) for (let tx = 0; tx < ROOM.COLS; tx++) {
      if (!isSolid(room, tx, ty)) continue;
      const x = tx * T, y = ty * T;
      g.fillStyle = THEME.tile; g.fillRect(x, y, T, T);
      g.fillStyle = THEME.tileEdge;
      // outline only the faces that border open space — reads as a diagram
      const open = (dx, dy) => { const nx = tx + dx, ny = ty + dy; return nx >= 0 && ny >= 0 && nx < ROOM.COLS && ny < ROOM.ROWS && !isSolid(room, nx, ny); };
      if (open(0, -1)) g.fillRect(x, y, T, 2);
      if (open(0, 1)) g.fillRect(x, y + T - 2, T, 2);
      if (open(-1, 0)) g.fillRect(x, y, 2, T);
      if (open(1, 0)) g.fillRect(x + T - 2, y, 2, T);
    }
    tileCache = { room, solid: room.solid, canvas: c };
  }
  ctx.drawImage(tileCache.canvas, 0, 0);
}
export const invalidateTiles = () => { tileCache = null; };

function drawExit(ctx, room, t) {
  const [ex, ey] = room.exit;
  const x = ex * T, y = ey * T;
  ctx.save();
  ctx.strokeStyle = THEME.exit;
  ctx.shadowColor = THEME.exit;
  ctx.shadowBlur = 10 + 6 * Math.sin(t * 3);
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 5, y + 2, T - 10, T - 2);
  ctx.globalAlpha = 0.18 + 0.08 * Math.sin(t * 3);
  ctx.fillStyle = THEME.exit;
  ctx.fillRect(x + 5, y + 2, T - 10, T - 2);
  ctx.restore();
}

// March a projectile's path forward until it would hit something.
function ghostEnd(state, room, s) {
  const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy) || 1;
  const ux = s.vx / sp, uy = s.vy / sp;
  let d = 0;
  for (; d < PROJECTILE.GHOST_LEN; d += 4) {
    const x = s.x + ux * d, y = s.y + uy * d;
    if (isSolid(room, Math.floor(x / T), Math.floor(y / T))) break;
    let blocked = false;
    for (const o of state.objects) {
      const r = OBJECTS[o.kind].hitRect(o);
      if (r && circleRect(x, y, 1, r)) { blocked = true; break; }
    }
    if (blocked) break;
  }
  return [s.x + ux * d, s.y + uy * d];
}

const DIR_ANGLE = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

export function render(ctx, { state, room, alpha, fx, time, hud = true, editorOverlay = null }) {
  ctx.save();
  if (fx && fx.shake > 0) ctx.translate((Math.sin(time * 90) * FEEL.SHAKE_PX), (Math.cos(time * 70) * FEEL.SHAKE_PX));
  drawTiles(ctx, room);
  drawExit(ctx, room, time);

  for (const o of state.objects) OBJECTS[o.kind].render(ctx, o, THEME);

  // ghost lines
  ctx.save();
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = 1.5;
  for (const s of state.projectiles) {
    const [gx, gy] = ghostEnd(state, room, s);
    ctx.strokeStyle = s.reflected ? THEME.ghostReflected : THEME.ghost;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(gx, gy); ctx.stroke();
  }
  ctx.restore();

  for (const s of state.projectiles) {
    const theme = { ...THEME, flash: fx && fx.flashIds.has(s.id), orb: s.reflected ? THEME.orbReflected : THEME.orb, orbGlow: s.reflected ? THEME.orbReflected : THEME.orbGlow };
    PROJECTILES[s.type].render(ctx, s, alpha, theme);
  }

  // player
  const p = state.player;
  const px = lerp(p.px, p.x, alpha), py = lerp(p.py, p.y, alpha);
  const cx = px + PLAYER.W / 2, cy = py + PLAYER.H / 2;
  if (fx) for (const a of fx.afterimages) {
    ctx.globalAlpha = (a.t / FEEL.AFTERIMAGE) * 0.35;
    ctx.fillStyle = THEME.playerGlow;
    ctx.fillRect(a.x, a.y, PLAYER.W, PLAYER.H);
    ctx.globalAlpha = 1;
  }
  if (state.reflect.window > 0) {
    ctx.fillStyle = THEME.zone;
    ctx.beginPath(); ctx.arc(cx, cy, REFLECT.RADIUS, 0, Math.PI * 2); ctx.fill();
  }
  if (state.status !== 'dead') {
    const sq = fx ? fx.squash : 0;
    const w = PLAYER.W * (1 + sq), h = PLAYER.H * (1 - sq);
    ctx.save();
    ctx.shadowColor = THEME.playerGlow;
    ctx.shadowBlur = 16;
    ctx.fillStyle = THEME.player;
    ctx.fillRect(cx - w / 2, py + PLAYER.H - h, w, h);
    ctx.shadowBlur = 0;
    ctx.fillStyle = THEME.bg0;
    ctx.fillRect(cx + p.facing * 3 - 1.5, py + PLAYER.H - h + 5, 3, 4); // eye shows facing
    ctx.restore();
  }

  // reflect arcs on the held side (neutral = full ring)
  if (fx) for (const a of fx.arcs) {
    const k = a.t / (FEEL.ARC_TIME * (a.strong ? 1.6 : 1));
    ctx.save();
    ctx.strokeStyle = THEME.arc;
    ctx.shadowColor = THEME.arc;
    ctx.shadowBlur = a.strong ? 18 : 8;
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
    ctx.strokeStyle = THEME[r.color] || THEME.arc;
    ctx.globalAlpha = 1 - k;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(r.x, r.y, 6 + 26 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  if (fx && fx.clearGlow > 0) {
    const [ex, ey] = room.exit;
    const k = 1 - fx.clearGlow / 0.6;
    ctx.save();
    ctx.strokeStyle = THEME.exit;
    ctx.globalAlpha = 1 - k;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc((ex + 0.5) * T, (ey + 0.5) * T, 20 + k * 700, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  if (fx && fx.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(fx.flash / FEEL.DEATH_FLASH) * 0.12})`;
    ctx.fillRect(0, 0, ROOM.W, ROOM.H);
  }

  if (hud) {
    ctx.save();
    ctx.font = '600 14px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = THEME.hudDim;
    ctx.fillText(room.name.toUpperCase(), 12, 9);
    const underPar = state.stats.reflects <= room.par;
    ctx.fillStyle = underPar ? THEME.hud : THEME.emitter;
    ctx.textAlign = 'right';
    ctx.fillText(`◇ ${state.stats.reflects} / ${room.par}`, ROOM.W - 12, 9);
    ctx.restore();
  }
  if (editorOverlay) editorOverlay(ctx);
}
