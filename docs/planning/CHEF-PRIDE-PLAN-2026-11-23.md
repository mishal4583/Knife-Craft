# KnifeCraft "Chef Pride" plan: ego, recognition and competition, built under the cozy restaurant

## Context

The developer wants Gen Z attention and retention through ego-driven motivation (status, proof of skill, a rival to beat), without turning KnifeCraft into a generic competitive game or manipulating players. Two plans were combined: the six-idea plan (named rival, player grades/titles, chef card, near-miss framing, badges, playful taunts) and the Codex plan (superiority/challenge/recognition/social-comparison triggers, Chef Identity, personal records, optional challenges, titles, prestige, weekly leagues, share cards, "what to avoid").

Decisions already made with the developer:
- **Weekly leagues** are local: the player competes against the game's 49 named rival restaurants (no server, no fake player data, works on every platform).
- **First release = Phases 1-3** (records, rival, titles, optional challenges). Phases 4-6 follow after the measurement in Phase 7 shows the first release helps.

Emotional pillars to keep in every screen: "I am skilled", "Look what I built", "I can be the best". Nostalgic cozy restaurant stays the base; competition sits underneath.

## What already exists (reuse, do not rebuild)

- **Per-dish score:** `recipeProgress[id].best`; grade ladder `qualityFor` / `GRADE_THRESHOLDS` (`src/game/CutEvaluator.ts`); "New Best" digits only on a genuine best (`bestVerdict.ts`); Law 4 = the plate is the score, so digits are shown sparingly.
- **Perfect cuts and combo exist only in the live run:** `CUT_COMPLETED` payload (`isPerfect`, `combo`) handled in `Preparation.tsx` ~l.775-810 (`bestCombo`, `perfectSteps`); `recordSessionDish` is memory-only (`signatureDishes.ts`). There is no cut-time or waste-per-cut data. Waste exists only as spoilage (`business.spoilage`, `closingPreview().spoiled`).
- **Service-level data:** `serviceScoresRef` (session only, `App.tsx` ~l.702), `ServiceResult` (`serviceQuality.ts`, last 7 in `business.restaurantDay.serviceResults`), `restaurantRecordOf` (`services, spotless, streak, bestStreak`), `business.finance.history` (30 days), `endlessStarsOf`, `economy.lifetime`.
- **City ranking:** `cityRanking(save)`, `rankChange()`, 49 fixed named rivals with `emoji, cuisine, district` (`src/game/restaurant/cityRanking.ts`); UI `CityRankBadge` (`Kitchen.tsx` ~l.1571), `CityRankHero` / `CityLeaderboard` (`kc/CityRanking.tsx`); celebration path `celebrationFor` + `CelebrationCard` (`App.tsx` ~l.3706).
- **Achievements:** pure `LADDERS` in `progression/achievements.ts` with optional per-tier `title`; badge-only tiers use `reward: 0` (no economy change); UI `kc/Achievements.tsx`.
- **Paige:** transient no-save beats via `miniGamePraise.ts` + `paigePraise` state (`App.tsx` ~l.862, 4692-4720); one beat per screen visit, `calm` gating, level-gap rules, `tipsOff`. "Later" + `REMIND_EVERY_LEVELS` pattern in `restaurantGuide.ts`.
- **Share card:** `moments/momentCard.ts` (`drawMomentCard`, off-screen canvas 1080x1350, bundled fonts) + `MomentPreview.tsx` (Web Share with files, fallback Save image, hidden on YouTube via `sharingAllowed()`).
- **Determinism helpers:** `makeSeededRand` (`business/businessDeterministicRandom.ts`), `dailyKeyFor` / `previousDayKey` (`daily/DailyOrderManager.ts`, device-local day), `playDayOf(save)`.
- **Persistence rule:** new state is ONE optional `business.<name>?` field read by a clamping `<name>Of(save)` helper (model: `restaurantRecordOf`, `carParkStateOf`); never a new top-level field; old saves keep working.
- **Platform limits that shape the plan:** no leaderboard on Playgama/CrazyGames; `bridge.social.share` unsupported on Playgama/CrazyGames/Yandex/YouTube; social actions only from direct player input; no external calls, no clipboard on YouTube; `PlayablesSDK.ts` is the only file touching `window.bridge`; rewarded ads stay opt-in; no time-based server clock (only device-local days).

