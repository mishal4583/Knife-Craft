# KnifeCraft — Handoff (Playgama edition)

## Glance copy pass (2026-10-23, `main`)

- Long sentences from game data (alerts, inspection, fridge, Pre-Service Check lists,
  menu ingredients, inventory rows, supplier events, achievements, upgrades) became
  emoji / number glance lines and chips, the full text behind ⓘ. Logic unchanged.
  REFERENCE §10 "Glance copy"; guard `tools/e2e/longcopy.mjs` (nothing over 12 words).
- Second sweep ("check everywhere"): screenshot review of every Market, Business, Inventory,
  Progress and Pre-Service Check screen at Level 60 in a trouble state; have / need rows,
  menu card line, wage lines, new-dish chips, Market plan list shortened. The only lines
  left over 7 words: the Settings credit, the Second Floor pickup line, the Inventory
  "view only" line and the Operations day line.

## Market shop cards redesigned (2026-10-22, `main`)

- Every Market card now uses one kit (`kc/market/ShopCard.tsx`), after the developer's
  reference: wooden frame, hanging name plank with leaves, produce crate picture with a
  stock pill and chalk sign, coin price pill, wooden stepper, 5 / 10 crate tiles, green
  leaf Buy button, wallet line. Logic and prices unchanged. REFERENCE §10 "Market shop
  cards". Not uploaded to Playgama.

## Phone landscape (2026-10-22, `main`)

- A phone on its side now fills the screen: a left rail instead of the bottom bar, wider
  layouts for the Kitchen, Market, Business and Inventory, centred sheets, the cutting
  board as big as the height allows beside the order card, Prep Rush sized for it, and
  the landscape art (`public/landscape-art/`) behind the map and in the cleaning rooms
  (own stain geometry per tier). Portrait and tablets unchanged. REFERENCE §10 "Phone
  landscape"; browser `landscape.mjs` 8/8. Not uploaded to Playgama (it has 1.4.1).

## Cleaning mini-game finished (2026-10-22, `main`)

- Stains on each kitchen tier's real surfaces, proper cleaning tools (🧽 🧴 🧹 and
  drawn mop, grill scraper, toilet brush, squeegee), a guide ring, wrong-tool hints,
  the room unobstructed with the tools below it. No save, money or ledger change.
  Then (developer 2026-10-22): bolder crumbs, scuffs, footprints and grime; a drawn
  string mop and spray bottle (no 🪣 / 🧴); fresh dirt every clean (`cleaningVariant`,
  position, count and strength); dining floor dirt on the walkways, off the rugs.
  REFERENCE §5 `cleaning-dirt-qa`; browser `cleaningfeel.mjs` 10/10,
  `restaurantcleanliness.mjs` 9/9. Not uploaded to Playgama (it has 1.4.1).

## Phases 1–6 committed and green (2026-10-22, `main`)

- Phases 1–6 were committed in 412f3bc (another session). Fixed after it: the
  Daily Gift card listened to `visibilitychange` (Page Visibility API — CLAUDE.md
  §9; the preflight failed): it now re-reads the day on window focus and every
  30 s. `phase2`–`phase5` QA compared with `HEAD` (right only while uncommitted):
  they compare with `0ab8a4e` (`PHASE_BASE`). `ad-bonuses-qa` used a fixed date.
- Now: QA 113/113, preflight clean, `phase5.mjs` 21/21. Nothing new uploaded to
  Playgama (it has 1.4.1).

## Phase 6: Kitchen Moment cards (2026-10-21, not committed)

- Four moments (Perfect Cut, Special Dish, New Personal Best, Customer
  Moment) from existing events; a quiet 📸 chip on the completion screen; a
  1080×1350 PNG card with Save image and (where supported) native Share. No
  storage, no network, no rewards. REFERENCE §10 "Kitchen Moment cards".
- QA `phase6-qa`; browser `tools/e2e/phase6.mjs`. Working tree only.

## Phase 5: restoration reveals, daily gift streak (2026-10-21, not committed)

- Building a kitchen tier now plays a short before-and-after of the existing
  painted kitchens (four restoration stages over the six tiers; skippable;
  Reduced Motion = instant). No tier, price or purchase rule changed.
