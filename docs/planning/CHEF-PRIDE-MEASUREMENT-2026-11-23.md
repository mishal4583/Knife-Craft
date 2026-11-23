# Chef Pride: how we measure it (Phase 7)

Written 2026-11-23. Part of `CHEF-PRIDE-PLAN-2026-11-23.md`. The events below are guarded by `scripts/chef-pride-analytics-qa.mts`: the table and the code must list exactly the same events.

## 1. The events

Every event goes through `sendAnalyticsEvent` (`src/game/PlayablesSDK.ts`, the only file that touches the Bridge), carries `game_version` automatically, uses a stable snake_case name, and has flat data with no personal data, text, ids of people or the numbers a player scored.

| Event | Data | Sent when | Answers |
|---|---|---|---|
| `record_broken` | `kind`: `perfects`, `combo`, `speed` (a plate) or `accuracy` (a service) | A plate or service strictly beat a real earlier mark | Do players reach records, and which? |
| `rival_passed` | `rank_to`, `passed` | A first completion passed a rival restaurant | How fast do players climb the ranking? |
| `assistant_beat_shown` | `beat` = `rival` (Paige's rival message), `level` | Paige showed a message (existing event) | How often does a rival message appear? |
| `title_earned` | `identity`, `tier` | A chef title was announced at the end of a service | Which identities do players lead? |
| `prestige_reached` | `tier` (1 to 4) | The restaurant reached a new prestige tier (announced at the end of a service) | How far do restaurants climb the prestige tiers? |
| `league_week_end` | `tier`, `rank`, `promoted` | A city league week ended and its result was shown | How many players have a league week, where do they finish, how many are promoted? |
| `dare_offered` | `id` | The Kitchen showed an offered dare (once per day and app run) | How many players could take a dare? |
| `dare_taken` | `id` | "Take the dare" | Acceptance = `dare_taken` / `dare_offered` |
| `dare_declined` | `id` | "Not today" | Which dares are turned down? |
| `dare_completed` | `id` | A dare was won | Completion = `dare_completed` / `dare_taken` |

Planned for a later phase (not sent yet): `moment_shared {kind, method}` (Phase 6).

## 2. Baseline (Playgama telemetry, 2026-10-24 to 2026-11-23)

Read with the Playgama telemetry tools on 2026-11-23. Numbers are the evidence at that date, not a forecast.

| Measure | Value |
|---|---|
| Sessions / identified users in 31 days | 260 / 230 |
| Sessions per day | about 20 to 33 on 24 to 28 Oct, then 2 to 12 a day; 2 to 4 a day since 10 Nov |
| Session length | median 56 s, mean 190 s, 95th percentile 11.5 min |
| Level-completed events | 263 from 124 users; median level length 44 s |
| Furthest level reached (`step_index` of `progression_completed`) | median 1, 90th percentile 22, maximum 38 |
| Interstitial ads opened / rewarded ads opened | 112 (36 users) / 7 (5 users) |
| Game version on every event | only `1.4.1` |

## 3. What this means (read this before judging any result)

1. **None of Chef Pride is live in this data.** Every event is from build 1.4.1. The local build is 1.6.0, and no release zip with Chef Pride has been uploaded. There is nothing to measure until a build with it reaches players.
2. **The sample is tiny.** About 2 to 4 sessions a day recently means a two-week window is 30 to 60 sessions. Day-1 and day-7 return rates from that are noise: one player moves them by several points. Do not run a percentage decision rule on it.
3. **Most players never reach the Chef Pride features.** The median player completes one level and stays under a minute; the 90th percentile reaches about Level 22. Records show from the first plates, the rival from Level 8, dares from Level 6, titles from Level 3. The ego features therefore reach roughly the top tenth of an already small audience, and the first minute is where most players are lost.
4. Rewarded ads are rare (7 opens in a month): do not judge revenue effects from this volume either.

## 4. Revised decision rule (replaces the percentage rule of the detailed plan)

Judge by counts, per `game_version`, once a Chef Pride build has had at least **200 sessions** (the Playgama overview shows `unique_sessions`):

- **Reach:** how many sessions saw each event at least once (`dare_offered`, `record_broken`, `title_earned`, `rival_passed`). If fewer than 1 in 10 sessions reaches any of them, the features are too deep for this audience: work on the first minutes, not on Phases 4 to 6.
- **Acceptance:** `dare_taken` / `dare_offered`. Under about 1 in 5 means the dare copy or placement does not attract; over 1 in 2 means it is liked.
- **Completion:** `dare_completed` / `dare_taken`. Near 0 means too hard, near 1 means too easy.
- **Do not regress:** `core_session_end` count per `core_initialization_started` (sessions that ended), median session length, `progression_completed` per session and rewarded-ad opens per session must not fall against the same measures for 1.4.1.
- Build Phases 4 to 6 only if reach is at least 1 in 10 sessions **and** nothing regresses. Otherwise tune Phases 1 to 3 first.

## 5. How to read it (Playgama MCP, read-only)

1. `get_game_telemetry_analytics` for the period: sessions, users, the event inventory, session length.
2. `get_game_telemetry_event_analytics` with `eventKind: custom`, `eventName: <event>` and `fieldName: game_version` to split by build, or `fieldName: kind` / `id` / `identity` for the breakdown.
3. `get_game_telemetry_timeseries` with `granularity: 1d` for the trend of one event.
4. Always compare a Chef Pride build against 1.4.1 over the same number of days, and say how many sessions each had.

## 6. Before a release (the developer's steps)

- Raise `BUILD_VERSION` (`src/game/config/buildVersion.ts`), build, zip with Python `zipfile`, upload with the Playgama tools (`get_launch_steps` first). `publish_sandbox` and `start_sandbox_traffic` always need the developer's explicit yes.
- A bigger lever than any ego feature may be traffic itself (a few sessions a day) and the first minute (median session 56 s); the Chef Pride plan cannot fix either.
