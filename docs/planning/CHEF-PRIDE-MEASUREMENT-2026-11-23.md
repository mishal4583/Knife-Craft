# Chef Pride: how we measure it (Phase 7)

Written 2026-11-23. Part of `CHEF-PRIDE-PLAN-2026-11-23.md`. The events below are guarded by `scripts/chef-pride-analytics-qa.mts`: the table and the code must list exactly the same events.

## 1. The events

Every event goes through `sendAnalyticsEvent` (`src/game/PlayablesSDK.ts`, the only file that touches the Bridge), carries `game_version` automatically, uses a stable snake_case name, and has flat data with no personal data, text, ids of people or the numbers a player scored.

| Event                  | Data                                                                                                                               | Sent when                                                                      | Answers                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `record_broken`        | `kind`: `perfects`, `combo`, `speed` (a plate) or `accuracy`, `service_perfects` (a service; one event per kind, once per service) | A plate or service strictly beat a real earlier mark                           | Do players reach records, and which?                                              |
| `rival_passed`         | `rank_to`, `passed`                                                                                                                | A first completion passed a rival restaurant                                   | How fast do players climb the ranking?                                            |
| `assistant_beat_shown` | `beat` = `rival` (Paige's rival message), `level`                                                                                  | Paige showed a message (existing event)                                        | How often does a rival message appear?                                            |
| `title_earned`         | `identity`, `tier`                                                                                                                 | A chef title was announced at the end of a service                             | Which identities do players lead?                                                 |
| `prestige_reached`     | `tier` (1 to 4)                                                                                                                    | The restaurant reached a new prestige tier (announced at the end of a service) | How far do restaurants climb the prestige tiers?                                  |
| `league_week_end`      | `tier`, `rank`, `promoted`                                                                                                         | A city league week ended and its result was shown                              | How many players have a league week, where do they finish, how many are promoted? |
| `moment_shared`        | `kind` (`title`, `prestige`, `league`, `rival`, and the dish moments), `method` (`share` or `save`)                                | The player shared a card with the phone's share sheet, or saved its image      | Do players share their achievements, and which?                                   |
| `dare_offered`         | `id`                                                                                                                               | The Kitchen showed an offered dare (once per day and app run)                  | How many players could take a dare?                                               |
| `dare_taken`           | `id`                                                                                                                               | "Take the dare"                                                                | Acceptance = `dare_taken` / `dare_offered`                                        |
| `dare_declined`        | `id`                                                                                                                               | "Not today"                                                                    | Which dares are turned down?                                                      |
| `dare_completed`       | `id`                                                                                                                               | A dare was won                                                                 | Completion = `dare_completed` / `dare_taken`                                      |

**Delivery rules (audit Batch 5, 2026-11-24; guarded by `chef-pride-analytics-qa` section F).**

- **Only after the save.** Every event above, except `dare_offered` (nothing is saved when a dare is only shown) and `moment_shared` (the player's own tap on Share or Save image), is sent after `persist()` has written the save that holds the thing it reports (`saveWrittenRef`). A refused save sends nothing, so a retry can never count the same record, dare, title or league week twice. A plate's `record_broken` and `dare_completed` leave from inside `persist()` itself; a dare won by a service or a day is queued by `noteDareWin` and leaves from the same place.
- **Once.** `league_week_end` is sent once per week: its "shown" mark is saved first and the event only follows a written save (an unsaved mark would bring the effect back and send it twice). `assistant_beat_shown` is counted only after the beat's "seen" mark is saved.
- **Not from a preview.** The Knife Report's lines are computed from the plate before it is saved; the report itself sends nothing. An abandoned or retried attempt never wrote a record, so it never sends `record_broken`, and it never counts toward a title or a dare.
- **Business plates and campaign plates** each go through the same `persist()` path once per plate (`shift-recognition-qa`, `batch3real.mjs`); a batch service changes no star rating.
- **Never sent:** names, scores, text, ids of people or any population claim. The game shows no figure about other players (there is no population data); the league is "the city's restaurants", labelled as such.

## 2. Baseline (Playgama telemetry, 2026-10-24 to 2026-11-23)

Read with the Playgama telemetry tools on 2026-11-23. Numbers are the evidence at that date, not a forecast.

| Measure                                                          | Value                                                                         |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Sessions / identified users in 31 days                           | 260 / 230                                                                     |
| Sessions per day                                                 | about 20 to 33 on 24 to 28 Oct, then 2 to 12 a day; 2 to 4 a day since 10 Nov |
| Session length                                                   | median 56 s, mean 190 s, 95th percentile 11.5 min                             |
| Level-completed events                                           | 263 from 124 users; median level length 44 s                                  |
| Furthest level reached (`step_index` of `progression_completed`) | median 1, 90th percentile 22, maximum 38                                      |
| Interstitial ads opened / rewarded ads opened                    | 112 (36 users) / 7 (5 users)                                                  |
| Game version on every event                                      | only `1.4.1`                                                                  |

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

## 7. What is instrumented and what needs a live release (audit Batch 5, 2026-11-24)

No Chef Pride build has reached players, so **every result below is unknown today.** "Instrumented" means the code sends the event and a QA suite proves when; it does not mean the feature works for players.

| Question                                        | Event(s) / source                                                               | Instrumented in the code                                                                                                                                                        | Needs a live release to answer                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Do players reach records?                       | `record_broken` by `kind`                                                       | yes                                                                                                                                                                             | reach and the mix of kinds                                                               |
| Do players climb the ranking?                   | `rival_passed`                                                                  | yes                                                                                                                                                                             | pace and distribution                                                                    |
| Do rival messages appear, and are they put off? | `assistant_beat_shown` with `beat = rival`                                      | shown: yes. **"Later" has no event of its own** (it is stored in `guideSeen`, not measured)                                                                                     | how often a message is shown and not repeated                                            |
| Which chef identities do players earn?          | `title_earned` by `identity`, `tier`                                            | yes                                                                                                                                                                             | the spread of identities and tiers                                                       |
| How far does the restaurant climb?              | `prestige_reached` by `tier`                                                    | yes                                                                                                                                                                             | tier distribution                                                                        |
| League participation and results                | `league_week_end` (`tier`, `rank`, `promoted`)                                  | yes                                                                                                                                                                             | needs at least one full calendar week of play per player (Monday to Sunday, device time) |
| Dare acceptance and completion                  | `dare_offered`, `dare_taken`, `dare_declined`, `dare_completed`                 | yes                                                                                                                                                                             | the rates in section 4                                                                   |
| Social sharing                                  | `moment_shared` by `kind` and `method`                                          | yes. `share` is sent when the phone's share sheet resolves, `save` when the image download starts. It cannot show that anyone saw the card, and a cancelled sheet sends nothing | how many cards are shared or saved, and which                                            |
| Returning players (day 1, day 7)                | Bridge's own `core_*` events, `core_initialization_started` per identified user | not a Chef Pride event; already collected                                                                                                                                       | needs a Chef Pride build and a sample large enough to mean anything (section 3)          |
| Session length and levels per session           | `core_session_end`, `progression_completed`, `level_completed`                  | already collected                                                                                                                                                               | the same comparison against 1.4.1                                                        |
| Ad effect                                       | `rewarded` and interstitial events of Bridge                                    | already collected; **Chef Pride adds no ad placement, pays no money and changes no payout**, so any change in ad opens must not be credited to it without a cause               | a comparison per `game_version`                                                          |
| Performance                                     | none of Chef Pride's own                                                        | **not instrumented.** The build's size and a frame-time check are measured by hand (`npm run preflight`, the browser tests); there is no live frame-time or error event         | a live signal would need a new event, which is out of scope here                         |

### Baseline: what is and is not known

- **Known (section 2):** the 1.4.1 telemetry of 2026-10-24 to 2026-11-23. It is the baseline for the "do not regress" measures only.
- **Not known, and not guessed:** acceptance, completion, reach, sharing and league behaviour. They have no baseline because none of these features existed in 1.4.1. The first Chef Pride build sets its own.
- **Not claimed:** no experiment has run, and nothing in this file says a feature helped. The decision rule in section 4 needs at least 200 sessions per `game_version`; below that, read counts only.

### Retention and engagement indicators (to read, not yet readable)

1. Share of sessions that see at least one of `record_broken`, `title_earned`, `rival_passed`, `dare_offered` (reach).
2. `dare_taken / dare_offered`, then `dare_completed / dare_taken`.
3. Services per session and `progression_completed` per session against 1.4.1.
4. Users with a `league_week_end` in two different weeks (needs two weeks of live play).
5. `moment_shared` per session with a Chef Pride event.

### Checks the team makes by hand before reading any number

- Filter by `game_version`: events from 1.4.1 have no Chef Pride data.
- Compare the same number of days and say how many sessions each side had.
- A dare event with an empty `id` is a bug (QA section F covers the send, not the id's content).
