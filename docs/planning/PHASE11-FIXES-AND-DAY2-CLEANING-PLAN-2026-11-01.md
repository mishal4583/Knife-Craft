# Phase 11: eight fixes and cleaning from Day 2 (developer 2026-11-01)

The developer's eight points, in the order they were given. Each says what was wrong, the rule that now holds, where it lives, and how it is
tested. Nothing here moves money except through the existing ledger rules.

## 1. Grandma's section pointers wait for the first service

- **Wrong:** "This is your Inventory" covered the Kitchen before the player had cut anything.
- **Rule:** only the Market's pointer comes before Level 1 is finished (it starts the first run: hire, then buy). Inventory, Business and the
  rest wait until the player has reached Level 2 (`POINTER_AFTER_FIRST_SERVICE`, `firstLevels.ts` `sectionToPoint`).
- **Tests:** `first-run-guide-qa` (P block), `restaurant-first-levels-qa` P1.

## 2. The cash lies beside the people who paid

- **Wrong:** the pile was drawn on the OTHER table (to avoid hiding a guest), so it sat at an empty table.
- **Rule:** the pile lies beside the party's own seats, between their chairs and the aisle (`tableCash.ts` `cashSpotBeside`); a takeaway
  customer's cash lies at the counter beside them. Used by the dining room card (`DiningCashView`) and the live floor (`ServiceFloor`).
- **Tests:** `dining-floor-qa` (C block), `tools/e2e/cashroom.mjs`.

## 3. The Business hub opens from the start

- **Meaning (asked, answered):** the locked round button on the Kitchen screen.
- **Rule:** the Business HUB (the Kitchen button and its first screen) opens at Level 1 (`BUSINESS_HUB_FROM_LEVEL`, `isShortcutOpen`).
  Every `business-*` page behind it keeps the Business section's own level, so the menu, the guests, upgrades and money are unchanged. The
  hub only lists tabs whose page is open (Overview at Level 1; Cleanliness from Day 2).

## 4. No Collect cash button: tap or swipe the pile

- **Rule:** the Served card has no Collect cash button. The cash is collected on the pile itself, by a tap or by dragging across it
  (`TableCash` `swipe`, a window pointer-move test against the pile's 52 px target, once per amount). The cash still waits on the table if
  the player moves on, and closing still needs it in the till (unchanged).

## 5. Next Customer waits for a wiped table

- **Wrong:** Next Customer went straight on with a dirty table.
- **Rule:** while the party's table is dirty and could be wiped, Next Customer is disabled and says so (`blockNext`, "next-blocked"); Auto
  waits too. A table that CANNOT be wiped (a needed supply is missing) never blocks, so nothing can soft-lock. A hired Cleaner on the dining
  room still clears it by themself.

## 6. The scrubbing game is back for the table

- **Wrong:** table care had become one button.
- **Rule:** wiping a table opens the cleaning game (`AreaCleaningPrototype`, the Dining room's "tables" dirt, a fresh layout every time) and
  the table is wiped (supplies, counters, napkins) when the game is finished. Closing the game leaves the table dirty. This is the player's
  job until a Cleaner is hired for the dining room.

## 7. Recommendations tell the truth

- **Wrong:** the guide said "You can afford the Santoku" while the Market still showed it locked: it compared the price to the wallet and never
  asked whether the item was unlocked.
- **Root cause:** a second, private price check beside the Market's own.
- **Rule:** every purchase promise uses the Market's own verdict: knives by `getKnifePurchaseState`, boards by `BoardManager.canBuy`.
  (A locked section also carries no attention count: `attentionBadges` for Progress.)
- **Guard:** `scripts/guide-reality-qa.mts` sweeps Levels 1-80 at five wallets (about 3,300 guide steps) and asks the game itself whether each
  step is true: knife/board unlocked, affordable and the cheapest; staff hireable at that level and not already on the team; the kitchen tier
  buildable; the opening levels of the 2nd floor, cleaning, suppliers and the Prep Cook; "You can afford" only about what can be bought; plus
  the reported Santoku case and locked-tab counts. A mutation check (the old price-only rule put back) fails six checks.

## 8. Cleaning from Day 2: morning, service time and night

- **Wrong:** cleaning (its tasks, the shift chores, the day ceremony, the Cleanliness page) started at Level 5, which is Day 3. At the end of
  Day 2 the night had no kitchen, dining or restroom chores.
- **Days:** a restaurant day is two services (Lunch, Dinner), so Day 1 = Levels 1-2, Day 2 = Levels 3-4, Day 3 starts at Level 5.
- **Rule:** `CLEANING_FROM_LEVEL` = 3 (`config/cleaningStart.ts`, a leaf module so `firstLevels.ts` and `cleanliness.ts` share it without an import
  cycle). From Level 3:
  - **morning** (Pre-Service Check, first service of the day): the opening chores (stations, restroom check);
  - **service time** (between the day's services): the lull chores (sanitizer bucket, sweep the line, restroom refresh), plus the tasks each
    service leaves behind (equipment, grease, bins; the restroom's toilet/sink/paper as guests come);
  - **night** (Closing Time after Level 4): the closing chores (wipe the boards, spoiled food, wrap the fridge, degrease, mop, disinfect the
    restroom), and the day ceremony itself (`DAY_CEREMONY_FROM_LEVEL` = `CLEANING_FROM_LEVEL`);
  - the Restroom and Cleaning rooms on the restaurant map and the Cleanliness page open with it; the hourly cleaners (map button) too.
  Chores that belong to later systems keep their own `fromLevel` (the dining room's lay-tables / clear-tables / condiments / polish from Level
  19, the deep cleans from Level 19), so a Day-2 dining area has the mop and the tables the guests leave.
- **Never a soft-lock:** a task whose supplies are missing stays open and says what to buy; it costs no tips and never blocks a service. The
  table wipe is free until cleaning starts (now Level 3).
- **Tests:** the cleanliness suites updated to the new start level; `guide-reality-qa`; browser: `tools/e2e/day2.mjs` plays Day 2 from a
  fresh Level 3 save (morning chores, lull, closing chores in all three areas).
