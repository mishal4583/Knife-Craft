# Delivery Inspection: Codex art prompts (2026-11-08)

Source: `DELIVERY-INSPECTION-MINIGAME-PLAN-2026-11-08.md` §9 (the plan is the source; if a prompt changes there, rebuild this file).

**Where the art goes:** `D:\WORKS\GAMES\Knife Craft\Delivery Inspection Assets` (a new folder; create it if it does not exist). File names are exact (`D01-backdrop.png` …).

The reference picture the developer gave (a landscape "Delivery Inspection" screen with a chef, a crate of produce, a guide clipboard, a timer) is **for mood and for the look of the spoiled food only**. Do not copy its layout, its text, its chef or its HUD: the game is portrait and draws its own words and HUD.

## How to use

**Option 1, one paste (Codex with file access).** Open ONE Codex conversation, attach the reference images listed below (or let Codex open them from the paths), and paste the whole **MASTER PROMPT**. Codex makes the 10 images one at a time and saves each into the folder with the exact file name. Do the OPTIONAL spoiled-twin sheets (T01–T02) in a second conversation after you have accepted the kit.

**Option 2, one image at a time (image chat).** Paste the **STYLE BIBLE**, then ONE **ASSET** block. Ask for 4 variants, keep the best, attach it as the reference for the next.

**Order:** D04 (the defect overlays) first (they set the look of "bad"), then D02/D03 (the crate), D01 (backdrop), then the rest. Accept a piece only after the checklist at the bottom.

