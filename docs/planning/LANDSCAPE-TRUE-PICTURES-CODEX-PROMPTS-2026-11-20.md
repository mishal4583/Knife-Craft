# TRUE landscape pictures: the Kitchen, the Restaurant map and the Second Floor (Codex prompts, developer 2026-11-20)

**Why this replaces Part 2 of the 2026-11-19 prompts.** Part 2 told Codex to keep the portrait picture in the exact centre and only paint extra room at the sides. The result is a wide
picture with the OLD PORTRAIT picture still standing in the middle and soft seams beside it (the developer saw it on a PC window). That is not a landscape screen. Until these new
pictures exist the game shows the Kitchen home, the restaurant map and the Second Floor as their original 9:16 box on a PC window (`<PortraitOnly wideOnly />`).

**The new rule: compose each picture WIDE from scratch.** Nothing from the portrait picture is placed inside it. The portrait pictures are only a reference for WHAT the place contains and
how it looks (rooms, furniture, colours, light, how rich it is at each stage). Re-arrange everything to suit a 16:9 canvas. There is no "centre column", no seam, no copy.

## READ THIS FIRST: what Codex must NOT do

**Make IMAGES ONLY. Do NOT write, edit or "improve" any game code, test, config or document in the repo.** Do not touch `src/`, `scripts/`, `tools/`, `public/` or `docs/`.
Do not rename, move or overwrite any existing file: the earlier pictures `LS-*.png` and the `reference\` folder stay exactly as they are.
Save every NEW picture ONLY into `D:\WORKS\GAMES\Knife Craft\Landscape Backdrops Assets\true-landscape\` (create the folder) with the exact file name below, then stop and report the file
names and pixel sizes. The developer then tells Claude, who converts them (webp, 1440 x 810) and wires them in.

## Reference images (in `D:\WORKS\GAMES\Knife Craft\Landscape Backdrops Assets\reference\`)

| Set | Files (portrait pictures: for CONTENT and LOOK only, never copied in) | Source in the repo |
|---|---|---|
| Kitchen home, 6 stages | `backdrop-kitchen-01-humble.png`, `-02-growing`, `-03-established`, `-04-neighborhood-cafe`, `-05-flourishing-cafe`, `-06-grand` (810 x 1440) | `src\assets\kitchen\skin-01.webp` to `skin-06.webp` |
| Restaurant map, 6 stages | `map-restaurant-01-humble.png`, `-02-growing`, `-03-established`, `-04-neighborhood-cafe`, `-05-flourishing-cafe`, `-06-grand` (864 x 1296) | `public\restaurant-map\kitchen-upgrade-map-<stage>.webp` |
| Second Floor | `map-second-floor.png` (864 x 1535) | `public\restaurant-map\second-floor.webp` |
| The look to match | `look-kitchen-landscape.png`, `look-restaurant-dining-landscape.png` (landscape, 1440 x 810) | `public\landscape-art\sections\` |

**Send each set in ONE conversation** (six Kitchens together, six Restaurants together, the Second Floor alone) so the progression from humble to grand stays consistent.

## STYLE BIBLE (paste at the top of EVERY request)

```
STYLE BIBLE: KnifeCraft landscape pictures. The exact look of the attached KnifeCraft pictures: warm hand-painted illustration with soft painterly shading, golden warm light,
polished brass and dark timber, green ivy and potted plants, rich colours that are not neon, soft light from windows and lamps.
This is a BACKGROUND picture: no people, no animals, no game pieces, no buttons, no cards, no UI.
NO TEXT AT ALL anywhere: no letters, numbers, words, logos, brand names or watermarks. Every sign, banner and board is painted BLANK (the game prints the words on them).
OUTPUT: a single opaque PNG, EXACTLY 1920 x 1080 pixels (16:9), no transparency, no border, no frame, no vignette.
COMPOSITION: designed for a 16:9 canvas from the start. DO NOT place any portrait picture, copy or crop of an attached picture inside it. No vertical seam, no centre column, no repeated
or mirrored block. Edge to edge: the picture fills all 1920 x 1080 with no letterbox and no empty margin.
```

---

## PART A: the six Kitchen home pictures (`true-landscape\TL-kitchen-01-humble.png` ... `TL-kitchen-06-grand.png`)

**What it is:** the full-screen background of the player's own kitchen, a warm cosy room, as the portrait pictures show it, but seen as a WIDE room: the same kitchen, the same stage of
richness, the same kinds of things (window with morning light, shelves with jars and pans, a hanging rail of knives and copper pans, the stove and the wooden counter, the herbs and plants,
the cutting boards, the pots). Re-arrange them along a wide wall and counter instead of a tall one. Keep each stage's identity: 01 humble (bare, simple, a few old pots), 02 growing, 03 established,
04 neighbourhood cafe, 05 flourishing cafe, 06 grand (rich copper, brass, big range, many plants and shelves). The six must look like ONE kitchen getting better, with the window and the
stove in the SAME place in all six.

**Camera:** a straight-on, slightly raised view along the back wall and counter, like the attached `look-kitchen-landscape.png`. The main subject (the stove / counter with pans, and the window)
sits in the MIDDLE third of the picture at mid height.

**The game draws buttons over the picture; keep these places CALM (soft, low-contrast, no focal detail, nothing important):**
- the left 5 % of the width (a thin navigation rail sits there);
- the top-left block, x 5 % to 30 %, y 0 % to 25 % (the ranking and gift cards);
- the top-right block, x 70 % to 100 %, y 0 % to 15 %, and a narrow column down the right edge, x 92 % to 100 %, y 15 % to 55 % (the wallet and the round shortcut buttons);
- the bottom-centre band, x 25 % to 75 %, y 72 % to 100 % (the next-order card): a plain wooden counter top or floor with soft light, no busy objects;
- the very bottom 6 % and the outer 3 % of the left and right edges (they are cropped on some screens).
The focal detail lives in the area that is left: roughly x 20 % to 90 %, y 15 % to 70 %.

Prompt per picture (replace the stage name and number):
```
[paste the STYLE BIBLE and the CALM-PLACES list above]
Paint the KnifeCraft player's kitchen, stage <NN> <stage name>, as a wide 16:9 room, in the same style and the same stage of richness as the attached portrait picture
<backdrop-kitchen-NN-...png> and the look of <look-kitchen-landscape.png>. Use the same kinds of things as the portrait picture but arrange them along a WIDE back wall and counter:
a tall window with warm morning light on one side, wooden shelves with jars and bowls, a rail with knives and copper pans, the stove and the wooden counter in the middle third, herbs and plants,
cutting boards, pots. The window is on the left-centre and the stove in the centre in all six stages. Do not copy or insert the portrait picture: compose a new wide picture.
```

---

## PART B: the six Restaurant map pictures (`true-landscape\TL-restaurant-01-humble.png` ... `TL-restaurant-06-grand.png`)

**What it is:** the restaurant seen from above (the same top-down, slightly angled floor-plan look as the portrait maps), but laid out WIDE. The game puts its own tap areas, lock chips, little
people and room names on top, **so every room must sit in the same place in all six pictures** (only the furniture, the quality and the richness change by stage, like the portrait maps).
There are 12 rooms plus the entrance. **Paint every name sign / banner BLANK** (a clean wooden or cream signboard at the top of each room); the game prints the names.

**Layout (the x and y are percentages of the 1920 x 1080 canvas; keep every room inside its box, with a thin wall between rooms):**

| Room | x range | y range | What is in it (as in the portrait map) |
|---|---|---|---|
| Inventory (store room) | 3 to 21 | 4 to 30 | shelves of sacks, crates, jars |
| Refrigerator (walk-in fridge) | 21 to 38 | 4 to 30 | steel fridge, pale blue floor |
| Staff Area | 38 to 54 | 4 to 30 | lockers, a small table, a water cooler |
| Knife and Equipment | 54 to 70 | 4 to 30 | knife racks, boxes of equipment |
| Blacksmith corner | 70 to 83 | 4 to 30 | anvil, forge glow, tool wall |
| Cleaning Supplies | 83 to 97 | 4 to 30 | mops, buckets, a wet-floor sign (blank) |
| Kitchen Area | 3 to 46 | 31 to 62 | the cooking kitchen: range, hoods, steel prep tables, the window wall on the left |
| Take Away / Parcel | 46 to 72 | 31 to 56 | a small pickup counter, paper bags, a till |
| Restroom | 72 to 97 | 31 to 56 | tiled floor, two cubicles, washbasin |
| Service counter | 46 to 97 | 56 to 62 | the pass and the serving counter between kitchen and dining (a long counter) |
| Manager / Office | 3 to 20 | 63 to 92 | a desk, a chair, shelves, a rug |
| Dining Area | 20 to 97 | 63 to 92 | the big dining room: tables, chairs, booths, rugs, lamps (many more tables at the later stages) |
| Entrance and garden | 40 to 60 | 92 to 100 | double doors in the front wall at the bottom centre, a paved path, planters, lanterns |

Outside the building (the very edges, x 0 to 3 %, 97 to 100 %, and the bottom strip) is garden and cobbles: flower beds, hedges, small trees, lanterns. Walls are dark timber and brick with warm
lamps, as in the portrait maps.

**CALM places (the game draws its toolbar and buttons there): the top-left corner (x 3 % to 25 %, y 0 % to 4 %: keep the wall line thin and plain), the top-right corner (x 88 % to 100 %, y 0 % to 5 %),
the bottom-right corner (x 80 % to 100 %, y 86 % to 100 %: a quiet garden or carpet), the left 5 % of the width.** Do not put an important object there.

**Stage progression (same rooms, same places):** 01 humble (bare, few tables, plain floor), 02 growing, 03 established, 04 neighbourhood cafe, 05 flourishing cafe, 06 grand (many tables, rich rugs, brass,
chandeliers, plants). Use the attached portrait map of each stage as the guide for how rich that stage is; do NOT copy its layout (it is tall).

Prompt per picture:
```
[paste the STYLE BIBLE and the CALM places above]
Paint the KnifeCraft restaurant floor plan, stage <NN> <stage name>, as a WIDE 16:9 top-down, slightly angled map in the same style and richness as the attached portrait map
<map-restaurant-NN-...png> and the look of <look-restaurant-dining-landscape.png>. Use exactly the room layout table (every room in its box, same place in every stage), with a thin wall between
rooms and a doorway in each. Every sign is painted blank. No people. Do not copy or insert the portrait map: lay the same rooms out wide.
```

---

## PART C: the Second Floor (`true-landscape\TL-second-floor.png`)

**What it is:** the upstairs food hall from above, in the same style as the portrait `map-second-floor.png`, laid out WIDE. The game draws tap areas, lock chips and the guests on top; the signs are
painted BLANK. Rooms (percent of 1920 x 1080):

| Station | x range | y range | What is in it |
|---|---|---|---|
| Auto Pizza Station | 3 to 26 | 4 to 36 | a pizza robot arm, ovens, topping trays |
| Smart Coffee and Espresso | 26 to 50 | 4 to 36 | espresso machines, cup towers |
| Drinks Dispenser | 50 to 74 | 4 to 36 | a lit drinks dispenser, ice, cups |
| Ice Cream Station | 74 to 97 | 4 to 36 | three soft-serve machines, cones, toppings |
| Burger Station | 3 to 33 | 37 to 62 | a burger robot, grills, buns |
| Hot Food and Fried Items | 33 to 62 | 37 to 62 | fryers, warming trays |
| Pickup Counter | 62 to 84 | 37 to 62 | a counter with paper bags and a till |
| Staircase down | 84 to 97 | 37 to 62 | a wooden staircase going down |
| Seating Area | 3 to 97 | 64 to 94 | green booths, round and square tables, rugs, plants |

**CALM places:** the top-left corner (x 3 % to 25 %, y 0 % to 3 %), the top-right corner, the bottom-right corner (x 80 % to 100 %, y 88 % to 100 %), the left 5 % of the width.

Prompt:
```
[paste the STYLE BIBLE and the CALM places above]
Paint the KnifeCraft Second Floor food hall as a WIDE 16:9 top-down map in the same style as the attached portrait map <map-second-floor.png>, with the stations in the table's boxes and the
seating area along the bottom. Every sign painted blank. No people. Do not copy or insert the portrait picture.
```

---

## After Codex: what Claude does

1. `scripts/make-landscape-assets.py` converts the 13 pictures (webp 1440 x 810, no dark well, no blur: they are true pictures) into `public/landscape-art/`.
2. Kitchen: remove `<PortraitOnly wideOnly />` from `Kitchen.tsx`, point `KitchenBackground` and the cutting scene at the new files.
3. Maps: remove the tag from the router, write new room boxes for the landscape map (`restaurantMapZones.ts` is percentages of a tall picture), the lock chips, the people paths and the name
   signs (the game prints the names on the blank signboards), and test the taps.
4. Tests: `landscape-art-qa`, `widelayout.mjs` W2 (back to "fills the whole window"), `portraitonly.mjs` P1, `landscape.mjs` check 1.
