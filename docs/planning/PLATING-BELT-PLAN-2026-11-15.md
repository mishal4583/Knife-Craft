# Plating Belt (Banquet Waiters): the mosaic conveyor mini-game (plan, developer 2026-11-15)

Developer's brief: build the mosaic-conveyor game (coloured pieces ride a belt around a picture and take away the cells of their own colour, five waiting places, "finish without getting
trapped") as a restaurant mini-game, in the **Banquet Waiters** version of the concept picture: a buffet platter drawn as a mosaic, a round belt, coloured banquet waiters, five waiting tables.
"The game should be perfect" and "suit the current restaurant game". The concept picture is a mood and layout reference only. Art prompts: `PLATING-BELT-CODEX-PROMPTS-2026-11-15.md`.

This replaces section B of `JAM-BELT-SORT-MINIGAMES-PLAN-2026-11-14.md` (which had the picture being FILLED; the real game CLEARS a finished picture). Rules that apply:
`MINIGAME-PRODUCTION-RULES-2026-11-14.md` (plain art first, a phone feel check before rewards and art, every plate solvable by construction, a one-tap retry, store text in the same release).
NAME in the game: **Plating Belt** (the step: "🍽️ Plate the banquet"). Not "Pixel Flow", which is another studio's title: our names, our art (waiters, tables, platter), our rules text.

## 0. Decisions, and the ones still open

