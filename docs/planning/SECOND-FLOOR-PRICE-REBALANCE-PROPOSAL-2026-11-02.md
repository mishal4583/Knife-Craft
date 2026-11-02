# Second Floor machine price rebalance: diagnosis and proposal (developer 2026-11-02)

Status: **proposal for approval. No game code, price, test or save was changed.** Nothing is committed, merged, deployed or uploaded.
Evidence comes from the real campaign simulator (the one the economy QA suites use) and the real `restaurant/secondFloor.ts`; reproduce it with

```
npx tsx scripts/second-floor-price-diagnosis.mts trajectories   # runs 4 profiles to Level 40 (seconds)
npx tsx scripts/second-floor-price-diagnosis.mts facts|afford|sim|table|report
MACHINES='[1000,2500,6000,14000,30000,65000]' STAFF='{"server":[180,1200,6000],"cleaner":[700,3500]}' npx tsx scripts/second-floor-price-diagnosis.mts report
```

Everything labelled **assumption** is a guess, not data (§9).

## 1. Diagnosis: why the prices are too low

1. **The First Floor out-earns every machine within minutes.** At Level 5 even the _low-balance_ player can afford all six machines of the game as it is today
   within **9 levels (about 20 minutes of play)**. The whole set costs $5,550; the First Floor pays $330-$1,470 operating income per level at Levels 5-14.
2. **The Second Floor cannot compete with that.** Today a machine earns $10-$22 an hour (Coffee $400 pays back in **40 hours**), so its income is irrelevant next to
   the First Floor's ($456-$772 a level at Levels 5-9, rising to about $2,000-$2,700 by Level 25-34). Prices were set for a floor that nobody has to earn money on.
3. **The plan I wrote (not built) made it worse.** Its first four machines cost $25 / $75 / $250 / $650; the typical player buys **Coffee, Drinks and Pizza the minute
   the floor opens**, and 93-100 % of every early machine (through Burger) was paid with First Floor money. That is the weakness you saw.
4. The actual cause is a missing relation: **prices were never tied to the money the player has when the floor opens**. This proposal ties them to measured wallets.

## 2. Discrepancies found (game vs plan vs calculator vs docs)

| Item                 | The game today                                               | The plan (docs/planning/PHASE12...) and calculator   | Note                                                                      |
| -------------------- | ------------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| Income model         | fixed $/hour per machine, 8 / 9 / 10 h cap                   | customer cycles, tables, milestones, 4 / 5 / 6 h cap | **plan not built**; your brief describes the plan as if it existed        |
| Machine prices       | $400 / $550 / $750 / $1,000 / $1,300 / $1,550                | $25 / $75 / $250 / $650 / $1,800 / $5,000            | the plan is _cheaper_ at the start                                        |
| Staff                | Server $400, Cleaner $300 (flat)                             | Servers $30 / $250 / $1,600, Cleaners $100 / $900    |                                                                           |
| Upgrades             | $600-$3,850                                                  | $90-$26,000                                          |                                                                           |
| Unserved machine     | earns nothing without a Server; a missing cleaner takes 25 % | half speed; cleaner is a bonus only                  |                                                                           |
| Unlock               | Level 5 (`EARLY_UNLOCK_CAP`)                                 | Level 5                                              | same                                                                      |
| Campaign income used | the economy simulator                                        | the Saver's income ($354k to Level 148)              | the typical profile earns $264k                                           |
| Completionist target | `CLAUDE.md` says "at least $150k"                            | your brief: $100k-$150k                              | `restaurant-final-economy-qa` header says $100k-$150k; unresolved wording |

Consequence: **a price change alone cannot be applied to the game as it is today.** With today's $10-$22 an hour, a $1,000 Coffee machine would pay back in 100 hours.
The proposal below is therefore for the customer-cycle economy (Phase 12). §8 asks how you want to apply it.

## 3. What the First Floor actually gives (real game logic)

Profiles are the economy suite's own scenarios. Wallet = money when the player is about to start Level 5 (Level 4 done). Operating income = income minus running costs
(ingredients, wages, supplies), per level.

