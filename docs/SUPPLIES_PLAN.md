# Supplies plan — cookware, cutlery, crockery and packaging across 250 levels

Written 2026-10-10 from the game's own data (`businessSupplies.ts`,
`serviceSupplies.ts`, `restaurantProgression.ts`, the campaign recipes).
**Approved plan (developer 2026-10-10); built phase by phase — see docs/HANDOFF.md for what has shipped.**

## 1. What the game has today

The Market sells 52 supply items in three sections (`SUPPLY_CATALOG`, real
U.S. foodservice prices × 0.65). Only 12 of them do anything in the
250-level restaurant:

| Used today | From | How |
|---|---|---|
| Dinner plates, dinner forks, dinner knives | L31 (dine-in) | one place setting per dine-in order; washed with soap; a missing clean setting **blocks** the service |
| Paper napkins | L31 | one per order (warns only) |
| Dish soap, cleaning liquid | L31 | % of a bottle per wash-up / closing (warns only) |
| 5 containers + 2 bags (one of each per order, by a fixed priority list) | L71 (takeaway) | a missing container or bag **blocks** |

**Not used anywhere in the campaign: 40 items.** That's all 18 culinary
smallwares (stock pot, pans, tongs, ladles, peelers, scales, thermometers…),
soup bowls and spoons, side and dessert plates, dessert forks, teaspoons,
steak knives, every glass, the coffee/tea set, the table accessories
(salt & pepper, jugs, napkin holders, menu stands), and 9 packaging items
(food wrap, deli sheets, cutlery packs, wet wipes, tissues, toothpicks,
tamper labels…). They can be bought and shown in Inventory, but they change
nothing.

## 2. What the 250 levels serve (the data the plan uses)

Dishes per stage, by how they're served (campaign recipe pools; *steak* =
a steak dish, *dessert* = the Business catalog's Dessert):

| Levels | Plated | Salad | Bread | Cooked | Soup/curry | Fruit | Steak | Dessert |
|---|---|---|---|---|---|---|---|---|
| 1–30 | 21 | 5 | 7 | 1 | 1 | 2 | – | – |
| 31–70 | 22 | 1 | 3 | 5 | **16** | 1 | – | – |
| 71–90 | 13 | 3 | 2 | 5 | – | 4 | – | – |
| 91–120 | 11 | 2 | – | **19** | – | 1 | 9 | – |
| 121–160 | 14 | 4 | – | **31** | – | – | 4 | 5 |
| 161–200 | 11 | 8 | 2 | 17 | 2 | – | **13** | – |
| 201–250 | 12 | – | – | **44** | – | 3 | **15** | 8 |

First appearance: salad L10 · bread L11 · cooked L16 · soup/curry L17 ·
fruit L23 · steak L106 · dessert L146. About 1,250 covers are served over
the campaign (≈ 400 level orders + ≈ 850 menu guests).


## 3. Context and decisions
The developer (2026-10-10) wants the restaurant to feel real: cookware, cutlery, crockery, glassware, packaging, napkins and cleaning must all depend on the 250-level campaign and affect play, with a tutorial asking the player to buy key tools and the rest "when necessary". Today only 12 of the 52 Market supplies do anything (place settings, napkins, soap, cleaner from L31; containers/bags from L71). Grandma's free lending (pantry, spares, "Emergency Service") must go; every such moment becomes a monetization spot (rewarded ad). Decisions answered:
- No ad available / ad declined → **small supplier credit** (exactly the shortfall, repaid automatically from the next earnings). This changes the CLAUDE.md "no debt" rule.
- Market timing unchanged (browse L7, buy L10); Grandma still covers L1–9 (pre-L10 pantry stays, nothing can be bought then). Tool tutorial at L10.
- Grandma's one-time gifts stay (L3 leftovers, migration crate; plus a one-time tool set).
- Ad-covered (and credit-covered) services: **no penalty** — Emergency Service is removed.
- Economy balance is deferred ("we will fix the economy later"); wallet/ledger invariants still hold.

Each phase ships separately (tests → push to `main` → Pages deploy).

## Shared foundations
- `src/game/restaurant/dishService.ts` (new, derived only): `serveStyleFor(recipe)` → `{ kind (dishKindFor), style: plate|salad|soup|curry|side|steak|dessert|cup|board, cooking: raw|oven|fried|pot|saute|wok|protein[], finger, messy, skewer, protein }` from `dishKindFor` (`recipes/dishKind.ts`), Business dish category (`businessDishForRecipeId`), ingredient categories and name patterns. Used by Phases A–C.
- One rules table per area (pattern: `STAFF_RULES`, `SERVICE_SUPPLY_RULES`). Only optional fields under `SaveData.business`, read through clamping readers (pattern `restaurantSuppliesOf`); no top-level field (playables-ads-qa F7). Seeded randomness only (`makeSeededRand`).

