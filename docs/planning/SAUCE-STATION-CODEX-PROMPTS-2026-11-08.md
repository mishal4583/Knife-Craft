# Sauce Station: Codex art prompts (2026-11-08)

Source: `SAUCE-STATION-MINIGAME-PLAN-2026-11-08.md` §10 (the plan is the source; if a prompt changes there, rebuild this file).
**38 files** in four batches. Nothing in the plan's asset table is missing from this file (checked: M01-M25, B01-B08, C01-C05).

**Where the art goes:** `D:\WORKS\GAMES\Knife Craft\Sauce Station Assets` (a new folder; create it if it does not exist). File names are exact (`M01-backdrop-mix.png` …). The folder is source art only (it is gitignored like the others).

## How to use

**Option 1: batches (recommended, Codex with file access).** Open ONE Codex conversation PER BATCH (A, B, C, D below), attach that batch's reference images, paste the **STYLE BIBLE**, then paste the batch's **BATCH PROMPT**. Codex makes the batch's images one at a time and saves each with its exact file name. Do the batches in order: **A** (containers: they set the look), then **B** (mixing tools and gauges), **C** (bottling), **D** (collection and rewards). A batch is 8-12 files.

**Option 2: one image at a time (image chat).** Paste the **STYLE BIBLE**, then ONE **ASSET** block. Ask for 4 variants, keep the best, attach it as the reference for the next.

**Reference files (all in `D:\WORKS\GAMES\Knife Craft`), attach what each batch says:**
1. `public/business/ingredients/tomato.webp`, `onion.webp`, `garlic.webp`, `chilli.webp`, `lemon.webp`, `lime.webp`, `basil.webp`, `mango.webp`, `pineapple.webp`, `corn.webp`, `avocado.webp`: the painted produce (for the heaps, chunks and bottle icons).
2. `public/business/fridge-sort/kitchen-wall.webp`, `shelf-glass.webp`, `result-panel.webp`, `hud-wide.webp`, `starbar-frame.webp`: the painted look of the sibling mini-games.
3. `public/business/inspection/crate-back.webp`, `crate-front.webp`, `backdrop.webp`, `magnifier.webp`, `markers.webp`: the newest kit (the same wood, brass and warm light; the bowl and the crate layers work the same way).
4. `public/business/stockroom/backdrop.webp`, `parcel-open.webp`, `badge-01.webp`, `ribbon-gold.webp`: a warm room, the enamel pin look and the ribbons.
5. `public/business/staff-portraits/prep-cook.webp`: the cook who watches (not redrawn).

---

## STYLE BIBLE (paste at the top of EVERY request)

```
STYLE BIBLE — KnifeCraft "Sauce Station" mini-game art.
A warm, cozy, hand-painted mobile-game look in the same family as the attached KnifeCraft ingredient, kitchen, crate and stockroom pictures:
soft painterly shading, gentle rim light, rounded chunky shapes, a thin darker outline in a warm brown (never pure black), rich but not neon
colors, a cheerful rustic kitchen. Light comes from the top-left, warm golden (about 3200 K), with a soft shadow falling bottom-right.
Everything must look like ONE set: same line weight, same softness, same saturation as the attached ingredient and crate pictures.
Things must read at SMALL size (a pantry bottle is about 64 px wide on a phone): a bold silhouette, one clear main color, a bright highlight on
the top-left, no tiny details.
GLASS AND LIQUID: glass is clear with soft white highlights and a faint green-blue edge; what is inside a container is painted fully (oil is
golden-green and glossy, vinegar is pale and clear, cream is white, soy is near-black brown). The game draws its OWN mixing liquid in code, so any
asset that says "EMPTY" or "MASK" must contain NO liquid.
STRICT RULES: NO text, NO letters, NO numbers, NO logos, NO brand names, NO watermarks, NO signature, NO people, NO animals, NO UI chrome unless
the asset IS the UI piece. Labels, tags, cards and plates stay BLANK (the game writes the words itself); a tiny simple pictogram (a leaf, a drop,
a chilli) on a label is allowed only where an asset says so.
Output: PNG with a TRANSPARENT background (alpha) unless the asset says "full scene". If transparency is not possible, use a flat pure chroma
green #00FF00 background with no green anywhere in the subject and no shadow on the background (for green subjects use flat magenta #FF00FF
instead and say so in the reply). Keep a clear margin of about 4% around the subject so nothing is cut off. Deliver ONE image per request,
exactly the size asked.
SHEET RULES (for sheets): the exact grid asked, each item centered in an equal cell at the same scale (about 78% of the cell unless the asset says
otherwise), transparent background, NO grid lines, NO labels, NO shadows crossing cells, cells in READING ORDER (left to right, top to bottom);
a cell marked EMPTY stays empty. Keep every item inside its own cell (nothing may reach into the next one).
LAYER RULES (for back / front / mask sets): every layer of one object has the SAME canvas size, the SAME silhouette and the SAME position so the
layers line up pixel for pixel when stacked. A MASK is solid pure white (#FFFFFF) where it applies and fully transparent elsewhere, with a hard
clean edge (no soft fringe, no colored pixels).
SCALE RULES (all pantry containers): one shared scale: a pantry bottle stands about 190 px tall in its 256 x 512 cell, a jar about 140 px tall in
its 256 x 256 cell, a carton about 240 px tall in its 256 x 384 cell, so they look right side by side on one shelf.
```

