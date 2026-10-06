# M3-prep report

An unattended session to prepare M3. No new chapter content, and no changes to feel or existing tunables. All eight steps are done; caveats are listed per step and in **Known issues**.

Branch `claude/zealous-carson-gdeqkc`. The session started after `dcf4c38` (M2 report) and ends at the commit carrying this report.

## Order of work

The steps were worked in the order given, with one exception. The solver cache is keyed on a hash of the sim, projectile, object and solver files plus the tunables. Any edit to those files during steps 1–2 would have thrown away hours of cached diagnostics and mirror solves.

So while steps 1–2 ran (about 4 h of solver time), steps 5–8 were built because they touch none of those files. Step 3 was drafted outside the tree and landed after step 2 finished.

Commit order is therefore 1/2 (interleaved), 5, 6, 7, 8 (tool), 2, 1 (final results), 3, 4, 8 (run). Each commit carries one intent, with one exception: I bundled diagnostics progress into the c2-05-m mirror commit by mistake.

## 1. Under-par and comfort diagnostics (no rooms modified)

`tools/diagnose.mjs` ran the `npm test` diagnostics on all 80 room files present at the start:

- the 70 rooms (Prologue 3, Chapter 1 20 + 20 mirrors, Chapter 2 17, Chapter 3 10);
- the 9 Examiner phases;
- the parked `c4-01`.

Results are in `test/diagnostics.json`, with the full table at the end of this report. Total solver time was 97 min.

**Under-par** (5 Hz, budget par − 1):

| Result | Rooms |
|---|---|
| **Cheaper clear found** | `c1-02-m` (◇1, par 2) · `c1-13-m` (◇1, par 2) · `c1-17-m` (◇1, par 2) |
| Proven none cheaper | 41 rooms |
| Unproven (search capped) | `c1-09`, `c1-09-m`, `c1-20`, `c1-20-m`, `c1-ex2`, `c1-ex3`, `c2-ex2`, `c2-ex3`, `c3-08`, `c3-09`, `c3-ex2`, `c3-ex3` |
| Par 0 (n/a) | 24 rooms |

The three under-par rooms are all Chapter 1 mirrors generated in M2 whose half-period phase shift opened a 1-reflect route. Either their par drops to 1 or they need a different mirror change. That's a design call, so they're left as they are.

**Comfort** (still solvable within par at 4 Hz / 3 Hz):

| | Rooms |
|---|---|
| 4 Hz: capped (unproven) | `c1-ex2`, `c1-ex3`, `c2-ex2`, `c2-ex3`, `c3-ex3`, `c3-08` |
| 3 Hz: **proven not solvable** | `c2-11` Weighbridge, `c3-07` Bridge, `c3-10` Stepping Stones |
| 3 Hz: capped | `c3-08` |

The three 3 Hz failures are real. Those rooms need input changes faster than three per second somewhere in their solution, so they are the tightest-timed rooms for a player. A capped search proves nothing either way.

The Examiner phases pass the CI gate through its deeper 4 Hz search. `c3-08` passes only on its recorded solution.

## 2. Mirror rooms for Chapters 2 and 3

All 27 core rooms in Chapters 2 and 3 now have a mirror, so with Chapter 1 there are 47. A re-check confirmed each one:

- the room is valid;
- exactly one property differs from the original;
- the original solution doesn't clear it;
- its own solution clears within par.

`tools/make-mirrors.mjs` gained three candidate kinds:

- a vertical emitter moved to the mirrored column;
- an emitter period changed by ±25%;
- the spawn moved to the mirrored column.

Two mirrors needed the new kinds: `c2-07-m` (2.2 → 1.65 s) and `c2-16-m` (1.6 → 1.2 s).

`c3-08-m` is too deep for the generator's search, so it was made by hand. The change is seed drop 1.8 → 1.35 s, proven with the staged climb solver at par 3. A slower drop (2.25 s) was tried first and isn't solvable.

| Change | Mirrors |
|---|---|
| Emitter phase + ½ period | c2-03, 04, 05, 06, 10, 12, 14 · c3-03, 07, 10 |
| Emitter reversed | c2-01, 02, 11, 13, 15, 17 |
| Emitter period ±25% | c2-07, c2-16, c3-08 |
| Exit moved | c2-09 · c3-01, 02, 04, 05 |
| Switch moved | c2-08 · c3-06, 09 |

Mirrors that came out harder than the original: `c2-15-m` (par 1 → 2) and `c3-01-m` (0 → 1).

