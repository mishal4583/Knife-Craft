# KnifeCraft Recipe Coverage

Generated at the end of Phase 5 (Campaign Levels 101–170). Reflects the full
`CAMPAIGN_RECIPES` library (Phases 1–5 combined) via one-off scripts over
the live data — not hand-counted.

## Totals

| Metric | Count |
|---|---|
| Total recipes | 132 |
| Total ingredients introduced | 41 |
| Total techniques | 11 / 11 |
| Total cuisines (real cuisine ids) | 9 |
| Levels implemented | 170 / 250 |
| Chapters implemented | 17 / 25 |
| Batch-group levels (whole campaign) | 20 |
| Batch-group levels (Levels 101–170 only) | 14 |
| Levels using a real branch recipe (101–170 only) | 8 |
| 2-customer-ish levels (101–170 only) | 17 |
| 3-customer-ish levels (101–170 only) | 22 |

All 9 cuisines (Italian, French, Indian, Mediterranean, Mexican, Japanese,
Chinese, Thai/Southeast Asian, Korean) now exist as real cuisine
definitions and have shipped recipes — matching the Phase 5 brief's own
"Cuisines introduced: 9/9" target exactly. A 10th bucket, `(none)`, covers
the 10 earliest Phase 1–2 recipes (Levels 1–10 and the standalone
Restaurant Service test pool) authored before recipes carried a
`cuisineId` at all — pre-existing, not part of any cuisine phase.

## Recipe count by ingredient

| Ingredient | Recipes | Ingredient | Recipes |
|---|---|---|---|
| tomato | 24 | avocado | 4 |
| carrot | 22 | cauliflower | 4 |
| chicken | 22 | celery | 4 |
| garlic | 21 | parsley | 4 |
| onion | 17 | pineapple | 4 |
| basil | 13 | baguette | 3 |
| pepper | 12 | lemon | 3 |
| steak | 12 | mozzarella | 3 |
| cucumber | 10 | tofu | 3 |
| potato | 9 | zucchini | 3 |
| salmon | 8 | broccoli | 2 |
| cabbage | 7 | coconut | 2 |
| mushroom | 7 | corn | 2 |
| spinach | 7 | fennel | 2 |
| bread | 6 | pumpkin | 2 |
| mango | 6 | asparagus | 1 |
| peapod | 5 | beetroot | 1 |
| | | eggplant | 1 |
| | | greenbean | 1 |
| | | orange | 1 |
| | | pear | 1 |
| | | pomegranate | 1 |
| | | radish | 1 |
| | | sweetpotato | 1 |

41 of KnifeCraft's ~52-ingredient roster are in active recipe use by Level
170 — in line with the brief's "should follow progression, not all 52"
expectation. Newly introduced this phase: tofu, radish, cabbage,
greenbean, pear, coconut (recipe use), broccoli, cauliflower (recipe use).

## Recipe count by technique

| Technique | Recipes |
|---|---|
| slice | 74 |
| dice | 54 |
| chop | 38 |
| julienne | 31 |
| rockMince | 14 |
| halve | 11 |
| peel | 6 |
| chiffonade | 5 |
| radial | 4 |
| smash | 4 |
| rings | 3 |

All 11 techniques introduced by Phase 3 (Level 40) remain in active use
through Phase 5 — no technique regresses to zero recipes, matching the
brief's own §57 requirement.

## Recipe count by cuisine

| Cuisine | Recipes |
|---|---|
| italian | 19 |
| japanese | 19 |
| french | 17 |
| indian | 16 |
| chinese | 14 |
| thai | 11 |
| (none) — pre-cuisine Phase 1–2 recipes | 10 |
| mexican | 10 |
| korean | 8 |
| mediterranean | 8 |

## Recipe count by protein

| Protein | Recipes | Target (brief §21) |
|---|---|---|
| chicken | 22 | ≥ 15 ✔ |
| steak | 12 | ≥ 15 — short by 3 |
| salmon | 8 | ≥ 15 — short by 7 |

**Honest report, not padded** (per brief §22/§55's explicit instruction):
chicken clears the target comfortably because it carries the branching
demos in three cuisines (Japanese, Chinese, Thai, Korean each use a
chicken branch/batch scenario) and is the "default" protein for generic
multi-customer pools. Steak and salmon each appear in every service
structure the brief asks for (single customer, multi-customer, batch,
branch or shared-vegetable service) but in fewer total recipes, because:
- Salmon is Japanese/Thai-only by design (its cuisine's own
  `coreIngredients` — chicken and steak both appear in more cuisines'
  ingredient lists than salmon does).
- Adding recipes purely to hit a count, without a real service-structure
  reason, would have violated brief §22 ("do not make every protein
  recipe structurally identical") and §69 ("do not create recipes merely
  to satisfy coverage"). Phase 6+ (Chapters 18+, which reuse these same 9
  cuisine families per cuisineDefinitions.ts) is the natural place to grow
  steak and salmon further within genuine new service scenarios.

## Batching / branching / allocation coverage (Levels 101–170)

- **Batching**: 14 batch-group levels (brief §34 target: ≥10) — Levels
  115, 117, 120, 125, 132, 137, 139, 140, 152, 155, 158, 160, 166, 170.
  Covers 3 ingredient categories as required: protein (chicken julienne/
  dice, steak slice), vegetable (carrot julienne), and aromatic (basil +
  garlic together).
- **Branching**: 8 levels use a real branch recipe (brief §35 target: ≥8)
  — `camp-chicken-protein-branch` (Levels 116, 120), `camp-steak-protein-
  branch` (135, 139), `camp-thai-chicken-branch` (148, 158),
  `camp-korean-chicken-branch` (168, 169).
- **Destination allocation**: every batch-group level above allocates one
  shared `PreparedOutput` across 2-3 named destinations; every branch
  recipe allocates two *independent* outputs to two named destinations.
- **Multi-customer**: 17 two-customer-ish levels and 22 three-customer-ish
  levels across 101–170; 3 customers is normal from Chapter 14 (Chinese
  Wok Service) onward, matching the brief's §33 suggested progression.

## How this was generated

`CAMPAIGN_RECIPES` and `LEVELS` were walked once each via throwaway
scripts (not committed, per this repo's `scripts/_*.mts` convention —
their logic is reproducible directly from `src/game/recipes/
campaignRecipes.ts` and `src/game/levels/levelDefinitions.ts`), counting
each ingredient/technique a recipe touches at most once per recipe, and
counting `batchGroupRecipeIds`/branch-recipe usage per level.
