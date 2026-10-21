# KnifeCraft — Phase 1 "Core Cutting Satisfaction" — engineering report

Repo: D:\byte\not8n\_clones\Knife-Craft (branch `main`, NOTHING committed or pushed —
the repo's CLAUDE.md forbids commits without the developer's approval).

## Headline
Workstream A was already ~70% implemented in the shipped game. The real gaps were the
combo system (entirely a stub: `currentCombo: 0` hardcoded), audio differentiation,
"New Best!"/improvement feedback, and replay double-press safety. Those are now done.

TWO ITEMS ARE BLOCKED ON A DESIGN CONFLICT AND WERE NOT IMPLEMENTED — see "Open questions".

## Files changed (349 insertions, 7 deletions across 7 files + 2 new)
- src/game/definitions.ts — new `CUT_DRAG` and `COMBO` config blocks (documented, no magic numbers)
- src/game/AudioManager.ts — `playComboMilestone(index)`, `playIngredientComplete()`
- src/game/events.ts — `combo: number` on CutCompletedPayload
- src/game/scenes/PreparationScene.ts — combo derivation, combo/perfect pitch, axis-aware
  board drag, `reducedMotion()`, ingredient-completion chime
- src/components/kc/game/Preparation.tsx — combo state, milestone toast, replay latch, best baseline
- src/components/kc/game/GameHUD.tsx — combo meter on the order card
- src/components/kc/game/KnifeReport.tsx — "New Best!" + improvement line
- NEW src/game/bestVerdict.ts — pure, unit-tested comparison
- NEW scripts/phase1-cutting-qa.mts — 40 assertions, ALL PASS

## Gates (all run, all green)
tsc 0 errors · eslint 0 errors (7 pre-existing warnings) · prettier clean ·
build OK · preflight all hard checks pass · 9 QA suites PASS incl. new one

## e2e baselines — PRE-EXISTING FAILURES CONFIRMED BY A/B
Reverted all changes, rebuilt, re-ran, restored. IDENTICAL failures both ways:
- adsflow.mjs: ALL PASS (before and after)
- coach.mjs: 5b, 8a FAIL + TimeoutError — PRE-EXISTING
- economyv25.mjs: 2f, 4a, 4b, 4c, 4d, 4e FAIL — PRE-EXISTING
(CLAUDE.md claims "Known pre-existing failures: none" — that line is STALE.)

## Live browser QA at 320x640 (screenshots in tools/e2e/out/phase1/, gitignored)
- combo meter ×2…×11 on the order card, never over the board
- "Clean ×10!" toast fired EXACTLY once, y 467–496 (clear of board and card)
- slice separation visible; plating gathers to a neat plate
- first run: "your first plate of this dish" (no false New Best) — correct
- seeded best=30, replayed, scored 84 → "✦ NEW BEST!" + "Cleaner than your best +180%"
  ((84-30)/30 = 180% exactly; game then banked 84). Save restored to the real 95.
- double-press "Prepare Again" → exactly one clean restart
- no horizontal scroll at 320; desktop contain-fit OK

## Open questions (NOT implemented, need developer approval)
1. A2 rotation/toppling. definitions.ts PIECE_SETTLE documents an explicit
   player-tested rule: "a cut piece does NOT fall, stack, or rotate … see the porting
   report for how skipping the 'no rotation' rule produced crossing, chaotic-looking
   pieces on angled cuts." Separation already exists. Adding rotation would revert a
   deliberate decision, so it was left alone.
2. B4 "show the previous best AND the new result". Design Law 4 forbids a visible
   score/percentage as a success readout, and OrderComplete.tsx records a prior agent's
   attempt being REJECTED ("the star/percentage system is not approved, full stop").
   Implemented the RELATIVE improvement only; absolute before/after digits withheld.
3. A3 rough-cut sound: the engine commits only guide-snapped cuts
   (`proxyCutQuality(0,0,1)` is constant), so no rough-cut state exists. Per the brief,
   no penalty system was invented.

## Follow-up (same day): both overrides implemented on the developer's instruction
- A2 settle tilt: PIECE_SETTLE.TILT_RAD 0.045 (~2.6 deg), proportional to the piece's
  offset across silhouette.rx, never reads the cut angle, pivots on the centroid
  (settleTilt / tweenSettle in PreparationScene). Live, 11 pieces: -1.88 ... +0.01
  (centre) ... +2.27 deg, monotonic. Reduced Motion -> 0.
- B4 digits: "Best 30 -> 100" on the New Best line only (formatScorePair in
  bestVerdict.ts; sr-only sentence). Live: 30 -> 100, +233% (correct).
- Override recorded: PIECE_SETTLE doc, settlePiece doc, KnifeReport doc,
  REFERENCE §10 new subsection + §5 suite bullet, HANDOFF top entry.
- REFERENCE §5 "Known pre-existing failures" now lists coach 5b/8a+timeout and
  economyv25 2f/4a-4e (A/B verified).
- QA: old F11 (Law 4) replaced by F11-F17 + new H1-H8; 14 suites PASS; e2e identical
  to baseline.
- FOUND (pre-existing, not fixed): Knife Report stats grid overflows at 320px —
  grid-cols-[1fr_auto] can't shrink below the Rhythm text, CutPathViz pushed to
  x 332-428 past the card edge (308); values "100" clip to "10". Grid unchanged
  from HEAD; my line proven not the cause (identical measurements with it hidden).
