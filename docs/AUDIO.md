# Audio: semantic event map

Gameplay emits semantic events; `src/engine/audio.js` alone decides what they sound like (shell constitution rule 17, GDD law 5). Nothing is tempo-locked.

| Event | When | Sound (placeholder synth) |
| --- | --- | --- |
| `reflect.open` | Reflect pressed | faint high tick |
| `projectile.reflect` | something redirected | bright square tone, **pitched by direction** (up highest → down lowest) |
| `emitter.telegraph` | 0.5 s before a shot | rising triangle sweep |
| `emitter.fire` | shot leaves | short falling blip (scheduled ahead when the audio offset is positive) |
| `emitter.off` | reflected hit shuts it | long descending saw |
| `switch.hit` | any projectile fires a switch | low resonant fifth |
| `door.open` / `door.close` | linked door moves | mechanical triad, up / down |
| `wall.break` | breakable wall smashed | (uses the impact particles; no sound yet) |
| `seed.stick` / `seed.expire` | Seed becomes / stops being a platform | (no sound yet) |
| `examiner.core` | a core breaks | (no sound yet; uses the target tone family in M3) |
| `player.jump` / `player.land` | | soft steps |
| `player.death` | | short muted hit |
| `room.clear` | | resolving four-note chord |

## Ambient bed (`src/engine/music.js`)

- Audible voices = live emitters in the room, from 0 to 4 above a drone. Shut an emitter off and its voice fades out.
- Each voice loops on its own period (9.0, 6.0, 6.7, 7.3 and 8.1 s), so they phase against each other and never share a beat.
- Each chapter has a root note: D for Chapters 0 and 1, E for Chapter 2, F for Chapter 3. Event sounds transpose by the same ratio, so a busy room stays consonant.

## Calibration

Settings → Audio offset, from −200 to +200 ms in 20 ms steps. Positive means sounds play earlier, to compensate for output latency such as Bluetooth headphones.

Reactive sounds can't play before the event that causes them, so "earlier" applies only where the future is known: emitter shots run on fixed clocks and are scheduled ahead. Every other sound can only be delayed (negative offsets).

## Not done (M3)

Real stems, buses and a voice per projectile type, sounds for walls, seeds and cores, and the Examiner-defeat cadence.
