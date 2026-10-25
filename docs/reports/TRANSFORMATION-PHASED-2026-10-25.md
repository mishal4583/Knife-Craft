# KnifeCraft — Transformation Phase D (2026-10-25): the oven for five more bread dishes

Base: `main` at `54e30cc` (Phase C, deployed to Pages). Work: `claude/sharp-wright-emfu2j`
(does not deploy). Not merged; nothing uploaded to Playgama.

## 1. What changed

After the cut, these dishes now bake in the Garlic Bread oven instead of the cooking film,
on every order of them (campaign, menu guest, Business):

| Recipe | Level | Id |
|---|---|---|
| Tomato Basil Toast | L6 | `camp-tomato-basil-toast` |
| Mushroom Bruschetta | L7 | `camp-mushroom-bruschetta` |
| Bruschetta for the House | L12 | `camp-bruschetta-for-the-house` |
| Family Antipasto for Two | L15 | `camp-family-antipasto-for-two` |
| Bruschetta Trio | L17 | `camp-bruschetta-trio` (its batch partner, Garden Tomato Cup, keeps the film) |

**How:** the five ids are added to `OVEN_STEP_RECIPES` (`src/game/cooking/ovenStep.ts`).
Nothing else in the game changed. Every recipe already takes the same route after the
cut: `RECIPE_COMPLETED` sets cooking to "playing", and Preparation shows the oven
in the film's place for recipes on the list. "Take it out" (or the automatic take-out at
toasty) then calls the film's own hand-over to the Knife Report. Order, Serve and pay are
untouched.

**Still cosmetic:** the doneness picks a line of text only. Score, grade, tips, pay,
wallet, ledger, achievements, rankings, rewards, save fields, prices and progression are
unchanged. Garlic Bread and every other recipe behave as before. Reduced Motion and the
automatic take-out are unchanged (the same `OvenStep`).

## 2. Not included

**Baguette dishes** (Avocado Baguette Toast L47; Baguette Rounds, Baguette & Cheddar Rounds,
Baguette Crostini Prep, menu / Business only). The adjustment they need:
- `src/components/kc/game/OvenStep.tsx:130` draws a fixed `🍞` three times on the tray.
- Replace it with a per-recipe tray glyph: e.g. a pure `trayItemFor(recipeId)` in
  `ovenStep.ts` returning `🥖` when the recipe has a `baguette` component, else `🍞`. Pass
  it from Preparation (`<OvenStep … tray={trayItemFor(view.recipeId)} />`, line 1208).
  Then add the four ids to `OVEN_STEP_RECIPES`.
- Three 28 px 🥖 fit the tray at 320 px (tray ≈ 212 px wide). `breadFilter` browns any
  glyph. No new art is needed; painted baguette frames would be optional, as for the bread.

**Potato & Onion Gratin Prep (L31):** not bread on a tray (a gratin dish); left on the film.

**Peach & Cheddar Board (L114):** a cold board, left on the film. Why the existing rule calls
it an oven dish:
- `src/game/recipes/dishKind.ts`, `dishKindFor`: any recipe with a `bread` or `baguette`
  component is kind `"bread"` (`BREAD_INGREDIENTS`). The board has a baguette component.
- `src/game/restaurant/dishService.ts:58`: `if (kind === "bread" || OVEN_NAME.test(name))
  cooking.add("oven")`. So the board's service profile says "oven" (sheet pans and oven
  mitts in the tool and cleanliness rules), and its cooking film is the bread film.
- Not changed: it feeds tools, cleanliness and the film choice, outside this task. The
  oven step itself never uses this rule; it uses its own explicit list.

## 3. Tests

**Gates:**
- `npx tsc --noEmit -p .`: clean.
- ESLint `src scripts tools`: 0 errors, 9 warnings (the existing baseline).
- `npm run build` and `npm run preflight`: pass.
- Prettier on the changed files: clean.

**QA:** all suites **120 / 120**. `oven-step-qa` (updated; the Phase C check "Garlic Bread
only" now states the developer's new scope, by decision):
- B1 exactly the six recipes use the oven; B2 each is its level's recipe; B3 all are
  bread-slice dishes (no baguette); B4 the four baguette dishes, the gratin and the board
  keep the film; B5 others (e.g. L17's batch partner) keep the film.
- D1 the oven code has no randomness, score, grade, tip, pay, reward, achievement,
  ranking, wallet, ledger or save code (the list now includes tips, pay, rewards,
  achievements and rankings).
- E1 no save, economy, level or recipe file changed since `0e0d83b`; E2 no order, serve,
  pay, oven-view, achievement or ranking code changed since `54e30cc`.

**Browser** (new `tools/e2e/ovenrecipes.mjs`, branch build): **7 / 7**.
- R1–R5 at L6, L7, L12, L15, L17: the oven after the cut (no film), "Take it out", the Knife
  Report, then Serve writes one settlement entry, and the wallet moves by exactly the new
  ledger entries.
- R6 L6 mid-bake at 390 × 844 and 320 × 568: baking, no sideways scroll, a 48 px button
  on screen (screenshots `ovenrecipes-l6-390.png`, `ovenrecipes-l6-320.png`).
- R7 no console errors.
- Baseline comparison (`54e30cc`, the same test): the film plays (so the oven checks fail
  there, as expected) and each level writes the same kinds of ledger entries: one
  settlement, plus L17's `customer-tip`, which is the same on both. Amounts follow the
  solver's cut quality.

**Regressions:** see §4.

## 4. Regression run

**Branch build (`claude/sharp-wright-emfu2j`), pass:** ovenrecipes, ovenstep, kitchenstrip,
servicefloor, restaurantday, restaurantguests, knifereport, levelflow (restaurant and
classic), platingskip, phase4, phase5, phase6.

**Fail on the branch:** cookingclip, levelux, phase2 (A9 the cloth wipe; C4 the wallet pill
`shown 40000` vs `credits 64500`). All three are recorded as pre-existing in the Phase B and
Phase C reports; the comparison on `54e30cc` follows below.
