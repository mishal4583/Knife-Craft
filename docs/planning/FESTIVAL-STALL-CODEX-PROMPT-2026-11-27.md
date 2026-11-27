# Codex art prompt: the Burger Festival stall (2026-11-27)

The stall is built in the game from the existing art, plus a few pieces drawn by code (the sign, the chalkboard, the lamps, the counter rails and
the cloth). These pictures replace the code-drawn and borrowed pieces so the screen matches the concept more closely. **Nothing is blocked
without them.** When the files arrive, Claude cuts them with `scripts/make-festival-assets.py` and swaps them in.

Copy everything below into Codex.

---

## TASK: paint the parts of a festival burger stall (art only, no code)

**Reference:** `Festival competition assets/reference/stall_concept.png`. Match its warm sunset food-fair look, its painted 3D-cartoon style,
and the materials: glossy honey wood, brushed steel, cream and red enamel. Also match the existing kit in
`Festival competition assets/01_burger_festival/`.

**Save to:** `Festival competition assets/stall/`, using exactly the file names below.

### Rules for every picture

1. **One object per file.** No collages, sheets, labels or mock-ups.
2. **PNG with a real alpha channel.** The background is fully transparent: never white, grey or a painted checkerboard. Only the three
   "TILE" strips fill their whole canvas.
3. Leave at least **16 px of empty space** on every side. The object is whole and never cropped by the canvas edge, except the lamp cord and
   chalkboard chains, which must reach the **top edge**.
4. **No text, letters, numbers, logos or watermarks.** The game writes every word itself.
5. **One camera for everything:** seen from the front, looking down about 35°, with no tilt or rotation. Ellipses (plates, burner rings,
   pan rims) must have the same flatness across all files.
6. **One light:** warm key light from the top left, with an orange sunset rim from behind. No cast shadow on the ground (the game adds
   shadows), but keep the object's own shading.
7. Crisp edges, with no glow halo or fringe around the cut-out.

### A. Ingredient pans (12 files, all 900 × 600)

All twelve use **the same stainless steel pan**: the same size, shape, angle and position on the canvas. Only the food differs, so a row of
them reads as one shelf. The food fills the pan generously and sits slightly above the rim.

| File | Food |
|---|---|
| `pan_bun.png` | sesame burger buns, whole and golden (3–4) |
| `pan_patty.png` | raw beef patties |
| `pan_chicken.png` | raw breaded chicken fillets |
| `pan_veggie.png` | raw veggie patties |
| `pan_cheese.png` | stacked cheese slices |
| `pan_lettuce.png` | fresh lettuce leaves |
| `pan_tomato.png` | tomato slices |
| `pan_onion.png` | red onion rings |
| `pan_pickles.png` | pickle slices |
| `pan_fries.png` | raw cut potato fries |
| `pan_ketchup.png` | the same pan holding two red squeeze bottles, upright |
| `pan_mustard.png` | the same pan holding two yellow squeeze bottles, upright |

### B. Cooking stations

| File | Size | What |
|---|---|---|
| `drink_cola.png` | 600 × 880 | tall black soda machine with a brown cola tank, a tap and a drip tray. The cup bay under the tap is **empty** (the game places the cup there, filling), and it sits in the lower half, centred |
| `drink_lemonade.png` | 600 × 880 | the same machine with a yellow lemonade tank and lemon slices; same canvas, size and baseline |
| `drink_shake.png` | 600 × 880 | pink milkshake machine, same canvas and baseline, cup bay **empty** |
| `fryer_empty.png` | 640 × 840 | steel deep fryer with golden oil, basket hanging on its side rail |
| `fryer_raw.png` | 640 × 840 | the **same fryer on the same canvas**, basket lowered into the oil with pale raw fries |
| `fryer_golden.png` | 640 × 840 | same, with golden crisp fries and a few oil bubbles |
| `fryer_burnt.png` | 640 × 840 | same, with burnt dark fries |
| `bin_steel.png` | 600 × 840 | small steel kitchen bin with a swing lid |
| `burner_cover.png` | 512 × 384 | a round steel cover over one burner ring, with a small closed padlock on top; its ellipse matches the rings of the current four-ring grill |
| `board_wide.png` | 1380 × 1040 | wide wooden assembly board with a juice groove, **empty** (plates are placed by the game) |

### C. Counter props (decoration)

| File | Size | What |
|---|---|---|
| `straws.png` | 360 × 480 | glass holder full of red-and-white paper straws |
| `cups_paper.png` | 360 × 480 | two stacks of red-and-white paper cups |
| `cups_clear.png` | 360 × 480 | two stacks of clear plastic cups with lids |
| `sauce_trio.png` | 520 × 480 | ketchup, mustard and mayonnaise squeeze bottles side by side, no labels |
| `salt_pepper.png` | 300 × 320 | salt and pepper shakers |
| `napkin_holder.png` | 360 × 360 | steel napkin holder with napkins |
| `utensils.png` | 480 × 360 | a spatula and tongs lying on a small cloth |
| `burger_boxes.png` | 520 × 420 | a stack of three kraft clamshell burger boxes |
| `planter.png` | 520 × 480 | wooden barrel planter with bright flowers |

### D. Stall decor

| File | Size | What |
|---|---|---|
| `sign_marquee_blank.png` | 912 × 600 | red marquee sign with lit bulbs and a gold rim, a big burger sitting on top. The red panel is **blank** and large enough for two lines of big text |
| `chalkboard_blank.png` | 792 × 732 | wooden-framed chalkboard hanging on two chains that reach the **top edge**; the board is blank dark slate |
| `lamp_pendant.png` | 300 × 560 | black enamel pendant lamp, lit, on a cord that reaches the **top edge** |
| `vine_corner.png` | 900 × 520 | leafy vine with pink, yellow and white flowers for the **top-left corner** (the game mirrors it for the right) |
| `gingham_cloth.png` | 400 × 860 | red-and-white checked cloth draped over the left end of a counter, falling in soft folds |

### E. Counter strips (TILE: opaque, full canvas)

Each must repeat **left to right with no visible seam**: the left and right edges match exactly.

| File | Size | What |
|---|---|---|
| `tile_wood_top.png` | 1080 × 904 | the honey-wood counter top and front planks, seen from the same camera, evenly lit with no objects on it |
| `tile_ledge.png` | 1080 × 96 | a raised wooden back ledge with a bright top lip and a darker underside |
| `tile_shelf_rail.png` | 1080 × 48 | the front rail of the ingredient shelf: a polished wooden edge with a thin gold highlight |

### Before delivering, check

- All **39 files** exist with exactly these names and sizes.
- The 12 pans line up when stacked on top of each other: same pan, same place.
- The 4 fryers line up the same way, and so do the 3 drink machines.
- No file has any text, a painted background or a cropped object.
- Each TILE strip, placed beside itself, shows no seam.

Make a contact sheet `Festival competition assets/stall/_preview.png` that shows every file on a dark grey background with its name under it.
The sheet is for review only.
