# Business pages, painted: plan (developer 2026-11-25)

**Request:** "Make the Business UI pages exactly like this in the document" (`C:\Users\HP\Documents\OneDrive\Documents\Business UI design.docx`, 11 pictures), plus a plan and Codex prompts for every asset.
**Two notes written inside the document:**

1. "If we have discussed or added any description for each kitchen upgrade add that also under each kitchen, if not it's okay." The descriptions exist (`KITCHEN_UPGRADE_CATALOG`: `tagline` + `description`, and the earnings / seats benefit), so each kitchen card shows them (see Upgrades).
2. "We already have dish images right? Use that in the menu page." Yes: 221 painted dish plates, one per recipe, `public/dishes/<recipe id>.webp` (`dishArtUrl()` in `src/game/dishArt.ts`). The Menu uses them instead of the emoji.

**STATUS 2026-11-25: BUILT.** The six tabs are done and tested; all 9 Codex sheets are cut and on the pages (`RB-icons-b` and `RB-decor-c` were regenerated). Corrections to the plan below: the Equipment page keeps `equipment-banner.webp` as the fallback of its painted scene (A4: only the Suppliers, Menu and Operations photos are unused); the Analytics cards were already in the pictures' order (Best-Selling, Ingredient Purchasing, Supply Purchasing, Ingredients Used); the price on the Menu sits between two laurel branches (`pieces/laurel-left` / `laurel-right`), so `pieces/price-laurel` (a full wreath) is not used.

