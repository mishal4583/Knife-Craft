# Painted icons to replace the line icons (Codex prompts), 2026-11-20

**Developer's request (2026-11-20):** "use proper emojis or assets throughout the game, so check each and every page." The outline icons in the screenshots (the leaf, the drops, the fork and knife) are not broken emoji: since 2026-11-19 the game draws a Lucide LINE icon for every emoji, because Playgama rule 4.3.2 says the interface must not use emoji in place of icons. The developer chose **painted assets** (full-colour pictures in the game's own look). This file is the complete list and the Codex prompts.

## What is already done in code

- `src/lib/paintedIcons.ts` + `EmojiIcon`: an emoji with a painted picture is drawn as that picture (1.45 em, coloured); everything else keeps its line icon until its picture arrives, so nothing breaks while Codex works.
- **37 food emoji already show the game's own ingredient paintings** (no Codex needed): 🌶 🌽 🌿 🍄 🍅 🍆 🍇 🍉 🍊 🍋 🍍 🍎 🍐 🍑 🍓 🍞 🍠 🎃 🐟 🥑 🥒 🥔 🥕 🥖 🥝 🥥 🥦 🥩 🥬 🥭 🧀 🧄 🧅 🧈 🫑 🫚 🫛.
- Colour dots (🟠 🟡 🟢 🔴 ⚪ ⚫ 🟤) and the plain shapes (⬜ ⭕) are drawn as plain colour dots and need no art. The stray male-sign and hair-colour parts of joined emoji need none either.
- **255 icons need new art**, in 10 sheets below (about 255 pictures). `scripts/icon-sheets.json` holds the same list (the build script reads it).

## How to use this file

1. Attach the **reference images** named in each prompt, paste the prompt, and generate ONE image per sheet.
2. Save each sheet as `Icon Sheets Assets/IS-<sheet>.png` (the sheet id is in the heading), in this repo's root (git-ignored, like the other Codex folders).
3. Tell me "icons are generated": I run `scripts/make-icon-assets.py` (cuts the grid, trims, 128 px WebP into `public/icons/`), add the names to `ICON_FILES` in `paintedIcons.ts`, and the whole game switches over, page by page, at once.

### Rules for every sheet

- A transparent background (real alpha, no checkerboard, no white, no grey). One icon per grid cell, in the order listed, centred, filling about 80% of the cell, never touching the cell's edge, with empty space between icons.
- Each cell is 512 x 512, so a sheet is (columns x 512) by (rows x 512). No grid lines, no numbers, no labels, no text, no watermarks.
- The same light on every icon (from the upper left) and the same outline weight across the whole sheet.
- The icon must read at 28 px: a simple bold silhouette first, detail second.
- Keep the meaning of the original emoji exactly (the description says what to show); do not invent a different object.

### Reference images to attach

- **UI style (all sheets except Dishes):** `public/business/cratedispatch/booster-icons.webp` (bulb, stopwatch, undo arrow), plus `public/business/cratedispatch/booster-freeze.webp`, `booster-rocket.webp`, `booster-hammer.webp`.
- **Food style (Dishes):** `public/business/ingredients/tomato.webp`, `public/business/ingredients/chicken.webp`, `public/business/supplies/dish-soap.webp`.

## Page audit: where the pending icons are drawn today

Every page and data source that shows an icon waiting for a painting (the number is how many times it is written in the code; the icon is what the player sees).

