# KnifeCraft — Phase 9: the dining floor (plan, 2026-11-01)

Request (developer 2026-11-01): bigger fridge for the future; check takeaway customers; the player cleans each table after a
dine-in; hire a cleaner and a server from the side of the dining area (the option disappears after hiring); Server and billing
staff early (about Level 3); cleaners paid by the hour, only if the player wants, three of them (one per area); a person who
carries the food instead of the plate flying. "Make a plan and implement this."

## 1. What the game does today (read from the code)

| Question | Answer |
|---|---|
| Takeaway customers? | **Only on paper.** From the takeaway stage (L44) a seeded 30 % of orders (60 % of curries) are tagged `takeaway` (`orderServiceFor`): they use a container and a bag from the supplies and count in the report. On the floor every customer still walks to a table and sits. Nobody picks up a parcel. |
| Who cleans a table? | Nobody per guest. After a service the **closing task "Wipe and sanitize the tables"** is added (`tasksAfterService`, from dine-in L19). The player cleans it from Business → Cleanliness, or a hired Cleaner / a day Cleaner does the routine tasks. |
| Cleaners | One permanent **Cleaner** (daily wage, hired from the Staff screen, L91 by the staff rule), or a **Day Cleaner** for the whole restaurant day (wage or an ad). One person covers every area (areas can be switched off). |
| Server and billing | The **Server** can be hired from Business (L5, hiring fee $113, wage from the wage level). The counter's cashier is drawn on the map only when a Server is hired — there is no separate billing role. The staff *rule* (needed for the service) only starts at L44. |
| Serving | The plate is an emoji that flies from the pass to the table (`sfplate` keyframes in `ServiceFloor.tsx`). Nobody carries it. |
| Fridge | Basic 40, Commercial 80, Professional 140. After Phase 8's pull the saver needs about 80 at once late on and the completionist about 121 of 140. |

## 2. The plan

**9A. Fridge (needs of the future).** Raise the two upgrades: Commercial 80 → 100 and Professional 140 → 240 units; the Basic 40 and
every price stay. (A fourth tier was tried first and moved the completionist's end by $9,600 and the frozen classic baseline; raising
the capacity moves no money.)

**9B. A person serves the food.** In the deliver beat a waiter walks from the pass to the table carrying the plate, puts it down and
walks back. The Server's own look when one is hired (and it takes the plate to the whole party), otherwise the cook runs it out.
The reaction and the served card follow when the plate is down. Reduced Motion keeps the old short beat.

**9C. Takeaway customers you can see.** An order that `orderServiceFor` calls takeaway is a customer who walks in, goes to the
**service counter** (not a table), orders, waits there, is handed a paper bag by the waiter and walks out with it. No table, no party,
no dirty table. They are marked 🥡 on the order card. The share and the stage (L44) are the existing ones; nothing moves in the
economy because the order's pay and supplies were already takeaway.

**9D. The player wipes the table.** After a dine-in party leaves, its table is left dirty (plates, a cloth). The served card
offers **🧽 Wipe the table** (one tap, uses one set of the "tables" supplies exactly as the closing task would). Wiping every table
of the service means the closing "tables" task is not added. A hired Server, or an hourly Dining cleaner, clears it by themself (the
waiter is seen doing it). Nothing blocks: an unwiped table is the same closing task as today.

**9E. Hire from the side of the dining area.** On the floor view a slim side panel shows what you can hire right now, and each card
disappears once the person is hired:
- **Server** (from Level 3, the existing one-time hiring fee, no new wage rule).
- **Cleaners by the hour**, **three**, one per area: 🍳 Kitchen, 🍽️ Dining, 🚻 Restroom. Each costs one shift hour of the Cleaner's
  hourly wage ($15), is optional, works only this service (their area's routine tasks at its end, the Dining one also wipes tables
  on the floor) and then leaves. One ledger entry per hire (`business-staff-salary`). The permanent Cleaner and the Day Cleaner stay as
  they are; nothing is deleted.

**9F. Billing staff.** There is no separate billing role today: the counter cashier belongs to the Server. Hiring the Server early
brings the cashier with them (the map shows both). A paid separate role was not built (see the report).