| # | Question | Decision |
|---|---|---|
| 1 | Theme | **Banquet Waiters** (developer). The waiters are a banquet crew in coloured berets, NOT the hired Server (the cast is explained once, by Paige's how-to). |
| 2 | Clock | **No clock.** The concept picture shows a 02:45 timer; the rules of every mini-game say no clock. The only pressure is the five tables. |
| 3 | Rules | Chosen with a prototype (section 8): lanes, ONE lap per tap, an unproductive tap is allowed and costs a table. |
| 4 | Failure | **Trapped** ends the round; "Try again" is the SAME plate, one tap, no ad (as the Car Park). One free Undo per round. |
| 5 | Unlock | **Level 18** (the concept shows it). |
| 6 | Place in the routine | **DECIDED (developer 2026-11-15): Option A.** From Level 18 the Car Park and the Plating Belt alternate days, so a day never has more than six steps (section 5). |
| 7 | Rewarded ad | `belt_slot`: "+1 waiting table", once a business day, never needed. |
| 8 | Money | None. Stars and Hype by the existing table. No ledger entry. |

## 1. The game, as the player sees it

- **The stage (portrait):** a banquet hall. In the middle a big round **platter** drawn as a **mosaic of food cubes** (the picture of the day's dish: a bowl of soup, a plate of salad...).
  A round **belt** runs around it. Under it a wooden **counter** with two parts: the **lane tray** (the waiting waiters, in lanes) and the row of **five waiting tables**.
- **The cubes:** each cell is a small glossy cube in one of up to six colours (tomato red, herb green, cheese yellow, cream...). The cubes are the dish; the plate's rim is cream.
- **The waiters:** each waiter has a colour and a **number** (how many cubes of its colour it can carry). They stand in 3 to 5 **lanes**; **only the front waiter of a lane can be tapped**; the ones
  behind step forward when the front one leaves.
- **One action:** tap a front waiter. It runs ONE lap round the belt. Wherever it passes a cube of its own colour that it can reach (see 2), it takes it, and its number goes down by one.
  When it has gone round: out of number, it leaves the stage happy; with number left it **goes to a waiting table** and stays there. Tap a waiter at a table to send it round again.
- **A table is a limited place:** five of them. A waiter that goes to a table (because the cubes it needs are still buried, or it is too big for what it could reach) uses one.
- **Win:** every cube is gone and the empty platter turns **gold**. 3 stars if you never needed more than 2 tables at once.
- **Trapped:** every table is full and no waiter anywhere can move without being left with nowhere to wait. "The kitchen is jammed." Try again is the same plate.
- **No clock, no timer chip, no Level badge** (the ui-copy rules forbid "Level N" in restaurant copy).

What the player has to think about: the belt only reaches the OUTSIDE of the picture, and taking the outer cubes uncovers the ones behind them. So the question is always "which waiter first?":
a waiter whose colour is buried would just go to a table; a big waiter sent when little of its colour is reachable leaves with number left and uses a table; a small one exactly the right size leaves clean.

## 2. The exact rules (the pure module is built from this, nothing else)

1. **The plate:** a square grid `size x size` of cells. Each cell is empty (outside the plate shape, or already taken) or has a colour 0..5. The plate shape is round, so the corners are empty.
2. **The belt positions:** `4 x size` positions in a loop, clockwise, each facing the centre: the top side left to right (facing down), the right side top to bottom (facing left), the bottom side right
   to left (facing up), the left side bottom to top (facing right). A waiter ENTERS at the middle of the bottom side.
3. **What a position can reach:** the FIRST non-empty cell along its line, looking inward from the edge. Empty cells (corners, already-taken cells) are looked through.
4. **A lap:** the waiter visits the `4 x size` positions in order, once, starting at the entrance. At each position, if it still has number left and the reachable cell is its colour, it takes that cell
   (the cell becomes empty at once, so a later position of the same lap can reach the cell behind it) and its number drops by one. At most one cell per position.
5. **After the lap:** number 0: the waiter leaves, for good. Number left: it goes to a free table and keeps its remaining number.
6. **A tap that finds nothing is allowed** (the waiter goes to a table with its full number): it is how a lane is cleared when the front waiter's colour is still buried. A tap that would leave the waiter
   with number left and no free table is **refused** with a small shake (no cost, no strike): the round is never lost by one tap.
7. **A waiter at a table** can be tapped: it makes a lap; if it takes cubes and still has number left, it goes back to its table; at 0 it leaves and frees the table. A tap that takes nothing is refused (no cost).
8. **Trapped** = no legal move: every front waiter and every table waiter, simulated, is either refused or leaves the state unchanged. The check is the same simulation the tap uses.
9. **Win** = no cube left. The number of cubes of a colour always equals the sum of that colour's waiters' numbers, so a won plate has no waiter left with number.
10. **Stars:** `peakTables` is the most tables in use at once. 3 stars: peak 0 to 2; 2 stars: 3 to 4; 1 star: 5. A used **Undo** (one per round) takes one star off, never below 1. A trapped round gives 0 and "Try again".
11. **Determinism:** `plateFor(save, level)` seeds from level, business day and rounds played. No clock, no `Math.random()`. A restart gives the same plate (same seed, same lanes).

### A worked example (computed with the real rules)

A 6 x 6 plate (B = blue, R = red, . = empty). The belt enters at the bottom middle.

```
. B B B B .
B B R R B B
B R R R R B
B R R R R B
B B R R B B
. B B B B .      20 blue cubes, 12 red cubes. Waiters: Red 12, Blue 20.
```

- **Tap Red 12 first:** the belt only sees blue, so it takes **0** and goes to a table with 12 left (1 table used). Tap **Blue 20:** it takes all 20 blue cubes in one lap and leaves; the red cubes are
  uncovered. Tap **Red 12** at its table: it takes 12 and leaves. **Won, peak 1 table: 3 stars.**
- **A different deck, Blue 8, Red 12, Blue 12:** Blue 8 takes 8 outer blue cubes. Red 12 then takes only **6** (the rest are still covered) and goes to a table with 6 left. Blue 12 takes the last 12
  blue cubes. The Red at the table takes its last 6. Won, peak 1 table.

## 3. The mosaic (the picture of the day)

- **Which dish:** `dishOfTheDay(save)`: the Today's Special dish when the Endless Restaurant has one (`restaurantEvents.ts`), else a stable pick among the dishes the player already has on the menu
  (the 48 customer-facing dishes of `BUSINESS_DISH_CATALOG`, by business day). It names the plate in the header ("Tomato Soup"); it never changes money or the menu.
- **Colours:** a dish has 2 to 5 distinct ingredients (12 dishes have 2, 29 have 3, 4 have 4, 3 have 5). Each ingredient gets one of the **eight game colours** (the palette in the Codex prompts file)
  by its picture: `scripts/make-belt-palette.py` reads the average colour of `public/business/ingredients/<id>.webp`, picks the nearest palette colour (`sauceColor.ts` `deltaE`), and writes
  `ingredientBeltColor.ts` (a table, no runtime image reading). **Plus the plate: cream for the rim, grey for the shade.** So a plate has 3 to 7 colours, capped by the tier; when two ingredients
  land on the same palette colour they simply share it. QA: every dish ingredient has a colour; no dish has fewer than 3 colours (a plate with two would be trivial, the plate colours are added).
- **The shape:** a round plate of `size x size`: a cream rim ring (2 to 3 cells), a grey shade crescent at the bottom, and inside it the dish: Voronoi-like blobs of the ingredient colours seeded
  from the plate seed, with a garnish pattern by dish category (a swirl for Curry, scatter for Salad, a line for Appetizer, a wedge for Dessert...). All pure and seeded.
- **Size by tier:** 20 x 20 (about 276 cubes) up to 36 x 36 (about 950). The cubes are drawn on **one canvas** (not 1,300 elements), see 6.

## 4. Waiters, lanes and the proof that every plate can be won

- **The deck is derived from the mosaic:** for each colour, its cell count is split into 2 to 5 waiters (numbers, none below 4); the waiters are shuffled into the lanes by the seed.
- **Solvable by construction:** the generator builds a plate and a deck, then a **solver** (depth-first, memoised on board + lanes + tables, with a node cap of 30,000) must find a winning order;
  if not, the seed is rejected and the next one is tried. The shipped game never searches: `plateSeeds.ts` holds, per tier, a list of seeds **already proven** by the same solver
  (built by `scripts/make-belt-seeds.mts`), and the QA re-proves the list. Runtime = pick a seed from the list, build the plate (milliseconds).
- **Difficulty is measured, not hoped:** the QA also plays "always the first legal move" and "always the best-looking move" on every seed and asserts the win rates stay inside a band per tier
  (below), so a tier can never be trivial or hopeless.

## 5. Where it sits in the routine (decided: Option A, developer 2026-11-15)

Today's opening routine has up to **six** steps (Check the delivery, Fridge Sort, Stock the shelves, Fridge Check, Sauce Station, Car Park). The jam plan's own rule is "at most six, each 45-90 s".

- **Option A (CHOSEN): one "service prep" slot that alternates.** From Level 18, odd business days: Car Park; even days: Plating Belt (`prepSlotToday(save, level)`: below Level 18 always the Car Park; from 18 `businessDay % 2 === 1` is the Car Park). Both stay mandatory, a day never has more than six steps, the
  Prep Cook does either. Before Level 18 the Car Park is daily, as now.
- **Option B (not chosen): a seventh daily step** ("Plate the banquet", n = 7, the last step). Simple, but 7 steps is the fatigue risk the plan warned about; the live `level_completed` numbers would tell.

The code supports both: `platingBeltDue(save, level)` and `carParkDue` read one function `prepSlotToday(save, level)`; switching is one line. **Prep Cook:** clears it with no stars from Level 33 (after the Car Park's 30),
`PREP_COOK_STEPS` gets `"belt"`. The "skip this step" ad (`skip_step`) works as for the others.

## 6. The screen

- **Layout (the concept, adapted to a phone):** the header chip ("🍽️ Plating Belt" and the dish name), the pause button (≥ 48 px), Paige's small bubble with ONE line ("Send the waiters in the right order!"),
  the platter and ring (a square sized from the stage, like the Car Park's ResizeObserver), the counter with the lane tray and the five tables. The how-to panel of the concept becomes a first-time card plus
  an ⓘ (`InfoTip`); no sentence over 14 words outside the ⓘ; the timer and the Level badge are dropped.
- **The cubes on ONE `<canvas>`:** redrawn on a change, a soft bevel (two tones) per cube so it looks like candy; 36 x 36 at 320 px wide is a cell of about 7 px (the cubes are not tapped, so no 48 px rule applies to them).
- **The waiters are DOM elements** (CSS transform only, no library): in the lane tray each is a **≥ 48 px** target with its number badge; on the belt a waiter's position is the point of the ring nearest the
  position it is visiting; it uses the "go" picture, unrotated, with a small bob. A taken cube flies to the tray in a short arc (CSS) with the sparkle.
- **Timing:** the logic resolves a tap instantly; the animation replays the lap in about 1.5 s; **a second tap while it runs fast-forwards it** and applies. `prefers-reduced-motion`: instant, no flight.
- **Feedback:** a refused tap shakes the waiter and shows a one-line reason ("Tables are full", "Nothing to collect yet"); the hint after 4 s idle glows a waiter that can take cubes now;
  the "why not 3 stars" line shows on the result ("3 tables at once").
- **Pause:** Resume / Restart this plate / Leave, as the other games. The round is not saved mid-way (a leave counts nothing), as the Car Park.
- **Sizes:** tested at 320 x 568, 360 x 640, 390 x 844, 430 x 900 and 768 x 1024, no sideways scroll; five lanes of waiters must each stay ≥ 48 px wide at 320 (5 x 56 fits in 320 with gaps).

## 7. State, rewards, ad, analytics

- **State:** `business.platingBelt = { rounds, stars, best, perfect, streak, howto, doneDay, slotAdDay }` (optional, no migration). No money, no stock, no ledger entry.
- **Stars and Hype:** the existing `HYPE_BY_STARS`; Paige's praise `PraiseGame` gets `"plating-belt"` (3 stars, with copy lines like the other games).
- **Ad:** `AD_PLACEMENT.beltSlot` / `belt_slot`: "Watch for one more table" (the sixth table is the golden one), once a business day, only in a round already started, never in the first round of the game (the production rules).
- **Analytics:** `plating_belt_started / finished / failed / skipped / auto / slot_ad` with `level`, `stars`, `peak_tables`, `undo`; stable names, no personal data.

## 8. What the prototype showed (200 random plates per row, one scratch script, not in the repo)

| Rule set | Tier 1 (20 x 20, 3 colours, 3 lanes) | Tier 2 (26 x 26, 4 colours, 4 lanes) | Tier 4 (36 x 36, 6 colours, 5 lanes) |
|---|---|---|---|
| Any waiter in the queue, repeated laps, unproductive taps refused (my first idea) | first-legal-move wins **200/200** | **200/200** | **200/200** |
| **Lanes, ONE lap, unproductive taps allowed (chosen)** | solvable 200/200, first-legal-move wins **160** (80 %), best-looking move 175 | solvable 200/200, first-legal-move **92** (46 %), best-looking 99 | solvable **170/200**, first-legal-move **47** (24 %), best-looking 54 |
| Lanes, one lap, unproductive taps refused | only 74 / 56 / 41 of 200 solvable (the lanes force idle sends) | | |
| Lanes, repeated laps, idle allowed | 189 / 134 / 74 first-legal-move wins | | |

What that means: with every waiter free to tap and refused idle taps the game is trivial (the first idea would have been a mistake); lanes plus one lap plus idle taps make a real puzzle that rises from
gentle (80 % won by a careless player) to hard (24 %), but about 15 % of the hardest plates have no win, so the generator MUST reject unsolvable plates (it does, section 4). The late solver needed up to
20,000 nodes on the worst plate (about 5 s for 200 plates in total), so the seeds are built offline. The numbers are for random blob plates; real dish plates must be re-measured.

**Tier table (BUILT 2026-11-15, measured on the shipped plates; the QA bands are the target, a phone test tunes them):**

| Levels | Plate | Colours (rim + food) | Rim (cells) | Waiters | Lanes | Tables | Target | Measured (300 shipped plates) |
|---|---|---|---|---|---|---|---|---|
| 18 to 27 | 20 x 20 | 3 (cream + 2) | 3.7 | 14 to 15 | 3 | 5 | 70 to 90 % | **76 %** |
| 28 to 44 | 26 x 26 | 4 (cream + 3) | 3.6 | 19 to 20 | 4 | 5 | 40 to 55 % | **49 %** |
| 45 to 64 | 30 x 30 | 5 (cream + 4) | 3.5 | 24 to 25 | 5 | 5 | 30 to 45 % | **38 %** |
| 65 to 91 | 36 x 36 | 6 (cream + 5) | 3.5 | 28 to 30 | 5 | 5 | 15 to 30 % | **21 %** |

"Measured" = the share of plates a careless player (always the first move that is not refused) wins. The shipped plates are the FIRST 300 solvable plates of each tier, not trimmed to a band
(an earlier build trimmed them to the top of each band and hid a generator that was too easy; the QA now asserts the band on the plates as shipped).

**What the build taught (the numbers above are not the prototype's; the plan's first guesses were wrong in two places):**
- The cream rim is what makes the ORDER matter: the food is out of reach until the rim is cleared. A thicker rim is the strongest difficulty lever (a rim of 3.5 on a 26-plate: 67 % won by a careless player; 5: 34 %).
- More waiters means harder, not easier: each is smaller, so more of them fail to finish and wait at a table. The number of regions per colour and the unevenness of the waiter sizes hardly matter.
- The deck follows the plan (2 to 5 waiters a colour, none under 4 cubes), with the waiters of a colour shared out in proportion, so no colour is one giant waiter (the first Codex build merged colour 0 into one waiter of 171 cubes).
- Only exactly-specified arithmetic (+ - * / sqrt floor) builds a plate: `Math.hypot`, `log`, `pow` may differ in the last digit between browsers, which could build a different plate on a phone than the one the solver proved. The QA reads the source and fails on them.
- The grey shade is art only (a crescent drawn under the plate); it is not a colour of cubes, so the prototype's numbers still hold.

## 9. Files to create and change (the Car Park's wiring, one for one)

| File | What |
|---|---|
| `src/game/business/platingBelt.ts` (new) | the pure rules: tiers, `plateFor`, `runLap`, `legalMoves`, `isTrapped`, `solve`, `starsFor`, `finishPlatingBelt`, `autoPlatingBelt`, `dishOfTheDay`, `prepSlotToday` |
| `src/game/business/ingredientBeltColor.ts` (new, generated) and `plateSeeds.ts` (new, generated) | the colour table and the proven seeds |
| `scripts/make-belt-palette.py`, `scripts/make-belt-seeds.mts`, `scripts/make-plating-belt-assets.py` (new) | the three generators |
| `src/components/kc/inventory/PlatingBeltGame.tsx` (new) | the screen (lazy), the canvas, the lanes, the tables, the overlays |
| `src/game/ads/platingBeltSlotAd.ts` (new) | the reward id, like `carParkTowAd.ts` |
| `src/App.tsx` | `platingBeltAction`, `watchPlatingBeltSlotAd`, `routineAuto` handling, the `?platingBelt=<level>` test hook (a separate `if`, after the `setScreen("kitchen"); setActiveLevelId(` text that the grandma's-fridge QA reads) |
| `ScreensRouter.tsx`, `components/kc/data.ts` (`ScreenId`), `restaurantScreens.ts` | the lazy screen "plating-belt" |
| `deliveryFlow.ts`, `businessTypes.ts` | `FlowStepId` `"belt"`, `PREP_COOK_STEPS`, `platingBelt?: PlatingBeltState`, `prepSlotToday` |
| `AudioManager.ts` | one or two synthesized sounds (a cube "tick", a table "ding"), no files |
| `PlayablesSDK.ts`, `public/playgama-bridge-config.json` | `AD_PLACEMENT.beltSlot` (a release-config change: say so to the developer) |
| `restaurant/miniGamePraise.ts` | `"plating-belt"` lines |
| `styles.css` | the keyframes (fly, bob, shake) |
| docs | `HANDOFF.md`, `REFERENCE.md`, `CLAUDE.md` (the ad list), this plan's status line |

**Tests that will need the new rule (found by building the Car Park, so done in the same commit and said so):** `car-park-qa` D and `tools/e2e/carpark.mjs` P10 / P11 (from Level 18 the Car Park is due on odd business days only, so "once a business day" becomes "once on its days"; Levels 15 to 17 are unchanged), `audio-qa` (the effect count), `mini-game-praise-qa` A1 / W2 (seven games),
`lazy-load-qa` L1 (twelve lazy screens; DONE with the preview screen, 2026-11-15), `playables-ads-qa` E6 (the new placement), `ui-copy-qa` (sentence length), `service-loop-qa` (no "Level N"), `restaurant-grandmas-fridge-qa` F8 (the hook text).
**New tests:** `plating-belt-qa.mts` (BUILT 2026-11-15: tiers, the engine-safe-maths source guard, 300 shipped plates per tier re-proved with structure and deck balance, the difficulty bands, the dish of the day, the rules, the hint and the stars; the groups below are the original plan, the routine ones are still to come; A rules and the worked example, B 300 proven seeds per tier solvable and re-proved, C difficulty bands, D tap legality and the refused taps, E stars and Undo,
F routine: due once a day, the alternate slot, the Prep Cook, no money, G every dish has colours and a plate), `tools/e2e/platingbelt.mjs` (BUILT 2026-11-15 for the preview screen: B1 to B10; open at 18 / 28 / 45 / 65; a waiter takes cubes; a refused tap shakes;
a table is used; Try again gives the same plate; the pause; a clean win and the gold platter; no sideways scroll at 320 and 390; no console error; **the visual check: every waiter, cube and
flying piece stays inside the stage and nothing passes behind a panel** (the lesson of the Car Park's walls)).

## 10. Order of work (the production rules, with a gate at each step)

1. **Rules and QA** (pure module, the seeds, the palette table, `plating-belt-qa`). **DONE 2026-11-15** (built by Codex, then reviewed and corrected: the rim, the even deck, the bands re-measured, the engine-safe maths).
2. **Plain screen** (coloured discs and rectangles, the canvas, the lanes, the tables, the lap animation). **DONE as a developer preview (`/?platingBelt=18`, also 28, 45, 65), with Undo, the refused-tap shake and the hint of step 4 already in.**
   **GATE, STILL OPEN: the developer plays it on a real phone and says it is fun.** Nothing else (art, routine, rewards, ads) is added before.
3. Numbers tuned from the phone (lap speed, tiers, number sizes, table count).
4. Failure and restart: trapped, Try again, Undo, the refused-tap messages, the "why" line, the hint, Paige's how-to card.
5. The routine slot, the Prep Cook, the ad, the praise, analytics, the e2e, the docs.
6. **Art** (Codex): run the prompts file. The screen swaps the plain shapes for the pictures, with the shapes still the fallback.
7. Release: gates, `BUILD_VERSION`, the Playgama upload (the developer says yes first), store text and a screenshot of the new game in the same release.

## 11. Risks and what is not known

- **Fatigue:** a seventh daily step. Option A in 5 avoids it; the live `level_completed` and step-quit numbers decide later.
- **The real plates are not the prototype's:** re-measured on the real generator (rim, 2 to 5 waiters a colour), see the tier table in 8. The plate does not depend on the dish: the dish only picks the colours, so the proof holds for every dish.
- **The real game's exact rules are not documented anywhere I could read:** only app-store text. The lanes, one lap and idle taps are what the prototype supports as a good puzzle; the developer's phone test is the judge.
- **Phone fit:** a 36 x 36 canvas at 320 px wide gives 7 px cubes; the picture must still read as the dish. Checked in step 2.
- **Bundle:** the art set stays under about 1.3 MB (the preflight bundle is already above its 15 MiB target, a known item).
- **No real-phone test yet:** the tap feel, the lap speed and the difficulty can only be judged by the developer.
