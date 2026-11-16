# Delivery Inspection: clearer "not fresh" and "just dirt" marks, Codex art prompts (2026-11-16)

**Why:** the developer could not tell dirt from fungus in the crate (screenshots 2026-11-16: a broccoli with a green tick after a wrong tap), and wants every
not-fresh kind to look properly spoiled. The game code is already changed (the guide chart, the names on a tap, a dark rim on every bad mark). What is left
is the PAINTING of the two mark sheets: the first set (D04, D05 of `DELIVERY-INSPECTION-CODEX-PROMPTS-2026-11-08.md`) has a brown dirt smear that looks a lot
like brown rot, and a white mold that disappears on pale food (broccoli, onion, mushroom).

## READ THIS FIRST — what Codex must NOT do

**Make IMAGES ONLY. Do NOT write, edit or "improve" any game code, test, config or document in the repo.** Do not touch `src/`, `scripts/`, `tools/`,
`public/` or `docs/`. Do not build a preview screen. Do not rename or move any existing file. (On 2026-11-15 Codex built a whole mini-game when it was
only asked for pictures; that cost a day of review.) Save the new images ONLY into `D:\WORKS\GAMES\Knife Craft\Delivery Inspection Assets\` with the exact
names below, then stop and report the file names and sizes. The developer will tell Claude, who converts and wires them in.

## What to make (two sheets, same grids and same order as before, so nothing in the game has to change)

| File (exact) | Size | Grid | Replaces |
|---|---|---|---|
| `D04v2-defects.png` | 1024 x 768, transparent | 4 x 3, cells of 256 | `D04-defects.png` |
| `D05v2-decoys.png` | 768 x 512, transparent | 3 x 2, cells of 256 | `D05-decoys.png` |

**Reference files (attach or open; all in `D:\WORKS\GAMES\Knife Craft`):**
1. `Delivery Inspection Assets\D04-defects.png` and `D05-decoys.png`: the CURRENT sheets. Keep their painted look, line weight and cell order; change what is listed below.
2. `public\business\ingredients\` : `broccoli.webp`, `tomato.webp`, `potato.webp`, `onion.webp`, `mushroom.webp`, `carrot.webp`, `lettuce.webp`, `apple.webp`: the foods the marks are laid on. Test every cell on a RED one (tomato), a PALE one (broccoli, onion) and a BROWN one (potato).
3. `public\business\ingredients-spoiled\` : the painted spoiled twins; the new marks must feel like the same family of "gross".

## THE ONE RULE: a bad mark and a harmless mark must never share a colour, a texture or an edge

The player has about one second per ingredient on a 65 px picture. So the two groups are split by three cues they can read without thinking:

| | NOT FRESH (D04v2) | HARMLESS (D05v2) |
|---|---|---|
| **Texture** | fuzzy, wet, glossy, slimy, sunken, cracked or holed: it looks like it is ALIVE or ROTTING | flat and matte, dry, crumbly or clear: it looks like it can be WIPED OFF |
| **Edge** | a DARK rim all round (deep olive-green, dark brown or near-black, 2 to 3 px at the sheet's size) so it separates from any food colour | NO rim, NO outline; the edge is crumbly or soft and just stops |
| **Colour** | greens, blue-greens, white-fuzz-on-dark, wet dark brown, yellow-green slime, purple-grey | neutral GREY-BROWN dirt, clear blue-white water, pale cream, light tan, one plain green leaf. **Never** the warm red-brown or wet black of rot; **never** green fuzz or white fuzz |

Everything must still read at 48 px (squint test below).

## STYLE BIBLE (paste at the top of the request)

```
STYLE BIBLE — KnifeCraft "Delivery Inspection" mark sheets, version 2.
Same warm, cozy, hand-painted mobile-game look as the attached KnifeCraft ingredient pictures and the current D04/D05 sheets: soft painterly shading,
gentle rim light from the top-left, rounded chunky shapes, rich but not neon colours. Friendly-gross like a cozy cooking game: never gore, never
photo-realistic, never worms or insects. Each mark is ONE blotch that the game lays on top of any ingredient picture, so it must look right on a red
tomato, a green leaf, a pale broccoli, a yellow potato and a white mushroom alike. Transparent background (alpha), NO grid lines, NO labels, NO text,
NO numbers, NO logos, NO watermark, NO ingredient drawn in the cells. Each mark is centred in its own 256 x 256 cell at about 78 % of the cell (the
harmless ones at about 70 %), nothing reaches into the next cell. Cells are in READING ORDER (left to right, top to bottom).
```

## D04v2: 12 NOT FRESH marks (`D04v2-defects.png`, 1024 x 768, 4 x 3)

```
<STYLE BIBLE>
A SHEET of 12 transparent "spoiled" marks. Same order as the current D04. Every mark has a DARK RIM and strong light/dark contrast. Change from the
current sheet: bolder, more raised and more clearly gross, so none of them can be mistaken for dirt. Reading order:
1  WHITE MOLD: a raised cotton-wool clump of white fuzz with a grey-green spore dot cluster in the middle, and a DARK OLIVE-GREEN shadow rim and shadow
   under it, so it stands out on pale food. (The old one was pure white and vanished on broccoli.)
