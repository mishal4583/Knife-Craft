# Dishwashing full screen: Codex art prompts (2026-11-09)

Source: `DISHWASHING-FULLSCREEN-PLAN-2026-11-09.md` §6 (the plan is the source; if a prompt changes there, rebuild this file).
**21 files** in three batches. Nothing in the plan's asset table is missing from this file (W01-W21, checked).

**Where the art goes:** `D:\WORKS\GAMES\Knife Craft\Wash Assets` (a new folder; create it if it does not exist). File names are exact (`W01-backdrop.png` …). Source art only (gitignored when it arrives).

**Do NOT draw:** the dishes (they stay inline SVG, painted ones are the older optional set), the stains and dirt (the game paints them), the sponge's position, text, buttons. The game draws all words.

## How to use

**Batches (recommended, Codex with file access).** One Codex conversation PER BATCH: attach the batch's reference images, paste the **STYLE BIBLE**, then the batch's **BATCH PROMPT**. Order: **A** (scene and water: it sets the look and the exact stage box), then **B** (effects sheets), then **C** (tools, props, rack, tray). 6-8 files each.
**One image at a time:** paste the STYLE BIBLE, then ONE asset block; ask for 4 variants; keep the best; attach it as the reference for the next.

**Reference files (in `D:\WORKS\GAMES\Knife Craft`):**
1. `public/dishwashing/premium-sink.webp` (the current sink: steel basin, bubbles, wood counter; keep this warm look, but portrait and bigger).
2. `public/business/inspection/backdrop.webp`, `crate-back.webp`, `magnifier.webp` and `public/business/fridge-sort/kitchen-wall.webp`, `hud-wide.webp`: the newest painted look (warm wood, brass, green wall).
3. `public/business/stockroom/spark-1.webp`, `puff-1.webp`, `ribbon-gold.webp`: sparkles, puffs, ribbons (the FX must match them).
4. `docs/planning/DISHWASHING-CODEX-PROMPTS-2026-11-07.md`: the older sink prompt (D1) for context only.

---

## STYLE BIBLE (paste at the top of EVERY request)

```
STYLE BIBLE — KnifeCraft "Dishwashing, full screen" art.
A warm, cozy, hand-painted mobile-game look in the same family as the attached KnifeCraft sink, kitchen and crate pictures: soft painterly shading,
gentle rim light, rounded chunky shapes, a thin darker outline in a warm brown (never pure black), rich but not neon colors, a cheerful rustic
restaurant kitchen with brushed steel, walnut wood, cream tile and brass. Light comes from the top-left, warm golden (about 3200 K), with a soft
shadow falling bottom-right. Everything must look like ONE set: same line weight, same softness, same saturation as the attached pictures.
Things must read at SMALL size on a phone: a bold silhouette, a bright highlight on the top-left, no tiny details.
WATER, SUDS AND FX: stylised and friendly (like a cozy cooking game), not photo-real: water is clear with a soft blue-green tint and bright
highlights; suds are white-cream with pastel bubble reflections; steam is soft and translucent. Every FX sprite is drawn in NEUTRAL white and pale
grey/blue with soft alpha so the game can tint and fade it.
STRICT RULES: NO text, NO letters, NO numbers, NO logos, NO brand names, NO watermarks, NO signature, NO people, NO hands, NO animals, NO dishes,
NO food, NO stains, NO UI chrome unless the asset IS the UI piece. Labels and windows stay BLANK.
Output: PNG with a TRANSPARENT background (alpha) unless the asset says "full scene". If transparency is not possible, use a flat pure chroma green
#00FF00 with no green anywhere in the subject and no shadow on the background (for green subjects use flat magenta #FF00FF and say so). Keep a 4%
margin round every subject. Deliver ONE image per request, exactly the size asked.
SHEET RULES (for sheets): the exact grid asked, each item centered in an equal cell at the same scale (about 78% of the cell unless the asset says
otherwise), transparent background, NO grid lines, NO labels, NO shadows crossing cells, cells in READING ORDER (left to right, top to bottom).
Keep every item inside its own cell. FRAME-STRIP RULES (for animation frames): the frames of one strip have the SAME size, the SAME anchor point
and the SAME overall shape, and they play as a smooth loop from the last frame back to the first.
LAYER RULES (for back / front pairs and the stage-aligned layers): every layer of one object has the SAME canvas size, the SAME silhouette and the
SAME position so the layers line up pixel for pixel when stacked.
```

---

## BATCH A: the scene and the water (do FIRST: it fixes the stage box)

Attach: references 1, 2, 3. Files: W01, W02, W03, W04, W05, W21.

