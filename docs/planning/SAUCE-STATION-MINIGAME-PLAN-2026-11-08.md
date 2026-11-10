# Sauce Station — "Mix it, whisk it, bottle it" (detailed plan + asset list)

Status: BUILT (2026-11-09) with the recommended decisions; see the top of `docs/HANDOFF.md`. Written 2026-11-08 after reading the code (the plan below is unchanged).
Developer idea 2026-11-08: a mini-game on the theme of sauces. (1) Mixing sauces and emulsifying dressings: the player combines base ingredients until the mixture matches a target colour or consistency indicator. (2) Cleanly pouring sauces into bottles.
Companion file with EVERY Codex art prompt: `SAUCE-STATION-CODEX-PROMPTS-2026-11-08.md` (assets are saved to `D:\WORKS\GAMES\Knife Craft\Sauce Station Assets`; say if you want another folder).
Decisions the developer must make are in §13 (recommendation first); the plan assumes the recommendations.

**Short answers**
- **What is it?** A two-stage station. STAGE 1 "Mix": a sauce is ordered; pour pantry bottles into the bowl until the live colour matches the target swatch and the thickness gauge is in the green; for dressings, whisk (circle your finger) in the green speed zone so the oil and the acid emulsify (too fast or too slow breaks it). STAGE 2 "Bottle": the batch you made is poured into bottles on a belt: hold to pour, release at the fill line; a spill wastes sauce, and every bottle you fill is a bottle of "yield".
- **Real data?** The sauce asked for is a real sauce of today's dishes (salsas, chutneys, bases, dressings) and its ingredients are the real ones of the dish (tomato, onion, garlic, chilli, lemon, herbs, mango, pineapple, corn...) plus a free **pantry** of oils, vinegars, creams and spices that is game-only (the 57 ingredients have no oil, vinegar or cream: see §3). Nothing is taken from the stock.
- **Money or stock?** Never (the same stance as Fridge Sort and Delivery Inspection). Rewards are Hype, collectible Saucier pins, and a **Sauce Shelf**: 24 bottles to collect, one per sauce mastered with three stars.
- **When?** Opens at Level 7 since 2026-11-10 (was 23; the first "base" dishes: French Onion Base and Potato Velouté), and grows with the sauce dishes that follow (masala L31, chutney L33, salsa L40, two salsas L44). Decision D1.
- **Different from the other games?** Fridge Sort places (knowledge), Stockroom Sort matches 3, Fridge Check swipes (judgement), Delivery Inspection searches (eyes). This one MIXES and POURS: colour sense, a rhythm (the whisk) and a steady hand (the pour). New verbs, so the set stays fresh.
- **Art?** 38 new image files (§10; the plan has the full list and the companion file has every prompt). The liquids themselves are drawn in code from the mixed colour, so the art is the containers, tools, props and collection pieces. Everything else is reused (HUD, star bar, result panel, ribbons, hand, Prep Cook portrait).
- **How hard?** Medium. About 12-14 working days with the art in hand (§11). The two real risks are colour on different phone screens (and colour-blind players) and the feel of the whisk and the pour; both have a planned answer (§9).

---

## 1. Why build it (the developer's goal is real revenue)

