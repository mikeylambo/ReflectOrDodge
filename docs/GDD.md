# REFLECT / DODGE — GDD & Technical Spec v1

Oct 4, 2026 · @Mike

## Vision

A 2D puzzle-platformer where the only answers to danger are reflect or dodge. Working title: REFLECT / DODGE (final name decided after M1).

**Pitch:** You can't attack, and you can't touch the world. Everything that changes the room is something thrown at you. Let it pass, or send it somewhere else.

**Theme:** you don't overcome force by producing greater force; you learn how to answer it. Carried by mechanics, almost never by text.

**North star (inherited from Living Loop):** read the system, don't memorize the map. Every room is a deterministic machine a sharp player can predict after watching it once. If a room requires dying to learn a hidden sequence, it's broken.

### Design laws (do not re-litigate)

1. **The player is causally inert.** No switches, buttons, pushable blocks or attacks. Only projectiles change the world.
2. **Three verbs: Move, Jump, Reflect.** Dodging is jumping or stepping aside, a voluntary choice to let a projectile reach its default destination.
3. **Decisions over execution.** Slow, telegraphed projectiles; generous reflect window; difficulty comes from routing and sequencing, not timing.
4. **Deterministic rooms, instant reset.** Fixed 120 Hz simulation, no randomness, death or manual reset returns to room start with no transition.
5. **Independent clocks, reactive audio.** Each emitter runs its own cycle. Sound reacts to events; nothing is tempo-locked.
6. **Composition before new mechanics.** A new projectile type is added only when combinations of existing ones are exhausted.
7. **Shape and behavior before color.** Every projectile and target type is readable by silhouette and motion alone.
8. **Elegant solutions are expression.** Alternate solutions that use fewer reflects are features, rewarded by medals, not bugs to patch.
9. **Four directions plus neutral.** Diagonal reflection is reserved for the sequel.

## Player

The player has three verbs. All numbers below are starting tunables, set in `config/tunables.js` and tuned in the editor, never inline.

### Move and jump

Living Loop's throttle movement doesn't apply; this is a conventional platformer. Variable-height jump (release early to cut), coyote time and jump buffering. No double jump, dash, wall jump or crouch.

| Tunable | Start value |
| --- | --- |
| Run speed | 180 px/s |
| Gravity | 1500 px/s² |
| Jump apex height | 64 px (about 3 player heights) |
| Coyote time | 0.08 s |
| Jump buffer | 0.10 s |

### Reflect

Press Reflect to open a reflect window around the player. Any reflectable projectile inside the zone during the window is redirected. The held direction at the moment of contact decides where it goes.

| Input held | Outgoing direction |
| --- | --- |
| Left / Right / Up / Down | That direction, at the projectile's current speed |
| Neutral | Straight back along its incoming path ("return to sender") |

Rules:

- Works on the ground and in midair. Reflecting in midair doesn't alter the player's momentum.
- One press can reflect several projectiles if they arrive in the same window. All go in the held direction.
- Down sends the projectile into the floor beneath, where it behaves per its type (most bounce back up; Seeds stick).
- A reflected projectile can still kill the player if it returns.
- Reflect has a short cooldown after the window closes, so it can't be held open by mashing.

| Tunable | Start value |
| --- | --- |
| Reflect zone radius | 28 px from player center |
| Reflect window | 0.20 s |
| Cooldown | 0.25 s |
| Hitstop on reflect | 0.06 s |

### Death and reset

Any unreflected contact with a lethal projectile or hazard kills instantly. The room resets to its start state on the next frame; R resets manually. No lives, no checkpoints inside a room.

### Controls

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | A/D or arrows | Left stick / D-pad | Left thumb pad |
| Jump | Space / W / Up | A / Cross | Right button |
| Reflect | J / K / Shift | X / Square or RB | Right button (second) |
| Direction for reflect | Held move/aim direction | Left stick / D-pad | Left thumb pad |
| Reset room | R | Back / Select | Reset icon |

Touch reflect direction needs a playtest. Up/down on a virtual pad competes with movement, and mobile may need a swipe-on-reflect-button alternative.

## Projectiles, emitters and targets

Six projectile types, one introduced per chapter. Every type is a module against a single interface (see Technical architecture), so adding one never touches the engine.

### Projectiles

