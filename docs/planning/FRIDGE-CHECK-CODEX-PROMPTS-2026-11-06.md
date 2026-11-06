# Fridge Check: Codex art prompts (2026-11-06)

Source: `FRIDGE-CHECK-MINIGAME-PLAN-2026-11-06.md` §9 (the plan is the source; if a prompt changes there, rebuild this file).

**Where the art goes:** `D:\WORKS\GAMES\Knife Craft\Fresh Check Assets` (a new folder; create it if it does not exist).

## How to use

**Option 1, one paste (Codex with file access).** Open ONE Codex conversation, attach the reference images listed below (or let Codex open them from the paths), and paste the whole **MASTER PROMPT**. Codex makes the 11 required images one at a time and saves each into the folder with the exact file name. Do the OPTIONAL spoiled-twin sheets (C20–C24) in a second conversation, after you have accepted the first 11.

**Option 2, one image at a time (image chat).** Paste the **STYLE BIBLE**, then ONE **ASSET** block. Ask for 4 variants, keep the best, attach it as the reference for the next.

**Order:** C02 (the card) first, then C08 (overlays), C01 (backdrop), then the rest. Accept a piece only after the checklist at the bottom.

**Reference files (all in `D:\WORKS\GAMES\Knife Craft`):**
1. `public/business/ingredients/tomato.webp`, `salmon.webp`, `bread.webp`, `basil.webp`, `cheddar.webp`, `apple.webp`: the painted fresh ingredients the overlays go on (and `art-source/fridge-sort/A7.png` to `A11.png`: the five full-size sheets of all 57, the source of the optional twins).
2. `public/business/fridge-sort/kitchen-wall.webp`, `crate-front.webp`, `shelf-glass.webp`, `result-panel.webp`, `hud-wide.webp`: the painted look of the sibling mini-games.
3. `public/inventory/ingredients-stockroom-upgraded.webp`, `public/inventory/supplies-stockroom.webp`: the warm rooms (the cold room must feel like the same game in a different room).
4. `Iventory Assets/I23-stamp.png`, `I21-ribbons.png`, `I26-badges.png`, `I22-fx.png`: the Stockroom Sort kit (the stamp ring, ribbons, enamel pins and sparkles share the look).

---

## STYLE BIBLE (repeat at the top of every request in Option 2)

```
STYLE BIBLE — KnifeCraft "Fridge Check" mini-game art.
A warm, cozy, hand-painted mobile-game look in the same family as the attached KnifeCraft ingredient, kitchen and stockroom pictures:
soft painterly shading, gentle rim light, rounded chunky shapes, a thin darker outline in a warm brown (never pure black), rich but not
neon colors, a cheerful rustic kitchen. Light comes from the top-left, warm golden (about 3200 K) in the kitchen pieces and a cool
blue-white (about 6500 K) only in the cold-room backdrop, with a soft shadow falling bottom-right.
Everything must look like ONE set: same line weight, same softness, same saturation as the attached ingredient pictures.
Things must read at SMALL size: a bold silhouette, one clear main color, a bright highlight on the top-left, no tiny details.
STRICT RULES: NO text, NO letters, NO numbers, NO logos, NO brand names, NO watermarks, NO signature, NO people, NO animals except
the flies where an asset asks for them, NO UI chrome unless the asset IS the UI piece. Blank labels, tags, stamps and cards stay BLANK
(the game draws the words itself). Spoilage is shown with mold, bruises, slime and wilting, never gore.
Output: PNG with a TRANSPARENT background (alpha) unless the asset says "full scene". If transparency is not possible, use a flat
pure chroma green #00FF00 background with no green anywhere in the subject and no shadow on the background (for green subjects use
flat magenta #FF00FF instead and say so in the reply).
Keep a clear margin of about 4% around the subject so nothing is cut off. Deliver ONE image per request, exactly the size asked.
SHEET RULES (for sheets): the exact grid asked, each item centered in an equal cell at the same scale (about 78% of the cell),
transparent background, NO grid lines, NO labels, NO shadows crossing cells, cells in READING ORDER (left to right, top to bottom);
a cell marked EMPTY stays empty. Keep every item inside its own cell (nothing may reach into the next one).
```

---

## MASTER PROMPT (Option 1: paste this whole block)

