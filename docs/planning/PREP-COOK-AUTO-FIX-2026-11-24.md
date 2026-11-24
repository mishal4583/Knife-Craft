# Prep Cook Auto: persistence and payment fix (2026-11-24)

Authorized by the developer ("Prep Cook Auto Persistence and Payment Fix"), narrowly: no economy, payment-formula, save-field, ad or Playgama change. Uncommitted.

## The defect

On the hired Prep Cook's **Auto** service (Level 30 and up), each order was served from an **older copy of the game state** than the one that held the finished plate. Two things followed:

1. **The order was paid as a plate of score 0.** The game's own formulas give, for the Level 32 order (`camp-garlic-curry-paste`): score 0 → pay $235.00, tip $0.00; score 75 (the Prep Cook's plain "Honest" plate) → pay $240.00, tip $15.00 (the tip formula before the restaurant-hygiene share gives $12.00 for the plain plate; the game pays $15.00 in play). Auto paid $235.00 and no tip. The shortfall was about 8% of the order, in every order, and it was never credited anywhere.
2. **The plate's record was overwritten.** The serve wrote a whole save built from the older copy, so the plate's recipe progress, the chef record (plates, services, accuracy), the shift tally and the dare progress that had just been saved were lost.

The wallet always equalled the opening cash plus the signed ledger, nothing was paid twice and no ledger id repeated: the money was **under**paid and the records were lost, never duplicated or corrupted.

## Root cause (exact)

