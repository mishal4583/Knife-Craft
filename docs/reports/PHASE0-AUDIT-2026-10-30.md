# KnifeCraft — Phase 0 audit and baseline (2026-10-30)

Scope: **audit only.** No code, save schema, economy figure, level or content was changed to produce this
report. Everything below was read from the source at `main` = `15a968c`, measured with throw-away scripts
(deleted afterwards), or checked in a real browser. Each claim says which. Where I did not verify something in a
browser, it says so.

## 0. Summary

| Question | Answer |
|---|---|
| Is the game already a customer-driven restaurant? | **Partly.** Customers walk in as parties, order, are served and react (`ServiceFloor`), but every order still comes from a **level's ticket list** and each level ends with a level-completion step. There is no arrival clock, no queue, no automation. |
| Do the pieces the plan wants exist? | Customers, order lifecycle, serve/pay/tip, cash pile + swipe, kitchen restoration reveal, inventory, Market, staff (as requirements and wages), second floor with real-time income: **yes**. Customer arrival schedule, order queue, staff that *do* work (Prep Cook cutting), idle production, offline income for the main restaurant: **no**. |
| Does the live (deployed) build work? | **Yes**, checked with the real browser tests against the Pages site (first run 7/7, cash flow incl. the cash vacuum 6/6). |
| Is a $0 start playable? | **Yes, by supplier credit** (measured at unit level; not browser-tested). See §5. |
| Level 2 reward-display inconsistency | **Not reproducible any more** — the practice level is gone and the preview matches the payout floor. See §6. |
| Biggest risks | Levels are baked into saves, achievements, story and pay curve (§7); 7 Business dishes teach nowhere (§9); order ids and party sizes depend on the clock (§9). |

## 1. Current architecture

- **App:** React 19 + Vite + TypeScript; `src/App.tsx` (~3,900 lines) owns the save state, the screens, the
  service session and every serve/advance function; `ScreensRouter.tsx` routes `ScreenId`s.
- **Cutting:** Phaser 3.90 `PreparationScene.ts` (~7,200 lines, lazy chunk) driven by `GameBridge` and the React
  `Preparation.tsx` (HUD, report, cooking clip / oven step, serve card, `ServiceFloor`).
- **Service model:** `service/ServiceManager.ts` (`ServiceSession { current, next, recent, tickets, completedCount }`),
  `CustomerOrderManager.ts`, `orderStateTypes.ts` (one linear state machine, `PAID` reachable once), `RecipeValidator`,
  `OrderGenerator`; per-level tickets in `restaurant/serviceTickets.ts`.
- **Money:** `SaveData.credits` (USD cents), `economy/EconomyLedger.ts`, `EconomySettlement.ts`, `wallet.ts`,
  `customerTips.ts`, `pendingCash.ts` (cash left on the table), `restaurant/restaurantEconomy.ts`.
- **Restaurant layer** (`src/game/restaurant/`, 55 files): day clock, pre-service check, stock, supplies, tools,
  cleanliness, staff requirements, second floor, deliveries, endless, city ranking, first-level pointers, guide.
- **Platform:** `PlayablesSDK.ts` (only file touching `window.bridge`), `SaveManager.ts` (Bridge storage, key `knifecraft_save`).
- **Build/deploy:** `vite.config.ts` (`base: "./"`), `.github/workflows/deploy.yml` → GitHub Pages on every push to `main`.

## 2. Feature inventory (what exists, what works)

