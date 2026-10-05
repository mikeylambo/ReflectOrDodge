// Presentation-only feedback state, fed by sim events. Nothing here is ever
// read by the simulation (GDD: Game feel — "presentation only").
import { FEEL } from '../config/tunables.js';

export function createFx() {
  return { arcs: [], rings: [], afterimages: [], flash: 0, shake: 0, flashIds: new Map(), squash: 0, clearGlow: 0 };
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
      case 'emitter.off':
        fx.rings.push({ x: e.x, y: e.y, t: 0.4, max: 0.4, color: e.type === 'switch.hit' ? 'switch' : 'emitter' });
        break;
      case 'projectile.destroy': fx.rings.push({ x: e.x, y: e.y, t: 0.15, max: 0.15, color: 'orb' }); break;
      case 'player.jump':
        fx.afterimages.push({ x: state.player.x, y: state.player.y, t: FEEL.AFTERIMAGE });
        fx.squash = -0.25;
        break;
      case 'player.land': fx.squash = 0.2; break;
      case 'player.death': fx.flash = FEEL.DEATH_FLASH; fx.shake = FEEL.SHAKE_TIME; fx.deathAt = { x: e.x, y: e.y }; break;
      case 'room.clear': fx.clearGlow = 0.6; break;
      default:
    }
  }
}

export function fxTick(fx, dt) {
  const age = (arr) => { for (const a of arr) a.t -= dt; return arr.filter((a) => a.t > 0); };
  fx.arcs = age(fx.arcs);
  fx.rings = age(fx.rings);
  fx.afterimages = age(fx.afterimages);
  fx.flash = Math.max(0, fx.flash - dt);
  fx.shake = Math.max(0, fx.shake - dt);
  fx.clearGlow = Math.max(0, fx.clearGlow - dt);
  fx.squash *= Math.pow(0.0005, dt); // ease back to 0
  for (const [id, t] of fx.flashIds) { if (t - dt <= 0) fx.flashIds.delete(id); else fx.flashIds.set(id, t - dt); }
}
