# Platform compliance audit — Playgama and YouTube Playables (2026-11-19)

Rules read LIVE on 2026-11-19: Playgama's Game Requirements (1.x to 5.x, the self-check list, the platform-specific page) and the Bridge SDK "Required steps"
(`get_game_checklist`, `get_bridge_sdk_docs`), and YouTube's own certification pages (stability, design, integration, monetization, privacy and data,
trust and safety, i18n, accessibility, FAQ; developers.google.com/youtube/gaming/playables/certification). The game was checked against them by reading the
code, the build (`dist/`, 864 files, 31 MB) and the Playgama record of the last upload. **Not done:** no real-device test, no moderator, no YouTube test suite.
"PASS" below means "met by what the code and the build show", not "approved".

Playgama record: KnifeCraft, status APPROVED, live archive `knifecraft-playgama-1.4.1` (2026-10-18, Bridge 2.3.1, build check PASSED, loading 541 ms,
initial size 2.2 MB). **That archive is a month older than this code**: the store text still says "250 hand-made recipe levels across 25 chapters" (the game has 91
levels in 13 chapters), the form still lacks a **category** (`FORM_INCOMPLETE`), and an update cannot be sent until it is chosen.

## FAILING (needs the developer)

| # | Rule | Finding | What it takes |
|---|---|---|---|
| 1 | Playgama **3.3.2** | **FIXED 2026-11-19, step 1 of the fix list**: the game now ships RECORDED CC0 audio (38 mp3 files, 4.3 MB, `public/audio`) and `AudioManager` only plays them; no oscillator or generated noise remains (`audio-qa` Y1, preflight). The generated score is deleted. Credits: `docs/AUDIO-CREDITS.md`. **Not heard by a person**: the choice of each recording was made from measurements (pitch, length, loudness), not by ear, so the developer must listen on a phone and name any sound that feels wrong (the levels are in `AudioManager.ts` `SFX` and the `MUSIC_LEVEL` table). | Listen; swap any recording by editing `scripts/make-audio-assets.py` and rerunning it. |
| 2 | Bridge Required step **7**, self-check "the game times them itself" | **FIXED 2026-11-19, step 2**: `interstitialPolicy.ts` no longer counts levels or seconds (it only stops a repeated transition, another ad in the way, and a missing ads API); the config's `minimumDelayBetweenInterstitial: 120` override is removed (the platform default, 60 s, is what moderation expects). Every natural break (a finished level, a closed business day) now asks the Bridge, which decides when an ad shows. Side effect to know: the first-clear "+50% for an ad" offer used to appear only when no interstitial showed; it now always follows the request (opt-in, after any ad has closed). A new player can now meet an interstitial after their first level, if the Bridge allows it. `playables-ads-qa` E/E2/E3 and `ad-bonuses-qa` E3 changed to the new rule. The old `adsflow.mjs` browser test cannot finish Level 4 any more (stale before this change). | Nothing more. |
| 3 | Playgama **1.6.1 / 1.6.8**; YouTube Playables Design 1 and Playgama's YouTube / MSN / CrazyGames lines | **FIXED 2026-11-19, step 3**: every window is now filled edge to edge, whatever its shape. `fitLayout` (`kc/game/layoutMode.ts`, pure, `layout-fit-qa`) lays the UI out at a logical size and `GameShell` scales it to the window with one uniform CSS scale: an upright phone at its own size (unchanged); aspect >= 1.3 the landscape layout (the phone-landscape layouts, now for every wide window, laid out at most 720 tall and scaled up); anything else the portrait layout (at most 768 wide, at least 600 tall). No 9:16 frame, no bezel, no side tagline. Also: Phaser measured its parent through the CSS scale (the cutting board was 1.5x too big at 1920 x 1080), now it measures the layout box; the two upright mini-games carry their room to the sides with mirrored copies of their backdrop; the service floor continues its painting sideways, mirrored; the blurred side areas (cooking clip, map surround, cleaning room) are gone (YouTube: no blur). Verified in a real browser at 1280 x 720, 1920 x 1080, 800 x 800, 1000 x 800, 1366 x 768, 2560 x 1080, 1080 x 1920, 768 x 1024 and 700 x 700 (screen audit: only the two small controls on the restaurant map that were there before), real cuts register at 1920 x 1080. The `landscape.mjs` checks 4a / 4b / 6 that were stale for weeks work again. | Nothing more. |
| 4 | Playgama **4.3.2** | **MOSTLY FIXED 2026-11-19, step 4**: the game now has its own JSX runtime (`src/lib/emoji-jsx`, `jsxImportSource` in `vite.config.ts`) that draws a bundled icon (Lucide, ISC licence, `src/lib/emojiIcons.ts`, 229 emoji mapped) in place of an emoji wherever a screen or a data string renders text, in the text's colour; the emoji stays as invisible inline text, so tests, searches and screen readers read the same text. **88 % of the 2,574 emoji uses in `src` are drawn icons** (`emoji-icons-qa` D1). **Left as emoji: 12 %**, almost all of it vegetables and pantry items that Lucide has no faithful icon for (tomato 28, potato 23, garlic 20, onion 20, cheese 16, pepper 16, mushroom 14, cucumber 13, mango 12, broccoli 11, avocado 11, chilli 10 ...): a wrong picture would be worse. A weak mapping was refused on purpose (a peach, a strawberry, a pear). | Those ingredient pictures need painted art (Codex): a list is in `src/lib/emojiIcons.ts` coverage output of `emoji-icons-qa`. |
| 5 | Store form / release | **DONE except the go-live, 2026-11-19**: the form now has the category `management` (a restaurant business: guests, orders, income, upgrades; the cutting is how an order is served), the description says 91 levels in 13 chapters and names the mini-games, the how-to-play text is current. Release v1.6.0 (`BUILD_VERSION` 1.6.0, 32 MB) is uploaded as archive `knifecraft-playgama-1.6.0b` (id `cmwmqqlqt0snskr0hypngywru`, build check PASSED, Bridge 2.4.3 FOUND). The first upload, `knifecraft-playgama-1.6.0` (made with PowerShell `Compress-Archive`), was refused with BRIDGE_NOT_INITIALIZED although the same files work in a browser: only the zip tool differed, so release zips are made with Python `zipfile` (CLAUDE.md section 4); that archive is left in the form and ignored. The live catalog still runs 1.4.1. | The developer's explicit yes for `send_playgama_catalog_update` (it updates the live game for every player with NO moderation). The form's `story` note is empty and is the developer's own words. |

