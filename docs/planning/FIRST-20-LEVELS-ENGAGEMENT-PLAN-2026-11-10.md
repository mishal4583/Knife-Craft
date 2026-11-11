# The first 20 levels, round 2: keep them playing (developer 2026-11-10)

**Update 2026-11-11 (bug list):** Delivery Inspection is back at **Level 3** (it must come BEFORE Fridge Sort: check the delivery, then unpack it) and the games are a mandatory routine (see HANDOFF "Bugs and Issues, 10 items"). Everything below that says Level 9 for Delivery Inspection is superseded.

**Status 2026-11-10 ("do the best plan"): items 1-5 of section 5 are BUILT** (teaser lines, funnel analytics, Delivery Inspection at Level 9, the guided first Sauce round, Hype chests at L5/10/15/20). Not built: item 6 (Dinner Rush, regular guest, top-40 card, the Golden Guest moment) and item 7 (daily streak), and the chest ad. **The Sauce Station "3 more rounds today" ad is BUILT** (developer yes 2026-11-10). See HANDOFF.

Request: "introduce the Sauce Station before Level 20; plan the first 20 levels so each one has something new, a mini-game or a reward that makes the player want the next level. This game is my only chance to make money."

This plan builds on `FIRST-20-LEVELS-PLAN-2026-11-08.md` (built: the schedule in `config/earlyLevels.ts`). It does not repeat it. It adds (A) the Sauce Station at Level 7, DONE, (B) what is still missing, (C) a measuring plan, because the live telemetry cannot tell us where players leave (the live build is 1.4.x, see the memory note; a fresh upload is needed).

## 1. Done today: Sauce Station opens at Level 7

- **Why 7:** Level 7 is "Garden Plates" with a Simple Garden Salad, and it was the emptiest early level (a zucchini and a story card). A salad level is where a dressing makes sense. Level 6 (Stock the shelves) is a chore-style game; Level 7 is a pure toy, so two weighty things never land together. Level 8 brings pans and degreasing, Level 10 the fridge.
- **The shelf grows with the early levels** (so the 24-bottle shelf is already a collection by Level 20):

| Level | Sauces that unlock | Shelf |
|---|---|---|
| 7 | Tomato Sauce (stir), Lemon Dressing and Vinaigrette (whisk) | 3 |
| 10 | French Onion Base (Minestrone Base level) | 4 |
| 12 | Potato Velouté | 5 |
| 13 | Béchamel, Basil Pesto (Italian Service Night) | 7 |
| 17 | Mayonnaise (the first hard emulsion) | 8 |
| 18 | Garlic Aioli | 9 |
| 20 | Caesar Dressing (finale) | 10 |

  Everything else keeps its old level (Ranch 29, then 31 up to 70). Difficulty is the plan's tier 1 (75 s, 9 scoops, generous tolerance) until Level 40, so a new player sees the easy version.
- **Code changed:** `SAUCE_FIRST_LEVEL` 23 to 7 and the unlock numbers (`business/sauceStation.ts`), tier 1 starts at `SAUCE_FIRST_LEVEL`, a Paige beat `sauce-station` (`restaurant/assistant.ts`, "Make a salad dressing! Mix it, whisk it, bottle it."), the chip comment. Tests updated to the new rule (CLAUDE §8): `sauce-station-qa` A1/A4/A6/D20, `saucestation.mjs` S1. Nothing else moved. Rules QA, `assistant-qa`, `early-levels-qa`, `lazy-load-qa`, `stockroom-sort-qa`, tsc and the browser test all pass.
- **Not changed (needs your word):** no rewarded-ad spot, no new sounds, no new art.

## 2. The mini-game rhythm (current, and one fix)

| Level | Game | Note |
|---|---|---|
| 3 | Unpack the delivery (Fridge Sort) | |
| 3 | **Delivery Inspection** | **Collision:** its first level is tied to Fridge Sort's (`INSPECTION_FIRST_LEVEL = FRIDGE_SORT_FIRST_LEVEL`), so two games land at Level 3 beside cleaning at Level 4. |
| 6 | Stock the shelves (Stockroom Sort) | |
| 7 | **Sauce Station** | new |
| 10 | Fridge Check | |
| 12 | Dishwashing (a game, with its own sink) | |

**Recommendation: move Delivery Inspection to Level 9.** Level 9 (eggplant) has no system today, and Levels 10, 11 and 12 each open a big thing. Result: a new toy at 3, 6, 7, 9, 10, 12, a gap-free early game. It is one constant and its test (`delivery-inspection-qa`); its tiers key off Fridge Sort's levels and stay.

## 3. Principles (what the levels must do)

1. **Every level has one new thing in its first minute** (ingredient, cut, system, game, person). Already true on paper (08-Nov plan).
2. **Never two heavy openings on adjacent levels.** Heavy = a chore system or a game with a how-to. Light = an ingredient or a reward.
3. **A reward at least every 90 seconds, a goal always one step away.** Cutting stars and Hype are the 20-second reward; a level payout the 3-minute one; a machine, a rank or a chest the 10-minute one.
4. **Close every level with a reason to open the next:** a one-line teaser on the result card ("Next: your first steak"). Cheap, universal, not built.
5. **Never block on a chore.** Cleaning and games are optional extras that feed Hype and ranking; the main loop stays cook, serve, earn.

## 4. Level by level: what is new, what is the reward, what makes them open the next

Built = in the game today. Gap = still to build (section 5).

