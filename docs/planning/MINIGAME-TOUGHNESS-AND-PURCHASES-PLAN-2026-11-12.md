# Tougher mini-games and a restaurant that buys a lot more (developer 2026-11-12, from player reviews)

Request: "Players said: increase the toughness of the mini-games, like the count of ingredients, and plan it properly. To increase the ingredients in the
mini-games the restaurant must also purchase a lot more, so raise the basic purchases and the requirement amounts. Plan it in detail and implement it."

BUILT, pushed (a932aad). **Corrected the same day by the deep check (docs/HANDOFF.md, "Deep check 2"):** a shortage day now buys a big row in several purchases (section 4 said the player does it by hand: the plan buttons could not), one delivery is at most 3 baskets (section 4 said "2 baskets"; a two-day plan was up to 15), a walk-in's reserve is batched at the next level, and a full Basic fridge with no fridge money gets the ad / credit cover. Suites: `prep-batch-qa` (new) plus the updated ones listed in section 7.

## 1. What was wrong (measured on 2026-11-12, empty fridge, every level's own orders)

- One order used ONE plate's portion (a tomato 0.3 lb, a bread quarter loaf). A whole service bought **$1-$16 of food** ($610 for the 89 stock levels of the
  campaign), at Levels 4-20 about **8 pieces** for the whole delivery.
- Three of the four routine mini-games work on what was BOUGHT: Delivery Inspection (the crate), Unpack the delivery (the pieces), Stock the shelves (the sets
  of supplies), and the Fridge Check judges what is in the fridge. With 6-10 pieces, every round was tiny, and the tiers' numbers (8-16 pieces, 9-17 items,
  2-8 sets, 5-12 cards) were small too.
- The Market sells by the quarter pound, so a plate's 0.3 lb became "buy 0.5 lb": 1-2 tomatoes.

## 2. The design: two levers that move together

### A. The restaurant buys a batch (`restaurant/prepBatch.ts`, pure, no new save field)

A service preps a **batch**: each ingredient of a level's OWN order is used `prepBatchAt(level)` times its plate portion. The Pre-Service Check asks for it, the Market
sells it, the serve takes it (ONE function, `campaignStock.orderRequirements(save, recipe, which, level)`), so nothing is left over and the Fridge Check
stays about real food.

| Level | 3 | 8 | 14 | 23 | 40 | 70+ |
|---|---|---|---|---|---|---|
| Batch (x the plate) | 3 | 4 | 5 | 6 | 7 | 8 |

Smooth between the rows (`difficultyRamp.rampOf`); 1 (the plain plate) at Levels 1-2 and when no level is given.

- **Row cap:** one ingredient of one order never takes more than **4 units** until Level 22 (the Basic fridge holds 40) and **6** from Level 23 (the
  completionist buys the Commercial fridge there, `restaurant-fridge-pressure-qa`). A heavy portion (a steak 1.5 lb, a watermelon) is never cut below its own plate.
- **Who is batched:** only a level's own orders. **Menu guests and walk-ins stay one plate** (`asPlate`, a WeakSet marker on a recipe copy: no field is added to the recipe).
  They are optional extras; a late service with a dozen guests must not need a dozen batches (fridge, cash), and the economy stays as it was for them.
- **Why not more orders:** orders pay, so it would move the frozen baseline (Revenue 51,275 / Completion 243,953 / COGS 11,317 / Quality 1,040 / Net 284,951). The batch only
  costs food, and the order's pay is unchanged.

Measured (own orders, empty fridge, `prep-batch-qa` D):

| | before | after |
|---|---|---|
| Pieces to sort, Levels 4-20, average per service | about 8 | **about 20** (6 at Level 3, then 10-32) |
| Food bill of the levels' own orders, Levels 3-91 | $610 | **about $3,300** (Level 18 steak service $75; against about $299k earned) |
| Fridge units one service needs, Levels 3-22 | 1-11 | **at most 17** (the Basic fridge holds 40) |
| Fridge units one service needs, Levels 23+ | 1-12 | **at most 38** (the Commercial holds 100) |