---

## BATCH A: the pantry (containers and spices): do FIRST (it sets the look)

Attach: references 1, 3, 4. Files: M12, M13, M14, M15, M16, M17, M18.

### BATCH PROMPT A
```
<STYLE BIBLE>
You are making the PANTRY for a sauce-making mini-game. Save every image into D:\WORKS\GAMES\Knife Craft\Sauce Station Assets (create the folder)
with the exact file name and size given, as PNG with a transparent background. Make them in this order: M12, M13, M14, M15, M16, M17, M18. After
each image, look at it and check the ACCEPTANCE CHECKLIST at the end of the prompts file (docs/planning/SAUCE-STATION-CODEX-PROMPTS-2026-11-08.md);
redo it if it fails. All containers share one scale and one light. Every label stays BLANK. When all seven are saved, list the file names and sizes.
Follow each ASSET block below exactly.
```

### M12: pantry BOTTLES (sheet 3 × 2, each cell 256 × 512, sheet 768 × 1024, `M12-pantry-bottles.png`)
```
<STYLE BIBLE>
A SHEET of 6 pantry bottles, each a standing bottle seen from the front, filled, with a BLANK paper label (cream, no text) on its middle. Reading
order: 1 OLIVE OIL: a tall green glass bottle with a cork stopper, golden-green oil inside; 2 VEGETABLE OIL: a clear plastic-look bottle with a
yellow screw cap, pale gold oil inside; 3 SESAME OIL: a small dark-amber glass bottle with a red cap, deep amber oil; 4 WHITE VINEGAR: a clear glass
bottle with a white screw cap, clear pale liquid; 5 RED WINE VINEGAR: a clear glass bottle with a cork and a red wax top, ruby-brown liquid;
6 SOY SAUCE: a squat dark glass bottle with a black cap and a red-and-white blank label, near-black brown liquid. Each stands at about 190 px tall in
its 512 px cell, centered, feet on a common baseline 40 px above the cell's bottom. Transparent background, no shadows crossing cells.
```

### M13: pantry JARS (sheet 3 × 2, each cell 256 × 256, sheet 768 × 512, `M13-pantry-jars.png`)
```
<STYLE BIBLE>
A SHEET of 6 pantry jars and tubs, filled, front view, each with a BLANK paper label. Reading order: 1 MAYONNAISE: a clear glass jar with a white
lid, thick cream-white contents; 2 MUSTARD: a squat glass jar with a yellow lid, bright mustard-yellow contents; 3 TAHINI: a tall glass jar with a
brown lid, beige creamy paste with a little oil on top; 4 PEANUT BUTTER: a glass jar with a red lid, brown textured paste; 5 HONEY: a hexagonal glass
jar with a wooden dipper stuck in it, golden translucent honey; 6 YOGURT: a white tub with a flat lid, thick white yogurt visible as a swirl on the
open top. About 140 px tall in each cell, centered, feet on a common baseline 30 px above the cell's bottom.
```

### M14: pantry CARTONS & CANS (sheet 3 × 2, each cell 256 × 384, sheet 768 × 768, `M14-pantry-cartons.png`)
```
<STYLE BIBLE>
A SHEET of 6 pantry packages, front view, each with a BLANK label area (a plain colored panel, no text, no logo). Reading order: 1 CREAM: a
white-and-pale-blue carton with a gabled top; 2 MILK: a white carton with a blue band, gabled top; 3 STOCK: a cream carton with a green band and a
spout; 4 COCONUT MILK: a metal can with a pull ring, a white and teal blank wrap; 5 TOMATO PASSATA: a tall red-lidded glass jar of smooth deep-red
puree; 6 WATER: a clear glass jug with a handle and a cork, clear water with tiny bubbles. About 240 px tall in each cell, centered, feet on a
common baseline 40 px above the cell's bottom.
```

### M15: chilli bottle, stock cube, measuring cup (sheet 3 × 1, each cell 256 × 384, sheet 768 × 384, `M15-pantry-extras.png`)
```
<STYLE BIBLE>
A SHEET of 3 extra pantry pieces, front view: 1 CHILLI SAUCE: a red plastic squeeze bottle with a pointed white nozzle and a BLANK label,
bright red sauce visible through the shoulder; 2 STOCK CUBES: three golden-brown wrapped stock cubes stacked in a small pile, wrapper blank;
3 MEASURING CUP: a clear glass measuring jug with a handle, painted measuring lines (no numbers), EMPTY. About 220 px tall each, centered, feet
on a common baseline 40 px above the cell's bottom.
```

