# Car Park: Codex prompts for the art (developer 2026-11-15)

The game: `CAR-PARK-MINIGAME-PLAN-2026-11-15.md`. A portrait mini-game: a jammed car park between **our restaurant (a thin slice on the LEFT edge)** and the **neighbour's building (a thin
slice on the RIGHT edge)**; the player taps vehicles to drive them out along an arrow without bumping anything.

## How to run it in Codex

1. One Codex conversation per BATCH (A to G). Attach the **reference images**, paste the **STYLE BIBLE**, then the **BATCH PROMPT**.
2. Codex saves each picture as `Car Park Assets/<name>.png` with the exact name in the table.
3. Tell me; I run `python scripts/make-car-park-assets.py` (written when the first files arrive), build, and check the pictures on a phone-sized screen.
4. The game works with plain shapes until a file arrives, so batches can come in any order. Priority: **A (the backdrop), then B (cars), C (vans), D (buses), E, F, G.**

Attach as references: `public/restaurant-map/kitchen-upgrade-map-neighborhood-cafe.webp` (our restaurant's look: dark timber frames, glowing lanterns, flower boxes, cobbled courtyard,
wooden double doors, the chalkboard sign), and, for the vehicles, any of the Sauce Station product pictures (`Sauce Product Assets/mayo.png`) for the painted toy finish.

## STYLE BIBLE (paste at the top of EVERY request)

```
STYLE BIBLE: KnifeCraft "Car Park" mini-game. A warm, cozy, hand-painted mobile-game look, exactly the family of the attached restaurant cutaway map: rich golden warm light, dark
timber frames, glowing lanterns, flower boxes, cobbled stone, soft painterly shading, gentle rim light, a thin darker warm-brown outline (never pure black), chunky rounded toy-like
shapes, glossy paint with a bright top-left highlight, rich candy colours that are not neon. Friendly, polished, premium-casual, like a top mobile puzzle game. NOT photographic,
NOT 3D-render plastic, NOT flat vector.
NO TEXT AT ALL anywhere: no letters, numbers, words, signs with writing, licence plates with characters, logos, brand names or watermarks (signs and boards stay blank or carry one
tiny pictogram). The game writes any words itself.
OUTPUT: PNG, exact canvas size stated for each file, TRANSPARENT background where the table says "transparent" (alpha, no background, no ground, no shadow, no frame). If true
transparency is impossible use flat pure green #00FF00 (magenta #FF00FF for green subjects) and say so. Deliver ONE image per file, exactly the file name asked.
```

## BATCH A: the backdrop (1 file, the most important picture)

```
Make ONE portrait image of an empty car park seen from straight above (a bird's-eye, orthographic overhead view, like a game board), saved as car-park-backdrop.png, 1080 x 1920 px,
NOT transparent (a full opaque scene). Warm golden-hour evening light, the same painted look as the attached restaurant map.

LAYOUT (percentages of the width; the picture will be cropped to these exact proportions, so keep each zone inside its band):
- LEFT EDGE, the first 11 % of the width: a slice of OUR RESTAURANT, a cosy neighbourhood café. Seen from above we see its dark timber-framed front wall running down the whole
  edge, a scalloped cream-and-green awning, window boxes full of flowers, hanging lanterns glowing warm, ivy, a pair of wooden double doors in the vertical middle (about 45 % to 55 %
  of the height) with a small cobbled drop-off lane running from the doors into the car park, a blank chalkboard sign, barrels with flowers. The building is mostly CUT OFF by the
  edge: only its front and awning show. A warm light spills from the windows onto the cobbles.
- RIGHT EDGE, the last 11 % of the width: a slice of the NEIGHBOUR'S BUILDING, a tidy modern building of pale brick and glass with a blue canopy, a glass door in the vertical middle with its
  own small service lane (smooth pale concrete) running into the car park, a couple of neat green hedges and a bench, a street lamp. Cooler, cleaner colours than the cafe so the two
  sides feel different. Also mostly cut off by the edge.
- TOP 9 % and BOTTOM 9 % of the height: the STREET running across: a kerb, a strip of pavement with a few small trees and bushes, then a road with a faint dashed line and a zebra
  crossing near the middle; the road continues off the picture's top and bottom.
- THE MIDDLE (78 % of the width, from 11 % to 89 %, and 9 % to 91 % of the height): the car park floor itself: dark warm-grey asphalt, soft painterly texture, fine cracks, a few oil
  stains, faint tyre marks, lighter in the centre so coloured vehicles will stand out, a little darker at the edges. IMPORTANT: NO painted parking lines, NO bays, NO arrows, NO
  cars, NO people, NO text. A plain, slightly worn asphalt that a game board can sit on. A subtle low kerb between the asphalt and each side building.
Overall mood: inviting, a little humorous, the two buildings clearly different neighbours sharing one car park.
```