## FIXED in this pass

| Rule | Change |
|---|---|
| Playgama **3.2.1** (never sessionStorage / cookies) | `src/lib/freshReload.ts` used `sessionStorage` to remember its last automatic reload; it now reads the time back from the address's own `fresh` parameter. The unused shadcn `src/components/ui/sidebar.tsx` (it wrote a cookie) is deleted. |
| Playgama **1.5.2** (the game does not use the Esc key) | The Esc handlers are gone: info bubbles, the Mini-games sheet, the Wash-up sink, the restaurant-name box. The bubble (tap outside / its ⓘ), the sheet (✕ and a tap outside) and the sink have an on-screen way out (1.6.5); the name box saves with Enter and had no cancel button besides Esc. Tests changed to the new rule: `ui-copy-qa` I2, `minigames.mjs` M7 (Escape now must leave the sheet open), `history.mjs` (a no-op Esc press removed). |
| YouTube Design **6.1** (no in-game sharing prompts) | `MomentPreview` uses `navigator.share`; the Share action is now hidden when the Bridge says the platform is `youtube` (`sharingAllowed()` in `PlayablesSDK.ts`). "Save image" stays. |
| Guard | `scripts/playables-preflight.mjs` now fails the build on any Esc handling, `sessionStorage` or `document.cookie` in our own source. |

## PASS (by code and build)

Playgama Required steps 1-6 and 8: `playgama-bridge-config.json` beside `index.html`; the Bridge script is the first script in `<head>`, initialized before the game;
`platform.language` read once (English only, 3.4.1 / 3.4.2); progress only through `bridge.storage` (single `get` at start, coalescing writer); `isAudioEnabled`
read at start plus the audio and pause events (3.3.4 / 3.3.5, Phaser's own visibility handlers are detached); `game_ready` sent when the first screen is
interactive; rewarded ads hidden when unsupported and granted only on `rewarded`. 1.2: no sign-in, no external analytics (Bridge `analytics.send` only), no
fetch / XHR to the outside, no WebSocket, no external links (the only external script is the Bridge), no URL checks. 1.3: 31 MB, `index.html` at the root, Latin
file names. 1.4.5: `styles.css` disables selection, callout and tap highlight outside inputs. 1.5.1: mouse and touch. 1.8: videos are bundled. 2.x: no banners, no
purchases, no real money; every rewarded button says "Ad" / "Watch an ad" and what it gives; once per day or attempt; never needed to progress. 3.1: progress,
guides, a story. 3.3.1 / 3.3.3: music, effects and a Sound toggle exist. 3.5.1: the game says "KnifeCraft". 4.1: no restricted content, no gambling.
YouTube: initial bundle far under 30 MiB, total 31 MB (limit 250), 864 files (limit 8000), every file under 1.2 MiB, file names legal, relative paths, no
orientation lock, no `eval`, `new Function`, WebAssembly or workers in the build, no clipboard, no login, no QR, minified but not obfuscated, a single page, the
finale tells the player when the story ends.

## Watch list (not failing, but a reviewer could raise it)

- **Save writes**: every state change goes through `persist` (coalesced, never overlapping). Playgama: "write only when meaningful progress changes ... never on every action" and the self-check "storage read and written too often". Consider throttling.
- **Save size** (YouTube: < 3 MiB, < 500 KiB advised): the ledger is capped at 200 entries, but a played-out save was NOT measured.
- **localStorage fallback** in `SaveManager` (only when no Bridge exists) and a one-off legacy read of the restaurant name: moderators run with the Bridge, so this is not hit.
- **Mute**: Playgama requires a mute control (3.3.3, we have the Settings toggle); YouTube says an in-game overall mute SHOULD NOT be shown. Playgama's is the MUST; hide it on `youtube` if Playgama's YouTube review asks.
- **Esc**: YouTube SHOULD close modals with Esc, Playgama's MUST says do not use Esc; we follow Playgama's.
- **AI art** (4.3.1): much of the art is AI-generated. The rule accepts it when the game is not built entirely from it; Playgama says AI-art games perform worse.
- **Shop catalogue**: `businessSupplies.ts` ships a `webstaurantstore.com` base URL and a product page path for every shop item, with product names, as data (never shown, never fetched). A static scan could flag them.
- **YouTube thumbnails / title / description must carry no branding or logos** (Design 4); Playgama's covers do. Check when the YouTube submission is made.
- **Platform lines that do not fit this game today**: Facebook (max 500 files, we have 864; needs two of IAP / leaderboards / multiplayer / social), Yandex (needs Russian), CrazyGames and MSN (black bars), TikTok (Home Screen Shortcut + Sidebar buttons; paused). GameSnacks, Xiaomi and MSN size limits are met.
- **Not measured**: peak memory (1.3.3 / YouTube 512 MB), real-device behaviour (1.4, 1.7), the 5 s load target.
