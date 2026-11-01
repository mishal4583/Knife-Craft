# KnifeCraft — Phase 6 check and the Phase 7 plan: milestones instead of levels (2026-10-31)

Request (developer 2026-10-31): "check phase 6 is completed or not and then plan for phase 7". Nothing in Phase 7 is built.
Companion file: `LEVEL-DISPOSITION-2026-10-31.md` (made by `scripts/level-disposition.mts` from the game's own data: every one of
the 148 levels, and the proposed 100 milestones).

---

## Status and decisions (developer 2026-10-31)

| #    | Decision                                            | Answer                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-6  | Machines: income only, or also the main restaurant? | **Income and popularity.** Built (below).                                                                                                                                                                                                                                                                                                                                                                 |
| D-7  | 100 milestones or ~60?                              | **100.**                                                                                                                                                                                                                                                                                                                                                                                                  |
| D-8  | Re-skin, full goals or hybrid?                      | **Hybrid.**                                                                                                                                                                                                                                                                                                                                                                                               |
| D-9  | Do milestones pay money?                            | **No.** Service pay and the achievements are the only money.                                                                                                                                                                                                                                                                                                                                              |
| D-10 | Is the table's grouping and naming right?           | **"Do what is best."** Done: a Practice milestone is named after the dish its last service cooks ("Mushroom Duxelles", not "Practice · Italian · 3"); "New dishes on the menu" got the dish too; staff and chefs are title-cased ("Hire a Line Cook"); chapters read "Welcome to Indian Kitchen & Service"; every name is unique (`journey-qa` J4b). The grouping is kept. Rename anything by telling me. |

**Built so far**

- **D-6 popularity.** A working Second Floor machine (one a Floor Server runs) gives its level in points (Lv 1 = 1, Lv 3 = 3); every 6
  points add +1 popularity a day, at most +3 for a full Lv 3 floor, less when the tables are messy. It joins the existing daily
  popularity sum (like the staff's boost), so it moves the same 0–100 score: the city ranking, how many orders come
  (`0.5 + score/100`) and what guests pay (`0.9 + score × 0.3`). A full floor settles about 9 points higher (the daily pull is 0.32),
  i.e. about +9% order frequency and +3% price. A player with no working machine is exactly as before, so the frozen economy does
  not move. Shown on the Pickup Counter panel ("⭐ +N popularity a day"). Tests: `idle-qa` D1–D3.
- **7A, the data.** `src/game/restaurant/journey.ts` (the 100 milestones, `milestoneOf`, `journeyOf`), `scripts/journey-qa.mts`
  (J1–J11, including that the written table equals what the game says now), and `scripts/level-disposition.mts` now prints from
  `journey.ts`. Nothing on screen has changed yet; 7B is next.

---

## Part 1 — Phase 6 check: Second Floor, machinery, cuisines

| Item in the status list                                            | Verdict                                                            | Evidence                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Second Floor and its stations open by Level 5 (the L10 vs L60 gap) | ✅ done                                                            | `restaurant-second-floor-qa` C1, C3, B1, L4: the floor opens at L5 and **all six** stations go on sale at L5; before that they are refused                                                                                                                                                                  |
| Cuisine chapters exist                                             | ✅ done                                                            | 13 chapters (`CAMPAIGN_150_CHAPTERS`), 10 cuisines (Home, Italian, French, Indian, Mediterranean, Mexican, Japanese, Chinese, Thai, Korean) opening at levels 1, 1, 19, 33, 44, 14, 57, 74, 86, 99; 4 specialist chefs (Mexican L14, Indian L33, Mediterranean L44, Asian L57); `restaurant-progression-qa` |
| Each machine really changes production capacity                    | ✅ **for the floor's own production**, 🟡 for the rest of the game | below                                                                                                                                                                                                                                                                                                       |

### What each machine really does (checked, not assumed)

A machine's whole effect is **the floor's income rate and how much it stores**: `rate × real hours`, capped at 8 / 9 / 10 hours
(Lv 1 / 2 / 3), only while a Floor Server runs it (a server runs 2), minus 25% for each missing Floor Cleaner (1 per 3 stations).

| Machine                    |  Price | $/h at Lv 1 / 2 / 3 | Stores at Lv 1 → Lv 3 | Pays itself back (Lv 1, staffed) |
| -------------------------- | -----: | ------------------- | --------------------- | -------------------------------: |
| ☕ Smart Coffee & Espresso |   $400 | $10 / $16 / $21     | $80 → $210            |                             40 h |
| 🥤 Drinks Dispenser        |   $550 | $12 / $19 / $25     | $96 → $250            |                             46 h |
| 🍕 Auto Pizza Station      |   $750 | $14 / $23 / $31     | $112 → $310           |                             54 h |
| 🍔 Burger Station          | $1,000 | $17 / $27 / $36     | $136 → $360           |                             59 h |
| 🍦 Ice Cream Station       | $1,300 | $20 / $31 / $41     | $160 → $410           |                             65 h |
| 🍟 Hot Food & Fried Items  | $1,550 | $22 / $35 / $46     | $176 → $460           |                             70 h |

All six fully upgraded earn $200 an hour for a total price of $29,550 (`restaurant-second-floor-qa` P3). Proven by: C2 (upgrades
cost more, earn more, and the cap never shrinks), E1–E4 (rate × real hours, cap, backwards clock, nothing before purchase), B5
(an upgrade banks what was earned, then the new rate starts), T1–T3 (no server = nothing; one server runs 2; each missing cleaner −25%).

**What is NOT true, so you can decide:**

1. No machine changes the **main restaurant's** production — not seats, not orders, not the menu, not dish availability. The
   Seating Area line "guests eat what the machines make" is a picture only. This was the developer's rule from the start
   ("extra on top of the campaign economy"), so I count it as **done as designed**, not as a gap. If "production capacity" meant the
   main kitchen, that is a new feature (decision D-6 below).
2. The six machines differ **only by numbers** (price, rate, storage); none has its own mechanic (e.g. the Ice Cream Station does
   nothing different from the Coffee machine).

**Phase 6 is complete as designed.** The only open question is D-6.

---

## Part 2 — Phase 7: replace levels with milestones

### 2.1 What "levels" mean in the code today (measured)

- **148 levels in 13 chapters** (`LEVELS`, `CAMPAIGN_150_CHAPTERS`); 75 SERVICE, 70 ORDER, 3 RELAX; pay `paidLevelReward` ($50 at L1, +$40 a level
  to L40, then +$6; the last level $5,000); the finale story at L75 and THE LAST PAGE at L148; after L148 the Endless Restaurant.
- **The level number is the engine's clock.** `restaurantLevelOf` (52 uses in 16 files), `levelNumber` (67 in 16), `isSystemLive` (32 in
  15), `unlockLevel` / `levelRequired` (415 in 48 files), `remapCampaignThreshold` (41 in 14). The save keeps `levelProgress`
  (`currentLevelId`, `highestUnlockedLevelId`, `completedLevelIds`).