**Reference files (all in `D:\WORKS\GAMES\Knife Craft`):**
1. `public/business/ingredients/tomato.webp`, `lettuce.webp`, `potato.webp`, `onion.webp`, `pepper.webp`, `carrot.webp`, `mushroom.webp`, `cucumber.webp`, `garlic.webp`, `bread.webp`, `cheddar.webp`: the painted fresh produce the overlays go on (and `art-source/fridge-sort/A7.png` to `A11.png`: the five full-size sheets of all 57, the source of the optional twins).
2. `public/business/fridge-sort/kitchen-wall.webp`, `crate-back.webp`, `crate-front.webp`, `shelf-glass.webp`, `result-panel.webp`, `hud-wide.webp`: the painted look of the sibling mini-games (the new crate must look like their crate's bigger cousin).
3. `public/business/stockroom/truck.webp`, `parcel-open.webp`, `backdrop.webp`, `stamp.webp`, `badge-01.webp`: the delivery truck, parcel, a warm room, the stamp ring and the pin look.
4. The developer's reference picture "Delivery Inspection" (attached to the request): ONLY for how moldy tomatoes, wilted lettuce and bruised potatoes should look (clear, readable, friendly-gross, never gore).

---

## STYLE BIBLE (repeat at the top of every request in Option 2)

```
STYLE BIBLE — KnifeCraft "Delivery Inspection" mini-game art.
A warm, cozy, hand-painted mobile-game look in the same family as the attached KnifeCraft ingredient, kitchen and stockroom pictures:
soft painterly shading, gentle rim light, rounded chunky shapes, a thin darker outline in a warm brown (never pure black), rich but not
neon colors, a cheerful rustic kitchen. Light comes from the top-left, warm golden (about 3200 K), with a soft shadow falling
bottom-right. Everything must look like ONE set: same line weight, same softness, same saturation as the attached ingredient pictures.
Things must read at SMALL size (an ingredient is about 64 px on a phone): a bold silhouette, one clear main color, a bright
highlight on the top-left, no tiny details, EXCEPT the assets marked "tiny defect" which are meant for the magnifier.
SPOILAGE LOOK: friendly-gross like a cozy cooking game, not horror and not photo-realistic. Mold is soft fuzzy patches with a gentle
sheen, rot is a dark soft sunken patch, bruises are brown dents, wilt is limp yellow-brown edges. Never gore, never worms, never insects
except the flies where an asset asks for them. A "bad" thing must be clearly different from a harmless "dirty" thing.
STRICT RULES: NO text, NO letters, NO numbers, NO logos, NO brand names, NO watermarks, NO signature, NO people, NO animals except
the flies where an asset asks for them, NO UI chrome unless the asset IS the UI piece. Blank labels, tags, stamps and cards stay BLANK
(the game draws the words itself).
Output: PNG with a TRANSPARENT background (alpha) unless the asset says "full scene". If transparency is not possible, use a flat
pure chroma green #00FF00 background with no green anywhere in the subject and no shadow on the background (for green subjects use
flat magenta #FF00FF instead and say so in the reply).
Keep a clear margin of about 4% around the subject so nothing is cut off. Deliver ONE image per request, exactly the size asked.
SHEET RULES (for sheets): the exact grid asked, each item centered in an equal cell at the same scale (about 78% of the cell),
transparent background, NO grid lines, NO labels, NO shadows crossing cells, cells in READING ORDER (left to right, top to bottom);
a cell marked EMPTY stays empty. Keep every item inside its own cell (nothing may reach into the next one).
```

---

## MASTER PROMPT (Option 1: paste this into ONE Codex conversation)

```
You are making the art kit for a mobile cooking game's mini-game "Delivery Inspection". Read the plan's art section at
D:\WORKS\GAMES\Knife Craft\docs\planning\DELIVERY-INSPECTION-MINIGAME-PLAN-2026-11-08.md (§4.3 and §9) and the reference pictures
listed in D:\WORKS\GAMES\Knife Craft\docs\planning\DELIVERY-INSPECTION-CODEX-PROMPTS-2026-11-08.md (open it and follow its STYLE BIBLE
and every ASSET block exactly). Save every image into D:\WORKS\GAMES\Knife Craft\Delivery Inspection Assets (create the folder), with
the exact file name and pixel size given for each asset, as PNG with a transparent background. Make them in this order: D04, D02, D03,
D01, D05, D06, D07, D08, D09, D10. After each image, look at it and check the ACCEPTANCE CHECKLIST at the end of the prompts file; redo
it if it fails. Do not add text, letters or numbers to any image. When all ten are saved, list the file names and sizes.
```

---

## ASSETS

### D01: backdrop, the receiving bench (full scene, 1080 × 1920, `D01-backdrop.png`)
```
<STYLE BIBLE>
FULL SCENE (opaque, no transparency), portrait 1080 x 1920. A cozy restaurant RECEIVING CORNER at the back door, seen from the front,
slightly above: on the left a hand truck and two stacked empty wooden crates, on the right a window with warm morning light and green
leaves outside, shelves of glass jars and sacks on the back wall, a coiled rope hook, a small chalkboard WITH NOTHING WRITTEN on it,
a clipboard hook. In the lower middle a big empty wooden bench top (plain boards, clear and flat, about 900 px wide, from y 1000
to y 1500) where a crate will be placed by the game. The upper 20% (y 0-380) must be calm and low-detail (the game puts its title sign,
clock and buttons there). The bench's left and right edges and its lower 20% are plain wood so the game's buttons are readable.
Warm golden light, soft vignette. NO people, NO text, NO logos, NO crate on the bench, NO food on the bench.
```

### D02: the delivery crate, BACK layer (1000 × 520, `D02-crate-back.png`)
```
<STYLE BIBLE>
A big open wooden delivery crate seen from the front and slightly above, drawn as TWO layers; this is the BACK layer only: the inside of
the far wall, the inside of the two side walls (seen at a slant), and a crumpled cream paper liner lining the inside, with the paper
edges folding over the top rim. The crate is EMPTY and open; its inside floor is covered with the paper liner and visible only as a
dark-to-light gradient (the produce will be placed on it by the game). The FRONT wall and the front corners are NOT in this image
(the next asset makes them): leave the lower 35% of the image transparent. Warm pine planks with rope-handle cut-outs on the side
walls, metal corner brackets, a few nails. 1000 x 520, transparent background, subject filling the width with a 4% margin.
Reference for the wood and paper look: public/business/fridge-sort/crate-back.webp.
```

### D03: the delivery crate, FRONT layer (1000 × 300, `D03-crate-front.png`)
```
<STYLE BIBLE>
The FRONT layer of the same delivery crate as D02 (attach D02 and match it exactly: same planks, brackets, nails, light): the front
wall seen from the front, a wide wooden board wall with two rope-handle cut-outs, the two front corner posts rising slightly higher
than the wall, a few crumpled paper-liner edges peeking over the TOP rim of the front wall, and in the middle of the wall a BLANK oval
wooden emblem plate (no picture, no text). 1000 x 300, transparent background above the wall's top edge. It must line up with D02
when the two are placed one over the other (D02's lower edge meets D03's top edge; same width 1000).
```

### D04: 12 defect overlays (sheet 4 × 3, each cell 256 × 256, sheet 1024 × 768, `D04-defects.png`)
```
<STYLE BIBLE>
A SHEET of 12 transparent "defect stickers" that the game lays on top of any fresh ingredient picture. Each is ONE blotch that fits
inside a round area, painted so that it looks right on a red tomato, a green leaf, a yellow potato or a white mushroom alike (so: opaque
where it is mold/rot and softly feathered at its edges, no background, no ingredient drawn). Reading order:
1 fuzzy WHITE mold patch with tiny grey-green dots in the middle;
2 BLUE-GREEN mold patch, fluffy, with a pale ring;
3 BLACK mold speckles, many small dark dots clustered in a round patch;
4 GREY fuzz mold, soft, spread like cobweb dust;
5 ROT: a dark brown wet sunken soft patch with a glossy edge;
6 BLACK ROT: a dark almost-black collapsed patch with a thin yellow halo;
7 BRUISE: a brown dented soft patch with a lighter ring;
8 BRUISE 2: a purple-grey dented patch with small dark speckles;
9 WILT: a yellow-brown limp edge, drawn as a curved band (to lie along a leaf's edge), dull and dried;
10 SLIME: a glossy wet sheen patch with one drip running down;
11 PEST HOLES: five tiny holes with dark specks around them ("tiny defect": it is meant for the magnifier);
12 DRY SHRIVEL: cracked, wrinkled, dried skin patch.
Each is centered, about 78% of its cell. Transparent background.
```

### D05: 6 harmless natural marks, the decoys (sheet 3 × 2, each cell 256, sheet 768 × 512, `D05-decoys.png`)
```
<STYLE BIBLE>
A SHEET of 6 transparent "harmless mark stickers" that look a little like a defect but are NOT: they are what a fresh vegetable has
naturally. They must be clearly different from D04 (no fuzz, no dark wet rot, no dents with halos). Same use as D04: softly feathered,
fits any produce. Reading order:
1 a smear of brown garden SOIL, dry and crumbly;
2 a single shiny WATER DROP with a small highlight;
3 a small light SCUFF, a faint pale scratch;
4 FRECKLES, a few small tan dots like on a pear's skin;
5 a pale SUN PATCH, a slightly lighter, warmer round area;
6 a small green LEAF SPECK stuck on, with a tiny bit of stem.
Each centered, about 70% of its cell (they are meant to look small and calm). Transparent background.
```

### D06: item markers (sheet 2 × 2, each cell 256, sheet 512 × 512, `D06-markers.png`)
```
<STYLE BIBLE>
A SHEET of 4 transparent feedback marks the game lays on an ingredient. Reading order:
1 a round RED rubber-stamp ink mark: a thick ring with a slightly rough, inked edge, tilted a little, with its inside EMPTY (the game
  writes the words), slightly transparent ink look;
2 a red hand-drawn CROSS (X) with chalky rough edges (the "this one is fine" mark);
3 a white CHALK RING, a loose hand-drawn circle (the "found it" mark);
4 a green TICK in a soft round badge.
Each centered, about 78% of its cell. Transparent background.
```

### D07: the magnifying glass (512 × 512, `D07-magnifier.png`)
```
<STYLE BIBLE>
A brass magnifying glass seen from the front, tilted 30 degrees, handle going to the lower right. The glass is COMPLETELY TRANSPARENT
(real alpha, so the game can show a zoomed picture through it), with only a faint white highlight arc at the top-left of the glass and
a thin bright rim reflection. A polished brass rim with a little wear, a dark walnut-wood handle with a brass cap. No shadow on the
background. 512 x 512, subject about 90% of the image.
```

### D08: spoilage life (sheet 3 × 2, each cell 256, sheet 768 × 512, `D08-spoilage-life.png`)
```
<STYLE BIBLE>
A SHEET of 6 transparent small effects that sit on or beside a spoiled ingredient. Reading order:
1 a FLY seen from above, wings slightly open, tiny and friendly-cartoon, dark body, soft glassy wings;
2 the same fly, wings in a different position (a second animation frame, same size and same body);
3 a third fly pose, seen a little from the side;
4 a STINK WISP: two or three wavy yellow-green curling lines rising upward, soft and translucent;
5 a second STINK WISP, a different wavy shape (an animation frame);
6 a DRIP: a single glossy brown-green drop with a tiny trail above it.
Each centered, about 70% of its cell, drawn at a size that reads when shown about 24 px on a phone. Transparent background.
```

### D09: the Inspection Guide clipboard (480 × 680, `D09-guide.png`)
```
<STYLE BIBLE>
A wooden clipboard seen from the front, slightly tilted: a brass clip at the top, a cream paper sheet on it, with THREE blank round
picture windows stacked on the left side (each a thin painted ring, EMPTY inside), a blank label strip to the right of each window
(a faint line, NO text), and a fourth window lower down with a thin green outline (the "harmless" example), also EMPTY. The paper has
soft fold marks and a little coffee-ring stain. NO writing, NO text. The area inside the windows must be transparent. 480 x 680,
transparent background around the board.
```

### D10: 12 collectible "Sharp Eye" pins (sheet 4 × 3, each cell 256, sheet 1024 × 768, `D10-pins.png`)
```
<STYLE BIBLE>
A SHEET of 12 round enamel pins (like the Stockroom Sort badges, attach public/business/stockroom/badge-01.webp for the exact pin look:
metal rim, enamel fill, a tiny pin highlight), each one with a different small picture in its middle, no text, theme "sharp eyes at the
delivery door". Reading order: 1 a magnifying glass over a tomato, 2 an eye with a green leaf, 3 a wooden crate, 4 a clipboard with a
check mark, 5 a carrot with a sparkle, 6 a lettuce leaf with a magnifier, 7 a mushroom under a lens, 8 a delivery truck, 9 a red
stamp ring, 10 a golden eye, 11 a lemon with a sparkle, 12 a crown over a crate. Rim colors go from copper (1-4) to silver (5-8) to gold
(9-12). Each centered, about 78% of its cell. Transparent background.
```

---

## OPTIONAL PHASE 2: spoiled twins (do after the kit is accepted)

### T01: 24 produce drawn SPOILED (sheet 6 × 4, each cell 256, sheet 1536 × 1024, `T01-spoiled-twins.png`)
```
<STYLE BIBLE>
Attach art-source/fridge-sort/A7.png to A11.png (the five full sheets of the fresh ingredients) and public/business/ingredients/*.webp.
Draw each of these 24 ingredients SPOILED, as the "twin" of the fresh picture: the SAME pose, the SAME framing, the SAME size and the
SAME lighting as the fresh version, so the game can swap one for the other. Reading order: 1 tomato (moldy white fuzz and a collapsed
dark patch), 2 lettuce (limp, yellow-brown edges, slimy), 3 potato (black spots, wrinkled, green sprouts), 4 onion (soft, grey mold
at the neck), 5 pepper (wrinkled, black spot), 6 carrot (limp, white fuzz), 7 cucumber (yellow, sunken, wet), 8 mushroom (slimy
brown spots), 9 garlic (green sprouts, brown spots), 10 apple (brown bruise, mold ring), 11 strawberry (grey mold fuzz), 12 lemon
(green-blue mold patches), 13 orange (blue-green mold), 14 pear (soft brown dent), 15 peach (fuzzy mold, collapsed side), 16 avocado
(black sunken skin), 17 zucchini (soft, dark wet patch), 18 eggplant (wrinkled, brown spots), 19 cabbage (black edge leaves), 20
broccoli (yellowing florets, dark spots), 21 spinach (slimy, dark limp), 22 parsley (yellow, wilted, drooping), 23 basil (black
limp leaves), 24 cauliflower (brown spots, soft). Same friendly-gross look as D04. Each centered, about 78% of its cell.
Transparent background.
```

### T02: bread and cheese with mold (sheet 2 × 1, each cell 256, sheet 512 × 256, `T02-spoiled-bread-cheese.png`)
```
<STYLE BIBLE>
Attach public/business/ingredients/bread.webp and cheddar.webp. Draw the SAME bread loaf and the SAME cheddar wedge, in the same pose,
framing and lighting, but moldy: the bread with blue-green fuzzy patches on its crust, the cheddar with white and blue-green mold
spots and a dry cracked edge. Reading order: 1 bread, 2 cheddar. Transparent background.
```

---

## ACCEPTANCE CHECKLIST (accept a piece only if every line is yes)

1. The exact file name and the exact pixel size asked.
2. A real transparent background (no white box, no grey checkerboard painted in, no green or magenta fringe) except D01.
3. NO text, letters, numbers or logos anywhere. Blank stamps, labels and plates stay blank.
4. The same painted family as the attached ingredient and kitchen pictures: same line weight, same softness, same light direction.
5. It reads at small size: an overlay shown at 64 px is still clearly "mold", "rot" or "bruise"; a decoy shown at 64 px is clearly "just dirt".
6. D04 vs D05: a stranger can tell a defect from a decoy at a glance (defects fuzzy / dark / sunken; decoys light / small / calm).
7. D02 and D03 line up when stacked (same width, same planks, same light); the front layer has nothing that belongs to the back.
8. Sheets: the exact grid, items centered at the same scale, nothing crossing into the next cell, no grid lines, cells in reading order.
9. Nothing gory: no worms, no insects except the flies in D08.
10. D01: the upper 20% is calm, the bench top is plain and empty, nothing sits where the crate will go.
