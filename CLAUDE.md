# KNIFECRAFT — PLAYGAMA EDITION — CLAUDE PROJECT INSTRUCTIONS

RULES ONLY; keep this file lean. Details: `docs/REFERENCE.md` (same section
numbers). Status / open items: the top of `docs/HANDOFF.md`. Past work:
`docs/HISTORY.md`. A new feature gets its details in REFERENCE and a short
status line in HANDOFF; this file changes only when a RULE changes.

## 0. READ FIRST

- The game is the developer's; their instruction overrides this file.
- Repo: GitHub `mishal4583/Knife-Craft`, branch `main`. It ships through
  **Playgama** (CrazyGames, Yandex, MSN, GameDistribution, YouTube Playables,
  TikTok, …), not straight to YouTube.
- **No commit, push, merge, deploy or release-config change without the
  developer's explicit approval** (2026-10-11). When approved, push to `main`
  after the gates (§5). Every push to `main` deploys GitHub Pages
  (`.github/workflows/deploy.yml`); check the run.
- **The Unified Restaurant is ON in every build** (`RESTAURANT_MODE`,
  `src/game/config/restaurantMode.ts`). The classic game is only a
  `VITE_RESTAURANT_MODE=0` build, used by the classic browser tests.
- Before starting, read HANDOFF's status section, and only the
  REFERENCE / `docs/playgama/` / `docs/ECONOMY_V3_*` sections the task touches.
- This is a production game. Don't rewrite the architecture or duplicate
  systems.
- **Save tokens:**
  - read files by section;
  - run only the suites the change touches (all of them before a release);
  - pipe long test output through `tail` or `grep -E "FAIL|PASS$"`.

## 1. PROJECT

- **Stack:** React 19 + Vite + TypeScript + Tailwind v4; Phaser 3.90 for
  the cutting (the lazy `Preparation` chunk).
- **Screen:** portrait first, logical 540×960, `GameShell` contain-fits.
- **Content:** 150 campaign levels in 13 chapters (developer 2026-10-15;
  `levels/campaignSelection.ts`), Market, Inventory, Restaurant (Economy V3),
  Achievements, story.
- **Money:** one wallet in USD cents (`SaveData.credits`); every movement
  goes in `SaveData.economyLedger`.
- **Reference-only folders** (not in the build): `Knifecraft vegetables/`,
  `Knifecraft Phase 1 review/`, `Shop UI/`, `knifecraft_kitchen_webp/`,
  `Market.png`, `*.docx`, the root `*.md` audits, `art-source/` (source art).
- **Playgama assets:** `playgama/covers/` (`source/`, `upload/`) and
  `playgama/screenshots/`.

## 2. PLATFORM: PLAYGAMA BRIDGE (v2)

- **Loading:** the Bridge script loads from Playgama's CDN in `index.html`,
  before the bundle; `public/playgama-bridge-config.json` sits beside it.
- **One file:** `src/game/PlayablesSDK.ts` is the ONLY file that touches
  `window.bridge`.
  - `bridge.initialize()` resolves before any other call.
  - `game_ready` is sent once.
- **Saves:** through Bridge storage, key `knifecraft_save`. Plain
  localStorage only when there is no Bridge.
- **Interstitials:** only at natural breaks, via
  `src/game/ads/interstitialPolicy.ts`. None before 3 completed levels, then
  ≥ 150 s apart.
- **Rewarded ads:** Replay Bonus, Rush Restock, the Pre-Service Check
  covers and the day's Cleaner (`day_cleaner`, developer 2026-10-17),
  granted only on the `rewarded` state. One placement per spot
  (`AD_PLACEMENT`).
- **Level messages:** `level_started/completed/paused/resumed` with
  `{ world, level }`; no `level_failed`.
- **Never publish a build in which Playgama did not detect the SDK.**
- English only.

## 3. PLAYGAMA DEPLOYMENT (MCP)

- MCP server `playgama-developer-cabinet` (authenticate via `/mcp`; never
  ask for the password). Game KnifeCraft, applicationId
  `cmuiim0sh1qcalc0hiuw6xwlp`.
- `get_launch_steps` first, and again after each step.
- **Upload:**
  1. zip `dist/` with `index.html` at the root;
  2. `start_archive_upload`, named with the version
     (`knifecraft-playgama-1.0.1`);
  3. PUT the zip;
  4. `confirm_archive_upload`;
  5. poll `get_archive_status` until DONE.
