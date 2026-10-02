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
- Ads (Playgama monetization guide + Bridge docs): interstitials only at
  natural breaks through `src/game/ads/interstitialPolicy.ts` — none before
  3 completed levels, then any natural break once 150 s (the guide's
  120–240 s) have passed since the last ad of any kind; the config's
  `minimumDelayBetweenInterstitial` is 120. Rewarded = the Replay Bonus
  (`src/game/ads/replayBonus.ts`) and Business Rush Restock, granted only
  when Bridge reports the `rewarded` state. One placement per ad spot
  (`AD_PLACEMENT`, listed in the config): `level_completed`,
  `business_day_end`, `replay_bonus`, `rush_restock`. Locally the mock
  platform reports ads as unsupported.
- Level messages: `level_started` / `level_completed` (App play sessions
  and Business orders) and `level_paused` / `level_resumed` (in-game pause
  menu), with `{ world, level }` (world = `chapter-N`, `todays-special`,
  `endless` or `business`). No `level_failed`: the game has no fail state.
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
- `economy-v25-qa` (+ `economy-v25-simulation`) — V2.5 final-wealth target,
  wallet safety, milestone/Family Legacy once-only, recurring caps, $0
  recovery, 365-day Business runs.
- `economy-final-qa` — the final rebalance + save migration: reward scaling
  (A), affordability (B), no negative money (C), kitchen migration (D),
  milestone migration (E), migration idempotence (F), Level 250 (G),
  Endless unlock (H), Progress/historical accounting (I, J) and the
  four-profile simulation table (K: Normal, Completionist, Aggressive
  Spender, Existing Save).
