# Fridge Check — "Fresh or spoiled?" (detailed plan + asset list)

Status: PLAN ONLY (2026-11-06), written after reading the code. No game code yet.
Developer idea 2026-11-06: replace the one-tap closing chore "Throw out spoiled food" with a swipe game: ingredient cards slide in, swipe the fresh ones to keep and the spoiled ones to the bin, from the real stock and freshness data; "Wrap and label" can share the screen.
Companion file with every Codex art prompt: `FRIDGE-CHECK-CODEX-PROMPTS-2026-11-06.md` (assets are saved to `D:\WORKS\GAMES\Knife Craft\Fresh Check Assets`; say if you want another folder).
Decisions the developer must make are in §11 (recommendation first); the plan assumes the recommendations.

**Short answers**
- **What is it?** A closing-night inspection of the walk-in fridge. A deck of cards, one per ingredient you really have in stock, slides in. Swipe right = **Keep**, left = **Bin**, up = **Use first** (from the second tier). Tap buttons work too. Then, for the "Wrap and label" chore, tap the kept items in use-by order and each one is wrapped and labelled.
- **Real data?** Yes. Cards are the real inventory; the answer for each card is the game's own freshness rule (`perishabilityStateFor`, read for tomorrow, exactly what closing will throw out, `closingPreview`). Nothing about it is invented.
- **How is it different from Fridge Sort?** Fridge Sort is the morning put-away (where does it go, knowledge of the fridge's shelves). Fridge Check is the night inspection (is it still good, judgment of shelf life). Different verb (swipe, not place), different moment (closing), different lesson.
- **When?** From the Fridge & Freshness stage, when food can actually spoil (`isSystemLive("fridge-freshness")`). Before that the chores stay one tap, because nothing can spoil yet. It only opens when there is something to judge (§3.4).
- **Money or stock?** Never. It completes the existing chore through the existing `cleanTask`, so the cleanliness effect is exactly what the one tap gave. Closing still throws out the spoiled stock itself, at the same value. Its rewards are Hype and collectible badges.
- **Art?** 11 new images are needed (§9), plus an OPTIONAL set of 5 sheets (the 57 ingredients drawn "spoiled") that is worth doing for quality. The 57 fresh ingredient pictures, the HUD, the star bar, the result board, the crate and the shelf already exist.
- **How big?** About 7 working days (§10).

---

## 1. Why build it (the developer's goal is real revenue)

- The two night chores are the most repeated one-taps in the game (every day, from the freshness stage). Turning one into a 30–45 second game gives the daily close a hands-on moment, so sessions get longer without a new required task.
- It teaches the "Fridge & Freshness" lesson ("Don't buy more than you can use") by doing: the player sees which food spoils fast (protein and herbs, 3 days) and which does not (aromatics, 12). That makes the Market's "Plan ahead" and the Fridge Sort freshness reward matter.
- It reuses what is built: 57 ingredient pictures, the sorting games' HUD, the star bar and result board, the Hype table, the chore system. Cheap for the engagement it adds.
- Optional and skippable, so it cannot hurt retention.

## 2. What the code does today (so nothing is invented)

- The chores are Cleanliness tasks (`cleanliness.ts`): `"spoiled-out"` ("Throw out spoiled food", closing, `staff: "prep-cook"`) and `"wrap-fridge"` ("Wrap and label what's left in the fridge", closing, `staff: "prep-cook"`). They use no supplies. They are cleaned by `cleanTask` and are one tap (not in `INTERACTIVE_CLEANING_TASKS`). The one place that decides "scrubbing game or one tap" is `useCleaningGame` / `isInteractiveTask` in `CleaningGame.tsx`, used by Restaurant → Cleanliness, the Pre-Service Check and Closing Time.
- The real throw-out is not the chore. Closing (`restaurantDay.closeDay`) advances the freshness clock one day and sweeps what has expired (`clearExpiredStock`), as waste with End Business Day's multipliers (`wasteValueFor`); no money, no ledger. `closingPreview` already lists what closing will throw out ("spoils by tomorrow"). Inventory's "Throw Out Expired" (`discardExpired.ts`) is the same sweep run early.
- Stock is ONE aggregate entry per ingredient (`inventory[id] = {quantity, unitCost, purchaseDay}`), so a card is an ingredient, not a piece, and an entry is wholly usable or wholly expired.
- Freshness: `perishabilityStateFor(id, purchaseDay, day)` → FRESH (< 35 % of shelf life), AGING (35 %+), NEAR_EXPIRY (75 %+), EXPIRED (100 %+). Shelf life by category: Protein 3, Herb 3, Dairy 4, Bakery 5, Fruit 6, Vegetable 7, Aromatic 12 days. Fridge Sort's reward (`freshenStock`) moves `purchaseDay`, so a player who sorted well sees younger food here for free.
- Freshness only exists from the Fridge & Freshness stage; the closing chores themselves start earlier (`CLEANING_FROM_LEVEL = 3`), when nothing can spoil.

## 3. How it fits the main game

### 3.1 Where it opens
- Tapping "Throw out spoiled food" (or "Wrap and label") in Closing Time, Restaurant → Cleanliness or the Pre-Service Check opens Fridge Check instead of doing the one tap. One new branch in `useCleaningGame.clean(task)`; nothing else that lists chores changes.
- A **Skip** (in the pause card) does the chore the old way with one tap, so the day can always close.
- A hired **Prep Cook** keeps doing both chores by himself (`staff: "prep-cook"`, unchanged), with no stars and no reward.
- The Pre-Service Check / Closing Time never wait on the game.

### 3.2 The two stages (one screen, one result board)
- **Stage 1 — Fresh or spoiled?** (chore `spoiled-out`). The swipe deck.
- **Stage 2 — Wrap & label** (chore `wrap-fridge`). The food that stays is lined up on a steel shelf; tap the one that goes off first, each tap wraps it and sticks a "Use by Day N" label. If both chores are open, stage 1's result card offers "Next: Wrap & label".
- Each stage completes only its own chore, so the existing checklist and its numbers stay exact.

### 3.3 The cards are real
- The deck is every ingredient with stock > 0 (`inventory`), the order seeded by the day (no `Math.random()`).
- The truth of a card is evaluated **for tomorrow** (`advanceBusinessDay(calendar).businessDay`, the same day `closingPreview` uses): EXPIRED → **Bin** (closing throws it out tonight); NEAR_EXPIRY → **Use first** (tier 2+; in tier 1 it counts as Keep); AGING / FRESH → **Keep**.
- The card shows the real picture, name, quantity in the player's measure (`formatStockAmount`) and "Bought N days ago".

### 3.4 It only opens when it matters
- If tomorrow nothing is NEAR_EXPIRY or EXPIRED, there is nothing to judge: the chore stays one tap and says "Everything is fresh ✓". The deck needs at least one non-trivial card, plus the other stock as company, 4 to 12 cards in all.
- **Measure before locking the tiers** (like the Fridge Sort demand table): a script runs the simulated campaign and reports, per level, how many stock lines are NEAR_EXPIRY / EXPIRED at closing. If it is too rare, the fallback is a free "Fridge Check" practice offered from the Inventory fridge with the real stock (no chore, no reward).

### 3.5 Consequences are never real
- A wrong swipe costs points only. Binning a fresh card does NOT remove stock ("It was still good!"); keeping a spoiled one does NOT save it ("This spoils tonight, closing throws it out"). The sweep at closing is the only thing that moves stock, and it happens whatever the player does, at the same value as today.

## 4. How the game plays

### 4.1 Stage 1 — the swipe deck
- A card sits in the middle of the cold room. Drag it right (Keep), left (Bin) or up (Use first); a green KEEP / red BIN / amber USE FIRST stamp fades in as it nears a side, and the matching spot (a crate, a pedal bin, a "use first" flag shelf) lights up. Release past the threshold to commit; release before it and the card springs back.
- **Buttons** under the card do the same (accessibility, and a mouse player): Bin · Use first · Keep, each ≥ 48 px. Keyboard arrows work.
- After every card the note line says WHY in one line: "Salmon: 3-day shelf life, bought 3 days ago → spoils tonight". A wrong answer shows the right one and the reason (the lesson is free, the points are not).
- A card's face carries the real cues: the picture (looking dull, then spoiled, as it ages), a freshness icon (leaf / clock / hourglass / "yuck"), "Bought N days ago". Later tiers hide the icon, then the days.
- A **Shelf-life guide** ⓘ lists the seven categories and their days (an InfoTip, `ui-copy-qa` guards copy length).
- Clock: `(8 s + 2.2 s × cards) × tier factor`, starting at the first drag. Combo: ×1.25 per right swipe in a row, max ×3, like the sorting games. Pausing freezes it.

### 4.2 Stage 2 — wrap and label
- The kept food stands on a steel shelf (up to 8 pictures). The player taps the one that **goes off first** (soonest use-by); a cling film wraps it, a label sticks on with "Use by Day N" (N = purchase day + shelf life, read from the data), and the next is asked. The order is right when it matches the real use-by order (ties are any order).
- A wrong tap shakes and says "This one goes off sooner: do it first" (free). Two stars need ≥ 75 % in order, three need all.
- No clock in tier 1; a gentle one from tier 3.

### 4.3 Stars, points and the result
- Stage 1 stars: all cards right = 3 stars (with the clock not run out), ≥ 85 % right = 2, ≥ 60 % = 1. A Bin-as-Keep mistake (keeping spoiled) counts double against the star share, because that is the costly one in a real kitchen.
- Score: 100 a right card with the combo, 20 a second left when the deck is finished (same shape as the sorting games, so the shared result board is reused).
- Result board: stars, score, "x of y right", Hype, a badge when earned, and a short "What closing throws out tonight: 🥩 🥬" strip made of the real ingredient pictures (the closing preview made visible).

## 5. Difficulty (levels are read from the live systems, not hard-coded)

| Tier | From | Cards | Piles | Cues | Clock |
|---|---|---|---|---|---|
| 1 First look | the freshness stage | 4–6 | Keep / Bin | picture + icon + "bought N days ago" | ×2.0 |
| 2 Rotation | +10 levels | 6–8 | + Use first | icon + days | ×1.6 |
| 3 Quick eyes | +23 levels | 8–10 | 3 piles | days only (no icon), spoiled look still shown | ×1.3 |
| 4 Cook's memory | +40 levels | 10–12 | 3 piles | no cues: the picture only; the guide ⓘ stays | ×1.1 |
| 5 Full kitchen | full operation | 12 | 3 piles, mixed with tricky ones (onions last 12 days, herbs 3) | picture only | ×1.0 |

The exact levels are taken from `restaurantProgression` when building (the numbers above are offsets from the freshness stage, like Fridge Sort's table). Stage 2 follows the same tiers (items 3–8, clock from tier 3).

## 6. Rewards (never money, never stock)

- **Hype:** the shared `HYPE_BY_STARS` (0 / 5 / 10 / 15), once per night per stage; practice and the Prep Cook give nothing.
- **Collectibles:** 12 **freshness pins** (every 3 three-star nights), shown in Inventory beside the fridge magnets; the same unlock pattern as the fridge magnets and shelf badges.
- **Streak of perfect nights** (a small counter, shown on the result board: "3 perfect nights in a row"). Display only.
- **No effect on the economy:** the waste value closing records is unchanged. (Option D3 in §11: a perfect night trims tonight's waste value a little; it would touch the economy tests, so it is not in the base plan.)

## 7. Making it clear (lessons from the Fridge Sort and Stockroom Sort feedback)

- A how-to card (4 icon steps: a card = something in your fridge / swipe right keep, left bin / up = use first / why it spoils) shows by itself until the first night is finished, and from a visible "?" button.
- A pointing hand and a ghost swipe on the very first card.
- The first night is tiny (4 cards, 2 piles, icon on) and the answer is explained after each card.
- Short copy: icons and numbers on the screen; longer words behind an ⓘ.

## 8. Technical plan (reuse, never duplicate)

New, pure first:
- `src/game/restaurant/fridgeCheck.ts` — rules only: `FRIDGE_CHECK_TIERS`, `checkCards(save, levelNumber, day)` (the deck, seeded), `verdictOf(card)` (Keep / Use first / Bin, from `perishabilityStateFor` for tomorrow), `useByDay`, `scoreCheck`, `starsFor`, `labelOrder`, `finishCheck(save, outcome)` (calls `cleanTask` for the stage's chore, `addHype`, updates the state) and `isFridgeCheckOpen(save, level)` (freshness live AND something to judge).
- State `business.fridgeCheck` (extends `business`, nested migration, no new save field): `{ best, stars, perfect, rounds, streak, lastDay }`. Absent on old saves.
- `src/components/kc/restaurant/FridgeCheckGame.tsx` (screen), opened from `useCleaningGame` as an overlay like `AreaCleaningPrototype`; shared look from `inventory/sort/SortParts.tsx` + `sortUtils.ts` (HUD, star bar, result frame, buttons).
- Analytics `fridge_check_started / finished / skipped` through `sendAnalyticsEvent`.

Rules kept: seeded generator only; whole numbers; old saves work; touch targets ≥ 48 px; text sizes per CLAUDE §10; reduced motion = no card fly, no stamp fade, no shake; no external requests; no animation library (CSS transform/opacity); never touches credits / inventory / ledger (the closing sweep keeps that job).

Tests: `scripts/fridge-check-qa.mts` (deck is the real stock, verdicts equal `closingPreview.spoiled`, order seeded, tiers, scoring, finishing completes only its chore and leaves credits / inventory / ledger identical, old saves, no randomness in the file); `tools/e2e/fridgecheck.mjs` (swipe and button paths, how-to once, skip = one tap, Prep Cook, 320 × 568, reduced motion, no console errors); `market-art-qa`-style art checks for the new files.

## 9. Assets: what exists, what is needed

### 9.1 Already in the repo (reused, not regenerated)
| Need | Existing piece |
|---|---|
| The 57 ingredient pictures (fresh) | `public/business/ingredients/<id>.webp` (`IngredientIcon`) |
| HUD plaques, pause button, star bar, stars, result panel | `public/business/fridge-sort/` (`hud-*`, `starbar-*`, `star-*`, `result-panel`) |
| A crate for the Keep pile | `fridge-sort/crate-back.webp`, `crate-front.webp` |
| A shelf to stand things on | `fridge-sort/shelf-glass.webp` |
| Praise ribbons, sparkles, dust puffs, the stamp ring, shelf-badge look | `public/business/stockroom/` (`ribbon-*`, `spark-*`, `puff-*`, `stamp`) |
| The tutorial hand, buttons, sounds | `PointerHand`, `SortButton`, `AudioManager` (synth) |

### 9.2 New and needed (Phase 1, 11 images)
| Id | What | Why it cannot be reused | Size |
|---|---|---|---|
| C01 | Backdrop: the walk-in cold room at night | the other rooms are warm (kitchen wall, stockroom); a cold, dim, steel room says "closing inspection" | 1080×1920 |
| C02 | The blank inspection card (index card with a clip, a blank picture window, blank name and amount strips) | the thing you swipe; nothing like it exists | 640×820 |
| C03 | Three blank rubber stamps: KEEP green, BIN red, USE FIRST amber | the swipe feedback; the current stamp is copper-red only | 3 × (256) |
| C04 | A pedal bin, open and closed | the Bin pile | 2 × (512) |
| C05 | Small props: a blank orange "use first" flag, 3 blank use-by labels (green, yellow, red), masking tape, marker, cling-film roll | the "Use first" pile and Stage 2 | 8 × (256) |
| C06 | A steel walk-in shelf strip | Stage 2's shelf (the glass shelf is the home fridge) | 1200×200 |
| C07 | 4 freshness icons: leaf (fresh), clock (aging), hourglass (near expiry), "yuck" fumes (spoiled) | the card's cue | 4 × (256) |
| C08 | 12 spoilage overlays: mold in 4 looks, black rot spots, brown bruises, slime drip, wilt shade, mushy patch | makes ANY of the 57 pictures look spoiled | 12 × (256) |
| C09 | Spoilage effects: 3 flies, 2 stink wisps, 2 drips, a cobweb | life on a spoiled card | 8 × (256) |
| C10 | 3 translucent cling-film wraps (round, box, long) | Stage 2's wrap | 3 × (512) |
| C11 | 12 collectible freshness pins | the reward | 12 × (256) |

### 9.3 Optional (Phase 2, recommended): "spoiled twins", 5 sheets
The overlays (C08) on a CSS-dulled picture work, but each ingredient rots differently (a wrinkled tomato, a grey steak, a mouldy loaf). Five sheets draw all 57 ingredients **spoiled**, in the same poses and order as the fresh sheets A7–A11, so the same cutting step (`scripts/make-market-assets.py`) produces `public/business/ingredients-spoiled/<id>.webp` (about 300 KB). Do them after Phase 1 is accepted. Without them the game ships with overlays and is playable; with them it looks finished.

Not needed: a background for Stage 2 (C01 serves both), new HUD, new stars, new fonts, characters, a new result board, sound files (synth), a swipe arrow (CSS).

## 10. Phases and estimate

1. **Measure + rules + QA** (2 d): the closing-stock script (how often something is near expiry or expired), `fridgeCheck.ts`, the QA suite.
2. **Screen Stage 1** (2 d): swipe and buttons, stamps, piles, note and reasons, how-to card, result board.
3. **Stage 2 + wiring** (1 d): wrap and label, the `useCleaningGame` branch, skip, Prep Cook, Pre-Service Check / Closing Time rows.
4. **Art wiring** (1 d): the build step (cut by shape, WebP, ≤ 350 KB for the kit), art QA.
5. **Playtest and tune** (1 d): e2e, screenshots at 320 × 568 / 360 × 640 / 390 × 844 / 430 × 900 / 768 × 1024, then the developer's real-phone pass.

## 11. Decisions for the developer (recommendation first)

- **D1. Two stages in one screen?** (Recommended) Yes: swipe (Throw out spoiled food) and wrap-and-label (Wrap and label), each finishing only its own chore.
- **D2. Only open when there is something to judge?** (Recommended) Yes; otherwise the chore stays one tap. (Option) Always open, and pad a quiet night with the freshest-looking cards: it is more game but less honest.
- **D3. Any real effect?** (Recommended) No: Hype and pins only. (Option) a perfect night trims tonight's waste value a little (touches the economy tests).
- **D4. Spoiled twins (§9.3)?** (Recommended) Yes, as Phase 2 polish after the kit; ship Phase 1 first with the overlays.
- **D5. Show the "Use by" labels in the Inventory fridge later?** (Recommended) Later; not in the base plan.
- **D6. Name.** "Fridge Check" (recommended) or "Fresh or Spoiled?".
- **D7. Asset folder.** `D:\WORKS\GAMES\Knife Craft\Fresh Check Assets` (recommended; the Stockroom folder stays untouched).

## 12. Risks

- **Too few judgeable nights.** Mitigated by the measurement step and the one-tap fallback (§3.4).
- **The spoiled look does not match every ingredient.** Mitigated by the optional twins; the rule cues (icon, "bought N days ago") carry the answer meanwhile.
- **Swipe on touch.** The shell scales the screen, so thresholds use screen pixels like the sorting games' drag; buttons and arrow keys are the safe path; the card uses `touch-none` like the sorting pieces.
- **Two chores, one screen.** Each stage completes only its own chore, tested.
- **Tuning by simulation only**: a real-phone pass is still needed.