| L | New thing | Reward moment | Hook to the next level | State |
|---|---|---|---|---|
| 1 | tomato, slice, first plate | first pay, hire the team | "Guests are waiting" | built |
| 2 | carrot, peel, halve | Closed-for-tonight card | "Day 2 opens with your next service" | built |
| 3 | Unpack the delivery, daily gift | first Hype | gift tomorrow | built |
| 4 | cleaning (one chore) | first interstitial after it | | built |
| 5 | **the menu opens**, party of 2 | menu guests, mushroom | | built; **gap: a small reward chest** (menu opened) |
| 6 | chicken, Stock the shelves | first tools bought | steak is coming | built |
| 7 | zucchini, **Sauce Station** | first bottle on the shelf, 1/24 | locked bottles on the shelf (no level numbers: the level system is hidden) | **built today**; gap: the first round is guided (below) |
| 8 | onion rings, pans | frying pan list | | built |
| 9 | eggplant, **Delivery Inspection** (proposed) | Sharp Eye pin | | proposed |
| 10 | Fridge Check, stock pot | a story card | the Second Floor is next | built; gap: **chest** |
| 11 | beetroot, radial, Second Floor | first machine | machine pays while you play | built (cash gated) |
| 12 | pepper, corn, one batch, dishwashing | | | built |
| 13 | avocado, lime, **Béchamel and Pesto** (shelf at 7) | a regular with a face | "Marco is back tomorrow" | regular is **gap** |
| 14 | julienne, fennel, mop | Knife Mastery streak | | built; streak reward gap |
| 15 | steak | knife tip | | built |
| 16 | salmon, restroom | board tip | | built |
| 17 | kiwi, watermelon, **Mayonnaise** | big peels | | built |
| 18 | cabbage, **Aioli** | first Dinner Rush | | rush is **gap** |
| 19 | radish, asparagus | top-40 celebration card | "Top 40! Next: top 25" | celebration is **gap** |
| 20 | ginger, **Caesar**, finale | chest, first Golden Guest, "Next: the French Bistro" preview | the chapter 2 teaser | chest, Golden Guest, preview are **gaps** |

### The first Sauce Station round (the first 60 seconds matter most)
The mini-game has real depth (colour matching, a whisk, bottling). At Level 7 the player must succeed once without reading anything:
1. Paige sends them to Inventory (done). The how-to shows once (done).
2. **Gap (small):** the first round is always **Lemon Dressing** (one pour, one whisk, no splitting risk), and its "pips" help is shown. Today the sauce of the day is seeded; add `firstSauce` override for round 1 of the save.
3. After the first bottle: a tiny "First bottle! 1/24" toast with the shelf button, and the achievement "First Bottle" (existing achievement system, no money).
4. The shelf shows the locked bottles (done; no level numbers, service-loop-qa U1): the player sees there is more to unlock.

## 5. What to build, in order (highest return first)

| # | Item | Why | Size | Money? |
|---|---|---|---|---|
| 1 | **Level-end teaser line** ("Next: ...", one per level from the plan) on the served / level-complete card | the cheapest cliffhanger; every level | S | no |
| 2 | **Level funnel analytics**: `level_started`/`completed` exist; add `feature_unlocked {feature, level}` and `first_use {feature}` so the first live build shows where players leave | all later decisions | S | no |
| 3 | Delivery Inspection to Level 9 (section 2) | smooths the rhythm | S | no |
| 4 | First-round Sauce guidance (section 4) | the new game must be won once | S | no |
| 5 | **Chests at L5, L10, L15, L20** (Hype boost + a pin or a one-time cosmetic; never cash, so the economy baseline holds) | a 10-minute reward | M | no |
| 6 | First Dinner Rush (L18), regular guest with a face (L13), top-40 card (L19), first Golden Guest (L20) | the unbuilt items of the 08-Nov plan | M | Golden Guest already has an ad offer |
| 7 | Daily streak (day 1 to 7, small non-cash gifts, the 7th a pin) shown on the Kitchen | brings them back; the daily gift exists from L3 | M | no |

## 6. Revenue (your main goal)

Retention comes first: no ad can pay for players who leave at minute two. After retention:
- **Rewarded-ad spots that suit the new things (all need your yes first, CLAUDE §2):** (a) Sauce Station "3 more rounds today" (you already show 3/3 on the chip; at 0 left it is a clear moment); (b) a double chest at L10/L20; (c) the Second Floor offers already exist.
- Each says what it gives before the ad, is optional, has a daily cap, and one ledger entry only if it pays money. Sauce rounds never pay money, so (a) needs no ledger entry.
- Interstitials stay as the policy says (none before 3 completed levels, then 150 s apart).

## 7. Measuring (so the next plan uses facts)

- Upload a fresh build (needs your explicit yes, CLAUDE §3), then read `get_game_telemetry_analytics` for `level_completed` by level for Levels 1-20 and `game_version` equal to the new `BUILD_VERSION`.
- The decision rule: any level whose completions fall more than 15% from the one before is a cliff; look first at what that level opens (section 4) and whether two heavy openings were adjacent.
- Also compare the first-use counts of each game with the level it opens at: a game that opens but is used by less than half of those who reach it needs a better first minute, not more content.

## 8. Questions for you

1. Move Delivery Inspection to Level 9 (recommended)?
2. Chests: Hype plus a pin only (recommended, keeps the economy untouched), or also a small cash gift (changes the frozen baseline)?
3. Do you want the Sauce Station "3 more rounds" rewarded ad?
4. Which first: the teaser lines and analytics (the smallest), or the Level 18-20 moments (Dinner Rush, top 40, Golden Guest, chest)?
