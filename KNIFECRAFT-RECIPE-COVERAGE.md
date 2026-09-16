# KnifeCraft Recipe Coverage

Generated at the end of Phase 4 (Campaign Levels 41–100). Reflects the full
`CAMPAIGN_RECIPES` library (Phases 1–4 combined) via a one-off script over
the live data — not hand-counted.

## Totals

| Metric | Count |
|---|---|
| Total recipes | 80 |
| Total ingredients introduced | 32 |
| Total techniques | 11 / 11 |
| Total cuisines (real cuisine ids) | 5 |
| Levels implemented | 100 / 250 |
| Chapters implemented | 10 / 25 |

The 5 real cuisines (Italian, French, Indian, Mediterranean, Mexican) match
the Phase 4 brief's own "Cuisines introduced: 5/9" expected-coverage target
exactly. A 6th bucket, `(none)`, covers the 10 earliest Phase 1–2 recipes
(Levels 1–10 and the standalone Restaurant Service test pool) authored
before recipes carried a `cuisineId` at all — pre-existing, not part of
Phase 4.

No protein ingredient (chicken/steak/salmon) appears in any recipe yet —
correct and intentional: the protein-introduction curve places proteins at
Level 101+ (Chapter 11 onward), untouched by this phase.

## Recipe count by ingredient

| Ingredient | Recipes |
|---|---|
| tomato | 24 |
| onion | 16 |
| garlic | 15 |
| carrot | 9 |
| potato | 9 |
| basil | 8 |
| cucumber | 7 |
| bread | 6 |
| pepper | 6 |
| celery | 4 |
| mango | 4 |
| parsley | 4 |
| avocado | 3 |
| baguette | 3 |
| lemon | 3 |
| mozzarella | 3 |
| mushroom | 3 |
| spinach | 3 |
| zucchini | 3 |
| cauliflower | 2 |
| corn | 2 |
| fennel | 2 |
| peapod | 2 |
| pineapple | 2 |
| pumpkin | 2 |
| asparagus | 1 |
| beetroot | 1 |
| coconut | 1 |
| eggplant | 1 |
| orange | 1 |
| pomegranate | 1 |
| sweetpotato | 1 |

32 of KnifeCraft's ~52-ingredient roster are in active recipe use by Level
100 — in line with the brief's "should follow progression, not all 52"
expectation (§31).

## Recipe count by technique

| Technique | Recipes |
|---|---|
| slice | 38 |
| dice | 35 |
| chop | 21 |
| julienne | 12 |
| rockMince | 8 |
| halve | 7 |
| chiffonade | 5 |
| peel | 5 |
| radial | 4 |
| smash | 4 |
| rings | 3 |

All 11 techniques introduced by Phase 3 (Level 40) remain in active use
through Phase 4 — no technique regresses to zero recipes.

## Recipe count by cuisine

| Cuisine | Recipes |
|---|---|
| italian | 19 |
| french | 17 |
| indian | 16 |
| (none) — pre-cuisine Phase 1–2 recipes | 10 |
| mexican | 10 |
| mediterranean | 8 |

## Recipe count by protein

| Protein | Recipes |
|---|---|
| chicken | 0 |
| steak | 0 |
| salmon | 0 |

Zero by design — see "Totals" note above. Proteins are Chapter 11's
(Level 101+) own introduction and are out of scope for Phase 4.

## How this was generated

`CAMPAIGN_RECIPES` was walked once, counting each ingredient/technique a
recipe touches at most once per recipe (a recipe using tomato twice still
counts as 1 toward tomato's total), and grouping by `cuisineId`. The
one-off script used to produce these numbers was not committed (throwaway,
per this repo's `scripts/_*.mts` convention) — its logic is reproducible
from `src/game/recipes/campaignRecipes.ts` directly.