- On PROBLEM / NOT_CHECKED, tell the developer `state.message` word for
  word. `bridgeSdk` must be FOUND.
- `publish_sandbox` / `start_sandbox_traffic`: **always ask first.**
- Use the links the tools return and never build URLs (QA Tool links via
  `get_archive_qa_tool_link`). A human submits moderation.

## 4. BUILD, PREFLIGHT, RELEASE

```
npm ci; npm run dev; npm run build          # dist/ = the restaurant game
VITE_RESTAURANT_MODE=0 npx vite build --outDir <dir>   # classic game
npm run preflight; npx vite preview         # :4173 for browser tests
```

Release zip: the CONTENTS of `dist/` →
`releases/KnifeCraft-Playgama-v<version>.zip` (gitignored), with
`index.html` and `playgama-bridge-config.json` at the zip root.

## 5. QA AND GATES

**Gates for any change:**
- TypeScript: `npx tsc --noEmit -p .`
- ESLint on `src scripts tools`: 0 errors (6 old warnings in
  `src/components/ui`).
- Prettier on the files you change only.
- Build and preflight.
- The QA suites the change touches, and a browser check.

**Running tests:**
- QA suites: `npx tsx scripts/<name>.mts`. Every suite at once:
  `for f in scripts/*-qa.mts; do npx tsx $f; done`.
- **Which suite covers what:** REFERENCE §5 (the suite index, then each
  suite).
- Browser tests: `tools/e2e/` (headless Chrome, see its README).
  Restaurant tests run on the normal build, classic ones on a
  `VITE_RESTAURANT_MODE=0` build.
- `economy-v2-final-qa` is the frozen baseline; some suites use `git diff`,
  so run them in this repo.
- Known pre-existing failures: `restaurant-takeaway-qa` U1/U2 (thali containers unused in the 150-level campaign — a design decision, HANDOFF).

## 6. ARCHITECTURE — PRESERVE AND REUSE

- **Core systems:**
  - React app, Phaser, `GameBridge`, `PreparationScene`, `events.ts`,
    `SaveManager`;
  - the Ingredient registry and the Recipe system (`campaignRecipes.ts`,
    `RecipeComponent`, `RecipeValidator`), `OrganizationManager`,
    `PreparedOutput`;
  - `OrderGenerator`, `CustomerOrderManager`, `ServiceManager`,
    `EconomySettlement`, `EconomyLedger`;
  - the equipment / staff / supplier / campaign systems;
  - `StoryManager` + `StoryOverlay`;
  - the UI primitives (`kc/common/primitives.tsx`, `Meters.tsx`) and the
    routing (`ScreensRouter.tsx`, `ScreenId`).
- **Single sources of truth, never duplicated:**

  | What | Source |
  |---|---|
  | Ingredient quantities | Business Inventory |
  | Ingredient definitions | Ingredient Registry |
  | Recipes | Recipe System |
  | Wallet | `credits` |
  | Money movements | `EconomyLedger` |
  | Preparation | `PreparationScene` |
  | Events | `events.ts` |
  | Platform | `PlayablesSDK.ts` |
  | Persistence | `SaveManager` |

## 7. ECONOMY RULES (figures: REFERENCE §7)