| Feature | Exists | Where | Verified |
|---|---|---|---|
| Customer arrival (walk in, sit, order bubble) | Yes, **presentation of a level's tickets** | `ServiceFloor.tsx`, `restaurant/serviceFloor.ts` | Browser |
| Parties of 1–4 served together | Yes (since 2026-10-30) | `serviceFloor.ts` held plates, `Preparation.tsx` | Browser (`sharedprep.mjs`) |
| Order lifecycle | Yes: `PENDING→ACTIVE→PREPARING→READY→SERVED→PAID→COMPLETED` (cooking is a clip/oven step after the cut, not a state) | `orderStateTypes.ts` | QA suites |
| Cutting, combos, mastery, cleanup | Yes | `PreparationScene.ts`, `cleaning*`, `boardDebris.ts` | QA + browser |
| Cooking / assembly | A cooking film or interactive oven tray per dish | `CookingClip.tsx`, `OvenStep.tsx`, `cooking/ovenStep.ts` | QA (`oven-step-qa`) |
| Serve, reaction, tip | Yes | `ServiceOrderComplete.tsx`, `customerTips.ts` | Browser |
| Wallet + ledger | Yes, one wallet, one ledger, one entry per movement | `SaveManager`, `EconomyLedger.ts` | QA (`economy-*`) + browser (wallet = $10 + signed ledger) |
| Cash on the table, swipe / "cash vacuum" | Yes, optional to collect, required before closing | `CashVacuum.tsx`, `pendingCash.ts` | **Browser, local and deployed** |
| Restoration reveal | Yes: only after a **saved** kitchen-tier purchase; skipping or reloading changes nothing | `RestorationReveal.tsx`, `kitchen/restoration.ts` | Source read (`App.tsx` opens it only from a successful `purchaseKitchenUpgrade`); not exercised in a browser in this audit |
| Inventory / Market | Yes; Market is the only place to buy; open from Level 1 | `Shop.tsx`, `Inventory*`, `business/BusinessInventoryManager.ts` | Browser (`firstshop.mjs`) |
| Staff | Yes **as hires and wages** (prep-cook L27, server L31, line-cook L40, cleaner L54, head-chef L74, manager L99; specialist chefs). They are *requirements* of a service; none performs a task | `staffRequirements.ts`, `economy/staff*` | QA (`staff-hire-qa`, `restaurant-half-wages-qa`) |
| Idle income | Only the **Second Floor**: real-time, capped (8–10 h), one ledger entry per collect, backwards clock earns nothing | `restaurant/secondFloor.ts` | QA only (not browser-tested in this audit) |
| Offline income for the main restaurant | **No** | — | Source search |
| Achievements, rankings, daily order, replay bonus, rewarded ads | Yes | `progression/achievements.ts`, `cityRanking.ts`, `daily/`, `ads/` | QA |
| Story | Intro, FINALE, THE LAST PAGE (bit 2048, plays at the completed-level count `LEGACY_AT`) | `story/` | QA |

## 3. First-20-level progression table

Measured with a script from the real level definitions (orders = the level's rolled tickets at their recipe pay;
completion = `paidLevelReward`; food = Market cost of the missing stock at an empty fridge; "preview" = what the
Kitchen/Order Board card shows, `levelPayPreview`). Tips and the small quality bonus are on top.

| Lv | Title | Dish(es) | Orders | Completion | Order pay | Food | Preview | Teaches |
|---|---|---|---|---|---|---|---|---|
| 1 | Garden Prep | Garden Tomato & Cucumber Plate | 1 | $50 | $100 | $0.95 | $150 | slice |
| 2 | Potato & Tomato | Halved Potato Bowl | 1 | $90 | $100 | $0.80 | $190 | halve, peel |
| 3 | Garlic Bread | Garlic Bread | 1 | $130 | $115 | $3.00 | $245 | smash |
| 4 | Tomato Basil Toast | Tomato Basil Toast | 1 | $170 | $170 | $4.50 | $340 | dice, chop |
| 5 | Mushroom Bruschetta | Mushroom Bruschetta | 1 | $210 | $200 | $3.65 | $410 | — |
| 6 | Zucchini Garden Plate | same | 1 | $250 | $115 | $0.70 | $365 | — |
| 7 | Caprese Plate | same | 1 | $290 | $170 | $3.15 | $460 | — |
| 8 | Simple Garden Salad | same | 1 | $330 | $170 | $1.15 | $500 | — |
| 9 | Onion Rings | Onion Rings Basket | 1 | $370 | $130 | $0.85 | $500 | rings |
| 10 | Bruschetta for the House | same | 1 | $410 | $315 | $6.15 | $725 | — |
| 11 | Italian Garden Plate | same | 1 | $450 | $240 | $3.15 | $690 | — |
| 12 | Garden Minestrone Base | same | 1 | $490 | $260 | $1.55 | $750 | — |
| 13 | Family Antipasto for Two | same | 1 | $530 | $170 | $3.55 | $700 | — |
| 14 | Beetroot & Orange Plate | same | 1 | $570 | $130 | $0.90 | $700 | radial |
| 15 | Two Tables, One Batch | Bruschetta Trio + Garden Tomato Cup (batch) | 1 | $610 | $395 | $6.00 | $1,005 | — |
| 16 | Onion Two Ways | same | 1 | $650 | $225 | $0.55 | $875 | — |
| 17 | Italian Service Night | Bruschetta Trio + Caprese Skewers (batch) | **2** | $690 | $450 | $6.40 | $1,140 | — |
| 18 | Julienne Vegetable Medley | same | 1 | $730 | $170 | $1.45 | $900 | julienne |
| 19 | French Onion Base | same | 1 | $770 | $160 | $0.58 | $930 | — |
| 20 | Potato Veloute Base | same | 1 | $810 | $200 | $0.65 | $1,010 | — |