### B. Every mini-game asks for more

| Game (where) | Tier numbers before | After (2026-11-12) |
|---|---|---|
| **Unpack the delivery** (`business/fridgeSort.ts`) pieces per basket by tier (3 / 14 / 27 / 44 / 74) | 8 / 10 / 12 / 14 / 16 | **12 / 15 / 18 / 20 / 22** |
| shelves on screen | 3 / 5 / 6 / 8 / 10 | **4 / 6 / 7 / 9 / 10** |
| pieces of ONE ingredient | 5 | **6 (Level 3) to 12 (Level 44)** (`piecesCapAt`) |
| clock (x on 15 s + 2.8 s a piece) | 1.6 / 1.3 / 1.1 / 1 / 1 | **1.5 / 1.25 / 1.12 / 1.08 / 1.05** |
| **Delivery Inspection** items | 9 / 10 / 12 / 14 / 17 | **12 / 14 / 17 / 20 / 24** |
| bad ones to find | 2 / 3 / 3-4 / 4-5 / 5-6 | **3 / 4 / 4-5 / 5-6 / 6-8** |
| clock | 60 / 55 / 50 / 45 / 45 s | **70 / 65 / 60 / 55 / 55 s** (more items need more time); item size shrinks a little so they fit |
| **Stock the shelves** sets per board | 2 / 4 / 6 / 8 / 8 | **3 / 5 / 7 / 9 / 9** |
| sets from a purchase of 1 / 2 / 3-5 / 6+ packs | 1 / 1 / 2 / 3 (max 3) | **1 / 2 / 2-3 / 3-4 (max 4)**: 1, 2-3, 4-6, 7+ packs give 1, 2, 3, 4 |
| **Fridge Check** cards a night (min / max) | 5-12 / 6-12 | **8-16 / 9-18** |
| Bin cards at least | 1 / 2 / 2 / 3 / 3 | **2 / 3 / 3 / 4 / 5** |
| Use next cards at least | 1 / 1 / 2 / 2 / 3 | **2 / 2 / 3 / 3 / 4** |
| wrap shelf | 4-8 | **5-9** |
| **Sauce Station** first tier | 75 s, tolerance x1.5 | **65 s, x1.3**; the later tiers 62 / 58 / 54 s (were 70 / 65 / 60) and x1.1 at tier 2 |

The ramp stays smooth between tiers (`difficultyRamp.ts`); nothing ever shrinks as the level rises.

Not changed: the Sauce Station's reference recipes (their scoops are the recipe), cutting, cleaning, the dish-washing pace (developer 2026-11-08), the money the games pay (none).

## 3. Keeping the star rules honest at bigger sizes

A bigger basket makes one mistake cost less of the score, so the third star had to be protected by the rule, not by luck:
- `fridge-sort-qa` **H4b** (new) walks every level and size from 4 to 22 pieces: **one wrong drop never earns three stars**, and a careful pace with two wrong drops still earns a star.
- STAR_AT stays [0.5, 0.74, 0.92]. A flawless careful round (2.2 s a piece) can still reach three stars (22% of the careful simulated players, 6% before: they are the flawless ones).
- The clock factors of the late tiers went up a little (1.12 / 1.08 / 1.05) so an average player (3 s, 10% wrong) still gets a star 95% of the time at 20-22 pieces.

## 4. What the bigger purchases do to the rest of the game (checked, not guessed)

- **Fridge:** from Level 23 the Basic fridge (40) holds a whole day's plan no more; the completionist buys the Commercial one at L23 and the Professional at L26 (as before). A player who does not keep
  buying per service; nothing blocks (a short service is covered by an ad or supplier credit, CLAUDE section 7). The game still decides the day's stock service by service.
