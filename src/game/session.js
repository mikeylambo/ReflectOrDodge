// A play session in one room: owns sim state, the input recorder, deaths and
// presentation fx. Used by the game and by the editor's play mode.
//
// Recording: every sim step's input mask is logged from room start; a death
// or reset starts a fresh log. On clear, `lastClear.log` is the full run —
// exactly what a room's `solution` field stores.
import { compileRoom } from '../sim/room.js';
import { createState, step } from '../sim/world.js';
import { encodeLog } from '../sim/input.js';
import { createFx, fxEvents, fxTick } from '../present/fx.js';
import { playEvent } from '../engine/audio.js';
import { haptic } from '../engine/haptics.js';
import { TIMESTEP } from '../../config/tunables.js';

export function medalFor({ reflects, par, deaths }) {
  if (reflects > par) return 1; // bronze
  return deaths === 0 ? 3 : 2; // gold : silver
}

export function createSession({ onClear = () => {}, opts = {} } = {}) {
  const S = {
    data: null, room: null, state: null, fx: createFx(),
    log: [], deaths: 0, lastClear: null, clearHold: 0, opts,
  };

  S.load = (data) => {
    S.data = data;
    S.room = compileRoom(data);
    S.deaths = 0;
    S.lastClear = null;
    S.reset();
  };

  S.reset = () => {
    S.state = createState(S.room, S.opts);
    S.log = [];
    S.clearHold = 0;
  };

  S.tick = (mask) => {
    fxTick(S.fx, TIMESTEP.STEP);
    const st = S.state;
    if (st.status === 'dead') { S.deaths++; S.reset(); return; } // instant: next frame
    if (st.status === 'clear') {
      if (S.clearHold > 0 && --S.clearHold === 0) onClear(S.lastClear);
      return;
    }
    S.log.push(mask);
    const events = step(st, S.room, mask);
    fxEvents(S.fx, events, st);
    for (const e of events) {
      playEvent(e);
      if (e.type === 'projectile.reflect') haptic('light');
      else if (e.type === 'player.death' || e.type === 'room.clear') haptic('medium');
    }
    if (st.status === 'clear') {
      const reflects = st.stats.reflects;
      S.lastClear = {
        roomId: S.room.id, reflects, par: S.room.par, deaths: S.deaths,
        medal: medalFor({ reflects, par: S.room.par, deaths: S.deaths }),
        underPar: reflects < S.room.par, frames: S.log.length, log: encodeLog(S.log),
      };
      S.clearHold = Math.round(0.6 * TIMESTEP.HZ); // room-clear glow before results
    }
  };

  return S;
}
