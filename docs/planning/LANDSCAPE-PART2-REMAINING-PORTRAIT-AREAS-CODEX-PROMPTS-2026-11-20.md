# Every remaining portrait area, and the Codex prompts to convert it (developer 2026-11-20)

The developer's rule: **everything in the game is landscape on a PC.** The Kitchen home, the restaurant map, the Second Floor, the cutting scene's room, the cleaning rooms and all list screens are
already true landscape. This file lists everything that still is not, why, and the new pictures needed. Part 1 of the true pictures: `LANDSCAPE-TRUE-PICTURES-CODEX-PROMPTS-2026-11-20.md`.

## 1. The list (audited in a 1917 x 912 window)

| # | Area | What is portrait today | What converts it |
|---|---|---|---|
| A | **9 mini-game screens** (10 pictures): Dessert Run, Unload the Van, Car Park, Sauce Station (mixing and bottling), Fridge Check, Fridge Sort, Check the delivery, Stock the shelves, the dishwashing sink | the whole game is a 9:16 stage; the picture is the portrait stage, in a dark well in the middle of a wide room | 10 new wide pictures (this file, part A) **and** a landscape layout of each game (code, mine) |
| B | **The dining room when a customer is served** (the Service Floor, the "Prepare" screen, the served card, the cash on the table) | the portrait crop of the restaurant plan in the middle with BLURRED sides (see `reference\current-service-floor-wide-window.png`) | 6 new wide dining-room pictures, one per kitchen stage (part B) and the code to place guests and tables on them |
| C | **The intro story** (7 scenes) | the first Codex scenes keep the portrait scene in their middle | 7 new wide scenes (part C) |
| D | **The loading screen** | portrait room with the chef, the board and the logo drawn over its middle | 1 new wide room (part D) and a wide arrangement of its layers (code) |
| E | **The cooking films** (6 chef films and the oven-bread film) | portrait videos (540 x 960; the oven one 4:5) played in the middle of the Kitchen painting, which does not match the film | **Decision (developer 2026-11-20): keep the films as they are and give EACH ONE its own matching wide background** (7 pictures, part E). The film fades into that picture at its two edges, so it looks like one wide scene |
| F | **The cutting scene's board** | the room behind it is true landscape now, but the cutting canvas itself is a portrait stage in the middle (`reference\current-cutting-scene-wide-window.png`) | no picture: the board and the order card get a wide layout (code, mine) |
| G | Prep Rush (the timed cutting mode) | a Phaser canvas laid out for portrait | no picture: a wide layout (code, mine) |

Not in the list (already fine in a wide window): Kitchen, restaurant map, Second Floor, Market, Business (all tabs), Inventory, Progress, Settings, Achievements, the cleaning rooms (they have their own
wide paintings), the finale / Last Page cards (vector art in a card), menus and pop-ups. Characters (Paige, the staff, the guests) are cut-outs, not backgrounds.

**Why they were left until now (honest):** these screens are games whose pieces are placed for a 9:16 stage, so the first set of wide pictures only painted extra room beside the portrait stage. That was
my prompt. A true landscape version needs the NEW picture and a NEW layout of the game on it. The pictures are below; the layouts are my work after the pictures arrive (a tall board game such as the
Car Park or the van grid becomes a wider board, with its buttons and counters on the sides).

## READ THIS FIRST: what Codex must NOT do

