# Unified Restaurant — Phase 1 audit and implementation map

Written 2026-10-04 for the developer's "Unified Restaurant Campaign & Endless
Service — Master Implementation Specification" (systems first, economy
later). This is the spec's §55 report: what exists, what is reused, what
needs adapters or migration, the conflicts, and the proposed sequence. **No
game code has been changed for this yet.**

Measured on branch `claude/sharp-wright-emfu2j` at `642b67e`.

---

## 1. Existing Campaign architecture

- 250 levels (`levels/levelDefinitions.ts`), 25 chapters. **Every level is an
  order session**: 210 are order-pool levels (`recipePoolIds` +
  `requiredOrders`, run by `App.startCampaignLevel` → `ServiceManager`
  `createServiceSession`), 40 are batch groups (`batchGroupRecipeIds`,
  `createBatchGroupSession`). No level uses the old single-recipe path any
  more; that path (`recordPreparationResult`) now serves Today's Special and
  Endless only.
- 221 recipes (`recipes/campaignRecipes.ts`) are used by the levels.
- Pool levels pick their next order with `Math.random` when the previous one
  is served (`pickNextRecipe`), so a level's exact orders are not known in
  advance.
- Pay: `EconomySettlement.computeSettlement` per served order (revenue − an
  **abstract COGS** from `ingredientCostRegistry` + quality bonus), plus
  `paidLevelReward` on completion (`completeCampaignLevel`). Campaign uses no
  stock, fridge or supplies.
- Paid orders of an unfinished level are saved (`levelProgress.paidOrders`).

## 2. Existing Business architecture

- `SaveData.business` (`BusinessState`): calendar, inventory, refrigerator,
  spoilage, menu (prices), popularity, supplierContract, staff (hired
  roles), equipmentCondition, inspectionFines, finance (daily accumulator +
  lifetime), menuActivation (active dishes), supplies.
- A Business day: `startBusinessService` → orders from the **active menu**
  (`businessServiceSessionForToday`, `BASE_CUSTOMERS_PER_DAY` 8 × popularity
  0.5–1.5) → the player cuts each order (`enterBusinessPreparation`) →
  `serveBusinessOrder` consumes real stock (FIFO-usable,
  `consumeUsableIngredients`), packaging, pays the menu price
  (`businessCustomerPayment`), records revenue/COGS → **End Business Day**
  (`BusinessDayManager.endBusinessDay`): advance the calendar, spoilage
  sweep, contract expiry, payroll, inspection + fine, popularity, P&L.
- Deterministic (seeded) everywhere money or demand is decided.
- Available from the start, no level gate; it is the only thing that
  advances the calendar.

## 3. Inventory

- `business.inventory`: per ingredient `{ quantity, unitCost (weighted
  average paid), purchaseDay (weighted) }` (`businessInventory.ts`).
- Freshness: `perishability.ts` (shelf life 3–12 days, FRESH / AGING /
  NEAR_EXPIRY / EXPIRED, expired never servable), age = calendar days.
- Requirements per dish: `businessDishRequirements(dish)` = the source
  recipe's components × `recipePortionFractionFor` (Aromatic 0.025, others
  1). Only defined for the 48 Business dishes (47 of them campaign recipes).
- Inventory screen (`kc/inventory/*`) is read-only + Throw Out Expired;
  statuses from `inventoryStatus.ts`; the physical fridge (`fridgeView.ts`).

## 4. Market

