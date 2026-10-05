# KNIFECRAFT — PLAYGAMA EDITION — CLAUDE PROJECT INSTRUCTIONS

## 0. READ FIRST

This repository (`D:\WORKS\GAMES\Playgama\KnifeCraft`) is now the **primary
KnifeCraft codebase**. The game ships through **Playgama**, which distributes
it to its own catalog and to partner platforms (CrazyGames, Yandex, MSN,
GameDistribution, YouTube Playables, TikTok, …). We do **not** deploy
directly to YouTube Playables any more.

The old repository `D:\WORKS\GAMES\Knife Craft` (the YouTube Playables build,
GitHub `mishal4583/Knife-Craft`) is retired. Do not edit it; do not push this
repo to its GitHub remote. Its history is included here (branch `main` starts
from its last commit `1af591f`; the ref `youtube-original/main` points to it).

Before starting work, read:

- `docs/HANDOFF.md` — where the project stands, what was done in the previous
  sessions, the Playgama cabinet state, open issues and next steps.
- `docs/playgama/` — Playgama requirements and Bridge SDK docs.
- `docs/ECONOMY_V3_MASTER_SPEC.md` / `docs/ECONOMY_V3_EXECUTION_PROTOCOL.md`
  only when a task touches the economy.

This is an existing production game. Do not rewrite the architecture, do not
create a second engine, and do not duplicate existing systems.

---

## 1. PROJECT

- React 19 + Vite + TypeScript + Tailwind v4, Phaser 3.90 for the cutting
  gameplay (lazy-loaded `Preparation` chunk).
- Portrait-first (9:16 logical 540×960, `GameShell` contain-fits it).
- 250 campaign levels (25 chapters), Market (knives, boards, suppliers,
  ingredients, Blacksmith, supplies), Restaurant Progress, Business Mode
  (Economy V3), opening story + milestones + finale.
- One wallet in **USD cents** (`SaveData.credits`), every movement in
  `SaveData.economyLedger`.

---

## 2. PLATFORM: PLAYGAMA BRIDGE (v2)

- The Bridge script is loaded from Playgama's CDN in `index.html`
  (`https://bridge.playgama.com/v2/stable/playgama-bridge.js`) before the
  game bundle. `public/playgama-bridge-config.json` sits next to
  `index.html` (interstitial/rewarded placement fallbacks, 60 s minimum
  between interstitials).
- `src/game/PlayablesSDK.ts` is the **only** file that touches
  `window.bridge`. Everything else calls its exports (`platformReady`,
  `startPlatform`, `gameReady`, pause/audio hooks, `loadCloudSave` /
  `saveCloudSave`, `requestInterstitialAd`, `requestRewardedAd`, …).
  The export names are kept from the YouTube build on purpose — callers did
  not change.
- `bridge.initialize()` must resolve before any other Bridge call
  (`platformReady()` awaits it). `game_ready` is sent once, when Level 1's
  scene is ready or the Kitchen mounts.
- Saves go through **Bridge storage** (key `knifecraft_save`), never
  `localStorage` directly (plain localStorage is only the fallback when no
  Bridge exists). Outside Playgama the Bridge runs a local "mock" platform
  whose storage is backed by localStorage.
- Ads (Playgama monetization guide + Bridge docs): interstitials only at
  natural breaks through `src/game/ads/interstitialPolicy.ts` — none before
  3 completed levels, then any natural break once 150 s (the guide's
  120–240 s) have passed since the last ad of any kind; the config's
  `minimumDelayBetweenInterstitial` is 120. Rewarded = the Replay Bonus
  (`src/game/ads/replayBonus.ts`) and Business Rush Restock, granted only
  when Bridge reports the `rewarded` state. One placement per ad spot
  (`AD_PLACEMENT`, listed in the config): `level_completed`,
  `business_day_end`, `replay_bonus`, `rush_restock`. Locally the mock
  platform reports ads as unsupported.
- Level messages: `level_started` / `level_completed` (App play sessions
  and Business orders) and `level_paused` / `level_resumed` (in-game pause
  menu), with `{ world, level }` (world = `chapter-N`, `todays-special`,
  `endless` or `business`). No `level_failed`: the game has no fail state.
- The Bridge SDK is required for every build. **Never publish a build in
  which Playgama did not detect the SDK.**
- Language: English only (the game reads `platform.language` and stays EN).

---

## 3. PLAYGAMA DEPLOYMENT (MCP)

The Playgama Developer Cabinet MCP server is `playgama-developer-cabinet`
(`https://developer.playgama.com/api/mcp`, add with
`claude mcp add --transport http playgama-developer-cabinet https://developer.playgama.com/api/mcp`,
then authenticate via `/mcp`). Never ask for the developer's password.

- Game: **KnifeCraft**, applicationId `cmuiim0sh1qcalc0hiuw6xwlp`.
- Always start with `get_launch_steps` and re-read it after each step.
- New build: `npm run build` → zip `dist/` (index.html at the zip root,
  forward-slash paths) → `start_archive_upload` (name archives with the
  version, e.g. `knifecraft-playgama-1.0.1`) → PUT → `confirm_archive_upload`
  → poll `get_archive_status` until processing is DONE and `state` is
  resolved. On PROBLEM or NOT_CHECKED tell the developer `state.message`
  verbatim. `bridgeSdk` must be FOUND.
- `publish_sandbox` (public immediately, no moderation) and
  `start_sandbox_traffic` (spends budget) — **always ask the developer
  first.** Hand out links from the tool answers; never build URLs.
- QA Tool links: always request them with `get_archive_qa_tool_link`
  (never build them). Moderation submission is done by a human in the
  cabinet after certification in the QA Tool.
- Covers live in `playgama/covers/` (`source/` originals,
  `upload/` exact-size files: square 800×800, portrait 1080×1920,
  landscape 1920×1080).

---

## 4. BUILD, PREFLIGHT, RELEASE

```
npm ci                      # first time
npm run dev                 # dev server
npm run build               # -> dist/
npm run preflight           # local platform checks (Bridge script/config, sizes, no orientation lock, safe names)
npx vite preview            # serve dist/ on http://localhost:4173 for browser tests
```

