# KNIFECRAFT — PLAYGAMA EDITION — CLAUDE PROJECT INSTRUCTIONS

**Keep this file lean (developer 2026-10-09).** It holds the RULES only. The
detailed descriptions (every QA suite's scope and numbers, the economy
history and figures, the story / cooking clip / coaching / knife details)
live in **`docs/REFERENCE.md`** (same section numbers). Project history and
what each session did live in **`docs/HANDOFF.md`**. When you add or change
a feature: put its details in `docs/REFERENCE.md` and a short entry in
`docs/HANDOFF.md`; touch this file only if a RULE changes (one or two lines,
never a changelog paragraph).

## 0. READ FIRST

This repository is the **primary KnifeCraft codebase**. The game ships
through **Playgama**, which distributes it to its catalog and partners
(CrazyGames, Yandex, MSN, GameDistribution, YouTube Playables, TikTok, …).
We do not deploy directly to YouTube Playables any more.

**THE DEVELOPER SETS THE RULES (2026-10-08).** The game is the developer's;
their instruction overrides anything here, and this file is updated to
match when they change a rule.

- Repository: GitHub **`mishal4583/Knife-Craft`, branch `main`**.
- Every change the developer asks for is committed and pushed **directly
  to `main`** (no branch, no pull request), after the gates (§5) pass.
- Every push to `main` deploys **GitHub Pages**
  (`.github/workflows/deploy.yml`) — the live test site; check the
  workflow run after each push.
- **The Unified Restaurant is ON in every build** (`RESTAURANT_MODE`,
  `src/game/config/restaurantMode.ts`). The classic game is only a
  `VITE_RESTAURANT_MODE=0` build (used by the classic browser tests).
- The old YouTube codebase's history is included (`main` starts at
  `1af591f`; ref `youtube-original/main`).

Before starting work read `docs/HANDOFF.md` (status, open issues, next
steps); `docs/playgama/` (Playgama + Bridge docs) for platform work;
`docs/REFERENCE.md` for the area you touch; `docs/ECONOMY_V3_MASTER_SPEC.md`
/ `docs/ECONOMY_V3_EXECUTION_PROTOCOL.md` only for economy work.

This is an existing production game: do not rewrite the architecture,
create a second engine or duplicate existing systems.

## 1. PROJECT

React 19 + Vite + TypeScript + Tailwind v4; Phaser 3.90 for the cutting
(lazy `Preparation` chunk). Portrait-first (logical 540×960, `GameShell`
contain-fits). 250 campaign levels (25 chapters), Market, Inventory,
Restaurant (Business Mode / Economy V3), Restaurant Progress, story. One
wallet in **USD cents** (`SaveData.credits`), every movement in
`SaveData.economyLedger`.

## 2. PLATFORM: PLAYGAMA BRIDGE (v2)

- The Bridge script loads from Playgama's CDN in `index.html` before the
  bundle; `public/playgama-bridge-config.json` sits beside it.
- `src/game/PlayablesSDK.ts` is the ONLY file that touches `window.bridge`
  (export names kept from the YouTube build). `bridge.initialize()` resolves
  before any other call; `game_ready` is sent once.
- Saves go through Bridge storage (key `knifecraft_save`); plain
  localStorage only when no Bridge exists.
- Ads: interstitials only at natural breaks via
  `src/game/ads/interstitialPolicy.ts` (none before 3 completed levels, then
  ≥ 150 s apart); rewarded = Replay Bonus, Rush Restock and the Pre-Service
  Check covers (missing stock / supplies), granted only on
  the `rewarded` state; one placement per spot (`AD_PLACEMENT`). Level
  messages `level_started/completed/paused/resumed` with `{ world, level }`;
  no `level_failed`.
- **Never publish a build in which Playgama did not detect the SDK.**
  English only.

## 3. PLAYGAMA DEPLOYMENT (MCP)

MCP server `playgama-developer-cabinet`
(`https://developer.playgama.com/api/mcp`; authenticate via `/mcp`, never
ask for the password). Game **KnifeCraft**, applicationId
`cmuiim0sh1qcalc0hiuw6xwlp`.

- Start with `get_launch_steps`, re-read it after each step.
- Build → zip `dist/` (index.html at the root) → `start_archive_upload`
  (name with the version, e.g. `knifecraft-playgama-1.0.1`) → PUT →
  `confirm_archive_upload` → poll `get_archive_status` until DONE. On
  PROBLEM / NOT_CHECKED tell the developer `state.message` verbatim;
  `bridgeSdk` must be FOUND.
- `publish_sandbox` and `start_sandbox_traffic`: **always ask the
  developer first.** Use the links the tools return; never build URLs
  (QA Tool links via `get_archive_qa_tool_link`). Moderation is submitted
  by a human.
- Covers: `playgama/covers/` (`source/`, `upload/` 800×800, 1080×1920,
  1920×1080).

## 4. BUILD, PREFLIGHT, RELEASE

