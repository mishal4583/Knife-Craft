# KnifeCraft — Transformation Phase 0 audit (2026-10-25)

Scope: the "customer-driven idle restaurant" plan, Phase 0 only. **Nothing in the game was
changed for this audit.** Source: `main` at `06d7e67`, working tree clean.

**Evidence used:**
- the code;
- the game's own simulator (`scripts/restaurantCampaignSim.mts`);
- a scripted fresh-save browser walkthrough (`fresh.mjs`, scratch);
- Playgama's publication records and live player telemetry;
- the test runs of 2026-10-24 (§7).

## 1. Current architecture

| Layer | What | Files |
|---|---|---|
| App shell | React 19 + Vite + TS. `App.tsx` (~3,600 lines) holds the save, `persist()`, routing (`ScreensRouter.tsx`, `ScreenId`). | `src/App.tsx`, `src/ScreensRouter.tsx` |
| Cutting | Phaser 3.90 scene, lazy chunk. React talks to it only through `GameBridge` + `events.ts`. | `src/game/scenes/PreparationScene.ts`, `src/components/kc/game/Preparation.tsx` |
| Orders | One state machine: `PENDING → ACTIVE → PREPARING → READY → SERVED → PAID → COMPLETED`. Linear; `isPayableTransition` lets an order pay once. | `service/orderStateTypes.ts`, `ServiceManager.ts`, `OrderGenerator.ts`, `RecipeValidator.ts` |
| Recipes | `campaignRecipes.ts` (the real library) and the business dish catalog. `dishService.ts` derives how a dish is cooked (oven / fry / pot / sauté / grill). | `recipes/`, `business/businessDishCatalog.ts`, `restaurant/dishService.ts` |
| Money | One wallet (`credits`, cents) and `EconomyLedger` (one entry per movement). Settlement: `EconomySettlement`; tips: `customerTips.ts`. | `economy/` |
| Campaign | 150 levels, 13 chapters. A level is one service of 1–3 tickets plus optional menu guests. | `levels/` |
| Restaurant systems | Unlocked by level (`RESTAURANT_SYSTEMS`, `isSystemLive`):<br>• day clock, closing, menu, fridge, dine-in, staff, cuisines, takeaway;<br>• cleanliness, deliveries, par audit, Second Floor. | `restaurant/` (~70 modules) |
| Business engine | The full Business Day (`BusinessServiceManager`): generates menu orders → checks inventory → existing cutting → one atomic serve → ledger. In the restaurant build it runs **only after Level 150** (Endless Restaurant). | `business/`, `daily/EndlessServiceManager.ts` |
| Persistence | `SaveManager` through Bridge storage, key `knifecraft_save`. | `SaveManager.ts`, `PlayablesSDK.ts` |

## 2. Feature inventory: does it exist, and can a player see it?

| Requested feature | In code | Seen in the current build? | Notes |
|---|---|---|---|
| Customers with orders | Yes: named customer per ticket, 5 special personalities, menu guests | **Order card only.** No figure arrives at a table during service. | Figures exist on the Restaurant map (`staffLife.ts`) and the Second Floor (`floorLife.ts`) as animation only. |
| Order lifecycle, pays once | Yes (above) | Yes | Serve, Prepare Again and Finish Level are buttons on a card. |
| Cooking step | A **cooking clip** after every dish (6 painted films by dish kind, skippable) | Plays, but passive | Nothing to do. Testers' "no cooking" is fair. |
| Serving and reaction | Yes: staged serve card, reaction from the real grade | Yes, on a card | No dining-room view. |
| Cash vacuum | Yes (`cashBurst.ts`, `CashVacuum.tsx`), credits nothing itself | **Current build only.** Playgama does not have it (§2.1). | In the fresh run the wallet pill showed $1,240 while the save already held $1,295. |
| Tips | Yes: 1 in 3 first-time Masterful orders, 10% (min $5), own entry | Current build only | |
| Restoration reveals | Yes: after a *saved* tier purchase (`App.buildKitchenUpgrade` → `RestorationReveal`), skippable | Current build only | The first tier costs **$20,000 at Level 16**. Nothing smaller changes the room before that. |
| Inventory / Market | Yes, from Level 3; real stock is used | Yes | |
| Staff | 6 Business roles; hire from L29 (`remap(41)`) | Yes | **No role automates cutting.** Prep Cook = 3% off purchases plus menu-guest capacity. Others add popularity, chores or cuts to wages. |
| Idle / offline income | **Second Floor:** real-time, capped, collected once (`lastCollectAt` per station) | Visible from L10, stations from **L60** | The only idle system. The pattern (rate × time, cap, one entry) is reusable. |
| Continuous service without levels | **Endless Restaurant** (the Business Day) | Only after all 150 levels | The closest existing engine to the plan's loop. |
| Daily gift, streak, replay bonus, achievements, ranking | Yes | Yes | |