- **Data shown on cards everywhere (levels, dishes, chefs, knives, customers, city ranking, goals, achievements, guide text)** (331): 🍗54 🍽46 🏆19 ★16 🎖10 🧑‍🍳9 🥗9 🔪8 🪵6 🥙6 ✨5 👩‍🍳5 🏠4 🍲4 🍛4 🌱4 🍢4 📦3 ⭐3 ⏱3 📋3 🧊3 👵3 🛒2 🌙2 🍳2 📖2 ☀2 📊2 ⬆2 ⚒2 🌍2 🥘2 🍜2 🫘2 🔒 🧽 🔥 🫧 🏬 🥡 🧴 🥄 🧼 🥣 👨‍🍳 🕵 📅 🚪 💥 🌟 🧂 🥇 🧰 💡 🗺 🥢 ☕ 🫒 🔔 🙁 🧲 🍱 🍷 🌀 🍕 👩 🧑 👩‍🦱 👴 👱‍♀ 🧔 👩‍🦰 🧑‍🦱 👨 🧕 👦 🧐 📝 🙎‍♂ ❔ 👵🏻 💐 🧔‍♂ 💬 🎲 🪓 ✂ 🎗 🍃 🎋 🏁 🌮 🍝 🍤 🍁 🧆 ⚓ 🍣 🌼 🌷 🌸 🐙 🐉 🫔 🏵 🌲 🥂 🏛 👑 🤝
- **Mini-games (Fridge Sort, Stockroom, Delivery, Car Park, Sauce Station, Dessert Run, Unload the Van)** (173): 🔥11 ⚡10 🍾8 🔎7 ⏸7 ✨6 🥣6 ★5 ⭐5 🧊5 🎖5 🥄5 🧑‍🍳4 ⏱4 👆4 🗄4 ▶4 🚗4 👇4 🧺3 🎉3 💧3 🥛3 🔒2 📦2 🚚2 ⏳2 🍛2 🥇2 🫙2 🫒2 ✋2 ♥2 🍰2 🥜2 🍶2 🥚2 ❄ 🛒 🔪 🍳 🧾 🥗 👨‍🍳 🪑 🍲 🧂 🔍 💡 🏅 🧲 🫗 🧪 🍷 🌀 🚙 📣 😬 🌻 🍯 🍬 🎨
- **Cleaning: Business > Cleanliness, the daily check, the sink** (171): ✨20 🧽16 🍽15 🧹10 🫧7 🍳6 🧴6 🛒5 🌙5 🚻5 🔥4 ⚠4 🪣4 🔒3 🗑3 🎬3 ⛔3 🧼3 🧑‍🔧3 💧3 ❄2 🔪2 💵2 ⏱2 💸2 🧺2 🕵2 🌅2 🧂2 😊2 📦 🧑‍🍳 🚚 👥 💰 📋 🔁 🥡 👩‍🍳 🔎 🥄 🏠 🧻 👨‍🍳 ☀ 💥 🛡 🍴 🚽 🥤 😐 😟 🧭
- **Pre-Service Check, covers, health inspector** (136): ✨8 📦8 ❄8 🎬8 ⚠6 🗑6 🍽5 🛒5 👥5 💳5 💵3 🧹3 🚚3 🌙3 ⛔3 🕵3 🚶3 🔥2 ⭐2 ⚡2 🍳2 💸2 👆2 🚪2 🎁2 🌅2 ↩2 🔍2 🧽 🔪 🫧 🧾 🔁 🧊 🥡 🧴 🔎 🧻 👵 🧼 👨‍🍳 🪑 🎯 📅 🗄 🌍 🏷 👉 ✅ 📍 🗓 🔜 🕒 ➡ ❓ 📆 📏
- **Inventory and the attention badges** (104): 🍽13 ⚠7 🗑7 ⏳7 ❄6 🛒5 💰5 🧽4 👥4 🥡4 ⛔3 📦2 🧹2 🌙2 🫧2 📋2 🔁2 🧺2 🧻2 🧼2 📊2 🚽2 🚫2 🛠2 🔒 🚚 🧾 🧴 🪣 💥 🔧 🥛 🍴 🧰 👀 👤 🥫
- **Business > Menu, Analytics, History, Finance, Service, Inspections, alerts** (103): 🍽10 💵7 🗑6 💸6 ❄5 ⏳5 ⭐4 ⚠4 👥4 🧊4 🧑‍🔧4 🔒3 🔥3 🧹3 🧾3 📅3 📦2 🛒2 💰2 📈2 🔧2 🛡2 📜2 ✨ 🍗 🔪 🚚 🌙 🥡 🕵 🧰 💡 🏅 📉 🔔 🧮 🎛 🥀
- **Second Floor, restaurant map and the ad bonus sheets** (101): 🏬9 ⚡8 📺7 🔒6 🪑6 🎉5 ✨4 🔥4 💰3 🎬3 ⬆3 🌟3 🍽2 🛒2 🧑‍🍳2 🛍2 ⬇2 🍔2 🏆 📦 ❄ ⭐ 🔪 💵 🧹 🌙 ⏳ 👥 🍳 🔁 🧼 📊 🎁 🚻 🏪 🤵 🥤 🔨 ☕ 🍕 ⏩ 💾 🛎 🎊 🍦 🍟
- **Market (Shop, Ingredients, Supplies, Plan, Second Floor)** (98): 🚚8 ❄7 📦5 ⏱5 🔪4 💸4 🏬4 🧺4 📌4 🔒3 🔁3 ⚒3 ↩3 🍽2 ⭐2 🛒2 🧑‍🍳2 ⏸2 🪵2 🎯2 ⬇2 🧽 ★ ⚠ 🧹 ⏳ ⚡ 🍳 💰 🫧 📋 🧊 🥡 🧴 📺 ⬆ 🏪 🏷 📜 👉 ♾ 🗓 🔜 🤖 🗡 🪶
- **During service: floor, dining room, cash, closing time, deliveries, clock** (92): 🌙7 🔒6 🧽5 💵4 🚚4 🙂4 🍽3 👆3 ☀3 🚪3 📦2 🛒2 🧑‍🍳2 ⏳2 🏬2 🧾2 🥡2 👨‍🍳2 ✨ 🔥 ⭐ 🔪 ⚠ 🧹 🗑 ⏱ 💸 💰 🫧 📋 🔁 🧊 🔎 🧻 ⏸ 🥣 🗄 💧 🌅 ▶ 🛍 🚗 🔍 🫙 🙁 👏 🥐 🫖 🌆 😍 😋 😌
- **Business > Suppliers and supplies** (84): 🚚6 🥄5 🍽4 🧻4 📦3 🍳3 🏷3 🧽2 🔪2 🧹2 🥡2 🧺2 🥣2 🪣2 🏪2 🛍2 🍴2 🥢2 📄2 ❄ ⭐ 💵 🗑 💸 🫧 📋 🔁 🧴 🧼 💳 ☀ 🍲 🥛 🧂 📜 🫙 🚽 🥤 🧤 📍 🍔 🥘 ☕ ⚖ 🕒 🫗 🍱 🧪 🌤 🌡 📃
- **Kitchen home, Paige, Journal, Mini-games sheet** (83): 🔒11 🍽10 📖6 🏆5 🔁4 👩‍🍳4 💵3 🧑‍🍳3 ⭐2 🔪2 🍳2 🏠2 👵2 🪑2 🎮2 📸2 ✨ 📦 🛒 ⏳ 💰 🧾 👨‍🍳 🪵 📊 📅 🗺 ♾ 🔨 📒 🏗 ♻ ⚖ 🙋 🪙 ⚙ 🏃
- **Cooking scene, Prep Rush, the app shell** (58): 🔥8 🍽4 🏆4 ⏱4 ✨3 🧽3 🔪3 🚶3 🔒2 ⭐2 👵2 🧤2 🛒 🧹 🗑 🥗 👆 🧻 👨‍🍳 💳 ☀ 🚪 💥 🙂 👉 🎵 📱 😤 ❤ 🤍
- **Progress, city ranking, achievements** (58): 🏆9 ⭐4 💰4 ✨3 🔒3 ★3 🍽2 🏠2 🎯2 📈2 🏙2 🧽 📦 🔪 💵 🧑‍🍳 👥 🍳 🥡 🧼 👨‍🍳 🪵 📖 🕵 🎁 🏪 🥇 ✅ ♾ 🔨 🥈 🥉 🔓
- **Business > Overview** (54): 🍽9 🔒3 ⚠3 💵3 🏆2 ★2 ⭐2 🌙2 📋2 🧾2 📈2 ✨ ❄ 🧹 🧑‍🍳 🚚 👥 💸 💰 ⛔ 🏠 🎯 📊 📅 🌅 🌟 🎮 ✅ 📒 🏗 📉 ℹ 🪴
- **Business > Staff and hiring** (40): 🧾4 👋4 🍽3 ⭐3 💵3 🧑‍🍳3 🤵3 🗑2 💸2 👩‍🍳2 🛒 🔪 🧹 🌙 📋 🔁 💳 🌍 🛡 ♻ 🧑‍🤝‍🧑
- **Business > Refrigerator and the fridge cards** (27): ⏳6 📦5 ❄4 🔪2 🔧2 🛒 ⚠ 📋 🔁 ⚒ 💥 📐 💺
- **Other: restaurantAttention.ts** (12): 🍽2 📦2 👥2 ❄ ⚠ 🌙 🫧 🧴 🧻
- **Other: FridgeCheckGame.tsx** (8): 🔥2 📦 ★ ⚡ ⏱ ⏸ 📍
- **Other: staffLife.ts** (7): 📋2 🍽 🧽 🍳 🧾 🍲
- **Other: afterServe.ts** (6): 🧽 🛒 🧊 🔎 🗄 ⬆
- **Other: serviceReport.ts** (5): 🍽 ✨ 🧽 🥡 🧼
- **Other: celebrations.ts** (5): ✨2 ⭐2 🏆
- **Other: MilestoneBanner.tsx** (4): ✨2 🍽 👵
- **Other: kitchenChaos.ts** (4): 🍽 ⏱ 📋 👵
- **Other: restaurantNews.ts** (4): ✨ 👥 👨‍🍳 🌍
- **Other: RestaurantMapView.tsx** (4): 🔒2 ⚠2
- **Other: EndlessDayEvents.tsx** (4): ⭐2 🔥 👥
- **Other: FridgeNeedCard.tsx** (4): 🎬3 ❄
- **Other: testRecipePool.ts** (3): 🍗 🥗 🥣
- **Other: navLevel.ts** (3): 🔒3
- **Other: Recipes.tsx** (3): 🔒3
- **Other: OrderComplete.tsx** (3): ★3
- **Other: levelChecklist.ts** (3): ★3
- **Other: restaurantStanding.ts** (3): ★3
- **Other: signatureDishes.ts** (3): ⭐ 🏠 👵
- **Other: SupplyBottle.tsx** (3): 🛒 ⚠ ⛔
- **Other: momentCard.ts** (2): 🍽 🔪
- **Other: toolLook.ts** (2): 🧽 🧹
- **Other: serviceSupplies.ts** (2): 🧽 🫧
- **Other: GameHUD.tsx** (2): 🔥 🎯
- **Other: DailyGiftCard.tsx** (2): ★ 🎁
- **Other: closingChores.ts** (2): 💵 🫧
- **Other: MapCleanerHire.tsx** (2): 🧹 💸
- **Other: ItemTile.tsx** (2): 🗑 ⛔
- **Other: milestoneChests.ts** (2): ⚡ 🎁
- **Other: serviceCover.ts** (2): 🎬 💳
- **Other: ShortfallOffer.tsx** (2): 📺2
- **Other: RestaurantNameCard.tsx** (1): 🍽
- **Other: main.tsx** (1): 🍽
- **Other: UpstairsButton.tsx** (1): 🔒
- **Other: floorLife.ts** (1): 🧽
- **Other: firstRunGuide.ts** (1): 🛒
- **Other: TableCash.tsx** (1): 💵
- **Other: InfoTip.tsx** (1): ⏱
- **Other: serviceFlow.ts** (1): ⏱
- **Other: ShopItemArt.tsx** (1): 🧺
- **Other: deliveryInspection.ts** (1): 🔎
- **Other: CashVacuum.tsx** (1): 👆
- **Other: GuideCard.tsx** (1): 🎯
- **Other: guestLife.ts** (1): 🍲
- **Other: ServiceCheckLayer.tsx** (1): ↩
- **Other: ScreensRouter.tsx** (1): 🗺

