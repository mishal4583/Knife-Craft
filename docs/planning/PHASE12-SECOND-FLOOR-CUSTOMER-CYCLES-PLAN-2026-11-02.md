# Phase 12 (PLAN, revision 3): a Second Floor that is fun to start and easy to love (developer 2026-11-02)

Status: **revised plan, waiting for approval. Nothing is built, committed or deployed.** This revision applies the developer's decisions of
2026-11-02: keep the $25 Coffee machine, the 12-second first cycle and the $0.20 first guest; keep the $30 first Floor Server; approve exactly
one new save field (tables owned per station); cleaners never reduce popularity; the completionist campaign target is **$100k-$150k**;
campaign and Second Floor income are reported separately; initial counter caps 4 / 5 / 6 hours.

All numbers are **estimates from the planning calculator** `scripts/second-floor-cycles-plan-sim.mts` (not game code, not a QA suite; it imports
nothing from `src/`). Run `npx tsx scripts/second-floor-cycles-plan-sim.mts <validate|stations|tables|guided|patterns|compare|sensitivity|buys|tune>`.
Assumptions are in §10. **Nothing here is measured player data.**

## 1. The experience (vision)

**Buy a machine, watch your first guest walk up and pay, tap the pile, and a minute later you can already upgrade. Hire a helper and the machine
runs while you play. Every few minutes something new is within reach. Come back later and your counter is full of coins.**

Loop: **buy -> watch customers arrive -> they order, eat, pay -> collect a satisfying payout -> upgrade -> automate -> expand.**

First-session promises on the guided path (§5), for a player who keeps playing levels. The Floor opens at Level 5:

| Moment                             | When             |
| ---------------------------------- | ---------------- |
| First machine bought (Coffee, $25) | at once          |
| First guest pays $0.20             | 12 seconds later |
| First cash collected               | under 1 minute   |
| First Floor Server ($30)           | about 3 minutes  |
| First extra table ($30)            | about 5 minutes  |
| Second machine (Drinks, $75)       | about 11 minutes |
| Third machine (Pizza, $250)        | about 29 minutes |
| Purchases in the first half hour   | 8 (§5)           |

## 2. Staged unlock and onboarding

The Floor keeps opening at Level 5 (developer rule 2026-10-26). Pacing comes from **price**, not locks. The only level gate is **Tier 3 from Level 30**;
Tier 2 and tables are open from the start. In the calculator a player had an affordable purchase blocked by that gate on only 0-4 % of visits
(the earlier gated proposal blocked 96-99 %, which is exactly the "money you cannot spend" feeling this revision removes).

1. **Level 5:** the Stairs open; a guide card (computed from the save like the first-run hand; no new field) says "Buy your first machine: Coffee, $25".
2. **First guest** (12 s): the machine lights up, a guest walks in, sits, a coin bursts when they pay. The pile starts to grow.
3. **First collection:** "Tap your cash." The pile is tapped or swiped (existing `TableCash`); one ledger entry.
4. **Floor Server ($30):** "Hire help and it runs while you play." The sheet shows what changes (§7).
5. Then, always one clear next step, judged by the floor's own rules (the Phase 11 lesson): table 2 ($30), Drinks ($75), table 3, Drinks table 2, Pizza
   ($250), Server 2 ($250), Coffee Tier 2 ($90)...
6. **No free money.** The first Server is bought, not gifted (CLAUDE.md: nothing is given free). A player who only visits every few hours buys it on the
   next visit (§6).

## 3. Complete price and earnings table

Guest price = what one guest pays at **one table**. "Hourly" is an average with a Floor Server and **one** table; it is a display number only, the game
pays per guest. Tier 2: guest x1.25, cycle x0.94. Tier 3: guest x1.50, cycle x0.90. Payback = price / hourly added, with a Server.