```
npm ci                      # first time
npm run dev                 # dev server
npm run build               # -> dist/ (the restaurant game)
VITE_RESTAURANT_MODE=0 npx vite build --outDir <dir>   # classic game
npm run preflight           # local platform checks
npx vite preview            # serve dist/ on :4173 for browser tests
```

Release zip: the CONTENTS of `dist/` → `releases/KnifeCraft-Playgama-v<version>.zip`
(gitignored); check `index.html` and `playgama-bridge-config.json` are at
the zip root.

## 5. QA AND GATES

**Gates for any change:** TypeScript (`npx tsc --noEmit -p .`), ESLint on
`src scripts tools` (0 errors; 6 pre-existing warnings in
`src/components/ui`), Prettier on the files you change (don't mass-format
files that were already unformatted), build, preflight, the relevant QA
suites and a browser check. Run the suites the change touches; run all of
them for wide changes.

QA suites: `npx tsx scripts/<name>.mts` (each one's full scope and
figures: `docs/REFERENCE.md` §5). Browser tests: `tools/e2e/` (headless
Chrome, `puppeteer-core`, see `tools/e2e/README.md`; `npm install` there
once). Restaurant browser tests run on the normal build, classic ones on a
`VITE_RESTAURANT_MODE=0` build.

- Restaurant: `restaurant-unlocks-qa`, `restaurant-stock-qa`,
  `restaurant-menu-qa`, `restaurant-day-qa`, `restaurant-guests-qa`,
  `restaurant-supplies-qa`, `restaurant-progression-qa`,
  `restaurant-migration-qa`, `restaurant-campaign-sim-qa`,
  `restaurant-economy-pass-qa`, `restaurant-endless-qa`,
  `restaurant-backoffice-qa`, `restaurant-endgame-qa`,
  `restaurant-fridge-pressure-qa`, `restaurant-final-economy-qa`,
  `restaurant-measures-qa`, `restaurant-city-ranking-qa`,
  `restaurant-first-levels-qa`, `restaurant-grandmas-fridge-qa`,
  `restaurant-level-goals-qa`, `restaurant-service-cover-qa`,
  `restaurant-tools-qa` (browser:
  `tools/e2e/restaurant*.mjs`).
- Campaign / UX: `story-intro-qa`, `story-pause-qa`,
  `campaign-paid-orders-qa`, `level-ux-qa`, `coaching-qa`,
  `knife-stroke-qa`, `cut-rules-qa`, `lazy-load-qa`, `unused-assets-qa`,
  `playables-ads-qa`.
- Economy: `economy-v2-final-qa`, `economy-v2-qa`,
  `economy-v2-settlement-ledger-qa` (frozen baseline; some use `git diff`,
  run in this repo), `economy-v25-qa`, `economy-final-qa`.
- Business / Inventory: `business-history-qa`, `business-supplies-qa`,
  `fridge-view-qa`, `inventory-screen-qa`, `inventory-market-qa`,
  `business-ux-qa`, plus the other `business-*-qa.mts`,
  `campaign-integrity-qa`, `restaurant-progress-qa`,
  `progression-preview-qa`, `usd-currency-qa`, `phase7-2-smoke-test`.
- Cutting / campaign systems: `blacksmith-qa`, `ingredient-realism-qa`,
  `julienne-fix-qa`, `level-system-v2-qa`, `multi-instance-preparation-qa`,
  `new-ingredients-integration-qa`, `overhang-regression-qa`,
  `plating-system-qa`, `shared-destination-plating-qa`, `prep-softlock-qa`,
  the `economy-v2-*` equipment / payout / sharpness / staff / supplier
  suites.
- Business systems: `perishability-qa`, `popularity-demand-qa`,
  `refrigerator-storage-qa`, `supplier-contracts-qa`,
  `supplier-events-qa`.
- Every suite at once: `for f in scripts/*-qa.mts; do npx tsx $f; done`.

Known pre-existing failures: none.

## 6. EXISTING CORE ARCHITECTURE — PRESERVE AND REUSE

React app, Phaser 3, `GameBridge`, `PreparationScene`, `events.ts`,
`SaveManager`, Ingredient registry, Recipe system (`campaignRecipes.ts`),
`RecipeComponent`, `OrganizationManager`, `PreparedOutput`,
`RecipeValidator`, `OrderGenerator`, `CustomerOrderManager`,
`ServiceManager`, `EconomySettlement`, `EconomyLedger`, equipment / staff /
supplier / campaign systems, `StoryManager` + `StoryOverlay`, UI primitives
(`src/components/kc/common/primitives.tsx`, `Meters.tsx`), routing
(`ScreensRouter.tsx`, `ScreenId`).

Single sources of truth: ingredient quantities = Business Inventory;
ingredient definitions = Ingredient Registry; recipes = Recipe System;
wallet = `SaveData.credits`; money movements = `EconomyLedger`;
preparation = PreparationScene; events = `events.ts`; platform =
`PlayablesSDK.ts`; persistence = `SaveManager`. Never duplicate them.

## 7. ECONOMY RULES

(Figures, history and per-system detail: `docs/REFERENCE.md` §7 and §5.)

