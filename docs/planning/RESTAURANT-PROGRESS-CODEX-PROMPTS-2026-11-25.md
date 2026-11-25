# Restaurant Progress, painted: Codex prompts for every picture (2026-11-25)

**Plan:** `docs/planning/RESTAURANT-PROGRESS-REDESIGN-PLAN-2026-11-25.md`.
**The developer's design document (the source of truth for the look):** `C:\Users\HP\Documents\OneDrive\Documents\Restaurant Progress UI design.docx`.
**The same nine pictures, one file each, in this repo** (attach these to EVERY prompt below, they are the style and the content reference):

```
docs/planning/reference/restaurant-progress/01-city-restaurant-guide.png
docs/planning/reference/restaurant-progress/02-ranking-chef-title-prestige.png
docs/planning/reference/restaurant-progress/03-city-league.png
docs/planning/reference/restaurant-progress/04-standing-numbers-restaurant-card.jpeg
docs/planning/reference/restaurant-progress/05-next-goal-campaign-progress.jpeg
docs/planning/reference/restaurant-progress/06-restaurant-earnings.png
docs/planning/reference/restaurant-progress/07-local-rankings-journey.jpeg
docs/planning/reference/restaurant-progress/08-knives-cutting-boards.jpeg
docs/planning/reference/restaurant-progress/09-milestones.jpeg
```

(If Codex cannot read the repo, attach the nine pictures from the .docx directly: open the document, save each picture. They are in the document in this order.)

> **DELIVERED AND INTEGRATED 2026-11-25:** all 10 sheets were generated, cut by `scripts/make-progress-assets.py` and are on the page. This file is kept for the prompts.

## How to use this file

1. For each sheet below: attach the nine reference pictures (and any extra reference named in the sheet), paste the prompt, and generate ONE image.
2. Save it as `Restaurant Progress Assets/RP-<sheet>.png` in the repo root (the sheet id is in the heading). The folder is a Codex source folder like `Icon Sheets Assets/`: it is not part of the build.
3. Tell Claude "progress assets are generated": Claude runs `scripts/make-progress-assets.py` (cuts every picture by its shape, trims it, resizes it to WebP into `public/progress/`), and the page switches to the paintings by itself.
4. A sheet that comes out wrong is simply generated again; sheets do not depend on each other. Suggested order: RP-pieces, RP-icons-a, RP-icons-b, RP-icons-c, RP-medals, RP-storefronts, RP-knives, RP-boards, RP-goals, RP-wide.

**The nine pictures are AI-made concept images** (the developer, 2026-11-25): follow their STYLE and the CONTENT named in each prompt, not their glitches (stray or garbled letters, odd counts, uneven edges). The prompts below say what each picture must contain.

## Rules for every sheet (the same as the earlier icon sheets)

- A **transparent background** (real alpha: no checkerboard, no white, no grey, no shadow plate). One picture per grid cell, in the order listed, centred, filling about 80 % of the cell, never touching the cell's edge, with empty space between pictures.
- **No text, no numbers, no letters, no watermark, no grid lines, no cell numbers.** Where a picture has a place for a name or a number (a ribbon, a medal, a plaque), leave that place **blank and plain**: the game writes the real words over it.
- The sheet size and cell size are stated in each prompt; keep them exactly (the build script cuts the sheet by its cells).
- Same light on every picture (from the upper left), the same thin darker-brown outline weight across the whole sheet, the same glossy finish.
- Every picture must read when shown small (about 32 to 64 px for icons): a bold simple silhouette first, detail second.
- Show exactly the object described; do not invent a different object.

## The shared style (it is repeated inside each prompt, so each prompt can be pasted alone)

> Warm, glossy, hand-painted cartoon mobile-game UI art, exactly in the style of the attached nine mock-up pictures: soft rounded shapes, a thin darker-brown outline, soft highlights from the upper left, a gentle shadow shape under each object, rich honey-gold, copper, cream, warm brown and leaf-green colours, polished and cheerful, never photographic, never flat vector, never pixel art.

---

