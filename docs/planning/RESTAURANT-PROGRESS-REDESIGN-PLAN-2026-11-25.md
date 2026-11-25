# Restaurant Progress: make the page like the developer's design document, and trim it (plan, 2026-11-25)

**Developer's request (2026-11-25):** "Make the restaurant progress page exactly like this in the document. Make plan and give codex prompt to generate all the assets and for reference attach this document path." Then: "also optimize the page, there are multiple rankings and other things, check if they are actually required."

**Answers from the developer (2026-11-25):** keep the game's card order; the City Restaurant Guide stays an inline card, no X button; show ALL 8 cutting boards ("all these images are concept images generated", so the pictures show the style and the content, not the exact count or wording); the game's wording stays where the mock-up's differs; the Staff row is dropped from this page.

**The design document:** `C:\Users\HP\Documents\OneDrive\Documents\Restaurant Progress UI design.docx` (nine concept pictures, no text). The nine pictures are copied into the repo, one file each, so they can be attached to Codex and opened without OneDrive:

| #   | Reference picture (`docs/planning/reference/restaurant-progress/`) | Shows                                                                                                         |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 1   | `01-city-restaurant-guide.png`                                     | City Restaurant Guide: the 50-restaurant list (top 3 with painted buildings, then the player's neighbourhood) |
| 2   | `02-ranking-chef-title-prestige.png`                               | City Ranking hero, Your Chef Title, Restaurant Prestige (the narrow / phone width)                            |
| 3   | `03-city-league.png`                                               | City League (Bronze League table)                                                                             |
| 4   | `04-standing-numbers-restaurant-card.jpeg`                         | Restaurant Standing, Your Restaurant in Numbers, the restaurant's own card ("The Copper Pan")                 |
| 5   | `05-next-goal-campaign-progress.jpeg`                              | Next Goal (a chapter, with a painted vignette) and Campaign Progress with the journey track                   |
| 6   | `06-restaurant-earnings.png`                                       | Restaurant Earnings and the Level Rewards chart with the "Total Level Rewards" plaque                         |
| 7   | `07-local-rankings-journey.jpeg`                                   | Local Restaurant Rankings (city benchmark) with the City Popularity shield, and Your Restaurant Journey       |
| 8   | `08-knives-cutting-boards.jpeg`                                    | Knives (painted, two columns), Knife Mastery (Blacksmith), Cutting Boards                                     |
| 9   | `09-milestones.jpeg`                                               | Milestones table                                                                                              |

The game today (before/after comparison): `current-wide-before-2026-11-25.png`, `current-portrait-before-2026-11-25.png` (same folder).

## The finding in one paragraph

The mock-up changes the LOOK of the page, not its data: every number in the nine pictures already exists in the game and the current screen shows it, as plain cream cards with emoji. The mock-up turns each card into a painted one (gold ribbon headings with painted icons, painted buildings, medals, knives, boards, glossy bars, pills, wide layouts). So the work is (1) new paintings, (2) one shared "painted card" kit in code, (3) re-laying out the cards. No economy, save or rule change. The audit below also removes what the page says twice.

## The audit: is every card on the page actually required?

The page today is about 6,350 px tall (7 screens in a wide window, 7 on a phone) and has 17 cards. Checked against the code (`restaurantProgress.ts`, `restaurantStanding.ts`, `CityRanking.tsx`, `Achievements.tsx`):

**Removed (the game says it twice, or says it wrongly):**

1. **Local Restaurant Rankings (the "city benchmark") and its shield.** It is a SECOND ranking: a fixed list of seven made-up restaurants (Golden Spoon, Hearth and Herb, ...) scored by popularity (`CITY_BENCHMARK`). It disagrees with the real ranking on the same page: it can put the player 6th while the City Ranking hero and the City Guide say "#10 of 50"; none of its restaurants is one of the 50 in the guide. Nothing else reads it. It goes, and with it the City Popularity shield.
2. **The Popularity card** (shown only after the campaign): popularity is already a tile in the Prestige strip (and on the Business screen). It goes.
3. **"Restaurant Complete" row in Standing:** `complete` and `endlessUnlocked` are the same rule in the code (the stage even turns into "Restaurant Complete" when the campaign is done). One row stays: **Endless Restaurant** (Locked / Open).
4. **"Remaining wealth" row in Earnings:** the same number as "Current cash" (and as the wallet in the page header). It goes.
5. **The plain progress bar in Campaign Progress:** the journey track right under it shows the same position (69 of 91). The track stays (it is the picture), with the "69 / 91 levels" and the % pill.
6. **The restaurant card ("The Copper Pan") as its own card:** its four rows repeat other cards: Campaign (= Campaign Progress), Restaurant rank (= the Kitchen title row in Standing). Its two new rows, **Chapters** and **Recipes cooked**, move into Campaign Progress as bars; the restaurant's name goes on a ribbon under the painted storefront in Standing. The old 12-row summary list (`Summary`) is gone (its other rows: Knives and Boards = the Knives and Boards cards; Kitchen upgrade = Journey; Blacksmith = Knife Mastery; Level rewards earned = Earnings; Business / Popularity = Standing and Prestige; **Staff** is dropped, it lives in Business).