All projectiles travel in straight lines at constant speed unless their type says otherwise, show a short ghost line of their upcoming path, and bounce off solid walls only if their type says so. Base speed starts at 140 px/s, roughly one second to cross a third of the room.

| Type | Silhouette | Reflectable | On hitting a wall | Special behavior | Puzzle role |
| --- | --- | --- | --- | --- | --- |
| Orb | Circle | Yes | Destroyed; triggers whatever it hits | None | Baseline: the routing primitive |
| Anchor | Heavy square | No (kills on contact) | Smashes breakable walls Orbs can't | Slower, unstoppable | Forces a jump; breaks heavy walls by its default path |
| Seed | Diamond | Yes | Sticks and becomes a one-way platform for a fixed time | Platform expires after a tunable time | Reflecting builds your route |
| Splitter | Triangle | Yes | Destroyed | Splits into two on reflect, at ±45° of the outgoing direction | Power with a cost: doubles your problems |
| Charge | Ring | Yes | Bounces | Speeds up 25% per bounce; lethal at max speed | Reflect it early or let it ricochet into danger |
| Twin | Linked pair | Yes | Destroyed | Reflecting one mirrors the reflection onto its twin | Late-game: one input, two outcomes |

### Emitters

An emitter fires a fixed projectile type in a fixed direction on its own clock: `{ type, direction, period, phaseOffset, count }`. An emitter shows a charge-up telegraph for 0.5 s before each shot. Hitting an emitter with a reflected projectile shuts it off permanently for that attempt (the "return to sender" payoff).

### Targets and room objects

| Object | Triggered by | Effect |
| --- | --- | --- |
| Switch | Any projectile hit | Toggles linked doors; one-shot or toggle per room data |
| Door | Linked switch | Opens or closes; blocks player and projectiles |
| Breakable wall | Orb (light) or Anchor (heavy variant) | Destroyed permanently for the attempt |
| Emitter | Reflected projectile | Shuts off |
| Exit | Player touch | Completes the room; may start locked behind a door |
| Spikes | Static hazard | Kills on contact; projectiles pass over |

Targets react only to projectiles. The player walking into a switch does nothing, which is law 1 made visible.

## Content structure

Target is about 330 rooms: 8 chapters × 20 core rooms, a mirror twin for each, and 8 Examiner encounters. If M1 shows orb-only rooms run dry before 20, the target drops to about 200 rather than padding.

### Rooms

Every room is a single screen (canvas 960×540 logical, 30×17 tiles of 32 px). A first solve should take 30 s to 3 min for a competent player; a known solution should execute in under 20 s.

### Chapters

| # | Name (working) | Introduces | Teaching focus |
| --- | --- | --- | --- |
| 0 | Prologue | Orb, Reflect | Wordless tutorial, 3 unscored rooms |
| 1 | Answer | Orb, switches, doors | Reflect vs let pass; consequences |
| 2 | Weight | Anchor | Read properties; forced jumps; heavy walls |
| 3 | Ground | Seed | Reflect to build your own route |
| 4 | Echo | Emitter shutdown, neutral reflect | Return to sender; sequencing |
| 5 | Fracture | Splitter | Power with a price |
| 6 | Momentum | Charge | Act early or lose control |
| 7 | Bond | Twin | One answer, two outcomes |
| 8 | Mastery | Nothing new | Recombination only; the game's real test |

### Mirror rooms

Each core room has a twin with the same geometry and one changed property: a type swap, a reversed emitter, a moved exit, a shifted phase. A mirror room unlocks when its core room earns Gold.

### World map

A clean node diagram, not a walkable overworld. Each chapter is a grid of 20 rooms with a few soft dependencies. Clearing 15 opens the Examiner; beating the Examiner opens the next chapter. Mirror rooms live on the flip side of the same grid.

### Medals

Reuses Living Loop's medal system, with reflect par replacing time par.

| Medal | Requirement |
| --- | --- |
| Bronze | Room cleared |
| Silver | Cleared at or under the room's reflect par |
| Gold | Cleared at or under par in a single attempt with zero deaths since entering the room |

Par is the designer's minimal reflect solution, verified by the solver in CI (see Testing). Finding a solution under par shows a special mark; those are expression, not bugs.

### The Examiner

One encounter per chapter. The Examiner is a large geometric presence that fires that chapter's projectile type in escalating phases. You never attack it. It's defeated only by your reflections, usually through targets on its body that open as phases progress. Each encounter is 3 phases, each phase is itself a deterministic room, and death restarts the current phase only.