## BATCH B: cars (8 files, 1024 x 2048, transparent)

```
Make these eight pictures, one CAR each, saved with the exact names. Every picture: the car seen from STRAIGHT ABOVE (a bird's-eye orthographic overhead view), the car points UP (its
bonnet and headlights toward the TOP of the picture), centred, perfectly symmetric left to right, canvas 1024 x 2048 px, TRANSPARENT background, NO shadow, NO road.
The body fills about 88 % of the width and about 96 % of the length with a small margin all round. Chunky rounded toy proportions, a little chubby, glossy candy paint with a soft
bright highlight on the top-left of the roof, a clean thin warm-brown outline. Windscreen and rear window are darker glass with a soft reflection; two tiny side mirrors; tiny wheels
only just visible at the body's edges; small warm-yellow headlights at the top, small red tail lights at the bottom.
THE ROOF MUST BE A CLEAN, FLAT, EMPTY AREA (about 40 % of the car's length, no stripes, no logos, no luggage): the game paints a white arrow on it.
```

| File | The car |
|---|---|
| `car-red.png` | a small friendly hatchback, candy red |
| `car-blue.png` | the same shape, sky blue |
| `car-yellow.png` | the same shape, sunny yellow |
| `car-green.png` | the same shape, leaf green |
| `car-orange.png` | the same shape, warm orange |
| `car-purple.png` | the same shape, soft violet |
| `car-white.png` | the same shape, pearl white (the neighbour's car, plain and tidy) |
| `car-grey.png` | the same shape, silvery grey (the neighbour's car, plain and tidy) |

Use the SAME body shape for all eight (only the paint changes) so the lot looks tidy; a tiny variation (a roof rack on one, a sunroof on another) is welcome but the roof's arrow area stays clear.

## BATCH C: vans (8 files, 1024 x 3072, transparent)

```
The same rules as the cars (overhead view, pointing UP, centred, symmetric, transparent, no shadow, a clean flat roof for the game's arrow), but each picture is a VAN, three car-lengths
long, canvas 1024 x 3072 px: a chunky rounded delivery-style van with a long flat roof, a short bonnet at the top, a darker windscreen, side mirrors, a small roof vent. Body fills about 88 % of
the width and 97 % of the length.
```

| File | The van |
|---|---|
| `van-red.png`, `van-blue.png`, `van-yellow.png`, `van-green.png`, `van-orange.png`, `van-purple.png` | the same van body, each in the colour of its name |
| `van-white.png`, `van-grey.png` | the same van, pearl white and silvery grey (the neighbour's) |

## BATCH D: buses (4 files, 1024 x 4096, transparent)

```
The same rules again, but each picture is a BUS, four car-lengths long, canvas 1024 x 4096 px: a chunky rounded friendly tour bus with a long flat roof, a row of darker windows along both
sides (seen as thin dark bands at the edges), a rounded front with a wide windscreen at the top, a small roof hatch. Body fills about 88 % of the width and 97 % of the length. A clean flat
roof area for the game's arrow.
```

| File | The bus |
|---|---|
| `bus-blue.png` | candy blue with a cream stripe along the edges |
| `bus-yellow.png` | sunny yellow with a cream stripe |
| `bus-green.png` | leaf green with a cream stripe |
| `bus-white.png` | pearl white with a pale grey stripe (the neighbour's) |

## BATCH E: the neighbour and the patience hearts (6 files, transparent)

```
Make these small UI pictures, transparent background, the same warm painted look, bold and readable at 56 px wide on a phone: a bold silhouette, big simple shapes.
```

| File | Canvas | The picture |
|---|---|---|
| `neighbour-happy.png` | 512 x 512 | a round portrait of a friendly middle-aged neighbour (a smart cardigan, round glasses, a kind smile), head and shoulders, in a warm cream circular badge with a thin gold rim |
| `neighbour-worried.png` | 512 x 512 | the same neighbour and badge, eyebrows raised, a nervous half-smile |
| `neighbour-annoyed.png` | 512 x 512 | the same neighbour and badge, frowning, one eyebrow lowered, arms not shown |
| `neighbour-angry.png` | 512 x 512 | the same neighbour and badge, red-faced, furious but still cute (steam puffs at the sides), a clenched jaw |
| `heart-full.png` | 256 x 256 | a plump glossy red heart with a bright highlight and a thin dark outline |
| `heart-empty.png` | 256 x 256 | the same heart shape as a dull, empty outline in grey-brown with a pale inside (lost patience) |

## BATCH F: effects and the tow truck (3 files, transparent)

| File | Canvas | The picture |
|---|---|---|
| `honk.png` | 512 x 512 | a bold comic horn burst: three curved sound-wave arcs and a small star spark radiating from the bottom centre, golden yellow with a warm outline, NO letters |
| `tow-truck.png` | 1024 x 3072 | a chunky rounded TOW TRUCK from straight above, pointing UP, symmetric, a flat-bed with a small yellow crane arm and a coil of chain, bright orange-and-white paint with a hazard-stripe edge (stripes only, no text), same rules as the vans |
| `puff.png` | 512 x 512 | a soft round puff of warm grey-white dust (an exhaust puff), painterly, fading at its edges, for a vehicle pulling away |

## BATCH G: later, not needed for the first version

| File | Canvas | The picture |
|---|---|---|
| `neighbour-right-bakery.png` | 330 x 1920, opaque | the right-edge strip (the same zone rules as the backdrop's right edge) as a BAKERY: striped awning, loaves in the window, a flour-white door, a small service lane; for a later chapter |
| `neighbour-right-bank.png` | 330 x 1920, opaque | the same strip as a small stone BANK with columns and a green awning |
| `neighbour-right-dentist.png` | 330 x 1920, opaque | the same strip as a cheerful DENTIST'S surgery: a pale blue front, a tooth-shaped pictogram sign (no letters) |
| `neighbour-right-gym.png` | 330 x 1920, opaque | the same strip as a small GYM: a dark glass front, a dumbbell pictogram sign (no letters), a bike rack |
| `guest-1.png`, `guest-2.png`, `guest-3.png` | 256 x 256, transparent | a small cheerful restaurant guest seen from slightly above, three different outfits and hair, walking up (for the moment a car drops its guests at our door) |

## Checking a picture before saving it

- The right picture for the file name, the same warm painted look as the others, and a clean bold silhouette at small size.
- Vehicles: pointing straight UP, symmetric, viewed from directly overhead, transparent, NO shadow, a flat empty roof, NO writing anywhere (not even on a licence plate).
- The backdrop: opaque, NO vehicles, NO painted lines on the asphalt, the left slice is our timber-framed cafe, the right slice a tidy modern building, street at the top and bottom.
- Nothing cut off wrongly: a vehicle fits fully inside its canvas with a small margin.

## What the build script will do (written when the first files arrive)

`scripts/make-car-park-assets.py`: reads `Car Park Assets/*.png` (local, gitignored), trims the empty border of each vehicle, fits it into its cell proportion (car 1:2, van 1:3, bus 1:4, with a
small margin), saves a small WebP (a car about 160 x 320, a van 160 x 480, a bus 160 x 640, 30 KB each at most) into `public/business/carpark/`; crops the backdrop to 720 x 1280 (the agreed
11 % / 78 % / 11 % zones), under 220 KB; keeps each UI picture under 20 KB. The game uses a picture when its file exists and plain shapes when it does not.