Release zip: zip the **contents** of `dist/` (index.html at the root, no
spaces in names) into `releases/KnifeCraft-Playgama-v<version>.zip`
(`releases/` is gitignored). Verify the zip lists `index.html` at the root
and `playgama-bridge-config.json` beside it before uploading.

---

## 5. QA

Focused suites (`npx tsx scripts/<name>.mts`):

- `story-intro-qa` — intro pacing, Skip story, story save semantics.
- `campaign-paid-orders-qa` — a multi-order level (or batch group) saves
  each order it pays (`levelProgress.paidOrders`, `levels/paidOrders.ts`):
  a retry carries on from there, a level never pays more orders than it
  requires, completing it clears the entry, old saves load unchanged.
  Browser: `tools/e2e/paidorders.mjs` (Level 30: serve 1 of 2, leave,
  retry → 2 settlements, not 3).
- `restaurant-unlocks-qa` — Unified Restaurant foundations
  (`docs/RESTAURANT_INTEGRATION_AUDIT.md`): the ONE build switch
  `src/game/config/restaurantMode.ts` `RESTAURANT_MODE` (false; no other
  restaurant flag; restaurant modules never read it), the unlock table
  `src/game/restaurant/unlocks.ts` (stock L11, fridge L21, equipment L41,
  dine-in L61, cleaning + staff L81, suppliers L101, menu L121, takeaway
  L151, efficiency L181, advanced L201, full management L221, grand
  preparation L241), and stock needs for every recipe
  (`restaurant/recipeRequirements.ts`, the rule Business dishes use too).
- `restaurant-stock-qa` — Unified Restaurant phases 3–4 (switch ON
  paths, tested as pure functions): rolled service tickets
  (`restaurant/serviceTickets.ts`, seeded per level, saved in
  `levelProgress.tickets`, dropped on completion, served in order by
  `createTicketedServiceSession`); campaign orders take their recipe's real
  stock from `business.inventory` on serve from Level 11
  (`restaurant/campaignStock.ts`), exactly once, never expired, never on a
  replay, with no money or ledger change (order pay unchanged — Economy
  TODO P0); the Pre-Service Check (`restaurant/preServiceCheck.ts`,
  `kc/restaurant/*`): need / usable / whole units at the Market's own
  price, wallet and fridge verdicts, Restock → the Market preset to that
  ingredient and quantity, Grandma's pantry only when the wallet can't
  cover it (goods, no money). Browser: `tools/e2e/restaurantstock.mjs`
  against a **test build** `VITE_RESTAURANT_MODE=1 npx vite build --outDir
  <dir>` (a normal build always has the switch off).
- `restaurant-menu-qa` — the menu from Level 1
  (`restaurant/restaurantProgression.ts` MENU_UNLOCKS + `restaurantMenu.ts`):
  2 dishes at L1, the developer's target band met at EVERY level, all 48 by
  L241; rules (techniques taught, cuisine open, meat L101 / fish L109 /
  ribeye L106); cuisines with specialist chefs from L51, announced 5 levels
  ahead; active menu (runs itself before L51, never empty, locked never
  orderable); level/recipe/dish data untouched.
- `restaurant-day-qa` — the restaurant day clock (`restaurant/restaurantDay.ts`):
  Lunch + Dinner (+ Breakfast from L51); opening card; services = first
  completions; Closing Time before the next level (chores, the day's count);
  before L21 only the day number moves, from L21 the freshness clock and
  spoilage, from L91 End Business Day exactly; old saves default to Day 1.
  Browser: `tools/e2e/restaurantday.mjs` (restaurant test build).
  The game map is `docs/GAME_MAP.md`.
- `restaurant-guests-qa` — phase D, orders from the ACTIVE MENU inside
  campaign services (`restaurant/menuGuests.ts`): after a level's own orders
  (unchanged, deterministic) the service can take menu guests (none before
  L6; 1/2/3/4/5 from L6/21/51/121/201, `MENU_GUESTS_SCHEDULE`), optional,
  one at a time ("🍽️ Menu guest n/N: dish · $price" next to Finish Level).
  At EVERY level 6–250 a guest orders only an unlocked, active dish; a dish
  switched off never appears; seeded per level; the count is saved
  (`levelProgress.menuGuests`) so no guest is paid twice; none on replays or
  batch groups; a guest pays the dish's menu price (`businessCustomerPayment`)
  with ONE "business-revenue" entry and uses real stock from L11
  (`App.serveMenuGuestOrder`). `business-final-audit-qa` F2 and
  `business-wtp-qa` H2 name the two revenue writers (Business serve, menu
  guest). Browser: `tools/e2e/restaurantguests.mjs` (restaurant test build).
- `restaurant-supplies-qa` — phase G, consumable supplies in a service
  (`restaurant/serviceSupplies.ts`, every number in `SERVICE_SUPPLY_RULES`):
  nothing before dine-in (L31); every order dine-in until L71, then a seeded
  ~30% takeaway. Dine-in: a clean place setting (plate + fork + knife,
  reusable → washing) and a napkin; takeaway: container + bag
  (`takePackagingForOrder`) + napkin; taken automatically on serve, never on
  a replay, never blocking there. Dish soap / cleaning liquid are gallon
  bottles (`business.restaurantSupplies` = open-bottle %, settings washing;
  sealed bottles = stock): soap per wash-up (after a service and at start),
  cleaning liquid per closing; "~N services left", low / empty. The
  Pre-Service Check's Supplies section: settings and packaging block,
  napkins and bottles warn; Restock → the Market line; Grandma's spares
  (cost 0, no money/ledger) only when the wallet can't cover what blocks.
  Menu guests need a clean setting. No money moves when supplies are used.
  Browser: `tools/e2e/restaurantsupplies.mjs` (restaurant test build).
- `story-pause-qa` — the finale and milestone banners stop their timers
  (and animations, and finale taps) while paused, resuming with the time
  left (`PausableCountdown` on a fake clock); the finale's "BACK TO THE
  KITCHEN" ends on Kitchen home. Browser: `tools/e2e/finale.mjs` (a real
  Bridge pause mid-finale).
- Browser `tools/e2e/resize.mjs` — a resize or rotation (320 ↔ 768 ↔ 430
  px) never restarts the game: `GameShell` keeps ONE wrapper and changes
  only its style (swapping the tree remounted everything).
