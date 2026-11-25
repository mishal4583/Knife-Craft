# Business pages, painted: Codex prompts for every picture (2026-11-25)

**Plan:** `docs/planning/BUSINESS-UI-REDESIGN-PLAN-2026-11-25.md`.
**The developer's design document (the source of truth for the look):** `C:\Users\HP\Documents\OneDrive\Documents\Business UI design.docx` (11 pictures).
**The same 11 pictures, one file each, in this repo** (attach these to EVERY prompt below: they are the style and the content reference):

```
docs/planning/reference/business-ui/01-overview-pace-rank-one-restaurant.jpg
docs/planning/reference/business-ui/02-equipment-your-refrigerator.jpg
docs/planning/reference/business-ui/03-equipment-refrigerators-knives.jpg
docs/planning/reference/business-ui/04-upgrades-grand-kitchen.jpg
docs/planning/reference/business-ui/05-suppliers-picker-standing-orders.jpg
docs/planning/reference/business-ui/06-suppliers-contracts.jpg
docs/planning/reference/business-ui/07-menu-management.jpg
docs/planning/reference/business-ui/08-operations-attention-service.jpg
docs/planning/reference/business-ui/09-operations-inspection-finance.jpg
docs/planning/reference/business-ui/10-operations-last-30-days.jpg
docs/planning/reference/business-ui/11-operations-purchasing-ingredients.jpg
```

(If Codex cannot read the repo, open the .docx and save its 11 pictures; they are in the document in this order.)

**Also attach, for the exact finish of the icons, ONE sheet from the Restaurant Progress set already made in this project** (the Business pages sit next to that page and must look the same): `Restaurant Progress Assets/RP-icons-a.png` (and `RP-pieces.png` for the pieces and decor sheets).

## How to use this file

1. For each sheet below: attach the 11 reference pictures (and the extra reference named in the sheet), paste the prompt, generate ONE image.
2. Save it as `Business UI Assets/RB-<sheet>.png` in the repo root (the sheet id is in the heading). The folder is a Codex source folder like `Restaurant Progress Assets/`: not part of the build, ignored by git.
3. Tell Claude "business assets are generated": Claude runs `scripts/make-progress-assets.py` with the Business sheet list (cuts every picture by its shape, trims it, resizes it to WebP into `public/business/art/`), and the pages switch to the paintings by themselves.
4. A sheet that comes out wrong is simply generated again; sheets do not depend on each other. Suggested order: RB-pieces, RB-icons-a, RB-icons-b, RB-icons-c, RB-fridges, RB-decor-a, RB-decor-b, RB-decor-c, RB-banners.

> **DELIVERED AND INTEGRATED 2026-11-25:** all 9 sheets were generated (`RB-icons-b` and `RB-decor-c` on the second try), cut by `scripts/make-progress-assets.py --business` and are on the pages. This file is kept for the prompts.

**The 11 pictures are AI-made concept images:** follow their STYLE and the CONTENT named in each prompt, not their glitches (stray or garbled letters, odd counts, uneven edges). Do not copy any text from them.