### 2.1 Which build players have

- **Playgama catalog:** `knifecraft-playgama-1.4.1`, published 2026-10-21. The zip was built from the 2026-10-18 tree (`f76a002`).
- **Playgama sandbox:** 1.4.0, and currently **UNPUBLISHED**.
- **GitHub Pages:** current `main`.

So everything from 2026-10-21 on is missing from the Playgama build:
- cash vacuum and tips;
- serve celebration and special customers;
- gift streak and restoration reveals;
- the cloth, the knife effects and the night chores.

Testers on the Playgama link saw none of it.

### 2.2 Real-player telemetry (Playgama, 2026-10-01 → 10-25)

| Measure | Value |
|---|---|
| Users | 213 |
| Intro completed | 150 |
| Started a level (`progression_started`) | 151 users |
| Completed at least one level | **95 users (63%)** |
| Session length | median **60 s** · mean 483 s · p95 1,319 s |
| Level length | median **36 s** · p90 89 s |
| Highest level, median player | ~3 (`step_index` p50 = 3 among completions) |

About a third of players who start the first order never finish it, and half of all sessions end within a minute. This matches the testers.

## 3. First 20 levels

| Lv | Recipe actually played | First-clear pay | Opens / introduces |
|---|---|---|---|
| 1 | Sliced Tomato Plate (tomato slice) | $50 + order | Slice coached. Only Kitchen and Restaurant map open. |
| 2 | Basic Knife Skills Practice | **$0** (`campaignNoEconomy`) | Dice, Peel. Kitchen card said "about +$130" (fixed, §8 B1). |
| 3 | Garden Tomato & Cucumber | $56 + order | **Market and Inventory.** Real stock from now on. Ad bonuses; interstitials after 3 levels. |
| 4 | Halved Potato Bowl (+tomato) | $59 | Halve |
| 5 | Garlic Bread | $62 | Smash. Chapter 2 (Italian). |
| 6 | Tomato Basil Toast | $66 | Chop |
| 7 | Mushroom Bruschetta | $69 | |
| 8 | Zucchini Garden Plate | $72 | |
| 9 | Caprese Plate | $75 | Ingredient list on the card; Paring Knife on sale. |
| 10 | Simple Garden Salad | $78 | Grandma's tools (free); tools block START; Santoku and Maple Board on sale; **Cleanliness**; **Second Floor visit** (stations L60); Progress; Grandma stops lending; story beat. |
| 11 | Onion Rings Basket | $81 | Rings. **Business tab, menu of 6 dishes, 1 menu guest per service.** Fry tools. |
| 12 | Bruschetta for the House | $84 | First 4-ingredient order; oven tools. |
| 13 | Italian Garden Plate | $87 | Herb Garden Board |
| 14 | Garden Minestrone Base | $90 | Stock pot and ladles |
| 15 | Family Antipasto for Two | $93 | Shared output (one batch, two plates). |
| 16 | Beetroot & Orange Plate | $97 | Wedges. **Fridge and freshness, 3 services a day, opening and Closing Time, shift chores, 2 menu guests.** Growing Kitchen tier ($20,000). |
| 17 | Bruschetta Trio + Garden Tomato Cup | $100 | Batching; Nakiri |
| 18 | Onion Two Ways | $103 | Branching (one onion, two dishes). |
| 19 | Italian Service Night (2 orders from 4) | $106 | Bread Knife, Marble Board; story beat. |
| 20 | Julienne Medley / Zucchini & Fennel | $109 | Julienne. L21: dine-in, dishwashing, deliveries, par audit. |

### Across all 150 levels

**Content:**
- 5 RELAX, 70 ORDER and 75 SERVICE levels;
- 37 multi-order, 28 batch and 41 pool levels;
- 186 distinct recipes referenced;
- 14 levels carry an unlock reward and 12 a milestone.

**What depends on level numbers:**
- `levelNumber` is used 328 times in 37 files;
- `isSystemLive` 46 times in 16 files;
- `remapCampaignThreshold` 52 times in 14 files.

**Level-tied systems:**
- the 22 milestone rewards (`first-dish`, `levels-10/25/50`, …) are achievements tied to level counts;
- the city ranking, story beats (by completed count) and replay bonus;
- daily orders and coaching (first play of a level);
- the Endless unlock (all 150 completed).

