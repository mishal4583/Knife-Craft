# Sauce Station: a real product on the counter for every pantry item (developer 2026-11-13)

Idea (developer): instead of small button cards with a tiny picture, each ingredient is a painted OBJECT standing on the counter: a jar of
mayonnaise with its label, an olive-oil bottle, a milk carton, a bowl of salt. The player taps the object.

## What is built already (no art needed to test it)

- `SauceStationGame` `PantryTile` draws a product as a **standing object with a small wooden name tag, no card** when
  `public/business/sauce/products/<id>.webp` exists; the recipe glow, the "+N" / tick badges, the count and the idle-hint hand are kept.
  Without the file it draws today's card, so products can be delivered a few at a time.
- `python scripts/make-sauce-products.py` turns `Sauce Product Assets/<id>.png` (local, gitignored) into the game's 192 x 192 WebP files (trims the
  empty border, sizes each picture by its kind so a bottle is taller than a jar and a spice bowl, stands it on the bottom edge, keeps each file
  under 40 KB). I looked at the layout with stand-ins made from the old sheets: it works, and the rows stay about as tall as today's.
- **The name is drawn by the game** (the wooden tag), so Codex must NOT paint any words. The label on a jar stays blank or carries one tiny
  pictogram. (AI pictures misspell words; the tag is always correct English and crisp.)

## How to run it in Codex

1. One Codex conversation per BATCH below (A, B, C, D). Attach the reference images, paste the **STYLE BIBLE**, then the **BATCH PROMPT**.
2. Codex saves each picture as `Sauce Product Assets/<id>.png` with the exact id in the table.
3. Run `python scripts/make-sauce-products.py`, then `npm run build`. Tell me and I will check them on a phone.

Attach as references (all in the project): `Sauce Station Assets/M12-pantry-bottles.png`,
`M13-pantry-jars.png`, `M14-pantry-cartons.png`, `M16-spice-bowls.png`, `M17-produce-heaps.png` (the current look and colours), and one kitchen
picture such as `Sauce Station Assets/M01-backdrop-mix.png` (the counter they will stand on).

## STYLE BIBLE (paste at the top of EVERY request)

```
STYLE BIBLE: KnifeCraft Sauce Station pantry products. A warm, cozy, hand-painted mobile-game look, exactly the family of the attached
pantry bottle, jar, carton, spice-bowl and produce sheets and the kitchen backdrop: soft painterly shading, gentle rim light, rounded chunky
shapes, a thin darker outline in warm brown (never pure black), rich but not neon colours, rustic farmhouse kitchen. Light from the top-left,
warm golden, soft contact shadow directly under the object only.
ONE OBJECT PER PICTURE, seen from the front with a very slight downward tilt, as if standing on a wooden counter, centred, the BASE of the object
near the bottom of the picture, a clear margin of about 5 % around it. It must read at SMALL size (about 60 px wide on a phone): a bold
silhouette, one clear main colour, a bright top-left highlight, no tiny details. Make it a little larger-than-life and friendly, not
photographic.
LABELS: every jar, bottle and carton has a PRINTED-STYLE LABEL that is a plain cream paper band with a simple rustic border and ONE small simple
pictogram of what is inside (an egg, a drop, a lemon, a chilli, a milk drop, a wheat ear). NO TEXT AT ALL: no letters, no numbers, no words, no
logos, no brand names, no watermark. The game writes the name itself.
CONTENTS: what is inside a clear container is painted fully (oil golden-green and glossy, vinegar pale and clear, soy near-black, cream white,
honey amber). Glass is clear with soft white highlights and a faint green-blue edge. Lids and caps are chunky and simple.
OUTPUT: PNG, 1024 x 1024, TRANSPARENT background (alpha), no background, no counter, no shelf, no table, no hands, no people, no UI, no frame.
If transparency is impossible use flat pure green #00FF00 (magenta #FF00FF for green subjects) and say so. Deliver ONE image per file, exactly the
file name asked.
SCALE: draw each object at the SAME scale as its neighbours in the table: a bottle is tall and slim, a carton tall and boxy, a jar short and
wide, a spice bowl low and round with a wooden scoop, a produce heap a small neat pile.
```

## BATCH A: bottles (7 files)

```
Make these seven pictures, one object each, saved with the exact names. Each is a tall slim glass or plastic bottle with a cork or screw cap and a
blank cream label band with one small pictogram.
```

