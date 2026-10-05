// Draws one frame from sim state + presentation fx. Reads, never writes, sim state.
//
// view options (all presentation-only; none can change room logic):
//   theme       THEME or HIGH_CONTRAST
//   shake       false disables screen shake
//   flashes     false = reduced flashing (no white flashes, softer glows)
//   preview     { mask } while Reflect is held → outgoing path per direction
//   ghost       a second sim state drawn translucent (hint ghost / solution)
//   hud         { par: number|null, hint: bool } or false
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

function drawTiles(ctx, room, theme) {
  if (!tileCache || tileCache.room !== room || tileCache.solid !== room.solid || tileCache.theme !== theme) {
    const c = document.createElement('canvas');
    c.width = ROOM.W; c.height = ROOM.H;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, ROOM.H);
    grad.addColorStop(0, theme.bg1); grad.addColorStop(1, theme.bg0);
    g.fillStyle = grad; g.fillRect(0, 0, ROOM.W, ROOM.H);
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

function drawPlayer(ctx, p, alpha, theme, fx, ghost) {
  const px = lerp(p.px, p.x, alpha), py = lerp(p.py, p.y, alpha);
  const cx = px + PLAYER.W / 2;
  const sq = fx && !ghost ? fx.squash : 0;
  const w = PLAYER.W * (1 + sq), h = PLAYER.H * (1 - sq);
  ctx.save();
  if (ghost) {
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = theme.playerGlow;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - w / 2, py + PLAYER.H - h, w, h);
  } else {
    ctx.shadowColor = theme.playerGlow;
    ctx.shadowBlur = 16;
    ctx.fillStyle = theme.player;
    ctx.fillRect(cx - w / 2, py + PLAYER.H - h, w, h);
    ctx.shadowBlur = 0;
    ctx.fillStyle = theme.bg0;
    ctx.fillRect(cx + p.facing * 3 - 1.5, py + PLAYER.H - h + 5, 3, 4); // eye shows facing
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

  for (const o of state.objects) OBJECTS[o.kind].render(ctx, o, theme);

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

  if (fx && fx.clearGlow > 0) {
    const [ex, ey] = room.exit;
    const k = 1 - fx.clearGlow / 0.6;
    ctx.save();
    ctx.strokeStyle = theme.exit;
    ctx.globalAlpha = 1 - k;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc((ex + 0.5) * T, (ey + 0.5) * T, 20 + k * 700, 0, Math.PI * 2); ctx.stroke();
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
