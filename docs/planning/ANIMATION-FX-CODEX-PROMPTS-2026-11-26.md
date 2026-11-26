# Animation FX: Codex prompts (2026-11-26)

For `docs/planning/SCREEN-ANIMATION-PLAN-2026-11-26.md`. Codex is used for ART only; Claude cuts it into small `webp` sprites and wires it. **FX-1 comes first** (the painted steam the developer asked for); it replaces Part 6 of `REMAINING-ART-CODEX-PROMPTS-2026-11-25.md`.

## What is here

| Sheet | What | Size | Save as (repo root, a Codex source folder: not part of the build) | Where it is used |
|---|---|---|---|---|
| **FX-1** | steam and mist wisps (8) | 2048 x 1536 | `FX Assets/FX-1.png` | steam off pots, plates, cups and machines; cold mist |
| **FX-2** | flame loops (3 strips of 6 frames) | 1536 x 960 | `FX Assets/FX-2.png` | the loading screen's brick oven, a stove burner, candles and lanterns |
| **FX-3** | sparkles and glows (8) | 2048 x 1024 | `FX Assets/FX-3.png` | glints on copper, lamp and window glows, magic sparkles |
| **FX-4** | drifting particles (18) | 1536 x 768 | `FX Assets/FX-4.png` | petals, leaves, flour, droplets, bubbles, embers |
| **FX-5** | confetti, coins and stars (16) | 2048 x 512 | `FX Assets/FX-5.png` | celebration cards, the coin pop, shine bursts |

After a sheet is generated, tell Claude "fx sheet 1 is generated" (or 2 to 5): Claude cuts it into `public/kitchen-fx/` (FX-1) or `public/fx/`, trims, converts to WebP, and wires it. A sheet that comes out wrong is simply generated again; sheets do not depend on each other.

## Rules for every sheet

- **Fully transparent background** (real alpha: no checkerboard, no white, no grey, no shadow plate). Soft edges must fade to **fully transparent**, never to a coloured halo.
- One picture per grid cell, in the order listed, centred, filling about 80 % of the cell, never touching the cell edge, with empty space between pictures.
- **No text, no numbers, no letters, no watermark, no grid lines, no cell numbers.** Show ONLY the effect (no pot, no stove, no hands, no people).
- Keep the sheet size and the cell size exactly (the cutter reads the sheet by cells).
- Soft, **translucent**, hand-painted look for a cozy warm-kitchen mobile game: gentle gradients, no hard outline, never photographic, never flat vector, never pixel art.
- Every effect is meant to be **layered and animated by the game** (moved, rotated, scaled, faded): so each must look good at 40 to 200 px and must fade out completely at its edges, so two can overlap without a visible box.

## The shared style (repeated inside each prompt, so each can be pasted alone)

> Soft, translucent, hand-painted effect art for a warm, cozy kitchen mobile game: gentle gradients with a bright core and soft edges that fade to fully transparent, no hard outlines, never photographic, never flat vector, never pixel art, warm and polished.

**Reference to attach (the world these effects sit in):** `public/landscape-art/true/kitchen-06.webp` (the Grand kitchen: copper pots, warm lamps, an arched sunlit window).

---

## FX-1: steam and mist wisps (8)

Cells: 4 columns x 2 rows of 512 x 768. Save as `FX Assets/FX-1.png` (the cutter writes `public/kitchen-fx/steam-1..6.webp` and `mist-1..2.webp`).

```
Create ONE image, 2048 x 1536 px, on a fully transparent background: a sprite sheet of 8 separate wisps of cooking steam in a grid of 4 columns x 2 rows, each cell 512 x 768 px, one wisp per cell in the order listed (left to right, top row first), centred, filling about 80 % of the cell's height, never touching the cell edge. No text, no numbers, no letters, no grid lines, no background, and NO pot, stove, cup or any object: ONLY the steam.

Style: soft, translucent, hand-painted effect art for a warm, cozy kitchen mobile game: a bright, milky-white core with a faint cool grey-cream shadow on one side, smooth curling ribbons that thicken in the middle and thin out toward the top, with soft edges that fade to fully transparent, no outline, never photographic, never flat vector.

Each wisp must start narrow at its BOTTOM (where it leaves the pot), widen as it rises, curl, and dissolve completely before its top edge, so it can be layered. All eight are the SAME kind of steam, seen from the side, lit from the upper left.
1. a tall S-curve ribbon curling to the right
2. a tall S-curve ribbon curling to the left
3. a thicker rolling column with two small curls near the top
4. two thin ribbons rising side by side and twisting around each other
5. a short puffy cloud that billows outward at the top
6. one tiny thin thread of steam with a single small curl (a cup of tea)
7. COOL MIST: a low, wide, soft cold vapour cloud with a faint cool blue-white tint, hugging the ground, rolling slowly to the right (for ice cream and cold storage)
8. COOL MIST: a taller, thinner drifting cold vapour with a faint cool blue-white tint, rising a little and curling left
```

**Integration:** the Kitchen's steam, the served plate's steam, the Second Floor's coffee machine; the two cool mists for the ice-cream machine and the fridge.

---

## FX-2: flame loops (3 strips of 6 frames)

Cells: 6 columns x 3 rows of 256 x 320. Each ROW is one flame, 6 frames of a seamless loop. Save as `FX Assets/FX-2.png`.

