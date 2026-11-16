# Crate Dispatch ("Kitchen Dispatch"): Codex prompts for the art (developer 2026-11-17)

> **STATUS 2026-11-17:** all 22 pictures were delivered and built into `public/business/cratedispatch/` by `scripts/make-crate-dispatch-assets.py`; the game is built (HANDOFF). `CD-crate-heavy-*`, the objectives panel and the speech bubble are not used yet.
>
> **PROVISIONAL.** The developer's 244-line brief for this game did not reach Claude (only its placeholder came through). These prompts
> are worked out from the developer's screenshot (`Crate Dispatch\CD-reference-kitchen-dispatch.png`) and the folder contents. If the brief
> gives other sizes, colours or rules, tell Claude and this file is corrected before Codex runs it.

**What the screenshot shows (the game as Claude reads it):** a square wooden board of dark floor tiles (about 7 x 7 cells). Ingredient CRATES of 2 or 3 cells (and grey
heavy blockers) lie on it, each with an arrow; a crate slides the way its arrow points and leaves through a coloured EXIT GATE in the wooden frame. Clear every crate
to win. Around it: a level badge, a wooden title sign, an instruction banner, a speech bubble from the assistant, an objectives panel with a crate counter and three
stars, a timer, and three booster buttons (Hint, Extra Time, Undo).

## READ THIS FIRST: what Codex must NOT do