| Station   | Buy    | Tier 2  | Tier 3  | Cycle / guest, T1 | T2             | T3             | Hourly T1 / T2 / T3 | Payback buy / T2 / T3   | Table #2 |
| --------- | ------ | ------- | ------- | ----------------- | -------------- | -------------- | ------------------- | ----------------------- | -------- |
| Coffee    | $25    | $90     | $300    | 12.0 s / $0.20    | 11.3 s / $0.25 | 10.8 s / $0.30 | $60 / $80 / $100    | 25 min / 4.5 h / 14.8 h | $30      |
| Drinks    | $75    | $270    | $900    | 18.0 s / $0.40    | 16.9 s / $0.50 | 16.2 s / $0.60 | $80 / $106 / $133   | 56 min / 10.2 h / 33 h  | $80      |
| Pizza     | $250   | $850    | $2,000  | 30.0 s / $0.80    | 28.2 s / $1.00 | 27.0 s / $1.20 | $96 / $128 / $160   | 2.6 h / 26.8 h / 2.6 d  | $230     |
| Burger    | $650   | $2,300  | $5,300  | 45.0 s / $1.30    | 42.3 s / $1.63 | 40.5 s / $1.95 | $104 / $139 / $173  | 6.3 h / 2.8 d / 6.4 d   | $600     |
| Ice Cream | $1,800 | $5,200  | $12,000 | 65.0 s / $2.00    | 61.1 s / $2.50 | 58.5 s / $3.00 | $111 / $147 / $185  | 16 h / 5.9 d / 13 d     | $1,700   |
| Hot Food  | $5,000 | $11,500 | $26,000 | 100 s / $3.20     | 94 s / $4.00   | 90 s / $4.80   | $115 / $153 / $192  | 43 h / 12.6 d / 28 d    | $4,500   |

Everything on the floor with one table each: machines $7,800 + Tier 2 $20,210 + Tier 3 $46,500 + staff $2,880 = **$77,390** (before extra tables;
the old floor: $29,550). Guest prices of Tier 1 never change from the approved numbers; later stations use **longer cycles** to stay in range
(prioritising cycle pacing over cutting a guest price, as requested).

**Table prices** (table #k = `round(T x 1.17^(k-2))` where T is "Table #2"; total to own 50 tables per station in the last column) and what each adds
(hourly, with a Server, and its payback):

| Station   | #2                   | #3                | #5                 | #10                | #25                  | #50                   | all 50 |
| --------- | -------------------- | ----------------- | ------------------ | ------------------ | -------------------- | --------------------- | ------ |
| Coffee    | $30 (+$23, 1.3 h)    | $35 (+$16, 2.2 h) | $48 (+$11, 4.4 h)  | $105 (+$12, 8.9 h) | $1,110 (+$15, 3.1 d) | $56,240 (+$20, 119 d) | $387k  |
| Drinks    | $80 (+$30, 2.6 h)    | $94 (+$22, 4.3 h) | $128 (+$15, 8.7 h) | $281 (+$16, 18 h)  | $2,961 (+$20, 6.3 d) | $150k                 | $1.03M |
| Pizza     | $230 (+$37, 6.3 h)   | $269              | $368               | $808               | $8,511               | $431k                 | $2.97M |
| Burger    | $600 (+$40, 15 h)    | $702              | $961               | $2,107             | $22,204              | $1.12M                | $7.74M |
| Ice Cream | $1,700 (+$42, 40 h)  | $1,989            | $2,723             | $5,969             | $62,911              | $3.19M                | $21.9M |
| Hot Food  | $4,500 (+$44, 4.3 d) | $5,265            | $7,207             | $15,802            | $167k                | $8.44M                | $58.0M |

So Coffee and Drinks reach their 25-table goal in weeks; the later stations' 25 and 50 are long-term goals (the table says so honestly: it is
deliberate, so late tables are a sink, not a ramp).

**Guests per cycle (diminishing)** with n tables: 1 -> 1.00, 2 -> 1.38, 3 -> 1.60, 4 -> 1.76, 5 -> 1.89, 8 -> 2.14, 10 -> 2.27, 15 -> 2.49, 25 -> 2.77,
50 -> 3.15. Each table adds fewer guests because the machine gets busy. **Milestones** multiply that station's income and are absolute (not stacked):
3 tables x1.03, 5 x1.06, **10 x1.12**, **25 x1.20**, **50 x1.30**. The big three also get a golden badge, a coin burst and a named title
("Busy Coffee Bar" ...) so they feel like goals, not just a percentage. Small ones before 10 (3 and 5) arrive within the first hour for Coffee.

**Staff (one-time, no wages)**

| Role          | Prices              | Covers                               | What it does                                                     |
| ------------- | ------------------- | ------------------------------------ | ---------------------------------------------------------------- |
| Floor Server  | $30 / $250 / $1,600 | 2 machines each, in the order bought | the machine runs at full speed and the counter holds 4 / 5 / 6 h |
| Floor Cleaner | $100 / $900         | 3 machines each                      | **+10 % guest tips** on those machines. Positive only.           |

**Counter caps** (hours of guests the counter holds with a Server, by Tier 1 / 2 / 3): **4 / 5 / 6 h** proposed, compared with the old 8 / 9 / 10 h in §8.
Without a Server: half speed and a 10-minute counter ("runs, but you must visit").

