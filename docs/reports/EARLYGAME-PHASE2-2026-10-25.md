# KnifeCraft — Early-game transformation, phase 2 (2026-10-25): the menu and menu guests from Level 5

Base: `main` at `1965342`. Work: `claude/early-game` (phase 1 `e0523e5`, then this commit).
Not merged or deployed; nothing uploaded to Playgama. No save field added.

## 1. What changed

**One switch.** `BUSINESS_MENU_FIRST_LEVEL` (`restaurantProgression.ts`) is 5 (was 11). The
menu's own schedule already placed its first point at the source design's old Level 11, which
the 150-level remap turns into the new Level 5. A floor of 11 had held it back. Everything that
reads the constant moves with it:

| | Before (`1965342`) | Now |
|---|---|---|
| Menu system ("Your menu" news, the Menu → … → Revenue chain) | L11 | **L5** |
| Business tab (Menu, Suppliers, Equipment, …) and the map's office and counter | L11 | **L5** |
| Menu guests per service | 0 until L10, 1 from L11 | **1 from L5**; 2 / 4 / 5 / 6 from L16 / 35 / 76 / 117 as before |
| Menu dishes | none until L10; 6 at L11 | L5 Garlic Bread · L6 +Caprese Salad, Mushroom Bruschetta, Garden Salad · L9 +Caprese Skewers, Tomato Bruschetta (the same six) |
| Grandma's L5 tip | "Bread and garlic — prepare each part…" | "We have a menu now! Guests order from it after the service." (Open Business) |
| Grandma's L11 tip | "We have a menu now!…" | "Our menu grows as you learn. Have a look in Business." |
| Level 10 card, last row | "your first menu at Level 11" | "📋 Your menu · new dishes in Business" |
| Menu news reason | "Four dishes you already know how to cut…" | "Dishes you already know how to cut…" (L5 adds one dish) |

**Why only Garlic Bread at L5?** The menu's existing rule (`dishLegalLevel`) admits a dish once
every cut it needs is taught. Garlic Bread is Level 5's own dish. The other three salads and the
bruschetta need chop, which Level 6 teaches. No rule was changed to force more dishes in.

**Code files:** `restaurantProgression.ts` (the constant, its comment, the reason line),
`firstLevels.ts` (comment, the two tips, the Level 10 row), `restaurantMapZones.ts` (office and
counter read the constant), and comments in `MarketIngredients.tsx` and `InventoryScreen.tsx`.
`App.tsx`, menu guests, payments, the wallet, the ledger and `SaveManager` are untouched.

## 2. Reuse: no new system

Menu guests are the existing ones (`menuGuests.ts`): the same queue, seeded per level, the same
capacity rule (chef 2, +1 per role), the same `business-revenue` payment through the existing
Business price rule, the same saved count `levelProgress.menuGuests` (so a paid guest is never
offered again), and none on replays. The Market already sells every ingredient.

## 3. Dependencies checked (`early-menu-qa` B)

- Every dish offered at L5–10 is a real recipe; each of its cuts is taught by that level; every
  ingredient is sold in the Market.
- At each of L5–10, with an empty fridge the guest needs stock. After buying what the
  Pre-Service Check lists, the guest is in stock.
- **Dishes offered before the player cooks them as a level** (allowed by the existing rule,
  because the cuts are known): Caprese Salad L6 (its level L9), Mushroom Bruschetta L6 (L7),
  Garden Salad L6 (L10), Caprese Skewers and Tomato Bruschetta L9 (no level of their own).
- The player is told: the Pre-Service Check opens on L5 with "Your menu" and its chain; Grandma
  points at Business when it opens, then her tip says the menu is open; Business → Menu lists the
  dish (screenshots at 320 and 390 px).

## 4. Old saves and players past Level 5 (`early-menu-qa` C, D)

- An old save at L8 loads through `SaveManager` with its progress, wallet and ledger unchanged.
  The levels it already finished (L5–7) get no guests, so nothing is offered or paid
  retroactively. Its current level gets its one guest (1 of 1). A guest already served is
  never offered again. A player at L40 keeps the served count.