| File | The object |
|---|---|
| `olive-oil.png` | a green-gold glass bottle of olive oil with a cork stopper; label pictogram: an olive branch |
| `veg-oil.png` | a clear bottle of pale golden vegetable oil, yellow screw cap; label pictogram: a sunflower |
| `sesame-oil.png` | a small dark-amber bottle of sesame oil, red cap; label pictogram: sesame seeds |
| `white-vinegar.png` | a clear bottle of water-clear vinegar, white cap; label pictogram: a drop |
| `wine-vinegar.png` | a dark ruby bottle of red-wine vinegar, cork; label pictogram: a grape |
| `soy.png` | a slim bottle of near-black soy sauce, red-and-white cap; label pictogram: a soybean pod |
| `chilli-sauce.png` | a squat bottle of bright red chilli sauce with a nozzle cap; label pictogram: a chilli |

## BATCH B: cartons, jars and the stock cube (13 files)

| File | The object |
|---|---|
| `water.png` | a small glass bottle of clear water with a swing cap (or a clean water jug); label pictogram: a drop |
| `stock.png` | a tall carton of golden stock; label pictogram: a pot |
| `milk.png` | a white-and-blue gable-top milk carton; label pictogram: a milk drop |
| `cream.png` | a smaller cream-coloured carton with a pour spout; label pictogram: a swirl |
| `coconut-milk.png` | a tin can with a ring pull, ivory label; label pictogram: a coconut half |
| `passata.png` | a tall tomato-red carton of passata; label pictogram: a tomato |
| `yogurt.png` | a short wide white tub with a foil lid and a spoon resting on top; label pictogram: a leaf |
| `honey.png` | a round amber honey jar with a wooden dipper standing in it; label pictogram: a bee-less honeycomb hexagon |
| `mayo.png` | a short wide jar of thick cream-white mayonnaise with a gold screw lid; label pictogram: an egg |
| `mustard.png` | a short jar of bright yellow mustard with a yellow lid; label pictogram: a mustard seed |
| `tahini.png` | a jar of beige sesame paste, a thin oil layer on top, brown lid; label pictogram: sesame seeds |
| `peanut-butter.png` | a short wide jar of brown peanut butter, red lid; label pictogram: a peanut |
| `stock-cube.png` | two wrapped golden stock cubes, one unwrapped, in a tiny pile (no box) |

## BATCH C: spice bowls (8 files)

Each is a low round earthenware bowl, heaped with the spice, with a small wooden scoop resting in it. No label; the colour does the talking.

| File | The object |
|---|---|
| `salt.png` | white coarse salt crystals |
| `pepper.png` | black peppercorns and cracked pepper |
| `paprika.png` | smooth deep-orange-red paprika powder |
| `turmeric.png` | bright golden-yellow turmeric powder |
| `cumin.png` | warm brown cumin seeds |
| `curry-powder.png` | rich yellow-orange curry powder |
| `chilli-flakes.png` | red chilli flakes with a few seeds |
| `sugar.png` | white sugar crystals, a sparkle |

## BATCH D: fresh produce, chopped heaps (15 files)

Each is a small neat pile of the chopped ingredient on a tiny wooden board OR loose (no board), with one whole piece beside it so it is
recognisable. Colours bright and true.

| File | The object |
|---|---|
| `tomato.png` | diced red tomato with one whole tomato |
| `onion.png` | diced white-gold onion with one whole onion |
| `garlic.png` | minced garlic with two cloves and a bulb |
| `chilli.png` | sliced red chilli rings with one whole chilli |
| `lemon.png` | a halved lemon and a wedge |
| `lime.png` | a halved lime and a wedge |
| `ginger.png` | sliced ginger with a knob of root |
| `cilantro.png` | a small bunch of cilantro leaves |
| `basil.png` | a small bunch of basil leaves |
| `parsley.png` | a small bunch of flat parsley |
| `mango.png` | diced mango cubes with a half |
| `pineapple.png` | pineapple chunks with a slice |
| `corn.png` | corn kernels with a half cob |
| `avocado.png` | a halved avocado with the stone and diced green |
| `potato.png` | diced potato with one whole potato |

## Checking a picture before saving it

- ONE object, transparent background, nothing else in the picture.
- NO letters or numbers anywhere (a label with a squiggle is fine; a word is not).
- The right object for the file name, and the same warm painted style as its neighbours.
- It stands on its base at the bottom of the picture, not floating or cut off.

## Priority if Codex time is short

`mayo`, `olive-oil`, `lemon`, `mustard`, `salt`, `water`, `tomato`, `milk`, `soy`, `honey`: the ones the first recipes (Lemon Dressing, Vinaigrette,
Tomato sauce) use. Any subset works: the rest keep the card look until their file arrives.
