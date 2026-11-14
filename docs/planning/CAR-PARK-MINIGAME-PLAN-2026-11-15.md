# Car Park: the shared-lot jam mini-game (plan v2, developer 2026-11-15)

Developer's brief: the vehicles come to our restaurant; the car park is **shared with the neighbour's building**; when vehicles park they get stuck and we release them
**without making mistakes**, like in the real game. This replaces the "Loading Dock / delivery carts" idea (section A of
`JAM-BELT-SORT-MINIGAMES-PLAN-2026-11-14.md`); the Plating Belt and Drink Bar stay as written there.

Rules that apply: `MINIGAME-PRODUCTION-RULES-2026-11-14.md` (plain art first, a phone feel check before rewards and art, every lot solvable by construction, one-tap
retry). The step is mandatory; the hired Prep Cook can do it with no stars. Art prompts for Codex: `CAR-PARK-CODEX-PROMPTS-2026-11-15.md`.

NAME: **Car Park** in the game ("🚗 Clear the car park"). Not "Parking Jam", which is another studio's title.

## 0. Decisions (the developer's answers of 2026-11-15)

| # | Question | Decision |
|---|---|---|
| 1 | Mistakes | "Whichever is best for the game": **three strikes** (my pick, reasons in section 5). The third honk ends the round; Try again is one tap on the SAME lot. |
| 2 | Place in the routine | The **last step before START**. |
| 3 | Colours | Our guests' vehicles are coloured, the neighbour's are white / grey. The lanes rule comes later (it now has real places on screen, see 1). |
| 4 | Look | **Very beautiful and attractive**, warm painted 2D in the style of the restaurant map (a top-down painted toy look: glossy, chunky, rounded). **Our restaurant is a small part visible on the LEFT edge, the neighbour's building on the RIGHT edge.** |
| 5 | Boosters | One free Tow per round (it costs the third star) and a rewarded second Tow (`car_park_tow`, once a day, never needed). |
| 6 | Unlock | **Level 15**, after every other mini-game has been introduced (Fridge Sort / Delivery Inspection 3-4, Stock the shelves 6, Sauce Station 7-10, Fridge Check 10). |

Why pure top-down painted art and not the 3D-toy look of the reference pictures: a vehicle is drawn once and **rotated by CSS** to face up, down, left or right. A 3D
three-quarter car cannot be rotated and still look right; a pure overhead car can. The painted toy shading (glossy highlights, thick rounded bodies, soft rim light) gives the
"attractive toy" feeling without 3D.

## 1. The game and the screen

- **The scene (portrait, 540 x 960 logical):** in the middle the lot (dark warm asphalt, no painted lines). **Left edge, about 11 % of the width: a slice of OUR restaurant**
  (the timber-framed front of the Neighbourhood Café, a scalloped awning, flower boxes, a lantern, one wooden door with a small cobbled drop-off lane). **Right edge, about 11 %:
  a slice of the neighbour's building** (a clean brick-and-glass front with a canopy and its own service lane). **Top and bottom edges: the street** (kerb, road, a crosswalk).
  The restaurant and the neighbour are only "slightly visible", as asked; they sit in the same picture as the lot.
- **The vehicles:** each is one cell wide and 2 (car), 3 (van) or 4 (bus) cells long, lying horizontally or vertically, with an **arrow** on its roof (drawn by the game, not
  painted) pointing forwards or backwards along its length. Our guests' vehicles are coloured (red, blue, yellow, green, orange, purple); the neighbour's are white and grey.
- **The one action:** tap a vehicle. It drives straight along its arrow and off the lot, **if every cell in front of it is empty**. Driving left it enters our restaurant's lane, right
  the neighbour's, up or down the street.
- **A mistake (a honk):** tap a vehicle whose way is blocked. It creeps forward, bumps the vehicle in front, a horn sounds, both shake and roll back. The neighbour loses one of
  **3 hearts of patience**. Stars: 3 = no honk, 2 = 1 honk, 1 = 2 honks.
- **Win:** every vehicle is out. Our guests' cars that left through the restaurant lane drop their guests at the door (small guests walk in; phase 5).
- **No clock.** The only pressure is your own mistakes.

A tiny lot (5 x 5). Each letter is one vehicle, 2 cells long; the arrow is on its roof:

```
        1 2 3 4 5
   1    . . . . .        A: vertical, arrow up      free (nothing above it)
   2    . B B C .        B: horizontal, arrow right BLOCKED by C
   3    . . . C .        C: vertical, arrow down    free (rows 4-5 of its column are empty)
   4    D D . . A        D: horizontal, arrow left  free (nothing to its left)
   5    . . . . A
```

Free at the start: A, C, D. B waits for C. Tapping B first is a honk; tapping C, then B is clean.

## 2. How a lot is made fair: solvable by construction

