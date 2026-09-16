# KnifeCraft Recipe Coverage

Generated at the end of Phase 6 — **the full 250-level campaign is now
complete**. Reflects the full `CAMPAIGN_RECIPES` library (Phases 1–6
combined) via one-off scripts over the live data — not hand-counted.

## Totals

| Metric | Count |
|---|---|
| Total recipes | 211 |
| Total ingredients introduced | **52 / 52** |
| Total techniques | 11 / 11 |
| Total cuisines (real cuisine ids) | 9 |
| Levels implemented | **250 / 250** |
| Chapters implemented | **25 / 25** |
| Batch-group levels (whole campaign) | 39 |
| Levels using a real branch recipe (whole campaign) | 32 |
| 2-customer-ish levels (whole campaign) | 64 |
| 3-customer-ish levels (whole campaign) | 45 |

All 9 cuisines (Italian, French, Indian, Mediterranean, Mexican, Japanese,
Chinese, Thai/Southeast Asian, Korean) are deepened, not replaced, by
Phase 6 — Chapters 18–22 reinforce five of them with underused
ingredients/techniques, Chapters 23–24 are deliberately **mixed-cuisine**
service (two-three `cuisineId`s sharing one batch-group session), and
Chapter 25 closes the campaign drawing on all nine at once. A 10th
bucket, `(none)`, covers the earliest Phase 1–2 recipes plus Phase 6's
own finale recipes (deliberately `cuisineId: null` — the grand finale is
presented as the restaurant's own signature, not any one cuisine).

## Recipe count by ingredient

Every one of the 52 defined ingredients now appears in at least 1 recipe
(brief §7's own coverage goal). 37 of 52 reach the "at least 3 recipes"
target; the remaining 15 are 1-2 recipe ingredients (below), reported
honestly rather than padded — see "Known limitations" in the Phase 6
report for why.

| Ingredient | Recipes | Ingredient | Recipes |
|---|---|---|---|
| chicken | 36 | apple | 3 |
| tomato | 36 | asparagus | 3 |
| carrot | 35 | baguette | 3 |
| garlic | 32 | broccoli | 3 |
| onion | 26 | butter | 3 |
| steak | 24 | fennel | 3 |
| salmon | 21 | grapes | 3 |
| basil | 19 | lettuce | 3 |
| pepper | 17 | tofu | 3 |
| cucumber | 13 | turnip | 3 |
| potato | 11 | watermelon | 3 |
| cabbage | 9 | zucchini | 3 |
| mushroom | 9 | artichoke | 2 |
| avocado | 8 | cheddar | 2 |
| lemon | 8 | coconut | 2 |
| mozzarella | 8 | kiwi | 2 |
| spinach | 8 | orange | 2 |
| bread | 6 | pumpkin | 2 |
| mango | 6 | beetroot | 1 |
| corn | 5 | eggplant | 1 |
| peapod | 5 | greenbean | 1 |
| cauliflower | 4 | peach | 1 |
| celery | 4 | pear | 1 |
| parsley | 4 | pomegranate | 1 |
| pineapple | 4 | radish | 1 |
| | | strawberry | 1 |
| | | sweetpotato | 1 |

**Newly introduced to active recipe use this phase**: apple, artichoke,
butter, cheddar, grapes, kiwi, lettuce, peach, strawberry, turnip,
watermelon — the 11 ingredients that had zero recipes at the end of
Phase 5.

## Recipe count by technique

| Technique | Recipes | vs. brief's "≥10" target |
|---|---|---|
| slice | 125 | ✔ |
| dice | 84 | ✔ |
| chop | 50 | ✔ |
| julienne | 50 | ✔ |
| rockMince | 24 | ✔ |
| halve | 19 | ✔ |
| radial | 12 | ✔ (was 4 at end of Phase 5) |
| chiffonade | 11 | ✔ |
| peel | 10 | ✔ (was 6) |
| rings | 10 | ✔ (was 3) |
| smash | 5 | ✘ — see Known limitations |

10 of 11 techniques now clear the brief's own "≥10 recipes" target.
**Smash remains at 5, honestly reported, not padded**: exactly one
ingredient in the entire 52-ingredient roster (garlic) supports `smash`
at all — reaching 10 would require 5 more garlic-smash recipes with no
other purpose, which the brief's own §2/§9 explicitly forbid ("do not
pad recipes merely to hit numerical targets").

## Recipe count by cuisine

| Cuisine | Recipes |
|---|---|
| italian | 29 |
| french | 27 |
| (none) — pre-cuisine + finale recipes | 26 |
| indian | 25 |
| japanese | 23 |
| chinese | 19 |
| mexican | 19 |
| mediterranean | 17 |
| thai | 14 |
| korean | 12 |

## Recipe count by protein

| Protein | Recipes | Target (Phase 5 brief §21) |
|---|---|---|
| chicken | 36 | ≥ 15 ✔ |
| steak | 24 | ≥ 15 ✔ (was 12 at end of Phase 5) |
| salmon | 21 | ≥ 15 ✔ (was 8 at end of Phase 5) |

**All three proteins now clear the ≥15 target** — reached naturally
through Chapters 19 (French: steak + salmon), 20 (Indian: steak curry),
21 (Mediterranean: salmon), 22 (Latin: steak), 23-24 (mixed-cuisine
batch/branch scenarios for both), and 25 (grand finale), never by
inventing a recipe purely to hit the number.

## Batching / branching / allocation coverage (whole campaign)

- **Batching**: 39 batch-group levels total (Phase 6 added 19: Levels
  175, 178, 185, 189, 195, 198, 200, 205, 209, 215, 219, 224, 228, 230,
  234, 238, 240, 245, 250).
- **Branching**: 32 levels use a real branch recipe total (Phase 6 added
  10 recipes' worth of usage: chicken/steak/salmon branches across
  Chapters 18-25, each with 2 independent outputs to 2 named
  destinations).
- **Destination allocation**: every batch/branch level above allocates a
  real, named destination set; Chapters 23-24 specifically allocate one
  shared output across destinations belonging to *different cuisines'*
  orders in the same session (brief §5's "handle different cuisines in
  the same service session").
- **Multi-customer**: 64 two-customer-ish and 45 three-customer-ish
  levels across the whole campaign; 3 customers are normal from Chapter
  14 onward and remain normal through the finale.

## How this was generated

`CAMPAIGN_RECIPES` and `LEVELS` were walked once each via throwaway
scripts (not committed, per this repo's `scripts/_*.mts` convention —
reproducible directly from `src/game/recipes/campaignRecipes.ts` and
`src/game/levels/levelDefinitions.ts`), counting each ingredient/
technique a recipe touches at most once per recipe, and counting
`batchGroupRecipeIds`/branch-recipe usage per level.
