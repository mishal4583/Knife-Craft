# Dish pictures for the starting card and the plates on the tables (Codex prompts, developer 2026-11-21)

**Developer's idea (2026-11-21):** "what if we designed the 91 dishes using Codex, and these can be used while serving also". YES: the starting card (his mock-up) shows the dish on a checkered cloth, and the plate set on the table while serving can be the same picture.

## What "91 dishes" really is (counted from the game's data)

- The campaign has **91 levels**, but a level is not one dish: **87 different dishes** are the headline dish of a level, and the orders inside a service level (2-4 dishes at once, shared preps, menu guests) are drawn from the level's pool: **138 different dishes** can appear on the starting card in the 91 levels.
- The Menu holds **221 recipes** in all (`CAMPAIGN_RECIPES`); the other **83** are served to menu guests and walk-ins, and can also appear on the card.
- So 91 pictures would leave about half of the cards without a dish picture. The plan below is in two phases; the game already falls back to the dish's painted icon on a plate for any dish without a picture, so you can deliver in any order and nothing waits.

| Phase | Sheets | Dishes | Covers |
|---|---|---|---|
| 1 | DS-01 to DS-09 (9 sheets) | 138 (+6 menu dishes that fit in the last sheet) | every dish a player meets in the 91 levels, in campaign order |
| 2 | DS-10 to DS-14 (5 sheets) | the rest of the 83 menu dishes | the Menu guests |

## What is done in code already

- **The new starting card** (`OrderArrivalCard.tsx`, `orderCard.css`): the dark banner with the chef's hat and leaves, the cream frame with gold corners, the dish row, the customer's line, the dish on a checkered cloth, the big orange "Start cooking" between two gold laurels, the green "Prep Cook cuts it" and the "Auto" switch, as in the mock-up. It is centred over the dining room in a wide window and a compact version (no plate) sits under the picture on an upright phone. Everything but the dish picture is painted in code, so the card is complete today.
- **The dish picture slot** (`src/game/dishArt.ts`, `dishArtFiles.ts`): when `public/dishes/<recipe id>.webp` exists the card shows it, and the plate set on the table while serving (`PlateFace` in `ServiceFloor.tsx`: the plate in front of a seated customer, the plates of the other members of a party) shows the same picture. Without one: the dish's painted icon on a white plate.
- **`scripts/make-dish-assets.py`** cuts the sheets below into `public/dishes/` and writes `dishArtFiles.ts`; run it after the sheets are saved and every delivered dish switches over by itself.

## How to use this file

1. Send each sheet in its own request. Attach the **reference images** below, paste the prompt, and generate ONE image per sheet (2048 x 2048, 4 x 4 cells of 512).
2. Save it as `Dish Sheets Assets/DS-<NN>.png` in the project root (git-ignored, like the other Codex folders), the sheet number in the heading.
3. Tell me "dishes are generated" (even one sheet at a time): I run the script and check the result on the card and on the tables.

### Reference images to attach to EVERY sheet

- `docs/planning/reference/order-card-mockup-2026-11-21.png`: the mock-up. **The plate in the middle (Turnip & Carrot Plate) is the exact look wanted**: a round white porcelain plate, a thin pale-blue rim, glossy appetising food neatly arranged, warm light, soft shading.
- `public/business/ingredients/tomato.webp`, `carrot.webp`, `chicken.webp`, `salmon.webp`, `mushroom.webp`: the game's own ingredient paintings, so the food on the plates uses the same colours and shapes the player already knows.

### Rules for every sheet