- `playables-ads-qa` — Bridge ads (interstitial policy, rewarded Replay Bonus).
- `economy-v2-final-qa`, `economy-v2-qa`, `economy-v2-settlement-ledger-qa`
  — Economy V2 frozen baseline (some checks use `git diff`, so run them in
  this git repo).
- `economy-v25-qa` (+ `economy-v25-simulation`) — V2.5 final-wealth target,
  wallet safety, milestone/Family Legacy once-only, recurring caps, $0
  recovery, 365-day Business runs.
- `economy-final-qa` — the final rebalance + save migration: reward scaling
  (A), affordability (B), no negative money (C), kitchen migration (D),
  milestone migration (E), migration idempotence (F), Level 250 (G),
  Endless unlock (H), Progress/historical accounting (I, J) and the
  four-profile simulation table (K: Normal, Completionist, Aggressive
  Spender, Existing Save).
- `knife-stroke-qa` — the knife as in the developer's POV photos: on the
  cut line, held from the right hand (vertical: tip up; horizontal: tip
  left, handle right), seen from above stood on its edge; tap lands +
  short slice, cut at the end of the stroke within 0.35 s; swipe moves
  with the finger along the drag (push/pull), steady near the tie; tap,
  swipe, drawing and ghost all use it.
- `cut-rules-qa` — the developer's cutting rules (`docs/KNIFE_RULES.md`)
  for every cutting step of all 250 levels + Endless: cut lines across the
  food (vertical, Level 1 style; horizontal only for julienne, Dice's cross
  cuts or a tall food), right-to-left order, knife poised on the last cut
  between cuts and laid down at step end, cards teach right to left.