**Unlocks in this stretch (verified from `firstLevels.ts` / `secondFloor.ts`):** Market + Inventory at Level 1; Rack,
Business, every knife/board/kitchen tier for sale and the **Second Floor with its stations at Level 5** (the plan's
"Second Floor visible at L10, stations at L60" is **out of date**: both are L5 now; stations cost $400–$1,550).
Cleaning and the night chores start at Level 5. Today's Special / restaurant day chores follow the day clock.

Cumulative (completion + order pay) for Levels 1–5 ≈ **$1,335** before tips and food; Level 1–20 ≈ **$12,585**.

## 4. Economy baseline (frozen, 2026-10-30)

- **Campaign simulation (148 levels, `economy-v2-campaign-simulation`):** Revenue 69,925 · Completion 245,138 ·
  COGS 16,604 · Quality 1,415 · Net 299,874.
- **Completionist** ends ≈ $292k with achievements collected (target ≥ $150k).
- **Pay curve:** `curatedRewardAt` $50 at L1, +$40 a level to L40, then +$6; the last level pays $5,000.
- **Starting wallet:** **$10.00** (verified in the fresh-save browser test: `credits: 1000`).
- **First purchase:** Level 1's food, **$0.95** (3 ledger entries for tomato/cucumber/potato, −$1.50 as bought in the test).
- **First order payment:** settlement **$110** + tip **$17** (browser), then the **$50** completion reward on Finish Level.
- **First affordable upgrades** (estimate from the tables above and the catalogs; tips included roughly): after Level 2 the
  wallet is about $380, enough for the Maple board ($300) or the Santoku ($350); the first Second-Floor station ($400)
  after Level 3; the first kitchen tier ($60,000) around Level 44. Estimates, not measured play.
- **Costs:** knives $350–$2,200, boards $300–$2,000, stations $400–$1,550, kitchen tiers $60k / $12k / $18k / … (the ladder is **not ascending**, §9).
- **Income sources:** order settlement, tips, level completion reward, achievements (collected by tap), daily gift,
  rewarded-ad bonuses, Second-Floor collect, menu-guest revenue. Active vs idle: only the Second Floor is idle.
- **Not measurable today:** time to first completed order / first payment / first upgrade in real minutes. No timing
  instrumentation exists. Proposal: non-persistent dev timers around the browser tests (no save field).

## 5. $0 start versus the current $10.00 start

Measured with the real stock check and cover functions (unit level):

| | **$10.00 (current)** | **$0** |
|---|---|---|
| Level 1 food | $0.95 → affordable | $0.95 → **not affordable** |
| What happens | Player buys 3 ingredients in the Market (guided by the hint and hand), cooks, serves | Pre-Service Check offers a **cover** from Level 1: a rewarded ad (free goods, no ledger entry) or **supplier credit** — Level 1 becomes ready with `owed 95`, wallet stays 0, repaid from the first earnings |
| Free-money risk | None (own money) | Ad cover is free goods by design (one rewarded ad); credit is a loan, not a gift |
| Soft-lock | None | None found: the credit path always makes Level 1 ready (measured: `ready after cover true`) |
| Teaching value | Player *chooses and buys* — matches the plan's "invest starting resources" | Player never spends money before the first order; the first purchase becomes "pay back the supplier" |
| Gaps | — | Not tested in a browser; the cover buttons' wording at Level 1 is unverified; the guide's first-shopping hand assumes the player can buy |

**Recommendation (not applied):** keep **$10.00**. It preserves a real first purchase and a first decision, needs no
new code and no wallet change. A true $0 start is playable through supplier credit but removes the first purchase
and adds an unverified debt on the very first screen. If you still want $0, it needs a browser pass of the cover flow
at Level 1 first. **Decision D1.**

## 6. Level 2 reward-display inconsistency (traced)

- Source of the card text: `Kitchen.tsx` `payText` → `levelPayPreview(save, level)` (orders at recipe price +
  `paidLevelReward`). `levelPayPreview` reads the same functions the serve uses (`recipePay`, `paidLevelReward`).