## The sheets

### Sheet `money-paper`: Money, paper and business (25 icons, 5 x 5 cells, 2560 x 2560 px)

Reference: the UI reference images above. Save as `Icon Sheets Assets/IS-money-paper.png`.

```
Create ONE image, 2560 x 2560 px, on a fully transparent background: a sprite sheet of 25 separate game icons in a grid of 5 columns and 5 rows (each cell 512 x 512), one icon per cell, centred, about 80% of the cell, never touching the cell edge. No text, no numbers, no grid lines.

Icons in reading order, left to right, top to bottom:
1. 💵  a green dollar banknote
2. 💸  a banknote with small wings flying away
3. 💰  a tied money bag with a dollar sign
4. 💳  a credit card
5. 🪙  one gold coin
6. 🧾  a long paper till receipt with printed lines
7. 📋  a clipboard with a checklist
8. 📊  a bar chart
9. 📈  a chart with a rising line and arrow
10. 📉  a chart with a falling line and arrow
11. 📅  a wall calendar page
12. 📆  a tear-off calendar
13. 🗓  a spiral-bound desk calendar
14. 📒  a closed ledger notebook
15. 📄  a sheet of paper with text lines
16. 📃  a paper sheet with a curled corner
17. 📜  a rolled parchment scroll
18. 📝  a memo pad with a pencil
19. 🧮  an abacus
20. ⚖  a pair of brass balance scales
21. 🏷  a price tag on a string
22. 📖  an open book
23. 🗺  a folded paper map
24. 🧭  a brass compass
25. 💾  a floppy disk

Style: Glossy casual-mobile-game icon style, EXACTLY like the attached reference sheet (the Unload the Van booster icons): chunky simplified shapes, a thick warm dark-brown outline (about 3% of the icon's width), bright saturated colours with a soft two-tone gradient, ONE crisp white highlight at the upper left and a soft inner shade at the lower right, slightly rounded corners. No cast shadow on the ground, no text, no letters, no numbers.
Use the same outline weight, the same upper-left light and the same colour richness for every icon on the sheet. Match the attached reference images' look.
```