- **From L11 to L150**, against `1965342` rebuilt from git: the same dishes, guest counts,
  menu targets, day schedule, other systems, cuisines and menu-choice level (L35).
- **One difference from L11 on: the menu's ORDER.** Garlic Bread now joins first. The seeded
  guest picker draws from the menu in order, so at 28 of L11–150 a guest orders a different
  dish (never a different number of guests). It stays deterministic. The economy effect is
  in §5.

## 5. Economy (simulator, against `1965342`)

Thirty-two economy, supply and tool scripts were run. Phase 1's correction is separated from
phase 2's effect (phase 2 = this branch − phase 1).

| Profile (L150) | `1965342` | Phase 1 (L2 fix) | **Phase 2** | Phase 1 effect | **Phase 2 effect** |
|---|---|---|---|---|---|
| Saver (buys nothing) | $267,210 | $267,072 | **$267,258** | −$138 | **+$186** |
| Completionist, Local (the rule's figure) | $132,066 | $132,067 | **$132,209** | +$1 | **+$142** |
| Completionist, Wholesale / Premium | $132,250 / $133,538 | $132,271 / $133,462 | **$132,324 / $133,227** | +$21 / −$76 | **+$53 / −$235** |
| Prudent completionist (keeps $500) | $132,298 | $132,014 | **$132,212** | −$284 | **+$198** |
| Kitchen-tiers-only buyer | $177,834 | $177,696 | **$177,781** | −$138 | **+$85** |
| Broke player | $70,355 | $70,355 | **$70,355** | $0 | **$0** (3 guests, +$25, absorbed by supplier credit) |
| Endless start (L250 completionist) | $132,066 | $132,024 | **$132,205** | −$42 | **+$181** |

**The saver in detail** (phase 2 vs phase 1):
- menu guests 443 → 454 (+6 by L10, then +5 from different picks);
- menu revenue $7,832 → $7,989 (+$157);
- ingredients −$9;
- cash at L10 $3,728 → $3,789 (+$61).

**Inventory, capacity, revenue:**
- Inventory: the saver's fridge at L10 holds 3.2 of 40 units (was 2.6). More stock is bought
  for guests, never blocking.
- Capacity: unchanged. One guest a service stays under the chef's 2.
- Revenue: one Garlic Bread guest pays $8.26 in the browser test, so L5–10 adds roughly $8–12 a
  level for a player who serves them.

**Other changes:**
- The prudent completionist's lowest cash rose to $449 (was $417).
- An Endless "full menu, thin staff" cell moved from 77 % to 70 % busy, from the order change.
- The frozen campaign figure (Net 101,005) is unchanged.

**Band:** every completionist stays inside $100k–$150k ($132,209 Local).

## 6. Tests

**Gates:** tsc clean; ESLint 0 errors (the same 9 warnings); Prettier clean on the changed
files that were formatted at the baseline (`restaurantProgression.ts` and
`restaurantMapZones.ts` were not, and are left as they were); build and preflight pass.

**QA:** all suites ran. Eight failed on the first run, every one on a pinned unlock level, and
each expectation was updated as the developer's rule change, with a comment in the file:

| Suite | Old expectation | New |
|---|---|---|
| `restaurant-unlocks-qa` U1/U2/U5 | menu @11; live at L10 = day + stock; next after L10 = menu | menu @5; live at L4 / L5; next after L4 = menu, after L5 = fridge |
| `restaurant-menu-qa` M1/M2/M2c/T3/A4 | no menu L1–10, 6 dishes at L11; curve "11:6,…"; short points 13,56,59,68; chain at L11; Caprese locked at L10 | none L1–4, 1 at L5, 4 at L6, 6 by L9; curve "5:4,9:6,…"; short points 5,13,56,59,68 (L5: chop at L6); chain at L5; Caprese locked at L5, open at L6 |
| `restaurant-guests-qa` G1/N4 | 0 at L10, 1 from L11 | 0 at L4, 1 from L5 (queue of 1 at L5) |
| `restaurant-half-wages-qa` M1 | guests at L10/11 = 0/1 | at L4/5 = 0/1 |
| `restaurant-final-economy-qa` R6 | no guests at L10 | none at L4, 1 at L5 |
| `restaurant-first-levels-qa` T1/T2/M1/L1/P1 | Business at L11; L10 card "your first menu at Level 11"; no pointer at L9 | Business at L5; "📋 Your menu · new dishes in Business"; pointer at L5, none at L4 |
| `restaurant-day-qa` O4 | no sheet at L5 | L5's sheet opens for the "Your menu" news only (without the news it stays closed; the day card still starts at L16) |
| `oven-step-qa` E2 | no restaurant file changed since Phase D (except phase 1's) | also allows `restaurantProgression.ts` and `firstLevels.ts`. A comment-only `App.tsx` edit was reverted, so App stays guarded |

**New:**
- `scripts/early-menu-qa.mts`: 16 checks (A unlock, B dependencies, C baseline from L11,
  D old saves, E no save / wallet / ledger / payment / App change). All pass.
- `tools/e2e/earlymenu.mjs`, 6 / 6 on the branch build:
  - E1: L4 Business is locked, "opens at Level 5".
  - E2: at L5 Grandma points at Business; "Show me" opens it; the Menu lists Garlic Bread at
    320 and 390 px with no sideways scroll; then her tip says the menu is open.
  - E3: L5's own Garlic Bread goes through the oven; the result offers "Menu guest 1/1: Garlic
    Bread · $8.26".
  - E4: the guest pays $8.26 with one `business-revenue` entry, and the wallet moves by exactly
    the ledger; the count is saved; there is no second guest.
  - E5: Finish Level pays the completion reward once and drops the count.
  - E6: no console errors.

**Existing browser tests on the branch build:**
- Pass unchanged: restaurantguests, restaurantmenu, levelflow, practicepay, kitchenstrip,
  businessDishes, ovenrecipes.
- Updated for the rule change (a comment in each file):
  - `restaurantday.mjs` 9 / 9.
    - Check 1: L5 now shows the "Your menu" news, with no day card; Start service starts it.
    - Check 2: L6 shows its three new dishes, with no day card.
    - Check 5: the menu is locked at L4, "Lv 5" (was L7, "Lv 11").
  - `restaurantfirstlevels.mjs` 13 / 13.
    - The Business shortcut shows "Lv 5".
    - The L10 card shows "Your menu", and L10 no longer announces Business.
    - At L7, after the Market, Grandma points at Business next.
- **Sandbox note:** `restaurantfirstlevels.mjs` times out in this sandbox on its
  `reload({ waitUntil: "networkidle0" })`, on `1965342` too, before any check runs. The 13 / 13
  came from a local copy that waits for `load`; the repo file keeps `networkidle0`.

**Seen, not changed:**
- The guests row in the check reads "1 dishes" (an existing plural bug).
- The Restaurant map's Dining Area, which opens the Menu, is still locked until L31. The
  Business shortcut and the office open the Menu from L5.

## 7. Next (awaiting review)

Walk-ins, staff, the Second Floor, the Growing Kitchen and prices: the proposal is in the
reply to the developer. Nothing is implemented beyond this phase.

## 8. Final verification (2026-10-26, build of `362553e`)

- **QA:** 122 of 122 suites pass (full rerun after every test edit).
- **Gates:** typecheck clean. ESLint 0 errors and 9 warnings (unchanged). Build and preflight
  pass.
- **Browser, rebuilt from `362553e`:**
  - earlymenu 6/6, restaurantguests 9/9, restaurantmenu 5/5, levelflow 12/12;
  - restaurantday 9/9, practicepay 4/4, kitchenstrip 5/5, ovenrecipes 7/7;
  - restaurantfirstlevels 13/13 (the local "load" copy; see §6).
- **Failing before Phase 2:** `ingredients.mjs` (14 of 20 fail) and `supplies.mjs` (1 of 13,
  check 7). The `1965342` build fails the same checks, check for check, so they are not
  caused by this phase. They stay open: CLAUDE.md's "known pre-existing failures: none" is
  out of date for these two.
- `businessDishes.mjs` is a shared list of dish ids, not a test.
