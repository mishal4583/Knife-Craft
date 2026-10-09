# KnifeCraft — Handoff (Playgama edition)

Last updated: 2026-10-08. Written at the end of the Claude Code session that
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
33. **Unified Restaurant** (developer spec 2026-10-04: Campaign + Business as
   one restaurant, systems first, economy later). Plan and status:
   `docs/RESTAURANT_INTEGRATION_AUDIT.md`; unbalanced economy items:
   `docs/ECONOMY_TODO.md` (P0: food is charged twice until the economy
   pass). Everything is behind ONE build switch,
   `src/game/config/restaurantMode.ts` (`VITE_RESTAURANT_MODE=1` test
   builds only; release builds are unchanged). Done: phases 1–4 (audit;
   unlock table; campaign orders use real stock from L11; rolled service
   tickets; Pre-Service Check with Restock → Market preset, Throw Out
   Expired, Grandma's pantry). QA `restaurant-unlocks-qa`,
   `restaurant-stock-qa`, e2e `restaurantstock.mjs`. Then (progression & early menu spec): central
   `restaurantProgression.ts`, the menu from L1 (2 → 48 dishes by L241),
   the Menu screen's active / locked view, and the day clock (opening card,
   services, Closing Time, Day N+1). QA `restaurant-menu-qa`,
   `restaurant-day-qa`, e2e `restaurantday.mjs`. Game map: `docs/GAME_MAP.md`.
   Phase D: menu guests — after a level's own orders, optional customers
   ordering from the active menu (1–5 per service from L6), menu price,
   real stock, one business-revenue entry, never paid twice
   (`restaurant/menuGuests.ts`, `restaurant-guests-qa`, e2e
   `restaurantguests.mjs`). Known pre-existing issue: a resize after serving
   drops the result panel. Next: supplies use (phase G) and bulk buying.
32. Developer decision batch (#1–26), on the feature branch only (no direct
   pushes to `main`; merge when the developer approves):
   - #4 `playables-ads-qa` B12/B13: section B pins `Date.now` to `NOW`
     (B14 checks the reset a day later). The cap is unchanged.
   - #8 The Market's supplier tab is now "Campaign Supplier"; Business →
     Suppliers is unchanged (`business-ux-qa` S10).
   - #15 Supplies "Restock" jumps to the exact Market line (ring +
     scroll; `openMarketSupplies(go, section, supplyId)`; e2e 6e).
   - #9 Throw Out Expired in Inventory (`business/discardExpired.ts`): the
     End Business Day sweep run early, recorded as waste, no money or
     ledger change; throwing out early then ending the day equals just
     ending the day (`inventory-screen-qa` D1–D5, e2e `inventory.mjs` 7b).
   - #5 Multi-order levels save their paid orders
     (`levelProgress.paidOrders[levelId]` = recipe ids, written in the same
     persist as the payment; `levels/paidOrders.ts`). A retry starts with
     them counted (service: `withOrdersAlreadyServed`; batch group: those
     customers already served, `withBatchOrdersAlreadyServed`); an order
     pays only while the level still owes one (`mayPayOrder`);
     `completeLevel` clears the entry. A level whose orders were all paid
     but never finished completes on its next start. The two finish paths
     now share `completeCampaignLevel`. QA `campaign-paid-orders-qa`, e2e
     `paidorders.mjs` (it fails on the old build: the retry needed 2 more
     orders); `story-pause-qa` K2 counts the merged path.
   - #21 The finale's "BACK TO THE KITCHEN" now goes to Kitchen home
     (`App.finishFinale`; it used to leave the player on the Order Board).
   - #22 Story timers stop while paused: the finale's beats and the
     milestone banners run on `PausableCountdown` (`usePausableTimeout` +
     `PauseManager`), animations freeze, finale taps are ignored
     (`story-pause-qa`, e2e `finale.mjs`; `story-intro-qa` D8 updated to
     the approved exit).
31. Staff only in Business (developer: "remove the staff from market keep them
   only in bussiness"; chose to MOVE the campaign kitchen helpers, not remove
   them). The Market's Staff tab is gone (8 tabs); Business → Staff shows the
   waged team, then "Kitchen helpers" (`KitchenHelpers.tsx`) with the same
   catalog, prices, unlock levels and `buyStaff` purchase. No economy change.
   QA: `business-ux-qa` S9, `progression-preview-qa` A4 (expected Market
   categories updated on purpose), e2e `staff.mjs`.