### M16: SPICE BOWLS (sheet 4 × 2, each cell 256 × 256, sheet 1024 × 512, `M16-spice-bowls.png`)
```
<STYLE BIBLE>
A SHEET of 8 small rustic spice bowls seen from a high 3/4 angle, each a little ceramic bowl heaped with ground spice and a tiny wooden spoon
resting in it. Reading order: 1 SALT: white coarse crystals; 2 PEPPER: black ground pepper; 3 PAPRIKA: bright red-orange powder; 4 TURMERIC: deep
golden-yellow powder; 5 CUMIN: warm brown powder; 6 CURRY POWDER: orange-yellow powder with brown flecks; 7 CHILLI FLAKES: red flakes with seeds;
8 SUGAR: white fine crystals with a glint. The bowls are the same size and the same cream glaze; only the heap differs. About 150 px wide in each cell.
```

### M17: chopped-produce HEAPS (sheet 5 × 3, each cell 256 × 256, sheet 1280 × 768, `M17-produce-heaps.png`)
```
<STYLE BIBLE>
Attach public/business/ingredients/tomato.webp, onion.webp, garlic.webp, chilli.webp, lemon.webp, lime.webp, basil.webp, mango.webp, pineapple.webp,
corn.webp, avocado.webp for the exact colors and style. A SHEET of 15 small heaps of CHOPPED fresh produce, each a neat little pile on nothing (no
plate, no board), seen from a high 3/4 angle, in the same painted style as the whole ingredients. Reading order: 1 diced TOMATO, 2 diced ONION,
3 chopped GARLIC, 4 sliced red CHILLI, 5 lemon WEDGES with a squeezed half, 6 lime WEDGES with a squeezed half, 7 grated GINGER, 8 chopped CILANTRO,
9 torn BASIL leaves, 10 chopped PARSLEY, 11 diced MANGO, 12 diced PINEAPPLE, 13 CORN kernels, 14 diced AVOCADO with a little skin, 15 diced
POTATO. About 160 px wide each, centered.
```

### M18: floating CHUNKS (sheet 5 × 2, each cell 128 × 128, sheet 640 × 256, `M18-chunks.png`)
```
<STYLE BIBLE>
A SHEET of 10 tiny floating chunk clusters used inside chunky sauces (they are drawn small, about 40 px), each a cluster of 3-4 small pieces with a
slight wet shine, no shadow. Reading order: 1 tomato dice, 2 onion dice, 3 pineapple cubes, 4 corn kernels, 5 green herb flakes, 6 mango cubes,
7 avocado chunks, 8 red chilli bits, 9 garlic bits, 10 pepper dice (yellow and green). Each cluster about 90 px wide in its 128 px cell.
```

---

## BATCH B: the mixing tools, gauges and scene

Attach: references 2, 3, 4. Files: M01, M02, M03, M04, M05, M06, M07, M08, M09, M10, M11, M19, M20, M21, M22, M23, M24, M25.

### BATCH PROMPT B
```
<STYLE BIBLE>
You are making the MIXING TOOLS and the SCENE for a sauce-making mini-game. Read the plan's §10 at
D:\WORKS\GAMES\Knife Craft\docs\planning\SAUCE-STATION-MINIGAME-PLAN-2026-11-08.md and follow every ASSET block of this prompts file
(docs/planning/SAUCE-STATION-CODEX-PROMPTS-2026-11-08.md) for batch B. Save each image into D:\WORKS\GAMES\Knife Craft\Sauce Station Assets with the
exact file name and size, PNG with a transparent background (except M01, a full scene). Order: M02, M03, M04, M05, M06, M07 (the two vessels first:
they set the scale), then M08, M09, M10, M11, M19, then the gauges M20-M25, and M01 last. After each image check the ACCEPTANCE CHECKLIST; redo it if
it fails. Layers of one object must line up exactly (LAYER RULES). When all are saved, list the file names and sizes.
```

### M01: backdrop, the sauce station (full scene, 1080 × 1920, `M01-backdrop-mix.png`)
```
<STYLE BIBLE>
FULL SCENE (opaque, no transparency), portrait 1080 x 1920. A cozy restaurant SAUCE STATION seen from the front, slightly above: a long warm
wooden counter across the lower half (plain boards, clear and flat, about 960 px wide, from y 1000 to y 1560), a back wall of green painted
wainscot with two wooden shelves of glass jars and copper pots, a hanging copper ladle, a window on the right with morning light and green leaves, a
small stove corner far left, a coil of rope on a hook. The counter top is EMPTY and calm: the game puts the bowl, the pantry and the tools on it.
The upper 20% (y 0-380) is calm and low-detail (the game puts its title, clock and buttons there). The lower 15% (y 1640-1920) is the plain front
panel of the counter (the game puts buttons there). NO people, NO text, NO food on the counter, NO bowl.
```

### M02: mixing bowl, BACK layer (900 × 520, `M02-bowl-back.png`)
```
<STYLE BIBLE>
A big cream-glazed ceramic MIXING BOWL seen from the front and a little above, drawn as TWO layers; this is the BACK layer: the complete bowl
(far rim, the inside wall curving down, the inside floor, and the whole outside body) as if empty and clean. A thin copper-brown band round the rim.
Wide shallow bowl, 900 px wide, top rim ellipse about 840 x 230 px centered at (450, 190); the body narrows to a flat base at about y 500.
Transparent background. The FRONT layer (the next asset, M03) is placed with its top edge at y 220 of this canvas and has the same width: do not
paint anything that belongs only to the front. NO liquid in the bowl.
```

