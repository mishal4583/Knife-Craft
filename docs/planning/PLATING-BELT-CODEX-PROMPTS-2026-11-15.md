# Plating Belt (Banquet Waiters): Codex prompts for the art (developer 2026-11-15)

The game: `PLATING-BELT-PLAN-2026-11-15.md`. A portrait mini-game: a **buffet platter** drawn as a mosaic of food cubes, a **round conveyor belt** around it, a team of coloured
**banquet waiters** who ride the belt and carry away the cubes of their own colour, and **five waiting tables** for waiters that cannot collect yet.
The concept picture the developer gave is the MOOD and LAYOUT reference only: it shows text, a timer, side panels and a level badge that the game draws itself (or does not have).

## How to run it in Codex

1. One Codex conversation per BATCH (A to D). Attach the **reference images**, paste the **STYLE BIBLE**, then the **BATCH PROMPT**.
2. Codex saves each picture as `Plating Belt Assets/<name>.png` with the exact name in the tables.
3. Tell me; I run `py scripts/make-plating-belt-assets.py` (written when the first files arrive), build, and check the pictures on a phone-sized screen.
4. The game works with plain shapes until a file arrives, so batches can come in any order. Priority: **A (the stage), then B and C (the eight waiters), then D.**

Attach as references:
- the developer's concept picture (the mood: a warm banquet hall, a wooden counter, chibi waiters in coloured berets, a gold-rimmed round platter), **layout and mood only, copy none of its text**;
- `public/business/carpark/car-park-backdrop.webp` and `public/restaurant-map/kitchen-upgrade-map-neighborhood-cafe.webp` (the painted look of the game: golden light, dark timber, lanterns, soft painterly shading);
- for the waiters, one of the Paige pictures in `public/people/` or `Paige Cutout Assets/` (the proportions and warmth of our cast).

## THE EIGHT COLOURS (the game uses EXACTLY these; every colour-coded picture must match them)

| Colour | Hex | Food it stands for | Hat and waistcoat |
|---|---|---|---|
| red | `#D9392B` | tomato, red pepper, sauce | red |
| orange | `#F28C28` | carrot, pumpkin, salmon | orange |
| yellow | `#F4C430` | cheese, corn, lemon | yellow |
| green | `#4C9A2A` | herbs, lettuce, cucumber | green |
| brown | `#8B5A2B` | bread, mushroom, meat | brown |
| purple | `#7B4BA3` | aubergine, onion, berries | purple |
| cream | `#F6F0E4` | the plate, cream, mozzarella | white (a tall white toque) |
| grey | `#8E8A86` | the plate's shadow, pepper | silver-grey |

## STYLE BIBLE (paste at the top of EVERY request)

```
STYLE BIBLE: KnifeCraft "Plating Belt" mini-game. A warm, cozy, hand-painted mobile-game look, exactly the family of the attached restaurant map and car-park backdrop: rich golden warm
light, dark timber and polished brass, glowing lanterns, soft painterly shading, gentle rim light, a thin darker warm-brown outline (never pure black), chunky rounded toy-like shapes, glossy
paint with a bright top-left highlight, rich candy colours that are not neon. Friendly, polished, premium-casual, like a top mobile puzzle game. NOT photographic, NOT 3D-render plastic, NOT flat vector.
The characters are CHIBI: a big round head (about 45 % of the figure), small body, simple hands, big expressive eyes, readable at 56 px wide on a phone.
NO TEXT AT ALL anywhere: no letters, numbers, words, signs with writing, logos, brand names or watermarks. The game writes every word and number itself. Do NOT copy the text, the timer, the
level badge or the side panels of the concept picture.
OUTPUT: PNG, the exact canvas size stated for each file, TRANSPARENT background where the table says "transparent" (real alpha, no background, no ground, no cast shadow, no frame). If true
transparency is impossible use flat pure green #00FF00 (magenta #FF00FF for green subjects) and say so. Deliver ONE image per file, exactly the file name asked.
```

## BATCH A: the stage (5 files)

### A1. `plating-backdrop.png` (1080 x 1920, opaque)

