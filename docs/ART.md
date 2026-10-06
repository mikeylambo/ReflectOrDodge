# Art bible (draft, M2 first pass)

Status: a **draft**. The GDD locks this after the first art pass, and it needs Mike's review. Everything here is implemented as code in `src/present/` (no image assets yet), so changing it never touches collision (shell constitution rule 6).

## Principles

1. **A playable diagram.** Dark field, thin luminous lines, bright geometric actors. Nothing decorative competes with a gameplay read.
2. **Shape and behaviour before colour** (law 7). Every category reads by silhouette alone:

   | Thing | Silhouette | Motion / tell |
   | --- | --- | --- |
   | Player | luminous humanoid (head, torso, limbs) | run stride; arms up in the air |
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

## Locked choices (style tile v3)

- **Wordmark:** concept 1, "Diamond O". Single-stroke letters on a 4×6 grid with 45° cut corners; the O in DODGE is the reflect diamond. The slash runs amber to ice. Source: `src/present/brand.js` (`wordmarkSVG`).
- **Type:** pairing D. Tektur for titles and room names, Doto (dot matrix) for numbers, Atkinson Hyperlegible for menus and body text. Self-hosted in `public/fonts/` under the OFL.
- **Character:** A, a cuffed watch cap in indigo (`#5b5fae`, cuff `#8387cf`) and round glasses. Pale warm body (`#f3ece0`) with a warm glow, off the old ice blue. Source: `src/present/hero.js`.
  - The reflect is a frame-grab: the far hand touches the glasses at the temple, the lenses flash, then the near hand parries toward the aim while the lenses glint that way.
  - No pose crosses the face (the right half of the head when facing right).
  - He never fires: open hands, parry stance. This keeps him clear of Mega Man and Neon Striker.
- **Panels:** square, chamfered corners instead of rounded cards.

## Light and material (first art pass)

The diagram now has depth. All of it is presentation only (`render.js`, `theme.js`), and none of it can change a read:

- **Light pools.** Additive radial light under every luminous actor: the player, every projectile (in its own colour), emitters as they charge, lit switches, closed doors, the exit. Spikes cast a low rose light, baked with the tiles.
- **Material.** Solid blocks get a faint diagonal hatch in the chapter accent and an inner shade on their exposed faces. Walkable tops are lit: a bright accent rim and a short glow above it, so floors read before walls.
- **Atmosphere.** A soft chapter-tinted haze in the upper middle of the room, slow rising dust motes in the accent, and a vignette.
- **Exit.** A doorway of light: a bright floor, a column fading upward, rising sparks.
- **Trails.** Projectile trails are longer and additive.

High contrast turns all of this off: no lights, motes, haze, hatch or vignette. Reduced flashing halves the light pools.

## Chapter palettes and motifs

Each chapter gets **one accent hue** and **one background motif**. The accent tints only the architecture (tile edges, grid, motif), never an actor (`src/present/theme.js`, `CHAPTER_ART`).

| Chapter | Accent | Motif | Reading |
| --- | --- | --- | --- |
| 0 Prologue | ice `#7fd4ff` | none | the bare diagram |
| 1 Answer | teal `#6fd3c1` | concentric rings, off-centre | answers spreading outward |
| 2 Weight | slate `#9aa6c8` | heavy slanted strata | mass and pressure |
| 3 Ground | moss `#9be37a` | rising tendrils | growth: reflecting builds your route |

High-contrast mode drops the motif, uses a pure black field and white edges, and keeps every silhouette.

## Player animation list (GDD) and status

| Animation | Status |
| --- | --- |
| idle, run (procedural stride), jump/fall (arms up) | done (procedural) |
| land (squash), jump (stretch + afterimage) | done |
| reflect ×5 (arc on the held side; full ring for neutral) | done as an arc effect; no body pose yet |
| death (burst into the killer's shape) | done |

## VFX language

Rings mean impact or trigger. Pulses (expanding squares) mean a target answered. Particles take the shape of the thing that caused them. Light trails mean doors moving. Reduced flashing removes white flashes and softens glows; screen shake is optional.

## To decide before content production

- Whether the player gets authored sprites or stays procedural.
- The Examiner's form per chapter. Chapter 1's is the octagon; later chapters should vary the silhouette, not just the colour.
- UI typography: the monospace placeholder is the system stack today.
- Capsule and store art.
