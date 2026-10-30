# KNIFECRAFT — DETAILED REFERENCE

Moved out of `CLAUDE.md` on 2026-10-09 (developer: keep CLAUDE.md lean, lose
nothing). This is the full, detailed text the rules in `CLAUDE.md` point to:
every QA suite's scope and numbers, the economy history and figures, the
story / cooking clip / coaching / knife details. Read the section you need
when a task touches it; `CLAUDE.md` keeps the rules. Section numbers match
`CLAUDE.md`.

---

## Restaurant Map integration (isolated review branch, 2026-10-12)

The in-game map is the always-available Restaurant destination in the bottom
navigation. The existing Restaurant management destination is labeled
Business. The map uses existing `ScreenId` routes and existing room unlocks;
it does not add or alter campaign progression. `src/components/kc/restaurantMap/`
contains the React map, normalized hotspot configuration, and map-only types.
The six compressed illustrations live in `public/restaurant-map/` and are
selected from `SaveData.equippedKitchenUpgradeId`; the refrigerator overlay
reflects the existing refrigerator tier. Restaurant name edits are kept in
browser local storage by the map component so this integration does not
change save data.

The five bottom destinations are Kitchen, Inventory, Market, Business, and
Restaurant (map). Progress remains reachable from the Kitchen home and the
Business overview. Map hotspots route to existing screens: Inventory,
Refrigerator, Staff, Kitchen, Market equipment, Market cleaning/packaging
supplies, Business management, Business service, Business cleanliness, and
Business menu. The map is available from the start; each room retains its
existing level lock. A contextual Map button returns from mapped destinations;
it is omitted during cutting gameplay.

This branch is an isolated local review. Follow its root `AGENTS.md`: leave
all changes uncommitted, do not run tests/build/server, and do not publish or
deploy. Older instructions elsewhere in this reference that direct work to
`main` do not apply to this explicitly scoped task.

---

## 0. READ FIRST

This repository (`D:\WORKS\GAMES\Playgama\KnifeCraft`) is now the **primary
KnifeCraft codebase**. The game ships through **Playgama**, which distributes
it to its own catalog and to partner platforms (CrazyGames, Yandex, MSN,
GameDistribution, YouTube Playables, TikTok, …). We do **not** deploy
directly to YouTube Playables any more.

**THE DEVELOPER SETS THE RULES (developer decision 2026-10-08).** The game
belongs to the developer; their instruction overrides anything in this file,
and this file is updated to match whenever they change a rule.

- The repository is GitHub **`mishal4583/Knife-Craft`, branch `main`**.
- Every change the developer asks for is committed and pushed **directly to
  `main`** (no branch, no pull request), after the gates below pass.
- Every push to `main` deploys **GitHub Pages**
  (`.github/workflows/deploy.yml`: `npm ci` → `npm run build` → Pages). That
  is the live test site; check the workflow run after each push.
- **The Unified Restaurant is ON in every build** (`RESTAURANT_MODE`, §5):
  Pages and Playgama zips play the restaurant. The classic game is only a
  `VITE_RESTAURANT_MODE=0` build.

The old YouTube Playables codebase's history is included here (branch `main`
starts from its last commit `1af591f`; the ref `youtube-original/main`
points to it).

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
- 250 campaign levels (25 chapters), Market (knives, boards, suppliers,
  ingredients, Blacksmith, supplies), Restaurant Progress, Business Mode
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
  (`src/game/ads/replayBonus.ts`), Business Rush Restock and the
  Pre-Service Check covers (missing stock / supplies, from L10 —
  `restaurant/serviceCover.ts`), granted only when Bridge reports the
  `rewarded` state. One placement per ad spot (`AD_PLACEMENT`, listed in
  the config): `level_completed`, `business_day_end`, `replay_bonus`,
  `rush_restock`, `service_stock`, `service_supplies`, `service_tools`,
  `day_cleaner`, and the five ad bonuses below (`floating_cash`, `level_bonus`,
  `shortfall_topup`, `floor_double`, `daily_gift`). Locally the mock platform
  reports ads as unsupported.
- Level messages: `level_started` / `level_completed` (App play sessions
  and Business orders) and `level_paused` / `level_resumed` (in-game pause
  menu), with `{ world, level }` (world = `chapter-N`, `todays-special`,
  `endless` or `business`). No `level_failed`: the game has no fail state.
- The Bridge SDK is required for every build. **Never publish a build in
  which Playgama did not detect the SDK.**
- Language: English only (the game reads `platform.language` and stays EN).
- Analytics (2026-10-18; Bridge `analytics.send`, 2.3.0+; Playgama telemetry
  guide 1.1): `sendAnalyticsEvent(name, data)` in `PlayablesSDK.ts` is the one
  way in; a Bridge without analytics is a silent no-op. Only events the game
  alone knows (Bridge already records `game_ready`, the level messages, ads,
  sessions and playtime). Every event carries `game_version`
  (`src/game/config/buildVersion.ts` `BUILD_VERSION`). The events:
  - `progression_started` / `progression_completed` / `progression_abandoned`
    with `{ world, step_index, duration_sec }`, sent beside the level
    messages (the platform's own level events carry no level, so these show
    WHERE players stop);
  - `intro_completed` `{ skipped }`;
  - `performance_sample` (`src/game/telemetry/performanceSample.ts`): on the
    cutting board, one aggregated sample per ~30 s of play (FPS average and
    p10, frame-time p50/p95/p99/max, frames over 50–1000 ms). Paused time
    (PauseManager) and frame gaps over 2 s (a hidden page) are excluded; no
    Page Visibility API. A window with under 5 s of play is dropped.
  - Names are stable snake_case with no digits; the changing values ride in
    the data; no personal data, text, URLs or ids. No external analytics.
  - Read them with the cabinet's telemetry tools (§3).
- A new player's Level 1 (under the intro) opens its play session when the
  intro closes, so it sends `level_started` / `level_completed` like every
  other level (before 2026-10-18 it sent neither).
- Ad bonuses (developer 2026-10-18, `src/game/ads/adBonuses.ts`): five optional
  rewarded-ad cash offers, each with its own placement, from Level 3, all through
  one sheet (`kc/ads/AdBonusSheet.tsx`: what it gives, 📺 Watch, No thanks; a tap
  in its first 600 ms is ignored):
  1. **Floating cash** (`floating_cash`, `kc/ads/FloatingCash.tsx`): a bag over the
     Kitchen's shelves, 60 s into the session then every 3 min, gone after 15 s;
     only when nothing else is on screen. 10% of the level's pay, $5–$50, 6 a day.
  2. **Level bonus** (`level_bonus`): after a first clear's Level Complete card,
     +50% of its reward (≤ $250), 3 a day. The interstitial comes first: the bonus
     is offered only at a break where the interstitial policy didn't show one
     (fix 2026-10-18: offered first, a declined bonus had cost every break its
     interstitial, since the cap counts claims).
  3. **Short by** (`shortfall_topup`, `kc/ads/ShortfallOffer.tsx`): under a "Not
     enough money" line (knives, boards, blacksmith, kitchen upgrades, Second
     Floor machines and team, kitchen helpers, ingredients, supplies) when the gap
     is ≤ 25% of the price and ≤ $150: the missing dollars, 2 a day. The player
     then buys it themselves.
  4. **Second Floor ×2** (`floor_double`): at the Pickup Counter, for $50+ waiting:
     collect, then the same again (extra ≤ $250), 2 a day.
  5. **Daily gift** (`daily_gift`): the first calm Kitchen or map of the day opens
     it once (from Level 3): Take the gift (10% of the level's pay, $20–$60; one
     `daily-reward` entry, works without ads) or 📺 take it twice; Later keeps it.
  - Money: one `rewarded-ad` ledger entry per bonus (description
    `knifecraft-adbonus-<kind>-<uuid>`); today's count per kind is read from those
    entries, so the caps survive reloads and ledger trims. The Replay Bonus counts
    only its own entries. Screens offer bonuses through `kc/ads/adBonusApi.ts`
    (context; without a provider nothing shows).
- Leaderboards: none yet (`sendScore` is a no-op); one needs a cabinet
  leaderboard and a config entry, both the developer's choice.

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
- Telemetry: `get_game_telemetry_analytics` (overview) first, then one
  event (`get_game_telemetry_event_analytics`) or a trend
  (`…_timeseries`); at most once a day, never in a loop. Under 30 sessions
  a conclusion is not reliable yet.
- Covers live in `playgama/covers/` (`source/` originals,
  `upload/` exact-size files: square 800×800, portrait 1080×1920,
  landscape 1920×1080).

---

## 4. BUILD, PREFLIGHT, RELEASE

```
npm ci                      # first time
npm run dev                 # dev server
npm run build               # -> dist/ (the restaurant game — RESTAURANT_MODE on)
VITE_RESTAURANT_MODE=0 npx vite build --outDir <dir>   # classic game (classic browser tests)
npm run preflight           # local platform checks (Bridge script/config, sizes, no orientation lock, safe names)
npx vite preview            # serve dist/ on http://localhost:4173 for browser tests
```

Release zip: zip the **contents** of `dist/` (index.html at the root, no
spaces in names) into `releases/KnifeCraft-Playgama-v<version>.zip`
(`releases/` is gitignored). Verify the zip lists `index.html` at the root
and `playgama-bridge-config.json` beside it before uploading. The
`<version>` is `BUILD_VERSION` (`src/game/config/buildVersion.ts`, sent as
`game_version` with every analytics event): raise it before building a new
release.

---

## 5. QA

### Suite index (moved from CLAUDE.md 2026-10-15)

QA suites: `npx tsx scripts/<name>.mts` (each one's full scope and
figures: `docs/REFERENCE.md` §5). Browser tests: `tools/e2e/` (headless
Chrome, `puppeteer-core`, see `tools/e2e/README.md`; `npm install` there
once). Restaurant browser tests run on the normal build, classic ones on a
`VITE_RESTAURANT_MODE=0` build.

- Prep Cook at the board and Auto service: `prep-cook-auto-qa` (browser: `prepcook.mjs`); his pay by the hour
  (no fee, full shift wage at each closing): `staff-hire-qa` H8/W1, `restaurant-half-wages-qa` H1–H3.
- Phase 2, customers on a clock: `service-flow-qa` (pace, schedule, queue, patience, the clock rule, sync, door,
  Auto), `order-pool-qa` (guests order from stock), `dish-heat-qa` (popular dishes cost more); browser:
  `queue.mjs` (slow, ~5 min), `dishheat.mjs`.
- The service loop (Phase 1): `service-loop-qa` (next service, Kitchen button, no level copy, unlock wording;
  browser: `openservice.mjs`).
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
  `restaurant-tools-qa`, `restaurant-tableware-qa`,
  `restaurant-takeaway-qa`, `restaurant-service-report-qa`,
  `restaurant-cleanliness-qa`, `cleaning-dirt-qa` (browser: `cleaningfeel.mjs`),
  `dish-washing-qa` (browser: `dishwashing.mjs`),
  `restaurant-day-clock-qa`,
  `restaurant-shift-chores-qa`, `restaurant-deliveries-qa`,
  `restaurant-par-audit-qa`, `restaurant-half-wages-qa`, `restaurant-second-floor-qa`,
  `restaurant-floor-life-qa`, `restaurant-menu-order-qa`, `restaurant-market-needs-qa` (browser: also
  `marketneeds.mjs`, `restaurantstafflife.mjs`,
  `restaurantmenu.mjs`, `marketsecondfloor.mjs`)
  `achievement-rewards-qa` (browser:
  `tools/e2e/restaurant*.mjs`).
- Campaign / UX: `story-intro-qa`, `story-pause-qa`, `story-legacy-qa`, `audio-qa`,
  `campaign-paid-orders-qa`, `level-ux-qa`, `coaching-qa`,
  `knife-stroke-qa`, `cut-rules-qa`, `lazy-load-qa`, `unused-assets-qa`,
  `playables-ads-qa`, `playgama-telemetry-qa`, `ad-bonuses-qa`.
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

Focused suites (`npx tsx scripts/<name>.mts`):

- `staff-hire-qa` + `tools/e2e/paidstaff.mjs` — EARLY GAME PHASE 4 (developer 2026-10-26: "I need
  everything to be unlocked at or before level 5" and "don't make any staff hire for free, let
  them pay for it"):
  - **Everything for sale by Level 5** (`config/earlyUnlocks.ts` `EARLY_UNLOCK_CAP` = 5,
    `earlyUnlock`): knives, boards, kitchen tiers, kitchen helpers, every staff role and
    specialist chef (`STAFF_HIRE_FROM`, `specialistOpensAt`), the Second Floor and all six
    stations (`SECOND_FLOOR_OPENS_AT` / `STATIONS_OPEN_AT`), every map room (the Dining Area
    was L31; the Restroom follows its Cleanliness tab, `CLEANING_FROM_LEVEL` 10) and the
    Progress section (`TAB_OPENS_AT.rack`, was L10). Prices and order unchanged. A pre-V2.5
    save's kitchen-tier grant keeps its old levels (`LEGACY_KITCHEN_GRANT_LEVEL`). A level's
    own knife/board "Unlocks" hint shows only while true (`liveUnlockReward`).
  - **Not moved:** the campaign's teaching stages (fridge, dine-in, staff requirements,
    cuisines, takeaway …, `RESTAURANT_SYSTEMS`), cleaning (L10), the tools requirement (L10),
    the menu dishes (by the cuts taught) and Endless (after L150).
  - **Paid hires** (`staffRequirements.ts` `hireRestaurantStaff`, `staffHireFee`): every role
    and specialist chef pays `HIRE_FEE_DAYS` (3) days of its full wage once, in whole dollars
    — Prep Cook $120, Line Cook $136, Head Chef $210, Server $113, Cleaner $84, Manager $180,
    each specialist $136 — with one "staff-purchase" entry; all-or-nothing; letting go refunds
    nothing; hiring again pays again. Wages unchanged (none before L29, half to L55, full
    from L56). A hire the next service REQUIRES that the wallet can't cover goes on supplier
    credit (owed, repaid from the next earnings), so a required hire never soft-locks. The
    classic Business Mode hire is unchanged (free).

- `story-intro-qa` — intro pacing, Skip story, story save semantics.
- `audio-qa` — the synthesized sound (W3): the ten named effects, the shared
  gate (platform audio, pause, ad, Sound off), music only after a
  gesture and with Music on, one loop, bounded nodes, seeded score, wiring.
- `story-legacy-qa` — the story for Levels 121–250 and THE LAST PAGE (§9):
  the approved text, a fresh 0 → 250 run (every beat once, in order), the
  catch-up rule (saves at 120/145/150/170/200/249), once-only after
  dismissal / reload / replay, saves already at 250, story-only changes, the
  App wiring.
- `campaign-paid-orders-qa` — a multi-order level (or batch group) saves
  each order it pays (`levelProgress.paidOrders`, `levels/paidOrders.ts`):
  a retry carries on from there, a level never pays more orders than it
  requires, completing it clears the entry, old saves load unchanged.
  Browser: `tools/e2e/paidorders.mjs` (Level 30: serve 1 of 2, leave,
  retry → 2 settlements, not 3).
- `restaurant-unlocks-qa` — Unified Restaurant foundations
  (`docs/RESTAURANT_INTEGRATION_AUDIT.md`): the ONE build switch
  `src/game/config/restaurantMode.ts` `RESTAURANT_MODE` (ON in every build
  since 2026-10-08, off only with `VITE_RESTAURANT_MODE=0` and in tsx QA
  scripts; no other restaurant flag; restaurant modules never read it), the system table
  `restaurant/restaurantProgression.ts` (developer teaching sequence
  2026-10-05: cooking fundamentals + the day L1, menu L11, ingredient stock
  L15, fridge L21, dine-in L31, staff L41, cuisines L51, takeaway L71,
  bigger restaurant L91, full management L121, established L161, master
  L201, Grand Service L241), and stock needs for every recipe
  (`restaurant/recipeRequirements.ts`, the rule Business dishes use too).
