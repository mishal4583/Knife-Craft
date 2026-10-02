# KnifeCraft — Handoff (Playgama edition)

Last updated: 2026-09-29. Written at the end of the Claude Code session that
created this repository, so the next session can continue without the old
conversation.

## 1. Where things stand

| Item | State |
|---|---|
| Primary codebase | this repo, `D:\WORKS\GAMES\Playgama\KnifeCraft` |
| Retired codebase | `D:\WORKS\GAMES\Knife Craft` (YouTube Playables build, GitHub `mishal4583/Knife-Craft`). Its last commit `1af591f` is the base of this repo's history (`youtube-original/main`). It still has the story change as **uncommitted** edits; leave it alone. |
| Distribution | Playgama → its catalog + partner platforms ("distribute everywhere", no exclusions). No direct YouTube Playables release. |
| Platform SDK | Playgama Bridge v2 (detected by Playgama: bridge 2.2.0, engine javascript) |
| Live sandbox | https://playgama.ai/play/gm6cvisosg — status ACTIVE, published 2026-09-26, running archive `knifecraft-playgama-1.0.0` (the **old** 13-beat intro, no Skip). Launch steps now say the sandbox is OUTDATED (form/covers changed since). |
| Latest local build | this repo at HEAD: re-paced intro + Skip story (not uploaded yet) |

## 2. Playgama cabinet (MCP `playgama-developer-cabinet`)

- applicationId `cmuiim0sh1qcalc0hiuw6xwlp`, title "KnifeCraft", status DRAFT
  (never submitted to moderation), engine `js`, agent claude-code / claude-opus.
- Archive `knifecraft-playgama-1.0.0` — id `cmuiime751qcnma0hudv5rc2r`,
  3,102,601 bytes, processing DONE, bridgeSdk FOUND, state PASSED,
  game_ready ARRIVED, bridge config VALID. Zip: `releases/KnifeCraft-Playgama-v1.0.0.zip`.
- Form: description + how-to-play filled (EN), devices iOS/Android/Desktop,
  portrait only, no multiplayer/leaderboards/social/IAP,
  `distributeEverywhere: true`, `excludedPlatforms: []`, no external link.
- Covers: all three slots filled (square = `playgama/covers/upload/square-800x800.png`,
  portrait = `portrait-1080x1920.png` (Poster.png centre-cropped from 1280 wide),
  landscape = `landscape-1920x1080.png` (Landscape.png trimmed from 1081 px tall)).
- Launch steps (2026-09-29): archive DONE, bridge DONE, covers DONE,
  form BLOCKED (NO_CERTIFICATION — a human must certify in the QA Tool),
  sandbox OUTDATED (CHANGED), share AVAILABLE, traffic DONE.
- Traffic: a FREE run (12 creatives, $6 internal budget) RUNNING
  2026-09-26 → 2026-09-29 16:06 UTC, posts on r/playgamabridge and Threads;
  an earlier 1-day FREE run FINISHED. Next traffic is PAID (verdict
  PAYMENT_REQUIRED) — only ever start traffic after asking the developer.
- Revenue share (Playgama wiki, checked 2026-09-28): playgama.com 50%;
  partner sites 70% up to $1k/month, $700 + 80% to $3k, $2,300 + 90% above;
  $100 payout threshold; bank transfer or crypto; non-exclusive.

## 3. What was done (chronological)

1. Business Mode UX overhaul (Market-style 7 tabs, visual Overview; no
   economy change), Business third in the bottom nav — committed `1af591f`.
2. Playgama conversion of a copy of the game (this repo):
   `PlayablesSDK.ts` rewritten over Bridge (same exports), `SaveManager`
   via Bridge storage, `main.tsx` → `startPlatform()`, Bridge CDN script in
   `index.html`, `public/playgama-bridge-config.json`, platform-neutral UI
   copy (App aside, ReplayBonusSheet), preflight + ads QA retargeted to
   Bridge. Uploaded as `knifecraft-playgama-1.0.0`, Bridge detected, form +
   covers, sandbox published and traffic started (by the developer).