| Profile (scenario)                             | Wallet at unlock                                                 | Op. income per level: L5-9 | L10-14 | L15-24 | L25-34 |
| ---------------------------------------------- | ---------------------------------------------------------------- | -------------------------- | ------ | ------ | ------ |
| Saver (A: buys no items)                       | **$1,177**                                                       | $562                       | $958   | $1,102 | $1,878 |
| Typical (G: prudent completionist, keeps $500) | **$608**                                                         | $772                       | $1,063 | $1,145 | $2,689 |
| Low balance 1 (C: greedy completionist)        | **$64**                                                          | $688                       | $878   | $1,265 | $2,578 |
| Low balance 2 (broke start)                    | **$348**                                                         | $456                       | $770   | $1,080 | $1,536 |
| Frequent                                       | same wallet as Typical; plays 2 x 45 min a day instead of 2 x 20 |                            |        |        |        |

The typical profile spends its income on knives, boards, staff and kitchen tiers ($6,000 by Level 10), so its wallet stays near $600: what it can put into the floor is a
**share of income** (assumed 25 %), not a stockpile. Time per level is an **assumption** of 2.5 minutes (sensitivity at 4 and 6 in §6).

## 4. Current vs proposed prices

| Machine   | Today  | Plan (not built) | **Proposed** | Why                                                                                                              |
| --------- | ------ | ---------------- | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| Coffee    | $400   | $25              | **$1,000**   | typical player is $492 short (3 levels / 7 min of 25 % saving); the Saver can buy it at once; low-balance 14 min |
| Drinks    | $550   | $75              | **$2,500**   | about 9-13 levels of saving, or half a day of play with the floor running                                        |
| Pizza     | $750   | $250             | **$6,000**   | more than 5 times the Saver's whole unlock wallet; about 1 day                                                   |
| Burger    | $1,000 | $650             | **$14,000**  | a multi-day milestone (3 days typical)                                                                           |
| Ice Cream | $1,300 | $1,800           | **$30,000**  | later milestone (about 5-6 days)                                                                                 |
| Hot Food  | $1,550 | $5,000           | **$65,000**  | major goal (about 12 days; funded mostly by the floor itself)                                                    |

Ratios between machines: x2.5, x2.4, x2.33, x2.14, x2.17 (each step bigger in dollars, smaller in ratio, so the path to the next machine stays reasonable).

