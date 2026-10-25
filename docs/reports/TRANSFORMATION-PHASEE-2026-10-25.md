# KnifeCraft — Transformation Phase E (2026-10-25): the oven for the baguette dishes

Base: `main` at `cc46bbd` (Phase D, deployed to Pages). Work: `claude/sharp-wright-emfu2j`
(does not deploy). Not merged; nothing uploaded to Playgama.

## 1. What changed

The four baguette dishes now bake in the oven after the cut, on a baguette tray:

| Recipe | Id (checked in `campaignRecipes.ts`) | Where it is cooked today |
|---|---|---|
| Avocado Baguette Toast | `camp-avocado-baguette-toast` | Level 47 |
| Baguette Rounds | `camp-baguette-rounds` | no level, menu guest or Business dish |
| Baguette & Cheddar Rounds | `camp-baguette-cheddar-rounds` | no level, menu guest or Business dish |
| Baguette Crostini Prep | `camp-baguette-crostini-prep` | no level, menu guest or Business dish |

The last three appear only in old source levels the 150-level campaign doesn't select. They
have no Business dish, so no menu guest orders them, and Endless replays campaign levels. They
are on the oven list as asked and will use it wherever they are cooked.

**Code:**
- `src/game/cooking/ovenStep.ts`: the four ids added to `OVEN_STEP_RECIPES` (now ten);
  `BAGUETTE_TRAY_RECIPES` and a pure `trayItemFor(recipeId)`, which returns 🥖 for these four
  and 🍞 for everything else.
- `src/components/kc/game/Preparation.tsx`: passes `tray={trayItemFor(view.recipeId)}`.
- `src/components/kc/game/OvenStep.tsx`: a `tray` prop replaces the fixed 🍞 (three items,
  `data-testid="oven-tray-item"`).

**Unchanged:** the six existing oven recipes (still 🍞); the gratin and the Peach & Cheddar
Board (still the film); `dishKindFor` and `dishService`; the order → oven → Knife Report →
Serve flow; Reduced Motion and the automatic take-out; score, grade, tips, pay, wallet,
ledger, rewards, progression and saves.

## 2. Tests

**Gates:**
- `npx tsc --noEmit -p .`: clean.
- ESLint `src scripts tools`: 0 errors, 9 warnings (the existing baseline).
- `npm run build` and `npm run preflight`: pass.
- Prettier on the changed files: clean.

**QA:** all suites **120 / 120**. `oven-step-qa` is updated: the Phase D checks for "six
recipes, baguette dishes excluded" now state the developer's new scope (by decision).
- B1 exactly the ten recipes, no duplicates; B2 each level's recipe (L5, L6, L7, L12, L15,
  L17, L47) is the one listed.
- B3 the six bread dishes use bread and bake 🍞; B4 the four baguette dishes exist, use a
  baguette and bake 🥖.
- B5 the gratin and the Peach & Cheddar Board keep the film; B6 other recipes keep the film,
  and `trayItemFor` defaults to 🍞.
- D1 no randomness, score, grade, tip, pay, reward, wallet, ledger or save in the oven.
- E1 no save, economy, level or recipe file changed since `0e0d83b`. E2 since `cc46bbd` no
  App, restaurant (incl. `dishService`), progression or `dishKind` code changed, and every
  changed line in Preparation and OvenStep is about the tray.

**Browser** (new `tools/e2e/ovenbaguette.mjs`, branch development server): **6 / 6**.
- How: only Avocado Baguette Toast has a level (L47, a late service that needs five hires
  and takeaway supplies), and the other three have none. So the test puts each dish in
  Level 6's place in memory (the page's own `LevelManager` module; nothing is saved) and
  plays it. The oven is chosen by recipe, not by level; QA B2 checks L47's recipe.
- B1–B4: each dish shows the oven after the cut (no film) with a 🥖 ×3 tray, then "Take it
  out", the Knife Report, and Serve writes one settlement entry. The wallet moves by
  exactly the new ledger entries (Baguette & Cheddar Rounds also wrote a `customer-tip`;
  see §3).
- B5 Avocado Baguette Toast mid-bake at 390 × 844 and 320 × 568: the 🥖 tray, no sideways
  scroll, the 48 px button on screen (screenshots `ovenbaguette-390.png`,
  `ovenbaguette-320.png`).
- B6 no console errors.

**Not driven:** Avocado Baguette Toast through Level 47's real Pre-Service Check (hires,
takeaway supplies). Its oven path is the same code path, chosen by recipe id.

**Visual note:** as with the bread, the browning is a colour filter on the emoji and reads
weakly on 🥖; the bar carries the timing.

## 3. Baseline comparison and regressions
