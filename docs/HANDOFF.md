# KnifeCraft — Handoff (Playgama edition)

## First 20 levels, round 2: engagement plan BUILT (developer 2026-11-10 "do the best plan", UNCOMMITTED)

- **Plan:** docs/planning/FIRST-20-LEVELS-ENGAGEMENT-PLAN-2026-11-10.md (section 1 and the table in 4 say what is built).
- **Sauce Station opens at Level 7** (was 23): `SAUCE_FIRST_LEVEL`, sauces unlock 7 x3 (Tomato, Lemon Dressing, Vinaigrette), 10, 12, 13 x2, 17, 18, 20 (Caesar), the rest as before; tier 1 until Level 40; Paige beat `sauce-station`; **the very first round is always Lemon Dressing** (`FIRST_SAUCE_ID`, `sauceOfTheDay`).
- **Delivery Inspection opens at Level 9** (was 3, on Fridge Sort's level): `INSPECTION_FIRST_LEVEL = 9`; its tiers still follow Fridge Sort's levels. Now exactly one thing opens per level from 3 to 12 (`config/featureUnlocks.ts`).
- **Level-end teaser:** the last plate of Levels 1-20 shows "✨ Next: ..." (`restaurant/levelTeasers.ts`, `level-teaser` on the served card; `afterServe.teaser`). `level-teaser-qa` checks each line against the schedule, so a moved unlock must move the line.
- **Funnel analytics:** `feature_unlocked { feature, level }` on a level's first completion for what opens at the next level (`config/featureUnlocks.ts`); the mini-games' `*_started` events already carry `level`. For the first live build: compare `level_completed` by level (plan section 7).
- **Milestone chests:** the first completion of Levels 5, 10, 15, 20 gives Hype (15/25/30/40; never money, stock or ledger) and a Congratulations card (`restaurant/milestoneChests.ts`, `Celebration.kind = "chest"`, merged with a ranking-climb card). No new save field: the first completion is the memory.
- **Tests:** new `level-teaser-qa` (teasers + funnel), `milestone-chest-qa`; `sauce-station-qa` (A1/A4/A6/A8b/D20), `delivery-inspection-qa` (A1 etc. at Level 9), e2e `deliveryinspection.mjs` (Level 9 seeds; the tap helper now taps the visible part of an item, because a neighbour can cover its middle), `saucestation.mjs` (S1 at 6/7), `firstrun.mjs` H6e (teaser after the first real service).
- **Sauce Station rewarded ad (developer yes 2026-11-10): "3 more rounds today"** (placement `sauce_rounds`, listed in `public/playgama-bridge-config.json`; `AD_PLACEMENT.sauceRounds`). Offered only after the 3 free rounds, once a business day (`canOfferRoundsAd`, state `business.sauceStation.extra` / `extraDay`, `withAdRounds`); the button says what it gives (result panel after the 3rd round and the practice ready screen; the chip reads "Sauce Station · ▶ 3 more rounds"); granted by `App.watchSauceRoundsAd` ONLY on `rewarded`; no money, stock or ledger entry; analytics `sauce_station_ad {level,status}`. Tests: `sauce-station-qa` K1-K12, `playables-ads-qa` E6, e2e S15/S16 (the result-panel button is covered by wiring only).
- **Not built (needs your word or is larger):** a chest ad (rewarded placements need a yes); the regular guest with a face (L13), the first Dinner Rush (L18), the top-40 card (L19; the ranking-climb card exists), a daily streak. The chest was not played through in a browser (rules, wiring and the card are tested; Level 5 needs a full play).

## Dishwashing full screen: BUILT with the art (developer request 2026-11-09, UNCOMMITTED)

- **Done:** the Dishwashing modal is no longer a card: the painted portrait sink (`public/dishwashing/backdrop.webp`, W01) is the whole screen; the 15-chip list is ONE "Up next" strip on the painted tray (`wash/SinkQueue.tsx`; tap = the full list in a bottom sheet `wash-up-sheet` / `wash-up-lines`); a ← Back button; status, progress and the painted drying rack below; the scene (still 360 x 280 units, rules untouched) is fitted into the stage box over the basin (`restaurant/sinkQueue.ts`: pure `kindViews`, `stripView`, `sceneScale`, `SINK_LAYOUT`, `BASIN`, `TAP`, `HOSE`).
- **Effects:** `wash/SinkAmbient.tsx` (water sheet, drifting ripples, suds that grow with the scrub and drain in the rinse (foam tiles 1-3 + the rim), running tap, rinse spray frames, steam, bubbles, mist), `wash/SinkCleanBurst.tsx` (glints, and the painted ribbon behind the game's "Squeaky clean!" label; keyed `burst-<n>`: sharing the piece's key duplicated the piece and froze the e2e), `wash/SinkRack.tsx` (rack back + front layers, the finished kinds stand in it, the cutlery cup), `wash/SinkSoap.tsx` (the pump presses and a soap blob drops when a piece comes in), painted sponge / foamy sponge / pot brush (`tools.webp`). Every layer uses its painted file when present and a CSS stand-in otherwise (`wash/washArt.ts` probes each file), so the sink is complete with any part of the art, and with none.
- **Art:** all 21 files of the Codex kit W01-W21 (`Wash Assets/`, gitignored) are built by `python scripts/make-wash-assets.py` into `public/dishwashing/` (630 KB; the build refuses a file with a painted checkerboard, rescues W03 ripples by keying and splits W05 into `foam-1/2/3.webp`; the regenerated W04 foam rim is good). Not used: the droplet / splash sheet (W07) and the bubble pop frames (the existing particle engine `CleaningFx` already throws droplets and sparkles).
- **Tests:** `dishwash-layout-qa` (the strip rules, the layout, the scale, the rules files untouched), `dishwashing.mjs` (updated: the list is in the sheet; check 0: stage >= 90% of the width, the scene fills it, strip <= 10% of the height, no scroll), `dishwashingfull.mjs` (five screen sizes, Back, the sheet, Reduced Motion, no new art), `dish-washing-qa` N19 reads `SinkRack.tsx` too.
- **Open:** a real-phone pass (the dish is bigger: sponge size, effect density, the rack icons are small); the existing synth sounds are reused (scrub, sparkle, spotless), no new sound effects; the finished kinds in the rack could be bigger.

## Sauce Station mini-game: BUILT with the art (developer request 2026-11-09, UNCOMMITTED)

- **What:** "Mix it, whisk it, bottle it". From **Level 7** (developer 2026-11-10: before Level 20; the Simple Garden Salad; sauces unlock 7 x3, 10, 12, 13 x2, 17, 18, 20, then 29+; plan docs/planning/FIRST-20-LEVELS-ENGAGEMENT-PLAN-2026-11-10.md; Paige beat `sauce-station`), **3 rounds a day** ("Sauce Station · 3/3" chip in Inventory above the fridge and in the Market's Ingredients tab; a hired Prep Cook has a "does it" button inside the game, no reward). STAGE 1: tap the 28-item pantry + the dish's produce to pour scoops (hold to repeat); match the target swatch and keep the thickness in the green band; blend by circling the whisk / spoon in the green speed zone (the dial; "Auto whisk" is the no-drag path); a dressing poured too fast into an unblended bowl SPLITS (blend back to 0, max 2 stars). STAGE 2: hold to pour the batch into 3-5 bottles and let go at the dashed fill line (a spill scores almost nothing; skipping the bottling caps at 2 stars). Stars, Hype (`HYPE_BY_STARS`), a Saucier pin every 3 perfect rounds (max 12) and the **Sauce Shelf** (screen `sauce-shelf`, 24 bottles, one per sauce mastered with 3 stars). **Never money, stock or the ledger.**
- **Rules:** `game/business/sauceColor.ts` (linear-light tint-weighted mix, CIE76 ΔE, match % = 100 - 2.2 ΔE, colour hints) and `game/business/sauceStation.ts` (PANTRY, the 24 SAUCES with reference recipes whose own mix IS the target, so each is solvable by construction; tiers from L23/40/55/75: cap 9-12 scoops, clock 75-60 s, help level, tolerance, oil limit, bottles 3-5 and fill window; blend/split/pour/bottle scoring; `finishRound`, `roundsLeft`, `sauceOfTheDay`). State `business.sauceStation = { mastered (bit per sauce), best, stars, perfect, rounds, streak, day, today, howto }` (optional, sanitised, no new top-level save field).
- **Screens:** `components/kc/sauce/` (`SauceStationGame.tsx`, `SauceShelf.tsx`, `SauceStationChip.tsx`, `SauceParts.tsx`, `sauceArt.ts`, generated `sauceSheets.ts`); lazy in `restaurantScreens.ts` (the Restaurant chunk now has ten lazy screens); ScreenIds `sauce-station`, `sauce-shelf`; `App.sauceStationAction` (analytics `sauce_station_started/finished/skipped/auto`, `sauce_mastered`). Back arrow before the clock starts, pause card, first-time how-to. Every painted piece has a CSS stand-in (the game plays with no art at all).
- **Art:** the 38 Codex files in `Sauce Station Assets/` (gitignored) are built by `python scripts/make-sauce-assets.py` into `public/business/sauce/` (843 KB lazy; unused pieces M10, M11, M19, M20, B07, B08 are not built; the vessels' front layers M03/M06 do not line up with M02/M05 so the liquid is clipped by the masks instead; C02 arrived 1536 x 1536 with the grid in the top 1024 rows and is cropped; the caps sheet carries a neck of sauce under every cap so only hand-picked cap boxes are shown) and writes `sauceSheets.ts` (the tight box of every cell).
- **Tests:** `sauce-station-qa` (colour maths, all 24 sauces solvable at every tier, thickness/blend/split/grade, bottling, finishing never touches money, wiring); e2e `tools/e2e/saucestation.mjs` (chip from L23, how-to, Back, pour/undo/cap, real pointer whisking, reference recipe + Auto = 100%, bottling by holding Pour, result, shelf, Prep Cook, 320 x 568, no art, no console errors). `lazy-load-qa` L1 updated to ten Restaurant screens (CLAUDE section 8: rule changed by the developer's new screens).
- **Open:** a real-phone pass (whisk circling by touch, tile size, bottle sizes); no new sound effects (the existing sort sounds are reused: pour/whisk/clink/cork/splash from the plan are not made); no rewarded-ad placement (needs the developer's yes); the Paige tip about it is not added; the shelf shows no recipe hints.

## Delivery Inspection mini-game: BUILT (developer 2026-11-08 "do what is best", UNCOMMITTED)

- **What:** a hidden-defect search over a crate of mixed produce: tap = flag NOT FRESH, drag = look behind, a 🔎 magnifier (tier 3+), a clock, a wrong flag costs 4 s. Rewards Hype + "Sharp Eye" pins only; never money or stock. The plan's recommendations were taken for every decision (own chip beside "Unpack delivery", no real effect, 5 rounds a day, Prep Cook inspects for the player, name "Delivery Inspection"); the rewarded ad (D5) and the freshness top-up (D3) were NOT built (they need the developer's yes). Plan: `docs/planning/DELIVERY-INSPECTION-MINIGAME-PLAN-2026-11-08.md`; Codex prompts: `docs/planning/DELIVERY-INSPECTION-CODEX-PROMPTS-2026-11-08.md`.
- **Code:** `business/deliveryInspection.ts` (rules, seeded crate generator with fairness guarantees, tiers on Fridge Sort's levels 3 / 14 / 27 / 44 / 74, scoring, stars, state `business.deliveryInspection`), `inventory/DeliveryInspectionGame.tsx` + `inspection/InspectionParts.tsx` (the screen; painted art when present, CSS stand-ins when not), `DeliveryInspectionChip.tsx` (Market Ingredients tab + above the Inventory fridge), `ScreenId` "delivery-inspection", App `deliveryInspectionAction` (analytics `delivery_inspection_started / finished / skipped`), lazy in the Restaurant chunk. Rounds: one per basket of the waiting crate (`basketsLeft`), at most 5 a day; a Prep Cook has a button in the game. Reuses Fridge Sort's HUD, star bar, result panel and sounds (no new effects).
- **Art:** `Delivery Inspection Assets/` (local, gitignored: D01-D10 from the Codex kit) is built by `python scripts/make-inspection-assets.py` into `public/business/inspection/`: backdrop, crate-back, crate-front, defects (4 x 3), decoys (3 x 2), markers (2 x 2), magnifier delivered and used (181 KB); `pins.webp` (D10) is wired (PinArt) and shows when the file exists; D08 flies and D09 the guide clipboard and the optional T01/T02 spoiled twins are NOT built or used yet (add them to `JOBS` when used). The crate's geometry (`CRATE_ART_TOP`, `WALL_TOP`) matches the painted crate; nothing that matters is ever put behind its front wall.
- **Tests:** `delivery-inspection-qa` (opening, daily limit, Prep Cook, old saves, the crate's real ingredients, tiers, 400 crates per tier with every defect findable, scoring, stars, Hype, pins, money/stock/ledger untouched, wiring) and `tools/e2e/deliveryinspection.mjs` (chip, guide, start, wrong and right tap, drag, result, Done, Prep Cook, Skip, 320 px, tier 3 lens and decoys).
- **Fix 2026-11-08 (developer: "not seeing the new game, the pause button is stuck, no way back; rename the first game"):** (1) a hired Prep Cook used to HIDE the Inspect chip: now the chip always shows and the Prep Cook is a button inside the game ("🧑‍🍳 Prep Cook does it": the basket counts as inspected, no stars / Hype / pins / day count; `autoInspect`). (2) Before the first touch the clock is not running and the HUD button did nothing: in Fridge Sort, Stockroom Sort and Delivery Inspection it is now a ← Back arrow in the ready phase (leaves the game, the crate stays waiting) and the pause button once playing. (3) The first game is called **Fridge Sort** everywhere (chip "🧊 Fridge Sort · N", the how-to title, Pre-Service Check, Paige's line, the after-serve chip), was "Unpack delivery" / "Unpack the delivery". Tests updated to the new words (`early-levels-qa` C1-C3, `earlylevels.mjs`, `fridgesort.mjs` + S28 Back arrow, `deliveryinspection.mjs` I9 / I9a / I9c, `delivery-inspection-qa` A7).
- **Fix 2026-11-08 (developer: "ingredients too small, not properly in the basket, defects not blended"):** the ingredients are about 35% bigger and there are fewer (8-9 / 10 / 12 / 14 / 17 for the five tiers, was 8-10 / 12 / 15 / 18 / 22); the pile now sits IN the crate (the bottom row against the front wall, its base hidden by it, heaped above the rim) instead of floating above it; marks are cut to the ingredient's own outline (`BlendedMark`: the picture is a CSS mask, so nothing hangs off the edge) and the dull kinds are multiplied with the food's colours; marks are bigger (0.92 / 0.7 / 0.52 / 0.36 of the picture); a spoiled ingredient is also a little duller and browner all over, more for a big defect and not at all for a tiny one.
- **Deep check 2026-11-08 (bugs found and fixed):** (1) the nine-table stage's guest routes took ~0.7 s on a fast PC to build when the map opened (a phone would freeze for seconds): the walkable grid is cached per stage and reachability is a flood fill (now 12-47 ms). (2) The inspection timer's closure read an old render's found / wrong counts when the clock ran out: `end()` reads refs. (3) The transparent corners of a big ingredient took taps meant for the one under it (a wrong flag): the hit area is a circle. (4) Tiny defects were fully invisible outside the magnifier: now faint (0.3). (5) Ingredients can be flagged from the keyboard (Tab, Enter / Space). (6) The music scheduler could pile up bars after a long stall: it restarts at "now" if more than 0.5 s behind. Known stale, not ours: `tools/e2e/fridgecheck.mjs` T8 (tier numbers moved when the campaign became 91 levels, 60b4303); `fridgesort.mjs` S11 failed once when run beside other heavy jobs and passed twice alone.
- **Open:** a real-phone pass (tap vs drag precision, item counts per tier, clocks: the numbers are a first guess, the plan's §8 simulated-player tuning script is not written); D10 pins and the optional twins when the art arrives; the Paige / achievements hooks; the rewarded-ad placement and the freshness top-up if the developer says yes.

## Music: relaxing generated score, loading music (developer 2026-11-08, UNCOMMITTED)

- **Copyright-safe by construction:** no recorded, sampled, downloaded or copied sound anywhere (the game still ships no sound file). The score is composed at run time by `src/game/music/relaxComposer.ts` from plain scales (major, pentatonic), stacked-third chords on the scale's own degrees, common four-chord cycles and a seeded random walk for the melody; `AudioManager.ts` plays it with sine / triangle waves and filtered noise. Original to the game; nothing to license. `music-qa` C1-C6 guards it (no audio files, no `new Audio` / `decodeAudioData`, no music-site links, no unseeded randomness, no fetch).
- **For long sessions:** slow (52-64 beats a minute), no drums, a warm pad + a music-box melody + a soft low note + a "breath" of noise + now and then a high chime, through a generated 3 s reverb and a gentle limiter. It never repeats: a new four-chord cycle every 8 bars, the key moves every 16 bars (a fifth, a fourth, a second or a sixth), the melody has its own slow ~4 minute rise and fall, every 8th bar is a bar of rest, the first two bars are the pad alone.
- **Moods** (`setMusicMood`): `loading` (new: while the save loads; slow and gentle), `kitchen`, `cutting` (quieter, fewer notes, no chimes), `night` (Closing Time: slowest, sparse), `off` (intro / finale / THE LAST PAGE). One continuous loop through every mood change.
- **Loading music:** App asks for `loading` while the save is not there. Browsers keep a page silent until a tap, so: if the page already had one (`navigator.userActivation.hasBeenActive`: the portal's Play button or a tap while loading) it plays at once, otherwise at the first tap, and the loading screen says "🎵 tap for music" until then (no autoplay warning is ever logged: the context is not created before). The Music toggle in Settings still rules once the save is in.
- **Tests:** new `music-qa` (copyright, the piece, loading) and `tools/e2e/music.mjs` (a real browser: silent and no warning before a tap, the hint, the real output level 0.05-0.11 peak after the tap, still moving 40 s later, no console errors). `audio-qa` updated (fake context gained the convolver and compressor; M3 now checks the new score's seeding).
- **Not done:** a volume slider / separate music volume (the toggle only); I could not listen to it, so the levels (`MUSIC_LEVEL`) and the gains in `relaxComposer.ts` are set by measurement, not by ear: the developer should listen and say if it is too quiet / loud.

## NPC: nine new looks, guests walk around the tables, a little smaller (developer 2026-11-08, UNCOMMITTED)

- **Nine new customer sheets** (`NPC Assets/`: international-tourist-f/m, food-blogger-f/m, businessman, affluent-diner-f, family-mother/father/child) are cut by `scripts/make-npc-assets.py` (ids added; `family-mother` has its whole figure at alpha 230-249 and figures touching across rows, so `thresholds` cuts it by rectangles) into `public/people/<id>/a.webp` (+0.58 MB; the cast budget in `npc-sprites-qa` A4 is 3.6 MB now) and are guest looks in `peopleLooks.ts` (the dining room, the Second Floor and the walk-ins pick them). Their row 3 is not the old guest order (menu, hand, eat...): nothing reads it for guests (a guest sits from the back view, row 1), only the walk rows are used.
- **The first floor's 7 guests** are now a food blogger, a businessman and an affluent diner, and a family of four (father, mother, child, grandmother).
- **Walking** (`restaurant/guestWalk.ts`, `guestLife.ts`): the six artworks have their tables in different places and the old routes were measured on the first one, so guests crossed tables on the others. `STAGE_TABLES` has the table centres per artwork (front tables from `FLOOR_SEATS`, the rest measured on the art; the sofa-corner booths are obstacles only); a person never steps on a cloth, never through another table's chairs, and walks to their own chair through their own table's chairs. The route is found with A* on a half-percent grid and pulled straight. A chair that cannot be reached (the nine-table room is packed) is not used; when the room is packed to the counter (nine tables) nobody queues in the middle: they use the free lane at the right and the front lane. `RestaurantMap` takes `stage` (the router passes `kitchenMapArtStage`; without it the stage is read from the artwork file name).
- **Size:** a map person `clamp(29px, 9.6vw, 56px)` (was 10.5vw / 62 px), the dining-room guest 124% (was 135%).
- **Tests:** new `guest-walk-qa` (A the looks, B on all six artworks: no table top stepped on, only open floor, own chair, own counter spot, C size); `npc-sprites-qa` (budget, pool size), `bug-batch-qa` 8 (size) updated to the developer's new numbers. `oven-step-qa` E2 allows the new pure files (afterServe / celebrations / floorGuide); `npcpeople.mjs` P3 now asks for a 29 px box. Looked at in a real browser on the flourishing-cafe artwork (nobody on a table); the other five were checked on route overlays drawn over their art and by `guest-walk-qa`.

## Bugs and Issues doc, 11 items (developer 2026-11-08, committed ddbf78d)

Source: "Bugs and Issues KnifeCraft.docx". Tests: `bug-batch-qa` (rules), `tap-cut-qa` (cutting), browser `tools/e2e/bugbatch.mjs`.

1. **Restroom picture shakes when wiping starts:** the cleaning footer changed height when the "use the squeegee" hint appeared and when the status line wrapped, so the room (sized from the free height) rescaled. A fixed 32 px hint slot and a single-line status line (`AreaCleaningPrototype.tsx`); bugbatch B1 measures the stage box before / during / after.
2. **Paige is a popup:** the same card as the Hire popup (her round portrait, her words, the buttons) over a dimmed, blurred scrim (`AssistantHost.tsx`, `data-testid="assistant-scrim"`). What she points at is left bright by a spotlight cut-out with the ring on it; tapping the dark closes the tip (not the hire). No speech bubble any more.
3. **Congratulations:** `restaurant/celebrations.ts` (pure) + `common/CelebrationCard.tsx`: a ranking climb, a popularity rise of 3+ (checked after a level and after a night's close) or a spotless run of 2 gives ONE card with the facts and Paige's appreciation. Moves no money.
4. **First machine, step by step:** `restaurant/floorGuide.ts`, plan in docs/planning/SECOND-FLOOR-FIRST-MACHINE-PLAN-2026-11-08.md (a progress card then a Buy card with a hand; the first machine needs price + $300 everywhere it can be bought).
5. **Cutting speed:** a tap cut is 320 ms at 1.0 (was 455); every knife is at most 0.9 and the basic Chef's Knife has the top knife's 0.85 (272 ms); the tap buffer is 110 ms; the closest two cuts may be is 10% of the band (was 7%), so a slice and a chop are 8 cuts (were 12), a julienne 8 (was 10). Fever lights at x5 (was x10, now unreachable in one step).
6. **Tapping one spot, fast:** `CutGeometry.magnetToSlot`: a tap lands near the nearest free even slot and keeps 15% of its offset; the first cut goes exactly onto its slot; a tap on a cut slot goes exactly onto the next free one. Tapping the same spot over and over gives a perfect 100 evenness and consistency. Not applied to Chop (irregular on purpose) or Halve.
7. **2nd floor button:** `restaurantMap/UpstairsButton.tsx` + `upstairs.css`, a brass medallion with a stairway icon, "2nd Floor" and a note ("Money waiting", "Full · collect", "Buy a machine", "Save for a machine"), a breathing glow and a red chip (`$4.40`, "Full", "New!") when there is a reason to go up.
8. **NPC size:** a person on the map is 2/3 of the old size (`clamp(32px, 10.5vw, 62px)`, was `clamp(48px, 16vw, 92px)`), the dining-room guests 135% of the puppet box (was 190%); a little smaller again the same day: see the NPC section above.
9. **Seated guests face the table:** a guest sits in the front chair, so they are drawn from behind (the walk-up row, cut at the waist, chair hides the legs) in the dining room (`GuestPoses`) and on the map (`FloorLife` `back`). The sheets only draw seated poses facing the viewer.
10. **Names:** the 12 regulars are Emma, Lucas, Sofia, Oscar, Mia, Mateo, Yuki, Liam, Isabella, Felix, Chloé, Noah (display names only; the ids that name the portraits are unchanged).
11. **No "Next Customer" for the first 20 levels:** `restaurant/afterServe.ts`: the served card shows "Back to Kitchen" as the main button and up to three chips for what to do on the way (unpack the delivery, stock the shelves, the 2nd floor, clean, restock). The next customer waits in the Kitchen ("Open for service"; the level resumes with its paid orders counted). Level 21 and later are as before. `NEXT_CUSTOMER_HIDDEN_THROUGH_LEVEL` in `config/earlyLevels.ts`.
- **Re-baselined tests:** blacksmith (the cadence numbers), julienne-fix, phase3 (Fever x5), oven-step / next-kitchen-strip (the diff guards allow `campaignPlan.ts`), paige.mjs (the popup look), peelslow.mjs (the Level 2 seed needs a carrot), cashflow.mjs and every browser test that clicked "Next Customer" (they now accept "Back to Kitchen", the only way on in Levels 1-20).
- **QA suites failing before this commit (checked against a clean HEAD, 2026-11-08):** `journey-qa` J11 (`docs/planning/LEVEL-DISPOSITION-2026-10-31.md` needs `scripts/level-disposition.mts` re-run for the 91 levels), `phase11-qa` D1/D2/D5/D6 (cleaning written for Level 3; it now starts later), `service-flow-qa` S4. `assistant-qa` G6/H5 were updated to the popup rule (dimmed scrim, ivory card).
- **Browser tests still stale (not re-run or known to fail):** `day2.mjs` (Y1-Y5: written for cleaning at Level 3; it now starts with the night of Level 4), `dining.mjs` D5/D6, and the ones already listed as stale on 2026-11-07. A mid-level serve now lands in the Kitchen and needs "Open for service" again; tests that played several orders in a row on Levels 1-20 through "Next Customer" need that extra step.

## The first 20 levels: retention plan built (developer 2026-11-08, UNCOMMITTED)

- **Plan:** docs/planning/FIRST-20-LEVELS-PLAN-2026-11-08.md. The schedule lives in ONE leaf module, `config/earlyLevels.ts` (shopping list + Stock the shelves L6, pan list L8, fridge L10, Second Floor L11, dine-in + dishwashing L12, mop L14, restroom L16; cleaning L4 in `cleaningStart.ts`; Unpack the delivery L3).
- **Dishes:** L2 Potato & Carrot (carrot new; the recipe `camp-halved-potato-bowl` is now "Potato & Carrot Bowl"), L5 Mushroom & Baguette (party of 2), L9 House Bruschetta & Eggplant, L12 Pepper & Corn, One Batch, L13 Italian Service Night (avocado, lime), L17 Chicken & Fruit (kiwi, watermelon), L19 Salmon Bistro (asparagus), L20 Meat & Fish Night (3 dishes). The first-use tables in `campaignSelection.ts` are re-recorded.
- **Unlocks moved:** the fridge system and its chores (spoiled food, wrap) to L10, dine-in (tableware, shakers, the sink, clear-tables) to L12, the water jugs L14, the Second Floor to L11 (machines 11 / 12 / 14 / 16 / 19 / 23, prices unchanged), Stockroom Sort and the first shopping list to L6 (frying pan + tongs for the first chicken, peelers / bowls / cups on the same list, sheet pans + mitts at L9, `ToolRule.exact`), the day ceremony stays at L3 (`DAY_CEREMONY_FROM_LEVEL` = 3), cleaning's first night chore L4. Chores are staged by cause: degrease and sweep L8, spoiled-out and wrap L10, mop L14, restroom L16.
- **Specialist cuisines wait for their chapter:** a cuisine's starter dishes cooked earlier (Mexican L11-13, Mediterranean L17, French L5 and L19) no longer open the cuisine or its chef (`restaurantProgression` `FIRST_CUISINE_LEVEL` skips any dish before the cuisine's own remapped chapter). Mexican chef L40, Mediterranean L38, French L23. The menu curve is one or two dishes short at L12 (`restaurant-menu-qa` M2c).
- **Words:** Fridge Sort's player-facing name is "Unpack the delivery" (chip "Unpack delivery · N", the how-to, the Pre-Service Check line, the Market basket tip); Paige: "Your order arrived! Unpack the delivery into the fridge for bonus Hype." Code names are unchanged.
- **Closed for tonight:** Closing Time says "Closed for tonight · Day N opens with your next service" (`closing-notice`).
- **Second Floor only when affordable:** Paige's `second-floor` beat appears at L11+ only with the first machine's price plus $300 in the till (`SECOND_FLOOR_RESERVE_CENTS`) and no machine yet. The floor itself can be visited from L11.
- **Cleaned is cleaned:** a heavy closing pass (mop, restroom disinfect, clear tables, degrease) is not added when none of the tasks it covers is open (`CLEAN_ONCE` in `cleanliness.ts`; `night-sync-qa` C1).
- **Dishwashing pace (developer 2026-11-08: no piece over 5 s, else 4):** `DISH_SCRUB_RATE` 0.2 (was 0.12), the pace cap 3.7 / s, a per-shape `DISH_EASE` (plates, pans, trays, forks, utensils had draws of 8-12 s), and a lighter, wider rinse (`DISH_RINSE_THRESHOLD` 0.8, `DISH_RINSE_REACH` 2, `DISH_RINSE_RATE` 1.5). `dish-washing-qa` N17 now measures EVERY shape on the WORST of 60 draws, scrub + rinse: all 14 shapes finish in under 4 s (worst about 3.8 s; a typical piece is about 1 s of scrub and 1-2 s of rinse).
- **L15 / L16:** two short Paige tips that open the Market (steak: a better knife; fish: the boards). No discount or money was added (economy baseline untouched).
- **Not built (still in the plan):** a regular guest with a face at L13, the first Dinner Rush at L18, the "top 40" celebration at L19, the first Golden Guest at L20, a chest at the L20 finale.
- **Tests:** new `scripts/early-levels-qa.mts`; re-baselined: first-levels, second-floor, stockroom-sort, cleanliness, night-sync (the day is now Levels 16-18), staff-hire, tools (first list L6; peel / bowls / cups up to two dishes early), supplies (dine-in L12), progression and menu (chef timing), dish-washing (pace), level-system-v2 (lime). Browser tests with seeds for these levels were not re-run.

## Peeling: slow and satisfying (developer 2026-11-07, UNCOMMITTED)

- **Feel:** the blade now bites at a fixed pace behind the finger (`PEEL.MAX_SPEED` 1.1 ingredient half-extents a second, `PreparationScene.tickPeel`, every frame). Scribbling or a faster drag changes nothing; the knife is drawn where the blade IS, so it drags behind a fast finger. If the finger lifts first, the blade finishes the stroke, then the knife leaves; off the ingredient the blade runs on to the skin's edge, and coming back on starts a fresh segment at the finger. The strip is narrower (`STROKE_WIDTH_FRAC` 0.34 to 0.22) and done is 90% (was 80%), so a whole potato or onion takes about 12-18 seconds; garlic and ginger have `peelConfig.paceMult` 1.5 (a clove is quick). The Blacksmith Sharpness still widens the strip (fewer passes).
- **Sense:** a curl of skin lifts every `RIBBON_EVERY_PX` of blade travel, a soft rustle (`AudioManager.playPeelRustle`, at most one per `SOUND_EVERY_MS`) and a 3 ms buzz (`BUZZ_EVERY_MS`) while real new skin comes away; the progress bar follows. Coaching text: "Drag slowly across the skin, strip by strip. The blade takes its time."
- **Tune:** the pace is `PEEL.MAX_SPEED` (raise it to speed the peel up); the strip width and the threshold set the number of passes.
- **Tests:** new `tools/e2e/peelslow.mjs` (P1 scribbling beats nothing, P2 at least 6 s, P3 a steady peel finishes, P4 the blade finishes after release); `solver.mjs` peels with full-width held sweeps now (the old quick strokes would barely peel); all 153 QA suites pass. Optional peeling per dish (decided) is still NOT built.

## Campaign V2: 91 levels, proteins early (developer 2026-11-07, UNCOMMITTED)

- **What:** the 148-level campaign became 91 (docs/planning/CAMPAIGN-V2-PLAN-2026-11-07.md, REMOVED-AND-MERGED and CAMPAIGN-LEVELS-INGREDIENTS list every level, dish and fate). Chicken at Level 6 (was 57), steak 15 (was 61), salmon 16 (was 64); the old Japanese chapter is now chapter 3, "The Meat & Fish Counter"; Chinese precedes the two Encore chapters, which precede Thai and Korean. Every one of the 221 dishes is still in the Menu (59 are in no campaign level).
- **Data:** `levels/campaignPlan.ts` (pure: chapters, levels, their dishes, mode single / party / batch, `from` = the previous 148-level numbers each grows from, the first-dish step snapshot, text). `scripts/campaign-v2-plan.mts` checks the plan against the design rules (`--write` the plan doc, `--detail` the removed/merged doc, `--emit` regenerates campaignPlan.ts; edit the data file, not the script's copy, from now on). `levelDefinitions.ts` builds `LEVELS` from the plan: each level inherits the old level it grows from (rewards, unlock items, story, theme).
- **Numbers:** `campaignSelection.ts` keeps three numberings: old 250 (items are authored in it), previous 148 (`CAMPAIGN_148_SOURCE_LEVEL_NUMBERS`, the plan's `from`, the save migration) and new 91. `remapCampaignThreshold(old)` is the PROGRESS mapping (monotone: systems, menu curve, day, staff, supplies, story); `remapCampaignContent(old)` is the CONTENT mapping (cuisines open with their chapters, the ribeye with its Butcher Block, the steak knife); `remapCampaignOrdered` keeps the price ladders (knives, boards) in order. Technique and ingredient first-use tables are re-recorded by hand (level-system-v2-qa checks them).
- **Pay:** `curatedRewardAt(n)` reads the 2026-10-30 curve at the former position `1 + (n-1)*147/90` and scales everything above $50 by 1.65 (L2 $158, L40 $2,869, L90 $3,677, the finale $5,000): completion total $243,953 (was $245,138). New frozen baseline: revenue 51,560 / completion 243,953 / COGS 11,337 / quality 1,047 / net 285,223; the completionist ends about $299k (aim $250k-$360k, floor $150k).
- **Saves:** `campaignVersion` 4. `migrateCampaignProgress` maps a version-3 (148-level) save: a new level is done when every previous level it grows from is done (a brand-new level is never pre-done; cut levels owe nothing); the current level and per-level data follow the level each grows from; version 2 and 1 saves chain through. A save that finished the last previous level is complete. A player past the Meat & Fish Counter in the old order must still play those new levels (the frontier is the first not-done level).
- **Restaurant systems on the new levels:** systems, menu curve (5:6 ... 68:48), the day (3 meals from L11, 4 from L31, 5 from L47, 6 from L68), guests (2 from L11, 4 from L31, 5 from L55, 6 from L75), staff (Prep Cook 30, Line Cook 33, Cleaner 41, Head Chef 55, Manager 68), supplies (dine-in 23, takeaway 38) and tools all follow the mapping. Cuisines: Mexican 11 (Beetroot & Orange), French 23, Indian 31, Mediterranean 38, the Asian Chef with the wok chapter (47), Thai 70, Korean 77. The Meat & Fish Counter's Japanese-tagged dishes need no specialist (`FIRST_CUISINE_LEVEL` skips them before the wok chapter). The first shopping list at L10 is bigger (frying pans etc.).
- **Services:** a party (a pool with `requiredOrders` or a batch) now serves DIFFERENT dishes while the pool has enough (`rollServiceTickets`); the Journey has one milestone per service (91; cap 100); the story finale is at L56 and THE LAST PAGE also marks every milestone seen; the achievement milestones "Completed 100 / 150 / 200 levels" now ask for 62 / 77 / 86 (same ids and money); Fridge Check tiers are spread evenly from the freshness stage to full operation.
- **Peeling (decided, NOT built):** make garlic, onion and the other peelables optional per dish (engine `peelDecoupled`), keep the peel where it is the point, add 2-3 peel-and-cut dishes. Needs the skin shown on unpeeled cut faces checked visually first.
- **Variety pass (not done):** garlic 31%, carrot 26%, steak 25% of levels; swap companions in the stir-fry, Thai and fusion pools for less-used produce.
- **Tests:** all 153 QA suites pass. About 45 suites were re-baselined to the new numbering (counts, levels, the frozen baseline, thresholds); `early-menu-qa` C1/C2 are SUPERSEDED (they compared the menu to a pre-early-menu baseline on the same campaign, which the re-plan moves on purpose); `next-kitchen-strip-qa` / `oven-step-qa` diff guards now allow the campaign files. Browser: new `campaignv2.mjs`; `staffhire.mjs`, `guests.mjs` and the e2e seeds re-pointed to version 4. `finale`, `legacy`, `kitchenstrip`, `levelux`, `firstteam`, `earlymenu`, `day2` were already stale before this change (same failures on the 2026-11-07 deploy).

## NPC realism: painted people on every map and the dining room (developer 2026-11-07, committed 2026-11-07)

- **Art:** the delivered sheets in `NPC Assets/` (local only, gitignored) are cut by `python scripts/make-npc-assets.py` into `public/people/<id>/a.webp` (960 x 640: 6 x 4 cells of 160, every cell on one baseline and one scale, the torso on the centre line), `b.webp` (the six first-floor workers' work poses) and `bust.webp` (the 12 regulars' six expressions). 35 looks, 2.8 MB, **lazy loaded** (only the people on screen are fetched; plan target was 2.4 MB). Cleaning is the Paige pipeline's (alpha cut, blob per cell); `floor-server-1-a` has a haze over the whole sheet, so it is cut per cell with a 249 threshold. Several figures drew the seated and guest-action cells as a half-body bigger than life: the head width of the idle pose gives the zoom and the cell hangs from its head line. Not shipped: the four specialists, `manager-b` (another outfit than `manager-a`) and `props.png` (nothing draws it yet): `--all` / `--props` build them.
- **Looks:** `restaurant/peopleLooks.ts` (pure, seeded): staff keep their portrait's identity (the Old Chef is the head chef's look, so with a hired Head Chef two chefs look alike), the 12 regulars are themselves, extra party members and walk-ins are a fixed pick (`guestLookFor`), the Second Floor has four floor servers and four floor cleaners (two women, two men each; no clones), guests are different (`pickLooks`: no neighbours alike, nobody repeats until the pool is used up). Child 0.74 size and 1.15 pace, elder 0.96 and 0.8.
- **Engine:** `restaurantMap/FloorLife.tsx` `MapCast` (both floors, staff and the first-floor guests) draws each actor as a stack of poses switched by keyframes from the route: walk down / up / right / left (left = the right row mirrored), carrying (staff and crew), idle, seated (guests cycle sit / eat / sip / delighted), the first-floor work poses by role (`WORK_CELLS`: stir, flip, chop, mop, type...), a raised hand at the counter. The facing follows each stretch of the walk; people nearer the bottom are in front (z-index follows y); a soft contact shadow replaces the hard drop shadow; the figure is about 1.5 x the old puppet (`.floor-person--sprite`, `clamp(48px, 16vw, 92px)` box). A sheet that fails to load leaves the old SVG puppet for that person (`peopleSheets.ts` probes each sheet; nothing is drawn while it loads).
- **First floor guests:** `restaurant/guestLife.ts` replaces the three CSS-keyframe parties of identical puppets (solo, couple, four friends, 7 painted people, own counter spot and chair each). The old `.map-guest-party` CSS is now unused (cleanup candidate in `RestaurantMap.css`).
- **Dining room (service floor):** `GuestPoses` takes a `look` (and a `face`: the name and timing of the walk's keyframes) and draws the painted person with the old `guest-walking-pose` / `guest-sitting-pose` classes, so `ServiceFloor` / `DiningCashView` CSS still shows and hides them; walkers turn the way they walk (`serviceFloor.ts` `walkFacing`, `faceKeyframes`). `lookFor(customerId)` and `WAITER_LOOKS` now carry the look.
- **Faces:** `common/CustomerBust.tsx` shows a regular's bust (expression follows the service: delighted / pleased / neutral) in the order cards (`ServiceOrderComplete`, the dining room's order line, `BusinessService`); the emoji stays when a bust cannot load.
- **Pace:** `floorLife.timeline(stops, speed)`; `speedOf(actor)`.
- **Tests:** `scripts/npc-sprites-qa.mts` (A art and budgets, B looks, C seeded picks, D casts and pace, E facing, F wiring), `tools/e2e/npcpeople.mjs` (staff and guests painted, sizes, second floor, 320 / 768 px, a failed sheet leaves the puppet). `restaurant-floor-life-qa`, `service-floor-qa`, `dining-floor-qa`, `party-served-together-qa`, `phase11-qa`, `table-cash-qa`, `ui-copy-qa` and the old `restaurantstafflife.mjs` pass. `servicefloor.mjs` / `servicefloorstages.mjs` were already stale (they open "Bruschetta for the House" at level 12); the dining room was checked on a throwaway dev page instead.
- **Not done (plan phases 2-3):** a path graph with queues (nobody crosses furniture: routes are still the measured stops), per-person reactions from the real service quality, the specialists on the map, the props sheet (bubbles, trays), regulars walking the first floor.

## Dishwashing: every piece, used per order, washed slowly (developer 2026-11-07, committed 2026-11-07)

- **When:** the sink starts with the dine-in stage (Level 19; `isSystemLive("dine-in")`, source number 31). The shakers come with it; the water jugs a stage later (Level 31). Before that nothing is dirtied.
- **What gets dirty (real counts):** each dine-in guest dirties their dish's own tableware (unchanged: plate, fork, knife or bowl and spoon, glass, bar glass, cup and saucer). NEW: every COOKED order (dine-in and takeaway) dirties the pots, pans and utensils its dish needs, read from the SAME `TOOL_RULES` the Pre-Service Check buys tools by (`restaurant/kitchenDirt.ts` `kitchenPiecesFor`): stock pot, saucepan, frying pan, sauté pan, sheet pan, mixing bowl, measuring cups, ladle, tongs, turner, skimmer, whisk, grater. A piece is dirty after `KITCHEN_USES_PER_WASH` orders (a pan 3, a stock pot 4, a mixing bowl 2…), never more pieces than you own. Guests also dirty the table's salt and pepper (one pair each) and the water jug (one a table of two). State: `restaurantSupplies.used` (orders since each piece was washed) next to `dirty`.
- **The sink game washes every piece on its own** (it used to scrub ONE sample for a whole stack): `WashUpSink` queues each piece ("Plate 3 of 6"); each is scrubbed, then covered in suds and RINSED (a new second step), then racked. Only then is that one piece washed for real (`{ kind: "wash", ids: [id], each: 1 }` → `handWash(save, ids, 1)`: soap by the piece, nothing breaks). Close half-way and what you washed stays washed; the rest waits for START. Without `each` the action still washes a whole line (closing, the Cleaner).
- **Slow on purpose:** `DISH_TOUGH` 1.8 (tougher stains), `DISH_SCRUB_RATE` 0.12 (a stroke wears 12 % as much), more stains on every piece, then a rinse (`DISH_RINSE_*`, two passes over every point). An ideal zig-zag scrub at 500 px/s takes about 8 s for a plate, 5 to 7 s for a pot, pan or sheet pan, 2 to 3 s for a fork or glass, before the rinse (`dish-washing-qa` N17 prints it).
- **New pictures (drawn in code, no art needed):** pot, pan, tray (sheet pan) and utensil shapes (ladle, turner, skimmer, whisk, tongs, grater) in `dishDirt.ts` + `WashUpSink.tsx`. Optional painted upgrade: `docs/planning/DISHWASHING-CODEX-PROMPTS-2026-11-07.md` (D1 basin, D2 pots, D3 pans, D4 sheet pan, D5 utensils, D6 tools, D7 suds); nothing is wired to it.
- **Economy kept still:** tableware breakage keeps its exact seed (`washedTotal` counts tableware only; pots and pans are `washedKitchen`, never break), the "Wash 100 pieces" achievement counts tableware only (its text says so), so `restaurant-final-economy-qa` is unchanged (V2: 828 / 845 / 883). Dish soap's "services left" now counts a full sink (`bottleView`: a sink of N pieces uses N x 0.25 %, at least 5 %).
- **Not changed:** pots and pans do NOT block START (the START wash-up washes them if soap; no soft-lock). Nothing in the sink is needed to progress.
- **Tests:** `dish-washing-qa` N1-N20 (per-order counts, ownership caps, takeaway, table pieces, one-piece wash, old saves, pictures, the pace, the rinse, wiring) + W4/R updated; `dishwashing.mjs` rewritten (one piece: short swipe cleans nothing, scrub then rinse, then one pan washed; plates and forks one by one; no soap; 320 px; it dismisses Paige's rewards card first).

## Cleaner hired but tasks still show: fixed (developer 2026-11-07, committed 2026-11-07)

- **Cause (simulated):** a Cleaner only does Cleaner chores. The Prep Cook's (stations, sanitizer bucket, spoiled food, wrap the fridge) and the Server's (lay / clear tables, condiments, cutlery) wait for those roles, spills are the player's, and a task short of a tool or supply waited for the NEXT service's round even after the supplies were bought. The card said only "Your Cleaner is on duty".
- **Catch-up:** the team's round (`cleanerRound`, the same rules and cost) also runs when supplies are bought (`purchaseSupply`), when someone is hired (`hireStaff`, `hireInService`) and when Cleanliness opens (`team-round` action). Nothing happens when there is nothing to do.
- **Honesty:** `waitingReason` / `waitingCounts` (cleanliness.ts) say why a task is open: yours (spill), the Prep Cook's, the Server's, outside the Cleaner's areas, or short of supplies. The card shows "Still open: 2 for a Prep Cook · 1 need supplies"; each such row says whose job it is and offers "Hire a Prep Cook / Server" (Staff screen). The two night chores of Fridge Check stay the player's game unless a Prep Cook is hired (unchanged).
- **Tests:** `restaurant-cleanliness-qa` Q1-Q6, `staff-hire-qa` A1 (a hire now persists `cleanerRound(hired.save).save`, still one save), `cleaners.mjs` K6. All pass.

## Fridge Sort fixes from player reviews (developer 2026-11-07, committed 2026-11-07)

- **Drops:** the piece is judged where its PICTURE is (drawn ~16 px above the finger) and ANY release over the fridge or within 40 px of its frame lands on the NEAREST visible shelf (`shelfAt`); a hovered shelf glows as the finger moves. Dragging near the fridge's top or bottom edge scrolls it (`EDGE_SCROLL_PX`).
- **Layout:** the shelves share the fridge's height (explicit grid rows from `rowSizes`), so all of them are in view with no scrolling: 6 shelves at Level 20 and the full 10 at Level 80 at 390 x 844; a tiny screen (320 x 568) still scrolls and shows a "More shelves below" pill. The basket's stool is cropped off in CSS (`BASKET_RATIO`, `BASKET_CROP`; the picture is untouched) and the basket sits flush low (163 px tall, was 227).
- **Which shelf is which:** every name chip carries its emoji (`TARGETS` icon) and an empty shelf shows 3 ingredient pictures at EVERY level (they were hidden from Level 44; `hint: "never"` now only means the lifted piece does not glow its shelf). A WRONG drop lights the right shelf for 3 s at every level, scrolls it into view and the note names it with its emoji ("Green Bean goes in: 🍄 Pods & fungi").
- **Practice:** "Again · practice" then "Practice again" any number of times (it used to be once); "Next crate" also shows after a practice round.
- **Clock:** the screen redraws when the whole second changes, not ten times a second.
- **Tests:** `fridge-sort-qa` L8 now expects the emoji in the chip (the old "no emoji" rule was the developer's earlier choice, changed 2026-11-07); `fridgesort.mjs` S17 (pictures at Level 80 too), S18 (emoji in the note) and new S21-S27 (a drop 28 px below the shelf lands, all shelves fit at 390 x 844, stool gone, emoji on every chip, wrong drop lights the right shelf, three practice rounds in a row, 10 shelves fit). ALL PASS. New: `KC_OFFLINE_BRIDGE=1` makes `harness.mjs` answer the Playgama CDN script with a local stand-in (the CDN was unreachable for a while and every browser test timed out).

## NPC realism: planned, not built (developer 2026-11-07)

- Player reviews: improve the people's look, costumes, size, faces, male / female identification, hair, walking and behaviour.
- Cause: one tiny faceless SVG puppet (`restaurantMap/GuestPoses.tsx`) for everyone, ~30-38 px, straight-line walks at one speed.
- Plan: `docs/planning/NPC-REALISM-PLAN-2026-11-07.md` (Phase 0 fixes with no new art: size, depth order, facing, queue spacing, speed;
  Phase 1 painted sprite engine with the SVG as fallback; Phase 2 paths and behaviour; Phase 3 busts for the 12 regulars and props).
  Codex prompts: `docs/planning/NPC-CODEX-PROMPTS-2026-11-07.md` (style anchor, sheet A walk / sit, sheet B work, busts, props; 50 sheets in
  3 priorities). Art goes in `NPC Assets/`.

## Paige, the personal assistant: BUILT; the cleaners' art placed (developer 2026-11-07, committed `340bae1`)

- **Art** (local-only sheets in `Assistant Assets/` and `Cleaner Assets/`, now gitignored): `python scripts/make-assistant-assets.py` cuts them
  into `public/business/assistant/` (12 poses on one canvas, aligned on the hips; 4 oval avatars; bubble, warning and success frames, ribbon,
  2 chevrons; 12 UI pieces; about 350 KB) and three portraits in `public/business/staff-portraits/`: `assistant.webp`,
  `floor-cleaner-male.webp`, `cleaner-today.webp`. The sheets had a baked soft glow and colour noise in the alpha: solid pieces are
  thresholded, the two glow rings keep their translucency. M01 (the identity sheet) and the thought cloud are not drawn (reserved).
- **Rules** `restaurant/assistant.ts` (pure, free: no wage, no ledger, no wallet; `business.assistant = { hired, seen[], tipsOff? }`, nested,
  old saves = not hired). A beat = 1-2 lines of at most 90 chars, a pose, an optional ring on a bottom-bar tab, an optional "Take me there",
  a frame tone. Beats: `meet` (new game, Hire Paige · Free), `meet-late` (a player past the first service), `first-pay`, `restock`,
  `fridge-sort`, `cleaning`, `stockroom-sort`, `fridge-check`, `ads-optional`, one per system (menu ... grand service; given from the unlock level
  for 3 levels), a cheer every 10 levels, `finale`. Highest priority first, once each. The existing guidance stays (first-run hand,
  Restaurant Guide card, Grandma's pointer, mini-game tours); she is the voice on top.
- **UI** `components/kc/assistant/`: `AssistantHost` (half-body Paige bottom-left, a painted 9-slice bubble, a glowing ring and a bobbing arrow
  on the real tab; no scrim; calm moments only; the beat on screen is latched; one beat per screen visit; `Next` / `Hire Paige · Free` /
  `Take me there` / `Got it`), `PaigeNotebook` (every tip, "Show again", Tips: On/Off), `AskPaigeButton` (her face on a porthole, Kitchen and Market
  top bars), `AssistantCard` (her portrait, free, notebook, tips, on the Staff screen), `AssistantContext`. App owns the hire, the seen mark, Tips
  and analytics (`assistant_hired`, `assistant_beat_shown`, `assistant_tips_off`).
- **Order of the first run:** intro -> restaurant name -> Paige meets the player and is hired -> Grandma's Market pointer (now with Paige's face)
  -> the first-run hand (buy, kitchen, open, start) -> the in-service Server and Cashier cards. The guide card also speaks as Paige once hired.
  The Market pointer's old line "Hire your team first" was stale since the 2026-11-07 hiring change and is now "Buy today's food...".
- **Cleaners:** the Second Floor's two Floor Cleaners are two people (`floorStaffPortraitFile`: first = the woman, second = the man, F01); the
  Market's floor-team card shows the NEXT hire, the Second Floor screen one face per hired cleaner. "A Cleaner for today" (the offer and the one
  on duty) is the man with the mop (F02, `DAY_CLEANER_PORTRAIT`); the team's Cleaner stays the woman.
- **Tests:** new `scripts/assistant-qa.mts` (A-H), `tools/e2e/paige.mjs` (P1-P8, real browser), `tools/e2e/cleaners.mjs` (K1-K5: the Market card, the Pickup Counter sheet, "a Cleaner for today"), `asset-mapping-qa` H1-H7; the harness gained
  `PAIGE_QUIET` (every seeded save has Paige hired with tips off), `hirePaige` and `answerServiceHires`; firstrun / firstshop / firstmarket and
  the `startFirstLevel` helper follow the new first-run order.
- Not built (noted in the plan): typed-in text, a "meet" backdrop, outfit variants, one beat per ad placement, Paige's own hire card in the Market.

## Fridge Check: a proper how-to tour (developer 2026-11-07, committed `340bae1`)

- Complaint: past Level 40 there was no real instruction (one thin card, first night only), and from tier 4 (Level 44+) the days and the
  icon are hidden, so a player must judge by the picture alone without ever being taught what spoiled looks like.
- Now: `restaurant/FridgeCheckHowTo.tsx`, an illustrated tour with the game's OWN pieces (`FridgeCheckParts.tsx`, moved out of the game
  file: `FcArt`, `FoodPicture`, `InspectionCard`, `SHELF_LIFE_GUIDE`). Sort = 4 pages: what the game is; one tomato fresh / going off /
  spoiled (the painted twin) with KEEP / USE FIRST / BIN; "count the days" (Bought + 1 vs Lasts, three quarters = use first, the shelf
  lives, and "later nights hide the days, trust the picture" from tier 4); the swipes, stars, Hype, pins. Wrap = 3 pages (what, which goes
  off first with the label colours, stars). Next / Back / Skip; the ? button brings it back.
- Shown ONCE per stage to EVERY player, old saves and practice included: `FridgeCheckState.howto` (bit 1 Sort, bit 2 Wrap, 0..3), saved on
  close by the new cleanliness action `{ kind: "check-howto", stage }` (no money, stock, ledger or chore; `withHowtoSeen` returns the same
  save if already seen). The spoiled picture is preloaded so page 2 is never an empty card.
- Tests: fridge-check-qa L1-L9 (new); e2e fridgecheck T16-T18 (the tour, seen-once, hidden days), T13 updated (practice now saves the
  tour as seen, nothing else), the old `fc-guide-ok` clicks became `fc-guide-skip`.

## Hire the Server and the Cashier when the game needs them (developer 2026-11-07, committed 2026-11-07)

- Was: both hired in the Market's first-shop card before the food was bought, and the Pre-Service Check required both from Level 1.
- Now (idle-game style): the Level 1 walk is buy food → Kitchen → open → start. In the service, when the plate is ready and there is
  no Server, a card (`game/ServiceHireSheet.tsx`, her portrait, the price, the hand on Hire) offers the hire; when the
  guest has eaten and there is no Cashier, the same card offers the Cashier. ONE button, no skip (developer 2026-11-07: "they need to be
  hired anyway"); asked once per customer. Pure rules/copy: `game/restaurant/serviceHire.ts`; App: `hireInService` (one `hireRestaurantStaff`, `required: true` so a short
  wallet goes on supplier credit, never stuck). Both are permanent (`hiredRoles`, no expiry); the opening cash ($10 + both fees,
  `config/startingTeam.ts`) is unchanged and pays them.
- `STAFF_RULES`: Server and Cashier `fromLevel` 1 → 2 (game numbering, no remap): Level 1 never stops for them; from Level 2 the check
  requires both. The Market's "Hire your team" card shows from Level 2 only (for a player who said "Not now"). First-run hand: the
  `hire` step is gone (buy → to-kitchen → open → start, captions 1️⃣–4️⃣).
- Tests updated to the new rule (with dated comments): dining-floor D2, first-run-guide R1/R2/R7/W1, restaurant-progression S1/S2,
  e2e firstrun (now plays both prompts: H6a–d), firstshop S3/S3b, firstmarket M2, firstteam (T0, Level 2), staffhire T4. New:
  `scripts/service-hire-qa.mts` (A–E).

## Hiring: portraits and "Hire" opens THEIR card; asset-mapping audit (developer 2026-11-06)

Bug report: Inventory -> Needs attention showed the missing Cashier as a 👥 emoji and its Hire button only opened the Staff page. Fixed, and the same two problems hunted across the game. Tests: `scripts/asset-mapping-qa.mts` (A-G), `tools/e2e/staffhire.mjs` (T1-T5, ALL PASS on a `vite preview` build).
- **Fixed:** the attention row's staff action now carries the role / specialist id (`restaurantAttention.ts`); ONE helper `components/kc/attentionActions.ts` (`openAttentionRow`) opens every attention row (used by Inventory's panel and Daily Maintenance) and a missing person opens Staff scrolled to THEIR card, marked "Needed now" (`openStaffFor`). The tile, the Market's "Hire your team" card (it showed 🤵 / 🧾), Daily Maintenance's required team and the guide card show the person's portrait. The guide's hire steps (`GuideStep.focus`) and its out-of-cleaning-supplies step (`GuideStep.supply`) open the exact card. `BusinessStaff` had its own copy of the role -> portrait map: it now reads `staffPortraits.ts` like everything else. The wash-up strip draws the supply pictures, "Missing: ..." on a blocked order draws ingredient pictures, and the Overview's spoil / near-expiry / blocked-order alerts draw them too (`BusinessAlert.glanceParts`; `glance` stays the full text).
- **Checked and fine:** every ingredient (57), supply (62) and Stockroom good has its file; no picture file is missing; the Staff screen, Pre-Service Check, Second Floor and Market already used portraits; the other "go to Staff / Market" buttons are section shortcuts, not item buttons.
- **Left as it is (no art exists, or it is decoration):** dishes are emoji everywhere (there is no dish art); alert glance text in notifications; the Service Floor's 🧾 bubble; rivals in the city ranking; `staff-portraits/cleaner.webp` is unused (the Cleaner is the floor-cleaner portrait since 2026-11-06). The Kitchen Helpers (Prep Assistant, Kitchen Assistant, Quality Chef) reuse the Prep Cook / Line Cook / Head Chef portraits, so each helper shows the same face as that hireable role: new portraits would be needed to tell them apart.

## iPhone playtest fixes (developer 2026-11-06)

Four bugs from the live site on an iPhone in Safari. Tests: `iphone-fixes-qa`, `tools/e2e/iphonefixes.mjs` (390x844 with touch, headless Chrome; WebKit is not installed, so none of this was run in Safari).
- **Market scroll locked:** no touch handler or scroll lock exists in the game; the likely cause is iOS keeping a scroller's old scrollable area when the Plan ahead list changes height. `common/scrollRepair.ts` rebuilds it after a day tab, Show all or a purchase. The Market's page padding is `pb-40`, so its end clears the Pre-Service Check pill. Not reproduced: needs a real iPhone check.
- **"Low" after Buy all:** Fridge Sort's "Put it away" is not the cause, its crate holds no stock (a purchase counts at once). Inventory's "low" used the customers-per-day estimate (`menuDemand`) while the Market's plan uses the real services. The restaurant's Inventory now passes `todayPlanNeed` (restaurant/marketPlan.ts), so "low" means the Market's Today tab still has that line. Endless and the classic build keep the estimate.
- **Cleaner:** the two screens read the same `hiredRoles`; the screenshots were 4 services apart (42 and 38 left). The "stuck" Hire was a refusal shown above the scrolled view: the message is now sticky (`staff-message`) and the Staff screen opens on the card asked for. The Cleaning page no longer quotes the hiring fee once hired, and shows `floor-cleaner.webp`, the broom-and-dustpan portrait, as does the Staff card (developer 2026-11-06; `cleaner.webp` looked like a cook and is now unused; a narrow staff card's status pill sits low, clear of the face). Emoji stay only inside strings (the toast, `businessInspection` glances).
- **Restroom shiver:** the room had a live CSS filter, a half-pixel centring transform and a backdrop blur while the guide pulsed. Now centred by layout, on its own layer, no filter or blur; the brighten-as-you-clean effect is an opacity layer (`cleaning-dim`). In Chrome the stage holds still for 3 s; the shiver itself was never reproduced.
- **Stale browser tests, same failures on the previous build (`204360c`, run side by side; not fixed here):** `prepcook` (8), `restaurantmeasures` (8), `restaurantcleanliness` 5, `marketneeds` (times out waiting for "Tonight's close"). `lazy-load-qa` L1 had been red since Stockroom Sort (it counted six lazy screens, there are seven): updated.

## Paige (personal assistant) + male Floor Cleaner: planned, not built (developer 2026-11-06)

A friendly assistant hired free ($0, no wage, no ledger entry) at Level 1 who teaches the whole game: a half-body cut-out in a corner, a speech bubble, the `PointerHand` on the real button. She is ONE voice over the existing guidance (`firstRunGuide`, `restaurantGuide`/`GuideCard`, `systemsIntroducedAt`, mini-game how-tos; the cutting coach is untouched); `business.assistant = {hired, seen, tipsOff}`; one beat per screen visit, once each, Tips Off, "Ask Paige" notebook; never in cutting, service, ads or modals. Plan: `docs/planning/ASSISTANT-PAIGE-PLAN-2026-11-06.md` (decisions D1-D8, about 9-10 days); Codex prompts (male Floor Cleaner into `Cleaner Assets/`, Paige's 7 images into `Assistant Assets/`, future extras, and the order to run them): `docs/planning/ASSISTANT-PAIGE-CODEX-PROMPTS-2026-11-06.md`. Fridge Check art check: all 11 required images are in `Fresh Check Assets/` at the right sizes; C05/C08/C09 carry a faint (alpha 1-39) haze over about 57 % of the sheet, so the build must cut by shape with an alpha threshold (as the Stockroom build does). The optional spoiled twins C20-C24 are still to be made. No code yet.

## Fridge Check: built (developer 2026-11-06)

The third mini-game, on the closing chores. "Throw out spoiled food" (stage SORT) and "Wrap and label" (stage WRAP) open a game from `useCleaningGame.clean(task)` when there is something to judge tonight; otherwise, and from Pause -> Skip, and for the Prep Cook, they stay the old one tap. Plan: `docs/planning/FRIDGE-CHECK-MINIGAME-PLAN-2026-11-06.md`; art prompts: `...-CODEX-PROMPTS-2026-11-06.md`.
- **Rules:** `src/game/restaurant/fridgeCheck.ts` (pure, seeded; state `business.fridgeCheck` = `{best, bestWrap, stars, perfect, rounds, streak, streakDay, hypeSortDay, hypeWrapDay}`). A card = a real stock line, judged for TOMORROW (`tomorrowOf`, the same day `closingPreview` reads; `fridge-check-qa` B3 proves the Bin cards equal `closingPreview.spoiled`): EXPIRED = Bin, NEAR_EXPIRY = Use first (Keep in tier 1), else Keep. Five tiers from the freshness stage (14 / 24 / 34 / 44) and full operation (54): 6 / 8 / 10 / 12 / 12 cards, clock x2 / 1.6 / 1.3 / 1.1 / 1 (`(8 s + 2.2 s x cards) x factor`), two piles in tier 1, the icon cue fades out at tier 3 and the days at tier 4. Opens only when freshness is live AND there are at least 3 cards with a Bin / Use first (sort), or at least 3 items with 2 different use-by days (wrap). Stars: all right = 3 (clock not out), 85 % = 2, 60 % = 1, a spoiled card kept counts double. Hype = `HYPE_BY_STARS`, once a night per stage; 12 freshness pins (every 3 three-star stages; `pinsOf`, pinned on the Inventory fridge door beside the Fridge Sort magnets); a perfect-night streak.
- **Never touches money or stock:** the finish is the cleanliness action `{kind:"check", task, outcome}` in `applyCleanlinessAction`: `cleanTask` for THAT chore only, then `finishCheck` (state + Hype); a second call or a chore the Prep Cook did pays nothing. Closing Time's sweep is the only thing that throws food out, at the same value as before.
- **Screen:** `restaurant/FridgeCheckGame.tsx` (an overlay like the cleaning game): swipe right Keep / left Bin / up Use first (tier 2+), three buttons, arrow keys; a reason line per card; the spoiled look comes from the painted overlays (`FoodPicture`, seeded by ingredient); stage 2 taps the shelf items soonest-use-by first (wrap film + a coloured label "N days left"); how-to card the first night; result board with "Closing throws out tonight" and "Again · practice". Reuses `inventory/sort/SortParts` + the fridge-sort HUD pieces. Analytics `fridge_check_started / finished / skipped`.
- **Art:** the 11 Codex PNGs are in `Fresh Check Assets/` (local, gitignored); `python scripts/make-market-assets.py --fridgecheck` cuts them BY SHAPE into `public/business/fridge-check/` (55 files, 466 KB). The spoiled twins (C20-C24, all 57 ingredients drawn spoiled) are cut into `public/business/ingredients-spoiled/` (56 files, 359 KB; the chicken is skipped: its twin is a drumstick, the game's chicken is a breast, so it keeps the fresh picture with the mold overlays). An expired card shows its twin plus a fly and a stink wisp.
- **Measured** (`scripts/fridge-check-measure.mts`, the campaign sim): only about 29 closing nights from Level 14 to the end, the sort game opens on about 2 in 3 of them (0-25 % in tiers 1-2, 88-100 % in tier 5), the wrap game on 97 %; the simulated player keeps 13-54 stock lines. So the early tiers are rarely seen; the answer is built: Inventory shows a chip "Fridge Check · practice" above the fridge (`FridgeCheckChip`, ScreenId `fridge-check`, `isPracticeOpen`: freshness live and at least 3 stock lines): the same deck from the real stock as free play, no reward, no chore, nothing changes.
- **Tests:** `scripts/fridge-check-qa.mts` (A-K); `tools/e2e/fridgecheck.mjs` (T1-T15, run on a `vite preview` build; ALL PASS). `inventory.mjs` (5 fails) and `fridge.mjs` (2 fails) fail the same way on the commit before this work (checked with my changes stashed): stale tests, not caused by it.
- **Open:** a real-phone pass; tiers and the clock are tuned by simulation only; no achievements (new reward tiers would change the economy tests); practice is sort-only (no wrap practice).

## Stockroom Sort: built (developer 2026-11-06)

A match-3 "stock the shelves" mini-game for SUPPLIES (Fridge Sort keeps the food). A Market supply purchase becomes sets of 3 identical goods (1-2 packs = 1 set, 3-5 = 2, 6+ = 3) scattered over wooden cubbies (3 slots each); tap a product then a free slot (or drag); 3 alike in a cubby are stocked and pop; stock everything before the clock. Plan: `docs/planning/STOCKROOM-SORT-MINIGAME-PLAN-2026-11-06.md`; art prompts: `...-CODEX-PROMPTS-2026-11-06.md`.
- **Rules:** `src/game/business/stockroomSort.ts` (pure; state `business.stockroomSort` = `{crate:[{id,sets}], seed, best, stars, perfect, rounds, chain}`). Opens at Level 10 (`STOCKROOM_FIRST_LEVEL`; `?stockroomSort` in the address shows it below that). Five tiers (10 / 19 / 31 / 44 / 74): 2 / 4 / 6 / 8 / 8 sets a board, clock x2 / 1.6 / 1.3 / 1.1 / 1, hint always / always / after a quiet spell / never / never, hidden second rows from 44, a locked cubby (opens after 2 sets) and 2 wrapped parcels from 74. Boards are built BACKWARDS from a cleared shelf (`dealBackwards`, solvable by construction; a random deal with hidden rows was often a dead end and took seconds to refute) and proven by `solve` (weighted A*, also the Hint and the clock: `(12 s + 1.9 s x moves) x factor`). Look-alikes (`LOOKALIKES`: forks, knives, spoons, plates, glasses, stock pot / saute pan) never share a board. Stars: half the sets = 1, all = 2, all with 40 % of the clock left = 3. Hype `HYPE_BY_STARS` (shared with Fridge Sort) and the big-delivery bonus (+5 Hype per extra board, max +20); a shelf badge for every 3 three-star boards (12 max). NEVER touches credits, supplies, inventory or the ledger.
- **Screen:** `inventory/StockroomSortGame.tsx` (route `stockroom-sort`, `ScreenId`); chip + badges `StockroomSortChip.tsx` (Market supply tabs, Inventory -> Supplies); the purchase commit is `purchaseSupply` in `App.tsx` (`addToSupplyCrate`); the Level 10 Pre-Service Check shows a Stockroom Sort line (`RestaurantNews.minigame` is now `"fridge-sort" | "stockroom-sort" | null`). The shared HUD (button, plaque, star bar, clock) moved to `inventory/sort/SortParts.tsx`; Fridge Sort uses it too (its QA and e2e unchanged and green). Prep Cook skips it (`autoStock`). Analytics `stockroom_sort_started / finished / skipped / auto`.
- **Art:** the 20 Codex PNGs live in `Iventory Assets/` (local, gitignored); `python scripts/make-market-assets.py --stockroom` cuts them BY SHAPE (the tall goods of sheet I10 reach past their cell) into `public/business/stockroom/` (kit + `goods/<supply id>.webp`, 451 KB). Not used: I02 (pantry backdrop, for an ingredient mode), I24 (glove; the shared `PointerHand` is used), the boost icons shelf / time / shuffle / ad (the rewarded boosters need an explicit yes).
- **Tests:** `scripts/stockroom-sort-qa.mts` (A-J, 3,570 boards proven solvable); `tools/e2e/stockroomsort.mjs` (T1-T15, run on a `vite preview` build; ALL PASS).
- **Open:** a real-phone pass; times, stars and the tier table are tuned by simulation only; no achievements for it yet (new reward tiers would change the economy tests); the Market supply panel has no "N shelves" chip yet; rewarded-ad boosters (extra shelf, +15 s, shuffle) need an explicit yes; the locked cubby is spare room that opens later, not something a solution needs.

## Fridge Sort, reworked as a basket of loose pieces (developer 2026-11-05)

The developer's playtest on a phone: no real instructions, no connection to the main game, introduced too late, and the crate of emoji-and-text tokens felt like the cutting game. What changed:
- **The basket (A6 woven basket, `basket.webp`; the wall and counter A3, `kitchen-wall.webp`):** a purchase now becomes loose PIECES, one per count (1 lb of tomato = 3 tomatoes: `piecesFor` uses `measure.itemCount`; 5 pieces of one ingredient at most, `MAX_PIECES_PER_INGREDIENT`). All the pieces of the delivery lie mixed on the cloth as painted ingredient pictures (no emoji, no text on them); picking one shows its name. A "Delivery" slip above the basket lists what was bought and how many pieces (`🍅 ×3`). `business.fridgeSort.counts` (optional, extends `business`) keeps the pieces per crate ingredient; an old save without it reads as one pound's worth. `roundFor` fills a round with whole ingredients while their pieces fit `Difficulty.maxTokens` (8/10/12/14/16 pieces); `Round.tokens` repeats an ingredient once per piece (the screen tells pieces apart by index), `Round.ingredients` lists the distinct ones. `addToCrate(save, ids, level, stock?)`: the purchase commit, the morning delivery and `purchaseIngredients` pass how much arrived; a repeat purchase adds pieces to the same entry. (Rush Restock and Quick Restock pass no amount and count as one pound.)
- **Opens at Level 3 (was 14):** `FRIDGE_SORT_FIRST_LEVEL = 3`. Level 3-13: 8 pieces at most, 3 shelves, the right shelf glows when a piece is picked, x1.6 time. Level 3's Pre-Service Check shows a "Fridge Sort" line (`RestaurantNews.minigame`).
- **Instructions:** a how-to card (4 icon steps) opens by itself until the player finishes a crate (`rounds === 0`) and comes back from the visible "?" button (the tiny ⓘ is gone); the first piece pulses with a hand; an empty shelf shows faded pictures of what lives there (`zoneExamples`, hidden from Level 44); the line under the star bar says what to do, names the held piece, and on a wrong shelf says where it goes ("Tomato goes in: Salad & fruiting") at every level; praise at 3, 5 and 8 in a row.
- **A real effect:** two stars keep that food fresh +1 day, three +2 (`freshenStock`, `FRESH_DAYS_BY_STARS`): the stock's `purchaseDay` moves forward (age clamps at 0, so it ages later), never more than 2 days past today, never quantity, price, credits or ledger. The result board shows the pictures of what stays fresh. Hype and magnets stay. The Inventory fridge does not show the extra days (its "days left" is capped at the shelf life), so the result board is where the player sees it.
- **Retuned for pieces:** time = 15 s + 2.8 s a piece x the stage factor (1.6 / 1.3 / 1.1 / 1); `STAR_AT` is now 50 / 74 / 92 % (the two-star share was 75 %: with pieces a careful player fell just under "3 in 4"); `fridge-sort-qa` H4 allows 6 % (was 5 %) of careful rounds to still get three stars. Still tuned by simulation only.
- **Tests changed by the new rules:** `fridge-sort-qa` B (Level 3), C (pieces, counts, caps, basket sizes), D1/D2/D9/D11 (time, difficulty table), E1/E2 (pieces leave the basket), F1 (the freshness reward moves `purchaseDay`, nothing else), H4; new section L; `fridgesort.mjs` rewritten for pieces plus S16-S19 (how-to, shelf pictures, Level 3, freshness); `market-art-qa` H1 also needs `basket` and `kitchen-wall`.
- **Big deliveries (developer 2026-11-05, "buy for 3 days, sort it all"):** measured with `marketPlanFor` on an empty fridge: one day of food is 6 pieces at Level 3, 16 at Level 5, 23-29 at Level 14-30, 37-60 at Level 45+; 3 days is 26-96 pieces; a basket holds 8-16. So one day is already more than one basket from about Level 5 (too little was never the problem), and 3 days is 3-7 baskets. Rule: `business.fridgeSort.chain` counts the baskets of the current delivery put away with at least one star (a 0-star basket starts it over); when the LAST basket is done and the run was 2+ baskets, Hype gets +5 per basket after the first, at most +20 (`bigDeliveryHype`, `BIG_DELIVERY_*`). The slip shows "+N more baskets · bonus for all", the result card shows the run and the bonus; the Market's Plan ahead shows "N baskets" with an ⓘ (`basketsFor`, `data-testid="market-plan-baskets"`). Tests: `fridge-sort-qa` M, `fridgesort.mjs` S20.
- **Art:** every Fridge Sort piece Codex made is already in `art-source/fridge-sort/` (A1-A25 and the two ingredient fixes); the 17 other PNGs in the Codex folder `generated_images/01a11c8e-...` from 2026-11-03 17:24 on are rejected retries (A23, A24, A25, the Cashier, two early fridge drafts). Not used yet: A1/A2/A19-A21 (fridge bodies, per-tier skins), A15 (checklist board), A18 (glass drawer). Optional new art: a cool "inside the fridge" backdrop (the screen uses the warm kitchen wall A3); O1 token plates and O2 badge stickers are not needed with bare pieces.
- **Still open:** a real-device pass (never run; only headless Chrome at 390x844, 360x640 and 320x568 was looked at); the layout of a 16-piece basket at Level 74+ was not looked at by eye; rewarded-ad offer (plan D4, needs an explicit yes); Playgama's live build is still the old one (no upload without an explicit yes).

## Fridge Sort mini-game, first version (developer 2026-11-03/04; the section above replaces it where they differ: Level 14, a crate of tokens)

`docs/planning/FRIDGE-SORT-MINIGAME-PLAN-2026-11-03.md` (rewritten after reading the code) and `FRIDGE-SORT-CODEX-PROMPTS-2026-11-03.md` (the art prompts).
After a Market purchase (or a morning delivery) the player sorts the crate into the fridge's REAL zones (`FRIDGE_ZONES` / `fridgeZoneFor`) in a 25-50 s round; stars give Hype and magnets; no money, no stock change, always optional.
**Unlock: Level 14** (the start of "Fridge & Freshness"); entry points: a chip in the Market and the Inventory fridge, the morning delivery card (Level 21+), later the closing chore.
Finding: 25 of the 57 ingredients (9 of 14 at Level 14) are "Vegetables", so the plan splits that shelf into 4 game-only bins (decision D1). Open decisions D1-D9 are in section 9 of the plan.
Art: the fridge scene, crate, HUD, stars, magnets are generated (local `art-source/fridge-sort/`); the 57 ingredient pictures are already in the game. The pantry basket (A6) is NOT used (the real fridge has no pantry zone).
**Built (P1 + P2):** `business/fridgeSort.ts` (pure rules: targets = `fridgeZoneFor` + 4 game-only vegetable bins, crate, difficulty by level, time, score, combo, stars `STAR_AT` 50/75/92 %, rewards, `finishRound`, `autoPutAway`; state `business.fridgeSort`), `inventory/FridgeSortGame.tsx` (drag AND tap, clock starts on the first touch, pause, result card, practice round, Prep Cook button), `inventory/FridgeSortChip.tsx` (Market Ingredients tab and above the Inventory fridge), `ScreenId "fridge-sort"`, `App.fridgeSortAction` (applies to the LATEST save; analytics `fridge_sort_started/finished/skipped/auto`), the crate is filled in `persistIngredientPurchases` (every Market line, Buy all, Rush Restock), five synthesized sounds (`sortPick/Place/Wrong/Combo/Tick`; `audio-qa` S1 now lists 15 effects). Dev flag `?fridgeSort` opens it below Level 14.
Tests: `scripts/fridge-sort-qa.mts` (targets, level 14, crate, scoring, rewards, NO money/stock change, saves, simulated players: fast and flawless = 3 stars, a careful 5 %-wrong player mostly 2, a random one none; mutation-checked) and the browser `tools/e2e/fridgesort.mjs` (S1-S12: chip gating, wrong/tap/drag, finish with Hype, nothing moves, Market purchase fills the crate, pause and skip, Prep Cook, Reduced Motion, 320 px, no errors).
**Art pass 1 (2026-11-04, working tree):** Codex round 2 delivered A23 (empty door), A24 (4 veg bins), A25 (2 drawers) and the Cashier portrait. `scripts/make-market-assets.py` now also writes `public/business/fridge-sort/` (4 bins, 2 drawers, 2 door racks cut from A23, one glass shelf cut from A1; 74 KB) and `staff-portraits/cashier.webp` (wired in `staffPortraits.ts` + `BusinessStaff.tsx`; `market-art-qa` D1 checks it). The fridge screen draws each shelf as its painted piece with the name chip on the blank label plaque; from 8 shelves (Level 44+) the pieces and tokens shrink so all 10 fit without scrolling. Rules, test ids and the tap/drag code did not change.
**Art pass 2 + the rest (2026-11-04):** `make-market-assets.py` also slices the HUD plaque (9-slice border image, so the carving never stretches), round pause button, star bar (frame, fill clipped with `clip-path`, a star on each painted ring; the fill maps score share piecewise through the rings), stars, crate back and lip (A4/A5), the result board (9-slice, title on its ribbon) and the 12 magnets (A17) into `public/business/fridge-sort/` (263 KB in all; `market-art-qa` H checks existence, budget and that the screen asks for nothing missing). Earned magnets are stuck on the Inventory fridge door (`PhysicalFridge` `magnets`, test id `fridge-magnets`) and the newest shows on the result card. **Expiring tokens (Level 74+):** `expiringTokens` marks at most 2 crate ingredients whose stock spoils tonight or soon (soonest first); a right drop of a ⏳×2 token pays double while more than a third of the clock is left; `bestPossible`/`starsFor` take the number of ⏳ tokens so such a crate is not easier to ace. **Achievements:** four badge-only ladders (reward 0, so the economy does not move): "Tidy fridge" 10 / "Fridge keeper" 50 crates, "Perfect crate" 5 / "Flawless fridge" 25 three-star crates. **Level 14:** the Pre-Service Check's news card shows a "Fridge Sort" line with an ⓘ next to the Refrigerator and freshness system. **Morning delivery (E3):** when the day closes, what the standing orders delivered goes on the crate (`addToCrate` in App's close handler; no money, ledger or stock). Tests: `fridge-sort-qa` J (expiring, achievements, magnets) and K (delivery), `fridgesort.mjs` S13-S15.
**Still open:** a real-device pass (never run, only headless Chrome at 320-430 px), the optional token plates and badge stickers (Codex round 2 O1/O2), per-tier fridge skins (A19-A21), the tidy streak (v2), a rewarded-ad offer (needs an explicit yes, plan D4).

## Market art: painted supply icons, ingredient pictures and Floor team portraits (developer 2026-11-03, committed locally, not pushed)

The Market audit found emoji that did not match the products (a wavy dash for the whisk, chopsticks for the tongs, a toilet-paper roll for the napkin dispenser, a chef for the Floor Server...).
Codex generated the art (branch `codex/fridge-sort-art-publish`, fetched read-only into the local ref `codex-local/fridge-sort-art-publish`, never merged: its 59 MB of PNG stay OUT of git).
- **Sources (local only, gitignored):** `art-source/market-supplies/S1..S6-*.png` (4 x 3 atlases), `art-source/staff/*.png`, `art-source/fridge-sort/*.png` (not used yet). The two manifests are tracked.
- **Build:** `python scripts/make-market-assets.py` (use `python`, Pillow + numpy + scipy): cuts the cells, removes the generator's haze (alpha ramp 56..205 and stray islands), fits 160 x 160, writes lossy WebP. Output is committed: `public/business/supplies/<supply id>.webp` (62 files, 284 KB total, <= 8 KB each) and `public/business/staff-portraits/floor-server.webp` / `floor-cleaner.webp` (320 px, like the other portraits).
- **Code:** `common/SupplyIcon.tsx` and `common/FloorStaffFace.tsx` (the emoji is the fallback if a picture fails). Used in the Market supply tabs, Inventory supplies, Business Cleaning, Par Audit, the Pre-Service Check, the sink chips, and the Floor team (Market Second Floor tab and the floor view). `ItemTile`/`ItemPic` take a ReactNode icon. The `FLOOR_STAFF` emoji (now the fallback) are 🤵 and 🧹.
- **Tests:** `scripts/market-art-qa.mts` (A-F: every supply has one 160 x 160 WebP with alpha, budgets, the script's cell order equals `SUPPLY_CATALOG` order (mutation-checked), portraits, fallbacks, sources not tracked; G: the 57 ingredient pictures, the script covers every ingredient, the screens use them), browser `tools/e2e/marketart.mjs` (M1-M7: 62 of 62 supply icons load on the four tabs, both portraits show, 57 of 57 Market crates, the Inventory fridge and the Needs-attention tiles show pictures, no failed requests).
- **Ingredients (done, second step):** the same script also cuts the 57 ingredient pictures from `art-source/fridge-sort/A7-A11.png` (the corrected `ingredient-green-chili.png` and `ingredient-chicken-breast.png` replace their sheet cells; a stronger haze ramp 96..215) into `public/business/ingredients/<ingredient id>.webp` (57 files, 346 KB). `common/IngredientIcon.tsx` (emoji fallback) is drawn in the Market crates, the Market plan, the Inventory tiles, the physical fridge (piles and bins), the Pre-Service Check rows, Kitchen, Daily Maintenance, Business Menu/Service/Analytics, AND the Inventory's "Needs attention" tiles (`RestaurantAttentionPanel`, ingredients and supplies, chosen from `row.action.to`).
- **Stays emoji on purpose:** sentences and badges built from strings (`businessAlerts.ts`, `attentionBadges.ts`, `restaurantAttention.ts` `glance` text, the stockroom banner strip, `BusinessService` titles), because a picture cannot sit inside a string. `WashUpSink.tsx` draws its dishes with emoji on a canvas. The Fridge Sort art (A1-A6, A12-A21) waits for the mini-game.
- **Staff gap (needs art):** the **Cashier** (required from Level 1) has NO portrait file, it shows an emoji (🧾). Prompt: A22 in `docs/planning/FRIDGE-SORT-CODEX-PROMPTS-2026-11-03.md`. When `art-source/staff/cashier.png` exists: add it to `scripts/make-market-assets.py`, add `cashier: "cashier"` to `PORTRAIT` (`staffPortraits.ts`) and `ROLE_PORTRAIT` (`BusinessStaff.tsx`), never before the file exists. `StaffPortrait` now falls back to `staffFallbackEmoji(id)` when a picture fails.
- The harness writes screenshots to `D:/WORKS/GAMES/Knife%20Craft/tools/e2e/out` (a percent-encoded copy of the repo path, `harness.mjs` `OUT`); not fixed.

## Deep review (developer 2026-11-03: "deep check for bugs and issues"; committed and pushed `d8588f2`)

Real bugs found and fixed (each has a test):
- **Decision (developer 2026-11-03, "do whats best"):** the cap stays at 5 branches (the spec said endless; going endless would mean big-number money everywhere, too risky for the wallet). The view shows "final branch" at the cap. A save above 5 reads as 5 (development saves only; nothing past 5 was ever shipped). The wallet is NOT clamped: past 2^53 cents is about four years of maximum play.
- **Franchise overflow:** money is kept as exact integers (below 2^53); at branch 6 the pile reached 1.7e16 mills. `MAX_BRANCH` is now 5 (`secondFloor.ts`), with a worst-case test (`F6`/`F7`).
- **Clock-rewind exploit:** `restartClock` could move a machine's clock BACK (a device clock set earlier), paying a pile twice. It now keeps `Math.max(lastCollectAt, now)`; found by the new fuzz test `Z1` (random actions, the clock going forward AND back).
- **Goal strip offered locked machines** under the dev `?floor2` flag (`floorGoal.ts` now reads the raw level); the locked message says "Tier 3 opens" only for a tier upgrade (`SecondFloorView.tsx`).
- **The "full in" bar ignored a Rush** (it followed the wall clock while the money came in at x3): `stationFillMs` (`secondFloor.ts`) is now the one source for `floorFill.ts` (test `R6b`).
- **The machine panel's price check** counted only that machine's takings; it now counts the whole floor's waiting pile (the purchase banks it first).

Browser comparison (current build vs the commit before the Second Floor rebuild, about 40 maintained tests, both builds run side by side): **no regression in the game.**
Every test that passed before and failed now was checking an old rule; updated to the new rule (each file says so): `cashflow` (C2a: a free second table means Next Customer is not held back;
C3: the two hires are ledger entries), `levelflow` G2.6, `rollon` R2 ($236 opening wallet), `guests`, `resize` and `restaurantguests` (their seeds now hire the Server and the Cashier).
`dish-classification-qa` D1/D2 now guard `dishKind.ts` and the LIST of oven recipes (the whole `ovenStep.ts` changed with the film).
Failing the same way on the old build too (stale, not caused by this work): `firstload`, `cashreload`, `paidstaff`, `earlymenu`, `walkins`, `longcopy` (times out), `landscape`, `legacy`, `history`,
`inventory`, `knifereport`, `kitchenstrip`, `fridge`, `phase5`, `phase6`, `restaurantguests` checks 3 and 4a (the cash now lies on the table, so the revenue entry comes later). `adbonuses` 3b is still flaky.
Not tested in a browser: the Pre-Service Check "Hire Server & Cashier →" path with supplier credit; two parties in one service (unit-tested).
Clean-up done: the baseline worktree and `tools/e2e/_base/` were temporary and are removed. The system stopped the preview servers once for low memory; run browser suites with one server.

## The oven shows a film of the bread baking (developer 2026-11-03, committed and pushed `deca28a`)

The developer added `Bread.mp4` (10 s, 720x1280, 6 MB, AI-made, a sparkle logo bottom-right). The oven step (`OvenStep.tsx`) now shows a FILM in its window instead of the
painted oven: the bread goes in (1.5 s), then bakes for 6.5 s: raw and pale, gradually cooking, perfect golden, deep brown, and at the end burnt. The meter and "Take it out"
sit under it. **The golden window is very thin: 8 % of the bake (0.60-0.68, 520 ms)**; a burnt zone follows (from 0.88: a new result line "Burnt!", words only, still no effect on
grade, score or pay). No skip button, no tap on the film. Files: `src/assets/video/oven-bread.mp4` (295 KB) / `.webm` (281 KB) / `-poster.webp`, built by
`scripts/make-oven-bread-video.py` (ffmpeg): crops 720x900 from y=160 (the logo is cut OUT, not hidden), keeps the carry-in at 2x speed and the close-up after the
source's own dissolve (4.95-10 s), stretches it to the bake, drops the audio, and COLOUR-GRADES the loaf only (an ellipse; the flames stay) over time, because the source loaf
only ever reaches a light golden crust and has no burnt stage. The film follows the bake clock (moved back when it drifts more than 0.25 s); if it cannot play (error, no frame in
3 s) or Reduced Motion is on, the painted oven is shown and the bake plays the same. The same film is used for the baguette dishes (it is a round loaf).
Tests: `oven-step-qa` A2/A3/A3b/A6 and new F1-F4 (E2's tray-only view guard relaxed, documented), browser `ovenstep.mjs` (rewritten: film on, thin window, the golden tap, Reduced
Motion, O4 for the cash-on-table rule) and `ovenrecipes.mjs` (repaired too: team hired, "Open for service", the film, cash on the table; six dishes pass). Not run: `ovenbaguette.mjs`
(needs the dev server), `earlymenu.mjs`, `walkins.mjs` (they use the oven).

## The Server and the Cashier are necessary (developer 2026-11-02, committed and pushed `458066a`)

"Without hiring both the Server and the Cashier the game still delivers food: make them necessary." `STAFF_RULES` (`restaurant/staffRequirements.ts`) now lists
`server@1` and `cashier@1` first, unconditional: every service needs both from Level 1 (the old "a Server from the second table, Level 46" rule is replaced). The
Pre-Service Check lists them as missing, says why, and its main button becomes "Hire Server & Cashier →" instead of "Start service" (the existing blocking rule); a hire the
wallet cannot cover goes on supplier credit (the existing rule for a REQUIRED hire), so it cannot soft-lock. The new game already starts with $10 plus both fees and the first-run
hand sends the player to hire them first. The guide skips the starting team (`restaurantGuide.ts`), and "· free" was removed from the check's hire row (the hire has a fee).
Also: the dining cash pile no longer keeps focus after a tap (`TableCash.tsx`: the browser warned "Blocked aria-hidden ... descendant retained focus").

- Tests updated to the rule, each saying so: `restaurant-progression-qa` S1/S2/S3/S7, `dining-floor-qa` D2, `restaurant-day-qa` O4 (the check is ready only with both hired),
  `journey-qa` J11 (the disposition document regenerated: Level 1 now says "Hire a Server; Hire a Cashier"), `restaurant-second-floor-qa` A2 (it used a fixed date, so it failed
  the next day: it now uses the real clock). Browser: new `tools/e2e/firstteam.mjs`; `harness.mjs startFirstLevel` hires both first; `dining.mjs` / `cashroom.mjs` seeds hire them.
- `oven-step-qa` E2 failed once inside a full run and passed alone five times afterwards (not understood; a git-reading guard).
- Browser tests that use `startFirstLevel` and were not re-run: `cashflow`, `cashreload`, `levelflow`, `openservice`, `rollon`.

## Fixes (developer 2026-11-02, after the Second Floor rebuild; committed with it)

- **Market hand:** a new game opens the Market on Knives, but hiring and buying food are in Ingredients, and nothing pointed there. While the first-run hand is on the
  "hire" or "buy" step and the player is not in Ingredients, the Ingredients tab gets the pointing hand and the line "Open Ingredients: hire your team, then buy the food"
  (`Shop.tsx`, `data-testid="first-run-hand"` / `first-run-ingredients-hint`). Browser: `tools/e2e/firstmarket.mjs`.
- **Wipe the table only when no table is free:** the dining room has two tables. A party that leaves only DIRTIES its table (`serviceFloor.ts`: `markTableDirty`,
  `cleanTableCount`, `nextTable`); the next party sits at a clean table; the player is asked to wipe (and Next Customer waits) only when both tables are dirty, and then only
  the one the next party will use (`Preparation.tsx` `floorDone` / `wipeDone`). Tables are clean again when a service starts (`resetParties`). A Cleaner on the dining room
  still clears each table by themself. The closing "tables" chore is unchanged: a service never wipes every guest's table any more, so it always remains tonight.
  Tests: `dining-floor-qa` T1-T7 (the rule replayed on the real functions), `dining.mjs` D4b / D6 / D6b and `cashroom.mjs` K2b (rewritten to the new rule). Not covered in a
  browser: two separate PARTIES in one service (Level 1's two customers share one table), so "both tables dirty, wipe asked" is only unit-tested.
- `oven-step-qa` E2 now also excludes `floorFlood.ts` / `goldenGuest.ts` (they became tracked with commit 6e0349e; that commit left this guard failing until now).
- `adbonuses.mjs` check 3b is still flaky (see the notes above); the developer said they will look into it.

## The Second Floor rebuilt for engagement and ads (2026-11-02, committed and pushed `6e0349e`)

Developer: "the main goal is real money: engaging, dopamine, players engage for hours and watch ads"; Level 3 opening; "let the player be rich";
the rest "whatever is best, you fix it". Spec and evidence: `docs/planning/SECOND-FLOOR-FINAL-SPEC-2026-11-02.md` (decisions, numbers),
`...-ENGAGEMENT-AND-ADS-DESIGN-...` (telemetry and ad plan), `...-IDLE-GAME-RESEARCH-AND-INCOME-...`, calculators `scripts/second-floor-*.mts`.

- **Built (A-C, partly D):** `restaurant/secondFloor.ts` is now a customer-cycle economy: opens at **Level 3**, machines $500 / $1,000 / $1,500 / $2,000 /
  $2,500 / $4,000 (own campaign levels 3 / 5 / 8 / 12 / 17 / 23), **tables** (√n guests, ×1.25 at 5, ×1.5 at 10, room 6 / 8 / 10 by tier), **Polish** (10
  steps, +6% each), **tiers** (Tier 3 needs Level 30), counters 4 / 5 / 6 h, whole cycles in integer mills with a carried anchor, the first two machines
  **self-serve**, Servers $1,200 / $6,000 (half speed + 10-minute tray without one), Cleaners a +10% bonus only, **branches** (Franchise: reset, prices and
  payouts ×10, +50% income per branch). State only in `business.secondFloor` (all new fields optional: `tables`, `polish`, `branch`, `bonus`,
  `floodTag`, `goldenSlot`). `floorGoal.ts` (the next-goal strip, best payback), `floorFlood.ts` (Flood after a first clear, ad extra, Skip ahead),
  `goldenGuest.ts` (a seeded VIP every 4 minutes, tap for a tip, ad ×3). New ad bonuses `flood`, `golden`, `skip` (placements `flood`, `golden_guest`,
  `skip_ahead` in `PlayablesSDK` and `public/playgama-bridge-config.json`); analytics `floor_action`, `floor_flood`. `formatUsdBig` ($123K, $1.23M ...).
- **Tests:** `restaurant-second-floor-qa` rewritten (rule change documented at its top, 100+ checks); updated to the new rules and said so: `idle-qa` F/D,
  `restaurant-floor-life-qa`, `restaurant-guide-qa` A1/B1, `staff-hire-qa` U4/U5, `oven-step-qa` E2 (exclusions), `playables-ads-qa` E6; browser
  `tools/e2e/restaurantsecondfloor.mjs` (rewritten, 10 checks incl. the Golden Guest), `marketsecondfloor.mjs`, `idle.mjs` I3. `adbonuses.mjs` 1-2 pass; its
  check 3 plays a real level through and timed out waiting for the cooking screen (not investigated; may be one of the stale old-numbering tests).
- **Also built (2026-11-02, second pass):** Hype (a first clear adds 20 + 20 per star, full = a free 3-minute **Rush Hour** at ×3, exact time-warp math in
  `secondFloor.ts`: `rushFrom/rushUntil`, `anchorForRest`; proved by `restaurant-second-floor-qa` R4-R7 including a 200-schedule property test and two
  mutation checks), the rewarded **Rush hour** offer (ten minutes at ×3 paid now, kind `rush`, placement `rush_hour`, cap 4 a day), the milestone **fanfare**
  (machine, tier, 5 / 10 tables, ten Polish, branch, Rush), and the rate pill shows ×3 during a Rush. `Collect ×2` has no $250 ceiling any more (rule change,
  `ad-bonuses-qa` updated).
- **adbonuses.mjs:** found stale (it also fails on the committed build): no team, no supplies, "Prepare" is now "Open for service". Repaired seeds and flow, so
  checks 1, 2, 3a, 4, 5, 6, 7, 8 pass. **3b still fails** (the day's second service ends in Closing Time, not "Next Customer"): documented in the file; the
  Level bonus path itself is unchanged. The Flood offer is therefore NOT exercised in a real level playthrough in a browser (only in unit tests).
- **Not built yet:** a floor streak, per-branch looks and the Franchise reward art, Level 1-2 first-minute work, the Closing Time step in the adbonuses level
  helper, a real-device / Playgama QA-tool pass. Playgama's live build is old (developer), so its telemetry (median session 60 s, 4% sessions with a
  rewarded ad) is not a measure of this build.

## Table cash lies on the tables and piles up; Phases 3 and 4 (2026-10-31, working tree, not committed)

Plan, evidence and the open decisions (D8-b, D10): `docs/planning/PHASE3-4-PLAN-2026-10-31.md`.

- **Table cash (developer 2026-10-31: "let it lay there, collect whenever, let it pile up like other idle games").**
  `economy/pendingCash.ts`: serving never collects older cash; one pile per pay kind (`business.pendingCash`, optional
  `more` for a second kind). Drawn as bundles with the amount by the front tables (`common/TableCash.tsx`,
  `restaurant/tableCash.ts`) in the dining room and on the restaurant map; one tap collects (`App.collectTableCash`).
  The Kitchen chip and the Pre-Service Check's "Collect $X from the tables" do the same. **Auto no longer collects it.**
  Closing Time: Collect first, then the chores and the count ("💵 First"), then Close.
- **Phase 7A + Second Floor popularity (2026-10-31, working tree):** developer answers D-6 income AND popularity (a working machine
  adds popularity, +1 per 6 level-points, max +3 a day: `floorPopularityDelta`, `idle-qa` D), D-7 100 milestones, D-8 hybrid. Built the
  data only: `restaurant/journey.ts` + `journey-qa`; no screen changed yet (7B next).
  D-9: milestones pay NO money (achievements stay the only bonus money). D-10 ("do what is best"): Practice milestones are named
  after their dish, names are unique.
- **Phase 6 check and Phase 7 plan (2026-10-31, plan):** `docs/planning/PHASE7-MILESTONES-PLAN-2026-10-31.md`.
  Phase 6 is complete as designed (floor and all six stations open at L5, 13 cuisine chapters, each machine changes the
  floor's own rate and storage; none affects the main restaurant, decision D-6). Phase 7 recommends a hybrid: the hidden
  service ladder stays the spine, 100 milestones become the visible progression (`restaurant/journey.ts`, derived, no save
  field), goals add stars but never block. The per-level table is generated by `scripts/level-disposition.mts` into
  `LEVEL-DISPOSITION-2026-10-31.md` (all 148 levels kept, 45 natural milestones + 55 Practice).
- **Phase 5 (idle, 2026-10-31, working tree, not committed; plan `docs/planning/PHASE5-IDLE-PLAN-2026-10-31.md`):**
  the Pace card (Business overview: Earned / Costs / Net per SHIFT hour from the closed days' own ledger figures saved by
  `closeDay` in `restaurantDay.paceDays`, the Second Floor on its own per REAL hour), fill bars and "Full in …" on the
  Second Floor, its takings as a pile on the Pickup Counter, the amount on the map's upstairs button, the Welcome-back
  sheet listing the floor's pile and the table cash as free rows, a floor line in Closing Time, badge-only floor
  achievements. No new money source; no offline income for the main restaurant (D5). Not built: staff-run services while the
  app is open (D11, later), the 7-days-running badge.
- **Fixes (developer 2026-11-01):** dicing a steak/chicken no longer freezes the cutting board (`PreparationScene`: the protein
  settle read every piece's centroid per piece, O(n²); now one per piece per batch, and a cut that makes 3+ pieces paints
  their textures a few per frame, `pieceJobs`). The tutorial hand is the cuffed 3D hand from the developer's SPLIT sheet
  (`src/assets/ui/pointer-hand.webp`, `common/PointerHand.tsx`, same fingertip placement as the old glove).
- **Phase 8 (customers), built 2026-11-01** ("build what is best", every plan answer D-1 … D-8 taken as recommended):
  `docs/planning/PHASE8-CUSTOMERS-PLAN-2026-11-01.md` has the plan and, at the end, what was added and what was skipped.
  8A demand that scales: `restaurant/guestDemand.ts` (timetable + seats + pull of reputation / menu / lunch-dinner rush /
  spotless, capped at 4, from dine-in; served = min(wanted, capacity); the floor never drops); `menuGuests.ts`
  `serviceGuestPlan`. 8B hurried guests (`serviceFlow.ts`, 1 in 4 from dine-in, patience ×0.7, ⏱️ on the door face).
  8C the Service Report (`restaurant/serviceQuality.ts`: ★ 1–5 from dishes / waits / clean, last 7 in
  `restaurantDay.serviceResults`, shown on the closing card, ±1 on the day's popularity, `service_report` analytics, never
  money). 8D the Pace card shows the next service's guests and the last stars (`guestReport.ts`). Suites:
  `guest-demand-qa`, `service-quality-qa`. Economy: pull adds guests (saver 570 → 800, completionist 694 → 863) and about
  +$3k to the completionist's end (295,442 vs 292,455); the saver's service-by-service fridge peak is now ~80 (was 40), so
  `restaurant-final-economy-qa` V3 was updated to the new rule. Skipped: Family / Foodie / Takeaway kinds, real effects
  for the five personalities, tip share from stars, badge achievements (see the plan's last section).
- **Phase 9 (the dining floor), built 2026-11-01** (`docs/planning/PHASE9-DINING-FLOOR-PLAN-2026-11-01.md`, report at its end).
  9A fridges: Commercial 80 → 100, Professional 140 → 240 (prices unchanged; 4 fridge suites and `restaurant-final-economy-qa` V3 updated to
  the new rule). 9B a waiter walks the plate from the pass (the Server's look when hired, else the cook). 9C takeaway: the tag existed only in
  the supplies (`orderServiceFor`, from L44); now the customer stands at the door and is handed a 🥡 bag, kept out of parties
  (`seatInParty(..., solo)`). 9D `cleanliness.wipeTable`: the table of a party that left is wiped by the player's tap (first wipe takes the
  closing task's supplies once) or by the Server / Dining cleaner; all tables wiped = no closing "tables" task. 9E the dining side panel
  (`restaurant/diningHire.ts`): Server from Level 3 (`SERVER_HIRE_FROM`, hiring only; the staff rule is unchanged) and three hourly Cleaners
  ($15 = one shift hour, one per area, gone when the service ends; `hireHourlyCleaner`). Suites `dining-floor-qa`; browser `tools/e2e/dining.mjs`.
  Not built: a separate billing role (the counter cashier comes with the Server), takeaway before L44, per-area cleaner portraits.
- **Fixes (developer 2026-11-01, after Phase 9):** the cash is on the table when the Served card opens: the card is a sheet under the
  dining room (`game/DiningCashView.tsx`, `ServiceOrderComplete` `room` prop) with the pile tappable like in an idle game (the same collect
  as the button; it also covers a plate held for its party); the Pre-Service Check chore row no longer squeezes its name (`ShiftChecklist`);
  the "Hire a Cleaner for today" offer and the Cleaner staff card moved to the bottom of Cleanliness, worded "Not in the mood to clean?".
  Browser: `tools/e2e/cashroom.mjs`; `dining-floor-qa` B1–B3.
- **Phase 10 (the team and the table care), 2026-11-01** (`docs/planning/PHASE10-TEAM-AND-TABLES-PLAN-2026-11-01.md`): a new game starts
  with $10 + the Server's and the Cashier's fees ($236) and the first Market visit has a "Hire your team" card (`restaurant/TeamHireCard`,
  `diningHire.teamOffers`); the Cashier is a 7th staff role (`businessStaff`): makes the bill on the Served card, takeaway customers stand
  at the counter beside them and are handed the bag, and the closing "count the takings" row is done by them. The Server only carries the
  food (no longer clears tables). Cleaners by the hour moved to a small 🧹 button on the restaurant map (`MapCleanerHire`): rest of today,
  wage × hours left, the wage grows with the restaurant, gone the next day; gone from the dining floor and from the Cleanliness page. Table
  care from the first customer: the dirty table and the napkin holders (every 3rd table) are tappable in the Served room
  (`cleanliness.wipeTable` free before Level 5, `refillNapkins`). Suites `dining-floor-qa`; browser `dining.mjs`, `firstshop.mjs`.
- **Growing Kitchen costs $6,000 (developer 2026-11-02)** in the restaurant build (`restaurantInvestments.kitchenPrices`); the tiers are now
  $6k / $12k / $18k / $24k / $29k ($89,000 in all, was $143,000 with Growing at $60,000). The classic catalog price (`kitchenUpgradeDefinitions`,
  classic test build only) is unchanged. The Pickup Counter sheet now scrolls and keeps its Close button in view.
  `restaurant-final-economy` T2/T3/R1 and `early-upgrade-payback` L4 updated; `phase5-qa` A3 diffs `restaurantInvestments.ts` against HEAD, so it
  passes only once this is committed.
- **Phase 11 (eight fixes, 2026-11-02)** (`docs/planning/PHASE11-FIXES-AND-DAY2-CLEANING-PLAN-2026-11-01.md`): (1) Grandma's pointers other than
  the Market's wait until Level 1 is finished; (2) the cash lies beside the party that paid (`tableCash.cashSpotBeside`), never on the other table;
  (3) the Business hub (its Kitchen button and first screen) opens at Level 1, its pages keep their levels; (4) no Collect cash button: tap or
  swipe the pile (`TableCash swipe`, only a gesture inside the room); (5) Next Customer waits for a dirty table that can be wiped
  (`blockNext`; never for one that cannot, so nothing soft-locks); (6) the table is scrubbed in the cleaning game (`AreaCleaningPrototype`,
  "tables") until a Cleaner is hired; (7) the guide asks the Market's own purchase verdicts (the Santoku bug: a price-only check) and
  `guide-reality-qa` sweeps 80 levels x 5 wallets so a recommendation can never name a locked or unaffordable thing; (8) cleaning, the shift
  chores and the day ceremony start at Day 2 = Level 3 (`config/cleaningStart.ts`; was Level 5): morning (stations + restroom check), the
  lull, and the night's chores in the kitchen, dining area and restroom. Suites `phase11-qa`, `guide-reality-qa`; browser `day2.mjs`,
  `cashroom.mjs`, `dining.mjs`. Rule changes updated in: night-sync, restaurant-day, -first-levels, -service-report, -shift-chores,
  -cleanliness, phase4, shared-prep, table-cash, dining-floor, oven-step (diff guard) suites.
- **Stale browser tests after Phase 11 (documented, not fixed):** `restaurantday.mjs` (its "no day card at Level 5" is the old rule: the day card
  now shows from game Level 3), `restaurantcleanliness.mjs` (check 5 expects the old tab levels), `restaurantshift.mjs` (seeds written for
  the old numbering; its chore lists are read at Levels the new rule changes), `restaurantfirstlevels.mjs` and `paidorders.mjs` (no result
  within 250 s; seeds from the old numbering). They were not part of the verified set. The verified browser set is `day2`, `cashroom`,
  `dining`, `firstrun`, `firstshop`, `cashflow`, `levelflow`, `servicefloor`, `sharedprep`, `prepcook`, `openservice`, `cleaningfeel`.
- **First-run hand (2026-11-01):** `restaurant/firstRunGuide.ts` puts one hand at a time in order: hire the Server and the Cashier first (their fees are the opening cash's extra $226), then buy the food, the Kitchen tab (with a numbered caption), Open for service, the sheet's Start service; a hire the player cannot pay for is skipped and nothing returns once done. `first-run-guide-qa`, `tools/e2e/firstrun.mjs`.
- **Phase 3:** `tools/e2e/reveal.mjs` proves the restoration reveal shows only after the purchase is saved;
  `scripts/early-upgrade-payback-qa.mts` measures reach and payback (no price changed: items return 0.25x, kitchen tiers
  never pay back in money — decision D8-b).
- **Phase 4:** the Prep Cook's cutting already existed; now one order state for hand-cut and Prep Cook orders
  (`PreparedBy` tag, served card "Cut by your Prep Cook"). Who automates what (Line Cook, Server): decision D10, not changed.
- **Decisions (developer 2026-10-31):** the Prep Cook opens only at **level 30** (`PREP_COOK_CUTS_FROM`; hiring, the
  guide tip and cutting all wait for it, and the service that requires him starts there too, `staffHireFrom` /
  `STAFF_RULES`); **D8-b: keep the kitchen tiers as restoration milestones** (no re-pricing); **D5: no offline/idle
  income without an ad** (the player hires staff and plays each day; the capped real-time Second Floor income stays
  as it is). **Added instead (developer 2026-10-31): "Welcome back"**, a 6th ad bonus: after 30+ minutes away, a few
  hours of earnings (up to 3 h, $10-$90) **only for a rewarded ad**, no free part and no doubling
  (`adBonuses.ts`, `AD_PLACEMENT.welcomeBack`; `ad-bonuses-qa` G1-G6, `tools/e2e/welcomeback.mjs` 6/6).
- Rules changed in tests (said here and in the commit): `pending-cash-qa` S4, `party-served-together-qa` C3,
  `prep-cook-auto-qa` A4/A5, `service-flow-qa` D3, `prepcook.mjs` P4. Browser: `tablecash.mjs` 7/7, `reveal.mjs` 5/5.
- Harness note: `tools/e2e/harness.mjs` `OUT` keeps `%20` from the URL, so screenshots land in `D:/WORKS/GAMES/Knife%20Craft/tools/e2e/out`
  (outside the repo), not in the repo.

## Phase 2: customers on a clock (2026-10-30/31, done)

Plan and decisions Q1–Q7: `docs/planning/PHASE2-PLAN-2026-10-30.md`. Built so far:

- 2.1 `restaurant/serviceFlow.ts`: the clock and queue logic (`service-flow-qa`).
- 2.2 `restaurant/orderPool.ts`: guests order what is in stock. The forecast list (what the Pre-Service Check
  plans) is weighted toward new dishes (×1.5). An arriving guest orders the forecast dish when it can be made,
  otherwise a stocked dish (weighted by new dish and portions in stock), never taking stock planned for the guests
  after them. A walk-in still keeps the next level's reserve (`order-pool-qa`).
- 2.3 The clock and queue are wired (`App.tsx`, `components/kc/game/useServiceQueue.ts`). A campaign service's customers
  arrive on the clock; the clock runs only with the service on screen and no card open (a hidden tab stops it).
  Guests wait at the door ("🚪 N waiting" with a patience bar on the service screen). The served card's Menu guest
  button seats the first one, calling them in early if they have not arrived. A guest whose patience runs out is
  skipped (counted in `levelProgress.menuGuests`, no order, no money). Patience pauses under Auto. No save field.
  Browser: `tools/e2e/queue.mjs` (5/5, about 5 minutes).
- 2.3b Customers only wait while the player is serving (developer 2026-10-30, `serviceClockRuns`): any other screen,
  a card, a pause or an ad, or cleaning the board freezes arrivals and patience. Coming back resumes the same queue.
- 2.4 The door shows a face per person waiting, each ringed by the patience left, and "😤 A guest left" when one walks
  out (`doorView().faces`, `Preparation.tsx`).
- 2.4b Popular dishes cost more (`restaurant/dishHeat.ts`, `business.dishHeat`, optional): +1 heat per guest order,
  x0.85 at every closing; from heat 3, +5% per point above 2, at most +25%, never above the menu cap. Shown as
  "🔥 +N%" on the Menu and the guest button and "🔥 Popular +$X" on the served card. A pricier dish is picked a little
  less (`orderPool` `dishWeight`). Tests: `dish-heat-qa`; browser `tools/e2e/dishheat.mjs` (3/3).
- 2.5 Auto works through the queue: after Serve and Collect cash it seats a waiting guest it can serve (the Menu
  guest button) before Next Customer. A guest's serve uses the reconciled session, like the level's own orders, so a
  dish the Prep Cook just cut is ready to serve.
- Economy at the end of Phase 2 (measured): completionist $292,322 (target ≥ $150k), saver $458,510, move-in
  $227,200, broke $64,398, prudent completionist lowest $376 (floor $350). Frozen campaign baseline unchanged
  (69,925 / 245,138 / 16,604 / 1,415 / 299,874).
- Still stale, not re-run in Phase 2 (from before): `restaurantprogression.mjs` 1/5b/5c, `marketneedslevel.mjs` 1/2.
- **Economy item resolved (2026-10-31):** `restaurant-final-economy-qa` S3 had dipped to $313 at L33 (floor $350).
  The cause was the simulated careful player's look-ahead, not prices. It kept the next service's stock, tools and
  supplies, and wages only from full operation, so it missed the closing wages before full operation (half wages,
  and the Prep Cook's full wage since Phase 1). With guests earning a little more, it bought a fifth Blacksmith
  upgrade at L32, then paid wages $68 + a required Indian Chef $136 + tools $78 + supplies $12 at L33.
  `restaurantCampaignSim.mts` `nextServiceNeeds` now also keeps `closingPay`. Lowest is back to $376 (L6). No game
  price changed.

## Phase 1: the service loop hides the levels (2026-10-30, decisions P1–P6, local commits, not pushed)

Plan and decisions: `docs/planning/PHASE1-PLAN-2026-10-30.md` §8.

- **Open for service** (P1/P2/P4): the restaurant build's Kitchen card is "Next customer" with one button that starts
  the first unlocked level not completed (`restaurant/nextService.ts`). No Replay on the Kitchen; replays are on the
  Order Board. After the last service the button opens the restaurant.
- **After a story card or a reload** (P3/P4): no roll-on. The player is back on the Kitchen and taps the button again.
- **No level numbers on the service path**: the Pre-Service Check header is "Day N", Closing Time and Daily
  Maintenance name services, the restock panel says "the next service", the Market says "Needed soon".
- **Unlock copy counts services** (P5): "opens in 3 services", "after the next service", "this service",
  "🔒 3 services", "after the final service". One source: `restaurant/servicesToGo.ts`, used by game copy and, in
  the screens, through `useUnlockText()` (`navLevel.ts`). The classic build keeps its "Level N" wording. Item levels
  (Blacksmith ★, Second-Floor machine Lv) stay.
- **Prep Cook paid by the hour only** (P6): no hiring fee, and every closing before full operation pays his full
  shift wage, $40 (`closingWage` / `closingPay`, `staffRequirements.ts`), from the day he is hired. (Cuts, and can be hired, from Level 30 since 2026-10-31.)
  Economy: completionist $291,692 → $291,672, saver $458,402 → $458,382, move-in at L120 +$120, broke player
  unchanged. The frozen campaign baseline is unchanged.
- Tests: `service-loop-qa` (new); browser `tools/e2e/openservice.mjs` (8/8, new). Browser tests that tapped the
  Kitchen's "Prepare" tap "Open for service" (harness, firstshop, prepcook, sharedprep, servicefloor).
- **Stale browser checks, already failing on the build before Phase 1** (same result on the previous commit's build,
  not fixed here): `restaurantprogression.mjs` 1 (L11 news), 5b and 5c (expect free hiring; fees since 2026-10-26),
  and `marketneedslevel.mjs` 1 and 2 (the Level 10 Market highlight).
- Not done: the order queue and orders drawn from stocked menu items (P1-B, Phase 2), idle/offline income (D5).

## Prep Cook cuts for the player; Auto service (2026-10-30, decision D4)

- Developer: "after certain levels, if needed by the players, let them hire a Prep Cook to cut the vegetables and
  ingredients and automate the restaurant fully". One rule module, `restaurant/prepCookAuto.ts`:
  hired Prep Cook + `PREP_COOK_CUTS_FROM` (Level 30 since 2026-10-31, was 20; change it there) + not a teaching first play.
- The arrival card (`ServiceFloor`, seated) gets **👨‍🍳 Prep Cook cuts it** and **Auto: on/off**. The cook "cuts" the whole
  order (every step and shared plate, `PREP_COOK_MS`), then the normal Serve card opens. The plate is always **Honest 75**
  (`PREP_COOK_SCORE`): neutral pay, the 5% Honest tip, no combo/moments/recipe-book page; hand-cut Clean/Masterful pay more.
  Nothing else changes: same `onComplete` → `recordCampaignServiceResult` → serve → ledger path, no new money code.
- **Auto** (`SaveData.settings.autoService`, optional, off by default): the cook starts each order when the customer sits,
  and the served card presses Serve → Next Customer a beat apart (`AUTO_*_MS`), then the level rolls on. (Since 2026-10-31 it
  no longer presses Collect cash: the cash stays on the tables for the player.)
  It never buys anything: it stops at the Pre-Service Check when stock or supplies are short, at a story card, and
  cash that must be swiped by hand is left to the player. **Stop Auto** is on the card; the toggle also sits on the arrival card.
- The guide (`restaurantGuide.ts`) offers "Hire a Prep Cook to cut for you" from Level 30 until hired; hiring opens at Level 30 too (was Level 5)
  (no fee and paid by the hour since Phase 1, see above). Role text: "Cuts orders for you — 3% off every ingredient purchase."
- Tests: `scripts/prep-cook-auto-qa.mts` (rule, plate pay/tip, save, hire, wiring); `tools/e2e/prepcook.mjs` (8/8: teaching
  level by hand, button, cut, Serve, Auto chain with wallet = cash + ledger, Stop Auto). Headless Chrome once printed
  "Framebuffer Unsupported" during Auto's many fast Phaser remounts (1 run in 5); not reproduced since.
- Not done (next): restocking food by itself (standing orders cover supplies only), idle/offline income (D5), per-dish limits.

## Service rolls on after the last customer; deterministic order ids (2026-10-30)

- The level's last "Next Customer" completes the level (reward and story flush as before) and, after a **first**
  completion with **no story card** pending, starts the next level through `onSelectLevel` (closing time, then the
  Pre-Service Check) once the completion is saved (`rollOnRef` effect in `App.tsx`). The reward toast stays up.
- Order ids are `order-N` (no clock): the same play makes the same ids and party sizes. `tools/e2e/rollon.mjs`.
- Decisions D1–D9 are in `docs/reports/PHASE0-AUDIT-2026-10-30.md` §12.

## Served card: Collect cash / Next Customer; level system hidden (2026-10-30)

- The served card has two actions instead of the swipe screen: **💵 Collect cash** (one tap takes the cash on the table
  into the wallet, `App.collectTableCash`) and **Next Customer** (cash keeps waiting). The cash is still required before
  closing and shows in the Kitchen. The dining-room cash screen and its swipe piles are gone from `ServiceFloor`.
- **No "Finish Level" button anywhere:** the last customer's Next Customer completes the level behind the scenes
  (`endsLevel` → `finishCampaignLevel`); "Back to Orders" is now "Back to Kitchen" and leaves to the Kitchen, not the Order Board.
- Browser tests were updated (`sweepCash` taps Collect cash; `/^Next Customer$/`). Older e2e scripts that look for
  `/Finish Level/` text in other files were renamed mechanically and not all re-run (stale list unchanged).

## Parties served together; no cash screen after the serve (2026-10-30)

- **After Serve:** the plate arrives, the customer reacts, walks out, and the served card opens by itself —
  the cash-on-the-table screen only opens when the player taps "Collect cash at the table" (`cashOnly` in
  `ServiceFloor`). The cash stays saved (`business.pendingCash`); Kitchen "on the table · Collect"; closing needs it in.
- **A party is served together** (`serviceFloor.ts` held plates): a party of 2–4 is made of the level's own
  required orders. While a party-mate is still to be cooked, a member's plate is HELD (paid by the normal serve,
  kept back, "plate ready — waiting for the rest of the table"); the last order's serve sends every plate out at
  once, everybody reacts, the cash is ONE pile (`withPendingCash` `merge`) and the whole party walks out together.
  Menu guests / the walk-in are their own tables after the level's orders. `resetParties()` clears the memory when a
  service starts, ends or is left.
- QA: `party-served-together-qa`; browser: `tools/e2e/sharedprep.mjs` (both a table of two and a lone customer).

## Same-dish parties prepared together; table cash optional (2026-10-30)

- **Shared preparation (developer 2026-10-30):** when the next required orders of a level ask for the same
  dish (customers who came together), the cutting runs plate after plate ("Plate 1", "Plate 2" in the step
  label, "N plates together" in the subtitle), the dish is cooked once, and the first plate is served; the next
  plate arrives READY with the same score (`sharedPrep` in `App.tsx`, `portions` in `Preparation.tsx`; up to a
  party of 4, required orders only, never menu guests). Each plate is still its own order: its own serve,
  pay, tip, stock use and paid-order record, so nothing is paid twice. The button reads "Serve the next plate →".
- **Table cash is optional:** Next / Back / Finish never wait for the swipe; the cash screen has "Collect
  later". The cash stays saved on the table (`business.pendingCash`) when the player leaves or reloads; the
  Kitchen shows "💵 $X on the table · Collect"; the next served order's cash first takes in the older cash
  (`withPendingCash`); "Close for the night" waits until it is in the till (`ClosingTime`).
- QA: `shared-prep-qa`; browser: `tools/e2e/sharedprep.mjs` (6/6), `cashreload.mjs` re-pinned (R2/R3).

## Own-money start, Market from Level 1, economy re-plan, fixes from the full analysis (2026-10-30, `main`)

- **No gifts (developer 2026-10-30):** Grandma's tools, cleaning cupboard and leftovers fridge are gone
  (`giveGrandmasTools`, `giveGrandmasCupboard`, `grandmasFridge.ts` removed; old saves keep their
  records, nothing reads them). Grandma's TIPS (advice lines) stay.
- **First run:** a new game starts with **$10.00** (was $0), lands on the **Kitchen** after the intro, and a
  hand points at the **Market** (`INGREDIENT_STOCK_FIRST_LEVEL` = 1; Market and Inventory open at Level 1). In the
  Market a banner and a hand point at the first plan item (plan starts on "Today"); the player buys Level 1's food
  (under $1) with their own money, goes back, taps Prepare. The chef knife and walnut board are owned from the start
  ($0 items), so the hint says so instead of asking for a purchase. Browser: `tools/e2e/firstshop.mjs` (7/7).
- **Level pay re-plan** (`curatedRewardAt`): $50 at Level 1, +$40 a level to Level 40, then +$6 (finale keeps
  $5,000). Frozen baseline re-recorded: revenue 69,925 · completion 245,138 · COGS 16,604 · quality 1,415 · net
  299,874. The completionist now ends ≈ $292k (target ≥ $150k); a kitchen-focused player affords the $60,000 first
  tier around Level 44; by Level 30 a player has earned ≈ $32k. Kitchen prices (restaurant build): Growing $60,000,
  Established $12,000, Neighborhood Café $18,000 — they are in `RESTAURANT_INVESTMENT_RULES.kitchenPrices` (the
  catalog in `kitchenUpgradeDefinitions` matches). NOTE the ladder is not ascending (a tier needs the one before).
- **Cleaning and supplies:** tasks short of a supply or tool never count toward the hygiene penalty
  (`lastStart.cleaning` ignores them); a fully clean start tips ×1.25 (`CLEAN_TIP_SHARE`), a dirty one ×0.5. The guide
  has a "You're out of cleaning supplies → Market" step and early purchase goals (a better knife, board, the
  Blacksmith) so there is always a next thing to do through Level 30.
- **Saves:** `SaveManager.save` is a serialized, coalescing queue (never overlapping, never out of order; a swept
  order = 2 writes, not ~10).
- **Removed dead code:** the old Level 2 practice branch and recipe (`camp-level2-basics-tutorial`),
  `campaignNoEconomy`, unused wrappers in `Buttons.tsx` / `modals/index.tsx`, three unused exports. KEPT on purpose:
  the 46 recipes only the 250-level source catalog uses (old-save migration and audit; 3 are oven trays) and the
  three modules tests import (`recipeDefinitions`, `cuisineDefinitions`, `testRecipePool`).
- QA: `pending-cash-qa` (Q: saves), `night-sync-qa` (B: supplies, clean bonus), `restaurant-guide-qa` (early goals).

## Deep check, 2026-10-30 (no game change except the Serve button label)

- Core loop verified in a real browser (`tools/e2e/cashflow.mjs`, 5/5): Serve books nothing; the table
  cash is swept in (10 pieces, 10 ledger entries for one $127 order); wallet = signed ledger; Finish
  Level waits for the cash and then completes once.
- The Serve button's label must stay `Serve to <name>` (the harness and most e2e find it with
  `/^Serve to /`); a "✅" prefix broke them and was removed.
- Stale because the money now arrives when swept, not at Serve (need a swipe step): `levelflow.mjs`,
  `servicefloor.mjs` F3/F4, `walkins.mjs`, `resize.mjs` 2a/2b, `phase2.mjs`. `restaurantcleanliness.mjs`
  5 still expects the Cleanliness tab to open at L11 (now L5).

## Restaurant Guide: what to do next, and why (2026-10-29, `main`)

- Developer 2026-10-29: the game felt like cutting and serving only. `restaurant/restaurantGuide.ts`
  is a list of rules read from the save and level; the Kitchen shows the first applicable step as one
  card (`GuideCard.tsx`, "🎯 Next step": why + a button to the section) at a calm moment, at most once
  per level. Steps: achievement rewards waiting / how achievements work (L6), the 2nd floor → buy a
  machine → hire a Floor Server (L5+), required and first staff, kitchen tier (once a third is saved),
  fridge nearly full, a Cleaner when cleaning piles up, a supplier contract, and the city ranking
  ("#N of 50, X reputation to pass …", L8+). A step is done when its rule stops applying. Later /
  Show me write `business.guideSeen` ("id@level", optional field): not offered again for 10 levels
  (one-off intros never). No money, no ledger, no randomness. QA `restaurant-guide-qa` (new); browser `tools/e2e/guide.mjs` (8/8).

## Cleaning and the night chores from Level 5, night and morning in sync (2026-10-29, `main`)

- Developer 2026-10-29: the whole cleaning system starts at **Level 5** (`CLEANING_FROM_LEVEL`,
  `PHASE_CHORES_FROM`, Grandma's cupboard, the day's opening card and Closing Time via
  `DAY_CEREMONY_FROM_LEVEL`). The night's chores hold the next day until done (a chore short of a
  supply is "blocked" and never holds it). The freshness clock and spoilage still start later.
- The night covers the day (`CLOSING_COVERS`), **nothing is deleted** (developer 2026-10-29: players like
  cleaning): every leftover task stays on the list. Doing a night chore also cleans, in the same pass, the
  day's leftovers of its kind (mop-all: floor, restroom floor, spill; restroom disinfect: toilet and the lull's
  restroom refresh; clear-and-reset: tables; degrease: grease, equipment; wipe-down: the lull's sweep and
  sanitizer bucket), all counted as cleaned. The morning restroom check stays but only comes when the
  night's restroom pass was not done; the morning is otherwise setup (stations, tables).
- Hygiene penalty: a service started with cleaning undone (`lastStart.cleaning`, not the morning's
  setup) tips half (`tipHygieneShare`, `tipAfterHygiene`, both serve paths in `App.tsx`).
- QA `night-sync-qa` (new); `restaurant-cleanliness-qa`, `restaurant-shift-chores-qa`,
  `restaurant-day-qa` O4 and `restaurant-first-levels-qa` D1/D2 updated to the new rule.
  Still failing from before (the 148-level change, not cleaning): `restaurant-day-qa` S1,
  `restaurant-first-levels-qa` E1, `restaurant-par-audit-qa` D1.

## v1.5.1: cash piled beside the seats (2026-10-26, `main`)

- The table cash is banded bundles of green bills piled beside the chairs (gold band = tip),
  one pile by each member's place in a party, with a sparkle, gold chevrons, a pointing hand
  and a "Swipe to collect" label (developer's reference picture). Display only; the money is
  still booked once at Serve. `servicefloorstages.mjs` now measures the member with the
  bubble (it measured the last person drawn, which fails for a party).
- **Stale e2e (documented, not removed):** `phase2.mjs` B2–B6, C1 and the `cash-auto` step
  test the counter cash tray and the old tip rule; in the restaurant build the cash is on the
  table (covered by `servicefloor.mjs` and the play-through). Its `expectedTip` follows the
  new 15 % rule. Needs a rewrite for v1.5.

## v1.5.0: parties, cash on the table, tips with every payment (2026-10-26, `main`)

- A service's customers arrive as a party of 1–4 at one table (deterministic, mostly pairs),
  each showing their order; the next member is already seated. After Serve the pay and tip lie
  on the table as cash to swipe or vacuum in (booked once at Serve; the pile is display). Every
  first-paid order tips by grade (Masterful 15 %, Clean 10 %, Honest 5 %). No save field.
  Report `docs/reports/PARTIES-TABLECASH-2026-10-26.md`.

## Early game, release candidate: $0 start, Second Floor and kitchen review (2026-10-26, branch `claude/early-game-unlocks`)

- A new save starts with **$0** (`DEFAULT_SAVE.credits`, was $1,240; developer 2026-10-26).
  Old saves keep their wallet. Completionist L150 $130,478, saver $266,442, prudent $131,426.
- Second Floor station panel: shows "need $X more" and that a machine earns only with a Floor
  Server. No price changed: the first knife / board / Coffee machine is affordable by ~L5–7,
  the $16k Growing Kitchen by ~L36 for a saver. Report
  `docs/reports/EARLYGAME-RC-2026-10-26.md`.
- Release gate: Second Floor audited (no change). Coffee + server = $60 per 8 h; a player who
  reinvests the floor often can end L150 well above the band — developer decision (report §9,
  `scripts/second-floor-early-sim.mts`). $0 start played L1–5 in the browser.

## Early game, phase 4: everything by Level 5, paid staff hires (2026-10-26, branch `claude/early-game-unlocks`)

- Every knife, board, kitchen tier, kitchen helper, staff role, specialist chef, Second Floor
  station, map room and the Progress section is for sale / open by L5 (`EARLY_UNLOCK_CAP`);
  prices unchanged. Every restaurant hire pays 3 days' wage once ($84–$210, one
  `staff-purchase` entry); a required hire short of money goes on supplier credit. Completionist
  L150 $132,916. QA `staff-hire-qa`; browser `paidstaff.mjs`; report
  `docs/reports/EARLYGAME-PHASE4-2026-10-26.md`.

## Early game, phase 3: walk-in customers from Level 5 (2026-10-26, branch `claude/early-game-walkins`)

- One walk-in per service from L5, after the menu guests, within the team's capacity; same
  serve, payment (one `business-revenue` entry) and count (`levelProgress.menuGuests`; no
  save field). It never takes the stock the next level's own orders need, and says what is
  short. Completionist L150 $134,203 (+$1,994; 109 walk-ins). QA `walkin-qa`; browser
  `walkins.mjs`; report `docs/reports/EARLYGAME-PHASE3-2026-10-26.md`.

## Early game, phase 2: the menu and menu guests from Level 5 (2026-10-25, branch `claude/early-game`)

- `BUSINESS_MENU_FIRST_LEVEL` 11 → 5: the menu, Business and 1 menu guest per service open at
  L5 (Garlic Bread; 4 dishes from L6, the old six by L9). From L11 the dishes and guest counts
  are as before; their order moved, so seeded guests pick another dish at 28 levels.
  Completionist L150 $132,209 (+$142). QA `early-menu-qa` + 8 suites' pinned levels updated;
  browser `earlymenu.mjs`; report `docs/reports/EARLYGAME-PHASE2-2026-10-25.md`.

## Early game, phase 1: Level 2 pays $0, and says so (2026-10-25, branch `claude/early-game`)

- The practice level's card read "about +$130" though it never pays; it now reads "$0.00".
  The campaign simulator also stopped paying it (−$138 for a saver; the completionist's L150
  is $132,067, inside the band). QA `restaurant-measures-qa` A1b; browser `practicepay.mjs`;
  report `docs/reports/EARLYGAME-PHASE1-2026-10-25.md`.

## Oven for the four baguette dishes (2026-10-25, work branch)

- Transformation Phase E. Avocado Baguette Toast (L47), Baguette Rounds, Baguette & Cheddar
  Rounds and Baguette Crostini Prep bake in the oven on a 🥖 tray (`trayItemFor`). Still
  cosmetic. The last three are on no level, menu or Business dish today. QA
  `oven-step-qa`; browser `ovenbaguette.mjs` (dev server); report
  `docs/reports/TRANSFORMATION-PHASEE-2026-10-25.md`.

## Oven for five more bread dishes (2026-10-25, `main`)

- Transformation Phase D. Tomato Basil Toast (L6), Mushroom Bruschetta (L7), Bruschetta for
  the House (L12), Family Antipasto for Two (L15) and Bruschetta Trio (L17) now bake in the
  Garlic Bread oven after the cut. Still cosmetic: score, grade, tips and pay unchanged.
  Baguette dishes: Phase E. QA `oven-step-qa`; browser
  `ovenrecipes.mjs`; report `docs/reports/TRANSFORMATION-PHASED-2026-10-25.md`.

## Kitchen next-upgrade strip (2026-10-25, `main`)

- The Kitchen shows the next kitchen tier not yet built: its existing price, its level
  lock, and the wallet's progress. A tap opens Kitchen Upgrades. Read-only: no new price,
  reward or save field. QA `next-kitchen-strip-qa`; browser `kitchenstrip.mjs`. Oven reuse
  audit: report `TRANSFORMATION-PHASEC-2026-10-25.md` (5 bread recipes can reuse it as
  is; none added).

## Interactive oven for Garlic Bread (2026-10-25, `main`)

- Transformation Phase C, Feature A. After the cut, Garlic Bread goes into the oven: the
  bread bakes and the player takes it out in the golden window. It shows a line only; the
  score and pay are unchanged. Other recipes keep the cooking film. Feature B (early
  restoration) was audited only: it needs new prices and art (decision pending). QA
  `oven-step-qa`; browser `ovenstep.mjs`; report
  `docs/reports/TRANSFORMATION-PHASEC-2026-10-25.md`.

## Service floor: the customer walks in, sits, gets the plate (2026-10-25, `main`)

- Transformation Phase B, slice 1. Each service order opens on the dining room: the
  customer walks in, sits and shows their real order. After Serve, the plate reaches
  their table and their face follows the grade; the previous customer walks out as the
  next one arrives. Presentation only: no save field, no money path, and the Business
  Day still runs only after Level 150 (decision pending). REFERENCE §10 "The service
  floor"; QA `service-floor-qa`; report `docs/reports/TRANSFORMATION-PHASEB-2026-10-25.md`.

## Night chores in Cleanliness; no board Skip; calmer dry splashes (2026-10-24, `main`)

- The night chores are Cleanliness closing tasks (boards, spoiled food, fridge wrap,
  dining reset, degrease, mop, disinfect …): in Restaurant → Cleanliness ("🌙 Tonight")
  and on Closing Time, cleaned in the same cleaning game (`CleaningGame.tsx`); the
  dishes and the till stay Closing Time's rows. REFERENCE §5 `closing-chores-qa`.
- The board cloth has no Skip. Dry ingredients barely splash; the splash scales with
  juiciness; a Golden Tomato bleeds gold. QA `phase2-qa` A12/A26, `knife-feel-qa` D1.

## The knife's feel (2026-10-24, `main`)

- Matched to the developer's reference board: motion trail, an impact splash of juice
  and seeds, a glint with a flare, juice beads that slide with a streak, a glowing
  blade with embers by combo (×5/×10/×15), lens-flare stars, a flash and the steel's
  ring on the last cut; short haptics. REFERENCE §10 "The knife's feel"; QA
  `knife-feel-qa` (R1–R5 for the reference).

## Random stains, every ingredient, wipe every corner (2026-10-24, `main`)

- Each session and each fresh ingredient stains differently (seeded per session,
  `newIngredientBatch`); all 54 ingredients have their own leftovers and liquid; a
  film over the whole board must be wiped corner to corner (hint ring on missed
  spots). REFERENCE §10 "Cleaning cloth…"; QA `phase2-qa` A15c/A15d, A22–A25.

## Realistic board mess and the cleaning cloth (2026-10-24, `main`)

- Cutting leaves realistic scraps (diced cubes, seeds, peel, leaves, crumbs) and
  juicy ingredients spill merged juice pools and drops at the cut. The board is
  cleaned with a folded towel over several strokes (sparkles, scrub sound,
  progress bar, polish); the next ingredient waits off the board until it's clean.
  REFERENCE §10 "Cleaning cloth…"; QA `phase2-qa` A15–A21.

## Closing chores are the player's (2026-10-23, `main`)

- Closing Time's chores each have a button (wash up opens the sink game); "Close for
  the night" stays locked until they're done. A Cleaner on duty does all but the count
  and washes the sink by hand. Economy unchanged. REFERENCE §5 `closing-chores-qa`.

## Dishwashing as a feature: realistic dirt, satisfying sink (2026-10-23, `main`)

- Cleanliness has a Dishwashing card (under today's status). The sink game paints
  realistic, per-piece dirt (`restaurant/dishDirt.ts`, seeded) and reuses the rooms'
  feel engine: suds, wet scrub, sparkles, combo, shine + squeak, drying rack, summary.
  REFERENCE §10 "The sink"; QA `dish-washing-qa` R1–R7.

## Dishwashing back: the sink (2026-10-23, `main`)

- A service's dishes wait in the sink; wash them by hand in the sink game (soap, nothing
  breaks, no money) from Cleanliness, the Pre-Service Check or Closing Time, or they're
  washed automatically at the next START (breakage as before). Spotless now judges what
  was dirty at a service's START. REFERENCE §10 Cleanliness "The sink"; QA
  `dish-washing-qa`, browser `dishwashing.mjs`.

## Images halved (2026-10-23, `main`)

- 109 of 126 images re-encoded smaller (20.5 → 10.6 MB; dist 29 → 19 MB), names and
  formats unchanged. Budget for new art: REFERENCE §10 "Image size budget".
- Open, pre-existing (fails on `main` before this change too): `lazyload.mjs` check 2 — the
  "Opening the restaurant…" state no longer shows; the chunk seems to be ready before
  the Restaurant tab is tapped. Not investigated yet.

## Staff cards fixed (2026-10-23, `main`)

- Staff cards no longer overlap on desktop: one kit (`business/StaffCard.tsx`) sized by
  the card's own width (container queries), like the developer's reference. REFERENCE §10
  "Staff portraits and roster cards".

## Pre-Service Check rows unified (2026-10-23, `main`)

- Tools, supplies, bottles and ingredients share one card-row look; staff are portrait
  tiles; long lists are chips. Fixed: a button inside a button (menu guests' ⓘ) and the
  40 px menu-guests toggle. The e2e suites follow 613d3a4's new button labels.
  REFERENCE §10 "Glance copy".

## Pre-Service Check visual refresh (2026-10-23)

- The check uses compact ticket cards, icon-led status rows, and folded ready-stock amounts
  so missing items and the start action are easier to spot. Optional menu-guest stock is
  folded until opened; expanded details and every existing restock / hire / clean action
  remain available. No service, inventory, or economy rules changed.
- UI: `components/kc/restaurant/PreServiceCheck.tsx`, `SupplyBottle.tsx`. Details: REFERENCE
  §10 "Glance copy".

## Staff portraits and roster refresh (2026-10-23)

- Business → Staff now uses illustrated portraits for the six restaurant roles
  and four cuisine specialists, with a warmer roster summary, clearer hired / needed
  states, and larger hire controls. The Head Chef portrait is an older man. All
  gameplay, hiring, unlocks, wages and save data remain unchanged.
- Portrait assets: `public/business/staff-portraits/`; UI: `components/kc/business/BusinessStaff.tsx`.
  Details: REFERENCE §10 "Staff portraits and roster cards".

## Staff cards arranged in a grid (2026-10-23)

- The restaurant crew, specialist chefs, and Kitchen Upgrades now use two-column
  portrait cards. At phone width, portraits sit above the details for readable
  names, effects, prices, unlocks, and actions; at wider widths, they sit beside
  the details. Kitchen helpers reuse the matching generated staff portraits.
  Hiring and economy rules are unchanged.

## Inventory in pictures (2026-10-23, `main`)

- Inventory's Needs Attention, summaries, stock list and supplies are picture tiles
  (`kc/inventory/ItemTile.tsx`), fewer words and numbers, nothing removed (sentences in
  labels / the details sheet). REFERENCE §10 "Inventory in pictures".

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

## Phase 6: Kitchen Moment cards (2026-10-21; committed in 412f3bc)

- Four moments (Perfect Cut, Special Dish, New Personal Best, Customer
  Moment) from existing events; a quiet 📸 chip on the completion screen; a
  1080×1350 PNG card with Save image and (where supported) native Share. No
  storage, no network, no rewards. REFERENCE §10 "Kitchen Moment cards".
- QA `phase6-qa`; browser `tools/e2e/phase6.mjs`. Working tree only.

## Phase 5: restoration reveals, daily gift streak (2026-10-21; committed in 412f3bc)

- Building a kitchen tier now plays a short before-and-after of the existing
  painted kitchens (four restoration stages over the six tiers; skippable;
  Reduced Motion = instant). No tier, price or purchase rule changed.
- **New money (developer):** the daily gift's streak — Day 3 +$100, Day 7
  +$300, paid with that day's gift, once; a missed day restarts the streak.
  REFERENCE §7 "Gift streak rewards". The ledger keeps gift/streak entries 9
  days (their only record; no save field). A gift card on the Kitchen.
- QA `phase5-qa`; browser `tools/e2e/phase5.mjs`. Working tree only.

## Phase 4: signature dishes, special customers, order completion (2026-10-21; committed in 412f3bc)

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

## Phase 3: Fever Mode, Prep Rush, Kitchen Chaos, special variants (2026-10-21; committed in 412f3bc)

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

## Phase 2: bench scraper, money vacuum, serve celebration, tips (2026-10-21; committed in 412f3bc)

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

## Phase 1: cutting feel, combo, New Best (2026-10-21; committed in 412f3bc)

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

- Starting wallet $0 since 2026-10-26 (was $1,240.00, 124,000 cents). Levels 1–10 on a first run pay
  $667 in order settlements + $636 completion rewards (after the G2 fix).
- Intro timing: Part 1 7.6 s, Part 2 6.0 s, Part 3 7.9 s; measured live
  22.4 s including two prompt button presses; Skip closes in ~130 ms.
- Bundle impact of the story change: main JS +~0.4 KB gz, CSS +~0.2 KB gz.
- Tests run in headless Chrome only; no real-device test has been done yet.