```
Create ONE image, 1536 x 960 px, on a fully transparent background: a sprite sheet of three small flame animations, each a seamless loop of 6 frames, in a grid of 6 columns x 3 rows, each cell 256 x 320 px. Each ROW is ONE flame; its 6 cells (left to right) are consecutive frames that loop back to the first. In every cell the flame is anchored at the BOTTOM CENTRE of the cell at exactly the same place and the same base width, so the frames can be played one after another without the base jumping. No text, no numbers, no letters, no grid lines, no background, no logs, no wick, no pot, no smoke: ONLY the flame.

Style: soft, hand-painted fire for a warm, cozy kitchen mobile game: a bright yellow-white core, warm orange body and a soft red-orange tip, with a gentle glow, soft edges that fade to fully transparent, no outline, never photographic, never flat vector.

Row 1: a LARGE fireplace / brick-oven fire: a lively cluster of 3 to 4 tongues of flame, wide at the base (about 200 px), flickering and leaning a little differently in each frame, with a few tiny sparks.
Row 2: a STOVE BURNER flame: a low, small ring of short blue-and-orange flames spread wide and flat (about 200 px wide, 90 px tall), gently pulsing and rippling from frame to frame.
Row 3: a CANDLE / LANTERN flame: one small teardrop flame, tall and thin (about 60 px wide), swaying slightly in each frame.
```

**Integration:** Row 1 on the loading screen's brick oven and the story scenes; Row 2 under the pots in the Kitchen; Row 3 on lanterns and chandeliers.

---

## FX-3: sparkles and glows (8)

Cells: 4 columns x 2 rows of 512 x 512. Save as `FX Assets/FX-3.png`.

```
Create ONE image, 2048 x 1024 px, on a fully transparent background: a sprite sheet of 8 separate light effects in a grid of 4 columns x 2 rows, each cell 512 x 512 px, one effect per cell in the order listed (left to right, top row first), centred, filling about 80 % of the cell, never touching the cell edge. No text, no numbers, no letters, no grid lines, no background, no objects.

Style: soft, translucent, hand-painted light art for a warm, cozy kitchen mobile game: bright, clean glowing light with soft edges that fade to fully transparent, no hard outline, never photographic.

Top row: SPARKLES (white-gold light)
1. a classic four-point star glint: a thin bright cross of light with a soft round glow at its centre
2. a six-point soft star with gentle rays
3. a small thin diagonal glint: a short bright streak with a tiny star at one end (a shine on metal)
4. a round soft bokeh sparkle: a bright soft disc with a faint ring and tiny rays

Bottom row: GLOWS (soft round light, brightest at the centre, fading smoothly to nothing at the edge)
5. a warm amber lamp glow (a hanging lamp's light)
6. a cool pale-blue-white window glow
7. a small warm candle-yellow glow
8. a golden magical sparkle glow: a soft golden disc with a few tiny bright specks inside
```

**Integration:** the glints on copper pans and glass, the lamps and windows in every painted room, a celebration's burst.

---

## FX-4: drifting particles (18)

Cells: 6 columns x 3 rows of 256 x 256. Save as `FX Assets/FX-4.png`.

```
Create ONE image, 1536 x 768 px, on a fully transparent background: a sprite sheet of 18 separate small drifting particles in a grid of 6 columns x 3 rows, each cell 256 x 256 px, one particle per cell in the order listed (left to right, top row first), centred, filling about 70 % of the cell, never touching the cell edge. No text, no numbers, no letters, no grid lines, no background, nothing but the single particle in each cell.

Style: soft, hand-painted details for a warm, cozy kitchen mobile game: gentle shading, a very thin soft darker edge for definition, never photographic, never flat vector.

Row 1, PETALS: six different flower petals, seen at a slight angle, each a little different in shape and curl: three pale-pink cherry-blossom petals and three white petals.
Row 2, LEAVES: six different small green leaves, each a little different: two basil leaves, two ivy leaves, one rosemary sprig, one parsley leaf.
Row 3, KITCHEN BITS: 1 a small soft white flour puff, 2 a second flour puff of a different shape, 3 a clear water droplet with a bright highlight, 4 a round soap bubble with a faint rainbow sheen, 5 a glowing orange ember spark, 6 a tiny golden dust speck with a soft glow.
```

**Integration:** petals and leaves drifting past the window, flour and droplets in the cutting scene, bubbles at the sink, embers at the fire.

---

## FX-5: confetti, coins and stars (16)

Cells: 8 columns x 2 rows of 256 x 256. Save as `FX Assets/FX-5.png`.

```
Create ONE image, 2048 x 512 px, on a fully transparent background: a sprite sheet of 16 separate celebration pieces in a grid of 8 columns x 2 rows, each cell 256 x 256 px, one piece per cell in the order listed (left to right, top row first), centred, filling about 75 % of the cell, never touching the cell edge. No text, no numbers, no letters, no grid lines, no background.

Style: glossy, hand-painted celebration art for a warm, cozy kitchen mobile game: soft highlights from the upper left, a thin darker outline, rich honey-gold, copper, cream, leaf-green, tomato-red and sky-blue colours, polished and cheerful, never photographic, never flat vector.

Row 1, CONFETTI (8): a gold ribbon curl, a red ribbon curl, a green ribbon curl, a blue ribbon curl, a gold round confetti dot, a red square confetti piece, a green strip, a small cream star.
Row 2: a gold coin turning in FOUR frames (1: the face, 2: three-quarter turn, 3: edge-on, 4: the back with a small chef's hat, all the same size and centre), then FOUR bursts: a gold star, a small red heart, a green leaf-sparkle, and a soft white-gold starburst.
```

**Integration:** the celebration cards (confetti and a starburst behind the emblem), the coin pop when money is collected.

---

## Suggested order

1. **FX-1** (the steam): generate it first and look at one wisp before anything else. The Kitchen already waits for it.
2. FX-2 (flames), then FX-3 (glows).
3. FX-4 and FX-5 last (they decorate; nothing is blocked on them).