- `Shop.tsx`, 8 tabs: Knives, Cutting Boards, Campaign Supplier,
  Ingredients, Blacksmith, Smallwares, Tableware, Takeaway. No Staff tab
  (removed on the developer's request; staff live in Business → Staff).
- Ingredients: `purchaseQuote` / `purchaseIngredient` (fridge capacity,
  funds, supplier event and contract prices, Prep Cook discount), one
  `inventory-purchase` ledger entry.
- Deep links: `openMarketIngredients(go, id)`, `openMarketSupplies(go,
  section, id)` (`marketFocus.ts`) — exactly what a "Restock" button needs.

## 5. Save / state

- One `SaveData`, `SaveManager.load` = `{...DEFAULT_SAVE, ...parsed}` plus
  nested migrations (business sub-states, supplies, finance, USD, kitchen
  development V3, economy V2.5). Bridge storage key `knifecraft_save`.
- Optional new fields inside existing objects need no migration (absent =
  default), as `levelProgress.paidOrders` showed.

## 6. Wallet / ledger

- `SaveData.credits` (cents, never < 0, `economy/wallet.ts`),
  `appendLedgerEntry` (one entry per movement, lifetime totals). 26 ledger
  categories; `inventory-purchase`, `supply-*`, `business-*` exist already.

## 7. Fridge

- `business.refrigerator.refrigeratorId`: Basic 40 / Commercial 80 /
  Professional 140 units; `RefrigeratorManager` capacity (sum of
  quantities), purchase in Business → Equipment; condition + maintenance.

## 8. Supplies

- `business.supplies.stock[id] = { units, costBasis }`, 50 lines
  (`businessSupplies.ts`): 18 culinary, 17 tableware, 15 packaging.
- Only packaging is used (one container + one bag per Business order).
  Smallwares and tableware are owned, never used up, no effect.
- In the catalog already: paper napkins, tissues, wet wipes, wrapped
  cutlery kits (disposable cutlery), containers, bags.
- **Not in the catalog**: dishwashing liquid, cleaning supplies.

## 9. Staff — two systems today

- **Campaign**: `SaveData.ownedStaffIds` (Prep Assistant, Quality Chef,
  Kitchen Assistant; one-time purchase; `economy/staff.ts` lowers the
  abstract COGS ≤ 6% and raises the quality bonus). Shown in Business →
  Staff → Kitchen helpers.
- **Business**: `business.staff.hiredRoles` (6 waged roles: Prep Cook,
  Line Cook, Head Chef, Server, Cleaner, Manager), paid at End Business Day.

## 10. Menu

- `business.menu` (player prices; suggested = cost / 0.30),
  `business.menuActivation` (active dishes), `BUSINESS_DISH_CATALOG` (48
  dishes, each from one campaign recipe). Orders come only from active
  dishes.

## 11. Suppliers — two systems today

- **Campaign**: `SaveData.selectedSupplierId` (Local / Wholesale −10% /
  Premium +10% on the abstract COGS), Market → Campaign Supplier.
- **Business**: `business.supplierContract` (contracts: price and quality
  terms on purchases) + daily supplier events (`businessSupplierEvents.ts`).

## 12. Endless

- `daily/EndlessServiceManager.ts`: unlocks when all 250 levels are complete
  (`isEndlessUnlocked`, derived — a Level 250 save unlocks immediately),
  loops the campaign's SERVICE levels, pays `paidLevelReward` up to $600 a
  day (`endless` in the save). No stock.

## 13. Today's Special

- `daily/DailyOrderManager.ts`: one featured unlocked level per calendar
  day (same for everyone), $50 bonus once a day (`dailyOrder` in the save).

---

## 14. Reused directly

Inventory + perishability + `consumeUsableIngredients` + `realCogsFor`;
`purchaseIngredient` / `purchaseSupply` and the Market deep links;
`RefrigeratorManager`; `endBusinessDay` (day end); the Business order engine
(`businessServiceSessionForToday`, `serveBusinessOrder`) for menu orders and
Endless; menu + activation; staff and supplier managers; the ledger and
wallet; `ServiceManager` sessions; `paidOrders`; the Inventory screen and
physical fridge; Business screens (Overview, Equipment, Staff, Suppliers,
Menu, Operations) as the Restaurant's back office; `DailyOrderManager`.

## 15. Needs adapters (new small pure modules, no second system)

| Adapter | Why |
|---|---|
| `restaurant/recipeRequirements.ts` | Stock needs for **any** of the 221 recipes (generalises `businessDishRequirements`, same portion rule), × guests later |
| `restaurant/serviceTickets.ts` | Rolls a pool level's orders up front (seeded, saved per level like `paidOrders`) so the Pre-Service Check knows exactly what's needed and a retry can't re-roll |
| `restaurant/unlocks.ts` | Which restaurant system is live at which level (the spec's §5 schedule), one table; every gate reads it |
| `restaurant/preServiceCheck.ts` | Ready / missing / warning verdict from the save (ingredients, fridge, tableware, napkins, dish soap, packaging, tools) |
| `restaurant/campaignConsumption.ts` | Consume stock and supplies when a campaign order is served (same functions as Business), exactly once |
| `restaurant/tableware.ts` | Reusable: in use / washing / available, derived per service (no per-plate tracking) |
| `restaurant/serviceResources.ts` | Dish soap as a 0–100% resource, napkins per order |
| `restaurant/restaurantDay.ts` | Ends the restaurant day from the campaign: `endBusinessDay` with only the unlocked parts (no payroll before staff, no inspections before cleaning) |
| `restaurant/endlessRestaurant.ts` | Endless = Business days on the active menu after L250, with an event hook |
| UI merge | One Staff screen and one Suppliers screen over the two existing data sets each |

## 16. Needs migration

- Existing Business stock, staff, menu, contracts, finance: kept as they are
  (they become the restaurant's). No new top-level fields.
- New nested fields with safe defaults: per-level tickets, dish-soap level,
  tableware washing state, unlock acknowledgements ("seen" story beats).
- A mid-campaign save: systems from chapters behind it switch on; it gets no
  money. Spec §46 allows default supplies quantities: a small starter set
  (see conflict 8).
- A save in the middle of a Business day: that day stays open and ends at the
  next restaurant day end.

---

## 17. Conflicts and risks

**Decided by the developer on 2026-10-04** (answers to the four open
questions; the defaults below stand for the rest):

- **#3 Food charged twice:** keep both. Do not change any payout, reward,
  recipe cost or economy number; no hidden rewards or automatic refunds.
  P0 of the Economy TODO. The campaign must still never soft-lock on stock:
  show exactly what is missing, the amount needed, the capacity needed,
  warn before expiry, allow disposal, announce requirements ahead, and give
  an affordable path.
- **#7 Business days before L250:** removed. Levels 1–250 are the only
  progression and the only campaign income; Business becomes management UI
  (Overview, Inventory, Fridge, Supplies, Equipment, Staff, Suppliers, Menu,
  Operations, Analytics), not a playable mode. Menu / random orders appear
  inside levels, especially from L121. Open restaurant days only in Endless
  after L250, on the same systems.
- **#1 Staff:** only in Restaurant → Staff, never in the Market. The waged
  staff and the campaign kitchen helpers become ONE Restaurant Staff system;
  current effects, wages and prices unchanged.
- **#12 Build safety:** one central build-time switch,
  `src/game/config/restaurantMode.ts` → `RESTAURANT_MODE` (false until every
  phase, migration, economy, QA and real-device testing are done and
  approved). No other feature flags; no player-facing setting; old systems
  stay until the full system passes QA.

| # | Conflict | Resolution |
|---|---|---|

| # | Conflict | My default unless you say otherwise |
|---|---|---|
| 1 | Spec §36 lists **Staff in the Market**; on 2026-10-03 you asked to remove staff from the Market and keep them in Business only. | **Decided:** Restaurant → Staff only, one Staff system. |
| 2 | Spec §2 nav: Kitchen · Market · Restaurant/Progress; §35 keeps Inventory separate. | Kitchen · Market · Inventory · **Restaurant** (was Business) · Progress. |
| 3 | **Food is charged twice.** The campaign settlement keeps deducting its abstract COGS (formulas must not change), and the player now also pays for real stock. | **Decided:** keep both, P0 in the Economy TODO, no compensation. |
| 4 | **Two staff systems, two supplier systems.** Spec: one conceptual system, keep campaign COGS effects until the economy pass. | One Staff screen and one Suppliers screen; both data sets kept underneath; effects unchanged. |
| 5 | **No day clock in the campaign**, so food never ages. | From the freshness unlock (L21) a restaurant day = **2 levels** (lunch + dinner); the evening review runs the unlocked parts of `endBusinessDay`. |
| 6 | **Dish soap and cleaning supplies** don't exist; adding them needs prices, and the spec forbids changing prices. | Add 2 lines priced like every other line (WebstaurantStore retail × 0.65, source recorded), flagged in the Economy TODO. |
| 7 | **Business days before L250.** Today anyone can run Business days for money; spec §30: nothing may fund the campaign except the campaign. | **Decided:** no pre-250 Business days; menu orders inside levels from L121; open days only in Endless. |
| 8 | **Existing players and new requirements.** A Level 120 save suddenly needs plates, napkins and dish soap it never bought. | A one-time starter set of the supplies their chapter needs (goods, no money), as §46 allows. |
| 9 | **Endless pay changes nature**: today the level reward up to $600/day; as a restaurant it earns menu prices through the Business engine. | Use the existing Business payment formula (no new numbers); flag in the Economy TODO. |
| 10 | The spec's **unlock schedule** puts takeaway at L151–180 and the menu at L121–150, but Business packaging and menus exist today. | Follow the spec's schedule for the campaign; before a system's unlock its stock is ignored, never wasted. |
| 11 | **CLAUDE.md** says "Campaign must never require any Business system", and suites guard it (`business-supplies-qa` H1, `inventory-market-qa`, `business-ux-qa`, `campaign-integrity-qa`). | Rewrite that rule to the new design once you approve, and change those checks on purpose (never delete them). |
| 12 | **Size and safety.** This touches both order engines, saves, navigation and most of the 61 suites. | **Decided:** one central `RESTAURANT_MODE` switch, off until everything is approved. |

---

## 18. Proposed sequence (the spec's §51, made concrete)

| Phase | Work | Main files | Tests added |
|---|---|---|---|
| 2 | `restaurant/` module: unlock table, recipe requirements for all 221 recipes, the switch | new `src/game/restaurant/*` | `restaurant-unlocks-qa` |
| 3 | Campaign orders consume real stock on serve (pool + batch + Today's Special), exactly once; replays free | `App.serveCampaignOrder`, `serveBatchGroupViewedOrder`, `campaignConsumption.ts` | A, B, E, U, V, W |
| 4 | Pre-Service Check: rolled tickets, ✓ / missing, Restock → exact Market item, Start Service | `serviceTickets.ts`, `preServiceCheck.ts`, `kc/restaurant/PreServiceCheck.tsx` | C, D |
| 5 | Day clock from L21, freshness, Throw Out Expired in the check, fridge-capacity warning (manage / upgrade / continue) | `restaurantDay.ts` | F, G |
| 6 | Tableware (reusable + washing), napkins, dish soap, takeaway packaging, tools | `tableware.ts`, `serviceResources.ts`, 2 catalog lines | H, I, J, K |
| 7 | Staff / equipment / suppliers merged screens, effects unchanged | `kc/business/*` → Restaurant | L, M |
| 8 | Menu + random menu orders inside levels (from L121) | Business order engine | N, T |
| 9 | Business entry point removed; Restaurant tab | `Kitchen.tsx` NAV, `ScreensRouter`, `businessTabs` | — |
| 10 | Endless Restaurant Service on the Business engine + event hooks (first: Dinner Rush, Large Group) | `endlessRestaurant.ts`, Endless screen | Q, R, S, T |
| 11 | Today's Special as a restaurant event | `DailyOrderManager` wiring | — |
| 12 | Progress (rank, stage, Restaurant Complete at L250), analytics | `RestaurantProgress`, Operations | — |
| 13 | Save migration + starter set | `SaveManager` nested migrations | O, P |
| 14 | Full QA at 320–768 px, every save era, docs, Economy TODO | `tools/e2e/restaurant*.mjs` | all |

Each phase ends with tsc, ESLint, Prettier, build, preflight, the full QA
sweep, its own browser check, a commit and a push to the feature branch.
`main` is only touched when you approve a merge.

### Progression & Early Menu spec (2026-10-04) — phase A audit

The developer's second spec ("Unified Restaurant Progression & Early Menu")
moved the menu to Level 1, re-ordered the systems and added a day clock.

- **Exists / reused:** `BUSINESS_DISH_CATALOG` (48 dishes, each from one
  campaign recipe) is THE menu; `business.menuActivation` (dishes switched
  OFF, so new dishes arrive on); the Business menu screen; End Business Day;
  the freshness clock `business.calendar`; coaching's technique-teaching
  levels; the phase 2–4 modules.
- **Added:** `restaurant/restaurantProgression.ts` (the ONE table: systems,
  menu unlocks, menu targets, cuisines + specialists, day schedule, closing
  chores; `unlocks.ts` re-exports it), `restaurant/restaurantMenu.ts`
  (unlocked / locked / active menu, orderability), `restaurant/restaurantDay.ts`
  (the day clock), the opening card in the Pre-Service Check, the Closing
  Time sheet, the Menu screen's restaurant view, `coaching.techniqueFirstLevel`.
- **Conflicts found:**
  1. No Business dish's recipe appears in a level before L10, so "unlock a
     dish when its level teaches it" gives 0 dishes at L1 (target 2). The
     menu is a curated schedule instead, under checked rules (techniques
     taught — L1–5 tutorial counts for the 2 starter dishes —, cuisine
     open, meat L101 / fish L109 / ribeye L106). Every band of the target
     curve is met at every level.
  2. Fixed campaign tickets vs menu-only orders: a level's own teaching
     orders stay exactly as they are (deterministic); "customers order only
     from the active menu" applies to the menu orders of phase D.
  3. The first spec's schedule (menu at L121, staff L81 …) is replaced;
     `restaurant-unlocks-qa` follows the new one on purpose.
  4. The Business screen is still titled "Business" (renaming to Restaurant
     is phase L).
  5. Days before L21 don't age food (freshness is taught at L21), so the
     day number and the freshness clock only move together from L21.
- **Tests protecting these systems:** `business-dish-catalog-qa`,
  `business-ux-qa` (S7 now reads the pool), `inventory-market-qa`,
  `economy-v3-*`, `restaurant-unlocks-qa`, `restaurant-stock-qa`, plus the new
  `restaurant-menu-qa`, `restaurant-day-qa`, e2e `restaurantday.mjs`.

### Progress

| Phase | State | Commit / QA |
|---|---|---|
| 1 Audit | done | this document |
| 2 Foundations | done | `restaurant-unlocks-qa` |
| 3 Campaign uses real stock | done (behind the switch) | `restaurant-stock-qa`, e2e `restaurantstock.mjs` |
| 4 Pre-Service Check | done (behind the switch) | same |
| A Audit (progression spec) | done | above |
| B Central progression data | done (behind the switch) | `restaurant-menu-qa`, `restaurant-unlocks-qa` |
| C Early menu progression | done (behind the switch) | `restaurant-menu-qa`, e2e `restaurantday.mjs` 5 |
| 5 Day clock (opening, services, closing, Day N+1) | done (behind the switch) | `restaurant-day-qa`, e2e `restaurantday.mjs` |
| D Menu orders inside levels (menu guests) | done (behind the switch) | `restaurant-guests-qa`, e2e `restaurantguests.mjs` |
| G Consumable supplies (place settings, napkins, dish soap, cleaning liquid, takeaway packaging) | done (behind the switch) | `restaurant-supplies-qa`, e2e `restaurantsupplies.mjs` |
| Brief 2026-10-05: menu from L11 on the developer's curve, tied to cuisine chapters; restaurant news; staff requirements + specialist chefs; bulk buying; Inventory NEEDS ATTENTION; fridge warnings; one restaurant before L250, Endless Restaurant after | done (behind the switch) | `restaurant-menu-qa`, `restaurant-progression-qa`, e2e `restaurantprogression.mjs` |
| M Save migration (starter crate, once, no money) | done (behind the switch) | `restaurant-migration-qa`, e2e `restaurantmigration.mjs` |
| N Final QA (campaign simulation, widths, regression, report) | done | `restaurant-campaign-sim-qa`, e2e `restaurantwidths.mjs`, `docs/RESTAURANT_QA_REPORT.md` |
| Economy pass (P0, item effects on real stock, Endless Restaurant demand) | done (behind the switch) | `restaurant-economy-pass-qa`, `restaurant-endless-qa` |
| 7 One back office (Staff, Suppliers, Equipment) | done (behind the switch) | `restaurant-backoffice-qa`, e2e `restaurantbackoffice.mjs` |
| Cleanup before the next gameplay phase: Level 1–10 UX pass, phone fridge (one compartment at a time), 30-day history, lazy Restaurant screens, unused assets | done (both builds — explicitly requested) | `level-ux-qa`, `business-history-qa`, `lazy-load-qa`, `unused-assets-qa`; e2e `levelux`, `fridgepager`, `history`, `lazyload` |

Phase 7 notes (one back office, conflict 4):

- **Staff** was already one screen (Restaurant → Staff: the six waged roles,
  the kitchen helpers, the specialist chefs). Nothing changed.
- **Suppliers**: the ingredient supplier (`SaveData.selectedSupplierId`:
  Local / Wholesale −10% / Premium +10%), which since the economy pass sets
  Market ingredient prices, moved from the Market's "Campaign Supplier" tab
  to Restaurant → Suppliers, above the contracts and today's supplier
  conditions. Each card shows a tomato's Market price with that supplier
  (the Market's own quote); choosing stays free (App.selectSupplier, no
  money, no ledger). The Market has no supplier tab in the restaurant build;
  its Ingredients view names the supplier and links to the tab. The release
  build keeps its Campaign Supplier tab.
- **Equipment**: restaurant development (the kitchen tiers) shown above the
  fridge — current tier, built x / 5, the next tier with its price and level
  — read-only, built on the Kitchen Upgrade screen.
- The back office is titled "Restaurant" ("your back office") in the
  restaurant build; its footer no longer says Business runs on its own
  calendar.
- View model: `restaurant/restaurantBackOffice.ts` (pure). Data and effects
  unchanged. Open (economy): Premium is strictly costlier with no benefit
  (`supplierDefinitions.ts` says so on purpose) — Economy TODO #9.

Phase M notes:

- `restaurant/restaurantMigration.ts`, run by `SaveManager.load` (and on
  reset and for a fresh save) only in the restaurant build, after the
  economy migration, written back at once. Stamped in
  `business.restaurantMigration` (version 1), so it runs once.
- Kept as they are: levels, credits, ledger, economy, items, kitchens,
  Business stock, staff, menu switches, prices, contracts, calendar and
  history — they become the restaurant's. No money, no ledger entry.
- Starter crate ("Welcome to your restaurant", goods at cost 0, only
  topping up), for the systems the save is already past: ingredients for
  the next 3 services (never past the fridge) from L15; place settings for
  a service, napkins to 100, one bottle each of dish soap and cleaning
  liquid from L31; takeaway containers and bags from L71. Staff need
  nothing (hiring is free; the check asks). A fresh save is only stamped.
- The welcome shows in the Pre-Service Check until a service starts.
- Not done: the plan's "Endless progress converted to stars" — the
  Endless Restaurant runs on the Business engine and has no stars; an old
  save's Endless Service history stays in its ledger.
- The START button now names the blocker ("Restock to start" / "Hire staff
  to start").

Notes on the 2026-10-05 brief:

- Teaching sequence (replaces the 2026-10-04 table): L1–10 cooking
  fundamentals (the day clock only), L11 menu, L15 ingredient stock, L21
  fridge, L31 dine-in, L41 staff, L51 cuisines, L71 takeaway, L91 bigger
  restaurant (closing = End Business Day), L121 full management, L241
  Grand Service. Suites that encoded the old schedule were updated on
  purpose (`restaurant-unlocks-qa` U1/U2/U5, `restaurant-stock-qa` A1,
  `restaurant-guests-qa` G1/M4/N4, `restaurant-menu-qa` M/A, e2e
  `restaurantday` 5 and `restaurantguests` → Level 12).
- Menu curve: hits the developer's numbers everywhere the 48 dishes allow;
  short only at L20/25/31 (techniques taught later) and L91/101/111 (meat
  L101, fish L109). No recipe was invented.
- Cuisine opening levels now follow the campaign chapters (Mediterranean
  61→71, Mexican 71→81, the Asian group split into Japanese 101, Chinese
  121, Thai 141, Korean 161 — one Asian Chef, still an open decision).
- Restaurant news (`restaurantNews.ts`) in the Pre-Service Check: what's
  new at the level and why, and what's coming within 5 levels; the check
  opens for it on a first play.
- Staff: requirements scale with the service (orders, tables, cuisines,
  team) and are announced 5 levels ahead; hiring is free, so a requirement
  can't soft-lock. Specialist chefs are restaurant staff
  (`business.restaurantStaff`); the classic six-role catalog is unchanged.
- Found and fixed: closing from L91 ran End Business Day without its
  payroll / fine ledger entries (phase 5); it now writes the same entries
  App does.
- Bulk buying: an optional discount argument on the existing purchase
  functions (0 = the classic price); the restaurant build passes it.
- Inventory: one restaurant-wide ⚠️ NEEDS ATTENTION list at the top
  (read-only, navigation only), recommending exactly what the next
  service's check would buy.
- Before L250 the restaurant build has no separate Business Day (the
  Business tab — "Restaurant" — shows a note; the route and start refuse);
  after L250 the same engine is the Endless Restaurant.

Phase G notes:

- `restaurant/serviceSupplies.ts`, every number in `SERVICE_SUPPLY_RULES`
  (napkins per order 1, soap 5% of a gallon per wash-up, cleaning liquid
  10% per closing, takeaway share 30%, "low" at ≤ 3 services left).
- Dine-in from L31: one clean place setting (dinner plate + fork + knife,
  reusable) and a napkin per order; used settings wait in "washing" until
  the wash-up (after the service, and again when the next one starts) uses
  dish soap. Takeaway from L71: a seeded ~30% of a level's orders; one
  container + one bag (Business's own rule) + a napkin. Menu guests eat in.
- Only what a service can't run without blocks: clean settings and
  takeaway packaging. Napkins, soap and cleaning liquid warn (no soap →
  settings stay dirty, which then shows as short settings). When the wallet
  can't cover what blocks, Grandma lends her spares (goods at cost 0, no
  money, no ledger — the pantry rule), so nothing soft-locks.
- Two catalog lines (decision 6): dish soap $50.99 and cleaning liquid
  $51.49 a case of 4 gallons at retail, × 0.65. The product pages can't be
  opened from the build machine; the prices are WebstaurantStore's own
  search listing (2026-10-04), recorded in the code — re-check them.
- Using supplies moves no money and writes no ledger entry; opening a
  bottle or using a napkin/package moves its cost basis to the packaging
  "used" totals (the same as Business packaging). No P&L line in the
  campaign (Economy TODO #2–6).
- Existing saves at L31+ have no tableware: the first check asks for it
  (or Grandma's spares). A starter set for old saves is phase M (decision 8).

Phase D notes:

- A level's own orders are unchanged (they teach); menu guests come after
  them, optional, from the active menu only. Batch-group levels take no
  guests yet.
- A guest is restaurant revenue at the dish's menu price (the Business
  payment rule), so the two pay models now meet in one service (Economy
  TODO #13). `business-final-audit-qa` F2 / `business-wtp-qa` H2 now name
  the two revenue writers instead of one.
- Found while testing (pre-existing): a window resize after serving
  dropped the result panel and showed the served order again at its first
  step. Cause: `GameShell` swapped its element tree when the frame crossed
  320 px wide (wrapper ↔ no wrapper), which remounted the whole game. Fixed
  with one stable wrapper (only its style changes); e2e `resize.mjs`.

Found while building 3–4:

- The switch is build-controlled (`VITE_RESTAURANT_MODE=1` test builds only).
  Vite substitutes only the plain `import.meta.env.VITE_…` form; the
  optional-chaining form silently folded to off.
- The Order Board / Kitchen buttons call `go("gameplay")` right after
  selecting a level; `App.go` ignores that jump while a check is opening.
- Freshness is ONE weighted average per ingredient (`addStock`), so fresh
  stock bought on top of expired stock makes the expired part look usable
  again. This is pre-existing Business behaviour; the pantry throws out
  expired stock first, and the check asks for it before Start. A real fix
  (per-batch stock) is an architecture change for later.

The Economy TODO (spec §48) is started at `docs/ECONOMY_TODO.md` with the
items known now and grows with every phase.
