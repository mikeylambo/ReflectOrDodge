// Breakable wall — a vertical block `h` tiles tall. Blocks the player and
// projectiles. Light walls break to any Orb hit; heavy walls only to an
// Anchor (Chapter 2). Destroyed permanently for the attempt (GDD: Targets).
// Silhouette: light = cracked panel, heavy = riveted slab.
import { ROOM } from '../../config/tunables.js';

const T = ROOM.TILE;
export const kind = 'wall';

// which projectile types can break which weight
const BREAKS = { light: ['orb', 'anchor'], heavy: ['anchor'] };

export function create(def) {
  return { kind, id: def.id || null, tx: def.at[0], ty: def.at[1], h: def.h || 1, heavy: !!def.heavy, broken: false };
}

export const step = (s) => ({ state: s, events: [], spawns: [] });

export function onProjectileHit(s, p) {
  if (s.broken || !BREAKS[s.heavy ? 'heavy' : 'light'].includes(p.type)) return { state: s, events: [] };
  return {
    state: { ...s, broken: true },
    events: [{ type: 'wall.break', heavy: s.heavy, x: (s.tx + 0.5) * T, y: (s.ty + s.h / 2) * T, w: T, h: s.h * T }],
  };
}

export const hitRect = (s) => (s.broken ? null : { x: s.tx * T, y: s.ty * T, w: T, h: s.h * T });
export const solids = (s) => (s.broken ? [] : [hitRect(s)]);

export function render(ctx, s, theme) {
  if (s.broken) return;
  const x = s.tx * T, y = s.ty * T, H = s.h * T;
  ctx.save();
  ctx.fillStyle = s.heavy ? theme.wallHeavy : theme.wall;
  ctx.fillRect(x + 1, y + 1, T - 2, H - 2);
  ctx.strokeStyle = theme.wallEdge;
  ctx.lineWidth = s.heavy ? 3 : 1.5;
  ctx.strokeRect(x + 2, y + 2, T - 4, H - 4);
  if (s.heavy) {
    ctx.fillStyle = theme.wallEdge;
    for (let k = 0; k < s.h; k++) for (const [dx, dy] of [[7, 7], [T - 7, 7], [7, T - 7], [T - 7, T - 7]]) {
      ctx.beginPath(); ctx.arc(x + dx, y + k * T + dy, 2, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    // crack zig-zag per tile
    ctx.beginPath();
    for (let k = 0; k < s.h; k++) {
      const yy = y + k * T;
      ctx.moveTo(x + 9, yy + 5); ctx.lineTo(x + 15, yy + 13); ctx.lineTo(x + 12, yy + 19); ctx.lineTo(x + 21, yy + 27);
    }
    ctx.stroke();
  }
  ctx.restore();
}