```
Make ONE portrait image of an elegant banquet hall seen from slightly above, saved as plating-backdrop.png, 1080 x 1920 px, NOT transparent. Warm golden-hour candlelight, a crystal chandelier
at the top, round tables with white cloths and candles, tall windows, soft flower arrangements (pink and white), warm wooden floor, a few softly BLURRED diners far away (no sharp people,
no faces). The whole picture is painted soft and slightly out of focus, like a shallow depth of field, so that bright game pieces stand out on top of it.
LAYOUT (percentages of the picture): the CENTRE of the picture, a circle about 80 % of the width centred at 42 % of the height, must be QUIET: an empty warm-lit space of floor and soft
blurred tables with NO bright details, NO table in the middle, NO strong lines (the game places a big platter there). The TOP 9 % stays dark and calm (the game puts its title there).
The BOTTOM 33 % is a darker warm wooden floor, quiet and plain (the game puts a wooden counter over it). Keep every strong shape (chandelier, window, flowers) in the outer 15 % at the
left and right edges and the upper 25 %.
```

### A2. `belt-ring.png` (1024 x 1024, transparent)

```
Make ONE picture seen from straight above, saved as belt-ring.png, 1024 x 1024 px, TRANSPARENT background: a ROUND CONVEYOR BELT RING like the belt of a sushi restaurant, perfectly circular
and centred. The outer edge of the ring touches 98 % of the canvas width. The ring is a band 11 % of the width thick: a dark glossy brown leather belt with a faint row of pale-gold chevron
arrows all pointing CLOCKWISE, small round brass studs along both edges, a thick polished-gold outer rim and a thin raised polished-gold inner lip. THE INSIDE OF THE RING IS A PERFECT CIRCLE,
76 % of the canvas width in diameter, FULLY TRANSPARENT (a hole) so that a platter shows through it. No platter, no food, no waiters, no shadow outside the ring, no table. The belt must look
like something small figures could stand and ride on. Perfectly symmetric.
```

### A3. `platter-base.png` (1024 x 1024, transparent)

```
Make ONE picture seen from straight above, saved as platter-base.png, 1024 x 1024 px, TRANSPARENT background: a big round BUFFET PLATTER, cream-white porcelain with a thin hand-painted
gold-leaf rim and a faint embossed leaf border, centred, a perfect circle 80 % of the canvas width in diameter. THE CENTRE (the inner 66 % of the width) is a plain, flat, slightly warm
off-white surface with a very soft porcelain sheen and NO pattern, NO food, NO cubes: the game draws a mosaic of food cubes there. No cast shadow outside the circle.
```

### A4. `platter-gold.png` (1024 x 1024, transparent)

```
The SAME platter, same size and framing as platter-base.png, saved as platter-gold.png, 1024 x 1024 px, TRANSPARENT: the finished, EMPTY platter shining as polished solid GOLD, a warm
mirror-like gold surface with a bright top-left highlight and a soft golden glow just outside its rim, a few tiny sparkle stars on the rim. This is the "plate cleared" reward picture.
```

### A5. `counter.png` (1080 x 760, transparent above its top edge)

```
Make ONE picture saved as counter.png, 1080 x 760 px: the front of a long wooden service COUNTER seen from slightly above, filling the picture from its top edge to the bottom. Above the
counter's top edge everything is TRANSPARENT. A polished brass edge runs along the top (the first 5 % of the height). The counter is rich warm walnut with a subtle grain, a soft golden
light, painterly. On it are TWO EMPTY RECESSED ZONES (the game draws its pieces inside them, so keep them plain and quiet, with NO objects, NO slots, NO dots, NO text):
 - ZONE 1, the LANE TRAY: a rounded dark-brown padded leather recess, from 4 % to 96 % of the width and from 11 % to 54 % of the height, with a thin brass border.
 - ZONE 2, the TABLE ROW: a lighter, slightly lower rounded recess like a row of place settings laid on warm linen, from 4 % to 96 % of the width and from 61 % to 94 % of the height,
   with a thin brass border.
The strip between the zones and below them is plain wood. Perfectly horizontal, symmetric left to right.
```

## BATCH B: the banquet waiters, part 1 (8 files, 512 x 768, transparent)

```
Make these eight pictures, TWO per waiter, saved with the exact names. Every picture: ONE chibi banquet waiter, FRONT view, standing centred, canvas 512 x 768 px, TRANSPARENT background,
NO shadow, NO floor, the figure fills about 92 % of the height with a small margin. A crisp white shirt, a waistcoat and a smart beret (hat) both in the waiter's colour, black trousers, neat
shoes, white gloves; one hand holds a ROUND SILVER SERVING TRAY raised at shoulder height with a small stack of FOUR glossy sugar-candy FOOD CUBES in the waiter's colour on it. The hat,
the waistcoat and the cubes use EXACTLY the hex colour in the table. The face is big, cheerful and clear at 56 px wide. Different hair, face and skin tone for each waiter, but the SAME style,
proportions, uniform shape and brightness for all of them, so they are clearly one banquet crew (and NOT the restaurant's own server: a banquet uniform with a beret).
Two poses per waiter, SAME character in both: (1) "ready": standing, tray raised, a friendly smile, one eyebrow raised as if waiting for a tap; (2) "go": mid-run, leaning forward, one leg
lifted, the tray tilted but the cubes still on it, the beret tilted, a big open-mouthed grin.
```