### Sheet `signs-arrows`: Signs and arrows (25 icons, 5 x 5 cells, 2560 x 2560 px)

Reference: the UI reference images above. Save as `Icon Sheets Assets/IS-signs-arrows.png`.

```
Create ONE image, 2560 x 2560 px, on a fully transparent background: a sprite sheet of 25 separate game icons in a grid of 5 columns and 5 rows (each cell 512 x 512), one icon per cell, centred, about 80% of the cell, never touching the cell edge. No text, no numbers, no grid lines.

Icons in reading order, left to right, top to bottom:
1. 🔒  a closed padlock
2. 🔓  an open padlock
3. ⛔  a red round no-entry sign with a white bar
4. 🚫  a red circle with a diagonal slash
5. ⚠  a yellow warning triangle with an exclamation mark
6. ✅  a green square with a white tick
7. ❓  a red question mark
8. ❔  a white question mark with a dark outline
9. ℹ  a blue round info badge with an i
10. 🔎  a magnifying glass tilted to the right
11. 🔍  a magnifying glass tilted to the left
12. 📍  a round red map pin
13. 📌  a red pushpin
14. 🎯  a dartboard with a dart in the middle
15. ⬆  a thick green arrow pointing up
16. ⬇  a thick orange arrow pointing down
17. ➡  a thick blue arrow pointing right
18. ↩  a curved arrow turning back to the left
19. 🔁  two arrows chasing each other in a loop
20. ♻  three green arrows in a recycling triangle
21. 🔜  a right arrow with the word-free "soon" look: an arrow ending at a small clock mark
22. ⏩  two thick right-pointing triangles
23. ▶  one thick right-pointing triangle
24. ⏸  two thick vertical bars
25. ♾  an infinity loop

Style: Glossy casual-mobile-game icon style, EXACTLY like the attached reference sheet (the Unload the Van booster icons): chunky simplified shapes, a thick warm dark-brown outline (about 3% of the icon's width), bright saturated colours with a soft two-tone gradient, ONE crisp white highlight at the upper left and a soft inner shade at the lower right, slightly rounded corners. No cast shadow on the ground, no text, no letters, no numbers.
Use the same outline weight, the same upper-left light and the same colour richness for every icon on the sheet. Match the attached reference images' look.
```

