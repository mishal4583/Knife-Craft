# Unload the Van: Cargo, Orders and Difficulty Plan (2026-11-27)

**STATUS 2026-11-27: phases 1 and 2 are BUILT** (choices in section 7 accepted: cleaning supplies yes, cosmetic only, these trapped numbers, art later). Changes while building:
- Trapped crates come at least in **pairs**: one alone cannot exist (once every other crate has left, it could drag back the way it came). So Levels 23-33 have 2 (not 1).
- The restaurant takes at most **half the doors** (rounded up), so tools, parcels and the other foods keep turning up even with an empty fridge.
- Cream is `#F6F1E4` and cardboard `#B98046` (further apart than first planned); `crate-dispatch-qa` Z1 keeps all door colours apart.

**Phase 3 (the developer's art) is BUILT too** (2026-11-27): crate skin by item, 9-sliced over the door colour with a "hard-light" blend (a plain overlay greyed the colours), the skins' own empty margins trimmed and their see-through shading lifted 35 %: fresh ingredients -> `skin-produce`; pantry products -> `skin-pantry`; chicken, steak, salmon and the dairy (milk, yogurt, cream, butter, cheddar, mozzarella) -> `skin-cold`; parcels (cardboard) -> `skin-parcel` (replaces the drawn tape); kitchen and tableware (teal) -> `skin-tableware`; cleaning (blue) -> `skin-cleaning`. `tag-delivered` / `tag-needed` replace the drawn door badges; `slip.png` is the delivery slip's background. The plain drawn crates stay as the fallback while a skin loads.

Developer request: use all of our 50+ ingredients (plus culinary tools, cutlery, parcels and so on) instead of the same few foods; plan the levels, crates and crate sizes with difficulty rising steadily; make the van carry what the restaurant actually ordered or needs, **without ever making a level easier because there is little to order**; give Codex prompts for any art needed.

## 1. Where the game is today

- **Foods:** 24, three per door colour (`CRATE_FOODS`). A level picks one per colour from the level and the day.
- **Items with pictures already in the game:** all **57** ingredients (`business/ingredients/`), **62** supplies (`business/supplies/`: cookware, cutlery, tableware, takeaway packaging, cleaning) and the pantry products (`business/sauce/products/`). Checked 2026-11-27: **140 distinct items are ready to use with no new art**.
- **Crates and doors** are drawn in code, in the door's colour, at any size. New colours and sizes need no art.
- **Difficulty, measured:** every generated board can be won **without ever moving a crate out of the way** (370 of 370 boards: 74 levels × 5 days). The player only finds a free crate and drags it to its door, again and again. Later levels have more crates, but no harder thinking. This is the main reason levels feel alike.
- **Idle doors:** 35 of 74 day-1 boards had a door with no crate. Fixed separately (2026-11-27).

## 2. The cargo: 140 items in 11 colour groups

Rule that stays: **a board uses at most one item per colour group**, so every door shows one item and every crate of that colour carries it (developer 2026-11-18, "unique for each and every ingredient"). Because only one item per group can appear, near-twins in the same group (onion/garlic, forks/knives, two kinds of pans) can never confuse each other. Five near-duplicate supply pictures are left out (dessert forks, dessert plates, side plates, teaspoons, storage containers).

| Group (door colour) | Items |
|---|---|
| Red (11) | apple, tomato, strawberry, bell pepper, pomegranate, watermelon, radish, chilli sauce, passata, paprika, chilli flakes |
| Orange (8) | carrot, orange, mango, pumpkin, sweet potato, peach, turmeric, curry powder |
| Yellow (8) | lemon, cheddar, corn, pineapple, butter, mustard, honey, veg oil |
| Green (21) | lettuce, cabbage, broccoli, spinach, basil, parsley, cilantro, cucumber, zucchini, avocado, asparagus, artichoke, celery, green beans, pea pod, spring onion, chilli, kiwi, lime, pear, olive oil |
| Purple (5) | eggplant, grapes, beetroot, turnip, wine vinegar |
| Brown (13) | potato, onion, mushroom, ginger, coconut, bread, baguette, cumin, peanut butter, soy sauce, sesame oil, stock, stock cubes |
| Cream (14), **new colour** | garlic, cauliflower, fennel, mozzarella, tofu, milk, yogurt, cream, coconut milk, mayonnaise, tahini, sugar, salt, white vinegar |
| Pink, cold chain (3), **new colour** | chicken, steak, salmon |
| Teal, kitchen and tableware (30) | stock pot, saucepans, frying pans, sauté pans, sheet pans, mixing bowls, measuring cups, kitchen scales, thermometers, oven mitts, tongs, spatulas, ladles, whisks, peelers, graters, skimmers, dinner forks, dinner knives, steak knives, soup spoons, dinner plates, soup bowls, water glasses, highball glasses, coffee and tea set, water jugs, salt and pepper, napkin holders, menu stands |
| Cardboard, parcels and takeaway (15), **new colour** | kraft boxes, burger boxes, paper bags, carry bags, foil containers, microwave containers, thali containers, food wrap, deli sheets, tamper labels, cutlery packs, paper napkins, tissues, wet wipes, toothpicks |
| Blue, cleaning (12) | dish soap, cleaning liquid, floor cleaner, disinfectant, hand soap, sponges and cloths, mop bucket, brooms, toilet brushes, toilet paper, paper towels, bin liners |

**Door colours:** red `#E5483E`, orange `#F59A28`, yellow `#F2C230`, green `#5BB84A`, teal `#2FB5A0`, blue `#3F8EE8`, purple `#9A5BD0`, brown `#8E5E38` (darker than today's, so it can't pass for cardboard), cream `#EFE3C4`, pink `#EC7BA6`, cardboard `#D2A566` with a drawn tape strip. A board never uses both brown and cardboard. Dark grey stays reserved for the blocks.

## 3. The van follows your restaurant

**The key rule:** a board has two separate parts.

1. **The shape** (grid, number of crates, crate sizes, blocks, doors, trapped crates) comes **only from the level, the business day and the board number**, as today. Orders can never change it.
2. **The pictures** (which item each colour carries) are chosen from your restaurant.

So with no orders at all, or a hundred, a level has **exactly the same difficulty**: same crates, same doors. Empty places are filled with other items. This is true by construction, and a test proves it (empty save vs. busy save: identical shape).

**Order of choosing items** (first match wins, per colour group):

| Priority | What | Where it's read from |
|---|---|---|
| 1. Delivered today | what arrived or was bought today | today's standing-order delivery (`deliveriesOf(save).history`, ingredients and supplies); ingredients bought at the Market today (inventory `purchaseDay` = today) |
| 2. Needed next | what the next service is short of | `marketPlanFor(save, 1)` rows (next service first); short supplies from the Pre-Service supplies check (`serviceSuppliesCheck`) |
| 3. Today's menu | what today's services use, even if in stock | `todayPlanNeed(save)`; takeaway supplies when takeaway runs; closing supplies (`closingSuppliesFor`) |
| 4. Your menu | ingredients of your unlocked dishes | recipe system |
| 5. The rest of the catalogue | everything else, rotating with the level and day | the 140-item list, so all items turn up over time |

- **Which doors:** colour groups containing priority 1–3 items take the board's doors first; other groups fill the remaining doors in a fixed rotation. A colour group that isn't needed still appears when the level has more doors than your order has groups.
- **Many items in one group** (for example three green ones on order): one per board; **Next dispatch** brings the next ones ("the van's next trip"). The board number already exists.
- **On screen:** the pinned truck card becomes a **delivery slip** listing the board's items, each tagged ✓ *Delivered today*, ★ *Needed next* or nothing. A needed item's door gets a small ★. Opening the slip pauses the clock.
- **It only reads the save.** No stock, money, ledger entry, reward or save field changes. The Market stays the only place to buy, and Inventory stays read-only (CLAUDE.md §7).

## 4. Level design and difficulty

### 4.1 The new difficulty ingredient: trapped crates

A **trapped crate** cannot reach its door until the player first **moves another crate out of the way**. The board is built as today (winnable crate by crate), then **shuffled with ordinary drags**, keeping shuffles that trap more crates, until the level's target is reached. Every drag can be dragged back, so **every board is still winnable by construction** (drag back, then send out in the built order). A prototype on 2026-11-27 reached 8 or more trapped crates on 8×8 boards in under 0.05 s per board; the generator will stop at the target.

### 4.2 Crates and sizes

| Size | Name | From level |
|---|---|---|
| 1×2 / 2×1 | Parcel | 18 (dealt twice as often) |
| 2×2 | Crate | 18 |
| 1×3 / 3×1 | Long crate | 28 |
| 2×3 / 3×2 | Pallet | 40 |
| 3×3 | Big pallet | 66 |

The sizes and their start levels are unchanged. Doors are 2 cells wide on 5×5 and 3 from 6×6, as today. L-shaped crates are not planned: they would need a new drag and exit engine.

### 4.3 The ramp

Crate counts, grid sizes and doors are **never lower than today**. The new column is *Trapped*. All numbers ramp smoothly inside each band, as today (`crateTierAt`).

| Levels | Grid | Crates | Doors (items) | Largest size | Block cells | Trapped | Free at start (max) |
|---|---|---|---|---|---|---|---|
| 18–22 | 5×5 | 5–6 | 3 | Crate | 2–3 | 0 (learn) | 4 |
| 23–27 | 5×5 | 6–7 | 3 | Crate | 3 | 1 (first lesson) | 3 |
| 28–33 | 6×6 | 7–8 | 4 | Long | 3–4 | 1–2 | 3 |
| 34–39 | 6×6 | 8–9 | 4 | Long | 4–5 | 2 | 3 |
| 40–45 | 6×6 | 9–10 | 4 | Pallet | 4–5 | 3 | 3 |
| 46–51 | 7×7 | 10 | 5 | Pallet | 4–6 | 3 | 3 |
| 52–57 | 7×7 | 11 | 5 | Pallet | 5–7 | 4 | 3 |
| 58–65 | 7×7 | 12 | 6 | Pallet | 6–7 | 4–5 | 3 |
| 66–71 | 8×8 | 12 | 6 | Big pallet | 6–8 | 5 | 3 |
| 72–77 | 8×8 | 13 | 7 | Big pallet | 7–9 | 6 | 3 |
| 78–83 | 8×8 | 14 | 7 | Big pallet | 8–10 | 6–7 | 3 |
| 84–90 | 8×8 | 15 | 8 | Big pallet | 8–10 | 7–8 | 3 |
| 91 | 8×8 | 15–16 | 8 | Big pallet | 9–10 | 9 | 3 |

- **Every door is used:** each door has at least one crate (the 2026-11-27 fix).
- **Clock:** today's `40 + 9 × crates` seconds, **+ 6 s per trapped crate**, so a harder board gets time to think. Stars stay by time left.
- **Boosters:** unchanged (Freeze 2, Rocket 2, Hammer 2, Undo 3).
- **First lesson (Level 23):** a one-time coach line on a trapped crate: "Slide the crate in the way aside to make room." A touched crate keeps its "→ the *item* door" hint. Instructions are never part of the difficulty (CLAUDE.md §10).

These targets are a first design. After playing a build on a phone, tune them; the numbers live in one table.

## 5. Art

**Phases 1 and 2 need no new art.** All 140 items have pictures, and crates and doors are drawn in code.

Optional polish (Phase 3): crate **skins** so a parcel looks like cardboard and a cold-chain crate looks insulated, plus the delivery slip and two tags. One combined Codex prompt:

```
KnifeCraft: Unload the Van cargo art. Make ALL of the following in one pass, as separate PNG files with transparent backgrounds, into a folder named "Van Cargo Assets" in the project root.
STYLE: match the existing Unload the Van screen (attach as references: "Unload the Van Screenshots/van-level-66-8x8-12-crates.png" and "public/business/cratedispatch/frame.webp"): warm, glossy, painted cartoon casual-game look, soft top-left light, no outlines thicker than the references, NO TEXT, NO LETTERS, NO NUMBERS, NO ITEMS or food in any picture.

A) SIX CRATE SKINS. Each file 384 x 384 px, made to be 9-SLICED: corner zones exactly 96 x 96 px; the top, bottom, left and right edge strips between the corners must look right when STRETCHED (no unique detail in the middle of an edge, only straight continuous lines or plain material); the centre (96..288 px both ways) completely transparent. The game paints each crate in its door colour UNDER the skin, so draw only shading and material detail as soft white highlights and dark shadows with partial transparency (greyscale feel), never a strong colour of its own.
  skin-produce.png  - wooden slat crate: slim wooden rim, small metal corner brackets and nail heads
  skin-pantry.png   - pantry crate: rounded wooden rim with a thin rope binding at the corners
  skin-cold.png     - insulated cold box: thick rounded rim with a light frost crust and four metal corner clips
  skin-parcel.png   - cardboard parcel: folded flap edges and a strip of packing tape running along the middle of each edge (the tape must stretch cleanly)
  skin-tableware.png- padded tableware crate: slim rim with soft foam corner cushions
  skin-cleaning.png - plastic tub: smooth rounded plastic rim with small handle notches in the corners

B) TWO SMALL TAGS, 128 x 128 px each:
  tag-delivered.png - a round green wax-seal badge with a white tick
  tag-needed.png    - a round golden badge with a white five-point star

C) DELIVERY SLIP, 600 x 760 px:
  slip.png - a wooden clipboard with a metal clip holding a blank cream paper sheet (flat, seen straight on, paper completely empty: the game writes the list)

CHECK before finishing: every file has a transparent background, the exact size above, no text, and each skin still looks correct when you stretch it to 384 x 192 and 192 x 576 by stretching only the edge strips and centre.
```

## 6. Build order

| Phase | What | New art | Proof |
|---|---|---|---|
| 0 | Every door has a crate | none | `crate-dispatch-qa` (all levels × many days) |
| 1 | The 140-item catalogue, 11 door colours, restaurant-driven pictures, delivery slip | none | each item's picture exists; all 140 turn up across levels and days; **same board shape with an empty save and a busy save**; nothing written to the save; needed and delivered items shown first |
| 2 | Trapped crates, clock bonus, the Level 23 coach line | none | every level × 60 days **proven winnable by replaying the generator's own drags through the real drag code**; trapped counts meet the table; never fewer crates than today; the build stays fast |
| 3 | Crate skins, tags, delivery slip art | Codex (above) | skins stretch cleanly at every size |

Each phase: gates, the van browser test on phone and landscape sizes, screenshots of all levels, and your phone check before the next one.

## 7. Choices for you

1. **Cleaning supplies on the van?** Recommended yes (the van delivers supplies as well as food).
2. **Keep the van cosmetic** (it never adds stock or money)? Recommended yes: adding stock would change the economy and the Market's rules.
3. **Trapped-crate targets** (table 4.3): fine to start with, then tune after you play?
4. **Phase 3 art:** order it now, or after you've played Phases 1 and 2? Recommended after (the plain crates may already be enough).
