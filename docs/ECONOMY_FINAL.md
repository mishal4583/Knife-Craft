# Final economy design pass (2026-10-06) — restaurant build

The brief set three goals:

- A true completionist (all 250 levels, every item bought) must reach Level 250 with **at least
  $150,000**, ideally **$160k–$175k**. This is a hard floor and it excludes Endless income.
- Buying must become economically meaningful, without large unconditional rewards.
- Saving must stay viable.

**Scope.** Everything here applies to the unified restaurant: saves stamped by the restaurant
migration, which only the `VITE_RESTAURANT_MODE=1` build stamps. The release build's economy is
unchanged: same kitchen prices, settlement, Today's Special and Business Day. Its frozen V2 / V2.5
suites still pass. `RESTAURANT_MODE` stays off for release.

**Evidence.**

- `scripts/economy-final-sim.mts`: seven players, checkpoint tables, the real restaurant
  functions.
- `scripts/economy-final-candidates.mts`: the candidate sweep.
- `scripts/economy-final-endless.mts`: the Endless candidates.
- `scripts/restaurant-final-economy-qa.mts`: the acceptance suite (target, safety, investment
  value, rules, release untouched, wiring, old saves).
- `tools/e2e/restauranteconomy.mjs`: the browser check.

## 1. Baseline (before this pass)

Restaurant build, full campaign, no Endless income.

| Player | L250 cash | Notes |
|---|---|---|
| A Saver (buys no items) | $307,353 | — |
| B Kitchen tiers only | $181,485 | — |
| C Completionist (Local) | **$128,063** | spent $193,430 on items |
| D Completionist + Wholesale | $128,556 | Wholesale saved $570 in total |
| E Completionist + Premium | $130,925 | Premium beat Local by $2.9k |

The completionist's flows over the campaign:

| Flow | Amount |
|---|---|
| Order earnings | $163,480 |
| Quality bonus | $11,122 |
| Menu guests | 687 |
| Ingredients | $5,529 |
| Wages | $21,627 |
| Fines | $4,510 |
| Fridge peak | 44 of 140 |

### Problems confirmed by the simulation

- **Saving beat buying by $179k.** Items cost $193k and returned about $1k: stock savings on about
  $5.6k of food.
- **The Blacksmith ($23,280) had no economic effect at all.** It only changes cutting feel.
- **The fridge never mattered.** The Basic 40 held every service at a 70% peak. The completionist's
  Professional fridge peaked at 31%.
- **Staff in the campaign were pure cost.** $21.6k of wages, and they bought no capacity.
- **Grandma's pantry and spares were free food with no consequence.** A broke player ran the whole
  campaign on them.
- **Today's Special was 36% of a one-chef Endless restaurant's day.**
- **Stars were too easy.** The one-chef restaurant earned 88 of 90.
- **Premium was money-optimal and Wholesale was irrelevant.** Food is too cheap for ±10% to matter.

## 2. Changes and exact values

All values live in one place each:

- `restaurantInvestments.ts` (`RESTAURANT_INVESTMENT_RULES`);
- `menuGuests.ts` (`GUEST_CAPACITY_RULES`);
- `restaurantEvents.ts`;
- `restaurantStanding.ts`.

### Kitchen tiers (restaurant price, release unchanged)

| Tier | Price | Quality share | Guest seats |
|---|---|---|---|
| Growing Kitchen (L21) | $16,000 (was $20,000) | +1.5% | — |
| Established Kitchen (L41) | $20,000 (was $25,000) | +3% | — |
| Neighborhood Café (L51) | $21,000 (was $25,000) | +4% | +1 |
| Flourishing Café (L71) | $24,000 (was $30,000) | +5% | +1 |
| Grand Kitchen (L91) | **$29,000** (was $35,000) | +7% | +2 |
| **Total** | **$110,000** (was $135,000) | | |

- **Quality share:** a share of each campaign order's recipe earnings, added to its quality bonus.
  The best tier built counts.
- **Seats:** extra menu guests per service, capped by the team's capacity. The Kitchen Upgrade
  screen shows each tier's benefit.

