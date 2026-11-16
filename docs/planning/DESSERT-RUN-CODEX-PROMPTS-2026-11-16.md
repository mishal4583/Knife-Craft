# Dessert Run (the new Plating Belt): Codex prompts for the art (developer 2026-11-16)

> **STATUS 2026-11-16:** every batch (A to D, plus the optional second waiter) was delivered and built by `scripts/make-dessert-run-assets.py` into `public/business/dessertrun/`. `DR-puff` is not used yet.

**Decided by the developer 2026-11-16:** the mini-game is rebuilt and renamed **Dessert Run**; tiny waiters RUN from the kitchen up the aisle onto a dessert plate, take one piece at a time and
carry it to four seated guests; the desserts are a fixed gallery by tier, one hand-made mosaic each. Plan and demo: the artifact "Plating Belt Redo"; rules: it replaces
`PLATING-BELT-PLAN-2026-11-15.md` and `PLATING-BELT-CODEX-PROMPTS-2026-11-15.md` (that banquet-hall / belt-ring art is NOT used any more; do not make it).

## READ THIS FIRST: what Codex must NOT do

**Make IMAGES ONLY. Do NOT write, edit or "improve" any game code, test, config or document in the repo.** Do not touch `src/`, `scripts/`, `tools/`, `public/` or `docs/`.
Do not build a preview screen or a mini-game. Do not rename or move any existing file. (On 2026-11-15 Codex built a whole mini-game when it was only asked for pictures.)
Save every picture ONLY into `D:\WORKS\GAMES\Knife Craft\Dessert Run Assets\` with the exact file name below, then stop and report the file names and pixel sizes.
The developer then tells Claude, who converts and wires them in. **The dessert mosaics, the cubes, the speed button and every word and number are drawn by the game's code:
do not paint any of them.**

## How to run it

1. One Codex conversation per BATCH (A to D). Attach the REFERENCE IMAGES, paste the STYLE BIBLE, then the batch prompt.
2. Priority: **B (the waiters) first**, then A (the stage), then C (the guests), then D. The game works with plain shapes until a file arrives, so batches can come in any order.
3. After each batch, run the checklist at the end on every picture before moving on.

**Reference images to attach (all in `D:\WORKS\GAMES\Knife Craft`):**
- `Paige Cutout Assets\cutout-point.png`, `cutout-cheer.png`: THE LOOK OF OUR PEOPLE. Warm, illustrated, semi-realistic proportions, soft painterly shading, a teal waistcoat over a cream
  shirt, brown trousers and a brown belt with a brass buckle. The waiters must look like staff of the same restaurant.
- `Car Park Assets\car-blue.png`, `bus-green.png`: THE LOOK OF OUR OBJECTS. Glossy painted toy-like shapes seen from straight above, a thin DARK WARM-BROWN OUTLINE (never pure black),
  a soft bright highlight at the top-left, rich colours that are not neon.
- `public\restaurant-map\kitchen-upgrade-map-neighborhood-cafe.webp` and `public\business\carpark\car-park-backdrop.webp`: the room look (golden light, dark timber, brass, lanterns).

## STYLE BIBLE (paste at the top of EVERY request)

```
STYLE BIBLE: KnifeCraft "Dessert Run" mini-game. The exact look of the attached KnifeCraft pictures: warm hand-painted illustration with soft painterly shading, golden warm light,
polished brass and dark timber, a thin darker warm-brown outline around every shape (never pure black), rich colours that are not neon, a gentle top-left highlight.
PEOPLE look like the attached Paige cutouts: warm, friendly, semi-realistic illustrated proportions with a slightly enlarged head and big clear eyes, so a face still reads when the picture
is shown 40 pixels tall. NOT chibi, NOT a flat vector icon, NOT 3D plastic, NOT photographic.
OBJECTS look like the attached car-park pictures: glossy, chunky, simple readable shapes.
NO TEXT AT ALL anywhere: no letters, numbers, words, signs with writing, logos, brand names or watermarks. The game writes every word and number itself.
OUTPUT: PNG with the EXACT canvas size stated for each file and a TRANSPARENT background (real alpha) wherever the table says "transparent": no background, no floor, no cast shadow, no frame
(the game adds its own soft shadows). If true transparency is impossible, use a flat pure green #00FF00 background and say so (our key colour for the waiters is magenta, so green is safe).
Deliver ONE file per name, exactly the name asked. Cells of a sheet are equal, in the stated order, and nothing crosses into the next cell.
```

## THE KEY COLOUR (waiters only, very important)

The game needs ten colours of waiter: red, pink, orange, yellow, green, dark chocolate, milk chocolate, biscuit tan, cream, blue. Do NOT paint ten waiters. Paint ONE waiter whose
colour-coded parts use a MAGENTA KEY, and a script recolours it:

| Part | Paint it in the magenta ramp |
|---|---|
| the WAISTCOAT, the BERET (a small flat cap on the head) and the BOW TIE | shadow `#A000A0`, base `#FF00FF`, highlight `#FF99FF`; shade the folds and the top-left light with these three and the tones between them |

