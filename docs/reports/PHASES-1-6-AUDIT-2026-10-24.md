# KnifeCraft — Phase 1–6 completion audit (2026-10-24)

Branch `main`, audited at `a759347` and finished at the commit that adds this
file. The work was built on 2026-10-21 (commit `412f3bc`, then `3272996`) and
changed since by the developer's own instructions (board cloth, knife effects,
night chores). Evidence is the code plus tests run today; nothing below rests
only on the old phase reports (`phase1-report.md` … `phase6-report.md`).

Statuses: `[x]` complete and verified · `[~]` partial · `[ ]` missing ·
`[!]` blocked on an approval · `[?]` not verified.

## 1. Executive summary

- **Already complete at the audit:** most of all six phases. That covers:
  - combo, New Best and replay;
  - board debris and the cleanup;
  - the cash vacuum and tips;
  - Fever Mode, Prep Rush and the six Kitchen Chaos events;
  - the five customers;
  - the Signature Dish Collection and the order-completion sequence;
  - the restoration reveals and the gift streak;
  - the four Kitchen Moment cards.

  The phase QA suites and browser tests pass on today's tree.
- **Partial:**
  1. P1.1: a finished ingredient doesn't gather into a neat pile. It fades off
     the board, or flies to the plate on the last step.
  2. P3.4: four of the five special variants are visual only. They have their
     own skin, juice colour and flecks; only the Giant Cucumber changes play
     (it is 1.3× bigger).
  3. P6.2: the share check tested file sharing only. **Fixed today**: text
     sharing is now detected separately.
- **Deliberately different from this brief (the developer's later
  instructions):** P2.1's "one forgiving swipe, optional, Skip" bench scraper
  became the cloth. The board must be wiped, slowly, corner to corner, before
  every next ingredient, and Skip was removed (2026-10-23/24). The brief's wording
  is not restored.
- **Missing:** nothing that the brief lists outright.
- **Needs an approval:**
  - real gameplay effects for the four visual-only variants, since they could
    touch scoring or difficulty;
  - saving best combo and variants per recipe (a new save field).

## 2. Checklist

### Phase 0 — baseline and QA

| Item | Status | Evidence |
|---|---|---|
| B1 Repository map | [x] | React 19 + Vite + TS; Phaser 3.90 (`PreparationScene`), `GameBridge`/`events.ts`; `SaveManager`; wallet `economy/wallet.ts` + `EconomyLedger`; flow Preparation → Knife Report → plating/clip → `ServiceOrderComplete` → settlement → replay (`App.tsx`). Working tree was clean. |
| B2 Historical failures | [x] | Today, classic build (`VITE_RESTAURANT_MODE=0`, :4174): **economyv25 exit 0, coach exit 0, adsflow exit 0** (historical 12 / 3 / 2). adsflow on the restaurant build: exit 0. `coach.mjs` on the restaurant build fails 5b/8a; it is a classic-build test (README, STATUS-2026-10-21), so that run doesn't apply. |
| B3 Baseline evidence | [~] | Five widths 320–768, **no sideways scroll, no console errors** (`audit320.mjs`, below). Economy: `restaurant-final-economy-qa`, `achievement-rewards-qa` and the frozen baseline suites pass. **Not measured:** frame-time on low-end devices (none here). |

### Phase 1 — core cutting satisfaction