A lot is solvable exactly when its "blocked by" relation has **no cycle**. The generator makes that true by building the lot backwards, so no lot can be unwinnable:

1. Choose the order the vehicles will leave: r1 first ... rn last.
2. Add the vehicles to an empty grid from the LAST to leave to the FIRST. Each new vehicle is placed on free cells, and the cells in front of it (its way out) must be free of
   every vehicle added so far. Vehicles added later may stand in front of it; they leave before it does.
3. So leaving in the order r1 ... rn always works with no honk. A seeded generator picks positions, sizes, arrows and colours; no `Math.random`.
4. **Difficulty is measured, not guessed:** the generator also computes (a) how many vehicles are free at the start, (b) the longest "blocked by" chain, and (c) how many
   first moves look free but lead to a long chain (traps). Each tier has a target range; a seed outside it is skipped (the next seed is tried, still deterministic).

`car-park-qa` proves for 500 seeds per tier: every lot is solvable with zero honks, the solution order exists, no vehicle overlaps another or leaves the grid, the free count, chain
length and vehicle count sit inside the tier's range, and the same seed always gives the same lot.

## 3. Difficulty (one table, like the other mini-games)

The lot is at most **6 columns x 9 rows**: with the two edge slices (about 11 % each) the 6 columns are about 44 px each on a 320 x 568 phone, and a whole vehicle is at least
44 x 88 px to tap. Vehicle counts keep the lot under about 80 % full (a full lot has no room to be interesting); they are tuned in the prototype.

| Tier | From level | Grid | Vehicles | Sizes | Free at start | Longest chain |
|---|---|---|---|---|---|---|
| 1 | 15 | 5 x 5 | 5-6 | cars | 3-4 | 2 |
| 2 | 22 | 5 x 7 | 8-10 | cars, vans | 2-3 | 3 |
| 3 | 32 | 6 x 8 | 10-13 | cars, vans | 2 | 4 |
| 4 | 45 | 6 x 9 | 14-16 | + a bus | 2 | 5 |
| 5 | 65 | 6 x 9 | 16-18 | + a bus, more traps | 1-2 | 6 |

## 4. What makes it feel good (the first prototype must have these)

- A vehicle accelerates out along its arrow with an ease-in, a soft whoosh and a puff, and vanishes off the edge. CSS transform only, no animation library.
- A honk is a real **horn** (two short synthesized notes in `AudioManager`), both vehicles shake, a heart pops off the patience bar and the neighbour's face frowns.
- The patience bar at the top shows the neighbour's face with 3 hearts. It is also the "why" of a lost star, so the result needs no explanation.
- **Hint:** 4 s without a tap and one free vehicle glows with a pulsing ring (as the Sauce Station's hint).
- **Tow truck (booster):** one per round, free: tap it, then tap any vehicle and it is towed away at once (no honk). Using it costs the third star (the result says so). A second tow
  is a rewarded ad (`car_park_tow`, once a day, never needed to progress).
- Pause card: Resume / Restart / Leave (the same as the other five). Restart = the same lot from the top, nothing counted.

## 5. Why three strikes, and how it stays fair

Three strikes makes a mistake matter (as in the real game) while the lot, the lesson and the way forward all stay:

- The third honk ends the round ("The neighbour called a tow truck!"). **Try again** puts the SAME lot back in one tap, no ad, nothing lost, and the player has already seen the lot.
- After two failed tries on one lot the hint stays lit on the next free vehicle. The mandatory step can never block the day: the hired Prep Cook and the "skip this step" ad
  (3 a day) always remain.
- A lot is never harder than its tier says, and an unlucky lot is impossible (section 2).

This differs from the production-rule sentence "a mistake never ends the round". The real intent of that rule is *never a dead end and never a slow restart*, and three strikes
keeps both. I will reword the rule to "a mistake never blocks progress, and a restart is one tap" in `MINIGAME-PRODUCTION-RULES` and `CLAUDE.md` when the prototype is built.
(The alternative, stars only, stays one constant: `CAR_PARK_STRIKES = 3` or `null`.)

## 6. Where it sits in the restaurant, and what it gives

- **Routine:** a sixth step, **"Clear the car park"**, the LAST step before START ("the guests arrive at opening"). From **Level 15**, with a how-to card (Paige explains it the first
  time). The five existing steps stay. When the Plating Belt and Drink Bar arrive they rotate into the same slot (service 1 car park, 2 plating, 3 drinks).
- **Gives:** stars and Hype by the existing table (`addHype`, as Fridge Sort and the others); **no money, no stock, no ledger entry**.
- **Prep Cook:** `autoCarPark` clears the lot with no stars (a "Prep Cook does it" button, as for the others). He is hired from Level 30, so before that the skip ad covers a player who
  does not want to play.
- **Paige:** a 3-star lot is praised on the kitchen home page (`PraiseGame` gets `"car-park"`, four lines such as "Not one honk! The neighbour is happy.").
- **The neighbour:** only the right-hand building and a face on the patience bar; a different building per chapter later (a bakery, a bank, a dentist, a gym). No rules.
- **Lanes rule (polish, after the feel is good):** the restaurant lane (left) takes only our guests' vehicles, the neighbour's lane (right) only the neighbour's, the streets (top,
  bottom) anyone. The generator respects it, so the arrows mean something; it adds meaning, not difficulty.

