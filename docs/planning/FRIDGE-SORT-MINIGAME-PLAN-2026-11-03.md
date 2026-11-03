# Fridge Sort — "Put the delivery away" (detailed plan + Codex asset prompts)

Status: PLAN ONLY, rewritten 2026-11-03 after reading the code (the real fridge zones, the real unlock levels, the delivery and closing systems). No game code yet.
Developer idea 2026-11-03 (concept image `images/75.png`). Decisions the developer must make are in §9.
Companion file with every art prompt ready to paste: `FRIDGE-SORT-CODEX-PROMPTS-2026-11-03.md`.

**Short answers**
- **Where does it live?** In the Inventory (the fridge) and right after the player buys food in the Market. Four entry points (§2.2).
- **Which level?** It unlocks at **Level 14**, the first level of the game's "Fridge & Freshness" stage (the fridge, spoilage and the closing chores "Throw out spoiled food" and "Wrap and label" all start there). Before Level 14 food never spoils, so there is nothing to put away.
- **How does it work?** After a purchase, a crate of what was just bought appears. The player drags (or taps) each item to the right fridge shelf, drawer or door rack before a 25–50 second timer ends. Right = combo points, wrong = the item springs back. 1–3 stars. Stars give Hype (the Second Floor's Rush meter) and fridge magnets. Never required, never costs money.
- **How big?** About 7 working days; the art is already generated (§5).

---

## 1. The idea, and why build it

After a Market purchase the player can tap **"📦 Put it away"** and sort the delivery into the fridge in a short, hands-on round.

Why (the developer's goal is real revenue: long sessions, return visits, rewarded-ad moments):
- It fills the dead moment after every purchase with a 30–50 second "hands-on toy", the kind of loop short-session players love.
- It makes the fridge the player owns (and the $2,000 / $4,800 upgrades) feel real, and it gives the closing chore "Wrap and label what's left in the fridge" a playable twin later (§9).
- It gives a repeatable star score to chase, plus 12 collectible fridge magnets: a reason to come back tomorrow.
- It carries the one more optional rewarded-ad offer (§9, needs an explicit yes).

## 2. Where it lives and when it unlocks

### 2.1 The level: 14

The campaign has 148 levels (`restaurantProgression.ts`, the real levels after the 150 → 148 remap):

| Level | What opens (existing system) | What it means for this game |
|---|---|---|
| 1 | Market, ingredient stock | the player buys food from the first level, but nothing spoils yet |
| 3 | Second Floor | Hype (the reward) is useful: a Rush needs a machine |
| 5 | Menu | |
| **14** | **Fridge & Freshness** (fridge capacity, spoilage, stock rotation) and the closing chores "Throw out spoiled food" and "Wrap and label" | **Fridge Sort unlocks here**, with its own unlock card ("Food doesn't keep forever. Put it away.") |
| 19 | Dine-in | |
| 21 | Standing-order deliveries (`DELIVERIES_FROM`) | entry point E3 (a delivery to unpack every morning) |
| 27 | Staff | a hired Prep Cook can put crates away automatically (§3.7) |
| 44 / 54 / 74 | Takeaway / a bigger restaurant / full management | bigger crates, all 7 zones, no hints (§3.6) |

Why 14 and not earlier: a sorting game about freshness before freshness exists is a chore with no reason. Why not later: the player already owns 14 ingredients and a 40-unit Basic fridge, and the first spoiled food arrives about now, so the game teaches the idea at the exact moment the need appears.

### 2.2 Entry points (all optional, none blocks anything)

| # | Where | When | Notes |
|---|---|---|---|
| E1 | Market, Ingredients tab: a "📦 Put it away · 6" chip near the top | after any ingredient purchase (one line, "Buy all", Rush Restock) from Level 14 | the crate collects everything bought since the last sort, so a long shopping trip is ONE round, not ten |
| E2 | Inventory screen, the fridge header: the same chip | while a crate is waiting | the permanent home; works after a reload |
| E3 | The morning "Delivery arrived" card (standing orders) | from Level 21, each delivery day | the delivery's lines become a crate |
| E4 | Closing Time, the chore row "Wrap and label what's left in the fridge" | v2 (§9 decision) | not in the first version |

Never: a full-screen interruption, a button that blocks Start service, or a requirement of any kind (CLAUDE.md §7: "the campaign never requires a Business system").

### 2.3 What does not change

The Business Inventory stays the only record of quantities (CLAUDE.md §6, §7: "Inventory is read-only"). The game reads which ingredients just arrived; it adds, removes and moves **no stock, no money, no ledger entry**. Spoilage, freshness and the fridge capacity rules are untouched, so every economy baseline stays frozen.

## 3. How the game works

### 3.1 One round, step by step

1. **The crate.** The player taps "📦 Put it away". The screen opens (a new `fridgeSort` screen, §4) on the open fridge, the crate on the counter below it. The crate holds one token per DIFFERENT ingredient bought (6–12 tokens; a stack badge shows "×4"). A longer shopping list is split into more than one crate.
2. **The tutorial moment** (first time only): the existing pointer hand drags the first token to its shelf; "Drag each item to its shelf" is the only sentence (short-copy rule, an ⓘ explains the rest).
3. **Ready · 3 · 2 · 1 · Go.** The timer starts on the first touch, not on screen open, so a slow reader loses nothing.
4. **Sorting.** The player picks a token (it lifts, a soft glow marks where it can go, and from Level 14 to 26 the right shelf also lights up) and drops it on a shelf, drawer or door rack.
   - Right zone: the token snaps in with a pop and a tick, the shelf's counter goes up (the checklist board on the left: "Dairy 2/3"), the combo grows.
   - Wrong zone: the token springs back to the crate with a soft thud and the combo resets. No time penalty, no lost stock (gentle on purpose).
5. **The end.** All tokens placed, or the timer reaches zero. Time running out is not a failure: the stars earned so far count.
6. **The result card.** Stars, score, the best score for this fridge, what was earned (Hype, a magnet), and two buttons: "Done" and "Again" (a practice round with no reward). If the player never opens it, nothing is lost: the crate simply waits in the Inventory.

### 3.2 The screen (540 × 960 logical, portrait)

```
┌───────────────────────────────┐
│ ⏸      ⏱ 0:38        ★ 1,200  │  HUD: pause, timer plaque, score plaque (blank plaques, text drawn in code)
│ ▓▓▓▓▓▓▓░░░░░ ★ ░░ ★ ░░ ☆     │  star bar: fills with the score, three star marks
│ ┌─────────┐ ┌───────────────┐ │
│ │ Sort &  │ │ DAIRY & TOFU   │ │  left: the checklist board (rows of zone icon + n/m)
│ │ Store   │ │  🧀 🧀          │ │  centre: the open fridge, shelves top to bottom
│ │ 🧀 0/2  │ ├───────────────┤ │         dairy · vegetables (bins) · meat, fish & bread
│ │ 🥕 2/5  │ │ VEGETABLES    │ │         then the drawers (fruit | greens)
│ │ 🥩 0/1  │ │  🥕 🍅        │ │  right edge: the door racks (butter, aromatics)
│ │ 🍎 1/2  │ ├───────────────┤ │
│ └─────────┘ │ MEAT, FISH …  │ │
│             ├──────┬────────┤ │
│             │ FRUIT│ GREENS │ │
│             └──────┴────────┘ │
│  ┌─────────── crate ────────┐ │  the crate (back + front art) with the tokens inside; one is lifted
│  │ 🍅 🥕 🧀 🍎 🥩 🧈 ✋      │ │
│  └──────────────────────────┘ │
└───────────────────────────────┘
```
Touch targets ≥ 48 px (CLAUDE.md §10); the shelves are wide bands, easy to hit on a 320 px phone. Text sizes follow the project's scale (HUD plaques 14–17 px, shelf labels 11–12 px).

### 3.3 The shelves are the fridge's REAL zones

The game does not invent a second classification: it uses `FRIDGE_ZONES` and `fridgeZoneFor` (`business/fridgeView.ts`), the same grouping the Inventory fridge already shows. There are 7 zones:

| Zone | Where | Ingredients (of 57) |
|---|---|---|
| Dairy & Tofu | top shelf | 3: cheddar, mozzarella, tofu |
| Vegetables | middle shelf | 25 (see the problem below) |
| Meat, Fish & Bread | low shelf | 5: bread, baguette, chicken, steak, salmon |
| Fruit | crisper drawer | 15 |
| Greens & Herbs | crisper drawer | 5: basil, parsley, lettuce, spinach, cilantro |
| Butter | door rack | 1 |
| Aromatics | door rack | 3: garlic, ginger, chilli |

**The problem found while planning.** Counted by the level where each ingredient first appears: at Level 14 the player knows 14 ingredients and 9 of them are vegetables; at Level 27, 13 of 20. A plain 7-zone sort would be "drop almost everything on Vegetables": no puzzle, no combos.
**The fix (decision D1, §9):** the game splits the Vegetables shelf into 4 game-only **bins** by how a cook thinks about them, so the biggest group becomes a real choice. The fridge itself and `fridgeZoneFor` do not change; the bins live in the new rules file with a test that every one of the 25 vegetables has exactly one bin:
- *Roots & bulbs:* potato, onion, carrot, turnip, beetroot, radish, sweetpotato, pumpkin
- *Salad & fruiting:* tomato, cucumber, pepper, zucchini, eggplant, corn
- *Cabbages & stems:* broccoli, cauliflower, cabbage, celery, asparagus, fennel, artichoke, springonion
- *Pods & fungi:* greenbean, peapod, mushroom

Result: at Level 14 the player sees about 6 targets (3 vegetable bins, dairy, a protein/bread shelf, a drawer) and every token is a real decision.

### 3.4 Controls and feedback

- **Drag** (pointer events, works with touch and mouse) **or tap-then-tap** (tap a token, tap a shelf): the second is the accessibility path and the default for slow connections or small thumbs. Both always work.
- **Feedback:** the token lifts with a shadow; the target shelf glows; right = pop + tick + a "+100" that floats up; wrong = shake + thud. Combo 3, 5, 8 each get a small flourish. All sounds are **synthesized** in `AudioManager.ts` (pick, place, wrong, combo, tick, finish): no sound files.
- **Reduced Motion:** no flying, floating numbers or shake; tokens appear in place and the shelf just flashes. The timer and rules are identical.
- **Pause:** freezes the clock and hides the fridge (so it cannot be used to plan), "Resume" / "Skip this crate".

### 3.5 Rules, score and stars

- **Time:** `20 s + 2.5 s × tokens` (8 tokens = 40 s, 12 tokens = 50 s). Level 14–26 adds +30 % (the player is learning).
- **Score:** 100 per right placement × a combo multiplier (+0.25 per right in a row, up to ×3), plus 20 per second left when every token was placed.
- **Stars** (thresholds to be tuned by the QA suite and real play): ★ at 50 % of the best possible score, ★★ at 75 %, ★★★ at 95 %. The bar fills as the score grows.
- **Practice rounds** ("Again") score and show stars but give no reward, so nothing can be farmed (crates only come from real purchases anyway).
- **Best score** is kept per fridge tier.

### 3.6 Difficulty by level

| Levels | Crate | Targets | Help | Time |
|---|---|---|---|---|
| 14 – 26 | 6 tokens | 5–6 (3 veg bins + what the crate needs) | the right shelf glows when a token is lifted | +30 % |
| 27 – 43 | 8 tokens | 6–7 | glow only after a wrong drop | normal |
| 44 – 73 | 10 tokens | all 7 zones + 4 veg bins (10 targets) | no glow | normal |
| 74 + | 12 tokens | all targets; an ⏳ token (it expires tomorrow) is worth ×2 if placed before the timer's last third | none | normal |

(Crate size is also capped by what was really bought; a crate is never padded with items the player does not own.)

### 3.7 Rewards and what keeps people coming back

All rewards are non-money (CLAUDE.md §7: the economy baselines stay frozen).
- **Hype** (`addHype`, the Second Floor's Rush meter; 100 starts a free 3-minute ×3 Rush): ★ +5, ★★ +10, ★★★ +15, once per crate. A normal day has about 2–3 crates, so this adds about 10–25 Hype a day on top of the level-clear Hype (20 + 20 per star).
- **12 fridge magnets**, shown on the fridge door in the Inventory: one per 3 ★★★ crates, in a fixed order (deterministic).
- **Achievements** (the existing Progress → Achievements): "Tidy Fridge" (10 crates), "Perfect Crate" (5 × ★★★).
- **Tidy streak** (v2): a business day with at least one ★★ crate keeps the streak; 3 and 7 days give a magnet.
- **Prep Cook helper** (from Level 27, the staff stage): a hired Prep Cook puts a crate away on its own, with no stars and no reward. So the game stays optional forever and late-game players who do not want it never see a chore.
- **An optional rewarded ad** (not in the first version): "Watch to double the Hype from this crate", which needs its own `AD_PLACEMENT`, a daily cap and a line in `ads/adBonuses.ts`; only with the developer's explicit yes (§9).

### 3.8 Edge cases

| Case | What happens |
|---|---|
| Nothing was bought | the chip is not shown |
| The fridge was full / a line was skipped by the wallet | only what was really bought is in the crate |
| Reload or app switch mid-round | the round is not saved; the crate is still waiting and the next open starts it fresh (no half-state, no exploit) |
| Several purchases before sorting | the crate grows (max 12 tokens, the rest queue as the next crate) |
| The player buys again after sorting | a new crate starts |
| Old saves | `business.fridgeSort` missing = nothing waiting; nothing breaks |
| Device clock changes | no time-based reward: the timer is local to the round; streak days use the game's own restaurant day |
| A player below Level 14 | the chip never appears |

## 4. Technical plan

New files (React DOM + CSS, no Phaser, no animation library; the existing UI primitives):
- `src/game/business/fridgeSort.ts` — PURE rules: `crateFrom(delivery)`, the zone and vegetable-bin mapping (`zoneOf`, using `fridgeZoneFor`), `targetsFor(crate, level)`, `timeLimitMs`, `scoreRound`, `starsFor`, `rewardFor`, the seeded token order (seed = crate id; no `Math.random()`). No I/O, no money.
- `src/components/kc/inventory/FridgeSortGame.tsx` (the screen), `FridgeSortChip.tsx` (the entry chip used by E1/E2/E3).
- `ScreenId "fridgeSort"` in `components/kc/data.ts` + the router.
- Save: `business.fridgeSort?: { crate?: IngredientId[]; crateId?: number; best?: { basic?: number; commercial?: number; professional?: number }; totalStars?: number; magnets?: number; perfect?: number; streak?: { day: number; days: number } }` through the nested-migration pattern in `SaveManager`; Hype goes through the existing `addHype`. No new top-level field, no new wallet/ledger/registry.
- The crate is set in exactly ONE place: where an ingredient purchase is committed (`persistIngredientPurchases` in `App.tsx`, the single place every Market line, "Buy all" and Rush Restock pass through) and by the delivery arrival (`deliveries.ts`).
- `AudioManager.ts`: six synthesized cues.
- Analytics through `sendAnalyticsEvent` (snake_case, no personal data): `fridge_sort_offered`, `fridge_sort_started` {level, tokens, targets}, `fridge_sort_finished` {stars, score, mistakes, seconds_left}, `fridge_sort_skipped`, `fridge_sort_auto` (the Prep Cook).
- A dev flag `?fridgeSort` to show it below Level 14 for testing (the same pattern as `?floor2`).
- Tests: `scripts/fridge-sort-qa.mts` (all 57 ingredients map to exactly one zone and the 25 vegetables to exactly one bin; crates are deterministic for a seed; time, score and star tables; reward once per crate; **credits, inventory and ledger are byte-identical before and after a round**; old saves read as empty; never negative; a perfect player always reaches ★★★ and a random player never reaches ★); browser `tools/e2e/fridgesort.mjs` (the drag path and the tap path, the timer ending, skip, Reduced Motion, the layout at 320 / 390 / 768, the chip showing only from Level 14); additions to `ui-copy-qa` and `market-art-qa`.

## 5. Art, phases and how we will know it works

**Art is mostly done** (generated by Codex; sources local-only in `art-source/`, only optimized WebP is committed):
- Already in the game: the 57 ingredient pictures (`public/business/ingredients/`), reused here as the tokens.
- Generated, waiting for the game screen (A1–A21): the open fridge (A1) and door (A2), the crate back and front (A4, A5), the wall (A3), HUD plaques (A12), star bar (A13), stars (A14), checklist board (A15), result panel (A16), 12 magnets (A17), glass bin (A18), and three fridge skins by tier (A19–A21, optional later: the zone layout is the same in every tier).
- Budget: new art ≤ 1.3 MB of WebP. The slicing script `scripts/make-market-assets.py` is extended for these, like the supplies and ingredients.
- Missing: nothing for this game. (The Cashier portrait, A22, is a separate staff gap.)

**Phases** (each ends with the CLAUDE.md §5 gates):

| Phase | Work | Time |
|---|---|---|
| P0 | the decisions in §9 | 0.5 d |
| P1 | `fridgeSort.ts`, the save field, the migration, `fridge-sort-qa` | 1.5 d |
| P2 | the playable screen on the existing emoji/pictures and CSS shelves; the chips E1/E2; the unlock card at Level 14 | 2.5 d |
| P3 | art integration: A1/A2 fridge, crate, HUD, stars, magnets; slicing script; budget check | 1.5 d |
| P4 | synthesized sound, combo feedback, Reduced Motion, the delivery entry E3, analytics, the browser test, a real-device pass | 1.5 d |

**How we will know it works** (Bridge analytics; the live Playgama build is old, so measure only after the new build ships):
- offered → started ≥ 50 %, started → finished ≥ 90 %, average stars ≥ 2, a round under 50 s;
- more crates per day among players who tried it; a longer session and a better next-day return than players who did not;
- guardrail: no drop in levels played per session and no rise in Quit during the round.
Rollout: ship dark behind the flag, then on for everyone; if the funnel is weak, tune the time and thresholds (data in `fridgeSort.ts`) before touching anything else.

---

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
| A6 | Pantry basket (wicker) | (not used) | 640 × 360 | NOT USED: the real fridge has no pantry zone (every ingredient has a fridge zone). The art exists; leave it out of the build. | never |
| A7–A11 | Painted ingredient sprites, 5 sheets of 12 cells (57 items) | `ing-<id>.webp` ×57 | 192 × 192 each | cells 256 × 256 in the sheet | P3 (emoji until then) |
| A12 | HUD plaques sheet (timer, score, pause, shelf tag) | `hud-*.webp` | 4 pieces | blank, 9-slice friendly | P3 |
| A13 | Star progress bar (frame + fill) | `starbar-*.webp` | 720 × 90 | the fill is a separate strip | P3 |
| A14 | Stars (full, empty, big result star) | `star-*.webp` | 3 × 160 | | P3 |
| A15 | Checklist board (parchment on a nail), blank | `board.webp` | 420 × 560 | 9-slice | P3 |
| A16 | Result ribbon + panel, blank | `result-*.webp` | 900 × 700 | 9-slice | P3 |
| A17 | Fridge magnets sheet (12 magnets) | `magnet-*.webp` ×12 | 128 × 128 each | collectibles on the door | P3/P4 |
| A18 | Optional glass bins (drawer) | `bin.webp` | 940 × 220 | OPTIONAL (CSS glass if too hard) | P4 |
| A22 | Cashier portrait (staff gap, not fridge-related) | `public/business/staff-portraits/cashier.webp` | 320 × 320 (generate 1254 square) | head and shoulders, like server.webp | now |

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

### A6 — pantry basket (NOT USED, kept only because it was already generated)
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

### A22 — Cashier portrait (a gap found 2026-11-03, NOT part of the fridge game)
The Cashier is required from Level 1 and is the only staff role with no portrait (it shows an emoji). Match the existing portraits in
`public/business/staff-portraits/` (server.webp, cleaner.webp): head and shoulders, a warm restaurant interior with soft bokeh lamps behind.
```
[STYLE BIBLE]
ASSET A22 (FULL SCENE, no transparency, square 1254 x 1254 px): a head-and-shoulders portrait of a friendly restaurant CASHIER in his late
twenties, short dark hair, a warm smile, round glasses, looking at the viewer. He wears a white collared shirt under a dark-green apron with
brown leather straps, a small pen behind his ear, and holds a BLANK paper receipt (no printed text or numbers on it) in one hand. Behind him,
softly out of focus: a wooden front counter with a brass cash register and warm hanging lamps in a cozy restaurant. Same framing, face
position (upper third, centered), warm golden light and painterly style as the other staff portraits (the server with the bow tie and the
cleaner with the green apron). No text anywhere, no logos.
```

## 9. Decisions for the developer (my recommendation first)

| # | Question | Recommendation |
|---|---|---|
| D1 | Split the Vegetables shelf into 4 game-only bins (roots & bulbs, salad & fruiting, cabbages & stems, pods & fungi)? | **Yes.** Without it, 9 of the 14 ingredients at Level 14 (25 of 57 overall) go to one shelf and the game has no puzzle. The fridge screen itself is not changed. |
| D2 | Unlock level | **14** (the start of Fridge & Freshness). Attach the unlock to the existing stage's card; do not add a new restaurant system id (that would touch `restaurant-progression-qa`). |
| D3 | Rewards | **Hype + 12 magnets + 2 achievements, no money, no spoilage bonus.** A freshness bonus would change spoilage and break the frozen economy baselines. |
| D4 | A rewarded-ad offer (double the Hype, or +15 s) | **Not in the first version.** Add in P4 only with your explicit yes: it needs its own `AD_PLACEMENT`, a daily cap, and a line in `ads/adBonuses.ts`. |
| D5 | A hired Prep Cook puts crates away by itself (no stars, no reward) | **Yes.** It keeps the game optional for good, and gives the Prep Cook one more visible job. |
| D6 | Closing chore "Wrap and label what's left in the fridge" opens the game | **Not in v1.** Look at it after the first numbers (it would be the third entry point to the same game). |
| D7 | Fridge skins by tier (A19–A21) | **Later.** One fridge body for all tiers first; the zones are identical in every tier. |
| D8 | One crate per shopping trip (max 12 tokens, the rest queue) | **Yes.** Ten separate rounds after ten purchases would turn a toy into a chore. |
| D9 | Optional or required | **Always optional.** |

## 10. Risks

- **A lopsided puzzle** (25 of 57 ingredients are vegetables): handled by D1 and checked by a test.
- **Friction after every purchase:** the entry is a small chip, never a popup; the crate collects a whole trip; the Prep Cook can do it; skipping costs nothing.
- **Dragging on small phones:** the tap-then-tap path is always available, targets are wide bands ≥ 48 px, and a round has at most 12 tokens (transform-only animation, no layout thrash).
- **Looks that do not match the game's fridge:** the generated fridge was sampled from the Inventory's own fridge (cream enamel, brown trim); the Inventory fridge and the game must be compared side by side in P3.
- **Art volume:** already generated; the slicing and the WebP budget are the same pipeline that already shipped the supplies and ingredients.
- **A weak reason to come back:** the magnets, the streak and the Hype are the hooks; if the funnel is weak the tuning data is in one file.
- **Playgama's live build is old:** no measurement is meaningful until the new build ships (the analytics events carry `game_version`).
