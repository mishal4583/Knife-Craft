# KnifeCraft — Handoff (Playgama edition)

## Five ad bonuses (2026-10-18, `main`)

- Developer: "build 1–5". From Level 3, each an optional rewarded ad with its
  own placement and daily cap, all through one sheet (what it gives → 📺 Watch
  / No thanks): **floating cash** over the Kitchen (6/day), **level bonus** +50%
  after a first clear (3/day, replaces that break's interstitial), **short by**
  top-up under "Not enough money" (2/day), **Second Floor ×2** (2/day) and the
  **daily gift** (free, or 📺 doubled). One `rewarded-ad` entry per claim.
  REFERENCE §2 / §7; QA `ad-bonuses-qa`, e2e `adbonuses.mjs`.
- Economy: a player who never watches is unchanged except the free gift
  (~$460 over the campaign); one who takes every offer at 10 levels a day ends
  ~$19.5k (14.8%) above the $132k target (cap 20%).
- Also: the Replay Bonus cap counts only Replay Bonuses; the scroll cue moved
  to the middle of the bottom bar (it covered Business's 🗺️ Map button); the
  browser harness seeds today's gift as taken.
- Tests: all 107 QA suites pass; every browser test passes on its build
  (restaurant and classic). Stale tests fixed on the way (they failed on the
  previous `main` too): `platingskip` and `audit10` (Level 3 needs stock: they
  restock from the Pre-Service Check now), and five "no ledger entry" checks
  that now ignore the harness's seeded daily-gift record.
- Playgama: the five new placements (`floating_cash`, `level_bonus`,
  `shortfall_topup`, `floor_double`, `daily_gift`) are in
  `playgama-bridge-config.json`; the zip is built on the developer's word.

## Playgama analytics, Level 1's level messages (2026-10-18, `main`)

- **Playgama cabinet check** (MCP connected): live archive
  `KnifeCraft-Playgama-v1.3.0` PASSED, Bridge 2.3.1 FOUND; sandbox and
  traffic done; covers done; no moderation comments, no leaderboards. The
  form waits on **certification** (`NO_CERTIFICATION`: "Submission requires
  a passed certification") — the QA Tool's certification run is the
  developer's, in the console.
- **Telemetry so far** (30 Sep–18 Oct, 92 sessions, 51 users; too few for a
  firm conclusion): 89 starts → 62 `game_ready` → 49 past 30 s → 40 past
  60 s; 24 sessions started a level. The platform's level events carry no
  level, so where players stop was unknown.
- **Added:** the game's own analytics events through Bridge
  `analytics.send` — the progression funnel (`progression_started` /
  `_completed` / `_abandoned` with world, level number and duration),
  `intro_completed {skipped}` and `performance_sample` every ~30 s on the
  board; each with `game_version` (`BUILD_VERSION` 1.4.0). REFERENCE §2;
  QA `playgama-telemetry-qa`, e2e `pganalytics.mjs`.
- **Fixed:** a new player's Level 1 (under the intro) sent no
  `level_started` / `level_completed`; it opens its play session when the
  intro closes now.
- **Stale test fixed:** `adsflow.mjs` (failed on the old `main` too: Level 4
  now needs stock and the Pre-Service Check's START).
- **For the developer:** a leaderboard is possible (the game already has a
  `sendScore` hook) but needs a choice of score and a cabinet leaderboard,
  which cannot be deleted. The new zip is built only on the developer's word.

## Achievements you can find, a scroll cue, browser tests current (2026-10-18, `main`)

- **Achievements** (developer: "hard to find which is unlocked … no arrow …
  no highlight or sort"): the ready rewards sit together at the top (gold,
  a red "!", Collect each or "Collect all"); "$X waiting" jumps there; the
  lists below filter All / In progress / Earned, closest first, collected
  last. The Kitchen's ranking card opens Achievements while money waits.
  REFERENCE §10.
- **Scroll cue** on every screen with the bottom bar (`kc/common/ScrollCue.tsx`):
  "▾ More" while a list goes on below, "▴ Top" at the end.
- **Game bugs found by the browser tests, fixed:** Level 2 (the $0
  practice) showed no Level Complete card (no Grandma line, no "Inventory /
  Market is open", no "Day 2 begins"); "Buy everything needed" in a supply
  section bought only one item (each purchase overwrote the one before);
  the order card overlapped the board at 320 px on a six-step dish.
- **Economy check:** every economy suite passes; completionist $132k at
  L150 (target $100k–$150k), every profile 150/150, prudent ≥ $458 with no
  supplier credit. The COGS audit follows the redesigned recipes.
- **Browser tests** (`tools/e2e`) follow the 150-level campaign and the
  current navigation; see the README's "Writing a test" notes (seeds carry
  `campaignVersion: 2` and migration v2; `openSection` for the map's
  screens; `openShortcut` for the Kitchen's shortcuts; `clickButton` unfolds
  folded cards). Grandma's-fridge e2e checks the retired feature stays
  retired. Final run: every browser test passes on its build (62), all 105
  QA suites pass.
- `releases/KnifeCraft-Playgama-v1.4.0.zip` is built from this `main`
  (gitignored; `index.html` and `playgama-bridge-config.json` at the root,
  preflight passes). Uploading it to Playgama, the real-Bridge check and
  registering the `day_cleaner` placement are for the developer (the
  cabinet tool isn't connected here).
- Open design point: Inventory left the bottom bar (5db9451), so Grandma's
  "This is your Inventory" pointer shows its card without the hand.

## Restaurant name (2026-10-17, `main`)

- After the intro, before Level 1, the player names the restaurant (four
  ideas, or "Keep \"Your Restaurant\""); an existing save is asked once on
  its next launch. Changeable in Settings → Restaurant name and on the map's
  sign. Stored as `settings.restaurantName` (optional, like `measure`).
  Shown on the map, Progress and the City Ranking. REFERENCE §10; QA
  `restaurant-name-qa`, e2e `restaurantname.mjs`. The browser harness names
  seeded saves and answers a new player's card unless `launch({ nameCard: true })`.

## Developer follow-ups to the audit (2026-10-17, `main`)

- Bulk tiers 3/5/8 % from 5/10/25 (were 25/50/100).
- The shift checklist's "Do all" button is gone (Do it per chore).
- Mexican cuisine and the Mexican Chef open at L16 (the first Mexican dish),
  announced at L11; the check asks to hire the chef (free). e2e `mexicanchef.mjs`.
  The Mexican menu dishes stay at L49 for now (menu re-plan, below).
- Unused files: the specialist chefs now show their characters from
  `chefDefinitions.ts` (Chef Marisol, …); the development card (replaced by
  Business → Upgrades on 2026-10-15) and the dishwashing scrub prototype
  with its 324 KB sink art were removed (the real wash-up runs itself).
  `kc/modals/index.tsx` was not unused (CutResultPanel's Toast).
- Half wages start with the Prep Cook (L29); the constant had stayed at the
  250-level 41. The Staff screen showed "Lv 41 / Lv 91"; it reads the
  constants now. Sim target still holds (`restaurant-final-economy-qa`).

## Whole-game audit fixes (2026-10-17, `main`)

- Menu dishes wait for their cuts: the Zucchini & Fennel Salad joined at
  L17, before julienne (L20); it now joins at L20. REFERENCE §5
  (`restaurant-menu-qa`), guard `restaurant-menu-order-qa` K.
- The day Cleaner (previous commit) broke two checks: its ledger entry is
  now `staff-purchase` (End Business Day stays the one wage site), and the
  map shows today's Cleaner through an explicit `cleanerToday` flag.
- **250-level suites re-baselined** (2026-10-17, developer: "fix it
  according to your plan"): every QA suite runs to the end and passes on
  the 150-level campaign except `restaurant-takeaway-qa` U1/U2 (below).
  New frozen baseline in CLAUDE.md §7. Twelve suites used to crash part-way
  (a loop to 250, a removed export), hiding their later checks.
  Game fixes found on the way: `HALF_WAGES_FROM` (L29) and `AUDIT_FROM`
  (L21) had stayed raw 250-level numbers; the menu schedule now follows
  the curve rule (REFERENCE §5, `restaurant-menu-qa`): Mexican dishes from
  L17, the Carne Asada waits for steak (L63). Three Grandma tips trimmed
  to ≤ 70 characters.
- **Curries travel** (developer 2026-10-17): a curry order (packed in a
  thali tray) is a takeaway at 60% instead of 30%
  (`SERVICE_SUPPLY_RULES.curryTakeawayShare`, same seeded roll), so the
  thali containers are used (3 of the campaign's 5 curry orders after
  L46). Other orders are unchanged. All 104 QA suites pass.
- **Notes:** `level.preparationSteps` is a stale fallback on 94 levels (the session is
  built from the recipe). GRAND SERVICE (L75) plays at L76, after the
  finale.

## Cleaner for today replaces "Clean everything I can" (2026-10-17, `main`)

- Pay the Cleaner's day wage (one ledger entry) or watch a rewarded ad
  (new placement `day_cleaner`, also in `public/playgama-bridge-config.json`
  — register it on Playgama if placements are set up there). REFERENCE §5.

## Market highlights follow the Pre-Service Check (2026-10-17, `main`)

- The Market now highlights what the open check's level needs (it read only
  `currentLevelId` and showed nothing when that level was played). Sections
  open on All with needed items first; chips and tabs count them. REFERENCE
  §7 (Market needs); e2e `marketneedslevel.mjs`.

## Market quantity presets 1/2/5/10 (2026-10-17, `main`)

- Was 5/25/50/100. The bulk tiers followed on the same day: 3/5/8 % from
  5/10/25, so the 5 and 10 presets save. REFERENCE §5
  (`restaurant-progression-qa` B1).

## Cleanliness screen sorted (2026-10-17, `main`)

- Removed three mock panels (practice rooms, dishwashing and chef's-tools
  test games that changed nothing); one status card first, each area once,
  a real read-only Wash-up card. REFERENCE §5 (`restaurant-cleanliness-qa`).
- `restaurant-cleanliness-qa` G2/G3 used two dishes no longer in the
  150-level campaign; they now use current dishes of the same kind.

## Short game copy + ⓘ InfoTip (2026-10-16, `main`)

- Long sentences across the screens became icons, chips and short points;
  longer explanations sit behind a tappable ⓘ (`InfoTip`). Details: REFERENCE
  §10. Guard: `scripts/ui-copy-qa.mts`.

## Menu price cap (2026-10-16, `main`)

- A dish sells for at most 1.5 × its suggested price; old saves above it are read at the
  cap. The menu's + button stops there. Details: REFERENCE §7 (Restaurant menu).
- Tests: `restaurant-menu-order-qa` C; the business suites that used above-cap prices
  now use in-cap ones (the developer's rule change). e2e `restaurantmenu.mjs` 5.

## Economy for 150 levels + achievement money (2026-10-16, `main`)

- **Built:** the level reward curve (`50 + 3.1 × (n − 1)`), achievements with
  Collect (milestones merged under their ids, new reward ladders), only the
  Family Legacy pays by itself. Details: REFERENCE §7.
- **Measured (sim):** completionist $132.5k–$133.9k at L150 (Local / Wholesale /
  Premium); prudent $132.5k, lowest $432, no credit; never-collects $7.7k,
  150/150. Second Floor (with one-time servers and cleaners) is extra on top.
- **Tests:** `achievement-rewards-qa`, `restaurant-final-economy-qa`,
  `restaurant-economy-pass-qa` pass; e2e `tools/e2e/achievements.mjs` passes.
- **Still to do:** re-baseline the suites pinned to the 250-level game
  (economy-v2-final, economy-v25, economy-final, restaurant-campaign-sim,
  restaurant-progress, progression-preview, restaurant-endgame, playables-ads,
  usd-currency, inventory-screen, business-ux, inventory-market,
  restaurant-backoffice and others); they failed before this change too.

## 150-level review fixes (2026-10-15, branch `codex/restaurant-map`)

- **No single-ingredient dishes** (Level 1's first slice aside). 21 dishes gained
  a second, already-taught ingredient (`SECOND_INGREDIENT`,
  `src/game/recipes/campaignRecipes.ts`); dish names are kept because
  `dishService` reads them.
- **No exact repeats.** Old 61/91/112/152 copied another level's recipes and
  were swapped for old 68/90/119/157 (`campaignSelection.ts`).
- **Chapters in play order, 1→13** (`CAMPAIGN_150_CHAPTERS`): encores are their
  own chapters, and Mediterranean merged with Latin. `cuisineChapter` keeps the
  old cuisine chapter for pay (`payChapterOf`, `levelMastery.ts`), so the
  renumbering moves no money.
- **Teaching:**
  - Level 2 practice is dice, slice and peel only;
  - smash is taught at L5 and julienne at L20;
  - L16 is a fixed Beetroot & Orange dish that teaches the wedge cut.
- **Text:**
  - level texts were fixed to match their dishes;
  - "spring onion", "sweet potato", "green beans" and "pea pods" now appear in
    instructions instead of the ingredient ids;
  - repeated level titles were renamed.
- **Side effects on money (the economy itself is untouched):**
  - expected campaign order revenue +3% ($64.0k → $66.1k), from the richer dishes;
  - the business-ux menu price sum is 82,293 (was 81,893).
- **Tests:** fixture tests were updated to count chicken instances
  (economy-v2-* J1/F1/O1/K1, multi-instance 4/9).
- **Still to do:** the suites pinned to the 250-level layout and the economy
  suites still fail, as before this change.

## Isolated Restaurant Map review (2026-10-12)

The developer created `D:\WORKS\GAMES\Knife-Craft-Codex` on branch
`codex/restaurant-map` with the origin push URL disabled. The Restaurant Map
prototype is being integrated here only. It is the always-available
Restaurant bottom tab; the previous Restaurant management tab is now
Business, and Progress is reachable from Kitchen and Business. See root
`AGENTS.md` and the Restaurant Map section in `docs/REFERENCE.md` for the
task boundaries and implementation overview. Changes are intentionally local and uncommitted.
Do not run tests, a build, or the dev server; the developer will test locally.

The earlier path/status notes below describe the original primary checkout
and are historical, not instructions for this isolated review.

Last updated: 2026-10-08. Written at the end of the Claude Code session that
created this repository, so the next session can continue without the old
conversation.

## 1. Where things stand

| Item | State |
|---|---|
| Primary codebase | this repo, `D:\WORKS\GAMES\Playgama\KnifeCraft` |
| Retired codebase | `D:\WORKS\GAMES\Knife Craft` (YouTube Playables build, GitHub `mishal4583/Knife-Craft`). Its last commit `1af591f` is the base of this repo's history (`youtube-original/main`). It still has the story change as **uncommitted** edits; leave it alone. |
| Distribution | Playgama → its catalog + partner platforms ("distribute everywhere", no exclusions). No direct YouTube Playables release. |
| Platform SDK | Playgama Bridge v2 (detected by Playgama: bridge 2.2.0, engine javascript) |
| Live sandbox | https://playgama.ai/play/gm6cvisosg — status ACTIVE, published 2026-09-26, running archive `knifecraft-playgama-1.0.0` (the **old** 13-beat intro, no Skip). Launch steps now say the sandbox is OUTDATED (form/covers changed since). |
| Latest local build | this repo at HEAD: re-paced intro + Skip story (not uploaded yet) |

## 2. Playgama cabinet (MCP `playgama-developer-cabinet`)

- applicationId `cmuiim0sh1qcalc0hiuw6xwlp`, title "KnifeCraft", status DRAFT
  (never submitted to moderation), engine `js`, agent claude-code / claude-opus.
- Archive `knifecraft-playgama-1.0.0` — id `cmuiime751qcnma0hudv5rc2r`,
  3,102,601 bytes, processing DONE, bridgeSdk FOUND, state PASSED,
  game_ready ARRIVED, bridge config VALID. Zip: `releases/KnifeCraft-Playgama-v1.0.0.zip`.
- Form: description + how-to-play filled (EN), devices iOS/Android/Desktop,
  portrait only, no multiplayer/leaderboards/social/IAP,
  `distributeEverywhere: true`, `excludedPlatforms: []`, no external link.
- Covers: all three slots filled (square = `playgama/covers/upload/square-800x800.png`,
  portrait = `portrait-1080x1920.png` (Poster.png centre-cropped from 1280 wide),
  landscape = `landscape-1920x1080.png` (Landscape.png trimmed from 1081 px tall)).
- Launch steps (2026-09-29): archive DONE, bridge DONE, covers DONE,
  form BLOCKED (NO_CERTIFICATION — a human must certify in the QA Tool),
  sandbox OUTDATED (CHANGED), share AVAILABLE, traffic DONE.
- Traffic: a FREE run (12 creatives, $6 internal budget) RUNNING
  2026-09-26 → 2026-09-29 16:06 UTC, posts on r/playgamabridge and Threads;
  an earlier 1-day FREE run FINISHED. Next traffic is PAID (verdict
  PAYMENT_REQUIRED) — only ever start traffic after asking the developer.
- Revenue share (Playgama wiki, checked 2026-09-28): playgama.com 50%;
  partner sites 70% up to $1k/month, $700 + 80% to $3k, $2,300 + 90% above;
  $100 payout threshold; bank transfer or crypto; non-exclusive.

## 3. Current status (2026-10-15)

- **2026-10-16: the Second Floor**, an automated food hall that earns money per real hour,
  is on `main`. Players can visit it from L10; all six stations go on sale at L60 and stay
  locked until bought. Stations upgrade, and Collect is at the Pickup Counter. Economy plan + Market · Second Floor
  (2026-10-16): machines $400–$1,550, whole floor $29.6k, $200/h at full (REFERENCE). Floor life:
  servers carry food from the machines to the counter, guests eat, cleaners wipe tables
  (`floorLife.ts` / `FloorLife.tsx`). First-floor staff at work on the
  map (`staffLife.ts`, hired roles only). The testing preview is off
  (`FLOOR_LIFE_ALWAYS_PREVIEW = false`): people show only when hired and needed; the Old Chef is
  always in the kitchen; the Cleaner really cleans open restroom jobs. The numbers are provisional. Details: REFERENCE, section before §7.

- **2026-10-16: `main` = the `codex/restaurant-map` build** (the 150-level
  campaign, restaurant map, achievements, review fixes), pushed at the
  developer's request. The 250-era QA suites and the economy suites still
  fail (pending: test update + economy/achievement-money plan). The notes
  below describe the 250-level build before that.

- `main` = `f350657`: finishing plan W1–W5 done and pushed; all gates green
  (99 QA suites, 46 e2e on both builds with the stub Bridge); Pages deployed.
  - W1 story: milestones at 140/165/190/220 and THE LAST PAGE at 250
    (bit 2048), catch-up window 10.
  - W2 first load: nothing under the intro, `game_ready` on the intro's
    first frame (slow phone 6.3 s → 0.63 s).
  - W3 synthesized audio and music, with a Music toggle.
  - W4 story polish.
  - W5 economy: half wages L41–90 (skipped when unaffordable), +1 menu
    guest from L51, guest-only tables don't block; completionist $187,057.
- `releases/KnifeCraft-Playgama-v1.3.0.zip` is built (gitignored, rebuild
  from `main`). Uploading it to Playgama and the real-Bridge check are for
  the developer to do.
- **Protocol (developer 2026-10-11):** no commit, push, merge or deploy
  without explicit approval. Report only test results that actually ran.
- **Waiting on the developer:**
  - the supplier change (alternative: Wholesale −15%, Premium quality +1%);
  - F5 provisional values (bulk tiers, Endless events, Today's Special)
    after their Level 1–60 playtest;
  - the deferred campaign-data split (startup bundle).
- Codex / experiments: work on a branch (`codex/...`); only a push to
  `main` deploys Pages.
- History, the old audits and the numbered log: `docs/HISTORY.md`.

## 6b. Current state (2026-10-09, end of session)

- `main` has Passes 1–3 and the Pass 2 review fixes (pushed 2026-10-09 at
  the developer's request for testing on Pages).
- Release order agreed: Pass 1 → Pass 2 (+ review fixes) → Pass 3, then
  test Levels 1–15 together on Pages before `main`.

### Running the browser tests in the cloud container
- Serve: `npx vite preview --host 127.0.0.1 --port 4173 --strictPort`
  (plain `localhost`/IPv6 fails); classic build:
  `VITE_RESTAURANT_MODE=0 npx vite build --outDir /tmp/claude-0/classic-dist`
  served on 4174.
- Chrome: `CHROME_PATH=/tmp/claude-0/chrome-nosandbox.sh` (a wrapper:
  `exec /opt/pw-browsers/chromium-1194/chrome-linux/chrome --no-sandbox "$@"`),
  `KC_URL=http://127.0.0.1:4173/`.
- The Bridge CDN is blocked here: run the tests from a COPY of
  `tools/e2e` (`/tmp/claude-0/e2erun`, node_modules symlinked) whose
  `harness.mjs` answers `https://bridge.playgama.com/...` with the official
  npm build (`/tmp/claude-0/pgb/package/dist/playgama-bridge.js`) via
  `page.setRequestInterception` (cooperative: respond priority 1000,
  continue priority 0). `lazyload.mjs` intercepts itself: run it with
  `KC_OWN_INTERCEPT=1` and let its own handler serve the Bridge. Never
  commit these test-env patches.
- `restaurant*.mjs` on the restaurant build; every other e2e on the
  classic build. Run them one at a time (parallel runs time out).

## 7. Useful facts

- Starting wallet $1,240.00 (124,000 cents). Levels 1–10 on a first run pay
  $667 in order settlements + $636 completion rewards (after the G2 fix).
- Intro timing: Part 1 7.6 s, Part 2 6.0 s, Part 3 7.9 s; measured live
  22.4 s including two prompt button presses; Skip closes in ~130 ms.
- Bundle impact of the story change: main JS +~0.4 KB gz, CSS +~0.2 KB gz.
- Tests run in headless Chrome only; no real-device test has been done yet.
