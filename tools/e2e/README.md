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
| `coach.mjs` | Beginner coaching: a new player (intro skipped) gets "How to slice" and the ghost at once; tapping where the ghost fingertip taps (found as the round white blob in a screenshot) makes a real cut and hides the card; idle brings it back, and swiping along the demonstrated line also cuts; Level 1 still finishes; Level 5 teaches peel then halve; Level 12 shows it only after ~8 s idle. Exits 1 on failure |
| `cookingclip.mjs` | The cooking clip after every dish: appears once the plate is taken, really plays, SKIP › (≥ 48 px) and tap skip straight to the Knife Report, plays to the end into the report, plays again on Prep Again, muted with Sound off. Salads (Level 10) get the salad film, fruit dishes (Level 84) the fruit-cup film, cut-and-plate dishes (Level 3) the plating film, curries (Level 58) the curry-pot film, other cooked dishes (Level 36) the chef-cooking film. Exits 1 on failure |
| `adsflow.mjs` | Ads + level messages with a stubbed Bridge: level_started / level_paused / level_resumed / level_completed with `{ world, level }`; no interstitial during a level; the first interstitial after the 4th completed level with placement `level_completed`; no second one within the 150 s cooldown. Exits 1 on failure |
| `ingredients.mjs` | Market buys, Business monitors: Business → Inventory has no buy controls and its "Go to Market →" opens Market → Ingredients; all 57 ingredients listed there (none hidden); per-ingredient prices; each card's wallet line ("$1,332 → $1,327", "You'll have $1,307 remaining", "Not enough money — need $2.00 more.", "Not enough fridge space. You have 2 units…"); buying moves the wallet by exactly the card total and Business → Inventory shows the stock at once; a Most needed chip deep-links to its Market card; the Butter dish (Ribeye with Herb Butter) is ordered, cut and served from stock, and Most used then lists butter. Exits 1 on failure |
| `storyaudit.mjs` | Story presentation measurements per beat and viewport (animations, layout, taps, CPU) |

`harness.mjs` is Bridge-aware: `boot(page, save)` seeds a save through
`window.bridge.storage`, `readSave`/`writeSave` read/write it, and
`freshPlayer(page)` clears storage for a brand-new player. `solver.mjs`
plays a preparation step like a player (taps, peel strokes, plating drags);
its coordinates assume the default 430×900 viewport.