## Story, art and audio

### Story layer (provisional)

Current direction: wordless and environmental, with the Examiner as a silent presence whose attack patterns are its voice, and exactly one line of text at the very end. Revisit once art is in motion; the art may push this toward pure environmental or toward more Examiner presence.

Environmental storytelling candidates: emitters as leftover machinery, faded silhouettes of earlier challengers frozen mid-reflect, and the world visibly repairing as chapters clear. No dialogue system is built until this decision locks.

### Art direction

A playable diagram. Dark backgrounds, a luminous simple humanoid player, bright geometric projectiles, and nothing decorative competing with gameplay readability.

- **Reflect** shows as a brief luminous arc on the side of the held direction.
- **Movement** leaves a short afterimage on jumps.
- **Ghost lines** show each projectile's next path segment, faint and dashed.
- **Each chapter** gets one accent hue and one background motif; gameplay colors stay constant across chapters.
- **Colorblind safety:** every type is distinct by silhouette and motion first.

Gameplay authority stays in simple geometry; presentation is mounted separately (shell constitution rule 6), so art upgrades never touch collision.

### Audio

Reactive, never tempo-locked. Emitters, reflects, hits, splits and door changes emit semantic events (`projectile.reflect`, `emitter.fire`, `switch.hit`), and the audio layer picks the sounds. Reuse Living Loop's look-ahead scheduler, calibration slider and voice limiter. Each chapter's ambient bed is harmonically compatible with that chapter's event sounds, so a busy room sounds composed rather than noisy.

## Technical architecture

Web-first: Vite + Canvas2D, built on two existing codebases. Ship targets are web/itch first, Steam via Tauri or Electron, mobile via Capacitor.

### What comes from where

| Need | Source | Action |
| --- | --- | --- |
| Fixed 120 Hz loop, interpolated render | Living Loop `engine/loop.js` | Reuse as is |
| Unified input (keys, touch) | Living Loop `engine/input.js` | Extend: add reflect + held direction, gamepad |
| Reactive audio, scheduler, calibration | Living Loop `engine/audio.js` | Reuse; add new semantic events |
| Tunables in one file | Living Loop `config/tunables.js` | Reuse pattern, new values |
| Level-as-data, module-per-type interface | Living Loop `level.js` + `patterns/_pattern.js` | Adapt: patterns become projectile types and room objects |
| Medals and progress | Living Loop `game/progress.js` | Adapt: reflect par instead of time par |
| Solvability and comfort tests | Living Loop `test/` | Adapt the BFS to the new action space |
| Menus, pause, results, settings, saves | Web Shell, platformer + puzzle Frames | Reuse via generator, Canvas2D adapter |
| Gamepad/keyboard UI navigation | Web Shell UI shell | Reuse |
| Input replay, ghosts | Web Shell `replay/` | Reuse for solution replays and bug repro |
| Player physics, reflect, projectiles, room objects | New | Build |
| Level editor | New | Build (see below) |

### Core interfaces

A **projectile type** module, mirroring Living Loop's pattern contract:

- `spawn(params) -> state`
- `step(state, dt, world) -> { state, events[] }`. Pure: same input, same output.
- `onReflect(state, direction) -> state[]`. Returns an array so Splitter can return two.
- `onHit(state, object) -> { state | null, events[] }`
- `render(ctx, state, alpha, theme)`
- `tunables`

A **room object** module (switch, door, wall, emitter, exit) follows the same shape: `step`, `onProjectileHit`, `solids()`, `render`.

A **room** is data:

```json
{
  "id": "c1-04",
  "tiles": "<30x17 grid string>",
  "spawn": [3, 14],
  "emitters": [{ "type": "orb", "at": [28, 6], "dir": "left", "period": 2.4, "phase": 0.0 }],
  "objects": [{ "kind": "switch", "at": [15, 2], "links": ["d1"] }, { "kind": "door", "id": "d1", "at": [29, 13] }],
  "exit": [29, 14],
  "par": 1,
  "mirrorOf": null
}
```

### Determinism

No `Math.random`, no wall-clock reads in simulation, no variable dt. Simulation state is plain data so a room can be stepped headless. Input replay of a recorded run must reproduce the identical final state bit for bit; this is a CI test.

## Assists, stuck players and saves

These three systems touch the simulation and save format, so they're locked before M0.

### Assist mode

