# REFLECT / DODGE — M0

A 2D puzzle-platformer where the only answers to danger are **reflect** or **dodge**.
[`docs/GDD.md`](docs/GDD.md) is the source of truth; its Design laws are non-negotiable.

Current build: **M1, proof of game**. It has the Prologue and Chapter 1 (20 Orb rooms), medals, saves, assists, hints and solution replays, all on the Web Shell's menus.
Milestone reports: [`docs/reports/`](docs/reports/).

```sh
npm install
npm run dev            # game        → http://localhost:5173
                       # editor      → http://localhost:5173/?edit=1
                       # all chapters unlocked (playtests) → ?all=1
npm test               # all gates (headless + Chromium smoke)
npm run test:fast      # headless gates only
```

## Controls

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | A/D, ←/→ | Left stick / D-pad | ◀ ▶ |
| Aim reflect | hold W/A/S/D or arrows (nothing held = return to sender) | stick / D-pad | ▲▼◀▶ |
| Jump | Space | A / Cross | ⤒ |
| Reflect | J / K / Shift | X / Square or RB | ◇ |
| Reset room | R | Back / Select | ↺ |
| Pause (assists, hint, settings) | Esc / P | Start | Ⅱ |
| Hint (when the eye glyph shows) | H | via Pause | via Pause |
| Menus | arrows / W S, Enter / Space / J, Esc back | D-pad / stick, A, B | tap |

**One GDD deviation:** W and Up don't jump. In the GDD table they both jump *and* aim up,
so you could never reflect upward from the ground. Jump is Space only.
Up beats Left/Right when you hold both, because you're usually still holding a run direction when you aim.

## Editor (`?edit=1`)

`1–8` pick tools (tile, erase, spawn, exit, emitter, switch, door, select). Left-click places,
right-click erases. **P** plays the room in place and returns to editing with the room untouched.
The timeline scrubs the room's clocks with an inert player, so you can design without playing.
Reach the exit in play mode, then press **Use as solution** to store that run's input log.
**Save** writes `src/content/rooms/<id>.json` via the dev server. **Mirror** duplicates the room with `mirrorOf` set.

## Layout

```
config/tunables.js       every number (GDD: never inline)
src/engine/              loop (fixed 120 Hz, from Living Loop), input, reactive audio, haptics
src/sim/                 the deterministic simulation: plain data, runs headless
  world.js               the tick: player, reflect, emitters, projectiles, contact, exit
  room.js                schema validation + compile;  input.js  masks + input-log codec
src/projectiles/         one module per type against _projectile.js
src/objects/             emitter, switch, door, wall against _object.js
src/present/             rendering + game feel; reads sim state, never writes it
src/game/                session runtime (recording, deaths, hints, replay)
src/shell/               Web Shell integration: screens, saves, settings
src/editor/              the level editor
src/content/rooms/       one JSON per room + index.json (chapter order)
src/content/ideas.md     ideas catalogue
vendor/web-shell/        built Web Shell modules (see its README)
tools/                   solve.mjs (solver CLI for authoring), screenshot.mjs
test/                    npm test
```

## Authoring a room

1. Build it in the editor (`?edit=1`) and save it.
2. Add it to `src/content/rooms/index.json` and give it a one-line idea in `src/content/ideas.md`.
3. Run `node tools/solve.mjs <id> --write`. The solver records a solution and sets par to the fewest reflects it can find. It refuses to write when that beats the par you intended; that's a bypass.
4. If you want to see how it was solved, run `node tools/trace.mjs <id>` (add `--solve 0` to trace the bypass instead).
5. Run `npm test`. Solver results are cached in `test/.solve-cache.json` (commit it). Editing one room re-solves only that room. Any change to the sim, objects, projectiles or tunables re-solves everything.

## Rules the code enforces

- **Determinism.** No `Math.random`, wall clock or variable dt in `src/sim`. Every timer is an integer frame count.
  The tests replay each room's solution twice in Node, then again in Chromium, and require identical end-state hashes.
- **Contracts.** Each projectile or object type is checked against its interface, including purity and no input mutation.
- **Law 1.** Nothing in `objects/` reacts to the player. A unit test walks the player through a switch.
- **Reflect count.** A press counts as one reflect if it redirects anything, however many projectiles it catches. A whiff costs nothing.

## Room schema notes

The schema is the GDD's, with these clarifications:

- `tiles` is an array of 17 strings (`#` solid, `.` empty). One string with rows split by `\n` is also accepted.
- An emitter fires shot *k* at `phase + k·period` for *k ≥ 1*, so every shot, including the first, gets its 0.5 s telegraph. `period` must exceed the telegraph.
- A door is `{ kind:"door", id, at, h=3, open=false }` and grows down from `at`. A switch is `{ kind:"switch", at, links, mode:"once"|"toggle" }`.
- `solution` is `"1:"` followed by run-length-encoded per-frame input masks in base 36. See `src/sim/input.js`.
