// Play mode: the sample rooms in order. M0 has no menus (GDD: stop at M0) —
// a clear shows a one-line result card, then the next room. [ and ] switch rooms.
import { createLoop } from '../engine/loop.js';
import { createInput } from '../engine/input.js';
import { initAudio } from '../engine/audio.js';
import { createSession } from './session.js';
import { render } from '../render/render.js';
import { ROOMS } from '../sim/levels.js';
import { ROOM } from '../config/tunables.js';
import { THEME } from '../render/theme.js';
import { compileRoom } from '../sim/room.js';
import { runLog } from '../sim/world.js';
import { decodeLog } from '../sim/input.js';

const MEDAL = ['', 'BRONZE', 'SILVER', 'GOLD'];

export function startGame(canvas, ctx) {
  let index = 0;
  let card = null; // { result, t }
  let time = 0;

  const session = createSession({
    onClear: (result) => { card = { result, t: 0 }; },
  });
  const go = (i) => { index = (i + ROOMS.length) % ROOMS.length; card = null; session.load(ROOMS[index]); };

  const input = createInput({
    touchRoot: document.getElementById('touch'),
    onMeta: (k) => {
      initAudio();
      if (k === 'r') { if (card) go(index); else session.reset(); }
      else if (k === ']') go(index + 1);
      else if (k === '[') go(index - 1);
      else if ((k === 'enter') && card) go(index + 1);
    },
  });
  addEventListener('pointerdown', initAudio, { once: true });
  addEventListener('keydown', initAudio, { once: true });

  go(0);

  const loop = createLoop({
    update: (dt) => {
      time += dt;
      const mask = input.sample();
      if (card) {
        card.t += dt;
        if (card.t > 1.8) go(index + 1);
        return;
      }
      session.tick(mask);
    },
    render: (alpha) => {
      render(ctx, { state: session.state, room: session.room, alpha, fx: session.fx, time });
      if (card) drawCard(ctx, card.result);
    },
  });
  loop.start();

  window.__RD = {
    get session() { return session; },
    get index() { return index; },
    get fps() { return loop.fps; },
    get card() { return card; },
    rooms: ROOMS.map((r) => r.id),
    go,
    // headless replay of a room's stored solution, for the cross-runtime determinism check
    replay(id) {
      const data = ROOMS.find((r) => r.id === id);
      const { state } = runLog(compileRoom(data), decodeLog(data.solution));
      return JSON.stringify(state);
    },
    // play a room's stored solution through the live session up to `frame`
    // (dev/screenshot hook; also the seed of "watch solution")
    seek(id, frame) {
      go(ROOMS.findIndex((r) => r.id === id));
      const masks = decodeLog(ROOMS[index].solution);
      for (let i = 0; i < Math.min(frame, masks.length); i++) session.tick(masks[i]);
    },
  };
}

function drawCard(ctx, r) {
  ctx.save();
  ctx.fillStyle = 'rgba(7,8,13,0.72)';
  ctx.fillRect(0, ROOM.H / 2 - 48, ROOM.W, 96);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = THEME.exit;
  ctx.font = '700 28px ui-monospace, Menlo, monospace';
  ctx.fillText(MEDAL[r.medal], ROOM.W / 2, ROOM.H / 2 - 12);
  ctx.font = '500 15px ui-monospace, Menlo, monospace';
  ctx.fillStyle = THEME.hud;
  const mark = r.underPar ? '  ★ under par' : '';
  ctx.fillText(`◇ ${r.reflects} / ${r.par}   ✕ ${r.deaths}${mark}`, ROOM.W / 2, ROOM.H / 2 + 22);
  ctx.restore();
}
