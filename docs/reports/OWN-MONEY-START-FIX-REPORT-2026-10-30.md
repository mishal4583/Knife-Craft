# Own-money start and full fix pass — report, 2026-10-30

Request (developer): remove Grandma's pantry, leftovers and every free gift; the player buys
everything with their own money from the Market; the Market is open from the start with a hand
pointing at the first shopping; the completionist ends with at least $150,000; make Levels 1–30
engaging; "make a checklist, fix all in the right order, do not skip any, report what is fixed and how".

Nothing is committed yet. Build version is still 1.5.1.

## Result of the final checks

| Check | Result |
|---|---|
| `npx tsc --noEmit -p .` | pass |
| ESLint `src scripts tools` | 0 errors, 9 old warnings |
| `npm run build`, `npm run preflight` | pass |
| QA suites (`scripts/*-qa.mts`, 127) | 126 pass; `phase5-qa` A3 fails until commit (it diffs `restaurantInvestments.ts` against `HEAD`) |
| Browser: firstshop 7/7, cashflow 5/5, cashreload 4/4, guide 8/8, levelflow all pass, servicefloor all pass, resize all pass, lazyload all pass | pass |

## Checklist: what was fixed and how

**A. The first run**
- A1 Free gifts removed. `grandmasFridge.ts` deleted; Grandma's tools, cleaning cupboard and leftovers are no
  longer granted (`kitchenTools.ts`, `cleanliness.ts`, `App.tsx`). Old saves keep the fields (`grandmasFridge?: unknown`,
  `GrandmasToolsState`) but nothing reads them. `restaurant-grandmas-fridge-qa` is rewritten as a "no free gifts" suite.
- A2 Own money. A new game starts with $10.00 (`SaveManager` default). Level 1's food costs less than that;
  the first levels' food is paid from what the levels earn. A short service still has the ad / supplier-credit
  safety net, so there is no soft-lock.
- A3 Market from the start. `INGREDIENT_STOCK_FIRST_LEVEL = 1`; Market and Inventory are open at Level 1.
  A new player lands on the Kitchen after the intro; Grandma's pointer points at the Market first, "Show me"
  opens the ingredients, and the plan shows a hint and a hand on the first Buy.
  Note: the chef knife and walnut board are free starter items, so the hint says so instead of asking to buy them.

**B. Economy**
- B1 Completionist target. Level pay re-planned (`curatedRewardAt`: $50 at L1, +$40 a level to L40, then +$6;
  finale $5,000). Simulation ends near $292k with achievements collected; baseline re-recorded in CLAUDE.md.
- B2 Kitchen prices set to the developer's figures (Growing $60,000, Established $12,000, Neighborhood Café $18,000) in both
  the restaurant rules and the classic catalog. The ladder is not ascending (Growing is the dearest): flagged, left as asked.
- B3 Cash left on the table is saved with the paid order (`pendingCash`) and settled on load or when the player leaves the
  table; one ledger entry per movement; wallet = opening cash + signed ledger.

**C. Content and flow (Levels 1–30)**
- C1 Cleaning and night chores from Level 5, with a hygiene tip share (dirty 0.5 / clean 1.25); nothing was deleted.
- C2 Restaurant Guide (Next-step card) for the second floor, machines, staff, kitchen and fridge upgrades, achievements.
- C3 Dead leftovers of the two removed levels cleaned out (practice-level branch, practice recipe, unused exports/wrappers).
- C4 Seven untaught Business dishes and technique first-use levels re-pinned to the 148-level campaign.

**D. Tests**
- D1 42 failing suites brought to the new rules by updating the expected values (never weakening): level numbers shifted
  by −2, $10 start, Market at L1, new pay curve, new kitchen prices, CRLF-safe source slicing, Windows quoting.
  Every changed expectation says the rule and date in a comment.
- D2 Browser tests: `startFirstLevel` helper added to `tools/e2e/harness.mjs`; cashflow, cashreload, levelflow, guide
  and resize updated for the shop-first start.

## Not fixed / still open (honest list)
- `phase5-qa` A3 passes only after the commit.
- Stale browser tests not re-run or re-seeded: `walkins`, `phase2` B2–B6/C1, `restaurantcleanliness`, and the ~60 other
  `tools/e2e` scripts whose seeds use `campaignVersion: 2` (the harness still stamps 2 on purpose: changing it broke `servicefloor`).
- Overlapping progression tracks, the cosmetic oven / dining room, Endless after Level 148 and the classic-build burden are unchanged.
- Level 2 now teaches halve + peel together (technique timing shifted by the level removal).
- Not committed or pushed; Playgama upload untouched.