| Item | Status | Evidence / remaining |
|---|---|---|
| Knife drag / resistance | [x] | `CUT_DRAG` (definitions.ts) on the board nudge; no input gating; skipped with Reduced Motion. |
| Hit-pause | [x] | `HITSTOP_MS` 40 ms, Perfect 50 ms ("thunk, not a freeze"), delays only the piece reveal. |
| Slice separation / toppling | [x] | Piece parting + settle tilt `PIECE_SETTLE.TILT_RAD` (developer override 2026-10-21); `phase1-cutting-qa` F. |
| Differentiated sounds | [x] | `AudioManager` per technique, rising combo pitch, `playBladeRing`; `knife-feel-qa`. |
| Perfect-cut feedback | [x] | Glint, flash, haptic (`knifeFeel.ts` `cutMoment`, `scenes/knifeFx.ts`). |
| Neat pile when finished | [~] | Pieces settle where cut; then fade (not last step) or fly to the plate. **No gather-into-pile.** Proposal in §8. |
| No duplicate effects | [x] | One `onCut` per committed cut; `knife-feel-qa` R1–R5. |
| Reduced Motion | [x] | Checked in `CUT_DRAG`, tilt, `knifeFx`, `CashVacuum`, Fever. |
| Low-end performance | [?] | Bounded (`MAX_WET` 24, trail and splash caps); not profiled on a device. |
| Combo meter, pitch, "Clean ×5!" | [x] | `COMBO` milestones, HUD; `phase1-cutting-qa`. |
| "New Best!" only when genuine | [x] | `bestVerdict.ts`: equal is not better, no baseline is "first", no "+0%". |
| Honest improvement line | [x] | Compares against the saved **best** (the save keeps no "last time"), so it says "Cleaner than your best +N%", never "than last time". |
| Immediate replay | [x] | Prepare Again with a replay latch (double press restarts once); `phase2.mjs`. |
| Replay Bonus preserved | [x] | `ads/replayBonus.ts` unchanged (share 0.2, cap 3). |
| Combo resets | [x] | Reset on STEP_STARTED and restart; Fever ended on restart (`endFever("restart")`). |

### Phase 2 — cleanup and physical money