```
You are making the art for a new KnifeCraft mini-game called "Fridge Check". Work through the 11 assets below ONE image at a time, in
the order given, and save every finished PNG into this folder with EXACTLY the file name shown:

    D:\WORKS\GAMES\Knife Craft\Fresh Check Assets

Create the folder if it does not exist. If you cannot write there, save into your normal output folder and tell me the exact full paths at
the end. Do not skip an asset, do not merge two assets, do not change a size. Open the reference files first and keep ONE look for the
whole set.

THE GAME (so you draw the right things): at closing time, in the restaurant's walk-in fridge, the player inspects the food. A card for each
ingredient in stock slides in; the player swipes it right to KEEP it (into a crate), left to BIN it (into a pedal bin) or up to USE FIRST
(onto a front shelf with an orange flag). Spoiled-looking food must look spoiled at a glance. Then the kept food is wrapped in cling film
and labelled with a use-by sticker. The game draws all words, numbers and the ingredient pictures itself.

REFERENCES (open these): D:\WORKS\GAMES\Knife Craft\public\business\ingredients\tomato.webp, salmon.webp, bread.webp, basil.webp, cheddar.webp,
apple.webp; ...\public\business\fridge-sort\kitchen-wall.webp, crate-front.webp, shelf-glass.webp, result-panel.webp, hud-wide.webp;
...\public\inventory\ingredients-stockroom-upgraded.webp and supplies-stockroom.webp; ...\Iventory Assets\I23-stamp.png, I21-ribbons.png,
I26-badges.png, I22-fx.png.

[PASTE THE STYLE BIBLE HERE]

ASSETS (file name, size, what):
C02-card.png — 640 x 820 — see block C02
C08-overlays.png — 1024 x 768 — see block C08
C01-backdrop-coldroom.png — 1080 x 1920, FULL SCENE — see block C01
C03-stamps.png — 768 x 256 — see block C03
C04-bins.png — 1024 x 512 — see block C04
C05-props.png — 1024 x 512 — see block C05
C06-steel-shelf.png — 1200 x 200 — see block C06
C07-freshness-icons.png — 1024 x 256 — see block C07
C09-spoil-fx.png — 1024 x 512 — see block C09
C10-wrap-film.png — 1536 x 512 — see block C10
C11-badges.png — 1024 x 768 — see block C11

After each image: check it against the CHECKLIST (bottom of this file) and redo it if it fails. When all are saved, write
D:\WORKS\GAMES\Knife Craft\Fresh Check Assets\ASSET-MANIFEST.md listing every file, its size, and (for sheets) the cell-by-cell contents, and
tell me anything you could not do.
```

---

## REQUIRED ASSETS

### C02 — The inspection card (`C02-card.png`)

```
ASSET C02: ONE blank inspection card, front view, portrait, slightly tilted by 1 degree so it feels hand-placed. A cream paper index card with
a thin warm-brown border and rounded corners, a small brass bulldog clip at the top center, a faint paper texture and a soft shadow underneath.
On the card: a large rounded-rectangle PICTURE WINDOW in the upper 58% (a slightly darker, recessed paper panel with a thin inner border; the
game puts an ingredient picture here, so keep it empty and calm), under it a BLANK name strip (a pale rounded bar), and at the bottom a row with
a small round BLANK corner badge on the left (for a freshness icon) and a BLANK rounded box on the right (for an amount). Two faint blank ruled
lines under the name strip. No text, no icons. Transparent background. 640 x 820 px.
```

### C08 — Spoilage overlays (`C08-overlays.png`)

```
ASSET C08: a sheet of 12 transparent spoilage overlays, 4 columns x 3 rows, 1024 x 768 px (256 x 256 cells). They are laid over a painted
ingredient picture to make it look spoiled, so each is a SEMI-OPAQUE patch with soft feathered edges, painted in the same style, no outline
except a very faint dark edge. Cells in order:
1 fuzzy GREEN-BLUE mold cluster (a round patch with fuzzy edges)      2 fuzzy WHITE-GREY mold cluster, lumpier
3 a scatter of small BLACK mold dots and speckles                      4 a bigger fuzzy mold patch with a darker green center
5 a soft BROWN bruise blotch with a darker edge                        6 two smaller brown-black rot spots
7 a wet SLIME sheen with a dripping edge (glossy, olive-green)        8 a grey-green WILT shade (a soft translucent darkening that
                                                                         covers about half the cell, like a shadow of rot)
9 a mushy dark patch with tiny bubbles                                 10 a long streak of white mold along an edge
11 a hairy grey mold tuft (fine threads)                               12 a ring of pale yellowish-green decay with a dark center
Each patch fills about 70 % of its cell and stays inside it. Transparent background.
```

