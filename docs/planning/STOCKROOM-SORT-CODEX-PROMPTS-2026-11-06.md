# Stockroom Sort: Codex art prompts (2026-11-06)

Source: `STOCKROOM-SORT-MINIGAME-PLAN-2026-11-06.md` §8 (the plan is the source; if a prompt changes there, rebuild this file).

**Where the art goes:** `D:\WORKS\GAMES\Knife Craft\Iventory Assets` (the folder name keeps the developer's spelling; it exists and is empty).

## How to use

**Option 1, one paste (Codex with file access).** Open ONE Codex conversation, attach the reference images listed in the prompt (or let Codex open them from the paths), and paste the whole **MASTER PROMPT** below. Codex makes the 20 images one at a time and saves each into the folder with the exact file name.

**Option 2, one image at a time (image chat).** Paste the **STYLE BIBLE** and then ONE **ASSET** block. Ask for 4 variants, keep the best, attach it as the reference for the next. Save the picked PNG into the folder under the exact file name.

**Order:** I03 (cubby) first, then I10 (goods sheet 1), then the rest. Accept a piece only after the checklist at the bottom.

**Reference files to attach (all in `D:\WORKS\GAMES\Knife Craft`):**
1. `public/inventory/supplies-stockroom.webp`: the room the game lives in (dark green wall, walnut shelf with brass bracket, cream plates, sage cabinet, ivy, warm light).
2. `public/inventory/ingredients-stockroom-upgraded.webp`: the pantry room (wooden crates, burlap sacks, lanterns, brick).
3. `public/business/fridge-sort/kitchen-wall.webp`, `basket.webp`, `shelf-glass.webp`, `hud-wide.webp`: the painted look of the sibling mini-game (wood, brass, ivy).
4. `art-source/market-supplies/S1-culinary-tools.png` ... `S6-cleaning-tools.png` and `ASSET-MANIFEST.md`: the 62 supplies and their order.
5. The two "Goods Puzzle" screenshots (the wooden cubby shelf with 3 slots per cubby, a 3-of-a-kind sort game): use them ONLY for the layout idea (open wooden cubbies, 3 items in a row, items standing inside). Do not copy their characters, brands, drink cans, bear mascot or packaging.

---

## STYLE BIBLE (repeat at the top of every request in Option 2)

```
STYLE BIBLE — KnifeCraft "Stockroom Sort" mini-game art.
A warm, cozy, hand-painted mobile-game look in the same family as the attached KnifeCraft stockroom and Fridge Sort pictures:
soft painterly shading, gentle rim light, rounded chunky shapes, a thin darker outline in a warm brown (never pure black), rich but not
neon colors, walnut wood grain, brass fittings, sage green, cream and kraft paper, a few ivy leaves. Light comes from the top-left, warm
golden (about 3200 K), with a soft shadow falling bottom-right. Everything must look like ONE set: same line weight, same softness, same
saturation.
GOODS must read at 56 px: bold silhouette, front-facing, standing upright, one clear main color, a bright highlight on the top-left, a
slightly thicker outline than a normal illustration, no tiny details. Flat things (plates, trays, sheets, napkins, cloths) are shown as a
small neat STACK or standing at a slight angle so they read as an object, never as a flat disc.
STRICT RULES: NO text, NO letters, NO numbers, NO logos, NO brand names, NO watermarks, NO signature, NO people, NO animals, NO mascots,
NO UI chrome unless the asset IS the UI piece. Blank labels, tags and plaques stay BLANK (the game draws the words itself).
Output: PNG with a TRANSPARENT background (alpha) unless the asset says "full scene". If transparency is not possible, use a flat pure
chroma green #00FF00 background with no green anywhere in the subject and no shadow on the background (for green items such as cleaning
bottles use flat magenta #FF00FF instead and say so in the reply).
Keep a clear margin of about 4% around the subject so nothing is cut off. Deliver ONE image per request, exactly the size asked.
SHEET RULES (for sheets): the exact grid asked, each item centered in an equal cell at the same scale (about 78% of the cell), transparent
background, NO grid lines, NO labels, NO shadows crossing cells, cells in READING ORDER (left to right, top to bottom); a cell marked
EMPTY stays empty.
```

---

## MASTER PROMPT (Option 1: paste this whole block)

```
You are making the art for a new KnifeCraft mini-game called "Stockroom Sort". Work through the 20 assets below ONE image at a time, in the
order given, and save every finished PNG into this folder with EXACTLY the file name shown:

    D:\WORKS\GAMES\Knife Craft\Iventory Assets

If you cannot write to that folder, save into your normal output folder and tell me the exact full paths at the end. Do not skip an asset,
do not merge two assets, do not change a size. Attach/open the reference files first and keep ONE look for the whole set.

THE GAME (so you draw the right things): the player buys supplies (pots, tools, plates, takeaway boxes, cleaning items) in the restaurant's
Market. The delivery arrives as SETS of 3 identical products scattered across a wooden shelf of cubbies (open compartments, 3 slots in a
row each). The player moves products between cubbies to put 3 of a kind together; 3 alike are "stocked" and pop away. It looks and feels
like the warm stockroom in `public/inventory/supplies-stockroom.webp`, so the shelf is walnut wood with brass fittings against a deep green
wall, and the goods are chunky, bold and readable at 56 px.

REFERENCES (open these): D:\WORKS\GAMES\Knife Craft\public\inventory\supplies-stockroom.webp, ...\public\inventory\ingredients-stockroom-upgraded.webp,
...\public\business\fridge-sort\kitchen-wall.webp, basket.webp, shelf-glass.webp, hud-wide.webp, and the six atlases
...\art-source\market-supplies\S1-culinary-tools.png to S6-cleaning-tools.png (the 62 supplies and their order).
The two attached "Goods Puzzle" screenshots are only for the layout idea (open wooden cubbies, 3 items in a row). Do NOT copy their
characters, brands, cans, bottles or the bear mascot.

[PASTE THE STYLE BIBLE HERE]

ASSETS (file name — size — what):
I01-backdrop-supplies.png — 1080 x 1920, FULL SCENE (no transparency) — see block I01
I02-backdrop-pantry.png — 1080 x 1920, FULL SCENE — see block I02
I03-cubby.png — 960 x 560 — see block I03
I04-unit-top.png — 1200 x 140 — see block I04
I05-unit-plinth.png — 1200 x 120 — see block I05
I06-lock-parts.png — 512 x 256 — see block I06
I07-parcels.png — 512 x 256 — see block I07
I10-goods-1.png ... I15-goods-6.png — 1024 x 768 each — see blocks I10-I15
I20-boosters.png — 1024 x 512 — see block I20
I21-ribbons.png — 1024 x 256 — see block I21
I22-fx.png — 1024 x 512 — see block I22
I23-stamp.png — 512 x 512 — see block I23
I24-hand-pointer.png — 256 x 256 — see block I24
I25-delivery-truck.png — 640 x 640 — see block I25
I26-badges.png — 1024 x 768 — see block I26

After each image: look at it against the CHECKLIST (bottom of this file) and redo it if it fails. Shrink it to 56 px in your head: if a good is
unrecognizable, redo it. When all are saved, write D:\WORKS\GAMES\Knife Craft\Iventory Assets\ASSET-MANIFEST.md listing every file, its size, and
(for the goods sheets) the cell-by-cell contents, and tell me anything you could not do.
```

---

## SCENES

### I01 — Backdrop, supplies stockroom (`I01-backdrop-supplies.png`)

```
ASSET I01 (FULL SCENE, no transparency), 1080 x 1920 px, portrait. The supplies stockroom of the attached `supplies-stockroom.webp`, seen straight
on and slightly from above: a deep green painted wall with a subtle wood-panel wainscot, a warm brass wall lamp glowing at the top-left and
a soft sunbeam falling across the wall, an ivy vine hanging at the top-right corner, a walnut counter strip across the bottom 15% with a
sage-green cabinet door and a round brass knob. The CENTER 70% x 60% of the image is calm, empty, evenly lit wall (the game draws the shelf
unit there), with a soft dark vignette at the corners. A few quiet details at the edges only: a stack of cream plates and a folded kitchen
cloth on the counter at the far left, a wooden spoon pot at the far right. No shelf unit, no text, no people.
```

### I02 — Backdrop, pantry stockroom (`I02-backdrop-pantry.png`)

```
ASSET I02 (FULL SCENE, no transparency), 1080 x 1920 px, portrait. The pantry stockroom of the attached `ingredients-stockroom-upgraded.webp`,
straight on: warm old brick wall and dark timber beams, two glowing lanterns at the top corners, hanging strings of garlic and chilies at the
edges, burlap sacks and wooden crates stacked low at the far left and far right edges, a worn stone floor strip across the bottom 15% with a
red patterned runner. The CENTER 70% x 60% is calm, empty, warmly lit brick wall (the game draws the shelf unit there) with a soft dark
vignette at the corners. No shelf unit in the center, no text, no people.
```

---

## SHELF KIT

### I03 — The cubby (`I03-cubby.png`)

```
ASSET I03: ONE open wooden cubby (a single compartment of a stockroom shelf unit), front view with a slight 3/4 look so the RIGHT side
shows a thin depth face and the top shows a thin lid edge. Walnut wood, visible grain, brass corner caps, a darker back wall inside, a
slightly lighter floor board. INSIDE it is EMPTY with exactly THREE evenly spaced, equally sized standing positions along the floor (do not
draw dividers; the positions are only implied by the width: items 52 px wide will stand at x = 20 %, 50 %, 80 %). The floor board has a THICK
FRONT LIP (about 14 % of the height) so goods placed behind it look like they are inside the cubby. Wide proportions: about 1.7 : 1.
Transparent background outside the cubby. 960 x 560 px.
```

### I04 — Shelf unit top cap (`I04-unit-top.png`)

```
ASSET I04: a long walnut top board (the cap of a stockroom shelf unit), seen straight on with a slight top face, brass end caps, a soft
shadow underneath. It must tile in the middle (the left and right ends are the caps). Transparent background. 1200 x 140 px.
```

### I05 — Shelf unit plinth (`I05-unit-plinth.png`)

```
ASSET I05: a low walnut plinth / base with two short turned feet (the bottom of a stockroom shelf unit), straight on, brass trim along the
top edge. Same wood and brass as I04. Transparent background. 1200 x 120 px.
```

### I06 — Lock parts (`I06-lock-parts.png`)

```
ASSET I06: a sheet of 2 items, 2 columns x 1 row, 512 x 256 px, transparent background. Cells in order: 1) a chunky brass padlock, CLOSED, with a
short heavy chain looped across it (it will be drawn over a cubby to show it is locked); 2) the same padlock OPEN, hanging by its shackle,
no chain. Bold, readable at 56 px, same brass as the shelf fittings.
```

### I07 — Mystery parcels (`I07-parcels.png`)

```
ASSET I07: a sheet of 2 items, 2 columns x 1 row, 512 x 256 px, transparent background. Cells in order: 1) a kraft-paper wrapped parcel tied
with natural twine and a small bow, closed, BLANK (no label text); 2) the same parcel with the twine undone and the paper flaps folded open
(the inside is a flat warm cream so the game can show a product on top). Chunky and readable at 56 px.
```

---

## THE GOODS (62 supplies, 6 sheets, SAME ORDER as `art-source/market-supplies/ASSET-MANIFEST.md`)

Each sheet: **4 columns x 3 rows**, cells 256 x 256, 1024 x 768 px, transparent background, reading order. Draw each good as ONE item (or one small neat stack/bundle where it says so), standing upright, front-facing, in warm realistic colors with a bold outline. Keep every item recognizable at 56 px. Make items of the same family share a material (stainless steel = cool grey with a bright highlight; wood = walnut; cloth = cream; kraft = tan).

### I10 — Goods sheet 1 (`I10-goods-1.png`)

```
ASSET I10 — sheet of 12 stockroom goods, 4 columns x 3 rows, 1024 x 768 px. Cells in order:
1 stock pot (tall stainless pot with two handles and a lid)
2 saucepan (stainless, one long side handle, lid)
3 frying pan (dark non-stick pan seen at a slight angle, handle to the right)
4 sauté pan (deeper stainless pan with a helper handle and a lid)
5 utility tongs (stainless, scissor shape, standing)
6 high-heat turner / spatula (wide stainless head, black handle)
7 ladle (deep bowl, long handle, standing upright)
8 piano whisk (balloon whisk shape, standing upright)
9 vegetable peeler (swivel peeler, orange handle)
10 box grater (four-sided stainless grater standing up)
11 fine mesh skimmer (round mesh scoop, long handle)
12 sheet pan (a small stack of two aluminum baking sheets at an angle)
```

### I11 — Goods sheet 2 (`I11-goods-2.png`)

```
ASSET I11 — sheet of 12 stockroom goods, 4 columns x 3 rows, 1024 x 768 px. Cells in order:
1 mixing bowl (large stainless bowl, a stack of two nested)
2 lidded storage container (clear tub with a snug lid)
3 measuring cup set (four nested measuring cups fanned out, BLANK markings)
4 digital portion scale (a small flat scale with a blank round display)
5 probe thermometer (slim stainless probe with a blank round dial head)
6 oven mitts (a pair of padded quilted mitts, red)
7 dinner fork (a bundle of 3 forks tied with a cream ribbon, standing)
8 salad / dessert fork (a bundle of 3 small forks tied with a cream ribbon)
9 dinner knife (a bundle of 3 table knives tied with a cream ribbon)
10 serrated steak knife (a bundle of 3 steak knives, wooden handles, tied with a ribbon)
11 teaspoon (a bundle of 5 teaspoons tied with a ribbon)
12 soup spoon (a bundle of 3 round soup spoons tied with a ribbon)
```

### I12 — Goods sheet 3 (`I12-goods-3.png`)

```
ASSET I12 — sheet of 12 stockroom goods, 4 columns x 3 rows, 1024 x 768 px. Cells in order:
1 dinner plates (a neat stack of 4 cream plates with a thin green rim, seen at a slight angle)
2 side plates (a smaller stack of 4 cream plates)
3 soup / pasta bowls (a stack of 3 deep cream bowls)
4 dessert plates (a stack of 3 small cream plates with a scalloped rim)
5 water tumbler (a clear heavy-base glass, a stack of 2 side by side)
6 highball glass (two tall clear glasses side by side)
7 coffee cup and saucer (a cream cup on its saucer with a golden rim)
8 water pitcher (clear glass pitcher with a handle)
9 salt and pepper shakers (a pair of shakers, one white one dark, BLANK)
10 napkin dispenser (a small chrome tabletop dispenser with a few napkins sticking out)
11 blank menu / card holder (a tiny wooden stand holding a BLANK card)
12 lidded microwave-safe container (a clear tub with a vented lid, a stack of 2)
```

### I13 — Goods sheet 4 (`I13-goods-4.png`)

```
ASSET I13 — sheet of 12 stockroom goods, 4 columns x 3 rows, 1024 x 768 px. Cells in order:
1 foil meal container (a silver foil tray with a domed lid, standing)
2 three-compartment thali tray (a round steel tray with three wells)
3 kraft take-out box (a tan folded takeaway box, BLANK)
4 burger clamshell (a small tan clamshell box, open a crack)
5 deli wrap sheet (a roll of wax paper, a little paper unrolled)
6 stack of kraft deli sheets (a neat tan paper stack with a twine band)
7 handled kraft paper bag (a tan shopping bag with twisted rope handles, BLANK)
8 plastic carry-out bag (a white tied bag with loops)
9 tissue cube (a square tissue box with one tissue pulled up)
10 folded paper napkins (a small stack of white folded napkins with a paper band)
11 moist towelette sachet (a tiny square sealed sachet pair, BLANK)
12 wrapped cutlery kit (a napkin-wrapped fork, knife and spoon in a paper band)
```

### I14 — Goods sheet 5 (`I14-goods-5.png`)

```
ASSET I14 — sheet of 12 stockroom goods, 4 columns x 3 rows, 1024 x 768 px. Cells in order (use flat magenta #FF00FF as the background for this
sheet if any item is green, and say so):
1 wrapped toothpicks (a tiny sealed pack of toothpicks, BLANK)
2 tamper-evident labels (a roll of round labels, BLANK)
3 dish soap bottle (a yellow squeeze bottle with a flip cap, BLANK label)
4 all-purpose cleaner bottle (a blue spray bottle, BLANK label)
5 floor-cleaner jug (a green jug with a handle, BLANK label)
6 disinfectant spray bottle (a white trigger spray bottle with a teal band, BLANK)
7 hand-soap pump refill (a clear pump bottle with pink soap, BLANK)
8 jumbo toilet-paper roll (a big white roll on its side, a little unrolled)
9 folded paper hand towels (a neat stack of green-tinted folded paper towels)
10 microfiber cloths (a small stack of three folded cloths: blue, yellow, pink)
11 bin-liner roll (a roll of black bags, BLANK band)
12 mop bucket and wringer (a yellow bucket with a wringer and a mop head)
```

### I15 — Goods sheet 6 (`I15-goods-6.png`)

```
ASSET I15 — sheet of 2 stockroom goods, 4 columns x 3 rows, 1024 x 768 px, ONLY cells 1 and 2 drawn, cells 3-12 EMPTY. Cells:
1 lobby broom and dustpan (an upright broom with a small dustpan leaning on it)
2 toilet brush and caddy (a white brush standing in a small round caddy)
```

---

## UI AND EFFECTS

### I20 — Booster and badge icons (`I20-boosters.png`)

```
ASSET I20: a sheet of 8 round icon buttons, 4 columns x 2 rows, 1024 x 512 px, transparent background, each a round copper-and-cream button
with a brass rim, a symbol in the middle, NO text. Cells in order:
1 Undo (a curved arrow going back)   2 Hint (a glowing lightbulb)   3 Extra shelf (a tiny open cubby with a plus sign)
4 Extra time (an hourglass / stopwatch with a plus sign)   5 Shuffle (two crossing arrows)
6 blank button face (a plain round copper button, no symbol)   7 locked (a grey button with a small padlock)
8 ad badge (a small gold ribbon-shaped badge with a play triangle, for "watch to get this")
```

### I21 — Praise ribbons (`I21-ribbons.png`)

```
ASSET I21: a sheet of 4 items, 4 columns x 1 row, 1024 x 256 px, transparent background. Cells in order: 1) a BLANK sage-green ribbon banner,
2) a BLANK gold ribbon banner, 3) a BLANK copper ribbon banner, each with swallow-tail ends and a gentle curve (the game prints words like
"Great!" on them); 4) a BLANK gold starburst badge with a soft glow (for "combo"). No text.
```

### I22 — Pop effects (`I22-fx.png`)

```
ASSET I22: a sheet of 8 effect sprites, 4 columns x 2 rows, 1024 x 512 px, transparent background. Row 1: four different sparkle / star shapes
in warm gold and cream (a 4-point twinkle, a 5-point star, a round glint, a tiny plus). Row 2: four stages of a soft dust puff (a small
cream cloud growing larger and fainter, left to right). Soft, painterly, glowing; no hard outline except a very thin warm brown one on the stars.
```

### I23 — "Stocked" stamp (`I23-stamp.png`)

```
ASSET I23: a round rubber-stamp impression, BLANK in the middle (the game prints a word), a double ring in warm copper-red ink, a small
laurel leaf at the left and right of the ring, ink slightly uneven like a real stamp, a tiny star at the top. Transparent background.
512 x 512 px.
```

### I24 — Pointing glove (`I24-hand-pointer.png`)

```
ASSET I24: a cartoon cream-white work glove with a pointing index finger, angled about 20 degrees, a thin warm-brown outline, a soft shadow.
It is a tutorial cursor (the only hand allowed in this whole set). Transparent background. 256 x 256 px.
```

### I25 — Delivery hand truck (`I25-delivery-truck.png`)

```
ASSET I25: a steel two-wheel hand truck loaded with three stacked kraft-paper cartons tied with twine, one small carton on top with its flaps
open and a few BLANK packing sheets peeking out. 3/4 view, bold and chunky, readable at 96 px. NO text on the cartons. Transparent
background. 640 x 640 px.
```

### I26 — Collectible shelf badges (`I26-badges.png`)

```
ASSET I26: a sheet of 12 collectible enamel pins / brass shelf tags, 4 columns x 3 rows, 1024 x 768 px, transparent background, each a
different shape, one bold symbol, NO text. Cells in order: 1 a bronze star, 2 a silver star, 3 a gold star, 4 a blue rosette, 5 a green
ribbon, 6 a brass key, 7 a tiny wooden crate, 8 a stack of plates, 9 a stopwatch, 10 a hand truck, 11 a trophy cup, 12 a golden padlock.
```

---

## CHECKLIST (after each image)

- [ ] The exact file name, the exact size, nothing cut off, a margin of about 4 %.
- [ ] No text, letters, numbers, logos or brand names anywhere (blank labels stay blank).
- [ ] Transparent background (or flat #00FF00 / #FF00FF as stated), no halo, no floor shadow on the background.
- [ ] The same warm top-left light and the same brown outline as the first accepted piece.
- [ ] Goods: recognizable when shrunk to 56 px; bold silhouette; same scale in a sheet (about 78 % of the cell).
- [ ] Sheets: the exact cell order above; EMPTY cells really empty; no grid lines.
- [ ] Not a copy of the Goods Puzzle screenshots (no cans, no bear, no brand look-alikes).

## What the developer does after the images are in the folder

Ask Claude: "wire the Stockroom Sort art". It writes `build_stockroom()` in `scripts/make-market-assets.py` (cuts the sheets, removes haze, fits the goods at 160 px, writes WebP to `public/business/stockroom/`), updates `market-art-qa`, and the screen can use the pictures. The plan's decisions (§10) come first.
