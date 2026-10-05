# Campaign Kitchen — running the restaurant inside the 250 levels

Status: **SUPERSEDED by `docs/ONE_RESTAURANT_PLAN.md`** (2026-10-04, the developer
chose one combined mode). Kept for its measurements and curriculum.
Original status: proposal, not approved. Written 2026-10-04 at the developer's
request: "let the user buy necessary stocks before the levels … for the first
10 levels let the stock be purchased already while knife and cutting board are
bought. After that player has to buy ingredients, culinary, cutlery, parcel
items, upgrade refrigerators, upgrade knife, buy new cutting boards and after
certain levels make it mandatory to buy new knife and upgrade refrigerators …
the game should be very realistic … target is millions of plays."

Every number below was measured from the current code (levels, recipes,
`businessPricing.ts`, `businessSupplies.ts`, `refrigeratorDefinitions.ts`,
knife/board catalogs, `scripts/economy-v25-simulation.mts`). Nothing is built
yet. Section 12 lists the decisions needed before any code.

---

## 1. The short answer

Yes, and it can make KnifeCraft a much better game: today the campaign and
Business Mode are two separate games that share a wallet. This plan joins them
into **one restaurant**: the food you cut in a level is food you bought, it
sits in your fridge and ages, dine-in tables need plates and cutlery, takeaway
needs boxes and bags, and some levels need the right knife or board, as in a
real kitchen.

The risk is just as real. On web portals (Playgama, CrazyGames, Yandex…)
players bounce within ~30 s and play 5–15 minute sessions. A shopping errand in
front of every level would cost us those plays. So the plan is built on one
rule:

> **Cutting is the game. Running the kitchen is one tap before a level, and it
> is never a wall.**

That means: the first 10 levels need no shopping, an "everything for this
level" button that buys exactly what is missing, a free safety net so no player
can ever be stuck, hard requirements only at a few story moments announced 5
levels ahead, and every requirement affordable by a player who bought
everything else (proven by simulation before release).

---

## 2. What the game is today (measured)

| Fact | Value |
|---|---|
| Campaign | 250 levels, 25 chapters of 10, **404 orders** (6 Relax, 114 Order, 130 Service levels; 69 levels need 2+ orders, 40 are batch groups of 2–3) |
| Ingredients the whole campaign cuts | ~979 purchase units (lb / pieces) at Business portion sizes, **$2,247 at Market prices** |
| Food cost the campaign charges now | an abstract per-recipe **COGS of ~$34,600**, deducted from each order's pay; no stock is involved |
| Per chapter | 12 units ($10) in Ch 1 → 74 units ($79) in Ch 10 → ~45–70 units ($70–190) per chapter after Ch 11 |
| Biggest single level | Level 98: 14 units; Level 100: 11; most levels 1–6 |
| Shelf life | 3 days (herbs) to 12 days |
| Fridges | Basic 40 units (free) · Commercial 80 ($2,000) · Professional 140 ($4,800) |
| Knives (unlock / price) | Chef L1 free · Santoku L10 $350 · Paring L15 $500 · Nakiri L25 $700 · Bread L30 $850 · Cleaver L40 $1,100 · Damascus L50 $1,800 · Obsidian L90 $2,200 |
| Boards | Walnut L1 free · Maple L10 $300 · Herb L20 $500 · Marble L30 $750 · Dark Oak L40 $1,000 · Copper L50 $1,500 · **Butcher Block L106** $1,800 · **Seafood Slate L109** $2,000 |
| When meat and fish arrive | Chicken/steak first at **L101** (94 levels from L106 on); salmon first at **L109** (51 levels) |
| Bread levels | L11–13, 18, 26, 29–31, 49, 74, 80, 184, 190 |
| Supplies | 50 lines: 18 culinary (stock pot $38, ladle $2.59, mixing bowl $1.81 …), 17 tableware (forks $4.54 a pack, plates $37/pack …), 15 packaging (containers $18/pack, bags $17/pack …) |
| Money curve (buys everything) | cash **$31 at L20, $10 at L50**, $2,712 at L100, $20k at L150, final ~$106–110k (target band $100–150k) |
| Money curve (buys nothing) | $5k at L20, $16k at L50, $50k at L100, $285k at L250 |

Three findings shape everything below:

1. **Real food is cheap next to campaign pay.** A Level 1 tomato order pays
   ~$45 + a $50 level reward; the tomato costs ~$1. Swapping the abstract COGS
   for real stock makes the campaign *richer* by ~$25–32k, which still lands
   inside the $100–150k final-wealth band (section 7).
2. **The early game has no slack** for a player who buys every knife and board
   as it unlocks ($10–31 in the bank around L20–50). Any new cost there must be
   tiny or offset, and a free safety net is mandatory.
3. **The catalog already tells a realism story.** The Butcher Block unlocks at
   L106, five levels after raw meat arrives; the Seafood Slate unlocks at L109,
   the first fish level. That is exactly the real food-safety rule (separate,
   colour-coded boards for raw meat and raw fish). The gates can follow what is
   already there.

---

## 3. Design pillars (what makes millions of players stay)

1. **One tap to cook.** The common case before a level is "✓ Kitchen ready →
   Start". The uncommon case is "Missing 2 items · $3.40 → Buy & start". It
   never takes more than two taps and 5 seconds.
2. **Never stuck.** Whatever a player spent their money on, the next level can
   always be played (section 6).
3. **Teach one thing per chapter**, with a story beat, the way coaching teaches
   one technique per level. A player is never handed every system at once.
4. **Real things, real units, real prices.** Pounds of tomatoes, a 20 qt stock
   pot, a pack of 12 forks. Real food-safety and kitchen rules, explained in
   one line ("Raw chicken gets its own board").
5. **Soft consequences first, hard gates rarely.** Running low lowers quality
   and tips; only a handful of story moments are hard requirements, each
   announced 5 levels ahead on the Order Board and the Kitchen.
6. **The money must feel fair.** The report after every level shows what the
   order cost you in stock and what you earned, so buying stock never feels
   like a tax.
7. **Replays stay free practice.** Re-playing a level for stars never eats
   your stock.

---

## 4. The new loop

### 4.1 Before a level: the Prep Check

Tapping **Prepare** on the Order Board opens a short sheet instead of going
straight to the board:

```
LEVEL 34 · Tonight: 2 tables (4 guests), 1 takeaway
  🥕 Ingredients      Tomato 2 lb ✓  ·  Basil 1 bunch ✓  ·  Garlic ✗ need 1
  🍳 Tools            Mixing bowl ✓
  🍽️ Place settings  4 of 4 ✓
  🥡 Takeaway         1 container ✓ · 1 bag ✗
                      ───────────────────────────
  Missing: 2 items · $2.10            [ Buy missing & start ]
                                      [ Open Market ]  [ Later ]
```

- The level's orders are **rolled when the Prep Check opens** (from the
  level's own pool, seeded) and saved, so the list is exact and leaving and
  coming back gives the same tickets (no shopping around for easy orders).
  This reuses the `levelProgress.paidOrders` pattern from decision #5.
- **Buy missing & start** buys exactly the missing quantities at today's
  Market prices through the same Market purchase functions (one ledger entry
  per line, as today), then starts the level. It is the Market's own purchase,
  reached from a pre-filled cart, so "Market is the only place things are
  bought" still holds.
- A ready kitchen skips the sheet entirely (a small "✓ Kitchen ready" toast).
- The Order Board shows a badge on every level card: **✓ Ready**,
  **🛒 $2.10**, or **🔒 Needs Bread Knife**, so nobody discovers a problem
  after tapping.

### 4.2 During the level

Nothing changes in the cutting. The ingredients are taken from stock when the
order is **served** (oldest fresh stock first, the way a real kitchen rotates
stock, FIFO), never before, so quitting mid-level costs nothing.

### 4.3 After the level

The report adds one line: *"Food cost $1.80 from your stock · Tips $6 · You
earned $58."* The Inventory badge shows what's left and what spoils soon.

### 4.4 Tables, guests and takeaway (new, small)

Each order is a **ticket for a table of N guests** (1 in the early levels,
growing to 2–4, banquets bigger) or a **takeaway** order. Guests multiply the
food needed; they don't change the cutting (the player still cuts one plate's
worth on screen; the ticket says "×4 plates"). This is what makes the fridge,
plates and cutlery matter without changing a single level's gameplay.

---

## 5. What the player learns, chapter by chapter