### Equipment quality (on top of the existing stock savings and boosts)

| Source | Share |
|---|---|
| Blacksmith mastery (steps forged ÷ every step on every knife) | up to +2% |
| Knife roll owned (by catalog value) | up to +1% |
| Board set owned (by catalog value) | up to +1% |
| Prep Assistant / Kitchen Assistant | +0.5% each (the Quality Chef already gives +1%) |
| **Maximum** | **+5%** |

These effects depend on ownership, not on what is equipped. The simulated completionist never
changes knives, so an equip-based effect would have rewarded nothing.

### Other rules

- **Service capacity** (`GUEST_CAPACITY_RULES`).
  - The chef serves 2 menu guests a service.
  - Each prep cook, line cook, server and Head Chef adds 1; each specialist chef adds 1.
  - Menu guests = min(schedule + kitchen seats, capacity).
  - Staff requirements still read the schedule only, so they never depend on this.
- **Emergency Service** (`emergencyService.ts`).
  - A service that used Grandma's pantry or spares earns recipe earnings with **no quality bonus**.
  - It is recorded in the optional `levelProgress.emergency` and dropped when the level completes.
  - The check explains it next to both buttons. No debt, no blocking.
- **Whole-day stocking** (`preServiceCheck.dayStockFor`).
  - A "Stock the whole day" card in the Pre-Service Check covers every service left today: orders
    and menu guests.
  - It shows the units, cost and bulk saving, and whether the day fits the fridge.
  - Each Restock row opens the Market preset to the day's quantity; the Market stays the only place
    to buy.
  - A small fridge never blocks: the player keeps stocking service by service.
  - Bulk tiers unchanged: 3% / 5% / 8% from 25 / 50 / 100.
- **Today's Special** (Endless).
  - The bonus is **15% of the day's restaurant revenue, capped at the existing $50**.
  - It is paid at End Business Day when the featured dish was served that day, through the same
    once-per-calendar-day claim. There is still no second daily reward.
- **BUSY star.**
  - It now means **every guest who wanted to eat was served**: the demand *before* the team's
    capacity caps it.
  - PROFITABLE and CLEAN are unchanged. Maximum 3 a day, status only.

### Unchanged

- Bulk tiers and supplier values (Wholesale −10%; Premium +10% / +1 day / +2%).
- Fridge sizes 40 / 80 / 140, wages, menu prices and ingredient prices.
- Level rewards, milestones, the Family Legacy and the Replay Bonus.
- The knife system and campaign levels.

## 3. Candidate sweep — completionist (C) at L250

All runs use full equipment quality.

| Kitchen price | No kitchen quality | Low (1/2/2.5/3.5/5%) | **Mid (1.5/3/4/5/7%)** | High (2/4/5.5/7/9%) |
|---|---|---|---|---|
| $135k | $136,876 | $141,113 | $142,650 | $144,521 |
| $115k | $157,225 | $161,471 | $163,355 | $165,136 |
| **$110k** | $162,052 | $166,455 | **$168,348** | $170,373 |
| $105k | $167,099 | $171,619 | $173,555 | $175,645 |

Equipment quality at $110k and mid kitchen quality: none $161,419, two-thirds $166,059, full
$168,348.

**Chosen: $110k, mid quality, full equipment.**

- It lands at **$168,348**: the middle of $160k–$175k, with $18k above the floor.
- $105k sits at the top edge of the band and $115k near the bottom.
- The $135k release price cannot reach $150k with any believable quality schedule.

## 4. Before → after

### Campaign

