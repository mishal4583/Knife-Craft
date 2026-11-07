# The first 20 levels: retention plan (developer 2026-11-08, PLAN ONLY, nothing built)

Goal: nobody drops before Level 20. Every level brings something NEW (an ingredient, a cut, a system or a mini-game), the heavy unlocks are spread out, and the dishes stop repeating tomato.
Source of the current state: the first-20 dump of 2026-11-08 (campaignPlan.ts and the unlock tables). Numbers are the 91-level campaign's.

## 1. What you asked for, and the fix

| # | You asked | Fix |
|---|---|---|
| 1 | L2 repeats tomato | L2 becomes **Peeled Potato & Carrot Bowl** (potato peel + halve, carrot slice). Carrot is new at L2 instead of L7. Same recipe id, new components, name and customer line. |
| 2 | L9, L10, L12 teach nothing new | L9 gets **eggplant** (Eggplant Antipasto replaces Family Antipasto). L10 opens **Fridge & Freshness + Fridge Check** (a system and a mini-game, your schedule). L12 becomes a shared-prep batch with **pepper and corn** (Pepper Onion Plate + Pepper Corn Bowl, one pepper dice serves both), and opens **dishwashing**. |
| 3 | L2: say the restaurant is closed and when the next day starts | After the 2nd service (the day's last) a short "Closed for tonight" card: "The restaurant is closed. Day 2 opens with your next service." The same wording every night. Today the first nights close silently. |
| 4 | L3: introduce the fridge mini-game properly, rename it | Rename **"Put it away"** to **"Unpack the delivery"** (chip: "Unpack delivery · 27"). Paige introduces it at L3 right after the first purchase: "Your order arrived! Unpack the delivery into the fridge for bonus Hype." The button goes straight into the game. |
| 5 | Second Floor only when he can afford a machine and keep playing | The Second Floor opens at **L11** and only when cash is at least **$800** (the $500 Coffee machine plus $300 to keep going); if not, it waits for the first service where that is true. Paige then asks him to buy the first machine. All Second Floor ad offers (Flood, Golden Guest, Rush, x2) start with it. |
| 6 | L4: cleaning | Cleaning starts at **L4**. The first night asks for ONE chore (wipe the boards). The others arrive when their cause does (see 8). |
| 7 | L5-L9 has nothing interesting: bring the stock-the-shelves game early | The first shopping list (tools) moves from L10 to **L6**: peelers, mixing bowls, measuring cups, sheet pans, oven mitts (5 things, for Garlic Bread and the salads). Buying supplies opens **Stock the shelves** (Stockroom Sort) at L6. L8 adds a second list (frying pan, tongs, skimmer); L10 the stock pot and ladles. |
| 8 | Cleaning: I already cleaned between services but must do it again | Two rules. (a) **Staged chores:** each closing chore starts when its cause does: boards L4, spoiled food and wrapping L10 (the fridge), degrease L8 (the pans arrive), dishes L12, mop L14, restroom L16. Today six chores can appear at once. (b) **Cleaned is cleaned:** a closing chore that the player already did since the last service (or whose area is still clean) is ticked off for him and never asked twice. I will check in code which chores really duplicate before changing them. |
| 9 | Dishwashing too slow: just a little slower than the start | Pace target: about **4-5 seconds for a plate** (the first version was 2.8 s, the current one is much longer), ONE rinse pass, fewer stains, and the pieces of one kind washed as a stack in one pass where they are identical. The sink opens at **L12** (the dine-in stage moves from L23 to L12 so tableware exists). I will measure the time with the existing pace test before and after. |

## 2. The first 20 levels, level by level (new plan)

"NEW" = the thing a player meets for the first time. Dishes use existing recipes unless marked.

| L | Level | Dishes | NEW (ingredient / cut) | NEW (system / mini-game / reward) |
|---|---|---|---|---|
| 1 | Garden Prep | Tomato & Cucumber Plate | tomato, cucumber, **slice** | first plate, first pay, hire Server and Cashier inside the service |
| 2 | Potato & Carrot | **Peeled Potato & Carrot Bowl** (new components) | potato, **carrot**, **peel**, **halve** | "Closed for tonight" card, Day 2 opens next service |
| 3 | Garlic Bread | Garlic Bread | bread, garlic, **smash** | **Unpack the delivery** (Paige), daily gift and ad bonuses |
| 4 | Tomato Basil Toast | Tomato Basil Toast (one dish; Caprese moves to L5's party) | basil, **dice**, **chop** | **Cleaning** (one chore); first interstitial after this level |
| 5 | Mushroom & Caprese | Mushroom Bruschetta + Caprese Plate | mushroom, mozzarella | **the menu opens**, menu guests, knife and board shop |
| 6 | Chicken Introduction | Sliced Chicken Plate | **chicken** | **first shopping list + Stock the shelves** |
| 7 | Garden Plates | Zucchini Garden Plate + Simple Garden Salad | zucchini | story card "The Room Comes Back" |
| 8 | Onion Two Ways | Onion Rings Basket + Onion Two Ways | onion, **rings** | frying pan list, **degrease chore**, a second stock-the-shelves delivery |
| 9 | House Bruschetta & Eggplant | Bruschetta for the House + **Eggplant Antipasto** | **eggplant** | |
| 10 | Garden Plate & Minestrone | Italian Garden Plate + Minestrone Base | | **Fridge & Freshness + Fridge Check**, spoiled-food and wrap chores, story "Word Gets Around" |
| 11 | Beetroot & Orange | Beetroot & Orange Plate | beetroot, orange, **radial** | **Second Floor** (if cash is $800+), buy the first machine; a 3-meal day |
| 12 | Pepper & Corn, one batch | **Pepper Onion Plate + Pepper Corn Bowl** (batch) | **pepper, corn** | **dishwashing + dine-in tableware** |
| 13 | Italian Service Night | Caprese Skewers + Bruschetta Trio + **Avocado & Lime Plate** | **avocado, lime** | first **regular guest** with a face and an expression |
| 14 | Julienne Medley | Julienne Vegetable Medley + Zucchini & Fennel | fennel, lemon, **julienne** | mop chore; "Knife Mastery" streak reward |
| 15 | Ribeye Introduction | Sliced Ribeye Plate | **steak** | the Butcher's Block moment: the steak knife and board are offered with a first-buy discount |
| 16 | Salmon Introduction | Sliced Salmon Plate | **salmon** | the Seafood Slate board offer; restroom chore |
| 17 | Chicken & Fruit | Halved & Sliced Chicken + **Kiwi & Watermelon Plate** | **kiwi, watermelon** (big satisfying peels) | |
| 18 | Steak Service | Steak, Mushroom & Cabbage + Sliced & Diced Steak | cabbage | first **Dinner Rush** (a surge of guests; a bonus for serving them all) |
| 19 | Salmon Bistro | Salmon, Cucumber & Radish + **Salmon & Asparagus** | radish, asparagus | city ranking: the player passes into the top 40 with a celebration card |
| 20 | Meat & Fish Night (chapter finale) | Chicken & Cabbage Julienne + Chicken, Cabbage & Carrot + Salmon & Asparagus (a 3-dish milestone) | ginger | a reward chest, a "Next: the French Bistro" preview, the first **Golden Guest** |

Nothing is left "nothing new": every level has a new ingredient, cut, system, mini-game or reward. Tomato now appears in 8 of the first 14 levels (it was 11).

## 3. What unlocks when (new)

| Level | Opens |
|---|---|
| 1 | Market, Inventory, the Business hub, hire inside the service |
| 3 | Unpack the delivery, daily gift, rewarded-ad bonuses |
| 4 | Cleaning (night chores) |
| 5 | the menu, menu guests, walk-ins, the knife and board shop, kitchen tiers on sale |
| 6 | the shopping list and Stock the shelves |
| 8 | pans, tongs, skimmer; degrease |
| 10 | Fridge & Freshness, Fridge Check; stock pot, ladles |
| 11 | the Second Floor (cash permitting), a 3-meal day, Mexican Chef (see 5) |
| 12 | dishwashing, dine-in tableware |
| 13 | a regular guest |
| 18 | Dinner Rush |
| 20 | the first Golden Guest |

## 4. What holds the player here (the dopamine core)

1. **The cutting feel** (perfect slices, combos, fever, the slow peel). Fruit peels at L17 are a treat.
2. **A goal on screen at all times:** the Growing Kitchen ($6,000, reachable about L10), "Next: pass <rival>", the first machine at L11.
3. **Something new every level** (section 2), and new proteins at L6, L15, L16.
4. **A return reason:** the Second Floor's idle income from L11, the daily gift from L3.
5. **Optional quick games with stars:** Unpack the delivery (L3), Stock the shelves (L6), Fridge Check (L10).
6. **People:** regulars with faces (L13), Paige's guidance at every new thing.
7. **Reward moments:** the finale chest at L20, the Butcher's Block and Seafood Slate offers.

## 5. What has to change in the game (when you approve)

- campaignPlan.ts: levels 2, 4, 5, 9, 12, 13, 17, 19, 20 (dishes), and the recipe components for the L2 dish (campaignRecipes.ts). New order of first-use tables (ingredients and cuts).
- Unlock constants: Second Floor open level 11 plus the $800 gate; first shopping list 10 to 6 (tools: peelers, bowls, cups, sheet pans, mitts at L6; pans at L8); Stockroom Sort 10 to 6; Fridge & Freshness and Fridge Check at L10 (already 11); dine-in 23 to 12; cleaning 3 to 4 with staged chores.
- Fridge Sort: the new name and the delivery wording (the chip, the screen, Paige's line).
- Closing messages: the "Closed for tonight" card.
- Dishwashing: the pace constants in dishDirt.ts (a measured retune).
- Cleaning: the closing checklist skips what is already clean.
- Tests and economy: the first-20 QA suites (unlocks, tools, supplies, takeaway, day, guests, journey, story), the frozen baseline if pay moves (it should not), the e2e seeds.
- Optional (not in the default): the Mexican Chef is asked for at L11 because the Beetroot dish is tagged Mexican; I would re-tag it Italian so that L11 stays light.

## 6. Questions for you

1. "Unpack the delivery": is that the name you want? (Alternatives: "Stock the Fridge", "Deliveries".)
2. L5's party (Mushroom Bruschetta + Caprese) makes L5 a 2-dish level right when the menu opens. Do you want L5 single and Caprese at L4 instead?
3. The L15 and L16 offers: a plain discount, or a gift item?
4. Do you want the Mexican Chef moved out of L11 by re-tagging the Beetroot dish Italian?
