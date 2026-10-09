# Store page draft (Steam)

A draft to edit, not final copy. Room counts are from the current build; recheck them before publishing.

## Name line and short description

Steam's short description is limited to 300 characters. Per the GDD, the pitch goes first.

> You can't attack, and you can't touch the world. Everything that changes the room is something thrown at you. Let it pass, or send it somewhere else. A calm, precise puzzle-platformer about answering force without force.

## Long description

> **You can't attack. You can't touch anything.**
>
> Every switch, door and wall in REFLECT / DODGE is moved by something thrown at you. Orbs, falling weights, seeds that grow into platforms, shots that split in two, sparks that heat up with every bounce, twin shots that mirror each other. You have three verbs: move, jump, and reflect. Send a shot up into a switch. Turn it back on the machine that fired it. Or step aside and let it land where it was always going.
>
> **Read the room, don't memorise it.** Every room is a deterministic machine. Each emitter runs on its own clock, and every shot is telegraphed and readable at a glance. Watch it once and you can predict it. Difficulty comes from routing and sequencing, not reflexes, and reset is instant.
>
> **Fewer answers are better answers.** Each room has a par: the fewest reflects that solve it. Beat it for Gold, find a cleverer route for an under-par star, and Gold unlocks the room's mirror, the same room with one change that needs a different answer.
>
> **Eight Examiners.** Each chapter ends with a silent geometric guardian that tests what the chapter taught you. You never strike it. It falls only to your reflections.
>
> **Made to be finished.** A hint shows a ghost of the first move. Assists slow the game, widen the reflect window, or turn off death. They're there whenever you want them.

## Features

- Nearly 300 hand-made rooms: 8 chapters, mirror rooms, and 8 three-phase Examiners
- Six projectile types, each with one clear rule: Orb, Anchor, Seed, Splitter, Charge, Twin
- No combat, no randomness, no hidden information: every room is a readable machine
- Par, medals and under-par solutions for players who want the elegant answer
- Every room proven solvable by a built-in solver
- Assists: game speed, wider reflect window, invincibility, reflect preview, hints
- Accessibility: high contrast, reduced flashing, screen shake off, a full-room camera
- Full controller support with matching button glyphs; Steam Deck ready
- Speedrun timer with verifiable, replayable runs
- Reactive soundtrack: every live emitter in the room is a voice in the music

## Tags (Steam allows up to 20; the first few matter most)

Puzzle Platformer · Puzzle · 2D Platformer · Minimalist · Logic · Relaxing · Abstract · Precision Platformer · Physics · Singleplayer · Atmospheric · Controller · Short · Indie · Casual · Hand-drawn (only if the painted cards ship) · Great Soundtrack (only once the music is final)

## Screenshots: a shot list

Steam wants at least 5 screenshots at 1920×1080. Take them in capture mode (below), one idea per shot:

1. **The verb.** Mid-reflect in Chapter 1: an orb turning ice-blue off the hero's open hand, a switch lit above. *c1-04 Overhead.*
2. **Let it pass.** A Splitter flying past the hero into the switch it was always going to hit. *c5-06 Let It Fly.*
3. **An Examiner.** The orrery mid-fight, cores lit, a reflected shot on its way up. *Any chapter's Examiner II.*
4. **Weight.** Anchors raining through a room with the hero timing a gap. *c2-12 Curtain or c6-13 Heavy Rain.*
5. **A built route.** Seeds planted as a staircase up a wall. *c3-08 Tower.*
6. **Bond.** A twin pair mid-mirror, both switches lighting at once. *c7-01 Mirror.*
7. **Mastery.** A busy late room with several types at once. *c8-03 The Gauntlet.*
8. **The map.** The chapter map with medals, to show scope.

## Capture mode (screenshots and trailer footage)

Open the game with `?capture=1` (for example `http://localhost:5173/?all=1&capture=1`). It renders at 1920×1080 on any screen.

| Key | Does |
| --- | --- |
| `H` | Hide or show the HUD, onboarding prompts, touch controls and the mouse cursor |
| `[` / `]` | Slow motion: 100% → 50% → 25% → 10%, and back |
| `K` | Save a PNG of the current frame (1920×1080, with post effects) |

For footage, clear a room, choose **Watch solution** on the results screen, press `H`, and record the screen. The solution replays exactly, every time, so a shot can be re-taken until it's right. The GDD's trailer moments:
- an Examiner collapsing along your reflections;
- a long reflect chain;
- a let-it-pass solution that looks like doing nothing until it pays off.