### M03: mixing bowl, FRONT layer (900 × 300, `M03-bowl-front.png`)
```
<STYLE BIBLE>
The FRONT layer of the same mixing bowl as M02 (attach M02 and match it exactly: same glaze, band, light, outline): only the part IN FRONT of the
liquid: the near lip of the rim (a thick rounded cream lip with the copper band) and the outside body below it down to the base. Everything above the
near lip is fully transparent (the inside of the bowl must be see-through, so the game's liquid shows). 900 x 300. It must line up with M02 when
placed with its top edge at y 220 of the 900 x 520 canvas.
```

### M04: bowl liquid MASK (900 × 520, `M04-bowl-mask.png`)
```
<STYLE BIBLE>
A MASK for M02: solid pure white (#FFFFFF) where liquid may show: the visible inside of the bowl, i.e. the interior ellipse of the rim, from the
far inner wall down to the near lip (but NOT over the near lip, NOT over the outside body). Same 900 x 520 canvas and the same ellipse as M02. Fully
transparent elsewhere. Hard clean edge.
```

### M05: saucepan, BACK layer (900 × 520, `M05-pan-back.png`)
```
<STYLE BIBLE>
A copper SAUCEPAN with a dark wooden handle, seen from the front and a little above, for hot sauces, drawn as TWO layers; this is the BACK layer:
the complete pan (far rim, inside wall, inside floor, outside body, the handle going out to the right and slightly up, a small pouring lip on the
left) as if empty and clean. Pan body 700 px wide, rim ellipse about 660 x 190 centered at (370, 200), handle reaching x 890. Transparent background.
The FRONT layer (M06) is placed with its top edge at y 220 of this canvas and has the same width. NO liquid, NO steam.
```

### M06: saucepan, FRONT layer (900 × 300, `M06-pan-front.png`)
```
<STYLE BIBLE>
The FRONT layer of the same saucepan as M05 (attach M05 and match it exactly): the near lip of the rim and the outside copper body below it, and the
part of the handle that is in front. The inside of the pan above the near lip is fully transparent. 900 x 300; lines up with M05 when placed with its
top edge at y 220.
```

### M07: saucepan liquid MASK (900 × 520, `M07-pan-mask.png`)
```
<STYLE BIBLE>
A MASK for M05: solid pure white (#FFFFFF) on the visible inside of the pan (the interior ellipse of the rim down to the near lip, not the near
lip, not the body, not the handle). Same 900 x 520 canvas as M05. Fully transparent elsewhere. Hard clean edge.
```

### M08: the whisk (512 × 768, `M08-whisk.png`)
```
<STYLE BIBLE>
A stainless-steel BALLOON WHISK, handle at the BOTTOM and the wire balloon at the TOP, seen from the front, upright, slightly tilted 10 degrees to
the right. A wooden handle with a steel ferrule, about 11 wires forming the balloon with soft highlights. Clean and EMPTY (no sauce on it).
The pivot point (where the hand holds it) is the middle of the handle at (256, 560). 512 x 768, subject about 85% of the height.
```

### M09: the wooden spoon (512 × 768, `M09-spoon.png`)
```
<STYLE BIBLE>
A long wooden cooking SPOON for stirring, handle at the BOTTOM and the round bowl of the spoon at the TOP, seen from the front, upright, slightly
tilted 10 degrees to the right, warm beech wood with a dark rim-wear and a small hanging hole in the handle. Clean and EMPTY (no sauce). The hand
point is the middle of the handle at (256, 560). 512 x 768, subject about 85% of the height.
```

### M10: the test spoon (384 × 640, `M10-test-spoon.png`)
```
<STYLE BIBLE>
A wooden spoon seen FROM ABOVE, handle pointing DOWN, the concave spoon head at the TOP: the head is an oval centered at x 192, y 170 that is
200 px wide and 240 px tall, the inside of the head is smooth empty wood (clean, no sauce), a tapering handle down to y 620. Warm beech wood, soft
outline and highlight. 384 x 640. The next asset (M11) is a set of sauce-coat shapes that are laid over exactly this oval.
```

### M11: spoon coat MASKS (sheet 5 × 1, each cell 256 × 256, sheet 1280 × 256, `M11-spoon-coats.png`)
```
<STYLE BIBLE>
A SHEET of 5 solid pure-white (#FFFFFF) MASK shapes (hard clean edge, no color) of how a sauce coats the oval head of the spoon M10, each centered
in its cell on the spoon-head center and fitting a 200 x 240 oval. The game tints them with the sauce color. Reading order: 1 RUNNY: a thin film
inside the oval with two long streaks running off the bottom edge; 2 LIGHT: an even thin film covering the oval, edges clean; 3 COATS: a smooth
even thick coat covering the whole oval with a rounded lip; 4 THICK: a heavy coat with a drooping glob hanging off the bottom edge; 5 PASTE: a stiff
mound standing up in the oval with a small peak. Transparent background.
```