`ServiceOrderComplete` (the Serve card) sets Auto's serve timer in its own mount effect: `window.setTimeout(handleServe, AUTO_SERVE_MS)`. That effect runs **before** `Preparation`'s effect that credits the plate (`onRunStats` then `onComplete` = `recordCampaignServiceResult`, which persists the recipe progress and replaces the service session with the plate's score recorded). React runs child effects before the parent's, and the timer effect's dependencies (`auto`, `hidden`, `served`) do not change when the plate is recorded, so it is never re-created. The timer therefore called the `handleServe` of the render that set it, whose `onServe` is `serveCampaignOrder` **of that render**:

- its `campaignServiceSession` still had the order without a score (`order.preparationScore` undefined, status not READY), so `serveCampaignOrder` reconciled it with `recordAllComponents(session, order.preparationScore ?? 0)` and priced and tipped the order from `?? 0`;
- its `save` did not have the plate's `recipeProgress` or chef record, and `persist(applySharpnessDecay(servedSave …))` wrote that older save over the newer one;
- `setCampaignServiceSession(result.session)` also put the older session back.

A tap on Serve is not affected: the handler it calls is the one of the render the player taps in, one moment later.

`toggleAutoService` (Stop Auto) is **not** part of the defect: before the fix it already saved the setting off and kept it off (autoservice S3). The Prep Cook and menu-guest serves share the one timer, so one fix covers both.

## The fix (one place)

`src/components/kc/game/ServiceOrderComplete.tsx`: the timer now calls the **latest** `handleServe` through a ref that an effect keeps current (`serveNowRef`). By the time it fires (900 ms later) the plate has been recorded and App has re-rendered, so Auto does exactly what a tap on Serve does one moment later. Nothing else changed: no payment or tip formula, no `save` or `saveRef` reference in App, no save field, no ledger or wallet code, manual serving untouched (it still calls `handleServe` directly, once per screen, behind its latch).

I did **not** replace `save` by `saveRef.current` anywhere. `serveCampaignOrder`, `serveMenuGuestOrder` and `recordCampaignServiceResult` read the render's `save` and session exactly as a manual serve does; the bug was that Auto ran an *older render's* copy of them, not that those functions read the wrong source. Their behavior on the manual path is unchanged and proven by the comparison below.

## Before and after (real gameplay, restaurant build)

`tools/e2e/autoservice.mjs` plays the same service two ways: M = the Prep Cook's button with the player serving by hand (the reference), A = Auto on. Before-fix output is preserved in `docs/planning/PREP-COOK-AUTO-BEFORE-FIX-2026-11-24.txt` (`AUTO_BASELINE=1 node tools/e2e/autoservice.mjs …` prints the numbers without asserting). The original read-only reproduction is kept as `tools/e2e/prepcook-autorepro.mjs`.

| | Level 32 (1 order) manual | Level 32 Auto BEFORE | Level 32 Auto AFTER |
|---|---|---|---|
| Order pay | $240.00 | $235.00 | **$240.00** |
| Tip | $15.00 | $0.00 | **$15.00** |
| Recipe progress | 75 | none | **75** |
| Chef record plates / services | 1 / 1 | 0 / 0 | **1 / 1** |
| Wallet = opening + signed ledger | yes | yes | yes |
| Duplicate ledger ids | 0 | 0 | 0 |
| Stock used | 23.825 / 23.825 | same | same |

| | Level 33 (2 orders) manual | Auto BEFORE | Auto AFTER |
|---|---|---|---|
| Order pay (both) | $474.00 | $465.00 | **$474.00** |
| Tips (both) | $31.00 | $0.00 | **$31.00** |
| Recipe progress | 75 and 75 | none | **75 and 75** |
| Chef record plates / services | 2 / 1 | 0 / 0 | **2 / 1** |

| Scenario | Result after the fix |
|---|---|
| S1 one order, M against A | identical (pay, tip, recipe book, chef record, stock, wallet) |
| S2 two consecutive orders | identical |
| S3 Stop Auto | saved off, still off 9 s later, no further order paid |
| S4 reload during Auto (after the first order), then the player's Start service | Auto carries on; the level pays exactly what the manual service pays, records once |
| S5 reload after a hand-served order | the one order stays paid once; finishing pays exactly the manual total |
| S6 interrupted: plate cut and recorded, reload before serving | nothing paid, no money moved, plate stays recorded; serving afterwards pays once |
| S7 three Serve clicks in one tick | one payment, one tip |
| S8 a taken dare | the dare and the record end identical by hand and on Auto |
| S9 / S10 a menu guest (Level 32) | by hand = Auto for the guest's pay, table cash, plate and recipe records, stock and wallet; three Serve clicks pay once; collecting the cash is one ledger entry per kind; reload changes nothing |
| Business service | does not share the path: Auto exists only for campaign services (`prepCookOn` needs `isCampaignService`) and the Business serve is `serveActiveBusinessOrder`; the shared Serve card only creates the timer when `auto` is on |

## What the fix does not change

Payment and tip formulas, the wallet, the ledger, the save format (no new field), the ad and Playgama code, the Auto design, manual serving.

## Limits

- After a reload the player must press "Start service" on the Pre-Service Check; Auto never presses it (by design: `prepCookAuto.ts` says Auto stops at the Pre-Service Check so it can never spend money).
- An interrupted order is cooked again after a reload, and the chef record then counts the two real plates (the same as for a hand-cut order).
- Menu guests use the same timer. They were played separately (autoservice S9 and S10, Level 32 with two guests): by hand and on Auto the guest is cooked, served and paid identically (the guest's cash waits on the table as a `business-revenue` piece, $21.70 for Caprese Skewers), three Serve clicks pay once, collecting the table cash makes exactly one ledger entry each for the order's pay, its tip and the guest ($276.70 in all), and a reload changes nothing. Reloading on the guest's card lets the game complete the level on load (the completion reward is paid at most once); that is existing resume behavior, not Auto's.
- The old `prepcook.mjs` and `tablecash.mjs` still fail on the same stale setup (they click "Prepare" and lack what the Pre-Service Check needs); they are not changed here.

## Tests

`prep-cook-auto-qa` A4 pinned the old timer form (`setTimeout(handleServe, …)`): updated with a RULE CHANGE note; A9 (the timer runs the latest handler) and A10 (manual serving untouched) are new. `shiftreal` E21 asserted that Auto makes no shift card (the defect's side effect): replaced, with a RULE CHANGE note, by the card Auto now makes.
