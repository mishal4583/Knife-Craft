# KnifeCraft — Transformation Phase F (2026-10-25): recipe classification audit

Base: `main` at `62c8a6d` (Phase E, deployed). Work: `claude/sharp-wright-emfu2j` (does not
deploy). **Audit only: no game code is changed.** A minimal patch is proposed below for
review. Not merged; nothing uploaded to Playgama.

## 1. Root cause

Peach & Cheddar Board (`camp-peach-cheddar-board`, L114, Business "Appetizer") is a cold
board: "Sharp cheddar, ripe peach and sliced baguette to share". All four components are
cut onto the plate (halve and slice the peach, slice the cheddar, slice the baguette).
Nothing is baked.

1. `src/game/recipes/dishKind.ts` `dishKindFor`: a recipe is kind `"bread"` if **any**
   component is in `BREAD_INGREDIENTS` (`bread`, `baguette`) **or** its name matches
   `BREAD_NAME` (`bread|toast|bruschetta|crostini`). The board has a baguette component, so
   it is `"bread"`.
2. `src/game/restaurant/dishService.ts:58`: `if (kind === "bread" || OVEN_NAME.test(name))
   cooking.add("oven")`. So the board's service profile says `cooking: ["oven"]`.

**Not involved:** `OVEN_STEP_RECIPES` (`src/game/cooking/ovenStep.ts`) is an explicit list
of ten ids and does not read `dishKindFor`. The board isn't on it, so it already uses the
cooking film after the cut. QA `oven-step-qa` B5 checks this.

## 2. Consumers of the classification

| Consumer | Reads | What it decides |
|---|---|---|
| `Preparation.tsx` → `CookingClip` | `dishKindFor` (`kind`) | which film plays after the cut (bread → "topping bruschetta" film, plated → plating film, …); not shown for the ten oven recipes |
| `kitchenTools.ts` `toolsNeeded` | `cooking` (`oven`), `kind` | the Pre-Service Check's tools: **sheet pans and oven mitts when `oven`** |
| `serviceSupplies.ts` `coverPiecesFor` | `kind` (bread), `cooking` (pot), `shared`, `protein` | dine-in tableware per cover (bread → side plate + dinner knife) |
| `serviceSupplies.ts` `takeawayPiecesFor` | `kind` (bread), `cooking`, `shared`, the name | takeaway container (bread → food wrap; a non-bread shared "combo" → thali tray), bag, cutlery pack (none for bread) |
| `serviceSupplies.ts` `orderServiceFor` | `takeawayPiecesFor` | dine-in or takeaway: a thali-tray dish uses the curry takeaway share (0.6) |
| `serviceSupplies.ts` `dineInExtrasFor` | `kind` (bread), `cooking` | deli sheets for bread and fried food |
| `cleanliness.ts` | `cooking` (anything but oven/pot) | the grease chore: **`oven` is ignored**, so no effect |

`cooking: "oven"` itself is read only by the kitchen tools. Supplies and the film read the
dish **kind**.

## 3. Every recipe the shared bread rule touches

All 222 campaign recipes were read. 12 are `bread` kind or have `oven`:

| Recipe | Level | Why bread / oven | Intended flow | Today |
|---|---|---|---|---|
| Garlic Bread | L5 | ingredient + name | oven | oven ✓ |
| Tomato Basil Toast | L6 | ingredient + name | oven | oven ✓ |
| Mushroom Bruschetta | L7 | ingredient + name | oven | oven ✓ |
| Bruschetta for the House | L12 | ingredient + name | oven | oven ✓ |
| Family Antipasto for Two | L15 | **ingredient only** | oven (Phase D) | oven ✓ |
| Bruschetta Trio | L17, L19 | ingredient + name | oven | oven ✓ |
| Avocado Baguette Toast | L47 | ingredient + name | oven (🥖) | oven ✓ |
| Baguette Rounds | none | ingredient + oven name | oven (🥖) | oven ✓ |
| Baguette & Cheddar Rounds | none | ingredient + oven name | oven (🥖) | oven ✓ |
| Baguette Crostini Prep | none | ingredient + name | oven (🥖) | oven ✓ |
| Potato & Onion Gratin Prep | L31 | oven name only (kind `cooked`) | film; a gratin does use an oven | film ✓; tools say oven (correct) |
| **Peach & Cheddar Board** | L114 | **ingredient only** | **film, cold, no oven** | film ✓; **tools say oven ✗** |

**Finding:** only two recipes are bread **by ingredient alone**: the board and Family
Antipasto for Two. Antipasto is an intended oven dish. So changing the shared ingredient
rule (for example "bread only by name", or "not when shared") would also reclassify
Family Antipasto, changing its tools, tableware and packaging at L15. **The shared rule
should not change.**

## 4. Options, measured

Each option was applied in the working tree only. All QA suites and 32
economy/supply/tool/campaign scripts were run, and their output was diffed against the
unchanged code. The original files were restored after each run (checked with `cmp`).