## 7. How it is built (the pattern of the other mini-games)

| Piece | Detail |
|---|---|
| Pure rules | `game/business/carPark.ts`: the tier table, `lotFor(save, level)` (seeded, backwards generator), `canLeave(lot, id)`, `leave`, `honk`, `solve` (the QA's proof), `finishRound`, `autoCarPark`, `starsFor(honks, towUsed)`, `lostStarReasons`, `CAR_PARK_FIRST_LEVEL = 15`. No clock, no random. |
| State | `business.carPark` `{ rounds, best, stars, perfect, streak, howto, doneDay }` (optional, no migration), like `stockroomSort`. |
| Screen | `components/kc/inventory/CarParkGame.tsx`: the backdrop, the grid of absolutely positioned vehicles with CSS transforms (the whole vehicle is the tap target), the patience bar, pause / Restart, hint, tow, the result with "why not 3 stars". Layout constants: left slice 11 %, lot 78 %, right slice 11 % of the width. |
| Routine | `FlowStepId` gets `"carpark"`; `flowSteps`, `PREP_COOK_STEPS`, `routineStepDone`, the "Before you open" sheet, the Pre-Service Check. |
| Ads | one new placement `car_park_tow` in `AD_PLACEMENT`, `PlayablesSDK.ts`, `playgama-bridge-config.json`, `playables-ads-qa`; granted only on the `rewarded` state; no money so no ledger entry. |
| Sound | `AudioManager`: a horn, a whoosh, a soft thud (synthesized; `audio-qa`). |
| Analytics | `car_park_started`, `car_park_finished { level, stars, honks, tow }`, `car_park_failed`, `car_park_skipped`, `car_park_auto`. |
| Art | `scripts/make-car-park-assets.py` turns `Car Park Assets/<name>.png` (local, gitignored) into small WebP in `public/business/carpark/`; the game uses a picture when its file exists and draws plain shapes when it does not, so the art can arrive a batch at a time (as the sauce products did). |
| Tests | `car-park-qa` (A solvable for 500 seeds a tier, B tier ranges, C honk / stars / three strikes, D tow, E Prep Cook and save round trip, W wiring), e2e `carpark.mjs` (a free vehicle leaves, a blocked one honks, three honks fail, Try again gives the same lot, Restart, the hint, 320 x 568 to 768 x 1024), updates to `difficulty-ramp-qa`, `delivery-flow-qa`, `mini-game-praise-qa`, e2e `deliveryflow` and `paige`. |

## 8. Order of work

1. **Plan approved** (this document) and **art ordered** from Codex in parallel (`CAR-PARK-CODEX-PROMPTS-2026-11-15.md`). The game does not wait for the art.
2. **Prototype:** `carPark.ts` + `car-park-qa` + the plain screen (plain rounded rectangles for vehicles and plain colour strips for the restaurant and neighbour slices),
   reachable from the routine at Level 15 and a debug entry so you can reach any tier. Honk, hearts, three strikes, hint, tow, Restart. Browser test. **You play it on your phone.**
3. We tune the numbers together (speed, tier sizes, hearts) until it feels good. Nothing else is added meanwhile.
4. The painted art goes in as it arrives (backdrop first, then vehicles, then the faces and effects). Re-check the layout at 320 x 568 to 768 x 1024.
5. Routine step, Prep Cook, the ad, Paige's praise and how-to, the lanes rule, docs, the store line and screenshot with the release.
6. Later: a neighbour building per chapter, guests walking into the restaurant.

## 9. Risks

- **Small tap targets:** about 44 px cells, so the grid is capped at 6 x 9; checked in the prototype on 320 x 568 first.
- **The slices are narrow:** about 35 px of restaurant on a 320 px phone. The art is drawn so even a thin slice reads (a timber edge, a lantern glow, a door and a lane).
- **Too easy or too hard:** tiers are measured (free count, chain length) and tuned from one table after your phone test.
- **A hard fail on a mandatory step:** Try again is one tap on the same lot, the hint stays on after two failures, and the Prep Cook / skip ad remain.
- **AI art that does not line up:** the lot floor is plain (no painted bay lines), so any slight difference in where the slices begin does not matter; the game aligns the grid by its own
  constants and the build script crops the picture to the agreed proportions.
- **No real-phone test yet:** the feel of the tap, the bump and the horn can only be judged by you.