**Codex prompts:** `docs/planning/BUSINESS-UI-CODEX-PROMPTS-2026-11-25.md`.
**The 11 pictures, one file each, in this repo:** `docs/planning/reference/business-ui/01-…11-….jpg` (extracted from the document, in the document's order). They are AI concept images (same as the Restaurant Progress ones): follow their STYLE and the CONTENT, not their glitches (garbled letters, odd counts).

## 1. What the 11 pictures are (and where each lives today)

| #   | Picture                                                                  | Business tab / code today                                                                                                      |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| 01  | Pace · per hour, Restaurant Rank, One Restaurant                         | **Overview** (`BusinessDashboard.tsx` `Overview`: `PaceCard.tsx`, `RankCard`, `OneRestaurantNote`)                             |
| 02  | Kitchen Equipment banner, Your Refrigerator                              | **Equipment** (`BusinessRefrigerator.tsx`, top)                                                                                |
| 03  | Refrigerators (3 cards), Knives, Boards & Sharpening                     | **Equipment** (`BusinessRefrigerator.tsx`, bottom)                                                                             |
| 04  | Grand Kitchen header + five other kitchens                               | **Upgrades** (`KitchenUpgrades.tsx`, embedded)                                                                                 |
| 05  | Your Ingredient Supplier, Standing Orders, Today's Supplier Conditions   | **Suppliers** (`restaurant/IngredientSupplier.tsx`, `restaurant/Deliveries.tsx` `StandingOrdersCard`, `BusinessSuppliers.tsx`) |
| 06  | Local Market / Wholesale / Premium contract cards                        | **Suppliers** (`BusinessSuppliers.tsx`, the contract offers)                                                                   |
| 07  | Menu Management                                                          | **Menu** (`BusinessMenu.tsx`)                                                                                                  |
| 08  | What Needs Attention, Today's Service                                    | **Operations** (`BusinessDashboard.tsx` `Operations`)                                                                          |
| 09  | Inspection · Right Now, Finance                                          | **Operations** (`InspectionSummary` in `BusinessInspections.tsx`, `BusinessFinance.tsx`)                                       |
| 10  | Last 30 Days, Best-Selling Dishes                                        | **Operations** (`BusinessHistory.tsx`, `BusinessAnalytics.tsx`)                                                                |
| 11  | Best-Selling, Ingredient Purchasing, Supply Purchasing, Ingredients Used | **Operations** (`BusinessAnalytics.tsx`)                                                                                       |

The document does not show the **Staff** tab, the tab strip, the Business header, the Cleanliness screen or the Inspection detail screen. They keep today's look (see assumption A1).

## 2. The look (one kit, two ribbons)

The pictures use the same family as the Restaurant Progress page: warm cream paper cards with a soft shadow, painted gold-outlined icons, glossy gold progress bars, cream "pill" value chips, plus ONE new thing: a **second heading style**.

- **Gold tab ribbon** (Overview, Equipment, Suppliers cards): the existing `pg-ribbon` (`styles.css`) with a painted icon at its left. Reused as is.
- **Dark wood ribbon with leaf sprigs** (Menu, Operations, Finance, History, Analytics headings): NEW `bz-ribbon-dark`, a walnut gradient ribbon, gold-brown outline, ivory Fraunces title, a painted icon overlapping its left end and a leaf sprig (`icons-c/leaf-right` from the Progress art) at its right end.
- Cards: the existing `pg-card` (container-query card, optional `right` decoration slot). Value chips: `ValuePill`. Bars: `GlossBar` (gold / green). Rows: `IconRow`, `StatTile`. All from `src/components/kc/progress/ProgressKit.tsx`; the Business pages import them (they are generic). Only the dark ribbon, an "info card" with a tinted background (`bz-hot`: the gold-highlighted row in Finance / the current supplier) and a "table head" (`bz-thead`, brown bar) are new.
- Landscape: every mock-up is a wide window. The pages are laid out with container queries like the Progress page (`@min-[720px]` etc.), so the same markup works from 320 px to a 1815 px desktop; the wide windows get the pictures' arrangement (3 fridge cards side by side, 3 stat tiles in a row, tables full width), portrait stacks them.

## 3. Page by page: what changes, what stays

Rule from the Restaurant Progress work (developer-approved): **where the mock-up's wording differs from the game's, the game's wording stays** (e.g. "Cash in outfit" in picture 09 is a garble; "waitting" in 01 is a typo; the fridge wear chips "+10–15%" in 02 are not game rules: the game keeps its "🔧 <60 · 💥 <20" repair costs line). **No money, rule or save field changes.** Every `data-testid` stays.

### Overview (pictures 01)

- **Pace · per hour** card: gold tab ribbon with a stopwatch, `ⓘ` right; deco top right (`pace-cluster`: silver cloche, leaves, coins). Three `StatTile`s in a row (Earned / Costs / Net, Net highlighted gold) each with an icon (coins, clipboard-calculator, rising bars) and two value pills (LAST DAY, AVG n). Today's text rows stay the same numbers (`paceOf`).
- **Guests next** row: guests icon, "Guests next · Breakfast 10 · 🙁 1 turned away", chips (chair "5 booked + 2 seats", star "Reputation +1", book "Menu +1", sparkles "Spotless +1") from `pullChips`; **Last service** with gold star + five stars at the right (`ⓘ` right).
- **Second Floor** row: building icon, "Second Floor +$/h" and a gold pill "$X waiting · Full in 3 h 15 min" (clock icon). Same data.
- **Restaurant Rank** card: gold tab ribbon (trophy); the rank medal (`medals/medal-N` from the Progress art, by rank tier), the title (Fraunces), "Service 70 / 91 · every rank reached" / "Next: …" line, a long `GlossBar` with "70 / 91" at its end, big gold CTA "View Restaurant Progress →" with the storefront icon; skyline ghost behind (`wide/skyline`, Progress art).
- **One Restaurant** card: gold tab ribbon with the plate icon, `ⓘ`; four tiles in a row (cloche "Service after service", clipboard "Orders · stock · supplies · staff", storefront "Open for service from the Kitchen", padlock "Endless Restaurant · after the final service" = the game's `ENDLESS_RESTAURANT_NAME`), footer "🍽️ One restaurant = 💵 one wallet" with painted plate and wallet. The existing "One restaurant · one wallet" caption under the page is replaced by this footer (not shown twice).
- `CampaignDayCard` ("Your restaurant today", its photo background) is not in the picture (the picture is cropped above Pace): kept unchanged on top (A2).
- Endless-state Overview (`RestaurantHealth`, `KpiCards`, popularity, "Business figures" toggle) is not in the document: it is moved onto the same card kit (cream cards, painted icons) but its content and order do not change (A3).

### Equipment (pictures 02, 03)

- **Banner:** a rounded gold-framed picture (new `equipment-scene`, a dark-wood kitchen with a steel fridge, shelves of jars and a plant) with a blank wooden plaque on the left that carries the live text "Kitchen Equipment" and a chef hat with laurels. Replaces `public/business/equipment-banner.webp`.
- **Your Refrigerator:** gold tab ribbon with a small fridge icon; the fridge in the card's top-left is the painted fridge of the current rank (replaces the CSS `FridgeMini`); `ⓘ`; status badge (GOOD / fair / poor) as a green laurel badge with a thumb; **Space** row (box icon, green `GlossBar`, "194.2 / 240" and a green pill "45.8 free"), **Condition** row (wrench icon, gold `GlossBar`, "100 / 100"); wear line (game wording) with a wrench and a burst icon and `ⓘ`; "✓ Working well" in green, or the Repair / Service button when needed (unchanged behaviour).
- **Refrigerators:** gold tab ribbon (fridge icon, leaf, a small shelf-with-jars ghost at right: `fridge-shelf`); three equal cards: the painted fridge standing on a soft shadow ellipse (the current one has a gold sunburst behind it), name + `ⓘ`, two pills (box = capacity units, wedge = ft³), price or "Included" in a small ribbon, the button (Switch = tan, Upgrade · $ = gold with hammer, Current = green with tick), and the "Too small · 194.2 stored" line. "Your stock moves to the new fridge" between two rules.
- **Knives, boards & sharpening:** gold tab ribbon (knife), the three chips (cart "Shared", storefront "Buy in Market", hammer+wrench "Blacksmith sharpens"), the deco picture (the Progress `wide/knives-deco`: board, whetstone, knife block) and the wide CTA "Manage in the Market →" with the storefront icon.

### Upgrades (picture 04) — with the descriptions

- **Header card** (the selected kitchen): its real kitchen picture in a gold rounded frame with a crown on its corner when current, laurel sprigs both sides, the name (Fraunces) + `ⓘ`, the **tagline** in caps ("THE DREAM, REALIZED"), the benefit line (gold star "+7% earnings" · chair "+2 guest seats"), a faint kitchen silhouette at the right (`kitchen-ghost`). Under it the state bar: green "✦ 👑 Current Kitchen ✦", or "Build · $" (copper), "Unlocks Level N · $", "Build the X first" (unchanged logic).
- **Tier cards** (2 per row portrait, 3 per row wide): the kitchen picture, a dark wood **name ribbon** with laurel sprigs, **and under it the description** (developer's note: the upgrade's own `description`, one or two lines, 12.5 px: "More counter space, more light — the kitchen is starting to fill out.") then the benefit chips and the state pill ("UPGRADED ✓", "CURRENT" green, "$12,000", "Lv 51"). The current card has the sunburst glow and a crown. The kitchen pictures are the six that exist (`KitchenBackground` skins); no new kitchen art.
- Tapping a card still selects it (the header and Build button follow).

### Suppliers (pictures 05, 06)

- **Your Ingredient Supplier:** gold ribbon with the market icon; sub line "See Market prices · Switch freely" (game wording: "Sets Market prices · switch free"); `ⓘ`; the produce cluster top right (`produce-cluster`). Three rows: painted supplier icon (market / truck / basket), name, "Standard prices · Tomato $2.19 a unit" line, chips (clock "+1 day fresh", star "quality bonus"), right: "Choose" pill button or green "✓ CURRENT". The current row is tinted gold (`bz-hot`).
- **Standing Orders:** gold ribbon (boxes icon), `ⓘ`; sub line "Order at closing · Arrives by morning" with moon and sun icons; the orders cluster (`orders-cluster`). Two rows: Fresh delivery (veg picture, an "Off" pill, "2 days · every 2 days") and Weekly delivery (box picture, "slow goods + cleaning · 7 days · Mondays"), "Turn on" / "On ✓" pill buttons.
- **Supplier credit** card (only when credit is taken): same card kit, no new picture.
- **Today's Supplier Conditions:** gold ribbon (calendar), the "Day 18" pill with a calendar icon, "☀️ A quiet day — normal prices" or the event name + price badge, the price-tag line, the faint market-stall deco at the right (`stall-ghost`). **The "Possible supplier events" chip list** (nine chips, three lines of small text; not in the picture) moves behind the `ⓘ` of this card (short-copy rule, nothing is deleted).
- **Contract cards** (picture 06): one card per supplier: painted icon (market / truck / basket) + name + `ⓘ`, the "$1.00 tomato → $0.92 today at $2+ units" line, the deco picture at the right (`stall-tomatoes`, `warehouse`, `tomato-bag`), a "Discount" `GlossBar` with the % pill, three tiles in a row (cart "Min. order", calendar "Contract", cancel-circle "Cancel"), the "For reference: delivery …· quality …" line with a sparkle. The current contract: gold tint, green "✓ YOURS", the Cancel button (unchanged rules and testids).

### Menu (picture 07) — with the dish pictures

- **Header:** a dark wood plaque "Menu Management" with a chef hat and leaf sprigs (`menu-plaque`, blank plaque; the title is live text). The "n / m dishes" count (`menu-active-count`) sits at its right as a pill; the "🥕 n ingredients · ❄️ n units · ⓘ" chips stay as one slim line under it; the "popular, raise your prices" tip card stays (game content, not in the picture).
- **Category chips:** a row of pills, each with a painted category icon (Salad, Appetizer, Entree, Side, Curry, Dessert, Stir-Fry: exactly the game's seven categories) and "All" first; active = dark wood pill with ivory text. ≥ 48 px tall, scrolls sideways when narrow (as today).
- **Dish card:** the dish's own painted plate from `public/dishes/` (`dishArtUrl(dish.sourceRecipeId)`; the emoji only when a dish has no picture) in a gold-framed rounded square on a warm wood-table tile (`plate-frame`, a Codex piece); the name + `ⓘ` (+ the 🔥 chip when hot), the category in caps (copper), the ingredient line (existing `IngredientIcon`s + amounts, with the ✓ / 🛒 mark), the **price badge** in the middle (laurel wreath piece `price-laurel`, the price in Fraunces, "suggested price" and "max $X"), the green **On** switch (check mark + knob; Off = grey) with the − / + buttons under it, three tiles in a row (coins "Customer pays", cloche "Food cost", chart "Kept per plate" in green), and the line "⭐ 66 · ×1.10 · 92% kept" with the "8% FOOD COST" pill at the right (colour by `foodCostPercent`). Wide window: price badge centre, switch right; portrait: stacked.
- Locked dishes section ("🔒 Locked") keeps its content with the same card look; dishes in it use the grey-scaled picture.

### Operations (pictures 08–11)

- **What Needs Attention:** dark wood ribbon with the gold bell, leaf sprig; each alert is a row card: painted picture at the left (inspection → clipboard with magnifier; spoilage → crate of veg; fridge repair / low stock → the matching picture), warning triangle + title (Fraunces), the glance line with icons (shield "2 checks", cash "$55.00 fine tonight"; the ingredient icons + trash can), `ⓘ`, a deco cluster at the right (`inspection-cluster`, `spoils-cluster`), and a full-width cream pill button ("View Inspection →"). The all-clear chips ("✓ Menu Ready", "✓ Staff") as green pills below. Behaviour, severities and the Rush Restock actions are unchanged.
- **Today's Service:** dark ribbon with the calendar; the "Customers Today" row with a guests icon and a pill "0 / 63 served" (the thin bar is dropped: the pill says it); the big wood CTA **"🔔 Open Service →"** with sparkles (copper → walnut gradient); a dashed rule; **If you end the day now** with a painted icon per row (toque, crate, clipboard, star, coins, money bag), right-aligned values (game wording), the chalkboard deco (`chalkboard`); the moon "Day ends at closing" + padlock "Endless Restaurant after the final service" footer line. "End Business Day →" (Endless only) keeps its place under the rows.
- **Inspection · Right Now:** a card with the big clipboard-magnifier art overlapping its top-left corner, the dark ribbon title, "4 / 7 checks" + `ⓘ`, the **seven check badges** (round cream tiles: snowflake = Food Storage, hourglass = Ingredient Expiry, ice cube = Refrigerator Condition, wrench = Equipment Condition, broom = Kitchen Cleanliness, shield = Food Safety, people = Staff Compliance) each with a small green tick / orange "!" / red cross badge at its corner (PASS / WARN / FAIL), the overall "WARNING" badge (burst) at the top right, and the big brown "View Inspection →" button at the right (wide) or under (portrait).
- **Finance:** dark ribbon with a coin stack; two columns on wide windows: **Today so far** (calendar header row; icon rows Revenue, Ingredients & packaging used, Repairs & supplier fees, the gold-tinted "Profit so far · before pay & fines" row, Cash moved today, and the game's own "Cash vs costs ⓘ" line, which picture 09 garbles as "Cash in outfit") and **Last business day** (Revenue, Costs, tinted Profit, "Full day breakdown ▾" toggle), then the full-width **All time** card (trophy header; Revenue, Costs, tinted Profit, "Orders served" pill; the extra detail lines stay behind the same toggle as today).
- **Last 30 Days:** dark ribbon with the calendar; a chip row (10 days, revenue, costs, profit, orders) and the chart-easel deco; a **table**: a brown head bar (Day / Revenue / Orders / Profit with icons), 10 zebra rows (a painted date page with the day number written live over it; revenue; a pill "0 orders"; the profit in a pink pill when negative, green when positive). A day still opens its detail on tap (today's behaviour).
- **Best-Selling Dishes:** dark ribbon with a trophy; each top dish shows its plate picture (the dish art, small) + name + "n orders · $"; empty: plate icon + "Nothing served yet"; the cloche-with-laurels deco.
- **Ingredient Purchasing:** dark ribbon with the grain-sack icon; four tiles (This Business Day, Average Purchase, Spent Today, All Time + "Last day $") with their icons; the produce / sack / oil deco.
- **Supply Purchasing:** dark ribbon with the truck; three rows (smallwares pan, tableware plates, takeaway boxes: icon, name, "7 Market orders, all time · saved $37.65 at retail", amount pill) + the "929 packaging cost · $56.99 ⓘ" pill + the paper-bag deco.
- **Ingredients Used:** dark ribbon with the veg basket; the rows as today (the ingredient pictures that exist, `IngredientIcon`) or "Nothing served yet"; the tomato / garlic / oil deco.
- Order of the Analytics cards stays the game's (Best-Selling, Ingredient Purchasing, Ingredients Used, Supply Purchasing); the pictures show Supply before Used, which is not required (same rule as the Progress page).
- Footer of the Operations page: "🍽️ One restaurant | 💵 One wallet" with the painted plate and wallet, as in picture 11 (the same footer as Overview's, one component).

## 4. What is cut or shortened (the audit)

Nothing that is a game fact is deleted; everything that is shown today either appears in the picture or moves behind an `ⓘ`.

| Today                                                                                                      | In the redesign                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Three different banners (equipment, suppliers, menu, operations photos in `public/business/*-banner.webp`) | Replaced by the painted ribbons / plaques; the four section photos are no longer used (files deleted after the build is green, A4) |
| "Possible supplier events" chips (suppliers)                                                               | Behind the `ⓘ` of Today's Supplier Conditions                                                                                      |
| Customers Today thin bar (operations)                                                                      | Replaced by the "0 / 63 served" pill                                                                                               |
| "One restaurant · one wallet" caption (Overview)                                                           | Becomes the card's footer line (not twice)                                                                                         |
| Fridge `FridgeMini` drawn in CSS                                                                           | The painted fridges (CSS drawing kept as the fallback)                                                                             |
| Kitchen-upgrade `ⓘ`-only description                                                                       | Description printed under each kitchen (developer's note)                                                                          |
| Menu emoji (🥗, 🍝 …)                                                                                      | The painted dish plate, emoji as fallback                                                                                          |

## 5. Assets

**Reused as they are (already painted, from the Restaurant Progress art in `public/progress/`, 120 pictures):** coins, money bag, cash, bars, chart-trend, trophy, crown, star, sparkles, toque, storefront, book-open, padlock, knife, hammer, board, clipboard-check, guests, people, box, crate, takeaway-bag, cloche, calendar, tick, leaf-left, leaf-right, medals (rank tiers), `wide/skyline`, `wide/knives-deco`, `pieces/clipboard`. **Dish pictures:** `public/dishes/*.webp` (221). **Kitchen pictures:** the six `KitchenBackground` skins. **Ingredient icons:** `IngredientIcon`.

**New (79 pictures, 9 sheets, `Business UI Assets/RB-<sheet>.png`, prompts in the prompts file):**

| Sheet           | Pictures                                                                                                                                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RB-icons-a (23) | stopwatch, clipboard-calc, chair, second-floor, clock-gold, plate-cutlery, wallet-cash, fridge-icon, thumbs-up, wrench, burst, volume-wedge, cart, moon, sun, price-tag, alarm-clock, cancel-circle, local-market, wholesale-truck, premium-basket, fresh-delivery, weekly-box |
| RB-icons-b (19) | bell-gold, warning-triangle, shield, trash-bin, snowflake, hourglass, ice-cube, broom, badge-ok, badge-warn, badge-bad, crossed-cutlery, date-page, grain-sack, cubes, smallwares, tableware, takeaway-box, veg-basket                                                         |
| RB-icons-c (7)  | the seven dish-category icons: salad, appetizer, entree, side, curry, dessert, stir-fry                                                                                                                                                                                        |
| RB-fridges (3)  | basic, commercial, professional                                                                                                                                                                                                                                                |
| RB-pieces (6)   | laurel-left, laurel-right, name-ribbon, sunburst, price-laurel, plate-frame                                                                                                                                                                                                    |
| RB-decor-a (9)  | pace-cluster, kitchen-ghost, fridge-shelf, produce-cluster, orders-cluster, stall-ghost, stall-tomatoes, warehouse, tomato-bag                                                                                                                                                 |
| RB-decor-b (9)  | inspection-cluster, spoils-cluster, chalkboard, chart-easel, cloche-laurel, purchasing-cluster, bag-cluster, used-cluster, clipboard-large                                                                                                                                     |
| RB-decor-c (1)  | knives-deco (the board, whetstone and knife block of picture 03; the Progress `wide/knives-deco` is a chef hat)                                                                                                                                                                |
| RB-banners (2)  | equipment-scene, menu-plaque                                                                                                                                                                                                                                                   |

Estimated size: about 1 MB of WebP (limit: the whole folder under 2 MB, each file under 90 KB, as `docs/REFERENCE.md` §10). They live in `public/business/art/<sheet>/<slug>.webp`, lazy-loaded; a missing picture falls back to today's emoji / CSS drawing, so the code can land before the art (as the Progress page did).

## 6. Code plan (nothing changes in the game rules)

1. **Art loader:** `src/game/businessArt.ts` + generated `businessArtFiles.ts` (same shape as `progressArt.ts`), the `Art` / `PIcon` components generalised to take a `base` ("progress" | "business") so one component serves both (no duplicate system).
2. **Build script:** `scripts/make-progress-assets.py` takes `--sheets / --src / --out / --ts` arguments (defaults = today's Progress run); `scripts/business-sheets.json` describes the eight sheets. The cutting (by shape), the WebP ladder and the budget check are shared.
3. **Kit:** `src/styles.css` gets `bz-ribbon-dark`, `bz-hot`, `bz-thead`; a small `kc/business/BizKit.tsx` (dark `RibbonHeading` variant, `TableRow`, `StatusBadge`) on top of `ProgressKit`.
4. **Pages, one at a time (each can ship alone):** Overview → Equipment → Upgrades → Suppliers (+ picker, standing orders, contracts) → Menu → Operations (alerts, service, inspection summary, finance, history, analytics). Components keep their props, state and testids.
5. **Dish art in the Menu and Best-Selling:** `dishArtUrl(recipeId)`; `loading="lazy"`, fixed box so the list does not jump.
6. **Docs:** `docs/REFERENCE.md` (a "Business pages, painted" section), `docs/HANDOFF.md` status line.

## 7. Tests

- **New** `scripts/business-ui-redesign-qa.mts`: every art name the pages use exists in `business-sheets.json` or the Progress sheets; the loader falls back for a missing picture; every `data-testid` the old tests read still exists; the Menu uses `dishArtUrl` and keeps the emoji fallback; no economy / save / ledger import in the new kit; the image budget.
- **New** `tools/e2e/businessredesign.mjs`: each Business tab at 320×568, 360×640, 390×844, 430×900, 768×1024, 1280×720, 1815×867, 740×360: no sideways scroll, buttons ≥ 44 px, the seven inspection badges, the three fridge cards, the Menu shows dish pictures after scrolling, the Upgrades cards show their descriptions, no console errors.
- **Re-run (touched):** `business-ux-qa`, `business-menu-qa`, `restaurant-menu-qa`, `restaurant-menu-order-qa`, `business-operations-qa`, `business-history-qa`, `business-lifetime-qa`, `business-pnl-qa`, `business-supplies-qa`, `restaurant-backoffice-qa`, `restaurant-progress-qa`, `ui-copy-qa`, `layout-fit-qa`, `landscape-art-qa`; the e2e `restauranteconomy.mjs` and the Business ones. Any old test that reads a removed string (e.g. the "Possible supplier events" line) is updated with a `RULE CHANGE (developer 2026-11-25 …)` comment and said in the commit (CLAUDE.md §8).

## 8. Assumptions (say if any is wrong)

- **A1.** Only the six tabs in the document are redesigned. The Staff tab, the tab strip, the header, the Cleanliness and Inspection detail screens keep today's look for now (they can follow in a second pass, with the same kit).
- **A2.** The picture-01 crop starts at Pace: the photo card "Your restaurant today" above it stays.
- **A3.** The Endless-state Overview (health, KPI cards) is not in the document: same content, new card chrome only.
- **A4.** The old banners (`equipment`, `suppliers`, `menu`, `operations` .webp) are deleted once the painted versions are in and the tests are green; `staff-banner.webp` stays (the Staff tab still uses it). `scripts/restaurant-backoffice-qa.mts` (W3) reads the equipment banner name, so it is updated with a RULE CHANGE comment.
- **A5.** The page order of the game stays where the pictures differ (Analytics order), and the game's wording stays where the pictures differ ("Cash vs costs", the wear line, "waiting").
- **A6.** The "More" pill at the bottom-left of pictures 07 and 10 is the game's own bottom-bar "More" menu, not a new control.
- **A7.** No new sounds, no motion beyond the existing press / lift transitions.

## 9. Order of work

1. Developer generates the 8 Codex sheets (the prompts file), saves them as `Business UI Assets/RB-<sheet>.png`.
2. Meanwhile: loader, script options, kit, Overview and Equipment on today's icons (fallbacks), tests.
3. Cut the sheets, switch the pages to the paintings, tune side by side with the 11 pictures at a wide and a phone size.
4. Gates (tsc, ESLint, Prettier, build, preflight, the suites above, the browser tests), then commit when the developer says so.
