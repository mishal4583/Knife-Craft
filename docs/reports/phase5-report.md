# KnifeCraft — Phase 5 report (2026-10-21) — working tree only, nothing committed

## Decisions (AskUserQuestion)
- Streak = days in a row the free daily gift is TAKEN (not Today's Special, which keeps its own streak).
- Rewards: fixed $100 on Day 3, $300 on Day 7.

## Baseline found
- Restoration art already existed: one painted Kitchen skin per kitchen tier (6) + map art per tier, driven by
  `save.equippedKitchenUpgradeId` (KitchenBackground, kitchenMapArt). Tiers are bought (purchaseKitchenUpgrade, atomic,
  App.buildKitchenUpgrade reads saveRef so a double tap buys once). No reveal existed.
- Daily gift: one "daily-reward" ledger entry per day (`knifecraft-daily-gift-<day>`), kept 36 h; a sheet opened once per
  session; no Kitchen entry point after "Later"; no gift streak. Today's Special has `dailyOrder.streak` (persisted).

## Built
- game/kitchen/restoration.ts: 6 tiers → 4 stages (Inherited / Cleaning & Repair / Improved / Restored Family
  Restaurant); per-tier changes (lighting, equipment, workstation, furniture) describing the actual paintings; family
  objects kept in every painting (arched window, wooden worktop, green cupboards, copper pans).
- kc/RestorationReveal.tsx (opened by App only after a successful, saved build; one at a time): before → wipe → after
  (major 0.7 s + 1.4 s; within-stage 0.35 s + 0.8 s), Skip, Continue, Reduced Motion = instant, timers cleaned.
- game/daily/giftStreak.ts: streak from the ledger; Day 3 +$100 / Day 7 +$300 paid inside takeDailyGift (same save, own
  "daily-reward" entry, once); day after Day 7 = new week; missed day = Day 1 again, nothing removed.
- EconomyLedger trim: gift + streak entries kept 9 days (was 36 h for gifts) — bounded (~18 entries).
- kc/DailyGiftCard.tsx on the Kitchen (from Level 3): ready + amount / ✓ Taken today; 7-day row with Day 3/7 marked; the
  reward ahead; tap opens the existing sheet (now shows "Gift streak · Day N of 7" + today's reward); re-reads the day
  every 30 s and on resume.
- AdBonusSheet shows the streak before and what landed after; App's two gift paths report the reward.
- Exported KITCHEN_SKIN_SRC and previousDayKey (no behaviour change). Docs: REFERENCE §5/§7/§10, HANDOFF, e2e README.

## Save / economy
No save field, no storage. Kitchen tiers, prices (catalog and the restaurant's kitchenTierPrice — $16,000 for Growing
Kitchen in the restaurant build), purchase rules untouched (phase5-qa A1–A3). Daily gift $20–$60 unchanged; order pay,
tips, Replay Bonus unchanged; App ledger writes unchanged (the reward is written in takeDailyGift). New money: ≤ $400/week.

## Verification
- tsc 0, eslint 0 errors, builds + preflight OK; phase5-qa ALL PASS.
- phase5.mjs 20/20 (restaurant build): failed purchase → no reveal; double-tapped Build → one entry for the shown price,
  one major reveal; Skip/after text; fits 320×568; Kitchen paints skin-02, also after reload, no reveal returns;
  within-stage short reveal; Reduced Motion instant; gift card ready/amount/Day 1, fits 320; one claim on double tap;
  "✓ Taken today"; Today's Special untouched; midnight + resume → Day 2; Day 3 gift + $100 (two entries), reload can't
  re-claim; Day 7 + $300; missed day restarts, nothing removed; no console errors.
- Regression (parallel lanes): adsflow 8/8, levelux (classic) 7/7; coach and economyv25 fail exactly their baseline
  checks (economyv25 4a–4e: its version-1 seed is given every tier by the kitchen migration — pre-existing).
  QA so far: the failing suites are identical check-for-check to HEAD, incl. ad-bonuses-qa.
  Completed later: phase2 29/29, knifereport 26/26, phase4 27/27, phase3 49/49; QA 107/112 with the 5 failures
  identical to HEAD.
- Screenshots: tools/e2e/out/phase5-reveal-before-320.png, phase5-reveal-after-320.png, phase5-kitchen-gift-320.png.

## Not done / limitations
- (Fixed in the gap pass) The cutting screen now shows the built tier's painting behind the board; Humble keeps the
  original cutting art. Checked by phase5-qa A13 and phase5.mjs R10.
- Only kitchen tiers get a reveal; other purchases keep their existing feedback.
- No new art: the reveal uses the existing six paintings.
- Phase 6 not implemented.