### BATCH PROMPT A
```
<STYLE BIBLE>
You are making the SCENE of a dishwashing mini-game. Save every image into D:\WORKS\GAMES\Knife Craft\Wash Assets (create the folder) with the exact
file name and size given, PNG (transparent background except W01, a full scene). Order: W01 first (it fixes the STAGE BOX every other layer must
match), then W02, W03, W04, W05, W21. After each image check the ACCEPTANCE CHECKLIST at the end of
docs/planning/DISHWASHING-FULLSCREEN-CODEX-PROMPTS-2026-11-09.md; redo it if it fails. The STAGE BOX is the rectangle x 40-1040, y 400-1150 of the
1080 x 1920 backdrop (1000 x 750): W02 and W04 are drawn on a 1000 x 750 canvas that sits exactly on it. When all are saved, list the file names
and sizes.
```

### W01: the sink backdrop (full scene, 1080 × 1920, `W01-backdrop.png`)
```
<STYLE BIBLE>
FULL SCENE (opaque, no transparency), portrait 1080 x 1920, a commercial restaurant dish-wash corner seen from the front and a little above, in the
warm painted look of the attached current sink. Composition, top to bottom:
- y 0-190: cream-and-green subway-tile backsplash, calm and low-detail (the game puts its title bar here).
- y 190-400: the tile wall continues. A chrome SWAN-NECK TAP rises from behind the basin at the top center-left (its body from y 200, its spout curving
  over the basin and ending at about x 470, y 400 pointing DOWN); a coiled PRE-RINSE SPRAY HOSE with a steel head hangs at the top right (x 780-1000,
  y 220-400). Leave the area x 60-230, y 190-400 as plain tile wall (the game places a soap pump there).
- y 400-1150, x 40-1040 = THE STAGE BOX (1000 x 750): the big stainless-steel BASIN seen from slightly above, EMPTY, brushed steel floor with a faint
  wet sheen and a round chrome drain near its lower-middle (x 540, y 1050 in the full image), the thick steel RIM running round it (about 40 px). The
  inside of the basin (the rectangle x 80-1000, y 440-1110) must be CALM, evenly lit, with no strong highlights or objects, because the game paints
  a dish, water and suds here. NO water, NO bubbles, NO dishes inside.
- y 1150-1240: the steel front lip of the sink unit, then the wooden counter.
- y 1240-1700: an EMPTY walnut counter top with the tile wall behind it (the game puts a drying rack here: keep it plain and calm), a small folded
  blue-and-cream dish towel at the far right edge only.
- y 1700-1920: the plain dark-walnut front panel of the counter (the game puts buttons here).
NO people, NO hands, NO text, NO dishes, NO sponge, NO bubbles.
```

### W02: the basin water sheet (1000 × 750, `W02-water.png`)
```
<STYLE BIBLE>
A transparent layer for the STAGE BOX (1000 x 750, the exact rectangle x 40-1040, y 400-1150 of W01): a shallow sheet of clear, slightly soapy
blue-green WATER lying on the basin floor: a soft see-through tint (about 30% opacity) over the inner rectangle of the basin (x 40-960, y 40-710 of
this canvas), gentle caustic light patterns (bright wavy lines), a few big soft highlights near the top-left, and a darker, slightly thicker edge
where the water meets the steel walls. The water is calm and mostly transparent in the middle (a dish will lie there); NO bubbles, NO foam.
Everything outside the water is fully transparent. Same rectangle position as W01's basin interior.
```

### W03: seamless ripple tile (512 × 512, `W03-ripples.png`)
```
<STYLE BIBLE>
A SEAMLESSLY TILEABLE (left edge meets right edge, top meets bottom) 512 x 512 texture of soft water RIPPLES: thin pale-blue and white curved lines
and tiny glints, drawn in neutral white and pale blue with soft alpha (about 40% max), transparent background, no object, no foam. The game scrolls
it slowly over the water.
```

### W04: foam rim piles (1000 × 750, `W04-foam-rim.png`)
```
<STYLE BIBLE>
A transparent layer for the STAGE BOX (1000 x 750, same canvas rule as W02): thick white-cream SUDS piled along the inside edges of the basin (the
left wall, the right wall, the back wall and a thinner heap along the front), with pastel bubble reflections, soft shadows under the piles and a few
tiny bubbles floating at their edges. The CENTER of the canvas (x 190-810, y 130-620) is fully transparent (the dish area). Piles about 90-160 px
thick at the sides and corners. Same alignment as W02 so the layers stack.
```