- `restaurant-stock-qa` — Unified Restaurant phases 3–4 (switch ON
  paths, tested as pure functions): rolled service tickets
  (`restaurant/serviceTickets.ts`, seeded per level, saved in
  `levelProgress.tickets`, dropped on completion, served in order by
  `createTicketedServiceSession`); campaign orders take their recipe's real
  stock from `business.inventory` on serve from Level 15
  (`restaurant/campaignStock.ts`), exactly once, never expired, never on a
  replay, with no money or ledger change (order pay unchanged — Economy
  TODO P0); the Pre-Service Check (`restaurant/preServiceCheck.ts`,
  `kc/restaurant/*`): need / usable / whole units at the Market's own
  price, wallet and fridge verdicts, Restock → the Market preset to that
  ingredient and quantity; when the wallet can't cover it (from L10) a
  rewarded ad or supplier credit (`restaurant-service-cover-qa`; was
  Grandma's pantry until 2026-10-10). Browser: `tools/e2e/restaurantstock.mjs`
  against the normal build (the restaurant is on by default; the browser
  tests marked "restaurant test build" below run on it, the classic ones on
  a `VITE_RESTAURANT_MODE=0` build).
- `restaurant-menu-qa` — the menu (`restaurant/restaurantProgression.ts`
  MENU_CURVE / MENU_UNLOCKS + `restaurantMenu.ts`), the developer's curve of
  2026-10-05: no menu in the L1–10 fundamentals; 4 dishes at L11, 6/8/10/12/
  15/18/21/25/29/33/36/39/42/45/48 at L15/20/25/31/41/51/61/71/81/91/101/
  111/121/141/161. At every point the menu has min(target, what the rules
  allow) and never runs ahead; it misses only at L20/25/31 (techniques) and
  L91/101/111 (meat L101, ribeye L106, fish L109) — no dish is invented.
  Each specialist cuisine opens with its campaign chapter (Indian 51,
  Mediterranean 71, Mexican 81 (since 2026-10-17 a cuisine opens no later
  than the campaign's first dish of it: Mexican and its chef at new L16, the
  Beetroot & Orange Plate; announced at L11), Japanese 101, Chinese 121, Thai 141,
  Korean 161; one Asian Chef for the four Asian chapters) and its first
  dishes arrive as soon as they legally can; every unlock says why
  (`MENU_UNLOCKS.why`, shown by `restaurant/restaurantNews.ts` with the
  L11 chain Menu → Customer Order → Inventory → Preparation → Service →
  Revenue); active menu (runs itself before L51, never empty, locked never
  orderable); level/recipe/dish data untouched.
  150-level re-plan (2026-10-17, `restaurantProgression.ts` MENU_UNLOCKS):
  the developer's dishes, in their scheduled order, are seated so that at
  every curve point (11:6 13:8 17:10 21:12 29:15 35:18 42:21 46:25 49:29
  56:33 59:36 68:39 76:42 88:45 101:48) the menu holds exactly min(target,
  dishes the rules allow) and never runs ahead between points. The rules
  (`dishLegalLevel`): every cut taught (first campaign cook), the cuisine
  open, chicken / steak / salmon from their introductions (L59 / L63 /
  L66), the ribeye with its butcher block (L63). Short points: L13 and
  L56–68. Moves from the plain remap: the Avocado & Corn and Beet & Orange
  salads to L17 (Mexican opens L16), the Carne Asada to L63 (steak), the
  Zucchini & Fennel Salad L21, and ten dishes one point later to make room.
  The suite numbers above are the 250-level ones; `restaurant-menu-qa`
  checks the 150-level ones.
  Early game phase 2 (developer 2026-10-25): `BUSINESS_MENU_FIRST_LEVEL` = 5
  (was 11) — the menu system, the Business tab, the map's office and service
  counter, and 1 menu guest per service open at L5 (the source curve's old L11
  point, which the floor of 11 had delayed). Curve points 5:4 9:6 13:8 …;
  Garlic Bread at L5 (chop is taught at L6), Caprese Salad, Mushroom
  Bruschetta and Garden Salad at L6, the skewers and tomato bruschetta at L9 —
  the same six dishes as the old L11 opening. From L11 the dishes, guests,
  systems and day are unchanged; their order moves (Garlic Bread first), so a
  seeded guest may order another dish at 28 of L11–150. Grandma's L5 tip
  points at the menu. `early-menu-qa` (old saves, no retroactive guests,
  the L5–10 dishes' cuts and stock, the baseline from L11);
  `tools/e2e/earlymenu.mjs` (L4 locked, L5 Menu at 320 / 390, a Garlic Bread
  guest pays once, Finish Level once).
- `restaurant-day-qa` — the restaurant day clock (`restaurant/restaurantDay.ts`):
  services per day (`DAY_SCHEDULE`, developer 2026-10-10): Lunch + Dinner to
  L20, + Breakfast from L21 (3), + Afternoon Tea from L51 (4), + Brunch from
  L101 (5), + Late Supper from L161 (6); opening card; services = first
  completions; Closing Time before the next level (chores, the day's count);
  before L21 only the day number moves, from L21 the freshness clock and
  spoilage, from L91 End Business Day exactly; old saves default to Day 1.
  Browser: `tools/e2e/restaurantday.mjs` (restaurant test build).
  The game map is `docs/GAME_MAP.md`.
- `restaurant-guide-qa` — the Restaurant Guide (`restaurant/restaurantGuide.ts`, `GuideCard.tsx`):
  pacing, done-means-gone, Later / 10-level reminders, `business.guideSeen` through the real
  SaveManager, wiring. See HANDOFF 2026-10-29.
- `night-sync-qa` — cleaning and the night chores from L5; the night covers the day's
  leftovers (`CLOSING_COVERS`), no morning restroom check, half tips after an undone-cleaning
  start (`tipHygieneShare`). See HANDOFF 2026-10-29.
- `closing-chores-qa` — the night chores are Cleanliness tasks
  (`restaurant/closingChores.ts`; developer 2026-10-23: "let the player do
  everything unless he hires a cleaner"; 2026-10-24: "why is it not
  connected with the cleanliness section just like opening or normal
  cleaning … add the same night chores also in the same cleanliness
  section"). The closing phase's own tasks (cleanliness.ts — new: wipe the
  boards and counters 🧽, throw out spoiled food 🗑️, wrap the fridge 🥡,
  reset the dining room 🍽️ from dine-in; with degrease, mop, disinfect, the
  condiments, the cutlery and the deep cleans) are given out when the day's
  last service ends, show in Restaurant → Cleanliness under their areas
  (tagged "🌙 Tonight") and on Closing Time (`closingRows`), and are cleaned
  the same way everywhere (`kc/restaurant/CleaningGame.tsx`,
  `useCleaningGame`: the scrubbing ones — the boards, the dining reset,
  degrease, mop, disinfect — in the cleaning game; the rest one tap). The
  Pre-Service Check's opening/lull checklist uses the same game. Closing
  Time adds the dishes (done when the sink is empty — the sink game; no soap
  → they wait for START) and counting the till (the owner's tap,
  `doClosingChore`, `business.restaurantDay.closingDone`). "Close for the
  night" reads "N chores left" until every row is done; a task short of a
  supply says what to buy and never holds the close. A row is ticked only for
  chores actually given out tonight (`choreKeys`). The team does its routine
  tasks when they arrive (`cleanerRound`: the Cleaner the boards, mop,
  degrease, disinfect; the Server the dining reset, condiments, cutlery; the
  Prep Cook the spoiled food and the wrap) and a Cleaner on duty washes the
  sink at closing (`cleanerClosing`) — the owner then only counts. The new
  tasks use no supplies (closeDay still draws the wipe-down's liquid and the
  wrap), so the economy is unchanged. Browser: every closing test does the
  rows with `doClosingChores` (harness: the cleaning game via
  `playCleaningGame`, the sink game, the taps).
- `restaurant-guests-qa` — phase D, orders from the ACTIVE MENU inside
  campaign services (`restaurant/menuGuests.ts`): after a level's own orders
  (unchanged, deterministic) the service can take menu guests (none before
  the menu opens; 1/2/3/4/5 from L11/21/51/121/201, `MENU_GUESTS_SCHEDULE`; 150 levels:
  1/2/4/5/6 from L5/16/35/76/117 since 2026-10-25), optional,
  one at a time ("🍽️ Menu guest n/N: dish · $price" next to Finish Level).
  At EVERY level 11–250 a guest orders only an unlocked, active dish; a dish
  switched off never appears; seeded per level; the count is saved
  (`levelProgress.menuGuests`) so no guest is paid twice; none on replays or
  batch groups; a guest pays the dish's menu price (`businessCustomerPayment`)
  with ONE "business-revenue" entry and uses real stock from L15
  (`App.serveMenuGuestOrder`). The Pre-Service Check lists today's guests
  and their extra stock as OPTIONAL rows (`guestStockFor`; never blocking,
  never opening the sheet; Inventory recommends them as "low") — K1–K4. `business-final-audit-qa` F2 and
  `business-wtp-qa` H2 name the two revenue writers (Business serve, menu
  guest). Browser: `tools/e2e/restaurantguests.mjs` (restaurant test build).
  Walk-ins (early game phase 3, developer 2026-10-25; `walkin-qa`, browser
  `tools/e2e/walkins.mjs`): from L5, after the menu guests, `WALK_IN_RULES.perService`
  (1) walk-in per service within the same team capacity (none at L16–28 with the chef
  alone; never a staff requirement). Same pipeline and count (`levelProgress.menuGuests`
  continues past the guests; no save field), own seed (`n × 7919 + 31`; the guests' picks
  unchanged). `walkInStock`: offered only when its dish fits beside the NEXT level's own
  orders (`reservedTicketsFor`); otherwise "🚶 Walk-in wants … — short of … (kept for your
  next order)", disabled. The Pre-Service Check's optional customer rows list it (🚶) with
  that reserve. Leaving the result finishes the level, so a refused walk-in is not kept for
  later; the next service brings its own.
- `restaurant-supplies-qa` — phase G, consumable supplies in a service
  (`restaurant/serviceSupplies.ts`, every number in `SERVICE_SUPPLY_RULES`):
  nothing before dine-in (L31); every order dine-in until L71, then a seeded
  ~30% takeaway. Dine-in: a clean place setting (plate + fork + knife,
  reusable → washing) and a napkin; takeaway: container + bag
  (`takePackagingForOrder`) + napkin; taken automatically on serve, never on
  a replay, never blocking there. Dish soap / cleaning liquid are gallon
  bottles (`business.restaurantSupplies` = open-bottle %, settings washing;
  sealed bottles = stock): soap per wash-up (after a service and at start),
  cleaning liquid per closing; "~N washes / closings remaining", low at
  ≤ 8 washes / ≤ 3 closings, empty. The
  Pre-Service Check's Supplies section: settings and packaging block,
  napkins and bottles warn; Restock → the Market line; when the wallet
  can't cover what blocks, a rewarded ad (cost 0, no money/ledger) or
  supplier credit (was Grandma's spares until 2026-10-10).
  Menu guests need a clean setting. No money moves when supplies are used.
  Browser: `tools/e2e/restaurantsupplies.mjs` (restaurant test build).
- `restaurant-progression-qa` — the developer's 2026-10-05 brief:
  staff requirements (`restaurant/staffRequirements.ts`, `STAFF_RULES`:
  Prep Cook L41 with ≥ 3 orders, Server L46 with ≥ 2 tables, Line Cook L61
  with ≥ 4 orders, Cleaner L91, Head Chef L121 with ≥ 3 specialist
  cuisines, Manager L161 with a team of ≥ 5; the specialist chef of every
  specialist cuisine on the active menu or in the tickets), announced 5
  levels ahead, shown with the reason in the Pre-Service Check, blocking
  START until hired (since 2026-10-26 a hire pays its fee — `staff-hire-qa`; a
  required hire the wallet can't cover goes on supplier credit, so no soft-lock); each specialist card
  shows its cuisine character (`chefs/chefDefinitions.ts`
  `specialistCharacter`: Chef Amara, Yusuf, Marisol, and Haruto for the
  Asian Chef — name, portrait, intro line behind ⓘ); specialist chefs in the
  optional `business.restaurantStaff`, hired on Restaurant → Staff, paid at
  closing from L91 (one "business-staff-salary" entry each, laid off if the
  wallet can't cover them; wage = the Line Cook's figure, not balanced);
  closing from L91 writes End Business Day's payroll and fine ledger
  entries (it used to move money without them); bulk buying
  (`restaurant/bulkBuying.ts`: presets 1/2/5/10, the cards show 5 and 10 as tiles since 2026-10-22 — developer 2026-10-17,
  sized to real buys: ≤ 2.25 lb an ingredient a service, ≤ 9 lb for 3 days,
  1–2 supply packs; was 5/25/50/100 — tiers 3/5/8 % from 5/10/25,
  lowered from 25/50/100 on 2026-10-17 so the 5 and 10 presets save; the last price layer, consumables only, up to 100
  supply packs, one ledger entry; the classic purchase is unchanged);
  Inventory's ⚠️ NEEDS ATTENTION (`restaurant/restaurantAttention.ts`,
  `RestaurantAttentionPanel`): the next service's missing ingredients and
  supplies with its recommended restock, napkins, dish soap, cleaning
  liquid, fridge and staff, urgent first, read-only, navigation only;
  fridge usage (`restaurant/fridgeUsage.ts`, nearly full at 85 %) in the
  check from L21; no separate Business Day before L250 and the Endless
  Restaurant after (`restaurant/endlessRestaurant.ts`; the Business tab is
  "Restaurant" in the test build). H (developer 2026-10-09, "doesn't show
  which staff to hire"): the check names the missing staff at its top
  (`psc-staff-needed`) and, when only staff is missing, its footer button
  hires them ("Hire Prep Cook & Server →"); Restaurant → Staff opens on the
  Restaurant Team with those roles marked "Needed now" (`kc/staffFocus.ts`),
  and before full operation (L91) every wage reads "Free now · $X/day from
  Lv 91" and the team "$0 a day until Level 91". Browser:
  `tools/e2e/restaurantprogression.mjs` (restaurant test build; 5c).
- `restaurant-migration-qa` — phase M (`restaurant/restaurantMigration.ts`):
  in the restaurant build `SaveManager.load` (and reset / a fresh save)
  moves every save into the unified restaurant ONCE, stamped in the
  optional `business.restaurantMigration`, and writes it back. Nothing is
  lost and no money or ledger moves. A save already past a system gets a
  one-time starter crate at cost 0, only topping up: the next 3 services'
  ingredients (never past the fridge) from L15; place settings for a
  service, napkins to 100, a bottle of dish soap and of cleaning liquid from
  L31; takeaway containers and bags (≥ 10) from L71. A fresh save is only
  stamped. The Pre-Service Check welcomes the player ("Welcome to your
  restaurant") until a service starts. Saves of every era load through the
  real `SaveManager.load`; the release build never migrates. Browser:
  `tools/e2e/restaurantmigration.mjs` (seeds an unstamped save; the other
  restaurant e2e tests seed `MOVED_IN_BUSINESS` so they get no crate).
- `restaurant-campaign-sim-qa` — phase N: the whole campaign, L1 → 250,
  through the real restaurant functions (the Pre-Service Check, buying,
  the pantry before L10, supplier credit from L10 (the sim shows no ads),
  free hiring, the wash-up, every order's stock + supplies +
  settlement, menu guests, completion, closing; every change through a
  mirror of `App.persist`) for three players — diligent, broke ($0 before
  every level) and an old save moving in at L120 — with invariants after
  every level: it could start, credits ≥ 0, opening cash + ledger = cash,
  no negative stock, fridge within capacity. Prints each player's money
  flows. Report: `docs/RESTAURANT_QA_REPORT.md`. Browser:
  `tools/e2e/restaurantwidths.mjs` (every restaurant screen at 320–768 px:
  no sideways scroll, buttons ≥ 48 px).
- `restaurant-economy-pass-qa` — the economy pass (restaurant build only):
  P0 (`restaurant/restaurantEconomy.ts`) — a campaign order pays recipe
  earnings + quality bonus, its food being the real stock bought in the
  Market (no built-in food cost; boosts to the quality bonus kept; the
  release settlement unchanged); measured with the full simulation
  (`scripts/restaurantCampaignSim.mts`), a completionist owns everything at
  L250 with $174,950 after the realistic portions of 2026-10-08 ($168,352
  before them; floor ≥ $150k, preferred $160k–$175k; $121,268 with the
  double charge);
  no soft-lock, cash = ledger. X: item effects on real stock (values
  unchanged): knife/board/helper savings and a dull knife's penalty scale
  the stock an order uses (`stockUseFor`; the Pre-Service Check plans
  exactly what the serve uses, a knife that dulls mid-service never
  blocks), the Campaign Supplier's ±10% sets Market ingredient prices
  (`supplierPriceFactor`, `restaurantQuote`; classic quote unchanged).
  Y: Premium supplier extras (developer 2026-10-06, PROVISIONAL —
  `SUPPLIER_EFFECTS`): its stock starts ageing 1 day later (recorded as
  bought a day on; age clamps at 0) and orders get +2 % of earnings as
  quality bonus; Local and Wholesale have none; the release purchase is
  unchanged.
- `restaurant-endless-qa` — the Endless Restaurant after L250
  (`restaurant/endlessDemand.ts`, `ENDLESS_DEMAND_RULES`): customers =
  min(demand: 8 × popularity × (1 + cookable dishes ÷ 8), a specialist
  dish only with its chef; capacity: chef + roles + specialists), only for a
  migrated restaurant save (classic Business demand unchanged); specialists
  paid at End Business Day. Five restaurants × 30 days from the L250
  completionist save through the real Business engine. Before the events
  (plain day): minimum $78/day, medium $135, full menu + thin staff $276,
  fully staffed $452, overstaffed −$262. The connected day (events, Today's
  Special's $50 once a day, stars; E2: $300–$600, E3: < $150): $132, $209,
  $344, $519, −$189; after the final economy pass (Today's Special 15 % of
  the day's revenue ≤ $50, from the new L250 save): $112, $208, $327, $518,
  −$187; with the realistic portions (2026-10-08: food ~10 % of the menu
  price instead of ~30 %) $151, $293, $436, $849, −$95, so the bands are
  now E2 $600–$900 and E3 minimal < $200, overstaffed < $0 (developer's
  call — see docs/HANDOFF.md); E7: events never lower customers, ≤ $50
  bonus and ≤ 3 stars a day. Cash = ledger, never < 0.
- `restaurant-backoffice-qa` — phase 7, one back office (restaurant
  build; `restaurant/restaurantBackOffice.ts`): the ingredient supplier
  (`selectedSupplierId`, Local / Wholesale / Premium) is chosen on
  Restaurant → Suppliers above the contracts, each card priced by the
  Market's own quote, free (no money, no ledger); the Market has no supplier
  tab there and its Ingredients names the supplier with "Change supplier →";
  Equipment shows restaurant development (kitchen tiers: current, built
  x / 5, next) read-only above the fridge, linking to Kitchen Upgrade; Staff
  is one screen in two teams — Kitchen Team (the one-time helpers) then
  Restaurant Team (waged roles + specialist chefs); the back office is
  titled "Restaurant". The
  release build keeps the Campaign Supplier tab and the "Business" title.
  Browser: `tools/e2e/restaurantbackoffice.mjs` (restaurant test build).
- `restaurant-endgame-qa` — the Endless Restaurant's events, standing and
  stars, CONNECTED (2026-10-06; restaurant build, Endless days only):
  `restaurant/restaurantEvents.ts` (Dinner Rush 20 % ×1.3 demand, Large
  Group 15 % +6, Today's Special every day — `RESTAURANT_EVENT_RULES`,
  provisional; deterministic per Business Day) applies only when
  `endlessEventsActive` (a unified-restaurant save past L250):
  `businessCustomersToday` = `demandWithEvents` (never below the plain
  demand, capped by capacity); the featured dish is weighted into the day's
  order pool (`featuredPool` / `endlessFeaturedFor`; 25 % weight, ~17 % of
  orders after the generator's variety rule); serving it is noted
  (`withTodaysSpecialServed`, optional `business.todaysSpecialServedDay`)
  and End Business Day pays 15 % of the day's restaurant revenue capped at
  the EXISTING $50 through the daily claim (`App.payTodaysSpecial`,
  `todaysSpecialBonus`: `hasClaimedToday` → `claimDaily`, one "daily-reward"
  entry, never twice a calendar day).
  Shown by `kc/business/EndlessDayEvents.tsx` on Restaurant → Overview and
  Service only (never during cutting). `restaurant/restaurantStanding.ts`:
  rank = café rank, stage = restaurant stage, Restaurant Complete at L250 →
  Endless, nothing reset — Restaurant Progress' "Restaurant standing" card
  (restaurant build; locked line "Complete all 250 campaign levels to unlock
  Endless Restaurant."). Endless stars 0–3 a day, status only, never money:
  PROFITABLE (the day's profit incl. specialist wages > 0), BUSY (no guest
  turned away: the day's DEMAND before the team's capacity —
  `businessCustomersToday().demand`, read before the day closes — served;
  final economy pass), CLEAN (the day's inspection not FAIL, with orders). Awarded by `App.advanceBusinessDay`
  (`recordEndlessDayStars`), shown on the day summary; lifetime
  `{total, days, bestDay}` in the optional `business.endlessStars` (absent
  = 0; never rolled off), the day's stars on its history record (optional
  `stars`). Browser: `tools/e2e/restaurantendless.mjs` (restaurant test
  build, 320–430 px).
- `restaurant-fridge-pressure-qa` — the fridge study (read-only, over the
  real simulations): the completionist and a diligent player through the
  campaign (L11/31/51/71/91/121/161/181/250) and two Endless restaurants;
  invariants only (no soft-lock, never over capacity but Grandma's goods).
  Findings and the decision in `docs/RESTAURANT_FRIDGE_PRESSURE.md`.
- `restaurant-final-economy-qa` — the FINAL ECONOMY PASS (2026-10-06,
  restaurant saves only — stamped by the restaurant migration; the release
  economy is untouched; `docs/ECONOMY_FINAL.md`): T the completionist (every
  item, all 250 levels, no Endless) ends L250 ≥ $150k — $174,950 Local,
  $175,173 Wholesale, $178,025 Premium with the realistic portions, ¼-lb
  buying and bulky items sold whole (2026-10-08; before: $168,348 /
  $169,027 / $171,582); T2 ≥ $160k with NO upper limit (developer
  2026-10-08: only the floor matters); saver $314,400 ($307,353); S no soft-lock, cash = ledger,
  never < 0, a prudent completionist (keeps $500 after every purchase,
  the next service's needs included) never needs Grandma; V every
  investment returns quality bonus; V3 whole-day stocking outgrows the
  Basic fridge by L250 (peak L91 28.7, L250 47.4 of 140 — bulky produce sold
  whole keeps the fridge in play; developer 2026-10-08, no capacity cuts);
  R the rules (`restaurant/restaurantInvestments.ts`
  `RESTAURANT_INVESTMENT_RULES`: kitchen tiers $16k/$20k/$21k/$24k/$29k =
  $110k with +1.5/3/4/5/7 % restaurant quality on campaign order earnings
  and +1/+1/+2 menu-guest seats from the Café/Flourishing/Grand; equipment
  quality ≤ 5 % by ownership — Blacksmith mastery 2 %, knife roll 1 %, board
  set 1 %, Prep/Kitchen Assistant 0.5 % each; `restaurantQualityBonusPct` =
  supplier + kitchen + equipment on the settlement's quality bonus only;
  `menuGuests.GUEST_CAPACITY_RULES`: guests = min(schedule + seats, chef 2 +
  1 per cook/server/Head Chef/specialist), staff requirements still read the
  schedule; Emergency Service retired 2026-10-10 (a covered service earns
  its full pay; an old save's `levelProgress.emergency` is ignored and
  dropped on completion); whole-day stocking (`preServiceCheck.dayStockFor`, the
  check's "Stock the whole day" card, Restock → the Market at the day's
  quantity); Today's Special 15 % ≤ $50; BUSY = demand); X release saves pay
  the catalog prices; W wiring; O old saves. Simulations:
  `scripts/economy-final-sim.mts` (seven players, checkpoint tables),
  `economy-final-candidates.mts` (the sweep), `economy-final-endless.mts`.
  Browser: `tools/e2e/restauranteconomy.mjs` (restaurant test build,
  320–430 px).
- `restaurant-measures-qa` — the developer's brief of 2026-10-08
  (restaurant build): M realistic portions (`business/ingredientMeasures.ts`
  — every one of the 57 ingredients has `pieceLb` (a tomato 0.3 lb: more
  than 3 to the lb) and a plate `serving`; `recipeRequirements` = one
  serving per PHYSICAL item prepared, `EconomySettlement.ingredientInstancesFor`,
  the cutting scene's chain rule; menu prices unchanged); U units
  (`business/measure.ts`: lb ↔ kg, "loaf"/"bunch", "0.6 lb", "≈ 3 tomatoes",
  the Market's smallest step — ¼ lb / ¼ kg for weighed goods
  (`marketStep`, `stepMarketQuantity` ¼ → 1 → 5; `purchaseIngredient`'s
  optional `step`, classic stays whole units), whole pieces for loaves and
  bunches, and BULKY PRODUCE SOLD WHOLE (`soldWhole`: an item of ≥ 1 lb —
  watermelon, pumpkin, pineapple, cabbage, cauliflower, coconut, lettuce,
  eggplant — one item of `pieceLb` per Market unit in lb or kg); K kilograms (Settings → Weights,
  the optional `settings.measure`, absent = lb, restaurant build only: the
  Market sells whole kg at the per-lb price × 2.20462, 1 kg = 2.205 lb of
  stock, 1.5 kg and a loaf by the kg refused; the Pre-Service Check's
  Restock counts kg; every screen shows the chosen measure through
  `setDisplayMeasure`, which App sets each render); Q Quick Restock
  (`restaurant/quickRestock.ts`: in the Pre-Service Check's "Missing" box,
  the check's Restock amount at the Market's own price for it +
  `RUSH_RESTOCK_FEE` 25 %, so always dearer than the Market (audit fix), the
  extra shown as a warning, all-or-nothing on money and fridge, one
  "inventory-purchase" entry per ingredient via `persistIngredientPurchases`);
  P the Market plan (`restaurant/marketPlan.ts`, `kc/MarketPlanPanel.tsx` at
  the top of Market → Ingredients: Today / 2 days / 3 days of services —
  today's still to come, then the day schedule; after L250 the Endless menu
  demand — tickets after paid orders + menu guests via `orderRequirements`,
  fridge stock first while fresh, nothing planned to spoil, today first,
  never more than the fridge's free space ("no room" for the rest); a Buy
  per line and "Buy all" (`App.purchaseIngredients`, one entry per line));
  A the audit fixes of 2026-10-08: the level's pay on the Kitchen card and
  Order Board (`restaurant/levelPayPreview.ts`: owed orders at `recipePay` +
  completion — "about +$363"), Order Board hints only on the level to play,
  the rank card one line at 320 px, supply restock "1 pack of 12"
  (`packsText`), "🛒 Buy everything in the Market →" (`openMarketPlan`: the
  Market's plan on Today with a hint), optional guest / whole-day sections
  folded, Grandma's first-shopping-trip guide until the first ingredient is
  bought (`restaurant/firstRestock.ts`, derived), the Restaurant Overview
  before L250 = the campaign day (`CampaignDayCard`; no Business Day,
  popularity forecast or "end the day"), Progress without Business
  popularity before L250 and "Kitchen upgrade" vs rank, Settings → Reduced
  motion (`settings.reducedMotion`, `.kc-reduced-motion` on <html>), a
  shorter Market banner on Ingredients with Plan ahead first;
  D the deep check of 2026-10-09: the Market plan puts the NEXT service's
  own orders first (`forNextService`; its fridge room is planned first and
  "Buy all" buys it first, so a tight wallet never spends on later services
  or optional guests instead), today's "no room" lines are told apart
  (`noRoomToday`: "make room or upgrade", not "after today's service");
  Quick Restock dates its stock like a Market purchase (Premium +1 day);
  the bulk tier is chosen by the STOCK bought (`ingredientBulkDiscount`:
  12 kg = 26.5 lb → 3 %, a whole melon counts by its weight; the presets show
  the same tier), so the lb/kg setting never changes the price per pound;
  the shortage cap reads in lb/kg ("Limited to 4.54 kg today"); Reduced
  motion (system or Settings) also calms panel entrances, the looping glows
  and the dust/steam (`.kc-ambient`);
  W wiring, plus the Kitchen's restaurant rank ("Restaurant rank · n/13",
  the café rank, next rank) and Prepare (sage) vs Replay (ghost). Browser:
  `tools/e2e/restaurantmeasures.mjs` (restaurant test build, 320–430 px).
- `restaurant-first-levels-qa` — the FIRST LEVELS, pass 1 (developer
  2026-10-09; `restaurant/firstLevels.ts`, restaurant build, presentation
  only): T the bottom-bar sections open at `TAB_OPENS_AT` (Inventory 3,
  Market 7, Progress 10, Restaurant 11; "opens at" = the highest unlocked
  level, as knives/boards read it; `NavLevelContext` from ScreensRouter feeds
  `BottomNav`); G Grandma's 15 Level Complete lines (`GRANDMA_LINES`,
  verbatim); D before L21 (`dayCeremonyAt` = fridge-freshness live) App's
  `quietDayEnd` runs the same `closeDay` at completion / next start (only the
  day turns; "☀️ Day N begins" on Level Complete) and a new day opens with no
  card (`servicePlanNeedsSheet` ignores `opening`, ServiceCheckLayer hides
  it); M Level 10's milestone (story bit 1) is `MilestoneBanner grand` with
  `firstPurchaseRows()` (catalog knives/boards at L10 + "your first menu at
  Level 11"), tap to dismiss; E Levels 1–15 rewards/order and the L10 knife
  and board prices unchanged; W wiring (Kitchen places + rank card wait for
  their level, the Market before L10 = Knives + Cutting Boards only,
  `FIRST_PURCHASE_LEVEL`). Browser: `tools/e2e/restaurantfirstlevels.mjs`.
  (restaurant-first-levels-qa) First-levels additions (2026-10-09): L `lockedScreenHint` / `App.go` refuse
  every screen of a closed section (shop-_, inventory-_, business-*, rack);
  `GRANDMA_TIPS` (Kitchen card, Levels 1–15, button only to an open section);
  `isTabNew` (NEW for a section's first two levels); W5 wiring. P Grandma's
  pointer (developer 2026-10-10, "a hand points towards the Market and says
  this is the Market"): `sectionToPoint(reached, business.sectionsSeen)` =
  the earliest section that is NEW and not seen; on the Kitchen only, with
  nothing else on screen (App's `navGuide` → `NavGuideContext` →
  `BottomNav`): the screen above the bar dims, Grandma's card
  (`SECTION_POINTER` title + line, Later / Show me →) and a bouncing 👇
  over the tab (`.kc-point-hand`, still under reduced motion); opening the
  section (any link, through `App.go`) or Later records it once in
  `business.sectionsSeen` (optional field; no money/stock). Since
  2026-10-10 every open section not seen yet, through Level 15
  (`POINTER_THROUGH_LEVEL`; was: only while NEW), one at a time; the hand
  is `common/PointerHand.tsx` (inline-SVG white glove tapping, with a
  ripple — `.kc-tap-hand`/`.kc-tap-ripple`), tilted so the tab's name
  shows; the Restaurant card reads "🍽️ Your Restaurant Business". Browser:
  `restaurantfirstlevels.mjs` 8a/8b/8c.
- MilestoneBanner (every Level Complete / milestone card): ✕ (48 px),
  auto-close (default 2.0 s; Level Complete with earnings 2.6 s, with
  Grandma's line 3.0 s, the Level 10 card 5 s); since 2026-10-10 a tap /
  click outside the card or any key closes it (after
  `OUTSIDE_TAP_GRACE_MS` 350 ms; the tap still goes through), and so does
  moving to another page (`page={screen}`). e2e `restaurantsupplies` 3d,
  `restaurantguests` 4c.
- `restaurant-tableware-qa` — TABLEWARE BY DISH (supplies plan Phase B,
  developer 2026-10-10). `serviceSupplies.coverPiecesFor(recipe, level,
cover)`: soups/curries a soup bowl + spoon; fruit a dessert plate + fork
  (cups a teaspoon); bread a side plate + knife; salads plate + fork; the
  rest plate, fork, knife (a steak knife for steak from L106); shared
  boards an extra side plate; every guest a water glass; from L121 a seeded
  25 % a highball glass (the bar), from L161 coffee/tea (cup & saucer) with
  every dessert and a seeded 30 %; messy dishes 2 napkins. All 17
  front-of-house items are used. Tables (`tablesFor`: 2 guests a table, max
  6, orders + menu guests): menu stand, 2 salt & pepper shakers, napkin
  holder from L31, water jug from L46 — durable, blocking. State
  `restaurantSupplies.dirty` per piece (an older save's `washing` =
  plates/forks/knives), `washedTotal`, `brokenTotal`; `washUp` washes every
  piece, soap = max(5 %, 0.25 % a piece) (`soapForPieces`), and breaks a
  seeded ~1 in 60 plates/glasses and 1 in 120 cutlery (they leave the
  stock; Level Complete says "🍽️ … broke in the wash-up"). The check:
  the orders' pieces block; the menu guests' pieces are optional rows
  (`guest`, never blocking or opening the sheet); `takeOrderSupplies(save,
service, {recipe, levelNumber, index})`; the guest gate
  `cleanSettingFor` (cover 100 + guests served). Inventory's "For service"
  explains it. The migration crate tops up a moving save's tableware by
  dish. Browser: `tools/e2e/restaurantsupplies.mjs`.
- `restaurant-deliveries-qa` — STANDING ORDERS & DELIVERIES (a real
  restaurant's day, plan F3, developer 2026-10-11; answer: standing orders +
  the Market). `restaurant/deliveries.ts`, state `business.deliveries`
  (clamped by `deliveriesOf`). From L21 two standing orders, switched on in
  Restaurant → Suppliers (`StandingOrdersCard`): FRESH (protein, herbs,
  dairy, bakery, fruit, vegetables) on every even restaurant day, for the
  next 2 days; WEEKLY (slow goods for 7 days + a week of cleaning supplies
  and a case of dish soap / cleaning liquid when a week's worth isn't in)
  on each week's first day. The order is worked out at closing from the
  Market plan (`marketPlanFor` — usable stock only, fridge room) and arrives
  with the morning: `afterNight` (Closing Time's close, the sim) places
  "day-kind" once and delivers each pending id once (`delivered` guard —
  a reload or a second tap changes nothing). Each line is an ordinary
  Market purchase (App.buyOn's price: bulk tier, supplier, freshness,
  lb/kg; supplies via `purchaseSupply`) with one ledger entry; a line the
  wallet or fridge can't take is skipped and listed. Closing Time shows
  tonight's order (`TonightsOrder`), the opening card what arrived
  (`MorningDeliveries`). The Market stays for instant buys; Inventory stays
  read-only. The sim's diligent player runs both orders (its prudent one
  keeps its $500 reserve: `afterNight(…, keep)`). Completionist $185,318.
  Browser: `tools/e2e/restaurantdeliveries.mjs`.
- `restaurant-half-wages-qa` — ECONOMY F2 + F3 (developer 2026-10-12): from
  L41 until full operation each hired waged role is paid half its daily wage
  at closing (`staffRequirements.payHalfWages`, one `business-staff-salary`
  entry per role; skipped that day when the wallet can't cover it, staff
  stay); +1 menu guest per service from L51 (4 / 5 / 6 at 51 / 121 / 201).
  Completionist $185,172 → $187,057; the Staff screen says "half pay".
  150-level numbers (re-baselined 2026-10-17): half wages from L29 (the
  Prep Cook; `HALF_WAGES_FROM` had stayed at the raw 41) to L55, full
  operation L56; menu guests 1 / 2 / 4 / 5 / 6 from L5 (L11 until 2026-10-25) / 16 / 35 / 76 / 117. The Staff screen's "½ pay from Lv … · full pay from Lv …" reads the
  constants (it said Lv 41 / 91).
  With it, the tables' pieces (`serviceSuppliesCheck`): only the orders' own
  tables block START; the extra tables the menu guests need are a
  non-blocking "for menu guests" warning (menu guests are optional) — so an
  existing L51+ save never gets stuck on the extra guest's table
  (`restaurant-tableware-qa` T1, e2e `restaurantmigration` 4).
- `restaurant-par-audit-qa` — PAR AUDIT & DEEP CLEANS (a real restaurant's
  day, plan F4, developer 2026-10-11; answer: the "month" is 14 days).
  `restaurant/parAudit.ts`: from L31, every `AUDIT_EVERY` = 14 restaurant
  days (Day 14, 28 …) the opening card (`ParAuditCard`) counts the
  tableware against its par — ceil(2.5 × seats) of each place-setting piece
  (and glasses, and any other piece the menu has made part of the kit),
  the table accessories per table — and the kitchen tools against the
  menu's own tool check (`toolsCheck`). Counted from what is OWNED (broken
  pieces have already left the stock). What's short is listed with Buy →
  that exact Market line (packs preset); read-only, no save writes, no
  money. Deep cleans (`cleanliness.ts`, rule field `deep`): EXTRA closing
  tasks only on their days — `deep-kitchen` (descale the dish machine,
  boil out the fryer) and `deep-restroom` (tiles and grout) on the week's
  last day (every `DEEP_CLEAN_EVERY` = 7), `deep-dining` (walk-in shelves,
  upholstery) on the audit day — never replacing a daily chore. Their own
  task kinds, so the day's `day:phase:services` key adds them once and
  `cleanTask` uses their (bigger) supplies once; the Cleaner does them in
  their areas; left undone they stay open like any closing chore. The
  Kitchen day strip marks "📋 Par audit" and "🧽 Deep clean tonight".
  Completionist $185,172 (the deep cleans' supplies; was $185,318).
  Browser: `tools/e2e/restaurantparaudit.mjs`.
- `restaurant-shift-chores-qa` — SHIFT CHORES (a real restaurant's day,
  plan F2, developer 2026-10-11). From L21 each phase brings its chores as
  Cleanliness tasks (`TASK_RULES` entries with `phase`, `fromLevel`,
  `staff`): opening — set up the stations (sanitizer), the morning restroom
  check, lay the tables (L31+); the lull after each service that isn't the
  day's last — fresh sanitizer bucket, sweep the line, refresh the restroom;
  closing after the last — degrease the hot equipment, mop all the floors,
  disinfect the restroom, top up the condiments and polish the cutlery
  (L31+). `choresAfterService` (App.completeCampaignLevel, the sim) and
  `choresAfterClose` (Closing Time's close, the quiet close, the sim) add a
  batch ONCE per key "day:phase:services" (`cleanliness.choreKeys`) — a
  reload or a repeated opening never adds it again. Each chore uses its
  supplies once (`cleanTask`); no "Do all" button (removed, developer
  2026-10-17; the `phase-all` action stays for tests and the sim).
  The team does its own (`cleanerRound`): the Cleaner the cleaning in their
  areas, the Server (dining-room chores), the Prep Cook (stations, sanitizer
  bucket). The Pre-Service Check opens for the opening / lull chores
  (`plan.chores`, `ShiftChecklist`), Closing Time lists closing's; a chore
  still open when the next service starts breaks spotless (the existing
  snapshot). Never blocks; no money. Browser: `tools/e2e/restaurantshift.mjs`.
- `restaurant-day-clock-qa` — THE DAY CLOCK (developer 2026-10-11: a real
  restaurant's day). `restaurant/dayClock.ts` (read-only, from
  `restaurantDay` + `servicesForDayAt`): the phase — opening (the day not
  open yet), lull (between services), closing (last service done) — the
  next service (k/n), the weekday (Day 1 = Monday, 7-day weeks) and the
  light: the next service's time of day (Breakfast dawn, Brunch morning,
  Lunch midday, Afternoon Tea afternoon, Dinner evening, Late Supper late),
  night at closing. The Kitchen (restaurant build) shows the day strip
  ("Day 12 · Fri · ☀️ Lunch next (2/3)", `data-testid="day-strip"`) above
  Today's Order and an opacity-only light tint over the kitchen art
  (`data-day-light`); Closing Time has a night sky. Browser:
  `tools/e2e/restaurantdayclock.mjs`.
- `restaurant-cleanliness-qa` — CLEANLINESS & MAINTENANCE (developer
  2026-10-10; restaurant build). Restaurant → 🧹 Cleanliness tab
  (`business-cleanliness`, `BusinessCleanliness.tsx`). Cleaning starts with
  Level 10's service (`CLEANING_FROM_LEVEL` = 10, developer 2026-10-10; was
  21): tasks, the cupboard, the spotless streak; the tab shows in the
  Restaurant section, open from Level 5 (11 until 2026-10-25). Kitchen / Dining Area / Restroom
  cards (meter, spots with ✓/!, View details → each task's Clean button and
  "Buy …" for what it lacks), Today's cleanliness (Ready for service /
  Clean everything I can), Cleaning staff (the existing Cleaner — On duty,
  area chips, wage from the catalog, Hire/Manage → Staff), Recent history
  (spotless streak → +1 %, inspection), the supplies strip (uses left, low,
  - → the exact Market line) and tools; a 4-step intro once.
    Screen order (developer 2026-10-17, "any mock or any section repeated —
    sort it"): Today's cleanliness first (a chip per area → that area's
    tasks, and Clean everything), the three area cards, the Wash-up (pieces
    in the sink, washed and broken from `serviceSupplies`, and the sink game —
    see "The sink" below), Cleaning staff,
    supplies, Recent history. Removed as mocks: "Practice room cleaning"
    (preview-only rooms), "Customer dishwashing" and "Chef's tools wash-up"
    (a scrubbing mini-game on a fixed list that never touched the save).
    `DishwashingPrototype.tsx` and its sink art were removed on 2026-10-17
    (the wash-up ran by itself after each service, so the scrub game had
    nothing real to wash); the developer brought dishwashing back on
    2026-10-23 as the real sink game (below). Browser: `tools/e2e/restaurantcleanliness.mjs`
    (8 checks; it now opens the tab through the map's Manager / Office and
    uses the 150-level numbering).
    **The sink** (developer 2026-10-23, "add the dish washing back and
    integrate it properly"; the developer chose "sink after service"):
    - A service's dishes WAIT in the sink (`restaurantSupplies.dirty`):
      App and the sim no longer wash right after a service.
    - By hand: the sink game `restaurant/WashUpSink.tsx` (the prototype's
      sink art, `public/dishwashing/premium-sink.webp`, and scrubbing, fed
      the real `sinkLines`), one kind at a time ("Dinner plates ×4"). Each
      kind scrubbed clean is the cleanliness action `{ kind: "wash", ids }`
      → `handWash`: dish soap by the piece (`soapPerPiece`, no machine
      minimum), nothing breaks, no money, no ledger; saved per kind, so
      closing half-way keeps it. No soap → the sink says so at once and
      offers 🛒 Dish soap (Market → that line).
    - Not washed: the automatic `washUp` at the next service's START washes
      what's left (one wash-up's soap, the seeded chance a piece breaks) —
      never needed to progress, no soft-lock.
    - Spotless (`serviceReport`): pieces still dirty when a service STARTED
      (`cleanliness.lastStart.dirty`, no soap for the START wash-up) spoil
      it; the service's own dishes in the sink at close don't.
    - Realistic dirt and the satisfying feel (developer 2026-10-23: "consider
      the cleaning an important feature … make the dirt in the utensils more
      realistic"): `restaurant/dishDirt.ts` is the pure dirt model — each
      piece collects its own kinds (plate: sauce, baked-on crust, grease
      streak, crumbs, smear; bowl: tide-mark ring; glass: water spots and lip
      marks; jug: scale; shakers: grime…), 3–6 stains seeded by
      `dishSeed(washedTotal, id)` (fresh dirt every wash, all on the piece),
      painted with the rooms' `paintStain` and scrubbed with the rooms' feel
      engine (`cleaningDirt` wear and toughness, `CleaningFx` suds and
      sparkles, wet scrub sound, sparkle steps, combo, a buzz). A piece is
      clean at 90%: the last specks cascade off, a shine sweep and a squeak,
      a cheer ("Squeaky clean!"), it slides onto the drying rack and the next
      slides in; the last one plays the spotless chime and a summary (best
      combo, seconds). Big pieces come first (`DISH_ORDER`); thin cutlery is
      zoomed in (`DISH_ZOOM`) so its dirt shows. Reduced motion is honoured.
    - Where: Restaurant → Cleanliness's **Dishwashing card** (right under
      today's status, before the areas; the sink picture, a count and meter,
      a chip per kind, soap · washed · broken behind ⓘ, "🧽 Wash N dishes",
      🛒 Soap with none; shown from dine-in, L31); `SinkWash` rows
      ("🫧 N in the sink · 🧽 Wash ›") on the Pre-Service Check (with the opening chores) and Closing
      Time; Level Complete adds "🫧 N in the sink · 🧽 wash by hand, nothing
      breaks" (`sinkNoticeLines`).
    - Economy: the sim's player never washes by hand, so its numbers barely
      move (completionist Local $132,088 → $132,066: soap and breakage one
      service later); hand washing only saves the odd broken piece.
      QA `dish-washing-qa`; browser `dishwashing.mjs`.
    A Cleaner for today (developer 2026-10-17, in place of "Clean everything
    I can"): with no Cleaner hired, the status card offers "Today · $X" (the
    Cleaner's day wage, `dayCleanerPrice` = the catalog salary; all-or-nothing
    `debitWallet`, ONE `staff-purchase` (Staff Hire) ledger entry "Cleaner ·
    one day" — End Business Day stays the one payroll site) or "🎬 Free with an ad" (rewarded placement `day_cleaner`, granted
    only on `rewarded`, no money, no ledger). `hireDayCleaner` stores the day
    in `cleanliness.dayCleanerDay` and runs the Cleaner's round at once;
    `cleanerOnDuty` (hired, or `dayCleanerToday`) drives the round after each
    service, the restroom job on the map, the map's Cleaner and tonight's
    inspection (`businessInspection` reads the day inline). Spills, and tasks
    short of supplies, stay the player's. Once a day; not with a Cleaner
    hired; the next day they're gone. QA `restaurant-cleanliness-qa` D1–D7;
    e2e `restaurantcleanliness.mjs` 4 (paid) and 9 (ad).
    Mechanics (`restaurant/cleanliness.ts`, state `business.cleanliness`,
    clamped by `cleanlinessOf`): no clock — each first completion adds the
    service's tasks after the report (`tasksAfterService`: equipment, bins,
    grease for fry/sauté/grill dishes; dining floor, tables from dine-in,
    seeded spills from messy dishes ~35 %; toilet, restroom floor, hand-soap
    refill every 6 customers, paper every 8; one task per kind with a count ≤
    9), then the Cleaner's round (`cleanerRound`: routine tasks of the
    assigned areas, never spills; no new wage). `cleanTask` uses each
    supply once from an opened unit (`USES_PER_UNIT`: floor cleaner 30,
    sanitizer 20, hand soap 17, cloth 25; cleaning lifetime "used"), tools
    must be owned; missing → stays open, names the need. Spotless
    (`hygiene.isSpotless`): also no task open when the service started
    (`snapshotServiceStart` in App.beginLevel) — hygiene is recorded from
    L21 (soap / cleaning liquid count from L31); the streak and +1 % rule
    unchanged. The inspector (L91+) warns "N cleaning tasks left undone"
    without a Cleaner (existing fines). Grandma's cleaning cupboard once at
    L10 (`giveGrandmasCupboard`, cost 0, no ledger; older saves on their next
    level). Catalog: section `cleaning` (restaurant only —
    `RESTAURANT_SUPPLY_SECTION_ORDER`; the classic order keeps 3): floor
    cleaner, sanitizer, hand soap, toilet paper, hand towels, cloths, bin
    liners (consumables, `supply-packaging-purchase`) and mop & bucket,
    broom & dustpan, toilet brush (durable). Never blocks START; no money
    moves except Market purchases. Pre-Service Check: a non-blocking
    "🧹 N cleaning tasks left" row; Level Complete: the Cleaner's line and
    what's waiting. Browser: `tools/e2e/restaurantcleanliness.mjs`.
- `cleaning-dirt-qa` — THE CLEANING MINI-GAME (developer 2026-10-21/22: "make it
  proper and satisfying, proper cleaning tools"). Tapping Clean on an interactive
  task (`INTERACTIVE_CLEANING_TASKS`, `BusinessCleanliness.tsx`) opens
  `AreaCleaningPrototype.tsx` on the room's art for the kitchen tier. Pure, seeded
  dirt (`restaurant/cleaningDirt.ts`): real stain kinds (sauce, smear, coffee ring,
  crust, grease streaks, crumbs, scuffs, footprints, puddle, limescale, water spots,
  grime) placed only on the tier's surfaces (`KITCHEN_GEO` line / islands / floor,
  `DINING_TABLES` tops and the floor between them, `RESTROOM_GEO` bowls / sinks /
  mirror / floor, measured from `public/cleanliness/interactive/`). Each stain has a
  tool (`toolForTask`; Disinfect: Squeegee on the mirror, Sponge on the sinks) and a
  toughness (`TOUGHNESS`: a crumb goes in one firm stroke, grease needs three).
  Fresh dirt every clean (developer 2026-10-22, "don't put the dirt in the same
  position and intensity"): `makeStains(…, variant)` with `cleaningVariant(cleaned,
since, task)` from the save (new after each clean, steady while the task waits; no
  save field) moves the stains, varies their number ±20 % and gives each a
  `strength` (paint 70–100 %, toughness ×0.75–1.25). The dining floor's dirt goes on
  the open walkways (`DINING_WALK`, off every rug `diningRug`), where it shows.
  Painting `cleaning/dirtArt.ts`, particles `cleaning/cleaningFx.ts` (none under
  Reduced Motion), sounds `AudioManager.playScrub / playSparkle / playSpotless`
  (Sound setting). Tools: `cleaning/toolLook.ts` names + emoji (🧽 🧹),
  `cleaning/CleaningToolIcon.tsx` draws the spray bottle & cloth, string mop, grill
  scraper, toilet brush and squeegee (🧴 is a lotion bottle, 🪣 a bucket). Feel: a guide ring on a stain (again after 3.5 s idle), the wrong tool
  says "Use the X here" and lights the right button, streak chip, 25/50/75 % cheers,
  "🫧 N stains left"; at `CLEAN_THRESHOLD` 0.9 the rest wipes away, then "Spotless!"
  (time, best streak) and Done → `onComplete` (the task's existing clean: supplies
  once, no money, no ledger, no save field). Layout: header, the room
  (contain-fit 540×960), tools and progress below. QA D/V/B/Z/T/K/S/A/R; browser
  `tools/e2e/cleaningfeel.mjs` (10 checks, incl. Reduced Motion, 320×568 and fresh dirt).
- `restaurant-service-report-qa` — THE RESTAURANT'S NUMBERS (supplies plan
  Phase D, developer 2026-10-10: "they should feel proud"). The supplies
  keep running totals (`restaurantSupplies.coversTotal / takeawayTotal /
packedTotal`, with `washedTotal / brokenTotal`); after each first
  completion's wash-up App calls `serviceReport.closeServiceReport(save,
level, noSoap)`: the report is the difference since the last one
  (`business.restaurantRecord.at`), plus hygiene from dine-in (L31): soap
  at the wash-up, nothing left dirty, cleaning liquid not empty =
  SPOTLESS. Spotless services build a streak (`streak`, `bestStreak`,
  `spotless`); a lapse resets it. Level Complete: "🍽️ N guests served ·
  🥡 N takeaway (N pieces packed) · 🧼 N washed" and "✨ Spotless service ·
  N in a row" or "🧽 Not spotless: …". A streak of 3
  (`SPOTLESS_QUALITY_STREAK`) adds 1 % (`SPOTLESS_QUALITY_PCT`) to the
  restaurant's quality share (`restaurantQualityBonusPct`). The inspector
  (`businessInspection` Kitchen Cleanliness, L91+ day ends) reads the last
  service's hygiene (`restaurant/hygiene.ts` `hygieneIssue`, no runtime
  imports): a lapse is a WARNING unless a Cleaner is on staff (a repeated
  warning is fined as before); Business Mode saves have no record and are
  unchanged. Restaurant Progress: "🏪 Your restaurant in numbers"
  (`data-testid="restaurant-numbers"`, read-only). No money, no ledger.
  The sim mirrors it (best streak in its log). Browser:
  `tools/e2e/restaurantreport.mjs`, `restaurantsupplies.mjs` 3c.
- `restaurant-takeaway-qa` — TAKEAWAY BY DISH + CLOSING SUPPLIES (supplies
  plan Phase C, developer 2026-10-10). Curries travel (developer
  2026-10-17, K1): `orderServiceFor(level, index, recipe)` makes a curry
  (a thali-tray dish) a takeaway at `curryTakeawayShare` (60%) instead of
  `takeawayShare` (30%), on the same seeded roll; every other order is
  unchanged. `serviceSupplies.takeawayPiecesFor
(recipe, level)`: curries and combo / mezze plates (shared, "mezze",
  "trio", 4+ ingredients) a 3-compartment tray; pots, soups, bases, salsas
  a microwavable tub; fried food a burger clamshell; grilled / sautéed a
  foil tray; bread deli wrap; the rest a kraft box; heavy orders (pot,
  grill, shared) a carry bag, the rest a paper bag; extras a cutlery kit
  (not bread / skewers), a wet wipe (messy), a tamper label from L91.
  `dineInExtrasFor`: fried food and bread on a deli-sheet liner, grilled /
  sautéed meat and fish with a toothpick from L101. `takeOrderSupplies`
  with a cover takes exactly those (packaging lifetime "used"; none in
  stock = still served). The check: each takeaway dish's container and bag
  block ("· takeaway"), the extras and dine-in liners / toothpicks warn
  (without recipes the old generic container / bag rows). Closing
  (`closingSuppliesFor` / `closingSupplies`, called by `closeDay` after the
  wipe-down; shown on Closing Time, `data-closing-supply`): a tissue cube
  from L31 and a sheet of deli wrap per ingredient line left in the fridge
  from L21 (new chore "Wrap and label what's left in the fridge") — short =
  a warning, no money. All 17 packaging / hygiene items are used. The
  migration crate packs each takeaway dish's own container and bag (≥
  KIT_PACKAGING) and extras. Sim: the diligent player keeps tissues and
  wrap. Browser: `tools/e2e/restauranttakeaway.mjs`.
- `restaurant-tools-qa` — KITCHEN TOOLS (supplies plan Phase A, developer
  2026-10-10: "ask the player to buy some important tools when the game
  starts and the rest when necessary"). `restaurant/dishService.ts`
  (`dishServiceFor(recipe)`: kind + cooking oven / fry / pot / saute /
  grill, protein, cheese, skewer, shared, messy — derived, cached) and
  `restaurant/kitchenTools.ts`: `TOOL_RULES` gives all 18 culinary
  smallwares a job — peelers (peeled dishes), mixing bowls & measuring cups
  (salads, fruit, pots) from L10 (Grandma's old set, `giveGrandmasTools`,
  once at cost 0, `business.grandmasTools`); sheet pans + oven mitts (oven,
  L11); frying pans, tongs (fried / grilled), skimmers (fried) L16; stock
  pot + ladles (pots) L17; storage containers + thermometers (every
  service) L21; saucepans L32, whisks L33 (pots, salads); sauté pans +
  spatulas L36; graters (cheese, gratin) L44; kitchen scales (meat / fish)
  L101. Peelers and the three pans are per cook from L41 (`cooksOnLine`:
  chef + prep / line cooks + Head Chef + specialists, max 4). Needed for
  today's tickets AND the active menu (`serviceRecipes`). `toolsCheck` →
  the plan's `tools` (every missing tool blocks START; the sheet's top
  says "🍳 Today's dishes need: …", rows say why, Buy → the Market's
  Culinary card preselected with its packs — `openMarketSupplies(…,
packs)`); `toolsSoon` (5 levels ahead, "🔜 Coming up"); Level 10's
  `firstShoppingList` card (the tools L11–20 need; never blocks L10). Cover
  part `"tools"` (ad placement `service_tools`, or supplier credit). Grandma's
  L10 tip opens the Market; the L10 milestone card lists the tools. Browser:
  `tools/e2e/restauranttools.mjs`.
- `restaurant-service-cover-qa` — COVERING A SHORT SERVICE (developer
  2026-10-10: "don't use Grandma lending anywhere — use watch ad; don't
  miss any monetization opportunity"; with no ad a small loan).
  `restaurant/serviceCover.ts`: `coverFor(plan, part)` only from L10
  (`FIRST_PURCHASE_LEVEL`) and only when that part (`"stock"` /
  `"supplies"`) is short AND unaffordable (a player who can pay buys it);
  `coverWithAd` = exactly the missing goods at cost 0 (no money, no ledger,
  no penalty — the Rush Restock ad rule); `coverWithCredit` = the Market's
  whole units / packs at the Market price (real cost basis), owed.
  `restaurant/supplierCredit.ts`: optional `business.supplierCredit {owed,
taken, repaid}`; taking on credit moves no money (no entry);
  `repayFromEarnings(save, earned)` = min(owed, earned, wallet), one
  `"supplier-credit-repayment"` entry (an expense, "Supplier Credit
  Repaid"), run at a first completion from the level's orders + reward
  (Level Complete row "💳 Supplier credit repaid"). App
  `coverServiceWithAd(part)` (placements `service_stock` /
  `service_supplies`; granted only on `rewarded`; save re-read after the
  ad) and `coverServiceWithCredit(part)`; UI `CoverActions.tsx` (ad only
  when `rewardedAdsAvailable()`, credit when not or after a failed ad),
  the check's owed line, Restaurant → Suppliers "💳 Supplier credit" card.
  Before L10 the pantry stays (nothing can be bought). Grandma's spares and
  Emergency Service are gone. Browser: `tools/e2e/restaurantcover.mjs`
  (stubbed rewarded ads: declined → credit offered; rewarded → free; no
  ads → credit, repaid at Level Complete; 320 px).
- `restaurant-level-goals-qa` — LEVEL GOALS, first levels pass 3 (developer
  2026-10-09; `restaurant/levelGoals.ts` + the light `levelChecklist.ts`
  used by the lazy Preparation chunk; restaurant build, Levels 1–15,
  presentation only): G the goal from the dish's real steps (one step: what
  its cut is judged on — "Even slices"; several: "Clean, even cuts"; a dish
  of peel/smash only — L7, L9 — "Finish …", because the engine gives an
  all-peel/smash dish a fixed 90); S stars = the engine's own grade
  (`CutEvaluator.qualityFor`) on the save's existing
  `recipeProgress[recipe].best`: ★ Honest ≥70, ★★ Clean ≥85, ★★★ Masterful
  ≥95; no save field, no money, ungraded dishes none (the developer's
  decision supersedes Law 4 "no stars" for Levels 1–15); C the customer line
  = the recipe's authored `customerDialogue` (≤ 64 chars); K the checklist =
  the dish's real steps ticked by Preparation's active step (the scene's
  STEP_STARTED), ≤ 3 steps all shown, longer dishes "✓ n done · current ·
  next · +n more", none for one step; the chef's note is hidden while a
  checklist shows (room for the board at 320 px); I from Level 9 the Order
  Board row's "What's in this dish?" lists the dish's `orderRequirements`
  with the fridge's usable amount (a pool level lists its possible dishes),
  read-only; D Grandma's 15 Level Complete lines are Pass 1's (no new ones);
  Level Complete adds "⭐ Best prep: ★★☆ Clean". Browser:
  `tools/e2e/restaurantlevelgoals.mjs`.
- `restaurant-grandmas-fridge-qa` — GRANDMA'S FRIDGE, first levels pass 2
  (developer 2026-10-09; `restaurant/grandmasFridge.ts`, levels in
  `firstLevels.ts`: LEFTOVERS_AT 3, STOCK_USED_FROM 4, RUNNING_LOW_AT 12,
  TOP_UP_AT 13, PREVIEW_AT 14, `earlyStockAt` = 4–14): L the leftovers
  (`giveGrandmasLeftovers`, once, `business.grandmasFridge {atLevel, lines}`;
  Levels 4–12's first-play needs, a pool's bigger recipe, × (1 + full
  sharpness penalty), rounded up to 0.05; cost 0, no money/ledger; older
  saves only the levels left; clamped to the fridge's free room); C Levels
  4–14's own orders take exactly `orderRequirements`, once per serve
  (`consumeCampaignOrderStock(…, kind)`: "guest" uses none before L15);
  since 2026-10-09 (developer: "without these ingredients in stock I still
  can cut and serve it") a short fridge refuses the serve like L15+:
  `serviceStockCheck(…, { ownOrders: true })` applies from L4, the sheet
  opens and START waits; before the Market sells ingredients (L10,
  `FIRST_PURCHASE_LEVEL`) the check shows no Restock/prices and offers
  Grandma's pantry (`pantryForMissing(…, canBuy = false)`, free), from L10
  the normal Buy / Quick restock, and when unaffordable an ad or supplier
  credit; R/T/P
  `grandmasFridgeNoteFor` (low: L12–14 · top-up: L13–14, missing = need −
  usable ≥ 0, `marketUnitsCovering`, `restaurantQuote` · preview: L14–15 +
  spare stock), on the Pre-Service sheet (`servicePlanNeedsSheet`; the note
  itself never blocks START; "Buy" opens the Market at the exact step with the back
  pill); S only first plays of 12–14 with the leftovers; E rewards, a whole
  run moves no money, Pass 1 unlocks; I (review) the Inventory reads the
  restaurant's menu at its level (`inventoryMenuOf`; the selectors'
  optional `MenuInEffect`, default = the Business menu): none before L11,
  the real 4 dishes at L11; F (review) the L15 hand-over card
  (`isFirstStockService`, `ServicePlan.firstStockService`) with food in the
  fridge or nothing missing, never after a stock level is done. Browser:
  `tools/e2e/restaurantgrandmasfridge.mjs`.
- `restaurant-city-ranking-qa` — the CITY RANKING (developer 2026-10-09:
  "add some mock restaurants and implement a ranking — gradually progress to
  the top 1 restaurant after completing the campaign";
  `restaurant/cityRanking.ts`, restaurant build): 49 made-up rivals + the
  player = 50 restaurants; reputation = completed campaign levels × 40
  (+5 per Endless star after L250); each rival is passed by completing one
  level (`passedAtLevel`, a curve: early ones every 2–3 levels, later ones
  every ~6–7, never more than 8 without one), #2 at L249 and #1 exactly at
  L250. Derived from the save, nothing stored, no money. The Kitchen's
  top-left card shows "City ranking · #n of 50" + the next rival
  (`CityRankBadge`); Restaurant Progress leads with it (`kc/CityRanking.tsx`:
  `CityRankHero` + the `CityLeaderboard` guide — top 3, the rows around you,
  "Show all 50"; the café stage is the standing card's "Kitchen title"); a
  first completion that passes a rival adds "🏆 City ranking #48 → #47 ·
  Passed …" to the Level Complete banner (`rankChange`). The classic build
  keeps its café rank card. Browser: `tools/e2e/restaurantmeasures.mjs`
  1a/1b.
- `level-ux-qa` — the Level 1–10 UX pass (presentation only): Level
  Complete waits for a story banner (Level 10's milestone) and lists Order
  payout + Completion reward + Earned this level (`levels/levelEarnings.ts`,
  read from the ledger the serves wrote; null rather than a wrong total when
  trimmed); peel progress "N% peeled" from a read-only `PEEL_PROGRESS`
  event (the scene's existing coverage count; peel unchanged); the Order
  Board lights no bottom-bar section; knife/board previews say "in the
  Market"; the Knife Report's line follows the grade (`game/qualityCopy.ts`),
  "Prepare Again"; no "Step 1 of 1", the step line sits on the HUD card.
  Browser: `tools/e2e/levelux.mjs`.
- `business-history-qa` — the 30-day restaurant history
  (`business/businessDayHistory.ts`): first day, several days, 30 kept, the
  31st drops the oldest, save/load, an old save without history (empty, no
  money/ledger change), End Business Day identical with or without it,
  specialist wages added to that day (restaurant build), malformed data
  cleaned, one writer. Browser: `tools/e2e/history.mjs`.
- `lazy-load-qa` — the Restaurant screens (back office, Restaurant Service,
  Inventory + fridge) are ONE lazy chunk (`kc/restaurantScreens.ts`) with an
  "Opening the restaurant…" state; nothing imports them statically; the
  built `index.html` never loads it. Browser: `tools/e2e/lazyload.mjs`
  (both builds).
- `unused-assets-qa` — every tracked `src/assets` file is referenced (or a
  documented original: `src/assets/shop/`); `kitchen$f` and `tomato.webp`
  stay removed.
- Browser `tools/e2e/fridgepager.mjs` — the phone fridge, one compartment at
  a time (320–430 px, both steel models, touch and mouse; all pages = the
  wide view's data).
- `story-pause-qa` — the finale and milestone banners stop their timers
  (and animations, and finale taps) while paused, resuming with the time
  left (`PausableCountdown` on a fake clock); the finale's "BACK TO THE
  KITCHEN" ends on Kitchen home. Browser: `tools/e2e/finale.mjs` (a real
  Bridge pause mid-finale).
- Browser `tools/e2e/resize.mjs` — a resize or rotation (320 ↔ 768 ↔ 430
  px) never restarts the game: `GameShell` keeps ONE wrapper and changes
  only its style (swapping the tree remounted everything).
- `playables-ads-qa` — Bridge ads (interstitial policy, rewarded Replay Bonus).
- `ad-bonuses-qa` — the five ad bonuses (§2): amounts, one entry per claim,
  caps per kind and day (apart from the Replay Bonus's), the free daily gift,
  ledger-trim survival, placements, and the economy bound (an every-offer
  player at 10 levels a day: +$19.5k, 14.8% of the $132k target; ≤ 20% allowed).
- `playgama-telemetry-qa` — the analytics events (§2): the progression
  funnel once per level, the event contract, `performance_sample`'s fields
  and values, only PlayablesSDK touches the Bridge, one version source.
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
- `knife-stroke-qa` — the knife as in the developer's POV photos: on the
  cut line, held from the right hand (vertical: tip up; horizontal: tip
  left, handle right), seen from above stood on its edge; tap lands +
  short slice, cut at the end of the stroke within 0.35 s; swipe moves
  with the finger along the drag (push/pull), steady near the tie; tap,
  swipe, drawing and ghost all use it.
- `cut-rules-qa` — the developer's cutting rules (`docs/KNIFE_RULES.md`)
  for every cutting step of all 250 levels + Endless: cut lines across the
  food (vertical, Level 1 style; horizontal only for julienne, Dice's cross
  cuts or a tall food), right-to-left order, knife poised on the last cut
  between cuts and laid down at step end, cards teach right to left.
- `coaching-qa` — beginner coaching: every technique has a how-to card,
  each technique is taught only in the level that introduces it (since
  2026-10-10 Levels 1–5 too: L1 slice, L3 chop, L5 peel + halve; L2/L4
  nothing — developer: "don't let the same instructions repeat"), the stuck rule (back only with no progress),
  first play only (no replay/Today's Special/Endless/Service/Business),
  the one-line hint only to Level 10, and the ghost never touches
  cut/peel/score state.
- `business-supplies-qa` — Business Supplies (§7, master spec §25): the
  catalog (50 sourced lines, ×0.65, no prep knives/boards, not
  ingredients), the purchase with ONE ledger entry (equipment vs
  packaging), atomic failures, packaging use per order → COGS, the P&L
  cash identity with ingredient analytics food-only, savings never money,
  saves/migration (real `SaveManager.load`), Campaign independence and
  wiring. Browser: `tools/e2e/supplies.mjs` (375×642).
- `fridge-view-qa` — the physical fridge on the Inventory screen (ids,
  zones, production tiers, aggregate freshness, attention, unknown ids,
  navigation-only actions, handle never takes a tap, 48 px targets).
- `inventory-screen-qa` — the Inventory section: 5-item bottom bar, no
  Business Inventory/Supplies tab or `business-inventory` route, the
  Ingredients | Supplies switch (N), supplies coverage/low/all 52 lines/
  read-only (U), all 57
  ingredients with the save's quantity/cost/freshness and fridge (A), the
  one status rule (S), Needs Attention (T), sorting (O), read-only +
  navigation (R), existing saves through the real `SaveManager.load` (C).
  Browser: `tools/e2e/inventory.mjs` (320–1024 px).
- `inventory-market-qa` — the Market/Inventory split (checks 1–16: no buy
  controls in Business, purchase maths, fridge, low stock, expiry,
  purchasing/consumption analytics, supplier modifiers, contracts, funds,
  fridge full, 57 ingredients, 48 dishes, Business-only recipe, old saves).
- `phase1-cutting-qa` — PHASE 1 CUTTING FEEL (developer 2026-10-21; §10
  "Cutting feel, combo and New Best"): A combo config; B the combo is the
  scene's own step count, emitted on CUT_COMPLETED, never a UI copy; C
  reset on STEP_STARTED, each milestone once, toast non-interactive; D the
  board drag (axis + speed, Reduced Motion off); E the sounds (Sound
  setting respected, Perfect sharper, completion chime once); F
  `bestVerdict` honesty (first / equal / worse / invalid never celebrate,
  real %), the before/after digits only on a genuine new best,
  `formatScorePair` never prints an equal pair; G the replay latch, no
  money near the combo, no save field; H the settle tilt never reads the
  cut's angle, is proportional, pivots on the centroid (checked on
  numbers), Reduced Motion off; I the Knife Report's stats grid can
  shrink and tightens under a 390 px game (static guard for
  `tools/e2e/knifereport.mjs`).
- `knife-feel-qa` — the knife's feel (developer 2026-10-24; §10 "The
  knife's feel"): tiers by combo (Fever ≥ 2), each moment's effects and
  buzz, the scene wiring (every committed cut, juice, the last cut's ring,
  the knife's own transform, a cool blade per ingredient, Reduced Motion),
  presentation only.
- `phase2-qa` — PHASE 2 (developer 2026-10-21; §10 "Cleaning cloth, money
  vacuum…", §7 "Customer tips"): A debris bounded, deterministic, per
  ingredient, in the margins, only from real actions; juicy cuts spill juice
  at the cut (2026-10-24); the cloth takes the board's pointer before any cut,
  wipes over several strokes, hides the next ingredient until it's done, is
  offered only at an order's start, has no Skip (2026-10-24), recovers lost pointers,
  ends cleanly, touches no save or wallet;
  B the cash adds up exactly (whole cents, tip in gold), bounded, never
  credits/records/saves, each piece once, the wallet = credits − counter, the
  Serve latch, the tray owns its pointer, auto-collect session-only; C tips:
  never on a replay, below Masterful, off-schedule or for no pay; 10% in whole
  dollars ≥ $5; no RNG; 1 in 3 of the REAL campaign within 2σ; worst case ≤ 5%
  of campaign income; credited in the same save as its own entry on both
  first-payment paths; D no save-schema change, exactly two new ledger
  writes. Browser: `tools/e2e/phase2.mjs`.
- `phase6-qa` — PHASE 6 (developer 2026-10-21; §10 "Kitchen Moment cards"):
  A the four moments from existing signals only (Perfect Slice in a Clean ×5+
  run; a real special variant or a new Grandma's Signature; bestVerdict's
  genuine best; a special customer's real Serve reaction), honest facts,
  nothing for an ordinary dish; B once per (run, kind), a new key per attempt,
  detection in one place (the scene's RECIPE_COMPLETED) and the customer
  moment behind the Serve latch; C the card on its own 1080×1350 canvas,
  feature-detected Share, Save as a PNG download, cancel is not an error,
  object URLs revoked, nothing opens by itself; E no storage, no network, no
  money, no save change. Browser: `tools/e2e/phase6.mjs`.
- `phase5-qa` — PHASE 5 (developer 2026-10-21; §10 "Restoration reveals and
  the daily gift streak", §7 "Gift streak rewards"): A kitchen tiers, prices
  and purchase rules byte-for-byte HEAD's, every tier in one of four
  restoration stages, major vs short reveals, each tier's real changes and
  the family's kept things, the reveal opened only after a saved purchase,
  skip / cleanup / Reduced Motion, no money in the restoration layer; B the
  gift streak from the ledger alone (Day 1–7, a missed day restarts, the day
  after Day 7 starts a new week), $100 / $300 paid once inside the gift's own
  save, the gift itself unchanged, the ledger keeping 9 days of gift records
  through a busy week, the Kitchen card only opening the existing sheet and
  re-reading the day on resume; E no save field, no new App ledger write, no
  storage, Today's Special untouched. Browser: `tools/e2e/phase5.mjs`.
- `phase4-qa` — PHASE 4 (developer 2026-10-21; §10 "Signature dishes,
  special customers and the order-completion sequence"): A the tiers sit on
  the Knife Report's own Clean/Masterful thresholds, a page's best is the max
  of its recipes, a milestone only when the saved best crosses a tier (once
  per recipe, never on a worse or equal replay), memories fixed per page,
  this visit's extras memory-only, no score digits in the book, "Prepared"
  kept; B five customers with their own names/faces, the cadence (2nd
  eligible order, then every 5th) and rotation, one decision per order id,
  eligibility, reactions that follow the real grade (cheer only for
  Masterful), the Regular's par, the Mystery reveal, presentation only — the
  money is the normal settlement; C one advance per stage (Continue, Serve,
  Next Customer), the staged serve card, every Knife Report field kept; E no
  save-schema change, no new ledger write, nothing persisted. Browser:
  `tools/e2e/phase4.mjs`.
- `phase3-qa` — PHASE 3 (developer 2026-10-21; §10 "Fever Mode, Prep Rush,
  Kitchen Chaos and special variants"): A Fever lights on the existing ×10
  milestone, once an order, on the scene clock, ends at plating / new order /
  restart, never touches grading, Reduced Motion; B Prep Rush's difficulty
  steps and caps, seeded sequence, scoring, end rule, clean-cut and stroke
  geometry, session best, isolation from save/money/storage, a bounded belt
  scoring each item once, teardown and pause safety, its own lazy chunk; C the
  Director's cadence (after 3, then every 4th eligible order), fixed rotation,
  determinism, eligibility (no taught technique, no Levels 1–10, never with
  the scraper), the six events' scene/UI hooks, the dev-only test hook, the
  report's words (never money), real-campaign coverage; D the variants'
  cadence (every 3rd order with a base ingredient), real ingredients only,
  their looks and where they are painted; E no save-schema change, no new
  ingredient id, no new ledger write, nothing persisted. Browser:
  `tools/e2e/phase3.mjs`.
- `campaign-integrity-qa`, `restaurant-progress-qa`, `business-ux-qa`,
  `progression-preview-qa`, `usd-currency-qa`, `phase7-2-smoke-test`,
  plus the other `scripts/*-qa.mts` / `business-*-qa.mts` suites.

Gates for any change: TypeScript (`npx tsc --noEmit -p .`), ESLint on
`src scripts tools` (0 errors; 6 pre-existing warnings in `src/components/ui`),
Prettier, build, preflight, the relevant QA, and a browser check.

Browser tests: `tools/e2e/` (headless Chrome via `puppeteer-core`; see
`tools/e2e/README.md`). Run `npm install` inside `tools/e2e` once.

Known pre-existing failures (document, do not "fix" by weakening) — found
2026-10-21 and confirmed identical on an unmodified `HEAD` build (A/B:
changes reverted, rebuilt, re-run):

- `tools/e2e/coach.mjs`: 5b ("Level 4's new halve step teaches itself"),
  8a ("a touch that made no progress hides it…"), then a
  `TimeoutError` at `coach.mjs:344` that ends the run.
- `tools/e2e/economyv25.mjs`: 2f ("no 'richest' / '#1' claim") and 4a–4e
  (the Kitchen Upgrade build flow and the Level 60 Endless lock).
- `tools/e2e/adsflow.mjs`: all pass.
  (`playables-ads-qa` B12/B13 depended on the calendar date; the test now
  pins `Date.now` to its `NOW` for section B — the cap is unchanged.)

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

### Market needs: what today needs, highlighted (developer 2026-10-16)

- `restaurant/marketNeeds.ts` (read-only, from the game's own checks): for the current level's
  service — the Pre-Service Check's missing ingredients (buy = its Restock amount), its
  supplies and kitchen tools, tonight's closing supplies (tissues, deli wrap), the open cleaning
  jobs' supplies, the menu guests' extra stock, and the tools coming up ("soon").
- Every Market section (Ingredients, Smallwares, Tableware, Takeaway, Cleaning): needed cards are
  highlighted ("📌 Needed today · buy 2 packs · Need 28, have 0 · why"), listed first (today,
  tonight, menu guests, soon; the rest keep their order) and preset to the amount; supplies
  sections have "Buy everything needed"; Ingredients has a "Needed for today" group first;
  each tab shows its count. Restock › links (Daily Check) preset the packs.
- Quick restock (checked on every level, lb and kg): each line is exactly the Market price
  - 25 %; it covers the service's own orders only, which the sheet now says.
- **Which level (developer 2026-10-17):** a Level 10 shopping list opened the
  Market with nothing highlighted. `marketNeeds(save, levelId)` now plans for
  the open Pre-Service Check's level (App's `serviceCheckLevelId` → router →
  Shop → sections), else the current level, else the furthest unlocked — the
  first not played yet (`planningLevelId`). Before, it only read
  `currentLevelId` and showed nothing when that level was already played.
- With needed items a section opens on **All** (a tapped Buy no longer filters
  to one group and hides the rest); group chips carry a count; tools for the
  next levels get a "🔜 N items needed for the next levels" note; a Market tab
  with only next-level needs shows a gold badge. Ingredients open on All too
  (its "Needed for today" group first).
- Tests: `restaurant-market-needs-qa` (L1–L5); e2e `tools/e2e/marketneeds.mjs`,
  `tools/e2e/marketneedslevel.mjs` (the Level 10 flow; fails on the old build).

### Restaurant menu order, switch and price tip (developer 2026-10-16)

- Business → Menu lists dishes in the order the 150-level campaign brings them
  (`restaurantMenu.inCampaignOrder`): the level a dish joins the menu, then the level its
  recipe is first cooked, then the catalog. Turning a dish off never moves it.
- On / off is a toggle switch (`role="switch"`, `aria-checked`).
- From popularity 60 a tip suggests raising prices by (popularity − 50) ÷ 2.5 % over the
  suggested price (+4 % at 60, +12 % at 80, +20 % at 100). Guests already pay
  × (0.9 + 0.3 × popularity/100) of the menu price.
- **Menu price cap** (developer 2026-10-16, "so menu prices can't be exploited"): a dish
  sells for at most 1.5 × its suggested price (`businessMenu.menuPriceCap`,
  `MENU_PRICE_CAP_MULTIPLIER`), the point where classic Business Mode already calls a menu
  overpriced (`pricingDelta` −3).
  - `setMenuPrice` saves a higher price AT the cap (`capped: true`); 0 and the cap itself
    stay allowed.
  - `menuPriceFor` (the one price resolver, also behind `businessDishPrice`) reads a saved
    price above the cap (an old save) as the cap, so payment, margin and popularity never
    see more.
  - A menu guest pays at most cap × 1.2 (popularity 100). The + button stops at the cap and
    the card shows "max $X" / "max price"; a capped tap says so.
  - Tests changed to the new rule: `business-wtp-qa` B/C/D/E/I/O, `business-menu-qa` D2,
    `business-pnl-qa` G and `business-service-qa` N used prices above the cap (e.g. 2000¢
    on the 900¢ salad, cap 1350¢); they now use in-cap prices with the same intent and
    exact expected values. A price still has no demand effect in the restaurant.
- Tests: `restaurant-menu-order-qa` (C: the cap on all 48 menu dishes, old saves, UI);
  e2e `tools/e2e/restaurantmenu.mjs` (5: + stops at the max price).

### The Second Floor — automated food hall (developer 2026-10-16)

- **Code:**
  - `src/game/restaurant/secondFloor.ts` (logic);
  - `src/components/kc/restaurantMap/SecondFloorView.tsx` (map, same CSS as the first
    floor);
  - art `public/restaurant-map/second-floor.webp` (source `art-source/second-floor-food-hall.png`).
- **Unlock** (early game phase 4, developer 2026-10-26: everything by Level 5 — the floor and
  every station now open at **Level 5**; the text below is the 2026-10-16 design). Since the
  release candidate (2026-10-26) a station's map panel shows the shortfall ("$400.00 · need
  $X more") and, when no Floor Server would run it, "Earns once a Floor Server runs it":
  players can **visit the floor from Level 10**
  (`SECOND_FLOOR_OPENS_AT`). The first-floor map shows "⬆ 2nd floor"
  (`data-testid="upstairs"`), or "🔒 2nd floor · Lv 10" before then. **Every station goes
  on sale at Level 60** (`STATIONS_OPEN_AT`) and stays locked until it is bought, like the
  first floor: the pill reads "🔒 Lv.60" before L60, then "🔒 $price". No staff can be hired
  before a station is owned (`noStations`). The test switch (`npm run dev` or `?floor2`)
  opens only the floor, never a station.
- **Economy plan** (developer 2026-10-16; `scripts/second-floor-economy-sim.mts`, QA section P).
  Prices follow payback in staffed earning hours: buying ≈ 40 h, Lv 2 ≈ 100 h, Lv 3 ≈ 200 h,
  each later station 15 % slower. Fast start, slow finish: the floor matters during the
  campaign but doesn't flood money after it. All on sale from L60:

  | Station   | Buy    | Lv 2   | Lv 3   | $/h at Lv 1 / 2 / 3 | Payback (h) buy / Lv2 / Lv3 |
  | --------- | ------ | ------ | ------ | ------------------- | --------------------------- |
  | Coffee    | $400   | $600   | $1,000 | 10 / 16 / 21        | 40 / 100 / 200              |
  | Drinks    | $550   | $800   | $1,400 | 12 / 19 / 25        | 46 / 114 / 233              |
  | Pizza     | $750   | $1,150 | $2,100 | 14 / 23 / 31        | 54 / 128 / 263              |
  | Burger    | $1,000 | $1,450 | $2,600 | 17 / 27 / 36        | 59 / 145 / 289              |
  | Ice Cream | $1,300 | $1,750 | $3,200 | 20 / 31 / 41        | 65 / 159 / 320              |
  | Hot Food  | $1,550 | $2,300 | $3,850 | 22 / 35 / 46        | 70 / 177 / 350              |
  - Storage 8 / 9 / 10 h (Lv 1/2/3): checking in twice a day pays.
  - Floor Server $400 (max 3, runs 2 stations), Floor Cleaner $300 (max 2, per 3 stations).
  - Whole floor $29,550; $200/h fully upgraded. First machine + server $800.
  - Sim (reinvesting its own takings from L60): complete on day 23.5 with 2 check-ins a day
    (day 47 with 1, day 17 with 4); $12.6k earned by day 18 (a 5-levels-a-day player's
    campaign end); then about $4k a day.

- **Market · Second Floor** (`kc/MarketSecondFloor.tsx`, Shop category `second-floor`,
  restaurant build): the six machines (buy, payback), their upgrades and the Floor Team, through
  the same `App.secondFloorAction` as the floor's panel (one debit, one ledger entry each). The
  Pickup Counter's "Machines, upgrades & team in the Market" opens it (`openMarketSecondFloor`).
  Collect stays on the floor. e2e `tools/e2e/marketsecondfloor.mjs`.
- **Money:**
  - real time (`Date.now()`); min(cap, rate × hours);
  - a clock set back earns 0;
  - the Pickup Counter's **Collect** pays everything with ONE `automation-income` ledger
    entry and restarts every clock;
  - buying and upgrading are all-or-nothing (`debitWallet`), one `automation-purchase` entry
    each;
  - an upgrade first banks the income already earned.
- **Floor staff** (developer 2026-10-16): permanent, one-time hires, no wages (`FLOOR_STAFF`).
  - **Floor Server** $400 (max 3): runs 2 stations; an unstaffed station earns $0 and shows
    "Needs a server".
  - **Floor Cleaner** $300 (max 2): keeps 3 stations' tables clear; each missing cleaner costs
    25 % of the takings.
  - Hiring and buying a station both bank what the floor already earned first, so staffing
    never changes past hours.
  - One `automation-purchase` entry per hire.
- **Floor life** (developer 2026-10-16), the idle-game animation:
  - logic `src/game/restaurant/floorLife.ts` (pure, seeded, no money or save): `floorCast(floor)`
    builds the cast from the **working** stations (owned and run by a Floor Server);
    `timeline(stops)` turns a route into keyframe percentages; spots in `FLOOR_SPOTS`
    (map percent, measured on the art);
  - **servers** (one per 2 working stations, never more than hired) walk machine → Pickup
    Counter with that station's food; **guests** (2 per working station, at most 10, a seat
    each) come in the door, pick up at the counter, sit and eat, then leave; **cleaners** (as
    hired) wipe the tables with a 🧽; a "+$" pops at the counter while the floor earns;
  - an empty or unstaffed floor is quiet;
  - `FLOOR_LIFE_ALWAYS_PREVIEW` (false; was on for the developer's testing) plays the full
    preview without buying anything;
  - **testing preview:** only with that flag (`FLOOR_LIFE_PREVIEW`: every station working, 3
    servers, 2 cleaners); only the drawing changes, never the save, the locks or the money;
  - view `components/kc/restaurantMap/FloorLife.tsx`: inline CSS keyframes, transform and
    opacity only, no library; aria-hidden, `pointer-events: none`; hidden by the game's Reduced
    Motion setting, like the first floor's guests. The people are the first floor's
    (`restaurantMap/GuestPoses.tsx`, shared).
  - Tests: `restaurant-floor-life-qa`; e2e `restaurantsecondfloor.mjs` check 3c.
- **First-floor staff life** (developer 2026-10-16): `restaurant/staffLife.ts` +
  `restaurantMap/StaffLife.tsx`, drawn by the shared `MapCast` (FloorLife.tsx).
  - **Who:** the **Old Chef** (from the intro) is always at the range. Each of the six real
    roles (`BusinessStaffRole`) shows only when hired AND it has work: Line Cook, Prep Cook,
    Head Chef, Manager (seated at the desk) when hired; the Server when hired and the dining
    room is open, with the service counter's cashier at its computer (the game has no cashier
    role). No toilet-cleaner role: the Cleaner does the restroom.
  - **The Cleaner really cleans:** they are in the restroom only when hired, assigned the
    restroom, and a routine restroom job they can do is open (`cleanerRestroomJob`, with its
    tools and supplies). They stand at the fixture with the job's icon for `CLEANING_SECONDS`,
    then App `cleanerCleans` runs `cleanTask(…, "cleaner")` (real supplies, counted in
    `byCleaner`); with nothing left they go.
  - **Six maps:** one artwork per kitchen stage (`kitchenMapArtStage`); `STAGE_SPOTS` holds the
    measured spots per stage (range, aisles, counter computer, two tables, office chair); the
    restroom (`RESTROOM_STOPS`) is the same on all six.
  - `FLOOR_LIFE_ALWAYS_PREVIEW` (false since the developer's testing ended) plays the full
    preview on both floors; the `?floor2` switch no longer adds people.
  - Tests: floor-life QA sections F/G/H; e2e `tools/e2e/restaurantstafflife.mjs`.
- **Economy:** extra on top of the campaign economy (developer decision); not counted in the
  $100k–$150k completionist target.
- **Save:** `SaveData.business.secondFloor = { stations: { [id]: { level, lastCollectAt } } }`,
  optional; absent = nothing owned.
- **Tests:** `restaurant-second-floor-qa` (catalog, accrual / cap / clock, buy / upgrade,
  collect once, saves); e2e `tools/e2e/restaurantsecondfloor.mjs` (L9 locked, L10 visit with every station
  locked, L60 all on sale, buy,
  +2 h collect once, reload, Downstairs, widths 320 / 390 / 768).

## 7. ECONOMY RULES

### Starting wallet $0 (developer 2026-10-26)

A new save opens with **$0** (`DEFAULT_SAVE.credits`; was $1,240): the player earns everything
from Level 1 (≈ $200 after L1). No ledger entry (it is the opening cash, as before). Old saves
keep their wallet (a loaded save always carries `credits`). Nothing early needs money the
first level hasn't paid; a short service is covered as before (rewarded ad or supplier
credit). Restaurant L150: completionist $130,478 (−$2,438 vs phase 4), saver $266,442
(−$1,240), prudent $131,426; the prudent $350 floor holds from when its $500 reserve is first
earned (`minCashAfterReserve`). Classic sims: −$1,240 to −$1,260. The frozen campaign figure
(Net $101,005) is unchanged.

### Gift streak rewards (developer 2026-10-21)

New money, approved: taking the free daily gift on consecutive days builds a
7-day streak (`daily/giftStreak.ts`). The gift that is the week's **Day 3**
also pays a fixed **$100**; **Day 7** pays a fixed **$300** (5× the largest
daily gift). Each is one "daily-reward" ledger entry
(`knifecraft-gift-streak-day<3|7>-<day>`) written in the SAME save as that
day's gift (`takeDailyGift`), and never twice: the gift can only be taken
once a day and the reward only when no entry for that day exists. The day
after Day 7 starts a new week; a missed day starts a new streak at Day 1 —
nothing is charged or taken back. At most $400 a week; the daily gift
($20–$60), order pay, tips and the Replay Bonus are unchanged. The ledger
now keeps gift and streak entries 9 days (was 36 h for the gift) — they are
the streak's only record; no save field.

### Customer tips (developer 2026-10-21)

A tip is real money on top of the frozen campaign economy, like the ad bonuses:
the frozen baseline is for a player who never earns one. The rule
(`economy/customerTips.ts`), with no random numbers anywhere:

- only a campaign order paid for the FIRST time — the settlement's own
  `isReplay` / `mayPayOrder` gate, so a replay can never tip and no order tips
  twice; an order that paid nothing never tips;
- only a Masterful dish (95+: CutEvaluator's grade of the very score the
  settlement used);
- only the 1-in-3 orders picked by a fixed hash of level + recipe + the order's
  place in the level (FNV-1a with murmur3's finalizer — plain FNV-1a picked
  40.5% of the real campaign, outside chance for one in three);
- 10% of that order's own pay, in whole dollars, at least $5.

App credits it in the SAME save as the order's settlement, as its own
`customer-tip` ledger entry (an income category, "Customer Tip"); the settlement
and its `campaign-settlement` entry are unchanged. Over the real 150-level
campaign 71 of 242 paid orders can tip, tips run $12–$68, and if EVERY order
were Masterful they would add $2,151 (1.79%) to campaign income —
`phase2-qa` C9 keeps it at or under 5%.

### Ad bonus money (developer 2026-10-18)

The five ad bonuses (§2) are extra, on top of the campaign economy, like the
Replay Bonus: the frozen baseline and the $100k–$150k completionist target are
for a player who watches nothing (that player gets only the free daily gift,
about $460 over the campaign). A player who takes every offer every day at 10
levels a day ends about $19.5k (14.8%) richer; `ad-bonuses-qa` F1 keeps it
≤ 20%.

### Economy for the 150-level campaign (developer 2026-10-16)

- **Level rewards:** `paidLevelReward` → `curatedLevelReward`,
  `round(50 + 3.1 × (n − 1))` dollars by the new level number; L2 practice $0;
  L150 keeps its stored $5,000. First clears total $46,585 (was $46,318, with a
  zig-zag from the old 250-level bands).
- **Achievements** (`progression/achievements.ts`, shown by
  `kc/Achievements.tsx`): `achievementsFor(save)` = every `MILESTONES` entry
  (same id, same reward) + reward ladders with `ach-<key>-<target>` ids:
  recipes 10/25/50/100/150/all ($200 / $500 / $1.5k / $3k / $5k / $8k), knives
  3/all ($300 / $4k), boards 3/all ($300 / $3k), kitchen stages 2/4 ($2k / $5k),
  services 25/50/100/150 ($500 / $1.5k / $4k / $6k), spotless 1/10/25/50/100
  ($100 / $600 / $1k / $2.5k / $5k), spotless streak 3/7/25/50/100 ($150 / $300 /
  $1k / $2.5k / $5k), pieces washed 100/500/1000/2000 ($500 / $1.5k / $3k / $5k),
  dine-in guests 100/250/500 ($1k / $2.5k / $5k), restaurant days 10/20
  ($1k / $2.5k), daily streak 3/7 ($300 / $700), Endless stars 100 ($10k, after
  the campaign).
- **Collect:** `collectAchievement(save, id)` — reached and unclaimed → credit +
  ONE `milestone-reward` ledger entry (description = the id) + id pushed to
  `economy.claimedMilestoneIds`; otherwise `unknown` / `notReached` / `claimed` /
  `automatic`. `collectAllAchievements` is used by the sim. The App grants only
  the Family Legacy by itself (`grantEarnedMilestoneRewards(save, legacyOnly)`);
  it announces each newly collectable reward once. The Kitchen rank badge, the
  Progress entry and the nav badge show the money waiting. Old saves: anything
  already paid or waived by the V2.5 migration stays claimed.
- **Measured (sim, `economy-final-sim` / `restaurant-final-economy-qa`):**
  completionist Local $132,466, Wholesale $132,664, Premium $133,854 (150/150,
  supplier credit 4 uses, $138 in total); prudent ($500 reserve) $132,473, lowest
  $432 after L10, no credit; never collects $7,662 (150/150, no soft-lock). The
  Second Floor is extra on top and not simulated.
- **Still pinned to the 250-level game** (fail until re-baselined): see HANDOFF.

### Economy V2 is frozen (with the approved V2.5 completion-reward change)

Locked Campaign baseline (enforced by `economy-v2-final-qa`):

- (148 levels since 2026-10-29: Revenue 69,925 · Completion Rewards 245,138 · COGS 16,604 · Quality 1,415 · Net 299,874; the 150-level figures were) Revenue 69,110 · Completion Rewards 46,585 · COGS 16,092 ·
  Quality Bonus 1,402 · Honest Chef Net 101,005 — the 150-level campaign,
  recorded 2026-10-17 (developer's approval of the re-baseline). The
  250-level figures were 165,140 / 77,581 / 37,620 / 3,315 / 208,416.

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
  menu prices follow at 30% food cost of the Economy V3 per-component basis
  (`businessMenu.menuPriceBasis`, unchanged). Since 2026-10-08 a plate uses
  REALISTIC PORTIONS (`business/ingredientMeasures.ts`: one serving per
  physical item prepared — a 0.3 lb tomato, 0.025 lb of garlic, a quarter
  loaf; peel → halve → slice of one onion is one onion), so the real food
  cost (`recipeCostBasis`, what the P&L sees) is ~10 % of the menu price.
  A no-staff Business nets ~$70/day (before the realistic portions);
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
- **Market = purchase, Inventory = stock control, Business = performance.**
  Five bottom-bar sections: Kitchen · Market · Inventory · Business ·
  Progress (`NAV` in `Kitchen.tsx`).
  - **Market → Ingredients** (`MarketIngredients.tsx`) is the ONLY place
    Business stock is bought: all 57 in category groups, today's supplier
    event, contract and Prep Cook pricing through `purchaseQuote`
    (BusinessInventoryManager — the SAME verdict `purchaseIngredient`
    makes, on top of `todaysUnitCost`). Each card shows the wallet effect
    before the tap — "$1,332 → $1,327", from 25 units "You'll have $X
    remaining", "Not enough money — need $X more.", or "Not enough fridge
    space. You have N units of fridge space left."
  - **Inventory** (bottom bar, screen id `inventory`,
    `kc/inventory/InventoryScreen.tsx`) answers "what do I have?" — EVERY
    kind of stock — and has NO purchase controls. A switch at the top picks
    **🥕 Ingredients** (food in the fridge, below) or **🍽️ Supplies**
    (`InventorySupplies.tsx`, screen id `inventory-supplies` opens on it).
    The Ingredients view, in order:
    - header + wallet, "Fridge: <model> · used / capacity";
    - summary cards: Total Stock (units, stock value), Running Low
      (`lowStockItems`), Expiring Soon (`expiringSoon`), Ready to Cook
      (`menuReadiness`, x / 48);
    - Needs Attention, grouped most urgent first (Expired · Spoils tonight ·
      Running low · Low for today's menu · Expiring soon), first group open,
      3 rows each + "View all", every row with Restock →;
    - the physical fridge (below);
    - Ready to Cook + Most needed ingredients;
    - All Inventory: filters (All + the 7 Market groups), sort (Status —
      needs attention first — Quantity, Freshness, Value, Name), compact
      cards (qty, average cost, value, freshness, today's menu need,
      status, Restock →);
    - Stock analytics (stock value, stocked x/57, fridge usage, waste);
    - links: Restock in Market → (`openMarketIngredients` →
      `shop-ingredients`, optionally preselecting the ingredient), Upgrade
      Refrigerator → (Business → Equipment), View Business Performance →
      (Business → Overview).
    - Tapping a crate or card opens a detail sheet above the bottom bar: in
      stock, freshness, days remaining, average cost, stock value, today's
      requirement and what's left after today's service (only for menu
      ingredients, from `menuDemand.perDay`), used by.
  - The view model is `business/inventoryView.ts` (`InventoryItemView`,
    `InventorySummaryView`, attention groups, `sortInventory`) over
    `fridgeView.ts` + `inventoryAnalytics.ts`. Statuses come from ONE rule,
    `business/inventoryStatus.ts` (expired › spoils tonight › critical ›
    expiring › low › healthy), with no threshold of its own: days left from
    perishability (≤ `EXPIRING_SOON_DAYS` = expiring), low =
    `lowStockItems`, critical = low that can't cover one average order
    (`dishesLeft < 1`). Each status shows a marker AND a word.
  - The Supplies view: summary cards (Supplies on hand x/52 lines, Stock
    value at cost basis, Running low, Takeaway orders covered =
    `packagingOrdersCovered`, the smaller of containers and bags on hand);
    Needs Attention kept short (one "Packaging covers N of today's M
    orders" alert, then only packaging lines you stock that `isLowSupply`
    flags, 3 + View all); Smallwares · Tableware (cutlery, crockery,
    glassware) · Takeaway (parcels: containers, boxes, bags) with group
    filters and the stock list (Low / In stock / Owned / None, marker +
    word); "Restock … in the Market →" (`openMarketSupplies`).
  - **Business** (6 tabs: Overview · Equipment · Staff · Suppliers · Menu ·
    Operations) answers "how is my restaurant performing?". ALL staff lives
    in Business → Staff: the waged team (6 roles) and the **Kitchen
    helpers** (`KitchenHelpers.tsx` — Prep Assistant $3,000 L20, Quality
    Chef $6,000 L45, Kitchen Assistant $4,000 L65; one-time, no wages;
    same `App.buyStaff` → `StaffManager.buyStaff`, one "staff-purchase"
    ledger entry). The Market has no Staff tab (developer request);
    `business-ux-qa` S9, `progression-preview-qa` A4, e2e `staff.mjs`. Overview adds
    "Today at a glance" (orders, revenue per dish, margin — from today's
    P&L and `ordersServed`); Operations holds Best-selling dishes
    (`dishSales`, from "business-revenue" ledger entries), Supply
    purchasing (per section: spent, Market orders, saved vs retail;
    packaging used by orders), Ingredient purchasing (`purchasingStats`)
    and Ingredients used (`ingredientConsumption`) — moved from the old
    Business → Inventory and Business → Supplies tabs, which no longer
    exist (no `business-inventory` / `business-supplies` routes; inventory
    alerts open `inventory`). The last completed day's full P&L is
    `lastDailyPnL`; the latest 30 completed days are kept in the optional
    `business.finance.history` (`business/businessDayHistory.ts`, written
    only by `closeBusinessDay` from the day's own DailyPnL + orders served;
    a save without it has an empty history) and listed on Operations ("Last
    30 days"). There are no weekly/monthly roll-ups beyond that.
  - The daily accumulator's `inventoryPurchases` counts purchases (one per
    "inventory-purchase" ledger entry; old saves migrate it as 0).
- **HARD RULE — Inventory is read-only.** The Inventory screen (the
  physical fridge included) is a read-only representation of the player's
  actual saved inventory. It must never keep its own stock, prices, money,
  freshness or any other economy state (only view selections: filter,
  sort, the open item); every figure comes from the existing save/economy
  systems (`business.inventory`, perishability, pricing,
  `RefrigeratorManager`, the ledger). Market is the ONLY place ingredients
  are bought; Business → Equipment is the ONLY place fridge upgrades and
  repairs happen. Flow: Market buys → Inventory observes → Menu consumes →
  Business analyzes → Equipment improves capacity/operation. Guarded by
  `business-ux-qa` S8, `inventory-market-qa` 1, `fridge-view-qa` H1/I1 and
  `inventory-screen-qa` R1–R4.
  - The ONE exception: **Throw Out Expired** (`business/discardExpired.ts`,
    a two-step confirm under Needs Attention). It runs End Business Day's
    own sweep early: only expired entries go, valued with the same
    multipliers, recorded as waste (spoilage totals + the day's
    `discardedQuantity` / `discardedValue`, which End Business Day adds to
    its sweep for the inspection and the P&L waste line). No credits move,
    no ledger entry. Guarded by `inventory-screen-qa` D1–D5 and e2e
    `inventory.mjs` 7b.
- **Physical fridge** (refrigerator UI handoff, a UI integration — not
  V3-17) on the Inventory screen: `kc/inventory/fridge/PhysicalFridge.tsx`
  - `.css`, fed by the read-only adapter `business/fridgeView.ts`. An open
    reach-in: Dairy & Tofu on the top shelf, Vegetables in the middle, Meat,
    Fish & Bread low, Fruit and Greens & Herbs crisper drawers, Butter and
    Aromatics in the door (production has no eggs, sauces or oils, so no egg
    tray or sauce rack). One crate per ingredient (quantity, aggregate
    freshness from the weighted `purchaseDay`, days left); production tiers
    (Basic 40 / Commercial 80 / Professional 140, prices from
    `refrigeratorDefinitions`), drawn after the developer's design
    references (refrigerator handoff `design-assets/`, CSS only — the 3 MB
    mockups carry sample numbers and are not shipped): **Basic** a vintage
    cream-enamel single-door with its door open on the right; **Commercial**
    a stainless two-door reach-in (two compartments, both doors open: Butter
    left, Aromatics right); **Professional** three compartments (Dairy +
    Meat/Fish/Bread · Vegetables · Greens + Fruit drawer). Food sits in
    wooden crates (1–3 pieces shown by quantity) with cream tags, zone names
    on wooden signs, glass shelves and crisper drawers. Every shelf and drawer
    holds at least two crates per row (developer: arrange two to a row rather
    than make the fridge taller): steel compartments are 214 px, Basic crates
    shrink to 64 px on narrow phones (set on `.kcf-unit` — a container query
    can't style its own container), and drawers sit side by side only while
    each still fits two crates, otherwise they stack full width
    (`fridge.mjs` check 9). Its header shows the
    model, used / capacity, units available and the cooling line, a status
    from the real condition ("Refrigerated" / "Needs service" / "Broken"),
    never a temperature (the game does not simulate degrees, so no °F/°C may
    appear), and "Upgrade / Service / Repair Refrigerator →" (Business →
    Equipment, `business-refrigerator`, which owns `purchaseRefrigerator`
    and maintenance). The fridge is display only: a tap calls `onSelect`
    (the Inventory screen's detail sheet). The Basic always fits its frame.
    On a phone (below the 768 px breakpoint) a steel model wider than its
    frame shows ONE door or compartment at a time (task #14): "‹ name n / N
    ›", 48 px buttons, a sideways swipe or mouse drag (never opening an
    item), page dots, opening on the first compartment; vertical scroll
    still works. On a tablet/desktop the wide steel models pan sideways
    inside the frame ("›" cue + "Swipe to see every door →", touch and mouse
    drag) without blocking vertical scroll. A "Show the whole fridge" / "One
    door at a time" toggle switches wherever it doesn't fit. Same crates,
    data and actions in both views (`fridgepager.mjs`).
    The door handle is decorative (`pointer-events: none`, in the door's own
    18 px edge). Business → Equipment's cards use the same small drawings
    (`FridgeMini`) and show the capacity gain (▲ +40). Unknown inventory ids
    are listed, never dropped. `HANDOFF_INGREDIENT_ID_MAP` maps the
    handoff's 57 ids.
    QA: `fridge-view-qa`, `inventory-screen-qa`, `tools/e2e/fridge.mjs`,
    `tools/e2e/inventory.mjs`.
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

### Business Supplies (separately authorized extension — not V3-17)

Master spec §25. V3's phase sequence stays closed; this is its own scope
with its own gates.

- **Catalog** — `business/businessSupplies.ts`: 52 lines.
  - Culinary smallwares 18, tableware 17, takeaway packaging & hygiene 17
    (dish soap and cleaning liquid added by Unified Restaurant phase G, in
    "Securing & hygiene"; their prices are from WebstaurantStore's listing
    on 2026-10-04 — re-check them in the economy pass). A bottle line is
    "low" only with no bottle in stock.
  - Every retail pack price comes from a WebstaurantStore product page
    (retrieved 2026-10-02, recorded per line and in §25).
  - Game price = round(retail × 0.65), the ingredient rule.
  - No prep knives or cutting boards (they stay in Knives / Cutting
    Boards). Never ingredients, never in the fridge.
- **Data** — `SaveData.business.supplies` = `{ stock: { id: { units,
costBasis } }, lifetime per section }`.
  - New and old saves start empty (no prototype opening stock).
  - `migrateBusinessSuppliesState` in `SaveManager.load`.
- **Purchase** — Market only (`MarketSupplies.tsx` → App `purchaseSupply`
  → `BusinessSuppliesManager.purchaseSupply`).
  - All-or-nothing: known id, 1–99 whole packs, funds.
  - Then exactly ONE ledger entry and one persist.
  - Smallwares and tableware: `supply-equipment-purchase`, capital
    (`capitalExpenditure`), never used up.
  - Packaging: `supply-packaging-purchase`, a stock asset with its own
    `packagingPurchaseCost` accumulator/lifetime line. Ingredient
    purchasing analytics stay food-only.
- **Packaging use** — every served Business order uses one container and
  one carry bag (priority lists, first in stock), inside
  `serveBusinessOrder`.
  - Their cost basis is added to that order's COGS.
  - None in stock: none used, never blocking.
- **Inventory → Supplies** (`kc/inventory/InventorySupplies.tsx`, screen
  `inventory-supplies`) is monitoring only:
  - on hand, stock value (cost basis), running low, takeaway orders
    covered;
  - low packaging (below today's customers) and packaging coverage;
  - the stock list;
  - "Restock … in the Market →" (`openMarketSupplies` → `shop-supplies`).
  - Spending (spent, saved vs retail, used by orders) is on Business →
    Operations ("Supply purchasing").
- **Saved vs retail** = retail value − paid: a display metric, never money.

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
- **Story pause** — the finale's beat timers and the milestone banners'
  dismiss timer count unpaused time only (`usePausableTimeout` over
  `game/story/pausableCountdown.ts`, following `PauseManager`); while
  paused their CSS animations freeze (`kc-story-paused`) and finale taps are
  ignored. The finale's last button, "BACK TO THE KITCHEN", ends on the
  Kitchen home screen (`App.finishFinale`; developer decision #21). Every
  path that plays the finale has already paid and saved the level.
- Milestones at 10/20/45/70/110/120 and the Level-100 finale are unchanged.
  **Story for Levels 121–250** (developer 2026-10-11, text approved
  verbatim): milestones at 140 "A NAME IN TOWN", 165 "THE NEXT GENERATION",
  190 "ONE OF THE BEST", 220 "THE OLD RECIPE BOOK" (mask bits
  128/256/512/1024), and at 250 **THE LAST PAGE** — `LEGACY`, a 4-beat
  `StoryOverlay` sequence like the finale (existing `keys` / `dining` art),
  gated on mask bit 2048; it retires the old one-line 250 "CAMPAIGN
  COMPLETE" banner (bit 64, marked with it). Order at 250: THE LAST PAGE →
  the Level Complete card → the Family Legacy $50,000 banner, once each; no
  interstitial or Replay Bonus behind it (`afterLevelFinished`), Closing
  Time held while it plays. Its flag is saved before it shows
  (`applyStoryFlush`), so a dismissal, reload or replay never repeats it.
  A save that finished 250 before it existed plays it once on the next load
  (`legacyPendingOnLoad`; no money or ledger change). **Catch-up**
  (`StoryManager.CATCHUP_WINDOW` = 10): a milestone more than 10 completed
  levels behind is marked seen silently; at most one banner per completion
  (the newest in the window); the finale and THE LAST PAGE are never
  skipped. The story never names "Grandma" ("they"), never reuses the
  finale's frozen lines. `SaveData.story = { introDone, milestoneMask,
finaleSeen }` — no new fields. QA `story-legacy-qa`; browser
  `tools/e2e/legacy.mjs` (classic, finishing the 250th level) and
  `restaurantlegacy.mjs` (restaurant, the on-load path).
- **First load (W2, developer 2026-10-12):** a new player's intro runs alone
  — Level 1 is not mounted under it (no hidden Phaser scene); its kitchen
  picture (`KitchenPlate`, the same `kitchen-bg.jpg` framing Preparation
  draws) lies underneath, so the outro dissolves into it, and is the
  gameplay Suspense fallback while the engine loads. The Preparation chunk is
  fetched 1.2 s into the intro (`INTRO_PRELOAD_DELAY_MS`); `game_ready` is
  sent on the intro's first frame (still once). Measured (local, slow-phone
  emulation 1.6 Mbps / 4× CPU): game_ready 6.3 s → 0.63 s. Not done: moving
  the campaign data (levels, recipes) out of the startup chunk — 27 modules
  import it synchronously, several build catalogs at load; a separate,
  approved refactor. Guards: `lazy-load-qa` L4/L5, e2e `firstload.mjs`.
- **Sound (W3):** `AudioManager` has an effects bus and a music bus; named
  synthesized effects (`playSfx`: tap, coin, till, bell, plate, delivery,
  lightsOff, squeak, levelComplete, story) from existing hooks (KButton,
  ledger growth in App, Preparation mount, MorningDeliveries, Closing Time,
  cleanliness actions, story events); a seeded kitchen-jazz loop
  (`setMusicMood`: kitchen, cutting = ducked, night = Closing Time, off =
  intro / finale / THE LAST PAGE), never before a user gesture, one loop,
  silent while paused (the platform's pause covers a hidden page — preflight
  forbids our own Page Visibility use), during an ad or with platform audio
  off. Settings: Sound and Music toggles (the existing `settings.music` key).
- **Story polish (W4):** the outro dissolves into Level 1's kitchen (above);
  beats may declare `fx` (dust / spark / coins) — CSS particles, off under
  reduced motion (THE LAST PAGE uses dust and spark; the finale is
  untouched); dialogue portraits 88 px; card text ≥ 11–12 px; light lines on
  the dark "decline" tint; milestone banners sit below the screen headers
  (`top-[13%]`) and wait for the Level Complete card (the finale and THE
  LAST PAGE still come first).
- Intro screenshots: `playgama/screenshots/intro/`.
- **Cooking clip** — after EVERY preparation, once the chef's hands have
  carried the plate away (RECIPE_COMPLETED) and before the Knife Report,
  `src/components/kc/game/CookingClip.tsx` plays one of six short chef
  films, each 540×960 WebM + MP4 (~0.25–0.65 MB) with a `-poster.webp`:
  **fruit-cup** (`chef-fruit.*`, 3.84 s, from `Fruit cups.mp4`: 2.13–4.46 s
  spooning → 6.50–8.00 s honey drizzle), **salad** (`chef-salad.*`, 2.97 s,
  from `Salads.mp4`), **plating** (`chef-plating.*`, 3.84 s, from
  `Plating.mp4`: 1.42–3.25 s tomato slices into a bowl → 8.0–10.0 s herbs
  and the pull-back over the plated counter), **curry-pot**
  (`chef-curry.*`, 3.67 s, from `Curry.mp4`: 2.04–3.96 s spoon stirring the
  curry → 6.04–7.79 s the chef over the big steaming pot), **bread**
  (`chef-bread.*`, 4.0 s, from `Bread.mp4`: 3.0–7.0 s — tomato spooned
  onto toasted bread, then hands finishing the crostini board) and
  **chef-cooking** (stove,
  `chef-cooking.*`, 3.75 s). `src/game/recipes/dishKind.ts` `dishKindFor(recipeId,
name)` decides, in order: **fruit** (every ingredient a Fruit, or a
  Business Dessert — 11 recipes, Level 84); **salad** ("Salad"/"Slaw" in the
  dish/recipe name, or a Business Salad — 14 recipes, Level 10);
  **curry** (curry, masala, chutney, minestrone, velouté, soup, French
  onion, dal, stew in the name, or a Business Curry — 18 recipes,
  Levels 51–69, Level 58);
  **bread** (the recipe uses bread or a baguette, or bread, toast,
  bruschetta or crostini in the name — 11 recipes, Levels 11–13, 18, 26,
  29, 30, 49, 74, 80; e2e Level 11);
  **cooked** (a Protein ingredient, a cooking word in the name — stir-fry,
  wok, sauté, rings, gratin, bread, toast, bruschetta… — or a Business
  Stir-Fry/Entree — 103 recipes, Level 36);
  else **plated** (cut-and-plate dishes — 75 recipes incl. Levels 1–9). The clip
  buffers from PLATING_STARTED, is
  skippable (SKIP › or a tap, 800 ms guard), pauses with PauseManager,
  (the plating and the chef taking the plate before it can be fast-forwarded
  by a tap only from 1.2 s after the last action — `PLATING_SKIP_GUARD_MS`,
  so an extra tap after the last cut does nothing — and a skipped plating
  plays no plate chimes; browser `tools/e2e/platingskip.mjs`; the plate sound itself is a soft low sine phrase, at most one every 200 ms — HANDOFF 50),
  is muted unless `AudioManager.soundAllowed`, and falls straight through
  on error / stall / `prefers-reduced-motion`. All six sources carry the same
  AI watermark (centre 600,1160 of 720×1280), painted out with ffmpeg
  `delogo` (`x=562:y=1122:w=76:h=76`, then scale 540:960; H.264 crf 27 /
  VP9 crf 38), and the SKIP › pill sits over that spot. Source uploads:
  `gemini_generated_video_aa3f242a - Trim.mp4`, `Salads.mp4`, `Fruit cups.mp4`, `Plating.mp4`, `Curry.mp4`, `Bread.mp4` (on `main`).

- **Beginner coaching** (`src/game/coaching.ts`) — a ghost demonstration
  on the board plus a how-to card. PreparationScene draws it
  (`scenes/coachGhost.ts`, its own Graphics layer at depth 29) exactly where
  the next tap would really cut, using the same axis, slot and position rules
  as `resolveTapCut`:
  - cutting: the line glows, then a 3 s loop shows both ways to cut, each
    labelled by the fingertip. **SWIPE**: the fingertip draws along the
    line while a see-through copy of the equipped knife (the same
    `scenes/knifeProfile.ts` silhouette as the real knife) brings its
    knife along the line, held from the right hand and seen from above,
    with the middle of the edge on the fingertip, exactly like the real
    swipe. **TAP**: the
    fingertip taps with a ripple and the knife makes the real tap stroke
    (`tapStrokePose`, below);
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
    - Only TAUGHT steps get it: each technique in the one level that
      introduces it (slice 1, chop 3, peel + halve 5, dice 6, smash 9,
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
    grind bevel, sheen, honed edge and spine. It uses fills only: Phaser's
    WebGL stroke breaks lines this thin into dots (an edge that looked
    serrated), so outlines and edge lines are filled bands.
  - Blade shape: a straight spine that curves smoothly down to the point;
    an edge that is flat from the heel and then sweeps up (the belly
    starts at `bellyControlXFrac`); a full bolster with a finger guard.
    - Chef / Damascus / Obsidian / paring: the point sits near the spine.
    - Santoku: sheepsfoot, the point at edge level.
    - Nakiri, cleaver: a square front (`tipRiseFrac` 0.5).
  - It is used by the in-game knife (PreparationScene.drawKnife), the
    coaching ghost and the Market icon (`KnifeGlyph`, the same shapes as
    SVG).
  - Proportions follow the real knives (`knifeDefinitions.ts`, in 1/540 of
    the scene width): the chef's blade is about 1/5 as tall as it is long,
    with the handle a little over half the blade, and a negative
    `tipRiseFrac` lifts the point toward the spine.
  - Every knife is drawn `KNIFE_DRAW_SCALE` (1.2×) that size (developer:
    "a little longer and bigger"). Blade, height, handle and the handle's
    thickness limits all scale together. It affects drawing only, never
    the cut geometry.
  - The resting knife lies flat, centred under the ingredient: on the board
    below it, or on the counter in front of the board when there's no
    room — never across the food.
  - **Cutting motion** (`knifeProfile.ts`). The reference is the
    developer's point-of-view photos of a cook slicing a tomato.
    - **Held from the right hand** (`knifeTipDir`): the knife always lies
      along the cut and the handle comes from the cook's right hand, at
      the lower right. The tip points away from that hand.
      - Vertical cut: tip up, handle down.
      - Horizontal cut: tip left, handle right.
      - A "\" diagonal: tip upper left.
    - **Seen from above** (`topViewProfile`, `CUT_SQUASH` 0.32): while it
      cuts, the knife stands on its edge. The blade is foreshortened, so
      you see the spine and a sliver of the face, never the flat side; the
      handle stays round. At rest it lies flat (full profile). A leftward
      tip is drawn mirrored (`poseForTipDir`), never upside down. When the
      knife has to face the other way, dirSign eases through 0, so it
      turns over in the hand.
    - **Tap** (`tapStrokePose`): the knife snaps onto the line, with no
      per-cut tilt. The point `TAP_CONTACT_FRAC` (0.22) along its edge sits
      at the line's middle over the food, so the blade covers the food and
      the handle doesn't hang down the board. The knife waits poised in
      the same place between cuts. It lands and makes one short back-and-forth slice along the
      line (8% of the blade). The cut is committed at the end of the
      stroke: 285 ms (slice) / 150 ms (chop) after the tap, using the
      existing TAP_KNIFE / CHOP_KNIFE timings. Then it lifts (Chop to its
      hover pose, Slice back to rest, lying flat).
    - **Swipe**: the knife moves with the finger, the middle of its edge
      under it, lying along the drag line with the same right-hand grip.
      - Right to left is a push cut, tip leading; left to right is a pull
        cut. A vertical drag gives a vertical knife, tip up.
      - It turns continuously with the drag's line; hysteresis near the
        tie stops it flipping.
    - The pivot (local origin) is the heel of the edge by the bolster.
    - The coaching ghost uses the same functions.
    - Rejected earlier variants, gone:
      - the knife drawn flat (side-on) while cutting;
      - a tip-leading "pointer" swipe that put the handle away from the
        cook;
      - a diagonal "rocking" stroke;
      - the knife across or along steep cuts.
    - `scripts/knife-stroke-qa.mts` checks all of this, plus the wiring.
  - **Cut plan** (`src/game/cutPlan.ts`; the rules and their sources are
    in `docs/KNIFE_RULES.md`).
    - Direction (`primaryCutAxis`): cut lines run ACROSS the food, i.e.
      vertical lines like Level 1's tomato. Horizontal lines only for
      julienne's lengthwise strips (`cutsLengthwise`), Dice's cross cuts
      (after its vertical slices) and a food taller than 1.35 × its width.
      An ingredient's `axisOverride` still wins. `technique.axis` is no
      longer consulted.
    - Order (`nextCutIndex` / `nextOpenPosition`): right to left, the claw
      hand stepping back. Horizontal sets start nearest the cook. The
      coaching ghost and the cards teach it. A tap still cuts where it lands.
    - Between cuts the knife stays poised on the last cut, stood on its
      edge (`runTapCut`'s stepDone, `poiseKnifeOn` after a swipe). It is
      laid down when the step ends (`layKnifeDown` in `beginStep`).
    - `scripts/cut-rules-qa.mts` checks every level.

---

## 10. UI

### Phone landscape (developer 2026-10-22)

"Optimize the game for mobile landscape layout; there are landscape images … integrate."

- **When:** `isPhoneLandscape(w, h)` (`kc/game/layoutMode.ts`): aspect ≥ 1.3 and height
  < 640. A phone on its side. Tablets and desktop windows keep the framed 9:16 portrait
  game; portrait is unchanged (every landscape style is behind `land:` / `[data-orient]`).
- **Shell:** `GameShell` fills the whole screen (safe-area insets left/right), sets
  `<html data-orient="landscape">` (the Tailwind `land:` variant, `styles.css`) and a
  `LayoutContext` (`useLandscape()`). Below `LAND_MIN_H` (320) the UI is laid out at
  320 and scaled, like `MIN_LAYOUT_W` in portrait. One wrapper at every size: turning
  the phone never remounts the game.
- **Navigation:** `BottomNav` becomes a 76 px rail on the left (`--kc-rail`); siblings
  start after it (`styles.css`); the `pb-24` room for the bar and the map's 72 px are
  dropped; the scroll cue, lock hint and Grandma's section pointer sit beside the rail.
- **Screens:** Kitchen home: HUD in one row, the order card at the bottom (max 640 px),
  shortcuts at the right; Market: shorter banner, categories in one row of 6; Business:
  tabs in one row; Inventory / Business banners shorter. Sheets and result cards
  (`Modal`, Pre-Service Check, Closing Time, Knife Report, Order Complete, Service Order
  Complete) are centred, at most 560–680 px wide, scrolling inside.
- **Landscape art** (`public/landscape-art/`, `LANDSCAPE_ART_CLAUDE.md`,
  `game/landscapeArt.ts`): the restaurant painting behind the Restaurant map and the
  Second Floor (`LandscapeBackdrop`, dimmed); the cleaning rooms (below). Loaded only in
  landscape.
- **Cutting:** the Phaser canvas stays portrait (`PreparationScene` sizes the food by the
  width): `.kc-prep [data-game-viewport]` is 0.912 × the height wide and 120 % tall
  (empty top and bottom cropped), right of the order card; the how-to / guide cards
  (`kc-prep-side`) sit under the order card, off the board; the HUD strip passes touches
  through. Phaser reads the canvas box, so cuts land exactly. The cooking clip plays
  whole in a 9:16 box over a blurred copy of its poster.
- **Prep Rush:** `PrepRushScene` sizes the food, belt and bins by `min(width, height)`
  (portrait: the width, as before).
- **Cleaning:** a job opens on its 16:9 painting when that painting shows it
  (`landscapeCleaningSupports`: the toilets of the last three tiers are behind stall
  doors, so those toilet jobs keep the portrait room). `LAND_GEO` (`cleaningDirt.ts`):
  per tier the measured surfaces in a 960×540 scene; `makeStains(…, orient)` /
  `stainMarks(…, orient)`; portrait dirt unchanged. Chosen once per cleaning, so turning
  the phone keeps the dirt and progress. The title, tools and progress sit in a 232 px
  column right of the room.
- **Tests:** `tools/e2e/landscape.mjs` (8 checks at 568×320 … 932×430, the map art, the
  cut, the cleaning, rotation mid-level), `cleaning-dirt-qa` L; `solver.mjs`
  `geometryFromCanvas` aims from the canvas's own box.

### Glance copy (developer 2026-10-23)

"Players won't read big sentences … show the full sentences only if very important, if not
make it short or show the issues with emojis." Builds on the 2026-10-16 short-copy rule
(`ui-copy-qa`, InfoTips).

- **Data copy gets a glance line**; the full sentence stays as data, behind an ⓘ (or a
  `title` / screen-reader text):
  - `BusinessAlert.glance` (`businessAlerts.ts`), e.g. "🗑️ 🍞 🥖 · use today" and
    "⏳ 🧊 🔧 🧹 🛡️ · 5 checks · 💸 $55 if again tomorrow". Operations shows
    title + glance + ⓘ(detail), and the business notice banner shows the glance.
  - `CategoryInspectionResult.glance` (`businessInspection.ts`, `hygieneGlance`): the
    inspection card shows "2 / 7 checks", a row of seven check icons (✓ / !), the failing
    checks as icon · name · glance · ⓘ(reason), and the passed ones as chips
    (`INSPECTION_CATEGORY_ICON`).
  - `AttentionRow.glance` (`restaurantAttention.ts`): "🐟 Salmon Fillet · 0 / 0.4 lb";
    the row's full `text` is kept for screen readers.
  - `restaurantNewsAt().comingUp[].short` ("🌍 Korean · 👨‍🍳 Asian Chef");
    `supplierEventGlance` ("📈 +10% prices · 📦 max 5").
- **Lists become chips or counts:**
  - the Pre-Service Check's staff and tools to buy are chips (`NameChips`);
  - the ready tools are "✓ N tools ready ▸" (`<details>`);
  - the Hire buttons name at most two roles;
  - a menu dish's ingredients show as emoji + amount;
  - the "New on the menu" dishes are chips; the Market plan's "later, no room" list is
    emoji (name on hover).
- **Have / need is "📦 have / need"** everywhere: the Market need note (ingredients and
  supplies; menu guests' rows add "optional ·"), the Pre-Service Check's ingredient and
  supply rows ("📦 0 lb / 0.5 lb (≈ 1 breast)", "📦 0 / 1 · 1 pack of 12").
- **Pre-Service Check glance layout** (`restaurant/PreServiceCheck.tsx`): day / level and
  title are compact; tickets use small dish cards; missing ingredients stay visible with a
  direct Restock action, while ready amounts are folded under one stock-details toggle.
  Menu-guest extras start folded as optional, and tools, supplies, cleaning, staff and fridge
  checks retain their existing actions and blocking rules. All stock, costs and status values
  still come from the existing game checks.
- **One row look for every list** (2026-10-23, "optimize the looks of pre service check"):
  ingredients, kitchen tools, service supplies and the soap / cleaning bottles
  (`SupplyBottle compact`) are the same tinted card rows: icon plate, short name, a
  "📦 have / need" line with the size split off the name ("Fine mesh skimmers" ·
  "📏 5 in"), and a compact action (a tool's two-line "Buy · $13.61" / "1 pack of 6").
  The staff list is portrait tiles (`business/staffPortraits.ts`), two a row when the
  sheet is ≥ 300 px wide (container query), one below. "Tools to buy" and "Coming up"
  are chips, at most six with "+N more". The ingredient button's word "Restock" is
  screen-reader text beside the 🛒. The menu guests' ⓘ sits beside its toggle, not inside
  it (a button can't hold a button). Button labels (developer, 613d3a4): "🔥 Start
  service", "🚪 Open restaurant", "🛒 Restock to start", "👥 Hire staff to start".
- **Short number lines:** a menu card's "⭐ 50 · ×1.05 · 92.6% kept" (the sentence in its
  `title`); staff wages "🆓 Free until Lv N · ½ pay to Lv M · then $X/day".
- `ShopLine` flows its icons inline with the text, so an icon never wraps onto its own line.

### Image size budget (developer 2026-10-23)

"Make sure all the images in the full game are of low size." Every bundled image was
re-encoded (same file names, formats and aspect ratios, so no code changes): 126 images
20.5 MB → 10.6 MB (dist images 20.0 → 10.4 MB, dist 29 → 19 MB). Rules for new art:
- full-screen paintings (cleaning rooms, landscape sections, kitchen skins, banners): long
  side ≤ 1440 px (1.5× the 960 frame), WebP quality ~72;
- the restaurant maps keep their size (the map zooms), WebP ~78;
- the story intro keeps its native 941 × 1672 (`story-intro-qa` A23), WebP ~76;
- staff portraits ≤ 320 px (shown ≤ 150 px), WebP ~78; thumbnails / clip posters as they are;
- a file is only replaced when it gets ≥ 10% smaller.
The largest image is now ~245 KB; the videos (six clips, ~4.5 MB) are unchanged.

### Inventory in pictures (developer 2026-10-23)

"Make the need attention with emojis or photos of what items need to be restocked … optimize
the inventory fully with less texts and numbers but with full pictures and emojis (do not
remove anything important)."

- `kc/inventory/ItemTile.tsx`: `ItemPic` (the item's emoji on a warm round plate, toned
  urgent / low / ok / none, with a corner badge), `AmountChip`, `ItemTile` (one ≥ 48 px
  button: picture, short name, amount, "Restock ›"). The game has no per-item art; the
  pictures are the Market cards' emoji.
- **⚠️ NEEDS ATTENTION** (`RestaurantAttentionPanel`): a 3-column grid of tiles (⛔ urgent /
  🟠 low badge, "0 / 0.3 lb", "Hire ›" / "Fridge ›"), 6 before View all, ⛔ N · 🟠 N in the
  header. `AttentionRow` gained `icon`, `name` (supplies without their size) and `amount`;
  the full sentence stays as the tile's label and screen-reader text.
- **Ingredients:** the Ingredients / Supplies tabs are the stockroom pictures (the separate
  stock-art banner is gone); the fridge pill has a fill bar; the summary is four icon tiles
  (💰 stock value · ⚠️ running low · ⏳ expire soon · 🍽️ dishes ready, sentences in the
  title); the ingredient Needs Attention groups are tiles (🗑️ Expired · 🌙 Tonight · ⏳ Nd ·
  have / need) with 🛒 Restock; All Inventory is a 2-column picture grid (status pill,
  amount, freshness bar + ⏳ Nd, 🍽️ today's need, 🛒 Restock). Price and value moved to the
  card's label and the details sheet, which shows the same plate.
- **Supplies:** icon stat tiles; "👤 🍽️ 🍴 🥛 per guest · 🫧 each service"; the alerts are
  tiles (packaging coverage + 3 lines, View all); every supply is a 3-column tile (picture,
  short name, units, bar, status), its group and price in the title.
- **Descriptions behind ⓘ:** fridges, kitchen upgrades, achievements, the ordered dish.
  Kitchen upgrade benefits read "⭐ +7% earnings · 🪑 +2 guest seats" (built in
  `KitchenUpgrades.tsx`; `kitchenTierBenefit` is unchanged).
- **Guard:** `tools/e2e/longcopy.mjs` crawls every screen at Levels 25 / 70 / 100 and fails
  on a visible line over 12 words (ⓘ bubbles and screen-reader text excluded).

### Staff portraits and roster cards (developer 2026-10-23)

- `BusinessStaff.tsx` presents the six waged roles as portrait cards with their actual
  wage, effect, status and hire / let-go action. The summary still uses the authoritative
  `dailyPayroll`; `STAFF_RULES`, `staffFocus`, unlock conditions, and save state are unchanged.
- The four cuisine specialists use matching portraits and retain their existing unlock,
  cuisine, free-hire and wage rules. Needed roles remain highlighted from the Pre-Service Check.
- Portraits are visual only in `public/business/staff-portraits/`: `prep-cook.webp`,
  `line-cook.webp`, `head-chef.webp` (an older male chef), `server.webp`, `cleaner.webp`,
  `manager.webp`, plus `specialist-{mexican,indian,mediterranean,asian}.webp`.
- The six-role roster and specialist chefs use a two-column card grid. On narrow screens,
  each portrait sits above the role details; wider screens place it beside them. Cards retain
  clear role/effect/pay lines, visible hired / needed states, and 48 px hire controls.
- Kitchen helpers use the same two-column portrait-card treatment, reusing the matching
  staff portraits. Their one-time purchase prices, unlocks and effects are unchanged.
- **One card kit, laid out by the card's own width** (`business/StaffCard.tsx`, developer
  2026-10-23 "fix the card like in the image"): `StaffCard` (crew, kitchen helpers) and
  `StaffRow` (specialist chefs) use container queries, never window media queries — the
  game is a fixed 540 frame, so the old `min-[700px]` rule squeezed cards on desktop and
  the name, HIRED pill and ⓘ overlapped. A card ≥ 200 px wide puts the portrait left
  (44%) and the HIRED pill, name + ⓘ, effect and pay ("🪙 $35.00/day now" over
  "$70.00/day from Lv 56") right; narrower, the portrait is on top with the pill on it.
  The Hire / Let go button spans the bottom. A specialist row puts its button on the
  right from 380 px, below it otherwise; a single cuisine isn't repeated under the title.

### Market shop cards (developer 2026-10-21, redesigned 2026-10-22)

"Make the ingredient shop card exactly like this … improve all the shop cards."

- One card kit, `components/kc/market/ShopCard.tsx` (+ `.shop-card*` / `.shop-stage*`
  in `styles.css`), used by every Market card: Ingredients, the four supply sections,
  Knives, Cutting Boards, the Second Floor machines and floor team, and the Blacksmith
  upgrades (those have no picture, so they are not `product-card`s).
- **Look:** a wooden frame with brass rivets; the name on a hanging cream plank with
  ropes and leaves; the picture (`common/ShopItemArt.tsx`), a warm market stall with lamp
  light: ingredients pile in a produce crate with a checked cloth and a chalkboard by
  their group ("Fresh Produce", "Baked Today" …), everything else stands on the counter;
  the dark green stock / owned pill (`StockPill`) top right; a parchment body.
- **Body:** the price on a coin pill (`PricePill`), the details lines (`ShopLine`:
  "1 kg ≈ 7 tomatoes", "🕒 7 days · 🍽 11 dishes", a supply's pack size), the wooden
  − / + stepper (`WoodStepper`, 48 px buttons), the bulk sizes as crate tiles
  (`BulkPresets`: 5 and 10 with their discount; 1 / 2 are on the stepper), the green
  leaf Buy button (`BuyButton`: go / short / done / wood), the wallet before → after
  (`WalletLine`). Every number is still the card's own quote.
- **Sizes:** two cards a row on a phone (a narrow card drops the basket and trend icons,
  `@container`), one a row under 360 px, three in phone landscape. Pictures 128 px
  (108 px under 360 px), the item ≥ 56 px.
- Browser: `tools/e2e/shopart.mjs`.

### The service floor: the customer's walk — Transformation Phase B (developer 2026-10-25)

- **What the player sees** (restaurant build, every service order: campaign tickets,
  menu guests, batch views, Business / Endless orders). The order opens on the dining
  room, cropped from the built stage's map painting (`kitchenMapArt.ts`). Then:
  - the customer walks in through the front door and sits;
  - their real dish shows in a bubble;
  - "🔪 Start cooking", or a tap anywhere, opens the cutting board.
- **After Serve:** the plate travels from the pass to their table, and their face follows
  the dish's real grade (`REACTION_FACE`). Then the existing serve card shows, with its cash.
- **Next Customer / a menu guest** advance at once. The customer who left walks out from
  the other table during the next arrival. Finish Level goes straight to Level Complete.
- **Files:** `game/restaurant/serviceFloor.ts` (pure) and `kc/game/ServiceFloor.tsx` +
  `serviceFloor.css`. Preparation's `floor` prop is given by App in the restaurant build only.
  - `serviceFloor.ts` holds the seats, walks and pass per stage, measured on each painting
    (door x 50 / y ≈ 81, front-row chairs), and the timings.
  - Seats alternate per order (`seatForOrder`). The leaving customer is kept in session
    memory (`noteDeparting` / `takeDeparting`, stale after 30 s).
- **Presentation only:**
  - it never serves, pays, advances or saves;
  - Serve calls the existing `service.onServe` once, and the plate shows only for a real serve;
  - no save field; the Business Day still runs only after Level 150 (`businessDayAllowed`).
- **Reduced Motion:** no walking, the end state at once. Any tap skips ahead, once.
- **Cooking:** the existing cooking clip still plays after the cut. No new interactive
  cooking step yet (proposal in `docs/reports/TRANSFORMATION-PHASEB-2026-10-25.md`).
- **Tests:** QA `service-floor-qa`; browser `tools/e2e/servicefloor.mjs` (F1–F8) and
  `servicefloorstages.mjs` (all six stages at 320/390/768, plus Reduced Motion). The shared
  e2e solver and phase4's `startOrder` tap through the arrival.

### The interactive oven — Transformation Phase C (developer 2026-10-25)

- **Recipes:** `game/cooking/ovenStep.ts` (`OVEN_STEP_RECIPES`) lists them, covering every
  order of each: campaign, menu guest, Business. Garlic Bread (L5); Phase D added Tomato
  Basil Toast (L6), Mushroom Bruschetta (L7), Bruschetta for the House (L12), Family
  Antipasto for Two (L15) and Bruschetta Trio (L17); Phase E the four baguette dishes:
  Avocado Baguette Toast (L47), Baguette Rounds, Baguette & Cheddar Rounds and Baguette
  Crostini Prep (these three are on no level today). Not in the oven: the Potato & Onion
  Gratin Prep and the Peach & Cheddar Board.
- **The tray:** `trayItemFor(recipeId)` gives 🥖 for `BAGUETTE_TRAY_RECIPES`, 🍞 for every
  other recipe; Preparation passes it to `OvenStep` (`tray`), which draws it three times.
- **Where:** Preparation shows `OvenStep` in the cooking film's place, when App gives
  `ovenCooking` (the restaurant build). It hands over to the Knife Report exactly as the film does.
- **The bake:** the tray slides in (600 ms), then the bread bakes for 5.2 s. Doneness 0–1
  reads pale, then the golden window (0.55–0.80), then toasty.
  - "🧤 Take it out" ends it once.
  - Left alone, the tray comes out at toasty. There is no failure.
  - A line follows (*Golden and crisp!* …) for 1.1 s.
- **Presentation only:** the score, grade, pay, tip and stock come from the cut.
- **Robustness:** an interrupted bake clears its timers. Reduced Motion drops the slide
  and glow and keeps the same bake.
- **Tests:** QA `oven-step-qa`; browser `tools/e2e/ovenstep.mjs` (O1–O6, Garlic Bread) and
  `tools/e2e/ovenrecipes.mjs` (R1–R7, the five Phase D dishes) and
  `tools/e2e/ovenbaguette.mjs` (B1–B6, the four baguette dishes; development server only, as
  it cooks each in Level 6's place in memory). The shared solver takes the tray out in the
  golden window.

### The Kitchen's next-upgrade strip — Transformation Phase C (developer 2026-10-25)

- **Where:** in the Kitchen's top-left column (restaurant build), under the rank and the
  daily gift.
- **What:** the first kitchen tier not yet built (`nextKitchenUpgrade`): its name, its
  existing price (`kitchenTierPrice`) and a bar of credits ÷ price, capped at 100 %.
  Beside the price: "🔒 Lv N", "N%" or "✓ Ready".
- **Tap:** opens Kitchen Upgrades; the strip itself buys nothing.
- **Hidden** when every tier is built.
- **Tests:** QA `next-kitchen-strip-qa`; browser `tools/e2e/kitchenstrip.mjs` (K1–K5).

### Kitchen Moment cards — Phase 6 (developer 2026-10-21)

- **Moments** (`game/kitchenMoments.ts`), from signals the game already has:
  **Perfect Cut** — a Perfect Slice (the scene's own detection: a swipe within
  12 px of an ideal division) on an ingredient that reached Clean ×5;
  **Special Dish** — made with a special variant that order really had, or
  just raised to Grandma's Signature; **New Personal Best** — `bestVerdict`'s
  "best" (a real improvement on the saved best; never a first plate or a tie);
  **Customer Moment** — a special customer's reaction at Serve (their own
  line, the Mystery Guest's reveal). An ordinary dish earns none. Detected once
  when the scene reports the finished recipe (the customer one on the real
  Serve), kept in memory per run and kind — a re-render adds nothing, Prepare
  Again is a new run, a reload forgets them. No save field.
- **Offer** (`kc/moments/MomentChip.tsx`): a small "📸" chip in the corner of
  the order's completion screen (serve card / Order Complete) — never during
  cutting, never over the Knife Report; it opens nothing by itself; ✕ puts it
  away. Declining changes nothing.
- **Card & preview** (`momentCard.ts`, `MomentPreview.tsx`): a 1080×1350 PNG
  drawn on its own canvas in the game's look (the kitchen painting, cream
  paper, gold frame, Fraunces/Nunito/Caveat — same-origin, so exportable): the
  KNIFECRAFT wordmark, the kind, the dish/variant/customer picture, the
  heading, a badge and one or two real facts. The preview IS that image; arrows
  between a dish's moments. **Save image** downloads it
  (`knifecraft-<kind>-<dish>.png`). **Share** appears only where the browser
  can share an image file (`navigator.canShare({ files })`); a cancelled share
  is silent, a refused one points to Save. Nothing is ever posted, uploaded or
  tracked; no money, rewards or progress for sharing.
- QA: `phase6-qa` (§5). Browser: `tools/e2e/phase6.mjs`.

### Restoration reveals and the daily gift streak — Phase 5 (developer 2026-10-21)

- **Restoration** (`game/kitchen/restoration.ts`): the six existing kitchen
  tiers — each already painted as its own Kitchen skin and map art — fall
  into four restoration stages: Humble → **Inherited Kitchen**, Growing →
  **Cleaning & Repair**, Established + Neighborhood Café → **Improved
  Kitchen**, Flourishing Café + Grand → **Restored Family Restaurant**. Each
  tier lists what its painting changed (lighting, equipment, workstation,
  furniture); every painting keeps the family's arched window, long wooden
  worktop, green cupboards and copper pans. No tier, price or rule changed.
  The cutting screen behind the board shows the built tier's painting too
  (App → Preparation `kitchenArt`); the Humble Kitchen keeps the original
  cutting-screen art (the same room, same framing).
- **Reveal** (`kc/RestorationReveal.tsx`): opened by App only after a
  successful, saved build (`buildKitchenUpgrade`), one at a time. The old
  kitchen shows, then the new one wipes across it (0.7 s + 1.4 s for a new
  stage, 0.35 s + 0.8 s within one); Skip jumps to the finished picture with
  what changed and what stayed; Continue closes. Reduced Motion: the result at
  once. The Kitchen behind already shows the new tier (it reads the save), so
  skipping or leaving changes nothing; nothing is saved about the reveal.
- **Daily gift card** (`kc/DailyGiftCard.tsx`, under the rank on the Kitchen,
  from Level 3): today's gift ready with its amount, or "✓ Taken today"; the
  week's seven days with Day 3 ($) and Day 7 (★) marked; the reward ahead. A
  tap opens the SAME gift sheet as before (now saying "Gift streak · Day N of
  7" and any reward today), so there is still one place a gift is taken. The
  card re-reads the device-local day every 30 s and when the page comes back,
  so it turns over at midnight. After a missed day: "Welcome back! A new
  streak starts today." Today's Special keeps its own streak, untouched.
- QA: `phase5-qa` (§5). Browser: `tools/e2e/phase5.mjs`.

### Signature dishes, special customers and the order-completion sequence — Phase 4 (developer 2026-10-21)

Presentation only: no new save field, no money, no new order or customer engine.

- **Signature Dish Collection** (`game/signatureDishes.ts`, `kc/Recipes.tsx`,
  `kc/signature/TierBadge.tsx`): the Recipe Book (Order Board → 📖) is the
  collection. Each page's tier comes from `recipeProgress[recipeId].best` —
  the existing, persisted max Knife Report score (max over the recipes a
  level can serve): **Homemade** once prepared, **Chef's Special** at 85+
  (the Clean grade), **Grandma's Signature** at 95+ (Masterful). A summary
  strip counts pages per tier; each row's stamp says its tier (Homemade is
  "Prepared"); a page shows its dish in a tier frame with the tier's ribbon,
  the ladder with how to reach each tier, the best plate as a grade word, one
  family memory per tier reached, and "This visit (not saved)" — the longest
  run and any special variant used, kept for the page session only (developer
  decision 2026-10-21: no save field for them). **Deliberate override (developer, Phase 4 brief):**
  the cookbook's old "no graded rating" rule (Law 4) gives way to the three
  tier words; score digits are still never shown in the book.
- **Book page** (`kc/game/BookPageNote.tsx`): when the dish writes something
  new — its first plate, a new tier (the saved best crossing 85 / 95 — once
  per recipe, ever) or a variant met for the first time this visit — a small
  page with one memory rides on the serve card (before Serve) or the Order
  Complete card. It is part of that card, not a stage: no extra tap (an
  earlier draft as its own step added a tap after every new level and broke
  the existing flows). Business orders keep no recipe record, so never one.
- **Special customers** (`game/customers/personalities.ts`): the Food Critic,
  the Regular, the Mystery Guest, Grandma's Old Friend and Big Bruno. Over
  ordinary service orders from campaign Level 4 (any Business order), never
  while a technique is taught: the 2nd eligible order of the page session,
  then every 5th, in that rotation; decided once per order id and cached.
  They change only who the player sees — the order card's name, an arrival
  card, the serve card (the Mystery Guest a silhouette until Serve, then
  revealed; Bruno drawn big) — and what they say at Serve, from the dish's
  real grade (cheer only for Masterful, nod for Clean). The Regular's par is
  8 s + 1.5 s per cut of unpaused prep: past it he checks his watch once and
  says "Finally!" — cosmetic, never a penalty. The order, its customer id,
  pay, tip and ledger entry are the normal ones. Grandma's Old Friend is a new
  narrative touch (a friend of the grandmother, unnamed); no new story beat.
- **Order completion** (`Preparation.tsx`, `ServiceOrderComplete.tsx`):
  plating → cooking film → Knife Report → serve card (with any book page); after
  Serve the customer's reaction, the pay, the tip and the cash appear a beat
  apart (0 / 0.18 / 0.36 / 0.52 s, opacity only, none with Reduced Motion);
  the plate's tier rides on the card's first line. Continue, Serve and Next
  Customer / Finish Level each advance exactly once per screen (Next used to
  advance the campaign queue twice on a double tap). The card tightens on
  screens up to 640 px tall so it fits 320×568 with any customer line.
- QA: `phase4-qa` (§5). Browser: `tools/e2e/phase4.mjs` (restaurant dev
  server; `window.__kcSpecials.customer(id)` in development builds only).

### Fever Mode, Prep Rush, Kitchen Chaos and special variants — Phase 3 (developer 2026-10-21)

Presentation and play only: nothing here pays, unlocks, records or saves
anything (no save field, no ledger entry, no stock, no progress).

- **Fever Mode** (`game/fever.ts`): the existing Clean ×10 milestone lights it,
  once per order (Prepare Again may light it again). 6 s on the scene clock, so
  a pause holds it; it ends early at plating or a restart. While on: a warm
  knife glow and trail, stronger flecks, board drag and piece separation, a
  slight pitch lift, warm screen edges (`kc-fever-vignette`, leaves the
  board's middle clear), a countdown bar along the top that pauses with the
  game, 🔥 on the combo chip, start and end sounds, "What a run!" at the end.
  No score change. Reduced Motion: no breathing edges, no flecks/drag boost.
- **Endless Prep Rush** (`game/prepRush.ts`, `scenes/PrepRushScene.ts`,
  `PrepRushBridge.ts`, `kc/prepRush/PrepRush.tsx`; screen `prep-rush`, a tile
  on the order board): its own small Phaser game, lazily loaded. Ingredients
  ride a conveyor; a swipe across one cuts it (through the middle = clean, +5),
  a tap cuts too (never clean); every 5 in a row +10; one falling off the end
  is a miss and resets the run. A fixed seed (the same sequence every run);
  speed and spacing step up every 10 s to a cap; at most 6 on the belt; 60 s
  or 5 misses. Results show prepared / clean / missed / best run and this
  session's best (memory only). Replay, Pause (Resume / Restart / Back), Back
  to Orders; leaving stops the run, un-pauses and tears the game down.
- **Kitchen Chaos Director** (`game/kitchenChaos.ts`): after 3 eligible orders,
  then every 4th, an order gets a twist in a fixed rotation — Giant
  Ingredient (the first ingredient ×1.35, clamped to the board), Vegetable
  Avalanche (8 little vegetables land on the board as the order starts; they
  hold the board — no cut can start — until swiped away or skipped), Rush
  Hour (plating, the hand-off and the cooking film run 1.6× / 1.5×),
  Grandma's Challenge (reach Clean ×8 on one ingredient; a live chip), Perfect
  Plating (the plating judge reads the Knife Report's Evenness: 90+ is the
  stamp — there is no separate plating interaction to judge) and Kitchen
  Inspection (restaurant build: a friendly visit whose verdict at the report
  is the live `inspectBusiness` result — no fine, no state). Eligible = not
  Levels 1–10 and no technique being taught (`coaching.ts`); an event that
  can't happen on the order (Grandma needs a step of 8+ cuts, Inspection a
  restaurant, Giant a cutting first step) passes to the next; a due event
  waits one order when the cleaning cloth is offered. Decided once per order
  in the scene (a restart keeps it), announced on a card; the Knife Report
  acknowledges it (`specialsReport.ts`).
- **Special variants** (`game/specialVariants.ts`): every 3rd eligible order
  that contains a tomato, cucumber, carrot, onion or pepper gets that
  ingredient as a Golden Tomato, Giant Cucumber (×1.3), Rainbow Carrot,
  Frosted Onion or Grandma's Heirloom Pepper — the same ingredient (id,
  cuts, grading, stock) painted differently: its skin pixels are re-hued on
  the ingredient's own texture (stems and leaves keep their colour) plus a few
  marks, so the pieces and the plate carry it; coloured flecks on each cut;
  "✨ Made with a Golden Tomato" on the report.
- Counters are this browser session's only. Development builds expose
  `window.__kcSpecials.chaos(id)` / `.variant(id)` for the browser tests;
  production builds inline it away.
- QA: `phase3-qa` (§5). Browser: `tools/e2e/phase3.mjs`. The e2e solver sweeps
  (then skips) an avalanche.

### Cleaning cloth, money vacuum and the serve celebration — Phase 2 (developer 2026-10-21)

All presentation except the tip (§7 "Customer tips"); no save field.

- **Cutting debris** (`game/boardDebris.ts`; realistic since 2026-10-24,
  developer: "make the ingredient leftover while cutting more realistic …
  for juicy ingredients make it juicy … let it spill while cutting"): each
  real action leaves a little mess in the ingredient's own look — diced cubes
  with a lit top and shaded sides, teardrop seeds, curled peel, herb leaves,
  crumbs, irregular chunks (`LOOKS`, by ingredient, else by category): 1 per
  cut or ring, 2 per smash, 3 per finished peel, in the board's far and near
  margins, at most 40. **Juice:** a juicy ingredient (`JUICE`: its colour and
  how much it spills — tomato, watermelon, citrus, pineapple, beetroot, steak
  …) spills at the cut itself: a pool that runs out from under the food and a
  few droplets (at most `MAX_WET` 24 wet pieces). Juice never brings the cloth
  sooner (CLEAN_AT counts solid pieces). Painted with Canvas 2D
  (`textures/boardMess.ts`) into ONE CanvasTexture image at depth 1 (above the
  board, under guides, food and knife): the pools' bodies merge in one wet
  layer laid on at the juice's own transparency with a soft darker edge, then
  their sheen and pulp, the drops and the scraps with contact shadows. A
  session list, never saved: it outlives one order on purpose, since each
  order remounts the scene.
- **Random, per ingredient** (2026-10-24, developer: "make the stains random,
  like cutting different tomatoes different stains … optimise the stains for
  all ingredients"): a fresh seed per session (the platform's crypto source,
  else the clock — never Math.random; tests fix it with
  `resetDebrisForTests(seed)`), and every fresh ingredient its own batch
  (`newIngredientBatch`: juiciness 0.65–1.35 ×, tone) — so each tomato
  spills differently: pool sizes, a second pool sometimes, 0–4 drops, now and
  then a squirt (a line of drops), every piece's shade, size, place and turn
  its own. Every ingredient has its own leftovers (`LOOKS` covers all 54:
  broccoli florets, corn kernels, cheddar crumbs, salmon skin…) and every
  fruit, the watery and starchy veg, dairy and the meats spill their own
  liquid (`JUICE`; bread and dry veg don't).
- **The cleaning cloth** (2026-10-24, developer: "instead of that tool use a
  realistic cloth and do not show the next ingredient before cleaning the
  cutting board … make the cleaning a little slow and satisfying"; was the
  bench scraper): at the START of an order (or Prepare Again) with 30+ solid
  pieces — about every 2–3 orders — never mid-dish. A folded kitchen towel
  (cotton weave, red stripes, a folded-over flap; `paintCloth`) rests on the
  board's near corner; the next ingredient and its guides wait OFF the board.
  While it is out the board's pointer is the cloth's (a tap or swipe can never
  cut): it follows the finger with a little lag, leans into its motion and
  presses flat; each frame's travel rubs the pieces under it
  (`wipeDebris`: reach `CLOTH_RU`/`CLOTH_RV`, `WIPE_RATE`, each kind's
  `WIPE_TOUGHNESS` — a juice pool takes a few passes, a seed one). Solids are
  dragged a little before it picks them up; juice smears along the stroke and
  fades. Each piece gone rings a rising sparkle note (a streak), a sparkle and
  a short buzz; the wet scrub sound follows the motion; the cloth picks up a
  faint stain. The card shows "🧽 Wipe it with the cloth" and a five-segment
  bar (`cleanProgress`, sent as `EVT.CLEANUP` "progress"). At `CLEAN_DONE`
(every piece gone AND every patch of the film wiped — developer 2026-10-24:
  "make the user wipe the board each and every corner, don't make it too
  easy") the cloth lifts off to the side, a polish glint, a squeak, sparkles
  and the spotless chime — then the ingredient is set down (a short drop and
  settle, a plate tap). **The film:** when the cloth comes out a film of grime
  (`startWipe`; `FILM_COLS` × `FILM_ROWS` patches, each `FILM_BASE` ± random,
  more under the mess, in a dull version of the juice's colour) covers the
  whole board, drawn as a soft smudge per patch still dirty; the cloth must
  pass over every patch, corners and edges included. Progress is half the
  pieces, half the film, and only reaches 100% when both are done; after a
  pause a soft ring pulses over the dirtiest spot left (`dirtiestPatch`). One
  sweep is nowhere near; a whole board takes many strokes (`phase2-qa` A15:
  10–40) and rubbing only the middle never finishes (A15c). A rub still going
  when the board comes clean never becomes a cut (`clothGestureLeft`). No Skip
  (developer 2026-10-24: "remove the skip button"): the cloth needs no
  supplies and every patch can be reached, so the board is always wiped —
  never a soft-lock. Lost pointers are let go; Reduced Motion makes the end
  instant; the coach waits.
- **Money vacuum** (`game/cashBurst.ts`, `kc/game/CashVacuum.tsx`): after
  Serve, the payment (and any tip, in gold) lands on the serve card as 4–14
  bills and coins whose cents add up to it exactly. Swipe across them — one
  broad pass picks up everything it passes near — and each flies to the wallet
  with a cha-ching. The money was credited when Serve was tapped; the wallet
  pill shows `credits − cash still on the counter`, so it rolls up to the real
  balance and lands on it exactly (also if the player just moves on). Each
  piece is collected once; the auto-collect toggle (session only, always on
  with Reduced Motion) uses the same path.
- **Serve celebration** (`ServiceOrderComplete.tsx`): Serve is latched to one
  call per screen (a double tap cannot pay twice); the till sound plays on the
  payment; the customer reacts to the dish's own grade — a cheer and
  "👏 Exceptional!" for Masterful, a nod for Clean; a tip shows as
  "💸 Generous tip! +$X" under the order pay. At 320×568 the card fits
  without scrolling (a tip on a two-line dish name may scroll, never clip).
- QA: `phase2-qa` (§5). Browser: `tools/e2e/phase2.mjs`. The e2e solver
  wipes the board (`wipeBoard`) when the cloth is offered, and takes an opt-in
  `aim` / `steady`.

### The knife's feel — glint, heat, juice, ring (developer 2026-10-24)

"Add effects to the knife while cutting so the cutting is satisfying and the
player gets dopamine from it." Presentation only (`game/knifeFeel.ts` says
when, `scenes/knifeFx.ts` draws, on the knife's own transform; the knife's
pose is untouched — docs/KNIFE_RULES.md). It builds with the run, so the
blade gets more alive the better the player cuts:

Matched to the developer's reference board (2026-10-24, "make the effects
like this": motion trail, impact, slice through, juice beads, combo build,
combo high, perfect / last slice):

| When | What |
|---|---|
| the knife moving | a soft motion trail — swooshes of the edge behind it (gold from ×10) |
| every cut — impact | 16–25 juice teardrops and 4–7 seeds burst from the cut and arc onto the board, with a wet mist (dry food throws flecks of itself) |
| every cut — slice through | a bright glint with a flare runs heel → tip (the spine catches it too); the edge's afterimage stays in the cut; the edge always carries a thin line of light; a 5 ms buzz |
| juicy ingredient (`JUICE`) | juice beads (teardrops) stick to the blade, slide down leaving a wet streak, and dry |
| combo ×5 (`bladeTier` 1) | the blade warms: a warm aura over the steel, a glowing edge |
| combo ×10 (tier 2; Fever is at least this) | a gold edge with bloom and embers rising off it |
| combo ×15 (tier 3) | pulsing white-gold, more embers, sparks off the tip |
| combo milestones | a brighter glint and a lens-flare star at the tip; 14 ms buzz |
| Perfect Slice | the whole blade flashes white; a big star; 18 ms buzz |
| the step's last cut | a flash, a double glint, the steel's "shing" (`AudioManager.playBladeRing`, under the "prepped" chord), a big star, the juice flicked off; 24 ms buzz |

A fresh ingredient starts cool and dry. Reduced Motion keeps only the edge's
colour and a short flash. QA: `knife-feel-qa`.

### Cutting feel, combo and New Best — Phase 1 (developer 2026-10-21)

Two parts of this deliberately override older rules on the developer's
instruction. Do not "restore" either without asking them.

- **Combo** (`COMBO`, `definitions.ts`): the cuts landed on the current
  ingredient step, owned by `PreparationScene` and sent on
  `CutCompletedPayload.combo` — the UI never counts on its own. Reset by
  STEP_STARTED and by restart. No break rule (only valid, guide-snapped
  cuts are ever committed, so there is no miss to break on). Awards
  nothing. A meter on the order card from ×2; a "Clean ×N!" toast once per
  milestone (5 / 10 / 15 / 20), below the board, `pointer-events-none`;
  the cut sound's pitch rises to ×1.12.
- **Feel**: the board gives along the blade's travel as well as down
  (`CUT_DRAG`, `boardNudge(axis, velocity)`); a Perfect Slice sounds
  sharper (×1.06); `AudioManager.playComboMilestone` and
  `playIngredientComplete` (once, on the cut that finishes an ingredient).
  Reduced Motion turns off the drag and the tilt.
- **Settle tilt — overrides the reference's "no rotation" rule.** Each
  piece leans up to `PIECE_SETTLE.TILT_RAD` (≈2.6°) about its own centroid,
  in proportion to its offset across the silhouette's half-width. It never
  reads the cut's angle, which is what caused the original crossing
  pieces. Full reasoning: the `PIECE_SETTLE` doc.
- **Knife Report "New Best!" — overrides Law 4 for this one line.** On a
  genuine improvement over `recipeProgress[recipe].best`
  (`game/bestVerdict.ts`): "✦ New Best!", "Best 72 → 85" and "Cleaner than
  your best +N%". Nothing for an equal or worse run; a first plate says
  "your first plate of this dish". The headline stays the qualityLabel and
  OrderComplete keeps Law 4. No save field, no money.
- **Replay**: "Prepare Again" is latched until the scene's STEP_STARTED, so
  a double tap can neither start nor credit two runs.
- **Knife Report on narrow screens** (fixed alongside Phase 1): the stats
  grid used to overflow the card at every game width up to ~460 px (its
  `1fr` column could not shrink below the Rhythm line's text), pushing the
  ideal-vs-yours diagram off the card and clipping "100" to "10" at 320
  px. Now `minmax(0, 1fr)`; under a 390 px-wide GAME the card, gaps and
  value column tighten (`@container` on the report + `@min-[390px]:`, the
  project's first container query — the game is a contain-fit frame, so
  a short wide window gives a narrow game); from 390 px it is the original.
- QA: `phase1-cutting-qa` (§5). Browser: `tools/e2e/knifereport.mjs`.

### Finding things: Achievements and the scroll cue (developer 2026-10-18)

- **Achievements** (`kc/Achievements.tsx`): the rewards ready to collect
  sit together at the top in "🎁 Ready to collect · n" (gold cards with a
  red "!" and their Collect; "Collect all · $X" when there are two or more —
  one `collectAchievement` each, one ledger entry each). The header's
  "$X waiting to collect" is a button that scrolls there. Below, filter
  chips All · In progress · Earned (≥ 48 px); each group lists in-progress
  ones first (closest first), then not started, then the earned ones; a
  ready one is never repeated there. The Kitchen's ranking card opens
  Achievements itself while money waits (`collectableTotal > 0`),
  Progress otherwise. e2e `achievements.mjs` 6–7.
- **Scroll cue** (`kc/common/ScrollCue.tsx`, mounted in `BottomNav`): the
  screens hide their scrollbars, so the screen's tallest vertical scroll
  area gets "▾ More" while there is more below (a tap scrolls most of a
  screen) and "▴ Top" at the end once well down; nothing when it fits;
  hidden under a lock hint or Grandma's pointer. Every screen with the
  bottom bar has it.
- **Level Complete with no reward:** a restaurant first completion always
  shows the card (Level 2's practice pays $0: "✓ Practice complete", with
  Grandma's line, the opened sections and the new day).

### Restaurant name (developer 2026-10-17)

`restaurant/restaurantName.ts`: `settings.restaurantName` (optional; absent
= not asked yet). App shows `RestaurantNameCard` once the intro is done and
holds Level 1 under it (restaurant build); "Open the doors →" saves the
typed name, cleaned (single spaces, trimmed, ≤ 24 characters), "Keep …"
saves the default "Your Restaurant". Settings → Restaurant name
(`RestaurantNameField`) and the map's nameboard change the same saved name
(the nameboard used to keep it in plain localStorage — that key is now
only read once, as the card's starting text). Progress and the City
Ranking show it. Display only: no money, ledger or progress reads it.

Use the existing KnifeCraft UI primitives and visual identity (warm
painted kitchens, wood/paper, Fraunces / Nunito / Caveat bundled locally).
Touch targets ≥ 48 px. Test at 320×568, 360×640, 390×844, 430×900,
768×1024. Do not add animation libraries or large assets; prefer CSS
transform/opacity. No external fonts, video or network requests at runtime
(only the Bridge CDN script); the bundled videos are the six cooking clips (§9).
Text sizes (developer 2026-10-08 "a little more size", then 2026-10-09
"a little too much — optimize, don't decrease too much"): the React UI's
small text sits about halfway between the original and the first bump,
~6–8 % above the original (descriptions and secondary lines 12–14.5 px,
badges 11 px, nothing below 8.5 px; Caveat lines +1 px, 13–17 px); new UI
uses these sizes.

### Short, game-style copy and the ⓘ InfoTip (developer 2026-10-16)

"Concise the big sentences … convey it with emojis … small points … if long
sentences are necessary add a small 'i' information symbol and only when it is
clicked let the information display; make the UI proper according to a game."

- **Primitives** (`kc/common/InfoTip.tsx`):
  - `InfoTip`: a 22 px ⓘ coin with a 48 px touch area. It opens a paper
    bubble with the longer text. One bubble is open at a time; a tap outside,
    Escape or resizing closes it; it follows a scroll and closes once its ⓘ is off screen. The bubble is portalled to
    `<body>` and drawn at the GameShell's scale, so a clipped card or a scaled
    frame never cuts it. Never put one inside a `<button>`.
  - `StatChip`: icon + short value ("⏱ $10/h", "↩ ~40 h").
  - `Points`: one icon + a few words per line.
- **The rule:** visible copy is a few words, icons and numbers. A longer
  explanation goes inside an `InfoTip`. Data copy (knife, board, station,
  staff and helper descriptions; why a role or tool is needed; forge details)
  is shown only behind ⓘ.
- **Swept (2026-10-16):** the Market (cards, Blacksmith, supplies,
  ingredients, Plan ahead, Second Floor), the Pre-Service Check, Daily Check,
  Closing Time, deliveries, supplier credit, the ingredient supplier, the par
  audit, every Business tab, Inventory, Restaurant Progress, the Journal, the
  Kitchen, the Second Floor view, the served card, the Replay Bonus sheet and
  the Level Complete notices. The story's narration is unchanged (frozen).
- **Guard:** `scripts/ui-copy-qa.mts` fails on any visible string over 14
  words outside an `InfoTip` (screen-reader text, the story and the cleaning
  mini-game are allowed), and checks the InfoTip's touch area and behaviour.
- Tests that pinned the old sentences now pin the short copy (the
  developer's rule change): `inventory-market-qa` 12c,
  `business-order-frequency-qa` U/U3, `restaurant-progress-qa` G22, e2e
  `restaurantendless.mjs` 1a/1c and `rushrestock.mjs`.

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
`.github/workflows/deploy.yml` deploys GitHub Pages on every push to `main`
(the live test site, §0).
