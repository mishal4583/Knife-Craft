# Second Floor and First Floor designed for engagement and ad revenue

Status: **design for approval. No game code changed, nothing committed.** Developer's goal (2026-11-02): the game exists to **make real money**, so it must be engaging,
satisfying, "one more" compulsive, keep players for long sessions, and give them reasons to watch ads. Everything below serves that, inside the project's own rules
(CLAUDE.md §2, §7) and Playgama's (ads at natural pauses, reward shown before the ad, the player can always decline, ads never needed to progress).

## 1. What the live game says (Playgama telemetry, 3 Oct to 2 Nov 2026)

Small sample (318 users, 412 sessions, builds 1.4.0 and 1.4.1), so read the direction, not the decimals.

| Measure                                 | Value                                                              | What it means                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Sessions that reach `game_ready`        | 370 of 410 (90%)                                                   | Loading is fine                                                                               |
| Sessions that reach 30 s / 60 s of play | 296 (72%) / 213 (52%)                                              | **Half of all sessions are over inside a minute**                                             |
| Session length                          | average 6.6 min, **median 60 s**, p95 22 min                       | The typical player never sees anything beyond the first levels                                |
| Level completions per event             | median level 3, 90th percentile level 18, deepest 38               | A minority reaches Level 5, where the Second Floor opens (the exact share cannot be read)     |
| Interstitials                           | 165 shown in 67 sessions (24% of sessions)                         | They work, but only the minority that plays on sees them                                      |
| **Rewarded ads**                        | **19 views in 12 sessions (4%), 10 users (3%)**, none after 28 Oct | Playgama's benchmark: **30-40% of players click, 3-5 views per session**. We are 10x below it |

Three consequences:

1. **The Second Floor cannot rescue revenue alone.** Most players leave before Level 5. The floor has to be _promised_ early (a visible locked door, a first taste) and it must
   multiply what the player already enjoys (the cutting levels), not stand beside it.
2. **Rewarded ads are the biggest unused lever.** The six bonuses exist, but sit at moments few players reach and are small by design ("at most ~20% richer", `adBonuses.ts`).
   For a revenue goal they need more moments, bigger visible value, and the placements Playgama names best: _after a level_, _when a purchase is a little out of reach_,
   _on return_, _to skip a wait_.
3. **Check the 28 Oct drop to zero** before building more ads: either no player reached an offer since, or a build changed something. This is cheap to verify first.

## 2. Pillars

1. **A reward every few seconds, a decision every level.** Numbers rise, piles burst, something glows "buy me".
2. **The cutting levels stay the engine.** The floor turns every finished level into a bigger moment and gives the money somewhere satisfying to go. Campaign pay stays frozen.
3. **Every ad offer is a good deal the player can see:** "Watch: +60 min of earnings (worth $480)". Never required, never punishing, never a fake timer.
4. **The goal is always one to three minutes away** for the first hour, then hours, then days. Someone must always be "almost there".
5. **No dead end.** After everything is built the player resets into a stronger restaurant (section 6.8).

## 3. One loop, five clocks

| Clock          | What the player does and gets                                                                              | Floor / First Floor role                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **3 seconds**  | Cuts, taps the Pickup pile, sees coins burst and a counter climb                                           | First Floor: the cut. Second Floor: pile tap with combo          |
| **30 seconds** | A glowing "Buy" is available, a golden guest walks in, a short Rush starts                                 | Second Floor: next-goal strip, golden guest, Rush                |
| **3 minutes**  | A level ends: pay, **Flood** (customers surge, the floor pays out a burst), a new item bought, an ad offer | Both: the level-complete screen is the hub                       |
| **15 minutes** | A session: 5-6 levels, 4-8 purchases, a milestone fanfare, 2-4 ad moments                                  | Floor spends the level money; First Floor unlocks the next gates |
| **Daily**      | Welcome back (income earned while away), daily gift, streak, counters full again                           | Floor: counter caps pull the return. First Floor: daily order    |
| **Weekly+**    | Tiers, Franchise reset, long goals                                                                         | Floor                                                            |

## 4. First Floor and Second Floor working as one engine

- **Level complete is the hub.** After the existing pay line, the floor adds **Flood**: the finished level sends a rush of guests, the Pickup pile fills with _15 minutes_ of
  the floor's income for free (a visible bonus on top of the unchanged level pay), with an optional ad for _60 minutes_. This is the placement Playgama calls the most effective
  ("after a challenge, positive state"), and it makes the floor matter to every level the player plays.
