# Economy TODO — for the economy pass after the Unified Restaurant

Spec §48: every new economic interaction the restaurant integration creates
is listed here and **not balanced now**. Prices, rewards, wages and formulas
stay as they are until the separate economy simulation.

Status key: OPEN (not yet built), BUILT (exists, not balanced).

| # | Interaction | Status | Why it needs the economy pass |
|---|---|---|---|
| P0 | **Double food-cost charging — FIXED in the economy pass (restaurant build).** A campaign order pays recipe earnings + quality bonus; the built-in food cost isn't deducted, because the real stock was bought in the Market (`restaurant/restaurantEconomy.ts`, App's two serve paths, result screen "Ingredients · from your stock"). The release build's settlement and the frozen V2 baseline are unchanged. A completionist who buys everything ends L250 with **$128,063** (was $94,393 with the double charge; approved target $100k–$150k). Item food-cost savings now act on real stock (row 26). | BUILT | `restaurant-economy-pass-qa`. |
| 1 | Campaign ingredient consumption | BUILT (phases 3–4, behind the switch) | Real stock costs are tiny next to campaign pay (a ~$1 tomato in a ~$45 order). |
| 2 | Napkins per order (1 per dine-in or takeaway order, from L31) | BUILT (phase G) | Cost per order, pack sizes; no P&L line in the campaign. |
| 3 | Dish soap (new line: $50.99 / 4 gal retail × 0.65; 5% of a gallon per wash-up) | BUILT (phase G) | Usage rate; price read from the store's search listing — re-check the product page. |
| 4 | Cleaning liquid (new line: $51.49 / 4 gal retail × 0.65; 10% per closing) | BUILT (phase G) | Usage rate and effect (none yet beyond the warning; inspections later?). |
| 5 | Tableware: reusable place settings (plate + fork + knife) with washing; no breakage | BUILT (phase G) | Any loss rate is a cost. Grandma's spare settings (cost 0) when the wallet can't cover them. |
| 6 | Takeaway packaging in campaign orders (~30% of orders from L71: container + bag) | BUILT (phase G) | Same packs as Business; takeaway share. |
| 7 | Staff wages during the campaign — staff are now REQUIRED as the restaurant grows (Prep Cook L41, Server L46, Line Cook L61, Cleaner L91, Head Chef L121, Manager L161, by service size; `restaurant/staffRequirements.ts`). Hiring is free; wages are paid only at closing from L91 (End Business Day), so L41–90 staff cost nothing | BUILT (behind the switch) | Waged staff cost more than they earn; free staff before L91 is a gap. |
| 8 | Two staff systems (one-time helpers vs waged roles) | OPEN | Which one survives, and its value. |
| 9 | Two supplier systems (campaign COGS ±10% vs Business contracts/events) | BUILT (restaurant build: the ingredient supplier's ±10% sets Market ingredient prices, row 26; chosen on Restaurant → Suppliers, phase 7). **Premium kept** (developer 2026-10-06): +10% price, stock stays fresh **+1 day** and orders get a **+2% quality bonus** (`restaurantEconomy.SUPPLIER_EFFECTS`, PROVISIONAL) | Exact Premium percentages in the final economy pass; Wholesale stays cheapest, Local the baseline. Contracts/events still stack on top. |
| 10 | Fridge upgrades as campaign needs — **final pass: whole-day stocking** (`preServiceCheck.dayStockFor`) fills the bigger fridges (completionist peak 21.5/40 at L50, 61/140 at L91, 101/140 at L250); service-by-service stocking still fits the Basic | BUILT | $2,000 / $4,800 against a buy-everything player's $10–31 around L20–50. |
| 11 | Equipment condition and maintenance in the campaign | OPEN | Recurring cost. |
| 12 | Waste / spoilage in the campaign | OPEN | Lost stock value. |
| 13 | Menu orders inside campaign levels (menu prices) next to level settlements — menu guests pay `businessCustomerPayment` (menu price × popularity), up to 1–5 per service | BUILT (phase D) | Two price models in one service. |
| 14 | Endless Restaurant (after L250): the Business engine with demand scaled by what the player built (`restaurant/endlessDemand.ts`, row 27); the old Endless Service economy is not used | BUILT (behind the switch) | Tuned, see below. |
| 15 | Random orders and demand (customers per day) | OPEN | Volume drives all of the above. |
| 16 | Starter crate for existing saves (phase M): the next 3 services' ingredients, place settings, 100 napkins, a bottle of soap and of cleaning liquid, takeaway packaging — goods at cost 0, once | BUILT (behind the switch) | Their value; ingredients at cost 0 lower the average unit cost. |
| 17 | **Grandma's pantry** (Pre-Service Check safety net): only when the wallet can't cover the missing stock, the exact missing quantities at cost 0, opt-in, no ledger | BUILT (phase 4) | Free food is value; how often it may be used. |
| 19 | **Closing time** before L91 moves no money; from L91 it is End Business Day (payroll, fines, P&L) | BUILT (phase 5) | When daily costs start in the career. |
| 20 | Menu prices of the newly unlocked early dishes (the existing 30% food-cost rule) | BUILT | Early menu income once menu orders pay (phase D). |
| 21 | Bulk discounts — presets 5/25/50/100, PROVISIONAL tiers 3 % from 25, 5 % from 50, 8 % from 100 (`restaurant/bulkBuying.ts`), ingredients and consumable supplies, up to 100 supply packs | BUILT (behind the switch) | The real tiers; how they interact with contracts and the Prep Cook discount. |
| 22 | Specialist chefs (Indian 51, Mediterranean 71, Mexican 81, Asian 101): free to hire, daily wage = the Line Cook's existing figure, paid at closing from L91 (one `business-staff-salary` entry each; laid off if unaffordable) | BUILT (behind the switch) | Their wage, and whether they earn their keep. |
| 23 | Menu revenue now starts at L11 (the menu opens there; menu guests from L11 instead of L6) | BUILT (behind the switch) | Early menu income next to level pay. |
| 24 | Grandma's spares (place settings / packaging at cost 0 when the wallet can't cover what blocks a service) | BUILT (phase G) | Free goods, like the pantry (#17). |
| 25 | Dish soap low at ≤ 8 washes, cleaning liquid at ≤ 3 closings (warnings only) | BUILT | Usage rates and thresholds. |
| 26 | **Item effects on real stock** (developer 2026-10-05). Values UNCHANGED, now acting on real ingredients (`restaurant/restaurantEconomy.ts`): knife + board specialisation 3–4 % less stock per matching category (`MAX_TOTAL_COGS_REDUCTION` 8 %; their quality boosts up to 3 % stay quality bonus); Prep Assistant 3 %, Kitchen Assistant 4 % less stock (`MAX_STAFF` 6 %; Quality Chef +1 % quality bonus stays); a dull knife up to +5 % stock (`MAX_SHARPNESS_PENALTY`; a serve never blocks while the un-dulled amount is in stock); Campaign Supplier Wholesale −10 % / Premium +10 % on Market ingredient prices (`supplierPriceFactor`, the purchase charges exactly the card's quote). Completionist $129,324 → $128,063. | BUILT (behind the switch) | Exact percentages in a later tuning pass (developer: "do not rebalance yet"). `restaurant-economy-pass-qa` X1–X5. |
| 27 | **Endless Restaurant demand** (developer: "Scale demand"). Customers/day = min(DEMAND, CAPACITY): DEMAND = classic 8 × popularity (0.5–1.5) × (1 + cookable dishes ÷ 8), a specialist-cuisine dish counting only while its chef is hired; CAPACITY = chef 10 + Prep Cook 10, Line Cook 13, Head Chef 10, Server 13, Cleaner 3, Manager 5 + 6 per specialist (`ENDLESS_DEMAND_RULES`). Costs untouched (real ingredients at Market prices, packaging, wages incl. specialists — now paid at End Business Day — fines, maintenance). Only saves stamped by the restaurant migration; classic Business demand unchanged. | BUILT (behind the switch) | Five restaurants, 30 days each from the L250 completionist save (`restaurant-endless-qa`): minimum viable **$78/day**, medium **$135**, full menu + thin staff **$276**, fully staffed **$452** (target $300–$600), overstaffed with a 6-dish menu **−$262**. Wages themselves are not rebalanced. |
| 28 | **Endless Restaurant events** (`restaurant/restaurantEvents.ts`, CONNECTED 2026-10-06, restaurant build, Endless days only): Dinner Rush 20 % of days × 1.3 demand, Large Group 15 % of days +6 guests (capacity still caps both), Today's Special every day — a featured cookable dish weighted 25 % in the order pool (~17 % of orders after the order generator's variety rule), its bonus = the existing once-a-day $50 through the daily claim, never a second one — all PROVISIONAL | BUILT (connected) | 30 days from the L250 completionist (`restaurant-endless-qa`, one Business Day per calendar day = the most bonuses): minimum $132/day (was $78), medium $209 ($135), thin staff $344 ($276), fully staffed **$519** ($452; target $300–$600 still met), overstaffed −$189 (−$262). $50/day of each is the Today's Special bonus; the minimum restaurant is near the "< $150" line. Tune the bonus/event values in the economy pass. |
| 29 | **Endless stars** (`restaurant/restaurantStanding.ts`, CONNECTED): up to 3 a day — PROFITABLE (profit > 0 incl. specialist wages), BUSY (the day's customer target served), CLEAN (inspection passed, with orders); lifetime in `business.endlessStars`, per day on the history record; status only, never money | BUILT (connected) | Stars are easy for a small restaurant: the minimum viable one earned 88 / 90 in 30 days (its capacity-capped target of 10 is easy to serve), the fully staffed one 89, the overstaffed one 60. Whether BUSY should measure the demand instead of the capped target is a design call. |
| 30 | **Fridge pressure** (`restaurant-fridge-pressure-qa`, `docs/RESTAURANT_FRIDGE_PRESSURE.md`): with the current values the fridge never binds in the campaign (a diligent player stays on the Basic 40 to L250, peak 70 %); an Endless fully staffed day uses ~272 units (about twice the 140 Professional) but restocking order by order keeps the peak at 16 % | MEASURED, no change | The only natural lever is how much a player stocks at once (per service vs per day) — a gameplay/economy decision, not made here. |
| 18 | Market buys whole units; a recipe may need 0.025 lb of garlic, so a service buys 1 lb and keeps the rest | BUILT | Leftover value and spoilage of part-used units. |

Phase N simulation (`scripts/restaurant-campaign-sim-qa.mts`, report in
`docs/RESTAURANT_QA_REPORT.md`): a diligent player ends L250 with ~$272k
(wages ~$21.6k, ingredients ~$5.6k, fines ~$5.6k, menu revenue ~$11.7k from
689 guests); a player at $0 before every level still finishes on Grandma's
pantry/spares and free re-hiring (staff effectively unpaid); the Basic
fridge (40) is enough for every service.

Economy pass (2026-10-05), measured with the full restaurant simulation
(`scripts/restaurant-economy-pass-qa.mts`): P0 fixed and in band (above).
Still open, with numbers, for the developer:

- **Endless Restaurant profitability**: DONE (row 27) — was −$200/day with
  the campaign's team; now $452/day fully staffed, little or a loss for poor
  setups. Specialist chefs are paid in the Business day too.
- **Item effects under P0**: DONE (row 26) — they act on real stock and
  Market prices; percentages unchanged.
- **Staff before L91** stay free (developer: payroll starts at L91; the
  completionist stays ~$128k). Exact wages, demand and consumption are tuned
  together later.

## Final economy pass (2026-10-06) — `docs/ECONOMY_FINAL.md`

Approved target: a completionist ends L250 with **≥ $150,000** (preferred
$160k–$175k), no Endless income. Restaurant saves only (the release economy
is unchanged). Measured by `scripts/economy-final-sim.mts`, accepted by
`restaurant-final-economy-qa`:

- completionist $128,063 → **$168,348** (Wholesale $169,027, Premium
  $171,582); saver $307,353 (unchanged); gap $179k → $139k;
- kitchen tiers $135k → **$110k** with +1.5 / 3 / 4 / 5 / 7 % restaurant
  quality and +1 / +1 / +2 guest seats (rows 26 / 27 context);
- equipment quality ≤ 5 % by ownership (Blacksmith 2 %, knife roll 1 %,
  board set 1 %, helpers 0.5 % each) — the Blacksmith now returns $3.1k;
- service capacity caps menu guests (chef 2 + 1 per cook/server/Head
  Chef/specialist); staff capacity is worth 416 guests / $5.0k against $21.6k
  of campaign wages (row 7 stays open: wages pay back in Endless);
- Emergency Service: a service run on Grandma's pantry/spares earns no
  quality bonus (rows 17, 24);
- whole-day stocking (row 10);
- Today's Special 15 % of the day's revenue ≤ $50 at closing (row 28:
  minimum restaurant $132 → $112/day, the bonus 22 % of its day);
- BUSY star = the whole demand (row 29: one-chef restaurant 88 → 58 / 90).

Still open after the pass: Premium remains money-best (+$3.2k over Local —
lower its quality share to ~1 % or raise its price if it must not be);
Wholesale is worth +$679 (food is ~3 % of order pay); campaign wages are not
earned back in the campaign; bulk tiers matter mainly through whole-day
stocking.

Questions the pass must answer (spec §48): can a player afford required
items; can they go into debt (never); money left after L250; Endless
profitability; staff cost; supply prices; expansion cost; random order
earnings; a completionist's final wealth.
