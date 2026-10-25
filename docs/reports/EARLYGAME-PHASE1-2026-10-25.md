# KnifeCraft — Early-game transformation, phase 1 (2026-10-25): the Level 2 pay correction

Base: `main` at `1965342`. Work: `claude/early-game` (does not deploy). Not merged; nothing
uploaded to Playgama.

## 1. What changed

Level 2 (Basic Kitchen Learning) is a practice level (`campaignNoEconomy`). The game pays
nothing for it: `App.serveCampaignOrder` serves it as a replay. Two places still counted it:

| Where | Before | After |
|---|---|---|
| Kitchen "Today's order" card (`levelPayPreview.ts`, `Kitchen.tsx payText`) | "ready to prepare · about +$130.00" | "ready to prepare · $0.00" |
| Campaign simulator (`scripts/restaurantCampaignSim.mts`) | paid Level 2's order ($138, "campaign-settlement") with its stock and supplies | serves it like the game: no stock, no supplies, no pay, no paid-order record |

**Payouts in the game are unchanged.** Only the preview and the simulator now match what
the game already does. Every other level's preview is unchanged (Level 3 still reads "about
+$156.00").

## 2. Economy difference (simulator, against `1965342`)

The same 32 economy, supply and tool scripts were run in a clean `1965342` worktree and on
this branch. Six differ, and all of the differences come from the $138.

| Measure | `1965342` | This branch | Difference | Why |
|---|---|---|---|---|
| Saver (buys nothing), L10 cash | $3,866 | $3,728 | −$138 | the phantom payment |
| Saver, L150 | $267,210 | $267,072 | −$138 | the phantom payment, exactly |
| Settlements (saver; broke player) | $75,857; $75,170 | $75,719; $75,032 | −$138 each | the phantom payment |
| Broke player, L150 | $70,355 | $70,355 | $0 | supplier credit absorbs it |
| **Completionist L150, Local** (the rule's figure) | **$132,066** | **$132,067** | +$1 | timing ripple (below) |
| Completionist L150, Wholesale / Premium | $132,250 / $133,538 | $132,271 / $133,462 | +$21 / −$76 | timing ripple |
| Prudent completionist (keeps $500) | $132,298 | $132,014 | −$284 | timing ripple |
| Kitchen-tiers-only buyer | $177,834 | $177,696 | −$138 | the phantom payment |
| Endless start (L250 completionist save) | $132,066 | $132,024 | −$42 | timing ripple |

**Timing ripple:** a buyer has $138 less from Level 2 on, so some purchases move by a level.
That shifts its quality bonus and menu guests slightly. The net is a few dollars either way
for greedy buyers, and −$284 for the prudent one. No new money path is involved.

**Bands:** the completionist stays inside $100k–$150k ($132,067). `restaurant-final-economy-qa`,
`restaurant-economy-pass-qa`, `restaurant-campaign-sim-qa` and `achievement-rewards-qa` all
pass. The frozen campaign figure in CLAUDE.md §7 (Net 101,005, from
`economy-v2-campaign-simulation`) is unchanged: that script's output is identical.

## 3. Tests

- typecheck clean; ESLint 0 errors (the same 9 warnings); build and preflight pass;
  Prettier clean on the changed files. In the simulator, one unrelated line Prettier reflowed
  was restored, so its diff is the fix only.
- **QA:** all 121 suites pass.
  - `restaurant-measures-qa` A1b (new): Level 2 previews $0, as it pays. It fails on the old
    preview (mutation check) and passes on the fix.
  - `oven-step-qa` E2 (deliberately updated): the Phase D–F guard forbids any change under
    `src/game/restaurant/` since `cc46bbd`. It now also allows `levelPayPreview.ts` (display
    only), with a comment. The oven and serve code stay guarded.
- **Browser** (new `tools/e2e/practicepay.mjs`): 4 / 4 on this branch.
  - P1 Level 2 reads "$0.00"; P2 Level 3 reads "about +$156.00";
  - P3 at 320 × 568 and 390 × 844 the line is on screen, with no sideways scroll;
  - P4 no console errors.
  - On the baseline build P1 fails ("about +$130.00"), so the test catches the old bug.
- Screenshot: `practicepay-320.png` (local e2e `out/`).

## 4. Next (awaiting review)

Phase 2: the restaurant menu and menu guests from Level 5 (was 11).
