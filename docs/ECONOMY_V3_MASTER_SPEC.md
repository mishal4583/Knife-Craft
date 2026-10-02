
---

# 3. `docs/ECONOMY_V3_MASTER_SPEC.md`

For this one, **use the same master specification as the Word document**, but I recommend making this the actual file Claude reads.

The important part is that it contains the complete **V3-3 → V3-14 requirements**. To keep the execution reliable, structure it like this:

```md
# KNIFECRAFT — ECONOMY V3
# BUSINESS SIMULATION MASTER SPECIFICATION

Version: 1.0

---

# 0. PURPOSE

Economy V3 extends the completed Economy V2 Core with a realistic Business Mode restaurant simulation.

Economy V2 remains frozen.

Economy V3 is implemented under:

SaveData.business

---

# 1. LOCKED ECONOMY V2

Revenue: 165,140
Completion Rewards: 330,691
COGS: 37,620
Quality Bonus: 3,315
Honest Net: 461,526

These values must remain unchanged for Campaign Mode.

---

# 2. CURRENT V3 ARCHITECTURE

SaveData
└── business: BusinessState
      ├── calendar
      └── inventory

V3-1 Business Calendar: COMPLETE

V3-2 Business Inventory: COMPLETE

All future systems extend BusinessState.

---

# 3. GLOBAL RULES

- No second wallet.
- No second ledger.
- No second ingredient registry.
- No second recipe registry.
- No second preparation engine.
- No second event bus.
- No second save file.
- No negative cash.
- No debt.
- No permanent bankruptcy.
- No hidden economic penalties.
- No uncontrolled Math.random().
- Campaign remains independent.
- Every wallet mutation enters EconomyLedger.
- Failed transactions are atomic.
- Existing tests must not be weakened.

---

# 4. BUSINESS MODE

Business Mode eventually contains:

Business Calendar
Business Inventory
Refrigerator
Perishability
Menu Pricing
Popularity
Customer Demand
Supplier Contracts
Supplier Events
Staff
Equipment Condition
Maintenance
Breakdowns
Inspections
Inspection Fines
Business Revenue / Order / Service Pipeline
Real-World USD Pricing Model
Operating Costs
Daily P&L

---

# 5. PHASE V3-3 — REFRIGERATOR / STORAGE

## Objective

Create functional Business Mode storage.

## Requirements

- Refrigerator catalog.
- Starting refrigerator.
- Capacity.
- Used capacity.
- Available capacity.
- Storage validation.
- Refrigerator purchase.
- Refrigerator upgrades.
- Persistence.
- UI.
- Ledger integration.

## Rules

Inventory remains the source of truth for quantities.

Refrigerator stores capacity and asset state.

Never duplicate ingredient quantity.

Never delete inventory during an upgrade.

Over-capacity inventory purchase must fail atomically.

## Do NOT implement

- freshness
- expiry
- spoilage
- aging
- supplier contracts
- supplier events
- menu pricing
- popularity
- demand
- staff expansion
- equipment condition
- inspections

## QA

Create:

scripts/refrigerator-storage-qa.mts

Test:

- default refrigerator
- capacity
- exact capacity
- over-capacity rejection
- atomic failure
- purchase
- upgrade
- inventory preservation
- persistence
- migration
- ledger
- Campaign independence
- no negative cash
- no negative inventory

---

# 6. PHASE V3-4 — PERISHABILITY

## Objective

Ingredients age according to Business Day.

## States

FRESH
AGING
NEAR_EXPIRY
EXPIRED

## Requirements

- Data-driven shelf life.
- Deterministic ageing.
- Business Day based.
- Refrigerator interaction.
- Expired ingredients cannot be served.
- Spoilage recorded for P&L later.
- No silent inventory deletion.

## QA

Test shelf-life boundaries, ageing, expiry, reload, determinism, and service blocking.

---

# 7. PHASE V3-5 — MENU PRICING

## Objective

Business Mode menu prices are player-controlled.

Campaign recipePay is untouched.

## Requirements

- Price per Business Mode menu item.
- Persistent price.
- Integer-safe.
- Non-negative.
- Data-driven.
- Margin calculation.
- Demand integration later.

## QA

Test persistence, validation, margins, and Campaign isolation.

---

# 8. PHASE V3-6 — POPULARITY + DEMAND

## Objective

Create a 0–100 restaurant popularity system.

## Factors

- food quality
- customer satisfaction
- pricing
- service consistency
- successful orders
- failed orders
- recent performance
- inspection status
- menu variety where meaningful

## Outputs

- customer demand
- order frequency
- customer mix/willingness to pay where implemented

Popularity must be deterministic and explainable.

---

# 9. PHASE V3-7 — SUPPLIER CONTRACTS

Extend the existing suppliers.

Possible fields:

supplierId
contractLength
discount
minimumOrder
deliveryTime
deliveryDays
qualityModifier
cancellationFee
contractStartDay
contractEndDay

Contracts are optional and persistent.

---

# 10. PHASE V3-8 — SUPPLIER EVENTS

Implement deterministic supplier events.

Examples:

- Supplier Delay
- Price Increase
- Bulk Discount
- Fresh Catch
- Temporary Shortage
- Premium Stock

No uncontrolled randomness.

Events must be visible and reproducible.

---

# 11. PHASE V3-9 — STAFF EXPANSION

Extend existing staff into Business Mode employees.

Possible fields:

employeeId
name
role
skill
specialization
salary
experience
fatigue
schedule

Possible roles:

- Prep Cook
- Line Cook
- Head Chef
- Server
- Cleaner
- Manager

Only implement roles with real business functions.

No Campaign salaries.

---

# 12. PHASE V3-10 — EQUIPMENT CONDITION

Condition:

100–80 GOOD
79–60 WORN
59–40 POOR
39–20 CRITICAL
19–0 BROKEN

Condition declines through usage.

It may affect:

- waste
- quality consistency
- efficiency

Existing sharpness and equipment specialization remain separate.

---

# 13. PHASE V3-11 — MAINTENANCE + BREAKDOWNS

States:

OPERATIONAL
NEEDS_SERVICE
BROKEN
UNDER_REPAIR

Requirements:

- maintenance
- repair
- condition restoration
- recoverable breakdown
- data-driven costs
- no permanent soft-lock
- no negative cash

Breakdowns should be consequences of poor condition, not arbitrary punishment.

---

# 14. PHASE V3-12 — INSPECTIONS

Inspection categories:

- Food Storage
- Ingredient Expiry
- Refrigerator Condition
- Kitchen Cleanliness
- Equipment Condition
- Food Safety
- Staff Compliance where applicable

Results:

PASS
WARNING
FAIL

Every result must explain why.

---

# 15. PHASE V3-13 — INSPECTION FINES

Severity:

Minor → warning

Repeated → small fine

Major → larger fine

Critical → temporary restriction or explicitly designed consequence

Never:

- create debt
- make cash negative
- permanently lock the restaurant

Every actual fine enters EconomyLedger.

---

# 16. PHASE V3-14 — BUSINESS REVENUE & SERVICE + REAL-WORLD BUSINESS MODEL

## Why this phase exists

The original V3-1..V3-14 sequence never assigned a phase to build an actual
revenue mechanism for Business Mode. Every phase from V3-6 onward documented
order/revenue effects as forward hooks with no real caller ("Business Mode
has no live order/serving pipeline... a later phase composes onto this").
Section 19 (BUSINESS DAY FLOW) has always described a real revenue path —
Open Restaurant -> Customers Generate Orders -> Existing Preparation System
-> Existing Quality System -> Serve -> Consume Business Inventory ->
Revenue/Settlement — but no phase number was ever attached to building it.
A Phase A economic audit (conducted before this phase existed) confirmed:
zero revenue-generating code exists anywhere in `src/game/business/*.ts` —
every credits mutation there is a subtraction. This phase closes that gap.
V3-15 (Business P&L) cannot mean anything until this phase gives Business
Mode a real income line.

This phase ALSO corrects a second gap found at the same time: Business
Mode's existing prices (ingredients, refrigerators, staff salaries,
maintenance, fines) are prototype numbers with no real-world grounding.
This phase replaces them with USD values calibrated against researched
2026 U.S. restaurant-industry benchmarks (see §24), without discarding any
V3-1..V3-13 architecture.

## Objective

Give Business Mode an actual restaurant simulation: a real customer-facing
dish catalog, a working order -> preparation -> serve -> revenue pipeline
built on the EXISTING preparation/quality/organization architecture, and
real-world USD-benchmarked pricing throughout.

## Reference market

USD ($), United States, independent/casual restaurant, 2026 baseline. Every
real-world figure used must carry: source, source date, unit, and whether it
is a retail, wholesale, restaurant, regulatory, or equipment price — see the
REAL-WORLD MARKET CALIBRATION appendix (§24). Where a real-world price is
jurisdiction- or market-dependent, label it explicitly as a U.S.
national-average benchmark abstraction rather than presenting one universal
number as if it were exact everywhere.

## Currency

Business Mode money is USD, stored as integer cents internally (mirroring
how `SaveData.credits` is already an integer unit), displayed to the player
as dollars/cents. Do not rename existing "coins" to dollars and do not
assume 1 old coin = $1 for any existing save — perform an explicit
migration/calibration analysis (documented in the phase's own implementation
report) for what an old save's `credits`/business prices become under the
new USD model.

## Requirements — Ingredient model

Extend Business Inventory ingredient records (never duplicate the existing
Ingredient Registry) to carry, where meaningful:

- purchase unit (kg / lb / g / ml / piece)
- quantity in that unit
- unit cost (USD)
- usable yield
- storage volume
- procurement/reference price (which researched §24 benchmark calibrates it)
- purchase day (existing field, unchanged)

Prefer kg/lb/g/ml/piece over an abstract "per-coin" unit wherever the real
ingredient naturally has one. Refrigerator capacity must represent a real
physical storage volume (liters or cubic feet) rather than an unexplained
abstract count, where feasible. Preserve old-save migration; do not break
Campaign Mode.

## Requirements — Business Dish catalog

A new catalog, separate from `CAMPAIGN_RECIPES`. Never rename or alter
Campaign recipe data to make a Business Dish work.

A Business Dish has: id, real culinary name (customer-facing), description,
cuisine/category, portion, actual ingredient requirements (Business
ingredient ids + quantities), a reference to the EXISTING preparation
definition that actually drives the minigame for this dish, price (USD),
food cost (USD), food-cost percentage, gross margin, demand characteristics.

The customer/menu-facing name must be a real, recognizable dish (examples:
Kachumber Salad, Pico de Gallo, Cucumber Raita, Tomato Bruschetta, Garlic
Bread) — never a raw preparation-step name (Sliced Tomato Plate, Fresh
Cucumber Plate, Carrot Chop Bowl, Garden Tomato & Cucumber Plate, Garlic
Prep, Smashed Garlic, Chopped Tomato, or any other prep-step-derived label).
Preparation steps are an implementation detail and must never be
customer-facing.

Only catalog a dish whose required ingredients and preparation are actually
supportable by an existing (or newly-added) Business ingredient and an
existing preparation definition. If an authentic dish needs an ingredient
the Business ingredient domain doesn't have yet, add the ingredient to the
Business ingredient domain — never substitute an inauthentic one.

## Requirements — Order / service pipeline

Reuse, never duplicate:

- PreparationScene
- organizationManager / PreparedOutput
- RecipeValidator
- the existing ServiceSession / serveCurrentOrder / advanceServiceSession
  machine (ServiceManager.ts)

Do not build a second cooking engine, a second organization system, or a
second order-session state machine.

Business Mode generates orders as a deterministic function of: active menu,
popularity, demand, restaurant capacity, business day, deterministic
modifiers. No Math.random() in order generation, pricing, or payment.

One order, end to end:

1. generated, referencing a Business Dish
2. starts the existing Preparation gameplay
3. completes through the existing preparation/quality system
4. requires actual available (non-expired) Business Inventory for its
   ingredients
5. consumes that inventory exactly once
6. calculates customer payment from the dish's own price (and any
   deterministic quality/demand modifier)
7. creates exactly one revenue wallet mutation
8. creates exactly one revenue ledger entry
9. updates popularity per the existing Business Mode popularity rules

## Do NOT allow

- double payment
- reload/replay farming
- a payment caused merely by a UI re-render
- duplicate service-cancellation payment
- inventory duplication
- serving with expired inventory

## Requirements — Real-world menu pricing

Menu price is derived from actual ingredient cost, portion size, a target
food-cost percentage (benchmarked, §24), cuisine/category, restaurant
positioning, and demand/popularity — never an arbitrary flat prototype price
(no more 50c/$1-style pricing). The UI must show Menu Price, Food Cost, Food
Cost %, Gross Margin. Margin means gross margin — (price - food cost) /
price — never markup; do not label one as the other.

## Requirements — Real-world supplier pricing

Local / Wholesale / Premium contracts and events modify a real, researched
base procurement price rather than an arbitrary game price. Supplier events
remain deterministic (V3-8's own rule, unchanged).

## Requirements — Real-world refrigeration

Refrigerator capacity/price calibrated against current commercial
refrigeration market data (§24). Show physical capacity, used capacity,
available capacity, purchase price, and — where the specification/data
supports it — maintenance/energy implications.

## Requirements — Real-world staff economics

Business Staff payroll = hourly wage x scheduled hours + documented employer
burden, grounded in current U.S. restaurant labor data (§24) — never an
arbitrary tiny daily flat rate. Business Staff stays a separate catalog from
Campaign Staff (existing V3-9 rule, unchanged). Staff effects must remain
understandable and measurable.

## Requirements — Real-world inspection/compliance

Separate, distinctly-labeled cost concepts — never one universal "inspection
fee":

- regulatory/permit cost
- scheduled inspection (no direct cost by itself)
- corrective action
- reinspection
- statutory/documented penalty

Calibrated against a clearly-labeled U.S. benchmark/reference jurisdiction
(§24). The existing deterministic PASS/WARNING/FAIL evaluation (V3-12) is
preserved unchanged; this phase only recalibrates what a WARNING/FAIL
actually costs. Do not create arbitrary tiny fines simply to make the
economy harder.

## Requirements — Kitchen Investments audit

Audit all 8 existing Kitchen Investments. Every investment must show:
purchase price, ongoing upkeep, unlock condition, current state, exact
effect, what changes after purchase, where the effect is visible,
owned/active state. No investment may exist as flavor text only. Replace or
redesign an investment whose effect isn't real and measurable (for example:
do not keep a beverage-themed investment if the game has no beverage
system).

## Requirements — Shop organization

Redesign Shop's visual hierarchy: 1) Equipped Knife / Knife Hero, 2) Knives,
3) Boards, 4) Refrigeration / Equipment, 5) Kitchen Investments, 6) other
business equipment where appropriate. Use clear section headers/category
navigation, never one undifferentiated list. Knives remain the visual
highlight. Every item shows price, unlock, ownership, equipped state, actual
gameplay effect.

## Accounting model

- Inventory purchase: cash decreases, inventory asset increases. Never also
  booked as an immediate P&L expense — that happens at consumption/spoilage,
  not at purchase.
- Customer sale: cash increases, revenue increases.
- Inventory consumed (served): inventory decreases, COGS increases.
- Inventory spoiled: inventory decreases, spoilage loss increases.
- Staff payroll: cash decreases, labor expense increases.
- Maintenance: cash decreases, maintenance expense increases.
- Inspection/reinspection penalty: cash decreases, compliance expense
  increases.
- Refrigerator/equipment purchase: cash decreases, capital/equipment asset
  increases — never counted as a daily operating expense.

Never double-count: purchase cash outflow vs. COGS; spoilage value vs.
physical inventory removal; maintenance vs. equipment purchase; inspection
evaluation vs. inspection fine; supplier discount vs. a separate revenue
line.

## Do NOT implement (deferred to later phases)

- the final P&L report/UI (V3-15)
- the final ship-readiness audit (V3-16)

## QA

Create `scripts/business-revenue-qa.mts`. Test: menu activation, real
Business Dish names (no raw prep-step name ever reaches the customer-facing
menu), order generation, demand effects, menu price, the existing
preparation pipeline, the existing quality pipeline, inventory availability,
expired-inventory rejection, inventory consumption, customer payment,
revenue ledger entry, cash reconciliation, duplicate-payment protection,
reload, replay, cancellation, failed order, insufficient inventory,
deterministic order generation, Campaign isolation, no Economy V2 drift.

---

# 17. PHASE V3-15 — BUSINESS P&L + FINAL BALANCING

Only begins after V3-14 passes every required gate.

P&L must distinguish: Revenue, COGS, Gross Profit, Labor, Spoilage,
Maintenance, Compliance, Other Operating Expenses, Operating Profit.
Separately report: Capital Expenditure, Inventory Asset Value, Cash, Net
Cash Flow.

Daily P&L:

Opening Cash
Revenue
Ingredient Cost (COGS)
Staff Cost
Operating Cost
Maintenance
Supplier Cost
Inspection Fines
Spoilage
Net Change
Closing Cash

Weekly / lifetime P&L (per the Business Calendar, where supported):

- Revenue
- COGS
- Gross Profit
- Operating Costs
- Net Profit
- Popularity
- Customer Count
- Waste

Reconciliation:

Opening Cash
+
Signed Ledger Cash Flow
=
Closing Cash

Every real wallet mutation must reconcile exactly. Audit every Business Mode
wallet mutation for: missing ledger entry, duplicate ledger entry, wrong
category, wrong sign, zero-value entry, mutation without ledger, ledger
without mutation. The reconciliation must hold across normal days,
profitable days, loss-making days, insufficient-cash days, and
replay/reload/navigation.

Simulation: deterministic, no Math.random(), across the scenario matrix in
§21 SIMULATION.

Balancing: use simulation results, not a preconceived target cash number. A
normal profitable day must be possible; a bad day must be possible; no
runaway cash accumulation, no unavoidable bankruptcy, no soft-lock. If
calibration changes are needed, make the smallest data-driven change
supported by §24's benchmarks and the simulation results, and document every
changed parameter and why.

## Do NOT change

- Campaign Economy V2
- Business Mode architecture merely for convenience
- working mechanics without simulation evidence
- prices/formulas just to force a preferred final number

---

# 18. PHASE V3-16 — FINAL ECONOMY V3 AUDIT / SHIP READINESS

Only begins after V3-14 and V3-15 both pass every required gate. This is the
final Economy V3 phase — do not create a V3-17.

Perform the complete audit described in §22 FINAL AUDIT and produce the
complete final report described in §23 FINAL REPORT.

Confirm every Business Mode economic mutation has a clear, single owner.
Confirm the Economy V2 freeze gate is still exact. Confirm Campaign
isolation holds end to end. Confirm no duplicate wallets/ledgers/inventory
systems/inspection evaluators exist anywhere in the repository.

---

# 19. BUSINESS DAY FLOW

Note (added when V3-14/15/16 were introduced): the "Customers Generate
Orders... Serve... Revenue/Settlement" steps below are now explicitly
V3-14's own scope (see §16) — they were always documented here, just never
assigned a phase number until V3-14 existed.

START BUSINESS DAY

↓

Review Dashboard

↓

Review Inventory

↓

Purchase Ingredients

↓

Review Refrigerator

↓

Review Suppliers

↓

Review Staff

↓

Review Equipment

↓

Set Menu Prices

↓

Open Restaurant

↓

Customers Generate Orders

↓

Existing Preparation System

↓

Existing Quality System

↓

Serve

↓

Consume Business Inventory

↓

Revenue / Settlement

↓

Popularity Update

↓

Equipment Usage

↓

Staff Cost

↓

Spoilage

↓

Supplier Events

↓

Inspection

↓

Daily P&L

↓

Advance Business Day

---

# 20. TESTING

Every phase must:

1. Have focused QA.
2. Preserve previous V3 QA.
3. Preserve Economy V2 QA.
4. Preserve Campaign.
5. Pass TypeScript.
6. Pass ESLint.
7. Pass Build.
8. Pass Preflight.
9. Perform required browser verification.

---

# 21. SIMULATION

After V3-14:

30 days
60 days
90 days
180 days
365 days

Profiles:

- Efficient
- Normal
- Wasteful
- Premium pricing
- Low-price/high-volume
- Poor inventory management
- Poor maintenance
- Supplier-focused

Measure:

- cash
- revenue
- COGS
- inventory purchases
- spoilage
- staff cost
- maintenance
- supplier cost
- fines
- popularity
- customers
- profit
- soft-locks

---

# 22. FINAL AUDIT (V3-16's own scope)

Inspect:

- all V3 files
- BusinessState
- SaveManager
- wallet mutations
- ledger mutations
- inventory
- refrigerator
- perishability
- menu
- popularity
- suppliers
- events
- staff
- equipment
- maintenance
- inspections
- fines
- P&L
- Campaign boundaries
- event listeners
- event emitters

Search for:

Math.random
credits +=
credits -=
credits =
economyLedger

Verify:

- no hidden wallet mutation
- no duplicate ledger
- no negative cash
- no negative inventory
- no duplicate revenue
- no duplicate COGS
- no Campaign contamination

---

# 23. FINAL REPORT (V3-16's own deliverable)

Generate:

1. Executive Summary
2. Phase Status
3. Architecture
4. BusinessState
5. Calendar
6. Inventory
7. Refrigerator
8. Perishability
9. Menu Pricing
10. Popularity
11. Demand
12. Supplier Contracts
13. Supplier Events
14. Staff
15. Equipment
16. Maintenance
17. Breakdowns
18. Inspections
19. Fines
20. P&L
21. Ledger Reconciliation
22. Save Migration
23. Files Created
24. Files Modified
25. QA
26. Browser Testing
27. Simulation
28. Economy V2 Regression
29. Known Issues
30. Remaining Risks
31. Final Ship Readiness

Never claim an unperformed test passed.

---

# 24. REAL-WORLD MARKET CALIBRATION

Reference market for every figure below: USD ($), United States,
independent/casual restaurant, 2026 baseline, unless noted otherwise. Each
figure states its source, source date, unit, and market level (retail /
wholesale / restaurant / regulatory / equipment). Values marked "estimated"
extrapolate from a cited source class using a documented, stated ratio —
they are not independently fetched for every individual item, since the
Business ingredient/dish catalog is large; the same documented methodology
is applied consistently rather than inventing a different one per item.

## Produce (retail, per lb, U.S. city average)

- Tomatoes (field grown): $2.489/lb — source: BLS/FRED Average Price Data
  (CPI), series APU0000712311, May 2026. Retail.
- Iceberg lettuce: $1.699/lb — source: BLS/FRED Average Price Data (CPI),
  series APU0000712211, January 2026. Retail.
- Romaine lettuce: $3.560/lb — source: BLS/FRED Average Price Data (CPI),
  series APU0000FL2101, February 2026. Retail.
- Cucumbers, onions, garlic, carrots, potatoes, bell peppers, and other
  staple produce not individually fetched from BLS/FRED: estimated from the
  same BLS/FRED Average Price Data series family and USDA ERS Fruit &
  Vegetable Prices (ers.usda.gov/data-products/fruit-and-vegetable-prices,
  updated 12/9/2025) comparable categories, using each ingredient's known
  2025-2026 U.S. retail grocery price range. Retail, estimated.

## Restaurant procurement discount (retail -> foodservice/wholesale)

Restaurants typically buy through foodservice distributors at below retail.
No single authoritative source publishes one universal discount ratio;
using the commonly-cited foodservice-industry rule of thumb of
approximately 65% of retail price as the wholesale/restaurant procurement
estimate. Labeled explicitly as an industry estimate, not a fetched
figure, wherever used.

## Restaurant staff wages

- Cooks, median hourly wage: $17.62 — source: U.S. Bureau of Labor
  Statistics, Occupational Employment and Wage Statistics, May 2025.
  Restaurant/labor market.
- Line cooks, national average: $18.14/hr ($37,730/yr) — source: BLS
  Occupational Outlook Handbook (Cooks), aggregated via Chef's Pencil, 2025
  data. Restaurant/labor market.
- Employer burden (payroll taxes + standard benefits load): approximately
  25% on top of gross wages (documented industry range: 20%-30% for FICA
  7.65%, FUTA/SUTA, and typical benefits) — source: 2026 employer payroll
  tax guides (FICA/FUTA/SUTA aggregation, e.g. Mercury/AllVoices 2026
  payroll tax guides). Regulatory + industry estimate.

## Commercial refrigeration (equipment, retail/dealer pricing)

- Single-door reach-in (~17.6-22 cu ft): $1,800-$2,500 — source: The
  Restaurant Warehouse "Commercial Refrigerators Buyer's Guide 2026" /
  Wilprep Kitchen commercial refrigerator cost guide, September 2026.
  Equipment, commercial market.
- Two-door reach-in (~43-48 cu ft): $2,000-$3,500 — same sources, September
  2026. Equipment, commercial market.
- Three-door reach-in (~54-68 cu ft): $4,500-$5,000 — same sources,
  September 2026. Equipment, commercial market.

## Food cost percentage (restaurant benchmark)

- Full-service restaurant industry average: 32.4% — source: National
  Restaurant Association data, 2026, as aggregated by VantaInsights/Rezku
  restaurant industry benchmark articles, 2026. Restaurant benchmark.
- Documented range: fast casual 25%-30%; full-service 28%-32%; fine dining
  30%-38%; bars 20%-28% — same source class, 2026. Restaurant benchmark.

## Health permit / inspection fees (regulatory, jurisdiction-dependent — U.S. benchmark abstraction)

Explicitly jurisdiction-dependent; no single national price exists. Cited
examples, each its own jurisdiction and date, used to calibrate a labeled
U.S.-benchmark abstraction rather than presented as universal:

- New York City: food service establishment permit $280/year (plus $25 for
  frozen desserts) — source: NYC Department of Health, 2026. Regulatory.
- Chicago: fines of $525 per priority violation, $275 per priority
  foundation violation, effective January 1, 2026 — source: City of
  Chicago, 2026. Regulatory/statutory penalty.
- Austin, TX: annual food establishment permit $309-$927, tiered by annual
  gross food sales — source: City of Austin FY25-26 adopted food permit fee
  schedule (via Texas DSHS Local Ordinance Registry), 2026. Regulatory.
- Florida: full-service restaurant total initial cost (permit + plan review
  + inspection) approximately $2,000-$3,300 — source: aggregated 2026
  Florida food license cost guide. Regulatory, estimated aggregation.
- General U.S. range: $50 registration + $100-$1,000 inspection fees —
  source: WebstaurantStore restaurant permits/licenses guide, 2026.
  Regulatory, general benchmark.

V3-14's own implementation documents exactly which of these it uses for its
regulatory/permit cost, scheduled-inspection cost, corrective-action cost,
reinspection cost, and statutory-penalty figures, and why.

---

# 25. BUSINESS SUPPLIES — SEPARATELY AUTHORIZED EXTENSION (NOT A V3 PHASE)

Status: shipped 2026-10-02, after V3-16.

Authorization: the developer's "integrate culinary, tableware, and takeaway
supplies" brief (Shop UI production handoff), confirmed in session with
these decisions:

- prices are researched real prices at the ~65% rule;
- packaging is used one container and one bag per order.

This is **not V3-17**. §18 still holds: Economy V3's phase sequence ended
with V3-16 and is not reopened. This section documents a self-contained
extension of the shipped Business Mode, with its own gates. It does not
change any V3 phase's scope or results.

## Scope

Three Market sections and one Business tab:

| Section | Lines | Groups | Kind |
| --- | --- | --- | --- |
| Culinary & Kitchen Smallwares (back of house) | 18 | Cookware · Prep utensils · Bakeware & storage · Measuring & safety | durable equipment |
| Cutlery, Crockery & Tableware (front of house) | 17 | Cutlery · Crockery · Glassware & hollowware · Table accessories | durable equipment |
| Parcel & Takeaway Supplies | 15 | Containers · Boxes & wraps · Bags & carriers · Securing & hygiene | consumable stock |

- Prep knives and cutting boards are not supplies; they stay in the
  Market's Knives / Cutting Boards sections. Dinner and steak knives are
  tableware.
- Supplies are never ingredients. They are not in `INGREDIENTS`, never
  go in the refrigerator, have no freshness and use no fridge capacity.
- Campaign never reads supplies.

## Data (one nested field, as §3 requires)

- `SaveData.business.supplies` (`businessSupplies.ts`) =
  `{ stock: { [id]: { units, costBasis } }, lifetime: { [section]: { spent, retailValue, purchases, unitsUsed, usedCost } } }`.
  - `units` are pieces/sets/sheets on hand.
  - `costBasis` is the whole cents actually paid for exactly those units.
- New saves start empty. The prototype's opening stock is not shipped.
- `migrateBusinessSuppliesState` (SaveManager.load):
  - a save from before supplies opens empty;
  - known lines and totals are kept, unknown lines dropped;
  - malformed or negative numbers become 0;
  - it is idempotent.
- No second wallet, ledger, save file or localStorage store.

## Prices (sourced, dated)

- Each line's retail price is the real price of that exact pack on
  WebstaurantStore, retrieved 2026-10-02. Its product page is recorded in
  the catalog and in the table below.
- Game price = round(retail × 0.65) in whole US cents. This is the same
  documented restaurant-procurement rule as Business ingredients (§24,
  `businessPricing.ts`).
- "Saved vs retail" = retail value of the packs bought − what was paid.
  It is a derived display metric, per section, all time. It is never
  money and never credited.
**Culinary & Kitchen Smallwares** (Back of house)

| Line | Pack | Retail | Game price | Source product |
| --- | --- | --- | --- | --- |
| Stock pot · 20 qt | 1 piece | $58.99 | $38.34 | [Vigor SS1 Series 20 Qt. Stainless Steel Aluminum-Clad Stock Pot with Cover](https://www.webstaurantstore.com/vigor-20-qt-heavy-duty-stainless-steel-aluminum-clad-stock-pot-with-cover/473SSPOT20.html) |
| Saucepan · 3 qt | 1 piece | $25.49 | $16.57 | [Vigor SS1 Series 3 Qt. Stainless Steel Saucier Pan with Cover](https://www.webstaurantstore.com/vigor-3-qt-stainless-steel-saucier-pan-with-aluminum-clad-bottom/473SSAUCIER3.html) |
| Fry pan · 10 in | 1 piece | $9.34 | $6.07 | [Choice 10" Aluminum Fry Pan](https://www.webstaurantstore.com/choice-10-aluminum-fry-pan/407FRYPAN.html) |
| Sauté pan · 5 qt | 1 piece | $40.99 | $26.64 | [Vigor SS1 Series 5 Qt. Stainless Steel Saute Pan with Lid and Helper Handle](https://www.webstaurantstore.com/5-qt-stainless-steel-saute-pan-with-lid-and-helper-handle/922SSAU5.html) |
| Utility tongs · 12 in | 1 piece | $4.99 | $3.24 | [Choice 12" Heavy-Duty One-Piece Stainless Steel Scalloped Tongs](https://www.webstaurantstore.com/tong-12-utility-s-s-hd-1pc-scallop-nsf/407OPUT12.html) |
| High-heat turner · 12 in | 1 piece | $5.61 | $3.65 | [TableCraft H3905GY 12" High Heat Flexible Silicone Slotted Spatula / Turner](https://www.webstaurantstore.com/tablecraft-h3905gy-12-high-heat-gray-flexible-silicone-slotted-spatula-turner/808H3905GY.html) |
| Ladle · 8 oz | 1 piece | $3.99 | $2.59 | [Choice 8 oz. One-Piece Stainless Steel Ladle](https://www.webstaurantstore.com/choice-8-oz-one-piece-stainless-steel-ladle/407OPL8.html) |
| Piano whisk · 12 in | 1 piece | $4.49 | $2.92 | [Choice 12" Stainless Steel Piano Whip / Whisk](https://www.webstaurantstore.com/choice-12-stainless-steel-piano-whip-whisk/407PW12.html) |
| Vegetable peeler | 1 piece | $3.19 | $2.07 | [Choice 6" Smooth Vegetable Peeler with Stainless Steel Blade](https://www.webstaurantstore.com/choice-6-smooth-vegetable-peeler-with-stainless-steel-blade/407PVSSM2.html) |
| Box grater · 4-sided | 1 piece | $4.99 | $3.24 | [Choice 9" 4-Sided Stainless Steel Box Grater](https://www.webstaurantstore.com/choice-9-4-sided-stainless-steel-box-grater/4074SDGTR.html) |
| Fine mesh skimmers · 5 in | 6 pieces | $20.94 | $13.61 | [Choice 5" Square Fine Mesh Reinforced Skimmer ($3.49 each, sold in 6s)](https://www.webstaurantstore.com/skimmer-square-nickel-plated-metal-sqr-fine-mesh-reinf-5/407SKMSQ5.html) |
| Sheet pan · full size | 1 piece | $6.99 | $4.54 | [Choice Full Size 18" x 26" 19 Gauge Aluminum Bun / Sheet Pan](https://www.webstaurantstore.com/choice-full-size-18-x-26-19-gauge-wire-in-rim-aluminum-bun-pan-sheet-pan/407BUNFULL.html) |
| Mixing bowl · 5 qt | 1 piece | $2.79 | $1.81 | [Choice 5 Qt. Standard Stainless Steel Mixing Bowl](https://www.webstaurantstore.com/choice-5-qt-standard-stainless-steel-mixing-bowl/407SSMXB5.html) |
| Storage container + lid · 4 qt | 1 set | $6.98 | $4.54 | [Choice 4 Qt. Clear Square Polycarbonate Food Storage Container ($5.99) + Choice 2/4 Qt. lid ($0.99)](https://www.webstaurantstore.com/choice-4-qt-clear-square-polycarbonate-food-storage-container-with-green-gradations/176SQRCL4.html) |
| Measuring cup set · 4 pc | 1 set | $5.49 | $3.57 | [Choice 4-Piece Stainless Steel Measuring Cup Set with Wire Handles](https://www.webstaurantstore.com/choice-4-piece-stainless-steel-measuring-cup-set-with-wire-handles/4074PCMCWH.html) |
| Digital portion scale · 11 lb | 1 piece | $23.49 | $15.27 | [Taylor 1020NFS 11 lb. Digital Portion Control Scale](https://www.webstaurantstore.com/taylor-1020nfs-11-lb-digital-portion-control-scale-for-dry-and-liquid-measuring/6081020NFS.html) |
| Probe thermometer | 1 piece | $7.79 | $5.06 | [Choice 5" Digital Pocket Probe Thermometer](https://www.webstaurantstore.com/choice-5-digital-pocket-probe-thermometer-58-572-degrees-fahrenheit/914DRT450.html) |
| Oven mitts · 15 in | 1 pair | $5.99 | $3.89 | [Choice 15" Flame Retardant Oven Mitts](https://www.webstaurantstore.com/choice-15-flame-retardant-conventional-style-oven-mitts/160FLAME15.html) |

**Cutlery, Crockery & Tableware** (Front of house)

| Line | Pack | Retail | Game price | Source product |
| --- | --- | --- | --- | --- |
| Dinner forks | 12 pieces | $6.99 | $4.54 | [Choice Milton 7 5/8" 18/0 Stainless Steel Dinner Fork - 12/Pack](https://www.webstaurantstore.com/choice-milton-7-5-8-18-0-stainless-steel-medium-weight-dinner-fork-pack/267270005M.html) |
| Salad / dessert forks | 12 pieces | $4.59 | $2.98 | [Choice Milton 6 1/2" 18/0 Stainless Steel Salad Fork - 12/Pack](https://www.webstaurantstore.com/choice-milton-6-1-2-18-0-stainless-steel-medium-weight-salad-fork-pack/267270006M.html) |
| Dinner knives | 12 pieces | $9.99 | $6.49 | [Choice Milton 9" 18/0 Stainless Steel Dinner Knife - 12/Pack](https://www.webstaurantstore.com/choice-milton-8-7-8-18-0-stainless-steel-medium-weight-dinner-knife-case/267270008.html) |
| Steak knives | 12 pieces | $6.29 | $4.09 | [Choice 4 3/8" Steak Knife with Natural Wood Euro Handle - 12/Case](https://www.webstaurantstore.com/choice-4-3-8-stainless-steel-steak-knife-with-natural-wood-euro-handle-and-pointed-tip-case/17630111.html) |
| Teaspoons | 12 pieces | $4.29 | $2.79 | [Choice Milton 6 5/8" 18/0 Stainless Steel Teaspoon - 12/Pack](https://www.webstaurantstore.com/choice-milton-6-5-8-18-0-stainless-steel-medium-weight-teaspoon-pack/267270001M.html) |
| Soup spoons | 12 pieces | $5.49 | $3.57 | [Choice Milton 6 3/8" 18/0 Stainless Steel Bouillon Spoon - 12/Pack](https://www.webstaurantstore.com/choice-milton-6-3-8-18-0-stainless-steel-medium-weight-bouillon-spoon-pack/267270002M.html) |
| Dinner plates · 10½ in | 12 pieces | $56.99 | $37.04 | [Acopa 10 1/2" Round Bright White Coupe Stoneware Plate - 12/Case](https://www.webstaurantstore.com/acopa-10-1-2-round-bright-white-coupe-china-plate-case/303BWCOP16.html) |
| Side plates · 7¼ in | 36 pieces | $67.99 | $44.19 | [Acopa 7 1/4" Round Bright White Coupe Stoneware Plate - 36/Case](https://www.webstaurantstore.com/acopa-7-1-4-round-bright-white-coupe-stoneware-plate-case/303BWCOP7.html) |
| Soup / pasta bowls · 16 oz | 12 pieces | $72.99 | $47.44 | [Acopa 16 oz. Bright White Wide Rim Stoneware Soup and Pasta Bowl - 12/Case](https://www.webstaurantstore.com/acopa-16-oz-bright-white-wide-rim-rolled-edge-rim-china-soup-and-pasta-bowl-case/303BWREB16.html) |
| Dessert plates · 8 in | 6 pieces | $21.99 | $14.29 | [Acopa 8" Round Bright White Coupe Stoneware Plate - 6/Pack](https://www.webstaurantstore.com/acopa-8-round-bright-white-coupe-china-plate-pack/999BWCOP22.html) |
| Water glasses · 12 oz | 12 pieces | $18.49 | $12.02 | [Acopa Straight Up 12 oz. Rocks / Double Old Fashioned Glass - 12/Case](https://www.webstaurantstore.com/acopa-12-oz-double-rocks-old-fashioned-glass-case/5535611R.html) |
| Highball glasses · 12 oz | 12 pieces | $25.99 | $16.89 | [Acopa Radiance 12 oz. Highball Glass - 12/Case](https://www.webstaurantstore.com/acopa-radiance-12-oz-high-ball-glass-case/5539012HB.html) |
| Coffee cups + saucers · 7 oz | 36 sets | $79.48 | $51.66 | [Acopa 7 oz. Bright White Stackable Stoneware Cup - 36/Case ($40.49) + Acopa 6" Saucer - 36/Case ($38.99)](https://www.webstaurantstore.com/acopa-7-oz-bright-white-rolled-edge-stackable-china-cup-case/303BWRESTKC7.html) |
| Water pitcher · 60 oz | 1 piece | $3.49 | $2.27 | [Choice 60 oz. Clear SAN Plastic Beverage Pitcher](https://www.webstaurantstore.com/choice-60-oz-clear-san-plastic-beverage-pitcher/999SAN60CLR.html) |
| Salt & pepper shakers | 4 shakers | $7.69 | $5.00 | [TableCraft 163S&P 1.5 oz. Glass Salt and Pepper Shaker - 4/Pack](https://www.webstaurantstore.com/tablecraft-163sp-1-5-oz-nostalgia-glass-salt-and-pepper-shaker-with-stainless-steel-top-case/808163SP6DZ.html) |
| Napkin dispenser | 1 piece | $4.99 | $3.24 | [Choice Stainless Steel Low-Fold Napkin Dispenser](https://www.webstaurantstore.com/choice-stainless-steel-low-fold-napkin-dispenser/176NDLSS.html) |
| Menu / card holder · 8 in | 1 piece | $1.69 | $1.10 | [Choice 8" Chrome Menu / Card Holder](https://www.webstaurantstore.com/choice-8-chrome-menu-card-holder/176CH8RB.html) |

**Parcel & Takeaway Supplies** (Packaging)

| Line | Pack | Retail | Game price | Source product |
| --- | --- | --- | --- | --- |
| Microwavable containers + lids · 32 oz | 150 pieces | $27.99 | $18.19 | [Choice 32 oz. Black Round Microwavable Container with Lid - 150/Case](https://www.webstaurantstore.com/choice-32-oz-black-7-1-4-round-microwavable-heavyweight-container-with-lid-case/129MCR32B.html) |
| Foil containers + lids · 2¼ lb | 250 pieces | $66.99 | $43.54 | [Choice 2.25 lb. Oblong Foil Take-Out Container with Board Lid - 250/Case](https://www.webstaurantstore.com/choice-2-25-lb-oblong-take-out-container-with-board-lid-case/612LOB225LBC.html) |
| 3-compartment meal trays + lids | 150 pieces | $61.49 | $39.97 | [Choice 36 oz. Black 3-Compartment Rectangular Microwavable Container with Lid - 150/Case](https://www.webstaurantstore.com/choice-32-oz-black-9-3-4-x-7-1-4-x-2-3-compartment-rectangular-microwavable-heavy-weight-container-with-lid-case/129MCS323CB.html) |
| Kraft take-out boxes · #8 | 300 pieces | $43.49 | $28.27 | [Choice Kraft Microwavable Folded Paper #8 Take-Out Container - 300/Case](https://www.webstaurantstore.com/choice-6-x-4-5-8-x-2-1-2-kraft-microwavable-folded-paper-8-take-out-container-case/795PTOKFT8.html) |
| Burger clamshells · 4 in | 500 pieces | $52.49 | $34.12 | [4" x 4" x 3" White Paper Clamshell Take-Out Container - 500/Case](https://www.webstaurantstore.com/4-x-4-x-3-white-paper-clamshell-take-out-container-case/1509080.html) |
| Deli wrap paper · 12×12 | 1000 sheets | $20.49 | $13.32 | [Choice 12" x 12" White Basket Liner / Deli Wrap - 1,000/Pack](https://www.webstaurantstore.com/choice-12-x-12-white-basket-liner-deli-wrap-pack/9993003536WH.html) |
| Kraft deli sheets · 12×12 | 1000 sheets | $22.99 | $14.94 | [Choice 12" x 12" Natural Kraft Basket Liner / Deli Wrap - 1,000/Pack](https://www.webstaurantstore.com/choice-12-x-12-natural-kraft-basket-liner-deli-wrap-case/1503003536.html) |
| Kraft paper bags with handles | 250 bags | $46.49 | $30.22 | [Choice 10" x 6 3/4" x 12" Natural Kraft Paper Shopping Bag with Handles - 250/Case](https://www.webstaurantstore.com/choice-10-x-6-3-4-x-12-natural-kraft-paper-shopping-bag-with-handles-case/433BR10712C.html) |
| Plastic carry-out bags | 1000 bags | $26.49 | $17.22 | [Choice 1/6 Standard Size White "Thank You" Medium-Duty Plastic T-Shirt Bag - 1,000/Case](https://www.webstaurantstore.com/1-6-size-59-mil-white-thank-you-plastic-t-shirt-bag-case/433NHT101H.html) |
| Tissue cubes · 90 sheets | 36 boxes | $30.99 | $20.14 | [Choice 90 Sheet 2-Ply Facial Tissue Cube - 36/Case](https://www.webstaurantstore.com/choice-2-ply-facial-tissue-cube-case/5002FCCUBE.html) |
| Paper napkins · 1-ply | 4000 napkins | $13.99 | $9.09 | [Choice 1-Ply White Beverage / Cocktail Napkin - 4,000/Case](https://www.webstaurantstore.com/choice-1-ply-white-beverage-cocktail-napkin-case/5001BNAP.html) |
| Moist towelettes | 1000 wipes | $18.49 | $12.02 | [4" x 6" Lemon Scented Moist Towelette / Wet Nap - 1,000/Case](https://www.webstaurantstore.com/4-x-6-lemon-scented-moist-towelette-wet-nap-case/433WETEC.html) |
| Wrapped cutlery kits | 250 kits | $14.49 | $9.42 | [Choice Medium Weight White Wrapped Plastic Cutlery Set with Napkin - 250/Case](https://www.webstaurantstore.com/choice-individually-wrapped-medium-weight-white-plastic-cutlery-set-with-napkin-case/346WKFSNM.html) |
| Wrapped toothpicks | 1000 pieces | $7.69 | $5.00 | [Choice 2 1/2" Plain Plastic Wrapped Round Toothpicks - 1,000/Box](https://www.webstaurantstore.com/choice-2-1-2-plain-plastic-wrapped-round-toothpicks-in-dispenser-box-box/500WWTPPLAS.html) |
| Tamper-evident labels | 250 labels | $7.89 | $5.13 | [Choice TamperSafe 3" x 1" White Paper Tamper-Evident Label - 250/Roll](https://www.webstaurantstore.com/tampersafe-1-x-3-white-paper-tamper-evident-label-roll/322TE1X3WPA.html) |

## Transactions and accounting

- **Purchase** (`BusinessSuppliesManager.purchaseSupply`, Market only).
  - It validates the item, a whole pack count from 1 to 99, and funds
    (`debitWallet`) before anything changes.
  - A failure changes nothing: no wallet, stock, finance or ledger change.
  - There is no storage limit (supplies aren't food).
  - `App.purchaseSupply` writes exactly ONE ledger entry and the matching
    P&L record, then persists once.
- **Smallwares and tableware**: ledger `supply-equipment-purchase`.
  - Durable equipment, i.e. capital (`capitalExpenditure`, like the
    refrigerator).
  - Never an operating expense, never used up.
- **Packaging**: ledger `supply-packaging-purchase`.
  - A stock asset with its own accumulator/lifetime line,
    `packagingPurchaseCost`. It is kept separate so ingredient purchasing
    analytics stay food-only.
  - Each successfully served Business order uses one container (32 oz
    microwavable → kraft box → foil → 3-compartment → burger clamshell,
    first in stock) and one carry bag (kraft paper → plastic). This
    happens in `serveBusinessOrder`, after the ingredients.
  - Their cost-basis share is added to that order's COGS.
  - With none in stock the order uses none. Packaging never blocks or
    delays a serve.
- Daily P&L:
  - packaging bought is in the cash-flow view, not the P&L;
  - equipment is capital;
  - packaging used is in COGS;
  - Opening cash + signed ledger = closing cash still holds.

## UI

- **Market**: three category tabs next to the existing six (Smallwares ·
  Tableware · Takeaway). Each has group filter chips (48 px) and
  two-column cards (`MarketSupplies.tsx`). A card shows:
  - pack price and retail price;
  - "N owned" (equipment) or "N left" (packaging);
  - a pack stepper (48 px);
  - "Buy · $X";
  - the wallet line "$A → $B" or "Not enough money — need $X more.".
- **Business → Supplies** (`BusinessSupplies.tsx`, route
  `business-supplies`), monitoring only, with no purchase controls:
  - a section switcher;
  - on hand, stock value (cost basis), spent, and saved vs retail
    (all time); plus used by orders for packaging;
  - a low-packaging alert (below today's customer target);
  - a filtered stock list;
  - "Restock … in the Market →" (`openMarketSupplies` → `shop-supplies`).

## Gates

- `scripts/business-supplies-qa.mts` (A–H):
  - catalog;
  - purchase and ledger;
  - atomic failures;
  - packaging use;
  - finance;
  - savings never money;
  - saves and migration, including the real `SaveManager.load`;
  - Campaign independence and wiring.
- `tools/e2e/supplies.mjs`:
  - 375×642 viewport;
  - sections and counts;
  - exact wallet and one ledger entry per purchase;
  - Business shows the saved stock;
  - reload persistence;
  - insufficient funds;
  - no horizontal scroll;
  - no console errors.
- `business-ux-qa` V2 and `inventory-market-qa` 16c pin the exact Business
  field list. They now list `supplies` as the one reviewed addition; any
  other new field still fails them.
- The full QA sweep, typecheck, lint, build and preflight run as for any
  change.