**Make IMAGES ONLY (parts A to D).** Do NOT write, edit or "improve" any code, test, config or document in the repo. Do not touch `src/`, `scripts/`, `tools/`, `public/` or `docs/`.
Do not rename, move or overwrite any existing file (`LS-*.png`, `TL-*.png` and the `reference\` folder stay as they are).
Save every NEW picture ONLY into `D:\WORKS\GAMES\Knife Craft\Landscape Backdrops Assets\true-landscape\part2\` (create it) with the exact file name below, then stop and report the file names and pixel sizes.

## Reference images (all in `D:\WORKS\GAMES\Knife Craft\Landscape Backdrops Assets\reference\`)

Portrait pictures are for CONTENT and LOOK only: never copy or insert one into a new picture.

| Part | Reference files |
|---|---|
| A mini-games | `backdrop-dessert-run.png`, `backdrop-unload-the-van.png`, `backdrop-car-park.png`, `backdrop-sauce-station-mix.png`, `backdrop-sauce-station-bottle.png`, `backdrop-fridge-check.png`, `backdrop-dishwashing.png`, `backdrop-delivery-inspection.png`, `backdrop-stockroom.png`, `backdrop-fridge-sort.png` (the portrait rooms) and `layout-dessert-run-540x960.png`, `layout-unload-the-van-540x960.png`, `layout-car-park-540x960.png`, `layout-sauce-station-540x960.png`, `layout-fridge-check-540x960.png`, `layout-dishwashing-540x960.png` (the game on top of the room: do NOT paint any of it) |
| B dining room | `map-restaurant-01-humble.png` to `map-restaurant-06-grand.png` (the tall plans: the dining room, counter and door are the lower part), `TL-restaurant-01..06` in `true-landscape\` (the wide plans: match their tables, rugs and richness), `current-service-floor-wide-window.png` (what the screen looks like now) |
| C story | `backdrop-story-1-key.png`, `backdrop-story-2-kitchen.png`, `backdrop-story-3a-clean.png`, `backdrop-story-3b-repair.png`, `backdrop-story-3c-restore.png`, `backdrop-story-4-chef.png`, `backdrop-story-5-first-order.png` |
| D loading | `backdrop-loading-screen.png`, and the layers the game puts over it: `loading-layer-chef.png`, `loading-layer-board.png`, `loading-layer-logo.png`, `loading-layer-bar-frame.png` (do NOT paint them) |
| E films | `clip-chef-cooking-poster.png`, `clip-chef-salad-poster.png`, `clip-chef-fruit-poster.png`, `clip-chef-plating-poster.png`, `clip-chef-curry-poster.png`, `clip-chef-bread-poster.png`, `clip-oven-bread-poster.png` (the films are `src\assets\video\*.mp4`) |
| the look | `look-kitchen-landscape.png`, `look-restaurant-dining-landscape.png`, and the new `TL-kitchen-01..06` |

Send each part in ONE conversation (A: the ten rooms together, so the family of rooms matches; B: the six stages together; C: the seven scenes together; D alone).

## STYLE BIBLE (paste at the top of EVERY request)

```
STYLE BIBLE: KnifeCraft landscape pictures. The exact look of the attached KnifeCraft pictures: warm hand-painted illustration with soft painterly shading, golden warm light,
polished brass and dark timber, green ivy and potted plants, rich colours that are not neon, soft light from windows and lamps.
NO TEXT AT ALL anywhere: no letters, numbers, words, signs with writing, logos, brand names or watermarks (blank chalkboards, blank paper and blank signboards are fine).
OUTPUT: a single opaque PNG, EXACTLY 1920 x 1080 pixels (16:9), no transparency, no border, no frame, no vignette.
COMPOSITION: designed for a 16:9 canvas from the start. DO NOT place any portrait picture, copy or crop of an attached picture inside it. No vertical seam, no centre column, no repeated or mirrored
block. Edge to edge: the picture fills all 1920 x 1080.
```

---

## PART A: the mini-game rooms (10 pictures, `part2\TL-game-<name>.png`)

**What each is:** the ROOM a mini-game is played in, as a wide background. The game draws its own pieces, board, buttons and counters on top (see the `layout-*` references), so the middle of every picture
must be a CALM, low-detail area (about x 25 % to 75 %, y 12 % to 88 %: floor, table top, counter top or a plain wall, no objects, no strong light), and the detail (shelves, lamps, plants, windows,
equipment) lives to the LEFT and RIGHT of it and along the top. Keep the very bottom 8 % calm too. **No people, no animals, no game pieces, no buttons, no cards.**
Re-arrange the room along a wide wall instead of a tall one; keep the same kind of things, the same colours and the same mood as the portrait picture.

Paste under the style bible, then add the line for the picture:

```
Paint a wide 16:9 background room for a KnifeCraft mini-game, in the style and colours of the attached portrait room <file>. Keep the middle (x 25-75 %, y 12-88 %) calm and low-detail for the game
board; put the detail left, right and along the top. No people, no game pieces. Do not copy or insert the portrait picture.
```

| File | Room (what to paint) |
|---|---|
| `TL-game-dessert-run.png` | the dessert table room: a warm polished timber table top / floor filling the middle (soft lamp light pools), dark wood and brass edges, lanterns and flower pots along the top, a few chairs and plants at the far left and right edges |
| `TL-game-unload-the-van.png` | the back of the kitchen where the van delivers: a wide wooden shelf wall along the top (copper pans, jars, two hanging lamps, ivy), a plain dark-brown wall panel in the middle for the board, a wooden counter along the bottom with a crate of tomatoes and a checked cloth at the far left, plants at the right |
| `TL-game-car-park.png` | the restaurant car park seen from above: dark asphalt filling the whole picture with painted parking lines and dashed lane markings only at the far left and right, kerbs, planters, hedges and a small footpath along the top and bottom edges, a lamp post or two; the middle is plain asphalt. NO cars |
| `TL-game-sauce-station-mix.png` | the sauce station kitchen: a wide wall with a copper-pot shelf, glass jars, a big window with ivy on the right, a green panelled wall, and a wide wooden counter across the bottom (counter top calm in the middle) |
| `TL-game-sauce-station-bottle.png` | the bottling side of the same kitchen: stainless steel counter top across the lower middle, a shelf of coloured sauce bottles, a blank blackboard, a pegboard with ladles, a sunny window at the left |
| `TL-game-fridge-check.png` | inside a walk-in cold room: blue-grey steel wall panels, a steel floor with a black rubber mat at the bottom, cooling fans and a caged lamp on the ceiling edge, steel shelving with a few boxes at the far left and right, cool light, a little frost; the middle plain steel wall |
| `TL-game-fridge-sort.png` | a warm plaster kitchen wall with a wall lamp, a shelf of jars and a copper pot at the top right, ivy, exposed brick patches at the edges, a wooden counter along the bottom; the middle plain warm plaster |
| `TL-game-delivery-inspection.png` | the back door of the restaurant: a dark green panelled wall with a wooden door with a lit window on the left, a shelf with sacks and jars, a blank blackboard, a hand truck and wooden crates at the left, a sunny window at the right, a wooden table top across the bottom (calm in the middle) |
| `TL-game-stockroom.png` | the stockroom: a dark green wall with a brass wall lamp and ivy at the top, a green cabinet counter along the bottom with plates, a cloth and a jar of utensils at the far left, window light at the right; the middle plain green wall |
| `TL-game-dishwashing.png` | the wash-up area: a cream tiled wall with a green tile band, ONE large stainless steel sink in the middle (empty and clean: the game draws the dishes, water and tools in it), a mixer tap and a spring spray tap above it, wooden counters on both sides with a folded cloth, a dish rack space on the right |

---

## PART B: the dining room during service (6 pictures, `part2\TL-dining-01-humble.png` ... `TL-dining-06-grand.png`)

**What it is:** the live scene while a customer is served: the restaurant's DINING ROOM seen from above (the same top-down, slightly angled look as the plans), but as a wide 16:9 close-up of the dining
room only: the service counter along the top, the dining floor with its tables, chairs, rugs and booths in the middle and lower part, and the front doors at the bottom centre. The game draws the guests,
the plates and the cash piles over it, and a card sits over the bottom 24 % of the screen. Use the SAME tables, rugs and richness as that stage's `TL-restaurant-0N` plan and the stage's tall plan
(`map-restaurant-0N`): 01 humble (few plain tables, bare timber floor), 02 growing, 03 established, 04 neighbourhood cafe, 05 flourishing cafe, 06 grand (many tables, rugs, chandeliers, plants).
**No people.** Keep the bottom 24 % of the picture free of important detail (a plain floor strip is fine). Every sign painted blank.

```
[paste the STYLE BIBLE]
Paint the KnifeCraft restaurant dining room, stage <NN> <name>, as a wide 16:9 top-down, slightly angled close-up: the service counter along the top, the dining floor with this stage's tables,
chairs, rugs and booths, the front doors at the bottom centre. Match the style, furniture and richness of <TL-restaurant-NN> and <map-restaurant-NN>. No people. Keep the bottom 24 % calm.
Do not copy or insert either attached picture: compose a new wide close-up.
```

---

## PART C: the intro story (7 scenes, `part2\TL-story-1-key.png` ... )

**What it is:** the opening cinematic of seven scenes in the same old, dusty, sunlit family kitchen. The portrait scenes are tall close-ups; paint each as a WIDE cinematic shot of the SAME moment with the
SAME people (same faces, clothes, hair, apron, key, objects) and the same light (golden dust rays from the tall windows at the left), now showing more of the room to both sides. The main character
(the young cook with dark curly hair, a cream shirt and a brown apron) is seen from behind or three-quarters, as in the portrait scene. Put the people in the left two thirds or centre, the
dusty kitchen, shelves, copper pans, brick oven and hanging lamps around them; leave the bottom 22 % calm (subtitles are drawn there). No text.

| File | Reference | The moment |
|---|---|---|
| `TL-story-1-key.png` | `backdrop-story-1-key.png` | the grandfather (grey hair and beard, apron) hands the restaurant key to the young cook while the grandmother (white hair, red cardigan) smiles beside him, at a rustic table |
| `TL-story-2-kitchen.png` | `backdrop-story-2-kitchen.png` | the young cook stands inside the abandoned, dusty kitchen holding the key and looks at the mess, cobwebs and dust rays |
| `TL-story-3a-clean.png` | `backdrop-story-3a-clean.png` | the cook wipes the dusty table with a cloth, a crate of old things beside, still a mess |
| `TL-story-3b-repair.png` | `backdrop-story-3b-repair.png` | the cook pushes open a tall old window, light floods in, the room is slightly tidier |
| `TL-story-3c-restore.png` | `backdrop-story-3c-restore.png` | the table is clean: the cook sets a wooden chopping board with fresh vegetables (tomatoes, carrots, herbs) and a bowl |
| `TL-story-4-chef.png` | `backdrop-story-4-chef.png` | the old chef in a white toque and apron greets the cook, hand on hip, a warm smile, the clean table between them |
| `TL-story-5-first-order.png` | `backdrop-story-5-first-order.png` | the old chef places a red tomato on the board; the cook watches, ready for the first order |

```
[paste the STYLE BIBLE, but: this part HAS people, exactly the ones in the reference scene]
Paint scene <N> of the KnifeCraft intro as a wide 16:9 cinematic shot of the SAME moment as <reference> with the SAME characters, clothes and objects, in the same sunlit dusty family kitchen, now
showing more of the room to both sides. People in the left two thirds or the centre. Keep the bottom 22 % calm. Do not copy or insert the portrait picture: re-frame it wide.
```

---

## PART D: the loading screen (1 picture, `part2\TL-loading.png`)

The portrait loading room: a bright cook's kitchen with a huge arched window full of leaves and blue sky, hanging copper pans, ivy and purple flowers, a brick oven, and a polished wooden floor with
window light patterns. The game puts over it the chef, a wooden board, the logo and a progress bar (the `loading-layer-*` files). Paint the SAME room as a wide 16:9 view: the arched window and brick
oven on the left and right, copper shelves, ivy, a wide sunlit timber floor in the lower part. Keep the CENTRE (x 25 % to 75 %, y 8 % to 92 %) calm and low-detail (floor and a soft wall) because the
chef, the board and the logo sit there. No people.

```
[paste the STYLE BIBLE]
Paint the KnifeCraft loading-screen kitchen as a wide 16:9 room in the style of <backdrop-loading-screen.png>: arched window and brick oven at the sides, copper shelves and ivy, sunlit wood floor below.
Keep the centre calm for the chef, the board and the logo. No people. Do not copy or insert the portrait picture.
```

---

## PART E: one matching wide background for each cooking film (7 pictures, `part2\TL-clip-<name>.png`)

**The decision:** the films stay as they are (portrait, 540 x 960; the oven one 4:5). Each film gets ONE wide background that is the SAME scene, so on a PC the film sits in the middle of its own room.
The game draws the film in the exact centre of the screen at full height (a 9:16 column, x 656 to 1264 of 1920) and fades its left and right edges softly into the background (I add that fade in code),
so the background does not have to match the film pixel for pixel; it has to be the same room, the same light, the same colours, the same time of day, and a natural continuation of what the film shows at its edges.

**The films are close-up, moving shots** (shallow depth of field, the camera drifts and zooms). So paint the background as the same scene with the SAME shallow-depth-of-field look: the parts beside the
film are softer and slightly out of focus (counter, wooden boards, jars, copper pans, window light, ivy), warm and golden, never sharper than the film.

**For each film you get FOUR reference pictures** (in `reference\`, taken from the film itself): `clip-<name>-poster.png` (the first frame as the game shows it), and `clip-<name>-frame-start.png`,
`clip-<name>-frame-mid.png`, `clip-<name>-frame-end.png` (three frames of the film, so you can see how the shot moves). **Put the `frame-mid` picture in the exact centre of the canvas, scaled
uniformly to 1080 pixels tall (about 608 wide, x = 656 to 1264) and keep it as it is; then paint the room to its left and right** so the counter, the light, the colours and the blur run on from the
film's edges (the seams will be hidden by my fade, but they should be close). **No people, no hands, no chef, no moving food in the sides** (the film has them in the middle only). No text.

Paste under the style bible (the style bible's "no portrait picture inside it" line does NOT apply to part E: here the film frame IS the centre), then the line for the film:

```
[paste the STYLE BIBLE, but the centre of this picture is the attached film frame]
Paint the wide 16:9 background for the KnifeCraft cooking film <name>. Put <clip-NAME-frame-mid.png> unchanged in the exact centre (scaled to 1080 px tall, about 608 wide, x 656-1264), then paint the
SAME room to its left and right: <what the room is>. Same warm golden light and colours, the same shallow depth of field (softer than the centre), no people, no hands, nothing moving. The seams must
run on naturally (counter edge, light, colours). Keep the outer 4 % calm.
```

| File | Film (frames) | The room beside it |
|---|---|---|
| `TL-clip-chef-cooking.png` | `chef-cooking` (the chef at the stove, the camera pushes in to a flaming wok on a gas hob) | a rustic timber kitchen: a gas hob and a dark iron range with pans on both sides, a counter with tomatoes, garlic, a pepper mill and a bottle of olive oil in front, shelves of jars and a chalkboard, copper pans, a big window with ivy and a hanging lamp, hot orange light from the flames |
| `TL-clip-chef-salad.png` | `chef-salad` (the chef with a grey beard and white toque pours olive oil and tosses a salad in a wooden bowl) | the same rustic kitchen: a wooden counter running both ways, jars and herbs on shelves behind, a window with ivy on the right, a chalkboard on the left, a cutting board with garlic and tomatoes and a checked cloth in front |
| `TL-clip-chef-fruit.png` | `chef-fruit` (hands cutting and arranging a fruit cup of strawberry, kiwi, pineapple and grapes in glasses) | a light kitchen counter in soft daylight: a white farmhouse sink and tap behind, leafy lettuce and red peppers, plates of cut fruit and a glass or two at the edges, a window at the back |
| `TL-clip-chef-plating.png` | `chef-plating` (hands plating a tomato salad in a wooden bowl; the chef steps in at the end) | the pass of the kitchen: a long wooden counter with olive oil bottles, potatoes and cucumber slices, plates, a window with ivy, shelves with jars, a hanging cloth |
| `TL-clip-chef-curry.png` | `chef-curry` (a steaming pot of curry stirred with a wooden spoon; the chef appears through the steam) | a warm, steamy kitchen: a big dark pot on the stove, wooden spoons and a bowl of bread at the sides, soft steam haze, a dark apron and tiles, amber light; keep the steam soft |
| `TL-clip-chef-bread.png` | `chef-bread` (toasted bread topped with a tomato bruschetta from a bowl, ending on a board of toasts) | a wooden counter with a big board of golden toasts and bowls of tomato and herbs at the sides, a dark apron blurred behind, warm light |
| `TL-clip-oven-bread.png` | `oven-bread` (4:5, a stone wood-fired oven with flames, a loaf on a wooden peel; the shot pushes into the flames and the loaf) | the bakery corner: a stone brick wood-fired oven with an iron arch and flames, ivy above, a floury wooden table with a garlic basket and a folded cloth, the long wooden peel, warm firelight. The film is 4:5: put its frame in the centre at 1080 tall (about 864 wide, x 528-1392) and paint the oven room round it |

Why this is better than a darkened Kitchen backdrop: the Kitchen painting does not match the film's room, so the film looked like a window cut into a different picture.

---

## After Codex: what Claude does (code, no pictures)

1. Convert the pictures (webp 1440 x 810 for the rooms and the story, 1920 x 1080 for the dining rooms) with `scripts/make-landscape-assets.py` (no dark well, no seam fix: they are true pictures).
2. A, F, G: a wide layout for each game and for the cutting scene's board and order card (the playfield gets a wide shape where it is a tall board today; the HUD and the buttons move to the sides), remove
   `<PortraitOnly />` from each, and add the browser checks.
3. B: wide positions for the guests, the tables and the cash piles on each dining picture (the same method as the wide restaurant map: `guestWalk`, `serviceFloor`, `tableCash`).
4. C, D: wire the scenes and the loading room; re-arrange the loading layers.
5. E: the 7 backgrounds go behind each film; the film is the same video, with its two edges faded softly into the picture (CSS mask), so no new video is needed.