### Sheet `effects-time`: Effects, states and time (25 icons, 5 x 5 cells, 2560 x 2560 px)

Reference: the UI reference images above. Save as `Icon Sheets Assets/IS-effects-time.png`.

```
Create ONE image, 2560 x 2560 px, on a fully transparent background: a sprite sheet of 25 separate game icons in a grid of 5 columns and 5 rows (each cell 512 x 512), one icon per cell, centred, about 80% of the cell, never touching the cell edge. No text, no numbers, no grid lines.

Icons in reading order, left to right, top to bottom:
1. ★  a plain bright gold five-point star
2. ⭐  a gold five-point star with a soft highlight
3. 🌟  a gold star with glow rays
4. ✨  three small four-point sparkles, one large
5. 💥  an orange-yellow impact burst
6. 🔥  a flame, orange and yellow
7. ❄  a white-blue six-arm snowflake
8. 🧊  a pale blue ice cube
9. ⚡  a yellow lightning bolt
10. ⏳  an hourglass with sand
11. ⏱  a stopwatch
12. 🕒  a round wall clock showing three o'clock
13. 🌙  a crescent moon
14. ☀  a sun with rays
15. 🌅  a sun rising over a horizon
16. 🌤  a sun peeking out from behind a cloud
17. 🌆  a city skyline at dusk
18. 💡  a lit light bulb
19. 🔔  a golden bell
20. 🛎  a hotel service desk bell
21. 💬  a speech bubble
22. 📣  a megaphone
23. 🌀  a blue swirl
24. 🏁  a chequered flag
25. 🌡  a glass thermometer

Style: Glossy casual-mobile-game icon style, EXACTLY like the attached reference sheet (the Unload the Van booster icons): chunky simplified shapes, a thick warm dark-brown outline (about 3% of the icon's width), bright saturated colours with a soft two-tone gradient, ONE crisp white highlight at the upper left and a soft inner shade at the lower right, slightly rounded corners. No cast shadow on the ground, no text, no letters, no numbers.
Use the same outline weight, the same upper-left light and the same colour richness for every icon on the sheet. Match the attached reference images' look.
```

### Sheet `cleaning-repair`: Cleaning and repair (25 icons, 5 x 5 cells, 2560 x 2560 px)

Reference: the UI reference images above. Save as `Icon Sheets Assets/IS-cleaning-repair.png`.