- **Temporary Shortage** (a supplier event, one day in nine, caps ONE purchase at 10 units): a late row can need 13-22 units (chicken at Level 55, steak at Level 80: 18-22 units). The Market card
  already says "over today's limit"; the player buys 10 and the rest in a second tap. The simulated player does the same now (`restaurantCampaignSim.mts buyIngredient`).
  The event's own number is untouched (classic Business tests).
- **Economy:** no pay moved, no reward, no ledger rule. The food bill grows by about $2,700 over the campaign. The completionist still ends above $150k (`restaurant-final-economy-qa` T1/T2), the frozen
  campaign simulation does not read the batch (`prep-batch-qa` D5).
- **Time per service:** a delivery has more baskets (a service of 28 pieces is 2 baskets of 15 at Level 14). The Prep Cook and the rewarded skip still do a step for the player (no stars).

## 5. Where the code is

- `restaurant/prepBatch.ts` (new): `PREP_BATCH_TIERS`, `prepBatchAt`, `rowCapAt`, `batchedQuantity`, `asPlate`, `isPlate`.
- `restaurant/campaignStock.ts`: `orderRequirements(save, recipe, which, level?)` (the one rule), `serviceStockCheck` and `consumeCampaignOrderStock` pass the level.
- `restaurant/marketPlan.ts`, `restaurant/levelGoals.ts`: pass the level; `restaurant/menuGuests.ts`, `restaurant/orderPool.ts`: guests are `asPlate`.
- `business/fridgeSort.ts` (`DIFFICULTY`, `piecesCapAt`, `piecesFor(id, stock, cap)`, `MAX_PIECES_HARD`), `business/deliveryInspection.ts` (`INSPECTION_TIERS`), `business/stockroomSort.ts`
  (`TIERS`, `setsFor`, `MAX_SETS_PER_LINE`), `restaurant/fridgeCheck.ts` (`checkTiers`), `business/sauceStation.ts` (`SAUCE_TIERS`).
- `components/kc/inventory/FridgeSortGame.tsx` `pileLayout` (smaller pieces and four rows for a basket over 16), `components/kc/MarketPlanPanel.tsx` (the basket hint uses the level's piece cap).

## 6. Not done (needs your word or a device)

- A look at the 22-piece basket and the 24-item crate on a real phone (checked at 390 x 844 and 320 x 568 in Chrome: nothing scrolls sideways; at 320 the ten shelves scroll as before).
- The first-20-levels pace: Levels 3-12 now have bigger first rounds (12 pieces, 11-12 items). If the live numbers (`level_completed` by level) show a cliff there, lower `PREP_BATCH_TIERS` for
  Levels 3-14 first (one table).
- A matching change for the supplies the restaurant buys (tableware, napkins): their amounts follow the covers and the tables, not the batch. The Stock the shelves boards are bigger through the tier
  numbers and the sets per purchase only.

## 7. Tests

New: `scripts/prep-batch-qa.mts` (A the batch, B one order's amount, C the check and the serve are one rule, D it buys more and fits, E the four games, F wiring and saves, G guests are one plate).
Updated to the new rule (CLAUDE section 8, each says why): `fridge-sort-qa` (C2b, C2d, C6, C11, C12, D1, D2, D9, H4, new H4b, L7, M2-M4), `stockroom-sort-qa` (A4, B1, B4, B10, B11, F7, H2), `fridge-check-qa` (A3, C5),
`difficulty-ramp-qa` (A3), `restaurant-stock-qa` (A2/B1 and the stocking helper), `walkin-qa` (the stocking helper), `restaurant-market-needs-qa` and `iphone-fixes-qa` (a player past Level 23 has the Commercial fridge),
`restaurant-economy-pass-qa` (X3), `oven-step-qa` (E2 allowlist, dated), browser `fridgesort.mjs` (S18, S20), `deliveryinspection.mjs` (I3, I6, I11), `fridgecheck.mjs` (the answer loop).
