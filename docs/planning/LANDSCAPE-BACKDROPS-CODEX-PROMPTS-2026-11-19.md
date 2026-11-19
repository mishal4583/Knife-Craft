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