3. Audit (no code change): Levels 1–10 and between-level flow — see §4.
4. Story presentation audits (three passes, no code change) — findings in §5.
5. Story pacing + Skip story implemented (main repo, then ported here):
   38.7 s → 21.5 s timed, 13 → 14 beats, new approved copy, one idempotent
   completion path, per-beat advancing, CSS transitions. QA:
   `scripts/story-intro-qa.mts` (63 checks) + `tools/e2e/introskip.mjs`.
6. This repo set up as the primary one: git history, CLAUDE.md, this file,
   covers / screenshots / Playgama docs / release zip moved in, e2e tools.
7. Intro cinematic (13.6 s), Business Rush Restock (cash +25% or a rewarded
   ad), Economy V2.5 (paid kitchen development, reward schedule, milestone
   rewards, $50,000 Final Reward) — on branch `claude/sharp-wright-emfu2j`.
8. Final economy rebalance + save migration fix: `SaveData.economy`
   (version, claimed/waived milestones, exact lifetime totals); old saves
   migrated once on load with NO milestone windfall and no kitchen charge;
   Progress shows historical figures; Endless unlocks after Level 250;
   Business fines ÷5 and 2-hour staff shifts; "Not enough money — need $X
   more" on every purchase. QA: `scripts/economy-final-qa.mts`. Open: Business
   staff still cost more than they earn (see CLAUDE.md §7 Business scale).
9. Cooking clip after every dish (CLAUDE.md §9): skippable 3.75 s film between
   the plate hand-off and the Knife Report. e2e: `tools/e2e/cookingclip.mjs`.
10. Ads aligned with Playgama's requirements + monetization guide: first
   interstitial after 3 levels, 150 s between interstitials (config floor
   120 s), one placement per ad spot, Bridge level messages. QA:
   `playables-ads-qa` (E, E6, A4b, F11, H) + `tools/e2e/adsflow.mjs`.
11. Business → Ingredients: per-ingredient prices, unused ingredients hidden
   behind "Show 20 more", wallet preview on every card, "Not enough money —
   need $X more". e2e: `tools/e2e/ingredients.mjs`.
12. Every ingredient on a menu: 13 new Business dishes (48 total), incl.
   Ribeye with Herb Butter on the Business-only recipe; the hide toggle
   removed. `setMenuPrice` now uses `getCampaignRecipe`.
13. Release v1.1.0 (`releases/KnifeCraft-Playgama-v1.1.0.zip`): deep check
   (all QA, all e2e, fresh-player L1–10 audit) + the P1 flow fixes in §4.
   Metrics at the time (1.0.0 sandbox, 26–28 Sep): 310 sessions, game_ready
   88.4%, 30 s+ 36.1%, bounce 63.9%, D1 3.64%, avg load 2.6 s. A fresh
   player's game_ready fires ~0.6 s after load locally, ~5 s on a slow
   mobile connection — the next lever for the 11.6% who never reach it is
   the first-load size (P2).
14. Business Ingredients + Market rework: buying moved to Market →
   Ingredients (`MarketIngredients.tsx`, `purchaseQuote`); Business →
   Ingredients became Business → Inventory, a read-only dashboard (fridge,
   on hand, low stock, readiness + most needed, expiring soon, analytics,
   purchasing, most used — `inventoryAnalytics.ts`) whose only purchase
   controls link to the Market (deep link `shop-ingredients`, ingredient
   preselected). Rush Restock's "Go to Market" and the "No Dish Can Be Made"
   alert now open the Market. QA: `inventory-market-qa`, business-ux-qa
   S4–S6/S8; e2e: `ingredients.mjs` (rewritten), `rushrestock.mjs` 9a.
15. Salad cooking clip: salads play the chef tossing a salad
   (`chef-salad.*`, from `Salads.mp4`, watermark painted out like the first
   clip); every other dish keeps the chef-cooking film. `dishKindFor` in
   `src/game/recipes/dishKind.ts`. e2e: `cookingclip.mjs` 1e2 + 5a–5c.