```
Create ONE image, 2560 x 2560 px, on a fully transparent background: a sprite sheet of 25 separate game icons in a grid of 5 columns and 5 rows (each cell 512 x 512), one icon per cell, centred, about 80% of the cell, never touching the cell edge. No text, no numbers, no grid lines.

Icons in reading order, left to right, top to bottom:
1. 🧽  a yellow kitchen sponge with a green scouring side
2. 🧹  a straw broom
3. 🧼  a bar of soap with bubbles
4. 🧴  a pump bottle of lotion or soap
5. 🪣  a metal bucket
6. 🧻  a roll of paper towel
7. 🫧  a cluster of soap bubbles
8. 💧  one blue water droplet
9. 🚻  a restroom sign with two figures
10. 🚽  a toilet
11. 🧤  a pair of rubber gloves
12. 🔧  a wrench
13. 🛠  a hammer and a wrench crossed
14. ⚒  a hammer and a pick crossed
15. 🔨  a hammer
16. 🧰  a red toolbox
17. 🧲  a red horseshoe magnet
18. 🪓  an axe
19. ✂  a pair of scissors
20. 🗡  a small knife or dagger
21. 📏  a straight ruler
22. 📐  a triangle set square
23. 🧪  a test tube with liquid
24. 🛡  a shield
25. 🎛  a panel of control knobs

Style: Glossy casual-mobile-game icon style, EXACTLY like the attached reference sheet (the Unload the Van booster icons): chunky simplified shapes, a thick warm dark-brown outline (about 3% of the icon's width), bright saturated colours with a soft two-tone gradient, ONE crisp white highlight at the upper left and a soft inner shade at the lower right, slightly rounded corners. No cast shadow on the ground, no text, no letters, no numbers.
Use the same outline weight, the same upper-left light and the same colour richness for every icon on the sheet. Match the attached reference images' look.
```

### Sheet `kitchen-containers`: Kitchen things and containers (25 icons, 5 x 5 cells, 2560 x 2560 px)

Reference: the UI reference images above. Save as `Icon Sheets Assets/IS-kitchen-containers.png`.

```
Create ONE image, 2560 x 2560 px, on a fully transparent background: a sprite sheet of 25 separate game icons in a grid of 5 columns and 5 rows (each cell 512 x 512), one icon per cell, centred, about 80% of the cell, never touching the cell edge. No text, no numbers, no grid lines.

Icons in reading order, left to right, top to bottom:
1. 🔪  a chef's knife
2. 🍳  a frying pan with a fried egg
3. 🥄  a metal spoon
4. 🍴  a fork and a knife
5. 🍽  a plate with a fork and a knife
6. 🥣  a bowl with a spoon
7. 🥡  a takeout box
8. 🫙  a glass jar with a lid
9. 🥫  a tin can
10. 📦  a cardboard box
11. 🗑  a wastebasket
12. 🗄  a file cabinet with drawers
13. 🛒  a shopping cart
14. 🛍  two shopping bags
15. 🧺  a woven basket
16. 🍾  a bottle with a popping cork
17. 🥤  a cup with a straw
18. ☕  a cup of hot coffee
19. 🫖  a teapot
20. 🍷  a glass of red wine
21. 🍶  a sake bottle and cup
22. 🥛  a glass of milk
23. 🧂  a salt shaker
24. 🫗  a glass pouring liquid
25. 🥢  a pair of chopsticks

Style: Glossy casual-mobile-game icon style, EXACTLY like the attached reference sheet (the Unload the Van booster icons): chunky simplified shapes, a thick warm dark-brown outline (about 3% of the icon's width), bright saturated colours with a soft two-tone gradient, ONE crisp white highlight at the upper left and a soft inner shade at the lower right, slightly rounded corners. No cast shadow on the ground, no text, no letters, no numbers.
Use the same outline weight, the same upper-left light and the same colour richness for every icon on the sheet. Match the attached reference images' look.
```

### Sheet `dishes`: Dishes and treats (25 icons, 5 x 5 cells, 2560 x 2560 px)

Reference: the food reference images above. Save as `Icon Sheets Assets/IS-dishes.png`.

```
Create ONE image, 2560 x 2560 px, on a fully transparent background: a sprite sheet of 25 separate game icons in a grid of 5 columns and 5 rows (each cell 512 x 512), one icon per cell, centred, about 80% of the cell, never touching the cell edge. No text, no numbers, no grid lines.

Icons in reading order, left to right, top to bottom:
1. 🍗  a roast chicken drumstick
2. 🥗  a green salad bowl
3. 🍲  a pot of stew
4. 🍛  curry and rice on a plate
5. 🥙  a stuffed flatbread
6. 🍢  oden skewers
7. 🥘  a shallow pan of paella-style food
8. 🍔  a hamburger
9. 🍕  a slice of pizza
10. 🍰  a slice of strawberry shortcake
11. 🍜  a steaming noodle bowl
12. 🍝  spaghetti on a plate
13. 🌮  a taco
14. 🍤  fried shrimp
15. 🍣  a piece of sushi
16. 🧆  falafel balls
17. 🫔  a tamale in a corn husk
18. 🍱  a bento box
19. 🥐  a croissant
20. 🍦  a soft-serve ice cream cone
21. 🍟  fries in a carton
22. 🍬  a wrapped candy
23. 🍯  a honey pot
24. 🥚  an egg
25. 🥜  peanuts

Style: Soft painted food style, EXACTLY like the attached reference pictures (our ingredient paintings, e.g. the tomato and the dish soap): painterly shading, rich natural colours, gentle highlights, a thin darker edge so the shape reads on a light or a dark background, seen slightly from above, the whole dish visible, a plate or bowl only when the dish needs one. No cast shadow on the ground, no text.
Use the same outline weight, the same upper-left light and the same colour richness for every icon on the sheet. Match the attached reference images' look.
```