## Phase 0 — Ads + supplier credit replace Grandma's lending (from L10)
- **Ads** (`src/game/PlayablesSDK.ts`, `public/playgama-bridge-config.json`): add rewarded placements `serviceStock: "service_stock"`, `serviceSupplies: "service_supplies"` (Phase A adds `serviceTools`). No new timers.
- **`src/game/restaurant/supplierCredit.ts`** (new): owed derived from ledger lifetime totals (no new state): `supplierCreditOf`, `advanceCredit` (+ `supplier-credit` entry), `repayCreditFromEarnings(save, earned)` (pay = min(owed, earned, credits); one `supplier-credit-repayment` entry; never < 0). Categories added to `ledgerTypes.ts`/`EconomyLedger.ts` labels (financing — neither income nor expense).
- **`src/game/restaurant/serviceCover.ts`** (new): `coverFor(save, plan, part)` (only when the part isn't ready, isn't affordable, L ≥ 10), `coverWithAd` (exact missing goods at cost 0, no ledger — Rush Restock rule; reuses the pantry/spares bodies), `coverWithCredit` (advance the shortfall, add goods at real cost with the normal purchase ledger entries + finance records), `newServiceCoverRewardId`. `pantryForMissing` stays for **before L10 only**; delete `grandmasSpares`, `markEmergencyService`/`isEmergencyService` (keep `withoutEmergency` for legacy saves); `restaurantSettlement` drops the emergency branch.
- **App** (`src/App.tsx`): `coverServiceWithAd(part)` next to `rushRestockCurrentOrder` (busy ref → `requestRewardedAd(..., AD_PLACEMENT.serviceStock|serviceSupplies)` → grant only on `rewarded` → re-read `saveRef.current` + `servicePlanFor` → persist); `coverServiceWithCredit(part)`; repayment in `completeCampaignLevel` after the completion reward (first completion) and in `advanceBusinessDay`; Level Complete rows "💳 Supplier credit repaid −$X · still owed $Y". Keep new ad code outside the `watchReplayBonusAd`…`finishCampaignLevel` slice (F3/F6).
- **UI** (`PreServiceCheck.tsx`, `ServiceCheckLayer.tsx`): per short section the ladder Buy in Market → Quick restock → "Not enough money" → 🎬 Watch an ad (only when `rewardedAdsAvailable()`, busy/failure text as `RushRestockActions.tsx`) → 💳 Supplier credit (when no ad, or after the ad failed/was declined). Remove both Emergency notes and Grandma's spares; owed banner on the sheet; "Supplier credit" card in `BusinessSuppliers.tsx` (not Inventory — Inventory stays money-free).
- **Optional extra ad spots** (each its own placement): no-fee Quick restock (`quick_restock_fee`), unaffordable optional menu-guest stock (`service_guests`).
- **Sim** (`scripts/restaurantCampaignSim.mts`, `economy-final-sim*.mts`): broke profile uses the pantry < L10, supplier credit from L10 (no ads in sim), mirrored repayment; stats `credits/creditAdvanced/creditRepaid` replace `spares/emergencyOrders`.
- **Tests (rule changed by the developer — say so in the commit):** playables-ads-qa A4b/E6/F11; restaurant-stock-qa U1/U2 (+U3/U4); restaurant-supplies-qa G1–G3; restaurant-grandmas-fridge-qa T4; restaurant-final-economy-qa R4/R5/S3/W1/W2/X2; restaurant-campaign-sim-qa B3 (+D4 diligent never borrows); rerun economy-pass / fridge-pressure. New `restaurant-service-cover-qa` (ad/credit exactness, repayment, wallet+ledger invariant over seeded runs, save round trip, wiring, no `Math.random`). e2e: rewrite restaurantstock 4, restaurantsupplies 6, restauranteconomy 3, restaurantgrandmasfridge 5b/6d; new `restaurantcover.mjs` (stubRewarded: rewarded / declined / no ads → credit; repayment on Level Complete; 320 px).
- **Docs:** CLAUDE.md §7 (supplier credit replaces "no debt") and §2 (rewarded list); REFERENCE; HANDOFF; SUPPLIES_PLAN.

