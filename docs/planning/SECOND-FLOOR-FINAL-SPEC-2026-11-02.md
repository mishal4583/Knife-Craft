# Second Floor: final spec (engagement, ads, a rich player)

Status: **decisions locked by the developer on 2026-11-02, numbers fitted with the calculators, no game code written, nothing committed.** This supersedes the prices, table room and
pacing targets in the earlier planning files (`PHASE12-...`, `SECOND-FLOOR-PRICE-REBALANCE-...`, `...-IDLE-GAME-RESEARCH-AND-INCOME-...`) and the "floor must not dominate" target.
Reasons and evidence: `SECOND-FLOOR-ENGAGEMENT-AND-ADS-DESIGN-2026-11-02.md`.

## 1. Decisions

| #   | Decision                                                                                                                                                                                     | Who                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1   | **The Second Floor opens at Level 3** (after Level 2 is finished). A locked door shows on the map from Level 1.                                                                              | Developer           |
| 2   | **The player gets rich, like in every idle game.** Big numbers, big ad rewards, a floor that may out-earn the campaign. Rewards scale with what the player is saving for, not fixed dollars. | Developer           |
| 3   | **Saved state** (tables, polish, tiers, Rush end, Golden Guest counter, ad counters, Franchise level) lives in **one nested object, `business.floor2`**. No top-level field.                 | Chosen for the game |
| 4   | **Franchise reset is the long tail.** Endless, with the same shape every branch and numbers x10 bigger.                                                                                      | Chosen for the game |
| 5   | **Soft level gates:** a new machine needs a campaign level (section 3). They pull players into the levels and give "just N more levels" goals.                                               | Chosen for the game |
| 6   | **Remove-ads and a starter pack are a later phase,** not in this build (separate Playgama purchase work).                                                                                    | Chosen for the game |
| 7   | **Coffee is self-serve and the first two machines need no Server.** The first purchase works the moment it is bought. (No machine is ever free.)                                             | Chosen for the game |

Rule changes to record when this is built (CLAUDE.md "when the developer changes a rule, update the tests and say so"): §7 "Second Floor income is extra on top of the campaign economy"
becomes "may exceed it"; the ~20% ad-richer limit in `adBonuses.ts` no longer applies to the floor; the Level-5 opening (`EARLY_UNLOCK_CAP`) moves to Level 3.

## 2. The player's first minutes (what the numbers must deliver)

The typical wallet after Level 2 is **$597** (saver $687, broke start $195, greedy spender $117; from the real campaign simulator). Level pay is about $200-$300 at Levels 3-4, rising to
$600+ by Level 5. So:

1. Level 3 begins: the door opens, a Coffee machine for **$500** is affordable for typical and saver players on arrival; everyone else is one or two levels away, helped by the Short-By ad.
2. Buy it: customers walk in, cups fill, the pile starts to grow, the income counter ticks. No second purchase is needed to see it work.
3. Finish the level: **Flood** brings a surge of guests and the pile fills.
4. From then on there is something to buy at almost every level end.

## 3. The numbers

