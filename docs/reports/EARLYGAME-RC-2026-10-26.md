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

(filled in below after the final runs)

## 7. Remaining issues and risks

- **Second Floor at L5 is real-time income** ($10/h for the Coffee machine, up to 8 h stored).
  It is "extra on top of the campaign economy" by the developer's 2026-10-16 rule and opened at
  L5 by the 2026-10-26 rule. A player who buys Coffee + server at ~L8 can collect up to $80
  twice a day, more than a level pays early on. The simulator doesn't count it. Worth a
  developer decision (e.g. a later floor opening) before release.
- The kitchen tiers stay a long-term goal ($16k–$29k). A saver affords the first at ~L36.
- The prudent profile's floor is $350 after its reserve is reached (was $400 before phase 4).
- The refused-walk-in limitation from phase 3 is unchanged.
- No real-device test; headless Chrome only.

## 8. Run the build locally

```
git checkout claude/early-game-unlocks
npm ci
npm run build          # dist/ = the restaurant game
npm run preflight
npx vite preview       # http://localhost:4173
```

For a new game at $0, clear the site's storage (or use a private window).
