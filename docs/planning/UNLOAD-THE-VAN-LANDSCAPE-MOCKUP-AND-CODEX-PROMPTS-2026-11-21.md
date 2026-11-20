# Unload the Van, landscape: the developer's mock-up and optional Codex prompts (2026-11-21)

**Developer's request:** "Optimize and make the Unload the Van game exactly like this image; if background assets are needed, ask."

**The mock-up:** `docs/planning/reference/unload-the-van-mockup-2026-11-21.png` (attach it to every prompt below).

## What is done in code (no new pictures were needed for it)

A wide window now shows the mock-up's arrangement (`KitchenDispatchGame.tsx`, `kitchenDispatchDraw.ts`; the 9:16 stage for an upright window is untouched):

- **Top bar, full width:** back and the level badge, the title sign, the parchment line that says what to do, Pause.
- **Left wall:** Paige, the clock, the "Crates" plate and the three stars on a dark wooden panel with a copper rim, and the pinned card with the truck and the tip button.
- **Right wall:** the four boosters (Freeze, Rocket, Hammer, Undo) in one column, the name plate overlapping the foot of each button.
- **Middle:** a LARGER board in a thick dark-wood frame with a copper rim, wider than tall; its cells are a little wider than tall (the rules count cells, never pixels, so no board,
  seed or proof changes: `crate-dispatch-qa` passes), the doors sit in the frame's margin, empty cells show a faint star.
- Checked at 1917 x 912, 1280 x 720 (an 8 x 8 level) and a phone on its side (844 x 390); `kitchendispatch.mjs` K1-K12 pass (K12's drags use the new cell geometry).

## What still differs: three optional pictures

The room and the HUD pieces are the existing paintings, and the frame is painted in code. To match the mock-up exactly, three pictures can be repainted. None blocks anything: the game
works and looks right without them. Say which you want and I integrate them the same way as the Fridge Sort ones.

### Set A: Paige, hands on her hips (one transparent picture, 1000 x 1200)

Replaces `public/business/cratedispatch/mascot.webp` (the file `make-crate-dispatch-assets.py` builds). Attach the mock-up and the current `mascot.webp`.

```
Create ONE picture, 1000 x 1200 px, on a fully transparent background (real alpha, no checkerboard): Paige, the restaurant's friendly assistant, from the waist up, facing the viewer in
a relaxed three-quarter pose with BOTH HANDS ON HER HIPS, smiling warmly. The same character as the attached mock-up and the current mascot: dark brown curly hair in a bun with a yellow pencil in it,
a cream blouse with the sleeves rolled up, a dark green vest with brass buttons and a small name tag. Glossy storybook painting style, a thin darker outline, soft light from the upper left.
No text, no background, no shadow on the ground. About 90 % of the height, centred, the hands on the hips fully visible.
```

### Set B: the board's frame (one transparent picture, 1600 x 1200)

Optional: the game paints this frame in code now (dark wood with a copper rim). A painted one would add wood grain. Save as `Unload Van Assets/UV-frame-wide.png`; I add it as `frame-wide.webp` (the draw code already has the slot).

```
Create ONE picture, 1600 x 1200 px, on a transparent background: a thick rounded-rectangle FRAME only, to hold a game board. Dark mahogany wood with visible grain, a polished orange-copper rim
on its outer and inner edges, soft highlights on the upper left, a thin dark outline. The frame is 1520 x 1120 px, centred, with rounded corners of about 70 px radius; the border is an even 70 px
all round. The whole inside of the frame (the board's area) is FULLY TRANSPARENT (no panel, no cells, no fill). No text, no doors, no icons, nothing inside. Match the attached mock-up's frame.
```

### Set C: the room (one picture, 1920 x 1080)

The current wide room (`TL-game-unload-the-van.png`) already has the dark wall, the jar shelves and the hanging lamps. The mock-up adds a red-and-white checkered cloth on the counter at BOTH bottom
corners and a chef's hat at the bottom right. Replaces `Landscape Backdrops Assets/true-landscape/part2/TL-game-unload-the-van.png` (same name and size). Attach the mock-up and the current room
`public/landscape-art/true/game-unload-the-van.webp`.

```
Create ONE landscape picture, 1920 x 1080, no people, no text, no UI: the same warm dark pantry as the attached current room (dark brown wall, wooden shelves with glass jars of spices, grains and
herbs on BOTH sides, ivy, two hanging metal lamps with glowing bulbs near the top left and top right) with these changes: a polished wooden counter along the bottom (y 90 to 100 %) with a
red-and-white checkered cloth draped on it at the bottom LEFT corner (x 0 to 12 %), a small wooden crate of red tomatoes beside it, and the same checkered cloth at the bottom RIGHT corner
(x 88 to 100 %) with a folded white chef's hat on it. Keep the whole middle (x 20 to 80 %, y 8 to 90 %) a plain dark brown wall with soft light: a big game board is drawn over it. Glossy storybook
painting style, the same as the attached images.
```
