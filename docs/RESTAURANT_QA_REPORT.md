# Unified Restaurant — final QA report (phase N)

Date: 2026-10-05 · Branch `claude/sharp-wright-emfu2j` · Everything below is
behind the ONE build switch `RESTAURANT_MODE` (off in the release build).

## What was tested

| Area | How | Result |
|---|---|---|
| The whole campaign, L1 → 250, through the real restaurant functions | `scripts/restaurant-campaign-sim-qa.mts` (3 players, invariants after every level) | ✅ all pass |
| Every restaurant screen at 320 / 360 / 390 / 430 / 768 px | `tools/e2e/restaurantwidths.mjs` (no sideways scroll, every button ≥ 48 px) | ✅ 7 screens × 5 widths |
| Saves of every era moving in | `scripts/restaurant-migration-qa.mts`, `tools/e2e/restaurantmigration.mjs` | ✅ |
| Every restaurant system | `restaurant-*-qa` suites (unlocks, stock, menu, day, guests, supplies, progression, migration) | ✅ |
| The release build is unchanged | all 70 QA suites, the release browser suite, a direct check (classic tab names, no presets, no attention panel, Business Day as before) | ✅ |
| Knife / cutting system | untouched (no file changed); `knife-stroke-qa`, `cut-rules-qa`, `coaching-qa` pass | ✅ |

### The campaign simulation

Each level is played the way App plays it: the Pre-Service Check
(`servicePlanFor`) → buy / Grandma's pantry / Grandma's spares / free hiring →
START (wash-up) → every order (real stock, supplies, the Economy V2
settlement) → menu guests → Finish Level → closing. Every save change goes
through a mirror of `App.persist` (kitchen sync, milestone payouts, the
wallet invariant).

After every level, for every player: the service could start; credits are
whole cents and ≥ 0; opening cash + every ledger movement since = cash now;
no negative stock or supplies; the fridge is never over capacity.

| Player | Levels | Cash at the end | Help used | Notes |
|---|---|---|---|---|
| D — diligent (buys what each check asks, keeps bottles/napkins, serves every guest it stocks) | 250 / 250 | $1,240 → ~$272k | none | 689 menu guests (~$11.7k menu revenue); no fridge upgrade was ever needed |
| B — broke ($0 before EVERY level) | 250 / 250 | (drained each level) | pantry ×236, spares ×220, 26 free hires | never blocked: the no-soft-lock rules hold |
| M — an old save moving in at L120 | 131 / 131 | $40k → ~$259k | none (the starter crate covered the first services) | |

## Found and fixed in phase N

1. **Menu guests were almost never servable.** The Pre-Service Check stocked
   only the level's own orders, so a guest's dish was out of stock and the
   result screen offered "Menu guest wants X — not in stock" with no way to
   restock mid-service. The simulation served **4 guests in 250 levels**
   ($57). Now the check lists today's guests and the extra stock their
   dishes need, as OPTIONAL rows (never blocking, never opening the sheet;
   Restock → the Market preset to that amount), and Inventory recommends
   them as "low". Result: **689 guests**, ~$11.7k menu revenue.
   (`preServiceCheck.guestStockFor`, `restaurant-guests-qa` K1–K4.)

Earlier phases' finds, for the record: closing from L91 moved payroll and
fines without ledger entries (fixed in the 2026-10-05 brief); the resize
remount (fixed before phase G); "Restock to start" when only staff were
missing (phase M).

## Economy pass (after phase N)

- **P0 fixed**: no double food cost in the restaurant (orders pay earnings +
  quality bonus; the food is the real stock). A completionist who buys
  everything now ends L250 with **$129,324** — inside the approved
  $100k–$150k (it was $95,082). `restaurant-economy-pass-qa`.
- Open with numbers: the Endless Restaurant loses ~$200/day with the
  campaign's team (+~$30/day with none) vs the classic Endless Service's
  $600/day; item food-cost savings vanish under P0.

## Findings for the economy pass (as found in phase N — see above for what changed)

- **Wages dominate the restaurant's costs**: ~$21.6k of wages against ~$5.6k
  of ingredients for the diligent player. Staff are free before L91 (wages
  are charged only at the L91+ day end).
- **A broke player keeps staff without paying them**: laid off at closing,
  re-hired free before the next service (26 hires). That is the no-soft-lock
  rule working; the economy pass decides whether staff should cost more.
- **Inspection fines** grow with guest volume (~$5.6k for the diligent
  player, L91+).
- **Food is still charged twice** (P0): the campaign settlement keeps its
  built-in food cost while the player also buys real stock.
- **The fridge never limited anyone**: Basic (40) held every service's stock;
  the bigger fridges are never needed in the campaign as tuned.
- **Menu revenue is small** next to level pay even with guests served.

## Open decisions (developer)

- One Asian Chef for the four Asian chapters, or one chef each.
- Staff wages before L91 (currently none).
- Day length (2 services, 3 from L51) and the menu choice at L51.
- Menu guests in batch-group levels (none today).
- Endless Service progress converted to "stars" for old saves (not done:
  the Endless Restaurant has no stars).

## Browser runs

- Restaurant test build: `restaurantmigration`, `restaurantstock`,
  `restaurantday`, `restaurantguests`, `restaurantsupplies`,
  `restaurantprogression`, `restaurantwidths` — all pass.
- Release build: `levelflow`, `introskip`, `coach`, `cookingclip`, `finale`,
  `paidorders`, `resize`, `inventory`, `fridge`, `ingredients`, `supplies`,
  `staff`, `economyv25`, `adsflow`, `rushrestock` — all pass.
  (`businessDishes.mjs` is a shared data module and `cadence.mjs` a
  measurement tool, not tests.)
- One note: `levelflow`, run FIRST against a server started two seconds
  earlier with a cold cache, failed its console check on aborted requests
  (`net::ERR_ABORTED` for the bridge config, a font and the favicon). The
  harness's `boot` loads the page and then reloads it, which aborts what the
  first load still had in flight; `levelflow` counts any failed request,
  while the other suites list aborted ones without failing. Run again it
  passed. Not a page error and unrelated to the restaurant; the test is
  unchanged.

## Not covered here

- Real devices (touch, performance, audio): to be done by the developer.
- The economy simulation/rebalance: the separate economy pass.
