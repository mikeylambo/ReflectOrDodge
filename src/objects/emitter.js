// Emitter — fires a fixed projectile type in a fixed direction on its own
// clock. Shot k (k ≥ 1) leaves at t = phase + k·period, so every shot, the
// first included, gets the full charge-up telegraph. A REFLECTED projectile
// hitting it shuts it off for the rest of the attempt ("return to sender").
import { EMITTER, ROOM, frames } from '../../config/tunables.js';
import { DIRS } from '../sim/input.js';

const T = ROOM.TILE;
export const kind = 'emitter';

export function create(def) {
  return {
    kind,
    id: def.id || null,
    ptype: def.type,
    tx: def.at[0],
    ty: def.at[1],
    dir: def.dir,
    periodF: frames(def.period),
    phaseF: frames(def.phase || 0),
    count: def.count || 0, // 0 = unlimited
    fired: 0,
    on: true,
    charge: 0, // 0..1 telegraph progress, for rendering and audio
  };
}

// frames until the next shot at sim frame f (shots at phase + k·period, k ≥ 1).
// Exported for the audio layer, which schedules shots ahead for calibration.
export function untilNext(s, f) {
  const c = f - s.phaseF;
  if (c < s.periodF) return s.periodF - c;
  const into = c % s.periodF;
  return into === 0 ? 0 : s.periodF - into;
}

export function step(s, world) {
  if (!s.on || (s.count && s.fired >= s.count)) return { state: s.charge ? { ...s, charge: 0 } : s, events: [], spawns: [] };
  const tele = frames(EMITTER.TELEGRAPH);
  const left = untilNext(s, world.frame);
  const events = [];
  const spawns = [];
  let { fired } = s;
  let charge = left <= tele ? 1 - left / tele : 0;
  if (left === tele) events.push({ type: 'emitter.telegraph', x: (s.tx + 0.5) * T, y: (s.ty + 0.5) * T });
  if (left === 0) {
    const [dx, dy] = DIRS[s.dir];
    const off = T / 2 + 7; // spawn just outside the emitter tile
    spawns.push({ type: s.ptype, x: (s.tx + 0.5) * T + dx * off, y: (s.ty + 0.5) * T + dy * off, dir: s.dir });
    events.push({ type: 'emitter.fire', ptype: s.ptype, x: (s.tx + 0.5) * T, y: (s.ty + 0.5) * T });
    fired++;
    charge = 0;
  }
  return { state: { ...s, fired, charge }, events, spawns };
}

export function onProjectileHit(s, p) {
  if (!p.reflected || !s.on) return { state: s, events: [] };
  return { state: { ...s, on: false, charge: 0 }, events: [{ type: 'emitter.off', x: (s.tx + 0.5) * T, y: (s.ty + 0.5) * T }] };
}

export const hitRect = (s) => ({ x: s.tx * T, y: s.ty * T, w: T, h: T });
export const solids = (s) => [hitRect(s)];

export function render(ctx, s, theme) {
  const x = s.tx * T, y = s.ty * T, cx = x + T / 2, cy = y + T / 2;
  const [dx, dy] = DIRS[s.dir];
  ctx.save();
  ctx.fillStyle = theme.emitterBody;
  ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
  ctx.strokeStyle = s.on ? theme.emitter : theme.emitterOff;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 3, y + 3, T - 6, T - 6);
  // muzzle on the firing side
  ctx.fillStyle = s.on ? theme.emitter : theme.emitterOff;
  const mw = dx ? 5 : 14, mh = dy ? 5 : 14;
  ctx.fillRect(cx + dx * (T / 2 - 3) - mw / 2, cy + dy * (T / 2 - 3) - mh / 2, mw, mh);
  if (s.on && s.charge > 0) {
    ctx.shadowColor = theme.emitter;
    ctx.shadowBlur = 18 * s.charge;
    ctx.globalAlpha = 0.25 + 0.75 * s.charge;
    ctx.fillStyle = theme.emitter;
    ctx.beginPath();
    ctx.arc(cx, cy, 3 + 7 * s.charge, 0, Math.PI * 2);
    ctx.fill();
  }
  // limited emitters show their remaining shots as pips (GDD: no hidden information)
  if (s.count) {
    const left = s.count - s.fired;
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    for (let k = 0; k < s.count; k++) {
      const px = x + 7 + k * ((T - 14) / Math.max(1, s.count - 1)) * (s.count > 1 ? 1 : 0) + (s.count === 1 ? (T - 14) / 2 : 0);
      ctx.beginPath();
      ctx.arc(px, y + T - 6, 2.2, 0, Math.PI * 2);
      if (k < left) { ctx.fillStyle = theme.emitter; ctx.fill(); } else { ctx.strokeStyle = theme.emitterOff; ctx.lineWidth = 1; ctx.stroke(); }
    }
  }
  if (!s.on) {
    ctx.strokeStyle = theme.emitterOff;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 8); ctx.lineTo(x + T - 8, y + T - 8);
    ctx.moveTo(x + T - 8, y + 8); ctx.lineTo(x + 8, y + T - 8);
    ctx.stroke();
  }
  ctx.restore();
}