16. Fruit-cup cooking clip: fruit dishes (all-fruit recipes + Business
   Desserts) play `chef-fruit.*` — 3.84 s cut from the 8 s `Fruit cups.mp4`
   (spooning shot → honey drizzle; the wide intro and mint garnish shots
   dropped), watermark painted out. e2e: `cookingclip.mjs` 6a–6c.
17. Plating cooking clip: dishes that are only cut and plated (Levels 1–9's
   plates and bowls, garnishes, salsas, skewers, antipasti, prep bases —
   75 recipes) play `chef-plating.*` — 3.84 s from the 10 s `Plating.mp4`
   (tomato slices into a bowl → herbs + pull-back over the plated counter;
   the stove intro and the over-the-shoulder shot dropped). Heated dishes
   keep the stove film. e2e: `cookingclip.mjs` 7a–7c.
18. Curry-pot cooking clip: curry / masala / chutney / soup-base dishes
   (18 recipes, Levels 51–69, the 7 Business curries) play `chef-curry.*` —
   3.67 s from the 10 s `Curry.mp4` (spoon stirring the curry → the chef
   over the big steaming pot; the wok intro, the face close-up and the
   side view dropped). e2e: `cookingclip.mjs` 8a–8c (the stove check
   moved to Level 36, since Level 58 is now a curry). Possible later: a
   bread/bruschetta film (9 recipes still on the stove film).
19. Beginner coaching (CLAUDE.md §9): a ghost demonstration on the board
   shows exactly where and how to cut/peel/smash/ring, with a how-to card
   (what to do + why). Taught in Levels 1–5 and wherever a technique is
   new; otherwise only when the player is idle 8 s. QA: `coaching-qa`;
   e2e: `tools/e2e/coach.mjs` (finds the ghost fingertip in a screenshot,
   taps there and checks a real cut lands). Bread film still to come.
20. Realistic knives (CLAUDE.md §9 "Knives"): real proportions for all
   8 knives, one shared geometry + painter (`scenes/knifeProfile.ts`) for
   the in-game knife, the coaching ghost (SWIPE then TAP demo) and the
   Market icon; the resting knife lies flat below the food (or on the
   counter in front of the board).
21. Coaching only for beginners, only when needed: first play of a
   campaign level only (never replays / Today's Special / Endless /
   Service / Business), Levels 1–5 + each technique's introducing level,
   back after a pause only if the player is stuck (no progress on the
   step); the one-line gesture hint only to Level 10. QA `coaching-qa`
   E2/F3/F4; e2e `coach.mjs` 3a, 6a, 7a (Order Board replay), 8a.
22. Knife cutting motion: two experiments were tried and reverted at the
   developer's request ("use old knife mechanics, it is better"): laying
   the knife ACROSS steep cuts (04e3675) and sliding it ALONG the cut line
   tip-first (612e204, "feels like a sword penetrating"). The motion is
   the original one again: the knife turns to the cut line's angle and
   comes down onto it (tap), or follows the finger (swipe). Do not
   re-introduce either pose without asking.
23. Knife cutting motion, from the developer's point-of-view tomato photos:
   - The knife lies along the cut, held from the cook's right hand at the
     lower right: vertical cut, tip up; horizontal cut, tip left and handle
     right.
   - While it cuts it is seen from above, standing on its edge
     (foreshortened blade, round handle). At rest it lies flat.
   - Tap: the knife snaps onto the line, lands, makes a short
     back-and-forth slice, and the cut opens at the end of the stroke.
   - Swipe: the knife moves with the finger along the drag, with the same
     grip (push or pull).
   - The coaching ghost matches.
   - Code: `knifeTipDir` / `poseForTipDir` / `tapStrokePose` /
     `topViewProfile` in `scenes/knifeProfile.ts`.
   - Guarded by `scripts/knife-stroke-qa.mts`.
   - `tools/e2e/coach.mjs` clears long straight white runs before looking
     for the ghost fingertip, because the ghost knife's edge lies through
     it.