**Machines** (prices are the developer's; gates, tables and tiers fitted this round):

| Machine   |  Price | Needs level | Cycle | Guest pays | Table #2 | Table cost grows |  Tier 2 |  Tier 3 | Polish step 1 |
| --------- | -----: | ----------: | ----: | ---------: | -------: | ---------------: | ------: | ------: | ------------: |
| Coffee    |   $500 |           3 |  12 s |      $0.20 |      $60 |            x1.50 |  $1,500 |  $4,500 |           $40 |
| Drinks    | $1,000 |           5 |  18 s |      $0.40 |     $120 |            x1.47 |  $3,000 |  $9,000 |           $80 |
| Pizza     | $1,500 |           8 |  30 s |      $0.80 |     $180 |            x1.45 |  $4,500 | $13,500 |          $120 |
| Burger    | $2,000 |          12 |  45 s |      $1.30 |     $240 |            x1.42 |  $6,000 | $18,000 |          $160 |
| Ice Cream | $2,500 |          17 |  65 s |      $2.00 |     $300 |            x1.40 |  $7,500 | $22,500 |          $200 |
| Hot Food  | $4,000 |          23 | 100 s |      $3.20 |     $480 |            x1.38 | $12,000 | $36,000 |          $320 |

- **Servers:** Coffee and Drinks need none. Pizza + Burger share a Server ($1,200); Ice Cream + Hot Food share one ($6,000). Unstaffed machines run at half speed with a 10-minute tray (unchanged).
- **Tables:** income of n tables = one table x n^0.5, x1.25 from 5 tables, x1.5 from 10. Room: **6 tables at Tier 1, 8 at Tier 2, 10 at Tier 3.**
- **Tiers:** Tier 2 = guest pays x1.25 and cycle x0.94; Tier 3 = x1.5 and x0.90. Tier 2 costs 3x the machine, Tier 3 costs 9x (Tier 3 needs Level 30, as today).
- **Polish (new):** ten cheap upgrades per station (decor, training, menu card). Each costs 8% of the machine price x1.3 per step and adds +6% to that station's income (+60% at ten).
  They exist so that **there is always something affordable to buy**. Without them the longest wait in the first hour was 10-25 minutes.
- **Counter caps:** 4 / 5 / 6 h at Tier 1 / 2 / 3, as in the plan. One machine alone is ~$60-$115 an hour at Tier 1 and one table; the full branch plateau is about **$54k a day**.
- **Money rewards scale with the goal, not in dollars:** see section 5.

## 4. What the calculators show

Session clock (`scripts/second-floor-session-sim.mts`, 2.5-minute levels, start Level 3 with $497, Polish on, Coffee self-serve, level gates on, share of level pay put into the floor):

| Share of level pay in the floor | 30 min: purchases / levels with a buy / longest wait | 60 min        | 120 min       |
| ------------------------------- | ---------------------------------------------------- | ------------- | ------------- |
| 50%                             | 23 / 9 of 12 / 10 min                                | 37 / 17 of 24 | 71 / 37 of 48 |
| 100%                            | 31 / 10 of 12 / 5 min                                | 61 / 20 of 24 | 96 / 37 of 48 |

(Before the changes: 3 purchases in 30 minutes, 15-minute waits.) Machines arrive at minutes 10-20 (Drinks), 40-60 (Pizza) of the first hour, limited by the level gates.

Day clock (`scripts/second-floor-income-model-v4.mts`, a regular player = 2 x 20 min a day, two floor visits):

| Player                      | Drinks / Pizza / Burger / Ice / Hot (day) | Everything built | Floor share when campaign ends | Floor per day then |
| --------------------------- | ----------------------------------------- | ---------------: | -----------------------------: | -----------------: |
| Regular (2 x 20 min)        | 0.8 / 1.3 / 1.8 / 3.8 / 3.8               |            day 9 |                            45% |            $53,693 |
| Frequent (2 x 45 min)       | 0.3 / 0.8 / 0.8 / 2.3 / 2.3               |            day 7 |                            24% |            $53,693 |
| Slow campaign, 4 visits/day | 1.0 / 1.8 / 2.3 / 3.5 / 5.0               |            day 9 |                            91% |           $107,385 |

The floor now builds out in about a week, so **the length of the game comes from Franchise, not from one branch.** Notes: this calculator does not include Flood, Golden Guests, Rush,
Polish or ad rewards (they add income on top; Polish alone is up to +60% on a station); the 2.5 minutes per level and the share put into the floor are assumptions.

## 5. Rich, the idle-game way

- **Rubber-band rewards.** Every free bonus and every ad bonus is `max(minutes of current floor income, share of the next goal's price)`, capped at half the goal:

  | Reward              | Free                                      | With the ad          |
  | ------------------- | ----------------------------------------- | -------------------- |
  | Flood after a level | 15 min of income, at least 5% of the goal | 60 min, at least 20% |
  | Golden Guest tap    | 1 min of income, at least 2%              | x3                   |
  | Rush Hour           | 3 min at x3 (from Hype or Golden)         | 10 min at x3         |

  At the start the next goal is Coffee ($500): a free Flood is worth $25 and the ad $100. At the end of a branch the goal is $36,000: free $1,800, ad $7,200. Rewards stay exciting at
  every stage, and an ad is always visibly better than the free version.

- **Big-number display** from the start: 1.2K, 3.4M, 7.8B, then letters, on every counter and price.
- **Franchise.** When all six stations are at Tier 3 with 8+ tables, **"Open a new branch"**: the six stations reset, prices and guest payouts become **x10**, and every finished
  branch gives a permanent **+50% income**. A branch repeats the same shape in a similar time, so numbers keep growing about tenfold per week of play. New branches get a new look
  (the cosmetic that makes it feel like progress). Pricing is checked in the calculator during build. The wallet is whole cents; the largest value stays far below the safe integer limit
  for many branches.
- **The First Floor stays relevant:** its purchases (kitchen, equipment) are cheap for a rich player, so they become quick wins on the way, while the cutting levels stay the way to
  open machines (gates), fill Hype and earn Flood. Campaign pay itself is unchanged.

## 6. Ads and engagement features

Unchanged: all rewarded offers state the reward first, can be declined, are never needed, have daily caps, pay with one `rewarded-ad` ledger entry, and never interrupt cutting.
Interstitials only at natural breaks, Bridge-spaced.

| #   | Moment                     | Offer                                                      | Daily cap | Offers per 30 min |
| --- | -------------------------- | ---------------------------------------------------------- | --------: | ----------------: |
| 1   | Return after 30+ min       | Welcome back, up to 3 h of income (exists)                 |         1 |               0-1 |
| 2   | Level complete             | Flood x4 (new), or x1.5 level pay (`level_double`, exists) |         8 |               3-4 |
| 3   | Golden Guest tapped        | x3 (new)                                                   |         8 |               3-5 |
| 4   | Entering the floor         | Rush 10 min (new)                                          |         4 |               1-2 |
| 5   | Within 25% of the next buy | Short By (exists)                                          |         6 |               1-2 |
| 6   | Counters full              | Collect x2 (`floor_double`, exists)                        |         4 |               0-1 |
| 7   | Waiting for a big goal     | Skip 2 h of income (new)                                   |         3 |               0-1 |
| 8   | Daily gift / floating cash | exist                                                      |     1 / 6 |               0-2 |

About 10-16 rewarded offers in 30 minutes; at Playgama's 30-40% click benchmark that is 3-6 views a session. Anti-clutter rules: one offer on screen at a time, 90 seconds between offers,
none during cutting. The whole set is switchable by one constant so it can be tuned from telemetry.

Engagement features: the **next-goal strip** (always visible, tap to buy), **Pickup pile combo**, **Golden Guest** (seeded by day and counter, every 4-5 active minutes), **Rush Hour**,
**Hype** (stars or perfect cuts fill it), **milestone fanfare**, **streak** (extends the daily gift streak), the **Flood** surge after each level.

## 7. Build plan (nothing started)

| Phase | Content                                                                                                                                                  | Gate before the next                               |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| A     | Data model `business.floor2`, cycle / table / tier / polish math in integer mills, offline settlement, old-save migration (no refunds, no free machines) | Unit tests + ledger invariants + old-save fixtures |
| B     | Floor screen: customers, cups, pile, next-goal strip, buy sheet, big numbers, Level 3 opening, locked door from Level 1                                  | Browser check at 320, 390 and 430 px               |
| C     | Flood on Level Complete, Golden Guest, Rush, Hype, fanfare, streak                                                                                       | Determinism tests (seeded), no negative values     |
| D     | The new ad offers, caps, `rewarded-ad` ledger entries, analytics events                                                                                  | `ad-bonuses-qa` extended; ad flow in the browser   |
| E     | Franchise                                                                                                                                                | Calculator pricing check; large-number tests       |
| F     | Telemetry events, full QA, phone check, release notes                                                                                                    | All gates (CLAUDE.md §5)                           |

Tests to add or update: the economy tests that assume Level 5 or the 20% ad limit (documented, never silently changed); floor math (cycles, tables, tiers, polish, caps); ledger
invariant (opening + entries = closing); offline settlement equals online; old-save migration; Flood / Golden / Rush determinism; ad caps and the one-entry-per-ad rule; Franchise reset
keeps wallet and ledger; big-number formatting; UI with no sideways scroll.

## 8. Risks and what I would watch

- **The telemetry shows most players leave before Level 3.** The locked door, a visible promise on the map, and this earlier opening are the answer, but the first-minute drop (52% gone by
  60 s) needs its own work on Levels 1-2 and is not covered here.
- **Rewarded ads dropped to zero after 28 Oct.** Check the placement before building more.
- **Assumptions to measure:** minutes per level (2.5 assumed), share of level pay put into the floor (25-100%), the real click rate on offers.
- **Wealth inflation:** a rich floor makes First Floor prices small. That is intended, but watch whether the cutting levels still feel worth playing; the gates and Hype exist for this.
- **Clutter:** more offers is not always more revenue. Tune by the telemetry in section 10 of the design file, not by feel.
