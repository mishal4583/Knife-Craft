# Animation FX: ONE Codex prompt for all five sheets (2026-11-26)

Paste the block below into Codex as ONE request. It makes all five sheets (FX-1 to FX-5) into `D:\WORKS\GAMES\Knife Craft\FX Assets\`. The same sheets, one at a time, are in `ANIMATION-FX-CODEX-PROMPTS-2026-11-26.md` (use those if Codex struggles with five images in one go).

After it finishes, tell Claude: **"fx assets are generated"**. Claude cuts them into small files, wires them in and checks them.

```
You are making art for the mobile game KnifeCraft, a warm, cozy kitchen game. In THIS one request, create FIVE separate sprite-sheet images, in the order below, and save each into this folder (create it if it does not exist):
D:\WORKS\GAMES\Knife Craft\FX Assets
with EXACTLY these file names: FX-1.png, FX-2.png, FX-3.png, FX-4.png, FX-5.png. Do not skip a sheet, do not merge two sheets, do not change a size. Make FX-1 first and look at it again before each later sheet so all five feel like one family.

Open and match the world these effects sit in: D:\WORKS\GAMES\Knife Craft\public\landscape-art\true\kitchen-06.webp (the Grand kitchen: copper pots, warm lamps, an arched sunlit window).

RULES FOR ALL FIVE SHEETS
- Fully TRANSPARENT background (real alpha: no checkerboard, no white, no grey, no shadow plate). Soft edges must fade to fully transparent, never to a coloured halo.
- Keep each sheet's size and cell size EXACTLY as stated (a script cuts the sheet by cells). One picture per cell, in the listed order (left to right, top row first), centred, filling about 70 to 80 percent of the cell, never touching the cell edge, with empty space between pictures.
- NO text, numbers, letters, watermark, grid lines or cell numbers. Show ONLY the effect: no pot, stove, cup, hands, people or background objects.
- Style: soft, hand-painted effect art for a warm, cozy kitchen mobile game: gentle gradients, polished and cheerful, never photographic, never flat vector, never pixel art. Effects (sheets 1 to 4) are translucent with soft edges and no hard outline. Sheet 5 (celebration pieces) is glossy with soft highlights from the upper left and a thin darker outline.
- Every effect is animated by the game (moved, rotated, scaled, faded) and layered, so each must look good at 40 to 200 px and fade out completely at its edges so two can overlap without a visible box.

=====================================================================
SHEET 1: FX-1.png  (steam and mist wisps), 2048 x 1536 px
Grid 4 columns x 2 rows, each cell 512 x 768 px, 8 wisps. ONLY steam: no pot, stove or cup.
Look: a bright, milky-white core with a faint cool grey-cream shadow on one side, smooth curling ribbons that thicken in the middle and thin out toward the top, soft edges that fade to fully transparent, no outline. Each wisp starts NARROW at its bottom (where it leaves the pot), widens as it rises, curls, and dissolves completely before its top edge. All eight are the same kind of steam, seen from the side, lit from the upper left.
1 a tall S-curve ribbon curling to the right
2 a tall S-curve ribbon curling to the left
3 a thicker rolling column with two small curls near the top
4 two thin ribbons rising side by side and twisting around each other
5 a short puffy cloud that billows outward at the top
6 one tiny thin thread of steam with a single small curl (a cup of tea)
7 COOL MIST: a low, wide, soft cold vapour cloud with a faint cool blue-white tint, hugging the ground, rolling slowly to the right (for ice cream and cold storage)
8 COOL MIST: a taller, thinner drifting cold vapour with a faint cool blue-white tint, rising a little and curling left