**Shortened:**

7. **Milestones** is the longest block (21 rows) and lists the same money events the Achievements screen collects. It shows the next 6 milestones still to earn, "9 of 21 done", and a "Show all 21" button that opens the full table exactly as in the mock-up.

**Kept on purpose:**

- **City Ranking hero, City Guide, City League:** three views of three different things: where you stand now (the headline and the rival to beat), the whole city list (folded to 8 rows, "Show all 50"), and this week's contest (its own table and points). They are not the same list.
- **Chef Title and Restaurant Prestige:** one is the player's skill, the other the restaurant's status. The Prestige strip repeats a few values (stage, ranking, popularity) on purpose: they are the parts of the prestige score, shown with their points (for example "+32").
- **Next Goal and Campaign Progress:** what unlocks next (with its own bar) versus where you are in the whole campaign.
- **Journey:** the only place that shows the six kitchens as pictures.
- **Earnings and the Level Rewards chart:** one card (a single ribbon).
- **Knives, Knife Mastery, Cutting Boards:** the only place that shows what you own; the Market is where you buy.
- **The Achievements entry** at the top (the only way to collect money).

**Result: 17 cards become 15 (the entry strip counts as the first), three rows fewer, the longest block half as long; roughly a quarter shorter page.** Tests that read a removed card or row are updated with a RULE CHANGE note quoting this request (`restaurant-progress-qa` D, `restaurantendless.mjs` row text, `economyv25.mjs` "Remaining wealth"); the `cityBenchmark()` function stays in the code (it is only no longer drawn), so its own QA still passes.

## Rules that stay true (CLAUDE.md)

- Pure display: nothing on this page buys, equips or changes anything. All numbers come from the same view models as today. No new save field, no new ledger entry, no `Math.random`.
- Every word on the page comes from the game's data. The mock-up's samples are samples: "The Copper Pan" is the player's restaurant name, "Lightning Chef" the player's current title, "Bronze League" and "$1,395,671.46" example values. Where the mock-up's wording differs from the game's ("Unlock in 7 recipes" where the game says "in 7 services", "5 spotlights in a row" where the game says "5 spotless in a row"), the game's wording stays.
- Landscape: a wide window is filled edge to edge and has a real wide layout (the mock-up is that layout); the upright phone keeps a stacked layout of the same cards (picture 2 is the narrow look).
- Short copy, text sizes (12 to 14.5 px descriptions, badges 11 px, nothing under 8.5 px), touch targets at least 48 px, no sideways scroll at 320x568, 360x640, 390x844, 430x900, 768x1024.
- Pictures are bundled files, no network, low size (REFERENCE section 10 "Image size budget"). A painted picture that fails to load falls back to today's emoji / painted icon.
- Every `data-testid` of the cards that stay is kept: `city-rank-hero`, `rival-chef-line`, `rival-chef-respect`, `city-leaderboard`, `chef-title-card`, `chef-title-name`, `chef-title-goal`, `chef-title-records`, `chef-title-chips`, `prestige-card`, `prestige-tier`, `prestige-goal`, `prestige-parts`, `league-card`, `league-name`, `league-goal`, `league-table`, `league-last`, `restaurant-standing`, `endless-stars`, `restaurant-numbers`, `achievements-entry-note`.

## The page, card by card (the game's order, 15 cards)