### M19: FX sheet (4 × 4, each cell 256 × 256, sheet 1024 × 1024, `M19-fx.png`)
```
<STYLE BIBLE>
A SHEET of 16 small effects for liquids, drawn in NEUTRAL white and pale grey with soft alpha so the game can tint them with the sauce color.
Reading order: 1 a small droplet, 2 a medium droplet, 3 a big droplet (all with a bright highlight), 4 a tiny bubble, 5 a medium bubble with a
rim, 6 a cluster of three bubbles, 7 an OIL-SLICK ring (a thin glossy ring with a rainbow-less white sheen), 8 an OIL-SLICK blob (an irregular
glossy puddle), 9 a CURDLE clump, 10 a second curdle clump (different shape), 11 a third curdle clump (small bits), 12 a long soft SHINE streak
(a diagonal highlight), 13 a SWIRL streak (a curved flowing line of foam), 14 a SPLASH crown (drops thrown up in a ring), 15 a STEAM wisp (an S-curve,
very soft), 16 a small star GLINT (four-pointed sparkle). Each about 150-180 px in its cell, centered.
```

### M20: recipe card (560 × 760, `M20-recipe-card.png`)
```
<STYLE BIBLE>
A cream paper RECIPE CARD seen from the front, slightly curled corners, a small brass clip holding it at the top, a thin copper border, a faint
stain in a corner. In the upper middle a BLANK round window (a thin painted ring, EMPTY and transparent inside, about 200 px wide) where the game
shows the target colour. Below it three faint horizontal blank lines. NO text. The inside of the round window must be fully transparent.
560 x 760, transparent background around the card.
```

### M21: swatch holder (384 × 384, `M21-swatch-holder.png`)
```
<STYLE BIBLE>
A round PAINT-CHIP HOLDER: a thick brass-and-wood ring seen from the front, with two small tabs at the bottom, like a color sample window. The
INSIDE of the ring is fully transparent (the game shows a color there). A subtle glass highlight arc at the top-left over the ring only. 384 x 384.
```

### M22: whisk-speed dial (sheet 2 × 1, each cell 384 × 384, sheet 768 × 384, `M22-dial.png`)
```
<STYLE BIBLE>
A SHEET of 2 pieces of a round gauge: 1 the DIAL FACE: a brass-rimmed round gauge, cream face with tick marks around a 240-degree sweep and a
thin EMPTY arc track near the edge (no numbers, no colored zone: the game draws the green zone), a small center boss; 2 the NEEDLE: a slim red
needle pointing straight UP with a round brass pivot at the exact center of its cell (192, 192), the needle's tail slightly below the pivot.
The dial face and the needle pivot are centered the same way so the game can rotate the needle over the face.
```

### M23: emulsion meter (sheet 1 × 2, each cell 768 × 192, sheet 768 × 384, `M23-emulsion-meter.png`)
```
<STYLE BIBLE>
A SHEET of 2 images of a horizontal glass TUBE with brass end caps, seen from the front: 1 EMPTY: the glass tube with a faint inner shine and
small tick marks, nothing inside; 2 FULL: the SAME tube filled edge to edge with a creamy pale-gold liquid with tiny bubbles. Same size and position
so the game can reveal the full one with a clip as the emulsion grows. No text.
```

### M24: thickness gauge (256 × 640, `M24-thickness-gauge.png`)
```
<STYLE BIBLE>
A tall vertical glass viscosity TUBE with a brass cap on top and a brass foot, seen from the front, with five small tick marks on its right side
and a faint inner shine; EMPTY inside; a narrow EMPTY slot on its left side (a thin brass bracket) where the game puts a green target band. No
numbers, no text. 256 x 640.
```

### M25: wax seals (sheet 3 × 1, each cell 256 × 256, sheet 768 × 256, `M25-wax-seals.png`)
```
<STYLE BIBLE>
A SHEET of 3 round wax SEALS with a small raised droplet emblem in the middle (no text): 1 BRONZE (copper-brown wax), 2 SILVER (grey-blue wax),
3 GOLD (golden-yellow wax), each with a slightly irregular edge, a soft highlight at the top-left and a short ribbon tail. They are the match grade
badges. About 180 px wide each, centered.
```

---

## BATCH C: bottling

Attach: references 2, 3, 4. Files: B01, B02, B03, B04, B05, B06, B07, B08.

### BATCH PROMPT C
```
<STYLE BIBLE>
You are making the BOTTLING LINE for a sauce-making mini-game. Follow every ASSET block of this prompts file for batch C. Save each image into
D:\WORKS\GAMES\Knife Craft\Sauce Station Assets with the exact file name and size, PNG with a transparent background (except B01, a full scene).
Order: B03 (the bottles: they set the scale), B04, B05, B06, B07, B08, B02, B01 last. After each image check the ACCEPTANCE CHECKLIST; redo it if it
fails. LAYER RULES apply to B03 and B07 (the layers must line up exactly). When all are saved, list the file names and sizes.
```

