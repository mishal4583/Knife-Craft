# One Restaurant — Campaign and Business as a single mode

Status: **PROPOSAL, not approved.** Written 2026-10-04. Supersedes
`docs/CAMPAIGN_KITCHEN_PLAN.md` (whose findings, gates and safety net carry
over; section 13 lists what changed).

The developer's direction:

> "Combine the business mode and campaign together, there should only be a
> single mode, and after these 250 levels let there only be endless mode and
> it also should have this business. After 250 levels let the restaurant be
> top tier and the player goal should be handling the prep and along with it
> manage the business, and from the menu let the player get random orders."

---

## 1. The idea in one paragraph

There is **one restaurant and one mode**. You are its head chef. Each level is
a **service** (lunch or dinner): its **featured tickets** are the dishes the
level teaches, and you cut them yourself to clear the level. Around them, your
restaurant takes **orders from its menu**, at random, and your stock, fridge,
staff, prices and reputation decide how many you can serve and what you earn.
Every dish you learn joins your menu. The 250 levels teach both the knife and
the business, one system per chapter. After Level 250 the restaurant is
top-tier and the game becomes **The Grand Restaurant**: endless service days,
random orders from your full menu, and the business to run.

---

## 2. Before and after

| | Today | One Restaurant |
|---|---|---|
| Modes | Campaign, Business Mode, Endless Service, Today's Special | **One**: the restaurant. Levels 1–250, then The Grand Restaurant |
| A level | 1–3 orders you cut; pay = a fixed amount minus an abstract food cost | A service: the featured tickets you cut, plus menu orders from your restaurant |
| Food | Campaign uses none; Business uses real stock | Real stock everywhere (Market → fridge → ages → used) |
| Prices | Campaign pays ~$45 for a tomato dish; Business sells it for ~$4 | **One price list**: every order earns its menu price |
| Staff | Kitchen helpers (campaign) and waged staff (Business), unrelated | **One brigade**, hired over the levels, each with a visible job in service |
| Day | Business days only | Every 2 levels (lunch + dinner) is one restaurant day, with an automatic day-end report |
| After L250 | Endless loops the Service levels, $600/day cap | The Grand Restaurant: endless random orders from your menu, full business |
| Bottom bar | Kitchen · Market · Inventory · Business · Progress | Kitchen · Market · Inventory · **Restaurant** · Progress |

---

## 3. One service, step by step

1. **Open service** (Order Board → Prepare). A Prep Check sheet (as in the
   earlier plan) shows tonight's featured tickets, the expected guests and
   whether your stock, tools, plates and packaging cover them. One tap buys
   what's missing in the Market; a free emergency crate guarantees nobody is
   stuck.
2. **Featured tickets** (required). The level's own recipes, exactly as
   designed today, with coaching on the first play. You cut them; quality
   decides the tip and stars. Clearing them clears the level.