## 3. Rules kept
No new wallet or ledger; whole cents, all-or-nothing; no `Math.random`; optional save fields only (`cleanliness.hourly`,
`cleanliness.wipes`), old saves read; the early game before L19 only gets the animation and the early Server; the frozen
campaign baseline does not move; nothing is deleted.

## 4. Order of work and tests
9A → 9B → 9C → 9D → 9E. New suites `dining-floor-qa` (tiers, takeaway marker, wipe rules, hourly cleaners, early server) and a
browser check. The git-diff guards get documented exceptions as in Phases 5, 7 and 8.

## 5. What was built (2026-11-01, "make a plan and implement this")

**Added**

| Step | What | Where |
|---|---|---|
| 9A | Commercial fridge 100, Professional 240 units (Basic 40, prices unchanged). `restaurant-final-economy-qa` V3 now says the saver's late-service peak (about 89) fits the Commercial 100. | `refrigeratorDefinitions.ts` |
| 9B | A waiter (the Server's look when hired, else the cook in whites) walks from the pass to beside the table with the plate (a tray for a party), sets it down, walks back; the plate shows on the table only once it is down. No flying plate. | `serviceFloor.ts`, `ServiceFloor.tsx` |
| 9C | Takeaway customers you can see: the supplies' own seeded rule (from L44, about 30 %), the customer waits just inside the door under a 🥡 tag, is handed a 🛍️ bag and leaves; never in a party, never held, never shared-prepped. | `serviceFloor.ts` (`seatInParty` solo), `App.tsx` (`takeawayAt`), `ServiceFloor.tsx` |
| 9D | Wipe the table: after a party leaves, "🧽 Wipe the table" (one tap); the first wipe of a service uses the closing task's disinfectant and cloth once, later tables are free; all wiped = no closing tables task; a Server or Dining cleaner does it by themself ("The Server clears the table"). Never blocks. | `cleanliness.ts` (`wipeTable`, `tableStaff`), `Preparation.tsx` |
| 9E | Side panel on the dining area (before cooking): 🤵 Server (from Level 3, the existing hiring fee) and 🍳 / 🍽️ / 🚻 hourly Cleaners ($15 each = one shift hour, one per area, work this service then leave); an offer disappears once hired. One wallet debit and one `staff-purchase` ledger entry each. | `diningHire.ts`, `cleanliness.ts` (`hireHourlyCleaner`, `dismissHourlyCleaners`), `ServiceFloor.tsx`, `App.tsx` |
| tests | `dining-floor-qa` (34 checks), `tools/e2e/dining.mjs` (7 checks in a real browser, with screenshots); `prep-cook-auto-qa` R7, four fridge suites, `oven-step-qa` guard updated. | |

**Verified answers to your questions**
- *Are there only dine-in customers?* Before this: yes on the floor. Takeaway was only a tag in the supplies (containers and bags taken from stock, counted in the report) from L44. Now they are people at the door.
- *Is the table cleaned after each dine-in?* Before: only by the closing "tables" task. Now per table, as above.
- *Billing staff?* There is no separate billing role: the counter cashier is drawn on the map with the Server, so hiring the Server early brings the cashier.

**Skipped, and why**
- **A separate paid billing / cashier role.** It would be a new staff role (payroll, requirements, capacity) with no function to give it beyond the Server's; say what it should do and I will add it.
- **Takeaway before L44.** The stage is a progression rule with its own supplies (containers, bags); moving it changes the early game.
- **A full hourly clock.** "Hourly" here is one shift hour per service at the Cleaner's hourly wage, charged when hired; there is no per-minute wage while the app is open.
- **Hand-measured waiter routes per kitchen stage.** The waiter walks a straight line from the pass to beside the table; on the crowded Growing stage it can cross a rug edge. The takeaway spot is the same just inside the door on every stage.
- **The wipe for the last party of a service at the closing card.** It is offered on the served card of the order that made the party leave only.
- **A phone check.** Not measured on a real phone; the headless browser at 430 px shows the panel on the right edge.