### B03: empty BOTTLES, three layers (sheet 6 × 3, each cell 256 × 512, sheet 1536 × 1536, `B03-bottles.png`)
```
<STYLE BIBLE>
A SHEET of 6 EMPTY glass sauce bottles in THREE rows of layers that line up exactly (LAYER RULES): ROW 1 = BACK layer (the far inside wall and the
glass back with faint shading), ROW 2 = FRONT layer (the glass front: highlights, the rim, the thick bottom, the shoulder reflections; the middle
of the glass is see-through so the liquid shows), ROW 3 = interior MASK (solid pure white where liquid may fill: the inside of the glass from the
bottom up to just under the neck, hard clean edge). Columns, left to right, six shapes, each standing with its base at y 470 of its 512 px cell
and the same silhouette in all three rows: 1 CLASSIC SAUCE BOTTLE: tall, round shoulders, a narrow neck (neck inside 40 px wide); 2 SQUEEZE
BOTTLE: wide and soft, a short wide neck; 3 WIDE JAR: a short round jar with a wide mouth (mouth inside 120 px); 4 SWING-TOP BOTTLE: a stout bottle
with a swing-top wire clasp (open) and a wide-ish neck; 5 DRESSING CRUET: a slim tall bottle with a long very narrow neck (neck inside 26 px) and a
small pouring spout; 6 TASTING BOTTLE: small and short with a narrow neck (neck inside 34 px). Heights: 1 about 400 px, 2 about 330, 3 about 230, 4
about 360, 5 about 420, 6 about 250. Transparent background. NO liquid in any row.
```

### B04: CAPS (sheet 3 × 2, each cell 256 × 256, sheet 768 × 512, `B04-caps.png`)
```
<STYLE BIBLE>
A SHEET of 6 bottle closures seen from the front, each sized to close the bottle of the same number in B03 (1 classic, 2 squeeze, 3 wide jar, 4
swing-top, 5 cruet, 6 tasting): 1 a red screw cap (ridged side), 2 a flip-top nozzle cap in white (open spout up), 3 a flat gold twist lid with a
little pleat, 4 a swing-top ceramic-and-rubber stopper with a wire bail, 5 a cork stopper with a short cut spout, 6 a wax-dipped cork (red wax drip).
About 130-170 px wide each, centered.
```

### B05: blank LABELS (sheet 2 × 2, each cell 256 × 256, sheet 512 × 512, `B05-labels.png`)
```
<STYLE BIBLE>
A SHEET of 4 BLANK sticky bottle LABELS, flat, slightly curved at the edges as if just stuck, cream paper with a thin copper border and a tiny
shadow, NO text, NO pictogram: 1 a rectangle with rounded corners (200 x 130), 2 an oval (210 x 140), 3 a circle (170 x 170), 4 a ribbon banner with
swallow-tail ends (220 x 110). Centered.
```

### B06: jug, ladle, funnel (sheet 3 × 1, each cell 384 × 512, sheet 1152 × 512, `B06-pour-tools.png`)
```
<STYLE BIBLE>
A SHEET of 3 pouring tools, EMPTY and clean: 1 a copper-and-cream POUR JUG with a handle on the RIGHT and a clear pouring spout on the LEFT, seen
from the front and standing upright, wide round belly, about 320 px tall; 2 a long LADLE seen from the front with the cup at the bottom and the
handle going up and slightly right, about 440 px tall; 3 a stainless-steel FUNNEL, wide cone on top and a narrow short stem at the bottom, about
300 px tall. The game rotates the jug and the ladle to pour and draws the stream itself. Centered, bases on a common baseline 40 px above the bottom.
```

### B07: finished-bottle CRATE (sheet 1 × 2, each cell 900 × 450, sheet 900 × 900, `B07-bottle-crate.png`)
```
<STYLE BIBLE>
A pale-pine wooden CRATE for finished sauce bottles, seen from the front and a little above, in TWO layers that line up exactly (LAYER RULES), in the
SAME wood and brass style as public/business/inspection/crate-back.webp: ROW 1 = the BACK layer (the inside back wall, the two side walls, and a
2 x 3 grid of divider slats inside, so six bottles stand in six slots; the inside floor is plain straw), ROW 2 = the FRONT layer (the front slats and
the two front corner posts, a blank oval plate, rope handles, and the front tops of the dividers; the area above the front rim is fully
transparent). Both rows 900 x 450 and the same silhouette position. NO bottles inside.
```

### B08: SPILL splats (sheet 3 × 2, each cell 256 × 256, sheet 768 × 512, `B08-spills.png`)
```
<STYLE BIBLE>
A SHEET of 6 solid pure-white (#FFFFFF) MASK shapes (hard clean edge, no color; the game tints them with the sauce color): 1-4 four different
PUDDLE splats seen from above on a counter (irregular blobs with a few satellite drops, glossy highlights shown only as lighter transparent
gaps), 5 a long DRIP TRAIL running down (a thin streak ending in a round drop), 6 a short drip trail with two drops. Each about 190 px in its cell.
```