- **New money (developer):** the daily gift's streak — Day 3 +$100, Day 7
  +$300, paid with that day's gift, once; a missed day restarts the streak.
  REFERENCE §7 "Gift streak rewards". The ledger keeps gift/streak entries 9
  days (their only record; no save field). A gift card on the Kitchen.
- QA `phase5-qa`; browser `tools/e2e/phase5.mjs`. Working tree only.

## Phase 4: signature dishes, special customers, order completion (2026-10-21, not committed)

- The Recipe Book is the Signature Dish Collection: Homemade / Chef's Special
  (Clean) / Grandma's Signature (Masterful) from the saved best — no new save
  field; a small book page on the serve / Order Complete card when a dish
  reaches a new tier (once per recipe) — no extra tap. Five special customers (Food Critic, Regular,
  Mystery Guest, Grandma's Old Friend, Big Bruno) on every 5th eligible
  service order — presentation only. The serve card fills in a beat at a time;
  Next Customer can no longer advance twice. REFERENCE §10 "Signature dishes…".
- **Override (developer):** tier words in the cookbook (Law 4's "no graded
  rating" there); digits still never shown.
- Not saved, by developer decision (2026-10-21): best combo / variants per
  recipe stay "This visit (not saved)" — no save field for them.
- QA `phase4-qa`; browser `tools/e2e/phase4.mjs`. Working tree only.

## Phase 3: Fever Mode, Prep Rush, Kitchen Chaos, special variants (2026-10-21, not committed)

- Fever Mode on the Clean ×10 milestone (6 s, once an order); Endless Prep Rush,
  a conveyor mini-game on its own screen (order-board tile); the Kitchen Chaos
  Director (Giant, Avalanche, Rush Hour, Grandma's Challenge, Perfect Plating,
  Kitchen Inspection — one every 4th eligible order); five special ingredient
  variants (every 3rd eligible order with their ingredient). REFERENCE §10
  "Fever Mode, Prep Rush, Kitchen Chaos and special variants".
- No save field, no money, no new ingredient id; counters and Prep Rush's best
  are session memory. The inspection event reads `inspectBusiness` live, no
  fine.
- QA `phase3-qa`; browser `tools/e2e/phase3.mjs` (needs the restaurant build
  plus the two dev servers it names). Dev builds only: `window.__kcSpecials`.
- Working tree only: no commit, no `BUILD_VERSION` change, no upload.

## Phase 2: bench scraper, money vacuum, serve celebration, tips (2026-10-21, not committed)

- Cutting leaves debris; every 2–3 orders the bench scraper is offered at the
  start of an order (one broad sweep cleans; Skip always there). After Serve
  the payment lands as cash to sweep into the wallet (which was already
  credited — the pill rolls up to the real balance). The customer cheers a
  Masterful dish and nods at a Clean one. REFERENCE §10 "Bench scraper…".
- **Customer tips — new money (developer):** 1 in 3 first-time Masterful
  campaign orders tip 10% (≥ $5), as a new `customer-tip` ledger entry in the
  same save as the order pay. REFERENCE §7 "Customer tips" (bound: ≤ 5%,
  measured 1.79% worst case). This lifts ServiceOrderComplete's old "no tip"
  rule on purpose.
- QA `phase2-qa`; browser `tools/e2e/phase2.mjs`. The shared e2e solver now
  scrapes when offered, and takes opt-in `aim` / `steady` (callers unchanged).
- Working tree only: no commit, no `BUILD_VERSION` change, no upload.

## Phase 1: cutting feel, combo, New Best (2026-10-21, not committed)

- The combo (meter, "Clean ×N!" milestones, rising cut pitch), the board
  drag, Perfect/milestone/completion sounds, the settle tilt, the Knife
  Report's "New Best!" with "Best 72 → 85" and "+N%", and a replay latch.
  REFERENCE §10 "Cutting feel, combo and New Best"; QA `phase1-cutting-qa`.
- Fixed with it: the Knife Report's stats grid overflowed the card on every
  phone width (diagram off-card, "100" clipped at 320 px). Container query
  on the report; browser check `tools/e2e/knifereport.mjs` (26 checks, 6
  screen sizes incl. a 1280×720 window).
- **Two deliberate rule overrides (developer):** pieces now lean as they
  settle (the reference's "no rotation" rule), and the New Best line shows
  score digits (Law 4). Both are scoped and reasoned in their docs — do
  not revert them as fixes.
- Working tree only: no commit, no `BUILD_VERSION` change, no upload.
- e2e baseline is NOT clean: `coach.mjs` and `economyv25.mjs` fail on an
  unmodified build too (REFERENCE §5, "Known pre-existing failures").

## v1.4.1: interstitials show again (2026-10-18)

- Found in the Playgama QA Tool's certification ("Trigger the Interstitial
  Ad"): after every first clear the Level bonus was offered instead of the
  interstitial, and a declined bonus never counts against its daily cap, so
  interstitials stopped. Now the interstitial is decided first (3 levels
  done, 150 s since the last ad) and the bonus is offered only when it didn't
  show. `ad-bonuses-qa` E3, `adbonuses.mjs` 3a/3b. `BUILD_VERSION` 1.4.1.
- Uploaded as `knifecraft-playgama-1.4.1` (id `cmve2clpwadmdmz0h3gxvkqay`, from
  `f76a002`): check PASSED, Bridge 2.3.1 FOUND. Certification restarts on it;
  the sandbox still serves 1.4.0 until the developer approves a publish.

## v1.4.0 uploaded to Playgama (2026-10-18)

- Archive `knifecraft-playgama-1.4.0` (id `cmvdtce9m9cbunj0h19uop72a`, built
  from `ec6f66e`): processing DONE, check PASSED, Bridge 2.3.1 FOUND.
- Published to the sandbox on the developer's approval: https://playgama.ai/play/gm6cvisosg
  serves v1.4.0 (publication PUBLISHED; launch step "sandbox" DONE). Not yet
  played on the live link from a cloud session (its network blocks
  playgama.ai). The form still waits on certification in the QA Tool (the
  developer's).

## Bug sweep before the v1.4.0 upload (2026-10-18, `main`)

- A crawl of every screen (Kitchen, Market tabs, map rooms, Business tabs,
  Inventory, Progress, Achievements, Settings, Second Floor) at 320 / 390 /
  768 px found no console or page errors and no sideways scroll.
- Fixed: map text under 8.5 px (the guest's order bubble 7 px, the
  restaurant's name sign 8 px, the Second Floor's carried items 8 px → 9 px);
  a pending Level-bonus sheet could open over the next level's board (it is
  dropped when a level starts, and no ad sheet shows during gameplay); a long
  press / right click opened the browser's menu (Playgama checklist #25 —
  GameShell blocks it outside text fields; `pgbridge.mjs` checks it).

## Five ad bonuses (2026-10-18, `main`)

- Developer: "build 1–5". From Level 3, each an optional rewarded ad with its
  own placement and daily cap, all through one sheet (what it gives → 📺 Watch
  / No thanks): **floating cash** over the Kitchen (6/day), **level bonus** +50%
  after a first clear (3/day, only at a break with no interstitial — 1.4.1), **short by**
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

| Item               | State                                                                                                                                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary codebase   | this repo, `D:\WORKS\GAMES\Playgama\KnifeCraft`                                                                                                                                                                                                          |
| Retired codebase   | `D:\WORKS\GAMES\Knife Craft` (YouTube Playables build, GitHub `mishal4583/Knife-Craft`). Its last commit `1af591f` is the base of this repo's history (`youtube-original/main`). It still has the story change as **uncommitted** edits; leave it alone. |
| Distribution       | Playgama → its catalog + partner platforms ("distribute everywhere", no exclusions). No direct YouTube Playables release.                                                                                                                                |
| Platform SDK       | Playgama Bridge v2 (detected by Playgama: bridge 2.2.0, engine javascript)                                                                                                                                                                               |
| Live sandbox       | https://playgama.ai/play/gm6cvisosg — status ACTIVE, published 2026-09-26, running archive `knifecraft-playgama-1.0.0` (the **old** 13-beat intro, no Skip). Launch steps now say the sandbox is OUTDATED (form/covers changed since).                   |
| Latest local build | this repo at HEAD: re-paced intro + Skip story (not uploaded yet)                                                                                                                                                                                        |

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
