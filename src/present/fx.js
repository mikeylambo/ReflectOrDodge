// Presentation-only feedback state, fed by sim events. Nothing here is ever
// read by the simulation (GDD: Game feel — "presentation only"). Randomness is
// allowed here and only here; the death burst uses even spacing anyway, so it
// looks the same every time.
import { FEEL } from '../../config/tunables.js';

export function createFx() {
  return {
    arcs: [], rings: [], afterimages: [], particles: [], trails: [], pulses: [],
    flash: 0, wipe: 0, shake: 0, flashIds: new Map(), squash: 0, clearGlow: 0,
  };
}

// Shape each projectile type bursts into on death (GDD: "player bursts into the
// projectile's shape"). Hazards without a projectile burst as triangles.
const BURST_SHAPE = { orb: 'circle', anchor: 'square', seed: 'diamond', splitter: 'tri', charge: 'ring', twin: 'circle' };

function burst(fx, x, y, shape, color, n, speed, life, size) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 2) * 0.2;
    const sp = speed * (0.6 + 0.4 * ((i * 7) % 5) / 4);
    fx.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, t: life, max: life, shape, color, size });
  }
}

export function fxEvents(fx, events, state) {
  for (const e of events) {
    switch (e.type) {
      case 'reflect.open': fx.arcs.push({ dir: e.dir, t: FEEL.ARC_TIME, strong: false }); break;
      case 'projectile.reflect':
        fx.arcs.push({ dir: e.dir, t: FEEL.ARC_TIME * 1.6, strong: true });
        fx.flashIds.set(e.id, 0.1);
        fx.rings.push({ x: e.x, y: e.y, t: 0.25, max: 0.25, color: 'arc' });
        break;
      case 'switch.hit':
        fx.pulses.push({ x: e.x, y: e.y, t: 0.35, max: 0.35, color: 'switch' });
        burst(fx, e.x, e.y, 'square', 'switch', 8, 90, 0.35, 3);
        fx.rings.push({ x: e.x, y: e.y, t: 0.4, max: 0.4, color: 'switch' });
        break;
      case 'emitter.off':
        fx.pulses.push({ x: e.x, y: e.y, t: 0.5, max: 0.5, color: 'emitter' });
        fx.rings.push({ x: e.x, y: e.y, t: 0.5, max: 0.5, color: 'emitter' });
        break;
      case 'wall.break':
        for (let k = 0; k < Math.max(1, Math.round(e.h / 32)); k++) burst(fx, e.x, e.y - e.h / 2 + 16 + k * 32, 'square', 'wallEdge', 7, 120, 0.5, 4);
        break;
      case 'door.open':
      case 'door.close':
        fx.trails.push({ x: e.x, y: e.y, t: 0.35, max: 0.35, open: e.type === 'door.open' });
        break;
      case 'projectile.destroy': fx.rings.push({ x: e.x, y: e.y, t: 0.15, max: 0.15, color: 'orb' }); break;
      case 'player.jump':
        fx.afterimages.push({ x: state.player.x, y: state.player.y, t: FEEL.AFTERIMAGE });
        fx.squash = -0.25;
        break;
      case 'player.land': fx.squash = 0.2; break;
      case 'player.death':
        burst(fx, e.x, e.y, e.ptype ? BURST_SHAPE[e.ptype] || 'circle' : 'tri', 'player', 14, 170, 0.45, 4);
        fx.flash = FEEL.DEATH_FLASH;
        fx.wipe = FEEL.DEATH_FLASH;
        fx.shake = FEEL.SHAKE_TIME;
        break;
      case 'room.clear': fx.clearGlow = 0.6; fx.clearAt = { x: e.x, y: e.y }; break;
      case 'examiner.core':
        fx.pulses.push({ x: e.x, y: e.y, t: 0.6, max: 0.6, color: 'examinerCore' });
        burst(fx, e.x, e.y, 'diamond', 'examinerCore', 12, 160, 0.6, 3);
        fx.shake = 0.12;
        break;
      case 'seed.stick': fx.rings.push({ x: e.x, y: e.y, t: 0.3, max: 0.3, color: 'seed' }); break;
      default:
    }
  }
}

export function fxTick(fx, dt) {
  const age = (arr) => { for (const a of arr) a.t -= dt; return arr.filter((a) => a.t > 0); };
  fx.arcs = age(fx.arcs);
  fx.rings = age(fx.rings);
  fx.afterimages = age(fx.afterimages);
  fx.trails = age(fx.trails);
  fx.pulses = age(fx.pulses);
  for (const p of fx.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.vx *= 0.985; }
  fx.particles = age(fx.particles);
  fx.flash = Math.max(0, fx.flash - dt);
  fx.wipe = Math.max(0, fx.wipe - dt);
  fx.shake = Math.max(0, fx.shake - dt);
  fx.clearGlow = Math.max(0, fx.clearGlow - dt);
  if (fx.collapse) { fx.collapse.k = Math.min(1, fx.collapse.k + dt / fx.collapse.dur); }
  fx.squash *= Math.pow(0.0005, dt); // ease back to 0
  for (const [id, t] of fx.flashIds) { if (t - dt <= 0) fx.flashIds.delete(id); else fx.flashIds.set(id, t - dt); }
}