All assists are off by default, toggleable any time from pause, and never lock or mark medals.

| Assist | Options | Implementation note |
| --- | --- | --- |
| Game speed | 100% / 75% / 50% | Scales the sim step count per real second; the sim itself stays at fixed 120 Hz, so determinism holds |
| Reflect window | Normal / Wide (×1.5) / Very wide (×2) | Reads from tunables via an assist multiplier |
| Reflect preview | Off / On | While Reflect is held, draw the outgoing path for each projectile in the zone for every direction; render-only, no sim effect |
| Invincibility | Off / On | Projectile contact doesn't kill; projectiles still collide and trigger as normal |
| Input remapping | Full remap, all devices | Shell input layer |
| Visual | High-contrast mode, reduced flashing, screen shake off | Presentation layer only |

Rule: an assist may change timing and information, never room logic. A solution found with assists on must work identically with them off.

### Stuck-player system

Three layers, each unlocking later than the last so players get time to solve it themselves first.

1. **Skip.** Each chapter needs 15 of 20 rooms to open its Examiner, so up to 5 rooms can be left unsolved at no cost.
2. **Hint ghost.** After 10 deaths or 3 minutes in a room, a hint icon appears. Using it plays a translucent ghost of the first reflect of the designer's solution, then stops. Hints used are recorded but don't affect medals.
3. **Solution replay.** After Bronze, the full designer solution can be watched from the results screen. This also teaches par: the player sees how the minimal solution works.

Every room ships with a recorded designer solution (input log) as part of its data. The CI par check replays it, so hints and replays can never be out of date.

### Save schema (v1)

One JSON blob in shell persistence, versioned for migration.

```json
{
  "version": 1,
  "rooms": {
    "c1-04": { "cleared": true, "bestReflects": 1, "medal": 3, "deaths": 14, "hintsUsed": 0, "bestTimeMs": 8420 }
  },
  "chapters": { "c1": { "examinerDefeated": true } },
  "mirrorsUnlocked": ["c1-04"],
  "assists": { "speed": 1.0, "window": 1.0, "preview": false, "invincible": false },
  "settings": { "audioOffsetMs": 0, "musicVol": 0.8, "sfxVol": 1.0, "highContrast": false, "shake": true },
  "stats": { "totalDeaths": 0, "totalReflects": 0, "playTimeMs": 0 }
}
```

Room records are keyed by stable room ID, never list position, so rooms can be reordered or inserted after launch without breaking saves. Mirror rooms are derived from Gold medals, not stored separately except as an unlock cache.

Room data also gains one field: `"solution": "<compact input log>"`.

## UX and screens

The shell provides the scaffolding; this section defines what each screen does and shows. Text is minimal throughout (shell constitution rule 8).

| Screen | Shows | Notes |
| --- | --- | --- |
| Title | Game name, animated room behind it running a demo solution | Any input continues |
| Chapter map | Room grid as a node diagram, medal glyph per node, Examiner node, mirror flip toggle | Cursor remembers last room; locked rooms shown, unlock condition shown by icon |
| Room intro | Room name and par, 0.8 s, skippable | Shown on first entry only |
| In-room HUD | Reflects used / par, hint icon when available | Nothing else; no timer unless speedrun mode |
| Pause | Resume, reset, hint, assists, settings, back to map | Reset also on R / Select |
| Results | Medal earned, reflects vs par, deaths, watch solution (after Bronze), next / retry / map | Next is the default focus |
| Settings | Audio, calibration slider, video, controls and remap, assists, accessibility | Shell settings, extended |
| Credits | Single scrolling screen | Plays after the final Examiner |

Navigation must be complete on keyboard, gamepad and touch, from boot to credits.

## Onboarding

Wordless. Each new projectile type is taught with a three-room pattern:

1. **Safe introduction.** The type appears where it can't hurt you, so you watch its behavior once.
2. **Single use.** One instance, one obvious correct answer.
3. **Twist.** The obvious answer fails; the room teaches the type's limit.

Prologue (3 unscored rooms): walk and jump with no threats; an Orb fires into a wall beside you, then a switch is placed where reflecting up hits it; finally an Orb aimed at you with the exit behind a door.

Input prompts appear only as device glyphs (never words), fade after first use, and switch automatically with the active device.

## Game feel

Every feedback layer, with starting values. Presentation only; none of it touches simulation.