- **A craft fantasy that fits the game.** The player already chops, fries, washes and stocks; sauces are the missing "chef" skill, and they are satisfying to watch (colour blends, swirls, a clean pour).
- **Collecting.** 24 sauces to master (three stars each) fill a Sauce Shelf: a long goal that keeps players coming back, like the fridge magnets and pins but bigger and more visible.
- **Daily loop.** A few rounds a day with a changing "sauce of the day" (the one today's menu needs), a streak of perfect rounds, and an optional rewarded "+1 scoop / show me the recipe" (never needed to progress).
- **Shareable moment.** A bottle that comes out the exact target colour is a nice screenshot.
- **Cheap compared with its pull**: the rules are pure math and the art kit is containers and props.

## 2. The design in one page

```
 STAGE 1  MIX                                   STAGE 2  BOTTLE
 +--------------------------+                   +--------------------------+
 | Tomato Salsa      ⏱ 0:48 |                   | 3 of 5 bottles   ⏱ 0:31  |
 | [target ▓▓▓] [live ▓▓▓]  |                   |   (jug)                  |
 | match 86%   thick ▮▮▮▯▯  |                   |   ╲ pour                 |
 |        ____              |                   |  ┌┐ ┌┐ ┌┐ ┌┐              |
 |   whisk /    \ bowl      |                   |  ││ ││ ││ ││  ← belt     |
 | 🫙 🫙 🫙 🧂 🍅 🧄  pantry  |                   |  └┘ └┘ └┘ └┘   fill line  |
 +--------------------------+                   +--------------------------+
```
- A **recipe card** names the sauce and shows the **target swatch** (colour) and the **thickness band**; a dressing also needs "emulsified".
- The **pantry** is a shelf of bottles, jars, spice bowls and the dish's own produce. **Tap** = one scoop; **hold** = a steady pour. Every scoop changes the live swatch and the thickness gauge.
- **Whisk** (dressings, creamy sauces, hollandaise): drag a circle in the bowl. A speed dial shows the green zone. In the zone the emulsion bar fills; too slow = lumpy (no progress), too fast = splashing (it falls back); pouring oil faster than the whisk can take it makes it **split** (an oil slick appears; scoop and re-whisk, or lose stars).
- **Stir** (chunky sauces, salsas): same circle with a wooden spoon, slower zone, no splitting; it spreads the chunks.
- **Spoon test** (the consistency indicator, drawn from art): a spoon dips in and shows how the sauce coats it, from runny to paste. The target has a band (say "coats the spoon").
- **Fix-ups:** "Scoop out" (remove one scoop, 2 a round), "Splash of water" (thin it), a "Taste" button that shows the match % (always on in tier 1, limited later).
- **Bottle** (Stage 2): the batch you made has a volume. A jug pours into bottles on a belt: hold = pour (the flow eases in, thick sauces glug), release at the fill line. Over-fill spills (wasted sauce: fewer bottles filled), under-fill is sloppy. Later tiers: narrow necks (use the funnel), a moving belt, different bottle shapes, thick sauces that string. After a bottle is full it is capped and labelled with a tap (the label is the sauce's name in the handwriting font).
- Stars: Stage 1 by colour match, thickness and emulsion; Stage 2 by fill accuracy, spill and yield; the result board shows both and the bottle that came out, which goes on the **Sauce Shelf** the first time it earns 3 stars.

## 3. What the code does today (so nothing is invented)

- **Sauce dishes exist** in the 91-level campaign (`levels/campaignPlan.ts`): L10 Garden Minestrone Base, L23 French Onion Base and Potato Velouté Base, L31 Potato Curry Base and Onion Tomato Masala Base, L32 Garlic & Ginger Paste, L33 Mango Chutney & Relish, L39 Herb & Tomato Base, L40 Corn & Tomato Salsa, L44 Two Salsas, L46 the Grand Latin Service, L70 Thai Basil Chicken.
- **The ingredient registry has no oil, vinegar, cream, egg, mustard, honey or spices** (57 ingredients: produce, herbs, meat, fish, dairy such as butter / cheddar / mozzarella, tofu, bread). So the pantry is a **game-only** list (free, not in the inventory, never bought): the game must not add ingredients to the registry for this (the registry stays the one source of ingredient definitions). The dish's real produce is used as the "fresh" part of the mix (a tomato, an onion, garlic, a chilli, a lemon...), with its real picture.
- **The mini-game pattern** (all recent games): a pure rules file in `business/` with seeded randomness and state in `business.<game>` (optional, sanitised, no new top-level save field); a React screen in the lazy Restaurant chunk with a `ScreenId`; a chip; `App.<game>Action` applying the result to the LATEST save with analytics; a Prep Cook "does it" button; tests `scripts/<game>-qa.mts` and `tools/e2e/<game>.mjs`; shared look from `inventory/sort/SortParts.tsx` (HUD plaques, star bar, buttons, result frame).
- **Rewards** go through `HYPE_BY_STARS` (0 / 5 / 10 / 15) and `addHype`; pins use the "every 3 perfect rounds" rule (`PERFECTS_PER_PIN`).
- **Money** is never touched by a mini-game (CLAUDE §7: the Market is the only place to buy; the ledger is for real movements).
- **Sound** is synthesized (`AudioManager`); this game wants 5 new named effects (§8.5).
- **Rewarded ads** have rules (CLAUDE §2: one placement per spot, says what it gives, daily cap, never needed to progress).

## 4. How it fits the main game

### 4.1 Where it opens
- A chip **"🥣 Sauce Station · N"** (N = the rounds waiting today) in the Inventory above the fridge chips and in the Restaurant → Kitchen section; a Paige beat introduces it once at the unlock level ("A new station: sauces!"). It is a small chip, never a popup, and nothing waits on it.
- A hired **Prep Cook** keeps the chip and gets a "🧑‍🍳 Prep Cook does it" button inside the game (no stars, no reward), exactly like the other games. (Lesson of 2026-11-08: a Prep Cook must NEVER hide a game.)

### 4.2 Which sauce, how many a day
- **Sauce of the day** = a sauce that today's menu really needs (the dishes' sauce tags), seeded by day; up to **3 rounds a day** (a "Sauces 1/3" tag, like "Deliveries 2/5"); after the three, free **practice** of any sauce already unlocked (no reward). A round asks for a sauce the player has unlocked (§6 catalog).
- **Mastery:** a sauce is "mastered" the first time it earns 3 stars; mastered sauces appear on the Sauce Shelf and can be practised any time.

### 4.3 Consequences are never real
- Wasting sauce, a split dressing or a wrong colour changes nothing in stock, credits or the ledger. The effects are stars, Hype, pins, the shelf and (optional D4) a small "house sauce" flavour line on the served card.

## 5. The mixing model (all pure, all testable)

### 5.1 Colour
- Each pantry item has a colour `c` (sRGB), a **tint strength** `t` (0..1: how much it colours a mix; oil 0.15, tomato 0.9, turmeric 1.0, cream 0.6...) and a **volume** per scoop `v` (1 unit; a spice is 0.25).
- The mix colour is the **tint-weighted average in linear RGB**, converted back to sRGB: `C = toSRGB( Σ(w_i · lin(c_i)) / Σ w_i )` with `w_i = v_i · t_i`. Linear-light mixing is far more natural than averaging sRGB bytes (yellow + blue does not give mud).
- The match is the **CIE76 ΔE in CIELAB** between the mix and the target: `match% = clamp(100 − 2.2·ΔE, 0, 100)`. Stars: ΔE ≤ 6 → colour 3★, ≤ 12 → 2★, ≤ 20 → 1★ (tier 1 widens these by 1.5×).
- Colour-blind help: the screen ALWAYS shows the number (match %) and a sliding "warmer / cooler / lighter / darker" hint arrow (from the Lab difference), so colour is never the only clue.

### 5.2 Thickness (the consistency indicator)
- Each item has a **viscosity** `η` (water 0, vinegar 0.05, oil 0.2, cream 0.4, yogurt 0.6, mayo 0.85, tahini 0.8, tomato 0.5, paste 0.9...). Thickness `T` = volume-weighted average of η, shifted by emulsion (an emulsified dressing is thicker) and by chunks (chunky sauces read thicker).
- The **spoon test** shows `T` as one of 5 coat states (runny / light / coats / thick / paste); the target has a band `[lo, hi]` (e.g. coats the spoon).

### 5.3 Emulsion (whisk) and splitting
- Only recipes with an **oil + an acid or yolk** need it (vinaigrettes, mayo, aioli, Caesar, hollandaise). `E` is 0..1.
- Whisk speed `ω` (turns per second) comes from the finger's angle around the bowl centre (smoothed). Green zone: `1.3 ≤ ω ≤ 2.6` (stir: `0.6-1.6`). In the zone `E += 0.35 · dt`; slow: no change; too fast: `E −= 0.2 · dt` and a splash.
- **Split:** if oil is poured faster than `0.5 unit/s` while `E < 0.4`, the mix **splits** (`E → 0`, an oil slick appears, −1 star share unless scooped and re-whisked). Pouring slowly while whisking is the lesson ("drizzle the oil").
- Done when colour, thickness and (if needed) `E ≥ 0.9` are all in range; the round can be finished early with the "Done" button.

### 5.4 Fairness (tested)
- Every sauce has a **reference recipe** (list of scoops) that reaches ΔE ≤ 3, thickness in band and, if needed, can be emulsified within the clock at a normal whisk speed; the QA searches (breadth-first over scoops ≤ the bowl cap) and fails if any sauce has no solution, if the clock is shorter than a perfect player needs, or if the target colour is outside what the pantry can make.
- No sauce asks for an ingredient the player cannot see: tier-1 sauces highlight the ingredients that belong; later tiers show only a list; tier 4 shows only the swatch.

## 6. The sauce catalog (24 sauces, one bottle each on the Sauce Shelf)

Target colour (sRGB hex), thickness band (0-1), emulsion (E) and the tool; "Unlock" = the first level that asks for it (the real campaign level, where one exists; others follow the cuisine chapters).

| # | Sauce | Target | Thick | Tool | Real produce in it | Unlock |
|---|---|---|---|---|---|---|
| 1 | Tomato Sauce | #C23A22 | .5-.65 | stir | tomato, onion, garlic, basil | L23 |
| 2 | Lemon Dressing | #F0DE7C | .15-.3 | whisk (E) | lemon, parsley | L23 |
| 3 | Vinaigrette | #D6B25A | .2-.35 | whisk (E) | onion | L23 |
| 4 | French Onion Base | #8A5A2B | .45-.6 | stir | onion | L23 |
| 5 | Potato Velouté | #EDE2C4 | .5-.65 | whisk | potato, onion | L23 |
| 6 | Béchamel | #F4EFE0 | .55-.7 | whisk | — | L26 |
| 7 | Basil Pesto | #5E8C2F | .55-.7 | stir | basil, garlic | L27 |
| 8 | Mayonnaise | #F5EBC8 | .8-.95 | whisk (E) | lemon | L28 |
| 9 | Garlic Aioli | #F1E4B6 | .8-.95 | whisk (E) | garlic, lemon | L28 |
| 10 | Caesar Dressing | #E9DDB6 | .5-.65 | whisk (E) | garlic, lemon | L29 |
| 11 | Ranch | #F3EFDF | .55-.7 | whisk | parsley, garlic | L29 |
| 12 | Curry Paste | #C9852E | .8-.95 | stir | garlic, ginger, chilli | L31 |
| 13 | Onion Tomato Masala | #B5481F | .55-.7 | stir | onion, tomato, ginger | L31 |
| 14 | Garlic & Ginger Paste | #D7C48A | .85-.95 | stir | garlic, ginger | L32 |
| 15 | Mango Chutney | #D88A1E | .65-.8 | stir | mango, onion, chilli | L33 |
| 16 | Mint & Cilantro Chutney | #6EA83C | .3-.45 | stir | cilantro, lime, chilli | L34 |
| 17 | Herb & Tomato Base | #B84A2C | .45-.6 | stir | parsley, tomato, garlic | L39 |
| 18 | Fresh Tomato Salsa (chunky) | #D9452B | .4-.55 | stir | tomato, onion, chilli, cilantro, lime | L40 |
| 19 | Corn & Tomato Salsa (chunky) | #DFA32A | .4-.55 | stir | corn, tomato, onion | L40 |
| 20 | Pineapple Salsa (chunky) | #F0C94A | .35-.5 | stir | pineapple, onion, chilli | L44 |
| 21 | Guacamole (chunky) | #7DA43C | .65-.8 | stir | avocado, lime, onion, tomato | L46 |
| 22 | Chimichurri | #50792B | .25-.4 | whisk (E) | parsley, garlic, chilli | L50 |
| 23 | Sweet Chili | #D5361F | .35-.5 | stir | chilli, garlic | L58 |
| 24 | Thai Basil Sauce | #4B3A1E | .3-.45 | stir | basil, garlic, chilli | L70 |

(Colours are first guesses; the tuning script §9 checks each is reachable and 3 stars is possible at a calm pace. Hollandaise, BBQ, teriyaki, satay and tahini sauce are the Phase 2 pack, §12.)

### 6.1 The pantry (game-only, free, never in the inventory): 28 items
- **Oils and vinegars:** olive oil, vegetable oil, sesame oil, white vinegar, red wine vinegar.
- **Liquids and creams:** water, stock, stock cube, milk, cream, coconut milk, yogurt, soy sauce, honey, tomato passata, chilli sauce (squeeze bottle).
- **Jars:** mayonnaise, mustard, tahini, peanut butter.
- **Spices (a spice is 0.25 of a scoop):** salt, pepper, paprika, turmeric, cumin, curry powder, chilli flakes, sugar.
- **The dish's real produce** (with the real ingredient picture, drawn as a chopped heap): tomato, onion, garlic, chilli, lemon, lime, ginger, cilantro, basil, parsley, mango, pineapple, corn, avocado, potato. These are NOT pantry slots: they appear on a second row only when the sauce uses them.
- Each pantry item has a blank-labelled container in the art (§10); the name is drawn in code.

## 7. Difficulty (the same levels as the other mini-games' growth)

| Tier | From | Sauces | Help | Bowl cap | Clock | Splitting | Bottles |
|---|---|---|---|---|---|---|---|
| 1 First sauce | L23 | #1-5 | recipe pips (the exact scoops, ghost-highlighted), Taste always on, wide colour tolerance (×1.5) | 8 scoops | 75 s | forgiving (oil limit ×2) | 3 wide |
| 2 Home cook | L40 | + #6-17 | the list of ingredients (no amounts), Taste ×5 | 10 | 70 s | normal | 4, one narrow neck |
| 3 Saucier | L55 | + #18-21 | colour + thickness target only, Taste ×3 | 12 | 65 s | strict | 5, funnel needed |
| 4 Chef | L75 | all 24 | the swatch only, Taste ×2, a distractor ingredient (a wrong look-alike spice) | 12 | 60 s | strict + thick oil | 5, moving belt |
(The exact levels are read from the schedule when building; a sauce unlocks at its own level whatever the tier.)

## 8. Technical plan (reuse, never duplicate)

### 8.1 New, pure first
- `business/sauceColor.ts` — colour math only: `srgbToLinear`, `linearToSrgb`, `rgbToLab`, `deltaE76`, `mixColors(items)`, `hintArrow(lab_diff)`. No state, no I/O.
- `business/sauceStation.ts` — rules: `PANTRY` (28 items: colour, tint, viscosity, volume, container art id), `SAUCES` (the 24 with target, band, tool, reference recipe, produce), `SAUCE_TIERS`, `sauceOfTheDay(save, level, day, round)` (seeded, from the menu's sauce tags), `mix(scoops)` → `{color, thick, emulsion needed}`, `whiskStep(state, ω, dt)`, `splitCheck`, `mixStars`, `bottleVolume(batch)`, `pourStep`, `bottleScore`, `starsFor`, `hypeFor`, `roundsLeft`, `finishRound`, `autoSauce`, state `business.sauceStation` = `{ mastered: bitmask of 24, best, stars, perfect, rounds, streak, day, today, howto }` (sanitised; absent on old saves).

### 8.2 Screen and wiring
- `inventory/sauce/SauceStationGame.tsx` (the screen: stage 1 and stage 2 as two components sharing the HUD), `MixStage.tsx`, `BottleStage.tsx`, `Pantry.tsx`, `LiquidBowl.tsx` (a canvas or layered CSS: the liquid is a clipped, tinted layer with a slow swirl from the whisk angle), `SpoonTest.tsx`, `SauceShelf.tsx` (the collection screen), `SauceStationChip.tsx`; `ScreenId` "sauce-station" (+ "sauce-shelf" or a tab); lazy in `restaurantScreens.ts`; `App.sauceStationAction`; a Paige beat in `assistant.ts`; the chip in the Inventory and the Kitchen section; analytics `sauce_station_started / finished / skipped / auto`, `sauce_mastered`.
- **Whisk input:** pointer events on the bowl; angle = `atan2` around the bowl centre; angular speed smoothed over 120 ms; a missed-frame guard; an **accessibility alternative** ("Auto-whisk": hold a big button to whisk at a steady speed, capped at 2 stars; also the default when Reduced Motion is on).
- **Pour input:** press-and-hold on a pantry item (mix) or on the jug (bottle); `touch-none` on the play area; a haptic-free soft "glug" via synth sound.
- **Rendering:** CSS transforms and opacity only (CLAUDE §10); no animation library; the stream is an SVG path with a CSS dash animation; the liquid level and colour are CSS variables; reduced motion = no swirl, no splash, steady stream.
- **No external requests**; assets are lazy loaded (the game is in the Restaurant chunk; the art loads on opening); budget **≤ 900 KB** for the kit (the 24 shelf bottles and the pins are the biggest part).

### 8.3 Sounds (synth, `AudioManager`, no files): `pourLoop` (a rising glug while pouring, stops on release), `whisk` (a soft swish tied to speed), `clink` (a bottle on the belt), `cork` (cap on), `splash` (a spill). Five new named effects; `audio-qa`'s list is updated (a rule change, noted).

### 8.4 Rules kept
Seeded generator only; whole numbers where saved; old saves work; touch targets ≥ 48 px; text 12-14.5 px (CLAUDE §10), nothing under 8.5 px; short copy with ⓘ for explanations; reduced motion; no money, stock or ledger; Bridge/analytics only through `PlayablesSDK`; English only.

### 8.5 Tests
- `scripts/sauce-station-qa.mts`: colour math against known values (sRGB white = Lab 100, ΔE of a colour with itself = 0, ΔE symmetric), mixing is monotonic (adding a scoop of X moves the mix toward X), linear-light mixing (yellow + blue is not grey-brown), every sauce is **solvable** by its reference recipe within ΔE ≤ 3 at normal speed and within the clock, the bowl cap, thickness band reachable, emulsion rules (slow drizzle OK, fast pour splits, scoop-out recovers), whisk speed scoring, bottle pour scoring (exact fill = full marks, over-fill spills, yield falls with spill), stars, Hype, pins, the shelf bitmask, the daily limit and `roundsLeft`, the Prep Cook (the chip stays; his button counts the round, no reward), old saves, no unseeded randomness, no money / stock / ledger in the rules, wiring (screen, chip, action, lazy chunk), text-size and ⓘ rules (`ui-copy-qa`).
- `tools/e2e/saucestation.mjs`: chip → game → how-to → pour by tap and hold → the live swatch changes → whisk with real mouse circles (a scripted circle at 2 turns/s must fill the emulsion bar; a still pointer must not) → a split case → Stage 2 pour and release → result → shelf → Back arrow before Start → Prep Cook button → 320 / 390 / 768 px → reduced motion → no console errors.
- `lazy-load-qa` L1 counts nine Restaurant screens; `audio-qa` lists the new effects; `ui-copy-qa` stays green.

## 9. Making it clear, and the risks

- **How-to card:** 4 pictured steps (read the card · pour · whisk in the green · bottle at the line), shown by itself until the first round is done and from a visible "?"; a pointing hand and a ghost whisk circle on the first sauce; Round 1 is **Tomato Sauce** with recipe pips and a wide tolerance.
- **Back arrow before the clock starts** and a pause card with Leave (the lesson of 2026-11-08).
- **Risks and answers**
  - **Colour differs per screen:** the target is shown next to the live mix on the same screen (relative, not absolute) and the match % is a number; the tolerance is generous in tier 1.
  - **Colour-blind players:** the % number, the warmer/cooler arrow, the thickness gauge and the spoon test carry the answer without colour.
  - **Whisk on touch:** an angle-based measure (not path length) forgives wobble; a large zone; Auto-whisk as the accessible path; the real-phone pass tunes the zone.
  - **Pouring feel:** the flow eases in and out and is capped; thick sauces glug; the QA tests the scoring function, the tuning pass tests the feel on a phone.
  - **Too many controls:** only 5 verbs (pour, whisk, scoop out, taste, done); the pantry shows 8-10 items per round (the sauce's own + 2-3 distractors), not all 28.
  - **No pantry in the registry:** deliberately game-only; the registry stays the single source (CLAUDE §6).
  - **Rewarded-ad rules:** any ad placement needs the developer's yes and the CLAUDE §2 rules.
  - **Tuning by simulation only:** a real-phone pass is still needed (§11).

## 10. Assets: what exists, what is needed

### 10.1 Already in the repo (reused, not regenerated)
| Need | Existing piece |
|---|---|
| The ingredient pictures of the real produce (tomato, onion, garlic, chilli, lemon, lime, ginger, cilantro, basil, parsley, mango, pineapple, corn, avocado, potato) | `public/business/ingredients/<id>.webp` (`IngredientIcon`) |
| HUD plaques, pause / back button, star bar, stars, result panel | `public/business/fridge-sort/` (`hud-*`, `starbar-*`, `star-*`, `result-panel`) |
| Ribbons, sparkles, dust puffs, the stamp ring | `public/business/stockroom/` (`ribbon-*`, `spark-*`, `puff-*`, `stamp`) |
| The Prep Cook portrait, the pointing hand | `staff-portraits/prep-cook.webp`, `PointerHand` |
| The painted markers (red ring, cross, chalk ring, tick) | `public/business/inspection/markers.webp` |

### 10.2 New and needed (all prompts are in the companion file; ids are the file names)
**Mixing (stage 1)**
| Id | What | Size |
|---|---|---|
| M01 | Backdrop: the sauce station (a warm kitchen counter, shelves of jars, a window), portrait, calm top 20% | 1080×1920 |
| M02 | Mixing bowl, BACK layer (interior and far rim) | 900×520 |
| M03 | Mixing bowl, FRONT layer (the near rim and the body) | 900×300 |
| M04 | Bowl liquid MASK (white = where liquid may show) | 900×520 |
| M05 | Saucepan, BACK layer | 900×520 |
| M06 | Saucepan, FRONT layer | 900×300 |
| M07 | Saucepan liquid MASK | 900×520 |
| M08 | The whisk (balloon whisk, from above, tilted) | 512×768 |
| M09 | The wooden spoon (for stirring) | 512×768 |
| M10 | The test spoon (wood spoon, blank, to show the coat) | 384×640 |
| M11 | Spoon coat masks, 5 states (runny → paste), white shapes, sheet 5×1 | 1280×256 |
| M12 | Pantry BOTTLES sheet (6: olive oil, vegetable oil, sesame oil, white vinegar, red wine vinegar, soy sauce) 3×2 | 768×1024 |
| M13 | Pantry JARS sheet (6: mayonnaise, mustard, tahini, peanut butter, honey, yogurt tub) 3×2 | 768×512 |
| M14 | Pantry CARTONS & CANS sheet (6: cream, milk, stock, coconut milk, tomato passata, water jug) 3×2 | 768×768 |
| M15 | Chilli-sauce squeeze bottle + stock cube + a measuring cup (3), sheet 3×1 | 768×384 |
| M16 | SPICE BOWLS sheet (8: salt, pepper, paprika, turmeric, cumin, curry powder, chilli flakes, sugar) 4×2 | 1024×512 |
| M17 | Chopped-produce HEAPS sheet (15: the real produce as a chopped pile for the "fresh" row) 5×3 | 1280×768 |
| M18 | CHUNKS sheet (10 floating bits for salsa and guacamole) 5×2 | 640×256 |
| M19 | FX sheet 4×4 (16: droplets, bubbles, oil slick ring, curdle clumps, shine, swirl streak, splash crown, steam wisp) | 1024×1024 |
| M20 | Recipe card (blank card, clip, a blank swatch window) | 560×760 |
| M21 | Swatch holder (paint-chip frame, round) | 384×384 |
| M22 | Whisk-speed dial: frame and needle, sheet 2×1 | 768×384 |
| M23 | Emulsion meter: a glass tube, horizontal, empty and full, sheet 1×2 | 768×384 |
| M24 | Thickness gauge: a vertical glass viscosity tube with a green band frame | 256×640 |
| M25 | Wax seals: bronze, silver, gold (the match grade), sheet 3×1 | 768×256 |
**Bottling (stage 2)**
| Id | What | Size |
|---|---|---|
| B01 | Backdrop: the bottling line (a counter with a belt, shelves of bottles), portrait, calm top 20% | 1080×1920 |
| B02 | Conveyor belt strip (tileable horizontally) with side rails | 1024×256 |
| B03 | Empty BOTTLES, 6 shapes × 3 layers (back, front, interior mask), sheet 6×3 of 256×512 | 1536×1536 |
| B04 | CAPS, corks and nozzles (6), sheet 3×2 | 768×512 |
| B05 | Blank LABELS (4 shapes), sheet 2×2 | 512×512 |
| B06 | Pour jug (spouted), ladle and funnel, sheet 3×1 | 1152×512 |
| B07 | Finished-bottle CRATE, BACK and FRONT, sheet 1×2 | 900×900 |
| B08 | SPILL splats (4 puddle masks) and 2 drip trails, sheet 3×2 (white masks) | 768×512 |
**Collection and rewards**
| Id | What | Size |
|---|---|---|
| C01 | The Sauce Shelf backdrop (a wooden wall shelf unit, 6 columns × 4 rows of slots), portrait | 1080×1920 |
| C02 | The 24 sauce BOTTLE ICONS (each sauce in its own bottle shape and label colour), sheet 6×4 | 1536×1536 |
| C03 | EMPTY-slot silhouette and a "locked" padlock tag, sheet 2×1 | 512×256 |
| C04 | 12 collectible "Saucier" enamel PINS, sheet 4×3 | 1024×768 |
| C05 | "Mastered" gold ribbon badge and "New!" sparkle burst, sheet 2×1 | 512×256 |
Total **38 files** (25 + 8 + 5, with each sheet counting once). The liquid, the pour stream, the swirl and all text are drawn in code.

### 10.3 Optional Phase 2 art (the second pack)
Hollandaise, BBQ, teriyaki, peanut satay, tahini and a few more sauces (6 more icons and 6 more pantry containers); a second saucepan colour; a seasonal bottle set. Not needed to ship.

Not needed: a new character (the Prep Cook portrait), new HUD, new stars, new fonts, a new result board, any sound file (synth), a pour-stream sprite (SVG), liquid sprites (CSS).

## 11. Phases and estimate

1. **Rules + QA** (3-4 d): `sauceColor.ts`, `sauceStation.ts` (pantry, 24 sauces and their reference recipes, mixing, emulsion, whisk, pour scoring, tiers, state), `sauce-station-qa`, the **solvability** search and the simulated-player tuning script (perfect / average / sloppy).
2. **Screen: Mix** (3-4 d): the bowl and liquid, pantry, tap / hold pour, the live swatch and thickness gauge, the whisk, the spoon test, scoop out / taste, how-to, Back / pause, result.
3. **Screen: Bottle** (2-3 d): the belt, jug, pour and release, funnel, spill, cap and label taps, yield, result.
4. **Shelf + wiring** (1-2 d): the Sauce Shelf, the chips, the Paige beat, the Prep Cook button, analytics, the lazy chunk.
5. **Art wiring** (1 d): the build step (`scripts/make-sauce-assets.py`: cut sheets, WebP, ≤ 900 KB), art QA.
6. **Playtest and tune** (1-2 d): e2e, screenshots at 320 × 568 / 360 × 640 / 390 × 844 / 430 × 900 / 768 × 1024, then the developer's real-phone pass (the whisk zone and the pour curve are the things to feel).

Total about **12-14 working days** with all the art in hand; the rules can start before the art (liquids are code).

## 12. Phase 2 ideas (not in the base plan)
- The second sauce pack (hollandaise, BBQ, teriyaki, satay, tahini), "house sauce" tags on dishes, a seasonal sauce, a daily challenge ("make the colour of the sunset"), a leaderboard of the best match (Bridge leaderboards), and a recipe-book screen with a story line per sauce.

## 13. Decisions for the developer (recommendation first)

- **D1. Unlock level?** (Recommended) **Level 23** (the first "base" dishes), growing with the catalog (§6). (Option) Level 12 or 15 with only the 5 first sauces; (Option) L40 with the salsas.
- **D2. Two stages in one game?** (Recommended) Yes: Mix, then Bottle, one result board; a player may skip Bottle with one tap (it gives 1 star less at most). (Option) two separate games.
- **D3. Whisk input.** (Recommended) circle with a finger + Auto-whisk as the accessible path (max 2 stars). (Option) tap-rhythm only.
- **D4. Any real effect?** (Recommended) None on money or stock: Hype, pins and the Sauce Shelf. (Option) a mastered sauce adds a line "House sauce" on the served card for dishes that use it (cosmetic, no pay change). (Option, touches the economy tests) a mastered sauce gives a tiny tip bonus on its dishes.
- **D5. How many a day?** (Recommended) 3 rounds a day, then free practice. (Option) unlimited.
- **D6. Rewarded ad?** (Recommended) Yes, one placement ("+1 scoop undo" or "show me the recipe", daily cap 5), after your yes. (Option) none in the first release.
- **D7. Prep Cook?** (Recommended) He keeps the chip and has a "does it" button (no reward). (Option) he also stocks the Sauce Shelf while idle (no).
- **D8. Pantry is game-only?** (Recommended) Yes, free and never in the inventory or the registry. (Option) add real oil / vinegar / cream ingredients to the registry and the Market (a much bigger change: new ingredients, art, recipes, economy numbers).
- **D9. Name.** "Sauce Station" (recommended) or "Saucier" / "Sauce Lab".
- **D10. Asset folder.** `D:\WORKS\GAMES\Knife Craft\Sauce Station Assets` (recommended; add it to `.gitignore` like the other source-art folders).
- **D11. The Sauce Shelf location.** (Recommended) a screen reached from the result board and a button in the Inventory (a trophy wall, like the fridge magnets). (Option) a shelf on the Restaurant map.

## 14. Risks (summary)

- **Colour and screens** (answer in §9). **Whisk feel** (Auto-whisk, real-phone tuning). **Pour feel** (curve and a tuning pass). **Scope:** 24 sauces and 39 art files is the biggest of the mini-games; mitigation: build the rules and Stage 1 first with CSS stand-ins (the art is not on the critical path), ship with the first 12 sauces if needed and add the rest as the art arrives. **Overlap with Delivery Inspection / Fridge Check:** different verbs, different moments (they are about food that ARRIVES or SPOILS; this is about food that is MADE). **Tuning by simulation only:** a real-phone pass is required.
