# KnifeCraft — Phase 6 report (2026-10-21) — working tree only, nothing committed

## Baseline
- Detectable already: Perfect Slice (scene, swipe within PERFECT_TOL=12 px of an ideal division, from the 3rd cut, once per
  ingredient — CUT_COMPLETED.isPerfect), combo per step (CUT_COMPLETED.combo), personal best (bestVerdict vs the saved
  recipeProgress best), special variants (Phase 3, per order), Grandma's Signature milestone (Phase 4), special customers'
  Serve reactions (Phase 4).
- Branding: game fonts (Fraunces, Nunito, Caveat) and the kitchen painting are local same-origin assets → a canvas card
  stays exportable. No existing share/export code; no backend; Playgama iframe may block Web Share → feature-detected.
- Persistence: none needed (moments are memory-only per run).

## Built
- game/kitchenMoments.ts — rules: perfect = a Perfect Slice on an ingredient whose combo reached Clean ×5 (first existing
  milestone); special = the order's real variant, or a new Grandma's Signature; best = bestVerdict "best"; customer = a
  special customer's real Serve reaction. Share texts per kind. In-memory store, once per (run, kind); nextRunKey per attempt.
- kc/moments/momentCard.ts — 1080×1350 (4:5) PNG drawn on its own canvas: kitchen painting backdrop, KNIFECRAFT wordmark,
  kind, emoji picture (flag emojis → 🍽️), heading, badge, facts, brand mark. Missing picture/font → drawn without it.
- kc/moments/MomentPreview.tsx — preview = the exported PNG (blob URL, revoked on change/close); arrows between moments;
  Share only when navigator.canShare({files}) is true; AbortError silent; other errors → "Save the image instead"; Save
  image = <a download> PNG; Close. No auto-open, no upload.
- kc/moments/MomentChip.tsx — quiet 📸 chip on the completion screen only; tap to open; ✕ to put away.
- Preparation.tsx: detection once at RECIPE_COMPLETED (run key, perfect slices per step, step combos, variant, tier,
  saved best from before the run; business orders: no best/tier); chip + preview at phase complete; restart clears.
- ServiceOrderComplete.tsx: onCustomerMoment fired once on the real Serve (behind the Serve latch) for special customers.
- Docs: REFERENCE §5/§10, HANDOFF, e2e README. Tests: scripts/phase6-qa.mts, tools/e2e/phase6.mjs.

## Save / economy
No save field, no storage, no network (phase6-qa E1–E3). No rewards for sharing; no ledger writes (browser M11: the
only new entry after a full order with three moments is the order's own settlement).

## Verification
- tsc 0, eslint 0 errors, builds + preflight OK, phase6-qa ALL PASS (A1–E3).
- phase6.mjs 17/17 (dev server, headless Chrome on Windows): M0–M11 (chip only on the completion screen; special+best
  then +customer; 1080×1350 PNG preview; arrows; fits 320×568; cancelled share silent; refused share → Save; Save
  downloads a real PNG; no Share without file sharing; no duplicates on reopen; ✕; no money), P1–P2 (aimed swipes →
  Perfect Cut), O1 (ordinary dish → nothing), Z1 no console errors.
- Native sharing was exercised through a stubbed navigator.share (cancel / refused). A real OS share sheet was NOT tested
  (headless Chrome has none) — Not Tested on real mobile devices.
- Screenshots: tools/e2e/out/phase6-preview-320.png, phase6-perfect-preview.png.
- Full regression (final tree, parallel lanes): phase6 16/16, phase5 20/20, phase4 27/27, phase3 49/49, phase2 29/29,
  adsflow 8/8, knifereport 26/26, levelux (classic) 7/7; coach and economyv25 fail only their recorded baseline checks.
  QA 108/113 — the 5 failures are identical check-for-check to HEAD; economy-v2-final-qa and phase1–6 QA all pass.

## Limitations
- Moments are forgotten on reload (no history, by design — no save field).
- The card's picture is the dish/variant/customer emoji over the kitchen painting, not a snapshot of the plated dish
  (the Phaser WebGL canvas isn't preserved for capture; snapshotting it would touch the live scene).
- Classic-build campaign orders have no customer → no Customer Moment there (by Phase 4 design).