- `coaching-qa` — beginner coaching: every technique has a how-to card,
  Levels 1–5 teach everything, each later technique is taught only in the
  level that introduces it, the stuck rule (back only with no progress),
  first play only (no replay/Today's Special/Endless/Service/Business),
  the one-line hint only to Level 10, and the ghost never touches
  cut/peel/score state.
- `inventory-market-qa` — the Market/Inventory split (checks 1–16: no buy
  controls in Business, purchase maths, fridge, low stock, expiry,
  purchasing/consumption analytics, supplier modifiers, contracts, funds,
  fridge full, 57 ingredients, 48 dishes, Business-only recipe, old saves).
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

### Economy V2 is frozen (with the approved V2.5 completion-reward change)

Locked Campaign baseline (enforced by `economy-v2-final-qa`):

- Revenue 165,140 · Completion Rewards 77,581 · COGS 37,620 ·
  Quality Bonus 3,315 · Honest Chef Net 208,416

(Completion Rewards were 330,691 and the net 461,526 before Economy V2.5;
that one line changed by the approved rebalance below. Nothing else moved.)
Any unexplained change is a regression. Investigate; never just update the
expected values.

### Economy V2.5 — Final Wealth (approved rebalance)

Goal: a completionist finishes Level 250 owning everything with
$100k–$150k left (simulated: **$111,405** with occasional Business days;
$109,534 campaign-only). `scripts/economy-v25-simulation.mts`,
`scripts/economy-v25-qa.mts` and `scripts/economy-final-qa.mts` prove it
with the real functions.

- **Level rewards** — `levels/levelRewards.ts` `paidLevelReward(level)` is
  the ONE rule for what a level pays (stored `reward.coins` untouched):
  100% L1–20, 90% 21–40, 75% 41–60, 60% 61–80, 50% 81–100, 40% 101–120,
  30% 121–160, 20% 161–200, 15% 201–249, 100% L250. Payout, Kitchen/Journal/
  Preparation displays, Progress, Endless and the Replay Bonus all use it.
- **Restaurant Development** — kitchen tiers are bought, in order, once
  their level is reached: Growing $20k (L21), Established $25k (L41),
  Neighborhood Café $25k (L51), Flourishing $30k (L71), Grand $35k (L91)
  = $135k (`KitchenUpgradeManager.purchaseKitchenUpgrade`, ledger
  `kitchen-investment-purchase`, Kitchen Upgrade screen). Save version 3:
  older saves keep every tier their level had earned
  (`migrateKitchenDevelopment`).
- **Milestone rewards** — the 22 Progress milestones each pay once
  (`progression/milestoneRewards.ts`, $38,200) and Level 250 pays the
  **Final Reward (Family Legacy) $50,000**, unscaled. "Completed" is
  derived from the save; "claimed" is `SaveData.economy.claimedMilestoneIds`
  (plus the never-trimmed `milestone-reward` / `family-legacy` ledger
  entries). Only reached AND unclaimed milestones pay, on every `persist`
  and on load.
- **Economy migration** — `SaveData.economy` (`economy/economyState.ts`,
  `version` = ECONOMY_VERSION 1). A save without it predates V2.5 and is
  migrated ONCE in `SaveManager.load` (`progression/economyMigration.ts`,
  written back immediately; idempotent): balance, items, kitchens and
  Business untouched; milestones it had already reached are claimed
  WITHOUT payment (`waivedMilestoneIds` — no retroactive ~$85k windfall);
  lifetime totals are reconstructed from what the save records.
- **Historical accounting** — `economy.lifetime` is the exact running
  total of every ledger category (updated by `appendLedgerEntry`, never
  trimmed). Progress's "Level rewards earned" / "Invested in your
  restaurant" / milestone figures read it — never today's rates. An old
  save's level rewards = the stored rewards it was paid in full; its free
  kitchens count $0. The reward-curve chart is the one current-rate
  figure and is labelled so.
- **Endless Service** — unlocks after Level 250 (`isEndlessUnlocked`);
  pays each service level's `paidLevelReward`, capped $600/day.
- **Business scale** — inspection fines $55 / $105 (Chicago schedule ÷5);
  staff paid for a 2-hour service shift (cleaner 1.5 h). Ingredient prices
  are per ingredient (`business/businessPricing.ts`, ~65% of 2026 U.S.
  retail, e.g. potato $0.60/lb, tomato $1.00, salmon $6.50, ribeye $9.50);
  menu prices follow at 30% food cost. A no-staff Business nets ~$70/day;
  hiring staff is currently a net cost (their popularity/discount effects
  earn less than their wages).
- **Business menu = 48 dishes**, and every one of the 57 ingredients is used
  by at least one (enforced by `business-dish-catalog-qa` A4). 13 were added
  for that: 7 on existing "A" recipes, 5 on "B" campaign recipes re-graded
  to "A" as genuine dishes (beet & orange, sweet potato hash, peach &
  cheddar board, kiwi & watermelon, strawberry & grape), and **Ribeye with
  Herb Butter** on the one Business-only recipe
  (`BUSINESS_ONLY_RECIPES` in `campaignRecipes.ts`, found by
  `getCampaignRecipe`; kept out of `CAMPAIGN_RECIPES`, so the campaign stays
  frozen at 221 recipes with no butter). New "Dessert" category.
- **Market = procurement, Business = monitoring.** Business stock is bought
  ONLY in **Market → Ingredients** (`MarketIngredients.tsx`): all 57 in
  category groups, today's supplier event, contract and Prep Cook pricing
  through `purchaseQuote` (BusinessInventoryManager — the SAME verdict
  `purchaseIngredient` makes, on top of `todaysUnitCost`). Each card shows
  the wallet effect before the tap — "$1,332 → $1,327", from 25 units
  "You'll have $X remaining", "Not enough money — need $X more.", or "Not
  enough fridge space. You have N units of fridge space left."
  **Business → Inventory** (`BusinessInventory.tsx`, tab id `inventory`,
  route `business-inventory`) has NO purchase controls: fridge status,
  On hand (freshness, days left, Used in), Low stock (threshold = today's
  customer target × the active menu's need), Menu readiness + Most needed,
  Expiring soon, Inventory analytics, Purchasing, Most used. All figures
  come from `business/inventoryAnalytics.ts` over existing state; Most used
  is derived from "business-revenue" ledger entries (dish id × its
  requirements). The only purchase-related controls navigate to the Market
  (`openMarketIngredients` in `kc/marketFocus.ts` → route
  `shop-ingredients`, optionally preselecting an ingredient). The daily
  accumulator's `inventoryPurchases` counts purchases (one per
  "inventory-purchase" ledger entry; old saves migrate it as 0).
- **Recurring caps** — Replay Bonus 20% of the paid reward, $10–$200,
  3/day; Endless $600/day; Today's Special $50/day.
- **Wallet invariant** — `economy/wallet.ts`: credits are whole cents and
  never < 0. Every expense is all-or-nothing (`debitWallet` or the
  manager's own balance guard); App `persist` and `SaveManager.save`
  refuse a wallet that breaks the invariant. No debt, no bankruptcy.

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

- Opening intro = the painted cinematic: `src/game/story/introCinematic.ts`
  (data: 7 scenes 1/2/3A/3B/3C/4/5, 13.6 s incl. a 0.8 s push into the
  tomato that fades into the already-running Level 1) played by
  `src/components/kc/story/CinematicIntro.tsx` (one rAF clock, taps step
  one line/scene, 250 ms tap guard, pause-aware, reduced-motion fallback).
- **SKIP ›** (top-right, 48 px, after 1 s) is the only early exit.
  Finishing and skipping share one completion path
  (`CinematicIntro.finish` → `App.completeIntro`) that sets only
  `story.introDone = true`, once. `StoryOverlay` still plays the finale.
- Milestones (Level 10/20/45/70/110/120/250) and the Level-100 finale are
  unchanged. `SaveData.story = { introDone, milestoneMask, finaleSeen }` —
  no new fields.
- Intro screenshots: `playgama/screenshots/intro/`.
- **Cooking clip** — after EVERY preparation, once the chef's hands have
  carried the plate away (RECIPE_COMPLETED) and before the Knife Report,
  `src/components/kc/game/CookingClip.tsx` plays one of five short chef
  films, each 540×960 WebM + MP4 (~0.25–0.65 MB) with a `-poster.webp`:
  **fruit-cup** (`chef-fruit.*`, 3.84 s, from `Fruit cups.mp4`: 2.13–4.46 s
  spooning → 6.50–8.00 s honey drizzle), **salad** (`chef-salad.*`, 2.97 s,
  from `Salads.mp4`), **plating** (`chef-plating.*`, 3.84 s, from
  `Plating.mp4`: 1.42–3.25 s tomato slices into a bowl → 8.0–10.0 s herbs
  and the pull-back over the plated counter), **curry-pot**
  (`chef-curry.*`, 3.67 s, from `Curry.mp4`: 2.04–3.96 s spoon stirring the
  curry → 6.04–7.79 s the chef over the big steaming pot) and
  **chef-cooking** (stove,
  `chef-cooking.*`, 3.75 s). `src/game/recipes/dishKind.ts` `dishKindFor(recipeId,
  name)` decides, in order: **fruit** (every ingredient a Fruit, or a
  Business Dessert — 11 recipes, Level 84); **salad** ("Salad"/"Slaw" in the
  dish/recipe name, or a Business Salad — 14 recipes, Level 10);
  **curry** (curry, masala, chutney, minestrone, velouté, soup, French
  onion, dal, stew in the name, or a Business Curry — 18 recipes,
  Levels 51–69, Level 58);
  **cooked** (a Protein ingredient, a cooking word in the name — stir-fry,
  wok, sauté, rings, gratin, bread, toast, bruschetta… — or a Business
  Stir-Fry/Entree — 103 recipes, Level 36);
  else **plated** (cut-and-plate dishes — 75 recipes incl. Levels 1–9). The clip
  buffers from PLATING_STARTED, is
  skippable (SKIP › or a tap, 300 ms guard), pauses with PauseManager,
  is muted unless `AudioManager.soundAllowed`, and falls straight through
  on error / stall / `prefers-reduced-motion`. All five sources carry the same
  AI watermark (centre 600,1160 of 720×1280), painted out with ffmpeg
  `delogo` (`x=562:y=1122:w=76:h=76`, then scale 540:960; H.264 crf 27 /
  VP9 crf 38), and the SKIP › pill sits over that spot. Source uploads:
  `gemini_generated_video_aa3f242a - Trim.mp4`, `Salads.mp4`, `Fruit cups.mp4`, `Plating.mp4`, `Curry.mp4` (on `main`).

- **Beginner coaching** (`src/game/coaching.ts`) — a ghost demonstration
  on the board plus a how-to card. PreparationScene draws it
  (`scenes/coachGhost.ts`, its own Graphics layer at depth 29) exactly where
  the next tap would really cut, using the same axis, slot and position rules
  as `resolveTapCut`:
  - cutting: the line glows, then a 3 s loop shows both ways to cut, each
    labelled by the fingertip. **SWIPE**: the fingertip draws along the
    line while a see-through copy of the equipped knife (the same
    `scenes/knifeProfile.ts` silhouette as the real knife) brings its
    glowing sharp edge down and slices through tip-first. **TAP**: the
    fingertip taps with a ripple and the knife chops straight down onto the
    line. The handle points towards the player (lower end, or left for a
    flat cut) and the spine away from the food;
  - Peel: a fingertip sweeps across the skin that's left (the peel grid row
    with the most skin);
  - Smash: a press with a ripple;
  - Rings: a tap plus the next ring glowing.
  The scene emits `EVT.COACH` → GameBridge `COACH` → Preparation shows
  `COACH_TEXT[technique]` (title, how, why; on cutting steps also
  `CUT_WAYS`: TAP / SWIPE rows with the same labels). The card is `pointer-events-none`.
  - **Only for beginners, only when needed:**
    - It runs only in a campaign level played for the FIRST time. App
      passes `coachLevelId` only then, so there's none on a replay, Today's
      Special, Endless, Restaurant Service or Business.
    - Only TAUGHT steps get it: every step of Levels 1–5, and each new
      technique in the one level that introduces it (dice 6, smash 9,
      rings 16, julienne 21, radial 23, rock-mince 34, chiffonade 35).
    - On such a step it plays 0.7 s after the step starts and hides on the
      first touch. It returns after 4 s idle only while the player has
      made NO progress on that step (stuck). After a cut or some peel it
      stays away.
    - Untaught steps never show it.
    - The plain one-line gesture hint shows only in Levels 1–10 on a first
      play (`showsBeginnerHint`).
  - It reads cut and peel state only and never commits, consumes a guide
    slot or affects scoring (`coaching-qa` F).
  - No save state: coaching is derived from the level.

- **Knives (look and size)** — every knife is drawn from ONE geometry and
  painter, `src/game/scenes/knifeProfile.ts`:
  - `knifeProfile`: blade outline, cutting edge and spine; a metal
    bolster; a tapered handle with its top in line with the spine, a palm
    swell and a rounded butt; rivets.
  - `paintKnife`: shadow, wood handle with grain and rivets, steel with a
    grind bevel, sheen, honed edge and spine.
  - It is used by the in-game knife (PreparationScene.drawKnife), the
    coaching ghost and the Market icon (`KnifeGlyph`, the same shapes as
    SVG).
  - Proportions follow the real knives (`knifeDefinitions.ts`, in 1/540 of
    the scene width): the chef's blade is about 1/5 as tall as it is long,
    with the handle a little over half the blade, and a negative
    `tipRiseFrac` lifts the point toward the spine.
  - The resting knife lies flat, centred under the ingredient: on the board
    below it, or on the counter in front of the board when there's no
    room — never across the food.

---

## 10. UI

Use the existing KnifeCraft UI primitives and visual identity (warm
painted kitchens, wood/paper, Fraunces / Nunito / Caveat bundled locally).
Touch targets ≥ 48 px. Test at 320×568, 360×640, 390×844, 430×900,
768×1024. Do not add animation libraries or large assets; prefer CSS
transform/opacity. No external fonts, video or network requests at runtime
(only the Bridge CDN script); the bundled videos are the five cooking clips (§9).

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
