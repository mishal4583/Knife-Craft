# Delivery Inspection — "Spot the bad ones" (detailed plan + asset list)

Status: BUILT (2026-11-08) with the recommendations of §11; see HANDOFF for what shipped and what is open (no rewarded ad, no freshness top-up). Written after reading the code.
Developer idea 2026-11-08: turn the Prep Cook's chore "Unpack incoming food deliveries and check them for quality and freshness" into a mini-game: a crowded crate of MIXED produce, several hidden bad ingredients, a countdown; the player looks closely, searches behind other ingredients and recognises subtle defects (reference picture: `Delivery Inspection`, "Find 3 ingredients that are NOT FRESH", an Inspection Guide, a timer, "Deliveries 2/5").
Companion file with every Codex art prompt: `DELIVERY-INSPECTION-CODEX-PROMPTS-2026-11-08.md` (assets are saved to `D:\WORKS\GAMES\Knife Craft\Delivery Inspection Assets`; say if you want another folder).
Decisions the developer must make are in §11 (recommendation first); the plan assumes the recommendations.

**Short answers**
- **What is it?** A hidden-defect inspection. A delivery crate of 8–17 mixed ingredients (bigger and fewer than first planned: 8–22, changed 2026-11-08 after play-testing) is tipped onto the bench. N of them are not fresh (mold, wilt, rot, bruises, later tiny pest holes). Tap an ingredient to flag it NOT FRESH; drag ingredients aside to search behind them; a magnifier shows subtle defects. Find them all before the clock runs out. A wrong flag costs time and the combo.
- **Real data?** The ingredient pictures are the REAL ingredients of the delivery that arrived (the crate in `business.fridgeSort`, the morning's standing-order lines), padded with other produce the player owns. The defects are the game's own (no stock is ever really bad because of this game: see §3.5).
- **How is it different from Fridge Sort?** Fridge Sort is "where does it go" (placing, knowledge of the fridge). Delivery Inspection is "is it any good" (searching and looking: observation). Different verb (find, not place), different skill (eyes, not memory), different moment (the delivery just arrived, before it is unpacked).
- **How is it different from the planned Fridge Check?** Fridge Check (plan 2026-11-06) is the closing-night SWIPE over the real freshness of the stock (rule knowledge: shelf life). Delivery Inspection is the morning LOOK at a crate (visual search). They share the spoilage art (overlays, flies, wisps) so the cost of the second one is small.
- **Money or stock?** Never (same as Fridge Sort). Rewards are Hype, collectible pins and (optional, D3) a small freshness top-up. It is always optional and nothing waits on it.
- **Prep Cook?** A hired Prep Cook does the inspection by himself (the chore the idea names is his), silently, with no stars and no reward, exactly like the other chores he takes over. The game is the player's hands-on version.
- **Art?** 9 new image files (§9, Phase 1), plus an OPTIONAL set of 1–2 sheets ("spoiled twins", 24 produce drawn spoiled). Everything else is reused: the 57 ingredient pictures, the Fridge Sort HUD, star bar, result panel, the Prep Cook portrait, the Stockroom ribbons, puffs and sparkles.
- **How big?** About 8 working days (§10).

---

## 1. Why build it (the developer's goal is real revenue)

- A new kind of play (searching, "find the odd ones", the same pull as hidden-object games, the genre that keeps casual players for hours). Fridge Sort and Stockroom Sort are both sorting; Fridge Check is swiping. This is the first game of LOOKING, so the set stops feeling samey.
- It fills the dead moment right after a delivery arrives (the morning card says "🚚 arrived", then nothing happens until the player opens Fridge Sort).
- It is a natural place for a REWARDED AD that the player wants (§6.4: "+15 s" or "Show me one"), with no effect on progression.
- A daily limit (the reference's "Deliveries 2/5") gives a reason to come back every day.
- Cheap: the art kit is small and the rules are pure.

## 2. What the code does today (so nothing is invented)

- **Deliveries** (`restaurant/deliveries.ts`, `Deliveries.tsx`): two standing orders (Fresh every 2 days, Weekly on Mondays) worked out at closing and delivered with the morning at the Market's price (`deliveredToday`, `DeliveryRecord.lines`). The morning card lists them read-only.
- **The crate to unpack** (`business/fridgeSort.ts`): `addToCrate` (the one place that fills it: an ingredient purchase and the morning delivery) puts loose pieces in `business.fridgeSort.crate` (+`counts`). `piecesWaiting(save)` is what the "📦 Unpack delivery · N" chip counts (`FridgeSortChip`, shown in the Market's Ingredients tab, above the Inventory fridge and as an after-serve chip `afterServe.ts`). `roundFor` / `basketsLeft` cut the crate into baskets. Fridge Sort opens from Level 3 and has five difficulty tiers (`DIFFICULTY`: from Levels 3 / 14 / 27 / 44 / 74).
- **Rewards of the sibling game**: stars → Hype (`addHype`, the Second Floor's Rush meter), magnets (12, one per 3 perfect rounds), and `freshenStock` (a good round moves `purchaseDay` of the sorted stock, so it lasts longer). Never credits, never a ledger entry.
- **Freshness** (`perishabilityStateFor`): FRESH / AGING / NEAR_EXPIRY / EXPIRED by category shelf life (Protein 3, Herb 3, Dairy 4, Bakery 5, Fruit 6, Vegetable 7, Aromatic 12 days). Stock is one aggregate entry per ingredient, not per piece.
- **Prep Cook** (`prepCookAuto.ts`, `staffRequirements.ts`, `cleanliness.ts`): hired by the player; cuts orders from Level 30, takes over the closing chores (`staff: "prep-cook"`). Nothing about deliveries yet.
- **Shared mini-game kit** (`inventory/sort/SortParts.tsx`, `sortUtils.ts`): HUD, star bar, result frame, buttons, the pointer hand, the pause card. The Stockroom Sort and Fridge Sort screens are `ScreenId`s.

## 3. How it fits the main game

### 3.1 Where it opens
- A chip **"🔍 Inspect delivery · N"** next to "📦 Unpack delivery · N" (Market → Ingredients, above the Inventory fridge). N = the inspections waiting today (§3.3). It is a small chip, never a popup. The after-serve chips are capped at three and keep "Unpack delivery"; the Inspect chip does not go there (D1).
- Inspecting first and unpacking second is the natural order, but neither needs the other. "Unpack delivery" never waits on an inspection.
- A hired **Prep Cook** removes the chip (he inspected it this morning).

### 3.2 When
- From the first level where deliveries exist AND Fridge Sort is open (Level 3 for bought food; standing orders from `DELIVERIES_FROM`). Tiers follow the Fridge Sort table (levels 3 / 14 / 27 / 44 / 74) so the two games grow together.

### 3.3 How many a day (the reference's "Deliveries 2/5")
- One **inspection round per crate basket** that arrived (`basketsLeft`), at most **5 a day**; the counter "Deliveries 2/5" is rounds done today / rounds available today (not the cap, when fewer arrived). A day with no delivery has none. State `lastDay` resets the day count. Nothing is lost when the player skips: the rounds just expire at the next morning (no penalty).

### 3.4 What is in the crate (real, mixed)
- Pictures: the ingredients of the arrived basket first (real names, the player recognises their own delivery), padded to the tier's item count with other produce the player already owns (`ownedIngredients`), then any unlocked produce. Seeded by day and round (no `Math.random()`), so a replay of the same round is the same crate.
- Only things a defect can be drawn on: produce, mushrooms, herbs, plus bread and cheese from tier 3 (mold). Meat and fish are NOT in the crate (they come cold-packed; spoilage there belongs to Fridge Check).
- Each item gets: a position in the crate (3 depth layers), a tilt, a size, and its defect (none, one of the real defects, or a harmless natural mark: see 4.3).

### 3.5 Consequences are never real
- Flagging, missing or mis-flagging changes nothing in stock, credits, ledger or the calendar. The only effects are points, stars, Hype and pins (and the optional D3 top-up). A found "bad" ingredient is NOT removed from the player's stock: it is a game crate (the same stance as Fridge Sort).

## 4. How the game plays

### 4.1 The screen (portrait 540 × 960)
- Top: the title sign "Delivery Inspection", the clock (a ring with seconds), the pause button, the Level chip. Under it the goal line "Find 3 ingredients that are NOT FRESH" (the number is the round's).
- Middle: the open crate (back layer, the ingredients, front layer) on the receiving bench.
- Bottom: 3–6 round slots (one per defect, filled with a mini stamp as they are found), the "Deliveries 2/5" tag, the Magnifier button (tier 3+), the guide "?" button.
- The Prep Cook's round portrait watches from the lower left with a speech line ("Look behind the big ones!"), reusing `staff-portraits/prep-cook.webp`.
- The **Inspection Guide** (the reference's clipboard) opens from "?" (and shows by itself on the first round): three rows, picture + name: Moldy / Rotten · Wilted / Spoiled · Bruised / Bad spots (later: Pests). It is an overlay, so the crate keeps its full width in portrait.

### 4.2 The verbs
- **Tap an ingredient = flag it NOT FRESH.** Right: a red stamp thumps on it, a slot fills, the combo grows, the item is marked and stays in the crate (so the player can still see it). Wrong (it is fine): the item shakes, "This one is fine!" for a second, −4 s on the clock, the combo resets, no stamp. Tapping a stamped item again does nothing.
- **Drag an ingredient = slide it aside** (the crate is a pile, so things can be moved, to a limit: they stay inside the crate and settle on the layer they were dragged to). This is how "search behind other ingredients" works; no special mode. A drag under ~10 px counts as a tap.
- **Magnifier** (tier 3+, 3 uses a round): press-and-hold anywhere to show a round lens that magnifies 2× under the finger and reveals the subtle defects (tiny mold, pest holes) at full detail. Without it tiers 1–2 are fully readable at normal size.
- **Guide hint** (tier 1–2 only): after 12 s with nothing found, the nearest unfound defect pulses softly (a gentle help for beginners; off from tier 3).
- Keyboard / accessibility: Tab through the items, Enter flags, arrow keys + Shift move one aside; the magnifier is a toggle button for mouse players. Reduced motion = no shake, no stamp fly, no pulse.

### 4.3 The defects (what the player learns to see)
| Defect | Look | Where it starts |
|---|---|---|
| Mold | fuzzy white / green-blue / grey patches | tier 1 |
| Wilt / spoiled | yellow-brown limp edges, dull colour (leaves, herbs) | tier 1 |
| Rot | dark, wet, collapsed soft patch | tier 1 |
| Bruise / bad spots | brown or purple-grey dents, black speckles | tier 2 |
| Slime | glossy wet sheen with a drip | tier 3 |
| Pests | tiny holes with dark specks | tier 4 |
| Dry shrivel | cracked, wrinkled skin | tier 4 |
- **Harmless natural marks (decoys)** from tier 3: soil smudges, a water drop, a little scuff, freckles, a sun patch. They must NEVER be flagged. They are what makes "recognise subtle defects" a real skill instead of "click anything odd". The guide shows one decoy ("a little soil is fine").
- Colour is never the only cue (shape + texture + guide), for colour-blind players.

### 4.4 Tiers (the exact levels are `DIFFICULTY.from` of Fridge Sort, read at build time)
| Tier | From | Items | Defects | Hidden | Decoys | Defect size | Clock | Help |
|---|---|---|---|---|---|---|---|---|
| 1 First look | L3 | 8–9 | 2 | none (no overlap on the bad ones) | 0 | big | 60 s | pulse hint, guide open |
| 2 Sharp eyes | L14 | 10 | 3 | 1 partly behind | 0 | medium | 55 s | pulse hint |
| 3 Behind the pile | L27 | 12 | 3–4 | 1 fully under another | 2 | medium + small | 50 s | magnifier ×3 |
| 4 Inspector | L44 | 14 | 4–5 | 2 fully hidden | 4 | small, pests | 45 s | magnifier ×3 |
| 5 Head inspector | L74 | 17 | 5–6 | 3 hidden | 6 | tiny | 45 s | magnifier ×2 |
- Item pictures are drawn about 64 px at 540 wide (never below 56 px, so touch ≥ 48 px holds after the overlap).
- **Fairness guarantees** (tested): every defect is findable (its visible area ≥ 25 % at the start, or ≥ 60 % after moving ONE item aside); the layout never hides a defect behind a defect; decoys never sit on the same item as a defect; the sum of the clock is long enough for a flawless player at ~4.5 s per defect.

### 4.5 Stars, points and the result
- Points: 100 per defect found × combo (×1.25 per find in a row, max ×3, like the sorting games), a time bonus of 20 per second left, 0 for a wrong flag (and the combo resets).
- Stars (the same `STAR_AT` shape as Fridge Sort, 0.5 / 0.74 / 0.92 of the best possible): 3 stars = all found, no wrong flags, with time to spare; the round ends the moment the last defect is found, or when the clock reaches 0 (then only what was found counts: 0–2 stars).
- Result board (the shared `result-panel`): stars, score, "found 4 of 5", Hype, a pin when earned, and a short reveal of the ones missed (they pulse and get their label, so the lesson is free).
- Next round button when another delivery is waiting; "Unpack delivery" button (the Fridge Sort chip's target).

## 5. Rewards (never money, never stock)

- **Hype:** the shared `HYPE_BY_STARS` (0 / 5 / 10 / 15), once per round; the daily five can all pay; practice and the Prep Cook give none.
- **Collectibles:** 12 "Sharp Eye" pins (one per 3 three-star rounds), shown beside the fridge magnets in Inventory and on the result board.
- **Streak of perfect rounds** (display only).
- **D3 (option):** a 3-star round freshens that delivery's stock by one day, like Fridge Sort's `freshenStock` (it touches `purchaseDay`, so it touches the freshness economy tests). Recommended OFF in the base plan; add it after the sim says it is safe.
- **No effect on the economy:** no credits, no ledger, no inventory quantities.

### 5.1 The optional rewarded ad (D5)
- One placement `delivery_inspection_time`: "Watch an ad: +15 seconds" offered once per round when the clock is under 10 s (or "Show me one" on the result board's retry). Granted only on the `rewarded` state, daily cap (e.g. 5), says what it gives before the ad, never needed to progress, pays nothing in money (no ledger entry: a time bonus; see the ad rules in CLAUDE §2, `ads/adBonuses.ts`). Developer's yes needed before it is built.

## 6. Making it clear (lessons from the Fridge Sort and Stockroom Sort feedback)

- A how-to card shows by itself until the first round is finished and from a visible "?" button: 4 icon steps (a crate of food / tap the bad ones / drag things aside / the guide).
- A pointing hand and a ghost drag on the first round (move the big lettuce, find the moldy tomato behind it).
- Round 1 is tiny (8 items, 2 big defects, no hiding), and a wrong flag explains itself in one line.
- Short copy: icons and numbers on screen; longer words behind an ⓘ (`ui-copy-qa`).
- The goal line always says how many are left to find.

## 7. Technical plan (reuse, never duplicate)

New, pure first:
- `src/game/business/deliveryInspection.ts` — rules only: `INSPECTION_TIERS` (from `DIFFICULTY`), `inspectionRoundsToday(save, level, day)`, `crateFor(save, level, day, roundIndex)` (the seeded layout: ingredient, x, y, layer, tilt, size, defect/decoy kind and variant), `visibleShare`, `flagVerdict`, `scoreRound`, `starsFor`, `hypeFor`. No Math.random, no I/O, no money.
- State `business.deliveryInspection` (extends `business`, nested migration in `SaveManager`, NO new top-level save field): `{ day, done, best, stars, perfect, pins, streak }`. Absent on old saves.
- `src/components/kc/inventory/DeliveryInspectionGame.tsx` (a `ScreenId` "delivery-inspection", lazy like Fridge Sort), the chip `DeliveryInspectionChip.tsx`, the shared look from `inventory/sort/SortParts.tsx`.
- Prep Cook: `deliveryInspection.ts` `prepCookInspects(hiredRoles)` removes the chip.
- Analytics through `sendAnalyticsEvent`: `delivery_inspection_started / finished (stars, found, wrong, seconds) / skipped / ad_time`.
- Art pipeline: a build step `scripts/make-inspection-assets.py` (cut by shape, WebP, budget ≤ 450 KB for the kit; the optional twins lazy-loaded).

Rules kept: seeded generator only; whole numbers; old saves work; touch targets ≥ 48 px; text sizes per CLAUDE §10; reduced motion; no external requests; CSS transform/opacity only (no animation library); never touches credits, inventory quantities or the ledger; Bridge/analytics only through PlayablesSDK; synthesized sounds only (`AudioManager`: a stamp thump, a wrong "bonk", a find chime: three new named effects).

Tests: `scripts/delivery-inspection-qa.mts` (the crate is the real delivery + padded produce, seeded, tiers, fairness guarantees (visibility), no defect behind a defect, decoys never on defects, scoring and stars, rounds per day and the cap, Prep Cook removes the chip, finishing leaves credits / inventory / ledger identical, old saves, no randomness in the file); e2e `tools/e2e/deliveryinspection.mjs` (chip → game → flag → drag → result → unpack; 320 / 390 / 768 px; reduced motion); `ui-copy-qa`, `lazy-load-qa` and `audio-qa` extended.

## 8. Difficulty tuning needs a measure first
- Before locking the clocks, a script plays the generator with simulated players (perfect, average, sloppy) and reports stars per tier, like the Fridge Sort table (`fridge-sort-qa H`). The numbers in §4.4 are the first guess.

## 9. Assets: what exists, what is needed

### 9.1 Already in the repo (reused, not regenerated)
| Need | Existing piece |
|---|---|
| The 57 ingredient pictures (fresh) | `public/business/ingredients/<id>.webp` (`IngredientIcon`) |
| HUD plaques, pause button, round clock face, star bar, stars, result panel | `public/business/fridge-sort/` (`hud-*`, `starbar-*`, `star-*`, `result-panel`) |
| The Prep Cook (round portrait) | `public/business/staff-portraits/prep-cook.webp` |
| Ribbons, sparkles, dust puffs, the stamp ring, enamel pin look | `public/business/stockroom/` (`ribbon-*`, `spark-*`, `puff-*`, `stamp`, `badge-*`) |
| The tutorial hand, buttons, sounds | `PointerHand`, `SortButton`, `AudioManager` (synth) |
| Flies, stink wisps, drips | planned for Fridge Check (C09); if Fridge Check is built first they are reused, otherwise made here (§D08) and shared |

### 9.2 New and needed (Phase 1, 9 files)
| Id | What | Why it cannot be reused | Size |
|---|---|---|---|
| D01 | Backdrop: the receiving bench at the back door, portrait (shelves, a hand truck, a window with a morning light, an empty wooden bench top) | the sorting rooms are fridge and stockroom; a receiving corner says "a delivery just arrived" | 1080×1920 |
| D02 | The open delivery crate, BACK layer (inside walls and paper liner, empty) | the pile sits inside it | 1000×520 |
| D03 | The same crate, FRONT layer (front wall and corners, a blank emblem plate) | the front wall must hide the bottom of the pile | 1000×300 |
| D04 | 12 defect overlays (mold ×4, rot ×2, bruise ×2, wilt ×1, slime ×1, pest holes ×1, dry shrivel ×1) | makes ANY of the produce pictures look spoiled | sheet 4×3 of 256 |
| D05 | 6 harmless natural marks (decoys): soil smudge, water drop, little scuff, freckles, sun patch, leaf speck | the "recognise subtle defects" skill needs fair look-alikes | sheet 3×2 of 256 |
| D06 | Markers: a red rubber stamp mark (blank, to overlay "NOT FRESH" in code), a red "wrong" cross, a chalk ring (found), a green tick | the feedback on an item | sheet 2×2 of 256 |
| D07 | The magnifying glass: brass rim, a handle, a transparent glass centre | the lens | 512×512 |
| D08 | Spoilage life: 3 flies, 2 stink wisps, 1 drip (shared with Fridge Check C09) | a spoiled item should feel alive and slightly gross | sheet 3×2 of 256 |
| D09 | The clipboard "Inspection Guide": a blank clipboard, three blank picture windows, three blank label strips, one "decoy" window | the guide overlay | 480×680 |
| D10 | 12 collectible "Sharp Eye" enamel pins | the reward | sheet 4×3 of 256 |

### 9.3 Optional (Phase 2, recommended): "spoiled twins", 1–2 sheets
Overlays on a CSS-dulled picture work, but a rotten tomato does not look like a rotten lettuce. One sheet of 24 produce drawn SPOILED (tomato, lettuce, potato, onion, pepper, carrot, cucumber, mushroom, garlic, apple, strawberry, lemon, orange, pear, peach, avocado, zucchini, eggplant, cabbage, broccoli, spinach, parsley, basil, cauliflower), in the same pose and framing as the fresh pictures, so a defect is the "twin" itself (a stronger, more natural defect; overlays stay for small ones). A second sheet for bread and cheese with mold. Not needed to ship.

Not needed: a new character (the Prep Cook portrait), new HUD, new stars, new fonts, a new result board, sound files (synth), a drag arrow (CSS).

## 10. Phases and estimate

1. **Rules + QA** (2 d): `deliveryInspection.ts` (the seeded layout with the fairness guarantees, tiers, scoring), the state and its migration, `delivery-inspection-qa`, the simulated-player tuning script.
2. **Screen** (3 d): the crate, tap / drag / magnifier, stamps, the slots, the clock, the guide overlay, how-to card and hand, the result board, sounds, reduced motion.
3. **Wiring** (1 d): `ScreenId`, the chip (Market, Inventory), the Prep Cook, the rounds per day, analytics, lazy chunk.
4. **Art wiring** (1 d): the build step (cut, WebP), art QA.
5. **Playtest and tune** (1 d): e2e, screenshots at 320 × 568 / 360 × 640 / 390 × 844 / 430 × 900 / 768 × 1024, then the developer's real-phone pass (drag vs tap precision is the thing to feel).

## 11. Decisions for the developer (recommendation first)

- **D1. Where is the entry?** (Recommended) Its own chip "🔍 Inspect delivery" beside "Unpack delivery" (Market, Inventory); not an after-serve chip. (Option) one combined flow: "Unpack delivery" starts with the inspection and then Fridge Sort, with Skip.
- **D2. Real effect?** (Recommended) None: Hype and pins only. (Option D3) a 3-star round freshens the stock by one day (touches the freshness economy tests).
- **D3.** (see D2) the freshness top-up.
- **D4. How many a day?** (Recommended) one round per arrived basket, at most 5 a day ("Deliveries 2/5"). (Option) unlimited practice after the five, with no reward.
- **D5. A rewarded ad?** (Recommended) Yes, one placement ("+15 s" under 10 s left, daily cap 5), after your yes. (Option) none in the first release.
- **D6. Prep Cook?** (Recommended) He inspects for you (the chip goes away, no stars, no reward). (Option) he only halves the clock for you.
- **D7. Meat and fish in the crate?** (Recommended) No (they come cold-packed; spoilage there belongs to Fridge Check). (Option) add them from tier 4 with a grey-green "off" look.
- **D8. Name.** "Delivery Inspection" (recommended, the reference's name) or "Fresh or Not?".
- **D9. Spoiled twins (§9.3)?** (Recommended) Yes, as Phase 2 polish after the kit; ship Phase 1 with the overlays.
- **D10. Asset folder.** `D:\WORKS\GAMES\Knife Craft\Delivery Inspection Assets` (recommended).

## 12. Risks

- **Fat fingers on a crowded crate.** Mitigated by the 56 px minimum, hit-testing the top-most item whose pixels are visible, a small tap slop, the drag-aside verb and the magnifier; the real-phone pass decides the item counts.
- **Tap vs drag on touch.** A 10 px threshold, `touch-none` on the crate (like the sorting pieces), and the flag only on release, never on press.
- **Unfair hidden defects.** The generator's visibility guarantees are tested; a defect can never be unreachable.
- **A spoiled look that does not fit every ingredient.** Mitigated by the decoys (a clear difference between "bad" and "dirty") and the optional twins.
- **Overlap with Fridge Check.** They share the art and the Hype table but differ in verb and moment; if only one is built first, build this one (a new feel) and keep Fridge Check for the freshness lesson.
- **Tuning by simulation only**: a real-phone pass is still needed.