**Conclusion:** level progress is the clock for almost every unlock. Replacing levels as the player-facing progression is possible, but every unlock reads `highestUnlockedLevelId` / `completedLevelIds`. Phase H needs a full mapping before any change.

## 4. Starting economy: $0 vs $1,240

- A fresh save starts with **$1,240** (`DEFAULT_SAVE.credits`), the same in 1.4.1 and today.
- The "$3,000" figure isn't reproducible; you said it was a testing mistake.

Simulated with the real campaign simulator (150 levels, real stock, supplies, staff and chores):

| Profile | Start | L1 | L3 | L10 | L20 | Final (L150) | Supplier credit | Blocked |
|---|---|---|---|---|---|---|---|---|
| Diligent (saves) | $1,240 | $1,443 | $1,742 | $3,866 | $8,793 | $267,210 | none | no |
| Diligent | **$0** | $203 | $502 | $2,626 | $7,553 | $265,970 | none | no |
| Completionist (buys all it can) | $1,240 | $33 | $332 | $29 | $116 | $132,066 | ×5 ($132) | no |
| Completionist | **$0** | $113 | $92 | $138 | $263 | $131,006 | ×3 ($97) | no |
| Broke (drained) | any | $203 | $161 | $807 | $272 | $70,355 | ×202 ($2,140) | no |

**What this shows:**
- **A $0 start doesn't block anyone.** Level 1–2 food is provided, and supplier credit plus the rewarded-ad cover already prevent soft-locks.
- **The end of the campaign barely moves:** −$1,240 diligent, −$1,060 completionist.
- **The $1,240 currently does nothing for the feeling of earning.** A spender burns it on Level 1, and a saver watches it sit there while $50–$100 a level trickles in.
- **The real problem is what there is to spend on.** Before Level 10, the Market sells only ingredients and the Paring Knife ($500, L9). The first visible room change is $20,000.
- **Exploits:** none found. Level 1–2 food is training food, so there is no ingredient to resell. Supplier credit is repaid from earnings.

**Not measurable here:** time to first purchase or upgrade for a real human (telemetry has no purchase events). Proposal: add `first_purchase` and `first_upgrade` analytics events (no save data) before tuning.

## 5. Baseline metrics (frozen today)

| Metric | Value |
|---|---|
| Starting balance | $1,240 |
| First order | Tobias: Sliced Tomato Plate, pays $55 (+$50 first-clear reward) |
| First payment | At Serve on Level 1: telemetry median ~36 s of play after the intro |
| First purchase possible | Level 3: ingredients (Market opens) |
| First tool on sale | Paring Knife $500 (L9); Santoku $350 / Maple Board $300 (L10) |
| First room change | Growing Kitchen $20,000 (L16) |
| Second Floor | Visit L10; stations L60 |
| First hire | Prep Cook needed from L29 at 3+ orders a service |
| Idle income | Second Floor only (from L60) |
| Campaign target | Completionist $132,066; frozen baseline Revenue 69,110 / Completion 46,585 / COGS 16,092 / Quality 1,402 / Net 101,005 |

## 6. Save dependencies

- **Top level:** `version, credits, equipped/owned knives, boards and kitchen tiers, economy, knifeUpgrades, knifeSharpness, ownedStaffIds, selectedSupplierId, economyLedger, recipeProgress, settings, levelProgress, story, business`.
- **`levelProgress`:** `currentLevelId, highestUnlockedLevelId, completedLevelIds, paidOrders, tickets, menuGuests, campaignVersion`. These drive unlocks, idempotent per-level pay (`paidOrders`) and guests served.
- **`business`:** about 30 sub-states, among them calendar, inventory, finance, staff, `restaurantDay`, cleanliness and `secondFloor` (stations with `lastCollectAt`).

**What the plan touches:**
- **Continuous service outside a level** has nowhere to record "this guest order was paid". `paidOrders` and `menuGuests` are keyed by level id. The Business Day's own state (calendar / finance) could hold it, but in the restaurant build it is switched off until Level 150.
- **Offline income for the first floor** needs a timestamp. Only the Second Floor's stations have one.

## 7. Tests and results (2026-10-24, tree `06d7e67`; no code has changed since)

- **QA:** 117/117 suites pass.
- **Gates:** tsc clean; ESLint 0 errors (9 old warnings); build and preflight pass.
- **Browser:**
  - knifereport, phase2–6 and restaurantname pass;
  - on the classic build: economyv25, coach and adsflow pass (historically 12 / 3 / 2 failures);
  - five widths 320–768: no sideways scroll, no console errors.
- **Not run for this audit:** the full 60-suite e2e set (only the suites above).

