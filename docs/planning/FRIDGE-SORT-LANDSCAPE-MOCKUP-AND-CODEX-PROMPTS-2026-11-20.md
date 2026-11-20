# Fridge Sort, landscape: the developer's mock-up and the Codex prompts (2026-11-20)

**Developer's request:** "Optimize and make the Fridge Sort game exactly like this image; if background assets are needed give Codex prompts and a reference image."

**The mock-up:** `docs/planning/reference/fridge-sort-mockup-2026-11-20.png` (attach it to every prompt below).

## What is done in code (no new pictures needed for it)

A wide window now lays the game out as the mock-up does (`FridgeSortGame.tsx`, the `land:` classes; the upright phone layout is untouched):

- **Left column (46 %):** the back button, the timer plaque and the star score on the first row, the star bar, the note pill ("Pick a piece from the basket") with the ? button, then a BIG basket
  (78 % of the window's height wide; the pieces grow with it, never under 48 px) and the Delivery pill under it.
- **Right column (54 %):** the "Prep Cook does it, no stars" pill at the top right (cream, when a Prep Cook is hired) and the cabinet: a cream panel with a gold rim, from 11.5 % to 95 % of
  the window's height. The wide shelves (Dairy and Tofu, Meat Fish and Bread) are bands, the bins and drawers sit two to a row; the rows are fixed shares of the window's height
  (a few shelves stretch up to 1.3 x, many scroll under the "More shelves below" button), so no shelf balloons.
- Checked at 1917 x 912, 1280 x 720 and a phone on its side (844 x 390); `fridgesort.mjs` S29 (new) and every old check pass.

## DELIVERED AND INTEGRATED (2026-11-21): both sets are in; this section is kept for the prompts

## What differed from the mock-up: the pictures

The mock-up's room and crates are NEW paintings. Until they arrive the game uses the current ones (the peach wall room and the mixed crate / glass drawer set), so it has the mock-up's
arrangement but not its look. Two sets are needed.

### Set A: the room (one picture, 1920 x 1080)

Replaces `Landscape Backdrops Assets/true-landscape/part2/TL-game-fridge-sort.png` (the file `make-landscape-assets.py` reads; same name, same size). Reference images to attach: the mock-up, and
the current room `public/landscape-art/true/game-fridge-sort.webp`.

```
Create ONE landscape picture, 1920 x 1080, no people, no text, no UI: the empty kitchen corner behind a cozy "unpack the delivery" game. Painted in the same warm, glossy
storybook style as the attached mock-up (soft golden light, rich orange and honey wood, small leaves and flowers), seen straight on from the front, a little from above.

The picture is the BACKGROUND only: the game draws its panels, buttons, the wicker basket and the shelves over it, so keep those areas calm.

LEFT HALF (the busy half, x 0 to 46 %):
- a warm orange brick wall (x 0 to 46 %, y 0 to 62 %), with a hanging iron lantern with a glowing flame at the top left (centre about x 6 %, y 20 %), green ivy and pink flowers climbing in
  from the left edge and the top left corner;
- a small wooden wall shelf (x 7 to 29 %, y 41 to 44 %) with three glass jars of dried beans and lentils (yellow, red, brown), a wooden pepper mill, and a small potted green herb at its left end;
- a wooden chopping board with a handle leaning on the wall (centre about x 39 %, y 52 %), a second smaller board behind it;
- a terracotta pot with a pink-flowering plant at the bottom left corner (x 0 to 5 %, y 62 to 100 %);
- the wooden counter across the bottom: the counter top starts at y 62 % and runs the whole width; on its LEFT part (x 1 to 46 %, y 70 to 88 %) lies a green-and-white
  checkered tablecloth with its corners hanging over the counter edge, seen in perspective (it is where the game puts its wicker basket: keep the cloth plain, no objects on it).

RIGHT HALF (the calm half, x 46 to 100 %): a plain warm wooden wall with soft vertical light, vines hanging from the top edge, a wooden wall bracket and shelf at the top right
(x 66 to 96 %, y 0 to 12 %) with ivy; the counter continues at the bottom. Almost no detail between y 12 % and y 92 % (a big cream panel is drawn over it).

Keep the HUD area (x 0 to 46 %, y 0 to 28 %) low in contrast: just the wall, the lantern and ivy at its far left. Soft vignette at the corners. No text, no numbers.
```

### Set B: the crates and shelf strips (one sheet, 2560 x 1024 px = 5 x 2 cells of 512 x 512)

The mock-up shows every bin as a simple wooden crate full of produce (not the mixed burlap / red tray / glass drawers of today). Reference images to attach: the mock-up, and the current set
`public/business/fridge-sort/bin-roots.webp`, `bin-salad.webp`, `bin-stems.webp`, `bin-pods.webp`, `drawer-fruit.webp`, `drawer-greens.webp`, `rack-butter.webp`, `rack-aromatics.webp`, `shelf-glass.webp`.
Save as `Fridge Sort Crates Assets/FSC-crates.png`. A real transparent background (alpha), one picture per cell, centred, about 85 % of the cell, no text, no labels (the game puts a white name tag on the front).

```
Create ONE image, 2560 x 1024 px, on a fully transparent background: a sprite sheet of 10 separate pictures in a grid of 5 columns and 2 rows (each cell 512 x 512), one picture per cell,
centred, about 85 % of the cell, never touching the cell's edge. No text, no numbers, no grid lines.

Style: the same warm, glossy storybook painting as the attached mock-up: light pine wooden crates with a darker rim, rope-free, slightly rounded, seen from the front and a little from above, the
produce heaped above the rim and painted with soft highlights and a thin darker outline so it reads on a cream background. The front of every crate is plain wood (a blank slat where a name tag goes).

In reading order, left to right, top to bottom:
1. Roots and bulbs: a wooden crate full of potatoes, a red onion, a brown onion, a garlic bulb and a carrot.
2. Salad and fruiting veg: a wooden crate with red tomatoes, a long cucumber, a green pepper and a red pepper.
3. Cabbages and stems: a wooden crate with two green cabbages, a head of broccoli, a cauliflower, a stalk of celery.
4. Pods and fungi: a wooden crate with a white mushroom, brown mushrooms, green peas in pods and green beans.
5. Fruit: a wooden crate with strawberries, a red apple, an orange, a yellow lemon and a pear.
6. Greens and herbs: a wooden crate packed with lettuce leaves, spinach, parsley and basil.
7. Butter: a wooden crate with two yellow butter blocks, one cut, on a piece of paper.
8. Aromatics: a wooden crate with ginger roots, garlic bulbs, a lemon and a bunch of spring onions.
9. Dairy shelf strip: a long thin wooden shelf board (wide, 4:1 ratio, drawn in the left 80 % of the cell's width centre line), empty, with a soft front edge.
10. Meat and fish shelf strip: the same long thin wooden shelf board, empty.
Use the same light, the same outline weight and the same wood colour for all ten.
```

## When the pictures arrive

- Set A: drop it over the old file and run `python scripts/make-landscape-assets.py`; nothing else changes (`landscapeGameArt("fridge-sort")` is already the room).
- Set B: tell me "fridge crates are generated"; I cut the sheet into `public/business/fridge-sort/` (the nine file names above keep their names, so the game picks them up) and re-check every shelf's name tag and
  the item pictures on the shelves against the new crates.