- **What the player sees is already mostly not a number.** Phase 1.2 (2026-10-30) replaced "Level N" with "in 3 services" in the
  restaurant build; no level number is left in the restaurant build's unlock or level wording (the remaining "Level N" strings are the classic build's wording and the Blacksmith's own upgrade levels). Every unlock
  sentence goes through **one helper** (`unlockText()` in `navLevel.ts`, 57 call sites in 14 files, with `servicesToGo.ts`).
- **What still makes levels the main progression:** the Kitchen's Order Board lists the levels, the "Next: … in 3 services" strips
  count them, the Progress screen's stages are level-based, and there is nothing else to aim at.

### 2.2 The findings that shape the plan

1. **Only 45 natural unlock events exist** (system, staff, chef, kitchen rank, technique, menu, day length, chapter, story) in 148
   services. A "100-milestone" ladder therefore needs **55 more** reasons to stop; the table adds them as _Practice_ milestones by
   splitting the longest stretches. The result is honest but blunt: **the first 19 milestones are one service each**, 52 of the 100 are a single
   service, and none is longer than 2. In the early game a milestone is a level with a new name.
   → Real replacement needs milestones that are _goals_, not just a renamed counter (decision D-7).
2. **Nothing has to be deleted.** All 148 levels are kept as hidden _services_ (they hold the recipes, pools, techniques, coaching and
   the pay curve). The disposition is "kept — anchor / body of milestone N" for every row; it is in the companion table.
3. **The engine can stay.** Because every unlock reads the level counter, the cheapest honest design keeps `levelProgress` as
   the hidden spine and derives milestones from it. No save migration, no new top-level save field, no change to economy code, ads,
   analytics or the Bridge `level_*` messages. (The user already calls them "hidden levels".)
4. **Name clash:** `progression/milestoneRewards.ts` and `economy.claimedMilestoneIds` already use "milestone" for the old reward
   system (now the achievements). The new module is called **`restaurant/journey.ts`** ("Journey milestones"); the player just sees
   "Milestones".

### 2.3 Three ways to do it

|                                            | A. Re-skin                                                            | B. Full goals                                                                                                    | **C. Hybrid (recommended)**                                                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Idea                                       | Levels hidden, milestones shown; a milestone = finishing its services | A milestone is a goal (cook N dishes of a cuisine, earn $X, hire a Server); services come from a pool, any order | The hidden service ladder stays the spine; milestones are the visible goals on it; **goals add stars and badges but never block** |
| Pacing                                     | unchanged                                                             | changes (variable, replayable)                                                                                   | unchanged; replay gets a reason                                                                                                   |
| Economy / frozen baseline                  | unchanged                                                             | needs a new simulation                                                                                           | unchanged                                                                                                                         |
| Engine changes                             | none                                                                  | large (unlocks re-keyed)                                                                                         | none                                                                                                                              |
| Risk                                       | milestones feel like renamed levels (finding 1)                       | high: the whole unlock graph, ~400 call sites, ~50 suites                                                        | low                                                                                                                               |
| Replaces "levels are the main progression" | partly                                                                | yes                                                                                                              | yes, on screen                                                                                                                    |

