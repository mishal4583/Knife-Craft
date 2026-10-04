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

### Progress

| Phase | State | Commit / QA |
|---|---|---|
| 1 Audit | done | this document |
| 2 Foundations | done | `restaurant-unlocks-qa` |
| 3 Campaign uses real stock | done (behind the switch) | `restaurant-stock-qa`, e2e `restaurantstock.mjs` |
| 4 Pre-Service Check | done (behind the switch) | same |
| 5–14 | to do | — |

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