### B02: conveyor belt strip (1024 × 256, `B02-belt.png`)
```
<STYLE BIBLE>
A short section of a kitchen CONVEYOR BELT seen from the front and slightly above: a dark rubber belt with fine ribs across it, stainless-steel side
rails with rivets on the top and bottom edge, a soft shadow under the belt. It is SEAMLESSLY TILEABLE HORIZONTALLY: the left edge and the right edge
continue each other exactly (no end caps, no rollers visible). 1024 x 256, transparent background above the top rail.
```

### B01: backdrop, the bottling line (full scene, 1080 × 1920, `B01-backdrop-bottling.png`)
```
<STYLE BIBLE>
FULL SCENE (opaque, no transparency), portrait 1080 x 1920. A cozy restaurant BOTTLING CORNER seen from the front, slightly above: a stainless-steel
and wood counter in the lower middle with an EMPTY clear strip across it (a band about 1000 px wide and 330 px tall, from y 1100 to y 1430) where the
belt and bottles are drawn by the game; behind it a wall of green wainscot with shelves of finished sauce bottles in different colors (blurred, small),
a pegboard with hanging tools, a window on the left with warm morning light, a small chalkboard with NOTHING written. The upper 20% (y 0-380) is calm
and low-detail (the game puts the title, clock and buttons there); the area above the counter strip (y 380-1100) is calm so the pouring jug and
stream read clearly. NO people, NO text, NO bottles on the counter strip.
```

---

## BATCH D: collection and rewards

Attach: references 3, 4 and, for C02, your finished B03 and M12. Files: C01, C02, C03, C04, C05.

### BATCH PROMPT D
```
<STYLE BIBLE>
You are making the COLLECTION and REWARD art for a sauce-making mini-game. Follow every ASSET block of this prompts file for batch D. Save each
image into D:\WORKS\GAMES\Knife Craft\Sauce Station Assets with the exact file name and size, PNG with a transparent background (except C01, a full
scene). Order: C02 first (the 24 bottles set the look of the shelf), C03, C05, C04, C01 last. After each image check the ACCEPTANCE CHECKLIST;
redo it if it fails. When all are saved, list the file names and sizes.
```

### C02: the 24 sauce BOTTLE ICONS (sheet 6 × 4, each cell 256 × 256, sheet 1536 × 1536, `C02-sauce-icons.png`)
```
<STYLE BIBLE>
Attach B03-bottles.png and M12-pantry-bottles.png for the bottle shapes. A SHEET of 24 FILLED, CAPPED sauce bottles, one per sauce, each standing
(or, for jars, sitting) in its cell, front view, each with a small BLANK-colored label (no text) that may carry ONE tiny simple pictogram (a leaf, a
drop, a chilli, a tomato, a lemon, a pineapple, a mango...), the sauce visible through the glass in the exact color given, with a soft highlight.
Each about 170 px wide x 230 px tall in its cell, bases on a common baseline 22 px above the cell's bottom. Reading order, with the bottle shape
(from B03: classic / squeeze / jar / swing / cruet / tasting) and the sauce color:
1 TOMATO SAUCE: classic bottle, #C23A22, red label with a tomato.
2 LEMON DRESSING: cruet, #F0DE7C, yellow label with a lemon.
3 VINAIGRETTE: cruet, #D6B25A, golden label with a drop.
4 FRENCH ONION BASE: jar, #8A5A2B, brown label with an onion.
5 POTATO VELOUTE: jar, #EDE2C4, cream label with a leaf.
6 BECHAMEL: swing-top, #F4EFE0, white label with a drop.
7 BASIL PESTO: jar, #5E8C2F, green label with a basil leaf.
8 MAYONNAISE: squeeze, #F5EBC8, pale-yellow label with a drop.
9 GARLIC AIOLI: squeeze, #F1E4B6, cream label with a garlic clove.
10 CAESAR DRESSING: cruet, #E9DDB6, ivory label with a crown-less leaf.
11 RANCH: squeeze, #F3EFDF, blue-grey label with a drop.
12 CURRY PASTE: jar, #C9852E, orange label with a chilli.
13 ONION TOMATO MASALA: jar, #B5481F, red-brown label with a tomato.
14 GARLIC AND GINGER PASTE: jar, #D7C48A, tan label with a clove.
15 MANGO CHUTNEY: jar, #D88A1E, amber label with a mango.
16 MINT AND CILANTRO CHUTNEY: classic, #6EA83C, bright green label with a leaf.
17 HERB AND TOMATO BASE: jar, #B84A2C, red label with a leaf.
18 FRESH TOMATO SALSA: jar, #D9452B, red label with a tomato, visible chunks.
19 CORN AND TOMATO SALSA: jar, #DFA32A, yellow label with a corn cob, visible kernels.
20 PINEAPPLE SALSA: jar, #F0C94A, yellow label with a pineapple, visible cubes.
21 GUACAMOLE: jar, #7DA43C, green label with an avocado, visible chunks.
22 CHIMICHURRI: tasting, #50792B, dark-green label with a chilli.
23 SWEET CHILI: swing-top, #D5361F, red label with a chilli.
24 THAI BASIL SAUCE: classic, #4B3A1E, dark-brown label with a basil leaf.
```