| When | What becomes real | Hard requirement? | Story beat |
|---|---|---|---|
| **Ch 1 · L1–10** | Grandma's pantry is stocked; the Chef's Knife and Walnut board are yours. Stock visibly goes down after each level (Inventory badge). | None. Pantry refills itself. | L8: "The pantry's nearly empty." L10 milestone: first trip to the Market, guided (buy tomatoes). |
| **Ch 2 · L11–20** | **Ingredients.** From L11 you buy your own. The Prep Check appears. L13: first herb wilts → freshness, FIFO and Throw Out Expired taught (that first spoiled bunch is replaced free). | Ingredients for the level. | "Fresh basil lasts 3 days. Buy it close to service." |
| **Ch 3 · L21–30** | **Kitchen tools** (smallwares). Each kind of dish needs its tools, bought once: salads and fruit → mixing bowl; soups and curries → stock pot + ladle; cooked dishes → fry pan + tongs; bread → sheet pan. Until L21 they're "borrowed from Grandma". **Takeaway** opens at L25: takeaway tickets need a container + a bag (napkins and a cutlery kit add a tip). | The tools for the level's dishes (cheap: $2–40 each). Packaging for takeaway tickets. | Grandma's friend wants her pots back. The takeaway window opens. |
| **Ch 4 · L31–40** | **Place settings** (tableware). Dine-in tables need a plate, fork, knife and glass per guest; they're reused, and a few break (1 in ~100 uses, seeded) so you top up now and then. Soup tickets need soup bowls + spoons. | Enough settings for the level's guests. | First full dining room. |
| **Ch 5 · L41–50** | **Freshness pays.** Fresh produce adds a quality bonus; stock bought too early costs you. Supplier choice (Wholesale / Premium) now changes real Market prices for the campaign too. | — | The first food critic. |
| **L49** | **Bread Knife** (unlocks L30). A serrated blade for crusty bread; the next bread levels are L49, 74, 80, 184, 190. | **Yes**, announced from L44. $850; the player has had 19 levels to plan. | "Squashing the baguette won't do for the critic." |
| **Ch 6–10 · L51–100** | Tables grow (2–4 guests), batch services, the **Cleaver** for squash, pumpkin and melon (soft: without it those cuts score lower). Sharpness matters more. | None new until L91. | Kitchen tiers (L51/71/91) as today. |
| **L91–100** | **Commercial fridge.** With 3–4 guests per ticket the biggest service (L98: 14 units per round × 3–4 = 42–56 units on hand at once) no longer fits the Basic fridge's 40. | **Yes** from L95, announced from L90. $2,000. | The Grand tier opens (L91); the L100 banquet. |
| **L101–105** | Raw chicken and steak arrive. Taught: wash up between raw meat and vegetables. | — | The health inspector's visit at L105. |
| **L106** | **Butcher Block** for raw meat (unlocks L106). | **Yes** for meat levels from L106. $1,800. | Inspector: "Raw meat gets its own board." |
| **L109** | **Seafood Slate** for raw fish (unlocks L109, the first salmon level). | **Yes** for fish levels from L109. $2,000. | Food safety, colour-coded boards. |
| **Ch 12–24** | Bigger services, events, suppliers, the Business days you run between chapters. | Soft only. | — |
| **L250** | **Family Legacy banquet** for 20 guests: ~140 units on hand. | **Professional fridge**, announced from L240. $4,800. | The finale. |

Why these, and only these, are hard gates:

- each matches a **real kitchen rule** a player understands in one sentence
  (serrated knife for bread, separate boards for raw meat and fish, a fridge
  big enough for the service);
- each item **already unlocks** before the gate, at the level the catalog
  already sets (the Butcher Block / Seafood Slate unlocks line up with the
  first meat and fish levels today);
- a normal player **already buys most of them** in the current simulation
  (it spends $6,800 on fridges and $7,850 on boards), so the gate rarely costs
  extra; it changes *when*, not *whether*.

The developer's request also mentions "upgrade knife". That stays **soft**: a
dull knife already lowers quality (sharpness), and the Blacksmith upgrades
remain optional. Forcing paid upgrades would push the buy-everything player
below $0 (section 2).

---

## 6. No player can ever be stuck