### C01 — Backdrop, the walk-in cold room (`C01-backdrop-coldroom.png`)

```
ASSET C01 (FULL SCENE, no transparency), 1080 x 1920 px, portrait. The restaurant's walk-in fridge at closing time, seen straight on: stainless-steel
wall panels with soft vertical seams, a cool blue-white light from one hanging caged lamp at the top-left, a little frost in the corners, a few
steel wire shelves at the far left and right edges holding blurred crates, a brushed steel prep counter across the bottom 22% with a rubber mat.
The CENTER 70% x 55% of the image is calm, empty, evenly lit steel wall (the game places a card and two piles there). Cool colors, but keep
the same painted warmth and soft outlines as the attached KnifeCraft pictures, and a warm brass accent on the lamp so it still feels like the
same game. A soft dark vignette at the corners. No text, no people, no food in the middle.
```

### C03 — Three blank stamps (`C03-stamps.png`)

```
ASSET C03: a sheet of 3 blank rubber-stamp impressions, 3 columns x 1 row, 768 x 256 px, transparent background. Each is a round double-ring
stamp with a thin outer ring and a thicker inner ring, slightly uneven ink like a real stamp, the middle BLANK (the game prints a word), and a
tiny symbol at the top of the ring. Cells in order: 1) GREEN ink with a tiny leaf at the top; 2) RED ink with a tiny cross at the top; 3) AMBER
ink with a tiny arrow pointing up at the top. Same style as the attached stamp ring. No text.
```

### C04 — Bins (`C04-bins.png`)

```
ASSET C04: a sheet of 2 items, 2 columns x 1 row, 1024 x 512 px, transparent background. A chunky steel PEDAL BIN for kitchen waste, front view,
with a dark green liner showing, a small foot pedal at the bottom, a dent or two for character, bold and readable at 120 px. Cell 1: the lid OPEN
(tilted back, the dark inside visible). Cell 2: the lid CLOSED. Same bin, same scale. No text, no labels.
```

### C05 — Props (`C05-props.png`)

```
ASSET C05: a sheet of 8 props, 4 columns x 2 rows, 1024 x 512 px (256 x 256 cells), transparent background, bold and readable at 56 px. Cells in
order:
1 a small ORANGE flag tag on a short stick (a "use first" marker), BLANK
2 a rounded rectangle use-by LABEL sticker, pale GREEN with a thin darker border, BLANK
3 the same sticker, pale YELLOW, BLANK
4 the same sticker, pale RED-PINK, BLANK
5 a roll of beige masking tape with a strip peeling off
6 a black marker pen with the cap beside it
7 a roll of cling film in a cardboard box with a strip pulled out
8 a small steel food-storage tray (empty, with a thin rim)
```

### C06 — Steel shelf (`C06-steel-shelf.png`)

```
ASSET C06: ONE long stainless-steel walk-in shelf seen straight on from the front: a thick brushed-steel front lip with a thin top surface and two
small bracket ends, a soft shadow under it, a cool-white highlight on the top-left. It must tile in the middle (the left and right ends are the
brackets). Transparent background. 1200 x 200 px.
```

### C07 — Freshness icons (`C07-freshness-icons.png`)

```
ASSET C07: a sheet of 4 round enamel icon badges, 4 columns x 1 row, 1024 x 256 px, transparent background. Each is a round badge with a thin
brass rim and a bold symbol, readable at 40 px, NO text. Cells in order: 1) FRESH: a bright green leaf on a cream background; 2) AGING: a
yellow clock face on a pale yellow background; 3) NEAR EXPIRY: an orange hourglass on a pale orange background; 4) SPOILED: a sickly green
stink cloud with three wavy lines, on a pale grey-purple background.
```

### C09 — Spoilage effects (`C09-spoil-fx.png`)