| Files | The waiter (colour and character) |
|---|---|
| `waiter-red.png`, `waiter-red-go.png` | RED `#D9392B`: a young man, short black hair, a cheeky grin |
| `waiter-orange.png`, `waiter-orange-go.png` | ORANGE `#F28C28`: a young woman, a ginger ponytail, freckles |
| `waiter-yellow.png`, `waiter-yellow-go.png` | YELLOW `#F4C430`: a teenage waiter, curly hair, a huge smile |
| `waiter-green.png`, `waiter-green-go.png` | GREEN `#4C9A2A`: a woman, a brown bun, round glasses |

## BATCH C: the banquet waiters, part 2 (8 files, 512 x 768, transparent)

Paste the same STYLE BIBLE and the same waiter prompt as batch B (attach one picture from batch B as the reference so the crew matches), then:

| Files | The waiter (colour and character) |
|---|---|
| `waiter-brown.png`, `waiter-brown-go.png` | BROWN `#8B5A2B`: an older man with a moustache, kind eyes, a round tummy |
| `waiter-purple.png`, `waiter-purple-go.png` | PURPLE `#7B4BA3`: a woman with dark skin and long braids, a warm smile |
| `waiter-cream.png`, `waiter-cream-go.png` | CREAM `#F6F0E4`: the HEAD waiter, a tall white chef's toque instead of a beret, a neat small beard; his waistcoat is cream with gold buttons, cubes are cream-white |
| `waiter-grey.png`, `waiter-grey-go.png` | GREY `#8E8A86`: a calm woman with a silver bob, a serene smile; her beret and waistcoat are silver-grey |

## BATCH D: tables, the jam picture and a spark (5 files, transparent)

```
Make these small pictures, transparent background, the same warm painted look, bold and readable at 64 px on a phone: a bold silhouette, big simple shapes.
```

| File | Canvas | The picture |
|---|---|---|
| `table-empty.png` | 256 x 256 | a small ROUND banquet table seen from a high three-quarter view, a cream tablecloth with a gold ribbon tied round it, a tiny UNLIT candle on top, inviting and empty |
| `table-taken.png` | 256 x 256 | the SAME table, same angle and size, the candle LIT with a warm glow, a tiny silver cloche (dome) on the cloth: a table where a waiter is waiting |
| `table-bonus.png` | 256 x 256 | the same table with a GOLDEN tablecloth and a ribbon, a few sparkle stars: the extra table a rewarded ad adds |
| `jam-pile.png` | 768 x 768 | a funny, cute "kitchen jam" picture: five chibi waiters in different coloured berets standing round tables holding up trays with their cubes, looking worried and a little cross-eyed; a few cubes tumbling; a small chef peeking in with both hands on his cheeks; NO text |
| `sparkle.png` | 256 x 256 | a bright four-point golden sparkle star with a soft glow and two tiny stars, for a cube being collected |

## Checking a picture before saving it

- The right picture for the file name, the same warm painted look as the others, a clean bold silhouette at small size.
- Waiters: front view, the SAME crew style, the hat, waistcoat and cubes the EXACT colour of the table at the top, the face clear at 56 px, transparent, NO shadow, NO writing anywhere.
- The ring and the platters: perfectly circular and centred, the ring's hole fully transparent, the platter's centre plain (no pattern, no food).
- The counter: transparent above its edge, two clean empty recesses at the stated percentages, nothing printed in them.
- The backdrop: opaque, the centre quiet, no sharp people, no text.
- Nothing cut off wrongly: a figure fits fully inside its canvas with a small margin.

## What the build script will do (written when the first files arrive)

`scripts/make-plating-belt-assets.py`: reads `Plating Belt Assets/*.png` (local, gitignored), trims the empty border of each waiter and fits it into 192 x 288, saves small WebPs into
`public/business/platingbelt/` (waiters about 30 KB each, the ring and the platters 768 x 768 at about 100 KB, the counter 720 x 507, the backdrop 720 x 1280 under 200 KB, the tables
128 x 128, the jam picture 384 x 384), the whole set under about 1.3 MB. The game uses a picture when its file exists and plain shapes (a coloured disc, a rounded rectangle) when it does not.