**Mill precision.** The calculator's validator (1,239 checks, 0 failures) first **failed** the whole-cent model: at 20 cents a guest, table #19 and later
added less than one cent per cycle and rounded to nothing. The plan therefore computes a cycle's pay in **mills (1/1000 of a cent) as an integer**:
`mills = floor(guestPrice x guestsPermille x milestonePermille x cleanerPermille / 1,000,000)`, and the wallet is credited in whole cents when the
pile is collected (`floor(sum of cycles x mills / 1000)`). Rounding loss is under 0.003 % in every case, so online and offline agree.

## 4. Consistency checks (run by `validate`)

1,239 checks, 0 failures. They assert, for every station: machine, Tier 2 and Tier 3 prices rise; machines rise with the station; cycle shortens and
guest price and hourly rise with each tier; Tier 1 hourly rises station to station; machine payback does not fall below the previous station's;
each upgrade pays back slower than the one before; **every one of the 49 table prices is an integer, rises, and adds positive income (also across a
milestone)**; each table adds fewer guests than the one before (checked against the exact formula, with the permille table within half a permille);
milestones rise; the first Server costs no more than the first extra table; Tier 3 cycles stay at least 8 s so each guest can be drawn; the new caps
are shorter than the old; mill rounding loss under 0.5 %. The only payback "dips" are at milestone steps (expected: a milestone is a bonus).

## 5. Time to afford and payback (guided path)

For an **active** player (keeps playing levels at 2.5 min a level - an assumption, §10 - collects every few minutes, puts 5 % of the campaign's pay
into the floor). The level column is the campaign level the player would be on.

| Step                             | Price  | Wait   | Elapsed | Level | Adds $/h | Payback | $/h after |
| -------------------------------- | ------ | ------ | ------- | ----- | -------- | ------- | --------- |
| Buy Coffee                       | $25    | 0      | 0       | 5     | +$30     | 50 min  | $30       |
| Floor Server 1                   | $30    | 3 min  | 3 min   | 6     | +$30     | 1.0 h   | $60       |
| Coffee table 2                   | $30    | 2 min  | 5 min   | 7     | +$23     | 1.3 h   | $83       |
| Buy Drinks                       | $75    | 6 min  | 11 min  | 9     | +$80     | 56 min  | $163      |
| Coffee table 3 (milestone x1.03) | $35    | 2 min  | 13 min  | 10    | +$16     | 2.2 h   | $179      |
| Drinks table 2                   | $80    | 3 min  | 16 min  | 11    | +$30     | 2.6 h   | $210      |
| Coffee table 4                   | $41    | 2 min  | 18 min  | 12    | +$10     | 4.2 h   | $219      |
| Buy Pizza                        | $250   | 10 min | 29 min  | 16    | +$48     | 5.2 h   | $267      |
| Coffee table 5 (milestone x1.06) | $48    | 2 min  | 31 min  | 17    | +$11     | 4.4 h   | $278      |
| Drinks table 3                   | $94    | 4 min  | 34 min  | 18    | +$22     | 4.3 h   | $300      |
| Floor Server 2                   | $250   | 10 min | 44 min  | 22    | +$48     | 5.2 h   | $348      |
| Coffee Tier 2                    | $90    | 2 min  | 46 min  | 23    | +$40     | 2.3 h   | $388      |
| Drinks Tier 2                    | $270   | 7 min  | 53 min  | 26    | +$44     | 6.2 h   | $431      |
| Buy Burger                       | $650   | 16 min | 1.1 h   | 32    | +$104    | 6.3 h   | $535      |
| Floor Cleaner 1                  | $100   | 2 min  | 1.2 h   | 33    | +$43     | 2.3 h   | $578      |
| Pizza Tier 2                     | $850   | 17 min | 1.6 h   | 42    | +$48     | 18 h    | $676      |
| Buy Ice Cream                    | $1,800 | 27 min | 2.0 h   | 53    | +$55     | 33 h    | $731      |
| Burger Tier 2                    | $2,300 | 33 min | 2.6 h   | 67    | +$35     | 2.8 d   | $774      |
| Buy Hot Food                     | $5,000 | 1.2 h  | 3.8 h   | 95    | +$58     | 3.6 d   | $832      |
| Floor Server 3                   | $1,600 | 23 min | 4.2 h   | 105   | +$113    | 14 h    | $945      |

**Time to purchase by pattern** (since the floor opened; the grid shows the first visit that can afford it. Source `buys`):