| Situation | What happens |
|---|---|
| Not enough money for the level's missing ingredients | **Grandma's emergency crate** (free): the missing ingredients for *this* level only, basic grade, once per level attempt. No money moves and no ledger entry (it is a gift of goods, like the Ch 1 pantry). The level still pays normally. |
| Ads are available | **Supplier sample crate** (rewarded ad): the same crate, plus 20%, any time. Placement `prep_sample_crate`. Never required. |
| Missing tools, tableware or packaging and can't afford them | The cheapest set is lent for this level ("Borrowed from Grandma") with a 10% tip penalty. Takeaway tickets fall back to dine-in if no packaging is on hand. |
| A hard-gate item can't be afforded | The gate levels' **neighbours stay playable** (the gate only blocks the meat / fish / bread levels themselves, and their own Today's Special / Business days still earn), and the simulation guarantees a normal and an aggressive spender reach each gate with the money (section 7). As a last resort the gated level can be played with a **borrowed** item for no stars above 2. |
| Fridge full | The Prep Check offers to throw out expired stock first, then shows "Upgrade Refrigerator →". Never blocks a level below a gate. |

This keeps the hard rules from section 7 of CLAUDE.md: no debt, credits never
below $0, no economic soft-lock.

---

## 7. Money: two options

### Option A — real stock replaces the abstract food cost (recommended first)

- Order pay is today's pay without the abstract COGS deduction; instead the
  player pays for real stock up front (Market prices × guests).
- Measured effect: the campaign stops charging ~$34.6k of abstract COGS and
  charges ~$6–9k of real stock (with 2–4 guests per ticket). Final wealth rises
  by roughly **$25–28k: ~$131–138k**, still inside the $100–150k target.
- Early game gets *easier*, not harder: L1–20's abstract COGS is ~$371; their
  real stock is ~$53 and the first 10 levels are free.
- Cost: the frozen Economy V2 COGS line (37,620) changes, so the V2 / V2.5
  baselines must be re-measured and re-locked with the new simulation (one
  approved rebalance, like V2.5).
- Honest weakness: food cost is ~5% of what an order pays, where a real
  restaurant runs ~30%. Few players will notice; anyone who plays Business Mode
  sees Business dishes priced realistically.

### Option B — real tickets (later, its own approval)

Order pay becomes the dish's real menu price × guests (Business's 30%
food-cost rule) plus tips from cut quality, and the level reward is re-curved
so the final wealth stays in the band. The campaign and Business then use one
price list, and the numbers agree everywhere. It is the more realistic model,
but it moves most campaign income into level rewards and needs a full V4
economy pass with every pinned economy suite re-locked. Recommended only after
A is live and measured.

### Simulation gates (both options)

Before release, `economy-v25-simulation` gains the new costs and must show,
for Normal, Completionist, Aggressive Spender and Saver profiles:

- final wealth $100–150k (Saver may exceed it, as today);
- cash ≥ the next level's stock every level, with **zero** emergency crates
  for the Normal profile and fewer than 5 for the Aggressive Spender;
- each hard-gate item affordable when its notice starts;
- no negative cash, ledger reconciles every step.

---

## 8. How it fits the existing code (no second system)

| Need | Uses (existing) | New (small, pure modules) |
|---|---|---|
| Stock | `business.inventory`, perishability, `RefrigeratorManager` (one inventory for both modes) | `campaign/levelNeeds.ts`: what a level's tickets need (ingredients × guests, tools by dish kind, settings, packaging, gate items) |
| Buying | Market purchase functions, ledger, wallet | `campaign/prepCheck.ts`: ready / missing / blocked verdict; a pre-filled Market cart |
| Using | `consumeUsableIngredients` (FIFO), supplies `stock` | Serve consumes; its cost basis becomes the order's food cost |
| Tickets | `paidOrders` pattern in `levelProgress` | `levelProgress.tickets[levelId]`: the rolled orders + guests |
| Clock | `business.calendar.businessDay` (the freshness clock) | Lunch + dinner: every 2 first-play campaign levels advance one kitchen day (spoilage only, no Business payroll); End Business Day still advances it |
| Gates | knife / board / fridge ownership | `campaign/equipmentGates.ts`: the table in section 5 |
| Safety net | — | `campaign/emergencyCrate.ts` (goods, no money) |
| Dish kind → tools | `recipes/dishKind.ts` (already decides the cooking clip) | a kind → tools map |
| Replays, Today's Special, Endless | — | Replays: free practice stock. Today's Special / Endless pay, so they use stock. |