- **Good cuts feed the floor.** Stars or perfect cuts raise a **Hype** meter; full Hype gives a free short Rush. The campaign skill is rewarded in the floor, not duplicated.
- **Floor money flows back.** The floor's money is the same wallet, so it buys the First Floor's kitchen and equipment. The player now has two places to spend and two ways
  to earn, which is the core of every long-lived idle tycoon.
- **Gates pull players into the campaign.** Tier 3 already needs Level 30. Add soft gates so that each new machine needs a level (for example Drinks 7, Pizza 10, Burger 14,
  Ice Cream 19, Hot Food 25). They give "just X more levels" goals. Gating by level also keeps the floor from outrunning the campaign.
- **Show the door early.** From Level 2 the map shows the Second Floor with a lock and "Opens at Level 5" (or earlier, see decision 1), so the promise lands before most players leave.
- **No new interruptions on First Floor.** Ads never appear during cutting. Interstitials only at the level-complete to map transition (Bridge spacing, 150 s minimum).

## 5. Why the floor currently feels thin in a session (measured)

Session simulator (`scripts/second-floor-session-sim.mts`): a player sits and plays 2.5-minute levels from Level 5 with $508, and puts a share of each level's pay into the floor.
With the current proposal (table and tier prices x2.5):

| Share of level pay put into the floor | First 30 min | First 60 min | Longest wait for a purchase | Floor earns per minute at 60 min |
| ------------------------------------- | -----------: | -----------: | --------------------------: | -------------------------------: |
| 25%                                   |  2 purchases |  4 purchases |                      25 min |                             $5.7 |
| 50%                                   |  3 purchases |  8 purchases |                      15 min |                             $7.4 |
| 100%                                  |  6 purchases | 12 purchases |                      10 min |                             $9.7 |

A level pays about $400 to $800 of floor money; the floor itself adds $55 in the first half hour. **A player would wait 10-25 minutes between purchases and the floor's own
income would be invisible next to the level pay.** That is the opposite of "satisfying". What the sweep showed:

| Table and tier price scale | Purchases in 30 min at 50% | Longest wait | Machines in first 60 min |
| -------------------------- | -------------------------: | -----------: | ------------------------ |
| x2.5 (current proposal)    |                          3 |       15 min | Drinks, Pizza, Burger    |
| x0.5                       |                          9 |       10 min | Drinks, Pizza            |
| x0.25                      |                         13 |        5 min | Drinks, Pizza            |

So the early game needs **many cheap steps**, as in every big idle game (Cookie Clicker's first Cursor costs 15, AdCap's first Lemonade Stand $3.74), and the expensive
steps must come later. The floor's own rate stays small in a session no matter the price, so the _feeling_ of income comes from Flood, Golden Guests and Rush (section 6),
not from the base rate.

## 6. Floor mechanics for engagement

1. **Cheap early steps.** Table #2 for each machine at about 10-15% of the machine price, growing 1.15-1.3 per table; costs then climb with the tables, tiers and machines.
   Target: **at least 70% of level ends in the first hour offer a purchase**, and never more than 5 minutes without one in the first 30 minutes.
2. **Level Flood** (section 4): free 15 min of income in the pile after each level, ad option for 60 min.
3. **Golden Guest.** A VIP walks in about every 4-5 active minutes (seeded by day and counter, so deterministic). Tap within 8 s: pays about one minute of the floor's income as a
   burst. Ad option: x3. Daily cap on ad offers.
4. **Rush Hour.** Speed x3 for 3 minutes (earned by Hype or Golden Guest, free), or **10 minutes by ad** (4 a day). While it runs, customers visibly pile in and the income
   counter races. Total rush minutes per day are bounded, so the daily total rises roughly 25% and cannot run away.
5. **Pickup pile with combos.** Hold or tap to collect; coins fly to the wallet, pitch rises with each pile, a combo counter pays small bonuses. The pile stays tap-to-collect.
6. **Always-visible next goal.** A strip under the header: "Next: Drinks table #2, $140, 40 s away". Tapping buys. "Almost there" turns into the Short-By ad offer.
7. **Fanfare for every milestone.** 5 tables x1.25, 10 tables x1.5, each tier, each machine: full-screen reveal, sound, a number that visibly jumps.
8. **Franchise (the long tail).** When all stations are built, "Open a new branch": the floor resets, the player keeps a permanent multiplier and a new cosmetic style. This
   removes the day-35 dead end found earlier. (Needs a decision; section 9.)
9. **Streaks.** The daily gift streak already exists; extend it to "floor streak" days with small stacking bonuses.

## 7. Ad plan

