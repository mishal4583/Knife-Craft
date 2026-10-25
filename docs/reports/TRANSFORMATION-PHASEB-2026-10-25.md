# KnifeCraft — Transformation Phase B, slice 1: the service floor (2026-10-25)

**Status: partially verified.**
- **Passing:** all gates, all 118 QA suites, 27 browser suites, and the six-stage sweep.
- **Failing:** two browser suites, `restaurantfirstlevels` and `paidorders`. Both fail
  identically on the untouched baseline build (§4).
- **Not run:** Playgama itself.
- **Pushed** to the non-deploying branch `claude/sharp-wright-emfu2j` only, not `main`.

### Final verification pass (2026-10-25, second session)

| Suite | New build | Untouched baseline (`095115a`) |
|---|---|---|
| restaurantfirstlevels | fails: first `reload({ waitUntil: "networkidle0" })` times out | **fails identically** (2 / 2 runs today) |
| paidorders | fails: `waitForFunction` timeouts at lines 53 / 88 | **fails identically** |

**restaurantfirstlevels:**
- The requests still open at the timeout are the game's own font files (Nunito, Fraunces,
  sometimes Caveat), on both builds.
- The local test helper intercepts every request (a sandbox-only patch that serves the
  Bridge from npm), and these font requests never report finished.
- Yesterday's single passing baseline run was not reproducible today, so §4's earlier "my
  build only" conclusion was wrong. Neither suite's failure is caused by Phase B. Neither
  test was changed.

**Other suites:**
- **Also passing:**
  - restaurant build: phase3 (49 / 49, run alone with a longer limit; the batch's 10-minute
    cut-off had stopped it), phase5, restaurantcleanliness, cleaningfeel, dishwashing,
    restauranttakeaway, restaurantsupplies, restaurantdeliveries, landscape, restaurantlegacy,
    restaurantlevelgoals, restaurantprogression;
  - classic build (`VITE_RESTAURANT_MODE=0`, no floor there): coach, economyv25, adsflow, levelflow.
- **Six stages:** new `tools/e2e/servicefloorstages.mjs` (13 / 13). On every kitchen stage,
  its own painting:
  - the customer is seated with the bubble above them, on screen and inside the room, at
    320 × 568, 390 × 844 and 768 × 1024, with no sideways scroll;
  - Reduced Motion seats them at once;
  - no console errors.

  Screenshots: `out/sfstage-<stage>-<width>.png` in the local e2e runner.

## 1. Scope and decisions

- **Customer journey:** built as a presentation layer over the existing service orders:
  - campaign tickets: `ServiceManager` + `levelProgress.paidOrders`;
  - menu guests: `levelProgress.menuGuests`;
  - Business / Endless orders: `serveBusinessOrder`.
- **Option A / B not chosen.** The Business Day gate (`businessDayAllowed`) is unchanged,
  and no save field was added. Customers arriving *between* levels still need that decision.
- **Not done, by instruction:** the interactive oven step, new art, economy changes.

## 2. Files

**New:**
- `src/game/restaurant/serviceFloor.ts`: seats, walks, pass and timings per stage; seat
  alternation; the departing customer (session memory, stale after 30 s); faces and looks.
- `src/components/kc/game/ServiceFloor.tsx` and `serviceFloor.css`: the arrive and deliver views.
- `scripts/service-floor-qa.mts`: QA, sections A–E.
- `tools/e2e/servicefloor.mjs`: browser checks F1–F8.

**Changed:**
- `src/components/kc/game/Preparation.tsx`:
  - the `floor` prop and floor state;
  - Serve wrapper: the plate shows only when the existing serve succeeds;
  - Next Customer and the menu guest record the leaver, then run the existing action at once;
  - Finish Level is unchanged;
  - the Regular's clock and the special-customer card wait for the arrival.
- `src/App.tsx`: passes `floor` in the restaurant build only.
- `tools/e2e/solver.mjs`: taps through the arrival.
- `tools/e2e/phase4.mjs` (`startOrder`): taps "Start cooking" — the new arrival step a player
  takes. No assertion changed.
- `docs/REFERENCE.md`, `docs/HANDOFF.md`, this report.

## 3. Fixes made during verification

1. **The order bubble and the face showed below the customer.** The shared `anim-pop`
   transform replaced the placement. The pop now sits on an inner element.
2. **The leaving and arriving customers crossed at the door.** The new customer now waits
   outside until the leaver is through.
3. **A special customer's entrance card played unseen under the arrival.** It now shows
   when the arrival closes.
4. **phase4-qa B18:** the source check for `if (paused) return;` had been folded into one line
   with the floor check. Split back into two lines; the test is unchanged.

## 4. Test results