2  BLUE-GREEN MOLD: fluffy velvet blue-green balls, a white fringe, a dark green core; saturated; dark teal rim.
3  BLACK MOLD: a dense cluster of black dots (some large, some tiny) on a faint grey-green haze, a dark rim around the haze; it must NOT look like soil crumbs:
   the dots are round, glossy and in a tight round patch.
4  GREY FUZZ: dusty grey-lilac fuzz with cobweb strands reaching outward, darker grey core, dark grey rim.
5  WET ROT: a dark brown sunken, glossy, dripping patch with a bright wet highlight and a yellow-green halo; very wet-looking.
6  BLACK ROT: an almost black collapsed, concave patch with a thin yellow-green halo and a glossy edge.
7  BRUISE: a brown dented soft patch with 2 to 3 concentric darker rings and a glossy centre, translucent soft rim.
8  PURPLE BRUISE: a purple-grey dented patch with small dark speckles and concentric rings.
9  WILT: a limp curved band of yellow-brown, dried, curled edge with a dark brown rim (it lies along a leaf's edge).
10 SLIME: a bright yellow-green glossy slime patch with big white highlights, tiny bubbles, one fat drip running down, a darker green rim.
11 PEST HOLES: seven round holes, each with a dark inner shadow, a brown rim and a few green-brown crumbs (frass) beside it. Larger than before.
12 DRY SHRIVEL: a deeply cracked, wrinkled, leathery brown patch with dark crack lines and a darker rim.
Transparent background.
```

## D05v2: 6 HARMLESS marks (`D05v2-decoys.png`, 768 x 512, 3 x 2)

```
<STYLE BIBLE>
A SHEET of 6 transparent "harmless mark" stickers: what a clean, fresh vegetable really has. They must look DRY, FLAT and WIPE-OFF-ABLE: matte, no gloss
(except the water drop), NO dark rim, NO outline, NO fuzz, NO wet black, NO halo, NO green or white fluff, and NO warm red-brown (that colour belongs to
rot). Same order as the current D05. Reading order:
1  DIRT: a dry, crumbly smear of NEUTRAL GREY-BROWN garden soil (about #8a7a66 to #6e6050): a flat smudge with 5 to 7 small round gritty crumbs of different
   sizes lying on it and 3 to 4 loose grains beside it. Matte. Light grey crumb highlights. It must look like dust you can brush off, never like a dent or a
   wet spot. Clearly lighter and greyer than the rot on the other sheet.
2  WATER DROP: one clear blue-white drop with a bright highlight and a thin pale rim (no dark outline).
3  SCUFF: a faint pale scratch mark, two thin light lines, very low contrast.
4  FRECKLES: five to seven small round tan dots of slightly different sizes, like the dots on a pear, matte.
5  SUN SPOT: a soft pale warm round glow, slightly lighter than the food, with a feathered edge.
6  LEAF BIT: one small flat green leaf fragment with a short stem, stuck on, with a single soft shadow.
Transparent background.
```

## ACCEPTANCE CHECKLIST (look at every cell, redo what fails)

1. **Squint test:** shrink each sheet to 25 % (a 64 px food gets a mark of 20 to 40 px). The six harmless marks must still look clean and flat; the twelve bad ones must still look
   "off". If DIRT (D05v2 cell 1) and WET ROT or BRUISE (D04v2 cells 5 to 8) can be confused at that size, redo DIRT lighter and greyer.
2. **Grayscale test:** in black and white, every bad mark must show a dark rim and a fuzzy, glossy or sunken look; every harmless mark must show no rim.
3. **Pale-food test:** put cell 1 and cell 2 of D04v2 on `broccoli.webp` and `onion.webp`. They must be clearly visible (the dark olive rim does that). If not, darken the rim.
4. **No overlap:** nothing crosses a cell edge; the background is fully transparent; no grid lines; no text anywhere.
5. **Family:** the line weight and softness match the current sheets and the painted ingredients; nothing is photo-real.
6. **Files:** exactly `D04v2-defects.png` (1024 x 768) and `D05v2-decoys.png` (768 x 512), both RGBA, in `Delivery Inspection Assets`. No other file changed.

## After Codex (for the developer and Claude, not for Codex)

Tell Claude "the v2 mark sheets are in the folder". Claude will: run `scripts/make-inspection-assets.py` with the two new names (it halves them to 512 x 384 and 384 x 256 webp
in `public/business/inspection/`), look at them in the crate at 320, 390 and 430 px, and re-run `delivery-inspection-qa` and `tools/e2e/deliveryinspection.mjs`. The cell order is
the same, so no game code changes. Nothing ships until the developer has looked at the crate on a real phone.
