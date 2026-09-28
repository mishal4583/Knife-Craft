# KNIFECRAFT — PLAYGAMA EDITION — CLAUDE PROJECT INSTRUCTIONS

## 0. READ FIRST

This repository (`D:\WORKS\GAMES\Playgama\KnifeCraft`) is now the **primary
KnifeCraft codebase**. The game ships through **Playgama**, which distributes
it to its own catalog and to partner platforms (CrazyGames, Yandex, MSN,
GameDistribution, YouTube Playables, TikTok, …). We do **not** deploy
directly to YouTube Playables any more.

The old repository `D:\WORKS\GAMES\Knife Craft` (the YouTube Playables build,
GitHub `mishal4583/Knife-Craft`) is retired. Do not edit it; do not push this
repo to its GitHub remote. Its history is included here (branch `main` starts
from its last commit `1af591f`; the ref `youtube-original/main` points to it).

Before starting work, read:

- `docs/HANDOFF.md` — where the project stands, what was done in the previous
  sessions, the Playgama cabinet state, open issues and next steps.
- `docs/playgama/` — Playgama requirements and Bridge SDK docs.
- `docs/ECONOMY_V3_MASTER_SPEC.md` / `docs/ECONOMY_V3_EXECUTION_PROTOCOL.md`
  only when a task touches the economy.

This is an existing production game. Do not rewrite the architecture, do not
create a second engine, and do not duplicate existing systems.

---

## 1. PROJECT

- React 19 + Vite + TypeScript + Tailwind v4, Phaser 3.90 for the cutting
  gameplay (lazy-loaded `Preparation` chunk).
- Portrait-first (9:16 logical 540×960, `GameShell` contain-fits it).
- 250 campaign levels (25 chapters), Market (knives, boards, staff,
  suppliers, ingredients, Blacksmith), Restaurant Progress, Business Mode
  (Economy V3), opening story + milestones + finale.
- One wallet in **USD cents** (`SaveData.credits`), every movement in
  `SaveData.economyLedger`.

---

## 2. PLATFORM: PLAYGAMA BRIDGE (v2)

- The Bridge script is loaded from Playgama's CDN in `index.html`
  (`https://bridge.playgama.com/v2/stable/playgama-bridge.js`) before the
  game bundle. `public/playgama-bridge-config.json` sits next to
  `index.html` (interstitial/rewarded placement fallbacks, 60 s minimum
  between interstitials).
- `src/game/PlayablesSDK.ts` is the **only** file that touches
  `window.bridge`. Everything else calls its exports (`platformReady`,
  `startPlatform`, `gameReady`, pause/audio hooks, `loadCloudSave` /
  `saveCloudSave`, `requestInterstitialAd`, `requestRewardedAd`, …).
  The export names are kept from the YouTube build on purpose — callers did
  not change.
- `bridge.initialize()` must resolve before any other Bridge call
  (`platformReady()` awaits it). `game_ready` is sent once, when Level 1's
  scene is ready or the Kitchen mounts.
- Saves go through **Bridge storage** (key `knifecraft_save`), never
  `localStorage` directly (plain localStorage is only the fallback when no
  Bridge exists). Outside Playgama the Bridge runs a local "mock" platform
  whose storage is backed by localStorage.
- Ads: interstitials only at natural breaks through
  `src/game/ads/interstitialPolicy.ts` (none before 10 completed levels,
  1 per 3 transitions, 3-min cooldown); rewarded = the Replay Bonus
  (`src/game/ads/replayBonus.ts`), granted only when Bridge reports the
  `rewarded` state, committed through the ledger. Locally the mock platform
  reports ads as unsupported.
- The Bridge SDK is required for every build. **Never publish a build in
  which Playgama did not detect the SDK.**
- Language: English only (the game reads `platform.language` and stays EN).

---

## 3. PLAYGAMA DEPLOYMENT (MCP)

The Playgama Developer Cabinet MCP server is `playgama-developer-cabinet`
(`https://developer.playgama.com/api/mcp`, add with
`claude mcp add --transport http playgama-developer-cabinet https://developer.playgama.com/api/mcp`,
then authenticate via `/mcp`). Never ask for the developer's password.

