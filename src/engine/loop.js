// Fixed-timestep game loop (from Living Loop engine/loop.js). Simulation
// advances in constant STEP increments regardless of display refresh; render
// receives an interpolation alpha so motion stays smooth at any Hz.
import { TIMESTEP } from '../../config/tunables.js';

export function createLoop({ update, render, step = TIMESTEP.STEP }) {
  let raf = null;
  let last = 0;
  let acc = 0;
  let running = false;

  let frames = 0;
  let fpsT = 0;
  let fps = 0;

  function frame(now) {
    if (!running) return;
    const ft = Math.min((now - last) / 1000, TIMESTEP.MAX_FRAME);
    last = now;

    frames++;
    fpsT += ft;
    if (fpsT >= 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }

    acc += ft;
    while (acc >= step) {
      update(step);
      acc -= step;
    }
    render(acc / step);
    raf = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
    },
    get running() { return running; },
    get fps() { return fps; },
  };
}