- **Economy V2 is frozen** (with the approved V2.5 completion-reward
  change): Revenue 165,140 · Completion Rewards 77,581 · COGS 37,620 ·
  Quality Bonus 3,315 · Honest Chef Net 208,416 (`economy-v2-final-qa`).
  Any unexplained change is a regression — investigate, never just update
  expected values.
- **Level rewards**: `levels/levelRewards.ts` `paidLevelReward` is the ONE
  rule for what a level pays. Milestones pay once; Level 250 pays the
  $50,000 Family Legacy once.
- **Restaurant economy** (restaurant saves): the completionist must end
  Level 250 with ≥ $150k (preferred floor $160k, no upper limit — developer
  2026-10-08). Check with `restaurant-final-economy-qa` after any economy
  change.
- **Market = purchase, Inventory = stock control, Restaurant/Business =
  performance.** The Market is the ONLY place ingredients and supplies are
  bought; Business → Equipment the ONLY place fridge upgrades/repairs
  happen.
- **HARD RULE — Inventory is read-only.** The Inventory screen (the
  physical fridge included) only shows the saved inventory; it keeps no
  stock, prices, money or freshness of its own. The one exception is
  Throw Out Expired (`business/discardExpired.ts`, no money, no ledger).
- **Wallet invariant** (`economy/wallet.ts`): whole cents, never < 0;
  every expense all-or-nothing; no bankruptcy, no soft-lock. Grandma never
  lends from Level 10 (developer 2026-10-10): a short service the player
  can't pay for is covered by a rewarded ad or, with no ad, **supplier
  credit** repaid automatically from the next earnings
  (`restaurant/serviceCover.ts`, `supplierCredit.ts`).
- **Ledger**: every real wallet movement has exactly ONE ledger entry;
  failed transactions none; opening cash + signed ledger = closing cash.
- **Business Mode (V3)** lives in `SaveData.business` — extend it; never
  add another top-level save field, save file, wallet, ledger, registry,
  engine or event bus. Campaign never requires a Business system.
- **Determinism**: no uncontrolled `Math.random()` for prices, events,
  spoilage, popularity, demand, inspections or money — use the seeded
  generator.
- **Saves**: preserve old saves (missing fields, old shapes, legacy
  keys); never discard known fields; migrate with the nested pattern in
  `SaveManager`.
- Never allow negative credits, inventory, storage capacity, menu price,
  equipment condition or popularity.

## 8. NEVER CHEAT THE TESTS

Never delete a failing test, weaken an assertion, change expected values to
make a test pass, skip a regression suite without documenting why,
suppress or hide console errors, bypass the ledger / SaveManager / wallet /
PlayablesSDK, create fake success states, or claim a browser test or
simulation that did not happen. When the developer changes a rule, update
the tests to the new rule and say so in the commit. Pre-existing stale
tests are documented, not silently removed.

## 9. STORY, CLIPS, COACHING, KNIVES

Details: `docs/REFERENCE.md` §9. Rules to keep:

- `SaveData.story = { introDone, milestoneMask, finaleSeen }` — no new
  fields. The intro's finish and SKIP › share one completion path; the
  finale's last button ends on the Kitchen home.
- The bundled videos are only the six cooking clips
  (`src/components/kc/game/CookingClip.tsx`); a tap can't skip the plating
  in its first 1.2 s (`PLATING_SKIP_GUARD_MS`).
- Coaching (`src/game/coaching.ts`) only on a first play of a level that
  teaches the technique; it never commits a cut or touches scoring.
- Every knife is drawn by ONE geometry/painter (`scenes/knifeProfile.ts`);
  the cut rules are in `docs/KNIFE_RULES.md` (`cut-rules-qa`,
  `knife-stroke-qa`).

## 10. UI

Use the existing KnifeCraft primitives and identity (warm painted
kitchens, wood/paper, Fraunces / Nunito / Caveat bundled locally). Touch
targets ≥ 48 px. Test at 320×568, 360×640, 390×844, 430×900, 768×1024; no
sideways scroll. No animation libraries or large assets (prefer CSS
transform/opacity). No external fonts, video or network requests at
runtime (only the Bridge CDN script).

Text sizes (developer 2026-10-09): descriptions and secondary lines
12–14.5 px, badges 11 px, nothing below 8.5 px; Caveat lines 13–17 px;
headings unchanged. Keep these for new UI.

## 11. REPOSITORY LAYOUT (additions for Playgama)

```
playgama/covers/source/        original cover art
playgama/covers/upload/        exact-size files for the Playgama form
playgama/screenshots/intro/    intro screens + Level 1
docs/HANDOFF.md                status and history for new sessions
docs/REFERENCE.md              the detailed reference (this file's details)
docs/playgama/                 Playgama requirements + Bridge SDK docs
tools/e2e/                     headless-Chrome checks (Bridge-aware harness)
releases/                      built zips (gitignored)
public/playgama-bridge-config.json
```

Reference-only folders (not in the build): `Knifecraft vegetables/`,
`Knifecraft Phase 1 review/`, `Shop UI/`, `knifecraft_kitchen_webp/`,
`Market.png`, `*.docx`, `*.md` audits.