```
ASSET C09: a sheet of 8 small effect sprites, 4 columns x 2 rows, 1024 x 512 px, transparent background, painted in the same style, each fills
about 60 % of its cell. Cells in order: 1-3) three cartoon FLIES in three different poses (tiny, dark, with pale wings); 4-5) two wavy green
STINK WISPS (soft translucent, one taller, one wider); 6-7) two olive-green slimy DRIPS (a drop and a long drip); 8) a small grey COBWEB
corner, translucent.
```

### C10 — Cling-film wraps (`C10-wrap-film.png`)

```
ASSET C10: a sheet of 3 translucent cling-film wraps, 3 columns x 1 row, 1536 x 512 px (512 x 512 cells), transparent background. Each is a
glossy clear plastic film stretched over an invisible object (so only the film is drawn): 1) a ROUND bundle wrap, 2) a BOX / rectangle wrap, 3)
a LONG roll wrap. The film is mostly transparent (alpha about 20-35 %) with bright white specular highlights along the top-left, a few crinkle
lines, and slightly thicker gathered edges, so it can be laid over any ingredient picture. If real translucency is not possible, draw the film on a
flat mid-grey #808080 background and tell me.
```

### C11 — Freshness pins (`C11-badges.png`)

```
ASSET C11: a sheet of 12 collectible enamel pins, 4 columns x 3 rows, 1024 x 768 px, transparent background, same style as the attached
`I26-badges.png`, each a different shape with one bold symbol, NO text. Cells in order: 1 a snowflake, 2 a thermometer, 3 a green leaf, 4 an
apple with a small star, 5 a pedal bin with a star, 6 a stopwatch, 7 a gold magnifying glass, 8 a blue rosette with a leaf, 9 a clipboard with a
tick, 10 a fish on ice, 11 a golden cheese wedge, 12 a trophy cup with a leaf.
```

---

## OPTIONAL: THE SPOILED TWINS (Phase 2; do these in a second conversation, after C01-C11 are accepted)

Five sheets draw all 57 ingredients **spoiled**, in the SAME poses, SAME scale and SAME cell order as the fresh sheets. For each sheet attach the matching fresh sheet (`art-source/fridge-sort/A7.png` ... `A11.png`) and say: "Redraw this exact sheet with every item spoiled. Keep every item's pose, size, position, lighting and outline identical; change only the state."

Common rules for every twin: the item is clearly spoiled but still recognizable; a dulled, desaturated version of its own colors; the signs below; NO gore; a few tiny flies are allowed on at most 3 items per sheet; same 4 columns x 3 rows, 1024 x 768 px, transparent background, NO text. Cells in reading order; a cell marked EMPTY stays empty.

### C20 — Twins, sheet 1 (`C20-spoiled-1.png`, fresh sheet A7)

```
ASSET C20: the SPOILED version of the attached sheet A7 (same poses and order): 
1 tomato: wrinkled, collapsing, a dark soft patch and green-white mold at the stem
2 carrot: limp and bent, white slimy patches, dull brown tip
3 cucumber: yellowish and shriveled, wet dark spots, one end collapsed
4 onion: soft with a dark wet patch, a sprout and green mold at the top
5 potato: green-tinged, sprouting long pale shoots, dark soft spots
6 mushroom: slimy and dark, collapsed cap, brown wet patches
7 bell pepper: wrinkled skin with a sunken mushy patch and white mold at the stem
8 zucchini: soft and sagging, yellow-brown patches, dark wet spots
9 eggplant: dull, wrinkled, a brown mushy patch, grey mold at the stem
10 broccoli: yellowing florets, dark patches, limp stem
11 corn cob: dry shriveled kernels, brown-black mold patches under the husk
12 celery: limp, brown-edged, slimy stalks
```

### C21 — Twins, sheet 2 (`C21-spoiled-2.png`, fresh sheet A8)

```
ASSET C21: the SPOILED version of the attached sheet A8 (same poses and order):
1 lettuce: wilted, brown, slimy translucent leaves
2 cabbage: black spots, yellow outer leaves, soft rot
3 cauliflower: brown-black speckles, soft patches
4 spinach: wilted, dark and slimy, collapsed
5 asparagus: limp, dried tips, slimy bases
6 radish: shriveled, soft, a white mold patch
7 beetroot: shriveled with a wet dark patch and grey mold
8 sweet potato: sunken dark patches, white fuzzy mold, sprouts
9 green beans: shriveled, brown spots, a slimy patch
10 fennel: browning and limp, black spots, soft base
11 artichoke: dried brown leaves, dark mold in the center
12 pea pod: yellowed, wrinkled, brown spots, a slimy patch
```