| Event | Visual | Audio | Other |
| --- | --- | --- | --- |
| Reflect | Luminous arc on held side, 0.1 s; projectile flashes white | Sharp bright tone, pitched by direction | Hitstop 0.06 s; gamepad rumble light |
| Reflect into target | Target pulses, short particle ring | Lower resonant tone | None |
| Emitter telegraph | Charge glow, 0.5 s | Rising tick | None |
| Jump / land | Squash and stretch, afterimage on jump | Soft step | None |
| Death | Player bursts into the projectile's shape | Short muted hit | Shake 2 px, 0.08 s; reset wipe 0.15 s |
| Door opens | Slides with light trail | Mechanical chord | None |
| Room clear | Room geometry glows outward from exit | Resolving chord in chapter key | 0.6 s before results |
| Examiner defeated | It collapses along the paths of your reflections | Full musical cadence | Slow-motion 0.5 s |

## Art bible (to lock after first art pass)

To be written once first art is in motion, before content production. Must define: chapter palettes and accent hues, the player silhouette and animation list (idle, run, jump, fall, land, reflect ×5, death), projectile shapes and trails, tile set rules, VFX language, UI typography, and the Examiner's form per chapter.

## Level design guide

Rules every room obeys:

- **One idea per room.** If you can't state the idea in one sentence, split the room.
- **Teach, then test.** Each idea appears first in a room that teaches it, later in rooms that test it combined with others.
- **Readable at a glance.** Every emitter, target and door link must be visible from room start.
- **No hidden information.** Nothing offscreen, nothing that appears without telegraph.
- **Jump-solution quota.** At least 1 in 4 rooms per chapter has a solution where letting a projectile pass is the key insight.
- **Difficulty from combination and sequence**, never from tighter timing.

Difficulty rubric per room, 1–5: number of projectiles in play, number of decisions in the solution, and how non-obvious the key insight is. Plot each chapter's rooms on it to keep the curve rising with dips.

Maintain an **ideas catalogue** (a table in the repo: idea, room ID, chapter) so no idea repeats across 330 rooms.

Mirror rooms change exactly one property of the original. The change must require a different solution, verified by the solver failing on the original solution.

## Launch requirements

### Platforms

| Platform | Requirements |
| --- | --- |
| Steam (Win/Mac/Linux) | Tauri or Electron wrapper, achievements, cloud saves, controller glyph switching |
| Steam Deck | Verified: 1280×800 legibility, full controller support, default controller glyphs, no launcher |
| Web / itch | Demo build: Prologue + Chapter 1 |
| Mobile (iOS/Android) | Separate control redesign pass after desktop launch; Capacitor path from Living Loop |

**Achievements:** one per chapter cleared, one per Examiner, Gold-all per chapter, find an under-par solution, finish with zero hints, and a few for total reflects and deaths.

### Telemetry

Opt-in, local-first, anonymous. Per room: attempts, deaths, time to first clear, hints used, quit-while-in-room. Used during playtests and the demo to find rooms that cause quits. No third-party analytics SDK.

### Speedrun support

Optional in-game timer (room, chapter, full game), shown only when enabled. Runs are verifiable by replaying their input log, which determinism makes reliable. Full-game and per-chapter categories; mirror rooms as a separate category.

### Community levels (post-launch)

The editor ships to players after launch. Rooms share as compact codes (compressed room JSON). A shared room must include a recorded solution before it can be exported, so every community room is proven solvable. Steam Workshop is a later step. M3 includes editor polish to player-facing quality.

### Marketing beats

- **Trailer moments:** an Examiner collapsing along your reflections; a long reflect chain; a let-it-pass solution that looks like doing nothing until it pays off.
- **Demo:** Prologue + Chapter 1 + its Examiner, for Steam Next Fest.
- **Store page:** capsule art from the art bible; the one-sentence pitch as the first line.
- **Price:** $15–20 for 300+ rooms.

Localization is limited to UI strings, since the game is wordless.

## Production plan

### Level editor

The editor is the production pipeline and ships in M0, not later. In-browser, same build as the game, behind a dev flag.

- Paint tiles; place spawn, exit, emitters, switches, doors, walls.
- Edit emitter period, phase and direction with live preview of the room running.
- Play-in-editor with one key, back to editing with one key, room state preserved.
- Save and load room JSON to the repo's `levels/` folder; a mirror room is created by duplicating with `mirrorOf` set.
- A timeline scrubber to step the room's clocks forward and back, so you can design without playing.