**NOTHING else in any picture may be pink, magenta, purple or violet**: the skin is warm tan, brown or peach with NO pink blush; the shirt is warm cream-white; the trousers are dark brown;
the shoes are dark brown; the gloves are cream-white. The outline around the waistcoat and the beret is the same dark warm brown as everywhere else (it is not magenta).

## BATCH B: THE RUNNING WAITERS (do this first)

Two sheets. THE SAME waiter in every cell: a friendly waitress or waiter (choose one, keep it for all cells), tidy dark-brown hair under the small beret, a cream shirt with rolled sleeves,
the key-colour waistcoat with two brass buttons, the key-colour bow tie, dark-brown trousers, a brown belt with a brass buckle, dark-brown shoes, cream-white gloves. The same proportions,
brightness and uniform in every cell. In every cell the feet touch the SAME baseline (94 % down the cell) and the body is centred on the SAME vertical axis (the cell's middle line), so
that frames swap without the figure jumping. The figure fills 86 % of the cell height. The camera looks from slightly above (a high three-quarter view), so the beret and shoulders are visible.

### B1. `DR-waiter-stand.png` (1024 x 256, transparent, 4 cells of 256 x 256, left to right)

```
<STYLE BIBLE> + <THE KEY COLOUR rule>
Make ONE sheet saved as DR-waiter-stand.png, 1024 x 256 px, transparent, 4 equal cells of 256 x 256, no grid lines. FRONT view of the same waiter in four standing poses:
1 READY: standing straight, a round silver serving tray held at hip height in one hand, a calm friendly smile.
2 WAITING: the same stance but hopeful and a little impatient: head tilted, one foot tapping, the tray held in front with both hands, eyebrows raised.
3 BOW: the job is done: bending forward in a polite bow, the beret held to the chest in one hand (the beret is still key colour), eyes closed in a happy smile.
4 CHEER: both arms up in joy, the tray tossed up beside the head (still visible), a big open-mouthed grin.
```

### B2. `DR-waiter-run.png` (1024 x 512, transparent, 4 columns x 2 rows of 256 x 256, reading order)

```
<STYLE BIBLE> + <THE KEY COLOUR rule>
Make ONE sheet saved as DR-waiter-run.png, 1024 x 512 px, transparent, 8 equal cells of 256 x 256 (4 across, 2 down), no grid lines. The SAME waiter, running, small and bouncy, a high
three-quarter view. A run cycle is TWO frames (A and B): in A the left foot is forward and the right arm swings forward, in B the opposite, the body bobbing slightly higher in B.
Row 1: cells 1 and 2 = RUN TOWARD THE VIEWER (running down the screen, FRONT view), frames A and B, a round silver tray tucked under one arm, empty hands otherwise.
       cells 3 and 4 = RUN AWAY FROM THE VIEWER (running up the screen, BACK view: the back of the head and beret, the back of the waistcoat with its strap), frames A and B, the tray tucked under the arm.
Row 2: cells 5 and 6 = CARRY TOWARD THE VIEWER (FRONT view, running down), frames A and B: the round silver tray held out FLAT in front at chest height with both hands, its top completely EMPTY
       (the game draws the dessert piece on it), the waiter looking proud and focused, leaning slightly back to keep the tray level.
       cells 7 and 8 = GRAB: a short pose pair seen from the FRONT, standing on the plate: 7 = bending forward and reaching down with one hand, the tray tucked under the other arm;
       8 = straightening up with the hand closed on a small invisible thing, a quick happy smile (do NOT draw the piece; the game draws it).
```

### B3 (OPTIONAL, later). `DR-waiter-b-stand.png` and `DR-waiter-b-run.png`

The same two sheets, same cell layout and same key-colour rule, for a SECOND waiter (a man with short curly hair and a small moustache) so the crew is not one clone. Only make these after the first
two are accepted. Attach B1 and B2 as the reference so the uniform and proportions match exactly.

## BATCH A: THE STAGE (seven files)

The game stage is a portrait 540 x 960 logical screen; the pictures are made at TWICE that size. From top to bottom the game places: a big round plate near the top, a wooden aisle
running down from the plate between two dining tables with guests, a serving cart in the aisle, a row of five waiter stands, and a wooden counter holding the queue of waiters.
Positions below are approximate: the game places each picture itself.

### A1. `DR-backdrop.png` (1080 x 1920, opaque)

```
<STYLE BIBLE>
Make ONE portrait picture saved as DR-backdrop.png, 1080 x 1920 px, NOT transparent: the floor and walls of a cosy restaurant dining room seen from slightly above, painted soft and slightly
out of focus so that bright game pieces stand out on top of it. Warm golden light, polished honey-coloured timber floor boards running up the picture, a dark warm wall strip across the top
7 % with softly glowing lanterns and a window, a darker timber skirting. LAYOUT: the CENTRE 70 % of the width must be QUIET (plain warm floor, soft light, NO bright details, NO furniture,
NO strong lines); keep every strong shape (lanterns, plants, a hat stand, a window) in the outer 12 % at the left and right edges and in the top 7 %. NO people, NO tables, NO plates, NO text.
The lower 36 % is a little darker and plainer (a counter is laid over it by the game).
```

### A2. `DR-plate.png` (1024 x 1024, transparent)

```
<STYLE BIBLE>
Make ONE picture seen from STRAIGHT ABOVE, saved as DR-plate.png, 1024 x 1024 px, transparent: a big round dessert plate, centred, a perfect circle whose outer edge is 96 % of the canvas
width. Cream-white porcelain with a soft glossy sheen, a wide hand-painted BLUE band (the blue of delft china, about #3F6FA6) just inside the edge, with a tiny repeating white leaf or dot
pattern in the band and a thin second blue line inside it. THE WELL (the inner circle, 82 % of the plate's diameter) is a plain, flat, slightly warm off-white surface with a very soft sheen
and NO pattern, NO food, NO crumbs, NO cubes: the game draws a mosaic dessert there. Thin dark warm-brown outline on the outer edge only. NO cast shadow, nothing outside the circle.
```

### A3. `DR-aisle.png` (256 x 512, transparent left and right of the runner, seamless top to bottom)

```
<STYLE BIBLE>
Make ONE picture seen from straight above, saved as DR-aisle.png, 256 x 512 px: a narrow polished wooden serving RUNWAY (a plank walkway) filling the middle 84 % of the width, with a thin
brass strip along each long edge and small brass studs every 64 px; outside the brass strips the picture is TRANSPARENT. Warm honey timber with a subtle grain and a faint worn path
down the middle. THE TOP EDGE AND THE BOTTOM EDGE MUST MATCH PERFECTLY so the picture repeats vertically with no visible seam. NO shadow, NO objects, NO text.
```

### A4. `DR-table.png` (640 x 320, transparent)

```
<STYLE BIBLE>
Make ONE picture saved as DR-table.png, 640 x 320 px, transparent: a long rectangular dining table for two, seen from a high three-quarter view (we see the top and the near side).
A white tablecloth with a deep BLUE border band (the same delft blue as the plate) that hangs down the near side, a folded napkin and a knife and fork laid at each of the TWO places,
a small glass of water at each place, one tiny posy in the middle. At each place the cloth is left PLAIN and EMPTY in an oval 26 % of the width wide and 22 % of the height tall
(centred at 25 % and 75 % of the width, 60 % of the height): the game draws a plate with the dessert there. The picture is LIT FROM STRAIGHT ABOVE and perfectly SYMMETRIC left to right,
so the game can mirror it for the other table. NO plates, NO food, NO people, NO text, NO shadow outside the table.
```

### A5. `DR-guest-plate.png` (256 x 128, transparent)

```
<STYLE BIBLE>
Make ONE small picture saved as DR-guest-plate.png, 256 x 128 px, transparent: a single oval dessert plate seen from a high three-quarter view (matching DR-table.png), cream-white
porcelain with a thin blue band, the well plain, flat and EMPTY (the game piles dessert pieces on it). Dark warm-brown outline. NO cast shadow.
```

### A6. `DR-cart.png` (256 x 256, transparent)

```
<STYLE BIBLE>
Make ONE picture saved as DR-cart.png, 256 x 256 px, transparent: a small brass-and-timber SERVING TROLLEY seen from a high three-quarter view, two little wheels, a brass push-rail
along the back, a flat round brass tray on top with its surface plain and EMPTY and a little glass cloche (dome) standing OPEN beside it. The top of the trolley is where the waiters
hand over the dessert pieces, so keep its top surface clear and bright. Centred, filling 86 % of the canvas, dark warm-brown outline, NO shadow, NO text.
```

### A7. `DR-spot.png` (512 x 256, transparent, 2 cells of 256 x 256)

```
<STYLE BIBLE>
Make ONE sheet saved as DR-spot.png, 512 x 256 px, transparent, 2 equal cells of 256 x 256: a waiter's STANDBY SPOT seen from a high three-quarter view, a round recessed timber pad
in a brass ring, 84 % of the cell width, with a plain flat middle where a waiter stands (the game draws the waiter).
1 EMPTY: the pad is dark, calm and slightly sunken, no glow.
2 TAKEN: exactly the same pad, now lit: a warm golden glow inside the brass ring and a soft glowing rim, as if "in use". Same shape and position in both cells.
```

### A8. `DR-counter.png` (1080 x 640, transparent above its top edge)

```
<STYLE BIBLE>
Make ONE picture saved as DR-counter.png, 1080 x 640 px: the front of a long timber service counter seen from slightly above, filling the picture from its top edge to the bottom. Everything
ABOVE the counter's top edge is TRANSPARENT (the top edge is a gently rounded rim, not a straight cut). A polished brass strip runs along the top (the first 4 % of the height). Rich walnut with a
subtle grain and a soft golden light. TWO plain areas, with NO objects, NO slots, NO dots, NO text:
 - the STAND SHELF, from 8 % to 38 % of the height: a lighter honey-timber band across the full width.
 - the QUEUE TRAY, from 42 % to 96 % of the height, 3 % to 97 % of the width: a rounded dark-brown padded-leather recess with a thin brass border, plain and calm.
The picture is perfectly horizontal and symmetric left to right. The bottom 20 % is plain timber that the game may stretch downward.
```

## BATCH C: THE GUESTS

### C1. `DR-guests.png` (1024 x 768, transparent, 4 columns x 3 rows of 256 x 256)

```
<STYLE BIBLE>
Make ONE sheet saved as DR-guests.png, 1024 x 768 px, transparent, 12 equal cells of 256 x 256 (4 columns, 3 rows), no grid lines. FOUR different restaurant GUESTS (the columns), each in THREE moods
(the rows). Each guest is seated at a table seen from the FRONT, a high three-quarter view: we see the head, neck, shoulders and the upper arms only; THE FIGURE IS CUT OFF CLEANLY BY A STRAIGHT
HORIZONTAL EDGE at 78 % of the cell height, as if the rest of the body were hidden behind a table (below that line the cell is transparent). The head is centred at 40 % of the cell height and is
about 38 % of the cell width. The same guest in a column has the same face, hair, clothes and size in all three rows.
Columns: 1 a grandmother with white curly hair and round glasses, a lilac cardigan over a cream blouse; 2 a boy of about 9 with a green baseball cap and a striped t-shirt;
3 a man with a short beard and a rust-orange jumper, a napkin tucked into his collar; 4 a woman with long auburn hair in a side plait and a denim jacket over a yellow top.
(Their clothes may be any colour EXCEPT magenta and pink-violet.)
Rows (moods): 1 HUNGRY: hopeful wide eyes, looking up at the food, hands waiting; 2 EATING: eyes happily closed, cheeks a little full, a small blissful smile; 3 DELIGHTED: eyes sparkling,
a huge open grin, hands clasped under the chin, cheeks rosy. NO hearts, NO sparkle symbols, NO text (the game draws those).
```

## BATCH D: THE RESULT PICTURES AND A SPARK

```
<STYLE BIBLE>
Make these pictures, transparent background, the same warm painted look, bold simple shapes that read when small.
```

| File | Canvas | The picture |
|---|---|---|
| `DR-win.png` | 768 x 576 | A happy ending: four guests around a table clapping (the same four guests as DR-guests.png), the waiters of the crew (the same waiter, in a RED, a GREEN and a BLUE waistcoat and beret) bowing beside them, a clean empty plate with a gold rim in the middle of the table. Warm celebratory feeling. NO confetti text, NO words. |
| `DR-jam.png` | 768 x 576 | A funny, cute "kitchen jam": five of the crew (in five different waistcoat colours, the same waiter drawing) squeezed together in a narrow aisle, each holding an empty tray and looking worried and a little cross-eyed, one fanning himself with a menu card (blank), a tiny steam puff above. No words. |
| `DR-sparkle.png` | 256 x 256 | A bright four-point golden sparkle star with a soft glow and two tiny stars beside it, for a dessert piece being handed over. |
| `DR-puff.png` | 256 x 256 | A soft white-cream puff of dust with a tiny golden fleck, for a piece being taken off the plate. |

## Checking every picture before saving it

- It is the picture for that file name, in the SAME warm painted look as the Paige cutouts and the car-park pictures, with a clean readable silhouette at 40 px.
- **Waiters:** the waistcoat, the beret and the bow tie are painted ONLY in the magenta ramp `#A000A0`, `#FF00FF`, `#FF99FF`; NOTHING else is pink, magenta or purple; the feet sit on the same baseline in
  every cell; the body is on the same middle line; the SAME person in every cell; the tray is flat and EMPTY wherever the prompt says "empty".
- **The plate:** a perfect circle, centred, the well plain. **The aisle:** the top and bottom edges match. **The table:** symmetric, the two place ovals plain. **The counter:** transparent above its edge.
- **The guests:** cut off by a straight line at 78 % of the cell; the same person down each column; no pink hearts.
- Transparent where required, exact canvas size, NO text anywhere, NO shadow baked in (except the glow in `DR-spot.png` cell 2).
- A figure or object fits fully inside its cell with a small margin.

## What the build script does (Claude, when the first files arrive)

`scripts/make-dessert-run-assets.py` (new): reads `Dessert Run Assets/*.png`; for the waiters it maps the magenta ramp to a three-tone ramp of each game colour
(red `#D8453C`, pink `#F4A3B5`, orange `#E7892F`, yellow `#F5D463`, green `#5BA845`, dark chocolate `#6A3F28`, milk chocolate `#A8683F`, tan `#DDAE6C`, cream `#FFF1D6`, blue `#4B58AA`), cuts the
cells, scales to 128 px per frame, and writes WebP sprite strips into `public/business/dessertrun/` (about 20 KB per colour sheet). The backdrop becomes 720 x 1280 WebP under 200 KB, the plate 768 x 768,
the table 320 x 160, the counter 720 x 427. The whole set stays under about 1.3 MB. The game uses a picture when its file exists and plain shapes when it does not, so nothing breaks while files are missing.