**Do NOT draw these (they already exist in the game):** the dish photos (the Menu uses the game's own 221 painted dishes), the six kitchen pictures, the ingredient icons, and these painted icons from the Restaurant Progress sheets: coins, money bag, cash, bars, trend chart, trophy, crown, star, sparkles, chef toque, storefront, open book, padlock, knife, hammer, cutting board, clipboard with tick, guests, people, box, crate, takeaway bag, cloche, calendar, tick, leaf sprigs, the medals, the city skyline, the knives-board-whetstone group.

## Rules for every sheet

- A **transparent background** (real alpha: no checkerboard, no white, no grey, no shadow plate). One picture per grid cell, in the order listed, centred, filling about 80 % of the cell (decor and banner cells: about 90 % of the width), never touching the cell's edge, with empty space between pictures.
- **No text, no numbers, no letters, no watermark, no grid lines, no cell numbers.** Where a picture has a place for a name or a number (a plaque, a ribbon, a date page, a chalkboard), leave that place **blank and plain**: the game writes the real words over it.
- The sheet size and cell size are stated in each prompt; keep them exactly (the build script cuts the sheet by shape and uses the cells to order the pictures).
- Same light on every picture (from the upper left), the same thin darker-brown outline weight across the whole sheet, the same glossy finish.
- Every icon must read when shown small (32 to 48 px): a bold simple silhouette first, detail second.
- Show exactly the object described; do not invent a different object.

## The shared style (repeated inside each prompt, so each can be pasted alone)

> Warm, glossy, hand-painted cartoon mobile-game UI art, exactly in the style of the attached eleven mock-up pictures: soft rounded shapes, a thin darker-brown outline, soft highlights from the upper left, a gentle shadow shape under each object, rich honey-gold, copper, cream, warm brown and leaf-green colours, polished and cheerful, never photographic, never flat vector, never pixel art.

---

## RB-pieces: UI pieces (6), `RB-pieces.png`, 1920 x 1280 px = 3 x 2 cells of 640 x 640

Extra reference to attach: `Restaurant Progress Assets/RP-pieces.png`.

```
Create ONE image, 1920 x 1280 px, on a fully transparent background: a sprite sheet of 6 separate painted UI pieces in a grid of 3 columns x 2 rows (each cell 640 x 640), one piece per cell, centred, filling about 85 % of the cell, never touching the cell edge. No text, no numbers, no letters, no grid lines.

Style: warm, glossy, hand-painted cartoon mobile-game UI art, exactly in the style of the attached eleven mock-up pictures: soft rounded shapes, a thin darker-brown outline, soft highlights from the upper left, a gentle shadow, rich honey-gold, copper, cream, warm brown and leaf-green colours.

In reading order, left to right, top to bottom:
1. LAUREL-LEFT: one golden-green laurel branch curving like the LEFT half of a wreath (stem at the bottom, tip curving up and inward), about 15 leaves, gold with a thin brown outline. It is placed at the left of a name in the game.
2. LAUREL-RIGHT: the exact mirror image of piece 1 (the RIGHT half of a wreath).
3. NAME-RIBBON: a wide, short ribbon-plaque in dark walnut wood with a glossy finish, a thin gold-brown outline and tiny gold studs at both ends, slightly curved ends; the face is completely blank and plain (the game writes a kitchen's name on it). Wider than tall (about 3 : 1).
4. SUNBURST: a soft round burst of golden light rays behind an object (like the glow behind the current fridge and the current kitchen): a warm gold-cream circle with 14 long soft rays fading to transparent at the edges; no object in it.
5. PRICE-LAUREL: a complete oval wreath of two golden laurel branches (like the two sprigs around the price in the Menu picture, joined into a round wreath with a small gap at the top), the inside is empty (transparent) so a price can be written in it; wider than tall (about 1.3 : 1).
6. PLATE-FRAME: a square picture frame for a dish: a rounded square with a thick glossy gold-brown frame and a warm polished wooden tabletop inside (light honey-brown planks, a soft vignette darker at the corners); the middle of the wood is empty (the game lays a plate on it). Square.
```

---

## RB-icons-a: overview, equipment and suppliers icons (23), `RB-icons-a.png`, 2000 x 2000 px = 5 x 5 cells of 400 x 400

Extra reference to attach: `Restaurant Progress Assets/RP-icons-a.png` (the finish).

```
Create ONE image, 2000 x 2000 px, on a fully transparent background: a sprite sheet of 23 separate painted icons in a grid of 5 columns x 5 rows (each cell 400 x 400), one icon per cell, centred, filling about 80 % of the cell, never touching the cell edge. The last two cells (24 and 25) stay completely empty. No text, no numbers, no grid lines.

Style: warm, glossy, hand-painted cartoon mobile-game UI art, exactly in the style of the attached eleven mock-up pictures: soft rounded shapes, a thin darker-brown outline, soft highlights from the upper left, a gentle shadow shape under each object, rich honey-gold, copper, cream, warm brown and leaf-green colours. Each icon must read at 32 px.

In reading order, left to right, top to bottom:
1. STOPWATCH: a gold stopwatch with a red-brown rim, a cream face with a red hand and tick marks, a small crown button on top (the "Pace" heading).
2. CLIPBOARD-CALC: a wooden clipboard with a paper that has a small calculator drawn at the top and three lines of figures, a metal clip (the "Costs" tile).
3. CHAIR: a small wooden dining chair seen from the front-side, warm brown (guest seats).
4. SECOND-FLOOR: a small two-storey cream and terracotta building with an awning on the ground floor and blue shuttered windows on the upper floor.
5. CLOCK-GOLD: a round gold wall clock with a cream face, hands at ten past ten, thick gold rim.
6. PLATE-CUTLERY: a white round plate with a gold rim, a silver fork on its left and a silver knife on its right (the "One Restaurant" heading).
7. WALLET-CASH: a brown leather wallet, half open, with a green banknote sticking out (the "one wallet" footer).
8. FRIDGE-ICON: a small steel double-door refrigerator, front view, two vertical handles, light blue-grey steel (the "Refrigerators" heading).
9. THUMBS-UP: a green glossy thumbs-up hand (the "GOOD" badge).
10. WRENCH: a silver-grey open-end wrench, diagonal, with a copper highlight (the "Condition" row).
11. BURST: an orange-red comic explosion star, jagged, with a yellow centre (the "breaks" warning).
12. VOLUME-WEDGE: a golden-yellow triangular wedge / set square with a few measuring tick marks (the "ft³" pill).
13. CART: a shopping cart with an orange body and a blue handle, small wheels (the "Shared" / "Min. order" chip).
14. MOON: a golden crescent moon with one tiny star (the "Order at closing" line).
15. SUN: a golden-orange sun with short rays and a soft face-less disc (the "Arrives by morning" line).
16. PRICE-TAG: a gold price tag on a string, a small hole, blank (the "today's price" line).
17. ALARM-CLOCK: a small red alarm clock with two little bells on top, cream face (the "+1 day fresh" chip).
18. CANCEL-CIRCLE: a copper-brown round button with a cream circle and a bold X inside (the "Cancel" tile).
19. LOCAL-MARKET: a small market shop with a red-and-white striped awning, a blue window, and a crate of vegetables at the door (the "Local Market" supplier).
20. WHOLESALE-TRUCK: a cheerful yellow delivery truck with a blue cab, white window, side view (the "Wholesale Supplier").
21. PREMIUM-BASKET: a woven wicker basket with a red handle, filled with tomatoes and leafy greens (the "Premium Supplier").
22. FRESH-DELIVERY: a bunch of broccoli, a red tomato and an orange carrot with its green top, grouped (the "Fresh delivery" row).
23. WEEKLY-BOX: a closed brown cardboard box with tape on top and a small green leaf sticker (the "Weekly delivery" row).
```

---

## RB-icons-b: operations, inspection, finance and analytics icons (19), `RB-icons-b.png`, 2000 x 1600 px = 5 x 4 cells of 400 x 400

Extra reference to attach: `Restaurant Progress Assets/RP-icons-a.png` (the finish ONLY).

**This is NOT the Restaurant Progress `icons-b` sheet.** The first try came back with that sheet's pictures (crossed hammer and wrench, a fried egg in a pan, a couple at a table, a paper bag, an open box, a bar of soap, sparkles, a man in a flat cap, two people, a lightning bolt, a crate of tomatoes, a heart, and five buildings). **None of those may appear.** Draw ONLY the 19 pictures listed below, in this order.

```
Create ONE image, 2000 x 1600 px, on a fully transparent background: a sprite sheet of 19 separate painted icons in a grid of 5 columns x 4 rows (each cell 400 x 400), one icon per cell, centred, filling about 80 % of the cell, never touching the cell edge. The last cell (20) stays completely empty. No text, no numbers, no grid lines.

Style: warm, glossy, hand-painted cartoon mobile-game UI art, exactly in the style of the attached eleven mock-up pictures: soft rounded shapes, a thin darker-brown outline, soft highlights from the upper left, a gentle shadow shape under each object, rich honey-gold, copper, cream, warm brown and leaf-green colours. Each icon must read at 32 px.

In reading order, left to right, top to bottom:
1. BELL-GOLD: a shiny golden hand bell with a wooden handle, a small shine (the "What Needs Attention" heading).
2. WARNING-TRIANGLE: a yellow triangle with a rounded red-brown outline and a bold dark exclamation mark.
3. SHIELD: a blue heart-shaped shield with a gold rim and a white tick on it (inspection checks).
4. TRASH-BIN: a grey-silver round dustbin with a lid, slightly open.
5. SNOWFLAKE: a pale blue ice-crystal snowflake with six arms (the "Food Storage" check).
6. HOURGLASS: a wooden hourglass with golden sand, half run (the "Ingredient Expiry" check).
7. ICE-CUBE: a glossy light-blue cube of ice with a white highlight (the "Refrigerator Condition" check).
8. BROOM: a straw broom with a wooden handle and a golden sparkle (the "Kitchen Cleanliness" check).
9. BADGE-OK: a small round green badge with a white tick, a cream rim (a status badge).
10. BADGE-WARN: a small round orange badge with a white exclamation mark, a cream rim.
11. BADGE-BAD: a small round red badge with a white X, a cream rim.
12. CROSSED-CUTLERY: a silver fork and knife crossed in an X (the "Costs" row of the all-time card).
13. DATE-PAGE: a small tear-off calendar page: cream paper, a red header band with two ring holes, a completely BLANK white square below (the game writes the day number there).
14. GRAIN-SACK: a burlap sack tied at the top with a small wheat ear badge on its front (the "Ingredient Purchasing" heading).
15. CUBES: three golden-brown wooden cubes stacked like a small pyramid (the "Spent Today" tile).
16. SMALLWARES: a copper frying pan with a whisk and a wooden spoon leaning on it.
17. TABLEWARE: a neat stack of five white plates with gold rims.
18. TAKEAWAY-BOX: an open kraft-paper takeaway box with a folded lid and a small fork-and-spoon mark on it (no text).
19. VEG-BASKET: a small wicker basket with a red handle holding a tomato, a green leaf and a carrot (the "Ingredients Used" heading).
```

---

## RB-icons-c: the seven dish-category icons (7), `RB-icons-c.png`, 1600 x 800 px = 4 x 2 cells of 400 x 400

Extra reference to attach: picture 07 (the category chips row).

```
Create ONE image, 1600 x 800 px, on a fully transparent background: a sprite sheet of 7 separate painted food-category icons in a grid of 4 columns x 2 rows (each cell 400 x 400), one icon per cell, centred, filling about 80 % of the cell, never touching the cell edge. The last cell (8) stays completely empty. No text, no numbers, no grid lines.

Style: warm, glossy, hand-painted cartoon mobile-game UI art, exactly in the style of the attached eleven mock-up pictures (see the category chips in picture 07): soft rounded shapes, a thin darker-brown outline, soft highlights from the upper left, a gentle shadow shape, rich warm colours. Each icon must read at 28 px.

In reading order:
1. SALAD: a wooden bowl of fresh salad: green lettuce, a red tomato slice, a cucumber slice.
2. APPETIZER: a wooden skewer with three bite-size pieces of food (a golden fried bite, a red pepper piece, a green herb leaf).
3. ENTREE: a silver cloche (serving dome) with a small round knob on top, seen from the side, with a little shine.
4. SIDE: a red paper carton of golden french fries.
5. CURRY: a round copper-brown pot with two handles and a lid slightly open, a little steam.
6. DESSERT: a slice of layered cake (pink and cream layers, a red cherry on top) on a small plate.
7. STIR-FRY: a black wok with a wooden handle, with colourful stir-fried vegetables (carrot, green pepper, broccoli) leaping above it.
```

---

## RB-fridges: the three refrigerators (3), `RB-fridges.png`, 1920 x 640 px = 3 x 1 cells of 640 x 640

Extra reference to attach: picture 03 (the three fridge cards) and picture 02.

```
Create ONE image, 1920 x 640 px, on a fully transparent background: three separate painted refrigerators in a row, one per cell (each cell 640 x 640), each standing upright, centred, about 75 % of the cell high, with a soft oval shadow on the floor under it, never touching the cell edge. No text, no numbers, no labels.

Style: warm, glossy, hand-painted cartoon mobile-game UI art, exactly in the style of the attached eleven mock-up pictures: soft rounded shapes, a thin darker-brown outline, soft highlights from the upper left, polished and cheerful, never photographic.

In order, left to right (the three refrigerators of picture 03, all drawn straight from the front):
1. BASIC: a small cream-white single-door fridge (a retro style), one slim dark handle on the right of the door, short dark feet; about 1.6 times as tall as wide.
2. COMMERCIAL: a brushed-steel two-door fridge in a light blue-grey, two vertical dark handles side by side, dark base grille; about 1.5 times as tall as wide, wider than the basic one.
3. PROFESSIONAL: a big brushed-steel three-door fridge in a light blue-grey, three vertical dark handles, a vent grille on top and at the bottom; about 1.3 times as tall as wide, the widest and richest of the three.
The three fridges must be the same height in the sheet (the bigger one is wider, not taller), the same steel finish and the same light.
```

---

## RB-decor-a: card decoration pictures, set 1 (9), `RB-decor-a.png`, 2048 x 1920 px = 2 x 5 cells of 1024 x 384

Extra reference to attach: `Restaurant Progress Assets/RP-wide.png` (the Progress decor, for the same finish).

These sit in the top-right corner of a card, half-hidden behind its edge, so each is a compact cluster, wider than tall, with soft leaf sprigs at its edges and a flat bottom (it "stands" on the card's edge).

```
Create ONE image, 2048 x 1920 px, on a fully transparent background: a sprite sheet of 9 separate painted decoration clusters in a grid of 2 columns x 5 rows (each cell 1024 x 384), one cluster per cell, centred, filling about 90 % of the cell width and about 85 % of its height, never touching the cell edge. The last cell (10) stays empty. No text, no numbers, no letters, no grid lines.

Style: warm, glossy, hand-painted cartoon mobile-game UI art, exactly in the style of the attached eleven mock-up pictures: soft rounded shapes, a thin darker-brown outline, soft highlights from the upper left, a gentle shadow, rich honey-gold, copper, cream, warm brown and leaf-green colours.

In reading order, left to right, top to bottom:
1. PACE-CLUSTER (top-right of picture 01's Pace card): a shiny silver serving cloche in the middle, green leafy sprigs on both sides, a short stack of gold coins on its right.
2. KITCHEN-GHOST (the faint picture behind picture 04's header): a soft, pale-cream, low-contrast (about 25 % opacity look) silhouette group: a chef toque, a shelf with jars and a plant, hanging pans and a pot on a rail; drawn only in pale warm beige on transparent, no strong colours, no outline.
3. FRIDGE-SHELF (top-right of picture 03's Refrigerators card): a wooden shelf with two honey / jam jars and a small potted plant, with the corner of a cream fridge peeking from the right edge, green leaves around.
4. PRODUCE-CLUSTER (picture 05, top-right): a wooden crate of red tomatoes, a green lettuce head, a burlap flour sack with a wheat badge, a bottle of golden oil, leaves around.
5. ORDERS-CLUSTER (picture 05, standing orders): three stacked brown cardboard boxes and a wooden clipboard with a green tick list, leaves around.
6. STALL-GHOST (picture 05, today's conditions, the faint picture): a soft, pale-cream, low-contrast silhouette of a market stall with a striped awning, crates and a small chalk sign with a carrot; pale warm beige on transparent, no strong colours, no outline (about 25 % opacity look).
7. STALL-TOMATOES (picture 06, Local Market): a small market stall with a yellow-and-white striped awning, crates of red tomatoes and green peppers in front, leaves at both sides.
8. WAREHOUSE (picture 06, Wholesale): a grey-roofed warehouse with an open door showing stacked cardboard boxes, a few crates in front, leaves at both sides.
9. TOMATO-BAG (picture 06, Premium): a wooden crate of red tomatoes and a gold-coloured sack tied with a string and marked with a gold star, sparkles around, leaves.
```

---

## RB-decor-b: card decoration pictures, set 2 (9), `RB-decor-b.png`, 2048 x 1920 px = 2 x 5 cells of 1024 x 384

Extra reference to attach: `Restaurant Progress Assets/RP-wide.png`.

```
Create ONE image, 2048 x 1920 px, on a fully transparent background: a sprite sheet of 9 separate painted decoration clusters in a grid of 2 columns x 5 rows (each cell 1024 x 384), one cluster per cell, centred, filling about 90 % of the cell width and about 85 % of its height, never touching the cell edge. The last cell (10) stays empty. No text, no numbers, no letters, no grid lines.

Style: warm, glossy, hand-painted cartoon mobile-game UI art, exactly in the style of the attached eleven mock-up pictures: soft rounded shapes, a thin darker-brown outline, soft highlights from the upper left, a gentle shadow, rich honey-gold, copper, cream, warm brown and leaf-green colours. Each is a compact cluster, wider than tall, with soft leaf sprigs at its edges and a flat bottom.

In reading order, left to right, top to bottom:
1. INSPECTION-CLUSTER (picture 08, Inspection Warning): a wooden clipboard with a green tick list leaning on the left, a golden serving cloche on the right, green leaves around.
2. SPOILS-CLUSTER (picture 08, Stock Spoils Tonight): a wooden hourglass on the right, a ripe tomato, a lettuce head and a pink-brown cut of meat on its left, leaves around.
3. CHALKBOARD (picture 08, Today's Service): a standing wooden A-frame chalkboard with a dark-green board that has a white chef toque drawn on it (a drawing, not letters), a potted green plant at its left foot.
4. CHART-EASEL (picture 10, Last 30 Days): a wooden easel with a white board showing a rising gold line chart with bars (no numbers or letters), a potted plant at its right.
5. CLOCHE-LAUREL (pictures 10 and 11, Best-Selling Dishes): a golden serving cloche with a shine, two golden laurel branches curving around it on both sides, small sparkles above.
6. PURCHASING-CLUSTER (picture 11, Ingredient Purchasing): a wooden crate of red tomatoes, a burlap grain sack with a wheat badge, a bottle of golden olive oil, leaves around.
7. BAG-CLUSTER (picture 11, Supply Purchasing): a brown paper shopping bag with a small plate-and-cutlery mark (a drawing, not letters) and two stacked kraft takeaway boxes in front, leaves around.
8. USED-CLUSTER (picture 11, Ingredients Used): a ripe red tomato, two garlic bulbs, a bottle of golden olive oil, green leaves around.
9. CLIPBOARD-LARGE (picture 09, Inspection · Right Now header): a LARGE wooden clipboard with a paper showing three green tick lines, a big magnifying glass with a gold rim held in front of it, green leaf sprigs at its left side. Taller than wide (about 1 : 1.2), centred in its cell; it is allowed to be taller than the other pieces (up to 95 % of the cell height).
```

---

## RB-decor-c: one more decoration picture (1), `RB-decor-c.png`, 2048 x 384 px = 2 x 1 cells of 1024 x 384

Extra reference to attach: picture 03 (the "Knives, boards & sharpening" card, top-right group) and `Restaurant Progress Assets/RP-wide.png`.

```
Create ONE image, 2048 x 384 px, on a fully transparent background: a sprite sheet of 1 painted decoration cluster in a grid of 2 columns x 1 row (each cell 1024 x 384). The picture goes in the LEFT cell (cell 1), centred, filling about 90 % of the cell width and about 85 % of its height, never touching the cell edge. The right cell (cell 2) stays completely empty. No text, no numbers, no letters, no grid lines.

Style: warm, glossy, hand-painted cartoon mobile-game UI art, exactly in the style of the attached eleven mock-up pictures: soft rounded shapes, a thin darker-brown outline, soft highlights from the upper left, a gentle shadow, rich honey-gold, copper, cream, warm brown and leaf-green colours. A compact cluster, wider than tall, with soft leaf sprigs at its edges and a flat bottom.

1. KNIVES-DECO (picture 03, top-right of the "Knives, boards & sharpening" card): on the left a wooden chopping board standing on its edge (a round hanging hole at its top), in the middle a flat grey sharpening whetstone on a small wooden base with a golden sparkle above it, on the right a wooden knife block holding three chef knives with dark handles; green leaf sprigs at both ends. No chef hat, no vegetables.
```

---

## RB-banners: two wide pictures (2), `RB-banners.png`, 1536 x 1152 px = 1 x 2 cells of 1536 x 576

Extra reference to attach: pictures 02 (the equipment banner) and 07 (the "Menu Management" plaque).

```
Create ONE image, 1536 x 1152 px, on a fully transparent background, with two separate pictures stacked vertically, one per cell (each cell 1536 x 576), centred, never touching the cell edge. No text, no numbers, no letters, no grid lines.

Style: warm, glossy, hand-painted cartoon mobile-game UI art, exactly in the style of the attached eleven mock-up pictures: soft rounded shapes, a thin darker-brown outline, soft highlights from the upper left, rich honey-gold, copper, cream, warm brown and leaf-green colours.

1. EQUIPMENT-SCENE (the banner of picture 02), the TOP cell: a wide rounded-rectangle picture (about 2.6 : 1, filling about 92 % of the cell width) with a thick glossy gold frame and rounded corners (the area outside the frame is transparent). Inside: a warm dark-wood kitchen storage room lit from the right: on the right a big brushed-steel double-door refrigerator, behind it wooden shelves with glass jars and wicker baskets of food and a warm light strip under the top shelf, a green potted plant on the floor next to the fridge, a tiled wall at the lower right. On the LEFT third of the picture a large dark-walnut wooden plaque with a gold-brown border, a chef toque with a small laurel wreath above it, and a plain EMPTY face (the game writes "Kitchen Equipment" on it).
2. MENU-PLAQUE (the heading of picture 07), the BOTTOM cell: a dark walnut wooden ribbon plaque (about 4.5 : 1, filling about 70 % of the cell width), curved ends, a glossy finish with a thin gold-brown outline and tiny gold studs, a white chef toque on a round gold-rimmed medallion overlapping its left end, a leafy green sprig at each end; the face of the plaque is completely EMPTY and plain (the game writes "Menu Management" on it).
```

---

## After generation (what Claude does)

1. Save the eight files as `Business UI Assets/RB-<sheet>.png`; tell Claude "business assets are generated".
2. Claude checks each sheet (size, transparency, counts, edge-spill) the way the Progress sheets were checked, lists any sheet to regenerate, runs the cutter, switches the pages, and tunes them side by side with the 11 pictures.
3. Regenerating one sheet never touches the others. The prompts stay in this file.