- Old behaviour: Level 2 was a practice level that paid $0 while the card showed ≈ $130. That branch
  (`camp-level2-basics-tutorial`, `campaignNoEconomy`) was **removed on 2026-10-29/30**; every level now pays.
- Now: Level 2 is *Potato & Tomato*, preview **"about $190"** = $100 order + $90 completion. Measured settlement for
  that dish is **$100 / $102 / $110** at scores 60 / 80 / 95 (+ tip, + $90 completion), so the preview is the
  documented **floor** ("about"): it never promises more than is paid. **No inconsistency remains.** Not re-checked by
  eye in a browser at Level 2; the Level 1 card was exercised by the flow tests.

## 7. Save dependencies on levels

`SaveData` top-level: `version, credits, equippedKnifeId, equippedBoardId, ownedKnifeIds, ownedBoardIds,
ownedKitchenUpgradeIds, equippedKitchenUpgradeId, economy, ownedKitchenInvestmentIds, knifeSharpness, knifeUpgrades,
ownedStaffIds, selectedSupplierId, economyLedger, recipeProgress, settings, levelProgress, story, dailyOrder, endless,
business`.

Things that depend on levels (all must keep working in any migration):
- `levelProgress { currentLevelId, highestUnlockedLevelId, completedLevelIds, campaignVersion, tickets, paidOrders,
  menuGuests }` — ids are `level-N`; `campaignVersion: 3` (148 levels; v2 = 150, none = 250, renumbered on load).
- `recipeProgress` is keyed by recipe id (survives any level change).
- `story.milestoneMask` — milestones fire by completed-level count (`LEGACY_AT`), FINALE by count.
- Unlocks by level: tabs, knives/boards/stations, staff rules, hygiene/cleaning (L5), par audit (L19), half wages (L27).
- Achievements and city ranking read level counts; replay pays nothing (`isCompleted`); `economyLedger` is capped at 200.
- `business.pendingCash` (cash on the table), `guideSeen`, `restaurantDay`, `secondFloor`, `endless` (unlocked after the last level).

## 8. Tests and results (today)

- **QA suites:** `scripts/*-qa.mts` — **129 suites, all pass** (last full run on the pushed commit's tree; run in three
  batches because one all-at-once run was killed for low memory).
- **TypeScript / ESLint / build / preflight:** pass; ESLint 0 errors, 9 old warnings.
- **Browser, local build:** firstshop 7/7, cashflow 6/6, cashreload 5/5, guide 8/8, sharedprep 6/6, levelflow,
  servicefloor, resize, lazyload — all pass.
- **Browser, deployed site (`mishal4583.github.io/Knife-Craft`):** firstshop 7/7, cashflow 6/6 (swipe + cash vacuum
  work and are visible).
- **Deploy workflow:** `15a968c` completed with success.
- **Not run / stale (documented, not removed):** 95 files in `tools/e2e` (scripts plus the harness and solver); only the ones above were re-run in this
  work. About 60 seed saves with `campaignVersion: 2` (renumbered by −2 on load) and the old $0 start; `walkins`,
  `phase2` B2–B6/C1 and `restaurantcleanliness` are known stale. I did not re-run them, so their status is **unknown**,
  not "passing".
- **Version check:** the deployed bundle's file hashes differ from my local `dist` (CI builds separately), so hashes
  cannot prove equality; the deployed behaviour tests above are the evidence.

## 9. Bugs and inconsistencies found

1. **7 Business dishes teach nowhere:** `biz-asparagus-persillade`, `biz-eggplant-masala`, `biz-tomato-chicken-curry`,
   `biz-black-pepper-chicken`, `biz-salmon-persillade`, `biz-ribeye-herb-butter`, `biz-turnips-persillade` —
   their source recipes exist only in the 102 levels dropped by campaign selection. Open since the earlier analysis.
2. **Kitchen price ladder is not ascending** (Growing $60,000, Established $12,000, Neighborhood Café $18,000).
3. **Order ids use `Date.now()`** (`createCustomerOrder`), so party size (a hash of the id) and anything keyed by it are
   not reproducible in tests; the browser test has to cover both a table of two and a lone customer.