### W05: foam tiles, three densities (sheet 3 × 1, each cell 512 × 512, sheet 1536 × 512, `W05-foam-tiles.png`)
```
<STYLE BIBLE>
A SHEET of 3 SEAMLESSLY TILEABLE (each cell tiles with itself on all four edges) 512 x 512 SUDS textures, white-cream bubbles with pastel
reflections and soft shadows between them, with soft alpha so the water shows through: 1 LIGHT: sparse small bubbles (about 20% coverage), 2 MEDIUM:
bubbles of mixed sizes (about 50% coverage), 3 HEAVY: dense overlapping bubbles with larger domes (about 80% coverage). The game cross-fades them
over the dish as the scrubbing progresses. Transparent background.
```

### W21: steam mist vignette (full screen, 1080 × 1920, `W21-mist-vignette.png`)
```
<STYLE BIBLE>
A full-screen transparent overlay, 1080 x 1920: a very soft, warm-white MIST that is strongest at the four corners and along the left and right
edges (about 35% opacity at the very edge, fading to fully transparent after about 200 px) with a few faint wisps near the top; the center and the
whole stage area (x 40-1040, y 400-1150) are completely transparent. No objects, no text.
```

---

## BATCH B: the effect sprites

Attach: references 1, 3. Files: W06, W07, W08, W09, W10, W11, W12.

### BATCH PROMPT B
```
<STYLE BIBLE>
You are making the WASHING EFFECTS for a dishwashing mini-game. Follow every ASSET block of this prompts file for batch B. Save each image into
D:\WORKS\GAMES\Knife Craft\Wash Assets with the exact file name and size, PNG with a transparent background. Order: W06, W07, W11, W12, W10, W08,
W09. After each image check the ACCEPTANCE CHECKLIST; redo it if it fails. Every FX is NEUTRAL white and pale blue-grey with soft alpha (the game
tints and fades it). Frame strips must loop. When all are saved, list the file names and sizes.
```

### W06: bubbles and pops (sheet 4 × 3, each cell 256 × 256, sheet 1024 × 768, `W06-bubbles.png`)
```
<STYLE BIBLE>
A SHEET of 12 soap-bubble sprites. ROW 1 (cells 1-4): four different complete soap BUBBLES, round, nearly transparent with a thin bright rim, a
large white window highlight at the top-left, a small one at the bottom-right and a faint pastel (pink, mint, sky) iridescent film, in four sizes (60,
90, 120 and 160 px across). ROW 2 (cells 5-8): four more bubbles, slightly squashed or oval, with different highlight shapes, 80-150 px. ROW 3
(cells 9-12): a 4-FRAME POP animation of one 140 px bubble: 9 the bubble stretched, 10 a ragged ring bursting, 11 tiny droplets flying out in a
circle, 12 a faint mist puff; the same center in all four (FRAME-STRIP RULES). Each centered in its cell.
```

### W07: droplets, splash crown, ripple ring, mist puff (sheet 4 × 2, each cell 256 × 256, sheet 1024 × 512, `W07-droplets-splash.png`)
```
<STYLE BIBLE>
A SHEET of 8 water effects, neutral white and pale blue, soft alpha. Reading order: 1 a small teardrop with a bright highlight (40 px), 2 a medium
teardrop (70 px), 3 a big teardrop (100 px), 4 a cluster of three droplets flying apart, 5 a SPLASH CROWN (a ring of thrown drops around a small
dip, seen from slightly above, 200 px), 6 a thin expanding RIPPLE RING (an ellipse, two concentric lines, 200 px wide), 7 a wider fainter ripple
ring (230 px), 8 a soft MIST PUFF (a round fluffy cloud, 160 px). Each centered, about 78% of its cell.
```

### W08: tap stream frames (sheet 6 × 1, each cell 128 × 512, sheet 768 × 512, `W08-tap-stream.png`)
```
<STYLE BIBLE>
FRAME-STRIP RULES apply. A SHEET of 6 frames of a STEADY STREAM of water falling straight DOWN from a tap, seen from the front: a slightly wavy,
glassy column about 44 px wide with bright side highlights and tiny air bubbles inside, starting at the very TOP of the cell (the tap's spout is
outside the image) and ending at the bottom with a small splash and a few droplets bouncing up. The frames are the same column in six moments (the
wave travelling down) so that frame 6 flows back into frame 1 as a loop. Neutral white and pale blue, soft alpha, transparent background.
```