- **Frozen campaign baseline (150 levels, recorded 2026-10-17 on the
  developer's approval):** Revenue 69,110 · Completion 46,585 · COGS 16,092
  · Quality 1,402 · Net 101,005 (`economy-v2-campaign-simulation`; the
  250-level figures were 165,140 / 77,581 / 37,620 / 3,315 / 208,416). Pay follows each
  level's `cuisineChapter` (`payChapterOf`). An unexplained change is still
  a regression.
- **Level rewards:** `levels/levelRewards.ts` `paidLevelReward` is the ONE
  rule: one rising curve by the new level number, `50 + 3.1 × (n − 1)`
  dollars (L2 practice $0, L150 keeps $5,000).
- **Achievement money** (developer 2026-10-16,
  `progression/achievements.ts`): the old milestones are achievements under
  their own ids, plus new reward tiers. Each pays once, only when the player
  taps Collect in Progress → Achievements (one `milestone-reward` ledger
  entry; claims in `economy.claimedMilestoneIds`). Only the $50,000 Family
  Legacy at L150 pays by itself.
- **Restaurant target:** the completionist ends L150 with $100k–$150k (sim
  ~$132k with achievements collected). Check with
  `restaurant-final-economy-qa` and `achievement-rewards-qa` after any
  economy change.
- **Where things happen:**
  - the Market is the ONLY place to buy ingredients and supplies;
  - Business → Equipment is the ONLY place for fridge upgrades and repairs;
  - **Inventory is read-only** (it only shows the saved inventory). The
    one exception is Throw Out Expired (`business/discardExpired.ts`, no
    money, no ledger).
- **Wallet** (`economy/wallet.ts`):
  - whole cents, never < 0; every expense is all-or-nothing;
  - no bankruptcy or soft-lock;
  - Grandma never lends from Level 10. A short service is covered by a
    rewarded ad, or with no ad by supplier credit repaid from the next
    earnings (`restaurant/serviceCover.ts`, `supplierCredit.ts`).
- **Ledger:** exactly ONE entry per real wallet movement, none for a
  failed one; opening cash + signed ledger = closing cash.
- **Business Mode (V3)** lives in `SaveData.business`; extend it. Never add
  another top-level save field, save file, wallet, ledger, registry, engine
  or event bus. The campaign never requires a Business system.
- **Determinism:** no uncontrolled `Math.random()` for money, prices,
  events, spoilage, popularity, demand or inspections; use the seeded
  generator.
- **Saves:** keep old saves working (missing fields, old shapes, legacy
  keys); never drop known fields; migrate with the nested pattern in
  `SaveManager`.
- **Second Floor income** (`restaurant/secondFloor.ts`) is real time, capped, and
  collected with one ledger entry. It is extra on top of the campaign economy.
- **Menu price cap:** a dish sells for at most 1.5 × its suggested price
  (`menuPriceCap`; old saves read at the cap).
- **Never negative:** credits, inventory, capacity, menu price, equipment
  condition, popularity.

## 8. NEVER CHEAT THE TESTS

- **Never:**
  - delete a failing test, weaken an assertion, or change expected values
    to make a test pass;
  - skip a suite without documenting why;
  - hide console errors;
  - bypass the ledger, SaveManager, wallet or PlayablesSDK;
  - fake success, or claim a test or simulation that didn't run.
- When the developer changes a rule, update the tests to the new rule and
  say so in the commit.
- Document stale tests; never remove them silently.

## 9. STORY, CLIPS, COACHING, KNIVES (details: REFERENCE §9)

- **Story save:** `SaveData.story = { introDone, milestoneMask, finaleSeen }`
  — no new fields.
  - The intro's finish and SKIP › share one completion path; the finale's
    last button ends on the Kitchen.
  - The FINALE (frozen copy) plays at L75; THE LAST PAGE plays at L150
    (mask bit 2048).
- **Clips:** the only bundled videos are the six cooking clips
  (`CookingClip.tsx`). A tap can't skip the plating in its first 1.2 s.
- **Coaching** (`src/game/coaching.ts`): only on the first play of a level
  that teaches the technique. It never commits a cut or touches scoring.
- **Knives:** every knife is drawn by `scenes/knifeProfile.ts`. The cut
  rules are in `docs/KNIFE_RULES.md`.
- **Audio:** synthesized only (`AudioManager.ts`, seeded music); no Page
  Visibility API (preflight).

## 10. UI

- Use the existing primitives and look: warm painted kitchens, wood and
  paper, Fraunces / Nunito / Caveat bundled locally.
- Touch targets ≥ 48 px.
- **Short game copy** (developer 2026-10-16): a few words, icons and numbers
  (`StatChip`, `Points`). Any longer explanation goes behind an ⓘ
  (`InfoTip`, `kc/common/InfoTip.tsx`); `ui-copy-qa` guards it.
- Test at 320×568, 360×640, 390×844, 430×900 and 768×1024, with no
  sideways scroll.
- No animation libraries or large assets (prefer CSS transform/opacity).
- No external fonts, video or network requests at runtime; the only one
  allowed is the Bridge CDN script.
- **Text sizes:**
  - descriptions and secondary lines 12–14.5 px;
  - badges 11 px;
  - nothing below 8.5 px;
  - Caveat lines 13–17 px;
  - headings unchanged.