**Make IMAGES ONLY. Do NOT write, edit or "improve" any game code, test, config or document in the repo.** Do not touch `src/`, `scripts/`, `tools/`, `public/` or `docs/`.
Do not build a screen or a mini-game. Do not rename, move or overwrite any existing file in `Crate Dispatch\` (the 57 ingredient pictures, `README.md`,
`asset_manifest.json` and the reference screenshot stay as they are). Save every NEW picture ONLY into `D:\WORKS\GAMES\Knife Craft\Crate Dispatch\` with the exact
file name below, then stop and report the file names and pixel sizes. **Every word, number, arrow, ingredient picture and star count is drawn by the game's code: paint
NONE of them** (empty plates, empty panels, empty windows).

## What already exists (do NOT draw again)

- The 57 ingredient pictures in `Crate Dispatch\*.webp` (1024 x 1024, transparent): the game puts them on the crates.
- The assistant, Paige: `Paige Cutout Assets\cutout-*.png` (point, cheer, clap, wave, oops, sorry, think...). She appears on the screen as she is.

## How to run it

1. One Codex conversation per BATCH. Attach the REFERENCE IMAGES, paste the STYLE BIBLE, then the batch prompt.
2. Priority: **A (crates, gate, tile, frame) first**: the game can be played with those alone. Then B (screen furniture), then C (scene), then D (results).
3. After each batch, run the checklist at the end on every picture.

**Reference images to attach:**
- `Crate Dispatch\CD-reference-kitchen-dispatch.png`: THE TARGET LOOK. Glossy, chunky, saturated game-UI painting; thick bevelled wood; warm light.
- `Paige Cutout Assets\cutout-point.png`: the look of our people (not needed unless a batch has a person).
- `Car Park Assets\car-blue.png`: our objects: glossy toy-like shapes, thin DARK WARM-BROWN outline (never pure black), a soft highlight at the top left.

## STYLE BIBLE (paste at the top of EVERY request)

```
Style: a glossy, chunky, hand-painted casual-game UI, like the reference screenshot: thick rounded shapes, soft bevels, a bright highlight at the top left, a deeper
shade at the bottom, warm golden light. Wood is honey-brown with visible grain and rounded plank edges; metal is warm brass; paper is cream parchment. A thin DARK
WARM-BROWN outline round every object (never pure black). Colours rich and saturated but not neon. Everything is seen straight on or from straight above, matching the
reference. Cozy restaurant-kitchen mood.
Format: PNG, true transparent background (real alpha, no checkerboard, no white box, no grey halo) unless a file is marked OPAQUE. Nothing may touch the edge of the
canvas unless the file says it fills it. No text, no numbers, no letters, no logos, no watermark, no signature, no arrows unless the file says so.
Key colour: where a file says "KEY", paint that part ONLY in the key ramp #A000A0 (shadow), #FF00FF (body), #FF99FF (highlight), and use NO other pink, magenta or purple
anywhere else in that picture. A script turns the key into the game's colours.
```

## BATCH A: the crates, the gate, the tile, the frame (these make the game playable)

**One crate cell is 192 x 192 px.** A crate is a long glossy slab: rounded corners, a thick bevelled rim, brass corner caps, a recessed LIGHTER PANEL in the middle where
the game draws the ingredient (leave it empty and calm, a plain pale tint), and a small flat ARROW PLATE at ONE end (the right end) left EMPTY. Seen straight from above.
The body of the slab is painted in the KEY ramp so the script can make it green, red, orange, blue, purple, yellow and so on. The rim and caps keep their own warm
brass, outline and highlight. The picture must be exactly the size below, the slab filling it with a 6 px transparent margin.

1. `CD-crate-2.png`, 384 x 192: the 2-cell crate (see above). Body KEY.
2. `CD-crate-3.png`, 576 x 192: the same crate, 3 cells long (the same cap, rim and arrow plate; only longer). Body KEY.
3. `CD-crate-heavy-2.png`, 384 x 192 and `CD-crate-heavy-3.png`, 576 x 192: the HEAVY blocker, the same slab shape, in cold grey stone-and-iron, with rivets, NO panel, NO arrow plate
   (it never moves). No KEY here: paint it grey.
4. `CD-gate.png`, 384 x 192: an EXIT GATE plate that sits in the wooden frame: a glossy rounded plate, a bright glowing rim, a soft outer glow, an EMPTY flat centre where the game
   draws white chevrons. Plate body KEY, rim and glow KEY highlight ramp. Straight on, pointing nowhere (the game rotates it).
5. `CD-tile.png`, 192 x 192: ONE floor tile: a dark charcoal-slate rounded square with a soft top-left highlight and a thin lighter rim, so a grid of them looks like a stone
   counter inset. It must fill the whole canvas edge to edge with NO transparent margin and no gap (the game lays them side by side). OPAQUE edges.
6. `CD-frame.png`, 1080 x 1080: the wooden FRAME of the board: a thick, rounded, honey-brown plank border with a brass inner lip, rounded outer corners, and a TRANSPARENT square
   opening in the middle exactly 940 x 940 px at the centre (so the border is 70 px wide on every side). The border carries NO gates, NO notches, NO text. Soft shadow
   outside it, inside the canvas.

## BATCH B: the screen furniture (all EMPTY: the game draws the words and numbers)

7. `CD-level-badge.png`, 384 x 320: a cloud-shaped glossy BLUE badge with a white-gold rim, an empty centre.
8. `CD-title-sign.png`, 1024 x 384: a carved dark-wood hanging SIGN with brass studs, a little chef's hat on top and leafy sprigs at both ends, a smooth EMPTY face for the title.
9. `CD-info-banner.png`, 1024 x 256: a cream parchment SCROLL banner with curled ends and a brown rim, an empty face.
10. `CD-objectives-panel.png`, 768 x 576: a parchment PANEL with a brown rim and a dark-wood ribbon across the top (empty), and an empty body.
11. `CD-timer-pill.png`, 576 x 192: a red-and-gold STOPWATCH sitting at the left end of a dark capsule with an EMPTY slot for a progress bar (the stopwatch face shows a clock with
    hands but NO numbers on it).
12. `CD-round-button.png`, 256 x 256: an empty round glossy BLUE button with a gold rim, used for Pause and the three boosters. Straight on.
13. `CD-booster-icons.png`, 768 x 256, three 256 x 256 cells left to right: a yellow LIGHT BULB; a gold-and-red STOPWATCH with a small green plus; a yellow curved UNDO ARROW.
    Each centred, with a 24 px margin, for putting on the round button.
14. `CD-count-badge.png`, 128 x 128: a small gold round BADGE, empty, for a number.
15. `CD-label-plate.png`, 384 x 128: a cream rounded LABEL plate with a brown rim, empty.
16. `CD-stars.png`, 512 x 256, two 256 x 256 cells: a bright GOLD star, and the same star EMPTY (dull grey-beige). Both bevelled, same size and place.
17. `CD-speech-bubble.png`, 512 x 384: an empty cream SPEECH BUBBLE with a soft brown outline and a tail at the bottom LEFT.

## BATCH C: the scene

18. `CD-backdrop.png`, 1080 x 1920, **OPAQUE**: a warm, softly blurred restaurant-kitchen wall at the back: dark wood shelves with jars, bottles and pots, hanging lamps, small
    potted herbs, golden light. Calm and low-contrast in the middle (the board sits there), a little busier at the top and sides. No people, no text.
19. `CD-counter.png`, 1080 x 420: the FOREGROUND at the bottom of the screen: a wooden counter top with a red-and-white gingham cloth corner at each end, a wooden crate of
    ripe tomatoes at the left, a white chef's hat on the right. Transparent above the counter (it overlaps the backdrop), open and empty in the middle (the booster buttons
    sit there).

## BATCH D: the results (picture only, no words)

20. `CD-win.png`, 768 x 576: the restaurant assistant (a young woman with a brown bun, a yellow headband, a cream shirt, a green apron: look at the screenshot's character) cheering
    with both arms up beside a tidy stack of empty crates, confetti round her. Same look as the screenshot's character and as `Paige Cutout Assets\cutout-cheer.png`.
21. `CD-fail.png`, 768 x 576: the same assistant with a worried face holding up a stopwatch, a few crates still on the counter behind her.
22. `CD-puff.png`, 256 x 256: a small soft white DUST PUFF with two tiny sparkles (for a crate leaving through its gate).

## CHECKLIST (before each file is saved)

- Exact pixel size; transparent where it says so; no checkerboard; no halo; no text, numbers or letters anywhere.
- KEY files: only the key ramp for the colour part, NO other pink, magenta or purple in the picture.
- Panels, plates and badges are EMPTY (no ingredient, no arrow, no word, no number).
- `CD-tile.png` touches every edge; `CD-frame.png` has a 940 x 940 transparent opening; the crates are 192 px a cell and not cropped.
- The set looks like ONE game (the same wood, the same brass, the same outline, the same light).
- Nothing in the repo outside `Crate Dispatch\` was touched.

## After Codex (Claude's part, only on the developer's word)

A script (`scripts/make-crate-dispatch-assets.py`) cleans the alpha, turns the KEY crates and gates into the game's colours (green, red, orange, blue, purple, yellow, teal, pink),
and builds WebP files into `public/business/cratedispatch/`. Plain shapes stay as the fallback until each file arrives. **Open question for the developer:** this is the Car Park's
rule (slide a vehicle out through a gap) re-skinned with crates, plus a timer, stars and boosters. Does Crate Dispatch REPLACE the Car Park, sit beside it as a separate mini-game, or
become the Car Park's new look? Claude would reuse `business/carPark.ts` for the rules in the first two cases only if the brief says so. Nothing is built before the developer plays
the plain-art version on a real phone (production rules).
