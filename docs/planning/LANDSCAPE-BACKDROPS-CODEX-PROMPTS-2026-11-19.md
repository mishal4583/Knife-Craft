# Landscape backdrops for the portrait-only screens: Codex prompts (developer 2026-11-19)

**Why:** in a wide window (laptop, desktop, tablet turned) the mini-games and the dishwashing sink only have a PORTRAIT painting, so the game now keeps them at their original
9:16 size with dark bars (`<PortraitOnly />`, `fitLayout(..., portraitOnly)`). Each picture below lets one screen fill a wide window with its own room instead of bars.
Nothing else needs new art: the Kitchen, Market, Business, Inventory, the cleaning rooms, the cutting scene and the restaurant map already have landscape art or need none.

**How the picture is used (read this, it decides how to paint):** the game's 9:16 stage stays exactly as it is, in the MIDDLE of the window. The landscape picture goes behind it.
So every landscape picture is the existing portrait picture in the CENTRE, unchanged, with the same room painted on to the LEFT and RIGHT. Nothing is drawn by the game on the sides.

## READ THIS FIRST: what Codex must NOT do

**Make IMAGES ONLY. Do NOT write, edit or "improve" any game code, test, config or document in the repo.** Do not touch `src/`, `scripts/`, `tools/`, `public/` or `docs/`.
Do not build a screen or a mini-game. Do not rename, move or overwrite any existing file (the `reference\` folder stays as it is).
Save every NEW picture ONLY into `D:\WORKS\GAMES\Knife Craft\Landscape Backdrops Assets\` (the folder itself, not `reference\`) with the exact file name below, then stop and report
the file names and pixel sizes. The developer then tells Claude, who converts them (webp, 1440 x 810, like the existing `public\landscape-art\`) and wires them in.

## Reference images (all in `D:\WORKS\GAMES\Knife Craft\Landscape Backdrops Assets\reference\`, PNG copies of the game's own files)

Two kinds per game. **`backdrop-*.png` is the picture to extend. `layout-*-540x960.png` is a screenshot of the current portrait game with its buttons and pieces on top, so you can see
what sits over the picture and where (do NOT paint any of that: it is drawn by the game).**

| Game | Picture to extend (portrait) | Game as it looks now (portrait layout) | Source file in the repo |
|---|---|---|---|
| Dessert Run | `reference\backdrop-dessert-run.png` (810 x 1440) | `reference\layout-dessert-run-540x960.png` | `public\business\dessertrun\backdrop.webp` |
| Unload the Van | `reference\backdrop-unload-the-van.png` (810 x 1440) | `reference\layout-unload-the-van-540x960.png` | `public\business\cratedispatch\backdrop.webp` |
| Car Park | `reference\backdrop-car-park.png` (720 x 1280) | `reference\layout-car-park-540x960.png` | `public\business\carpark\car-park-backdrop.webp` |
| Sauce Station, mixing | `reference\backdrop-sauce-station-mix.png` (702 x 1248) | `reference\layout-sauce-station-540x960.png` | `public\business\sauce\mix-backdrop.webp` |
| Sauce Station, bottling | `reference\backdrop-sauce-station-bottle.png` (702 x 1248) | (same game, bottling step) | `public\business\sauce\bottle-backdrop.webp` |
| Fridge Check | `reference\backdrop-fridge-check.png` (540 x 960) | `reference\layout-fridge-check-540x960.png` | `public\business\fridge-check\backdrop.webp` |
| Dishwashing sink | `reference\backdrop-dishwashing.png` (810 x 1440) | `reference\layout-dishwashing-540x960.png` | `public\dishwashing\backdrop.webp` |
| Check the delivery | `reference\backdrop-delivery-inspection.png` (540 x 960) | (the game draws crates and cards over it) | `public\business\inspection\backdrop.webp` |
| Stock the shelves | `reference\backdrop-stockroom.png` (540 x 960) | (the game draws shelves and goods over it) | `public\business\stockroom\backdrop.webp` |
| Fridge Sort | `reference\backdrop-fridge-sort.png` (420 x 746, low resolution) | (the game draws the fridge and crates over it) | `public\business\fridge-sort\kitchen-wall.webp` |

Also attach, once per conversation, the look of the rest of the game: `public\landscape-art\sections\kitchen.webp` and `public\landscape-art\sections\inventory.webp` (landscape, 1440 x 810: the
light, the wood, the plants we want on the sides).

## STYLE BIBLE (paste at the top of EVERY request)

```
STYLE BIBLE: KnifeCraft landscape backdrops. The exact look of the attached KnifeCraft pictures: warm hand-painted illustration with soft painterly shading, golden warm light,
polished brass and dark timber, green ivy and potted plants, rich colours that are not neon, soft light from windows and lamps.
This is a BACKGROUND ROOM: no people, no animals, no game pieces, no buttons, no boards, no cards.
NO TEXT AT ALL anywhere: no letters, numbers, words, signs with writing, logos, brand names or watermarks (blank chalkboards and blank paper are fine).
OUTPUT: a single opaque PNG, EXACTLY 1920 x 1080 pixels (16:9), no transparency, no border, no frame, no vignette.
```

## The rule for EVERY picture below (paste it under the style bible)

```
CANVAS AND CENTRE COLUMN: the canvas is 1920 x 1080. Place the attached portrait picture in the exact middle of the canvas, scaled uniformly to 1080 pixels tall, so it is
about 608 pixels wide and covers x = 656 to x = 1264. KEEP THAT COLUMN PIXEL-FOR-PIXEL THE SAME PICTURE: the same objects in the same places, the same colours, the same light.
Do not redraw it, do not move anything in it, do not add anything to it.
SIDES: paint the SAME ROOM continuing to the left (x = 0 to 656) and to the right (x = 1264 to 1920), as if the portrait picture were a window onto the middle of a wider room.
The two seams must be invisible: the wall, the floor, the table or counter edge, the skirting line, the light and the colours run straight across them with no step and no visible join.
Continue the perspective and the horizon / counter / floor lines of the centre column exactly. Do NOT mirror or copy the centre column, do NOT repeat the same object twice, do NOT use a
blur or a flat colour: paint new, natural room detail of the same kind (listed per picture). Keep the sides a little calmer and slightly darker than the centre so the game piece in the
middle stays the focus, and keep the very bottom 12 % free of busy detail. No important detail at the left and right edges (the picture is cropped a little on some screens).
```

## The pictures (priority order: the games played most first)

### 1. `LS-dessert-run.png` (Dessert Run)
```
Extend the attached Dessert Run room: a warm, lantern-lit restaurant dining room with golden wooden walls, hanging lanterns, window light, flowering plants on the walls and potted plants.
Left and right: more of the same golden timber wall with extra hanging lanterns at different heights, a tall window with a soft garden view on one side, hanging flower baskets,
a plant stand, a wooden pillar. The floor / wall lines of the centre column run straight on. Warm, festive, cosy. Same light direction as the reference.
```

### 2. `LS-unload-the-van.png` (Unload the Van)
```
Extend the attached Unload the Van room: the back-of-house kitchen wall with wooden shelves, copper pots and pans on hooks, glass jars of grains, hanging lamps, potted herbs, a wooden counter
at the bottom with a checked cloth. Left and right: more shelves (NOT the same ones copied) with different jars, bowls, bottles and cookware, a hanging utensil rail, herb pots, a tall pantry
cabinet at the far edges, the same counter continuing along the bottom with crates of tomatoes and greens near the corners. Keep the same warm timber and brass.
```

### 3. `LS-car-park.png` (Car Park)
```
Extend the attached Car Park picture (seen from straight above): a warm brown asphalt lot with a dashed painted edge line on each side of the centre column, a zebra crossing with a dashed
centre line at the top and the bottom, and small details in the four corners (a shop front with a striped awning, a lamp post, flower beds, a bin). Left and right: the lot ends at the dashed lines,
so paint what lies beyond them: a kerb, a pavement of warm paving stones, shop fronts with striped awnings and glowing windows seen from above, flower beds and planters, shrubs, a few lamp posts
with soft pools of light, benches, a bin, a bus-stop shelter. Same top-down view and the same warm colours. NO cars and no people (the game draws the cars).
```

### 4. `LS-sauce-mix.png` and 5. `LS-sauce-bottle.png` (Sauce Station, two pictures that must match each other)
```
Extend the attached Sauce Station picture: a rustic kitchen with a green wainscot wall, a window with ivy and warm light on the right, a copper pot on a stove at the lower left, a rope
hook, a wooden counter along the bottom. MIX picture: the big empty mixing bowl stays in the centre column exactly as it is. BOTTLE picture: attach the bottle backdrop and do the same.
Left and right (both pictures the SAME room, only the centre differs): more green wainscot and plaster wall, a second window on the left with ivy, shelves with spice jars, hanging
ladles and a whisk rack, a stove hood, the counter continuing with a wooden board and a bowl of lemons near the edges. Warm light from the window on the right across the whole room.
```

### 6. `LS-fridge-check.png` (Fridge Check)
```
Extend the attached Fridge Check picture: the inside of a cold room, a cool blue-grey brushed-steel wall in panels with a caged lamp glowing at the upper left, an evaporator unit with two fans and
a pipe at the top, wire shelving with a few crates at the left and right edges, frost at the corners, a steel counter with a black rubber mat at the bottom. Left and right: the steel wall panels,
the wire shelving and the steel counter go on; more shelving bays with a few plain crates and tubs (no readable labels), a second caged lamp, a cold-room door with a rubber seal and a handle at
one edge, a thermometer, a drain, frost on the pipes. Same cool light; keep warm colour only where the centre already has it (the brass of the lamp bracket and the pipe).
```

### 7. `LS-dishwashing.png` (Dishwashing sink)
```
Extend the attached Dishwashing picture: a brass-and-steel kitchen sink under a window with cream tiles, a tap, soap and a drying rack. The sink in the centre column stays as it is.
Left and right: the counter and the cream tile wall go on at the same height and perspective, with a second smaller work surface, a window with garden light on one side, a shelf of clean
plates and cups, a hanging cloth, a pot of herbs, a dish rack and a bowl at the counter edge. The counter-top line and the tile line of the centre column run straight across both seams.
```

### 8. `LS-delivery-inspection.png` (Check the delivery)
```
Extend the attached delivery-room picture: an olive-green back room with a warm wall lamp, a door with a small window, a trolley and stacked wooden crates, wooden shelves with glass jars and
sacks, a blank chalkboard and a blank clipboard, a window with ivy, a big wooden table at the bottom. Left and right: more olive-green panelled wall, a second door or a loading hatch with
daylight, more crates and sacks, a rack of empty baskets, a hanging scale, ivy on the window, the long wooden table continuing along the bottom.
```

### 9. `LS-stockroom.png` (Stock the shelves)
```
Extend the attached stockroom picture: a calm dark-green plaster wall with a brass wall lamp, ivy at the top, a wooden counter with a drawer cabinet, a stack of plates and folded cloths, a pot of
wooden spoons. Left and right: more green wall and wainscot, a second brass lamp, a window with ivy, a pegboard with plain hooks, the counter continuing with a few more tidy kitchen items
(a basket, a jar, folded towels). Keep the wall above the counter mostly calm, with light and shadow only: the game draws its shelves there.
```

### 10. `LS-fridge-sort.png` (Fridge Sort)
```
Extend the attached Fridge Sort wall (low resolution, so paint the sides at full 1920 x 1080 sharpness and keep the centre column as close as possible to the reference): a warm plaster wall with
patches of old brick, a lamp, a shelf with a copper pot, jars and ivy, a wooden counter at the bottom. Left and right: more warm plaster with patches of brick, a second shelf with copper
pans and jars, a window with soft light, a hanging herb bunch, the counter continuing. The centre column stays calm (the game draws the fridge there).
```

## Part 2: the six Kitchen home pictures and the six Restaurant map surroundings

Add to the reference table: `reference\backdrop-kitchen-01-humble.png` to `-06-grand.png` (the six Kitchen home pictures, 810 x 1440, from `src\assets\kitchen\skin-01.webp` to `skin-06.webp`), `reference\map-restaurant-01-humble.png` to `-06-grand.png` (the six restaurant maps, 864 x 1296, from `public\restaurant-map\kitchen-upgrade-map-<stage>.webp`), and the two looks to match: `reference\look-kitchen-landscape.png` and `reference\look-restaurant-dining-landscape.png`. Send the six of a set in ONE conversation so the progression from humble to grand stays consistent.

### 11. `LS-kitchen-01-humble.png` (Kitchen home, Humble Kitchen)
```
Extend the attached Kitchen picture `backdrop-kitchen-01-humble.png` (Humble Kitchen: bare, worn and simple: plain tools, little decor, plain wood, a few plants). Same rule as above: the portrait picture stays unchanged in the centre column (x 656 to 1264); paint the SAME kitchen
continuing left and right at the SAME level of richness (do not make a humble kitchen fancy or a grand one bare). Left and right: more of the same room, in the same style as the attached
landscape kitchen `look-kitchen-landscape.png` (window light and plants on one side, a dining room glimpsed through an arch on the other, more shelves, jars, baskets, a stove and counter that
continue along the bottom). The game puts a ranking card and a gift card at the top left, a wallet and four round buttons at the top right and a wide order card along the bottom: keep the top
and bottom 14 % calmer, with no important detail.
```

### 12. `LS-kitchen-02-growing.png` (Kitchen home, Growing Kitchen)
```
Extend the attached Kitchen picture `backdrop-kitchen-02-growing.png` (Growing Kitchen: a little more equipment and cheer). Same rule as above: the portrait picture stays unchanged in the centre column (x 656 to 1264); paint the SAME kitchen
continuing left and right at the SAME level of richness (do not make a humble kitchen fancy or a grand one bare). Left and right: more of the same room, in the same style as the attached
landscape kitchen `look-kitchen-landscape.png` (window light and plants on one side, a dining room glimpsed through an arch on the other, more shelves, jars, baskets, a stove and counter that
continue along the bottom). The game puts a ranking card and a gift card at the top left, a wallet and four round buttons at the top right and a wide order card along the bottom: keep the top
and bottom 14 % calmer, with no important detail.
```

### 13. `LS-kitchen-03-established.png` (Kitchen home, Established Kitchen)
```
Extend the attached Kitchen picture `backdrop-kitchen-03-established.png` (Established Kitchen: a well-equipped working kitchen with a pot rack and a knife strip). Same rule as above: the portrait picture stays unchanged in the centre column (x 656 to 1264); paint the SAME kitchen
continuing left and right at the SAME level of richness (do not make a humble kitchen fancy or a grand one bare). Left and right: more of the same room, in the same style as the attached
landscape kitchen `look-kitchen-landscape.png` (window light and plants on one side, a dining room glimpsed through an arch on the other, more shelves, jars, baskets, a stove and counter that
continue along the bottom). The game puts a ranking card and a gift card at the top left, a wallet and four round buttons at the top right and a wide order card along the bottom: keep the top
and bottom 14 % calmer, with no important detail.
```

### 14. `LS-kitchen-04-neighborhood-cafe.png` (Kitchen home, Neighborhood Cafe)
```
Extend the attached Kitchen picture `backdrop-kitchen-04-neighborhood-cafe.png` (Neighborhood Cafe: a warm cafe kitchen, more copper, more shelves, more food on display). Same rule as above: the portrait picture stays unchanged in the centre column (x 656 to 1264); paint the SAME kitchen
continuing left and right at the SAME level of richness (do not make a humble kitchen fancy or a grand one bare). Left and right: more of the same room, in the same style as the attached
landscape kitchen `look-kitchen-landscape.png` (window light and plants on one side, a dining room glimpsed through an arch on the other, more shelves, jars, baskets, a stove and counter that
continue along the bottom). The game puts a ranking card and a gift card at the top left, a wallet and four round buttons at the top right and a wide order card along the bottom: keep the top
and bottom 14 % calmer, with no important detail.
```

### 15. `LS-kitchen-05-flourishing-cafe.png` (Kitchen home, Flourishing Cafe)
```
Extend the attached Kitchen picture `backdrop-kitchen-05-flourishing-cafe.png` (Flourishing Cafe: rich and busy, abundant produce and cookware, brass and lanterns). Same rule as above: the portrait picture stays unchanged in the centre column (x 656 to 1264); paint the SAME kitchen
continuing left and right at the SAME level of richness (do not make a humble kitchen fancy or a grand one bare). Left and right: more of the same room, in the same style as the attached
landscape kitchen `look-kitchen-landscape.png` (window light and plants on one side, a dining room glimpsed through an arch on the other, more shelves, jars, baskets, a stove and counter that
continue along the bottom). The game puts a ranking card and a gift card at the top left, a wallet and four round buttons at the top right and a wide order card along the bottom: keep the top
and bottom 14 % calmer, with no important detail.
```

### 16. `LS-kitchen-06-grand.png` (Kitchen home, Grand Kitchen)
```
Extend the attached Kitchen picture `backdrop-kitchen-06-grand.png` (Grand Kitchen: the most lavish: gleaming copper, a full pot rack, abundant food, many lamps). Same rule as above: the portrait picture stays unchanged in the centre column (x 656 to 1264); paint the SAME kitchen
continuing left and right at the SAME level of richness (do not make a humble kitchen fancy or a grand one bare). Left and right: more of the same room, in the same style as the attached
landscape kitchen `look-kitchen-landscape.png` (window light and plants on one side, a dining room glimpsed through an arch on the other, more shelves, jars, baskets, a stove and counter that
continue along the bottom). The game puts a ranking card and a gift card at the top left, a wallet and four round buttons at the top right and a wide order card along the bottom: keep the top
and bottom 14 % calmer, with no important detail.
```

### 17. `LS-restaurant-01-humble.png` (Restaurant map, Humble Kitchen)
```
RESTAURANT MAP VARIANT OF THE RULE: the attached picture `map-restaurant-01-humble.png` (864 x 1296) is a top-down map of the whole restaurant. Place it in the exact middle of the canvas, scaled uniformly
to 1080 pixels tall, so it is 720 pixels wide and covers x = 600 to x = 1320. KEEP THAT COLUMN PIXEL-FOR-PIXEL THE SAME: every room, table, person, light and label position unchanged (the game
puts tap areas on it). Paint the dining room of the Humble Kitchen stage continuing left and right of it (x 0 to 600 and x 1320 to 1920), seen from above at an angle like the attached
`look-restaurant-dining-landscape.png`: tables and chairs, plants, a window wall with soft daylight, floor tiles and rugs, lamps; at the SAME level of richness as this stage's map (bare, worn and simple: plain tools, little decor, plain wood, a few plants).
No people, no text, no copy or mirror of the map. Seams invisible; the top and bottom 14 % calm (buttons and a card sit there).
```

### 18. `LS-restaurant-02-growing.png` (Restaurant map, Growing Kitchen)
```
RESTAURANT MAP VARIANT OF THE RULE: the attached picture `map-restaurant-02-growing.png` (864 x 1296) is a top-down map of the whole restaurant. Place it in the exact middle of the canvas, scaled uniformly
to 1080 pixels tall, so it is 720 pixels wide and covers x = 600 to x = 1320. KEEP THAT COLUMN PIXEL-FOR-PIXEL THE SAME: every room, table, person, light and label position unchanged (the game
puts tap areas on it). Paint the dining room of the Growing Kitchen stage continuing left and right of it (x 0 to 600 and x 1320 to 1920), seen from above at an angle like the attached
`look-restaurant-dining-landscape.png`: tables and chairs, plants, a window wall with soft daylight, floor tiles and rugs, lamps; at the SAME level of richness as this stage's map (a little more equipment and cheer).
No people, no text, no copy or mirror of the map. Seams invisible; the top and bottom 14 % calm (buttons and a card sit there).
```

### 19. `LS-restaurant-03-established.png` (Restaurant map, Established Kitchen)
```
RESTAURANT MAP VARIANT OF THE RULE: the attached picture `map-restaurant-03-established.png` (864 x 1296) is a top-down map of the whole restaurant. Place it in the exact middle of the canvas, scaled uniformly
to 1080 pixels tall, so it is 720 pixels wide and covers x = 600 to x = 1320. KEEP THAT COLUMN PIXEL-FOR-PIXEL THE SAME: every room, table, person, light and label position unchanged (the game
puts tap areas on it). Paint the dining room of the Established Kitchen stage continuing left and right of it (x 0 to 600 and x 1320 to 1920), seen from above at an angle like the attached
`look-restaurant-dining-landscape.png`: tables and chairs, plants, a window wall with soft daylight, floor tiles and rugs, lamps; at the SAME level of richness as this stage's map (a well-equipped working kitchen with a pot rack and a knife strip).
No people, no text, no copy or mirror of the map. Seams invisible; the top and bottom 14 % calm (buttons and a card sit there).
```

### 20. `LS-restaurant-04-neighborhood-cafe.png` (Restaurant map, Neighborhood Cafe)
```
RESTAURANT MAP VARIANT OF THE RULE: the attached picture `map-restaurant-04-neighborhood-cafe.png` (864 x 1296) is a top-down map of the whole restaurant. Place it in the exact middle of the canvas, scaled uniformly
to 1080 pixels tall, so it is 720 pixels wide and covers x = 600 to x = 1320. KEEP THAT COLUMN PIXEL-FOR-PIXEL THE SAME: every room, table, person, light and label position unchanged (the game
puts tap areas on it). Paint the dining room of the Neighborhood Cafe stage continuing left and right of it (x 0 to 600 and x 1320 to 1920), seen from above at an angle like the attached
`look-restaurant-dining-landscape.png`: tables and chairs, plants, a window wall with soft daylight, floor tiles and rugs, lamps; at the SAME level of richness as this stage's map (a warm cafe kitchen, more copper, more shelves, more food on display).
No people, no text, no copy or mirror of the map. Seams invisible; the top and bottom 14 % calm (buttons and a card sit there).
```

### 21. `LS-restaurant-05-flourishing-cafe.png` (Restaurant map, Flourishing Cafe)
```
RESTAURANT MAP VARIANT OF THE RULE: the attached picture `map-restaurant-05-flourishing-cafe.png` (864 x 1296) is a top-down map of the whole restaurant. Place it in the exact middle of the canvas, scaled uniformly
to 1080 pixels tall, so it is 720 pixels wide and covers x = 600 to x = 1320. KEEP THAT COLUMN PIXEL-FOR-PIXEL THE SAME: every room, table, person, light and label position unchanged (the game
puts tap areas on it). Paint the dining room of the Flourishing Cafe stage continuing left and right of it (x 0 to 600 and x 1320 to 1920), seen from above at an angle like the attached
`look-restaurant-dining-landscape.png`: tables and chairs, plants, a window wall with soft daylight, floor tiles and rugs, lamps; at the SAME level of richness as this stage's map (rich and busy, abundant produce and cookware, brass and lanterns).
No people, no text, no copy or mirror of the map. Seams invisible; the top and bottom 14 % calm (buttons and a card sit there).
```

### 22. `LS-restaurant-06-grand.png` (Restaurant map, Grand Kitchen)
```
RESTAURANT MAP VARIANT OF THE RULE: the attached picture `map-restaurant-06-grand.png` (864 x 1296) is a top-down map of the whole restaurant. Place it in the exact middle of the canvas, scaled uniformly
to 1080 pixels tall, so it is 720 pixels wide and covers x = 600 to x = 1320. KEEP THAT COLUMN PIXEL-FOR-PIXEL THE SAME: every room, table, person, light and label position unchanged (the game
puts tap areas on it). Paint the dining room of the Grand Kitchen stage continuing left and right of it (x 0 to 600 and x 1320 to 1920), seen from above at an angle like the attached
`look-restaurant-dining-landscape.png`: tables and chairs, plants, a window wall with soft daylight, floor tiles and rugs, lamps; at the SAME level of richness as this stage's map (the most lavish: gleaming copper, a full pot rack, abundant food, many lamps).
No people, no text, no copy or mirror of the map. Seams invisible; the top and bottom 14 % calm (buttons and a card sit there).
```

## Part 3: the audit of every other screen (2026-11-19): what else needs a landscape picture

**Needs NEW pictures (below): the 7 intro story scenes, the loading screen, the Second Floor (9 pictures).**

**Reuses pictures from Part 2, no extra art:**
- The **cutting scene** draws the same six Kitchen pictures as its backdrop (`Preparation` `kitchenArt`, 810 x 1440 cropped wide today): the six `LS-kitchen-*` pictures serve it too.
- The **service floor** (the dining-room view when a guest arrives or is served) can show the six `LS-restaurant-*` pictures dimmed behind its view instead of the blurred crop.

**Needs nothing:** every list screen (Market, Business, Inventory, Progress, Settings and so on: no full-screen picture), Prep Rush (drawn in code), the Restoration reveal (a small card), the people
and Paige cutouts (objects, not rooms), the section banners (cropped bars), the 18 cleaning rooms (they already have landscape art).

**Cannot be fixed with a picture:** the six cooking-clip videos and the oven bread film are portrait VIDEOS; they keep playing at their own shape in the middle of the window over the kitchen picture.
A landscape version would have to be a new video, which is outside what Codex makes here.

Reference PNGs for this part, in `reference\`: `backdrop-story-1-key.png`, `-2-kitchen`, `-3a-clean`, `-3b-repair`, `-3c-restore`, `-4-chef`, `-5-first-order` (941 x 1672 each, from `src\assets\story\intro-*.webp`),
`backdrop-loading-screen.png` (576 x 1024, from `public\loading\bg.webp`) and `map-second-floor.png` (864 x 1535, from `public\restaurant-map\second-floor.webp`).

**The nine Part 3 prompts are in their own file, ready to paste:** `docs/planning/LANDSCAPE-PART3-STORY-LOADING-SECONDFLOOR-CODEX-PROMPTS-2026-11-19.md`.

## Checklist (run it on EVERY picture before moving on)

1. The file name is exact, the size is exactly 1920 x 1080, opaque PNG.
2. The centre column (x 656 to 1264) is the attached picture unchanged. Overlay it on the reference to check: nothing moved.
3. The two seams (x = 656 and x = 1264) cannot be found: no step in the wall, floor, counter or horizon line, no colour jump, no hard light edge.
4. The sides are NEW painting, not a mirror and not a copy of the centre, and not blurred or flat.
5. No people, animals, game pieces, buttons, cards, boards or cars. No text of any kind.
6. The sides are a little calmer and darker than the centre; the bottom 12 % has no busy detail.
7. The two Sauce Station pictures are the same room; only the centre differs.

## What Claude does after delivery

Per game, in this order: convert to webp 1440 x 810 into `public\landscape-art\games\`; load it only in a wide window; remove that game's `<PortraitOnly />` so it fills the window with the 9:16 stage
over the new picture (the stage, the pieces and every control stay exactly as they are); extend `scripts/full-screen-qa.mts` F5 and `tools/e2e/portraitonly.mjs`. Until a picture arrives, that game stays at its
original 9:16 size. The service floor (the dining-room crop at the start and end of an order) is NOT in this list: it needs six pictures (one per kitchen tier) and keeps its blurred sides.
