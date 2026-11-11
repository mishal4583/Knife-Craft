# Mini-games: more to check, a gradual climb, and a real routine (developer 2026-11-11)

Developer asks (the "Bugs and Issues" round of 2026-11-11): more things to check for good and bad in Fridge Sort, Stockroom Sort, Fridge Check and Delivery
Inspection, the challenge and engagement growing gradually; the Sauce Station and Fridge Check not optional; the delivery check at Level 3 and the sorting a
level later; a skip by watching an ad for the player who does not want to play them; the word "practice" gone.

## What was wrong

- The five tiers of every game start at fixed levels (3 / 14 / 27 / 44 / 74), so Levels 4-13 gave the same 8-piece basket, Levels 6-18 the same 2-set board,
  and the Fridge Check showed whatever the fridge held: often 3 fresh items, nothing to bin, no "use next".
- The Sauce Station and the Fridge Check were optional chips; the Fridge Check fell back to a one-tap chore when the fridge was quiet.
- Delivery Inspection and Fridge Sort both opened at Level 3.

## What was built

1. **A smooth ramp** (`game/business/difficultyRamp.ts`, `scripts/difficulty-ramp-qa.mts`): every number moves from one tier's value to the next tier's value
   over the levels between them, and is exactly the tier's own on its first level. Fridge Sort's basket (8 pieces at Level 4 growing to 10 at Level 14, 12 at
   Level 27 ...) and its decoy targets, Stockroom Sort's board (2 sets at Level 6 growing to 4 at Level 19 ...), Delivery Inspection's items and defects,
   Fridge Check's cards. Nothing ever shrinks as the level rises.
2. **Fridge Check always has something to judge** (`restaurant/fridgeCheck.ts`): the three piles (Keep / Bin / **Use next**) from the first tier (Use next was
   hidden until the second); each tier has a minimum deck and a minimum of Bin and Use next cards (tier 1: 5 cards, 1 Bin, 1 Use next; tier 5: 12 cards, 3 Bin,
   3 Use next, all ramped). A quiet fridge is topped up with seeded **training cards** (common ingredients with a made-up age): never real stock, never
   removed, bought or paid. The wrap stage is topped up the same way. The game is always open once freshness is live (Level 10), so the one-tap fallback is gone.
   "Play again" deals a new deck.
3. **Delivery Inspection is easier to read** (`DeliveryInspectionGame.tsx`): the three instructions (tap the bad ones, drag the fresh ones aside to look behind
   them, the magnifier) are on the ready card, in the guide and in the in-game line; the 🔎 magnifier is in every tier (30 / 22 / 16 / 12 / 10 s a round) so a
   phone that cannot pinch-zoom still has a zoom.
4. **The routine** (`business/deliveryFlow.ts`): check the delivery (Level 3) -> Fridge Sort (Level 4) -> stock the shelves (Level 6) -> Fridge Check (the
   closing chores, Level 10) -> **Make today's sauce (Sauce Station, step 5, from Level 10; Levels 7-9 are its free discovery)**. Each step holds the next
   service until done. A Prep Cook does a step (a button inside each game, no reward); the new **rewarded skip** ("Skip with an ad", placement `skip_step`,
   3 a day, `business.stepSkips`) does it too, only on `rewarded`, no money, no ledger. The game itself still gives the stars, Hype and pins.
5. **The order**: `FRIDGE_SORT_CRATE_LEVEL = 3` (the delivery waits in the crate and is checked), `FRIDGE_SORT_FIRST_LEVEL = 4` (the sorting game),
   Paige's tips come only while their step really waits ("check it" at Level 3, "sort it into the fridge" at Level 4: never "play Fridge Sort").

## Not built

- Stockroom Sort's depth / locks / mystery pieces stay on their tiers (44 / 74): they are new rules, not more of the same; the ramp only grows the board.
- The training cards are not drawn with their own art: they use the real ingredient pictures.