- `coaching-qa` — beginner coaching: every technique has a how-to card,
  Levels 1–5 teach everything, each later technique is taught only in the
  level that introduces it, the stuck rule (back only with no progress),
  first play only (no replay/Today's Special/Endless/Service/Business),
  the one-line hint only to Level 10, and the ghost never touches
  cut/peel/score state.
- `business-supplies-qa` — Business Supplies (§7, master spec §25): the
  catalog (50 sourced lines, ×0.65, no prep knives/boards, not
  ingredients), the purchase with ONE ledger entry (equipment vs
  packaging), atomic failures, packaging use per order → COGS, the P&L
  cash identity with ingredient analytics food-only, savings never money,
  saves/migration (real `SaveManager.load`), Campaign independence and
  wiring. Browser: `tools/e2e/supplies.mjs` (375×642).
- `fridge-view-qa` — the physical fridge on the Inventory screen (ids,
  zones, production tiers, aggregate freshness, attention, unknown ids,
  navigation-only actions, handle never takes a tap, 48 px targets).
- `inventory-screen-qa` — the Inventory section: 5-item bottom bar, no
  Business Inventory/Supplies tab or `business-inventory` route, the
  Ingredients | Supplies switch (N), supplies coverage/low/all 52 lines/
  read-only (U), all 57
  ingredients with the save's quantity/cost/freshness and fridge (A), the
  one status rule (S), Needs Attention (T), sorting (O), read-only +
  navigation (R), existing saves through the real `SaveManager.load` (C).
  Browser: `tools/e2e/inventory.mjs` (320–1024 px).
- `inventory-market-qa` — the Market/Inventory split (checks 1–16: no buy
  controls in Business, purchase maths, fridge, low stock, expiry,
  purchasing/consumption analytics, supplier modifiers, contracts, funds,
  fridge full, 57 ingredients, 48 dishes, Business-only recipe, old saves).
- `campaign-integrity-qa`, `restaurant-progress-qa`, `business-ux-qa`,
  `progression-preview-qa`, `usd-currency-qa`, `phase7-2-smoke-test`,
  plus the other `scripts/*-qa.mts` / `business-*-qa.mts` suites.

Gates for any change: TypeScript (`npx tsc --noEmit -p .`), ESLint on
`src scripts tools` (0 errors; 6 pre-existing warnings in `src/components/ui`),
Prettier, build, preflight, the relevant QA, and a browser check.

Browser tests: `tools/e2e/` (headless Chrome via `puppeteer-core`; see
`tools/e2e/README.md`). Run `npm install` inside `tools/e2e` once.

Known pre-existing failures (document, do not "fix" by weakening): none
at present. (`playables-ads-qa` B12/B13 depended on the calendar date; the
test now pins `Date.now` to its `NOW` for section B — the cap is unchanged.)

---

## 6. EXISTING CORE ARCHITECTURE — PRESERVE AND REUSE

React app, Phaser 3, `GameBridge`, `PreparationScene`, `events.ts`,
`SaveManager`, Ingredient registry, Recipe system (`campaignRecipes.ts`),
`RecipeComponent`, `OrganizationManager`, `PreparedOutput`,
`RecipeValidator`, `OrderGenerator`, `CustomerOrderManager`,
`ServiceManager`, `EconomySettlement`, `EconomyLedger`, equipment / staff /
supplier / campaign systems, `StoryManager` + `StoryOverlay`, existing UI
primitives (`src/components/kc/common/primitives.tsx`, `Meters.tsx`) and
routing (`ScreensRouter.tsx`, `ScreenId`).

Single sources of truth: ingredient quantities = Business Inventory;
ingredient definitions = Ingredient Registry; recipes = Recipe System;
wallet = `SaveData.credits`; money movements = `EconomyLedger`;
preparation = PreparationScene; events = `events.ts`; platform =
`PlayablesSDK.ts`; persistence = `SaveManager`. Do not duplicate any of them.

---

## 7. ECONOMY RULES

### Economy V2 is frozen (with the approved V2.5 completion-reward change)

Locked Campaign baseline (enforced by `economy-v2-final-qa`):

- Revenue 165,140 · Completion Rewards 77,581 · COGS 37,620 ·
  Quality Bonus 3,315 · Honest Chef Net 208,416

(Completion Rewards were 330,691 and the net 461,526 before Economy V2.5;
that one line changed by the approved rebalance below. Nothing else moved.)
Any unexplained change is a regression. Investigate; never just update the
expected values.

### Economy V2.5 — Final Wealth (approved rebalance)

Goal: a completionist finishes Level 250 owning everything with
$100k–$150k left (simulated: **$111,405** with occasional Business days;
$109,534 campaign-only). `scripts/economy-v25-simulation.mts`,
`scripts/economy-v25-qa.mts` and `scripts/economy-final-qa.mts` prove it
with the real functions.

- **Level rewards** — `levels/levelRewards.ts` `paidLevelReward(level)` is
  the ONE rule for what a level pays (stored `reward.coins` untouched):
  100% L1–20, 90% 21–40, 75% 41–60, 60% 61–80, 50% 81–100, 40% 101–120,
  30% 121–160, 20% 161–200, 15% 201–249, 100% L250. Payout, Kitchen/Journal/
  Preparation displays, Progress, Endless and the Replay Bonus all use it.
- **Restaurant Development** — kitchen tiers are bought, in order, once
  their level is reached: Growing $20k (L21), Established $25k (L41),
  Neighborhood Café $25k (L51), Flourishing $30k (L71), Grand $35k (L91)
  = $135k (`KitchenUpgradeManager.purchaseKitchenUpgrade`, ledger
  `kitchen-investment-purchase`, Kitchen Upgrade screen). Save version 3:
  older saves keep every tier their level had earned
  (`migrateKitchenDevelopment`).
- **Milestone rewards** — the 22 Progress milestones each pay once
  (`progression/milestoneRewards.ts`, $38,200) and Level 250 pays the
  **Final Reward (Family Legacy) $50,000**, unscaled. "Completed" is
  derived from the save; "claimed" is `SaveData.economy.claimedMilestoneIds`
  (plus the never-trimmed `milestone-reward` / `family-legacy` ledger
  entries). Only reached AND unclaimed milestones pay, on every `persist`
  and on load.
- **Economy migration** — `SaveData.economy` (`economy/economyState.ts`,
  `version` = ECONOMY_VERSION 1). A save without it predates V2.5 and is
  migrated ONCE in `SaveManager.load` (`progression/economyMigration.ts`,
  written back immediately; idempotent): balance, items, kitchens and
  Business untouched; milestones it had already reached are claimed
  WITHOUT payment (`waivedMilestoneIds` — no retroactive ~$85k windfall);
  lifetime totals are reconstructed from what the save records.
- **Historical accounting** — `economy.lifetime` is the exact running
  total of every ledger category (updated by `appendLedgerEntry`, never
  trimmed). Progress's "Level rewards earned" / "Invested in your
  restaurant" / milestone figures read it — never today's rates. An old
  save's level rewards = the stored rewards it was paid in full; its free
  kitchens count $0. The reward-curve chart is the one current-rate
  figure and is labelled so.
- **Endless Service** — unlocks after Level 250 (`isEndlessUnlocked`);
  pays each service level's `paidLevelReward`, capped $600/day.
- **Business scale** — inspection fines $55 / $105 (Chicago schedule ÷5);
  staff paid for a 2-hour service shift (cleaner 1.5 h). Ingredient prices
  are per ingredient (`business/businessPricing.ts`, ~65% of 2026 U.S.
  retail, e.g. potato $0.60/lb, tomato $1.00, salmon $6.50, ribeye $9.50);
  menu prices follow at 30% food cost. A no-staff Business nets ~$70/day;
  hiring staff is currently a net cost (their popularity/discount effects
  earn less than their wages).
- **Business menu = 48 dishes**, and every one of the 57 ingredients is used
  by at least one (enforced by `business-dish-catalog-qa` A4). 13 were added
  for that: 7 on existing "A" recipes, 5 on "B" campaign recipes re-graded
  to "A" as genuine dishes (beet & orange, sweet potato hash, peach &
  cheddar board, kiwi & watermelon, strawberry & grape), and **Ribeye with
  Herb Butter** on the one Business-only recipe
  (`BUSINESS_ONLY_RECIPES` in `campaignRecipes.ts`, found by
  `getCampaignRecipe`; kept out of `CAMPAIGN_RECIPES`, so the campaign stays
  frozen at 221 recipes with no butter). New "Dessert" category.
- **Market = purchase, Inventory = stock control, Business = performance.**
  Five bottom-bar sections: Kitchen · Market · Inventory · Business ·
  Progress (`NAV` in `Kitchen.tsx`).
  - **Market → Ingredients** (`MarketIngredients.tsx`) is the ONLY place
    Business stock is bought: all 57 in category groups, today's supplier
    event, contract and Prep Cook pricing through `purchaseQuote`
    (BusinessInventoryManager — the SAME verdict `purchaseIngredient`
    makes, on top of `todaysUnitCost`). Each card shows the wallet effect
    before the tap — "$1,332 → $1,327", from 25 units "You'll have $X
    remaining", "Not enough money — need $X more.", or "Not enough fridge
    space. You have N units of fridge space left."
  - **Inventory** (bottom bar, screen id `inventory`,
    `kc/inventory/InventoryScreen.tsx`) answers "what do I have?" — EVERY
    kind of stock — and has NO purchase controls. A switch at the top picks
    **🥕 Ingredients** (food in the fridge, below) or **🍽️ Supplies**
    (`InventorySupplies.tsx`, screen id `inventory-supplies` opens on it).
    The Ingredients view, in order:
    - header + wallet, "Fridge: <model> · used / capacity";
    - summary cards: Total Stock (units, stock value), Running Low
      (`lowStockItems`), Expiring Soon (`expiringSoon`), Ready to Cook
      (`menuReadiness`, x / 48);
    - Needs Attention, grouped most urgent first (Expired · Spoils tonight ·
      Running low · Low for today's menu · Expiring soon), first group open,
      3 rows each + "View all", every row with Restock →;
    - the physical fridge (below);
    - Ready to Cook + Most needed ingredients;
    - All Inventory: filters (All + the 7 Market groups), sort (Status —
      needs attention first — Quantity, Freshness, Value, Name), compact
      cards (qty, average cost, value, freshness, today's menu need,
      status, Restock →);
    - Stock analytics (stock value, stocked x/57, fridge usage, waste);
    - links: Restock in Market → (`openMarketIngredients` →
      `shop-ingredients`, optionally preselecting the ingredient), Upgrade
      Refrigerator → (Business → Equipment), View Business Performance →
      (Business → Overview).
    - Tapping a crate or card opens a detail sheet above the bottom bar: in
      stock, freshness, days remaining, average cost, stock value, today's
      requirement and what's left after today's service (only for menu
      ingredients, from `menuDemand.perDay`), used by.
  - The view model is `business/inventoryView.ts` (`InventoryItemView`,
    `InventorySummaryView`, attention groups, `sortInventory`) over
    `fridgeView.ts` + `inventoryAnalytics.ts`. Statuses come from ONE rule,
    `business/inventoryStatus.ts` (expired › spoils tonight › critical ›
    expiring › low › healthy), with no threshold of its own: days left from
    perishability (≤ `EXPIRING_SOON_DAYS` = expiring), low =
    `lowStockItems`, critical = low that can't cover one average order
    (`dishesLeft < 1`). Each status shows a marker AND a word.
  - The Supplies view: summary cards (Supplies on hand x/52 lines, Stock
    value at cost basis, Running low, Takeaway orders covered =
    `packagingOrdersCovered`, the smaller of containers and bags on hand);
    Needs Attention kept short (one "Packaging covers N of today's M
    orders" alert, then only packaging lines you stock that `isLowSupply`
    flags, 3 + View all); Smallwares · Tableware (cutlery, crockery,
    glassware) · Takeaway (parcels: containers, boxes, bags) with group
    filters and the stock list (Low / In stock / Owned / None, marker +
    word); "Restock … in the Market →" (`openMarketSupplies`).
  - **Business** (6 tabs: Overview · Equipment · Staff · Suppliers · Menu ·
    Operations) answers "how is my restaurant performing?". ALL staff lives
    in Business → Staff: the waged team (6 roles) and the **Kitchen
    helpers** (`KitchenHelpers.tsx` — Prep Assistant $3,000 L20, Quality
    Chef $6,000 L45, Kitchen Assistant $4,000 L65; one-time, no wages;
    same `App.buyStaff` → `StaffManager.buyStaff`, one "staff-purchase"
    ledger entry). The Market has no Staff tab (developer request);
    `business-ux-qa` S9, `progression-preview-qa` A4, e2e `staff.mjs`. Overview adds
    "Today at a glance" (orders, revenue per dish, margin — from today's
    P&L and `ordersServed`); Operations holds Best-selling dishes
    (`dishSales`, from "business-revenue" ledger entries), Supply
    purchasing (per section: spent, Market orders, saved vs retail;
    packaging used by orders), Ingredient purchasing (`purchasingStats`)
    and Ingredients used (`ingredientConsumption`) — moved from the old
    Business → Inventory and Business → Supplies tabs, which no longer
    exist (no `business-inventory` / `business-supplies` routes; inventory
    alerts open `inventory`). The game keeps only the last completed day's P&L, so
    there are no weekly/monthly figures.
  - The daily accumulator's `inventoryPurchases` counts purchases (one per
    "inventory-purchase" ledger entry; old saves migrate it as 0).
- **HARD RULE — Inventory is read-only.** The Inventory screen (the
  physical fridge included) is a read-only representation of the player's
  actual saved inventory. It must never keep its own stock, prices, money,
  freshness or any other economy state (only view selections: filter,
  sort, the open item); every figure comes from the existing save/economy
  systems (`business.inventory`, perishability, pricing,
  `RefrigeratorManager`, the ledger). Market is the ONLY place ingredients
  are bought; Business → Equipment is the ONLY place fridge upgrades and
  repairs happen. Flow: Market buys → Inventory observes → Menu consumes →
  Business analyzes → Equipment improves capacity/operation. Guarded by
  `business-ux-qa` S8, `inventory-market-qa` 1, `fridge-view-qa` H1/I1 and
  `inventory-screen-qa` R1–R4.
  - The ONE exception: **Throw Out Expired** (`business/discardExpired.ts`,
    a two-step confirm under Needs Attention). It runs End Business Day's
    own sweep early: only expired entries go, valued with the same
    multipliers, recorded as waste (spoilage totals + the day's
    `discardedQuantity` / `discardedValue`, which End Business Day adds to
    its sweep for the inspection and the P&L waste line). No credits move,
    no ledger entry. Guarded by `inventory-screen-qa` D1–D5 and e2e
    `inventory.mjs` 7b.
- **Physical fridge** (refrigerator UI handoff, a UI integration — not
  V3-17) on the Inventory screen: `kc/inventory/fridge/PhysicalFridge.tsx`
  + `.css`, fed by the read-only adapter `business/fridgeView.ts`. An open
  reach-in: Dairy & Tofu on the top shelf, Vegetables in the middle, Meat,
  Fish & Bread low, Fruit and Greens & Herbs crisper drawers, Butter and
  Aromatics in the door (production has no eggs, sauces or oils, so no egg
  tray or sauce rack). One crate per ingredient (quantity, aggregate
  freshness from the weighted `purchaseDay`, days left); production tiers
  (Basic 40 / Commercial 80 / Professional 140, prices from
  `refrigeratorDefinitions`), drawn after the developer's design
  references (refrigerator handoff `design-assets/`, CSS only — the 3 MB
  mockups carry sample numbers and are not shipped): **Basic** a vintage
  cream-enamel single-door with its door open on the right; **Commercial**
  a stainless two-door reach-in (two compartments, both doors open: Butter
  left, Aromatics right); **Professional** three compartments (Dairy +
  Meat/Fish/Bread · Vegetables · Greens + Fruit drawer). Food sits in
  wooden crates (1–3 pieces shown by quantity) with cream tags, zone names
  on wooden signs, glass shelves and crisper drawers. Every shelf and drawer
  holds at least two crates per row (developer: arrange two to a row rather
  than make the fridge taller): steel compartments are 214 px, Basic crates
  shrink to 64 px on narrow phones (set on `.kcf-unit` — a container query
  can't style its own container), and drawers sit side by side only while
  each still fits two crates, otherwise they stack full width
  (`fridge.mjs` check 9). Its header shows the
  model, used / capacity, units available and the cooling line, a status
  from the real condition ("Refrigerated" / "Needs service" / "Broken"),
  never a temperature (the game does not simulate degrees, so no °F/°C may
  appear), and "Upgrade / Service / Repair Refrigerator →" (Business →
  Equipment, `business-refrigerator`, which owns `purchaseRefrigerator`
  and maintenance). The fridge is display only: a tap calls `onSelect`
  (the Inventory screen's detail sheet). The Basic always fits its frame;
  the wide steel models pan sideways inside it ("›" cue + "Swipe to see
  every door →", touch and mouse drag) without blocking vertical scroll.
  The door handle is decorative (`pointer-events: none`, in the door's own
  18 px edge). Business → Equipment's cards use the same small drawings
  (`FridgeMini`) and show the capacity gain (▲ +40). Unknown inventory ids
  are listed, never dropped. `HANDOFF_INGREDIENT_ID_MAP` maps the
  handoff's 57 ids.
  QA: `fridge-view-qa`, `inventory-screen-qa`, `tools/e2e/fridge.mjs`,
  `tools/e2e/inventory.mjs`.
- **Recurring caps** — Replay Bonus 20% of the paid reward, $10–$200,
  3/day; Endless $600/day; Today's Special $50/day.
- **Wallet invariant** — `economy/wallet.ts`: credits are whole cents and
  never < 0. Every expense is all-or-nothing (`debitWallet` or the
  manager's own balance guard); App `persist` and `SaveManager.save`
  refuse a wallet that breaks the invariant. No debt, no bankruptcy.

### Economy V3 (Business Mode)

All V3 phases (V3-1 … V3-16) shipped in the release candidate. V3 lives in
`SaveData.business` (`BusinessState`) — extend it; never add another
top-level save field, save file, wallet, ledger, registry, engine or event
bus. Campaign must never require any Business system (inventory,
refrigerator, perishability, pricing, contracts, supplier events, salaries,
equipment condition, inspections, fines, operating costs).

### Business Supplies (separately authorized extension — not V3-17)

Master spec §25. V3's phase sequence stays closed; this is its own scope
with its own gates.

- **Catalog** — `business/businessSupplies.ts`: 52 lines.
  - Culinary smallwares 18, tableware 17, takeaway packaging & hygiene 17
    (dish soap and cleaning liquid added by Unified Restaurant phase G, in
    "Securing & hygiene"; their prices are from WebstaurantStore's listing
    on 2026-10-04 — re-check them in the economy pass). A bottle line is
    "low" only with no bottle in stock.
  - Every retail pack price comes from a WebstaurantStore product page
    (retrieved 2026-10-02, recorded per line and in §25).
  - Game price = round(retail × 0.65), the ingredient rule.
  - No prep knives or cutting boards (they stay in Knives / Cutting
    Boards). Never ingredients, never in the fridge.
- **Data** — `SaveData.business.supplies` = `{ stock: { id: { units,
  costBasis } }, lifetime per section }`.
  - New and old saves start empty (no prototype opening stock).
  - `migrateBusinessSuppliesState` in `SaveManager.load`.
- **Purchase** — Market only (`MarketSupplies.tsx` → App `purchaseSupply`
  → `BusinessSuppliesManager.purchaseSupply`).
  - All-or-nothing: known id, 1–99 whole packs, funds.
  - Then exactly ONE ledger entry and one persist.
  - Smallwares and tableware: `supply-equipment-purchase`, capital
    (`capitalExpenditure`), never used up.
  - Packaging: `supply-packaging-purchase`, a stock asset with its own
    `packagingPurchaseCost` accumulator/lifetime line. Ingredient
    purchasing analytics stay food-only.
- **Packaging use** — every served Business order uses one container and
  one carry bag (priority lists, first in stock), inside
  `serveBusinessOrder`.
  - Their cost basis is added to that order's COGS.
  - None in stock: none used, never blocking.
- **Inventory → Supplies** (`kc/inventory/InventorySupplies.tsx`, screen
  `inventory-supplies`) is monitoring only:
  - on hand, stock value (cost basis), running low, takeaway orders
    covered;
  - low packaging (below today's customers) and packaging coverage;
  - the stock list;
  - "Restock … in the Market →" (`openMarketSupplies` → `shop-supplies`).
  - Spending (spent, saved vs retail, used by orders) is on Business →
    Operations ("Supply purchasing").
- **Saved vs retail** = retail value − paid: a display metric, never money.

### Safety, determinism, ledger, migration

- Never allow credits < 0, inventory < 0, storage capacity < 0, negative
  menu price / equipment condition / popularity. No debt, no permanent
  bankruptcy, no economic soft-lock.
- Business Mode is deterministic: no uncontrolled `Math.random()` for
  prices, supplier events, spoilage, popularity, demand, inspections,
  failures or money — use the seeded generator.
- Every real wallet movement has exactly one ledger entry; failed
  transactions create none. Opening cash + signed ledger = closing cash.
- Preserve old saves (no `business` field, older V3 shapes, legacy
  settings keys). Never discard known fields; use the nested migration
  pattern in `SaveManager`.

---

## 8. NEVER CHEAT THE TESTS

Never delete a failing test, weaken an assertion, change expected values to
make a test pass, skip a regression suite without documenting why, suppress
or hide console errors, bypass the ledger / SaveManager / wallet /
PlayablesSDK, create fake success states, or claim a browser test or
simulation that did not happen. Pre-existing stale tests are documented,
not silently removed.

---

## 9. STORY SYSTEM (current state)

- Opening intro = the painted cinematic: `src/game/story/introCinematic.ts`
  (data: 7 scenes 1/2/3A/3B/3C/4/5, 13.6 s incl. a 0.8 s push into the
  tomato that fades into the already-running Level 1) played by
  `src/components/kc/story/CinematicIntro.tsx` (one rAF clock, taps step
  one line/scene, 250 ms tap guard, pause-aware, reduced-motion fallback).
- **SKIP ›** (top-right, 48 px, after 1 s) is the only early exit.
  Finishing and skipping share one completion path
  (`CinematicIntro.finish` → `App.completeIntro`) that sets only
  `story.introDone = true`, once. `StoryOverlay` still plays the finale.
- **Story pause** — the finale's beat timers and the milestone banners'
  dismiss timer count unpaused time only (`usePausableTimeout` over
  `game/story/pausableCountdown.ts`, following `PauseManager`); while
  paused their CSS animations freeze (`kc-story-paused`) and finale taps are
  ignored. The finale's last button, "BACK TO THE KITCHEN", ends on the
  Kitchen home screen (`App.finishFinale`; developer decision #21). Every
  path that plays the finale has already paid and saved the level.
- Milestones (Level 10/20/45/70/110/120/250) and the Level-100 finale are
  unchanged. `SaveData.story = { introDone, milestoneMask, finaleSeen }` —
  no new fields.
- Intro screenshots: `playgama/screenshots/intro/`.
- **Cooking clip** — after EVERY preparation, once the chef's hands have
  carried the plate away (RECIPE_COMPLETED) and before the Knife Report,
  `src/components/kc/game/CookingClip.tsx` plays one of six short chef
  films, each 540×960 WebM + MP4 (~0.25–0.65 MB) with a `-poster.webp`:
  **fruit-cup** (`chef-fruit.*`, 3.84 s, from `Fruit cups.mp4`: 2.13–4.46 s
  spooning → 6.50–8.00 s honey drizzle), **salad** (`chef-salad.*`, 2.97 s,
  from `Salads.mp4`), **plating** (`chef-plating.*`, 3.84 s, from
  `Plating.mp4`: 1.42–3.25 s tomato slices into a bowl → 8.0–10.0 s herbs
  and the pull-back over the plated counter), **curry-pot**
  (`chef-curry.*`, 3.67 s, from `Curry.mp4`: 2.04–3.96 s spoon stirring the
  curry → 6.04–7.79 s the chef over the big steaming pot), **bread**
  (`chef-bread.*`, 4.0 s, from `Bread.mp4`: 3.0–7.0 s — tomato spooned
  onto toasted bread, then hands finishing the crostini board) and
  **chef-cooking** (stove,
  `chef-cooking.*`, 3.75 s). `src/game/recipes/dishKind.ts` `dishKindFor(recipeId,
  name)` decides, in order: **fruit** (every ingredient a Fruit, or a
  Business Dessert — 11 recipes, Level 84); **salad** ("Salad"/"Slaw" in the
  dish/recipe name, or a Business Salad — 14 recipes, Level 10);
  **curry** (curry, masala, chutney, minestrone, velouté, soup, French
  onion, dal, stew in the name, or a Business Curry — 18 recipes,
  Levels 51–69, Level 58);
  **bread** (the recipe uses bread or a baguette, or bread, toast,
  bruschetta or crostini in the name — 11 recipes, Levels 11–13, 18, 26,
  29, 30, 49, 74, 80; e2e Level 11);
  **cooked** (a Protein ingredient, a cooking word in the name — stir-fry,
  wok, sauté, rings, gratin, bread, toast, bruschetta… — or a Business
  Stir-Fry/Entree — 103 recipes, Level 36);
  else **plated** (cut-and-plate dishes — 75 recipes incl. Levels 1–9). The clip
  buffers from PLATING_STARTED, is
  skippable (SKIP › or a tap, 300 ms guard), pauses with PauseManager,
  is muted unless `AudioManager.soundAllowed`, and falls straight through
  on error / stall / `prefers-reduced-motion`. All six sources carry the same
  AI watermark (centre 600,1160 of 720×1280), painted out with ffmpeg
  `delogo` (`x=562:y=1122:w=76:h=76`, then scale 540:960; H.264 crf 27 /
  VP9 crf 38), and the SKIP › pill sits over that spot. Source uploads:
  `gemini_generated_video_aa3f242a - Trim.mp4`, `Salads.mp4`, `Fruit cups.mp4`, `Plating.mp4`, `Curry.mp4`, `Bread.mp4` (on `main`).

- **Beginner coaching** (`src/game/coaching.ts`) — a ghost demonstration
  on the board plus a how-to card. PreparationScene draws it
  (`scenes/coachGhost.ts`, its own Graphics layer at depth 29) exactly where
  the next tap would really cut, using the same axis, slot and position rules
  as `resolveTapCut`:
  - cutting: the line glows, then a 3 s loop shows both ways to cut, each
    labelled by the fingertip. **SWIPE**: the fingertip draws along the
    line while a see-through copy of the equipped knife (the same
    `scenes/knifeProfile.ts` silhouette as the real knife) brings its
    knife along the line, held from the right hand and seen from above,
    with the middle of the edge on the fingertip, exactly like the real
    swipe. **TAP**: the
    fingertip taps with a ripple and the knife makes the real tap stroke
    (`tapStrokePose`, below);
  - Peel: a fingertip sweeps across the skin that's left (the peel grid row
    with the most skin);
  - Smash: a press with a ripple;
  - Rings: a tap plus the next ring glowing.
  The scene emits `EVT.COACH` → GameBridge `COACH` → Preparation shows
  `COACH_TEXT[technique]` (title, how, why; on cutting steps also
  `CUT_WAYS`: TAP / SWIPE rows with the same labels). The card is `pointer-events-none`.
  - **Only for beginners, only when needed:**
    - It runs only in a campaign level played for the FIRST time. App
      passes `coachLevelId` only then, so there's none on a replay, Today's
      Special, Endless, Restaurant Service or Business.
    - Only TAUGHT steps get it: every step of Levels 1–5, and each new
      technique in the one level that introduces it (dice 6, smash 9,
      rings 16, julienne 21, radial 23, rock-mince 34, chiffonade 35).
    - On such a step it plays 0.7 s after the step starts and hides on the
      first touch. It returns after 4 s idle only while the player has
      made NO progress on that step (stuck). After a cut or some peel it
      stays away.
    - Untaught steps never show it.
    - The plain one-line gesture hint shows only in Levels 1–10 on a first
      play (`showsBeginnerHint`).
  - It reads cut and peel state only and never commits, consumes a guide
    slot or affects scoring (`coaching-qa` F).
  - No save state: coaching is derived from the level.

- **Knives (look and size)** — every knife is drawn from ONE geometry and
  painter, `src/game/scenes/knifeProfile.ts`:
  - `knifeProfile`: blade outline, cutting edge and spine; a metal
    bolster; a tapered handle with its top in line with the spine, a palm
    swell and a rounded butt; rivets.
  - `paintKnife`: shadow, wood handle with grain and rivets, steel with a
    grind bevel, sheen, honed edge and spine. It uses fills only: Phaser's
    WebGL stroke breaks lines this thin into dots (an edge that looked
    serrated), so outlines and edge lines are filled bands.
  - Blade shape: a straight spine that curves smoothly down to the point;
    an edge that is flat from the heel and then sweeps up (the belly
    starts at `bellyControlXFrac`); a full bolster with a finger guard.
    - Chef / Damascus / Obsidian / paring: the point sits near the spine.
    - Santoku: sheepsfoot, the point at edge level.
    - Nakiri, cleaver: a square front (`tipRiseFrac` 0.5).
  - It is used by the in-game knife (PreparationScene.drawKnife), the
    coaching ghost and the Market icon (`KnifeGlyph`, the same shapes as
    SVG).
  - Proportions follow the real knives (`knifeDefinitions.ts`, in 1/540 of
    the scene width): the chef's blade is about 1/5 as tall as it is long,
    with the handle a little over half the blade, and a negative
    `tipRiseFrac` lifts the point toward the spine.
  - Every knife is drawn `KNIFE_DRAW_SCALE` (1.2×) that size (developer:
    "a little longer and bigger"). Blade, height, handle and the handle's
    thickness limits all scale together. It affects drawing only, never
    the cut geometry.
  - The resting knife lies flat, centred under the ingredient: on the board
    below it, or on the counter in front of the board when there's no
    room — never across the food.
  - **Cutting motion** (`knifeProfile.ts`). The reference is the
    developer's point-of-view photos of a cook slicing a tomato.
    - **Held from the right hand** (`knifeTipDir`): the knife always lies
      along the cut and the handle comes from the cook's right hand, at
      the lower right. The tip points away from that hand.
      - Vertical cut: tip up, handle down.
      - Horizontal cut: tip left, handle right.
      - A "\" diagonal: tip upper left.
    - **Seen from above** (`topViewProfile`, `CUT_SQUASH` 0.32): while it
      cuts, the knife stands on its edge. The blade is foreshortened, so
      you see the spine and a sliver of the face, never the flat side; the
      handle stays round. At rest it lies flat (full profile). A leftward
      tip is drawn mirrored (`poseForTipDir`), never upside down. When the
      knife has to face the other way, dirSign eases through 0, so it
      turns over in the hand.
    - **Tap** (`tapStrokePose`): the knife snaps onto the line, with no
      per-cut tilt. The point `TAP_CONTACT_FRAC` (0.22) along its edge sits
      at the line's middle over the food, so the blade covers the food and
      the handle doesn't hang down the board. The knife waits poised in
      the same place between cuts. It lands and makes one short back-and-forth slice along the
      line (8% of the blade). The cut is committed at the end of the
      stroke: 285 ms (slice) / 150 ms (chop) after the tap, using the
      existing TAP_KNIFE / CHOP_KNIFE timings. Then it lifts (Chop to its
      hover pose, Slice back to rest, lying flat).
    - **Swipe**: the knife moves with the finger, the middle of its edge
      under it, lying along the drag line with the same right-hand grip.
      - Right to left is a push cut, tip leading; left to right is a pull
        cut. A vertical drag gives a vertical knife, tip up.
      - It turns continuously with the drag's line; hysteresis near the
        tie stops it flipping.
    - The pivot (local origin) is the heel of the edge by the bolster.
    - The coaching ghost uses the same functions.
    - Rejected earlier variants, gone:
      - the knife drawn flat (side-on) while cutting;
      - a tip-leading "pointer" swipe that put the handle away from the
        cook;
      - a diagonal "rocking" stroke;
      - the knife across or along steep cuts.
    - `scripts/knife-stroke-qa.mts` checks all of this, plus the wiring.
  - **Cut plan** (`src/game/cutPlan.ts`; the rules and their sources are
    in `docs/KNIFE_RULES.md`).
    - Direction (`primaryCutAxis`): cut lines run ACROSS the food, i.e.
      vertical lines like Level 1's tomato. Horizontal lines only for
      julienne's lengthwise strips (`cutsLengthwise`), Dice's cross cuts
      (after its vertical slices) and a food taller than 1.35 × its width.
      An ingredient's `axisOverride` still wins. `technique.axis` is no
      longer consulted.
    - Order (`nextCutIndex` / `nextOpenPosition`): right to left, the claw
      hand stepping back. Horizontal sets start nearest the cook. The
      coaching ghost and the cards teach it. A tap still cuts where it lands.
    - Between cuts the knife stays poised on the last cut, stood on its
      edge (`runTapCut`'s stepDone, `poiseKnifeOn` after a swipe). It is
      laid down when the step ends (`layKnifeDown` in `beginStep`).
    - `scripts/cut-rules-qa.mts` checks every level.

---

## 10. UI

Use the existing KnifeCraft UI primitives and visual identity (warm
painted kitchens, wood/paper, Fraunces / Nunito / Caveat bundled locally).
Touch targets ≥ 48 px. Test at 320×568, 360×640, 390×844, 430×900,
768×1024. Do not add animation libraries or large assets; prefer CSS
transform/opacity. No external fonts, video or network requests at runtime
(only the Bridge CDN script); the bundled videos are the six cooking clips (§9).

---

## 11. REPOSITORY LAYOUT (additions for Playgama)

```
playgama/covers/source/        original cover art (Poster, Icon, Landscape, portrait crop)
playgama/covers/upload/        exact-size files uploaded to the Playgama form
playgama/screenshots/intro/    the 14 intro screens + Level 1 after the intro
docs/HANDOFF.md                project status and history for new sessions
docs/playgama/                 Playgama requirements + Bridge SDK docs (reference)
tools/e2e/                     headless-Chrome checks (Bridge-aware harness)
releases/                      built zips (gitignored)
public/playgama-bridge-config.json
```

Reference-only folders carried from the original repo (not part of the
build): `Knifecraft vegetables/`, `Knifecraft Phase 1 review/`, `Shop UI/`,
`knifecraft_kitchen_webp/`, `Market.png`, `*.docx`, `*.md` audits.
`.github/workflows/deploy.yml` is the old GitHub Pages workflow of the
retired repo; it does nothing here unless this repo gets a GitHub remote.
