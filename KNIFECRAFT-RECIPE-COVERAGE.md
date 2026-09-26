# KnifeCraft Recipe Coverage

Generated at the end of Phase 7.1 — the 250-level campaign is unchanged in
size; this phase was a correctness pass (brief "do not add content"), not
a content phase. Reflects the full `CAMPAIGN_RECIPES` library (Phases
1–7.1 combined) via one-off scripts over the live data — not hand-counted.
Numbers below supersede the Phase 6 version of this document wherever
they differ (see "What changed this phase").

## What changed this phase

Phase 7.1 fixed a real gameplay dead-end (brief §8/§9): 6 ingredients
(Onion, Potato, Garlic, Pineapple, Watermelon, Coconut) are
peel-mandatory in the engine (`PreparationScene.requiresPeelFirst()` —
`INGREDIENTS[id].techniques` includes `"peel"` and `peelDecoupled` is not
set), but 60 of the 211 recipes asked for a technique on one of these
ingredients with no Peel step first — a genuine, unplayable dead end (the
player is silently blocked, never shown a Peel prompt). Every one of
those 60 recipes had a Peel component inserted immediately before the
affected technique (see the Phase 7.1 report's own recipe-by-recipe
list). **No recipe's final technique/destination/payment changed** — only
the missing prerequisite step was added — so this table's ingredient/
cuisine/protein counts are unchanged from Phase 6 except:
- **`peel`'s own technique count** jumps from 10 to 69 (60 recipes gained
  a real Peel step they never had).
- The Phase 6 version of this document said "15 ingredients at 1-2
  recipes" but actually listed 16 names — recalculated from source below;
  the correct count is 15.

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
| **Blocked recipes (RecipeValidator.isRecipePlayable)** | **0 / 211** |

All 9 cuisines (Italian, French, Indian, Mediterranean, Mexican, Japanese,
Chinese, Thai/Southeast Asian, Korean) are represented; a 10th bucket,
`(none)`, covers the earliest Phase 1–2 recipes plus the Phase 6 finale
recipes (deliberately `cuisineId: null`).

## Recipe count by ingredient

Every one of the 52 defined ingredients appears in at least 1 recipe. 37
of 52 reach the "at least 3 recipes" target; the remaining **15** (not
16 — corrected this phase) are 1-2 recipe ingredients, reported honestly
rather than padded.

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
| potato | 11 | zucchini | 3 |
| mushroom | 9 | orange | 2 |
| cabbage | 9 | coconut | 2 |
| mozzarella | 8 | pumpkin | 2 |
| spinach | 8 | artichoke | 2 |
| lemon | 8 | kiwi | 2 |
| avocado | 8 | cheddar | 2 |
| bread | 6 | eggplant | 1 |
| mango | 6 | pomegranate | 1 |
| peapod | 5 | sweetpotato | 1 |
| corn | 5 | beetroot | 1 |
| celery | 4 | radish | 1 |
| parsley | 4 | greenbean | 1 |
| cauliflower | 4 | pear | 1 |
| pineapple | 4 | peach | 1 |
| watermelon | 4 | strawberry | 1 |

**The exact 15 ingredients at 1-2 recipes** (corrected count): beetroot,
eggplant, greenbean, peach, pear, pomegranate, radish, strawberry,
sweetpotato (1 recipe each); artichoke, cheddar, coconut, kiwi, orange,
pumpkin (2 recipes each).

## Recipe count by technique

| Technique | Recipes | vs. "≥10" target |
|---|---|---|
| slice | 125 | ✔ |
| dice | 84 | ✔ |
| **peel** | **69** | ✔ (was 10 before Phase 7.1's prerequisite fix) |
| chop | 50 | ✔ |
| julienne | 50 | ✔ |
| rockMince | 24 | ✔ |
| halve | 19 | ✔ |
| radial | 12 | ✔ |
| chiffonade | 11 | ✔ |
| rings | 10 | ✔ |
| smash | 5 | ✘ — see Known limitations |

10 of 11 techniques clear the "≥10 recipes" target. **Smash remains at
5, honestly reported, not padded**: exactly one ingredient in the entire
52-ingredient roster (garlic) supports `smash` at all. Phase 7.1
specifically verified (brief §19) that every one of those 5 Smash
recipes now has a valid Peel path first — Smash's *count* is unchanged,
only its *playability* was in question, and that's now fixed.

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

| Protein | Recipes | Target |
|---|---|---|
| chicken | 36 | ≥ 15 ✔ |
| steak | 24 | ≥ 15 ✔ |
| salmon | 21 | ≥ 15 ✔ |

## Batching / branching / allocation coverage (whole campaign)

- **Batching**: 39 batch-group levels. Phase 7.1 re-verified every one of
  these still shares its batchable output correctly after the Peel-step
  insertion (the inserted Peel component is never itself `batchable` —
  only the original shared cut/technique component is, unchanged).
- **Branching**: 32 levels use a real branch recipe.
- **Destination allocation**: every batch/branch level allocates a real,
  named destination set — unaffected by the Phase 7.1 fix.
- **Multi-customer**: 64 two-customer-ish and 45 three-customer-ish
  levels across the whole campaign.

## How this was generated

`CAMPAIGN_RECIPES` and `LEVELS` were walked once each via throwaway
scripts (not committed, per this repo's `scripts/_*.mts` convention —
reproducible directly from `src/game/recipes/campaignRecipes.ts` and
`src/game/levels/levelDefinitions.ts`), counting each ingredient/
technique a recipe touches at most once per recipe, and cross-checked
against `src/game/service/RecipeValidator.ts`'s `recipePrerequisiteIssues`/
`isRecipePlayable` (new this phase) for prerequisite-path correctness.
