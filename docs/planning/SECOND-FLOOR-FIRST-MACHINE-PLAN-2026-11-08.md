# The Second Floor: buying the first machine (developer 2026-11-08, item 4 of "Bugs and Issues KnifeCraft.docx")

Ask: "proper instruction to buy machines on the second floor after the first visit, and only when the player has enough money to buy and set up the machines and the other required things. Make plans for this and maintain it properly."

## The rule (one place: `restaurant/floorGuide.ts`)

- The first machine is the cheapest one on sale (the Coffee machine, $500).
- It is bought only with the price **plus the reserve** in hand: `SECOND_FLOOR_RESERVE_CENTS` ($300, `config/earlyLevels.ts`), the food and wages for the next service. So $800.
- Money waiting on the floor counts toward it.
- Nothing moves money here: the buy is still `buyStation` (one debit, one ledger entry).

## What the player sees, in order

| Step | Where | What |
|---|---|---|
| 0. Level 11 | the map | the **2nd Floor** medallion button (`UpstairsButton`): a lock with "Level 11" before; after it opens it says "Save for a machine" |
| 1. First visit, short of money | Second Floor, bottom card (`floor-first-machine`, stage `save`) | "Save $X more": the machine's price, the $300 to keep, a progress bar "$have of $800" |
| 2. Enough money | same card, stage `buy` | "Buy the Coffee machine": the price, what is left afterwards, a pointing hand and one Buy button; the map button breathes and wears "New!" |
| 3. Paige | any screen | the `second-floor` beat, once, only with $800+ and no machine ("You can afford your first machine. Take a look!") |
| 4. The guide | the Restaurant Guide card | the `floor-machine` step, first in line, only with $800+ |
| 5. After the machine | Second Floor | the ordinary "Next: ..." goal strip (`floorGoal.ts`): tables, polish, tier, the next machine |

The floor's own machine panel and the Market's "Automated food hall" card use the same rule: the first machine's Buy says "Save $X more to keep cooking" / "Keep $300 for food" until the reserve is there.

## Maintaining it

- One constant moves everything: change `SECOND_FLOOR_RESERVE_CENTS` and the guide, Paige, both buy buttons, the map button's note and the tests follow.
- The machine order and prices are `secondFloor.ts` (`STATIONS`); the first machine is the cheapest unlocked, so re-pricing never needs a code change here.
- Tests: `bug-batch-qa` section 4 (the stages, the missing amount, the null cases), `early-levels-qa` D (Paige's offer), `restaurant-guide-qa` A2/A7, `restaurant-second-floor-qa`; browser: `tools/e2e/bugbatch.mjs` B4 (with $400 "save", with $900 "buy" and a hand).
- Not done on purpose: a forced tutorial or a locked floor. The floor can be visited from Level 11; only the first purchase is guided and gated.
