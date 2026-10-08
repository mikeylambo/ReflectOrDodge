# M3 performance pass

`node tools/bench.mjs --browser --reps 5 --top 6`, run on this build: all 277 room files, the projectile fixtures, and a synthetic stress room (eight fast emitters of every type, 113 projectiles alive at once).

## Sim (Node, per 1/120 s step; budget 8 333 µs)

| Room | Max projectiles | Mean µs | p99 µs | Worst µs |
|---|---|---|---|---|
| stress-8 (synthetic) | 113 | 80.2 | 207.0 | 626.4 |
| c6-09 Warm Rain | 14 | 9.1 | 39.7 | 626.8 |
| c3-04 Ladder | 13 | 5.7 | 18.4 | 347.4 |
| c7-11 Between the Pairs | 10 | 7.4 | 26.3 | 385.2 |
| c8-ex3 Examiner III | 8 | 4.9 | 18.3 | 382.3 |

The worst p99 step of any room is 207 µs: about 2.5% of the budget, even in the synthetic worst case.

## Browser (headless Chromium, real loop and renderer, solution replay)

The six busiest rooms (by projectile count) held 60 fps: mean frame interval 16.67 ms, worst 16.80 ms, no dropped frames. This includes the new Chapter 5–8 stages and the Examiner variations: stage layers are drawn once per room into cached canvases, so they cost a blit per frame.

## Caveats

- Headless Chromium renders in software, and the post effects (bloom, ripples, grade) switch themselves off on software GL. **Post effects are not measured here.** They need checking on a Steam Deck and a mid-range phone.
- The frame interval is capped at the display rate, so it shows "fast enough", not the headroom left.
- To measure on a device: open `?all=1`, play c6-09, c3-04 and any Chapter 8 Examiner, and watch the FPS readout (`window.__RD.fps` in the console).