Rules in CLAUDE.md that change (they need the developer's explicit OK):

- §7 "Campaign must never require any Business system" → replaced by "the
  campaign uses the one kitchen inventory; requirements only as listed in
  `campaign/equipmentGates.ts`".
- §7 Economy V2 frozen baseline → re-locked after the approved rebalance.
- The Campaign-independence checks (`business-supplies-qa` H1,
  `inventory-market-qa`, `campaign-integrity-qa`) are rewritten on purpose to
  check the new rules, never deleted.

Existing players: everything below their current level is grandfathered. On
first load they get a one-time "New kitchen" crate: stock for their next 3
levels plus the tools, settings and packaging their current chapter needs
(goods, no money). Gates ahead of them follow the normal 5-level notice.

---

## 9. Screens

- **Order Board**: readiness badge per level; "Coming up: Butcher Block needed
  at L106" banner 5 levels ahead.
- **Prep Check sheet** (section 4.1): 48 px targets, fits 320×568, one primary
  button.
- **Kitchen home**: "Next service: ✓ ready" or "🛒 $2.10 to get ready".
- **Market**: "Shop for Level 34" cart (pre-filled, editable); everything else
  as today.
- **Inventory**: "Reserved for your next level" chips on crates; Supplies tab
  unchanged.
- **Level report**: food cost, tips, stock left, what spoils soon.
- **Business**: unchanged, but its fridge and stock are now the same ones the
  campaign uses (one restaurant).

---

## 10. Rollout (each step separately approved, tested and merged)

| Step | Content | Hard requirements live? |
|---|---|---|
| 0 | Decisions in section 12; economy simulation of Option A with guests | — |
| 1 | `levelNeeds` + tickets + Prep Check **as information only** ("This level uses 2 lb tomato"), Order Board badges | No |
| 2 | Ingredients required from L11, Ch 1 pantry, FIFO consumption, kitchen-day clock, emergency crate, replays free | Ingredients |
| 3 | Tools (L21), takeaway packaging (L25), place settings (L31), breakage | + supplies |
| 4 | Equipment gates (L49, L95, L106, L109, L250) with 5-level notices and the borrowed-item fallback | + gates |
| 5 | Rebalance + re-lock the economy baselines; migration crate for existing saves | — |
| 6 | Polish: story beats, coaching cards for each new system, analytics | — |

QA added per step: `campaign-needs-qa`, `prep-check-qa`, `campaign-stock-qa`
(consumption, FIFO, no negative stock, replay free), `equipment-gates-qa`
(every gated level, notice, fallback), `emergency-crate-qa` (no money, no
ledger, once per attempt), the four-profile simulation, and e2e: Ch 1 → L11
first purchase, L13 spoilage, L25 takeaway, L49 bread knife, L106 / L109
boards, an old save's migration, all at 320–1024 px.

---

## 11. What to measure on Playgama

Compare to the current build (same placements): D1 / D7 retention, levels per
session, drop-off at L11 / L21 / L25 / L31 / L49 / L95 / L106 / L109, share of
Prep Checks that are one tap, emergency-crate rate (target < 5% of levels),
rewarded-ad opt-in on the sample crate, time from tap to cutting (target
< 5 s). If drop-off at a gate exceeds the previous level's by more than 3
points, soften that gate (borrowed item) in the next build.

---

## 12. Decisions needed

1. Go ahead with the Campaign Kitchen at all (it reverses the rule that the
   campaign never needs Business systems)?
2. Money: **Option A** first (recommended), Option B later or never?
3. Guests per ticket (2–4 mid-game, a 20-guest L250 banquet): yes?
4. The hard gates: Bread Knife L49, Commercial fridge L95, Butcher Block L106,
   Seafood Slate L109, Professional fridge L250. Add or remove any? (The
   request asked for knife and fridge gates; the boards follow the catalog's
   own food-safety unlocks.)
5. Safety net: free emergency crate (recommended) and/or the rewarded-ad
   sample crate?
6. Clock: one kitchen day per 2 campaign levels (lunch + dinner)?
7. Replays as free practice (recommended), or do they use stock?
8. Existing saves: grandfather + one free "New kitchen" crate?
9. Order of work: finish the current decision batch first (#6, #7, #10, #14,
   #16–20, #24–25), or start this plan now? Note: #7 (smallwares/tableware
   effects) is absorbed into this plan's steps 3–4.