`c3-04-m` is weak. Its exit moves one column inside the same shaft, so it changes little. It's a candidate for a hand-made replacement.

## 3. Splitter, Charge and Twin

These are modules in `src/projectiles/`, with tunables in `config/tunables.js` (new blocks only; no existing value changed):

- **Splitter**: a reflect returns two Splitters at ±45° of the outgoing direction. The rotation uses `Math.SQRT1_2`, not trigonometry, so replays stay bit-identical across runtimes. Anything it hits destroys it, like an Orb.
- **Charge**: it bounces off solid tiles, ×1.25 speed per bounce for 3 bounces (140 → 273 px/s). It is lethal only at full speed. A reflect keeps its speed. Non-tile objects end it like an Orb. It fizzles after `LIFE` = 8 s.
- **Twin**: `spawn()` returns a pair 48 px apart across the line of travel, and the engine tags them with a shared `group`. Reflecting one gives its partner the mirror image of the new velocity across the pair's original axis. So reflect the low one up and the high one goes down; send one back and both come back.

The engine got three generic additions:

- `spawn()` may return an array;
- `lethal` may be a function of state;
- after a reflect, `onLinkedReflect` is applied to group partners.

All 107 room solutions replay to bit-identical end states before and after, so no existing behaviour changed.

Solver support: reflect reach uses each projectile's real closing speed (a full-speed Charge outruns the old fixed 160 px/s allowance), and an optional `keyOf(state)` adds type state to the visited key (Charge: bounces).

There are 9 new unit tests and all pass, as do all three contracts.

**Fixtures** are in `test/fixtures/`, outside the campaign. Each recorded solution is checked in `npm test`. In every fixture the solver also proved that par − 1 can't clear it, so each fixture really requires the rule it was built for.

| Fixture | Proves | Par | Search time | States |
|---|---|---|---|---|
| fx-splitter-fork | one reflect, two halves, two switches | 1 | 5.4 s | 15,682 |
| fx-splitter-angle | a switch reachable only on a 45° half | 1 | 37.6 s | 108,337 |
| fx-charge-early | reflect it while still harmless | 1 | 41.8 s | 208,973 |
| fx-charge-pass | slow, it passes through you to the switch | 0 | 2.6 s | 17,816 |
| fx-twin-mirror | the partner is mirrored onto a second switch | 1 | 16.1 s | 44,795 |
| fx-twin-home | send one home, both come home | 1 | 7.9 s | 9,770 |

Times come from `tools/solve-fixtures.mjs` at 5 Hz, and include the par − 1 proof. They are recorded in `test/fixtures/timings.json`.

Design calls I made where the GDD is open:

- **Twin "mirrors the reflection".** I read this as the mirror image across the pair's line of travel, not "the same direction". It's a one-line change in `twin.js` if the other reading is wanted.
- **Charge.** It's harmless below full speed. I added `LIFE` so ricochets can't pile up forever; the GDD has no lifetime.
- **Splitter angle.** It's fixed at 45° by the GDD, so it isn't a tunable.
- **Twin emitters.** A pair is too wide to shut its own emitter on a return, because both twins miss the emitter tile. This emerged from the rules, and `fx-twin-home` uses it. It's worth knowing for Chapter 7.

The new types have placeholder colours (`theme.js`), and none have sound yet.

## 4. Solver profiling and pruning

**Profile** (`node --cpu-prof`, c1-20):

| Share | Where |
|---|---|
| 27% | `world.step` |
| 22% | solver loop |
| 16% | GC |
| 11% | orb step |
| ~12% | collision lookup |

The simulation itself dominates, so per-state micro-optimisation has little room. Fewer states is the lever.

**Tried: reflect dominance.** Reflects-used leaves the key and a key reached with no more reflects is skipped. It's sound, so an exhausted search is still a proof. Measured effect: none. c3-ex2 explored the same 107,290 states, and c3-ex3 the same capped 400,001, because states that differ only in reflects used almost never coincide. It's kept as a free soundness-preserving rule.

**Tried: guiding Examiner searches toward the nearest unbroken core.** No gain on c2-ex2; reverted.

**Adopted: coarse projectile buckets for finding a solution.** Emitter phase is bucketed per decision window, but projectiles were keyed at 8 px. Their sub-window drift (up to ~28 px) split one situation into 3–4 keys. A new `projQ` option sets the projectile bucket. CI's solvability gate now tries `projQ: 32` first and falls back to the exact searches unchanged.

