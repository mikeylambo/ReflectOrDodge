// Speedrun support (GDD: Speedrun support). Off by default; the timer only
// shows when the player turns it on in Settings.
//
// Time is in-game time: simulation frames at 120 Hz, the same clock the sim
// runs on, so a run's time is a pure function of its inputs. A run is a list
// of segments, one per room, each holding EVERY attempt's input log (deaths and
// resets included), so the whole run can be re-simulated:
//
//   { v: 1, kind: 'room'|'chapter'|'game', category: 'core'|'mirror',
//     segments: [{ room, attempts: ['1:…', …], assisted }] }
//
// verifyRun replays each attempt from room start. Every attempt but the last
// must fail to clear (it ended in a death or a reset); the last must clear on
// exactly its final frame. Time = the sum of all attempts' frames.
import { compileRoom } from '../sim/room.js';
import { runLog } from '../sim/world.js';
import { decodeLog } from '../sim/input.js';
import { TIMESTEP } from '../../config/tunables.js';

export const RUN_VERSION = 1;

export function createRun(kind = 'chapter', category = 'core') {
  return { v: RUN_VERSION, kind, category, segments: [] };
}

// attempts: encoded logs, oldest first, the clearing attempt last
export function addSegment(run, room, attempts, assisted = false) {
  run.segments.push({ room, attempts: [...attempts], assisted: !!assisted });
  return run;
}

export const segmentFrames = (seg) => seg.attempts.reduce((n, a) => n + decodeLog(a).length, 0);
export const runFrames = (run) => run.segments.reduce((n, s) => n + segmentFrames(s), 0);

// 1234 frames → "0:10.28"
export function formatTime(frameCount) {
  const cs = Math.floor((frameCount * 100) / TIMESTEP.HZ);
  const m = Math.floor(cs / 6000), s = Math.floor((cs % 6000) / 100), c = cs % 100;
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

/**
 * @param run          a run object (see top)
 * @param roomsById    { id: room JSON }
 * @param expectRooms  optional ordered room ids the run must cover exactly
 * @returns { ok, frames, problems[] }
 */
export function verifyRun(run, roomsById, expectRooms = null) {
  const problems = [];
  if (!run || run.v !== RUN_VERSION || !Array.isArray(run.segments)) return { ok: false, frames: 0, problems: ['not a v1 run'] };
  let total = 0;
  run.segments.forEach((seg, i) => {
    const data = roomsById[seg.room];
    if (!data) { problems.push(`segment ${i}: unknown room ${seg.room}`); return; }
    if (!seg.attempts.length) { problems.push(`segment ${i} (${seg.room}): no attempts`); return; }
    if (seg.assisted) problems.push(`segment ${i} (${seg.room}): assisted (not eligible)`);
    const room = compileRoom(data);
    seg.attempts.forEach((a, k) => {
      let masks;
      try { masks = decodeLog(a); } catch { problems.push(`segment ${i} attempt ${k}: bad log`); return; }
      const { state } = runLog(room, masks);
      const last = k === seg.attempts.length - 1;
      if (last && state.status !== 'clear') problems.push(`segment ${i} (${seg.room}): final attempt does not clear (${state.status})`);
      else if (last && state.tick !== masks.length) problems.push(`segment ${i} (${seg.room}): ${masks.length - state.tick} input frames after the clear`);
      else if (!last && state.status === 'clear') problems.push(`segment ${i} (${seg.room}): attempt ${k} clears but the run carries on`);
      total += masks.length;
    });
  });
  if (expectRooms) {
    const got = run.segments.map((s) => s.room).join(',');
    if (got !== expectRooms.join(',')) problems.push(`rooms ${got} ≠ expected ${expectRooms.join(',')}`);
  }
  return { ok: problems.length === 0, frames: total, problems };
}