4. **No arrival clock:** customers exist only as tickets of the current level; nothing schedules them.
5. **Stale e2e harness stamp:** `harness.mjs` stamps `campaignVersion: 2`, shifting every seeded level by −2.
6. Documented wording drift: CLAUDE.md still says the last page plays "at L150" while the campaign has 148 levels
   (`LEGACY_AT` is the source-number count).
7. A party only completes when all its members are required orders; menu guests are separate tables (by design since today).

## 10. Proposed architecture for the order-driven experience (smallest safe vertical slice)

**Slice B1 — "service never stops" using what exists, no save change:**
1. When the last required order of a level is served and paid, run the existing `completeCampaignLevel` silently (the
   level reward is a normal ledger entry, shown as a small toast) and **immediately build the next level's service
   session** (`buildCampaignServiceSession`) instead of showing the Level Complete card and going to the Order Board.
2. The Pre-Service Check stays as the only gate (stock, supplies, tools), shown at a natural break.
3. Customers keep arriving through the existing `ServiceFloor`/party code; the served card (cash, Collect later) stays.
4. Level messages (`level_completed`), interstitial rules, story flushes and achievements keep firing from the same
   function, so nothing downstream changes.

What stays untouched: wallet, ledger, `levelProgress`, recipes, tickets, story, achievements, the level data and the
Order Board (reachable from the Kitchen, not on the critical path).

Tests for B1: a two-level flow in the browser (L1 → L2 with no completion card), `levelflow` re-pinned, wallet = opening +
signed ledger, one completion reward per level, replay pays nothing, reload mid-service.

Later slices follow the plan: D order queue (needs an arrival rule, §11 D3), E staff that cut (new staff behaviour,
needs D4), F/I idle and offline (needs D5, D6), H milestones (needs D7).

## 11. Decisions that need your approval

| # | Decision | My recommendation |
|---|---|---|
| D1 | Starting balance: keep **$10.00** or move to **$0** (supplier credit covers Level 1) | Keep $10.00 |
| D2 | Slice B1: auto-complete the level and roll straight into the next service, **removing the Level Complete card** from the main path (level data and Order Board stay) | Approve |
| D3 | Customer arrival rule for the order queue: fixed schedule by restaurant capacity (deterministic ids/sizes, no `Date.now()`), still bounded by the level's required orders at first | Approve a deterministic schedule |
| D4 | What a **Prep Cook** does: replaces the player's cutting of one eligible step per order (reduced score, wages from the existing payroll) — needs a new rule for score and combo | Decide before Slice E |
| D5 | Idle/offline: new persistent timestamp field in `business` (allowed place) with a cap (e.g. 8 h) and one ledger entry; needs a save-schema approval | Decide before Slice I |
| D6 | The 7 untaught Business dishes: teach them in an existing level pool (changes the economy baseline) or hold them back from the menu | Hold back until Phase H |
| D7 | Level fate (Phase H): keep all 148 as internal data, present them as restaurant milestones; no deletion | Approve "keep, present as milestones" |
| D8 | Fix the non-ascending kitchen price ladder, or leave as set | Leave as set unless you say otherwise |
| D9 | Re-seed the stale browser tests (harness stamp → `campaignVersion: 3`) | Approve, as part of Slice B1 |

Nothing in this audit changed the game. Phase 0 is complete; the next step waits for your answers to D1–D3.

## 12. Decisions taken (2026-10-30, after review)

| # | Decision | Outcome |
|---|---|---|
| D1 | Starting balance | **Keep $10.00** (the player buys Level 1's ingredients before it starts) |
| D2 | Hide the level system; service rolls on | **Done.** No Finish Level / Level Complete screen; the last customer's Next Customer completes the level and the next level's customers arrive (Pre-Service Check first when stock is short). Browser: `rollon.mjs` |
| D3 | Deterministic orders | **Done for ids** (`order-N`, no clock) so party sizes are reproducible; an arrival *schedule* waits for Phase D |
| D4 | What a Prep Cook does | Open — Phase E |
| D5 | Offline/idle persistence | Open — Phase I |
| D6 | The 7 untaught dishes | **No change needed.** All seven have recipes with steps and join the menu at Levels 33–74; they are playable menu orders, only no campaign level introduces them. Holding them back would break the menu-count curve |
| D7 | Fate of the 148 levels | Kept as internal data, presented as restaurant service; no deletion |
| D8 | Kitchen price ladder | Left as set |
| D9 | Re-seed old browser tests | **Not needed:** the old-numbering seeds exercise the real old-save migration. The tests that changed were updated individually |
