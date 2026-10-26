# KnifeCraft — Early game release candidate (2026-10-26): $0 start, Second Floor, kitchen review

Branch `claude/early-game-unlocks`, on phase 4 (`e90cd11` + `5ab2995`), which builds on phases
1–3. `main` is untouched (`1965342`). Nothing merged, deployed or uploaded to Playgama. **No
save field added, removed or renamed.**

## 1. What changed

**The game starts at $0** (developer 2026-10-26: "Ensure that the game starts at 0 cash and the
players starts earn from it"):
- `DEFAULT_SAVE.credits` $1,240 → **$0** (`src/game/SaveManager.ts`, the one value; no field,
  type or migration change). A new player earns ≈ $200 on Level 1 and builds from there.
- **Old saves keep their wallet and ledger**: a loaded save always carries `credits`, so the
  default is never applied to it.
- Nothing early needs money the first level hasn't paid. A short service is covered as before
  (rewarded ad or supplier credit), so even a $0 wallet never soft-locks (the broke profile,
  drained to $0 before every level, finishes all 150).

**Phase 5 — Second Floor machines** (all six already open at L5 since phase 4):
- Inspected every machine's price, upgrades, hourly takings, storage cap, the Floor Server /
  Cleaner rules, the purchase / collect paths and their tests.
- Fixed in the map's station panel (`SecondFloorView.tsx`):
  - an unaffordable machine now says by how much: "$400.00 · need $X more" (was a silent
    disabled "Buy for $400.00");
  - before buying, a machine no Floor Server would run says "🧑‍🍳 Earns once a Floor Server
    runs it ($400.00 once)". A Level 5 player buying the Coffee machine learned only after
    paying that it earns nothing alone.
- The Market's Second Floor section already explains the floor (points + ⓘ), shows payback
  hours, refuses short purchases with "Not enough money — need $X more." and offers the
  existing short-by ad top-up. Unchanged.
- Verified (QA + browser): buy, upgrade, hire, collect are each all-or-nothing with exactly one
  ledger entry; a second collect tap or a reload pays nothing; nothing earns before it is bought
  or while unstaffed. Machines take no stock and touch no service, so they can't bypass a
  teaching stage or block a level.

**Phase 6 — kitchen upgrades, tools and affordability:** simulated from the $0 start
(`restaurantCampaignSim`, same profiles as the economy QA):

| Profile | L5 | L10 | L15 | L36 | First kitchen tier bought |
|---|---|---|---|---|---|
| Saver (buys nothing) | $726 | $2,629 | $4,473 | $16,282 | can afford the $16,000 Growing Kitchen at **L36** |
| Completionist (buys as soon as affordable) | $14 | $53 | $142 | $53 | L77 (it buys every knife, board, helper and machine first) |
| Prudent (keeps $500) | $633 | $551 | $601 | $753 | L75 |

- **Early meaningful purchases already exist** and are affordable through normal play: Santoku
  $350 and Maple board $300 (≈ L5–6 for a saver), the Coffee machine $400 + its Floor Server
  $400 (≈ L7–8), paid hires $84–$210.
- **The first kitchen tier ($16,000) is a savings goal**, reachable by ~L36 for a saver; the
  Kitchen's next-kitchen strip already shows the progress toward it.
- **No price was changed.** A cut would only move the completionist's L150 total up, change
  the tier order's spacing and the R1 rule ($110,000 for all tiers), and it isn't needed for an
  early purchase.
- Earlier tools don't bypass the lessons: knives and boards change stock use and quality, not
  which cut a level teaches. Coaching, the teaching stages, cleaning (L10) and the tools
  requirement (L10) are unchanged.

**Levels 1–15 review:**
- Grandma's tips and the section pointers match the game. L3: "Buy what today's order needs" —
  affordable from the L1 earnings.
- Fixed "1 items need attention" in the Kitchen and map labels (singular now). The check's
  "1 dishes" / "1 stock items" fix from phase 4 is in place.
- Dining Area (was L31): opens at L5 and leads to the Menu, which opens at L5. Dine-in
  progression is unchanged.
- Restroom / Cleanliness still begin at L10.
- Paid hiring, wages (none before L29), supplier credit for a required hire, the walk-in (paid
  once, never takes the next level's stock) — all re-verified by their suites and browser tests.

## 2. Files and commits

- **Source:**
  - `src/game/SaveManager.ts` (opening credits);
  - `src/components/kc/restaurantMap/SecondFloorView.tsx` (shortfall + server note);
  - `src/components/kc/Kitchen.tsx`, `src/components/kc/restaurantMap/RestaurantMapView.tsx`
    (singular labels).
- **Tests:**
  - new `scripts/startCashGuard.mts` (shared guard helper);
  - `economy-final-sim.mts` (`minCashAfterReserve`);
  - suites updated: see §4;
  - `tools/e2e/levelflow.mjs` G2.6.
- **Docs:** HANDOFF, REFERENCE §7 and the Second Floor note, this report.
- **Commit:** see `git log` on the branch (the commit that adds this report).

## 3. Economy (Level 150, simulator)

| Profile | Phase 4 | **RC** | Change | Why |
|---|---|---|---|---|
| Saver | $267,682 | **$266,442** | −$1,240 | exactly the missing opening cash |
| Completionist (Local) | $132,916 | **$130,478** | −$2,438 | −$1,240, plus its early buys come later and 3 more short services go on supplier credit (repaid) |
| Completionist (Wholesale / Premium) | $133,073 / $134,107 | **$131,616 / $132,275** | | |
| Prudent completionist | $132,855 | **$131,426** | −$1,429 | lowest after its reserve $370 (L29), never credit |
| Broke player | $70,354 | **$70,354** | $0 | it is drained to $0 before every level anyway |

- The completionist stays inside the **$100k–$150k** target.
- The frozen campaign figure is unchanged: **Net $101,005**.
- Classic (test-only) build: completionist $33,878 → $32,618 (`economy-final-qa` K5), V2.5
  completionist $31,686 → $30,446 and normal player $29,796 → $28,550 (`economy-v25-qa` A1 / A5).

## 4. Tests

**Gates:**
- `npx tsc --noEmit -p .` clean;
- ESLint 0 errors and the same 9 warnings;
- `npm run build` and `npm run preflight` pass;
- Prettier on changed files that were formatted at the base.

**QA:** all `scripts/*-qa.mts` — results in §6.

**Expectations changed for the developer's rule** (each with a comment in the file):

| Suite | Old | New |
|---|---|---|
| `usd-currency-qa` B5 | a new player starts with $1,240.00 | $0.00 |
| `restaurant-final-economy-qa` S3 | prudent never < $350 from L1 | from when its $500 is first earned |
| `economy-final-qa` K5, `economy-v25-qa` A1 / A5 | classic finals | −$1,240 to −$1,260 |
| `early-menu` E1, `next-kitchen-strip` E1, `oven-step` E1, `service-floor` E1, `phase2` D1, `phase3–5` E1 | SaveManager.ts untouched | only the opening-credits line may change (`startCashGuard.mts`) |
| `restaurant-guests-qa` fixture | a Level-40 save with the default $1,240 | the same $1,240 set explicitly (its K checks buy stock) |
| `phase6-qa` E3 | compares against `HEAD` | passes once committed |
| e2e `levelflow` G2.6 | wallet = $1,240 + ledger | wallet = $0 + ledger |

## 5. Browser (headless Chrome, `vite preview`, local Bridge file)

See §6 for the final table. `restaurantfirstlevels` runs as the established page-load variant
(waiting for network idle hangs in this sandbox).

## 6. Results

**Gates:**
- tsc clean; ESLint 0 errors / 9 warnings (the same as before);
- build and preflight pass (rebuilt after the last change).

**QA:** 124 / 124 suites pass. 123 pass in the full run on the working tree; `phase6-qa` E3
compares against `HEAD` and passes once committed (verified).

**Economy:** §3.

**Browser:**

| Test | Result |
|---|---|
| levelflow (a new game: L1 pays, wallet = $0 + ledger) | 12/12 |
| restaurantfirstlevels (page-load variant) | 13/13 |
| earlymenu, walkins, restaurantday, restaurantguests | 6/6, 6/6, 9/9, 9/9 |
| paidstaff, staff, restaurantstafflife | 6/6, 7/7, 5/5 |
| restaurantsecondfloor, marketsecondfloor | 11/11, 6/6 |
| kitchenstrip, practicepay, restaurantmenu, ovenrecipes | 5/5, 4/4, 5/5, 7/7 |
| new save at $0 (local check): Kitchen shows $0.00; Coffee panel at $50 shows "need $350.00 more" and the server note | pass, no sideways scroll at 320 px |

- `restaurantsecondfloor` step 8 opens `127.0.0.1` unless `KC_URL` is set. It must point at
  the same origin as the other steps (here `KC_URL=http://127.0.0.1:4173/`), else step 8 loads
  a different, empty origin. That's a harness quirk, unchanged since phase 4.

**Known baseline failures:**
- `ingredients.mjs`: 6 pass, 14 fail — the same 14 check ids as on `1965342`. Only 4f's detail
  text differs ("·4 dishes", the phase 2 menu; the same as phase 4).
- `supplies.mjs`: 12 pass, 1 fail — the same check 7 as on `1965342`.
- **No new failures.**

**Screenshots (320 px):** `fresh-kitchen-320.png` (a new save's Kitchen at $0.00) and
`floor-coffee-320.png` (the Coffee panel: shortfall + server note), in the local e2e `out/`.

## 7. Remaining issues and risks

- **Second Floor from L5:** audited in §9 — no game change; the Level 150 effect for players who
  reinvest the floor is a decision for the developer (§9.5).
- The kitchen tiers stay a long-term goal ($16k–$29k). A saver affords the first at ~L36.
- The prudent profile's floor is $350 after its reserve is reached (was $400 before phase 4).
- The refused-walk-in limitation from phase 3 is unchanged.
- No real-device test; headless Chrome only.

## 9. Release gate (2026-10-26): Second Floor audit and the fresh-game check

No game code changed in this pass. Added `scripts/second-floor-early-sim.mts` (real floor
functions, fake clock) so the figures below can be re-run.

### 9.1 What the code does (`restaurant/secondFloor.ts`)

- **Coffee machine:** $400; $10 an hour at Lv 1; stores at most **8 hours** ($80 gross).
- **Floor Server** ($400, one-time, no wage): a machine with no server earns **nothing**
  (one server runs 2 machines).
- **Floor Cleaner** ($300, one-time): each missing cleaner (1 per 3 machines) costs 25 % of the
  takings. Coffee alone, with no cleaner, keeps **$7.50/h, $60 per full 8 h**.
- **Collect:** at the Pickup Counter; one wallet credit and ONE `automation-income` entry;
  every clock restarts. Buying, upgrading and hiring first bank what is waiting (its own entry),
  then charge the price with one `automation-purchase` / staff entry; all-or-nothing.
- **Ad ×2** (`floor_double`): at most 2 a day, only on a collection of at least $50, the extra
  capped at $250.

**Correction to §7's earlier note:**
- "Up to $80 twice a day" was not exact. Coffee + server gives **$60** per full collection;
  **$80** needs the $300 cleaner too.
- Nothing limits it to two collections: the 8 h cap allows **3 full collections a day**
  ($180, or $240 with a cleaner), plus up to 2 ad doubles.

### 9.2 Duplication

Verified in code and tests:
- a second tap pays nothing and writes no entry (`restaurant-second-floor-qa` K2; e2e step 4);
- a reload pays nothing more (e2e step 5);
- a clock jump forward pays only the cap (E2); a clock set backwards earns nothing, never
  negative (E3);
- nothing earns before purchase (E4) or unstaffed (T1);
- upgrades and hires bank the old rate first (B5, T4);
- revisiting the screen moves no money: only the Collect button does.

Limit: like any real-time feature, a player who moves the device clock forward gets each
period's cap sooner (no server time exists). That equals waiting, never more than the cap per
collection.

### 9.3 When a player can first buy it, and what it pays early

- **Earliest purchase:** from $0, a saver has $726 at L5 and $1,001 at L6 (campaign sim, §1).
  So Coffee + server ($800) at **L6**, with the cleaner ($1,100) at **L7**.
- **Early earnings:** the campaign pays ≈ $200–$375 a level at L5–L15.
- **Coffee only** adds $60–$180 a day. It pays back its $800 in 7 days at 2 check-ins a day,
  and has added $2,680 by day 29.
- **Effect: small and optional.** It is never needed for any level; the floor takes no stock
  and touches no service.

### 9.4 Simulated Level 150 effect

The campaign simulator has no clock, so this sits beside it, not inside it. It does not include
the floor (by the developer's 2026-10-16 rule the floor is "extra on top"). The floor's money is
real-time and depends on habit and pace. Assumed pace: **5 levels a day** (L60 ≈ day 11, L150 ≈
day 29); at 3 a day, L150 ≈ day 49.

Floor net added to the wallet, starting from $800 at L6 (`second-floor-early-sim`):

| Habit | Day 11 (≈ L60) | Day 29 (≈ L150 at 5/day) | Day 49 (≈ L150 at 3/day) |
|---|---|---|---|
| never buys | $0 | $0 | $0 |
| Coffee only, 2 check-ins/day | +$520 | +$2,680 | +$5,080 |
| reinvests, 1 check-in/day | −$320 | −$117 | +$4,064 |
| reinvests, 2 check-ins/day | −$284 | **+$22,064** | **+$102,064** |
| reinvests, 4 check-ins/day | +$780 | **+$58,374** | **+$154,374** |

- **Before phase 4** the floor opened at L60 (day 11). At 5 levels a day it then had 18 days by
  L150: net −$206 / +$205 / +$5,574 for 1 / 2 / 4 check-ins (`second-floor-economy-sim`'s
  day-18 figures).
- **The L5 opening adds 11 floor days** before L60, so a reinvesting player's floor matures
  inside the campaign.
- **Who it changes:**
  - a player who never buys, or keeps only the Coffee machine, stays at the reported balances
    (completionist $130,478, within a few thousand);
  - a player who reinvests twice a day ends L150 around **$152k**;
  - four times a day, around **$189k**.
- **Are the reported Level 150 balances misleading?** Not for the campaign. For an engaged
  floor player, yes: they are a floor, not the expected total.

### 9.5 Decision: no correction made

- **Early game:** the floor's opening at L5 causes no early balance or progression problem.
  Through ≈ L60 it is worth −$320 to +$1,180, never needed, and a reinvesting player has *less*
  free cash for the first 1–3 weeks.
- **Late game:** its effect is late-campaign compounding, for players who reinvest it often. By
  the developer's rule that money sits outside the campaign target.
- **Why nothing smaller works:**
  - a lower cap or rate would re-tune the floor's own economy (its payback plan, P1–P4) and
    still not remove compounding for heavy players;
  - a later opening reverses the developer's "everything at or before Level 5" instruction.
- **So the logic is unchanged.** If you want the L150 band to hold for floor players too, the
  smallest lever is to put machines 2–6 (and upgrades) back behind later levels, while keeping
  the floor and Coffee at L5. That is your call.

### 9.6 The $0 start, re-checked

- **A new save:** $0.00 and an empty ledger (browser).
- **Levels 1–5 played in the browser from a brand-new game** (local check
  `zzplay5.mjs`: the real screens, the solver cutting, the Pre-Service Check's quick restock):

  | After | Wallet | Ledger entries |
  |---|---|---|
  | L1 | $105.00 | settlement $55, completion $50 |
  | L2 (practice) | $105.00 | none |
  | L3 | $265.81 | ingredients −$1.19, settlement $106, completion $56 |
  | L4 | $430.12 | ingredients −$0.69, settlement $106, completion $59 |
  | L5 | $623.63 | ingredients −$3.75, settlement $127, menu guest $8.26, completion $62 |

  The wallet equals the ledger after every level, never goes negative, and there are no console
  errors.
- **Short at $0** (local check `zzcover.mjs`, L3, empty fridge, $0):
  - the check says "Not enough money — need $X more" and offers "💳 Supplier credit · $0.95";
  - the service runs and pays;
  - the $0.95 is repaid automatically from the earnings (one `supplier-credit-repayment`
    entry), and nothing is owed after.
- **Required hire with no money:**
  - goes on supplier credit (`staff-hire-qa`);
  - the broke player, drained to $0 before every level, finishes all 150 with 10 hires and 203
    short services on credit, all repaid (`restaurant-campaign-sim-qa` B3).
- **Old saves** keep wallet, staff and ledger (a loaded save always carries `credits`;
  `staff-hire-qa` O, `restaurant-second-floor-qa` S1).
- **No save field added:** the guards (`startCashGuard.mts`) allow only the opening-credits
  value in `SaveManager.ts`.

### 9.7 Checks in this pass

- **Gates:** tsc clean; ESLint 0 errors / 9 warnings; build and preflight pass.
- **Browser:** `restaurantsecondfloor` 11/11 with `KC_URL=http://127.0.0.1:4173/`, the same
  origin as its other steps.
- **Known baseline failures:** `ingredients` (14) and `supplies` (1) are the same check ids as on
  `1965342` (§6). No game code changed since that run.

## 8. Run the build locally

```
git checkout claude/early-game-unlocks
npm ci
npm run build          # dist/ = the restaurant game
npm run preflight
npx vite preview       # http://localhost:4173
```

For a new game at $0, clear the site's storage (or use a private window).