**A. The board is kind `"plated"`** (an id override in `dishKindFor`). One recipe profile
changes (`bread/oven` → `plated/none`), but every consumer moves:
- tools: no sheet pans or oven mitts;
- tableware: dinner plate, fork and knife plus a side plate (was side plate and knife);
- takeaway: a **thali tray** as a shared combo, plus a cutlery pack (was food wrap);
- **dine-in or takeaway: as a thali dish it now takes the curry takeaway share (0.6)**;
- no deli sheet; the film becomes the plating film.
- **Economy moves:** the completionist's L150 cash goes Local $132,066 → $132,104,
  Wholesale $132,250 → $132,233, Premium $133,538 → $133,541; L91 supply spend +$12; the
  takeaway QA counts 6 thali "curry" orders instead of 5. All suites still pass, but by the
  project rules an unexplained figure move is a regression. **Not recommended.**

**B. The board keeps kind `"bread"` and loses only `oven`** (an id exclusion in
`dishServiceFor`). One recipe profile changes (`cooking: ["oven"]` → `[]`):
- tools: sheet pans and oven mitts are no longer listed **for this dish**. Both are already
  owned by L114 (needed since L5 for Garlic Bread, and still needed by the other oven
  dishes);
- tableware, takeaway, the takeaway rate, deli sheets, cleanliness and the film:
  **unchanged**;
- **economy: 0 diffs in all 32 scripts** (economy final sim and candidates, campaign
  simulation, restaurant final economy, economy pass, supplies, takeaway, tools, …);
- QA 119 / 120. The one failure is `oven-step-qa` E2, the guard that forbids any
  `dishService` change since Phase D; it would be restated to allow exactly this change.
- **Recommended: the smallest safe fix.**

**C. Change nothing.** The board already uses the film. The only wrong output is "sheet
pans + oven mitts" in its tool reasons, and those tools are owned anyway by L114.

**Not addressed by B:** the board keeps the bread film ("topping bruschetta"). Changing the
film alone would need a film-only override in `Preparation` (the `kind` passed to
`CookingClip`), separate from supplies. Optional, and only if you want it.

## 5. Proposed patch (option B, not applied)

```diff
--- a/src/game/restaurant/dishService.ts
+++ b/src/game/restaurant/dishService.ts
@@ -37,6 +37,12 @@
 const OVEN_NAME = /bread|toast|bruschetta|crostini|baguette|gratin|rounds/i;
+/**
+ * Cold boards served with sliced bread (Transformation Phase F, 2026-10-25): their bread
+ * is sliced, not baked, so they need no oven (sheet pans, oven mitts). They stay kind
+ * "bread" for the clip, tableware and packaging.
+ */
+const COLD_BOARD_RECIPE_IDS: ReadonlySet<string> = new Set(["camp-peach-cheddar-board"]);
@@ -55,7 +61,8 @@
-  if (kind === "bread" || OVEN_NAME.test(recipe.name)) cooking.add("oven");
+  if (!COLD_BOARD_RECIPE_IDS.has(recipe.id) && (kind === "bread" || OVEN_NAME.test(recipe.name)))
+    cooking.add("oven");
```

**Tests that would come with it:**
- New QA checks (in a small `dish-classification-qa`, or in `oven-step-qa`):
  - the board's profile is `kind "bread"`, `cooking []`, and `toolsNeeded` at L114 lists
    no sheet pans or oven mitts for it;
  - every other recipe's `dishServiceFor` profile is identical to `62c8a6d`'s (a snapshot
    of the 221 others);
  - `dishKindFor` is unchanged for all 222;
  - the ten oven recipes keep `cooking` including `"oven"`, and stay on
    `OVEN_STEP_RECIPES`.
- `oven-step-qa` E2 restated to allow this one `dishService` change (by decision).
- Re-run the economy suites (expected: no change) and the oven browser tests.

## 6. Test results (this audit)

- **Baseline `62c8a6d` (no code change):** QA 120 / 120; typecheck, lint, build and
  preflight as in Phase E.
- **Option A:** QA 119 / 120 (only the `oven-step-qa` guard); the economy moves as listed in §4.
- **Option B:** QA 119 / 120 (only the `oven-step-qa` E2 guard); 0 economy diffs.
- **Oven flow:** for both options, the ten oven recipes' profiles and `OVEN_STEP_RECIPES`
  are unchanged (only the board's profile differs), so the oven, the Knife Report and Serve
  are untouched. No browser run was needed for an unapplied change. With B applied, the
  oven browser tests (`ovenstep`, `ovenrecipes`, `ovenbaguette`) and the restaurant
  regressions would be re-run against `62c8a6d`.

## 7. Risks

- **B:** an id list means a future cold board with bread must be added by hand. In
  exchange, no other recipe can change silently. The board's tool reasons lose "oven", and
  the tools stay owned.
- **A or any shared-rule change:** moves money (takeaway rate, packaging) and would
  reclassify Family Antipasto for Two.
- **Film:** under B the board still plays the bread film; a film change is a separate,
  optional decision.