- Game: **KnifeCraft**, applicationId `cmuiim0sh1qcalc0hiuw6xwlp`.
- Always start with `get_launch_steps` and re-read it after each step.
- New build: `npm run build` → zip `dist/` (index.html at the zip root,
  forward-slash paths) → `start_archive_upload` (name archives with the
  version, e.g. `knifecraft-playgama-1.0.1`) → PUT → `confirm_archive_upload`
  → poll `get_archive_status` until processing is DONE and `state` is
  resolved. On PROBLEM or NOT_CHECKED tell the developer `state.message`
  verbatim. `bridgeSdk` must be FOUND.
- `publish_sandbox` (public immediately, no moderation) and
  `start_sandbox_traffic` (spends budget) — **always ask the developer
  first.** Hand out links from the tool answers; never build URLs.
- QA Tool links: always request them with `get_archive_qa_tool_link`
  (never build them). Moderation submission is done by a human in the
  cabinet after certification in the QA Tool.
- Covers live in `playgama/covers/` (`source/` originals,
  `upload/` exact-size files: square 800×800, portrait 1080×1920,
  landscape 1920×1080).

---

## 4. BUILD, PREFLIGHT, RELEASE

```
npm ci                      # first time
npm run dev                 # dev server
npm run build               # -> dist/
npm run preflight           # local platform checks (Bridge script/config, sizes, no orientation lock, safe names)
npx vite preview            # serve dist/ on http://localhost:4173 for browser tests
```

Release zip: zip the **contents** of `dist/` (index.html at the root, no
spaces in names) into `releases/KnifeCraft-Playgama-v<version>.zip`
(`releases/` is gitignored). Verify the zip lists `index.html` at the root
and `playgama-bridge-config.json` beside it before uploading.

---

## 5. QA

Focused suites (`npx tsx scripts/<name>.mts`):

- `story-intro-qa` — intro pacing, Skip story, story save semantics.
- `playables-ads-qa` — Bridge ads (interstitial policy, rewarded Replay Bonus).
- `economy-v2-final-qa`, `economy-v2-qa`, `economy-v2-settlement-ledger-qa`
  — Economy V2 frozen baseline (some checks use `git diff`, so run them in
  this git repo).
- `campaign-integrity-qa`, `restaurant-progress-qa`, `business-ux-qa`,
  `progression-preview-qa`, `usd-currency-qa`, `phase7-2-smoke-test`,
  plus the other `scripts/*-qa.mts` / `business-*-qa.mts` suites.

Gates for any change: TypeScript (`npx tsc --noEmit -p .`), ESLint on
`src scripts tools` (0 errors; 6 pre-existing warnings in `src/components/ui`),
Prettier, build, preflight, the relevant QA, and a browser check.

Browser tests: `tools/e2e/` (headless Chrome via `puppeteer-core`; see
`tools/e2e/README.md`). Run `npm install` inside `tools/e2e` once.

Known pre-existing failures (document, do not "fix" by weakening):

- `playables-ads-qa` B12/B13 (Replay Bonus daily cap): the test pins
  `NOW` to 2026-09-26 while ledger entries carry the real `Date.now()`, so
  the check depends on the calendar date. Fix the test's clock, not the cap.

---

## 6. EXISTING CORE ARCHITECTURE — PRESERVE AND REUSE

React app, Phaser 3, `GameBridge`, `PreparationScene`, `events.ts`,
`SaveManager`, Ingredient registry, Recipe system (`campaignRecipes.ts`),
`RecipeComponent`, `OrganizationManager`, `PreparedOutput`,
`RecipeValidator`, `OrderGenerator`, `CustomerOrderManager`,
`ServiceManager`, `EconomySettlement`, `EconomyLedger`, equipment / staff /
supplier / campaign systems, `StoryManager` + `StoryOverlay`, existing UI
primitives (`src/components/kc/common/primitives.tsx`, `Meters.tsx`) and
routing (`ScreensRouter.tsx`, `ScreenId`).

Single sources of truth: ingredient quantities = Business Inventory;
ingredient definitions = Ingredient Registry; recipes = Recipe System;
wallet = `SaveData.credits`; money movements = `EconomyLedger`;
preparation = PreparationScene; events = `events.ts`; platform =
`PlayablesSDK.ts`; persistence = `SaveManager`. Do not duplicate any of them.

---

## 7. ECONOMY RULES

### Economy V2 is frozen

Locked Campaign baseline (enforced by `economy-v2-final-qa`):