## Phase A — Kitchen tools (all 18 culinary smallwares) + L10 shopping-list tutorial
- **`src/game/restaurant/kitchenTools.ts`** (new): `TOOL_RULES` — Grandma's set (mixing bowls, peelers, measuring cups, frying pan, one-time gift at L10 like the leftovers); L11 sheet pans + oven mitts (bread/oven); L16 frying pans, tongs, skimmers (fried rings); L17 stock pot, ladles (soups/curries); L21 storage containers (2 + fridge tier) and thermometers (fridge log; per cook from L101); L32 saucepans + whisks (French onion, velouté, sauces); L36 sauté pans + spatulas (sauté, fajita, hash, wok L121+); L44 graters (gratin, cheddar boards); L101 kitchen scales (meat/fish portions). `perCook` tools scale with cooks on the line (staff from L41). Required for today's tickets **and the active menu's dishes**. `toolsCheck`, `toolsComingUp` (news 5 levels ahead → `restaurantNews.comingUp`), `giveGrandmasTools` (stamp `business.grandmasTools`).
- Pre-Service Check "🍳 Kitchen tools" section (blocking rows with why + dishes; Buy → Market preset quantity), ad/credit cover part `tools` (placement `service_tools`); `marketFocus.openMarketSupplies` gains a `packs` preset and a "Buy all" shopping-list panel in `MarketSupplies.tsx` (each line an ordinary purchase + ledger entry).
- **Tutorial at L10:** `GRANDMA_TIPS[10]` "Buy your first kitchen tools"; `firstPurchaseRows()` adds the tools line; `FirstShoppingListCard` in the check (pattern `GrandmasFridgeCard`) listing the tools L10–20 need; L10 START never blocks on it.
- Copy: Market/Inventory say equipment lasts and dishes need it; Inventory shows "Needed N · have M" (read-only). Migration v2 step (`restaurantMigration.ts`, version 2, v1 not re-run) tops up what an existing save's stage needs.
- Tests: new `restaurant-tools-qa` (every culinary id has a rule tied to real dishes; Grandma's set once/cost 0; L11 blocks without sheet pan; per-cook; menu dishes; news; cover; `serveStyleFor` covers all recipes; migration idempotent); update first-levels-qa, migration-qa, business-supplies-qa F3 note; e2e `restauranttools.mjs`.

## Phase B — Tableware by dish, tables, glasses, breakage
- Extend `SERVICE_SUPPLY_RULES` (`serviceSupplies.ts`): setting by style (plate: plate+fork+knife; salad: plate+dessert fork; soup/curry: soup bowl+spoon; side/bread/board: side plate; steak L106+: steak knife; dessert: dessert plate+fork; cup: dessert plate+teaspoon); water glass per cover (L31); highball glasses for a seeded 25 % of covers from L121 (the bar); coffee/tea set with desserts + seeded 30 % from L161; table pieces per table (menu stand, salt & pepper, napkin holder from L31, water jug from L46); seeded breakage per washed piece (glass/plate 1/60, cutlery 1/120); soap = max(5 %, 0.25 % per piece); tissues per table per closing; 2 napkins for finger/messy dishes.
- `takeOrderSupplies(save, service, recipe?)` (optional 3rd arg — legacy behaviour without it), per-piece `dirty` state (legacy `washing` migrated), `washUp` returns washed/broken, `cleanSettingFor(save, recipe)` for the menu-guest gate; the check gets per-piece rows for tickets (blocking) and optional guest rows.
- UI grouped "Plates & cutlery · Glasses · Tables", broken pieces shown. Sim buys rows + replacements.
- Tests: new `restaurant-tableware-qa`; update restaurant-supplies-qa R2/rows, restaurant-guests-qa:317, migration-qa; e2e `restauranttableware.mjs`.

## Phase C — Takeaway by dish + extras + closing wrap
- Restaurant takeaway by style: curry → thali tray; soup → microwave container; hot/wok/protein → foil container; fried → burger clamshell; salad/plate/fruit → kraft box; bread → deli sheet + food wrap; bags by style. Extras per takeaway order: cutlery pack (not finger food), napkins, wet wipe (messy), tamper label (L91+). Toothpicks for skewers (L19/25) and protein covers (L101+); deli-sheet liners for fried baskets/boards (L16/L29). Closing from L21: food wrap per fridge line + chore "Wrap and label what's left". Business/Endless priority lists unchanged.
- Tests: new `restaurant-takeaway-qa` (all 17 packaging ids used); e2e `restauranttakeaway.mjs`.

## Phase D — Pride, hygiene, the restaurant's numbers
- `src/game/restaurant/serviceReport.ts`: per-service report (covers, guests, pieces washed, broken, packed, spotless) + lifetime `business.restaurantRecord` (covers, takeaway, washed, packed, spotless streak/best).
- Level Complete rows ("🍽️ 6 covers · 🥡 2 packed · 🧼 21 washed", "✨ Spotless service · streak 4"); Restaurant Progress "Your restaurant in numbers" card.
- Hygiene into the L91+ inspection (`inspectBusiness` optional hygiene facts: wipe-down, unwashed pieces, wrap, thermometer, tamper labels) — Business Mode unchanged; `closeDay` wipes down before `endBusinessDay`. Quality: +1 % while spotless, small share for smallwares owned (existing `restaurantQuality` hook). City ranking unchanged (pinned).
- Tests: new `restaurant-service-report-qa`; update restaurant-day-qa, restaurant-progress-qa, final-economy W-list; e2e `restaurantreport.mjs`.

## Verification (every phase)
`npx tsc --noEmit -p .`; ESLint `src scripts tools` (0 errors); Prettier on touched files; `npm run build` + classic `VITE_RESTAURANT_MODE=0` build; `npm run preflight`; the phase's new + updated QA suites, then all `scripts/*-qa.mts` (incl. `restaurant-campaign-sim-qa` — all 250 levels, every profile, no soft-lock, wallet ≥ 0, ledger exact); e2e: the phase's new tests + all restaurant e2e on the normal build and classic e2e on the classic build (cloud setup per HANDOFF §6b; ads simulated with the `stubRewarded` pattern from `tools/e2e/rushrestock.mjs`); screenshots at 320/360/390/430/768. Then commit (stating which tests changed for the developer's new rules), push to `main`, confirm the Pages deploy, and report. Economy figures (completionist) are reported but not balanced (deferred by the developer).