| Metric | Before | After |
|---|---|---|
| L20 / L50 wallet (completionist, buys greedily) | $15 / $69 | $26 / $68 |
| L91 / L121 / L150 / L200 wallet | $3,810 / $13,165 / $6,680 / $25,061 | $100 / $14,652 / $18,592 / $30,820 |
| Prudent completionist (keeps $500), lowest cash | — | $479, no emergency service |
| **L250 completionist (Local)** | **$128,063** | **$168,348** |
| L250 completionist + Wholesale / + Premium | $128,556 / $130,925 | $169,027 / $171,582 |
| L250 progression buyer (kitchen tiers only) | $181,485 | $217,732 |
| **L250 saver** | $307,353 | $307,353 (unchanged) |
| Saver − completionist gap | $179,290 | $139,005 |
| Total investment cost (completionist) | $193,430 | $168,430 |
| Ingredients / supplies (completionist) | $5,529 / $272 | $6,127 / $272 |
| Staff wages / fines | $21,627 / $4,510 | $21,627 / $4,560 |
| Order earnings / quality bonus | $163,480 / $11,122 | $163,480 / $24,872 |
| Menu guests (completionist) | 687 | 804 |
| Fridge peak (completionist, stocks whole days) | 43.9 / 140 | 101.5 / 140 (L50 21.5/40, L91 61.4/140) |
| Fridge peak (saver, service by service) | 28.1 / 40 | 28.1 / 40 |
| Safety-net use, completionist (pantry / spares) | 1 / 1 | 0 / 1 (now an Emergency Service) |
| Premium vs Local | +$2,862 | +$3,234 |
| Wholesale vs Local | +$493 | +$679 |

The completionist's quality bonus by investment, over the campaign:

| Investment | Quality bonus |
|---|---|
| Kitchen tiers | $6,286, plus about $1.6k from the 117 extra guests the seats bring |
| Blacksmith | $3,105 (was $0) |
| Knife roll | $1,508 |
| Board set | $1,413 |
| Helpers | $1,443 |

Staff capacity is worth 416 more menu guests (+$5,033 net) over the campaign, against $21,627 of
wages. Campaign staff remain mainly the required cost of a bigger restaurant. Their capacity pays in
the Endless Restaurant.

### Endless Restaurant (30 days, from the new L250 save)

| Restaurant | Before ($/day) | After ($/day) | Stars before | Stars after |
|---|---|---|---|---|
| Minimum (chef, 6 dishes) | 132 | **112** (bonus 22% of the day) | 88/90 | **58/90** |
| Medium | 209 | 208 | 89 | 89 |
| Full menu, thin staff | 344 | 327 | 89 | 80 |
| Fully staffed | 519 | **518** | 89 | 85 |
| Overstaffed | −189 | −187 | 60 | 60 |

Today's Special candidates on the same days (minimum restaurant):

| Rule | Net per day | Bonus's share of the day |
|---|---|---|
| A ($50 flat) | $138 | 36% |
| B (10%, cap $50) | $104 | 16% |
| **C (15%, cap $50)** | **$112** | **22%** |

The bigger restaurants hit the $50 cap under every rule. C was chosen because it leaves medium and
larger restaurants as they were.

BUSY rule candidates: rules A, B and C (100% / ≥ 90% / ≥ 95% of the capped target) all gave about
88/90 everywhere. **D (the whole demand)** spreads them:

| Restaurant | Stars under D |
|---|---|
| Minimum | 58 |
| Thin staff | 80 |
| Fully staffed | 85 |

## 5. Remaining balance issues (for the developer)

- **Saving still out-earns buying by about $139k.** Items now return about $15k plus capability:
  seats, whole-day stocking and Endless capacity. That return is real, but the items don't pay for
  themselves in the campaign. This is acceptable under the brief, which doesn't ask buying to beat
  saving.
- **Premium is still the money-best supplier (+$3.2k over Local).** Food is too cheap for its +10%
  price to bite. If it must not be mathematically best, lower its quality share to about +1% or raise
  its price.
- **Wholesale is worth +$679 over the whole campaign.** Ingredient prices are about 3% of order pay,
  so price levers barely move money. The bulk tiers matter mainly through whole-day stocking.
- **Campaign wages ($21.6k) are not earned back in the campaign** (capacity gives about $5k).
  Staff pay in Endless.
- **The greedy completionist dips to about $0 often.** Buying with a small reserve removes every
  emergency at no cost to the final cash.