### C22 — Twins, sheet 3 (`C22-spoiled-3.png`, fresh sheet A9; cell 12 is EMPTY)

```
ASSET C22: the SPOILED version of the attached sheet A9 (same poses and order; cell 12 stays EMPTY):
1 pumpkin: a collapsed soft side, grey-white mold, a dark wet patch
2 turnip: shriveled, soft, a white mold patch
3 green chili: wrinkled, brown-black, limp
4 spring onion: slimy, yellow and translucent, collapsed
5 garlic: soft, yellowed, a green-blue mold patch and a sprout
6 ginger: shriveled, dark wet patches, white mold
7 basil: black, wilted, limp leaves
8 parsley: yellow-brown, wilted, slimy
9 cilantro: black-brown, melted stems
10 bread loaf: green-blue fuzzy mold patches
11 baguette: dried, hard and cracked, green mold patches
12 EMPTY
```

### C23 — Twins, sheet 4 (`C23-spoiled-4.png`, fresh sheet A10)

```
ASSET C23: the SPOILED version of the attached sheet A10 (same poses and order):
1 strawberry: dark, mushy, fuzzy grey mold
2 apple: brown bruises, a soft wrinkled patch, a bite of mold
3 orange: a blue-green mold patch, soft and dull
4 lemon: a white-green mold patch, hard and wrinkled
5 avocado: black and wrinkled, a mushy dent
6 pear: brown mushy patches, wrinkled
7 peach: a fuzzy mold patch, a soft brown dent
8 pineapple: browning, soft and sagging, mold at the crown
9 watermelon: a soft sunken patch, white mold, slimy
10 mango: black speckles, a mushy dent, wrinkled
11 kiwi: shriveled, a white mold patch, wet dents
12 pomegranate: a brown shriveled skin, mold at the crown
```

### C24 — Twins, sheet 5 (`C24-spoiled-5.png`, fresh sheet A11; cells 11 and 12 are EMPTY)

```
ASSET C24: the SPOILED version of the attached sheet A11 (same poses and order; cells 11 and 12 stay EMPTY):
1 grapes: shriveled, a fuzzy grey mold on the bunch, brown
2 coconut: a cracked shell with a wet dark patch and a white mold spot
3 lime: hard, shriveled, a blue-green mold patch
4 cheddar wedge: green-blue mold spots, a hard dried edge
5 mozzarella ball: slimy, yellowish, a pink-grey patch
6 butter block: yellowed, a grey-green mold patch, melted corner
7 tofu block: slimy, yellow-grey, a pink patch
8 raw chicken breast: grey-green, slimy, a sickly sheen
9 raw steak: grey-brown, slimy, dark dry edges
10 raw salmon fillet: dull grey, slimy, a milky film
11 EMPTY
12 EMPTY
```

---

## CHECKLIST (after each image)

- [ ] The exact file name, the exact size, nothing cut off, a margin of about 4 %.
- [ ] No text, letters, numbers, logos or brand names anywhere (blank things stay blank).
- [ ] Transparent background (or the flat #00FF00 / #FF00FF / #808080 where stated), no halo.
- [ ] The same top-left light and the same brown outline as the attached ingredient pictures; the cold room is the only cool-lit piece.
- [ ] Small size: shrink it to 56 px in your head; if it is unrecognizable, redo it.
- [ ] Sheets: the exact cell order; EMPTY cells really empty; nothing reaches into a neighbouring cell.
- [ ] Spoilage looks spoiled but friendly (no gore), and a twin keeps the fresh item's pose, size and position.

## After the images are in the folder

Ask Claude: "wire the Fridge Check art". It adds a `build_fridge_check()` step to `scripts/make-market-assets.py` (cuts the sheets by shape, writes WebP to `public/business/fridge-check/` and, for the twins, `public/business/ingredients-spoiled/`), updates the art QA, and the screen can use the pictures. The plan's decisions (§11) come first.
