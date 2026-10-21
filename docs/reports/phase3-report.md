# KnifeCraft — Phase 3 report (2026-10-21) — working tree only, nothing committed

Repo: D:\byte\not8n\_clones\Knife-Craft. No commit, no BUILD_VERSION change, no upload.

## 1. Instructions and key files inspected
CLAUDE.md (FlowBuilder's; the clone has none of its own) + docs/REFERENCE.md, docs/HANDOFF.md, tools/e2e/README.md.
Inspected: PreparationScene.ts (combo, cleanup, plating, pause, layout, textures), GameBridge.ts, events.ts, PauseManager.ts,
Preparation.tsx, KnifeReport.tsx, CookingClip.tsx, GameHUD.tsx, Kitchen.tsx (OrderBoard), ScreensRouter.tsx, data.ts,
App.tsx (session kinds, coaching, RESTAURANT_MODE), coaching.ts, definitions.ts (COMBO, techniques, geometry),
texture painters, business/businessInspection.ts, restaurant/restaurantEvents.ts, SaveManager.ts.

## 2. Files changed / added (Phase 3 only)
New: game/fever.ts (rules), game/prepRush.ts (rules, scoring, sequence, geometry), game/scenes/PrepRushScene.ts (belt game),
game/PrepRushBridge.ts (its own Phaser game, GameBridge's safeguards), components/kc/prepRush/PrepRush.tsx + lazyPrepRush.ts
(screen, lazy chunk), game/kitchenChaos.ts (Director: cadence, rotation, eligibility, copy, dev-only hook),
game/specialVariants.ts (variants: cadence, hue remap painting), game/specialsReport.ts (Knife Report lines),
scripts/phase3-qa.mts, tools/e2e/phase3.mjs.
Changed: PreparationScene.ts (Fever; decideSpecials; ingredient scale for Giant/Giant Cucumber clamped to the board; variant
overlay + cut flecks; Vegetable Avalanche; Rush Hour time scale at plating; pointer gating + coach block), events.ts
(FEVER, SPECIALS, AVALANCHE, AVALANCHE_SKIP, StartPreparationConfig.specials), GameBridge.ts (forwarding, skipAvalanche),
Preparation.tsx (Fever layer; specials card; avalanche card; Grandma chip; inspection read; report lines; clip rate),
GameHUD.tsx (🔥 on the combo chip), KnifeReport.tsx (specials lines), CookingClip.tsx (rate prop), App.tsx (orderSpecials prop:
eligibility + inspect callback; music mood for prep-rush), ScreensRouter.tsx + data.ts + Kitchen.tsx (prep-rush screen,
route, order-board tile), styles.css (Fever keyframes, reduced motion), tools/e2e/solver.mjs (sweeps/skips an avalanche),
docs (REFERENCE §5 + §10, HANDOFF, e2e README).

## 3–6. Workstreams
A Fever Mode — Clean ×10 (an existing milestone) lights it once per order; 6 s on the scene clock (pauses with the game);
ends at plating/restart; glow+trail, stronger flecks/drag/separation, pitch ×1.04, vignette + countdown bar (pauses), 🔥 chip,
start/end sounds, "What a run!". No score change. Reduced Motion: no breathing/flecks/drag boost.
B Endless Prep Rush — order-board tile → own screen; seeded conveyor (tomato/onion/orange/potato, never 3 in a row);
swipe = cut (through the middle = clean +5), tap cuts (never clean), +10 every 5 in a row, a miss resets the run; speed
and spacing step every 10 s to caps; ≤6 on the belt; 60 s or 5 misses; results + session best (memory only); Pause
(Resume/Restart/Back), Replay, Back to Orders (stops, un-pauses, tears down the WebGL game). No save/money/progress.
C Kitchen Chaos Director — after 3 eligible orders then every 4th; rotation Giant → Avalanche → Rush Hour → Grandma's
Challenge → Perfect Plating → Kitchen Inspection; eligible = Level 11+ (or a Business order) and no technique being taught;
unfit events pass to the next; never with the bench scraper. Decided once per order in the scene (restart keeps it).
 - Giant: first ingredient ×1.35, clamped to 86% of the board's half-size (bread came out ×1.22).
 - Avalanche: 8 small vegetables hold the board until swiped/skipped; fully destroyed; once per order; resize-safe.
 - Rush Hour: plating/hand-off ×1.6 (scene clocks), cooking film ×1.5. Nothing timed is scored → grades unchanged.
 - Grandma's Challenge: reach Clean ×8 (live chip); needs a step of 8+ cuts.
 - Perfect Plating: there is NO plating interaction to judge, so the judge reads the Knife Report's Evenness (≥90 = stamp).
 - Kitchen Inspection (assessment: feasible without Phase 4 systems): friendly visit; at the report the live
   `inspectBusiness(save)` verdict (pure read; no fine, no state); restaurant build only.
 - Food Critic was NOT built as a chaos event (it is Phase 4's customer).
D Variants — Golden Tomato, Giant Cucumber (×1.3), Rainbow Carrot, Frosted Onion, Grandma's Heirloom Pepper: every 3rd
eligible order with a base ingredient; same ingredient id/cuts/grading/stock; skin pixels re-hued on the ingredient's own
texture (stems/leaves keep colour) so pieces and plate carry it; cut flecks; announced (again when it reaches the board);
"✨ Made with a …" on the report.
Counters are per page session (a reload starts over). Dev builds only: window.__kcSpecials.chaos(id)/.variant(id).

## 7. Save / economy
No save-schema change (SaveManager.ts, src/types untouched — phase3-qa E1); no new ingredient id (E2); no new ledger write
(App's ledger writes = HEAD + Phase 2's two — E3); nothing persisted (E4). Inspection reads only. economy-v2-final-qa passes.

## 8. Verification
- tsc 0 errors; eslint 0 errors (7 pre-existing warnings); Prettier on changed files (App.tsx, definitions.ts, Kitchen.tsx,
  ScreensRouter.tsx are not Prettier-clean on HEAD — left as they are); `npm run build` + classic build OK; preflight passes;
  production bundle has no `__kcSpecials`; Prep Rush is its own lazy chunk.
- QA: 110 suites → 105 pass. The 5 failures are IDENTICAL check-for-check to a pristine HEAD worktree (pre-existing):
  ad-bonuses, business-experience, business-final-audit, business-order-frequency, business-rush-restock.
  economy-v2-final-qa (frozen baseline) passes; phase2-qa and phase3-qa (A1–E4) pass. Found & fixed: phase1-cutting-qa E5,
  a static regex broken by Prettier wrapping `comboPitch * (perfect ? 1.06 : 1)` (behaviour unchanged).
- Browser phase3.mjs, 49 checks: B 15/15 and D 11/11 in the full run; A 6/6, C 15/15, Z 2/2 after test-side fixes (bootAt
  waited too little before touching Bridge storage → console errors; toast is CSS-uppercased; the restaurant HUD shows a
  moment before the scene announces). No game code changed between those runs.
  Level 18 was swapped for Level 21 in D4: the e2e solver stalls on Level 18's onion dice at 5/6 on pristine HEAD too.
- Regression browser: knifereport, adsflow, levelux (classic) pass; coach (5b, 8a, TimeoutError) and economyv25 (2f, 4a–4e)
  fail exactly as on the recorded baseline. phase2.mjs: 28/29 — B5 (the served card at 320×568 needs 1 px more than it has,
  556 px) is a Phase 2 margin exposed by the random customer line wrapping; not caused by Phase 3; fixed in Phase 4's
  serve-card work and re-run there.
Screenshots: tools/e2e/out/phase3-*.png (rush-playing-320, rush-results-320, avalanche-320, golden-tomato-320,
inspection-report-320, giant, fever, giant-cucumber, rainbow-carrot, frosted-onion, heirloom-pepper).
