# Second Floor: how top idle games price and pace, and a new income for every machine

Status: **planning numbers only. No game code changed, nothing committed.** Machine prices are the developer's ($500 / $1,000 / $1,500 / $2,000 / $2,500 / $4,000).
Numbers come from `scripts/second-floor-income-model-v4.mts` (new, standalone; it reads the campaign income curve from the Phase 12 calculator).

## 1. What the research found (and what it could not confirm)

**Confirmed from sources**

| Game / source                                                                                                              | Fact                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AdVenture Capitalist ([wiki](https://adventure-capitalist.fandom.com/wiki/Businesses))                                     | Next unit costs `base x coefficient^owned`. Lemonade Stand $3.74, x1.07, 0.6 s, $1; Newspaper $60, x1.15, 3 s, $60; Car Wash $720, x1.14, 6 s, $540.                                                                            |
| AdVenture Capitalist, derived from those figures                                                                           | First-unit payback is **2.2 s, 3 s, 8 s**; each new business costs **12-16x** the last but earns **4.5-12x** more, so payback grows only ~1.4-2.7x per business.                                                                |
| Cookie Clicker ([guide](https://dinogame.gg/blog/how-cookie-clicker-progression-works/))                                   | Base costs 15 / 100 / 1,100 / 12,000 / 130,000 (about x10 per tier), 1.15 growth per unit, output 0.1 / 1 / 8 / 47 / 260 per second. First-unit payback **150 / 100 / 138 / 255 / 500 s**. Upgrades at 1, 5, 25, 50, 100 owned. |
| Game Developer, "The Math of Idle Games" ([part I](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i))    | Costs grow exponentially while production grows linearly; multipliers exist "to (temporarily) get production closer to, or ahead of, costs"; keep older generators relevant by shifting multiplier values.                      |
| Idle Idol post-mortem ([Game Developer](https://gamedeveloper.com/design/balancing-tips-how-we-managed-math-on-idle-idol)) | Cost growth of 11-19% per step; reward should grow more slowly so pacing slows; values were tuned by hand late in production.                                                                                                   |
| AdCap players ([Steam thread](https://steamcommunity.com/app/346900/discussions/0/618458030663042229/?ctp=3))              | Reaching 25, 50 and 100 of a business doubles its speed (2015 post, may have changed).                                                                                                                                          |
| CrazyGames ([guide](https://docs.crazygames.com/resources/monetizing-clicker/))                                            | Show offline earnings on return and offer to double or triple them for an ad ("one of the highest-converting placements"); their clicker average play time is 15 minutes.                                                       |
| Offline caps in the wild                                                                                                   | Examples of 8 h, 12 h and 50 h caps exist; caps create the "I should come back" pull. No source called any length a standard.                                                                                                   |

**Not found:** the other AdCap rows (Pizza onward), manager prices, any published "ideal payback" rule, Idle Miner Tycoon's formulas. Where I use a number from
those games it is derived from the figures above, not quoted.

## 2. Rules the big games share, and how each one applies here

1. **The first unit repays itself quickly, each new business a little slower** (x1.2-1.6, never x10). Applied: single-table payback 8.3 / 12.5 / 15.6 / 19.2 / 22.6 / 34.7 h.
2. **Cost grows with every unit you own, steeper for cheap businesses** (AdCap: 1.15 for the cheap, 1.07 for the dear). Applied: table growth x1.30 (Coffee) down to x1.18 (Hot Food).
3. **A new business is the best next buy for a while, then the old one's next unit gets dearer than it** (so the player keeps switching). Applied: after Coffee, Drinks (12.5 h)
   beats Coffee table #2 (45 h), and so on up the ladder. Every visit in the simulation has two to four sensible buys, never zero.
4. **Milestones multiply the whole business.** Applied: x1.25 at 5 tables, x1.5 at 10 (AdCap uses x2 at 25 / 50 / 100; our rooms are smaller).
5. **Offline progress is capped and the cap is the reason to come back.** Already in the plan: 4 / 5 / 6 h at Tier 1 / 2 / 3. An optional "double my collection" rewarded ad is the
   standard placement (already planned as `floor_double`).

**Two rules that do NOT transfer, and what I did instead**

- **The clock.** Those games are played every few seconds, so a first purchase that repays in 2 seconds is "one tap". Our player returns twice a day. The comparable unit is the
  _visit_: the first purchase should repay in about **one visit gap or less** (Coffee 8.3 h against a 12 h gap), not in seconds. I tried tripling guest prices (Coffee repays in 2.8 h, the
  literal genre feel): every purchase repaid before the next visit and the floor compounded to **millions of dollars a day**. Guest prices stay at the Phase 12 plan's.
- **Unlimited units.** Linear income with no ceiling is how those games reach 10^30. A restaurant has finite floor space. Linear tables ran away (floor share of total income at the
  campaign's end: 60-97%), so tables pay with a square-root curve and each tier seats a fixed number: **6 / 8 / 10 tables** at Tier 1 / 2 / 3. Reaching a tier is how the room grows.

Sweep that led there (regular player, floor share of total income when the campaign ends; lower is better):

| Variant                                                          | Floor share |
| ---------------------------------------------------------------- | ----------: |
| Guest price x3, linear tables, no table limit                    |         97% |
| Guest price x1, linear tables, growth x1.25-1.15, no limit       |         72% |
| Guest price x1, tables^0.8, growth x1.15-1.10, limit 8 / 12 / 16 |         60% |
| Guest price x1, tables^0.6, growth x1.25-1.15, limit 6 / 8 / 10  |         35% |
| Guest price x1, tables^0.5, growth x1.30-1.18, limit 6 / 8 / 10  |         27% |
| **Same, with table and tier prices x2.5 (the proposal)**         |     **16%** |

## 3. The new income per machine (the proposal)

| Machine   |  Price | Cycle | Guest pays | 1 table / h | / day (24 h) | Pays back | Tier 2 (cycle x0.94, guest x1.25) | Tier 3 (x0.90, x1.5) |
| --------- | -----: | ----: | ---------: | ----------: | -----------: | --------: | --------------------------------: | -------------------: |
| Coffee    |   $500 |  12 s |      $0.20 |         $60 |       $1,440 |     8.3 h |                            $3,750 |              $11,250 |
| Drinks    | $1,000 |  18 s |      $0.40 |         $80 |       $1,920 |    12.5 h |                            $7,500 |              $22,500 |
| Pizza     | $1,500 |  30 s |      $0.80 |         $96 |       $2,304 |    15.6 h |                           $11,250 |              $33,750 |
| Burger    | $2,000 |  45 s |      $1.30 |        $104 |       $2,496 |    19.2 h |                           $15,000 |              $45,000 |
| Ice Cream | $2,500 |  65 s |      $2.00 |        $111 |       $2,658 |    22.6 h |                           $18,750 |              $56,250 |
| Hot Food  | $4,000 | 100 s |      $3.20 |        $115 |       $2,765 |    34.7 h |                           $30,000 |              $90,000 |

- **Income of n tables** = one table x n^0.5 x milestone (x1.25 from 5 tables, x1.5 at 10). Tier 2 pays 1.33x the hourly of Tier 1 (guest x1.25, cycle x0.94); Tier 3 pays 1.67x.
- **Table room:** 6 tables at Tier 1, 8 at Tier 2, 10 at Tier 3. Table #2 costs 2.25x the machine, growing x1.30 / 1.27 / 1.25 / 1.22 / 1.20 / 1.18 per extra table.
- **Table and tier prices are 2.5x my first ratios** (Tier 2 = 7.5x the machine, Tier 3 = 22.5x). That one number sets how long the floor keeps giving the player something to buy
  (section 4); it can be changed without touching anything else.
- **A Coffee machine plus the first Server costs $700**, and a Server comes with each pair of machines ($200 / $1,200 / $6,000, my numbers).
- **Best station at the end:** Hot Food, Tier 3, 10 tables = **$911 an hour, $21,858 a day** if never stopped; one full counter visit pays **$5,464**. All six at the top: about $54k a day.

## 4. Timing: what a regular player (2 x 20 min a day, 2 floor visits) sees

| When         | What the floor gives                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| First visit  | Coffee ($500) and a Server bought with the unlock wallet; Drinks too if the campaign has fed the purse   |
| Day 1        | Pizza and Burger machines; first extra Coffee tables                                                     |
| Days 2-4     | Tables on every station, first Tier 2 (Coffee), Ice Cream (day 3) and Hot Food (day 4) machines          |
| Days 5-10    | Tier 2 on Drinks, Pizza, Burger; Coffee Tier 3; floor earns about $16k a day by day 10                   |
| Weeks 2-5    | The long part: tables 6-10 and Tier 3 on every station (a single Tier 3 repays in 8-30 days at 6 tables) |
| About day 35 | Everything is built: about $45-54k a day. After that the only goals left are the ones in section 6.      |

| Player                              | Machines bought on day (Drinks / Pizza / Burger / Ice / Hot) | Everything built | Floor share when campaign ends |
| ----------------------------------- | ------------------------------------------------------------ | ---------------: | -----------------------------: |
| Regular (2 x 20 min)                | 0.3 / 0.8 / 1.3 / 3.3 / 3.8                                  |           day 35 |                            16% |
| Frequent (2 x 45 min)               | 0.3 / 0.3 / 0.3 / 1.3 / 1.3                                  |           day 33 |                             7% |
| Slow campaign, 4 floor visits a day | 1.0 / 2.0 / 2.5 / 5.8 / 6.0                                  |           day 24 |                            87% |

Reading the table: with these prices a player who has the wallet of the campaign behind them owns every machine within the first four to six days; the long game is tables and tiers.
The slow-campaign row is structural (a player who advances one level per visit lets a real-time income run for 36 days before the campaign ends), as in the earlier plan.

How much price scaling buys (regular player; machine prices unchanged):

| Table and tier price scale | Everything built | Floor share at campaign end |
| -------------------------- | ---------------: | --------------------------: |
| x1 (Tier 2 = 3x machine)   |           day 14 |                         27% |
| x2                         |           day 28 |                         18% |
| **x2.5 (proposal)**        |       **day 35** |                     **16%** |
| x3                         |           day 42 |                         15% |
| x4                         |           day 57 |                         13% |

## 5. What I changed against the earlier model

| Item                       | Earlier (Phase 12 plan, rev 3)            | Proposal                                     | Why                                                                                     |
| -------------------------- | ----------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| Guest prices, cycles       | $0.20-$3.20, 12-100 s                     | unchanged                                    | Payback rule (one visit); tripling them made money compound without limit               |
| Income of n tables         | 1 + 0.55 ln n                             | n^0.5 (1, 1.41, 1.73, 2.0, 2.45, 2.83, 3.16) | The log curve made tables beyond the 4th worthless (payback of table #6 over 100 hours) |
| Table cost growth          | x1.17 for every station                   | x1.30 down to x1.18                          | Genre pattern: cheap businesses climb steeper, expensive ones gentler                   |
| Table room                 | up to 50                                  | 6 / 8 / 10 by tier                           | Finite room; tiers become the way to grow                                               |
| Milestones                 | 3, 5, 10, 25, 50 tables (+3% to +30%)     | 5 (x1.25) and 10 (x1.5)                      | Only two are reachable now; they are visible jumps                                      |
| Table #2 / Tier 2 / Tier 3 | 0.9x / 3x / 9x the machine                | 2.25x / 7.5x / 22.5x                         | Stretches the content from 2 weeks to about 5                                           |
| Machine prices             | $25-$5,000 (plan), then my $1k-$65k offer | $500-$4,000 (developer)                      | The developer's decision                                                                |

## 6. Honest limits and decisions needed

1. **The floor is finite.** A regular player has built everything by about day 35 and then earns about $50k a day with nothing to buy. Genre games solve this with prestige or a
   second map. Options: accept it (the campaign is the main game, the floor is a side income), raise the price scale (x4 reaches day 57), or later add a "Third Floor / Franchise" reset.
2. **Campaign timing is still the assumed 2.5 minutes a level.** Campaign income here is the calculator's Saver curve ($356k at Level 148, higher than the $264k used in the earlier
   proposal), so these shares are slightly lower than they would be on the earlier curve. Measure the real minutes per level before locking.
3. **Wallet feed is an assumption:** 25% of campaign income goes into the floor; the rest buys First Floor upgrades. If players put more in, every purchase date moves earlier.
4. **The cheap machine ladder means machine purchases are nearly free for anyone who has played to Level 10.** The spending that matters is tables and tiers, which is why those prices
   carry the pacing. If you want the machines themselves to feel like events, the earlier $1,000 to $65,000 ladder did that.
5. **Not done:** staff prices beyond the placeholders, Cleaners, the unstaffed half-speed rule in this simulation (it assumes every station is staffed), the real game logic, tests.
   Nothing here is implemented.

Questions for the developer: (a) approve table room 6 / 8 / 10 and the square-root curve? (b) price scale x2.5, or longer? (c) keep guest prices at the Phase 12 values? (d) how to
handle the end of the floor (accept, longer, or a reset)?

---

## Generated tables

Produced by `npx tsx scripts/second-floor-income-model-v4.mts all` with the defaults above.

### A. The new income of each machine

Guest price x1 of the Phase 12 plan; income ~ tables^0.5; tables cost x1.3/1.27/1.25/1.22/1.2/1.18 each; milestones 5->x1.25, 10->x1.5, 25->x2, 50->x3; tiers pay x1/1.25/1.5 and cycle x1/0.94/0.9.

| Machine   |  Price | Cycle | Guest pays | Per cycle | Per hour | Per day (24 h) | Pays back | Table growth |
| --------- | -----: | ----: | ---------: | --------: | -------: | -------------: | --------: | -----------: |
| Coffee    |   $500 |  12 s |      $0.20 |     $0.20 |    $60.0 |         $1,440 |     8.3 h |         x1.3 |
| Drinks    | $1,000 |  18 s |      $0.40 |     $0.40 |    $80.0 |         $1,920 |    12.5 h |        x1.27 |
| Pizza     | $1,500 |  30 s |      $0.80 |     $0.80 |    $96.0 |         $2,304 |    15.6 h |        x1.25 |
| Burger    | $2,000 |  45 s |      $1.30 |     $1.30 |     $104 |         $2,496 |    19.2 h |        x1.22 |
| Ice Cream | $2,500 |  65 s |      $2.00 |     $2.00 |     $111 |         $2,658 |    22.6 h |         x1.2 |
| Hot Food  | $4,000 | 100 s |      $3.20 |     $3.20 |     $115 |         $2,765 |    34.7 h |        x1.18 |

#### Income per HOUR, staffed

| Machine   | Tier | 1 tbl | 2 tbl | 3 tbl | 4 tbl | 6 tbl | 8 tbl | 10 tbl |
| --------- | ---- | ----: | ----: | ----: | ----: | ----: | ----: | -----: |
| Coffee    | 1    | $60.0 | $84.9 |  $104 |  $120 |  $184 |     - |      - |
|           | 2    | $79.8 |  $113 |  $138 |  $160 |  $244 |  $282 |      - |
|           | 3    |  $100 |  $141 |  $173 |  $200 |  $306 |  $354 |   $474 |
| Drinks    | 1    | $80.0 |  $113 |  $139 |  $160 |  $245 |     - |      - |
|           | 2    |  $106 |  $150 |  $184 |  $213 |  $326 |  $376 |      - |
|           | 3    |  $133 |  $189 |  $231 |  $267 |  $408 |  $471 |   $632 |
| Pizza     | 1    | $96.0 |  $136 |  $166 |  $192 |  $294 |     - |      - |
|           | 2    |  $128 |  $181 |  $221 |  $255 |  $391 |  $451 |      - |
|           | 3    |  $160 |  $226 |  $277 |  $320 |  $490 |  $566 |   $759 |
| Burger    | 1    |  $104 |  $147 |  $180 |  $208 |  $318 |     - |      - |
|           | 2    |  $138 |  $196 |  $240 |  $277 |  $423 |  $489 |      - |
|           | 3    |  $173 |  $245 |  $300 |  $347 |  $531 |  $613 |   $822 |
| Ice Cream | 1    |  $111 |  $157 |  $192 |  $222 |  $339 |     - |      - |
|           | 2    |  $147 |  $208 |  $255 |  $295 |  $451 |  $521 |      - |
|           | 3    |  $185 |  $261 |  $320 |  $369 |  $565 |  $653 |   $876 |
| Hot Food  | 1    |  $115 |  $163 |  $200 |  $230 |  $353 |     - |      - |
|           | 2    |  $153 |  $217 |  $265 |  $306 |  $469 |  $542 |      - |
|           | 3    |  $192 |  $272 |  $333 |  $384 |  $588 |  $679 |   $911 |

#### Income per DAY if never stopping (24 h), staffed

| Machine   | Tier |  1 tbl |  2 tbl |  3 tbl |  4 tbl |   6 tbl |   8 tbl |  10 tbl |
| --------- | ---- | -----: | -----: | -----: | -----: | ------: | ------: | ------: |
| Coffee    | 1    | $1,440 | $2,036 | $2,494 | $2,880 |  $4,409 |       - |       - |
|           | 2    | $1,915 | $2,708 | $3,317 | $3,830 |  $5,863 |  $6,770 |       - |
|           | 3    | $2,400 | $3,394 | $4,157 | $4,800 |  $7,348 |  $8,485 | $11,384 |
| Drinks    | 1    | $1,920 | $2,715 | $3,326 | $3,840 |  $5,879 |       - |       - |
|           | 2    | $2,553 | $3,611 | $4,422 | $5,106 |  $7,818 |  $9,027 |       - |
|           | 3    | $3,200 | $4,525 | $5,543 | $6,400 |  $9,798 | $11,314 | $15,179 |
| Pizza     | 1    | $2,304 | $3,258 | $3,991 | $4,608 |  $7,055 |       - |       - |
|           | 2    | $3,064 | $4,333 | $5,307 | $6,128 |  $9,381 | $10,832 |       - |
|           | 3    | $3,840 | $5,431 | $6,651 | $7,680 | $11,758 | $13,576 | $18,215 |
| Burger    | 1    | $2,496 | $3,530 | $4,323 | $4,992 |  $7,642 |       - |       - |
|           | 2    | $3,319 | $4,694 | $5,749 | $6,638 | $10,163 | $11,735 |       - |
|           | 3    | $4,160 | $5,883 | $7,205 | $8,320 | $12,737 | $14,708 | $19,733 |
| Ice Cream | 1    | $2,658 | $3,760 | $4,605 | $5,317 |  $8,140 |       - |       - |
|           | 2    | $3,535 | $5,000 | $6,123 | $7,070 | $10,824 | $12,499 |       - |
|           | 3    | $4,431 | $6,266 | $7,674 | $8,862 | $13,566 | $15,665 | $21,017 |
| Hot Food  | 1    | $2,765 | $3,910 | $4,789 | $5,530 |  $8,465 |       - |       - |
|           | 2    | $3,677 | $5,199 | $6,368 | $7,353 | $11,257 | $12,999 |       - |
|           | 3    | $4,608 | $6,517 | $7,981 | $9,216 | $14,109 | $16,292 | $21,858 |

#### What one visit collects (counter caps 4 / 5 / 6 h at Tier 1 / 2 / 3)

| Machine   | Tier | Cap |  1 tbl |  3 tbl |  6 tbl |  8 tbl | 10 tbl |
| --------- | ---- | --: | -----: | -----: | -----: | -----: | -----: |
| Coffee    | 1    | 4 h |   $240 |   $416 |   $735 |      - |      - |
|           | 2    | 5 h |   $399 |   $691 | $1,221 | $1,410 |      - |
|           | 3    | 6 h |   $600 | $1,039 | $1,837 | $2,121 | $2,846 |
| Drinks    | 1    | 4 h |   $320 |   $554 |   $980 |      - |      - |
|           | 2    | 5 h |   $532 |   $921 | $1,629 | $1,881 |      - |
|           | 3    | 6 h |   $800 | $1,386 | $2,449 | $2,828 | $3,795 |
| Pizza     | 1    | 4 h |   $384 |   $665 | $1,176 |      - |      - |
|           | 2    | 5 h |   $638 | $1,106 | $1,954 | $2,257 |      - |
|           | 3    | 6 h |   $960 | $1,663 | $2,939 | $3,394 | $4,554 |
| Burger    | 1    | 4 h |   $416 |   $721 | $1,274 |      - |      - |
|           | 2    | 5 h |   $691 | $1,198 | $2,117 | $2,445 |      - |
|           | 3    | 6 h | $1,040 | $1,801 | $3,184 | $3,677 | $4,933 |
| Ice Cream | 1    | 4 h |   $443 |   $767 | $1,357 |      - |      - |
|           | 2    | 5 h |   $736 | $1,276 | $2,255 | $2,604 |      - |
|           | 3    | 6 h | $1,108 | $1,919 | $3,392 | $3,916 | $5,254 |
| Hot Food  | 1    | 4 h |   $461 |   $798 | $1,411 |      - |      - |
|           | 2    | 5 h |   $766 | $1,327 | $2,345 | $2,708 |      - |
|           | 3    | 6 h | $1,152 | $1,995 | $3,527 | $4,073 | $5,464 |

#### Cost of the next unit and how long it takes to repay (the 'which one do I buy next' curve)

| Machine   | Table #2 |      #3 |      #4 |      #6 |      #8 |     #10 |   All 10 | Payback #2 |     #4 |     #6 |
| --------- | -------: | ------: | ------: | ------: | ------: | ------: | -------: | ---------: | -----: | -----: |
| Coffee    |   $1,130 |  $1,469 |  $1,910 |  $3,227 |  $5,454 |  $9,218 |  $36,177 |     45.5 h |  4.9 d |  8.4 d |
| Drinks    |   $2,250 |  $2,858 |  $3,629 |  $5,853 |  $9,441 | $15,227 |  $63,290 |      2.8 d |  7.1 d | 11.4 d |
| Pizza     |   $3,380 |  $4,225 |  $5,281 |  $8,252 | $12,894 | $20,146 |  $87,212 |      3.5 d |  8.6 d | 13.4 d |
| Burger    |   $4,500 |  $5,490 |  $6,698 |  $9,969 | $14,838 | $22,085 | $102,015 |      4.4 d | 10.0 d | 15.0 d |
| Ice Cream |   $5,630 |  $6,756 |  $8,107 | $11,674 | $16,811 | $24,208 | $117,098 |      5.1 d | 11.4 d | 16.5 d |
| Hot Food  |   $9,000 | $10,620 | $12,532 | $17,449 | $24,296 | $33,830 | $171,773 |      7.9 d | 16.9 d | 23.7 d |

#### Tier upgrades: price and payback at 1 / 3 / 6 tables

| Machine   | Tier 2 price | repays (1 / 3 / 6 tbl)   | Tier 3 price | repays (1 / 3 / 6 tbl)   |
| --------- | -----------: | ------------------------ | -----------: | ------------------------ |
| Coffee    |       $3,750 | 7.9 d / 4.6 d / 2.6 d    |      $11,250 | 23.2 d / 13.4 d / 7.6 d  |
| Drinks    |       $7,500 | 11.8 d / 6.8 d / 3.9 d   |      $22,500 | 34.8 d / 20.1 d / 11.4 d |
| Pizza     |      $11,250 | 14.8 d / 8.5 d / 4.8 d   |      $33,750 | 43.5 d / 25.1 d / 14.2 d |
| Burger    |      $15,000 | 18.2 d / 10.5 d / 6.0 d  |      $45,000 | 53.5 d / 30.9 d / 17.5 d |
| Ice Cream |      $18,750 | 21.4 d / 12.3 d / 7.0 d  |      $56,250 | 62.8 d / 36.3 d / 20.5 d |
| Hot Food  |      $30,000 | 32.9 d / 19.0 d / 10.7 d |      $90,000 | 96.6 d / 55.8 d / 31.6 d |

### B. Progression: when each machine is bought, what the floor earns, floor against campaign

Typical wallet at the Level 5 unlock ($608, $100 kept back). 25% of campaign income goes into the floor. Greedy best-payback buying, Servers bought with each pair of machines, Tier 3 from Level 30.

Machines bought on day: Coffee 0.3, Drinks 0.3, Pizza 0.8, Burger 1.3, Ice Cream 3.3, Hot Food 3.8
Floor income per day: d1 $560, d2 $2,480, d3 $3,974, d5 $7,891, d7 $10,983, d10 $16,232, d14 $21,194, d21 $29,525, d30 $45,392, d45 $53,693, d60 $53,693
Floor at day 60: Coffee 10t/T3, Drinks 10t/T3, Pizza 10t/T3, Burger 10t/T3, Ice Cream 10t/T3, Hot Food 10t/T3
Campaign ends day 9 with $356,273; the floor had earned $69,154 by then => floor share 16%. By day 30: floor $680,701 vs campaign $356,273. Day 60 floor total $2,273,840.

Machines bought on day: Coffee 0.3, Drinks 0.3, Pizza 0.3, Burger 0.3, Ice Cream 1.3, Hot Food 1.3
Floor income per day: d1 $1,360, d2 $4,623, d3 $7,953, d5 $13,063, d7 $15,210, d10 $18,558, d14 $22,452, d21 $31,726, d30 $48,180, d45 $53,693, d60 $53,693
Floor at day 60: Coffee 10t/T3, Drinks 10t/T3, Pizza 10t/T3, Burger 10t/T3, Ice Cream 10t/T3, Hot Food 10t/T3
Campaign ends day 4 with $356,273; the floor had earned $25,062 by then => floor share 7%. By day 30: floor $764,356 vs campaign $356,273. Day 60 floor total $2,367,084.

Machines bought on day: Coffee 0.3, Drinks 1.0, Pizza 2.0, Burger 2.5, Ice Cream 5.8, Hot Food 6.0
Floor income per day: d1 $480, d2 $1,920, d3 $3,907, d5 $8,101, d7 $14,708, d10 $24,684, d14 $43,638, d21 $87,921, d30 $107,385, d45 $107,385, d60 $107,385
Floor at day 60: Coffee 10t/T3, Drinks 10t/T3, Pizza 10t/T3, Burger 10t/T3, Ice Cream 10t/T3, Hot Food 10t/T3
Campaign ends day 36 with $356,273; the floor had earned $2,315,519 by then => floor share 87%. By day 30: floor $1,671,209 vs campaign $291,439. Day 60 floor total $4,892,762.

### Purchase log, regular player (first 10 days)

- day 0.3 (2 buys): Coffee machine ($700); Drinks machine ($1,000)
- day 0.8 (1 buys): Pizza machine ($2,700)
- day 1.3 (3 buys): Burger machine ($2,000); Coffee table #2 ($1,130); Coffee table #3 ($1,469)
- day 1.8 (2 buys): Drinks table #2 ($2,250); Drinks table #3 ($2,858)
- day 2.3 (2 buys): Pizza table #2 ($3,380); Coffee Tier 2 ($3,750)
- day 2.8 (2 buys): Coffee table #4 ($1,910); Coffee table #5 ($2,483)
- day 3.3 (1 buys): Ice Cream machine ($8,500)
- day 3.8 (3 buys): Hot Food machine ($4,000); Burger table #2 ($4,500); Coffee table #6 ($3,227)
- day 4.3 (2 buys): Ice Cream table #2 ($5,630); Drinks table #4 ($3,629)
- day 4.8 (2 buys): Drinks table #5 ($4,609); Pizza table #3 ($4,225)
- day 5.3 (1 buys): Drinks Tier 2 ($7,500)
- day 5.8 (2 buys): Burger table #3 ($5,490); Hot Food table #2 ($9,000)
- day 6.3 (2 buys): Ice Cream table #3 ($6,756); Coffee table #7 ($4,196)
- day 6.8 (1 buys): Coffee Tier 3 ($11,250)
- day 7.3 (1 buys): Pizza Tier 2 ($11,250)
- day 7.8 (2 buys): Pizza table #4 ($5,281); Pizza table #5 ($6,602)
- day 8.3 (2 buys): Drinks table #6 ($5,853); Coffee table #8 ($5,454)
- day 8.8 (2 buys): Burger table #4 ($6,698); Burger table #5 ($8,171)
- day 9.8 (1 buys): Burger Tier 2 ($15,000)
- day 10.3 (1 buys): Pizza table #6 ($8,252)
- day 10.8 (1 buys): Burger table #6 ($9,969)
- day 11.3 (1 buys): Ice Cream table #4 ($8,107)
- day 11.8 (1 buys): Ice Cream table #5 ($9,729)
- day 12.8 (1 buys): Ice Cream Tier 2 ($18,750)
- day 13.3 (1 buys): Drinks table #7 ($7,434)
