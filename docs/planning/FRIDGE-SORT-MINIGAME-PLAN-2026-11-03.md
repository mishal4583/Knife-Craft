# Fridge Sort — "Put the delivery away" mini-game (plan + Codex asset prompts)

Status: PLAN ONLY (developer idea 2026-11-03, concept image `images/75.png`). No game code written. Decisions the developer must make are in §9.
Where it would live: Inventory (the fridge) and the Market's "order arrived" moment. It never changes money, stock or the economy baselines.

---

## 1. The idea in one line

After a Market purchase arrives, the player can tap **"Put it away"** and drag (or tap) the ingredients into the right fridge shelves before a short timer ends.
Fast and clean sorting gives stars and a small non-money reward. Skipping it costs nothing: the food is already in the Business Inventory.

Why it is worth building (the developer's goal is real revenue: long sessions, return visits, rewarded-ad moments):
- It fills the dead moment right after every purchase with a 30–50 second "hands-on" toy, the kind of loop short-session players love.
- It shows the fridge the player paid for ($2,000 / $4,800 upgrades): a bigger fridge means a bigger, more fun puzzle, which is a reason to upgrade.
- It gives a repeatable star score to chase, plus collectible fridge magnets: a reason to come back.
- It is the natural place for one more optional rewarded-ad offer (see §9, needs an explicit yes).

## 2. Rules it must obey (from CLAUDE.md)

| Rule | What it means here |
|---|---|
| Inventory is read-only (§7) | The game NEVER adds, removes or moves stock. It only reads which ingredients just arrived. Quantities stay in Business Inventory. |
| One wallet, one ledger | The game moves **no money** and writes **no ledger entry**. |
| Never required to progress | Always skippable ("Later"). No level, service or Pre-Service Check depends on it. |
| No new top-level save field | State lives in `SaveData.business.fridgeSort` (optional, nested migration in `SaveManager`). Old saves read as "nothing pending". |
| Determinism | Item order and spawn come from the seeded generator (seed = delivery id), never `Math.random()`. |
| Short game copy | Icons and numbers on screen; any explanation behind an ⓘ (`InfoTip`). `ui-copy-qa` guards it. |
| Touch ≥ 48 px, 540×960 logical, no sideways scroll | Test at 320×568, 360×640, 390×844, 430×900, 768×1024. |
| Audio synthesized only | New cues are made in `AudioManager.ts` (pick up, place, wrong, combo, tick, finish). No sound files. |
| No external fonts or network | Fraunces / Nunito / Caveat only. All art bundled. |
| Analytics through `sendAnalyticsEvent` only | `fridge_sort_started`, `fridge_sort_completed` (stars, items, mistakes, seconds), snake_case, no personal data. |
| Ads | Rewarded only, one placement per spot, says what it gives first, daily cap, one `rewarded-ad` ledger entry if it pays money. NOT included until the developer says yes. |

## 3. Gameplay spec (proposal, numbers to be tuned by the QA suite)

**Trigger.** A purchase in the Market that arrives sets `business.fridgeSort.pending` (the ingredient ids of that delivery, at most 12 per crate; the rest wait for the next crate). Entry points:
1. The Market "order arrived" sheet gets a second button: **📦 Put it away**.
2. The Inventory fridge header shows the same button while a crate is pending (badge with the item count).
Starting a new purchase replaces an unsorted crate (nothing is lost; the stock is in the Inventory either way).

**Shelves = the real fridge tier** (`refrigeratorDefinitions.ts`; the fridge tier is the difficulty):

| Fridge | Zones (shelves) | Crate size |
|---|---|---|
| Basic (40) | 3: Vegetables & Fruit · Cold (dairy, protein) · Pantry basket | up to 8 |
| Commercial (100) | 4: Vegetables · Fruit · Leafy & Herbs · Cold | up to 10 |
| Professional (240) | 5: Vegetables · Fruit · Leafy & Herbs · Dairy · Meat & Fish | up to 12 |

**Which ingredient goes where** (all 57 ingredients, checked by a test that every id has exactly one zone per tier):
- *Leafy & Herbs:* lettuce, spinach, cabbage, celery, basil, parsley, cilantro, springonion, asparagus.
- *Vegetables:* the other vegetables that keep cold (tomato, carrot, cucumber, mushroom, pepper, zucchini, eggplant, broccoli, cauliflower, radish, beetroot, greenbean, fennel, artichoke, peapod, chilli, corn).
- *Pantry basket (not the fridge, on the counter):* onion, potato, sweetpotato, pumpkin, turnip, garlic, ginger, bread, baguette, watermelon, coconut. (A small real-life lesson, and a pleasant "trap": the player learns not everything goes cold.)
- *Fruit:* strawberry, apple, orange, lemon, avocado, pear, peach, pineapple, mango, kiwi, pomegranate, grapes, lime.
- *Cold / Dairy / Meat & Fish:* cheddar, mozzarella, butter, tofu · chicken, steak, salmon.
(On Basic, Leafy folds into Vegetables and Fruit shares the first shelf; Dairy and Meat share Cold.)

**Controls.** Drag an item to a shelf, OR tap an item then tap a shelf (accessibility and phones in a bus). Correct: the item snaps in with a pop and a tick. Wrong: it springs back, the combo resets, no time penalty (gentle).
**Timer.** `20 s + 2.5 s × items` (8 items = 40 s, 12 items = 50 s). The timer never makes the player lose anything: at zero the round ends with the stars earned so far.
**Score.** 100 per correct item × a combo multiplier (+0.25 per item in a row, up to ×3), +20 per second left on a full sort. The star bar fills with the score; stars at 50 % / 75 % / 95 % of the best possible score (to be tuned).
**Reward (non-money, once per crate):**
- ★ +5 · ★★ +10 · ★★★ +15 **Hype** (the existing Second Floor meter, `addHype`; 100 Hype starts the free 3-minute ×3 Rush).
- A **fridge magnet** on the fridge door for the first ★★★ of each ingredient group (12 collectible magnets, shown in the Inventory fridge).
- Achievements: "Tidy Fridge" (10 crates), "Perfect Crate" (5 ★★★ crates).
- Replaying a crate gives no second reward (nothing to farm: crates only come from real purchases).

**Never negative, never stuck:** no timer penalty, no lost stock, no forced play, Reduced Motion removes the flying/popping animation (items just appear in place), and the Pause button freezes the clock.

## 4. Technical plan

New files (reuse the existing UI primitives; React DOM + CSS, no Phaser, no animation library):
- `src/game/business/fridgeSort.ts` — PURE rules: `zonesForTier`, `zoneOf(ingredientId, tier)`, `makeCrate(seed, delivery, tier)`, `timeLimitMs`, `scoreRound`, `starsFor`, `rewardFor`, `reducePending`. No I/O, no money.
- `src/components/kc/inventory/FridgeSortGame.tsx` — the screen (pointer events for drag, tap-select fallback, `data-testid` hooks), `FridgeSortButton.tsx` for the two entry points.
- `ScreenId "fridgeSort"` in `components/kc/data.ts` + `ScreensRouter`.
- Save: `business.fridgeSort?: { pending?: IngredientId[]; crateId?: number; bestStars?: number; totalStars?: number; magnets?: string[]; perfect?: number }` with the nested-migration pattern (missing = empty). Hype goes through the existing `addHype`.
- Market hook: where a purchase is committed (the Market is the only place to buy), set `pending`. Exactly one place; found in the Market commit path.
- `AudioManager.ts`: six synthesized cues.
- Tests: `scripts/fridge-sort-qa.mts` (every one of the 57 ingredients has a zone in every tier; crates deterministic for a seed; scoring and stars table; reward granted once per crate; **no change to credits, inventory or ledger**; old saves read as empty; never-negative), browser `tools/e2e/fridgesort.mjs` (drag and tap paths, timer end, skip, 320 px layout, Reduced Motion), additions to `ui-copy-qa` and `unused-assets-qa`.

Phases (each ends with the gates in CLAUDE.md §5):
- **P0 (decision, 0.5 day)** — the questions in §9.
- **P1 pure rules + tests (1 day)** — `fridgeSort.ts`, the save field, `fridge-sort-qa`.
- **P2 playable with PLACEHOLDERS (2 days)** — the screen using emoji on round plates (the same look as `ItemTile`) and CSS shelves. Fully playable before any art exists, so art never blocks the work.
- **P3 art integration (1–1.5 days)** — drop the generated WebP in, 9-slice the UI, measure the budget.
- **P4 polish (1 day)** — synthesized sound, combo feedback, Reduced Motion, analytics, the browser test, the real-device pass.

## 5. Art budget and pipeline

- All art is WebP, designed at **2× the logical 540×960** screen (so the full background is 1080×1920).
- Total new art target: **≤ 1.3 MB** (the project already has 8 MB of assets; the oven film is 295 KB). Item sprites ≤ 9 KB each; backgrounds ≤ 180 KB each.
- Source PNGs from Codex go to `art-source/fridge-sort/` (reference-only, not in the build). A script `scripts/make-fridge-sort-assets.py` (like `make-oven-bread-video.py`) slices the sheets, removes the background if needed, resizes, and writes `src/assets/fridge-sort/*.webp`.
- **Ingredients are emoji in the game today** (`ItemTile`, the Market). So painted item sprites are the one big art cost: 57 ingredients. Plan: P2 ships on emoji; P3 adds the painted sprites; any missing sprite falls back to the emoji on a round plate. This means art can arrive in batches.
- Reused (not regenerated): `src/assets/ui/pointer-hand.webp` (the tutorial hand), the game's Fraunces / Nunito / Caveat fonts (ALL text is drawn in code, never baked into art), `src/assets/kitchen/skin-0x.webp` as the wall behind the fridge if one fits.

## 6. Style bible (paste this at the top of EVERY Codex image request)

```
STYLE BIBLE — KnifeCraft "Sort & Store" mini-game art.
A warm, cozy, hand-painted mobile-game look in the same family as the reference concept image: soft painterly shading, gentle rim light,
rounded chunky shapes, a thin darker outline in a warm brown (never pure black), rich but not neon colors, wood and paper textures,
a cheerful rustic kitchen. Light comes from the top-left, warm golden (about 3200 K), with a soft shadow falling bottom-right.
Everything must look like it belongs to ONE set: same line weight, same softness, same saturation.
STRICT RULES: NO text, NO letters, NO numbers, NO logos, NO brand names, NO watermarks, NO signature, NO people or hands,
NO UI chrome unless the asset IS the UI piece. Blank plaques and blank tags stay BLANK (the game draws the words itself).
Output: PNG with a TRANSPARENT background (alpha) unless the asset says "full scene". If transparency is not possible, use a flat
pure chroma green #00FF00 background with no green anywhere in the subject and no shadow on the background.
Keep a clear margin of about 4% around the subject so nothing is cut off. Do not crop the subject.
Deliver ONE image per request, exactly the size asked.
```

Workflow tip: use ONE Codex conversation per group (so the style stays the same), attach `images/75.png` (the concept) as the style reference, ask for 4 variants of each prompt, pick the best, and re-use the picked one as the reference for the next piece.

## 7. Asset list (what is needed, in priority order)

| # | Asset | File (after the script) | Size (px) | Layers/notes | Needed for |
|---|---|---|---|---|---|
| A1 | Open fridge, empty interior, 4 shelf bands | `fridge-body.webp` | 1000 × 1300 | the cabinet only (door separate); the shelves must be flat horizontal bands the game can overlay | P3 (placeholder = CSS) |
| A2 | Open fridge door | `fridge-door.webp` | 380 × 1100 | door shelves with jars and a note, attached on the right | P3 |
| A3 | Wall / room behind | `sort-bg.webp` | 1080 × 1920 | OPTIONAL: reuse a `kitchen/skin-0x` first | P3 |
| A4 | Wooden crate, BACK part | `crate-back.webp` | 1000 × 420 | the inside of the crate | P3 |
| A5 | Wooden crate, FRONT part with cloth | `crate-front.webp` | 1000 × 420 | overlays the items so they sit inside the crate | P3 |
| A6 | Pantry basket (wicker) | `pantry-basket.webp` | 640 × 360 | the "not in the fridge" zone | P3 |
| A7–A11 | Painted ingredient sprites, 5 sheets of 12 cells (57 items) | `ing-<id>.webp` ×57 | 192 × 192 each | cells 256 × 256 in the sheet | P3 (emoji until then) |
| A12 | HUD plaques sheet (timer, score, pause, shelf tag) | `hud-*.webp` | 4 pieces | blank, 9-slice friendly | P3 |
| A13 | Star progress bar (frame + fill) | `starbar-*.webp` | 720 × 90 | the fill is a separate strip | P3 |
| A14 | Stars (full, empty, big result star) | `star-*.webp` | 3 × 160 | | P3 |
| A15 | Checklist board (parchment on a nail), blank | `board.webp` | 420 × 560 | 9-slice | P3 |
| A16 | Result ribbon + panel, blank | `result-*.webp` | 900 × 700 | 9-slice | P3 |
| A17 | Fridge magnets sheet (12 magnets) | `magnet-*.webp` ×12 | 128 × 128 each | collectibles on the door | P3/P4 |
| A18 | Optional glass bins (drawer) | `bin.webp` | 940 × 220 | OPTIONAL (CSS glass if too hard) | P4 |

Not needed as art: the glow ring around the target shelf (CSS), the flying arrow trail (CSS), sparkles/confetti (CSS), all sounds (synthesized), the tutorial hand (exists).

## 8. Codex prompts (paste the STYLE BIBLE first, then one prompt)

**Ready to paste:** `FRIDGE-SORT-CODEX-PROMPTS-2026-11-03.md` has every prompt below already combined with the style bible (nothing to assemble). The text here is the source.

### A1 — fridge body
```
[STYLE BIBLE]
ASSET A1: an open vintage-style kitchen refrigerator, front view, centered, EMPTY inside. Rounded 1950s shape, mint-green enamel body with a
cream-colored interior, a small blank metal name plate on the top front (no text on it), two warm lamps lit on the inside ceiling.
Inside there are exactly FOUR flat horizontal shelves of equal height with a clear, empty, evenly lit glass-and-steel shelf on each,
slightly below eye level, so items can be laid over each shelf later. The DOOR IS NOT PART OF THIS IMAGE (leave the right edge as a clean
vertical cut of the cabinet frame). Transparent background outside the cabinet. 1000 x 1300 px, portrait.
```

### A2 — fridge door
```
[STYLE BIBLE]
ASSET A2: the open door of the same mint-green vintage refrigerator, seen from the INSIDE, attached edge on the left of the image.
Three white door shelves holding a few jars of spices, a bottle of oil and a bottle of milk, all with BLANK labels (no text).
On the OUTER side of the image (right side) leave the door's thick rounded rim. Two blank paper notes held with small magnets near the
bottom (one checklist note with ONLY tick-mark shapes and no words, one note with a tomato doodle). A little ivy leaf at the top corner.
Transparent background. 380 x 1100 px, portrait.
```

### A3 — room behind (optional)
```
[STYLE BIBLE]
ASSET A3 (FULL SCENE, no transparency): a cozy rustic restaurant kitchen wall seen straight on, warm brick, a wooden shelf with jars and
a copper pot, hanging ivy at the top, a warm lamp glow on the left, a dark soft vignette at the corners. The center is calm and
uncluttered so a refrigerator can stand in front of it. The bottom 20% is a worn wooden counter top. No people, no text.
1080 x 1920 px, portrait.
```

### A4 — crate back / A5 — crate front
```
[STYLE BIBLE]
ASSET A4: the BACK half of a rustic wooden produce crate seen from slightly above and in front: only the inside of the far wall and the
side walls and an empty dark-wood floor, ready for fruits and vegetables to be placed on top of it. Rope handle holes on the sides.
Transparent background. 1000 x 420 px.
```
```
[STYLE BIBLE]
ASSET A5: the FRONT half of the SAME wooden produce crate: only the near wall (planks, nails, a blank painted label area with NO text)
and a red-and-cream checkered kitchen cloth draped over the front rim. The top edge must be a clean straight line so items placed behind
it look as if they are inside the crate. Transparent background above the rim. 1000 x 420 px. Match the wood color and the grain of A4.
```

### A6 — pantry basket
```
[STYLE BIBLE]
ASSET A6: an empty wide wicker basket with a linen liner, seen from slightly above, rim only (the inside is soft and empty), placed on a
small wooden board. Warm rustic look, same colors as the crate. Transparent background. 640 x 360 px.
```

### A7–A11 — painted ingredient sprites (5 sheets, same prompt shape)
Sheet layout: **4 columns x 3 rows**, each item centered in an equal 256 x 256 cell, same scale (about 80% of the cell), the whole sheet 1024 x 768 px, transparent background, NO grid lines, NO labels, NO shadows crossing cells. Each item is a single, whole, fresh ingredient (a little glossy highlight, tiny water droplets on vegetables and fruit), the same lighting from the top-left. Cells in READING ORDER (left to right, top to bottom); a cell marked EMPTY stays empty.
```
[STYLE BIBLE]
ASSET A7 — sheet of 12 ingredient icons, 4 columns x 3 rows, 1024 x 768 px, transparent background, no grid lines, no text.
Cells in order: tomato, carrot, cucumber, onion, potato, mushroom, bell pepper, zucchini, eggplant, broccoli, corn cob, celery.
```
```
ASSET A8 — same style, same layout (4x3, 1024 x 768, transparent). Cells in order:
lettuce head, cabbage, cauliflower, spinach bunch, asparagus bundle, radish, beetroot, sweet potato, green beans, fennel bulb,
artichoke, pea pod.
```
```
ASSET A9 — same style and layout. Cells in order: pumpkin, turnip, red chilli pepper, spring onion bunch, garlic bulb, ginger root,
basil bunch, parsley bunch, cilantro bunch, round loaf of bread, baguette, EMPTY.
```
```
ASSET A10 — same style and layout. Cells in order: strawberry, red apple, orange, lemon, avocado (halved with the pit visible),
pear, peach, pineapple, watermelon wedge, mango, kiwi (halved), pomegranate (halved).
```
```
ASSET A11 — same style and layout. Cells in order: bunch of grapes, coconut (halved), lime, cheddar cheese wedge, mozzarella ball,
butter block (half wrapped in paper with NO text), tofu block, raw chicken leg, raw steak, raw salmon fillet, EMPTY, EMPTY.
```
Tip for the script that slices them: the cell order above is the ingredient order, so `ing-<id>.webp` is named from the list in
`INGREDIENTS` (tomato, carrot, cucumber, onion, potato, mushroom, pepper, zucchini, eggplant, broccoli, corn, celery, lettuce, cabbage,
cauliflower, spinach, asparagus, radish, beetroot, sweetpotato, greenbean, fennel, artichoke, peapod, pumpkin, turnip, chilli,
springonion, garlic, ginger, basil, parsley, cilantro, bread, baguette, strawberry, apple, orange, lemon, avocado, pear, peach,
pineapple, watermelon, mango, kiwi, pomegranate, grapes, coconut, lime, cheddar, mozzarella, butter, tofu, chicken, steak, salmon).

### A12 — HUD plaques
```
[STYLE BIBLE]
ASSET A12: a sheet with FOUR separate pieces on a transparent background, spaced apart, 1600 x 520 px total, in a row:
(1) a wide dark-walnut wooden plaque with a thin gold-leaf trim and ivy leaves at the corners, BLANK, for a timer (about 560 x 170 px);
(2) a smaller walnut plaque with the same trim, BLANK, for a score (about 400 x 150 px);
(3) a round walnut pause button with a gold rim and TWO blank dark vertical bars NOT drawn (leave the face plain), 150 x 150 px;
(4) a small cream paper shelf tag on a short string, BLANK, 260 x 100 px.
The plaques must be 9-slice friendly: the corners are decorated, the middle is plain wood grain that can stretch.
```

### A13 — star progress bar
```
[STYLE BIBLE]
ASSET A13: a long horizontal rounded wooden frame (the empty progress bar) 720 x 90 px with a dark inner groove, and BELOW it as a
separate piece the matching fill strip: a glossy gradient from lime green to golden yellow, 700 x 56 px, rounded ends.
Three empty round star sockets sit ON the frame at 40%, 70% and 100% of its length. Transparent background, no text.
```

### A14 — stars
```
[STYLE BIBLE]
ASSET A14: three separate stars in a row on a transparent background, 160 x 160 px each: a glossy golden star with a warm outline,
an EMPTY dark-brown carved-out star socket, and a big glowing golden star with soft sparkles. Same shape in all three.
```

### A15 — checklist board
```
[STYLE BIBLE]
ASSET A15: a rustic parchment checklist board hanging from a small nail, 420 x 560 px, BLANK (no text, no lines of text), with a darker
worn-paper border and a wooden top bar. The middle is plain parchment so the game can draw four rows on it. 9-slice friendly corners.
Transparent background.
```

### A16 — result panel
```
[STYLE BIBLE]
ASSET A16: a result panel for the end of a round: a cream paper card with a warm wood frame, a blank red-gold ribbon banner across the
top (NO text), and a small wooden crate icon at the bottom corner. 900 x 700 px, 9-slice friendly, plain middle. Transparent background.
```

### A17 — fridge magnets (collectibles)
```
[STYLE BIBLE]
ASSET A17: a sheet of TWELVE glossy fridge magnets, 4 columns x 3 rows, each centered in an equal 256 x 256 cell (sheet 1024 x 768),
transparent background, a thin white edge around each magnet like a sticker, a tiny drop shadow inside the cell only.
In order: tomato, carrot, apple, lemon, cheese wedge, fish, chef hat, whisk, star, heart, chili pepper, mushroom.
```

### A18 — glass bin (optional)
```
[STYLE BIBLE]
ASSET A18 (OPTIONAL): an empty transparent glass-and-steel fridge drawer bin, front-three-quarter view, with a soft white frosted rim,
940 x 220 px, a see-through look that works on top of a lit fridge shelf. Transparent background.
```

## 9. Decisions for the developer (my recommendation first)

1. **Rewards.** Recommended: Hype + magnets + achievements (no money, no spoilage change, economy baselines untouched). Hype feeds the Second Floor Rush, so it is real value without touching the wallet.
2. **A rewarded-ad offer** (for example "watch to double the Hype from this crate", or "+15 s"). Recommended: add it in P4 only if you say yes; it needs its own `AD_PLACEMENT`, a daily cap and a line in `ads/adBonuses.ts`.
3. **Ingredient art.** Recommended: ship P2 on emoji, add the 57 painted sprites in P3. Alternative: only the 24 most common ones first (sheets A7, A8 and A10) and emoji for the rest.
4. **Optional vs required.** Recommended: always optional. (A required version would turn every purchase into a chore and break "never needed to progress".)
5. **Night-chore link.** The closing chore "Wrap and label what's left in the fridge" (Level 21+) could open this game as its hands-on version. Recommended: not in the first version; look at it after the numbers come in.
6. **Does a well-sorted fridge matter for the economy?** Recommended: NO (cosmetic and Hype only). A freshness bonus would change spoilage and break the frozen economy baselines.

## 10. Risks

- Art volume (57 sprites + ~15 pieces) is the main cost: mitigated by the emoji fallback and the sheet workflow.
- Dragging on small phones: mitigated by the tap-tap fallback and ≥ 48 px targets.
- AI sheets rarely keep a perfect grid: the slicing script crops by the cell grid and trims; any wrong cell is regenerated alone with the same style bible.
- The concept image has a text-like brand plate on the fridge: the prompts forbid any text and logo.