27. Physical refrigerator (developer's refrigerator UI handoff). A UI
   integration, NOT V3-17: no save field, price, ledger category or
   action was added.
   - Business → Inventory now opens on an open reach-in
     (`kc/business/fridge/PhysicalFridge.tsx` + `.css`), fed by the
     read-only adapter `business/fridgeView.ts`, built from
     `business.inventory`, perishability, `lowStockItems`, the active
     menu, `refrigeratorDefinitions` and equipment condition.
   - Zones: Dairy & Tofu (top), Vegetables, Meat · Fish · Bread, Fruit
     and Greens & Herbs drawers, and Butter and Aromatics door bins. There
     is no egg tray or sauce rack because the game has none of those.
   - Restock and "Buy more" go to Market → Ingredients; Upgrade, Service
     and Repair go to Business → Equipment. The fridge buys nothing
     itself, which keeps the "Business → Inventory has no purchase
     controls" rule (`business-ux-qa` S8, `inventory-market-qa` 1).
   - Not used from the handoff: its mock tiers (30-slot "My Fridge"),
     slot counting, prices, demo inventory, mirror state, coins and
     in-fridge buying.
   - Fixed: the door handle no longer covers or steals taps at 375×642.
     Shelves pan sideways only when they overflow, with touch and mouse.
   - The fridge replaces the old On hand list (developer: "replace the
     current on hand with proper refrigerator and stocks inside it").
   - Developer review: approved as built. The fixed 37°F was replaced by a
     cooling status from the real condition (Refrigerated / Needs service
     / Broken) so players don't think temperature is simulated. The
     read-only rule is now a hard rule in `CLAUDE.md` §7.
   - QA: `fridge-view-qa`, `tools/e2e/fridge.mjs` (375×642 plus
     320/360/390/430/768).
26. Business Supplies (developer's Shop UI production handoff). This is a
   separately authorized extension, NOT V3-17: master spec §25, with a
   note in the execution protocol.
   - Three Market sections, Smallwares · Tableware · Takeaway: 50 lines,
     each with a sourced WebstaurantStore pack price (2026-10-02) at the
     ingredient rule, ×0.65.
   - A Business → Supplies tab showing saved stock, stock value, spend and
     saved vs retail.
   - Accounting: smallwares/tableware are capital; packaging is a stock
     asset; one container and one bag are used per served Business order,
     and their cost goes to COGS.
   - Data: one nested save field, `business.supplies`. Old saves open
     empty.
   - QA: `business-supplies-qa`, `tools/e2e/supplies.mjs`.
   - `business-ux-qa` V2 / `inventory-market-qa` 16c now list `supplies`
     as the one reviewed new Business field.
   - The prototype's prices, reference prices and opening stock were not
     used.
25. Bread cooking clip: `Bread.mp4` (10 s) cut to 3.0–7.0 s (tomato
   spooned onto toast → the finished crostini board), watermark painted
   out, 540×960 WebM/MP4 + poster (`chef-bread.*`). `dishKindFor` "bread"
   (bread/baguette ingredient, or bread/toast/bruschetta/crostini in the
   name), checked after curry and before the stove film: 11 recipes. e2e
   `cookingclip.mjs` 9a–9c (Level 11, Garlic Bread).
24. Cutting rules (developer's `Knife_Rules.docx` + review). See
   `docs/KNIFE_RULES.md`.
   - Every cut goes across the food, vertical lines like Level 1.
     Horizontal lines only for julienne strips, Dice's cross cuts or a
     tall food.
   - Order: right to left.
   - The knife stays poised on the last cut and is laid down at step end.
   - Code: `src/game/cutPlan.ts`. Guarded for all 250 levels + Endless by
     `scripts/cut-rules-qa.mts`.
   - `julienne-fix-qa` checks 11/13b were moved from the old
     `tapDefaultAxis` source text to the same invariants on
     `primaryCutAxis`. 13b's old "Slice/Chop/Dice use technique.axis"
     rule was replaced on purpose by the developer's rule.
   - `coach.mjs` now searches the food band only (38–60% height) and needs
     a ring-like blob. The ghost knife's handle hangs below the food on a
     vertical cut.

## 4. Open issues from the Level 1–10 audit (not fixed yet)

Priority order as agreed in the audit (P0 = before wide release):

- ~~P0 — G1~~ **fixed 2026-09-29**: leaving a campaign level (Served
  screen or pause menu) after its required orders are served and paid now
  completes it through `finishCampaignLevel` / `finishBatchGroupLevel`, so a
  retry is a replay and pays nothing. Still open (needs a decision, would
  need persisted partial progress): on a `requiredOrders: 2` level, leaving
  after the 1st of 2 orders and retrying pays that 1st order again.
- ~~P0 — G2~~ **fixed 2026-09-29**: a fresh save's Level 1 is built with
  `buildCampaignServiceSession` (same as `startCampaignLevel`), so the first
  play has the customer/Serve/Finish Level flow, pays $48 + the $50 reward
  and shows Level Complete. Economy V2 QA output unchanged (Honest net
  $461,526). Browser regression: `tools/e2e/levelflow.mjs`.
- P1 **fixed 2026-09-29 (v1.1.0)**: the campaign exit button now says "Back
  to Orders" (it goes to the Order Board); the Order Board opens scrolled to
  the next level; knife/board rows say "Unlocks: X in the Market" instead of
  "Reward: X"; any instruction that omits a peel step is prefixed "Peel the
  X first." (43 recipes, incl. Levels 8/9).
- P1 still open: Level 10's +$80 toast is replaced by the story milestone
  banner; order payout and completion reward are shown separately (never a
  total); peel shows no progress ("0/1 peel" until done).
- P2: first-load bundle (main 782 KB / Phaser chunk 1.44 MB raw), Business
  code in the main bundle, stale "Next: Santoku · Lv 10" hints, Knife Report
  copy, faint destination label under the HUD card, nav highlights Kitchen on
  the Order Board, unused tracked assets `src/assets/kitchen$f` and
  `src/assets/tomato.webp`.

## 5. Story presentation — remaining recommendations

Implemented: pacing, Skip, per-beat entrance, tint crossfade, art drift,
reduced-motion fallback, double-tap / tap-through protections.

Not implemented (from the audits, all CSS/asset-free):

- Story timers do not pause on a platform pause (subscribe `StoryOverlay`
  to `PauseManager`; freeze CSS animations with a paused class).
- Reuse the already-downloaded `kitchen-bg.jpg` as the story background
  plate so the last beat dissolves straight into Level 1 (same image).
- Render the existing `fx` data (dust/spark/coins) with CSS particles;
  class hooks on existing SVGs (lamp flicker, key glint, chef breathing).
- Larger dialogue portraits + speaker handoff; ≥12 px card/label text;
  better contrast on the dark "decline" tint.
- Milestone banners: a story variant placed below screen headers, queued
  after the Level Complete toast instead of replacing it.
- Finale: its button says "BACK TO THE KITCHEN" but leaves the player on
  the Order Board (one-line navigation change — needs the developer's OK).
- Pause the Level 1 scene underneath the intro after SCENE_READY (it costs
  ~19% main thread while hidden) — never delay `gameReady`.

## 6. Next steps (suggested order)

1. ~~Fix P0 G1 and G2~~ (done 2026-09-29). No release zip until the intro
   story rework and bug fixes are finished (developer's instruction).
2. Build, zip `releases/KnifeCraft-Playgama-v1.0.1.zip`, upload as archive
   `knifecraft-playgama-1.0.1`, confirm Bridge FOUND / state PASSED.
3. Ask the developer, then `publish_sandbox` the new archive (the sandbox
   is currently OUTDATED and runs the old intro).
4. Certify in the QA Tool (`get_archive_qa_tool_link` with
   `mode: certification`), then the developer submits the form to
   moderation in the cabinet.
5. P1 UX fixes, then the story presentation items in §5.

## 7. Useful facts

- Starting wallet $1,240.00 (124,000 cents). Levels 1–10 on a first run pay
  $667 in order settlements + $636 completion rewards (after the G2 fix).
- Intro timing: Part 1 7.6 s, Part 2 6.0 s, Part 3 7.9 s; measured live
  22.4 s including two prompt button presses; Skip closes in ~130 ms.
- Bundle impact of the story change: main JS +~0.4 KB gz, CSS +~0.2 KB gz.
- Tests run in headless Chrome only; no real-device test has been done yet.
