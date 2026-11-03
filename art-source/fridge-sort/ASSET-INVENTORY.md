# Fridge Sort generated art inventory

Generated source PNGs for the Fridge Sort mini-game. These are art-source files; they are not yet production WebP assets and are not wired into the game.

All assets use the warm cream-enamel / brown-trim style sampled from the existing inventory fridge. A1 existed before this batch. A2–A21 were generated for the pasted prompt set and the capacity audit.

## Generated assets

| ID | File | Contents |
|---|---|---|
| A1 | `A1.png` | Original cream-enamel open fridge body, four shelf bands |
| A2 | `A2.png` | Matching open fridge door |
| A3 | `A3.png` | Optional portrait kitchen wall and counter background |
| A4 | `A4.png` | Wooden crate back half |
| A5 | `A5.png` | Matching crate front half with cloth |
| A6 | `A6.png` | Pantry basket |
| A7 | `A7.png` | 12 ingredients: tomato through celery |
| A8 | `A8.png` | 12 ingredients: lettuce through pea pod |
| A9 | `A9.png` | 11 ingredients plus one intentionally empty cell |
| A10 | `A10.png` | 12 fruit sprites |
| A11 | `A11.png` | 10 ingredients plus two intentionally empty cells |
| A12 | `A12.png` | Four HUD plaque parts: timer, score, blank button face, shelf tag |
| A13 | `A13.png` | Star progress frame and separate fill strip |
| A14 | `A14.png` | Filled star, empty socket, large reward star |
| A15 | `A15.png` | Blank parchment checklist board |
| A16 | `A16.png` | Blank result panel and ribbon |
| A17 | `A17.png` | 12 fridge magnet collectibles |
| A18 | `A18.png` | Optional glass-and-steel drawer bin |
| A19 | `A19-commercial-fridge.png` | Commercial fridge upgrade, four shelf zones |
| A20 | `A20-professional-fridge.png` | Professional fridge upgrade, five shelf zones |
| A21 | `A21-basic-fridge.png` | Basic gameplay-matched fridge, two shelf zones |

The five ingredient sheets contain 57 ingredient cells total. A9 has one empty cell; A11 has two empty cells.

## Capacity alignment and plan note

The gameplay plan has three Basic zones: Vegetables & Fruit, Cold, and Pantry basket. The original A1 image prompt requested four fridge shelves, which does not visually match that structure. A21 supplies the gameplay-matched Basic cabinet with two fridge shelves plus the separate A6 pantry basket. Keep A1 as the original prompt deliverable; use A21 for the Basic tier if shelf count should mirror zone count.

Commercial uses four shelves; Professional uses five. A19 and A20 are additions because the original art list only described one fridge body for three capacity tiers.

## Remaining integration work (not an image-generation gap)

1. Crop A7–A11 and A17 into individual cells; export 57 ingredient sprites and 12 magnets as optimized WebP.
2. Export the standalone sprites and sheets to WebP, resize to the plan's target dimensions, and keep these PNGs as source only.
3. Integrate the fridge variants by capacity, align shelf hit/drop regions to each tier, and compose A2 with the cabinet.
4. Use nine-slice treatment for the stretchable HUD, checklist, and result panels; draw all text and the pause glyph in code.
5. Verify transparent edges, cell mapping/order, mobile layout, asset budget, and tier-specific placement in game.

The later visual mismatch audit added 62 Market supply icons, two Second Floor team portraits, and replacement green-chili and chicken-breast sprites; see the adjacent `art-source/market-supplies/ASSET-MANIFEST.md`. Audio cues, effects, pointer/tutorial hand, labels, drag trails, and sparkle/confetti are specified as synthesized, existing, or code-drawn—not image assets.