- A fully transparent background (real alpha; no checkerboard, no white, no grey). 16 dishes in a 4 x 4 grid, one per cell, in the order listed, left to right then top to bottom.
- Each cell is 512 x 512. The **plate (or bowl) has the SAME size in every cell**: about 400 px across (78 % of the cell), centred, with its soft shadow inside the cell. Nothing touches the cell's edge. No grid lines, numbers, labels or text.
- **Viewpoint:** from above, tilted about 35 degrees (the same as the mock-up's plate), the same on every dish.
- **What it is served on:** a round white porcelain plate with a thin pale-blue rim. A soup, stew, curry, ramen, rice bowl or porridge is in a round white shallow bowl with the same blue rim and the same outer size. A drink is in a glass or cup on a small saucer, inside the same footprint. A sandwich, burger or bread sits on the same plate. No tablecloth, no table, no cutlery (unless the dish itself is cutlery-eaten like a skewer), no steam, no text.
- Paint exactly the dish named, with its listed ingredients visibly recognisable (a carrot looks like a carrot, a salmon fillet like a salmon fillet). Authentic to its cuisine where one is given. Appetising, tidy, a sensible portion, not piled up.
- The same light (from the upper left), the same level of finish and the same plate on every dish of the sheet. It must read at 56 px: a clear silhouette first, detail second.

## The sheets

### Sheet `DS-01` (phase 1): 16 dishes

Save as `Dish Sheets Assets/DS-01.png`.

```
Create ONE image, 2048 x 2048 px, on a fully transparent background: a sprite sheet of 16 separate plated dishes in a grid of 4 columns and 4 rows (each cell 512 x 512), one dish per cell, centred, in the reading order below. The plate or bowl is the same size in every cell (about 400 px across), nothing touches a cell's edge. No text, no numbers, no grid lines, no cloth, no table.

Dishes, left to right, top to bottom:
1. Garden Tomato & Cucumber Plate: tomato, cucumber
2. Potato & Carrot Bowl: potato, carrot
3. Garlic Bread (italian cuisine): bread, garlic
4. Caprese Plate (italian cuisine): tomato, mozzarella, basil
5. Tomato Basil Toast (italian cuisine): bread, tomato, basil
6. Baguette Crostini Prep (french cuisine): baguette, tomato
7. Mushroom Bruschetta (italian cuisine): bread, mushroom, garlic
8. Sliced Chicken Plate (japanese cuisine): chicken, cucumber
9. Simple Garden Salad: tomato, cucumber, carrot
10. Zucchini Garden Plate (italian cuisine): zucchini, carrot
11. Onion Rings Basket (italian cuisine): onion, tomato
12. Onion Two Ways (italian cuisine): onion, carrot
13. Bruschetta for the House (italian cuisine): bread, tomato, garlic, basil, mozzarella
14. Eggplant Antipasto (italian cuisine): eggplant, garlic, basil
15. Garden Minestrone Base (italian cuisine): tomato, carrot, zucchini, onion
16. Italian Garden Plate (italian cuisine): tomato, zucchini, basil, onion

Style: exactly like the attached mock-up's plate (Turnip & Carrot Plate): from above, tilted about 35 degrees; a round white porcelain plate with a thin pale-blue rim (soups, curries, noodles and rice in a round shallow white bowl with the same rim and the same outer size, drinks in a glass or cup on a saucer inside the same footprint); glossy, appetising, tidy food painted with soft painterly shading, a thin darker edge, warm light from the upper left, a soft shadow under the plate. Use the attached ingredient paintings for the exact look of the ingredients. The same plate, the same light and the same finish on every dish.
```

### Sheet `DS-02` (phase 1): 16 dishes

Save as `Dish Sheets Assets/DS-02.png`.

```
Create ONE image, 2048 x 2048 px, on a fully transparent background: a sprite sheet of 16 separate plated dishes in a grid of 4 columns and 4 rows (each cell 512 x 512), one dish per cell, centred, in the reading order below. The plate or bowl is the same size in every cell (about 400 px across), nothing touches a cell's edge. No text, no numbers, no grid lines, no cloth, no table.

Dishes, left to right, top to bottom:
1. Beetroot & Orange Plate (mexican cuisine): beetroot, orange
2. Pepper Onion Plate (mexican cuisine): pepper, onion
3. Avocado & Lime Plate (mexican cuisine): avocado, lime
4. Bruschetta Trio (italian cuisine): bread, tomato, basil, garlic
5. Caprese Skewers Batch (italian cuisine): tomato, mozzarella, basil
6. Julienne Vegetable Medley (italian cuisine): carrot, pepper, cucumber
7. Zucchini & Fennel with Lemon (italian cuisine): zucchini, fennel, lemon
8. Sliced Ribeye Plate (japanese cuisine): steak, mushroom
9. Sliced Salmon Plate (japanese cuisine): salmon, lemon
10. Halved & Sliced Chicken (japanese cuisine): chicken, lemon
11. Kiwi & Watermelon Fresh Plate (mediterranean cuisine): kiwi, watermelon
12. Steak, Mushroom & Cabbage (japanese cuisine): steak, mushroom, cabbage
13. Sliced & Diced Steak (japanese cuisine): steak, onion
14. Salmon & Asparagus (french cuisine): salmon, asparagus, lemon
15. Salmon, Cucumber & Radish (japanese cuisine): salmon, cucumber, radish
16. Chicken, Cabbage & Carrot (japanese cuisine): chicken, carrot, cabbage

Style: exactly like the attached mock-up's plate (Turnip & Carrot Plate): from above, tilted about 35 degrees; a round white porcelain plate with a thin pale-blue rim (soups, curries, noodles and rice in a round shallow white bowl with the same rim and the same outer size, drinks in a glass or cup on a saucer inside the same footprint); glossy, appetising, tidy food painted with soft painterly shading, a thin darker edge, warm light from the upper left, a soft shadow under the plate. Use the attached ingredient paintings for the exact look of the ingredients. The same plate, the same light and the same finish on every dish.
```

### Sheet `DS-03` (phase 1): 16 dishes

Save as `Dish Sheets Assets/DS-03.png`.

```
Create ONE image, 2048 x 2048 px, on a fully transparent background: a sprite sheet of 16 separate plated dishes in a grid of 4 columns and 4 rows (each cell 512 x 512), one dish per cell, centred, in the reading order below. The plate or bowl is the same size in every cell (about 400 px across), nothing touches a cell's edge. No text, no numbers, no grid lines, no cloth, no table.

Dishes, left to right, top to bottom:
1. Chicken & Cabbage Julienne (japanese cuisine): chicken, cabbage, ginger
2. Salmon & Carrot Plate (japanese cuisine): salmon, carrot
3. Chicken Julienne Bowl (japanese cuisine): chicken, carrot
4. Chicken Two Cuts (japanese cuisine): chicken, pepper
5. French Onion Base (french cuisine): onion, celery
6. Potato Veloute Base (french cuisine): potato, onion
7. Chiffonade Herb Garnish (french cuisine): basil, tomato
8. Basil Mozzarella Bowl (italian cuisine): basil, mozzarella
9. Rock Minced Garlic (french cuisine): garlic, tomato
10. Mushroom Duxelles Prep (french cuisine): mushroom, garlic, onion
11. Mushroom & Garlic Saute Prep (french cuisine): mushroom, garlic
12. Salmon, Tofu & Spinach (japanese cuisine): salmon, tofu, spinach
13. Spinach & Fennel Chiffonade Plate (french cuisine): spinach, fennel
14. Celery & Potato Prep (french cuisine): celery, potato, garlic
15. Julienne Vegetable Trio & Potato (french cuisine): carrot, celery, potato
16. Herb Butter Vegetable Plate (french cuisine): basil, carrot, potato, butter

Style: exactly like the attached mock-up's plate (Turnip & Carrot Plate): from above, tilted about 35 degrees; a round white porcelain plate with a thin pale-blue rim (soups, curries, noodles and rice in a round shallow white bowl with the same rim and the same outer size, drinks in a glass or cup on a saucer inside the same footprint); glossy, appetising, tidy food painted with soft painterly shading, a thin darker edge, warm light from the upper left, a soft shadow under the plate. Use the attached ingredient paintings for the exact look of the ingredients. The same plate, the same light and the same finish on every dish.
```

### Sheet `DS-04` (phase 1): 16 dishes

Save as `Dish Sheets Assets/DS-04.png`.

```
Create ONE image, 2048 x 2048 px, on a fully transparent background: a sprite sheet of 16 separate plated dishes in a grid of 4 columns and 4 rows (each cell 512 x 512), one dish per cell, centred, in the reading order below. The plate or bowl is the same size in every cell (about 400 px across), nothing touches a cell's edge. No text, no numbers, no grid lines, no cloth, no table.

Dishes, left to right, top to bottom:
1. Potato & Onion Gratin Prep (french cuisine): potato, onion
2. Celery & Apple Remoulade Prep (french cuisine): celery, apple, lemon
3. Fennel & Celery Julienne (french cuisine): fennel, celery
4. Radish & Cucumber Namasu (japanese cuisine): radish, cucumber, ginger
5. Asparagus & Carrot Precision Plate (french cuisine): asparagus, carrot
6. Herb & Garlic Garnish (french cuisine): basil, parsley, garlic
7. Onion Tomato Masala Base (indian cuisine): onion, tomato, garlic, ginger
8. Potato Curry Base (indian cuisine): potato, onion, tomato
9. Garlic & Ginger Curry Paste (indian cuisine): garlic, ginger
10. Mango Chutney Base (indian cuisine): mango, chilli
11. Mango Onion Relish (indian cuisine): onion, mango, chilli
12. Pumpkin & Coconut Curry (indian cuisine): pumpkin, coconut, ginger
13. Pumpkin Curry Dice (indian cuisine): pumpkin, onion
14. Aromatic Garlic & Onion Base (indian cuisine): garlic, onion, ginger
15. Spinach & Pea Pod Bowl (indian cuisine): spinach, pea pods
16. Tomato Chicken Bowl (indian cuisine): tomato, chicken, ginger

Style: exactly like the attached mock-up's plate (Turnip & Carrot Plate): from above, tilted about 35 degrees; a round white porcelain plate with a thin pale-blue rim (soups, curries, noodles and rice in a round shallow white bowl with the same rim and the same outer size, drinks in a glass or cup on a saucer inside the same footprint); glossy, appetising, tidy food painted with soft painterly shading, a thin darker edge, warm light from the upper left, a soft shadow under the plate. Use the attached ingredient paintings for the exact look of the ingredients. The same plate, the same light and the same finish on every dish.
```

### Sheet `DS-05` (phase 1): 16 dishes

Save as `Dish Sheets Assets/DS-05.png`.

```
Create ONE image, 2048 x 2048 px, on a fully transparent background: a sprite sheet of 16 separate plated dishes in a grid of 4 columns and 4 rows (each cell 512 x 512), one dish per cell, centred, in the reading order below. The plate or bowl is the same size in every cell (about 400 px across), nothing touches a cell's edge. No text, no numbers, no grid lines, no cloth, no table.

Dishes, left to right, top to bottom:
1. Spinach Curry (indian cuisine): onion, spinach, ginger
2. Avocado Baguette Toast (mediterranean cuisine): baguette, avocado, lemon
3. Cucumber & Tomato Mezze (mediterranean cuisine): cucumber, tomato, parsley, onion, lemon
4. Herb & Tomato Base (mediterranean cuisine): parsley, tomato, garlic, onion
5. Corn & Tomato Salsa (mexican cuisine): corn, tomato, onion, chilli, garlic
6. Pepper Fajita Julienne (mexican cuisine): pepper, onion
7. Pineapple & Mango Fresh Cup (mexican cuisine): pineapple, mango, lime
8. Sweet Potato Hash (mexican cuisine): sweet potato, pepper, onion
9. Pineapple Salsa (mexican cuisine): pineapple, tomato, onion, chilli, cilantro
10. Latin Garden Plate (mexican cuisine): corn, pepper, avocado, lime
11. Chicken & Broccoli Plate (chinese cuisine): chicken, broccoli, spring onion
12. Tofu & Broccoli Bowl (chinese cuisine): tofu, broccoli
13. Chicken Pepper Stir-Fry Prep (chinese cuisine): chicken, pepper, carrot, garlic, ginger, spring onion
14. Steak Pepper Stir-Fry Prep (chinese cuisine): steak, pepper, carrot, garlic, ginger, spring onion
15. Carrot & Pepper Wok Plate (chinese cuisine): carrot, pepper
16. Artichoke & Fennel Plate (italian cuisine): artichoke, fennel, lemon

Style: exactly like the attached mock-up's plate (Turnip & Carrot Plate): from above, tilted about 35 degrees; a round white porcelain plate with a thin pale-blue rim (soups, curries, noodles and rice in a round shallow white bowl with the same rim and the same outer size, drinks in a glass or cup on a saucer inside the same footprint); glossy, appetising, tidy food painted with soft painterly shading, a thin darker edge, warm light from the upper left, a soft shadow under the plate. Use the attached ingredient paintings for the exact look of the ingredients. The same plate, the same light and the same finish on every dish.
```

### Sheet `DS-06` (phase 1): 16 dishes

Save as `Dish Sheets Assets/DS-06.png`.

```
Create ONE image, 2048 x 2048 px, on a fully transparent background: a sprite sheet of 16 separate plated dishes in a grid of 4 columns and 4 rows (each cell 512 x 512), one dish per cell, centred, in the reading order below. The plate or bowl is the same size in every cell (about 400 px across), nothing touches a cell's edge. No text, no numbers, no grid lines, no cloth, no table.

Dishes, left to right, top to bottom:
1. Lettuce & Tomato Salad (italian cuisine): lettuce, tomato
2. Cabbage & Cauliflower Bowl (chinese cuisine): cabbage, cauliflower
3. Eggplant & Green Onion Wok Bowl (chinese cuisine): eggplant, spring onion, garlic
4. Chicken Wok Bowl (Pepper) (chinese cuisine): chicken, pepper
5. Steak Two Cuts (chinese cuisine): steak, spring onion
6. Mushroom & Spinach Bowl (chinese cuisine): mushroom, spinach
7. Tofu & Cauliflower Bowl (chinese cuisine): tofu, cauliflower
8. Full Wok Plate (chinese cuisine): chicken, steak, mushroom, carrot, spring onion
9. Chicken & Artichoke (italian cuisine): chicken, artichoke, lemon, garlic
10. Insalata Tricolore (italian cuisine): mozzarella, basil, lettuce
11. Turnip & Carrot Plate (french cuisine): turnip, carrot
12. Peach & Fennel Plate (french cuisine): peach, fennel, lemon
13. Peach & Cheddar Board (french cuisine): peach, cheddar, baguette
14. Carrot Turnip Plate (french cuisine): carrot, turnip
15. Chicken & Watermelon (mediterranean cuisine): chicken, watermelon, parsley
16. Salmon & Lemon (mediterranean cuisine): salmon, lemon

Style: exactly like the attached mock-up's plate (Turnip & Carrot Plate): from above, tilted about 35 degrees; a round white porcelain plate with a thin pale-blue rim (soups, curries, noodles and rice in a round shallow white bowl with the same rim and the same outer size, drinks in a glass or cup on a saucer inside the same footprint); glossy, appetising, tidy food painted with soft painterly shading, a thin darker edge, warm light from the upper left, a soft shadow under the plate. Use the attached ingredient paintings for the exact look of the ingredients. The same plate, the same light and the same finish on every dish.
```

### Sheet `DS-07` (phase 1): 16 dishes

Save as `Dish Sheets Assets/DS-07.png`.

```
Create ONE image, 2048 x 2048 px, on a fully transparent background: a sprite sheet of 16 separate plated dishes in a grid of 4 columns and 4 rows (each cell 512 x 512), one dish per cell, centred, in the reading order below. The plate or bowl is the same size in every cell (about 400 px across), nothing touches a cell's edge. No text, no numbers, no grid lines, no cloth, no table.

Dishes, left to right, top to bottom:
1. Lemon Salmon Plate (mediterranean cuisine): lemon, salmon
2. Grapes & Strawberry Cup (mexican cuisine): grapes, strawberry
3. Chicken, Avocado & Grapes (mexican cuisine): chicken, avocado, grapes, lime
4. Steak & Corn (mexican cuisine): steak, corn
5. Sweet Potato & Strawberry Plate (mexican cuisine): sweet potato, strawberry, lime
6. Avocado Corn Plate (mexican cuisine): avocado, corn, lime
7. Beetroot & Pomegranate Plate (mediterranean cuisine): beetroot, pomegranate, parsley
8. Salmon, Two Ways (mediterranean cuisine): salmon, lemon
9. Pomegranate & Apple Plate (mediterranean cuisine): pomegranate, apple, lemon
10. Thai Basil Chicken (thai cuisine): chicken, basil, garlic, onion, chilli
11. Green Bean & Pepper (thai cuisine): green beans, pepper
12. Salmon & Coconut (thai cuisine): salmon, coconut
13. Cucumber & Pea Pod Salad (thai cuisine): cucumber, pea pods, lime, chilli, cilantro
14. Mango & Pineapple Fresh Cup (thai cuisine): mango, pineapple, lime
15. Salmon & Mango Plate (thai cuisine): salmon, mango, lime
16. Chicken Two Ways, Thai Style (thai cuisine): chicken, basil

Style: exactly like the attached mock-up's plate (Turnip & Carrot Plate): from above, tilted about 35 degrees; a round white porcelain plate with a thin pale-blue rim (soups, curries, noodles and rice in a round shallow white bowl with the same rim and the same outer size, drinks in a glass or cup on a saucer inside the same footprint); glossy, appetising, tidy food painted with soft painterly shading, a thin darker edge, warm light from the upper left, a soft shadow under the plate. Use the attached ingredient paintings for the exact look of the ingredients. The same plate, the same light and the same finish on every dish.
```

### Sheet `DS-08` (phase 1): 16 dishes

Save as `Dish Sheets Assets/DS-08.png`.

```
Create ONE image, 2048 x 2048 px, on a fully transparent background: a sprite sheet of 16 separate plated dishes in a grid of 4 columns and 4 rows (each cell 512 x 512), one dish per cell, centred, in the reading order below. The plate or bowl is the same size in every cell (about 400 px across), nothing touches a cell's edge. No text, no numbers, no grid lines, no cloth, no table.

Dishes, left to right, top to bottom:
1. Basil Garlic Chicken (thai cuisine): basil, garlic, chicken, chilli
2. Chicken & Spinach (korean cuisine): chicken, spinach
3. Steak & Cabbage (korean cuisine): steak, cabbage
4. Steak & Carrot Julienne (korean cuisine): steak, carrot
5. Pear & Radish Side (korean cuisine): pear, radish, spring onion
6. Steak Plate (Cabbage) (korean cuisine): steak, cabbage, spring onion
7. Korean Grand Service Plate (korean cuisine): steak, chicken, mushroom, carrot, pear, lemon
8. Salmon & Cabbage (japanese cuisine): salmon, cabbage
9. Steak & Spinach (korean cuisine): steak, spinach, spring onion
10. Radish & Pear Fusion Cup (korean cuisine): radish, pear, ginger
11. Mushroom Salmon Plate (japanese cuisine): mushroom, salmon
12. Carrot Salmon Plate (japanese cuisine): carrot, salmon
13. Salmon Basil Garlic (thai cuisine): salmon, basil, garlic
14. Green Bean & Tofu Wok Bowl (chinese cuisine): green beans, tofu, spring onion
15. Garlic Chicken Plate (chinese cuisine): garlic, chicken, spring onion
16. Chicken & Carrot Plate (japanese cuisine): chicken, carrot

Style: exactly like the attached mock-up's plate (Turnip & Carrot Plate): from above, tilted about 35 degrees; a round white porcelain plate with a thin pale-blue rim (soups, curries, noodles and rice in a round shallow white bowl with the same rim and the same outer size, drinks in a glass or cup on a saucer inside the same footprint); glossy, appetising, tidy food painted with soft painterly shading, a thin darker edge, warm light from the upper left, a soft shadow under the plate. Use the attached ingredient paintings for the exact look of the ingredients. The same plate, the same light and the same finish on every dish.
```

### Sheet `DS-09` (phase 1): 16 dishes

Save as `Dish Sheets Assets/DS-09.png`.

```
Create ONE image, 2048 x 2048 px, on a fully transparent background: a sprite sheet of 16 separate plated dishes in a grid of 4 columns and 4 rows (each cell 512 x 512), one dish per cell, centred, in the reading order below. The plate or bowl is the same size in every cell (about 400 px across), nothing touches a cell's edge. No text, no numbers, no grid lines, no cloth, no table.

Dishes, left to right, top to bottom:
1. Apple & Cheddar Plate: apple, cheddar
2. Nine-Kitchen Sampler: tomato, basil, carrot, garlic, onion, orange
3. Chicken, the Full Kitchen: chicken, carrot
4. Grand Carrot Plate (Steak): carrot, steak
5. Grand Carrot Bowl (Salmon): carrot, salmon
6. Steak, French Two Ways (french cuisine): steak, mushroom
7. Steak & Carrot Plate (japanese cuisine): steak, carrot
8. Kiwi & Lemon Plate: kiwi, lemon, pomegranate
9. Onion Rings & Smashed Garlic: onion, garlic
10. The Last Service, Table One: garlic, steak, turnip
11. Sliced Tomato Plate: tomato
12. Fresh Cucumber Plate: cucumber
13. Carrot Chop Bowl: carrot
14. Onion Prep: onion
15. Diced Tomato Cup: tomato
16. Garden Tomato Cup (italian cuisine): tomato, cucumber

Style: exactly like the attached mock-up's plate (Turnip & Carrot Plate): from above, tilted about 35 degrees; a round white porcelain plate with a thin pale-blue rim (soups, curries, noodles and rice in a round shallow white bowl with the same rim and the same outer size, drinks in a glass or cup on a saucer inside the same footprint); glossy, appetising, tidy food painted with soft painterly shading, a thin darker edge, warm light from the upper left, a soft shadow under the plate. Use the attached ingredient paintings for the exact look of the ingredients. The same plate, the same light and the same finish on every dish.
```

### Sheet `DS-10` (phase 2): 16 dishes

Save as `Dish Sheets Assets/DS-10.png`.

```
Create ONE image, 2048 x 2048 px, on a fully transparent background: a sprite sheet of 16 separate plated dishes in a grid of 4 columns and 4 rows (each cell 512 x 512), one dish per cell, centred, in the reading order below. The plate or bowl is the same size in every cell (about 400 px across), nothing touches a cell's edge. No text, no numbers, no grid lines, no cloth, no table.

Dishes, left to right, top to bottom:
1. Peeled Potato Bowl: potato
2. Smashed Garlic Prep: garlic
3. Pepper Corn Bowl (mexican cuisine): pepper, corn
4. Mozzarella & Tomato Skewers (italian cuisine): tomato, mozzarella
5. Chicken Julienne Cup (japanese cuisine): chicken, pepper
6. Julienne Carrot Garnish (italian cuisine): carrot
7. Julienne Pepper Ribbons (italian cuisine): pepper
8. Orange Rose Garnish (italian cuisine): orange
9. Family Antipasto for Two (italian cuisine): bread, tomato, mozzarella
10. Baguette Rounds (french cuisine): baguette
11. Tomato Steak Cup (indian cuisine): tomato, steak
12. Tomato Onion Plate (indian cuisine): tomato, onion
13. Cauliflower Curry (indian cuisine): onion, cauliflower, tomato, ginger
14. Parsley Chiffonade Garnish (french cuisine): parsley
15. Fresh Tomato Salsa (mexican cuisine): tomato, onion, chilli, cilantro, lime, garlic
16. Baguette & Cheddar Rounds (french cuisine): baguette, cheddar, apple

Style: exactly like the attached mock-up's plate (Turnip & Carrot Plate): from above, tilted about 35 degrees; a round white porcelain plate with a thin pale-blue rim (soups, curries, noodles and rice in a round shallow white bowl with the same rim and the same outer size, drinks in a glass or cup on a saucer inside the same footprint); glossy, appetising, tidy food painted with soft painterly shading, a thin darker edge, warm light from the upper left, a soft shadow under the plate. Use the attached ingredient paintings for the exact look of the ingredients. The same plate, the same light and the same finish on every dish.
```

### Sheet `DS-11` (phase 2): 16 dishes

Save as `Dish Sheets Assets/DS-11.png`.

```
Create ONE image, 2048 x 2048 px, on a fully transparent background: a sprite sheet of 16 separate plated dishes in a grid of 4 columns and 4 rows (each cell 512 x 512), one dish per cell, centred, in the reading order below. The plate or bowl is the same size in every cell (about 400 px across), nothing touches a cell's edge. No text, no numbers, no grid lines, no cloth, no table.

Dishes, left to right, top to bottom:
1. Carrot & Pea Pod Wok Plate (chinese cuisine): carrot, pea pods
2. Chicken Wok Bowl (Pea Pod) (chinese cuisine): chicken, pea pods
3. Chicken Wok Bowl (Cabbage) (chinese cuisine): chicken, cabbage, onion
4. Cauliflower Chop Bowl (indian cuisine): cauliflower
5. Coconut Prep (indian cuisine): coconut
6. Mozzarella & Tomato Bowl (italian cuisine): mozzarella, tomato, basil
7. Mozzarella & Lettuce Cup (italian cuisine): mozzarella, lettuce, orange
8. Carrot Asparagus Bowl (french cuisine): carrot, asparagus
9. Lemon Chicken Bowl (mediterranean cuisine): lemon, chicken
10. Lemon Cucumber Cup (mediterranean cuisine): lemon, cucumber, pomegranate
11. Potato Tomato Curry (indian cuisine): tomato, potato, ginger
12. Pea Tomato Curry (indian cuisine): tomato, pea pods, ginger
13. Avocado Pepper Bowl (mexican cuisine): avocado, pepper, lime
14. Avocado Grapes Cup (mexican cuisine): avocado, grapes, lime
15. Pumpkin Garlic Curry (indian cuisine): garlic, pumpkin
16. Mango Garlic Chutney (indian cuisine): garlic, mango, chilli

Style: exactly like the attached mock-up's plate (Turnip & Carrot Plate): from above, tilted about 35 degrees; a round white porcelain plate with a thin pale-blue rim (soups, curries, noodles and rice in a round shallow white bowl with the same rim and the same outer size, drinks in a glass or cup on a saucer inside the same footprint); glossy, appetising, tidy food painted with soft painterly shading, a thin darker edge, warm light from the upper left, a soft shadow under the plate. Use the attached ingredient paintings for the exact look of the ingredients. The same plate, the same light and the same finish on every dish.
```

### Sheet `DS-12` (phase 2): 16 dishes

Save as `Dish Sheets Assets/DS-12.png`.

```
Create ONE image, 2048 x 2048 px, on a fully transparent background: a sprite sheet of 16 separate plated dishes in a grid of 4 columns and 4 rows (each cell 512 x 512), one dish per cell, centred, in the reading order below. The plate or bowl is the same size in every cell (about 400 px across), nothing touches a cell's edge. No text, no numbers, no grid lines, no cloth, no table.

Dishes, left to right, top to bottom:
1. Eggplant Mezze Plate (mediterranean cuisine): eggplant, garlic, parsley
2. Lemon Garnish (mediterranean cuisine): lemon
3. Pomegranate & Parsley Garnish (mediterranean cuisine): pomegranate, parsley
4. Basil Garlic Salmon (thai cuisine): basil, garlic, salmon
5. Basil Garlic Pineapple (thai cuisine): basil, garlic, pineapple
6. Shared Mezze for Two (mediterranean cuisine): cucumber, tomato, parsley
7. Pickled Onion Rings (mediterranean cuisine): onion, lemon
8. Steak Bowl (Spinach) (korean cuisine): steak, spinach, spring onion
9. Mushroom Steak Bowl (korean cuisine): mushroom, steak
10. Carrot Steak Bowl (korean cuisine): carrot, steak
11. Carrot Cabbage Cup (chinese cuisine): carrot, cabbage
12. Garlic Salmon Bowl (thai cuisine): garlic, salmon
13. Garlic Steak Cup (korean cuisine): garlic, steak
14. The Last Service, Table Two: garlic, salmon, asparagus
15. The Last Service, Table Three: chicken, basil
16. Pepper Two Ways (mexican cuisine): pepper, onion

Style: exactly like the attached mock-up's plate (Turnip & Carrot Plate): from above, tilted about 35 degrees; a round white porcelain plate with a thin pale-blue rim (soups, curries, noodles and rice in a round shallow white bowl with the same rim and the same outer size, drinks in a glass or cup on a saucer inside the same footprint); glossy, appetising, tidy food painted with soft painterly shading, a thin darker edge, warm light from the upper left, a soft shadow under the plate. Use the attached ingredient paintings for the exact look of the ingredients. The same plate, the same light and the same finish on every dish.
```

### Sheet `DS-13` (phase 2): 16 dishes

Save as `Dish Sheets Assets/DS-13.png`.

```
Create ONE image, 2048 x 2048 px, on a fully transparent background: a sprite sheet of 16 separate plated dishes in a grid of 4 columns and 4 rows (each cell 512 x 512), one dish per cell, centred, in the reading order below. The plate or bowl is the same size in every cell (about 400 px across), nothing touches a cell's edge. No text, no numbers, no grid lines, no cloth, no table.

Dishes, left to right, top to bottom:
1. Halved & Diced Chicken (japanese cuisine): chicken
2. Chicken Garden Plate (japanese cuisine): chicken, cucumber, carrot
3. Salmon & Avocado Plate (japanese cuisine): salmon, avocado, lemon
4. Thai Basil Garlic Base (thai cuisine): basil, garlic
5. Korean Garlic Onion Base (korean cuisine): garlic, onion, ginger, spring onion
6. Chicken, Thin & Fine (korean cuisine): chicken
7. Caprese, Extra Greens (italian cuisine): mozzarella, tomato, basil, lettuce
8. Basil Tomato Plate (italian cuisine): basil, tomato
9. Chicken, Italian Two Ways (italian cuisine): chicken
10. Steak & Turnip (french cuisine): steak, turnip
11. Asparagus Persillade Cup (french cuisine): parsley, garlic, asparagus
12. Salmon Persillade (french cuisine): parsley, garlic, salmon
13. Turnip Persillade Bowl (french cuisine): parsley, garlic, turnip
14. Onion Rings & Garlic (indian cuisine): onion, garlic
15. Steak Curry Bowl (indian cuisine): steak, onion, tomato, ginger
16. Chicken with Onion Rings (indian cuisine): chicken, onion, garlic, ginger

Style: exactly like the attached mock-up's plate (Turnip & Carrot Plate): from above, tilted about 35 degrees; a round white porcelain plate with a thin pale-blue rim (soups, curries, noodles and rice in a round shallow white bowl with the same rim and the same outer size, drinks in a glass or cup on a saucer inside the same footprint); glossy, appetising, tidy food painted with soft painterly shading, a thin darker edge, warm light from the upper left, a soft shadow under the plate. Use the attached ingredient paintings for the exact look of the ingredients. The same plate, the same light and the same finish on every dish.
```

### Sheet `DS-14` (phase 2): 13 dishes

Save as `Dish Sheets Assets/DS-14.png`.

```
Create ONE image, 2048 x 2048 px, on a fully transparent background: a sprite sheet of 13 separate plated dishes in a grid of 4 columns and 4 rows (each cell 512 x 512), one dish per cell, centred, in the reading order below. The plate or bowl is the same size in every cell (about 400 px across), nothing touches a cell's edge. No text, no numbers, no grid lines, no cloth, no table.

Dishes, left to right, top to bottom:
1. Eggplant Masala Prep (indian cuisine): eggplant, onion, ginger, chilli
2. Onion Rings Bowl (Tomato) (indian cuisine): onion, tomato, chilli
3. Onion Rings Cup (Garlic) (indian cuisine): onion, garlic
4. Potato, Two Ways (indian cuisine): potato
5. Cucumber Tomato Plate (mediterranean cuisine): cucumber, tomato
6. Cucumber Watermelon Bowl (mediterranean cuisine): cucumber, watermelon
7. Chicken, Latin Two Ways (mexican cuisine): chicken
8. Salmon, Fusion Two Ways (japanese cuisine): salmon, cabbage
9. Chicken & Broccoli, Wok Style (chinese cuisine): chicken, broccoli, spring onion
10. Pepper Chicken Plate (chinese cuisine): pepper, chicken, ginger
11. Pepper Salmon Bowl (thai cuisine): pepper, salmon, chilli
12. Steak, Wok Two Ways (chinese cuisine): steak, spring onion
13. Chicken, The Last Branch: chicken

Style: exactly like the attached mock-up's plate (Turnip & Carrot Plate): from above, tilted about 35 degrees; a round white porcelain plate with a thin pale-blue rim (soups, curries, noodles and rice in a round shallow white bowl with the same rim and the same outer size, drinks in a glass or cup on a saucer inside the same footprint); glossy, appetising, tidy food painted with soft painterly shading, a thin darker edge, warm light from the upper left, a soft shadow under the plate. Use the attached ingredient paintings for the exact look of the ingredients. The same plate, the same light and the same finish on every dish.
```

## Optional: the card's own pieces as paintings (not needed)

The card's banner, hat, leaves, gold laurels, corner flourishes and cloth are drawn in code and look like the mock-up. If you want them painted like the mock-up (wood grain on the banner, a real chef's hat), send this one prompt with the mock-up attached and I swap them in:

```
Create ONE image, 2400 x 1600 px, on a fully transparent background: six separate UI pieces for a restaurant game, painted exactly like the attached mock-up (glossy storybook style, thin darker edges, warm light from the upper left), each centred in its own area of a 3 x 2 grid (800 x 800 cells), no text anywhere.
1. A dark-brown wooden banner plaque (about 1000 x 330 px) with a gold border, rounded bottom corners, a plain EMPTY face for text, a white chef's hat standing on its top-middle edge, and a green leafy sprig coming out of each side.
2. A gold laurel branch, curved, leaves pointing up and outward (the right-hand one; the game mirrors it for the left).
3. A gold corner flourish for a card frame: a thin elegant curl for the TOP-LEFT corner (the game mirrors it).
4. A green and cream checkered table cloth seen in perspective, slightly skewed, with soft folds and a soft shadow.
5. An empty round white porcelain plate with a pale-blue rim, tilted about 35 degrees, with a soft shadow.
6. A cream parchment divider ornament: a thin gold line with a small diamond in the middle, 900 px wide.
```

## Notes

- The same pictures can later be used in the Menu, the order list, the served card and the Journal; the code already looks a dish up by its recipe id (`dishArtUrl(recipeId)`).
- Costs: 14 sheets for all 221 dishes (about 2 MB per sheet delivered; the game files are small webp, around 25 KB per dish, so about 5.5 MB for all of them, loaded one at a time when a card needs it, never all at once).