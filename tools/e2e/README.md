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
| `economyv25.mjs` | Economy V2.5: an older finished save gets every reached milestone + the $50,000 Family Legacy once (one summary banner; reload pays nothing more); Progress shows CAMPAIGN COMPLETE · FAMILY LEGACY · "Your restaurant is yours."; Kitchen Upgrade builds Growing Kitchen for $20,000 and shows the exact shortfall for the next tier. Exits 1 on failure |
| `rushrestock.mjs` | Business Rush Restock: a blocked order shows ⚡ Rush Restock (Market + 25%) on Service and Operations; cash stocks exactly the shortfall with one ledger entry and unblocks the order; with a stubbed rewarded ad, 🎬 Watch Ad restocks free and a declined ad does nothing. Exits 1 on failure |
| `storyaudit.mjs` | Story presentation measurements per beat and viewport (animations, layout, taps, CPU) |

`harness.mjs` is Bridge-aware: `boot(page, save)` seeds a save through
`window.bridge.storage`, `readSave`/`writeSave` read/write it, and
`freshPlayer(page)` clears storage for a brand-new player. `solver.mjs`
plays a preparation step like a player (taps, peel strokes, plating drags);
its coordinates assume the default 430×900 viewport.