1. **Achievements entry:** a gold-ribbon strip with the trophy, "$5,200.00 waiting to collect" (the current text).
2. **City Ranking hero** (picture 2): wood banner with a gold ribbon tab "CITY RANKING"; gold trophy at the left of "#10 of 50"; laurel emblem (chef hat over crossed knife and whisk) at the right; the two rival-chef quote lines get a small chef face each. (`CityRankHero`; same `rival-chef-*` testids.)
3. **Your Chef Title** (2): painted identity icon (a lightning bolt for Speed, and so on) before the title; a glossy gold bar; the six identity chips with a painted icon and gold stars; ⓘ stays. (`ChefTitleCard`)
4. **Restaurant Prestige** (2): a painted building for the tier (five tiers, five buildings) before the tier name; a glossy bar with a gold star cap; the parts as a strip of five small tiles (Kitchen stage, City ranking, Popularity, Spotless services, Endless stars) with painted icons and the green `+points`. (`PrestigeCard`)
5. **City League** (3): a small ribbon medal for the tier, the tier name in the serif, "Apprentice Chef . 3 days left", a gold pill with a star for the goal line, a big laurel badge at the top right (five tiers, five badges); the rows become pills: laurel medals for 1 to 3, number pills for the rest, the player's row gold; the footer line stays. (`LeagueCard`)
6. **City Restaurant Guide** (1): skyline icon, "Every campaign service you complete builds your reputation. Finish all 91 to be the city's best." (one line in a wide window, behind the ⓘ on a phone); ranks 1 to 3 with a laurel medal, a painted storefront (one per podium place), name, cuisine and district, and the points in a star pill; a "..." gap; the player's neighbourhood (rank - 2 to rank + 2) as number pills with the rival's emoji; the player's row gold with the chef face and "That's you"; "Show all 50" as a full-width button (at least 48 px). No X button. (`CityLeaderboard`)
7. **Restaurant Standing** (4): ribbon; at the left a painted storefront of the player's kitchen stage with a soft glow (six stages, six pictures) and the restaurant's name on a ribbon under it; at the right four rows with painted icons: Kitchen title (a laurel pill), Stage ("Established Restaurant . 11 / 14"), Next stage (a gold pill), Endless Restaurant (a gold padlock pill "Locked" / "Open"); the hint line; the Endless stars block (once open) stays. (`StandingCard`)
8. **Your Restaurant in Numbers** (4): six tiles in 3 columns x 2 rows (2 x 3 on a phone), each with a big painted icon (frying pan with egg, guests at a table, takeaway bag, taped box, pink soap, sparkles), number and label; then the streak pill ("Spotless streak: 10 . Best 10 . 2 pieces broken") and a pill with the quality rule and the inspector face. (`NumbersCard`)
9. **Next Goal** (5): gold ribbon with a target; an open-book icon, the goal's name ("Chapter 11 . Korean Kitchen"), "Unlock in 7 services" in the hand font, a green striped bar with the "70 / 77" pill; at the right a painted vignette of the goal (a chapter's cuisine, a cafe rank, the Campaign Finale). The Campaign Complete state keeps its text with the trophy vignette. (`NextGoal`)
10. **Campaign Progress** (5): ribbon with a flag; map icon, "69 / 91 levels", a % pill, "Chapter 10 / 13 . Thai & Southeast Asian"; two bars, **Chapters** ("9 / 13 completed") and **Recipes cooked** ("105 / 138"); the pill "YOUR RESTAURANT ALONG THE CAMPAIGN" and the track: a painted storefront at the start, gold check coins for the ticks passed (1, 18, 36, 55, 73, 91), a glowing green chef-hat coin for "you are here", grey ring coins ahead. (`CampaignCard`, `JourneyTrack`)
11. **Restaurant Earnings with the Level Rewards chart** (6): one card; ribbon with a money bag and, top right, a painted cluster (chef hat, coin stacks, clipboard with a chart, leaves); two columns of rows with painted icons and cream value pills: Current cash, Level rewards earned, Milestone rewards, Final Reward, Business revenue; (dashed line) Invested in your restaurant, Business running costs, Total spent; then the chart under a sub-ribbon: the dark wooden plaque at the left ("$165,130 Total Level Rewards (Cumulative)"), the chart at the right (dashed grid, glossy copper line, soft gold area, a gold dot at the end). (`Earnings`, `EarningsChart`)
12. **Your Restaurant Journey** (7): the six kitchens in one row (wide) or two rows of three (phone): the kitchen picture in a gold frame, a gold check badge when reached, a crown on the current one, gold `>>` arrows between, a name ribbon under each, "reached" / "your kitchen" / the unlock level. (`Journey`)
13. **Knives with Knife Mastery** (8): ribbon with a knife and a vegetables-and-chef-hat decoration, a gold pill "3 / 8 owned" with a crate; eight painted knives on small wooden stands, two columns, each row: a round status mark (a gold check for owned or in use, a market stall for "in the market", a hand for "in hand"), the knife, its name, a status pill ("OWNED . +1 star", "IN THE MARKET", "IN HAND . +1 star"); owned and in-hand rows glow. Under it Knife Mastery: a sub-ribbon with a hammer, a copper anvil medallion, "0 / 36 upgrade levels", a bar, the game's own line "across the knives you own", and a painted anvil with sparks at the right. (`Knives`)
14. **Cutting Boards** (8): ribbon with a board and "1 / 8 owned"; ALL eight boards as painted pictures, 4 per row (two rows); the one in use has a gold frame and a check, locked ones are dimmed with a gold padlock coin; names under each. (`Boards`)
15. **Milestones** (9): a big gold banner "MILESTONES" with a trophy and stars and "Each pays once . collect in Achievements", a clipboard with leaves at the right; the next 6 milestones still to earn first, "9 of 21 done", and "Show all 21" which opens the full table: a status mark (gold check coin or an empty ring), a painted icon per milestone, the label, for paid ones a green tick, a coin and the green amount, for the others a pill ("THIS SERVICE", "IN 7 SERVICES") and the grey amount; paid rows have a warm gold band, "earlier" for waived ones. (`Milestones`)

