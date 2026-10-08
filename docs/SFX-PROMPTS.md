# Sound effect prompts

Prompts for an AI sound-effect generator (ElevenLabs Sound Effects, Stable Audio, or similar). Each sound has a file name: drop the file into `src/assets/sfx/` and it replaces that event's synth placeholder. No code change needed. `.ogg` is preferred; `.mp3` and `.wav` also work.

A type-specific file wins over the plain one, so `projectile.destroy.charge.ogg` plays for Charges and `projectile.destroy.ogg` for everything else.

## The house style (paste into every prompt)

> Minimal, clean, glassy sound design for a calm, precise 2D puzzle-platformer drawn as glowing diagrams of light. Soft synthetic and crystalline tones, like light on glass and quiet machinery. Dry, close, short tail, no music, no voices, no ambience. Mono, peak at −1 dBFS, silence trimmed from both ends.

**Hold to:**
- **Pitch near D.** The game shifts sounds by pitch (the chapter's key, a reflect's direction), so record them neutral, centred on D.
- **Short.** Most of these play many times a minute. Keep them under 0.3 s unless noted.
- **Gentle.** Nothing harsh, metallic-clanky, cartoonish, or "laser gun". The hero never fires anything.

## Gameplay

| File | When it plays | Length | Prompt (after the house style) |
| --- | --- | --- | --- |
| `projectile.reflect` | The hero redirects a projectile. The game pitches it by direction (up highest). The most important sound in the game. | 0.15 s | A bright, satisfying glass "tink" with a quick shimmer, like a crystal lens catching light; crisp attack, tiny sparkle tail. |
| `reflect.open` | The reflect button is pressed (the timing window opens) | 0.04 s | An almost inaudible high tick, like a fingernail tapping thin glass. |
| `emitter.telegraph` | Half a second before an emitter fires | 0.5 s | A soft rising charge-up hum, a gentle swell of filtered synth that brightens toward the end. |
| `emitter.fire` | A shot leaves an emitter | 0.08 s | A soft, muted "thup", a small puff of light leaving a tube; low and round, not a gunshot. |
| `emitter.fire.splitter` (optional) | A Splitter shot leaves | 0.1 s | The same soft "thup", with a faint double click as if two halves are packed inside. |
| `emitter.fire.anchor` (optional) | An Anchor shot leaves | 0.15 s | A heavy, low, soft thud, like a stone block released, dull and weighty. |
| `emitter.off` | A reflected shot hits its emitter and shuts it down | 0.6 s | A machine powering down: a descending synth whine fading into silence, gentle and final. |
| `switch.hit` | Any projectile fires a switch | 0.4 s | A low, resonant crystal chime, two notes a fifth apart, like striking a glass bowl softly. |
| `door.open` / `door.close` | A linked door slides | 0.35 s | Open: a smooth mechanical slide with a light rising whoosh, ending in a soft click. Close: the same, falling, ending in a soft seat. |
| `wall.break` | An Anchor or reflected shot smashes a breakable wall | 0.3 s | A pane of thick frosted glass cracking and crumbling into small pieces; brief, not violent. |
| `wall.break.heavy` (optional) | A heavy wall breaks, in place of `wall.break` | 0.45 s | A thicker stone-and-glass slab breaking, lower and weightier. |
| `charge.bounce` | A Charge ricochets off a wall. The game raises the pitch with each bounce; on the third it turns lethal. | 0.07 s | A tight electric "tick" off a hard surface, a small spark; dry and quick. |
| `charge.hot` (optional) | The bounce that makes a Charge lethal (its third), in place of `charge.bounce` | 0.25 s | A short ignition crackle with a rising electric whine, a warning that something just became dangerous. |
| `projectile.mirror` | A Twin's partner mirrors your reflect | 0.12 s | Two soft glass tones a fifth apart, a few milliseconds apart, like an echo answering instantly. |
| `seed.stick` | A Seed sticks into a surface and becomes a platform | 0.12 s | A soft wooden-glass "tock" with a tiny sprout of brightness, like a seed taking root in crystal. |
| `seed.expire` | A planted Seed fades away | 0.25 s | A gentle airy dissolve, a soft downward breath of glitter. |
| `projectile.destroy` (optional) | Any projectile ends on a wall or object. Very frequent: keep it nearly silent. | 0.05 s | A tiny soft puff, a light blinking out. |
| `player.jump` | The hero jumps | 0.06 s | A light cloth-and-air "fwip", soft and quick. |
| `player.land` | The hero lands | 0.05 s | A soft footstep on a hard smooth floor, muted, barely there. |
| `player.death` | The hero is hit | 0.25 s | A muted glass "tunk" with a short downward pitch bend and a soft scatter of light; disappointing, not violent or gory. |
| `room.clear` | A room is cleared | 0.6 s | A short resolving four-note crystal arpeggio rising to the octave, warm and rewarding, a small "you got it". |

## The Examiner

| File | When it plays | Length | Prompt |
| --- | --- | --- | --- |
| `examiner.core` | One of its cores breaks | 0.9 s | A bright crystal bell struck once, with a shimmering glass-shatter overtone and a long soft ring. |
| `examiner.defeat` | The last core breaks: the Examiner collapses along your reflections in slow motion. The design doc wants a full musical cadence here. | 1.8 s | A slow, resolving cadence of layered glass chimes and a soft synth pad, descending then settling on the home chord; reverent and calm, like a great machine coming to rest. |

## Menus

| File | When it plays | Length | Prompt |
| --- | --- | --- | --- |
| `ui.move` | Focus moves in a menu | 0.035 s | A tiny soft tick, almost nothing. |
| `ui.accept` | A choice is accepted | 0.12 s | A light two-note rising glass blip. |
| `ui.back` | Back / cancel | 0.09 s | A light falling glass blip, the mirror of accept. |

## Tips

- Generate 3–4 takes of each and pick one; ask for "single hit, no repeats".
- If a sound comes back too long, trim it in Audacity and fade out the last 20 ms.
- Keep `projectile.reflect`, `emitter.fire`, `player.land` and `ui.move` the quietest and shortest: they repeat the most.
- Test in the busiest rooms (Chapter 8's The Gauntlet, any Examiner) before settling.
