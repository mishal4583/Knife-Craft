# KnifeCraft — Phase 2 report (2026-10-21) — working tree only, nothing committed

## Approvals obtained (AskUserQuestion)
- Tip ledger: own `customer-tip` category (additive; entry shape unchanged), in the same save as the order pay.
- Tip rule: 1 in 3 first-time Masterful campaign orders, 10% of that order's pay, whole dollars, min $5.

## Payment lifecycle (traced)
Serve tap -> App.serveCampaignOrder / serveBatchGroupViewedOrder: settlement computed, wallet credited and ONE
`campaign-settlement` entry written in a single persist (gated by isReplay / mayPayOrder). "Finish Level" ->
separate `completion-reward`. So the cash vacuum is pure presentation over money already in the wallet.

## Built
- A Debris (`game/boardDebris.ts`): 1/cut, 1/ring, 2/smash, 3/peel; cap 40; session list, never saved; seeded;
  board margins; ONE Graphics at depth 1. Scraper offered at an order's START (or Prepare Again) at 30+ pieces
  (~every 2–3 orders); takes the board's pointer (no cut possible); 45% sweep cleans; Skip; lost-pointer guard;
  polish glint + squeak + sparkles; Reduced Motion instant; coach waits. e2e solver scrapes when offered.
- B Cash (`game/cashBurst.ts`, `CashVacuum.tsx`): 4–14 pieces adding up EXACTLY to pay + tip (gold = tip);
  swipe (generous radius, pointer capture, touch-none) or auto-collect (session toggle in the wallet row,
  forced on with Reduced Motion); each piece once; wallet pill = credits − cash on counter (rolls, lands
  exactly); Serve latched (double tap pays once).
- C Celebration: till sound on the real payment; customer reacts to the dish's own grade (cheer +
  "👏 Exceptional!" for Masterful, nod for Clean); tip line "💸 Generous tip! +$X"; tip sound (own method).
  Tips (`economy/customerTips.ts`): FNV-1a + murmur3 finalizer, no RNG. Real campaign: 71/242 orders can tip
  (29.3%, within 2σ of 1/3; plain FNV-1a was 40.5% — fixed), tips $12–$68, worst case $2,151 = 1.79% of income.
- 320×568 fix: served card 641px -> 548px (toggle into wallet row, tray 68px, chip inline); never taller than
  the screen (scrolls in the rare worst case, never clips). Swipe hint on an ivory backing.

## Verification (final build)
- tsc 0 errors; eslint 0 errors (7 pre-existing warnings); preflight passes; Prettier on changed code files
  (App.tsx and definitions.ts are NOT Prettier-clean on HEAD — left unformatted to avoid unrelated churn).
- ALL 109 QA suites: 104 pass; 5 fail IDENTICALLY on a pristine HEAD worktree (pre-existing):
  ad-bonuses-qa (C1, C3, D2), business-experience-qa (E), business-final-audit-qa (F2),
  business-order-frequency-qa (J4), business-rush-restock-qa (F2–F4). economy-v2-final-qa (frozen baseline) PASSES.
  Found & fixed along the way: audio-qa S1 (tip sound moved out of the ten-effect table into playTip()),
  phase2-qa B10 (assertion followed the toggle's move).
- Browser: phase2.mjs 29/29 (positive tip path: Level 17 batch Masterful -> pay $312.20 + tip $31.00 exactly,
  own entry, cheer, gold piece = tip, 320×568 fits without scrolling, sweep pays nothing more);
  knifereport, adsflow, levelux (classic) all pass; coach 5b/8a+timeout and economyv25 2f/4a–4e identical to baseline.
- Screenshots: tools/e2e/out/phase2-cleanup-320.png, phase2-cash-320.png, phase2-tip-320.png.

## Save / economy
No save-schema change (SaveManager.ts, src/types untouched). The only new money path is the approved tip
(two ledger writes, one per first-payment path). `economy.lifetime` gains a "customer-tip" key when a tip is
paid (the existing per-category map). Base payouts, replay, Replay Bonus unchanged.
