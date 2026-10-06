// Speedrun timer + replay-verified runs (GDD: Speedrun support).
import { loadRooms } from './levels-node.mjs';
import { createRun, addSegment, runFrames, verifyRun, formatTime } from '../src/game/speedrun.js';
import { createSession } from '../src/game/session.js';
import { decodeLog, encodeLog, BTN } from '../src/sim/input.js';
import { TIMESTEP } from '../config/tunables.js';
import { readFileSync } from 'node:fs';

export function runSpeedrunTests() {
  const out = [];
  const check = (label, fn) => {
    try { const r = fn(); out.push([r === true || (r && r.ok), label, r && r.detail ? r.detail : '']); } catch (e) { out.push([false, label, e.message]); }
  };
  const byId = Object.fromEntries(loadRooms().map(({ room }) => [room.id, room]));
  const sol = (id) => byId[id].solution;
  const len = (id) => decodeLog(sol(id)).length;

  // save.js imports the Web Shell through a Vite alias, so read its default from source
  check('speedrun timer is off by default', () => /speedrunTimer: false/.test(readFileSync(new URL('../src/shell/save.js', import.meta.url), 'utf8')));

  check('time format: frames → m:ss.cc at 120 Hz', () => {
    const f = formatTime(TIMESTEP.HZ * 75 + 12);
    return { ok: f === '1:15.10' && formatTime(0) === '0:00.00', detail: f };
  });

  check('a run of recorded solutions verifies; its time is their frame total', () => {
    const run = createRun('chapter');
    for (const id of ['c1-01', 'c1-02', 'c1-03']) addSegment(run, id, [sol(id)]);
    const v = verifyRun(run, byId, ['c1-01', 'c1-02', 'c1-03']);
    const want = len('c1-01') + len('c1-02') + len('c1-03');
    return { ok: v.ok && v.frames === want && runFrames(run) === want, detail: `${v.frames}/${want} ${v.problems.join('; ')}` };
  });

  check('failed attempts count toward the time and still verify', () => {
    const half = encodeLog(decodeLog(sol('c1-04')).slice(0, 90)); // an abandoned attempt (reset)
    const run = addSegment(createRun('room'), 'c1-04', [half, half, sol('c1-04')]);
    const v = verifyRun(run, byId);
    return { ok: v.ok && v.frames === 180 + len('c1-04'), detail: `${v.frames} ${v.problems.join('; ')}` };
  });

  check('tampered runs are rejected', () => {
    const masks = decodeLog(sol('c1-04'));
    const cases = {
      truncated: addSegment(createRun(), 'c1-04', [encodeLog(masks.slice(0, -5))]),
      padded: addSegment(createRun(), 'c1-04', [encodeLog([...masks, 0, 0, 0])]),
      'clear-then-carry-on': addSegment(createRun(), 'c1-04', [sol('c1-04'), sol('c1-04')]),
      'unknown room': addSegment(createRun(), 'zz-99', [sol('c1-04')]),
      assisted: addSegment(createRun(), 'c1-04', [sol('c1-04')], true),
    };
    const bad = Object.entries(cases).filter(([, r]) => verifyRun(r, byId).ok).map(([k]) => k);
    const order = verifyRun(addSegment(createRun(), 'c1-04', [sol('c1-04')]), byId, ['c1-05']).ok;
    return { ok: bad.length === 0 && !order, detail: bad.length ? `accepted: ${bad.join(', ')}` : '' };
  });

  check('the play session records every attempt; its clear carries a verifiable segment', () => {
    let clear = null;
    const s = createSession({ onClear: (r) => { clear = r; }, opts: { silent: true } });
    s.load(byId['c1-04']);
    for (let i = 0; i < 40; i++) s.tick(BTN.R); // wander, then reset by hand
    s.reset();
    for (const m of decodeLog(sol('c1-04'))) s.tick(m);
    for (let i = 0; i < 200 && !clear; i++) s.tick(0); // clear hold
    const seg = clear && clear.attempts;
    const v = seg ? verifyRun(addSegment(createRun('room'), 'c1-04', seg), byId) : { ok: false, frames: 0, problems: ['no clear'] };
    return { ok: !!seg && seg.length === 2 && v.ok && v.frames === 40 + len('c1-04'), detail: `${seg && seg.length} attempts, ${v.frames} frames ${v.problems.join('; ')}` };
  });

  return out;
}