| Pattern                      | Server 1 | Drinks | Pizza  | Server 2 | Coffee T2 | Burger | Ice Cream | Hot Food | Coffee table 10 |
| ---------------------------- | -------- | ------ | ------ | -------- | --------- | ------ | --------- | -------- | --------------- |
| Short session once daily     | 5 min    | 10 min | 2 d    | 2 d      | 1 d       | 2 d    | 4 d       | 7 d      | 3 d             |
| Regular twice daily          | 5 min    | 10 min | 12 h   | 12 h     | 12 h      | 1 d    | 2 d       | 3 d      | 1 d             |
| Frequent check-ins           | 5 min    | 3 h    | 6 h    | 9 h      | 6 h       | 12 h   | 1 d       | 1.5 d    | 12 h            |
| Long session                 | 5 min    | 10 min | 45 min | 50 min   | 25 min    | 1.5 h  | 1 d       | 3 d      | 1 d             |
| Slow campaign, regular floor | 4 h      | 8 h    | 12 h   | 12 h     | 8 h       | 1 d    | 1.3 d     | 2.2 d    | 1 d             |
| Fast campaign, rare floor    | 1 h      | 1 h    | 1 h    | 1 h      | 1 h       | 3 d    | 6 d       | 9 d      | 3 d             |

## 6. Player patterns (explicit definitions, not one fixed level count)

Every pattern is defined by sessions (when, how long) and floor visits during them; levels played = session minutes / minutes per level (assumed),
except the slow-campaign pattern which plays one level a visit regardless. 5 % of the campaign's pay goes into floor purchases (assumption).

| Id        | Pattern                                    | Floor visits                                              |
| --------- | ------------------------------------------ | --------------------------------------------------------- |
| short     | Short session, once daily                  | 10 min at 20:00, every 5 min                              |
| regular   | Regular sessions, twice daily              | 2 x 20 min (8:00, 20:00), every 5 min                     |
| frequent  | Frequent check-ins                         | 6 x 5 min every 3 h from 8:00                             |
| long      | Long-session player                        | 1 x 90 min at 19:00, every 5 min                          |
| slowfloor | Slow campaign, regular floor collection    | 4 visits a day of 3 min, 1 level each                     |
| fastrare  | Fast campaign, rarely returns to the floor | 60 min every 3rd day, floor only at the start and the end |

## 7. Manual to automation

- A bought machine **starts working at once** (no tap grind). The player's action is collecting the pile (tap or swipe).
- **Without a Floor Server:** half speed and the counter holds 10 minutes ("runs, but visit often").
- **With a Floor Server:** full speed, and the counter holds 4 / 5 / 6 hours. The sheet states the three changes ("2x faster, 24x storage, runs while you play").
- **Coverage is never a trap:** a Server covers the next two machines in the order bought, a new machine uses spare capacity, and the sheet always shows
  who serves what ("Served by Server 1" / "No Server yet: half speed, holds 10 minutes"). There is no wrong staff to buy.