30. Fridge: two crates per row on every shelf and drawer (steel
   compartments 214 px, drawers stack when two crates won't fit side by
   side, Basic's narrow crate size fixed); the fridge is a little wider.
   e2e `fridge.mjs` check 9.
29. Inventory holds every kind of stock (developer: "in inventory i need all
   kinds of stocks include cutlery, parcels and all those things"; chose to
   MOVE Business → Supplies rather than show it twice).
   - Inventory has an Ingredients | Supplies switch; Supplies
     (`kc/inventory/InventorySupplies.tsx`, screen `inventory-supplies`)
     shows smallwares, tableware & cutlery and takeaway parcels: summary
     cards (on hand, stock value, running low, takeaway orders covered),
     a short Needs Attention (packaging coverage + stocked lines running
     low), section/group filters and the stock list. Restock → Market.
   - Business is down to 6 tabs (Supplies tab and `business-supplies`
     route removed, `BusinessSupplies.tsx` deleted); supply spending moved
     to Business → Operations ("Supply purchasing").
   - New `packagingOrdersCovered` in BusinessSuppliesManager (min of
     containers and bags on hand). No save, price or economy change.
   - QA: `inventory-screen-qa` N6 + U1–U5; `business-supplies-qa` H3/H4,
     `business-ux-qa` S1/S4 follow the move; e2e `inventory.mjs` 6d and
     `supplies.mjs` section 3–4 read Inventory → Supplies / Operations.
28. Separate Inventory section + Business restructure (developer brief). A UI and
   navigation change only: no economy value, save field, migration or purchase
   path was added or changed.
   - Bottom bar: Kitchen · Market · Inventory · Business · Progress
     (5 sections; 📦 Inventory between Market and Business).
   - Inventory (`kc/inventory/InventoryScreen.tsx`, screen `inventory`) is the
     stock-control screen: fridge pill, summary cards (Total Stock, Running
     Low, Expiring Soon, Ready to Cook), grouped Needs Attention, the physical
     fridge, Ready to Cook + Most needed, All Inventory (filters + sort),
     stock analytics, and a detail sheet per item. Restock → Market →
     Ingredients; Upgrade Refrigerator → Business → Equipment; View Business
     Performance → Business → Overview.
   - One view model, `business/inventoryView.ts`, and one status rule,
     `business/inventoryStatus.ts` (reused by `fridgeView.ts`), both over the
     existing selectors; no second inventory state.
   - Business lost its Inventory tab (7 tabs now) and the
     `business-inventory` route; `BusinessInventory.tsx` was removed.
     Purchasing and Most used moved to Business → Operations (now
     "Ingredient purchasing" / "Ingredients used", plus Best-selling dishes);
     Overview gained "Today at a glance".
   - The fridge files moved to `kc/inventory/fridge/`; the fridge became
     display-only (its own tabs, Needs Attention and detail panel moved to
     the screen).
   - QA: new `inventory-screen-qa`, `tools/e2e/inventory.mjs`; updated
     `business-ux-qa` S1/S4/S8, `inventory-market-qa` 1, `fridge-view-qa`
     H2/H5 (+ I1, which an earlier commit had claimed but never added),
     `tools/e2e/fridge.mjs`, `ingredients.mjs`, `fridgeshots.mjs`.
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
   - Second handoff (with `design-assets/` mockups for the three models):
     the fridge was redrawn after them — enamel Basic with the door open
     on the right, stainless two-door Commercial and three-door
     Professional with both doors open, crates with cream tags, wooden
     signs, glass drawers; the steel models pan sideways on a phone; the
     Equipment cards use the same drawings. `tools/e2e/fridgeshots.mjs`
     captures all three for visual review.
   - Developer review: approved as built. The fixed 37°F was replaced by a
     cooling status from the real condition (Refrigerated / Needs service
     / Broken) so players don't think temperature is simulated. The
     read-only rule is now a hard rule in `CLAUDE.md` §7.
   - QA: `fridge-view-qa`, `tools/e2e/fridge.mjs` (375×642 plus
     320/360/390/430/768).
26. Business Supplies (developer's Shop UI production handoff). This is a
   separately authorized extension, NOT V3-17: master spec §25, with a
   note in the execution protocol.
   - Three Market sections, Smallwares · Tableware · Takeaway: 50 lines
     (52 since Unified Restaurant phase G: dish soap, cleaning liquid),
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

26. Mobile resize/rotation bug: `GameShell` rendered its children bare at
   ≥ 320 px and inside a scaled wrapper below that, so crossing 320 px
   (rotation, a narrow phone's keyboard, a window resize) remounted the
   whole app below it: a served order came back at its first step and the
   result panel vanished. Now one wrapper always exists and only its style
   changes. e2e `tools/e2e/resize.mjs`.

27. Unified Restaurant phase G (behind RESTAURANT_MODE): consumable
   supplies in a service — place settings with washing, napkins, dish soap
   and cleaning liquid as bottles (% and ~N services left), takeaway
   packaging from L71; Pre-Service Check Supplies section, Grandma's spares,
   Inventory → Supplies "For service" panel, Closing Time's cleaning liquid.
   `restaurant-supplies-qa`, e2e `restaurantsupplies.mjs`. Details:
   `docs/RESTAURANT_INTEGRATION_AUDIT.md` (Phase G notes).

28. Unified Restaurant, developer brief 2026-10-05 (behind RESTAURANT_MODE):
   the menu opens at L11 (4 dishes) on the developer's curve to 48 at
   L161, tied to the cuisine chapters, with restaurant news in the
   Pre-Service Check; staff requirements by service size and specialist
   chefs; bulk buying (5/25/50/100, provisional discounts); Inventory's
   restaurant-wide ⚠️ NEEDS ATTENTION; fridge warnings; no Business Day
   before L250, the Endless Restaurant after. Fixed: closing from L91 now
   writes End Business Day's ledger entries. `restaurant-progression-qa`,
   e2e `restaurantprogression.mjs`. Details in the audit's notes.

29. Unified Restaurant phase M (behind RESTAURANT_MODE): existing saves
   move into the unified restaurant once on load (stamped
   `business.restaurantMigration`), keeping everything, with a one-time
   starter crate of goods at cost 0 for the systems they're already past
   and a "Welcome to your restaurant" note. `restaurant-migration-qa`, e2e
   `restaurantmigration.mjs`; restaurant e2e seeds use
   `MOVED_IN_BUSINESS`.

30. Unified Restaurant phase N (final QA): `restaurant-campaign-sim-qa`
   plays L1 → 250 through the real restaurant functions for a diligent, a
   broke and a moving-in player with invariants after every level (no
   soft-lock, no negative money, ledger = cash); `restaurantwidths.mjs`
   checks every restaurant screen at 320–768 px. Fixed: menu guests were
   almost never in stock (4 in 250 levels) — the check now lists their
   stock as optional rows (689 guests). Report and economy findings:
   `docs/RESTAURANT_QA_REPORT.md`.

31. Economy pass (restaurant build): P0 — no double food cost
   (`restaurant/restaurantEconomy.ts`); the completionist now ends L250 with
   $129,324 (target $100k–$150k; was $95,082). The simulation is a module
   (`scripts/restaurantCampaignSim.mts`) shared by the sim and economy QA.
   Then (developer answers of 2026-10-05): item effects on REAL stock —
   knife/board/helper savings and the dull-knife penalty scale the stock an
   order uses, the Campaign Supplier sets Market prices (values unchanged;
   completionist $128,063); the Endless Restaurant's demand scales with what
   was built (`restaurant/endlessDemand.ts`): fully staffed $452/day, minimum
   $78, overstaffed −$262 (`restaurant-endless-qa`). Wages unchanged (free
   before L91). `restaurant-economy-pass-qa`, docs/ECONOMY_TODO.md rows
   26–27.

32. Unified Restaurant phase 7 — one back office (restaurant build):
   Staff was already one screen; the ingredient supplier moved from the
   Market's "Campaign Supplier" tab to Restaurant → Suppliers (free choice,
   it sets Market prices; the Market names it and links there); Equipment
   shows restaurant development (kitchen tiers) above the fridge; the back
   office is titled "Restaurant". `restaurant/restaurantBackOffice.ts`,
   `restaurant-backoffice-qa`, e2e `restaurantbackoffice.mjs`. Release
   build unchanged.

33. Level 1–10 UX pass (presentation only, both builds): Level Complete
   waits for a story banner and shows Order payout / Completion reward /
   Earned this level (read from the ledger, `levels/levelEarnings.ts`);
   peel progress "N% peeled" (a read-only `PEEL_PROGRESS` event from the
   scene's existing coverage count); the Order Board lights no bottom-bar
   section; knife/board previews say "in the Market"; Knife Report line
   follows the grade (`game/qualityCopy.ts`), "Prepare Again"; no "Step 1
   of 1" and the step/destination line sits on the HUD card.
   `level-ux-qa`, e2e `levelux.mjs`. Knife/cutting untouched.
34. Phone fridge (both builds): below 768 px a steel fridge wider than its
   frame shows one door/compartment at a time ("‹ name n / N ›", swipe,
   48 px buttons); tablets/desktop keep the wide panning appliance; a
   "Show the whole fridge" toggle. e2e `fridgepager.mjs`; `fridge.mjs`
   checks the wide view at 768×1024.
35. 30-day restaurant history (both builds): `business.finance.history`
   (optional, latest 30 completed days, written by `closeBusinessDay` from
   the day's own DailyPnL + orders; specialist wages added in the restaurant
   build); "Last 30 days" on Operations. No money, ledger or settlement
   change. `business-history-qa`, e2e `history.mjs`.
36. Lazy Restaurant screens + asset cleanup: the back office, Restaurant
   Service and Inventory are one lazy chunk (`kc/restaurantScreens.ts`;
   ScreensRouter 216 → 98 KB) with an "Opening the restaurant…" state;
   `src/assets/kitchen$f` (a copy of kitchen/skin-06.webp) and
   `src/assets/tomato.webp` removed after a full reference scan.
   `lazy-load-qa`, `unused-assets-qa`, e2e `lazyload.mjs`.

37. Developer decisions of 2026-10-06 (restaurant build unless noted):
   Premium supplier kept with provisional extras (+1 day freshness, +2 %
   quality bonus; `restaurantEconomy.SUPPLIER_EFFECTS`); the Staff screen
   in two teams (Kitchen Team / Restaurant Team); asset audit written
   (`docs/ASSET_AUDIT.md`: USED / POTENTIALLY USED / SAFE TO REMOVE).
   Confirmed as already built: staff free before L91, specialist wage
   placeholder, bulk tiers 3/5/8 %, item effects on real stock, one Asian
   Chef, 2 services a day (3 from L51), menu curation from L51 (never
   permanent), no menu guests in batch groups. `restaurant-economy-pass-qa`
   Y, `restaurant-backoffice-qa` T2.
38. Next gameplay phase prepared (pure, NOT wired, no economy change):
   `restaurant/restaurantEvents.ts` (Dinner Rush, Large Group, Today's
   Special as a restaurant event re-using the existing $50/day bonus),
   `restaurant/restaurantStanding.ts` (rank, stage, Restaurant Complete at
   L250 → Endless Restaurant, Endless stars as status only),
   `endlessDemand.cookableMenuDishes` extracted (logic unchanged).
   `restaurant-endgame-qa`.
39. Prepared systems connected (2026-10-06, restaurant build only; release
   unchanged): Endless events drive the Endless day's customers
   (`businessCustomersToday`), Today's Special is weighted into the order
   pool and pays the EXISTING $50 once a calendar day
   (`App.payTodaysSpecial`), the events show on Restaurant → Overview and
   Service (`EndlessDayEvents`); End Business Day awards 0–3 Endless stars
   (profitable / busy = the day's customer target / clean = inspection
   passed), kept for life in `business.endlessStars` and per day on the
   history record; Restaurant Progress shows the restaurant standing, the
   Endless lock line and the lifetime stars. Fridge pressure studied with
   the current values (`restaurant-fridge-pressure-qa`,
   `docs/RESTAURANT_FRIDGE_PRESSURE.md`): the fridge never binds in the
   campaign, so NO value was changed — the lever is a design decision for
   the economy pass. Favicon is relative (`./favicon.ico`). Bug found by
   the browser test and fixed: the event rules copied the $50 constant at
   module load and showed "$NaN" in the bundle (now read when used).
   Endless with events (30 days, `restaurant-endless-qa`): $132 / $209 /
   $344 / $519 / −$189 a day (was $78 / $135 / $276 / $452 / −$262; the
   $50 bonus is most of the change). Browser:
   `tools/e2e/restaurantendless.mjs`.
40. FINAL ECONOMY PASS (2026-10-06, restaurant saves only; release
   untouched; `docs/ECONOMY_FINAL.md`): target ≥ $150k at L250 for a
   completionist (preferred $160k–$175k) → $168,348 (was $128,063). Kitchen
   tiers $110k (was $135k) with +1.5–7 % restaurant quality and guest seats;
   equipment quality ≤ 5 % (Blacksmith now worth something); service
   capacity caps menu guests; Emergency Service (no quality bonus on a
   pantry/spares service); whole-day stocking card (the bigger fridges now
   fill: 101/140 at L250); Today's Special 15 % of the day's revenue ≤ $50 at
   closing; BUSY star = the whole demand (one-chef restaurant 58/90, was 88).
   Saver unchanged ($307,353). QA `restaurant-final-economy-qa`, browser
   `restauranteconomy.mjs`. Open: Premium is still money-best (+$3.2k),
   Wholesale worth only +$679, campaign wages not earned back in the
   campaign.
41. DEVELOPER RULES + RESTAURANT ON (2026-10-08): the developer sets the
   rules; every requested change goes straight to `main` and deploys
   GitHub Pages; `RESTAURANT_MODE` is on in every build (classic =
   `VITE_RESTAURANT_MODE=0`). Plating skip: an extra tap right after the
   last cut no longer fast-forwards the plating (1.2 s guard), a skip plays
   no chime burst, the cooking clip ignores taps for 0.8 s
   (`tools/e2e/platingskip.mjs`).
42. MEASURES, QUICK RESTOCK, MARKET PLAN (developer 2026-10-08,
   `restaurant-measures-qa`, browser `restaurantmeasures.mjs`):
   - Prepare is green (sage), Replay outlined (ghost) — Kitchen card, Order
     Board, Recipe Book. The Kitchen's top-left card shows the restaurant
     rank ("Restaurant rank · n/13", 🏆 name, "Next: … · Lv …").
   - REALISTIC PORTIONS: `business/ingredientMeasures.ts` gives every
     ingredient its item weight and a plate serving (a tomato 0.3 lb — more
     than 3 to the lb). A plate uses one serving per PHYSICAL item (the
     scene's chain rule): an onion peeled, halved and sliced used 3 lb
     before, now 0.35 lb. Menu prices are unchanged (`menuPriceBasis`); the
     real food cost (`recipeCostBasis`) is now ~10 % of the price. Effects,
     measured: completionist $168,348 → $174,503 (Premium $177,373, saver
     $313,237); Endless days $151 / $286 / $423 / $799 / −$106 (were $112 /
     $208 / $327 / $518 / −$187) — the E2/E3 bands were moved to
     $600–$900 / < $200, < $0; the fridge fills ~2.5× slower (completionist
     peak L250 51/140, was 102), so the bigger fridges matter later. The
     classic Business QA checks that pinned "1 lb per step" (Garden Salad
     COGS 300c → 75c, Garlic Bread 0.05 → 0.025 lb garlic, …) were
     rewritten to the new portions at the same strictness. OPEN for the
     developer: keep the higher Endless income and the lighter fridge, or
     rebalance (e.g. smaller fridges, lower Endless demand).
   - Settings → Weights: pounds or kilograms (`settings.measure`, optional;
     restaurant build). The Market sells whole kg (per-lb price × 2.20462),
     every amount on every screen follows the choice (`business/measure.ts`,
     "≈ 3 tomatoes" counts, crate piles from the item count).
   - Quick Restock in the Pre-Service Check: exactly the missing stock at
     the Market price + 25 % (Rush Restock's fee), with the extra shown as a
     warning; one ledger entry per ingredient.
   - Market → Ingredients → Plan ahead: Today / 2 days / 3 days of upcoming
     services, today's menu first, within the fridge's free space, nothing
     that would spoil first; Buy per line or Buy all.
43. AUDIT FIXES (2026-10-08, developer: "fix all"; `restaurant-measures-qa`
   A1–A6, U4, K7, browser `restaurantmeasures.mjs` 3b2, 4c–4e):
   Quick Restock now costs the Market's price for the same amount + 25 %
   (it had been cheaper than the Market); the Market sells ¼ lb / ¼ kg
   steps (garlic for 5 cloves = ¼ lb), bulky produce sold whole (developer's
   fridge choice); levels show what they pay ("about +$363", was the
   completion reward only); the Restaurant Overview before L250 shows the
   campaign day instead of Business Day tools; Progress drops Business
   popularity before L250 and says "Kitchen upgrade"; rank card fixed at
   320 px; supply packs say "1 pack of 12"; "Buy everything in the Market"
   + folded optional sections + Grandma's first-shopping-trip guide;
   board hints only on the next level; Settings → Reduced motion; Plan
   ahead first on a shorter Market banner. Economy: completionist $174,950
   (preferred band's upper limit dropped by the developer — only the $150k
   floor counts), saver $314,400, Endless $151 / $293 / $436 / $849 / −$95,
   fridge peak L250 47.4 of 140. Tried and rejected: lowering Endless demand
   (made a chef-alone restaurant out-earn a medium one).
44. BIGGER TEXT (developer 2026-10-08: "the description and all needs a
   little more size … in every page and section", keeping the font colours
   and styles): every React screen's small text grew ~12–15 % (8→9, 9→10.5,
   10→11.5, 11→12.5, 12→13.5, 13→14.5, 14→15.5, 15→16.5, 16→17, 17→18 px;
   18 px+ headings unchanged), the handwritten Caveat lines ~2 px more
   (14→16), the fridge's labels +0.5–1.5 px; Market → Plan ahead's Buy
   buttons stack "Buy 2 baguettes" over the price so rows fit at 320 px.
   Browser: `restaurantwidths.mjs` + `restaurantmeasures.mjs` on it, no
   sideways scroll at 320–768 px. The Phaser cutting HUD is not React and is
   unchanged.
45. DEEP CHECK (2026-10-09, developer: "deep check for bugs and solve it"):
   a correctness review of the last three changes plus every QA suite, every
   browser test (both builds) and a crawl of every section and tab at
   Levels 2/15/31/91/251 (no page errors, no NaN/undefined text, no
   sideways scroll). Fixed: Buy all could spend a tight wallet on later
   services/guests and leave the next service blocked (the plan now puts
   the next service's own stock first); "no room" for today's stock said
   "buy after today's service"; Quick Restock ignored the Premium
   supplier's extra fresh day; the bulk tier counted Market units, so kg
   vs lb changed the price per pound (now by the stock bought); the
   shortage cap showed a bare number (now lb/kg); Reduced motion left the
   panel entrances, glows and dust/steam moving; the Market plan was
   recomputed on every tap (memoised). `restaurant-measures-qa` D1–D5.
46. TEXT SIZE OPTIMISED (developer 2026-10-09: "you increased size of
   everything a little too much, optimize and don't ruin aesthetics, don't
   decrease the size too much also"): every size item 44 raised is now
   halfway back — descriptions 11 → 12 px (was 12.5), 12 → 12.5 (13.5),
   13 → 13.5 (14.5), 14 → 14.5 (15.5), badges 10 → 11 (11.5); handwritten
   Caveat lines +1 px over the original (was +2); the stacked Plan ahead
   buttons and the pinned bottom bar stay. No sideways scroll 320–768 px.
47. CITY RANKING (developer 2026-10-09: "add some mock restaurants and
   implement a ranking — gradually progress to the top 1 restaurant after
   completing the campaign"; the café rank card was not what they meant):
   `restaurant/cityRanking.ts` — 49 made-up rivals, reputation from the
   completed campaign levels, one rival passed every 2–7 levels, #1 exactly
   at Level 250 (Endless stars only add reputation after). Kitchen card,
   Restaurant Progress hero + city guide, and a Level Complete line when you
   climb. `restaurant-city-ranking-qa`; e2e `restaurantmeasures.mjs` 1a/1b.
48. HIRING FROM THE CHECK (developer 2026-10-09: "doesn't show which staff
   to hire and there is no money to permanently hire"): the Pre-Service
   Check names the missing staff at its top and its footer hires them; the
   Staff screen opened from it scrolls to the Restaurant Team (the costly
   one-time Kitchen Team helpers sat on top and read as the price) and marks
   the needed roles; before Level 91 wages read "Free now · $X/day from Lv
   91". Hiring always was free; wages start with full operation (L91), and a
   team the wallet can't pay is laid off, never debt.
   `restaurant-progression-qa` H1, e2e `restaurantprogression.mjs` 5c.
49. CLAUDE.md SLIMMED (developer 2026-10-09: it burned too many tokens —
   "remove the unwanted things, don't lose any important things"):
   CLAUDE.md is now the rules only (~270 lines, was 1,138); its full former
   text is kept verbatim in `docs/REFERENCE.md` (same section numbers). From
   now on feature details go to REFERENCE.md and a short entry here; CLAUDE.md
   changes only when a rule changes.
50. SOOTHING PLATING SOUND (developer 2026-10-09: "the plating sound is very
   annoying"): `AudioManager.playPlateChime` was a bright triangle note per
   landing piece climbing to 1.17 kHz every ≤ 90 ms, plus a 2.6 kHz ceramic
   tick. Now a soft low sine (G A C E D, repeating, never climbing), gentle
   swell + 0.7 s warm low-passed fade, a muffled low "set down" instead of
   the tick, ~1/3 the volume, and at most one sound every 200 ms
   (`PLATING.CHIME_LADDER`, `CHIME_MIN_GAP_MS`). Skipped platings stay
   silent (`platingskip.mjs` 4).
51. FIRST LEVELS, PASS 1 (developer 2026-10-09, "Levels 1–15 retention":
   the start is where players decide to stay; presentation only,
   `restaurant/firstLevels.ts`): the bottom bar opens one section at a time
   (Kitchen L1, Inventory L3, Market L7, Progress L10, Restaurant L11; a
   closed one shows 🔒 "Lv N" and a tap says when it opens; the Kitchen's
   Market / Progress places and the ranking card wait too); the Market before
   L10 is a look at Knives and Cutting Boards only (the Santoku and Maple
   Board arrive at L10, never required); Grandma says one line on each of
   Levels 1–15's Level Complete (the developer's words), which also names a
   section that just opened; before Level 21 a day ends quietly (the same
   `closeDay`, "☀️ Day N begins" on Level Complete) and opens without its
   card — the opening card and Closing Time start at L21 (fridge &
   freshness); Level 10's milestone is a bigger card listing the Market's
   first tools and the menu next. Rewards, level order, cutting, stock (L15)
   unchanged. Report: `docs/LEVELS_1_15_REPORT.md`. Tests changed to the new
   rule: `restaurant-day-qa` O4/W2, wiring regexes in `level-ux-qa` N1,
   `restaurant-backoffice-qa` W1, `restaurant-stock-qa` W1;
   `tools/e2e/restaurantday.mjs` (the ceremony from L21). New:
   `restaurant-first-levels-qa`, e2e `restaurantfirstlevels.mjs`. Next:
   pass 2 (Grandma's leftovers in the fridge from L3, used from L4, running
   low L12, a top-up from the real need L13, preview L14), pass 3 (stars,
   customer lines, checklist).
52. FIRST LEVELS, PASS 2 — GRANDMA'S FRIDGE (developer 2026-10-09;
   `restaurant/grandmasFridge.ts`, on the ONE inventory, the recipes' own
   portions and the Market's own prices): Level 3 Grandma's leftovers (once,
   `business.grandmasFridge`; Levels 4–12's real needs at a dull knife's
   most, cost 0, no ledger; an older save at L4–14 gets the levels it still
   has to play; never more than fits); Levels 4–14 a level's own order uses
   its planned ingredients (`consumeCampaignOrderStock` early branch: as much
   as is there, never blocking; replays, menu guests and L1–3 use none; L15+
   unchanged); Level Complete "🧊 Left in the fridge: …"; Levels 12/13/14
   open a sheet with Grandma's note (running low · the top-up = need − usable,
   whole Market steps, Market price, optional, "Buy" → the Market at that
   step · a preview of Levels 14–15), START never waits; Inventory explains
   the leftovers until L15. Money: none moves except an optional top-up
   (about $3.55 at L13). Tests changed (wiring regexes only):
   `level-ux-qa` N1, `restaurant-day-qa` W2, `restaurant-guests-qa` W2. New:
   `restaurant-grandmas-fridge-qa`, e2e `restaurantgrandmasfridge.mjs`.
   Review fixes (developer 2026-10-09): (1) the restaurant build's
   Inventory (and the Market card's "N menu dishes") measured stock against
   the whole 48-dish Business catalog; the inventory selectors now take the
   menu in effect (`inventoryAnalytics` `MenuInEffect`, default unchanged)
   and the restaurant passes `restaurantMenu.inventoryMenuOf` (the active
   menu at its level) — before L11 no menu need / "low for today's menu" /
   dish count, a "menu opens at Level 11" card instead. (2) The L15
   first-shopping card was gated on "never bought and fridge empty"; it is
   now `firstRestock.isFirstStockService` (no stock level completed yet —
   derived from level progress, no new flag), opens the sheet on that
   service even with nothing missing, and explains the hand-over from
   Grandma's leftovers and the top-up. `restaurant-measures-qa` A2 changed
   to the new rule.

## 4. Open issues from the Level 1–10 audit (not fixed yet)

Priority order as agreed in the audit (P0 = before wide release):

- ~~P0 — G1~~ **fixed 2026-09-29**: leaving a campaign level (Served
  screen or pause menu) after its required orders are served and paid now
  completes it through `finishCampaignLevel` / `finishBatchGroupLevel`, so a
  retry is a replay and pays nothing. The partial case is fixed too
  (developer decision #5): each paid order is saved in
  `levelProgress.paidOrders`, so leaving after the 1st of 2 orders and
  retrying carries on from the 2nd instead of paying the 1st again.
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
- ~~P1~~ **fixed 2026-10-05** (item 33): Level 10's reward notice now waits
  for the story banner instead of being dropped; Level Complete lists Order
  payout + Completion reward + Earned this level; peel steps show "N%
  peeled" and a bar.
- P2 — fixed 2026-10-05 (items 33–36): stale "Next: Santoku · Lv 10" hints
  (now "… in the Market · Lv 10"), Knife Report copy, the faint label under
  the HUD card, the Kitchen highlight on the Order Board, the unused assets
  `src/assets/kitchen$f` and `src/assets/tomato.webp` (removed), and the
  Restaurant UI in the startup path (now a lazy chunk).
- P2 still open: the first-load bundle itself — the startup chunks still
  carry the game data (levels, recipes, definitions) and the Business game
  logic App/SaveManager need to load and save; Phaser stays its own lazy
  1.46 MB chunk.

## 5. Story presentation — remaining recommendations

Implemented: pacing, Skip, per-beat entrance, tint crossfade, art drift,
reduced-motion fallback, double-tap / tap-through protections.

Not implemented (from the audits, all CSS/asset-free):

- Reuse the already-downloaded `kitchen-bg.jpg` as the story background
  plate so the last beat dissolves straight into Level 1 (same image).
- Render the existing `fx` data (dust/spark/coins) with CSS particles;
  class hooks on existing SVGs (lamp flicker, key glint, chef breathing).
- Larger dialogue portraits + speaker handoff; ≥12 px card/label text;
  better contrast on the dark "decline" tint.
- Milestone banners: a story variant placed below screen headers, queued
  after the Level Complete toast instead of replacing it.
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

53. FIRST LEVELS, PASS 3 — GOALS, STARS, CUSTOMER LINES, CHECKLIST, LEVEL 9
   INGREDIENT LIST (developer 2026-10-09; `restaurant/levelGoals.ts`,
   `levelChecklist.ts`; restaurant build, Levels 1–15, presentation only,
   uncommitted on the branch with the Pass 2 review fixes). The order card
   shows the customer's own line (recipe `customerDialogue`), the goal and
   the best stars, and a multi-step dish's real checklist; stars are the
   engine's grade ladder on the saved best score (no money, no save field;
   L7 and L9 aren't graded by the engine, so no stars there); the Order
   Board shows the stars and, from L9, "What's in this dish?"; Level
   Complete adds "⭐ Best prep". Grandma's lines: Pass 1's, unchanged. New:
   `restaurant-level-goals-qa`, e2e `restaurantlevelgoals.mjs`.

54. BANNER CLOSE + AUTO-CLOSE (developer 2026-10-09): every MilestoneBanner
   (Level Complete, milestones, late Replay Bonus) has a ✕ (48 px,
   `banner-close`); starting a level (`App.beginLevel`) closes the last
   level's cards so nothing sits over the board, and queued "Milestone
   reached" notices wait until the player is off the cutting screen. e2e
   `restaurantfirstlevels.mjs` 1b, 3b.

55. NEW-PLAYER POINTERS + NO LOCKED LINKS (developer 2026-10-09: "there is
   no instruction to visit or see these"; "Upgrade refrigerator goes
   directly to the locked page"): `App.go` refuses any screen of a section
   still closed (`firstLevels.lockedScreenHint` → "🔒 Restaurant opens at
   Level 11"), and Inventory / Market hide the links into closed sections
   (`navLevel.useTabOpen`: Restock / Go to Market until L7; Upgrade
   Refrigerator, View Business Performance, Change supplier until L11).
   The Kitchen's Today's Order card shows Grandma's tip for Levels 1–15
   (`GRANDMA_TIPS`; a button to the new section beside "See all orders"),
   "What's in this dish?" from L9, and a section says NEW in the bottom bar
   for its first two levels. QA `restaurant-first-levels-qa` L1–L3/W5, e2e
   `restaurantgrandmasfridge.mjs` 1d.
56. MISSING STOCK BLOCKS FROM LEVEL 4 (developer 2026-10-09: "without these
   ingredients in stock I still can cut and serve it" — L14 with zucchini
   and mozzarella Out still started). Levels 4–14's own orders now need
   their ingredients (`campaignStock`: the lenient early branch is gone;
   `serviceStockCheck(…, { ownOrders: true })`), so the Pre-Service Check
   opens and START waits. Before L10 (no ingredients for sale) the rows
   show "✗ Missing" without prices and Grandma's pantry fills the gap free
   (no emergency mark); from L10 the normal Buy / Quick restock, pantry when
   unaffordable. Menu guests still need stock only from L15. Tests changed
   to the new rule: `restaurant-grandmas-fridge-qa` C3/T4,
   `restaurant-stock-qa` A1, `restaurant-day-qa` O4 (stocked save), e2e
   `restaurantgrandmasfridge` 4c/5b (+ new 6d L14, 6e L5), `lazyload`
   (seeds L13–14 stock). The campaign sim now gives the leftovers like App;
   completionist $174,950 → $174,948.

## 6b. Current state (2026-10-09, end of session)

- `main` has Passes 1–3 and the Pass 2 review fixes (pushed 2026-10-09 at
  the developer's request for testing on Pages).
- Release order agreed: Pass 1 → Pass 2 (+ review fixes) → Pass 3, then
  test Levels 1–15 together on Pages before `main`.

### Running the browser tests in the cloud container
- Serve: `npx vite preview --host 127.0.0.1 --port 4173 --strictPort`
  (plain `localhost`/IPv6 fails); classic build:
  `VITE_RESTAURANT_MODE=0 npx vite build --outDir /tmp/claude-0/classic-dist`
  served on 4174.
- Chrome: `CHROME_PATH=/tmp/claude-0/chrome-nosandbox.sh` (a wrapper:
  `exec /opt/pw-browsers/chromium-1194/chrome-linux/chrome --no-sandbox "$@"`),
  `KC_URL=http://127.0.0.1:4173/`.
- The Bridge CDN is blocked here: run the tests from a COPY of
  `tools/e2e` (`/tmp/claude-0/e2erun`, node_modules symlinked) whose
  `harness.mjs` answers `https://bridge.playgama.com/...` with the official
  npm build (`/tmp/claude-0/pgb/package/dist/playgama-bridge.js`) via
  `page.setRequestInterception` (cooperative: respond priority 1000,
  continue priority 0). `lazyload.mjs` intercepts itself: run it with
  `KC_OWN_INTERCEPT=1` and let its own handler serve the Bridge. Never
  commit these test-env patches.
- `restaurant*.mjs` on the restaurant build; every other e2e on the
  classic build. Run them one at a time (parallel runs time out).

## 7. Useful facts

- Starting wallet $1,240.00 (124,000 cents). Levels 1–10 on a first run pay
  $667 in order settlements + $636 completion rewards (after the G2 fix).
- Intro timing: Part 1 7.6 s, Part 2 6.0 s, Part 3 7.9 s; measured live
  22.4 s including two prompt button presses; Skip closes in ~130 ms.
- Bundle impact of the story change: main JS +~0.4 KB gz, CSS +~0.2 KB gz.
- Tests run in headless Chrome only; no real-device test has been done yet.
