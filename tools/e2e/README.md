# E2E checks (headless Chrome)

Test tooling only — not part of the game build. Drives the real built game
with `puppeteer-core` and your installed Chrome
(`C:/Program Files/Google/Chrome/Application/chrome.exe`, override with
`CHROME_PATH`).

```
cd tools/e2e && npm install          # once
cd ../.. && npm run build && npx vite preview   # serves dist/ on http://localhost:4173
node tools/e2e/<script>.mjs          # in another terminal (KC_URL overrides the URL)
```

Output (screenshots, JSON) goes to `tools/e2e/out/`; throwaway Chrome
profiles to `tools/e2e/profile-*` (both gitignored).

| Script | What it checks |
|---|---|
| `introskip.mjs` | Opening intro: natural finish time, Skip story (double tap, mid-transition, button beat, last-timer race), button beats, reload, existing saves, 6 viewports, network hosts, console errors |
| `introshots.mjs` | Captures every intro screen into `playgama/screenshots/intro/` |
| `pgbridge.mjs` | Bridge loads + initializes, `game_ready` sent once, saves go through Bridge storage, only the Bridge CDN is contacted |
| `audit10.mjs` | Plays a brand-new player through the intro and Levels 1–10 with real input; records every transition, reward, ledger entry, memory |
| `audit10b.mjs` | Level 2 edge cases: Serve → Back to Kitchen (bug G1), pause exit, reload mid-level, Prep Again, Level 1 replay flow |
| `levelflow.mjs` | Regression for G1/G2: a fresh player's Level 1 runs Serve → Finish Level (settlement + $50 reward, Level Complete); Serve → Back to Kitchen completes the level once and a retry pays nothing; pause exit pays nothing. Exits 1 on failure |
| `economyv25.mjs` | Economy migration: an old finished save is migrated once with no milestone/Final Reward windfall (balance + kitchens kept, reloads pay nothing); Progress shows CAMPAIGN COMPLETE · 250 / 250 and historical figures; a current save that completed Level 250 gets the $50,000 Final Reward once with its banner; Kitchen Upgrade builds Growing Kitchen for $20,000 and shows "Not enough money — need $X more"; Endless locked before Level 250. Exits 1 on failure |
| `rushrestock.mjs` | Business Rush Restock: a blocked order shows ⚡ Rush Restock (Market + 25%) on Service and Operations; cash stocks exactly the shortfall with one ledger entry and unblocks the order; Go to Market → opens Market → Ingredients; with a stubbed rewarded ad, 🎬 Watch Ad restocks free and a declined ad does nothing. Exits 1 on failure |
| `coach.mjs` | Beginner coaching, only when needed: a new player (intro skipped) gets "How to slice" and the ghost at once; tapping where the ghost fingertip taps (found as the round white blob in a screenshot) makes a real cut and hides it, and after a real cut a pause brings nothing back; Level 1 still finishes; Level 5 teaches peel then halve; Level 12 never shows it; replaying Level 4 from the Order Board shows no coaching or hint; a stuck player (touch, no progress) gets it back, and swiping along the demonstrated line also cuts. Exits 1 on failure |
| `cookingclip.mjs` | The cooking clip after every dish: appears once the plate is taken, really plays, SKIP › (≥ 48 px) and tap skip straight to the Knife Report, plays to the end into the report, plays again on Prep Again, muted with Sound off. Salads (Level 10) get the salad film, fruit dishes (Level 84) the fruit-cup film, cut-and-plate dishes (Level 3) the plating film, curries (Level 58) the curry-pot film, other cooked dishes (Level 36) the chef-cooking film. Exits 1 on failure |
| `adsflow.mjs` | Ads + level messages with a stubbed Bridge: level_started / level_paused / level_resumed / level_completed with `{ world, level }`; no interstitial during a level; the first interstitial after the 4th completed level with placement `level_completed`; no second one within the 150 s cooldown. Exits 1 on failure |
| `ingredients.mjs` | Market buys, Business monitors: Business → Inventory has no buy controls and its "Go to Market →" opens Market → Ingredients; all 57 ingredients listed there (none hidden); per-ingredient prices; each card's wallet line ("$1,332 → $1,327", "You'll have $1,307 remaining", "Not enough money — need $2.00 more.", "Not enough fridge space. You have 2 units…"); buying moves the wallet by exactly the card total and Business → Inventory shows the stock at once; a Most needed chip deep-links to its Market card; the Butter dish (Ribeye with Herb Butter) is ordered, cut and served from stock, and Most used then lists butter. Exits 1 on failure |
| `fridge.mjs` | The physical fridge in Business → Inventory at 375×642: production model, used/capacity and the "Refrigerated" status (no temperature); every stocked ingredient in its zone; the door handle covers no label and takes no tap; touch tap and mouse click open an item's details (quantity, freshness, value, paid price, menu dishes) in view; the Basic fits its frame while the wide Professional shows the › cue and a swipe hint, pans with a touch swipe and a mouse drag (no accidental tap) while a vertical swipe still scrolls the page, and both its door handles stay clear; tabs filter; Needs Attention order; Restock opens Market → Ingredients on the item without buying, a Market purchase shows in the fridge at once (one ledger entry); Upgrade opens Equipment; Basic 1 compartment + 1 door (enamel) → Commercial 2 + 2 → Professional 3 + 2 (steel), each wider (40/80/140); no horizontal scroll and the handle clear at 320/360/390/430/768 widths; no console errors. Exits 1 on failure |
| `fridgeshots.mjs` | Screenshots of the three fridge models (Basic, Commercial, Professional) with a stocked fridge, for visual review against the handoff mockups (`SIZE=WxH`, default 375x642). Not a pass/fail check |
| `supplies.mjs` | Business Supplies at 375×642: the Market has Knives, Cutting Boards and the three supply sections (18 Smallwares · 17 Tableware · 15 Takeaway), no horizontal scroll; buying dinner plates moves the wallet by exactly the card total with ONE `supply-equipment-purchase` entry and +12 saved plates; takeaway containers use `supply-packaging-purchase` (+150); Business → Supplies (no purchase controls) shows the stock and spend at once and "Restock" opens the Market section; the stock survives a reload; not enough money → the card says so and a tap changes nothing; a Business order cooked and served for real (Ribeye with Herb Butter, 430×900) uses one container + one carry bag from saved stock, their cost goes to COGS, and the serve still writes only its one revenue entry; no console errors. Exits 1 on failure |
| `storyaudit.mjs` | Story presentation measurements per beat and viewport (animations, layout, taps, CPU) |

`harness.mjs` is Bridge-aware: `boot(page, save)` seeds a save through
`window.bridge.storage`, `readSave`/`writeSave` read/write it, and
`freshPlayer(page)` clears storage for a brand-new player. `solver.mjs`
plays a preparation step like a player (taps, peel strokes, plating drags);
its coordinates assume the default 430×900 viewport.