Coarse buckets can merge states that differ, so a coarse search that fails proves nothing. Under-par and comfort searches therefore keep exact buckets, and no proof is weakened.

**Before/after**: CI gate first search, 5 Hz at par, default cap 400k. The five slowest rooms by total diagnostic time are in bold.

| Room | Before | After |
|---|---|---|
| **c3-ex3** | 303.9 s, capped | 409.0 s, capped |
| **c2-ex3** | 304.4 s, capped | 307.7 s, capped |
| **c2-ex2** | 289.4 s, capped | 265.0 s, capped |
| **c3-09** | 268.0 s, capped | **166.3 s, solved ◇2** |
| **c3-ex2** | 106.4 s, ◇2 (107k states) | **46.7 s**, ◇2 (61k) |
| c1-20 | 198.6 s, ◇2 (275k) | **72.5 s**, ◇2 (154k) |
| c3-ex1 | 82.5 s, ◇2 (95k) | **38.4 s**, ◇2 (54k) |
| c1-20-m | 119.6 s, ◇2 (215k) | **64.8 s**, ◇2 (129k) |

Where the fast search finds a clear, it does so 1.6–2.7× faster, and c3-09 now solves without falling back.

The three capped Examiner phases don't improve. Their space is reflect angles, not projectile drift. On a cold cache the failed fast search adds up to about 5 min per such room before the exact search runs, after which the result is cached.

Under-par times are unchanged, because those searches keep exact buckets by design. Before: c3-ex3 422 s, c3-ex2 344 s, c3-09 277 s, c2-ex3 345 s, c2-ex2 260 s, all capped.

The Examiner phases still need either a smarter search, such as staged or core-by-core solving inside the gate, or to keep relying on the deep fallback and recorded solutions.

## 5. Speedrun timer and replay-verified runs

`src/game/speedrun.js` handles the timer and run verification:

- **Timing.** Time is in-game: sim frames at 120 Hz.
- **Runs.** A run holds one segment per room, with every attempt's input log, deaths and resets included.
- **Verification.** `verifyRun` replays each attempt. Every attempt but the last must fail to clear, and the last must clear on exactly its final frame. Assisted segments are rejected, and an optional ordered room list must match.
- **Session.** The play session now keeps each attempt's log; this is additive, and the hint, replay and medal paths are unchanged.

In the game:

- the Settings toggle **Speedrun timer** is off by default;
- the HUD shows room time and run time;
- a run spans back-to-back rooms and ends at the map or title;
- results offer **Export run** (JSON).

Tests in `test/speedrun.mjs`, wired into `npm test` and `test:unit`, all pass:

- the timer is off by default;
- time formatting;
- multi-room runs verify, with time equal to the frame sum;
- failed attempts count toward the time;
- five tampering cases are rejected (truncated, padded, clear-then-continue, unknown room, assisted), plus a room-order mismatch;
- a live session records attempts that verify.

There is no in-game leaderboard or chapter/full-game categories UI yet. Runs are verifiable files.

## 6. Steam scaffolding (behind `FLAGS.STEAM`, off)

- `config/flags.js`: `VITE_STEAM=1` turns it on at build time. Default web builds compile it out of the live path.
- **Achievements** (`src/platform/steam/achievements.js`): 30 definitions from the GDD list.
  - Clear each chapter (8), defeat each Examiner (8), Gold every room per chapter (8).
  - Under-par clear, game finished with zero hints.
  - 100 and 1,000 reflects, 100 and 1,000 deaths.
  - `evaluateAchievements` is a pure function of the save. Achievements are synced after clears and Examiner wins.
- **Cloud saves** (`cloud-storage.js`): a Web Shell `StorageAdapter` that writes through to local and Steam Cloud. On read it keeps the newer copy by the save envelope's `savedAt`. If Steam is missing, or the cloud copy is corrupt, it falls back to local.
- **Glyph switching** (`glyphs.js`): a Steam Input controller type wins, then USB vendor ID (Valve `28de` maps to the new **Steam Deck** glyph set; Sony, Nintendo and Microsoft as expected), then the Web Shell's own family.
- **Bridge** (`bridge.js`): the only door to Steam. On the Tauri desktop build it calls `steam_*` commands; everywhere else it's a null bridge.

Tests in `test/steam.mjs`: 8 checks covering the flag default, the achievement set, evaluation, cloud merge both ways and fallback, glyph classification, and bridge gating. All pass.