### Sheet `people-roles`: People and roles (25 icons, 5 x 5 cells, 2560 x 2560 px)

Reference: the UI reference images above. Save as `Icon Sheets Assets/IS-people-roles.png`.

```
Create ONE image, 2560 x 2560 px, on a fully transparent background: a sprite sheet of 25 separate game icons in a grid of 5 columns and 5 rows (each cell 512 x 512), one icon per cell, centred, about 80% of the cell, never touching the cell edge. No text, no numbers, no grid lines.

Icons in reading order, left to right, top to bottom:
1. 🧑‍🍳  a chef in a white hat and jacket (neutral)
2. 👩‍🍳  a woman chef in a white hat
3. 👨‍🍳  a man chef in a white hat
4. 🧑‍🔧  a repair person with a wrench and overalls
5. 🤵  a waiter in a vest and bow tie
6. 👵  an older woman with grey hair
7. 👴  an older man with grey hair
8. 👥  two people side by side
9. 👤  one person bust
10. 🙋  a person raising a hand
11. 🧑‍🤝‍🧑  two people shaking hands
12. 🕵  an inspector with a hat and a magnifier
13. 🤝  a handshake
14. 👋  a waving hand
15. 👏  clapping hands
16. 👩  a woman with brown hair
17. 🧑  a person with short hair
18. 👩‍🦱  a woman with curly hair
19. 👱‍♀  a woman with blond hair
20. 🧔  a bearded person
21. 👩‍🦰  a woman with red hair
22. 🧑‍🦱  a person with curly hair
23. 👨  a man with dark hair
24. 🧕  a person with a headscarf
25. 👦  a boy

Style: Glossy casual-mobile-game icon style, EXACTLY like the attached reference sheet (the Unload the Van booster icons): chunky simplified shapes, a thick warm dark-brown outline (about 3% of the icon's width), bright saturated colours with a soft two-tone gradient, ONE crisp white highlight at the upper left and a soft inner shade at the lower right, slightly rounded corners. No cast shadow on the ground, no text, no letters, no numbers.
Use the same outline weight, the same upper-left light and the same colour richness for every icon on the sheet. Match the attached reference images' look.
```

### Sheet `faces-hands`: Faces and hands (25 icons, 5 x 5 cells, 2560 x 2560 px)

Reference: the UI reference images above. Save as `Icon Sheets Assets/IS-faces-hands.png`.

```
Create ONE image, 2560 x 2560 px, on a fully transparent background: a sprite sheet of 25 separate game icons in a grid of 5 columns and 5 rows (each cell 512 x 512), one icon per cell, centred, about 80% of the cell, never touching the cell edge. No text, no numbers, no grid lines.

Icons in reading order, left to right, top to bottom:
1. 🙂  a slightly smiling face
2. 😊  a happy smiling face with smiling eyes
3. 🙁  a slightly frowning face
4. 😐  a neutral face
5. 😟  a worried face
6. 😬  a grimacing face
7. 😤  a face with a look of triumph
8. 😍  a face with heart eyes
9. 😋  a face savouring food
10. 😌  a relieved face
11. 🧐  a face with a monocle
12. 🙎‍♂  a man with a pouting face
13. 👵🏻  an older woman with light skin
14. 🧔‍♂  a bearded man
15. 🤖  a friendly robot face
16. 👀  a pair of eyes
17. 👆  a hand pointing up
18. 👇  a hand pointing down
19. 👉  a hand pointing right
20. ✋  a raised open hand
21. 🏃  a running figure
22. 🚶  a walking figure
23. ♥  a plain red heart
24. ❤  a glossy red heart
25. 🤍  a white heart

Style: Glossy casual-mobile-game icon style, EXACTLY like the attached reference sheet (the Unload the Van booster icons): chunky simplified shapes, a thick warm dark-brown outline (about 3% of the icon's width), bright saturated colours with a soft two-tone gradient, ONE crisp white highlight at the upper left and a soft inner shade at the lower right, slightly rounded corners. No cast shadow on the ground, no text, no letters, no numbers.
Use the same outline weight, the same upper-left light and the same colour richness for every icon on the sheet. Match the attached reference images' look.
```

