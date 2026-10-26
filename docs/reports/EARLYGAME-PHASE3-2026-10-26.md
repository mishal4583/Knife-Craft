# KnifeCraft — Early-game transformation, phase 3 (2026-10-26): walk-in customers from Level 5

Base: `claude/early-game` at `a046786` (phase 1 `e0523e5`, phase 2 `362553e`) on `main`
`1965342`. Work: `claude/early-game-walkins`. Not merged or deployed; nothing uploaded to
Playgama. **No save field added.**

## 1. The lifecycle, and where walk-ins go

A campaign service already runs this lifecycle (`App.tsx`, `menuGuests.ts`):
1. the level's own orders, then
2. optional menu guests offered on the result screen next to Finish Level,
3. then Finish Level.

A guest is an extra ticket of the same service. It is cooked with the normal cutting flow
(oven, Knife Report, the same animations, customer reaction, payment feedback and Reduced
Motion handling) and paid by `serveMenuGuestOrder`: the menu price, real stock, one
`business-revenue` entry, and the count `levelProgress.menuGuests[level]` saved in the
same persist. Finishing the level drops the count; a finished level offers nobody.

**The safest point** is the end of that window: after this level's own orders and its
guests, before Finish Level. That is between one level's orders and the next level's. No
new serve, payment or save path is needed there.

## 2. What changed

| | Rule |
|---|---|
| When | From L5 (`WALK_IN_RULES.fromLevel` = `BUSINESS_MENU_FIRST_LEVEL`) |
| How many | `perService` = **1** per service, within the team's existing capacity (chef 2, +1 per role): at L5–15, 1 guest + 1 walk-in; at L16–28 the chef alone has no room (2 guests), and one hire makes room. Never more than 1. |
| Which dish | From the active menu, seeded per level (`n × 7919 + 31`, its own seed: the guests' picks don't move), avoiding a repeat of the guest's dish |
| Count | The same `levelProgress.menuGuests[level]` continues past the guests (guest 1/1, then walk-in 1/1) |
| Stock | Offered only when its dish fits **beside the next level's own orders** (`walkInStock`, `reservedTicketsFor`); nothing is reserved at L150 |
| Short of stock | Disabled: "🚶 Walk-in wants Garlic Bread — short of bread (kept for your next order)" |
| Restock | The Pre-Service Check's optional customer rows list the walk-in (🚶) with the reserve counted; Restock opens the Market as for guests |
| Staff | Walk-ins never create staff requirements (the service's shape counts the schedule's guests only) |

**Files:**
- `menuGuests.ts`: `WALK_IN_RULES`, `walkInsFor`, `walkInQueue`, `walkInStock`,
  `reservedTicketsFor`, `customerQueue`, `remainingWalkIns`; `nextMenuGuest` returns
  `kind` and `short`.
- `preServiceCheck.ts`: the walk-in in the optional rows.
- `App.tsx`: the offer's label only.
- `PreServiceCheck.tsx`: the ⓘ line.
- The simulator counts walk-ins.

**Unchanged:** the serve, payment, wallet, ledger, `SaveManager`, level rewards,
achievements, rankings, story, replay bonus, daily orders, kitchen upgrades and staff
rules.

**One limit (reported, not changed):** leaving the result screen finishes the level (the
existing rule once its own orders are paid). So a walk-in refused for stock is not kept for
later: the player restocks, and the NEXT service's walk-in uses it. Checked in the browser:
Back to Orders → Market → buy bread → the level is complete and L6 is next. Keeping a
refused walk-in waiting would need a new save field or a change to that rule.

## 3. Economy (simulator, Level 150)

| Profile | `1965342` | Phase 1 (L2 fix) | Phase 2 (menu L5) | **Phase 3** | **Phase 3 effect** |
|---|---|---|---|---|---|
| Saver | $267,210 | $267,072 (−$138) | $267,258 (+$186) | **$269,069** | **+$1,811** |
| Completionist, Local | $132,066 | $132,067 (+$1) | $132,209 (+$142) | **$134,203** | **+$1,994** |
| Completionist, Wholesale / Premium | $132,250 / $133,538 | $132,271 / $133,462 | $132,324 / $133,227 | **$134,393 / $135,825** | +$2,069 / +$2,598 |
| Prudent completionist | $132,298 | $132,014 | $132,212 | **$134,353** | **+$2,141** (lowest cash $421) |
| Kitchen-tiers-only buyer | $177,834 | $177,696 | $177,781 | **$179,764** | +$1,983 |
| Broke player | $70,355 | $70,355 | $70,355 | **$70,355** | $0 (1 walk-in, $8, absorbed by supplier credit) |
| Endless start | $132,066 | $132,024 | $132,205 | **$134,203** | +$1,998 |

| Walk-ins (150 levels) | Count | Revenue |
|---|---|---|
| Saver | 103 | $1,736 |
| Completionist | 109 | $1,828 |
| Prudent completionist | 113 | $1,930 |

**Saver details** (Phase 3 vs Phase 2):
- customers 454 → 560;
- menu revenue $7,989 → $9,825 (+$1,836);
- ingredients −$1,338 → −$1,474 (−$136);
- service supplies −$1,394 → −$1,411, takeaway −$612 → −$649;
- hygiene fines −$770 → −$605 (a timing ripple of the cleaning game);
- cash at L10 $3,789 → $3,869.