**Not done:** the Rust side. `steam_init`, `steam_unlock`, `steam_cloud_*` and `steam_controller_type` don't exist yet in `src-tauri`. They need steamworks-rs and a Steam App ID. Until then the bridge reports "not available" and the game runs exactly as on the web.

## 7. Tauri desktop build in CI

`.github/workflows/ci.yml` has a new `desktop` job on Ubuntu 22.04:

1. Install the WebKitGTK 4.1 system libraries.
2. Install stable Rust, with a Rust build cache.
3. `npm ci`, then `npx tauri build --bundles deb`.
4. Upload the `.deb` as artifact `reflect-dodge-linux-deb`.

Its first run passed: the build step took 2 min 25 s (run 37473779539).

**Launch is untested.** Nothing in CI starts the built app, and it has never been opened on a desktop. Windows and macOS builds aren't configured.

The same CI run's `test` job, the full `npm test`, passed in 46 min at `b9ca425`. That was before the step 2 mirrors and the step 3–4 changes landed; later runs cover those.

## 8. Headless performance benchmark

`node tools/bench.mjs --reps 20 --top 5 --browser` covers:

- every room's solution;
- the six fixtures;
- a synthetic worst case, `stress-8`: eight emitters (Orb, Splitter ×2, Charge ×2, Twin, Seed, Anchor) firing every 0.6 s for 10 s, with the player invincible.

**Sim (Node, per 1/120 s step; budget 8,333 µs):**

| Room | Max projectiles | Mean µs | p99 µs | Worst µs |
|---|---|---|---|---|
| stress-8 (synthetic) | 113 | 95.9 | 342.1 | 7,302 |
| c3-04 (heaviest real room) | 13 | 6.0 | 23.9 | 804 |
| c3-10-m | 8 | 4.1 | 12.9 | 586 |
| c2-ex3 | 7 | 4.1 | 12.3 | 502 |

Across all 114 rooms the worst p99 step is 342 µs, under 5% of the budget. The single 7.3 ms worst step in stress-8 is one outlier, most likely a GC pause; it's still under budget.

**Browser (headless Chromium, real loop + renderer):** the five heaviest real rooms run at a mean 16.7 ms per frame, which is vsync. p99 is 16.8 ms. There are occasional single 33–50 ms frames, one or two per 600.

Headless software rendering isn't a device measurement. The **Steam Deck and mid-range mobile measurements the GDD asks for haven't been done** and need real hardware.

## Final checks

At the end of the session:

- `npm run test:unit`: all pass. That covers contracts, rules, the new types, speedrun and Steam.
- `npm run build`, and the Steam-flag build: both compile.
- Browser smoke test against the final build: **137/137**, including Chromium == Node replay for every room and the 27 new mirrors.

The full `npm test` (solver gates) runs in CI on each push; its last completed run passed at `b9ca425`.

## Known issues and decisions for Mike

1. **Chapter 3 breaks the 15-of-20 unlock rule.** It has 10 core rooms, so its Examiner never opens (`examinerOpen` needs 15 cleared), and Chapter 4 can't unlock without `?all=1`. Flagged, not fixed, as asked. The options are to fill the chapter to 15+ rooms or to scale the rule, for example 75% of the chapter's rooms.
2. **Under-par mirrors.** `c1-02-m`, `c1-13-m` and `c1-17-m` clear with ◇1 against par 2: re-par or redesign.
3. **Tight comfort.** `c2-11`, `c3-07` and `c3-10` aren't solvable at 3 Hz: review whether the timing is intended.
4. **The Twin reading** (mirror vs. same direction) and the **Charge lifetime** need confirming.
5. **The Examiner phases** remain the solver's weak spot (see step 4).
6. **Commit mix-up.** One commit bundles a mirror with diagnostics progress (`c2-05-m`). The M2 report earlier noted a similar mislabelled commit.

## Appendix: diagnostics, all 80 room files

(`node tools/diagnose.mjs --table`. "capped" means the search hit its state cap and proves nothing; "exhausted" means no route exists at that budget.)