### Testing

| Test | What it proves | Gate |
| --- | --- | --- |
| Room schema validation | Every room file is well formed and links resolve | CI |
| Determinism replay | Recorded input reproduces identical end state | CI |
| Solvability (BFS) | A solution exists using the real physics | CI |
| Par check | A solution at or under the stated par exists | CI |
| Comfort | The room still solves at coarse input-decision rates, so it doesn't demand tight timing | Diagnostic, flag for review |
| Browser smoke | Boots, renders, 60 fps, zero console errors | CI |

The BFS is the riskiest port. Reflect adds a timed action with five direction choices, which multiplies branching. Search over decision windows (Living Loop's approach), prune states by position bucket plus projectile and object state, and cap search depth per room. If it's too slow for late rooms, fall back to verifying the designer's recorded solution plus the comfort test.

### Milestones

1. **M0, one room, feels good.** Player movement and jump, Orb, emitter, switch, door, exit, reflect with hitstop and arc, instant reset, editor basics. Pass: reflecting is satisfying with nothing at stake.
2. **M1, kill-or-commit.** 20 orb-only rooms built in the editor, medals, determinism and solvability tests in CI. Pass: all three kill criteria below.
3. **M2, vertical slice.** Shell integration (menus, saves, map for chapters 1–3), Anchor and Seed, the first Examiner, first-pass art and audio. Shareable build.
4. **M3, content.** Remaining types, chapters 4–8, mirror rooms, all Examiners, polish, Steam and mobile builds.

### Kill criteria (M1)

- [ ] Rooms where letting a projectile pass is the clever answer feel clever, not like doing nothing.
- [ ] Failures read as misreads of the room, not fumbled timing (confirm with the comfort test plus 3 outside playtesters).
- [ ] Reflect par makes players want to replay a cleared room.
- [ ] 20 distinct orb-only rooms came without padding. If not, cut the room target to about 200.

### Open questions

- Final name, decided after M1.
- Touch input for reflect direction: virtual pad versus swipe on the reflect button.
- Story layer, revisited once art is in motion.
- Whether Examiner phases count toward medals.
- Per-room or per-chapter music beds.

## M0 handoff to Claude Code

Paste this as the kickoff prompt in a new repo that has `living-loop` and `Web-Game-Shell-v1.02` available locally.

```markdown
Build M0 of REFLECT / DODGE, a 2D puzzle-platformer. The full GDD is the source of truth; read it first and treat its Design laws as non-negotiable.

Foundation:
- Start from Living Loop's engine: engine/loop.js (fixed 120 Hz, interpolated render), engine/input.js, engine/audio.js, config/tunables.js pattern, and its test harness approach. Copy, don't import across repos.
- Do NOT integrate the Web Shell yet (that's M2). Keep M0 a single Vite + Canvas2D app.
- Plain JS modules, no new dependencies beyond Vite and Playwright.

Build:
1. Player: run, variable jump, coyote time, jump buffer. All values in tunables.js.
2. Reflect: zone + window + cooldown + hitstop, 4 directions + neutral per the GDD.
3. Projectile type interface (spawn, step, onReflect returning an array, onHit, render, tunables). Implement Orb only.
4. Room objects: emitter (with 0.5 s telegraph, shut off by reflected hit), switch, door, exit, solid tiles.
5. Room loader from JSON per the GDD schema, including the solution field.
6. Instant reset on death and on R.
7. Editor behind ?edit=1: paint tiles, place objects, edit emitter params, play-in-editor toggle, save/load JSON, timeline scrubber.
8. Record input logs; save one as a room's solution.
9. Placeholder visuals per Art direction: dark background, luminous player, ghost lines, reflect arc.

Tests (npm test):
- Room schema validation.
- Determinism: replaying a room's solution log twice yields identical final state.
- Solution check: the stored solution clears the room within par.
- Browser smoke: boots, renders, input works, zero console errors.

Deliver: 3 sample rooms (one let-it-pass solution, one reflect-into-switch, one return-to-sender emitter), each with a recorded solution.

Rules: no Math.random or wall-clock in simulation; one intent per commit; report honestly what was and wasn't tested. Stop at M0. Do not add projectile types, menus or art beyond placeholders.
```

M0 is done when reflecting feels satisfying in those three rooms with nothing else at stake.