**Inventory reservation:** the next level's own orders were never left short. QA `R2` serves
a walk-in and checks the next level's order is still fully in stock. The simulator finishes
150/150 for every profile, with no new supplier credit.

**Band:** inside $100k–$150k ($134,203). **Frozen campaign figure** (Net 101,005):
unchanged. Of the 32 scripts, the same 6 as in phase 2 changed.

## 4. Tests

**New `walkin-qa`** (22 checks):
- S schedule and capacity (none before L5, 1 from L5, within capacity, bounded at every
  level, none on batch levels);
- L lifecycle (guest → walk-in → none; finishing drops it; none at L4);
- R the reserve (refused when only its own stock is there, served when the next order is
  stocked too, the next order still in stock after; none at L150);
- I insufficient stock (what to buy; the check lists the 🚶 walk-in; buying its rows makes
  it servable; START never depends on it);
- P paid once (one entry, the count saved with it, nothing after a reload; the level
  pays once);
- O old saves and players past L5;
- D determinism, no staff change, separate seeds;
- W the App wiring.

**New browser test `walkins.mjs`** (6 / 6):
- W1 the offer after the order and the guest ("🚶 Walk-in 1/1: Garlic Bread · $8.26").
- W2 served through the oven: one `business-revenue` entry of exactly $8.26, wallet =
  ledger, count 2, no further customer.
- W3 Finish Level pays once.
- W4 with ¾ lb of bread the walk-in is refused ("short of bread (kept for your next
  order)"); a tap takes and pays nothing.
- W5 both buttons fit at 320 and 390 px (≥ 48 px, not clipped, no sideways scroll).
- W6 no console errors.

**Expectations changed on purpose** (a comment in each):
- `early-menu-qa` D4: after the L8 guest a walk-in follows (was: nothing). The guest is
  still never offered again.
- `early-menu-qa` E1: the guard no longer pins `menuGuests.ts` and `App.tsx`; it still pins
  SaveManager, the save types, the wallet / ledger and payment.
- `oven-step-qa` E2: `menuGuests.ts` and `preServiceCheck.ts` are allowed; in `App.tsx`
  only lines of the offer's label may change. A changed line with `persist`, `credits`,
  `appendLedgerEntry`, `serve`, `complete`, `reward`, `settle`, `levelProgress` or the
  take action fails it.

**Gates and browser results:** in §6.

## 5. The two items you asked about

- **Dining Area lock:** the map's Dining Area (`restaurantMapZones.ts`, `unlockLevel: 31`)
  opens the Menu. 31 is an unconverted 250-level number: dine-in opens at L21 and the menu
  at L5. This needs a separate approved change (a one-line unlock level, L5 or L21). It is
  not needed for walk-ins: the Business shortcut and the office open the Menu from L5.
- **"1 dishes":** the check's customer row reads "{n} dishes · {m} stock items" with no
  singular. Walk-ins make it show more often ("2 dishes" is right; "1 dishes" / "1 stock
  items" still wrong). It is a two-word copy fix in `PreServiceCheck.tsx`; it needs a
  separate approved change and is not done here.

## 6. Final verification (on this branch's build)

- **QA:** 123 of 123 suites pass (122 plus `walkin-qa`). Typecheck clean. ESLint 0 errors,
  the same 9 warnings. Build and preflight pass. Prettier clean on every changed file (all
  were formatted at the base).
- **Browser:**
  - walkins 6/6 (320 and 390 px), earlymenu 6/6, restaurantguests 9/9, restaurantmenu 5/5;
  - levelflow 12/12, restaurantday 9/9, practicepay 4/4, kitchenstrip 5/5, ovenrecipes 7/7;
  - restaurantfirstlevels 13/13, from a local copy that waits for `load`. In this sandbox
    the repo file's `networkidle0` reload never settles, on `1965342` too.
- **Known baseline failures:** `ingredients.mjs` (6 pass, 14 fail: 1b 3a 3b 4a 4b 4d 3c 3d
  4f 4g 5a 5b 5c 5d) and `supplies.mjs` (12 pass, 1 fail: 7). Both test files are
  identical to `1965342`'s. The `1965342` build gives the same pass and fail sets, check
  for check, so they are not new.

## 7. The refused walk-in: exact behaviour

1. A walk-in is offered on the result screen after the level's own orders and its guests.
   If its dish does not fit beside the next level's own orders, the button is disabled and
   names the short ingredients. A tap does nothing: no stock is taken, nothing is paid, and
   the count does not change.
2. The result screen offers Finish Level or Back to Orders. Both finish the level: the
   existing rule says a level whose own orders are paid is complete when the player leaves
   it. Finishing drops the level's customer count.
3. So **that** walk-in is gone. It was never paid or counted, so nothing is lost from the
   save or the ledger. The player can restock in the Market (checked in the browser: Back
   to Orders → Market → Buy bread → Level 6 is next).
4. The next service brings its own walk-in. Its Pre-Service Check lists it (🚶) with
   optional Restock rows that count the reserve for the level after it.

**Consequence:**
- A walk-in refused for stock is a lost sale of one dish (about $8 at L5), never a lost
  payment or a duplicate.
- A player who keeps the check's optional rows stocked never sees a refusal.
- Keeping a refused walk-in waiting while the player shops would need a new save field, or
  a change to the "leaving completes the level" rule. Neither is done: both need your
  approval.