### Sheet `places-fun`: Places, vehicles and fun (25 icons, 5 x 5 cells, 2560 x 2560 px)

Reference: the UI reference images above. Save as `Icon Sheets Assets/IS-places-fun.png`.

```
Create ONE image, 2560 x 2560 px, on a fully transparent background: a sprite sheet of 25 separate game icons in a grid of 5 columns and 5 rows (each cell 512 x 512), one icon per cell, centred, about 80% of the cell, never touching the cell edge. No text, no numbers, no grid lines.

Icons in reading order, left to right, top to bottom:
1. 🏠  a small house
2. 🏬  a department store building
3. 🏪  a small convenience store with an awning
4. 🏗  a crane over a building site
5. 🏙  a city skyline in daylight
6. 🏛  a classical building with columns
7. 🚪  a wooden door
8. 🪑  a wooden chair
9. 💺  a padded seat
10. 🚚  a delivery truck
11. 🚗  a car
12. 🚙  a sport utility vehicle
13. 📺  a television
14. 🎮  a game controller
15. 📱  a smartphone
16. 🌍  the Earth globe
17. ⚙  a gear
18. 🎬  a film clapper board
19. 📸  a camera with a flash
20. 🎵  a musical note
21. 🎨  a painter's palette
22. 🎁  a wrapped present
23. 🎉  a party popper with confetti
24. 🎊  a confetti ball
25. 🏃‍♂  a running man

Style: Glossy casual-mobile-game icon style, EXACTLY like the attached reference sheet (the Unload the Van booster icons): chunky simplified shapes, a thick warm dark-brown outline (about 3% of the icon's width), bright saturated colours with a soft two-tone gradient, ONE crisp white highlight at the upper left and a soft inner shade at the lower right, slightly rounded corners. No cast shadow on the ground, no text, no letters, no numbers.
Use the same outline weight, the same upper-left light and the same colour richness for every icon on the sheet. Match the attached reference images' look.
```

### Sheet `awards-nature`: Awards, nature and decoration (30 icons, 6 x 5 cells, 3072 x 2560 px)

Reference: the UI reference images above. Save as `Icon Sheets Assets/IS-awards-nature.png`.

```
Create ONE image, 3072 x 2560 px, on a fully transparent background: a sprite sheet of 30 separate game icons in a grid of 6 columns and 5 rows (each cell 512 x 512), one icon per cell, centred, about 80% of the cell, never touching the cell edge. No text, no numbers, no grid lines.

Icons in reading order, left to right, top to bottom:
1. 🏆  a gold trophy cup
2. 🎖  a medal with a ribbon
3. 🏅  a sports medal
4. 🥇  a first-place gold medal
5. 🥈  a second-place silver medal
6. 🥉  a third-place bronze medal
7. 👑  a gold crown
8. 🎗  a reminder ribbon
9. ⚓  an anchor
10. 🌱  a seedling
11. 🪴  a potted plant
12. 🌻  a sunflower
13. 🌼  a daisy blossom
14. 🌷  a tulip
15. 🌸  a cherry blossom
16. 🏵  a rosette flower badge
17. 💐  a bouquet of flowers
18. 🥀  a wilted flower
19. 🌲  an evergreen tree
20. 🪵  a wood log
21. 🪶  a feather
22. 🍁  a maple leaf
23. 🍃  a leaf in the wind
24. 🎋  a bamboo branch with paper strips
25. 🥂  two clinking glasses
26. 🎲  a six-sided die
27. 🐙  an octopus
28. 🐉  a small friendly dragon
29. 🫘  a pile of beans
30. 🫒  an olive

Style: Glossy casual-mobile-game icon style, EXACTLY like the attached reference sheet (the Unload the Van booster icons): chunky simplified shapes, a thick warm dark-brown outline (about 3% of the icon's width), bright saturated colours with a soft two-tone gradient, ONE crisp white highlight at the upper left and a soft inner shade at the lower right, slightly rounded corners. No cast shadow on the ground, no text, no letters, no numbers.
Use the same outline weight, the same upper-left light and the same colour richness for every icon on the sheet. Match the attached reference images' look.
```

## Code left to do when the pictures arrive

- `scripts/make-icon-assets.py` (reads `scripts/icon-sheets.json`, cuts each cell, trims the empty margin, writes `public/icons/<slug>.webp`, 128 px) and fills `ICON_FILES` in `src/lib/paintedIcons.ts`.
- `emoji-icons-qa`: every `ICON_FILES` entry has its file; the line-icon map stays as the fallback for anything not yet painted.
- Check each page by screenshot (the page list above) at 1280 x 720 and 390 x 844.
- The wavy dash 〰 in `businessSupplies.ts` is a decoration character, not an icon: replace it with a plain dash in code (no art).