### W09: rinse spray burst (sheet 3 × 2, each cell 256 × 256, sheet 768 × 512, `W09-rinse-spray.png`)
```
<STYLE BIBLE>
FRAME-STRIP RULES apply (reading order = play order, frame 6 flows into frame 1). A SHEET of 6 frames of the spray from a pre-rinse hose head seen
from the front: a FAN of thin water jets and droplets shooting from the top-center of the cell down and outward in a 70-degree cone, with white
streaks, tiny drops and a soft mist at the ends; the jets shimmer a little differently in each frame. The hose head itself is NOT drawn. Neutral
white and pale blue, soft alpha. Each frame anchored at the top-center of its cell, the spray reaching about 220 px down.
```

### W10: steam wisps (sheet 3 × 1, each cell 256 × 384, sheet 768 × 384, `W10-steam-wisps.png`)
```
<STYLE BIBLE>
A SHEET of 3 STEAM WISPS rising straight up: each a soft, translucent, S-curved plume that is narrow at the bottom, widens and fades toward the top,
white at about 40% maximum opacity, no hard edges. Three different curves. Each fills about 85% of its cell's height, bottom-center anchored.
```

### W11: glints and sparkles (sheet 4 × 1, each cell 128 × 128, sheet 512 × 128, `W11-glints.png`)
```
<STYLE BIBLE>
A SHEET of 4 "SQUEAKY CLEAN" glints, bright warm-white with a faint gold edge, soft glow, no outline: 1 a four-pointed star glint with long thin
points, 2 a smaller star with a round bloom, 3 a diagonal shine STREAK (a long soft-edged diagonal highlight), 4 a tiny cross twinkle with three
dots. Match the sparkles of public/business/stockroom/spark-1.webp. Each centered, about 80% of its cell.
```

### W12: the "Squeaky clean" ribbon (640 × 180, `W12-clean-ribbon.png`)
```
<STYLE BIBLE>
A wide BLANK banner ribbon (no text), glossy turquoise-to-mint with a thin cream border, swallow-tail ends curling at both ends, a soft drop shadow
below and three small gold-white sparkles around it (top-left, top-right, bottom-right), in the same ribbon family as public/business/stockroom/
ribbon-gold.webp. The middle band (x 120-520, y 40-130) is plain and empty (the game writes the words). 640 x 180.
```

---

## BATCH C: tools, props, rack and tray

Attach: references 1, 2, 3. Files: W13, W14, W15, W16, W17, W18, W19, W20.

### BATCH PROMPT C
```
<STYLE BIBLE>
You are making the TOOLS, PROPS and RACK for a dishwashing mini-game. Follow every ASSET block of this prompts file for batch C. Save each image into
D:\WORKS\GAMES\Knife Craft\Wash Assets with the exact file name and size, PNG with a transparent background. Order: W16, W17, W18 (the rack: it sets
the scale), then W13, W14, W15, then W19, W20. After each image check the ACCEPTANCE CHECKLIST; redo it if it fails. W16 and W17 must line up
(LAYER RULES). Blank labels stay blank. When all are saved, list the file names and sizes.
```

### W16: drying rack, BACK layer (1000 × 420, `W16-rack-back.png`)
```
<STYLE BIBLE>
A chrome-and-wire DISH DRYING RACK seen from the front and a little above, drawn as TWO layers; this is the BACK layer: a long low tray with a
raised back rail, the 8 thin vertical wire dividers standing in a row (seen from the front, spaced about 100 px apart) rising to about 300 px, the
back of the plastic drip tray, a small drain spout at the right end. The slots between the dividers are EMPTY and see-through. 1000 x 420,
transparent background. The FRONT layer (W17) is placed with its top edge at y 200 of this canvas and has the same width.
```

### W17: drying rack, FRONT layer (1000 × 220, `W17-rack-front.png`)
```
<STYLE BIBLE>
The FRONT layer of the same drying rack as W16 (attach W16 and match it exactly): the front wire rail, the front lip of the drip tray with its soft
shadow, and the front feet. Everything above the front rail is fully transparent (washed dishes will stand between the dividers). 1000 x 220; lines
up with W16 when placed with its top edge at y 200 of the 1000 x 420 canvas.
```

### W18: cutlery cup (256 × 320, `W18-cutlery-cup.png`)
```
<STYLE BIBLE>
A tall stainless-steel CUTLERY CUP (a straight cylinder with a thin rolled rim and a perforated band near the bottom for draining), seen from the
front and a little above, EMPTY and clean, with a soft shadow. About 190 px wide and 250 px tall in the 256 x 320 canvas, centered, base 30 px above
the bottom.
```