I recommend **C**: you get the player-facing change you asked for without touching the frozen economy or the 415 level-keyed
call sites, and the optional goals give the 55 Practice milestones a real meaning.

### 2.4 The plan (each step ships alone)

**7A — The data (pure, no screen).** `restaurant/journey.ts`: the 100 milestones built from the same catalogs as the generator (the
generator then imports it, so the doc can never drift), `milestoneOf(level)`, `journeyOf(save)` (current milestone, services left,
the next unlock names, chapter totals). Derived from `levelProgress`; **no save field**, old saves read. Tests: `journey-qa`
(100 milestones; every level in exactly one; contiguous; the anchors are exactly the unlock levels; the last ends at L148; first-play
rules unchanged; pure, no `Math.random`).

**7B — The visible layer.** One helper changes the wording everywhere: `unlockText()` says "at _Hire a Server_" or "at milestone
_Indian Kitchen_" instead of "in 3 services" (the 57 call sites change by themselves). A **Journey** page in Progress (13 chapters,
100 milestones, the current one lit), a Kitchen strip "Next milestone: _Your menu_ · 2 services", the unlock cards and the news named
by milestone. Level numbers disappear from every restaurant-build screen; the classic build keeps them word for word. Tests:
`ui-copy-qa`, `journey-copy-qa`, browser `journey.mjs` at 320×568, 390×844 and 768×1024.

**7C — Goals for the Practice milestones (never blocking).** Each Practice milestone gets a goal from records that already exist
(`restaurantProgress(save).recipes`, `restaurantRecordOf`, recipe grades): e.g. "Serve 3 Italian dishes Clean or better". Meeting
it earns a **star** (badge-only, no money); the milestone itself completes with its service as before. Replay gets a reason without
changing pacing or pay. Tests: goal maths against the real records; stars derived (no save field).

**7D — The Order Board.** Services shown under their milestone card; the number hidden; replay of a finished service stays.

**7E — Analytics and the finish.** `milestone_reached` through `sendAnalyticsEvent` (stable snake_case, `game_version`); the Bridge
`level_started/completed { world, level }`, the interstitial policy and the ad gates are **unchanged** (they count completed
levels; the Bridge needs them). After milestone 100 the Endless Restaurant opens exactly as after L148 today.

**Gates every step:** tsc, ESLint 0 errors, Prettier on changed files, build, preflight, the suites touched, the economy
baseline run unchanged (`economy-v2-campaign-simulation`, `restaurant-final-economy-qa`), and — because several suites diff against a
base commit — a full run **with the new files added** to git (the lesson of 2026-10-31).

### 2.5 What does NOT change

Pay per service, the $150k+ target, achievement money, the Second Floor, ads, the Bridge, saves, the classic build's wording, the
Endless Restaurant. **Nothing is deleted** (the developer's standing rule): all 148 services stay.

### 2.6 Risks

| Risk                                           | Handling                                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Early milestones read as renamed levels        | D-7: goals (7C), or fewer, longer milestones                                                  |
| 415 level-keyed call sites                     | not touched: milestones are derived, the counter stays                                        |
| Old saves                                      | no migration; `journeyOf(save)` reads `levelProgress`                                         |
| Diff-based suites and new files                | add files before the full run; documented exceptions only where the file is read-only numbers |
| The word "milestone" already means old rewards | new module `journey.ts`; player text "Milestones" only                                        |

---

## Part 3 — Decisions for the developer

| #    | Decision                                                                                                                                                                   | My recommendation                                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| D-6  | Should a Second Floor machine also affect the **main restaurant** (seats, menu, a bonus), or stay "extra income only"? And should the six machines get distinct mechanics? | Stay as designed (income only)                                                          |
| D-7  | How should 100 milestones be shaped: keep 100 (≈ 1.5 services each, goals make them meaningful), or ~60 (≈ 2.5 services each, fewer but longer)?                           | Keep 100, with the goals of 7C                                                          |
| D-8  | Model A, B or C (§2.3)?                                                                                                                                                    | C                                                                                       |
| D-9  | Do milestones pay money?                                                                                                                                                   | No: service pay and achievements stay the only money; milestones unlock and award stars |
| D-10 | Is the table's grouping and naming right (edit `LEVEL-DISPOSITION-2026-10-31.md`; re-run the script)?                                                                      | You edit, I re-generate                                                                 |
