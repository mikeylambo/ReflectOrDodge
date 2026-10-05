// A play session in one room: owns sim state, the input recorder, deaths,
// the hint ghost, solution replay and presentation fx. Used by the game and by
// the editor's play mode.
//
// Recording: every sim step's input mask is logged from room start; a death
// or reset starts a fresh log. On clear, `lastClear.log` is the full run —
// exactly what a room's `solution` field stores.
//
// Modes:
//   play    input comes from the player
//   replay  input comes from the room's stored solution ("watch solution")
// Hint ghost (GDD: Stuck-player system): a second, independent sim fed the
//   designer solution in lockstep with the live room, drawn translucent, and
//   stopped shortly after the solution's first reflect.
import { compileRoom } from '../sim/room.js';
import { createState, step } from '../sim/world.js';
import { encodeLog, decodeLog } from '../sim/input.js';
import { createFx, fxEvents, fxTick } from '../present/fx.js';
import { playEvent } from '../engine/audio.js';
import { haptic } from '../engine/haptics.js';
import { TIMESTEP, frames } from '../../config/tunables.js';

import { HINT, CLEAR_HOLD } from '../../config/ux.js';

export { HINT };

export function medalFor({ reflects, par, deaths }) {
  if (reflects > par) return 1; // bronze
  return deaths === 0 ? 3 : 2; // gold : silver
}

// Tick at which the solution's first reflect lands (null if it never reflects).
function firstReflectTick(room, masks) {
  const s = createState(room);
  for (let i = 0; i < masks.length && s.status === 'play'; i++) {
    const ev = step(s, room, masks[i]);
    if (ev.some((e) => e.type === 'projectile.reflect')) return i + 1;
  }
  return null;
}

export function createSession({ onClear = () => {}, onEvent = () => {}, opts = {} } = {}) {
  const S = {
    data: null, room: null, state: null, fx: createFx(),
    log: [], deaths: 0, lastClear: null, clearHold: 0, opts,
    mode: 'play', solution: null, replayAt: 0,
    ghost: null, hintStop: null, hintsUsed: 0,
  };

  S.load = (data, { mode = 'play' } = {}) => {
    S.data = data;
    S.room = compileRoom(data);
    S.deaths = 0;
    S.hintsUsed = 0;
    S.lastClear = null;
    S.solution = data.solution ? decodeLog(data.solution) : null;
    S.hintStop = null;
    S.mode = mode;
    S.reset();
  };

  S.setOpts = (o) => { S.opts = { ...S.opts, ...o }; };

  S.attempt = 0;
  S.reset = () => {
    S.attempt++;
    S.state = createState(S.room, S.mode === 'replay' ? {} : { invincible: S.opts.invincible, windowMult: S.opts.windowMult });
    S.log = [];
    S.clearHold = 0;
    S.replayAt = 0;
    S.ghost = null;
    S.reflectPaths = []; // this attempt's answers: where each reflect went (Examiner collapse)
  };

  S.hintAvailable = (msInRoom) => !!S.solution && S.mode === 'play'
    && (S.deaths >= HINT.AFTER_DEATHS || msInRoom >= HINT.AFTER_MS);

  // Restart the room with the ghost running alongside.
  S.useHint = () => {
    if (!S.solution) return false;
    if (S.hintStop === null) {
      const first = firstReflectTick(S.room, S.solution);
      S.hintStop = first === null ? S.solution.length : first + frames(HINT.TAIL);
    }
    S.reset();
    S.ghost = { state: createState(S.room), i: 0 };
    S.hintsUsed++;
    return true;
  };

  S.tick = (mask) => {
    fxTick(S.fx, TIMESTEP.STEP);
    const st = S.state;
    if (st.status === 'dead') {
      S.deaths++;
      const hadGhost = !!S.ghost;
      S.reset();
      if (hadGhost) S.ghost = { state: createState(S.room), i: 0 }; // the ghost restarts with you
      return;
    }
    if (st.status === 'clear') {
      if (S.clearHold > 0 && --S.clearHold === 0) onClear(S.lastClear);
      return;
    }
    if (S.mode === 'replay') mask = S.solution[S.replayAt++] ?? 0;

    if (S.ghost) {
      const g = S.ghost;
      if (g.i < S.hintStop && g.state.status === 'play') step(g.state, S.room, S.solution[g.i++]);
      else S.ghost = null;
    }

    S.log.push(mask);
    const events = step(st, S.room, mask);
    fxEvents(S.fx, events, st);
    for (const e of events) {
      onEvent(e);
      if (S.opts.silent) continue;
      playEvent(e);
      if (e.type === 'projectile.reflect') haptic('light');
      else if (e.type === 'player.death' || e.type === 'room.clear') haptic('medium');
    }
    for (const e of events) {
      if (e.type !== 'projectile.reflect') continue;
      const pr = st.projectiles.find((q) => q.id === e.id);
      const sp = pr ? Math.hypot(pr.vx, pr.vy) : 0;
      if (sp) S.reflectPaths.push({ x: e.x, y: e.y, dx: pr.vx / sp, dy: pr.vy / sp });
    }
    if (st.status === 'clear') {
      const reflects = st.stats.reflects;
      S.lastClear = {
        roomId: S.room.id, reflects, par: S.room.par, deaths: S.deaths, replay: S.mode === 'replay',
        medal: medalFor({ reflects, par: S.room.par, deaths: S.deaths }),
        underPar: reflects < S.room.par, frames: S.log.length, log: encodeLog(S.log),
        timeMs: Math.round((S.log.length / TIMESTEP.HZ) * 1000),
        assisted: !!(S.opts.invincible || (S.opts.windowMult && S.opts.windowMult !== 1)),
      };
      S.clearHold = Math.round(CLEAR_HOLD * TIMESTEP.HZ); // room-clear glow before results
    }
  };

  return S;
}