## RP-icons-a: heading and row icons (25), `RP-icons-a.png`, 2000 x 2000 px = 5 x 5 cells of 400 x 400

Extra reference to attach: `public/icons/trophy.webp`, `public/icons/flag.webp`, `public/icons/coin.webp` (the game's existing painted icons, for the finish).

```
Create ONE image, 2000 x 2000 px, on a fully transparent background: a sprite sheet of 25 separate painted icons in a grid of 5 columns x 5 rows (each cell 400 x 400), one icon per cell, centred, filling about 80 % of the cell, never touching the cell edge. No text, no numbers, no grid lines.

Style: warm, glossy, hand-painted cartoon mobile-game UI art, exactly in the style of the attached nine mock-up pictures: soft rounded shapes, a thin darker-brown outline, soft highlights from the upper left, a gentle shadow shape under each object, rich honey-gold, copper, cream, warm brown and leaf-green colours. Each icon must read at 32 px.

In reading order, left to right, top to bottom:
1. A skyline of small blue and cream city buildings with tiny windows (the City Guide heading).
2. A gold trophy cup with two handles on a small base (the rankings heading).
3. A small restaurant storefront with a red and white striped awning, a door and two windows (Restaurant Standing and "Invested").
4. A gold bar chart: three rising gold bars on a small base (Your Restaurant in Numbers, and City ranking).
5. A white chef's toque (tall pleated chef hat) with a red band, front view (the restaurant card heading and Kitchen title).
6. A red and white archery target with a golden arrow in the middle (Next Goal).
7. A gold and red pennant flag on a wooden pole (Campaign).
8. A tan canvas money bag tied with a rope with a gold dollar sign on it (Restaurant Earnings).
9. Three rising orange-gold bars with an orange trend arrow above them (Level rewards chart).
10. A folded paper map with a green and tan land and a red map pin (Your Restaurant Journey).
11. A chef's knife, diagonal, steel blade and a dark walnut handle (Knives).
12. A hammer with a steel head and a wooden handle, diagonal (Knife Mastery).
13. A wooden cutting board with a handle hole, seen a little from above (Cutting Boards).
14. Three gold rising steps like a staircase (Stage).
15. A gold double chevron pointing right, like fast-forward (Next stage).
16. An open gold padlock, shackle lifted (Endless Restaurant: Open).
17. A closed gold padlock (Locked).
18. An open book with cream pages and a red ribbon bookmark (Chapters).
19. An open recipe book with a red page tab and a small gold star on a page (Recipes cooked).
20. A gold crown with three points and a red jewel in the middle (Restaurant rank).
21. A neat stack of green banknotes tied with a paper band (Current cash).
22. A single glossy gold five-point star with a soft glow (Level rewards, stars).
23. A red gift box with a gold ribbon and bow (Milestone rewards).
24. A gold trophy cup inside a green laurel wreath (Final Reward).
25. A tall stack of gold coins with one coin leaning on it (Business revenue).
```

## RP-icons-b: number icons, prestige buildings, faces (24 of 25 cells), `RP-icons-b.png`, 2000 x 2000 px = 5 x 5 cells of 400 x 400

```
Create ONE image, 2000 x 2000 px, on a fully transparent background: a sprite sheet of 24 separate painted icons in a grid of 5 columns x 5 rows (each cell 400 x 400), one icon per cell, centred, filling about 80 % of the cell, never touching the cell edge. Fill the first 24 cells, leave the last cell empty. No text, no numbers, no grid lines.

Style: warm, glossy, hand-painted cartoon mobile-game UI art, exactly in the style of the attached nine mock-up pictures: soft rounded shapes, a thin darker-brown outline, soft highlights from the upper left, a gentle shadow shape under each object, rich honey-gold, copper, cream, warm brown and leaf-green colours.

In reading order, left to right, top to bottom:
1. A steel wrench crossed with a hammer (Business running costs).
2. A clipboard with a checklist of three ticked lines and a pencil clipped to it (Total spent).
3. A black frying pan with a fried egg in it, a small wisp of steam (Services). A bigger, richer picture: it is shown at about 64 px.
4. Two happy guests (a woman and a man, shoulders and heads) sitting at a small round table with a white cloth and a candle (Guests at the tables). Shown at about 64 px.
5. A kraft paper takeaway bag with folded top and a small white chef-hat logo on the front (Takeaway orders). Shown at about 64 px.
6. A taped brown cardboard box, slightly open flaps, a little from above (Pieces packed). Shown at about 64 px.
7. A pink bar of soap with soap bubbles on top and a few blue bubbles (Pieces washed). Shown at about 64 px.
8. Two glossy gold four-point sparkles, a big one and a small one (Spotless services). Shown at about 64 px.
9. One big glossy gold spiky sparkle star with a soft glow (Spotless streak).
10. A small inspector face: a cartoon man with a brown flat hat, a moustache and round glasses (the inspector notices).
11. Two friendly people busts, one gold and one brown, side by side (Popularity).
12. A gold lightning bolt, bold, with a soft glow (Speed, and "Lightning Chef").
13. An open light-wood crate with a few red tomatoes and a green leaf in it (Organizer).
14. A glossy orange-red heart with a small highlight (Customer Favourite).
15. A small tidy cottage-like shop with a plain awning and a chimney, simple (Prestige: Neighbourhood Spot).
16. A cosy cafe with a striped awning, a chalkboard sign and a flower box (Prestige: Local Favourite).
17. A tall clock-tower building with a lit clock face and a flag (Prestige: City Landmark).
18. A stone building with four white columns, a triangular pediment and wide steps, glowing gold windows (Prestige: Culinary Destination).
19. A grand building with a golden dome, a star on top, banners on the sides and a red carpet (Prestige: Living Legend).
20. A cartoon chef bust: a smiling woman with a white toque and a brown ponytail.
21. A cartoon chef bust: a smiling man with a white toque and a black moustache.
22. A cartoon chef bust: a smiling older woman with a white toque and grey hair in a bun.
23. A cartoon chef bust: a smiling young man with a white toque and a small beard.
24. A cartoon chef bust: a smiling woman with a white toque and curly dark hair.
All five chef busts have the same size, the same outline, a white jacket collar and a red neckerchief.
```

## RP-icons-c: milestone and status marks (13 of 15 cells), `RP-icons-c.png`, 2000 x 1200 px = 5 x 3 cells of 400 x 400

```
Create ONE image, 2000 x 1200 px, on a fully transparent background: a sprite sheet of painted icons in a grid of 5 columns x 3 rows (each cell 400 x 400), one icon per cell, centred, filling about 80 % of the cell, never touching the cell edge. Fill the first 13 cells, leave the last 2 empty. No text, no numbers, no grid lines.

Style: warm, glossy, hand-painted cartoon mobile-game UI art, exactly in the style of the attached nine mock-up pictures (above all pictures 8 and 9): soft rounded shapes, a thin darker-brown outline, soft highlights from the upper left, rich honey-gold, copper, cream, warm brown and leaf-green colours.

In reading order, left to right, top to bottom:
1. A silver serving cloche (dome lid) on a plate (First dish served).
2. A dark iron anvil with a little orange spark (First Blacksmith upgrade).
3. A desk calendar with a grid of days and one ticked day (First Business day).
4. Three small chef-and-waiter busts side by side in warm colours (Staff hired).
5. A round gold badge ring with a dark-brown check mark in the middle, glossy (a DONE milestone).
6. A thin empty round ring in light grey-brown, simple, flat, a little inset (a NOT DONE milestone).
7. One glossy gold coin seen at a slight angle with a small shine (a payout).
8. A bold dark-green check mark with a soft highlight, no circle (PAID).
9. A tiny market stall: a red and white striped awning over a small counter with a basket (IN THE MARKET).
10. An open palm hand, friendly, tan with a thin outline (IN HAND).
11. A small taped cardboard crate, front view (the "owned" counter).
12. A sprig of green leaves with two berries, to sit in a ribbon corner (decoration, leaning to the left).
13. The same sprig of leaves mirrored (leaning to the right).
```

## RP-medals: rank medals, league medals and league badges (13 of 15 cells), `RP-medals.png`, 2560 x 1536 px = 5 x 3 cells of 512 x 512

```
Create ONE image, 2560 x 1536 px, on a fully transparent background: a sprite sheet of 13 separate painted medals and badges in a grid of 5 columns x 3 rows (each cell 512 x 512), one picture per cell, centred, filling about 80 % of the cell, never touching the cell edge. Fill the first 13 cells, leave the last 2 empty. No text, no numbers, no letters anywhere: every medal's centre is a plain smooth disc (the game writes the number on it).

Style: warm, glossy, hand-painted cartoon mobile-game UI art, exactly in the style of the attached nine mock-up pictures (the laurel medals in pictures 1, 3 and 7, and the Bronze League badge in picture 3): soft rounded shapes, a thin darker-brown outline, soft highlights from the upper left, a gentle shadow shape under each.

In reading order:
1. ROW 1, cell 1: a round GOLD disc medal framed by a laurel wreath that opens at the top, shiny gold, plain centre.
2. Cell 2: the same medal in SILVER, plain centre.
3. Cell 3: the same medal in BRONZE (warm copper), plain centre.
4. Cell 4: a small BRONZE league medal: a round bronze coin with a gold star in the middle, hanging from a short blue ribbon with a V shape at the top.
5. Cell 5: the same league medal in SILVER (silver star on a silver coin, blue ribbon).
6. ROW 2, cell 1: the same league medal in GOLD.
7. Cell 2: the same league medal in PLATINUM (white-blue metal, a pale blue star).
8. Cell 3: the same league medal in DIAMOND (a bright cyan crystal star on a deep blue coin with white sparkles).
9. Cell 4: a big BRONZE league badge: a round bronze coin with a white chef's toque embossed in the middle, framed by golden laurel branches left and right, and a gold ribbon banner across the bottom with a small gold star on the ribbon, the banner's middle left blank.
10. Cell 5: the same big badge in SILVER (silver coin, silver laurels, silver ribbon).
11. ROW 3, cell 1: the same big badge in GOLD.
12. Cell 2: the same big badge in PLATINUM.
13. Cell 3: the same big badge in DIAMOND (cyan crystal sparkle around the coin).
Cells 4 and 5 of row 3 stay empty.
```

## RP-storefronts: podium buildings and Standing buildings (9 of 10 cells), `RP-storefronts.png`, 2560 x 1024 px = 5 x 2 cells of 512 x 512

Extra reference to attach: `public/nav/restaurant-map.webp` (the finish of the game's own buildings).

```
Create ONE image, 2560 x 1024 px, on a fully transparent background: a sprite sheet of 9 separate painted restaurant buildings in a grid of 5 columns x 2 rows (each cell 512 x 512), one building per cell, centred, filling about 85 % of the cell, never touching the cell edge. Fill the first 9 cells, leave the last cell empty. No text, no numbers, no signs with letters (a sign may show a symbol only, like a chef hat or a crown). Front view, a little from above, each building with a soft ground shadow.

Style: warm, glossy, hand-painted cartoon mobile-game art, exactly in the style of the attached nine mock-up pictures (the buildings in pictures 1 and 4): soft rounded shapes, a thin darker-brown outline, soft highlights from the upper left, warm lit windows, small potted plants and bushes.

ROW 1, cells 1 to 3: the City Guide podium (three different buildings, the same size and finish):
1. A classic restaurant with a red and white striped awning, a red roof with a small round gold sign above the door, lit windows, flower boxes.
2. A building with a blue and white striped awning, a small golden crown on the roof, lit windows.
3. A building with a green roof and a green and white striped awning, a round gold sign, trees at the sides.

STANDING BUILDINGS, one for each kitchen stage, growing from tiny to grand. Each has a white chef-toque sign (a symbol, no letters) above the door, a striped awning and potted plants; larger stages are bigger and richer. They sit in a soft golden glow:
4. (row 1, cell 4) Humble Kitchen: a tiny one-room cottage, a small plain green awning, one window, a single potted plant.
5. (row 1, cell 5) Growing Kitchen: a small shop, a red and white awning, two windows, two plants.
6. (row 2, cell 1) Established Kitchen: a two-window restaurant with a red and white striped awning, a wooden chef-toque sign, shutters, hedges on both sides (this one is exactly the building in the attached picture 4).
7. (row 2, cell 2) Neighborhood Cafe: a wider cafe with a striped awning and a terrace with two small round tables.
8. (row 2, cell 3) Flourishing Cafe: a two-storey restaurant, a balcony with flowers, string lights, a terrace.
9. (row 2, cell 4) Grand Kitchen: a grand three-part restaurant with a gold-trimmed roof, a clock, banners and a red carpet at the door.
```

## RP-goals: Next Goal vignettes (8), `RP-goals.png`, 1536 x 1536 px = 2 columns x 4 rows of 768 x 384

Extra reference to attach: `docs/planning/reference/restaurant-progress/05-next-goal-campaign-progress.jpeg` is the model (the Korean kitchen vignette at the right of the card).

```
Create ONE image, 1536 x 1536 px, on a fully transparent background: a sheet of 8 painted wide vignettes in a grid of 2 columns x 4 rows (each cell 768 x 384), one vignette per cell. Each vignette is a small painted scene of a restaurant of one cuisine with its signature dish in the front, like the Korean kitchen with the bibimbap bowl in the attached picture 5. Each vignette is a soft-edged cut-out: it fades to fully transparent at its LEFT edge and its BOTTOM edge (no hard line), because the game places it on a cream card, with the scene's weight on the right. No text, no letters anywhere (signs and lanterns carry no writing).

Style: warm, glossy, hand-painted cartoon mobile-game art, exactly in the style of the attached nine mock-up pictures: soft rounded shapes, a thin darker-brown outline, soft highlights from the upper left, warm glowing lanterns and windows.

In reading order, left to right, top to bottom:
1. Chapter 8, Italian and French Encore: an Italian trattoria with a red-white-green awning beside a small Parisian bistro with a dark green awning and a round cafe table; in front a plate of pasta and a croissant.
2. Chapter 9, Mediterranean and Latin Encore: a white-and-blue Greek taverna with a blue door beside a colourful Mexican food stall with papel picado flags; in front a bowl of salad with feta and two tacos.
3. Chapter 10, Thai and Southeast Asian: a wooden Thai street-food stall with a thatched roof, hanging lanterns and a palm; in front a plate of pad thai with a lime wedge.
4. Chapter 11, Korean Kitchen: a Korean hanok restaurant with a dark tiled curved roof, glowing paper lanterns and a green tree at its left; in front a hot stone bowl of bibimbap with a fried egg and chopsticks (the same scene as the attached picture 5).
5. Chapter 12, East Asian Fusion: a Japanese sushi bar with a noren curtain (no writing) beside a small dim-sum house with a red lantern; in front sushi on a board and a bamboo steamer of dumplings.
6. Chapter 13, The Grand Finale: a grand golden-lit restaurant facade with columns, banners and stars, a red carpet, confetti in the air; in front a golden cloche on a platter.
7. The Campaign Finale: a big gold trophy on a stepped podium with laurels, confetti and streamers, soft golden rays.
8. A restaurant rank (a cafe milestone): a charming cafe with a striped awning and a glowing star above its door, a coffee cup and a cake in front.
```

## RP-knives: the eight knives (8), `RP-knives.png`, 1280 x 1280 px = 2 columns x 4 rows of 640 x 320

Extra reference to attach: `docs/planning/reference/restaurant-progress/08-knives-cutting-boards.jpeg` (the knife style, the stand), and the game's knife shapes if useful: `src/game/knives/knifeDefinitions.ts` (names and descriptions), `src/game/scenes/knifeProfile.ts` (the blade silhouettes).

```
Create ONE image, 1280 x 1280 px, on a fully transparent background: a sheet of 8 painted kitchen knives in a grid of 2 columns x 4 rows (each cell 640 x 320), one knife per cell, centred, filling about 85 % of the cell width, never touching the cell edge. Every knife lies in the same pose as in the attached picture 8: horizontal, the handle on the left and the blade pointing to the right and slightly up (about 8 degrees), resting on a small dark-brown wooden wedge stand with a soft shadow under it. The stand is identical for all eight. No text, no numbers, no engraving of letters.

Style: warm, glossy, hand-painted cartoon mobile-game art, exactly in the style of the attached picture 8: polished steel with a clear highlight line along the blade, a thin darker outline, warm soft light from the upper left, dark walnut handles with three small silver rivets (unless stated).

In reading order, left to right, top to bottom:
1. Chef's Knife: a classic wide curved chef's blade, pointed tip, dark walnut handle.
2. Santoku: a Japanese santoku, a flat edge with a rounded sheep-foot tip and a row of small oval hollow dimples along the blade, dark walnut handle.
3. Nakiri: a rectangular vegetable knife with a flat edge and a squared tip, light steel, dark walnut handle.
4. Paring Knife: a small short knife with a short pointed blade and a short walnut handle (clearly smaller than the others).
5. Bread Knife: a long blade with a serrated wavy edge and a rounded tip, dark walnut handle.
6. Cleaver: a big rectangular cleaver with a thick spine, a round hole near the back of the blade, dark walnut handle.
7. Damascus Knife: a chef's blade with a flowing wavy Damascus steel pattern in light and dark grey, dark walnut handle with a steel end cap.
8. Obsidian Knife: a chef's blade in glossy black volcanic glass with a bright edge highlight, a black handle with a thin gold bolster ring.
```

## RP-boards: the eight cutting boards (8), `RP-boards.png`, 2048 x 1024 px = 4 columns x 2 rows of 512 x 512

Extra reference to attach: `docs/planning/reference/restaurant-progress/08-knives-cutting-boards.jpeg` (the boards at the bottom) and `src/game/boards/boardDefinitions.ts` (names).

```
Create ONE image, 2048 x 1024 px, on a fully transparent background: a sheet of 8 painted cutting boards in a grid of 4 columns x 2 rows (each cell 512 x 512), one board per cell, centred, filling about 80 % of the cell, never touching the cell edge. Every board is shown from the front, tilted back a little, a rounded rectangle with rounded corners and a small round hole near the top right corner for hanging, the same size and the same pose for all eight, with a thin darker outline and a soft shadow under it. No text, no numbers, no letters.

Style: warm, glossy, hand-painted cartoon mobile-game art, exactly in the style of the attached picture 8 (the Cutting Boards row): soft rounded shapes, soft highlights from the upper left.

In reading order, left to right, top to bottom:
1. Walnut Board: dark reddish-brown walnut wood with a subtle grain.
2. Maple Board: pale cream maple wood with a fine light grain.
3. Herb Garden Board: light wood with a delicate engraved pattern of herb sprigs and small flowers (engraving, not paint).
4. Marble Board: white marble with soft grey veins, a thin wooden rim.
5. Dark Oak Board: very dark brown oak with a lighter edge line.
6. Chef's Copper Board: warm wood with a polished copper rim and corner caps.
7. Butcher's Block: a thick end-grain board (a chequerboard of small wooden squares), thick edge visible.
8. Seafood Slate Board: dark blue-grey slate with a small engraved fish outline and a pale wooden rim.
```

## RP-pieces: the big pieces (7 of 9 cells), `RP-pieces.png`, 1920 x 1920 px = 3 x 3 cells of 640 x 640

```
Create ONE image, 1920 x 1920 px, on a fully transparent background: a sheet of 7 separate painted pieces in a grid of 3 columns x 3 rows (each cell 640 x 640), one piece per cell, centred, filling about 85 % of the cell, never touching the cell edge. Fill the first 7 cells, leave the last 2 empty. No text, no numbers, no letters. Where a piece has a place for words (a plaque), leave it blank and plain: the game writes over it.

Style: warm, glossy, hand-painted cartoon mobile-game art, exactly in the style of the attached nine mock-up pictures: soft rounded shapes, a thin darker-brown outline, soft highlights from the upper left, a gentle shadow under each piece, rich honey-gold, copper, cream, warm brown and leaf-green.

In reading order:
1. (the City Ranking hero, picture 2, at the left) A big, glossy gold trophy cup with two curved handles on a dark wooden base, a soft glow behind it.
2. (picture 2, at the right of the hero) A laurel emblem: a white chef's toque on top, a chef's knife and a whisk crossed behind it, golden laurel branches on both sides.
3. (picture 6, the "Total Level Rewards" plaque) A dark wooden sign board with a gold border and rivets, two golden laurel branches at its lower corners, and a stack of gold coins with sparkles on top of it; the middle of the board is plain and empty for text.
4. (picture 8, the Knife Mastery medallion) A round copper medallion with a gold rim, a dark anvil in its middle with orange sparks above it.
5. (picture 8, at the right of Knife Mastery) A dark iron anvil on a stone, a hammer lying across it, orange sparks flying and a small pile of coal and rocks.
6. (picture 5, the "you are here" mark on the campaign track) A glossy green round coin with a white chef's toque in its middle, a golden rim, a soft golden glow and rays around it.
7. (picture 9, the Milestones corner) A clipboard with a green checklist (four lines with green ticks) and a pencil, leafy green plants growing around its lower corners.
```

## RP-wide: wide heading pieces (5), `RP-wide.png`, 2048 x 1152 px = 2 columns x 3 rows of 1024 x 384

```
Create ONE image, 2048 x 1152 px, on a fully transparent background: a sheet of 5 painted wide pieces in a grid of 2 columns x 3 rows (each cell 1024 x 384), one piece per cell, centred, filling about 90 % of the cell width, never touching the cell edge. The sixth cell stays empty. No text, no numbers, no letters. Where a piece has a place for words, leave it blank and plain.

Style: warm, glossy, hand-painted cartoon mobile-game art, exactly in the style of the attached nine mock-up pictures: soft rounded shapes, a thin darker-brown outline, soft highlights from the upper left, a gentle shadow, rich honey-gold, copper, cream, warm brown and leaf-green.

In reading order:
1. (picture 6, the top right of Restaurant Earnings) A decorative cluster seen from the front: a white chef's toque on the left, two stacks of gold coins in the middle, and a clipboard with a rising orange chart at the right, tucked in leafy green plants. The cluster has a flat bottom edge.
2. (picture 8, the top left of Knives) A small decoration: a white chef's toque with a few vegetables beside it (a tomato, a carrot, green leaves), flat at the bottom, wide and low.
3. (picture 1 and 7, behind the headings) A faint skyline of small city buildings, towers and a dome in a soft pale tan, low contrast, fading to transparent at its bottom, wide and low.
4. (picture 9, the Milestones banner) A wide glossy gold ribbon banner with curled and folded ends, a gold trophy cup with laurels on top of its middle and a gold star at each end; the banner's middle is plain and empty for the word.
5. (picture 2, the top of the City Ranking hero) A gold ribbon tab with angled folded ends and small laurel leaves at both ends, to sit over the top edge of a wooden banner; the middle is plain and empty for the words.
```

## After the sheets are generated (what Claude does)

1. `python scripts/make-progress-assets.py` (new): cuts each sheet by shape, trims, resizes to WebP (icons 160 px, medals 256, storefronts 384, goals 640 x 320, knives 480 x 240, boards 320, pieces 512, wide 768 wide; q 76 to 80), writes `public/progress/<sheet>/<name>.webp` and `src/game/progressArtFiles.ts`; stops with a list if a cell is empty or two pictures touch.
2. The page switches from the fallbacks to the paintings; the side-by-side check against the nine reference pictures follows.
3. This file is marked DELIVERED, as the icon prompts were.