## Layout: one card set, two widths

- Cards use **container queries** (`@container`), so a card lays itself out by its own width, not by a `land:` flag: wide (the mock-up pictures 1, 3 to 9) from about 720 px of card width, narrow (picture 2, and the phone) below that. This also makes the page right at in-between sizes (a tablet, a phone on its side).
- The page column in a wide window keeps filling the window (about 1210 to 1400 px of cards); cards stack one under another, as in the mock-up. Nothing is cropped or hidden to fit.
- Painted pieces keep their ratio and never stretch; wide card art sits with `object-fit: contain` over a cream ground so a card never shows a bar.

## What needs painting (Codex): the asset list

Ready prompts, ten sheets, in `RESTAURANT-PROGRESS-CODEX-PROMPTS-2026-11-25.md`; each saved as `Restaurant Progress Assets/RP-<id>.png` in the repo root (a Codex source folder like the others), with the nine reference pictures attached to every prompt. After the audit the benchmark storefronts, the shield and the restaurant emblem are no longer needed.

| Sheet          | What                                                                                                                                                                                                                                    | Count | Cell       | Used by                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------- | ------------------------------------------------- |
| RP-icons-a     | ribbon heading and row icons (skyline, trophy, storefront, bars, toque, target, flag, money bag, chart, map, knife, hammer, board, stairs, double chevron, open padlock, padlock, books, crown, cash, star, gift, laurel trophy, coins) | 25    | 400        | every ribbon, Standing, Campaign, Earnings        |
| RP-icons-b     | wrench and hammer, clipboard, the six Numbers icons, streak star, inspector, people, lightning, crate, heart, five prestige buildings, five chef faces                                                                                  | 24    | 400        | Numbers, Chef Title, Prestige, rival quotes, rows |
| RP-icons-c     | cloche, anvil, calendar, staff trio, milestone and status marks (done coin, empty ring, coin, tick, market stall, hand, crate), leaf sprigs                                                                                             | 13    | 400        | Milestones, Knives, Boards, Journey               |
| RP-medals      | gold / silver / bronze laurel medals (blank), five league ribbon medals, five league laurel badges                                                                                                                                      | 13    | 512        | Guide, League                                     |
| RP-storefronts | three podium buildings, six Standing buildings (one per kitchen stage)                                                                                                                                                                  | 9     | 512        | Guide, Standing                                   |
| RP-goals       | eight vignettes (chapters 8 to 13, Campaign Finale, cafe rank)                                                                                                                                                                          | 8     | 768 x 384  | Next Goal                                         |
| RP-knives      | eight knives on wooden stands                                                                                                                                                                                                           | 8     | 640 x 320  | Knives, Milestones                                |
| RP-boards      | eight cutting boards                                                                                                                                                                                                                    | 8     | 512        | Boards                                            |
| RP-pieces      | trophy, laurel emblem, plaque, anvil medallion, anvil with hammer, journey chef-hat coin, clipboard decoration                                                                                                                          | 7     | 640        | hero, Earnings, Knives, Campaign, Milestones      |
| RP-wide        | Earnings cluster, Knives decoration, skyline, Milestones banner, City Ranking ribbon tab                                                                                                                                                | 5     | 1024 x 384 | headers                                           |

About 120 pictures, about 1.2 MB after the build script (icons 160 px WebP, medals 256, storefronts 384, goals 640 x 320, knives 480 x 240, boards 320, pieces 512, wide 768 wide; all q 76 to 80). Drawn by code, not painted (so they stretch with the text): panels (cream paper with a soft inner glow), ribbon heading shapes (gold, angled end), pills, bars (glossy gold, green, copper), rank number pills, the five stars, ⓘ buttons, dashed lines.

