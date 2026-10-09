# Levels 1–15 — recipes, techniques and the first-levels plan

Generated 2026-10-09 from the game's own data (`levelDefinitions`,
`campaignRecipes`, `levelRewards.paidLevelReward`) before any level data was
touched. Every level is one order of one dish; nothing below changes it.

## What each level is today

| Lv | Title | Dish | Ingredient → technique | Completion reward |
|---|---|---|---|---|
| 1 | First Slice | Sliced Tomato Plate | tomato → slice | $50.00 |
| 2 | Fresh Cucumber | Fresh Cucumber Plate | cucumber → slice | $52.00 |
| 3 | Carrot Chop | Carrot Chop Bowl | carrot → chop | $55.00 |
| 4 | Garden Prep | Garden Tomato & Cucumber Plate | tomato → slice · cucumber → slice | $58.00 |
| 5 | Onion Basics | Onion Prep | onion → peel → halve → slice | $61.00 |
| 6 | Diced Tomato | Diced Tomato Cup | tomato → **dice** (new) | $64.00 |
| 7 | Peeled Potato | Peeled Potato Bowl | potato → peel | $68.00 |
| 8 | Halved Potato | Halved Potato Bowl | potato → peel → halve | $72.00 |
| 9 | Smashed Garlic | Smashed Garlic Prep | garlic → peel → **smash** (new) | $76.00 |
| 10 | Simple Garden Salad | Simple Garden Salad | tomato → dice · cucumber → slice · carrot → chop | $80.00 · milestone |
| 11 | Garlic Bread | Garlic Bread | bread → slice · garlic → peel → smash | $80.00 · menu opens |
| 12 | Tomato Basil Toast | Tomato Basil Toast *or* Bruschetta Trio | bread → slice · tomato → dice (+ slice) · basil → chop (· garlic peel/smash) | $83.00 |
| 13 | Mushroom Bruschetta | Mushroom Bruschetta | bread → slice · mushroom → slice · garlic → peel → chop | $86.00 |
| 14 | Zucchini Garden Plate | Zucchini Garden Plate | zucchini → slice · carrot → dice | $89.00 |
| 15 | Caprese Plate | Caprese Plate | tomato → slice · mozzarella → slice · basil → chop | $92.00 · stock starts |

(Level 16, Onion Rings, brings **rings**.)

**Repetition:** slice is in 11 of 15 levels and peel in 6. The techniques that
are actually new are chop (L3), the multi-step chain (L5), dice (L6), halve
(L5/L8) and smash (L9). L7 and L8 (both potato, peel ± halve) are the most
alike pair. That's why the plan adds something to look at in the restaurant
at L3, L4, L7, L9, L10, L11, L12, L13, L14 and L15, not more cutting.

## The plan (developer-approved 2026-10-09)

| Level | What's new | Pass |
|---|---|---|
| 1–2 | Kitchen only; Grandma's line on every Level Complete | 1 |
| 3 | 📦 Inventory opens (Grandma's free leftovers come in pass 2) | 1 · 2 |
| 4 | Ingredients get used up; what's left is shown | 2 |
| 5–6 | Multi-step checklist; the goal shown first | 3 |
| 7 | 🛒 Market opens: browse knives & boards (nothing to buy yet) | 1 |
| 8–9 | Customer line; the dish's ingredient list | 3 · 2 |
| 10 | 🏆 Progress opens; the big milestone card; Santoku & Maple Board can be bought (optional) | 1 |
| 11 | 🍽️ Restaurant opens with the four-dish menu | 1 |
| 12 | First "running low" | 2 |
| 13 | Guided top-up, calculated from the real recipe need and stock | 2 |
| 14 | Preview of the next service's ingredients | 2 |
| 15 | Full Pre-Service Check; normal stock from here | — |

Pass 1 shipped 2026-10-09; pass 2 (Grandma's fridge: L3 leftovers, L4 use,
L12 running low, L13 top-up, L14 preview) is implemented on the working
branch (`restaurant/grandmasFridge.ts`); pass 3 (goals and stars from the
engine's grade, the customer's own line, the multi-step checklist, the
Level 9 ingredient list) is on the branch too (`restaurant/levelGoals.ts`).
Stars are not given on Levels 7 and 9: the engine doesn't grade peel or
smash, so those dishes always score a fixed 90.

Before Level 21 a day ends quietly (Level Complete says "☀️ Day N
begins"); the opening card and Closing Time start at Level 21.

**Unchanged by pass 1:** what any level pays, completion rewards, milestone
rewards, the level order, the cutting and knife behaviour. Pass 2 moves no
money except the optional L13 top-up (about $3.55).