## 8. Bugs and inconsistencies found

| # | Issue | Evidence | Status |
|---|---|---|---|
| B1 | Kitchen card shows "about +$130" for Level 2, which pays $0 | Fresh run: wallet unchanged after L2. Source: `Kitchen.tsx payText` → `levelPayPreview` ignores `level.campaignNoEconomy`. | **Not fixed** (audit only). One-line fix in `levelPayPreview.ts`. |
| B2 | Players have a build 3+ days and many features behind | §2.1 | Needs an upload (your yes) |
| B3 | Wallet pill reads the old balance while cash is being swept, though the save already holds the new one | Fresh run, served card: $1,240 shown, save $1,295 | Intended (the pill rolls up as you sweep). It reads as "no money" if the player doesn't swipe. Consider auto-collect after ~2 s. |
| B4 | The $50 first-clear reward lands with no moment (Finish Level goes straight to the order board) | Fresh run: $1,295 → $1,345 at Finish Level, nothing shown | Open |
| B5 | First Order Ready card offers "Prepare Again" and "Back to Orders" beside Serve | Screenshot `fresh-L1-c` | Open (noise for a first player) |
| B6 | Sandbox is unpublished | `get_sandbox_state` | Your call |

## 9. Proposed architecture for the order-driven experience

**Principle:** reuse the Business engine the game already has for after Level 150, because it is exactly the plan's loop: generate an order from the active menu → check inventory → existing cutting → serve once → ledger. Open it early. Don't build a new order system.

**Vertical slice (Phase B), smallest safe version:**
1. **Restaurant screen as home** for restaurant-build players past Level 3. It uses the existing Restaurant map art, with customer figures from `staffLife`/`floorLife` sitting at tables, each with an order bubble.
   - The order comes from the existing `menuGuests` / `OrderGenerator` (active menu, seeded, real stock).
   - The pay is the existing `businessCustomerPayment`.
2. **Tap a customer → existing Preparation** for that recipe → cooking clip → existing serve card and cash vacuum → the customer eats and leaves → the next one arrives.
3. **Campaign levels stay, unchanged, as milestones.** The "Today's order" card becomes "Next milestone". A milestone still teaches a technique, plays story and gives the first-clear reward. Customers keep coming between milestones.
4. **No new money path:** guest pay uses the existing `business-revenue` entry with the existing per-order idempotency.

**What the slice needs that doesn't exist yet:** a place to record paid customer orders that aren't tied to a level. Two options:
- **(a)** reuse the Business engine's own state (calendar / finance / service). No new field, but it means turning the Business Day on before Level 150 in the restaurant build. That is a rule change: "one restaurant" (developer 2026-10-05).
- **(b)** a small new field, e.g. `business.service = { day: number, paidGuestIds: string[] }`. Missing means none, so old saves load unchanged. That is a schema change.

I recommend **(a)** if you accept the rule change, otherwise (b). Either needs your yes.

**Later phases:**
- **Prep Cook automation:** reuse the menu-guest capacity rule (`perRole`). A hired Prep Cook prepares the cuts of eligible queued orders over time, using real stock through the same `serveBusinessOrder` gate. The player can still cut any order by hand (the order is claimed by whoever starts it, so it can't be done twice).
- **Idle and offline income:** extend the Second Floor's `rate × time, capped, one entry` pattern to automated first-floor stations. This needs a per-station timestamp, so a schema approval.
- **Early ownership:** cheap restoration steps ($50–$400, Levels 2–10) inside the existing tier art. This needs new art (5–8 kitchen paintings) and an economy change.

## 10. Decisions needed from you

1. **Upload the current build to Playgama** (1.4.2) so testers stop seeing 1.4.1.
2. **Fix B1** (Level 2 "+$130") now: a one-line display fix, no economy change.
3. **Starting cash:** keep $1,240, go to $0, or something between? The sim shows $0 is safe; I'd pair it with the cheap early repairs (decision 6) so the first earnings have a purpose.
4. **Turn the Business engine on before Level 150** (option a), or add `business.service` (option b) for the vertical slice.
5. **Restaurant screen as the home screen** from Level 3 (Levels 1–2 stay guided), with levels shown as "milestones".
6. **Early restoration steps** (cheap, visible, Levels 2–10): approve the economy change and the art route (image API with network access and a key, or images you upload).
7. **Automation design:** Prep Cook automating cuts is a new rule. Today's Prep Cook only discounts purchases.
8. **Offline income for automated first-floor stations:** needs a timestamp field (later phase).
9. **Analytics events** `first_purchase`, `first_upgrade`, `first_hire` (no save data), to measure the funnel before tuning.
