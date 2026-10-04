# Economy TODO — for the economy pass after the Unified Restaurant

Spec §48: every new economic interaction the restaurant integration creates
is listed here and **not balanced now**. Prices, rewards, wages and formulas
stay as they are until the separate economy simulation.

Status key: OPEN (not yet built), BUILT (exists, not balanced).

| # | Interaction | Status | Why it needs the economy pass |
|---|---|---|---|
| P0 | **Remove double food-cost charging** after the unified restaurant system is implemented. The campaign settlement still deducts its built-in COGS (~$34.6k over 250 levels) while the player also buys real stock (~$2.2k at Market prices). Developer decision 2026-10-04: keep both in this phase, no hidden rewards or refunds. Target for the pass: level revenue → real ingredient consumption → supplies → actual profit. | OPEN | Formulas must not change in this phase. |
| 1 | Campaign ingredient consumption | BUILT (phases 3–4, behind the switch) | Real stock costs are tiny next to campaign pay (a ~$1 tomato in a ~$45 order). |
| 2 | Napkins / tissues per order | OPEN | Cost per order, pack sizes. |
| 3 | Dishwashing liquid (new line, retail × 0.65) | OPEN | New item; usage rate per dine-in service. |
| 4 | Cleaning supplies (new line, retail × 0.65) | OPEN | New item; usage and effect. |
| 5 | Tableware breakage / replacement | OPEN | Reusable today; any loss rate is a cost. |
| 6 | Takeaway packaging in campaign orders | OPEN | Same packs as Business; share of takeaway orders. |
| 7 | Staff wages during the campaign | OPEN | Waged staff currently cost more than they earn. |
| 8 | Two staff systems (one-time helpers vs waged roles) | OPEN | Which one survives, and its value. |
| 9 | Two supplier systems (campaign COGS ±10% vs Business contracts/events) | OPEN | One supplier effect. |
| 10 | Fridge upgrades as campaign needs | OPEN | $2,000 / $4,800 against a buy-everything player's $10–31 around L20–50. |
| 11 | Equipment condition and maintenance in the campaign | OPEN | Recurring cost. |
| 12 | Waste / spoilage in the campaign | OPEN | Lost stock value. |
| 13 | Menu orders inside campaign levels (menu prices) next to level settlements | OPEN | Two price models in one service. |
| 14 | Endless revenue through the Business engine (menu prices) instead of level rewards with a $600/day cap | OPEN | Endless income changes completely. |
| 15 | Random orders and demand (customers per day) | OPEN | Volume drives all of the above. |
| 16 | Starter supplies for existing saves (goods, no money) | OPEN | Their value. |
| 17 | **Grandma's pantry** (Pre-Service Check safety net): only when the wallet can't cover the missing stock, the exact missing quantities at cost 0, opt-in, no ledger | BUILT (phase 4) | Free food is value; how often it may be used. |
| 19 | **Closing time** before L91 moves no money; from L91 it is End Business Day (payroll, fines, P&L) | BUILT (phase 5) | When daily costs start in the career. |
| 20 | Menu prices of the newly unlocked early dishes (the existing 30% food-cost rule) | BUILT | Early menu income once menu orders pay (phase D). |
| 21 | Bulk discounts (1–9 / 10–49 / 50–99 / 100+) | OPEN | Percentages are configurable, not set. |
| 18 | Market buys whole units; a recipe may need 0.025 lb of garlic, so a service buys 1 lb and keeps the rest | BUILT | Leftover value and spoilage of part-used units. |

Questions the pass must answer (spec §48): can a player afford required
items; can they go into debt (never); money left after L250; Endless
profitability; staff cost; supply prices; expansion cost; random order
earnings; a completionist's final wealth.
