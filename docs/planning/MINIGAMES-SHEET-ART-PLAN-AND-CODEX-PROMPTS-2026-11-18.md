# Mini-games sheet: painted art plan and Codex prompts (developer 2026-11-18)

> **STATUS 2026-11-18 (updated): DONE.** Codex delivered all 22 pictures the same day and they are built (`scripts/make-minigame-assets.py` -> `public/business/minigames/`)
> and wired into the sheet (`MiniGamesSheet.tsx`, `minigamesArt.ts`); see HANDOFF. The sizes below are what was asked for; the shipped files are the smaller WebP versions.

## 1. Why it is worth doing

The sheet is the shop window of ALL eight mini-games, and mini-games are what keep a player in a session (see the revenue goal in memory). Right now it is
the plainest screen in the game: emoji on pastel squares, flat cream cards. A painted icon per game, a card with the same wood-and-brass look as the Kitchen
buttons, and a clear "ready" glow make each game look like something worth opening. It also costs very little: eight icons and fourteen small pieces of UI.

## 2. What the screen is, exactly (so every size below is real)

The sheet is a bottom sheet on the Kitchen (a centred card in phone landscape). Measured from `MiniGamesSheet.tsx`:

| Part | Today (CSS px) | Notes |
|---|---|---|
| Sheet | full width, max **560 px**, max height 88 % of the screen, top corners 26 px, 16 px side padding | bottom edge sits on the screen's bottom edge |
| Header | title "Mini-games" (22 px display font) + "8 of 8 open" (Caveat 14 px) on the left; **48 x 48** round close button on the right | |
| Grid | **2 columns**, gap 10 px, scrolls inside the sheet | |
| Card (tile) | width = (sheet width - 32 - 10) / 2: **139 px** at 320 wide, **174 px** at 390, **259 px** at the 560 max; min height 112 px, corner 18 px, 2 px border | the card is a whole button (>= 48 px touch target) |
| Logo | **56 x 56**, corner 16 px, centred at the top of the card | this is the part the paintings replace |
| Name | 14 px display font, one or two lines | drawn by code |
| Status line | 12 px, e.g. "3/3 rounds left", "Free play", "Cleared today", or "opens at Level N" when locked | drawn by code |
| States | **ready** (cream + gold border, green status text), **resting** (open, nothing to play now: faded), **locked** (grey logo + a small padlock) | the code applies grayscale / opacity; the art does not need to |

**The new design (what Claude would build once the pictures exist):** the logo grows to **84 x 84** and may rise a little above the card's top edge (a "pop-out"
painting, no square tile behind it); the card is ~150 px tall; the card plate, the sheet panel, the title ribbon, the close button and the status lines become
painted pieces; a gold star badge shows on a game that has something waiting. Every word and number stays code (nothing is painted into a picture).

**Pictures are drawn at 3x the largest size they are shown, saved as PNG by Codex, and turned into small WebP files by a script of ours** (the same pipeline as
Car Park, Dessert Run and Crate Dispatch: `scripts/make-*-assets.py` -> `public/business/<folder>/`). The sheet loads them lazily when it opens.

## 3. The asset list (22 files: 8 icons + 14 furniture pieces)