## Guardrails (apply to every phase; enforced by a copy QA)

1. Every claim shown to the player is true of that player's own data. No "Only 8% of chefs..." or any population percentage (the game has no population data).
2. Taunts are playful and about the rival's attitude, never insults about the player. No shame copy.
3. No streak punishment: a missed day loses nothing. No notification spam; rival/record beats follow Paige's no-nag rules (one per visit, gaps, Later, tips off silences them).
4. No pay-to-win: ego features pay badges/titles, never money; no ads attached in the first release; challenges are opt-in and never block progression (CLAUDE.md "mistake never blocks progress").
5. Presentation-first: no economy figure changes, so the frozen baselines (`economy-v2-campaign-simulation`, `restaurant-final-economy-qa`) stay green.
6. Short copy: a few words, icons and numbers; longer text behind `InfoTip` (`ui-copy-qa`).

## Phase 0: Foundations (small, enables everything)

**What:** one place to remember the player's personal bests and a pure module that turns a finished run/service into "news".

**How:**
- Add `business.chefRecord?: ChefRecord` in `src/game/business/businessTypes.ts` with a clamping reader `chefRecordOf(save)` in new `src/game/restaurant/chefRecord.ts` (pattern of `restaurantRecordOf`; whole-number clamps, missing => defaults). Initial shape (kept small, save stays far under the 3 MiB YouTube limit):
  `{ perfectCuts, bestCombo, bestPlate, fastestMs: Record<recipeId?, never> -> single fastestMs, bestServiceAccuracy, bestServicePerfects, bestFlawlessRun, flawlessRun, seen: string[] }` plus later sub-objects for `challenge`, `titles`, `league`.
- `chefRecord.ts` is pure (no wallet, ledger, clock, or random): `RunStats`, `applyRun(save, stats)`, `applyService(save, stats)`, `recordNews(before, after)` returning `RecordNews[] = {kind, text}` with plain real numbers.
- Capture `RunStats { perfects, bestCombo, cuts, ms }` in `Preparation.tsx`: reuse the existing `bestCombo` and `perfectSteps` refs; add a perfects counter and a start timestamp at scene start; read it in `RECIPE_COMPLETED` (~l.822). Pass it as an optional third argument of `onComplete(result.score, portions, stats)`; `App.tsx` `recordPreparationResult` / `recordCampaignServiceResult` (~l.3065-3990) call `applyRun` while saving. Old callers that pass no stats keep working.
- Service totals: extend the session list `noteServedScore` (`App.tsx` ~l.3082) to keep each plate score and the run stats, then in `completeCampaignLevel` (~l.3544) call `applyService` once, beside `closeServiceReport` / `rateService`.
- Analytics through `sendAnalyticsEvent` (`PlayablesSDK.ts`): `record_broken {kind}`, with `game_version` as always.

**Tests:** new `scripts/chef-record-qa.mts` (pure functions, old-save defaults, clamps, no new top-level save field, no wallet/ledger/random in the rule file, `save-safety-qa` and `restaurant-migration-qa` still pass).

## Phase 1: Recognition: personal records, shift card, near-miss (Codex #3 + idea #4)

**What:** every finished plate and service tells the player specifically what they did better than before.