### C03: empty slot and locked tag (sheet 2 × 1, each cell 256 × 256, sheet 512 × 256, `C03-slot-states.png`)
```
<STYLE BIBLE>
A SHEET of 2 pieces: 1 an EMPTY-SLOT silhouette: a soft dark, slightly transparent bottle-shaped shadow (170 x 230) as if a bottle is missing from the
shelf, with a faint dashed outline; 2 a LOCKED tag: a small wooden hanging tag with a brass padlock, string at the top, BLANK (no text). About 170 px
tall each, centered.
```

### C05: mastered badge and "new" burst (sheet 2 × 1, each cell 256 × 256, sheet 512 × 256, `C05-mastered.png`)
```
<STYLE BIBLE>
A SHEET of 2 pieces: 1 a golden "MASTERED" ribbon badge: a gold round medal with a droplet in the middle and a short red ribbon with swallow-tail
ends, no text; 2 a "NEW" starburst: a bright star-shaped sparkle burst with a warm orange glow and tiny sparks, no text. About 180 px each, centered.
```

### C04: 12 "Saucier" PINS (sheet 4 × 3, each cell 256 × 256, sheet 1024 × 768, `C04-pins.png`)
```
<STYLE BIBLE>
Attach public/business/stockroom/badge-01.webp and public/business/inspection/pins.webp for the exact enamel pin look: round metal rim, enamel
fill, a tiny pin highlight. A SHEET of 12 round enamel pins, each with a different small picture in the middle, no text, theme "the saucier".
Reading order: 1 a whisk, 2 a ladle, 3 a tomato with a drop, 4 a squeeze bottle, 5 a mortar and pestle, 6 a copper saucepan, 7 a chilli with a
sparkle, 8 a bowl with a swirl, 9 a bottle with a cork, 10 a golden drop, 11 a chef's hat over a bottle, 12 a crown over a whisk. Rim colors go from
copper (1-4) to silver (5-8) to gold (9-12). Each centered, about 78% of its cell. Transparent background.
```

### C01: the Sauce Shelf (full scene, 1080 × 1920, `C01-sauce-shelf.png`)
```
<STYLE BIBLE>
FULL SCENE (opaque, no transparency), portrait 1080 x 1920. A warm wooden WALL SHELF UNIT hung on a green painted wall, seen from the front,
holding a grid of 6 columns x 4 rows of EMPTY cubby slots (24 in all). Each cubby is a recessed wooden slot, the opening about 150 px wide and 240
px tall, with a small brass plate under it (BLANK, no text); the slot centers are at x = 115 + 170 x column (column 0 to 5) and y = 520 + 290 x row
(row 0 to 3), so a bottle icon from C02 sits exactly in each. A soft warm light from the top-left, a hanging copper ladle and a small trailing herb
plant at the top corners. The upper 20% (y 0-380) is calm and low-detail (the game puts its title there, above the shelf unit's top rail); the lower
15% (y 1640-1920) is plain wall (the game puts buttons there). NO bottles, NO people, NO text.
```

---

## ACCEPTANCE CHECKLIST (accept a piece only if every line is yes)

1. The exact file name and the exact pixel size asked.
2. A real transparent background (no white box, no painted checkerboard, no green or magenta fringe), except M01, B01 and C01 (full scenes).
3. NO text, letters, numbers or logos anywhere. Blank labels, tags, plates and cards stay blank (a tiny pictogram only where the asset says so).
4. The same painted family as the attached ingredient, crate and stockroom pictures: same line weight, same softness, same light direction.
5. It reads at small size: a pantry bottle at 64 px is still clearly "a bottle of that thing"; a spice bowl at 64 px is still clearly its spice.
6. Shared scale: the pantry bottles (M12), jars (M13), cartons (M14) and extras (M15) look right standing side by side (same table height, same
   light); the bowl M02/M03 is big enough that three pantry bottles would stand taller than its rim.
7. LAYER sets line up pixel for pixel when stacked: M02 + M03 (front's top edge at y 220), M05 + M06 (same), B03 rows 1-2-3, B07 rows 1-2. The
   masks (M04, M07, B03 row 3, M11, B08) are pure white on transparent with hard edges.
8. "EMPTY" pieces contain NO liquid (bowl, pan, bottles, measuring cup, jug, ladle, funnel, test spoon, meter tube).
9. Sheets: the exact grid, items centered at the same scale, nothing crossing into the next cell, no grid lines, cells in reading order.
10. Full scenes (M01, B01, C01): the upper 20% is calm; the working strip or the cubby grid is exactly where the prompt says and empty.
11. The 24 icons of C02 are clearly different from each other in color and label; each is the color in the list (within a small tolerance).
12. Nothing gory, nothing scary; the only things alive are none (no people, no animals).

## AFTER THE ART IS IN THE FOLDER
Tell me ("the sauce assets are in the folder"). I then: write `scripts/make-sauce-assets.py` (cuts the sheets, makes the masks 1-bit, WebP, ≤ 900 KB into `public/business/sauce/`), add the folder to `.gitignore`, and build the game from the plan (rules first, the art is not on the critical path).
