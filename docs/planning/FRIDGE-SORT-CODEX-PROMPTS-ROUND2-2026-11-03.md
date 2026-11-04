# Fridge Sort: what is STILL missing, and the Codex prompts for it (round 2, 2026-11-03)

Written after the game screen was built and the first round of art (A1–A21, supplies, ingredients, floor staff) was looked at against it.
Every prompt below is self-contained: paste ONE per Codex request, and attach the reference files named under it (they are in `art-source/`, local only).

## What already exists and is enough (do NOT regenerate)

| Have | File | Used for |
|---|---|---|
| Cream-enamel open fridge, 4 glass shelves | `A1` | the fridge: shelf 1 Dairy & Tofu, shelf 2 the four vegetable bins, shelf 3 Meat, Fish & Bread, shelf 4 the two crisper drawers |
| Fridge skins by tier | `A19`, `A20`, `A21` | optional later (the zones are the same in every tier) |
| Crate back and front | `A4`, `A5` | the crate the tokens sit in |
| HUD plaques, star bar, stars, checklist board, result panel | `A12`–`A16` | the screen's frame |
| 12 magnets | `A17` | the collectibles on the fridge door |
| Glass-and-steel tray | `A18` | reusable as a plain drawer |
| Kitchen wall | `A3` | the background |
| All 57 ingredients, 62 supplies, the Floor team | already in the game | tokens, the Market |
| Pantry basket | `A6` | NOT used (the real fridge has no pantry zone) |

## What is missing

| # | Asset | Why it is needed | Priority |
|---|---|---|---|
| R1 | **Cashier portrait** (A22) | the Cashier is required from Level 1 and is the only staff role with no portrait (it shows an emoji) | needed now, not fridge-related |
| R2 | **Fridge door with EMPTY racks** (A23) | the game has a Butter rack and an Aromatics rack on the door; the generated door (A2) is full of jars, so tokens would sit on top of them | needed for the art pass |
| R3 | **Four vegetable bins** (A24) | the Vegetables shelf is split into four game-only bins (roots, salad, stems, pods) that must look different at a glance | needed for the art pass |
| R4 | **Two crisper drawers** (A25) | Fruit and Greens & Herbs are the two drawers at the bottom; they must look different (warm / green tint) | needed for the art pass |
| O1 | Token plates (A26) | a consistent cream plate behind every ingredient token, and a "selected" glow version | optional (the screen has a CSS plate) |
| O2 | Badge stickers (A27) | the ⏳ "expires tomorrow" tag, ×2, NEW BEST, ✓, ✗, combo flame, Hype bolt | optional (Level 74+ and polish) |

Not needed: a Level 14 unlock illustration (the unlock moment uses text and an icon), achievement icons (they use emoji), sparkles and confetti (CSS), sounds (synthesized), the pointing hand (exists).