- **Cleaners are a bonus:** +10 % tips on 3 machines each. There is no penalty, no missing-cleaner warning, and **`floorPopularityDelta` stops multiplying by
  `cleanFactor`** (the floor's popularity depends only on working machines; developer 2026-11-02). Tests change with the rule.
- No new save field for hand mode (a "tap to rush" boost would need a field and invites tap grinding; excluded).

## 8. Counter caps: 4/5/6 vs 8/9/10 (and alternatives)

Source `compare` (campaign share = floor's share of combined income on the day the campaign ends; "lost" = share of the floor's potential income the
counter could not hold):

| Pattern   | Caps                | Campaign ends | Floor share then | Floor then       | Lost to cap  | Floor out-earns campaign from |
| --------- | ------------------- | ------------- | ---------------- | ---------------- | ------------ | ----------------------------- |
| short     | 8/9/10              | day 36        | 72 %             | $928k            | 58 %         | day 7 (L33)                   |
| short     | **4/5/6**           | day 36        | **59 %**         | $499k            | 74 %         | day 12 (L53)                  |
| short     | 3/4/5               | day 36        | 52 %             | $390k            | 79 %         | day 19 (L81)                  |
| short     | 2/3/4               | day 36        | 45 %             | $288k            | 83 %         | day 31 (L129)                 |
| regular   | 8/9/10              | day 9         | 52 %             | $381k            | 14 %         | day 8 (L133)                  |
| regular   | **4/5/6**           | day 9         | **36 %**         | $195k            | 47 %         | never                         |
| regular   | 3/4/5               | day 9         | 30 %             | $150k            | 56 %         | never                         |
| frequent  | 8/9/10              | day 12        | 67 %             | $725k            | 0 %          | day 7 (L89)                   |
| frequent  | **4/5/6**           | day 12        | **64 %**         | $619k            | 12 %         | day 7 (L89)                   |
| long      | 8/9/10 -> 4/5/6     | day 4         | 11 % -> 7 %      |                  | 52 % -> 69 % | never                         |
| slowfloor | 8/9/10 -> **4/5/6** | day 36        | 87 % -> 84 %     | $2.38M -> $1.90M | 8 % -> 25 %  | day 7 (L33)                   |
| fastrare  | 8/9/10 -> 4/5/6     | day 16        | 18 % -> 11 %     |                  | 85 % -> 90 % | never                         |

**Trade-offs.** Shorter caps are the most effective lever that keeps guest prices intact: they move a regular player's campaign-end floor share from
52 % to 36 % (the patterns that check in often barely notice: 12 % lost). They cost the rarely-visiting player a lot (74-90 % of potential floor money
cannot be held), which is the idle-game bargain (frequent returns are rewarded) but can feel harsh. Because the Server doubles the speed and the cap
is the only reason to return, caps below 3 h make the floor feel like a chore.

**Recommendation: 4 / 5 / 6 h, as you proposed.** It is the first cap set that makes the regular player _not_ out-earn the campaign (and the
long-session and rare-floor players clearly not), while a 3-hour check-in rhythm loses almost nothing. Revisit with Playgama telemetry (collections
per session, time between visits) before changing it. A rewarded-ad "stay open late" that doubles the cap once a day is a possible kindness for
the once-a-day player; it needs a new ad placement and is **not** included (open question E).

## 9. Does the floor become the dominant income, and when? (the main finding)

Campaign = the Saver simulation's pay for the levels played since Level 5. Floor = collections. Combined = both. "Dominant" = the floor out-earns the
campaign over every 7-day window until the campaign ends; "d7" means from the first measurable week. Level 2.5 min, 4/5/6 h, source `patterns`.

| Pattern   | Day 3 (campaign / floor, floor share) | Day 7                 | Day 30                                      | Campaign ends | Floor share then | Dominant from    |
| --------- | ------------------------------------- | --------------------- | ------------------------------------------- | ------------- | ---------------- | ---------------- |
| short     | $9.9k / $2.2k, 18 %                   | $35.8k / $21.7k, 38 % | $289k / $383k, 57 %                         | day 36        | 59 %             | **day 12 (L53)** |
| regular   | $86k / $23.6k, 22 %                   | $266k / $128k, 32 %   | $354k / $1.04M, 75 % (campaign ended day 9) | day 9         | 36 %             | **never**        |
| frequent  | $52k / $66.9k, 56 %                   | $187k / $289k, 61 %   | $354k / $1.91M, 84 %                        | day 12        | 64 %             | **day 7 (L89)**  |
| long      | $255k / $15.1k, 6 %                   | $354k / $71.6k, 17 %  | $354k / $574k, 62 %                         | day 4         | 7 %              | **never**        |
| slowfloor | $9.9k / $38.6k, 80 %                  | $35.8k / $180k, 83 %  | $289k / $1.53M, 84 %                        | day 36        | 84 %             | **day 7 (L33)**  |
| fastrare  | $28.2k / $5, 0 %                      | $154k / $10.0k, 6 %   | $354k / $107k, 23 %                         | day 16        | 11 %             | **never**        |

Maximum floor income reached in 90 days: **about $3,200-$3,800 an hour** (6 machines at Tier 3, about 140-240 tables), against a campaign that pays about
$354k in total. After Level 148 the campaign pays nothing, so any floor is then "the income"; the comparison that matters is while the campaign runs.

**Reading it honestly.**

- A _regular_ player (twice daily), a _long-session_ player and a _rarely-returning_ player never see the floor out-earn the campaign. Good.
- A player who **checks the floor often** (frequent, slowfloor) sees the floor pass the campaign in the first week, and a once-daily _short_ player does so
  by Level 53. This is not a tuning error: the floor pays per real hour, the campaign pays per level played, and the whole campaign (about $354k) is worth
  only a few days of a full floor. For those players the floor is their second main income, the campaign is the story.
- **The levers I was told to try first (milestones, table and tier pacing, caps, cycle length) were tried, and moved the share by single digits to 15 points**
  (round 2 numbers: regular 51 %, frequent 74 %, slowfloor 88 % -> now 36 / 64 / 84 %). As a **last resort**, cutting the guest price of Pizza..Hot Food by
  40 % changed frequent from 64 % to 55 % and slowfloor from 84 % to 79 %; a 60 % cut gave 49 % and 75 %. The floor stays dominant for the
  frequent player even then, because the early machines (Coffee, Drinks) and the diminishing tables carry it. **I did not cut any guest price.**
- **Floor money never enters the campaign target.** The $100k-$150k completionist target and `restaurant-final-economy-qa` are measured without it. The
  single wallet means floor money can buy campaign things sooner (kitchen tiers $89k, knives), but those stay level-gated, so nothing is skipped.
- The wallet gets an extra "Floor report" (read-only, from the ledger kind `automation-income`, entry ref `floor`): campaign income, floor income, combined, and
  the share, so you can watch this live after release.

**Sensitivity to the level duration** (source `sensitivity`; cell = campaign end day | floor share then | dominant from):

| Pattern   | 1.5 min/level         | 2.5 min/level (assumed) | 4 min/level             | 6 min/level           |
| --------- | --------------------- | ----------------------- | ----------------------- | --------------------- |
| short     | d22 / 42 % / never    | d36 / 59 % / d12 (L53)  | d58 / 72 % / d7 (L22)   | d86 / 81 % / d7 (L16) |
| regular   | d6 / 24 % / never     | d9 / 36 % / never       | d15 / 53 % / d10 (L105) | d22 / 65 % / d7 (L51) |
| frequent  | d8 / 51 % / d8 (L148) | d12 / 64 % / d7 (L89)   | d20 / 77 % / d7 (L57)   | d29 / 83 % / d7 (L40) |
| long      | d3 / 5 % / never      | d4 / 7 % / never        | d7 / 16 % / never       | d10 / 23 % / never    |
| slowfloor | d36 / 84 % / d7 (L33) | same                    | same                    | same                  |
| fastrare  | d10 / 6 % / never     | d16 / 11 % / never      | d28 / 21 % / never      | d43 / 33 % / never    |

The **level duration decides a lot**: if a level really takes 4-6 minutes, even the regular player's floor passes the campaign (from L105 / L51). The
conclusion "regular players are not dominated" holds only if levels are short. This must be measured (open question A).

## 10. What the calculator assumes (labels, not facts)

- **Minutes per level = 2.5 (my assumption, not measured)**, with sensitivity at 1.5 / 4 / 6. Levels per session = session minutes / that.
- Campaign pay per level is linear between the checkpoints of `economy-final-sim` scenario A (Saver): cumulative $256 at Level 1, $5,269 at 10, $15,438 at
  20, $32,422 at 30, $51,832 at 40, $80,021 at 50; held at the Level 40-50 rate to Level 148 (about $354k). That is the Saver's income, not the
  completionist's net; both include no floor money.
- The six patterns are invented schedules (§6). Real schedules should replace them once Playgama telemetry exists.
- "5 % of the campaign's pay goes to the floor" is a guess; at 0 % the early steps are slower, at 10 % faster.
- The buyer is greedy (best payback; saves for the best option unless a purchase within 1.5x of its payback is affordable) and collects at every visit. Real
  players are less efficient, so these curves are **upper bounds for floor growth**.
- Pending money is modelled as a continuous rate with the counter caps; the real game counts whole cycles in integer mills (§11).

## 11. Fractional cycle progress, offline and reloads (exact once)

**State (no new field for this):** each station's existing `lastCollectAt` (epoch ms) is the **anchor**: the start of the cycle chain that has not been
paid yet. Everything else is derived on read, so a reload cannot change it.

- `elapsed = now - anchor` (`0` if `now < anchor`).
- `cyclesDone = min(floor(elapsed / cycleMs), capCycles)`, `capCycles = floor(capHours x 3,600,000 / cycleMs)`.
- `pendingMills = cyclesDone x millsPerCycle`. The pile shows `floor(sum over stations of pendingMills / 1000)` cents.
- The **fraction of the current cycle** is `(elapsed mod cycleMs) / cycleMs` and is what the animation shows. It is not stored.
- **Collect** (one atomic `SaveManager` write: credit, ledger entry, anchors): pays `P = floor(sum pendingMills / 1000)` cents, appends ONE
  `automation-income` ledger entry for `P` (none if `P = 0`), and moves each anchor forward by `cyclesDone x cycleMs`, so the in-progress fraction is kept.
  If the cap was hit, the anchor becomes `now - (elapsed mod cycleMs)`: the cap loses whole cycles, **never the partial one**. At most 0.999 cent in total is
  lost to rounding per collection (stated, validated by the calculator's loss figures).
- **Purchases that change cycle length or pay** (Tier, Server hire, tables): bank the pending money first (as today: one `automation-income` entry, then the purchase
  entry), compute the saved fraction `f`, and set `anchor = now - round(f x newCycleMs)`. A table purchase changes only pay, so `f` is unchanged.
- **Buying a station:** its anchor is `now`.
- **Returning just before a cycle completes:** `elapsed mod cycleMs` is kept, so the next cycle finishes seconds later; nothing is lost.
- **Reload, force-quit, tab restore:** no state is held outside the save; the same `now` formula gives the same result. A collect either completes
  (credit + ledger + anchors) or does not, because it is one write (SaveManager's all-or-nothing save).
- **Clock changes:** `now < anchor` gives 0 pending and the anchor **never moves backwards**. A forward jump is bounded by the cap; jumping back then forward again
  gains nothing because the anchor already sits at the later time. The UI says "Clock looks wrong; income resumes at HH:MM" if a station is waiting on its anchor.

## 12. Collection feedback and the offline summary

- **The pile** (existing `TableCash` art) grows with the pending amount in five visual stages (a few coins, a stack, a bag, a full till, FULL) and a header "N guests
  paid, $X". "Counter full in 2 h 10 m" uses the same functions as the money.
- **Collecting:** tap or swipe the pile. A count-up of the amount (600 ms), coins fly to the wallet chip, a short synthesized "ka-ching" via `AudioManager`, a little
  haptic if the platform allows, and the station tiles show their ring of the current cycle. The ad offer ("Double it") stays as today.
- **Offline summary:** the existing welcome-back sheet and Closing Time gain a Floor line: "While you were away: 214 guests paid $63.20. Counter full after
  4 h, you missed about $41." The "missed" number is information (potential minus held) from the same function.
- **Visual cash never pays.** The animation component reads a number it is handed and imports nothing from the wallet, ledger or `SaveManager`
  (a static test, like the Floor Life guard); only `collectFloor` moves money, once.
- **320 px and 390 px:** the station sheet scrolls, its header (close button) stays visible, targets are at least 48 px, no sideways scroll.

## 13. Save migration and exploit safeguards

**Exactly one new persisted value:** `business.secondFloor.stations[id].tables?: number` (optional, missing = 1, clamped 1-50). Nothing else is added:
no cycle clock, pile, hand state or bonus flag; cleaner bonus derives from `cleaners`; the pile derives from anchors.

- **Existing players** keep their stations, tiers (Lv 1-3 become Tier 1-3), Servers and Cleaners, and get `tables = 1` per station. **No refund, no charge,
  no re-buy.** What changes is the formula going forward: an owned Lv 1 Coffee goes from $10 an hour to $60, and an unstaffed machine now runs at
  half speed instead of earning 0. The pile already waiting is bounded by the new cap (at most 4-6 h at the new rate) and is the only windfall.
- **Old Servers/Cleaners** keep coverage; the 25 % cleaner penalty and its popularity effect are removed.
- **Exact-once payment:** one atomic write per collect; second tap finds 0; no ledger entry for 0; offline equals online (same function, larger `now`).
- **No negative balance, free stock or alternate payment path:** purchases use the existing all-or-nothing debit; cycles never debit.
- **Determinism:** no `Math.random()`; guest looks from the seeded generator; the guests-per-table values are an integer lookup table, not `Math.log`.
- **Bounds:** tables <= 50, tiers <= 3, staff counts as today, at most 10 guests drawn (the rest counted).
- **Ad bonus:** `floor_double` keeps its rules ($50 minimum collection, $250 maximum extra). With early collections of $1-$30 it will appear rarely at first and
  matter later; the bounds are an open question (D).
- **Campaign independence:** no level, unlock, story step or quality rule reads the floor; the Floor report is read-only.
- **CLAUDE.md:** once approved, §7's wording changes to the $100k-$150k completionist target and the new floor rules (tables, caps, positive cleaners); this revision
  does not edit it.

## 14. Tests (written first)

| Id    | Test                                                                                                                                                                                                                                                        | Suite                                            |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| M1-M5 | **Old-save migration:** missing `tables` -> 1; garbage -> clamped; stations/tiers/servers/cleaners unchanged; ledger sum unchanged; no refund and no charge; pending bounded by the new cap                                                                 | `restaurant-second-floor-qa`                     |
| T1-T8 | **Table purchases:** price formula to #50 as integers; all-or-nothing debit; cannot exceed 50; insufficient funds changes nothing; pending banked first; fraction kept; milestones 3/5/10/25/50 apply exactly once; guests-per-cycle lookup = exact formula | same                                             |
| R1-R4 | **Repeated taps:** second collect pays 0 and writes no entry; 100 rapid collects equal one; a collect then upgrade then collect pays each pile once                                                                                                         | same                                             |
| L1-L4 | **Reloads:** save, reload, `now` unchanged -> same pending; a reload between collect's credit and ledger is impossible (one write); partial cycle fraction identical before and after                                                                       | `idle-qa`                                        |
| C1-C5 | **Clock changes:** `now < anchor` -> 0 and the anchor unchanged; +1 year -> exactly the cap; back then forward never gains twice; DST and timezone shifts irrelevant (epoch)                                                                                | `idle-qa`                                        |
| O1-O6 | **Offline caps:** 1 s, 1 min, 4 h, 6 h, 8 days and "1 s before a cycle" equal the same time spent online; no cycle lost on collect; cap loses whole cycles only                                                                                             | `idle-qa`                                        |
| X1-X4 | **Exact-once ledger:** random 10,000-action run (buy, upgrade, hire, collect, reload): opening cash + ledger = closing cash; one `automation-income` entry per non-empty collect; never negative                                                            | `economy-ledger` suites                          |
| E1-E3 | Visual effect module imports nothing from wallet/ledger/SaveManager; the Floor Life cast stays at most 10                                                                                                                                                   | `restaurant-floor-life-qa`                       |
| G1-G2 | Popularity ignores cleaners; the guide never promises a floor step the floor would refuse                                                                                                                                                                   | `restaurant-second-floor-qa`, `guide-reality-qa` |
| UI    | 320 and 390 px, no sideways scroll, close button visible                                                                                                                                                                                                    | browser run in `tools/e2e`                       |

## 15. Implementation sequence

1. **Approval** of this revision and the open questions (§16).
2. Pure model and the tests above (red, then green): mills, anchors, caps, tables, milestones, migration.
3. Save migration (`tables?`), old-save tests, ledger invariants.
4. Wire `floorEarnings`, `collectFloor`, buy/upgrade/hire to the new model; popularity change.
5. UI: station sheet with exact previews ("Cycle 12 s -> 11.3 s, guest $0.20 -> $0.25, hourly $60 -> $80, counter 4 h -> 5 h"), tables, milestones, pile, collect feedback,
   welcome-back and Closing Time line, Floor report.
6. Floor animation tied to the cycle clock (bounded cast).
7. Guide steps and `guide-reality-qa`; re-tune the calculator's constants with the real functions (`second-floor-economy-sim`, `second-floor-early-sim`).
8. Full QA loop, browser run, report with campaign and floor reported separately.

## 16. Acceptance criteria

1. Level 5: the first machine in one tap; a guest pays within 15 s; the first Server within 5 minutes of continued play; 8 purchases in the first half hour.
2. Every purchase button shows exact previews of cycle time, guest price, guests per cycle, hourly and counter hours, computed by the same functions as the game.
3. No screen shows a cleaner penalty; popularity ignores cleaners.
4. Tables, milestones and caps follow §3; validator output in the final run is 0 failures.
5. Offline equals online to the cent; no cycle lost; second tap pays nothing; one ledger entry per collect.
6. Old saves: same machines and tiers, `tables = 1`, no refund, no charge.
7. Floor money is reported separately; campaign target and `restaurant-final-economy-qa` unchanged.
8. 320 and 390 px layouts pass; the sheet scrolls; 48 px targets.
9. All existing suites pass or are updated with the changed rule documented in the commit.

## 17. Open questions that need your approval

- **A. Minutes per level.** The "regular players are not dominated" result depends on levels taking about 2.5 minutes. At 4-6 minutes the regular player is dominated
  too (§9). Do you have a real level duration (from play-testing), or should I add a debug timer to gather it before we fix the caps?
- **B. Floor dominance.** For frequent and floor-focused players the floor becomes the bigger income in the first week even with 4/5/6 h caps and no guest-price cut. Accept
  it (the floor is the idle player's main income, the campaign is the story, both are reported separately), or approve one of these? (1) caps 3/4/5 (frequent
  62 %, short 52 %), (2) cutting the guest price of Pizza..Hot Food by 40 % (frequent 55 %), (3) a daily soft limit on floor income (needs a new design and probably a field,
  which I will not add without a separate approval). My recommendation: accept, keep 4/5/6, and re-check with telemetry.
- **C. Milestones.** The 10 / 25 / 50 multipliers are x1.12 / x1.20 / x1.30 plus a title and badge. Are those "meaningful" enough, or do you want them larger with a matching cut
  to the tier multipliers?
- **D. Ad bonus bounds.** `floor_double` pays at most $250 extra on a collection of at least $50. Keep those bounds, or scale them to the new floor?
- **E. The once-a-day player** loses about three quarters of potential floor income at 4/5/6 h. Is a rewarded-ad "stay open late" (doubles the counter once a day) desired, or
  do we stay with the cap as the only reason to return?
- **F. First Server for slow visitors.** A player who visits every few hours buys the $30 Server on the next visit, not within 3 minutes. Acceptable (no free money), or should
  the first Server be discounted/free for Level 5?
