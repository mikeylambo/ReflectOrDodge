# Art bible (draft, M2 first pass + reference art)

Status: a **draft**. The GDD locks this after the first art pass, and it needs Mike's review. In-room art is code in `src/present/` (vector shapes on canvas), so changing it never touches collision (shell constitution rule 6). Painted art appears only on full-screen cards (see **Painted art**).

## Reference art (`docs/art/`)

| File | What it fixes |
| --- | --- |
| `character-turnaround.jpg` | The player: a kid in an indigo beanie, round glasses, cream sweatshirt and sweatpants, white sneakers |
| `pose-sheet.jpg` | Idle, run, glasses push, open-palm reflect |
| `key-art.jpg` | The reflect moment: amber in, cyan out, dashed ghost lines |
| `examiner-ch1.jpg` | Chapter 1 Examiner: octagon, eye states, gold hex core on a tether |
| `title-card-ch1…4.jpg` | Chapter cards: Answer (teal rings), Weight (slate slabs, the Anchor cube), Ground (moss, Seed platforms), Echo (violet, mirror floor) |

The shipped cards are `src/assets/title-cards/ch1…4.webp` (1600×900).

## Principles

1. **A playable diagram.** Dark field, thin luminous lines, bright geometric actors. Nothing decorative competes with a gameplay read.
2. **Shape and behaviour before colour** (law 7). Every category reads by silhouette alone:

   | Thing | Silhouette | Motion / tell |
   | --- | --- | --- |
   | Player | beanie on a cream body (see **Player**) | run stride; arms up in the air; open palm on reflect |
   | Orb | circle with a bright core | straight line, short trail |
   | Anchor | heavy square with a cross-brace | slower, never stops at walls or switches |
   | Seed | diamond | sticks as a slab with a draining life bar, blinks before expiring |
   | Emitter | square with a muzzle on its firing side | charge glow 0.5 s before each shot; pips = shots left |
   | Switch | diamond inside a square | fills when fired; **toggle** switches add a ring |
   | Door | barred slab | slides with a light trail; dashed outline when open |
   | Breakable wall | cracked panel (light) / riveted slab (heavy) | debris on break |
   | Spikes | three teeth on a base plate | static |
   | Exit | glowing frame | slow pulse |
   | Examiner body | chamfered octagon, rings, an eye that follows you | collapses along your reflections |
   | Examiner core | hexagon with a dark centre | breaks only to a reflected projectile |

3. **Gameplay colours are constant across chapters.** Orb amber, reflected projectiles cyan, emitters red, switches green, doors violet, hazards rose, cores gold.
4. **Links are always visible.** Faint dashed lines join each switch to its doors from room start. A one-shot switch's lines fade once it has fired.

## Chapter palettes and motifs

Each chapter gets **one accent hue** and **one background motif**. The accent tints only the architecture (tile edges, grid, motif), never an actor (`src/present/theme.js`, `CHAPTER_ART`).

| Chapter | Accent | Motif | Reading |
| --- | --- | --- | --- |
| 0 Prologue | ice `#7fd4ff` | none | the bare diagram |
| 1 Answer | teal `#6fd3c1` | concentric rings, off-centre | answers spreading outward |
| 2 Weight | slate `#9aa6c8` | heavy slanted strata | mass and pressure |
| 3 Ground | moss `#9be37a` | rising tendrils | growth: reflecting builds your route |

High-contrast mode drops the motif, uses a pure black field and white edges, and keeps every silhouette.

## Player

The collision box is **14×22 px** on a 960×540 canvas, so the sheet's face and fabric detail can't survive. What reads at that size is the **indigo beanie on a cream body**. The figure is vector shapes drawn inside the box (`drawPlayer` in `src/present/render.js`): hat and cuff, hair, face, one round lens on the near side, sweatshirt, legs, shoes.

- **Beanie colour** is indigo `#5865f2` (cuff `#8590ff`), not the sheet's violet. Violet is taken by doors (`#c49bff`) and Chapter 4's accent (`#d7a6ff`).
- **One lens, not two.** A frame line across the whole face reads as sunglasses at this size.
- **Glow** stays faint (blur 5). More turns the cream body blue.
- Body and reflect poses may reach a few px outside the box, the way a raised hand does. The box never changes.

## Player animation list (GDD) and status

| Animation | Status |
| --- | --- |
| idle, run (stride) | done |
| jump (arms up), fall (arms out) | done, chosen by vertical speed |
| land (squash), jump (stretch + afterimage) | done |
| reflect ×5: open palm right / left (wide stance on the ground) / up / down; **neutral = glasses push with a lens glint** (from the pose sheet) | done, held while the reflect arc lives; spark at the palm |
| death (burst into the killer's shape) | done |
| idle fidget (glasses push after standing still) | not done |

## Painted art

Painted art (title cards, key art, store art) is **never drawn behind a room**:

- **Arches are exits.** The cards are full of glowing arched frames with a dot on a dashed line. In a room the exit is a glowing frame, so behind play they would be false exits.
- **Gameplay colours are reserved.** TC4 has red emitters and dashed red lines. Red, amber, cyan, green, violet and gold mean actors; a background may not use them.
- **Rooms are flat.** The cards' perspective blocks are fine full screen. In-room tiles stay flat 2D so solid is never in doubt; if a parallax layer is added later, it must be flat, unlit and dimmer than the tile edges.

Chapter cards show full screen the first time a chapter is entered (`drawCard` in `src/shell/app.js`, timing in `config/ux.js` `CARD`), then fade to the room. The Prologue has none: it is the bare diagram.

## Provenance (launch requirement)

Record where every shipped image came from. If any of it is AI-generated, Steam's Content Survey requires a disclosure (pre-generated content), and the store page shows it. The reference art and title cards here need their source confirmed by Mike before they ship.

## VFX language

Rings mean impact or trigger. Pulses (expanding squares) mean a target answered. Particles take the shape of the thing that caused them. Light trails mean doors moving. Reduced flashing removes white flashes and softens glows; screen shake is optional.

## To decide before content production

- Whether the player stays vector or moves to frames rendered from a 3D model (Meshy → rig → orthographic render). Vector until then.
- The Examiner's form per chapter. Chapter 1's is the octagon; later chapters should vary the silhouette, not just the colour.
- UI typography: the monospace placeholder is the system stack today.
- Capsule and store art.