=====================================================================
SHEET 2: FX-2.png  (flame loops), 1536 x 960 px
Grid 6 columns x 3 rows, each cell 256 x 320 px. Each ROW is ONE flame animation: its 6 cells (left to right) are consecutive frames of a SEAMLESS LOOP that returns to the first frame. In every cell the flame is anchored at the BOTTOM CENTRE of the cell, at exactly the same place and the same base width, so frames can be played one after another without the base jumping. ONLY the flame: no logs, wick, pot or smoke.
Look: soft, hand-painted fire: a bright yellow-white core, warm orange body, a soft red-orange tip, a gentle glow, soft edges that fade to fully transparent, no outline.
Row 1: a LARGE fireplace / brick-oven fire: a lively cluster of 3 to 4 tongues of flame, wide at the base (about 200 px), flickering and leaning a little differently in each frame, with a few tiny sparks.
Row 2: a STOVE BURNER flame: a low, small ring of short blue-and-orange flames spread wide and flat (about 200 px wide, 90 px tall), gently pulsing and rippling from frame to frame.
Row 3: a CANDLE / LANTERN flame: one small teardrop flame, tall and thin (about 60 px wide), swaying slightly in each frame.

=====================================================================
SHEET 3: FX-3.png  (sparkles and glows), 2048 x 1024 px
Grid 4 columns x 2 rows, each cell 512 x 512 px, 8 light effects. Bright, clean, glowing light, soft edges that fade to fully transparent, no outline.
Top row, SPARKLES (white-gold light):
1 a classic four-point star glint: a thin bright cross of light with a soft round glow at its centre
2 a six-point soft star with gentle rays
3 a small thin diagonal glint: a short bright streak with a tiny star at one end (a shine on metal)
4 a round soft bokeh sparkle: a bright soft disc with a faint ring and tiny rays
Bottom row, GLOWS (soft round light, brightest at the centre, fading smoothly to nothing at the edge):
5 a warm amber lamp glow (a hanging lamp's light)
6 a cool pale-blue-white window glow
7 a small warm candle-yellow glow
8 a golden magical sparkle glow: a soft golden disc with a few tiny bright specks inside

=====================================================================
SHEET 4: FX-4.png  (drifting particles), 1536 x 768 px
Grid 6 columns x 3 rows, each cell 256 x 256 px, 18 small particles, ONE particle alone in each cell. Gentle shading with a very thin soft darker edge for definition.
Row 1, PETALS: six different flower petals seen at a slight angle, each a little different in shape and curl: three pale-pink cherry-blossom petals and three white petals.
Row 2, LEAVES: six different small green leaves, each a little different: two basil leaves, two ivy leaves, one rosemary sprig, one parsley leaf.
Row 3, KITCHEN BITS: 1 a small soft white flour puff, 2 a second flour puff of a different shape, 3 a clear water droplet with a bright highlight, 4 a round soap bubble with a faint rainbow sheen, 5 a glowing orange ember spark, 6 a tiny golden dust speck with a soft glow.

=====================================================================
SHEET 5: FX-5.png  (confetti, coins and stars), 2048 x 512 px
Grid 8 columns x 2 rows, each cell 256 x 256 px, 16 celebration pieces. Glossy, with soft highlights from the upper left, a thin darker outline, and rich honey-gold, copper, cream, leaf-green, tomato-red and sky-blue colours.
Row 1, CONFETTI (8): a gold ribbon curl, a red ribbon curl, a green ribbon curl, a blue ribbon curl, a gold round confetti dot, a red square confetti piece, a green strip, a small cream star.
Row 2: a gold coin turning in FOUR frames (1 the face, 2 a three-quarter turn, 3 edge-on, 4 the back with a small chef's hat; all the same size and centre), then FOUR bursts: a gold star, a small red heart, a green leaf-sparkle, and a soft white-gold starburst.

When done, list the five saved files and their pixel sizes.
```

## What Claude does after

| Sheet | Cut to | Used for |
|---|---|---|
| FX-1 | `public/kitchen-fx/steam-1..6.webp`, `mist-1..2.webp` | the Kitchen's steam (then `KITCHEN_STEAM_SPRITES = 6`), the served plate, the Second Floor machines |
| FX-2 | `public/fx/flame-fire-1..6`, `flame-burner-1..6`, `flame-candle-1..6` | the loading screen's brick oven, the stove burner, candles and lanterns |
| FX-3 | `public/fx/glint-1..4`, `glow-1..4` | glints on copper, lamp and window glows |
| FX-4 | `public/fx/petal-*`, `leaf-*`, `bit-*` | petals and leaves past the window, flour, droplets, bubbles, embers |
| FX-5 | `public/fx/confetti-*`, `coin-1..4`, `burst-*` | celebration cards, the coin pop |
