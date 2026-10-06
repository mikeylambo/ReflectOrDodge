# Image-generation prompts (Gemini / GPT)

Prompts for concept and marketing art. **None of this ships in the game as-is.** The in-game hero is drawn in code (`src/present/hero.js`); these images are reference for him and source material for store and menu art. Generated images drift between runs, so pick the strongest result, then keep the in-game figure matched to it.

Every prompt repeats the core description, because neither model remembers a previous image reliably.

## The core description (paste into every prompt)

> A small, slender young hero for a 2D puzzle-platformer. Indigo knit watch cap (beanie) with a folded cuff in a lighter periwinkle; round black-framed glasses; pale, warm cream-white clothes (a simple long-sleeve top and trousers) and skin. Calm, thoughtful expression, a little bookish. He never carries a weapon and never fires anything: open hands, relaxed posture. Not a robot, no helmet, no armour, no arm cannon, no scarf, no hood.

**Palette to hold:** indigo `#5b5fae`, periwinkle `#8387cf`, cream `#f3ece0`, frame black `#1c2030`, background near-black navy `#07080d`. Accent light: ice blue `#7fd4ff` and amber `#ffb347`.

**Avoid (add as negatives where the tool allows):** blue bodysuit, helmet, arm cannon, armour, visor, scarf, hood, cape, weapon, gun, sword, anime sparkle eyes, chibi proportions, text, watermark, logo.

## 1. Character turnaround (the main reference)

> Character turnaround sheet, front, three-quarter, side and back views, full body, standing in a neutral pose, evenly spaced on a plain dark navy background (#07080d), soft rim light in warm white. [core description] Clean vector-like rendering with flat shapes and minimal shading, crisp silhouettes, consistent proportions across all four views, about 6 heads tall. No text.

Then ask for: *"Same character, same sheet, add a close-up of the head in three-quarter view showing the glasses and the beanie cuff."*

## 2. Pose sheet: the frame-grab reflect

> Pose sheet of the same character, four poses in a row on a dark navy background: (1) idle, (2) running mid-stride, (3) touching the side of his glasses with his far hand, lenses catching a bright flash, (4) the same hand still on the glasses while his near hand is held out open-palmed, deflecting a small glowing amber orb that turns ice blue as it bounces away along a curved arc of light. [core description] Flat vector style, strong silhouettes, his face is never covered by his arms.

## 3. Key art / store capsule

> Key art for a minimalist puzzle-platformer called REFLECT / DODGE. A small cream-white figure in an indigo beanie and round glasses stands on a thin glowing floor line in a vast dark navy chamber drawn like a luminous technical diagram: faint grid, thin cyan and teal lines, concentric rings in the background. Several glowing amber orbs streak toward him along dashed trajectory lines; one has just been deflected at his open palm and leaves in ice blue. His glasses glint. Calm, precise, quiet mood rather than action-movie. Lots of negative space at the top for a logo. Cinematic but restrained lighting, soft bloom on the light sources. No text.

Sizes to request: 1232×706 (Steam main capsule area), 920×430 (header), 600×900 (vertical capsule), 3840×1240 (library hero, no figure crop at the edges).

Leave the logo off. The real wordmark is `src/present/brand.js` (`wordmarkSVG`), placed over the art afterwards so the letters stay exact.

## 4. Chapter title cards

One per chapter. Same base prompt each time; swap the line in brackets.

> A wide, quiet establishing image of an abstract chamber drawn as a luminous diagram on a near-black navy field, with the small cream-white hero in an indigo beanie standing small in the lower third for scale. [chapter line]. Flat vector style, thin glowing lines, soft bloom, no text.

| Chapter | Chapter line |
| --- | --- |
| 1 Answer | Teal light; concentric rings spread outward from an off-centre point like ripples. |
| 2 Weight | Slate blue-grey light; heavy slanted horizontal bands press down; a grey square block hangs in the air. |
| 3 Ground | Moss green light; thin tendrils grow upward; small diamond-shaped green platforms float in a rising line. |
| 4 Echo | Soft violet light; red square emitters on the walls, two of them dark and switched off. |

## 5. The Examiner (one shape with variations)

> A large, silent geometric guardian made of light: a wide chamfered octagon body with concentric elliptical rings inside and a single round eye in the centre that follows the viewer, a hexagonal golden core hanging below it. Magenta-pink outlines (#ff8fd8) on a dark violet fill, on a dark navy background. Calm, watchful, not monstrous. Flat vector style, thin glowing lines. No text.

Variation lines to append per chapter, keeping the same octagon and eye: *Weight: the rings are thick and stacked like strata, the body sits lower and heavier.* · *Ground: thin root-like lines grow from the bottom edge of the octagon.* · *Echo: the outline is doubled, a faint offset copy trailing behind it.*

## Tips

- **Gemini** holds a character better when you upload the previous best image and ask for "the same character" in a new pose. Do that for every pose after the turnaround.
- **GPT** follows layout instructions (rows of poses, empty space for a logo) more literally; use it for sheets and capsules.
- If the hero drifts toward a blue bodysuit or a helmet, that's the Mega Man pull: add the negatives again and restate "cream-white clothes, knit beanie".
- Keep a folder of approved images in `docs/art-ref/` (not shipped) so later prompts can reference them.