**How:**
- **Knife Report:** `KnifeReport.tsx` already has a `specials` slot and the "New Best!" block. Add (a) a real-record line ("New personal record: 14 perfect cuts") from `recordNews`; (b) near-miss framing in words only (Law 4 keeps digits rare): when `result.score` is within 4 of the next `GRADE_THRESHOLDS` step, show "A hair from Masterful, one more try" (pure `nearMiss(score)` in `chefRecord.ts`); Retry button already exists (instant retry, no penalty).
- **Shift card:** extend `levelRewardNotice` (`App.tsx` ~l.791) with `shift?: { orders, accuracy, perfects, spoiled, news[] }` and render it as a compact stats grid in `MilestoneBanner.tsx` (reuse `rows`/`notes`; add a new optional `stats` prop). Content = what the data truly gives: orders served, average plate accuracy (average of the session's plate scores), perfect cuts, spoiled items (from `closingPreview`, shown as "0 wasted" only when truly zero). "Improved accuracy by 12%" only when the average is higher than `chefRecord.bestServiceAccuracy` or the previous service's average.
- **Copy:** "Excellent work, Chef!" tiers keyed to the real result; "Precision Chef unlocked" appears when Phase 3's title is earned.
- **Recognition for waste:** be honest, there is no per-cut waste; "Zero waste" = the day had no spoilage (`closingPreview().spoiled.quantity === 0`).
- Wide/PC: `MilestoneBanner` already has a landscape layout; verify the new grid at 1815x867, 1280x720 and 740x360.

**Tests:** `scripts/chef-record-qa.mts` additions (nearMiss thresholds, news only on a real improvement); browser `tools/e2e/chefrecords.mjs` (seed a save, play one order with the solver, check the report line and the shift card appear and fit at 320x568, 390x844, 768x1024, 1280x720, 1815x867; no console errors); run `ui-copy-qa`, `knife-report` related suites and `mini-game-praise-qa`.

## Phase 2: A named rival with a voice (idea #1 + Codex #4 social comparison)

**What:** the "next restaurant to pass" becomes a character the player wants to beat.

**How:**
- New data file `src/game/restaurant/rivalChefs.ts`: for each of the 49 rivals (`RIVAL_LIST`, same ids) a chef name and a few lines: `dare` (before), `beaten` (after you pass them), `respect` (late-game). Written by hand for the first ~12 rivals the player meets, and cuisine/district templates (deterministic pick by hash of the rival id) for the rest, so no rival is blank. The rival's existing `emoji` is the face; painted portraits can be a later Codex art task (not required).
- Surfaces (never a new screen): (a) `CityRankHero` (Progress) shows the next rival's chef name and `dare` line under "Next: pass X"; (b) the Kitchen `CityRankBadge` keeps its two lines (no extra card, the Kitchen is already tight, see layout notes) and gets the rival chef's name only when height >= 600; (c) when `rankChange()` (`App.tsx` ~l.3662) reports a passed rival, `celebrationFor` (`celebrations.ts`) gets a rival `beaten` line in the existing `CelebrationCard`; (d) an optional once-per-rival Paige-style beat before a level that would pass them, using the transient `paigePraise` path (`miniGamePraise.ts` pattern, no save write), shown only on the Kitchen, only when she is hired with tips on, gap of at least 3 levels between rival beats. "Later"/tips-off silence it.
- State: `chefRecord.seen` holds `rival:<id>:<kind>` markers so each line shows once.
- Gated like the existing ranking news: from `RANKING_NEWS_FROM_LEVEL` (8).

**Tests:** new `scripts/rival-chefs-qa.mts` (every rival id has a line set, line length limits as `assistant-qa`: <= 90 chars, <= 1 emoji, no insulting words from a banned list, no digit-percentage claims); extend `restaurant-city-ranking-qa` (rank math untouched); browser: `tools/e2e/rivals.mjs` (celebration shows the rival line after a rank change, beat appears once and respects Later).

## Phase 3: Chef Identity: titles and optional challenges (Codex #1-#3 + ideas #2, #5)

### 3a. Titles and identities
**What:** the player earns a reputation (Precision, Speed, Organizer, Cleanliness, Customer Favourite, Restaurateur) shown as a title, not just money.

**How:**
- New `src/game/progression/chefTitles.ts` (pure): six identity ladders with 4-5 tiers each, valued from data that exists or Phase 0 adds: Precision = `chefRecord.perfectCuts` + plates >= 95; Speed = `chefRecord.fastestMs`-based tiers; Organizer = `fridgeSortOf` perfect/stars; Cleanliness = `restaurantRecordOf.spotless` / `bestStreak`; Customer Favourite = `business.popularity.score` + tips lifetime (`economy.lifetime["customer-tip"]`); Restaurateur = city rank / `endlessStarsOf`. The "current title" is derived (the identity with the highest progress share, ties by a fixed order), not stored; only "earned" announcements are marked in `chefRecord.seen`.
- Register as badge-only `LADDERS` entries (`reward: 0`, ids `ach-chef-<identity>-<n>`) so they show in `Achievements.tsx` automatically and do NOT touch the money-range test (`achievement-rewards-qa` A4) or the economy suites; check regexes in `fridge-sort-qa` J10/J11 and `idle-qa` B1/B2 do not match the new ids.
- Display: title line on `CityRankHero`; a small title chip in the Kitchen rank card only when height >= 600 (same hide rule as its bar); "Title earned" appears in the shift card and as a `CelebrationCard`.

### 3b. Optional skill challenges ("dares")
**What:** opt-in challenges that test the player: No Mercy Prep (5 plates in a row at "Clean" or better), Speed Demon (an order cooked under 30 s), Zero Waste (a day with no spoilage), Perfect Chef (3 consecutive Masterful plates), Clean Freak (a spotless service, already tracked by `restaurantRecordOf.spotless`). **Kitchen Chaos is deferred** (it needs a multi-order notion the engine does not measure today).

**How:**
- New `src/game/restaurant/skillChallenges.ts` (pure): challenge definitions with a `check(progress, runOrService)` and playful copy ("Think you're ready for this?", "Your record is waiting to be broken"). Daily pick uses `dailyKeyFor` and a stable hash (reuse the one in `DailyOrderManager.ts`, exported) so everyone sees the same dare per calendar day; the next rival "issues" it (ties Phase 2 in).
- State in `chefRecord.challenge = { day, id, accepted, progress, done }` (one active dare, resets by calendar day via `dailyKeyFor`; a missed day costs nothing).
- UI: an opt-in "Dare" row in the Next Customer collapsible (`Kitchen.tsx` `#kitchen-order-details`, no layout risk) with "Take the dare" / "Not today"; progress shown on the shift card; success pays a badge/title step only (no money, no ad). Unlocks at Level 6. A failed dare never blocks anything.
- Evaluation hooks: per plate in `recordPreparationResult` (Phase 0 stats), per service in `completeCampaignLevel`, per day in `closeDay` (spoilage).

**Tests:** `scripts/chef-titles-qa.mts` (tier math, derived title is deterministic, ids unique and `ach-`-prefixed, badge-only), `scripts/skill-challenges-qa.mts` (daily pick deterministic across calls, each check logic, reset by day, opt-in required, nothing paid), re-run `achievement-rewards-qa`, `economy-v25-qa`, `restaurant-final-economy-qa`; browser `tools/e2e/dares.mjs` (accept, complete No Mercy Prep with the solver, badge appears, Not-today leaves no trace).

## Phase 4 (after measurement): Restaurant Prestige (Codex #5)

**What:** a long-term aspiration for "look what I built".
**How:** pure `restaurantPrestige.ts` derived from stage, `endlessStarsOf`, popularity, cleanliness record and city rank, with named tiers shown on `RestaurantProgress.tsx`. Cosmetic rewards (restaurant name plaque style, Kitchen trophies) need painted art: request from Codex through the existing art-prompt workflow, then integrate like the rail icons. No economy change.

## Phase 5 (after measurement): Weekly city league (Codex #5, local version)

**What:** weekly competition with the named rivals, Bronze to Diamond (Apprentice, Skilled, Master, Executive, Legendary Chef).
**How:** `cityLeague.ts` (pure): `weekKeyFor(date)` built on `dailyKeyFor`; league points = the player's weekly gain (perfects, services, spotless days), rivals' weekly points come from a seeded formula (`makeSeededRand` over week + rival id) scaled to the player's tier so the contest is always fair; state `chefRecord.league = { week, tier, points, history[] }`. The first Kitchen visit of a new week shows a result `CelebrationCard` (promote on a top-third finish; no demotion shame, "stay" is the floor). UI: a card in `CityRanking.tsx`. Clearly labelled as the city's restaurants (not other players) to keep trust. Optional later: send the weekly score to the Bridge leaderboard only on platforms that support it (`yandex`, `y8`, via `PlayablesSDK.ts` `sendScore`, currently a stub).

## Phase 6 (after measurement): Shareable chef cards (Codex #6)

**What:** "THE PERFECT 50" style achievement cards.
**How:** extend `momentCard.ts` / `MomentPreview.tsx` with new `KitchenMoment` kinds (`title`, `record`, `league`) fed from `recordNews` and title unlocks (`kitchenMoments.ts` shape: `kind, emoji, heading, badge, lines, shareText`). Reuse the canvas renderer, bundled fonts, Web Share with files and Save image fallback; hidden on YouTube by `sharingAllowed()`; triggered only by a tap on "Share" (never automatically); no new library, no external call, no clipboard. Add the Bridge `social.share` only for platforms that support it, behind `PlayablesSDK.ts`.

## Phase 7: Measure before building more (runs alongside 1-3)

- New analytics events (stable snake_case, flat data): `record_broken {kind}`, `rival_beat_shown {rival_index}`, `dare_taken {id}`, `dare_completed {id}`, `title_earned {identity, tier}`, later `league_week_end {tier, rank}`, `moment_shared {kind, method}`.
- Compare for two weeks with the Playgama telemetry tools (`get_game_telemetry_analytics` and friends): sessions per player per day, day-1/day-7 return, services per session, dare acceptance and completion, rewarded-ad views. Proceed to Phases 4-6 only if the first release moves repeat visits or session length, as the Codex plan advises; engagement alone is not revenue.

## Documentation and housekeeping per phase

- `docs/HANDOFF.md` status line; `docs/REFERENCE.md` §10 entry (where, what, tap, hidden, tests) and the §5 suite index; `docs/planning/CHEF-PRIDE-PLAN-2026-11-23.md` with this plan.
- Any rule change to an existing test is made with a RULE CHANGE comment and said in the commit (CLAUDE.md §8).
- Commit only on the developer's explicit "commit and push".

## Critical files

- New: `src/game/restaurant/chefRecord.ts`, `rivalChefs.ts`, `skillChallenges.ts`, `src/game/progression/chefTitles.ts`; QA suites listed above; `tools/e2e/chefrecords.mjs`, `rivals.mjs`, `dares.mjs`.
- Modified: `src/game/business/businessTypes.ts`, `src/components/kc/game/Preparation.tsx`, `KnifeReport.tsx`, `src/App.tsx` (record/service hooks, `levelRewardNotice`, rival beat), `src/components/kc/story/MilestoneBanner.tsx`, `src/game/restaurant/celebrations.ts`, `src/components/kc/CityRanking.tsx`, `Kitchen.tsx` (dare row, title chip), `src/game/progression/achievements.ts`, `src/game/daily/DailyOrderManager.ts` (export the hash).

## Verification (end to end)

1. Gates for each phase: `npx tsc --noEmit -p .`, ESLint on `src scripts tools`, Prettier on the changed files, `npm run build`, `npm run preflight`.
2. QA suites: the new ones plus `achievement-rewards-qa`, `economy-v25-qa`, `restaurant-final-economy-qa`, `economy-v2-campaign-simulation` (unchanged baselines), `restaurant-city-ranking-qa`, `ui-copy-qa`, `assistant-qa`, `mini-game-praise-qa`, `save-safety-qa`, `restaurant-migration-qa`, `layout-fit-qa`, `playables-ads-qa`.
3. Browser: the new `tools/e2e/*.mjs` at 320x568, 360x640, 390x844, 768x1024, 1280x720, 1815x867 and 740x360, looking at screenshots (nothing covering controls, 48 px targets, no sideways scroll), plus a played order and service with the cutting solver (`tools/e2e/solver.mjs`), watching the console for errors.
4. Old-save check: load a pre-change save (no `chefRecord`) and confirm nothing breaks and the first run creates the record.
5. Compliance: grep that no `window.bridge`, network call, clipboard or Page Visibility use leaves `PlayablesSDK.ts`; confirm share is hidden on YouTube.

## Open items for later decisions

- Painted rival portraits and prestige cosmetics (Codex art requests).
- Whether to add a real Bridge leaderboard score for Yandex/Y8 once Phase 5 ships.
- Kitchen Chaos challenge needs a new multi-order measure; deferred until the engine can measure it.