| Item | Status | Evidence / remaining |
|---|---|---|
| Natural debris (scraps, seeds, skins, juice) | [x] | `boardDebris.ts`: 54 ingredient looks, juice for juicy ones, session-seeded variety; `phase2-qa` A. |
| Bounded debris | [x] | Caps on pieces and wet marks; texture-painted (one CanvasTexture). |
| Scraper interaction, one forgiving swipe, optional | [~] **developer override** | Replaced by the cloth: wipe every patch (film grid 8×5), before **every** next ingredient, no Skip (2026-10-23/24). Not optional by the developer's decision. |
| Clean board revealed, audio, sparkle | [x] | `boardClean`, wipe sounds, sparkle; ingredient hidden until clean. |
| No conflict with cutting | [x] | `clothGestureLeft`: a drag that finishes the cloth can't cut (`phase2-qa` A25). |
| Listener / debris cleanup on exit | [x] | `resetDebrisForTests` / scene shutdown; `phase2.mjs`. |
| No scoring, payout or save change | [x] | `phase2-qa` D. |
| Cash shown after confirmed payment | [x] | `cashBurst.ts` from the settled amount; `ServiceOrderComplete`. |
| Swipe vacuum, animation, cha-ching, rolling wallet | [x] | `CashVacuum.tsx`; the pill rolls to the real `credits`. |
| Auto-collect without a save field | [x] | Session-only `setAutoCollect`; always automatic with Reduced Motion. |
| No second payout | [x] | Vacuum credits nothing (`phase2-qa` B, `phase2.mjs` ledger checks). |
| Celebration and reactions from real quality | [x] | Cheer for Masterful, nod for Clean (the settlement's grade). |
| Tips: deterministic, once, own ledger entry | [x] | `economy/customerTips.ts`: 1 in 3 first-time Masterful orders, 10% (min $5), one `customer-tip` entry; bound ≤ 5%, measured 1.79%. A fixed percentage rather than fixed dollar amounts (developer-approved 2026-10-21). |
| Breakdown: base vs tip | [x] | Serve card lists pay and tip separately; cash = the combined total. |

### Phase 3 — high-energy gameplay

| Item | Status | Evidence / remaining |
|---|---|---|
| Fever Mode (trigger, glow, countdown, end, cleanup, once an order) | [x] | `fever.ts` (Clean ×10, 6 s), `feverLights`; `phase3-qa` A, `phase3.mjs` (exit 0). Scoring unchanged. |
| Endless Prep Rush (separate mode, conveyor, bins, start/end/result/replay, cleanup, no money) | [x] | `prepRush.ts`, `PrepRushScene`, `components/kc/prepRush`; seeded sequence; best is session memory. |
| Kitchen Chaos Director: Giant, Avalanche, Rush Hour, Grandma's Challenge, Perfect Plating, Inspection | [x] | `kitchenChaos.ts`: one every 4th eligible order, fixed rotation, never stacked on a variant, the cloth or a teaching level. Inspection reads `inspectBusiness` live with no fine. Each is played in `phase3.mjs` (dev hook `window.__kcSpecials`, dev builds only). |
| Five variants: distinct visual identity | [x] | `specialVariants.ts` hue-mapped skin plus marks; juice and scrap tint (`boardDebris`, `knifeFx`). |
| Five variants: meaningful gameplay effect | [~] | Giant Cucumber: 1.3× size (a longer ingredient to cut). Golden Tomato, Rainbow Carrot, Frosted Onion, Heirloom Pepper: **visual, juice colour and Recipe Book memory only**. Needs a design choice (§8). |
| Variant finished-dish presentation | [x] | The book page's memory line per variant (`signatureDishes.ts`), the Special Dish moment card. |

### Phase 4 — collection and customers

| Item | Status | Evidence / remaining |
|---|---|---|
| Signature tiers (Homemade / Chef's Special / Grandma's Signature) | [x] | `signatureDishes.ts` from the saved `recipeProgress.best` (existing thresholds 85 / 95); no save field. |
| Mastery, variants, illustrations, family memories | [x] / [!] | Shown. Best combo and variant per recipe are **this visit only** ("not saved"): saving them needs a new save field (§8). |
| Five customers in real play | [x] | `customers/personalities.ts`: every 5th eligible order, fixed rotation, cached per order. Reactions follow the real grade, and the Regular reacts to the real prep time. Presentation only. Big Bruno's "big portion" is a line, not a bigger order (no economy path, as the brief requires). |
| Completion sequence (report → plating → clip → reaction → payment → cash) | [x] | Staged serve card, one advance per stage, Next Customer can't double-advance; `phase4.mjs` (exit 0), `knifereport.mjs` (exit 0). |

### Phase 5 — ownership and comeback

| Item | Status | Evidence / remaining |
|---|---|---|
| Transformation reveals | [x] | `kitchen/restoration.ts`, `RestorationReveal.tsx`: after a saved purchase only, skippable, Reduced Motion = instant, prices unchanged; `phase5.mjs` (exit 0). |
| Daily gift on the Kitchen, streak, Day 3 $100, Day 7 $300 | [x] | `daily/giftStreak.ts`, `DailyGiftCard.tsx`. Reads the ledger's gift entries (kept 9 days), no save field; once per day; a missed day restarts. Today's Special streak is untouched. |

### Phase 6 — sharing

| Item | Status | Evidence / remaining |
|---|---|---|
| Four moments from real data | [x] | `kitchenMoments.ts` (Perfect Cut, Special Dish, Personal Best, Customer); once per run; `phase6-qa`. |
| Card: brand, mobile-readable, long names | [x] | 1080×1350 canvas; fits 320×568 (`phase6.mjs` M5). |
| Optional preview, no auto-post, no rewards, no network | [x] | Quiet 📸 chip; `phase6.mjs` M10–M11 (only the order's own ledger entry). |
| Share vs file-share detected separately | [x] **fixed today** | Was file-share only. Now `canShareText` is detected on its own (`MomentPreview.tsx`). Tests M8 / M8b (new) pass. |
| Download fallback, cancel handling | [x] | Save image (PNG), AbortError is not an error (M6–M7). |
| Real-device native share | [?] | Only a stubbed `navigator.share` in headless Chrome. |

## 3. Files changed today

- `src/game/levels/levelDefinitions.ts`: the step lists for Levels 4, 11 and 16 now match their recipes. Play already used the right recipe; the difficulty badge and the derived recipe read the old snapshot. Commit `a759347`.
- `src/game/restaurant/firstLevels.ts`: the Level 10 card's tools line ("sheet pans before Level 11" was wrong). Commit `a759347`.
- `src/components/kc/moments/MomentPreview.tsx`:
  - text sharing is detected separately from file sharing;
  - the card arrows are now 48 px (were 44, under the touch-target rule).
- `scripts/phase6-qa.mts` C2 and `tools/e2e/phase6.mjs` M8 / M8b: updated to the brief's rule (separate detection); recorded in the commit.
- `docs/HANDOFF.md`: the Phase 1–6 headings said "not committed"; they were committed in `412f3bc`.

## 4. Tests run (all today)

- Gates:
  - `npx tsc --noEmit -p .`: clean.
  - ESLint `src scripts tools`: 0 errors, 9 warnings (the existing baseline).
  - Prettier on the changed, formatted files.
  - `npm run build` and `npm run preflight`: all hard checks passed.
- QA: `for f in scripts/*-qa.mts` passes **117/117** after the level fix. `phase6-qa` passes after the share change.
- Browser, restaurant build (:4173): knifereport, phase2, phase3 (with dev servers :8080 / :8081), phase4, phase5, adsflow all exit 0.
  - phase6 failed M8 on the unchanged build (an old "no Share" check whose `navigator.share` stub was still set).
  - On the new build, phase6 passes 13/13 (M0–M11 + M8b).
- Browser, classic build (:4174): economyv25, coach, adsflow all exit 0.
- `audit320.mjs` (scratch):
  - widths 320×568, 360×640, 390×844, 430×900 and 768×1024: 0 px sideways scroll;
  - 0 console errors;
  - the 320 px Pre-Service Check screenshot.

## 5. Regression vs. historical baseline

| Suite | Historical | Today |
|---|---|---|
| economyv25 (classic) | 12 failures | 0 (exit 0) |
| coach (classic) | 3 failures | 0 (exit 0) |
| adsflow | 2 failures | 0 on both builds |

## 6. Save and economy integrity

- No save field, storage key or schema was added today or in Phases 1–6. Session-only state covers:
  - auto-collect;
  - Prep Rush best;
  - moments;
  - best combo and variants.

  The gift streak reads the ledger.
- Money paths:
  - Phases 1–6 add exactly two approved ones: `customer-tip`, and the Day 3 / Day 7 streak entries;
  - each is one ledger entry, once;
  - cash visuals credit nothing.
- The economy suites pass, including the frozen baseline and `restaurant-final-economy-qa`.

## 7. Screenshots

In the session scratchpad: `audit-kitchen-320.png`, `-360`, `-390`, `-430`, `-768`, and `audit-play-320.png` (the Pre-Service Check at 320 px).

## 8. Waiting on the developer

1. **Variant gameplay effects (P3.4).** Proposal, none of which changes a score or pay:
   - Golden Tomato: twice the juice;
   - Rainbow Carrot: each slice shows the next colour ring;
   - Frosted Onion: an icy crack sound and frost shards, no tears;
   - Heirloom Pepper: a seed burst and a Grandma line.

   Anything that makes a variant harder or easier (more cuts, a wider guide) changes difficulty, so it needs your yes.
2. **Neat pile (P1.1).** Before the board fades, tween the finished pieces into a tidy stack at one side (about 250 ms, skipped with Reduced Motion). It touches the step change and plating timing. Say if you want it.
3. **Saved best combo and variants per recipe (P4.1).** Would need two optional fields on the existing record, `recipeProgress[id].combo?: number` and `recipeProgress[id].variants?: string[]` (missing = none, so old saves load unchanged). That is a save-schema change, so it is not done.
4. **Cloth vs. the brief's optional scraper (P2.1).** Your later instruction is kept (must wipe, no Skip). Tell me if the brief's version should come back.

## 9. Not verified

- Frame time on low-end phones.
- Native share on a real phone.
- Fault injection of interrupted animations (scene killed mid-tween), beyond the existing restart and double-press checks.