**Palette (read from the mock-up):** page cream `#f6e3c2`, card `#fef0da` with a thin tan edge, row cream `#fbf1e0`, the player's row `#fedc99` to `#fce188`, ribbon gold `#fbd374` (edge `#d9a441`), bar gold `#fbc63c` on track `#eedabf`, campaign bar copper `#c3761c`, goal bar green `#85b859`, text brown `#86480c` to `#3a1b08`, wood `#894f34` to `#6c3715`. These map to the existing tokens (`cream`, `ivory`, `gold`, `copper`, `olive`, `walnut`, `walnut-dark`); only the ribbon gold, the glossy bars and the pills are new CSS.

## Code work (can start before the pictures arrive)

The kit is built first with today's painted icons / emoji in the picture slots, so the layout can be finished, tested and shown before the art exists; each picture switches on by itself when its file exists.

1. **Kit** (`src/components/kc/progress/`): `ProgressKit.tsx` (`PaintedCard`, `RibbonHeading` with an icon slot and a right slot, `GlossBar` gold / green / copper, `ValuePill`, `StatTile`, `RankMedal` 1 to 3 / number pill, `StatusMark`), `progressArt.ts` (the manifest: name to file, the fallback for each, `data-art` for tests), the container-query styles in `styles.css`.
2. **Cards:** rework `RestaurantProgress.tsx` and `CityRanking.tsx` onto the kit, one card at a time, keeping every testid and data source. Delete `Summary`, `Benchmark`, `PopularityCard` and the plain Campaign bar from the page (the code of `cityBenchmark()` stays); merge the chapter and recipe bars into `CampaignCard`; put the name ribbon in `StandingCard`; collapse `Milestones`; re-lay out `Journey`, `Knives`, `Boards`, `Earnings`, `EarningsChart`, `JourneyTrack`.
3. **Art build:** `scripts/make-progress-assets.py` cuts each sheet (the shape-based cutter of `make-icon-assets.py`), trims, resizes, writes `public/progress/<sheet>/<name>.webp` and `src/game/progressArtFiles.ts`. Loaded lazily by this page only.
4. **Fallbacks:** a missing or failed picture shows today's icon; never a broken image box.
5. **Docs:** REFERENCE section 10 entry, HANDOFF status line, the prompts file marked DELIVERED when the sheets are integrated.

## Tests

- `scripts/restaurant-progress-redesign-qa.mts` (new): every kept card has its ribbon, testids and data source unchanged; the removed cards are not drawn (no `CITY_BENCHMARK` list, no second popularity card, no "Remaining wealth", no "Restaurant Complete" row); no new save field; no economy file touched; every picture the manifest names has a file and a fallback; the image budget; Staff not shown; the restaurant's own name reaches the Standing ribbon (no "Copper Pan" literal in the code).
- `tools/e2e/progressredesign.mjs` (new): the page with a level 70 save and with a new save, at 1815x867, 1280x720, 740x360, 430x900, 390x844, 360x640, 320x568, 768x1024; no sideways scroll; touch targets at least 48 px; every painted picture decoded (`naturalWidth > 0`); with the picture files blocked, the page still renders with the fallbacks; the Milestones "Show all" opens; section screenshots written for the side-by-side check; no console errors.
- Re-run: `restaurant-progress-qa`, `restaurant-city-ranking-qa`, `chef-titles-qa`, `restaurant-prestige-qa`, `city-league-qa`, `restaurant-measures-qa`, `restaurant-endgame-qa`, `restaurant-service-report-qa`, `ui-copy-qa`, `layout-fit-qa`, `landscape-art-qa`; browser `restaurantendless`, `restaurantreport`, `achievements`, `widelayout`, `economyv25`. Tests that read a removed card or row are updated with a RULE CHANGE note quoting this request; none is weakened.
- Final check by eye: each mock-up picture next to the same card in a wide window until they match (apart from the cuts above); then the phone.

## Order of work and rough effort

1. **Done now:** the references, this plan, the audit, the Codex prompts.
2. **Developer:** run the ten Codex prompts (one picture each) and put the files in `Restaurant Progress Assets/`. Sheets are independent; suggested order: RP-pieces, RP-icons-a, RP-icons-b, RP-icons-c, RP-medals, RP-storefronts, RP-knives, RP-boards, RP-goals, RP-wide.
3. **Code, in parallel** (no pictures needed): the kit and the cards on fallbacks, with tests: about one working session.
4. **When the sheets arrive:** the build script and the switch-over, the side-by-side tuning, the full gates: about one more session.

## Assumptions still standing

- The painted pictures are for this page only for now; the Market and the Blacksmith keep their code-drawn knives and board swatches until the developer asks for them to switch.
- Milestones show the next 6 first (the audit's shortening); say so if the full table should always be open.