**Gates:**
- `npx tsc --noEmit -p .`: clean.
- ESLint `src scripts tools`: 0 errors, 9 warnings (the existing baseline).
- Prettier: clean on the new files, and on Preparation and App (both formatted at HEAD).
- `npm run build`: OK. `npm run preflight`: all hard checks pass.

**QA:** `service-floor-qa` passes; all suites **118 / 118**.

**Browser** (headless Chromium, local `vite preview` at :4173, Bridge served from npm
2.3.1, dev servers at :8080 / :8081 for phase3/4/6):

| Suite | Result |
|---|---|
| servicefloor (new, F1–F8) | pass |
| restaurantguests | pass |
| restaurantday | pass |
| phase2 | pass |
| phase4 | pass (after the `startOrder` step) |
| phase6 | pass |
| knifereport | pass |
| levelflow | pass |
| restaurantshift | pass |
| adsflow | pass |
| restaurantfirstlevels | **fails** |

**The restaurantfirstlevels failure:**
- Its first `page.reload({ waitUntil: "networkidle0" })` times out: two font requests
  (Nunito, Fraunces) never finish under the sandbox's request interception.
- It fails 3 times out of 3 on this build and passes on an untouched HEAD build, so the arrival
  screen's early text rendering triggers it. No game check runs before the timeout.
- Not fixed and not worked around (changing the test's wait would hide it).
- It needs a run outside this sandbox, or your call on the test's load wait.

**Not run:** the rest of the ~60-suite e2e set (including phase3 and the classic-build suites),
the 6-stage visual sweep (only the starting stage was shown in a browser), and Playgama itself.

## 5. Gameplay verification (browser, `servicefloor.mjs`, Level 12)

| Step | Check | Result |
|---|---|---|
| Arrival | Walks in from outside, sits at seat 0; bubble "🍞 Bruschetta for the House" (the real order); figure inside the room | pass (F1) |
| Start | A double tap starts cooking once: the board, no skipped step | pass (F2) |
| Cutting | Unchanged: the shared solver plays to the Knife Report | pass (F3) |
| Cooking | The existing film plays | unchanged; no interactive step |
| Serve | One settlement entry (0 → 1); the plate on its way, then the face 😍 for Masterful; a second Serve adds nothing | pass (F3) |
| Next | Menu guest: the guest walks in to seat 1 while the previous customer walks out from seat 0 | pass (F4) |
| Finish | The guest paid once (business-revenue 0 → 1); Finish Level completes Level 12; no floor left on screen | pass (F6) |
| Reduced Motion | Seated at once, nobody walks | pass (F7) |
| Console | No errors | pass (F8) |

## 6. Economy and persistence

- **Payment-once:** the floor has no wallet, ledger, settlement or save code (QA D1). Serve
  calls the existing `service.onServe` once (D2). Browser F3 and F6 show exactly one entry each.
- **Animations:** tapping skips ahead once (`done` ref). Skipping or interrupting an animation
  calls no service action. Next and menu guest run their action immediately, once (D3).
- **Inventory, rewards, the gift, tips, cash vacuum:** untouched code paths. restaurantguests,
  restaurantday and phase2 pass.
- **Saves:** no field added. `SaveManager`, `businessTypes`, `economy/`, `EndlessServiceManager`
  and `endlessRestaurant` are byte-identical to `095115a` (QA E1). A reload during the
  arrival replays the arrival; the order's pay state comes from the save as before.

## 7. Visual QA

- **Sizes:** 320 × 568, 390 × 844 and 768 × 1024 on the seated arrival. No sideways scroll,
  bubble on screen, customer inside the room (F5).
- **Screenshots** (session scratchpad): `servicefloor-arrive-320.png`, `-390.png`,
  `-768.png`, `servicefloor-3-served.png`, `servicefloor-4-next-arrives.png`.
- **Kitchen stages:** only the humble stage was seen in a browser. The other five rely on
  the measured coordinates and QA A (walks inside the view, ending at the chair in front of
  the table), not on a visual check.

## 8. Remaining issues

1. **`restaurantfirstlevels` and `paidorders` fail.** They fail the same way on the baseline
   (see "Final verification pass"). They need a run outside this sandbox's request
   interception before a release.
2. **Departures were checked in a browser on the humble stage only.** The other stages rely
   on QA A (the walk geometry).
3. **Not run:** Playgama (the deployed build is still 1.4.1), plus the browser suites not
   listed above (about 30 older ones, e.g. shopart, inventory, staff, history).
4. **Customers between levels:** still needs the A/B decision.

## 9. Next step

Ready for your review on `claude/sharp-wright-emfu2j`. Before merging to `main` (which
deploys Pages):
1. Run `restaurantfirstlevels` and `paidorders` outside this sandbox, or on your machine
   with the plain `tools/e2e` harness, to confirm they pass on both builds.
2. Then approve the merge.