3. **Menu orders** (optional, from Chapter 3). While the service is open,
   orders arrive from your **active menu**, at random, weighted by popularity,
   price and the time of day. On each order you choose:
   - **Cook it yourself.** You play the dish (it's a recipe you already know).
     Best quality, best tip.
   - **Send it to the brigade** (once you have staff). Your Prep Cook / Line
     Cook makes it at their quality, from your stock, while you move on.
   - **Pass** (the guest leaves; a small popularity cost).
   A service never forces menu orders on you, so a level stays a 1–3 minute
   session when you want it short.
4. **Close service.** The report: tickets, menu orders, revenue, food cost
   from your stock, tips, wages for the shift, stock left, what spoils soon.
5. **End of day** (after the dinner level). The existing End Business Day runs
   on its own: spoilage, payroll, popularity, inspections when they apply, the
   day's P&L. One summary card, never a blocking screen.

A replay of a cleared level is **free practice**: no stock, no money, no day
passes, so the mastery loop stays as it is.

---

## 4. The menu

- **Learning a dish adds it to your menu.** Business dishes are already built
  from campaign recipes (`businessDishCatalog.ts`, `sourceRecipeId`), so the
  menu grows out of the levels with no second recipe system.
- Today there are 48 sellable dishes; the plan grows the catalog chapter by
  chapter until most of the 221 recipes that make a real plate are sellable
  (each with a culinary name, category and portion, priced from its real
  ingredients at a 30% food cost, the existing rule).
- You switch dishes on and off and set prices (the existing Business → Menu).
  A small menu is easy to stock; a big menu draws more guests but ties up the
  fridge and spoils more. That trade-off is the business game.
- **Chef's Special** replaces Today's Special: one dish a day (the same for
  everyone) that draws extra orders and pays a $50 bonus once a day.

---

## 5. What you learn, chapter by chapter

The earlier plan's curriculum is kept and the business systems are threaded
through it. One new thing per chapter, with a story beat and a coaching card.

| Chapter (levels) | New in the restaurant | Required? |
|---|---|---|
| 1 (1–10) | Grandma's pantry is stocked; knife and board owned. Stock goes down as you cook. L10: first Market trip. | Nothing |
| 2 (11–20) | Buy ingredients; freshness and FIFO (L13); **your first menu** (the dishes you've learned) and prices | Ingredients for the level |
| 3 (21–30) | **Menu orders** begin (2–3 per service); kitchen tools by dish type (L21); takeaway (L25) | Tools, packaging |
| 4 (31–40) | Place settings for dine-in guests; **day-end report** explained | Plates and cutlery for the guests |
| 5 (41–50) | **First hire**: a Prep Cook who can take menu orders (and buys stock 10% cheaper); bread knife (L49) | Bread Knife at L49 |
| 6 (51–60) | Suppliers and contracts; supplier events | — |
| 7 (61–70) | Popularity and reviews: good service brings more guests | — |
| 8 (71–80) | Server (more guests, better tips), Line Cook | — |
| 9–10 (81–100) | Equipment wear and maintenance; the Commercial fridge for the biggest services (L95); the L100 banquet | Commercial fridge at L95 |
| 11 (101–110) | Raw meat and fish; the health inspector; Cleaner; Butcher Block (L106), Seafood Slate (L109) | The two boards on their levels |
| 12–20 (111–200) | Bigger services, events (catering, theme nights), Head Chef, Manager, contracts at scale | Soft only |
| 21–25 (201–250) | Running a top restaurant; the Family Legacy banquet (L250) | Professional fridge at L250 |

Hard gates stay the five from the earlier plan, each a real kitchen rule,
each unlocked earlier and announced 5 levels ahead.

---

## 6. The brigade (staff with a real job)

Today Business staff give small percentage effects and cost more than they
earn (open decision #6), while the campaign's Kitchen helpers are one-time
buys. In one restaurant they become **one brigade**, hired over the levels,
paid per day, and each one *does something you can see in service*:

| Role | In service |
|---|---|
| Prep Cook | Takes menu orders you send (simple dishes), from your stock; buys stock 10% cheaper |
| Line Cook | Takes harder menu orders; more orders per service |
| Server | More guests per service; tips |
| Cleaner | Kitchen always passes inspection; less spoilage |
| Head Chef | Raises the brigade's quality; reputation |
| Manager | Lower payroll; runs the day-end paperwork |

The three Kitchen helpers (Prep Assistant, Quality Chef, Kitchen Assistant)
become the first upgrades of this brigade (owners keep their bonus). Staff now
earn their wages because they let you serve more orders, which settles
decision #6.

---

## 7. Money: one price list

Joining the modes forces one rule: **every order earns its menu price**. A
featured ticket and a menu order for the same dish must pay the same, or
players notice at once.

What that means, measured:

- Menu prices at a 30% food cost: dishes cost $1.80–13.56 in ingredients
  (median $4.60), so they sell for ~$6–45 (median ~$15) per plate.
- Today the campaign pays ~$215k over 250 levels (orders + level rewards),
  plus $38k milestones and $50k at L250. Featured tickets alone at menu prices
  would earn ~$20–25k. The rest has to come from **running the restaurant**:
  menu orders served by you and the brigade, growing with your menu, staff,
  popularity and kitchen tier, which is what a real restaurant's income is.
- Level rewards become **reviews and reputation**: smaller, quality-based
  payouts per level; milestones and the $50k Family Legacy stay.
- The $135k kitchen tiers, knives, boards, fridges and staff stay the big
  costs, so money keeps meaning something.

Targets the simulation must prove before release (Normal, Completionist,
Aggressive Spender, Casual "featured tickets only" and Saver profiles):

| Target | Value |
|---|---|
| Final wealth at L250 (Normal / Completionist) | $100–150k, as today |
| Casual player (cuts only featured tickets, never hires) | can still afford every hard gate, ending lower (≥ $40k) |
| Cash never below the next level's stock | every level, every profile; emergency crate < 5 uses for Aggressive, 0 for Normal |
| A staffed restaurant | earns more per day than an unstaffed one from Chapter 6 on |
| Food cost on the report | 25–35%, like a real restaurant |
| Ledger | reconciles every step, no negative cash |

This replaces Economy V2 / V2.5's frozen numbers: one approved rebalance
("Economy V4"), re-locked by new suites.

---

## 8. After Level 250: The Grand Restaurant

The restaurant reaches its top tier (a new **Legacy** tier after Grand
Kitchen, cosmetic dining-room and plating upgrades). The game becomes
open-ended service days:

- **Random orders from your whole menu**, weighted by popularity, price, the
  day of the week and the season. No fixed levels.
- **Goals that keep players coming back** (no timer, no fail state, never
  a loss of progress):
  - a **star rating** (1–5), earned from quality, service and inspections,
    with a weekly critic's visit;
  - **events**: weddings and banquets (big prep, big fridge), food festivals,
    a theme night every week, with their own rewards;
  - **seasonal menus**: dishes rotate in and out with the season's produce
    and prices;
  - **weekly challenges** ("serve 30 fish dishes", "zero waste week");
  - a **restaurant value** score (assets + reputation) as the long-term
    number, and a leaderboard if Playgama's is enabled later.
- **Money stays real**: the $600/day Endless cap goes (income is limited by
  your restaurant, not by a cap), with real costs to match: wages, stock,
  maintenance, events, Legacy upgrades.
- Today's Endless loop of Service levels is retired (its levels live on as
  the restaurant's menu dishes).

---

## 9. Rules that keep it fun for millions

1. **The first minute is cutting.** Levels 1–10 have no management at all.
2. **One tap before cooking** in the common case; never a wall.
3. **Never stuck**: free emergency crate (goods, no money), the borrowed-item
   fallback, no debt, no fail state.
4. **Short sessions**: menu orders are optional; a service can be the
   featured tickets only.
5. **Every number is real** (lb, packs, wages per hour, menu prices) and every
   report explains itself in one line.
6. **Introduce one system per chapter**, never two at once.
7. **Old saves lose nothing** (section 10).

---

## 10. Existing players and saves

Nothing new in the save: the restaurant is the existing `SaveData.business`
(inventory, supplies, fridge, staff, menu, finance, calendar) plus the
campaign's `levelProgress`. The wallet and ledger stay the ones.

- A player mid-campaign keeps every level, item and dollar. Systems from
  chapters behind them switch on with a one-time "Welcome to your restaurant"
  crate (stock for 3 levels, the tools, plates and packaging their chapter
  needs), goods only.
- A player who already ran Business days keeps their stock, staff, menu,
  prices, contracts and history; they are now simply their restaurant's.
- A player past L250 lands in The Grand Restaurant with their Endless
  progress converted to stars.

---

## 11. How it fits the code (no second system)

| Piece | Becomes |
|---|---|
| `CustomerOrderManager`, `ServiceManager` (campaign sessions) | The featured tickets of a service |
| `BusinessServiceManager` (Business orders, demand, popularity) | The menu orders of a service and The Grand Restaurant |
| `BusinessDayManager.endBusinessDay` | The day end after every dinner level |
| `businessDishCatalog` + `businessMenu` | Your menu, growing with the levels |
| `EconomySettlement` | Replaced for campaign orders by the menu price + real stock cost (the V4 rebalance) |
| `EndlessServiceManager` | Retired; The Grand Restaurant runs on the Business engine |
| `DailyOrderManager` | Chef's Special |
| Business tab | **Restaurant** tab: the back office (performance, staff, menu, suppliers, equipment) |
| `business-service` screen | Merged into the service screen |

New, small, pure modules: `restaurant/service.ts` (a level as a service:
featured + menu orders), `restaurant/levelNeeds.ts`, `restaurant/prepCheck.ts`,
`restaurant/brigade.ts` (who can take which order), `restaurant/equipmentGates.ts`,
`restaurant/emergencyCrate.ts`, `restaurant/grandRestaurant.ts` (post-250
goals). CLAUDE.md §7 ("Campaign must never require any Business system",
Economy V2 frozen, V2.5 caps) is rewritten once the developer approves; the
suites that guard the old rules are rewritten on purpose, never deleted.

---

## 12. Rollout, effort and risk

This is the largest change since the game was built: it touches the economy,
both order engines, the menu, staff, navigation and most of the 61 QA suites.
Each step ships a playable game and is approved and merged on its own.

| Step | Content | Size |
|---|---|---|
| 0 | Decisions (section 14) + the V4 simulation on paper (money targets, section 7) | small |
| 1 | One price list behind a switch: featured tickets pay menu price + tips; level rewards re-curved; the V4 suites | large |
| 2 | Real stock in levels: Prep Check, Ch 1 pantry, FIFO, the day = 2 levels, emergency crate, replays free | large |
| 3 | Menu orders in services (cook / send / pass), the menu growing with levels, Chef's Special | large |
| 4 | Brigade (staff take orders), tools, takeaway, place settings | medium |
| 5 | Hard gates with notices; Restaurant tab replaces Business; migration crate | medium |
| 6 | The Grand Restaurant (stars, events, seasons, weekly challenges, Legacy tier); Endless retired | large |
| 7 | Story beats, coaching cards, tuning from Playgama data | medium |

Biggest risks and the answer to each:

- **Too much for casual players** → Levels 1–10 untouched, one system per
  chapter, everything optional except the five gates.
- **Economy breaks** → nothing ships without the five-profile simulation
  passing section 7's targets.
- **Long sessions** → menu orders optional; a service can be 1 minute.
- **Old saves** → section 10, tested on real save files from every era.
- **A long time without a release** → the steps are ordered so the game can
  ship after step 2, 3 or 5 if needed (the current release plan: a QA build
  only after the current batch).

---

## 13. What changed from the Campaign Kitchen plan

- Business Mode is no longer a separate mode: it is the restaurant around
  every level.
- Money: Option B (one price list) is now required, not optional, because
  featured tickets and menu orders must pay the same for the same dish.
- Staff become the brigade that serves menu orders (this settles decision #6).
- Smallwares and tableware get their effect through tools and place settings
  (decision #7).
- After L250: The Grand Restaurant replaces Endless Service.
- Unchanged: the Prep Check, the Ch 1 pantry, the five hard gates, the
  emergency crate, replays as free practice, the day = lunch + dinner.

---

## 14. Decisions needed

1. **Go ahead** with one mode (this retires Business Mode and Endless Service
   as separate modes)?
2. **One price list** (menu prices + tips, level rewards become reviews) and
   the money targets in section 7?
3. **Menu orders**: optional in every service (recommended), from Chapter 3?
4. **Brigade**: staff take menu orders; the Kitchen helpers fold into it
   (owners keep their bonus)?
5. **The five hard gates** (Bread Knife L49, Commercial fridge L95, Butcher
   Block L106, Seafood Slate L109, Professional fridge L250)?
6. **After L250**: stars, events, seasonal menus, weekly challenges, the
   Legacy tier; the $600/day cap removed?
7. **Chef's Special** replaces Today's Special?
8. **Order of work**: pause the current batch (#6, #7, #10 and #14 are
   absorbed or reshaped by this plan; #16–20 Level 1–10 fixes, #24–25 and
   the QA build still apply) and start with step 0?