- Revenue 165,140 · Completion Rewards 330,691 · COGS 37,620 ·
  Quality Bonus 3,315 · Honest Chef Net 461,526

Any unexplained change is a regression. Investigate; never just update the
expected values.

### Economy V3 (Business Mode)

All V3 phases (V3-1 … V3-16) shipped in the release candidate. V3 lives in
`SaveData.business` (`BusinessState`) — extend it; never add another
top-level save field, save file, wallet, ledger, registry, engine or event
bus. Campaign must never require any Business system (inventory,
refrigerator, perishability, pricing, contracts, supplier events, salaries,
equipment condition, inspections, fines, operating costs).

### Safety, determinism, ledger, migration

- Never allow credits < 0, inventory < 0, storage capacity < 0, negative
  menu price / equipment condition / popularity. No debt, no permanent
  bankruptcy, no economic soft-lock.
- Business Mode is deterministic: no uncontrolled `Math.random()` for
  prices, supplier events, spoilage, popularity, demand, inspections,
  failures or money — use the seeded generator.
- Every real wallet movement has exactly one ledger entry; failed
  transactions create none. Opening cash + signed ledger = closing cash.
- Preserve old saves (no `business` field, older V3 shapes, legacy
  settings keys). Never discard known fields; use the nested migration
  pattern in `SaveManager`.

---

## 8. NEVER CHEAT THE TESTS

Never delete a failing test, weaken an assertion, change expected values to
make a test pass, skip a regression suite without documenting why, suppress
or hide console errors, bypass the ledger / SaveManager / wallet /
PlayablesSDK, create fake success states, or claim a browser test or
simulation that did not happen. Pre-existing stale tests are documented,
not silently removed.

---

## 9. STORY SYSTEM (current state)

- Opening intro = `OPENING + FRESH + CHEF` in
  `src/game/story/storyDefinitions.ts`: 14 beats, 21.5 s of timed beats
  (7.6 / 6.0 / 7.9 s) + the OPEN THE RESTAURANT and READY buttons
  (re-paced from the original 38.7 s / 13 beats).
- `StoryOverlay` (`src/components/kc/story/StoryOverlay.tsx`): per-beat
  advancing (a timer and a tap, or two taps, move one beat), taps ignored
  for 250 ms after a beat appears, button beats only advance via their
  button, CSS-only transitions (`kc-story-*` in `styles.css`) with a
  `prefers-reduced-motion` fallback.
- **Skip story →** (top-right, 48 px) exists only on the opening intro.
  Finishing and skipping share one completion path
  (`StoryOverlay.finish` → `App.completeIntro`) that sets only
  `story.introDone = true`, once.
- Milestones (Level 10/20/45/70/110/120/250) and the Level-100 finale are
  unchanged. `SaveData.story = { introDone, milestoneMask, finaleSeen }` —
  no new fields.
- Intro screenshots: `playgama/screenshots/intro/`.

---

## 10. UI

Use the existing KnifeCraft UI primitives and visual identity (warm
painted kitchens, wood/paper, Fraunces / Nunito / Caveat bundled locally).
Touch targets ≥ 48 px. Test at 320×568, 360×640, 390×844, 430×900,
768×1024. Do not add animation libraries or large assets; prefer CSS
transform/opacity. No external fonts, video or network requests at runtime
(only the Bridge CDN script).

---

## 11. REPOSITORY LAYOUT (additions for Playgama)

```
playgama/covers/source/        original cover art (Poster, Icon, Landscape, portrait crop)
playgama/covers/upload/        exact-size files uploaded to the Playgama form
playgama/screenshots/intro/    the 14 intro screens + Level 1 after the intro
docs/HANDOFF.md                project status and history for new sessions
docs/playgama/                 Playgama requirements + Bridge SDK docs (reference)
tools/e2e/                     headless-Chrome checks (Bridge-aware harness)
releases/                      built zips (gitignored)
public/playgama-bridge-config.json
```

Reference-only folders carried from the original repo (not part of the
build): `Knifecraft vegetables/`, `Knifecraft Phase 1 review/`, `Shop UI/`,
`knifecraft_kitchen_webp/`, `Market.png`, `*.docx`, `*.md` audits.
`.github/workflows/deploy.yml` is the old GitHub Pages workflow of the
retired repo; it does nothing here unless this repo gets a GitHub remote.