**Everything else that must move with them** (decided together, then validated; the calculator's 1,239 checks pass with this set):

|                                                                               | Plan (not built)                                  | **Proposed**                                               | Rule                                                                                                                           |
| ----------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Table #2                                                                      | $30 / $80 / $230 / $600 / $1,700 / $4,500         | **$190 / $460 / $1,150 / $2,800 / $6,950 / $16,000**       | follow the machine at half the exponent: plan price x (new machine / plan machine)^0.5; later tables x1.17 each as in the plan |
| Tier 2                                                                        | $90 / $270 / $850 / $2,300 / $5,200 / $11,500     | **$570 / $1,550 / $4,150 / $10,500 / $21,000 / $41,500**   | same rule                                                                                                                      |
| Tier 3                                                                        | $300 / $900 / $2,000 / $5,300 / $12,000 / $26,000 | **$1,900 / $5,200 / $9,800 / $24,500 / $49,000 / $93,500** | same rule                                                                                                                      |
| Floor Server 1 / 2 / 3                                                        | $30 / $250 / $1,600                               | **$180 / $1,200 / $6,000**                                 | Server 1 is cheaper than table #2 ($190): it is the first thing to buy after Coffee                                            |
| Floor Cleaner 1 / 2                                                           | $100 / $900                                       | **$700 / $3,500**                                          |                                                                                                                                |
| Guest price, cycle, tiers' multipliers, caps 4/5/6 h, milestones, level gates |                                                   | **unchanged**                                              | not touched                                                                                                                    |

Why tables and tiers follow only at half the exponent: if they scaled fully (my first attempt), the reinvestment loop died (Drinks needed 8 days of floor income only).
At half the exponent a floor-only player gets Drinks in 4 days (§5).

Single-table paybacks (with a Server): Coffee 16.7 h (table #2 pays back in 8.3 h), Drinks 31 h, Pizza 2.6 d, Burger 5.6 d, Ice Cream 11 d, Hot Food 23.5 d.
Late upgrades are long-term sinks: Hot Food Tier 3 ($93,500) adds $39 an hour per table, 100 days single-table payback (about 2-3x better with 10 tables). One of each
(machines $118,500 + Tier 2 $79,270 + Tier 3 $183,900 + staff $11,580 = **$393k**, before extra tables) against the typical player's $264k of First Floor income: the
floor remains a longer-term goal than the campaign, as it should.

## 5. Affordability by profile

"now" = wallet minus $100 pocket covers it. Otherwise: levels and minutes of play to save the price (2.5 min a level assumed; Saver puts in 100 % of operating income, the others
25 %). Source `afford`.

| Profile                  | Machine prices | Coffee        | Drinks         | Pizza          | Burger         | Ice Cream      | Hot Food       |
| ------------------------ | -------------- | ------------- | -------------- | -------------- | -------------- | -------------- | -------------- |
| Saver                    | **today**      | now           | now            | now            | now            | 1 lv / 1 min   | 1 lv / 3 min   |
| Typical                  | today          | now           | 1 lv / 1 min   | 2 lv / 4 min   | 3 lv / 7 min   | 5 lv / 11 min  | 6 lv / 13 min  |
| Low balance (greedy)     | today          | 3 lv / 6 min  | 4 lv / 8 min   | 5 lv / 11 min  | 6 lv / 14 min  | 7 lv / 16 min  | 8 lv / 20 min  |
| Low balance (broke)      | today          | 2 lv / 4 min  | 3 lv / 8 min   | 5 lv / 11 min  | 6 lv / 14 min  | 8 lv / 18 min  | 9 lv / 21 min  |
| Saver                    | plan           | now           | now            | now            | now            | 2 lv / 4 min   | 6 lv / 15 min  |
| Typical                  | plan           | now           | now            | now            | 1 lv / 3 min   | 6 lv / 15 min  | 18 lv / 45 min |
| Low balance (greedy)     | plan           | 1 lv / 1 min  | 1 lv / 1 min   | 2 lv / 4 min   | 4 lv / 9 min   | 10 lv / 23 min | 20 lv / 49 min |
| Low balance (broke)      | plan           | now           | now            | 1 lv / 1 min   | 4 lv / 9 min   | 11 lv / 26 min | 21 lv / 53 min |
| **Saver**                | **proposed**   | **now**       | 3 lv / 8 min   | 8 lv / 18 min  | 16 lv / 38 min | 25 lv / 1.0 h  | 44 lv / 1.8 h  |
| **Typical**              | **proposed**   | 3 lv / 7 min  | 9 lv / 21 min  | 21 lv / 51 min | 34 lv / 1.4 h  | 67 lv / 2.8 h  | 141 lv / 5.9 h |
| **Low balance (greedy)** | **proposed**   | 6 lv / 14 min | 12 lv / 29 min | 21 lv / 51 min | 35 lv / 1.5 h  | 67 lv / 2.8 h  | 138 lv / 5.7 h |
| **Low balance (broke)**  | **proposed**   | 6 lv / 14 min | 13 lv / 32 min | 24 lv / 1.0 h  | 44 lv / 1.8 h  | 82 lv / 3.4 h  | 165 lv / 6.9 h |

(These are play-time costs of saving First Floor money only; the full loop, including floor income, is the next section.)

## 6. Progression simulation (the full loop)

Ordered purchases, as a player is guided: Coffee, Server 1, Coffee tables 2-3, Drinks, Drinks table 2, Coffee Tier 2, Pizza, Server 2, Pizza table 2, Drinks Tier 2, Burger,
Cleaner 1, Coffee table 4, Pizza Tier 2, Burger table 2, Ice Cream, Burger Tier 2, Server 3, Hot Food, Cleaner 2, then more tables/tiers by best payback. Regular pattern
(2 x 20 min a day) unless stated; counter caps 4/5/6 h; Tier 3 from Level 30. Each cell: time since the floor opened, campaign level then, % of that price paid with
First Floor money (the rest was Second Floor collections). Source `sim`.

**Proposed prices, 2.5 minutes a level:**

| Profile                                       | Coffee          | Server 1 | Drinks           | Pizza           | Burger          | Ice Cream       | Hot Food         |
| --------------------------------------------- | --------------- | -------- | ---------------- | --------------- | --------------- | --------------- | ---------------- |
| Saver                                         | 0 min           | 5 min    | 15 min L11 100 % | 12.2 h L17 85 % | 24.3 h L27 86 % | 2.0 d L45 88 %  | 4.5 d L77 75 %   |
| Typical                                       | 10 min L9 100 % | 10 min   | 12.3 h L19 84 %  | 24.3 h L29 92 % | 3.0 d L53 59 %  | 5.5 d L97 55 %  | 12.5 d L148 23 % |
| Low balance (greedy)                          | 15 min L11      | 20 min   | 12.3 h L21 92 %  | 36 h L29 78 %   | 3.0 d L55 67 %  | 5.5 d L97 55 %  | 12.5 d L148 24 % |
| Low balance (broke)                           | 15 min L11      | 20 min   | 24 h L21 77 %    | 36.3 h L37 80 % | 3.5 d L63 59 %  | 6.5 d L109 47 % | 14.5 d L148 13 % |
| Frequent (2 x 45 min)                         | 10 min L9       | 10 min   | 40 min L21 99 %  | 12.3 h L29 81 % | 36 h L59 71 %   | 3.0 d L115 65 % | 10.5 d L148 5 %  |
| **Floor income only after Coffee + Server 1** | 0               | 0        | **4 d**          | **7 d**         | **12 d**        | **18 d**        | **28 d**         |

**Sensitivity to the level duration** (assumption), typical profile:

| Minutes per level | Coffee | Drinks | Pizza  | Burger | Ice Cream | Hot Food |
| ----------------- | ------ | ------ | ------ | ------ | --------- | -------- |
| 2.5               | 10 min | 12.3 h | 24.3 h | 3.0 d  | 5.5 d     | 12.5 d   |
| 4                 | 15 min | 24.1 h | 2.0 d  | 4.0 d  | 7.5 d     | 14.0 d   |
| 6                 | 20 min | 36.2 h | 3.0 d  | 5.5 d  | 9.5 d     | 16.5 d   |

The floor-only row does not depend on the level duration.

**Reading the results**

- The brief's shape is met: Coffee after a short, real saving (7-15 minutes for typical and low-balance; the Saver has it at once); Drinks and Pizza take half a day to a day
  and a deliberate reinvestment (they used to take 0 minutes); Burger is a multi-day milestone; Ice Cream and Hot Food are 5-6 day and 12 day goals, in the order asked.
- **The First Floor still pays most of the price of Drinks and Pizza (84 % and 92 %)** for the typical player, because the floor earns little in its first day. The change is that
  it now takes 10-20 levels and 12-24 hours instead of nothing. By Burger the floor pays 41 %, by Hot Food 77 %. Pushing the First Floor's share lower would mean making the
  early machines nearly unaffordable, which contradicts "attainable".
- **Floor-only players** progress: second machine in 4 days, third in a week. Slow, but this is the extreme case (no First Floor money at all); the same player with a normal
  campaign gets Drinks in half a day.

**Does the Second Floor dominate the First Floor?** (campaign ends when Level 148 is reached; "floor share" = Second Floor's share of combined income on that day)

| Typical wallet, pattern             | Plan prices: floor share then                     | **Proposed prices: floor share then** | Floor out-earns the campaign |
| ----------------------------------- | ------------------------------------------------- | ------------------------------------- | ---------------------------- |
| Regular (2 x 20 min), 2.5 min/level | 45 %                                              | **16 %**                              | never                        |
| Regular, 4 min/level                |                                                   | 26 %                                  | never                        |
| Regular, 6 min/level                |                                                   | 38 %                                  | from day 22 (the last day)   |
| Frequent (2 x 45 min)               | 24 %                                              | **7 %**                               | never                        |
| Slow campaign, regular floor visits | 87 % (floor passes campaign from day 7, Level 33) | **79 %**                              | from day 9 (Level 41)        |

So the rebalance **cuts the floor's share of income during the campaign by about two thirds** for normal players and leaves the (structural) case of a player who barely
advances the campaign unchanged. Income reported separately: First Floor $264,034 vs Second Floor $48,933 (regular) at the campaign end; the maxed floor reaches about
$3,200-$3,300 an hour by day 90, as in the plan.

## 7. What does not change (Step 5 rules)

- Wallet, ledger, SaveManager, purchase validation: untouched; prices are constants in the machine table; every buy stays all-or-nothing with one ledger entry.
- **No save field added.** Old saves keep what they own (machines, tiers, tables, staff), pay nothing again and are refunded nothing; only future purchases cost the new prices.
- First Floor prices and earnings are **not** touched (the analysis shows prices alone solve it).
- Customer cycles, guest prices, staff mechanics, tiers' multipliers, caps and the Tier 3 gate are unchanged.

## 8. Options for applying it (needs your decision)

- **A (recommended): fold the new prices into Phase 12.** The proposal is built for the customer-cycle income; applying it when the cycle model is built means one price
  set, one test pass, no throwaway work.
- **B: change the numbers in `secondFloor.ts` today.** The game's current rates ($10-$22 an hour) make the prices above nonsensical (Coffee payback 100 h). A price-only change on
  today's model would need either much lower prices (which stay too easy) or higher income. I do not recommend it.

## 9. Assumptions and limitations (not data)

- 2.5 minutes a level; sensitivity at 4 and 6. Wallets and incomes are real simulator output, but only for the economy's four scripted playstyles.
- Share of operating income put into the floor: Saver 100 %, others 25 % (guess). Pocket money kept: $100.
- The patterns (2 x 20 min, 2 x 45 min, 4 visits of 1 level) are invented schedules. The buyer follows the stated order, then best payback.
- The plan's cycle model is itself a proposal; the table of paybacks above comes from the calculator, not from a built game.
- I relaxed one **calculator** invariant (Tier 2 may cost less than the machine; Tier 3 must still cost more than both). No game test was touched.

## 10. Tests and QA after approval (not run yet; nothing was implemented)

Add or update: exact machine prices and the Level 5 unlock; insufficient funds changes nothing; wallet and ledger sum after every purchase; the four profile
progressions (Saver, Typical, Frequent, Low balance) as a regression of the table in §6; First Floor income vs machine affordability (first four are never "now" for the
typical profile); a full machine progression with no negative balance and no duplicate payout; old-save compatibility (owned machines, no refund, no charge). Then
`tsc`, ESLint, Prettier on changed files, the QA suites the change touches, build, and browser checks at 320 and 390 px. Browser failures will be compared with
the known stale list in `docs/HANDOFF.md` (`restaurantday`, `restaurantcleanliness`, `restaurantshift`, `restaurantfirstlevels`, `paidorders`) and not reported as new.

## 11. Decisions I need from you

1. **Approve the price curve?** Machines $1,000 / $2,500 / $6,000 / $14,000 / $30,000 / $65,000; Servers $180 / $1,200 / $6,000; Cleaners $700 / $3,500; tables and tiers as in §4.
2. **A or B** (§8): build it with Phase 12 (my recommendation), or change today's table now?
3. Is **"typical = the prudent completionist who keeps $500"** the right reference? (A typical player who spends everything gets Coffee 6 levels / 14 minutes later.)
4. Late upgrades (Hot Food Tier 3 $93,500) are long-term sinks: keep them, or lower the top tiers?
5. Floor-only players wait 4 days for the second machine. Acceptable, or should Drinks be cheaper?
6. `CLAUDE.md` still says the completionist ends with at least $150k, your brief says $100k-$150k: which should the docs keep?

## 12. Changed files and git state

New (untracked, uncommitted): `docs/planning/SECOND-FLOOR-PRICE-REBALANCE-PROPOSAL-2026-11-02.md`, `scripts/second-floor-price-diagnosis.mts`.
Earlier untracked planning files from this phase: `docs/planning/PHASE12-...md`, `scripts/second-floor-cycles-plan-sim.mts` (extended this round: two spending purses, ordered
goals, staff and cycle overrides, one relaxed invariant). No game source file changed. Last commit: `2a02ab7`. Nothing was pushed, merged or deployed.
