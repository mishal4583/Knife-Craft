# Restaurant maps and Second Floor: quality / smoothing prompts (Codex, developer 2026-11-21)

**Developer's note (2026-11-21):** "the colour is okay. Look at the concept image and the current map: the current map feels too sharpened, it does not look realistic and smooth. Ask Codex to optimize
the QUALITY." (An earlier version of this file blamed the orange colour. That was WRONG and the repaint pictures it produced were deleted. The colour is approved: only the QUALITY changes.)

## What is wrong (measured)

I compared the current Codex map (`TL-restaurant-06-grand.png`) with the portrait concept/reference map of the same stage, and checked that the game's own conversion is not the cause:

| | Fine-detail energy (Laplacian variance, 960 x 540) | Pixels with an edge halo / overshoot |
|---|---|---|
| Codex source PNG | 6289 | 10.7 % |
| What the game shows (webp built from it) | 6062 (slightly SOFTER than the source) | 10.4 % |
| Portrait concept / reference (native size) | about 1750 | 2.7 % |

So the crunch is in the Codex pictures themselves: about **3 to 4 times the micro-contrast** of the concept and **4 times the edge halos**. In the 1:1 crops it shows as hard bright rims round every object, tiny
high-contrast speckle on shelves and steel, over-detailed small items and a "sharpened / HDR" look, where the concept has soft painterly edges, smooth gradients on floors, walls and steel, and calm
small details. The game's conversion (webp 80) does not add any of it.

## The method: REPAINT FOR QUALITY, keep the colour and the layout

The colour is approved and the game's tap areas, lock chips and people routes were measured on the current pictures, so Codex must change ONLY the rendering quality: same colours, same layout, same objects,
smoother and more natural. Attach TWO pictures to every request:

1. the CONCEPT / reference for the stage (the smooth look to reach): `Landscape Backdrops Assets\reference\map-restaurant-0N-<stage>.png` (and `map-second-floor.png` for the Second Floor);
2. the CURRENT wide picture (colour and layout are the truth, its sharpness is the fault): `Landscape Backdrops Assets\true-landscape\TL-restaurant-0N-<stage>.png`.

Save the results into a NEW folder `Landscape Backdrops Assets\true-landscape\smooth\` with the same file names. Send the six restaurants in ONE conversation (so they stay consistent), the Second Floor in
its own. **Make IMAGES ONLY: do not edit any game code, test, config or document in the repo.**

## The prompt (paste into every request; fill the stage name and number)

```
QUALITY REPAINT. Attached: picture 1 = the concept / reference of this stage (the soft, smooth, painterly look I want), picture 2 = the current wide map (its COLOUR and its LAYOUT are approved,
but it is over-sharpened and unrealistic).

Redraw picture 2 as a 1920 x 1080 PNG with EXACTLY the same layout (every wall, room, door, doorway, table, chair, sofa, counter, shelf, plant, lamp and path in the same place and the same size)
and EXACTLY the same colours (same hues, same saturation, same brightness, same warm light), changing ONLY the rendering quality, to look like picture 1:

1. NO SHARPENING LOOK: no unsharp-mask halos, no bright or dark outline glow round objects, no crunchy micro-contrast, no HDR look, no "clarity" or "detail boost". Edges are soft and cleanly
   anti-aliased, like a smooth painting.
2. SMOOTH SURFACES: floors, walls, steel counters, tiles, tablecloths and rugs are smooth, calm gradients with gentle painted shading, not noisy or speckled. Wood grain and brick texture are
   subtle and even, not high-contrast scratches. Steel has a few soft reflections, not hundreds of tiny sparkles.
3. CALM SMALL DETAILS: jars, bottles, plates, cutlery, tools, produce and books are simple clean shapes with soft shading and a gentle darker edge. Do not add extra tiny details or speckle. Every
   object is complete and correctly shaped: no melted, doubled, warped, garbled or half-finished objects, no letter-like scribbles on labels (every label is blank).
4. NATURAL LIGHT: the same warm light as picture 2, but soft: smooth shadows and soft light shafts, no hard-edged glow, no bloom spikes, no banding, no dithering, no noise, no compression blocks.
5. REALISTIC: believable proportions and materials (matte painted, slightly soft), clean and tidy, one consistent level of finish across the whole picture, as in picture 1.
6. TECHNIQUE: if you can, render at 3840 x 2160 and reduce to 1920 x 1080 with a smooth (bicubic / area) filter; do NOT sharpen after reducing. Final output: one opaque 1920 x 1080 PNG, no border,
   no vignette, no text of any kind, no people.

Stage: <NN> <stage name>. Keep everything else exactly as in picture 2.
```

For the Second Floor use the same text with "the Second Floor food hall" instead of the stage, picture 1 = `map-second-floor.png`, picture 2 = `TL-second-floor.png`.

## How Claude checks the result (objective, before anything is wired in)

`python scripts/check-map-quality.py "Landscape Backdrops Assets\true-landscape\smooth"` compares each new picture with the one it replaces:

- **colour unchanged** (every channel mean within 0.02, saturation within 0.03),
- **layout unchanged** (a 128 x 72 grey copy within 0.05),
- **smoother**: fine-detail energy 35 % to 75 % of the old (a 0.9 px blur of the old picture scores 40 %, so this is a modest softening, not a blur),
- **fewer halos**: at most 70 % of the old.

A picture that fails comes back to Codex with the exact numbers. I also look at the result next to the concept. When all seven pass: copy them over `true-landscape\`, run
`python scripts/make-landscape-assets.py`, rebuild. Because the layout is locked, nothing else changes (tap areas, lock chips, guests, staff); I run the map and Second Floor browser suites.

## Stopgap that needs no new pictures (say "soften them" to get it)

I can soften the existing seven pictures in `make-landscape-assets.py` (a light blur and a gentle halo reduction, saved at a higher webp quality), so the game looks smoother today. It cannot make
the details cleaner or fix malformed objects, so a Codex repaint is still the proper fix. Today's pipeline is not the cause: it does not sharpen.

## The same fault elsewhere

The six Kitchen homes, the dining rooms and the mini-game rooms come from the same Codex batches and probably share the over-sharpening. Say so and I measure them and write the same prompt for them.
