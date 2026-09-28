> For the complete documentation index, see [llms.txt](https://wiki.playgama.com/playgama/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://wiki.playgama.com/playgama/mcp/game-checklist.md).

# Game checklist

What a game needs before it goes up on playgama.ai — the required Bridge steps in the order you do them, build constraints, and the tips that save the most time.

The list below is in the order you work through it. Everything numbered is required; the tips at the end are not, but each one removes a problem people hit repeatedly.

## Checklist

1. Connect and initialize the Bridge — nothing else works until initialization finishes.
2. Localize the game from `platform.language`, read once after initialization.
3. Save and load progress only through Storage, never through `localStorage` directly.
4. Save and load everything in a single call — pass an array of keys at once, instead of one key per call.
5. Subscribe to the pause and audio state events, so the game does not keep running and playing sound in the background.
6. Send `platform.sendMessage('game_ready')` when the first playable frame is ready.
7. Show interstitials at natural pauses — level transitions and game over.
8. Ads and payments go through the Bridge only, with no third-party advertisers.
9. An ad block never appears under the player's finger or cursor, on top of what they were about to tap.
10. Rewarded ads are opt-in: a clear button that says an ad is coming and what it gives; the reward is an extra bonus rather than a condition for continuing; never offer "+1 life" every time the player loses one.
11. Load no external resources — everything the game needs ships inside the build, and only the Bridge itself comes from the Playgama CDN.
12. The whole archive is 300 MB or less.
13. `index.html` sits at the root of the archive, and file and folder names use Latin characters only.
14. No embedded analytics — neither GA4 nor any equivalent.
15. Launching the game requires no registration or sign-in with an external service.
16. Check that interface elements do not overlap and that the layout holds at every screen size — in both portrait and landscape if the game supports both orientations, otherwise in the one it supports.
17. No browser page scrollbar; custom scrolling inside the game is fine.
18. Every popup has a close button or a cross.
19. On mobile: full screen during gameplay, elements that do not deform when the orientation or the available area changes, and a keyboard that opens by itself when an input field is tapped.
20. On desktop the game field stretches to the edges of the available area, but no further than a 2:1 ratio — on an ultra-wide or very short window, leave margins rather than turn the game into a strip.
21. Check font sizes: text stays readable at every screen size.
22. If the game has sound, check that it can be turned off and back on in the settings.
23. If the game has multiplayer, get the host whitelisted — without it multiplayer will not work on playgama.ai.
24. Check that the game has both mobile and desktop controls, and that both of them work.
25. Play the game through: levels can be completed, and nothing freezes anywhere.
26. After uploading to Playgama, open the published link with Playwright and check that everything works there the same way.

## Tips

Not required, but each one removes a familiar problem.

### Assets

* Take assets from free CC0 libraries, and download them before you start rather than asking the agent to look for them along the way.
* Do not synthesize sound procedurally — use ready-made free sound packs. It is faster and it sounds far better.
* Ship audio compressed (ogg/mp3, not wav). The 300 MB limit is not the constraint here; load time is.
* Prefer asset packs painted from one shared palette texture: the whole pack lives on a single material and batches into one draw call, while a model carrying its own 2K texture costs a draw call of its own. The art choice is the performance choice.
* Script the asset pipeline into one command instead of optimizing by hand: lossless glTF compression cuts size several times over with no visual change, and the originals stay in a folder that never ships. Do not strip node names to save bytes — if the game finds parts of a model by name, that silently breaks everything.

### Performance

* Budget draw calls, not polygons. The bottleneck is usually the number of meshes rather than the geometry: a scene with tens of thousands of triangles can run worse than one twice as heavy but merged into a few meshes.
* Cap the frame rate at 60 on touch devices. A 120 Hz panel runs the loop twice as often, heats up and starts throttling.
* Do not judge performance by the first 5–10 seconds — that is shader compilation and the first meshes being built, and the same phones reach a normal frame rate afterwards. Automatic quality downgrade must not run inside that window.
* Ask for numbers, not adjectives. While JS time per frame is above 10 ms, touching graphics settings is pointless.

### Process

* Describe the world as data rather than as content: a map of a few lines with one character per block type is edited with a single character, and an agent will rewrite it twenty times in a session — it will never hand-place hundreds of objects once.
* Give the agent eyes: a few debug hooks on a global object, so a headless browser can drive the game, switch quality presets and report FPS, draw calls and triangles. An agent that only reads code guesses; one that can play the game measures.
* Run the UI through a fixed matrix of sizes instead of eyeballing it: 360×640, 390×844 portrait, 915×412 landscape, 1280×720, 2560×1440.
* Look at every screenshot yourself before calling a check passed.

***

Points 1–7 are the required steps from the [Bridge SDK](/playgama/bridge-sdk/api.md) documentation. The rest are build and quality requirements.
