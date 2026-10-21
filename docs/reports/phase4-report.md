# KnifeCraft — Phase 4 report (2026-10-21) — working tree only, nothing committed

Repo: D:\byte\not8n\_clones\Knife-Craft. Baseline: knifecraft-phase4-baseline.md (same folder).

## 1. Instructions and key files inspected
CLAUDE.md; docs/REFERENCE.md, HANDOFF.md, tools/e2e/README.md. SaveManager.ts (recipeProgress {best, done}), App.tsx
(recordPreparationResult and the service recorders: best = max, replays included; serve* settlement paths; session kinds;
coaching), CutEvaluator.ts (grade thresholds), levels/levelMastery.ts + recipeBook.ts, kc/Recipes.tsx (Recipe Book, its
"no numeric readout" rule), customers/customerTypes.ts + customerDefinitions.ts, service/ServiceManager.ts (random customer
per order) + CustomerOrderManager.ts (order ids), Preparation.tsx, KnifeReport.tsx, CookingClip.tsx,
ServiceOrderComplete.tsx, CashVacuum.tsx, OrderComplete.tsx, story/storyDefinitions.ts, restaurant/firstLevels.ts, Kitchen.tsx.

## 2. Files changed (Phase 4)
New: game/signatureDishes.ts (tiers, best-of, milestones, memories, this-visit memory), game/customers/personalities.ts
(5 customers, cadence/cache/eligibility, reactions, Regular's par), kc/signature/TierBadge.tsx, kc/game/BookPageNote.tsx,
scripts/phase4-qa.mts, tools/e2e/phase4.mjs.
Changed: kc/Recipes.tsx (summary, tier stamps, tier-framed illustration, Signature panel), levels/levelMastery.ts
(recipeIdsOfLevel, used by isLevelPrepared), kc/game/Preparation.tsx (personality, arrival card, Regular's clock, book page
step, one-advance Continue, this plate's tier + personality to the serve card), kc/game/ServiceOrderComplete.tsx (special
customer face/name/reaction, Mystery silhouette + reveal, plate tier, staged reveal, Next latch, tighter layout ≤640 px tall),
App.tsx (customerEligible in orderSpecials), kitchenChaos.ts (dev hook .customer), styles.css (kc-arrive, kc-silhouette,
kc-stage), scripts/phase1-cutting-qa.mts + phase2-qa.mts (two static regexes made whitespace-tolerant — behaviour unchanged),
docs (REFERENCE §5/§10, HANDOFF, e2e README).

## 3–6. Collection
- The Recipe Book (Order Board → 📖) is the collection. Tier from the saved best (max over a level's recipes):
  Homemade = prepared; Chef's Special = best ≥ 85 (the Clean grade); Grandma's Signature = best ≥ 95 (Masterful).
  Best result = the existing persisted `recipeProgress[id].best` (max of Knife Report scores; ties keep the value; a worse
  run can't lower it; App writes it, the collection never does).
- Summary strip; tier stamps (Homemade = "Prepared"); page: dish in a tier frame + ribbon, the ladder with how to reach
  each tier, "Best plate so far: <grade word>", one memory per tier reached, "This visit (not saved)" (longest run, variants).
- Variants (Phase 3 exist): shown only when that order really had one; first one per visit gets a memory on the book page.
- Illustrations: no dish art exists in the repo (dishes are emoji glyphs) — the page frames the dish's own picture by tier;
  NO new illustration asset was created.
- Memories: a small book page ON the serve / Order Complete card only when the saved best crosses into a new tier
  (first plate included) — once per recipe, forever, no field needed; replays at the same tier show nothing (browser
  A10). It is part of the card (no extra tap). A first draft made it its own stage after the Knife Report; the regression
  run showed that added a tap after every new level and broke phase2/adsflow/levelux flows → reworked inline.
## 7–11. Customers (presentation over ordinary orders)
Food Critic (🧐📝), The Regular (🙎‍♂️⏱️), Mystery Guest (🕵️❔ silhouette → revealed), Grandma's Old Friend (👵🏻💐),
Big Bruno (🧔‍♂️🍽️ drawn big). Arrival card; name on order card and serve card; reaction line per real grade; cheer only
for Masterful, nod for Clean. Regular: par 8 s + 1.5 s/cut of unpaused prep → once "checks his watch", "Finally!" — no
penalty. Order model has one dish per order → Bruno's appetite is presentation only (no quantity, no extra pay).
Schedule: service orders from Level 4 (any Business order), never while a technique is taught; the 2nd eligible order of the
page session, then every 5th, fixed rotation; decided once per order id (cached). Existing 12 customers unchanged.
Assumption: "Grandma's Old Friend" is new narrative (an unnamed friend of the grandmother); no story beat added.
## 12. Completion sequence
plating → cooking film → Knife Report → serve card (with any book page) → Serve → reaction 0 s, pay 0.18 s, tip 0.36 s, cash
0.52 s (opacity only; none with Reduced Motion). Continue / Serve / Next each advance once. FOUND & FIXED: a double tap on
"Next Customer" advanced the campaign queue twice (skipping an order) — now latched (browser C4 checks order ids 1 → 2).
Serve card fits 320×568 (was 556/556 with a long line; 510 px now even with the menu-guest button).
## 13–15. Report, money, save
Knife Report unchanged (all fields; book page is a separate stage, never on top of it). Payment untouched: Serve →
settlement → one ledger entry (browser: exactly one campaign-settlement entry, wallet delta = entries, for all five
customers). Tips/Replay Bonus untouched. NO save-schema change; no new storage; nothing persisted (phase4-qa E1–E4).
Per-recipe best combo / variants-used stay "This visit (not saved)" — developer decision (2026-10-21): no save field.
Rule override flagged: tier words in the cookbook (Law 4 said no graded rating there); digits still never shown.

## 16–17. Tests actually run (final tree)
- tsc 0 errors; eslint 0 errors (7 pre-existing warnings); Prettier on changed files that are clean on HEAD; `npm run build`
  + classic build OK; preflight: all hard checks pass; production bundle has no `__kcSpecials`.
- QA: 111 suites → 106 pass; the 5 failures are check-for-check identical to a pristine HEAD worktree (ad-bonuses,
  business-experience, business-final-audit, business-order-frequency, business-rush-restock). economy-v2-final-qa
  (frozen baseline) passes; phase1/2/3/4-qa pass (phase1 E5 and phase2 C13 regexes made whitespace-tolerant — the code
  they check is unchanged in behaviour).
- Browser (restaurant build + dev servers): phase4.mjs 27/27 (full run) + C 5/5 after the last fix; phase3.mjs 49/49;
  phase2.mjs 29/29 (B5 — the 320×568 serve card — now fits, 510 px); adsflow 8/8; knifereport 26/26; levelux (classic)
  7/7; coach and economyv25 fail exactly their recorded pre-existing checks (coach 5b, 8a + TimeoutError; economyv25 2f,
  4a–4e).
- Screenshots (tools/e2e/out/): phase4-book-320.png, phase4-signature-page-320.png, phase4-book-note-320.png,
  phase4-food-critic-320.png, phase4-impatient-regular-320.png, phase4-mystery-customer-320.png,
  phase4-grandmas-old-friend-320.png, phase4-giant-eater-320.png.

## 18. Known limitations
- Best combo / variants per recipe are this-visit only (no save field; approval needed for one).
- No dish or customer art assets exist: dishes and customers are emoji (as the whole game); special customers use emoji +
  a badge + CSS treatment (silhouette, size). No new illustration assets were made.
- Order model is one dish per order → Big Bruno's appetite is presentation only.
- The Regular's "wait" is a documented cosmetic par (no service timer exists).
- Special customers only appear on service orders (classic-build campaign levels have no customer).
- Counters (special customers, chaos, variants) are per page session.

## 19. Acceptance checklist
Collection: accessible via Order Board → 📖 PASSED · real recipe ids PASSED · documented best rule (saved max) PASSED ·
worse can't overwrite PASSED (QA A5/A6, browser A10) · three tiers PASSED · thresholds = existing grades PASSED ·
mastery real PASSED · variant accuracy PASSED (A9) · illustrations PASSED-with-limitation (no art exists; dish frame) ·
family memories PASSED (once per tier, no field) · empty states PASSED (A6) · replay no duplicates PASSED (A10) ·
no unapproved save fields PASSED (E1) · scoring/economy unchanged PASSED.
Customers: Food Critic / Regular / Mystery / Old Friend / Giant Eater PASSED (B1–B5, B6, B8) · distinct identity PASSED
(emoji+badge, documented asset limitation) · entrances PASSED · supported orders PASSED · reactions from real grade PASSED ·
scheduling documented + testable PASSED (QA B3–B8) · normal customers kept PASSED · cleanup PASSED (QA B18; no console
errors) · no duplicate payment PASSED (one settlement entry each) · no relationship system/save fields PASSED.
Completion: flow intact PASSED (C2) · plating/clip PASSED · Knife Report fields PASSED (QA C4) · reaction coordinated PASSED
(C3) · payment accurate PASSED · cash collection PASSED (phase2 29/29) · wallet/ledger authoritative PASSED ·
Replay/Replay Bonus unchanged PASSED (no change to those paths; QA E2; Replay Bonus itself not browser-tested here →
covered by existing suites only) · skip PASSED (C4 film skip) · rapid taps PASSED (C1, C4) · missing assets/interrupted
animations: no new animation can block (opacity-only stages, no callbacks) PASSED by design, NOT TESTED by fault
injection · next order consistent PASSED (C4 ids) · mobile PASSED (B7, C1b).
No existing feature removed (the Prepared stamp now names the tier; flagged override of Law 4 for tier words).
Phase 5 / Phase 6 not implemented.
