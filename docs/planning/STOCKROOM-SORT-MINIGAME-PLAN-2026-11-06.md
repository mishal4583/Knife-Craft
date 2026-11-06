# Stockroom Sort — "Match 3 and stock the shelves" (detailed plan)

Status: BUILT 2026-11-06 (see the top of docs/HANDOFF.md for what shipped and what differs from this plan: boards are built backwards and solver-checked, the whole art folder is 451 KB, no achievements yet).
Developer idea 2026-11-06 (reference: the "Goods Puzzle: Sort Match" screenshots): when the player buys things in the Market, the delivery arrives as sets of 3 of the same product; the player sorts them onto the inventory shelves before a timer ends. It starts tiny and grows with the restaurant.
Companion file with every Codex art prompt: `STOCKROOM-SORT-CODEX-PROMPTS-2026-11-06.md` (assets are saved to `D:\WORKS\GAMES\Knife Craft\Iventory Assets`; the folder name keeps the developer's spelling).
Decisions the developer must make are in §10 (my recommendation first); the plan below assumes the recommendations.

**Short answers**
- **What is it?** A shelf of wooden cubbies, 3 slots each. The bought goods are scattered across them, mixed. Tap a product, tap a free slot, and move it. Three of the same product in one cubby = "stocked" (they pop into the stockroom). Stock them all before the timer ends.
- **How is it different from Fridge Sort?** Fridge Sort (done) is "which shelf does this food go to" (knowledge, perishable food, ingredients). Stockroom Sort is "group three of a kind" (a spatial puzzle) for the shelved goods, the Supplies. Two different brains, so the Inventory gets two toys, not one repeated.
- **Which purchases?** Supplies (the 62 tools, tableware, packaging and cleaning items). Ingredients keep Fridge Sort. The engine does not care what the goods are, so ingredients can be added later (§10 D1).
- **Which level?** The first supply purchase: the kitchen-tools shopping list at Level 10. It grows in five tiers (§4).
- **Does it cost or give money?** Never costs. Never changes quantity, price, credits or the ledger (the Inventory stays the single truth). It gives Hype and collectible shelf badges, like Fridge Sort (§6).
- **Art?** 20 new images (§8, prompts in the companion file). The 62 supply pictures are redrawn as chunky "goods" (the current ones are small photo-like icons that do not read as bold shapes in a 52 px slot). HUD, star bar, result board and wall are reused from Fridge Sort.
- **How big?** About 8 working days (§9).

---

## 1. Why build it (the developer's goal is real revenue)

- A match-3 sort is the most proven "one more round" loop on web portals (the reference game is on Playgama itself). It fits a 30–60 second slot after every purchase.
- Every Market supply purchase becomes a short, skillful moment instead of a dead tap, so sessions get longer without adding any required chore.
- It gives repeatable star scores, 12 collectible shelf badges, and the same "big delivery" bonus as Fridge Sort: a reason to buy for several days at once ("Buy everything needed" becomes the fun button).
- It adds rewarded-ad moments that are optional and honest (undo, extra shelf, +time), each needing an explicit yes (§10 D4).

## 2. How it connects to the main game

| Where | What happens |
|---|---|
| Market → buy a supply (or "Buy everything needed") | The purchase commit adds the goods to the supply crate (`business.stockroomSort.crate`). A toast/chip says "📦 Stock the shelves · N". |
| Inventory → Supplies tab | A chip at the top opens the game when goods wait. The tab already shows the stockroom picture (`public/inventory/supplies-stockroom.webp`): the same room is the game's backdrop, so the game feels like "the same stockroom, up close". |
| Pre-Service Check | A one-time "Stockroom Sort" news line at the unlock level (same mechanism as the Level 3 Fridge Sort news, `RestaurantNews.minigame`). |
| Practice | A button on the how-to card runs a free practice board (no reward, no crate used). |
| Staff | A hired Prep Cook can put the crate away on its own (no stars, no Hype), same as Fridge Sort's `autoPutAway`. Nothing is ever required: the player can ignore the chip forever. |

Rule kept from Fridge Sort: the game only **shows and sorts**. Inventory is read-only (CLAUDE §7); the game never touches `inventory`, `supplies` quantities, `credits` or `economyLedger`.

## 3. How the game works

### 3.1 The board
- A shelf unit of **cubbies** (compartments), each with **3 slots in a row**, staggered in rows like the reference. At 390 px wide a row holds 2 cubbies, each slot is about 52 px. At most 10 cubbies on a board.
- A **set** = 3 identical pieces of one product (3 dinner plates, 3 whisks). A board holds S sets (S = 1 at the start, up to 8).
- Goods are placed mixed across the cubbies at the start. There are always **spare cubbies** (empty) so the board is never stuck.

### 3.2 Moves
- **Tap a piece** (it lifts and its name shows), **tap a cubby with a free slot** (it hops in). Dragging works too.
- A piece can go to any free slot in any cubby (no colour rule): the puzzle is *planning*, not guessing.
- **Match:** when one cubby holds 3 identical pieces, they glow, pop into a small carton, and the cubby is free again ("stocked"; +points, a counter flies up).
- **Win:** every set stocked. **Time out:** the round ends with what was stocked; the rest stays in the crate for the next board. Nothing is lost, nothing is punished.

### 3.3 Fair by construction
- The board is built **backwards from the solved state**: start with S full cubbies, then apply K random legal "reverse moves" (a piece into a free slot elsewhere), seeded (`business.stockroomSort.seed`, no `Math.random()`). So every board is solvable.
- A small solver/greedy counts the **minimum moves**; the timer is built from it: `time = (12 s + 1.9 s × minMoves) × tierFactor`, tierFactor 2.0 / 1.6 / 1.3 / 1.1 / 1.0 for tiers 1–5. (Tuned by simulation in the QA suite, like Fridge Sort.)
- Boards that start with a cubby already holding a triple are re-rolled.

### 3.4 Stars, points, help
- Points: a stocked set = 100, a quick second set in 4 s = combo ×2/×3, spare time at the end = 20 points a second (same shape as Fridge Sort's score so the shared result board can be reused).
- Stars: 1 star = at least half the sets stocked; 2 = all sets; 3 = all sets with at least 40 % of the time left. (`STAR_AT` equivalent, kept in one table.)
- Help that is always free: **Undo** (unlimited in tiers 1–2, 3 uses after), **Hint** pulse on a useful move (tiers 1–3 always, tier 4 after a wasted move, tier 5 never).
- Optional boosters (rewarded ad, each needing an explicit yes): **Extra shelf** (+1 empty cubby), **+15 s**, **Shuffle**. Never needed to progress.

### 3.5 Encouragement and clarity (lessons from the Fridge Sort feedback)
The developer's playtest said: unclear instructions, no connection, introduced too late, feels like another game. So, from day one:
- **How-to card** (4 icon steps: Tap a product / Tap a free slot / 3 alike = stocked / Beat the clock) opens by itself until the first round is finished, and always from a visible "?" button.
- **A pointing hand** on the first piece and the target cubby in the first 3 rounds.
- A **note line** says what to do next in plain words, and what went right ("3 plates stocked!").
- **Praise** at 2, 3 and 4 sets in a row (blank ribbons drawn by the game with words).
- The **delivery slip** at the top lists what was bought with pictures and ×3 (so the player sees "my purchase is these pieces").
- Same painted look as the rest of the Inventory, so it never feels like a different game.

## 4. Difficulty ladder (low → high as the restaurant grows)

Proposed unlock levels (confirm the supply unlock numbers against `restaurantProgression.ts` when building; the tool shopping list is Level 10 and tableware/cleaning arrive with Dine-in):

| Tier | From level | Sets per board | Cubbies | Rows | Extras | Timer factor | Hint |
|---|---|---|---|---|---|---|---|
| 1 Learn | 10 | 1–2 | S + 2 (3–4) | 1–2 | none; free undo | ×2.0 | always |
| 2 Easy | 19 | 3–4 | S + 2 (5–6) | 2–3 | none | ×1.6 | always |
| 3 Busy | 31 | 5–6 | S + 1 (6–7) | 3 | none | ×1.3 | after a wasted move |
| 4 Stacked | 44 | 6–8 | S + 1 (7–9) | 3–4 | **depth 2**: a hidden row behind some pieces (greyed until the front clears) | ×1.1 | never |
| 5 Full stockroom | 74 | 8 (+ chained boards) | S + 1 (9–10) | 4–5 | **locked cubbies** (open when a neighbour is stocked) and **mystery parcels** (wrapped; the product shows when picked) | ×1.0 | never |

Why this matches "buy little first": a Level 10 shopping list is 2–3 tools, so the first board is 1 set (3 pieces, 2 moves). A Level 80 "Buy everything needed" can be 20+ sets, which becomes several chained boards (§5).

## 5. From a purchase to a board (and "too little / too much")

- **Sets per product line:** 1–2 packs bought = 1 set; 3–5 packs = 2 sets; 6+ = 3 sets (cap 3). The cap keeps one bulk line from swamping the board. (Proposal; tuned with the same measuring script style used for Fridge Sort.)
- **Too little (one tool):** a single set is a valid 3-piece board (the tutorial). It is quick and always 3 stars at the start.
- **Perfect:** 2–4 lines = one board of 2–6 sets.
- **Too much:** more than 8 sets (or 10 cubbies) splits into **boards** ("🧺 +N more shelves · ⚡ bonus for all"). Put every board away with at least one star and the **big delivery bonus** is paid: the Fridge Sort rule reused as is: +5 Hype for each board after the first, max +20 (`bigDeliveryHype`). A 3-day buy therefore *means* more fun and more reward, not a chore. "Buy everything needed" is the natural trigger.
- The Market's supplies panel shows the "📦 N shelves" chip with an ⓘ, like the Plan ahead chip for ingredients.
- A measuring script (like the one that produced the Fridge Sort demand table) runs the simulated campaign and reports sets per purchase and boards per level, so the tier table is checked against real purchases before it is locked.

## 6. Rewards (never money, never stock)

- **Hype:** the same table as Fridge Sort (`HYPE_BY_STARS` 0 / 5 / 10 / 15), plus the big-delivery bonus. A practice round gives nothing.
- **Collectibles:** 12 **shelf badges** (enamel pins / brass tags) earned at star milestones (first board, 10 boards, 3 stars ×5, a big delivery, a 6-set board with no undo ...). They show in the Inventory Supplies tab, like the 12 fridge magnets. Achievements for them extend the existing list.
- **No effect on the economy:** unlike Fridge Sort's freshness, supplies do not spoil, so there is nothing real to protect. (An optional real effect, "fewer breakages after 3 stars", is D3 in §10; it would touch the economy tests, so it is not in the base plan.)

## 7. Where it lives in the code (reuse, never duplicate)

New files, small and pure first:
- `src/game/business/stockroomSort.ts`: rules only (no React). Exports the tier table (`STOCKROOM_TIERS`), `STOCKROOM_FIRST_LEVEL = 10`, `setsFor(packs)`, `addToSupplyCrate(save, lines, level)`, `makeBoard(state, level)` (reverse-play generator), `minMoves(board)`, `timeLimitMs`, `applyMove`, `finishBoard` (effects), `boardsLeft`, `autoPutAway`, `stockroomSortOf` (sanitizer).
- State `business.stockroomSort` (extends `business`, nested migration pattern; no new save field): `{ crate: {id, packs}[], seed, best, stars, perfect, rounds, chain?, badges }`. An old save has none and reads as empty.
- `src/components/kc/inventory/StockroomSortGame.tsx` (screen) and `StockroomSortChip.tsx`.
- **Shared with Fridge Sort** (extract once, do not copy): the HUD (timer / score / round tag), the star bar, the result board, the how-to card shell, the note line. A short refactor of `FridgeSortGame.tsx` moves them to `src/components/kc/inventory/sort/` (behaviour unchanged, its QA must stay green).
- Entry points: the purchase commit in `App.tsx` (`purchaseSupply`, the "Buy everything needed" path); `InventorySupplies.tsx` chip; Pre-Service news (`restaurantNews.ts`); Market supplies panel chip.
- Art build: `scripts/make-market-assets.py` gets a `build_stockroom()` step (cuts the 6 goods sheets and the kit, writes WebP to `public/business/stockroom/`). Budget: whole folder ≤ 470 KB. `market-art-qa` H1's need list gains the new files.

Rules to keep: seeded generator only; whole-number state; old saves work; touch targets ≥ 48 px (a slot is 52 px, a cubby is the target); text sizes per CLAUDE §10; copy stays short (longer words behind an ⓘ, `ui-copy-qa`); no external requests; no new animation libraries (CSS transform/opacity only).

## 8. Art (summary; every prompt is in the companion file)

Style: the existing warm painted Inventory look (walnut wood, brass, sage green, cream, ivy), as seen in `public/inventory/supplies-stockroom.webp`, `ingredients-stockroom-upgraded.webp` and the Fridge Sort set. The reference screenshots are for the *mechanic and the 3-slot cubby idea only*: no brand names, no bear mascot, no copying of their characters or packaging.

| Id | What | Size |
|---|---|---|
| I01 | Backdrop: supplies stockroom (dark green wall, warm lamp, counter) | 1080×1920 |
| I02 | Backdrop: pantry stockroom (brick, crates, lantern) for the ingredient mode | 1080×1920 |
| I03 | The wooden cubby (3 slots, open front) | 960×560 |
| I04 / I05 | Shelf-unit top cap and plinth | 1200×140 / 1200×120 |
| I06 | Padlock closed + open (locked cubby) | 512×256 |
| I07 | Mystery parcel closed + half open | 512×256 |
| I10–I15 | The 62 supply goods, 6 sheets of 4×3 (same order as the Market atlases S1–S6) | 1024×768 each |
| I20 | Booster and badge icons (undo, hint, extra shelf, +time, shuffle, blank button face, lock badge, ad badge) | 1024×512 |
| I21 | 3 blank praise ribbons + a blank starburst | 1024×256 |
| I22 | Sparkles and dust puffs for the "stocked" pop | 1024×512 |
| I23 | Blank round "stocked" stamp | 512×512 |
| I24 | Pointing glove (tutorial hand) | 256×256 |
| I25 | Delivery hand truck with cartons (chip, slip and result art) | 640×640 |
| I26 | 12 collectible shelf badges | 1024×768 |

Reused, not regenerated: the HUD plaques, star bar, result panel and kitchen wall from `public/business/fridge-sort/`.

## 9. Phases and estimate

1. **Rules + generator + QA** (2 d): `stockroomSort.ts`, board generator, solver, tier table, the `stockroom-sort-qa` suite (solvable for 5,000 seeds per tier, min-moves vs timer, sets per purchase, the crate commit path, old-save safety, never touches credits / inventory / ledger).
2. **Shared pieces refactor + screen** (3 d): extract the shared HUD/result/how-to, the board screen, tap and drag, hand, praise, sounds (synth), the how-to card.
3. **Wiring** (1 d): purchase commit, chips, Pre-Service news, Market chip, Prep Cook skip, Achievements.
4. **Art wiring** (1 d): once the 20 images are in the folder: the build step, WebP, `market-art-qa`.
5. **Playtest and tune** (1 d): headless e2e (`tools/e2e/stockroomsort.mjs`), screenshots at 320×568 / 360×640 / 390×844 / 430×900 / 768×1024, then a real-phone pass by the developer.

## 10. Decisions for the developer (recommendation first)

- **D1. Which purchases use it?** (A, recommended) Supplies only: ingredients keep Fridge Sort, so each Inventory tab has its own toy. (B) Everything from the Market, replacing Fridge Sort for new players. (C) Both, and the player picks on the chip. The engine is item-agnostic (`{kind, id}` + a picture resolver), so switching later is small.
- **D2. Start level.** (Recommended) The first supply purchase (Level 10). Supplies are not bought earlier, so an earlier start would need a purchase that does not exist yet.
- **D3. Any real effect?** (Recommended) No: Hype and badges only. (Option) fewer breakages in the next wash-up after 3 stars (touches the economy tests).
- **D4. Rewarded-ad boosters** (Extra shelf, +15 s, Shuffle): (Recommended) yes, later, one placement each, daily cap, never needed. Needs an explicit yes before any code.
- **D5. Redraw the supply pictures as chunky goods?** (Recommended) Yes (I10–I15): the current 62 are small photo-like icons, fine for a list, weak in a 52 px slot. The Market and Inventory keep their current icons, the game uses the new ones (or both can switch later).
- **D6. Name.** "Stockroom Sort" (recommended) or "Shelf Match".

## 11. Risks

- **Two similar toys.** Mitigated by different brains (knowledge vs spatial) and different purchases (food vs supplies). If playtests say "too much sorting", D1-C lets the player choose.
- **Slot readability.** A 52 px slot needs bold silhouettes: the art prompts ask for front-facing, upright, high-contrast goods; checked at 56 px before accepting.
- **Long boards at high levels.** Capped at 8 sets per board, then chained boards, and the Prep Cook button skips them.
- **Tuning by simulation only** (like Fridge Sort): the timer and stars need a real-device pass.
- **Hype farming.** Rewards need a real purchase (the crate), practice pays nothing, and the big-delivery bonus is capped at +20.