| Room | Par | Under-par search | Comfort 4 Hz | Comfort 3 Hz |
|---|---|---|---|---|
| c1-01 | 1 | exhausted | pass | pass |
| c1-01-m | 1 | exhausted | pass | pass |
| c1-02 | 0 | n/a | pass | pass |
| c1-02-m | 2 | ◇1 | pass | pass |
| c1-03 | 1 | exhausted | pass | pass |
| c1-03-m | 1 | exhausted | pass | pass |
| c1-04 | 1 | exhausted | pass | pass |
| c1-04-m | 1 | exhausted | pass | pass |
| c1-05 | 0 | n/a | pass | pass |
| c1-05-m | 0 | n/a | pass | pass |
| c1-06 | 1 | exhausted | pass | pass |
| c1-06-m | 1 | exhausted | pass | pass |
| c1-07 | 1 | exhausted | pass | pass |
| c1-07-m | 1 | exhausted | pass | pass |
| c1-08 | 0 | n/a | pass | pass |
| c1-08-m | 0 | n/a | pass | pass |
| c1-09 | 2 | capped | pass | pass |
| c1-09-m | 2 | capped | pass | pass |
| c1-10 | 1 | exhausted | pass | pass |
| c1-10-m | 1 | exhausted | pass | pass |
| c1-11 | 1 | exhausted | pass | pass |
| c1-11-m | 1 | exhausted | pass | pass |
| c1-12 | 1 | exhausted | pass | pass |
| c1-12-m | 1 | exhausted | pass | pass |
| c1-13 | 1 | exhausted | pass | pass |
| c1-13-m | 2 | ◇1 | pass | pass |
| c1-14 | 1 | exhausted | pass | pass |
| c1-14-m | 1 | exhausted | pass | pass |
| c1-15 | 0 | n/a | pass | pass |
| c1-15-m | 0 | n/a | pass | pass |
| c1-16 | 1 | exhausted | pass | pass |
| c1-16-m | 2 | exhausted | pass | pass |
| c1-17 | 1 | exhausted | pass | pass |
| c1-17-m | 2 | ◇1 | pass | pass |
| c1-18 | 1 | exhausted | pass | pass |
| c1-18-m | 1 | exhausted | pass | pass |
| c1-19 | 0 | n/a | pass | pass |
| c1-19-m | 2 | exhausted | pass | pass |
| c1-20 | 2 | capped | pass | pass |
| c1-20-m | 2 | capped | pass | pass |
| c1-ex1 | 1 | exhausted | pass | pass |
| c1-ex2 | 2 | capped | capped | pass |
| c1-ex3 | 3 | capped | capped | pass |
| c2-01 | 0 | n/a | pass | pass |
| c2-02 | 0 | n/a | pass | pass |
| c2-03 | 0 | n/a | pass | pass |
| c2-04 | 0 | n/a | pass | pass |
| c2-05 | 1 | exhausted | pass | pass |
| c2-06 | 1 | exhausted | pass | pass |
| c2-07 | 1 | exhausted | pass | pass |
| c2-08 | 0 | n/a | pass | pass |
| c2-09 | 0 | n/a | pass | pass |
| c2-10 | 0 | n/a | pass | pass |
| c2-11 | 1 | exhausted | pass | exhausted |
| c2-12 | 0 | n/a | pass | pass |
| c2-13 | 0 | n/a | pass | pass |
| c2-14 | 0 | n/a | pass | pass |
| c2-15 | 1 | exhausted | pass | pass |
| c2-16 | 1 | exhausted | pass | pass |
| c2-17 | 0 | n/a | pass | pass |
| c2-ex1 | 1 | exhausted | pass | pass |
| c2-ex2 | 2 | capped | capped | pass |
| c2-ex3 | 2 | capped | capped | pass |
| c3-01 | 0 | n/a | pass | pass |
| c3-02 | 1 | exhausted | pass | pass |
| c3-03 | 2 | exhausted | pass | pass |
| c3-04 | 0 | n/a | pass | pass |
| c3-05 | 2 | exhausted | pass | pass |
| c3-06 | 1 | exhausted | pass | pass |
| c3-07 | 0 | n/a | pass | exhausted |
| c3-08 | 3 | capped | capped | capped |
| c3-09 | 2 | capped | pass | pass |
| c3-10 | 1 | exhausted | pass | exhausted |
| c3-ex1 | 2 | exhausted | pass | pass |
| c3-ex2 | 2 | capped | pass | pass |
| c3-ex3 | 2 | capped | capped | pass |
| c4-01 | 1 | exhausted | pass | pass |
| p0-01 | 0 | n/a | pass | pass |
| p0-02 | 1 | exhausted | pass | pass |
| p0-03 | 0 | n/a | pass | pass |