## How to run it
Open ONE Codex image conversation, attach the reference files listed under each prompt, ask for **4 variants**, keep the best, and save it under the name shown (`art-source/fridge-sort/…` or `art-source/staff/…`). Order: R2, R3, R4 first (they are one set: same fridge), then R1, then the optional ones.
After each image check: no text or letters anywhere, transparent background (or flat green #00FF00 if transparency is not possible), the exact size, nothing cut off, the same warm top-left light as the references.

---

## R1 — Cashier portrait (A22) → `art-source/staff/cashier.png`
Attach: `public/business/staff-portraits/server.webp` and `cleaner.webp` (the existing portraits to match), and `art-source/staff/floor-server.png`.
```
Match EXACTLY the look, framing and lighting of the attached staff portraits: a warm, cozy, hand-painted mobile-game illustration, soft painterly
shading, a thin darker warm-brown outline, golden light from the top-left, a restaurant interior softly out of focus behind the person.
Create a square 1254 x 1254 px head-and-shoulders portrait (FULL SCENE, no transparency) of a friendly restaurant CASHIER: a man in his late
twenties, short dark hair, a warm smile, round glasses, looking at the viewer. He wears a white collared shirt under a dark-green apron with
brown leather straps (the same apron design as the cleaner portrait), a small pen tucked behind his ear, and holds a BLANK paper receipt in one
hand (no printed text, no numbers on it). Behind him, softly blurred: a wooden front counter with a brass cash register and warm hanging lamps.
Face centered in the upper third of the image, shoulders cropped at the bottom edge, exactly like the other portraits.
NO text, NO letters, NO numbers, NO logos, NO watermark anywhere.
```

## R2 — Fridge door with empty racks (A23) → `art-source/fridge-sort/A23-door-empty.png`
Attach: `A2.png` (the existing door, the size and outline to match) and `A1.png` (the fridge it belongs to).
```
Match EXACTLY the style, colors, materials and lighting of the attached open refrigerator door (A2) and fridge (A1): cream enamel with a warm
copper-brown trim, a thin brown outline, warm golden light from the top-left, painterly shading.
Create the SAME open door seen from the INSIDE, same silhouette, same hinges on the LEFT edge, same size 737 x 2135 px, transparent background
outside the door. But inside the door there must be EXACTLY TWO large EMPTY racks and nothing else on them:
 1. an upper rack (about 22% of the door's height, starting about 14% from the top): a shallow cream-and-copper shelf with a clearly visible
    empty open butter-dish nook in the middle, wide enough to lay a block of butter and a few small items on it;
 2. a lower rack (about 30% of the door's height, starting about 45% from the top): a deeper rack with a front rail of thin copper wire, empty,
    wide enough to hold a bulb of garlic, a piece of ginger and a chili laid on it.
Both racks must have a flat, clear, empty floor so small objects can be drawn on top later. NO jars, NO bottles, NO food on the racks.
Keep from A2 only the decoration at the very bottom: the small paper checklist note (only tick marks, no words) held with a magnet, and one
small ivy leaf at the top corner. Do not add a handle on the inside.
NO text, NO letters, NO numbers, NO logos, NO watermark.
```

## R3 — Four vegetable bins (A24) → `art-source/fridge-sort/A24-veg-bins.png`
Attach: `A1.png` (the fridge they sit in), `A18.png` (the glass tray, for the style) and `A4.png`/`A5.png` (the crate wood).
```
Match EXACTLY the painterly style of the attached art (A1 fridge, A18 glass tray, A4/A5 wooden crate): warm, polished, a thin brown outline,
golden light from the top-left, soft shadow to the bottom-right.
Create ONE sheet, 2048 x 512 px, transparent background, with FOUR separate open-top storage bins in a row, each centered in its own equal
512 x 512 px cell (4 columns x 1 row), no grid lines. They are the compartments of a vegetable shelf inside a fridge, seen from slightly above
and in front (a three-quarter view), EMPTY inside so vegetables can be drawn on top later. All four have the SAME shape, size (about 440 px wide)
and rim; only the color and material differ so a player can tell them apart at a glance:
 1. ROOTS & BULBS: a warm earth-brown bin with a burlap-and-wood look;
 2. SALAD & FRUITING: a glossy tomato-red enamel bin;
 3. CABBAGES & STEMS: a fresh leaf-green bin;
 4. PODS & FUNGI: a soft mushroom-beige and lilac bin.
Each bin has a small BLANK cream paper label on the front (no text). Bins are shallow enough that items sitting in them stay visible.
NO text, NO letters, NO numbers, NO logos, NO watermark.
```

## R4 — Two crisper drawers (A25) → `art-source/fridge-sort/A25-drawers.png`
Attach: `A18.png` (the glass tray: the style and the three-quarter view to match) and `A1.png`.
```
Match EXACTLY the style of the attached glass-and-steel tray (A18) and the fridge (A1): warm painterly look, thin brown outline, golden light
from the top-left.
Create ONE sheet, 1024 x 512 px, transparent background, with TWO separate open-top crisper drawers side by side, each centered in its own
512 x 512 px cell (2 columns x 1 row), no grid lines. Each drawer is a clear-plastic crisper tray with a brushed-steel rim and a small handle
slot on the front, seen from slightly above and in front, EMPTY inside so fruit or leaves can be drawn on top later. Same shape and size for
both (about 460 px wide); only the tint differs:
 1. FRUIT: a warm, slightly orange-amber translucent tint;
 2. GREENS & HERBS: a fresh, slightly green translucent tint.
A small BLANK cream label tab on the front of each (no text).
NO text, NO letters, NO numbers, NO logos, NO watermark.
```

---

## Optional

## O1 — Token plates (A26) → `art-source/fridge-sort/A26-token-plates.png`
Attach: `A12.png` and `A15.png` (the paper and wood look).
```
Match the style of the attached HUD plaques and parchment board: warm cream paper, a thin copper-brown rim, a soft drop shadow.
Create ONE sheet, 1024 x 512 px, transparent background, with TWO separate pieces, each centered in its own 512 x 512 px cell (2 columns x 1 row):
 1. a rounded-square cream token card (about 300 x 330 px), plain and EMPTY in the middle (a vegetable will be placed on it), a thin
    copper-brown rim and a soft shadow underneath;
 2. the SAME card with a glowing warm-gold selection ring and a slight lift (a bigger, softer shadow), still EMPTY in the middle.
NO text, NO letters, NO numbers, NO logos, NO watermark.
```

## O2 — Badge stickers (A27) → `art-source/fridge-sort/A27-badges.png`
Attach: `A14.png` (stars) and `A17.png` (magnets, the sticker style).
```
Match the glossy sticker style of the attached stars and magnets (a thin white edge, a warm outline, a tiny glow).
Create ONE sheet, 2048 x 1024 px, transparent background, with EIGHT separate stickers in a 4 columns x 2 rows grid, each centered in its own
512 x 512 px cell, no grid lines. In reading order:
 1. an hourglass tag (sand running out, a warm orange tint) = "expires tomorrow";
 2. a round gold badge with a bold "x2" shape drawn as two simple strokes (no font, no letters);
 3. a red-gold ribbon burst (empty, no text) for "new best";
 4. a green check mark in a round badge;
 5. a red cross in a round badge;
 6. a fire flame (orange to yellow) for the combo;
 7. a lightning bolt in a gold round badge for Hype;
 8. a small crate with a snowflake (the Fridge Sort icon).
NO text, NO letters, NO numbers, NO logos, NO watermark.
```

---

## After the images exist
Put the PNG files in `art-source/` (they stay local and out of git), then ask for the build step: `scripts/make-market-assets.py` is extended to slice them into small WebP (like the supplies and ingredients), the fridge screen gets the art (fridge A1 + door A23 + bins + drawers + crate + HUD + stars + magnets), and `market-art-qa` / `fridgesort.mjs` check the budget and the layout.