All files go in a NEW folder `D:\WORKS\GAMES\Knife Craft\Mini-games Sheet Assets\`. Names start with `MG-`.

### Batch A: the eight game icons (do these first; the sheet already looks far better with only these)

| File | Size | Game | What it shows |
|---|---|---|---|
| `MG-icon-inspection.png` | 512 x 512 | Check the delivery | a wooden delivery crate of mixed produce with a brass-rimmed magnifying glass held over it |
| `MG-icon-fridge-sort.png` | 512 x 512 | Fridge Sort | a cheerful open retro fridge with shelves and a few foods being placed |
| `MG-icon-sauce.png` | 512 x 512 | Sauce Station | a copper mixing bowl of red-orange sauce, a wooden whisk, two small sauce bottles |
| `MG-icon-stockroom.png` | 512 x 512 | Stock the shelves | a wooden stockroom shelf with boxes, jars and cans, one box being slid in |
| `MG-icon-fridge-check.png` | 512 x 512 | Fridge Check | a fridge door ajar, a round thermometer, a wrapped, labelled food package with a green tick tag |
| `MG-icon-car-park.png` | 512 x 512 | Car Park | the game's glossy blue car and a yellow bus nose, with an orange traffic cone |
| `MG-icon-dessert-run.png` | 512 x 512 | Dessert Run | a blue-and-white plate with a mosaic (pixel-tile) cake slice and two loose tiles, a tiny waiter carrying one tile |
| `MG-icon-kitchen-dispatch.png` | 512 x 512 | Unload the Van | the white-and-green delivery van, rear doors open, colourful crates stacked out of it |

### Batch B: the furniture (after A looks right)

| File | Size | Used for |
|---|---|---|
| `MG-card-ready.png` | 384 x 384, nine-slice (96 px corners) | the card of a game you can play: warm parchment, a gold rim |
| `MG-card-resting.png` | 384 x 384, nine-slice | the card of an open game with nothing to play now: the same shape, quieter, no gold glow |
| `MG-card-locked.png` | 384 x 384, nine-slice | the card of a locked game: dark cool wood, no glow |
| `MG-sheet-panel.png` | 512 x 512, nine-slice (128 px corners) | the sheet itself: parchment inside a wood-and-brass edge, rounded TOP corners, flat bottom |
| `MG-title-ribbon.png` | 768 x 192 | the empty ribbon behind the title "Mini-games" |
| `MG-close-button.png` | 192 x 192 | the empty round close button (the cross is drawn by code) |
| `MG-pill-ready.png` | 288 x 84 | the status line of a ready game (green) |
| `MG-pill-rest.png` | 288 x 84 | the status line of a resting game (cream) |
| `MG-pill-locked.png` | 288 x 84 | the status line of a locked game (brown) |
| `MG-lock-badge.png` | 128 x 128 | the padlock on a locked game's icon |
| `MG-badge-ready.png` | 96 x 96 | a small gold star badge on a card that has something waiting |
| `MG-shortcut-icon.png` | 256 x 256 | the painted game controller on the Kitchen's round Mini-games button (shown at 40 px) |
| `MG-header-sparkle.png` | 256 x 128 | three tiny gold sparkles beside the title |
| `MG-ready-glow.png` | 384 x 384, nine-slice | a soft gold outer glow behind a ready card (no card in it) |

(Also decided: the locked and resting looks are made by the code from the SAME icon (grey and dim), so no second set of icons is needed.)

## 4. How to run it

1. **One Codex conversation per batch.** Attach the REFERENCE IMAGES, paste the STYLE BIBLE, then the batch prompt.
2. **Batch A first.** Check each icon on the checklist (section 7). Fix a bad one before moving on; do not paint all fourteen furniture pieces on top of a weak icon.
3. Then Batch B. Then tell Claude: it builds the script, the loader and the new tile (section 8) and shows screenshots at 320 x 568, 390 x 844, 430 x 900 and 768 x 1024.
4. The developer plays it on a real phone before anything else is added (production rules, `MINIGAME-PRODUCTION-RULES-2026-11-14.md`).

**Reference images to attach (they exist in the repo folders):**
- The current sheet screenshot (the developer's image of 2026-11-18): the layout and the 8 games.
- The Kitchen screenshot with the round golden-ring buttons (the developer's image of 2026-11-18, "Kitchen HUD"): THE TARGET LOOK for the ring, the gold and the parchment.
- `Car Park Assets\car-blue.png` and `Car Park Assets\bus-yellow.png`: the car and bus exactly as the game draws them.
- `Dessert Run Assets\DR-plate.png` and `Dessert Run Assets\DR-guests.png`: the blue-and-white plate and the waiter.
- `Paige Cutout Assets\cutout-point.png`: how our people are painted (only for the Dessert Run waiter).
- `Crate Dispatch\` any ingredient picture (e.g. a tomato): how food is painted.
- `Sauce Product Assets\` any bottle: how bottles are painted.

## 5. READ THIS FIRST: what Codex must NOT do

**Make IMAGES ONLY. Do NOT write, edit or "improve" any game code, test, config or document in the repo.** Do not touch `src/`, `scripts/`, `tools/`, `public/` or `docs/`.
Do not build a screen, a preview page or a mini-game (on 2026-11-15 Codex built a whole mini-game when it was only asked for pictures). Do not rename, move or overwrite any
existing file. Save every NEW picture ONLY into `D:\WORKS\GAMES\Knife Craft\Mini-games Sheet Assets\` with the exact file name below, then stop and report the file names and pixel
sizes. **Every word, number, letter, tick-in-a-word and cross is drawn by the game's code: paint NONE of them** (empty ribbon, empty pills, empty button).

## 6. STYLE BIBLE (paste at the top of EVERY request)

```
Style: a glossy, chunky, hand-painted casual-game UI, matching the attached Kitchen screenshot: thick rounded shapes, soft bevels, a bright highlight at the top left,
a deeper shade at the bottom, warm golden light. Gold is a rich honey-gold ring (#E0A63A) with a lighter inner highlight. Wood is honey-brown with visible grain and
rounded edges; metal is warm brass or copper; paper is cream parchment (#FFF3D6 to #F6DFB5). A thin DARK WARM-BROWN outline (#4A2A14, never pure black) round every object.
Colours rich and saturated but not neon. Objects are seen from a gentle front-and-slightly-above hero angle unless a file says otherwise. Cozy restaurant mood, one
consistent light from the top left.
Format: PNG, true transparent background (real alpha, no checkerboard, no white box, no grey halo, no drop shadow outside the object unless the file says so).
No text, no numbers, no letters, no logos, no watermark, no signature anywhere.
```

## 7. BATCH A prompts: the eight icons

**Common rules for all eight (say them in the request):** a single hero object group, centred, filling about 80 % of a **512 x 512** canvas with a **48 px transparent margin**
on every side (nothing touches the edge); a soft contact shadow directly under the group is allowed but must stay inside the canvas and fade to fully transparent; the group
must read clearly when shrunk to 84 px (big simple shapes, strong silhouette, few small details); NO square tile, NO frame, NO background behind it (the game puts the card
behind it); same light, same outline weight (about 6 px at 512), same gloss in all eight so they look like one set.

1. `MG-icon-inspection.png`: "A sturdy honey-wood delivery crate, open at the top, heaped with mixed fresh produce (a red tomato, a green lettuce head, an orange carrot, a green
   pepper). A big round brass-rimmed MAGNIFYING GLASS is held at an angle over the front of the pile, its lens clear with a bright highlight, magnifying one tomato that has a
   small brown bruise spot. No hand holding it (the glass floats at a natural angle). Warm, friendly, slightly cartoon-glossy."
2. `MG-icon-fridge-sort.png`: "A cheerful retro refrigerator in soft mint-blue with a chrome handle, its door swung wide open to the left, showing three shelves. A carton of milk, a wedge
   of yellow cheese and a pink salmon fillet sit on the shelves; a little cold-blue glow inside. One extra piece of food (a green lettuce) floats just above the middle shelf as if
   it is about to be placed."
3. `MG-icon-sauce.png`: "A glossy copper mixing bowl, seen from slightly above, full of thick red-orange sauce with a swirl; a long wooden whisk resting in it, its handle up and to the right.
   Beside it, two small glass sauce bottles with cork caps and blank cream labels, one with green sauce, one with golden sauce. A few drops on the rim."
4. `MG-icon-stockroom.png`: "A tall honey-wood stockroom shelving unit (three shelves) with neatly stored items: cardboard boxes with brown tape, glass jars with cork lids, round tin cans with blank
   labels, a sack of flour. A cardboard box is half-slid into the middle shelf. The shelf is slightly angled to show depth."
5. `MG-icon-fridge-check.png`: "A mint-blue refrigerator seen from the front with its door slightly ajar and a thin warm line of light, a big round dial THERMOMETER (white face with a red needle, NO numbers)
   hanging at the left, and in front a food package wrapped in clear film with a blank cream label tied on, plus a small GREEN round tag with a white tick shape (a check mark, not a word)."
6. `MG-icon-car-park.png`: "The game's own vehicles: the glossy toy-like BLUE car (match `Car Park Assets\car-blue.png` exactly in colours and shape) in front, a bright YELLOW bus nose behind it
   (match `bus-yellow.png`), and an orange-and-white striped TRAFFIC CONE at the right. Shown from a high front-three-quarter angle so the cars read as friendly toys. A short strip of
   asphalt with one white parking line under them."
7. `MG-icon-dessert-run.png`: "A round blue-and-white patterned plate (match `Dessert Run Assets\DR-plate.png`) holding a slice of cake made entirely of small square MOSAIC TILES (like pixel art:
   pink frosting tiles on top, cream sponge tiles, a red cherry tile), two loose tiles beside it, and a tiny cheerful WAITER in a green apron (match the waiter in `DR-guests.png`) carrying
   one pink tile like a tray. The mosaic tiles have square sharp corners and no gaps between them."
8. `MG-icon-kitchen-dispatch.png`: "A friendly white delivery van with a green stripe and a round headlight, seen from the rear three-quarter, both back doors flung open, with crates sliding out and stacked
   beside it: wooden crates in eight bright colours (red, orange, green, teal, purple, yellow, blue, brown), each crate with a plain lighter panel in the middle. No arrows, no writing."

## 8. BATCH B prompts: the furniture

(All EMPTY. The game draws the words and numbers. Paste the Style Bible first.)

9. `MG-card-ready.png`, **384 x 384, nine-slice**: "A rounded parchment CARD seen straight on, made to be stretched: the four 96 x 96 corners carry the rounded corners and the detail; the 192 px middle band on each side
   and the centre are calm so they can stretch. Cream parchment fill with a very soft vertical gradient (lighter at the top), a thick honey-gold rim (#E0A63A) with a lighter inner
   highlight and a thin dark warm-brown outer line, a faint warm inner glow. Fills the canvas edge to edge, OPAQUE inside the rounded corners, transparent outside them."
10. `MG-card-resting.png`, 384 x 384, nine-slice: "The SAME card, same size and same corner shapes, but quieter: a thinner, paler gold-beige rim, no glow, slightly greyer cream fill."
11. `MG-card-locked.png`, 384 x 384, nine-slice: "The SAME card shape in dark cool walnut wood with a muted brass rim and a faint woodgrain, no glow. Calm in the middle (the game draws a greyed icon and words on it)."
12. `MG-sheet-panel.png`, **512 x 512, nine-slice (128 px corners)**: "The bottom sheet's panel: cream parchment inside, a thick honey-wood edge with a gold lip along the TOP and the two top corners rounded (radius about 104 px); the sides run
    straight down; the bottom edge is FLAT and runs off the canvas (no rounded bottom corners, no rim along the bottom). Calm centre. A faint leafy vine on the top-left corner only,
    inside the 128 px corner area."
13. `MG-title-ribbon.png`, 768 x 192: "A curved cream-and-gold ribbon banner with tucked, folded ends in warm dark red-brown, an EMPTY smooth cream face, a thin gold edge, a little brass star at each end."
14. `MG-close-button.png`, 192 x 192: "An empty round glossy button in rich walnut-brown with a gold rim and a bright top-left highlight, pressed-down shadow underneath. No cross drawn."
15. `MG-pill-ready.png`, 288 x 84: "An empty rounded status PILL, glossy fresh green with a lighter top highlight and a thin dark-green outline, soft rounded ends. Nothing on it."
16. `MG-pill-rest.png`, 288 x 84: "The same pill shape in cream-beige with a thin brown outline."
17. `MG-pill-locked.png`, 288 x 84: "The same pill shape in dark brown with a thin brass outline."
18. `MG-lock-badge.png`, 128 x 128: "A small round brass badge with a glossy padlock (closed, dark steel shackle, brass body, a keyhole). Straight on, 8 px margin."
19. `MG-badge-ready.png`, 96 x 96: "A small round gold badge with a bright glossy five-point star in the middle and two tiny sparkles. Straight on, 6 px margin."
20. `MG-shortcut-icon.png`, 256 x 256: "A glossy game controller (gamepad) in rich purple with cream buttons (one blue, one green, one red, one yellow) and a little cross pad, a bright top-left highlight, 3/4 front view.
    Fills about 80 % of the canvas, transparent background. It will sit on a cream round button with a gold ring, so keep its colours bold."

(Items 9 to 22 are Batch B: 14 files; with Batch A's eight that is 22 in all.)

21. `MG-header-sparkle.png`, 256 x 128: "A tiny cluster of three gold four-point sparkles of different sizes, soft glow, to sit beside the title."
22. `MG-ready-glow.png`, 384 x 384, nine-slice: "A soft warm gold OUTER GLOW ring only (no card): transparent in the middle, a soft glowing halo hugging a rounded-square outline, to sit behind a ready card. The 96 px
    corners carry the glow's rounded shape."

## 9. CHECKLIST (before each file is saved)

- Exact pixel size; transparent where it says so; no checkerboard; no halo; **no text, numbers or letters anywhere** (a tick or a cross shape is fine only where the prompt says so).
- Icons: centred, 48 px margin, nothing touches the edge, no tile or frame behind, readable at 84 px, same outline weight and gloss as the others.
- Nine-slice files: the four corners hold all the detail; the middle bands are calm; every edge pixel lines up so stretching shows no seam.
- Pills, ribbon, button and cards are EMPTY.
- The whole set looks like ONE game: the same gold (#E0A63A), the same wood, the same outline, the same light from the top left.
- Nothing in the repo outside `Mini-games Sheet Assets\` was touched.

## 10. After Codex (Claude's part, only on the developer's word)

1. `scripts/make-minigame-assets.py`: trims, checks every size above, resizes the icons to 320 x 320 and the furniture to its 2x size, writes WebP into `public/business/minigames/`
   (target: the whole folder under about 400 KB; lazy-loaded when the sheet opens, never in the first load).
2. `useMiniGameArt` (the same small loader the other mini-games use); each tile falls back to today's glyph tile if its picture is missing.
3. `MiniGamesSheet.tsx`: the 84 x 84 pop-out icon, `border-image` cards (the technique the result panels already use), the painted panel, ribbon, close button and pills; locked = grey + lock badge,
   resting = dimmed, ready = gold glow + star badge when something waits. Touch targets stay >= 48 px; text sizes unchanged (12 to 14.5 px).
4. Tests: `mini-games-qa` gets checks that every file exists at its size and every game has an icon; `minigames.mjs` e2e checks the pictures load (no broken image), nothing scrolls sideways at
   320 / 360 / 390 / 430 / 768 and the close button is still reachable; screenshots at those sizes go to the developer.
5. The store text and screenshots (`playgama/`) are refreshed in the same release (the sheet is a good store screenshot).

**Open question for the developer:** the eight icons are drawn as ONE set. If you would rather have each game's icon match that game's own screen art even more closely (for example the
Sauce Station's painted bowl), say so and Claude lists which existing pictures to reuse instead of painting new ones.
