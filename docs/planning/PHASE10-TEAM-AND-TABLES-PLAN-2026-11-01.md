# KnifeCraft — Phase 10: the starting team, hourly cleaners on the map, table care (2026-11-01)

Request (developer 2026-11-01): the billing staff and the Server are hired permanently when the game starts, during the
purchase of ingredients, with money for their purchase added to the ten dollars; the cleaner is not shown on the dining
screen but as a small idle-game button on the restaurant map, hired by the hour and again each day, with a wage that rises as
the restaurant progresses; after 10+ orders nothing came up to clean the table after each customer, no tissue refill.

Answers I asked for: the billing staff **make the bills, take the takeaway orders beside them and count the money at night**;
start with **$10 + their fees, hired in the first shop**; the cleaner is **hired for the rest of today at $15 an hour × the hours
left, the wage rising with progress**; table care **from the first customer**.

## Plan and what was built

| Step | What | Where |
|---|---|---|
| 10A | A 7th staff role, the **Cashier**: same pay as the Server, hired from Level 1 with the Server. | `businessStaff.ts`, `staffRequirements.ts` (`TEAM_HIRE_FROM`), `staffLife.ts` |
| 10B | New game cash = $10 + the two hiring fees ($236.00). A "Hire your team" card on top of the first Market visit; each hire is one `staff-purchase` entry; the card is gone once both are hired. The staff rules and wage start are unchanged (nothing forces a hire, nothing drains early). | `config/startingTeam.ts`, `SaveManager.ts`, `TeamHireCard.tsx`, `diningHire.teamOffers` |
| 10C | The Cashier: the Served card has a 🧾 bill line; they stand at the counter on the floor and in the Served room; **takeaway customers stand beside them** (no table, no walk through the tables) and the Cashier hands over the bag; the closing "count the takings" row is done by them. | `serviceFloor.ts`, `ServiceFloor.tsx`, `DiningCashView.tsx`, `ServiceOrderComplete.tsx`, `closingChores.ts` |
| 10D | **Cleaners by the hour** off the dining floor and off the Cleanliness page: a small 🧹 button on the restaurant map opens a tray of three areas; hired for the rest of today for wage × hours left; wage $15 at the start rising to about $33 (`hourlyCleanerWage`); gone the next day. The Server no longer clears tables (the player does, or a Dining cleaner). | `cleanliness.ts`, `MapCleanerHire.tsx`, `ScreensRouter.tsx`, `App.tsx` |
| 10E | **Table care from the first customer**: the Served room shows the party's dirty table (tap to wipe; free before cleaning supplies exist at Level 5, then the closing task's supplies once) and the napkin holders run low after every third wiped table (tap to refill; no extra supply). A Dining cleaner does both by themself. | `cleanliness.ts` (`wipeTable`, `napkinsLow`, `refillNapkins`), `Preparation.tsx`, `DiningCashView.tsx` |

## Rule changes made on purpose (tests updated to the new rules)
- A new game's cash: $10.00 → $236.00 (CLAUDE.md §1 updated; `startCashGuard.mts`, `firstshop.mjs`).
- Six staff roles → seven (`business-staff-qa` A2, `business-ux-qa` K).
- Server hire from Level 3 → Level 1 and the Cashier too (`prep-cook-auto-qa` R7).
- The hourly cleaner is no longer per service on the floor.

## Skipped, and why
- **Making the two hires compulsory.** A "Hire your team" card with the money for it, not a lock: the staff-requirement system would
  block the first service, and a player who spent the money on food would be stuck. The extra $226 is not fenced off; a player can
  spend it on food instead, and hire later from the Staff screen.
- **Takeaway customers walking in from the door.** They stand at the counter by the Cashier: the tables are in the way on several kitchen
  stages and I did not hand-measure a lane for each.
- **A tissue cost.** The refill is a chore with no supply of its own (each dine-in order already takes its napkin from stock).
- **Cashier portraits** (a staff portrait image): the card shows the 🧾 icon.

## First-run hand (added after this plan)

A guided first run (developer 2026-11-01: "proper hand instructions to buy ingredients, hire them and then go back to cutting"):
`restaurant/firstRunGuide.ts` `firstRunHand(save, where)` is pure and derived from the save only. Steps: buy the first order, hire the Server
and Cashier (skipped if unaffordable), back to the Kitchen tab, Open for service, Start service. Numbered captions; gone after the first
service. Tests: `first-run-guide-qa`, `tools/e2e/firstrun.mjs`.