All rewarded offers: reward shown before the ad, one ledger entry per grant (`rewarded-ad`), daily cap, the player can decline, never needed. Interstitials: Bridge-spaced,
natural breaks only.

| #   | Moment                     | Offer                                                                              | Daily cap | Offers in a 30-min session |
| --- | -------------------------- | ---------------------------------------------------------------------------------- | --------: | -------------------------: |
| 1   | Return after 30+ min       | Welcome back: up to 3 h of earnings (exists)                                       |         1 |                        0-1 |
| 2   | Level complete             | **Flood x4** (60 min instead of 15) _or_ x1.5 level pay (exists as `level_double`) |         8 |                        3-4 |
| 3   | Golden Guest tapped        | x3 payout                                                                          |         8 |                        3-5 |
| 4   | Entering the floor         | **Rush 10 min** x3                                                                 |         4 |                        1-2 |
| 5   | Within 25% of the next buy | Short By (exists, 2/day)                                                           |         6 |                        1-2 |
| 6   | Counters full              | Collect x2 (exists as `floor_double`, 2/day)                                       |         4 |                        0-1 |
| 7   | Waiting for a big goal     | **Skip ahead: 2 h of income** (timer skip, Playgama pattern)                       |         3 |                        0-1 |
| 8   | Daily gift                 | x2 (exists)                                                                        |         1 |                          0 |
| 9   | Floating cash              | Bag of cash (exists)                                                               |         6 |                        1-2 |
| 10  | Level complete to map      | Interstitial (Bridge-spaced)                                                       |    Bridge |                        2-3 |

That is about **10-16 rewarded offers** in a 30-minute session. At Playgama's 30-40% click benchmark that is **3-6 views per session**, inside their 3-5 target. The risk is
clutter: rules to keep it pleasant are one offer on screen at a time, a 90-second pause between offers, and nothing during cutting.

**Reward sizing.** Today's rewards are small dollar caps ($50-$250). For a revenue goal they should scale with the floor, shown as time and worth: "+60 min of earnings ($480)".
The free option should be visibly smaller (15 min against 60 min, x1 against x3) so the ad is clearly a better deal while the free path still progresses.

## 8. Economy changes this implies (not yet modelled)

- **Table #2 and tier prices come down early** and the curve is re-fitted so the first hour has a purchase at most 5 minutes apart (section 5).
- **Flood, Golden Guest and Rush add to income,** so base guest prices or caps may need to come down a little to keep the floor's share of total income near the 16% target.
- **Soft level gates** on machines (section 4) replace some of the price pacing.
- **Franchise** adds a permanent multiplier layer that has to be priced.
- Every one of these needs a calculator run before any number is final; the figures in sections 5-7 are targets and evidence, not tuned values.

## 9. Decisions needed from the developer

1. **Open the Second Floor earlier?** Today Level 5, and most players leave before. Level 3 (Market opens, bonuses start) would put a first Coffee machine in front of far more players.
2. **How strong may ad rewards be?** The code's stated rule is "a player who takes every offer ends the campaign at most ~20% richer". A revenue goal means raising that. Suggested: the
   ad path may give up to about 2x the free path's income for the _floor_, while campaign pay stays unchanged.
3. **Save fields.** Rush end time, golden-guest counter, ad counters and Franchise level need persisted state. Rev 3 approved exactly one new field (tables per station). OK to
   put these under `business` as a single nested object?
4. **Franchise reset** as the long tail, or just make the single floor longer?
5. **Soft level gates** for machines (pulls players into the campaign), or keep them price-gated only?
6. **Remove-ads purchase and a starter pack** are Playgama's top-converting IAP, outside this task. Want them in the plan later?

## 10. How success is measured

Playgama telemetry already gives sessions and durations. Add stable events (snake_case, values in the data): `floor_opened`, `floor_buy`, `flood_collected`, `golden_tapped`,
`rush_started`, `ad_offer_shown` (kind), `ad_offer_accepted` (kind). Targets to judge the redesign on a real sample: median session from 60 s to 3 min or more, average from
6.6 to 15 min, rewarded views per session from 0.07 to 3-5, and 30-40% of players clicking at least one rewarded offer. Revenue per player cannot be estimated here: no eCPM data
is available to me.

## 11. Honest limits

- The telemetry sample is small and cannot show how many players reach Level 5, or whether retention is the main problem.
- "Hours of play" is a goal the design improves the odds of, not something I can promise; the measures in section 10 decide.
- Numbers in sections 5-7 come from the session simulator and Playgama's benchmarks; the per-session ad counts are design targets, not observed rates.
- Nothing is implemented.