### W13: cleaning tools (sheet 4 × 1, each cell 384 × 384, sheet 1536 × 384, `W13-tools.png`)
```
<STYLE BIBLE>
A SHEET of 4 cleaning tools seen from above at a slight angle, all about the same visual weight: 1 a SPONGE: a rounded yellow kitchen sponge with a
green scouring layer on its underside edge, clean and dry (240 x 180 px); 2 the same sponge, FOAMY: covered in white suds with a few bubbles on it;
3 a POT BRUSH: a round wooden-handled scrubbing brush with stiff bristles, handle pointing to the lower right (the head about 200 px wide); 4 a
SCOURING PAD: a round green-blue abrasive pad with a texture of fibres (190 px). Each centered, with a soft shadow bottom-right. Transparent
background.
```

### W14: dish-soap pump bottle (256 × 512, `W14-soap-pump.png`)
```
<STYLE BIBLE>
A clear-plastic DISH-SOAP PUMP BOTTLE, seen from the front: a rounded bottle full of pale-green translucent soap, a chrome pump head on top with a
curved spout pointing LEFT, a BLANK cream label wrap on the lower half (no text), and a narrow clear level WINDOW down its right side showing the
soap inside (the window is simply the clear bottle there). About 170 px wide and 440 px tall, centered, base 30 px above the bottom, soft shadow.
```

### W15: soap blobs (sheet 3 × 1, each cell 128 × 128, sheet 384 × 128, `W15-soap-blobs.png`)
```
<STYLE BIBLE>
A SHEET of 3 soap blobs, pale-green translucent with a glossy highlight and a few tiny bubbles: 1 a rounded glob (80 px), 2 a long squirt with a
curl (110 px), 3 a flattened splat (100 px). Each centered. Transparent background.
```

### W19: the "Up next" tray (1000 × 170, `W19-queue-tray.png`)
```
<STYLE BIBLE>
A shallow wooden TRAY seen from the front, a warm walnut rail with a thin brass edge, a darker recessed groove in the middle holding SIX round slots
(a recessed circle each, 88 px across, spaced 140 px apart, the first one (the "current" slot) a little larger, 104 px, and the sixth a little
smaller). The slots are EMPTY and BLANK (no icons, no numbers). The slot centers are at x = 130, 290, 430, 570, 710, 850 and y = 85. 1000 x 170,
transparent background around the tray.
```

### W20: slot states (sheet 3 × 1, each cell 128 × 128, sheet 384 × 128, `W20-slot-states.png`)
```
<STYLE BIBLE>
A SHEET of 3 round slot overlays (each 100 px across, centered), transparent in the middle so the game's icon shows through: 1 EMPTY: a thin
brass ring with a soft inner shadow; 2 CURRENT: a thicker golden glowing ring with a warm halo; 3 DONE: a green enamel ring with a small white CHECK
mark in the lower right and a soft glow. No text.
```

---

## ACCEPTANCE CHECKLIST (accept a piece only if every line is yes)

1. The exact file name and the exact pixel size asked.
2. A real transparent background (no white box, no painted checkerboard, no green or magenta fringe), except W01 (a full scene).
3. NO text, letters, numbers or logos anywhere; labels, windows, the ribbon band and the slots stay blank.
4. The same warm painted family as the attached sink, kitchen and crate pictures: same line weight, softness, light direction.
5. W01: the basin interior (x 80-1000, y 440-1110) is calm and empty; the tap spout, hose, tile wall, rack zone and counter front are exactly where
   the prompt says; the upper 190 px is calm.
6. W02 and W04 are on a 1000 x 750 canvas that matches the stage box; stacking them over W01 at (40, 400) looks like one basin; W04's center
   (x 190-810, y 130-620) is fully transparent.
7. W03 and the three tiles of W05 TILE seamlessly (check by placing four copies side by side: no visible seam).
8. W06-W11 are neutral white / pale blue with soft alpha (tintable); the frame strips (W08, W09, W06 row 3) loop and keep one anchor point.
9. W16 + W17 line up pixel for pixel (W17's top edge at y 200 of W16); the rack slots between the dividers are see-through.
10. W19's slot centers are at the given coordinates (x 130, 290, 430, 570, 710, 850; y 85) and the slots are empty.
11. Nothing scary: no hands, no dishes, no stains, no food, no animals.
12. Everything reads at small size (a bubble at 30 px is still a bubble; the sponge at 70 px is still a sponge).

## AFTER THE ART IS IN THE FOLDER
Tell me ("the wash assets are in the folder"). I then: write `scripts/make-wash-assets.py` (cuts the sheets, WebP, ≤ 700 KB into `public/dishwashing/`), add the folder to `.gitignore`, and wire the layers. The layout work (phase 1 of the plan) does not wait for the art.
