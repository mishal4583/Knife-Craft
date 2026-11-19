# Landscape pictures, Part 3: the intro story, the loading screen and the Second Floor (developer 2026-11-19)

Nine pictures for Codex, on their own. They are the third part of `LANDSCAPE-BACKDROPS-CODEX-PROMPTS-2026-11-19.md` (Part 1: the mini-games and the sink; Part 2: the six Kitchen and six Restaurant pictures).
**How the picture is used:** each one is the existing portrait picture in the CENTRE, unchanged, with the same scene painted on to the LEFT and RIGHT, so the game fills a wide window with its own picture instead of dark bars.

## READ THIS FIRST: what Codex must NOT do

**Make IMAGES ONLY. Do NOT write, edit or "improve" any game code, test, config or document in the repo.** Do not touch `src/`, `scripts/`, `tools/`, `public/` or `docs/`.
Do not build a screen or a mini-game. Do not rename, move or overwrite any existing file (the `reference\` folder stays as it is).
Save every NEW picture ONLY into `D:\WORKS\GAMES\Knife Craft\Landscape Backdrops Assets\` (the folder itself, not `reference\`) with the exact file name below, then stop and report
the file names and pixel sizes. The developer then tells Claude, who converts them (webp, 1440 x 810, like the existing `public\landscape-art\`) and wires them in.

## Reference images (all in `D:\WORKS\GAMES\Knife Craft\Landscape Backdrops Assets\reference\`, PNG copies of the game's own files)

| Picture | Reference to extend | Size | Source file in the repo |
|---|---|---|---|
| Story 1 (the key) | `backdrop-story-1-key.png` | 941 x 1672 | `src\assets\story\intro-1-key.webp` |
| Story 2 (the kitchen) | `backdrop-story-2-kitchen.png` | 941 x 1672 | `src\assets\story\intro-2-kitchen.webp` |
| Story 3a (clean) | `backdrop-story-3a-clean.png` | 941 x 1671 | `src\assets\story\intro-3a-clean.webp` |
| Story 3b (repair) | `backdrop-story-3b-repair.png` | 941 x 1672 | `src\assets\story\intro-3b-repair.webp` |
| Story 3c (restore) | `backdrop-story-3c-restore.png` | 941 x 1671 | `src\assets\story\intro-3c-restore.webp` |
| Story 4 (the chef) | `backdrop-story-4-chef.png` | 941 x 1672 | `src\assets\story\intro-4-chef.webp` |
| Story 5 (first order) | `backdrop-story-5-first-order.png` | 941 x 1672 | `src\assets\story\intro-5-first-order.webp` |
| Loading screen | `backdrop-loading-screen.png` | 576 x 1024 | `public\loading\bg.webp` |
| Second Floor map | `map-second-floor.png` | 864 x 1535 | `public\restaurant-map\second-floor.webp` |

Also attach, once per conversation, the look of the rest of the game: `look-kitchen-landscape.png` and `look-restaurant-dining-landscape.png` (landscape, 1440 x 810).
**Send the seven story scenes in ONE conversation** (the room, the light and the time of day must match in all seven). The loading screen and the Second Floor are one conversation each.

## STYLE BIBLE (paste at the top of EVERY request)

```
STYLE BIBLE: KnifeCraft landscape backdrops. The exact look of the attached KnifeCraft pictures: warm hand-painted illustration with soft painterly shading, golden warm light,
polished brass and dark timber, green ivy and potted plants, rich colours that are not neon, soft light from windows and lamps.
This is a BACKGROUND picture: no animals, no game pieces, no buttons, no cards. The story scenes keep the people already in them (and only those); the loading screen and the Second Floor have no people.
NO TEXT AT ALL anywhere: no letters, numbers, words, signs with writing, logos, brand names or watermarks (blank chalkboards and blank paper are fine).
OUTPUT: a single opaque PNG, EXACTLY 1920 x 1080 pixels (16:9), no transparency, no border, no frame, no vignette.
```

## The rule for EVERY picture below (paste it under the style bible)

```
CANVAS AND CENTRE COLUMN: the canvas is 1920 x 1080. Place the attached portrait picture in the exact middle of the canvas, scaled uniformly to 1080 pixels tall, so it is
about 608 pixels wide and covers x = 656 to x = 1264. KEEP THAT COLUMN PIXEL-FOR-PIXEL THE SAME PICTURE: the same objects in the same places, the same colours, the same light.
Do not redraw it, do not move anything in it, do not add anything to it.
SIDES: paint the SAME ROOM continuing to the left (x = 0 to 656) and to the right (x = 1264 to 1920), as if the portrait picture were a window onto the middle of a wider room.
The two seams must be invisible: the wall, the floor, the table or counter edge, the skirting line, the light and the colours run straight across them with no step and no visible join.
Continue the perspective and the horizon / counter / floor lines of the centre column exactly. Do NOT mirror or copy the centre column, do NOT repeat the same object twice, do NOT use a
blur or a flat colour: paint new, natural room detail of the same kind (listed per picture). Keep the sides a little calmer and slightly darker than the centre so the game piece in the
middle stays the focus, and keep the very bottom 12 % free of busy detail. No important detail at the left and right edges (the picture is cropped a little on some screens).
```

## The pictures (the story scenes first: the player sees them on the first launch)

### 23. `LS-story-1-key.png` (intro story scene 1-key)
```
STORY SCENE: extend the attached portrait story picture `backdrop-story-1-key.png` (the old man and the old woman (the grandparents) handing a brass key to the young man in the foreground, a sunlit run-down barn kitchen full of dust and ivy). Same rule as above (centre column x 656 to 1264 unchanged, the room continues left and right,
invisible seams). The story scenes have PEOPLE in them: the people stay exactly as they are in the centre. the grandparents are cut by the left edge of the portrait picture: complete them naturally. Any person who is cut by the left or right edge of the
portrait picture is completed naturally on the side (same clothes, same pose, same lighting), never copied or mirrored. Left and right: the same big sunlit barn kitchen, with the
same warm god-rays from the tall windows, hanging lamps, a brick oven, shelves of crockery, ivy, long worktables, herbs and baskets in the foreground corners. No NEW people on the sides.
This story is told in seven pictures in order, so the room, the light and the time of day must be the SAME in all seven landscape scenes (send all seven in one conversation).
```

### 24. `LS-story-2-kitchen.png` (intro story scene 2-kitchen)
```
STORY SCENE: extend the attached portrait story picture `backdrop-story-2-kitchen.png` (the young man seen from behind, one hand on his head, looking at the dusty, overgrown kitchen). Same rule as above (centre column x 656 to 1264 unchanged, the room continues left and right,
invisible seams). The story scenes have PEOPLE in them: the people stay exactly as they are in the centre. Any person who is cut by the left or right edge of the
portrait picture is completed naturally on the side (same clothes, same pose, same lighting), never copied or mirrored. Left and right: the same big sunlit barn kitchen, with the
same warm god-rays from the tall windows, hanging lamps, a brick oven, shelves of crockery, ivy, long worktables, herbs and baskets in the foreground corners. No NEW people on the sides.
This story is told in seven pictures in order, so the room, the light and the time of day must be the SAME in all seven landscape scenes (send all seven in one conversation).
```

### 25. `LS-story-3a-clean.png` (intro story scene 3a-clean)
```
STORY SCENE: extend the attached portrait story picture `backdrop-story-3a-clean.png` (the young man wiping the dusty worktable, a crate of herbs beside him). Same rule as above (centre column x 656 to 1264 unchanged, the room continues left and right,
invisible seams). The story scenes have PEOPLE in them: the people stay exactly as they are in the centre. Any person who is cut by the left or right edge of the
portrait picture is completed naturally on the side (same clothes, same pose, same lighting), never copied or mirrored. Left and right: the same big sunlit barn kitchen, with the
same warm god-rays from the tall windows, hanging lamps, a brick oven, shelves of crockery, ivy, long worktables, herbs and baskets in the foreground corners. No NEW people on the sides.
This story is told in seven pictures in order, so the room, the light and the time of day must be the SAME in all seven landscape scenes (send all seven in one conversation).
```

### 26. `LS-story-3b-repair.png` (intro story scene 3b-repair)
```
STORY SCENE: extend the attached portrait story picture `backdrop-story-3b-repair.png` (the young man pushing open a tall old window, light pouring in). Same rule as above (centre column x 656 to 1264 unchanged, the room continues left and right,
invisible seams). The story scenes have PEOPLE in them: the people stay exactly as they are in the centre. Any person who is cut by the left or right edge of the
portrait picture is completed naturally on the side (same clothes, same pose, same lighting), never copied or mirrored. Left and right: the same big sunlit barn kitchen, with the
same warm god-rays from the tall windows, hanging lamps, a brick oven, shelves of crockery, ivy, long worktables, herbs and baskets in the foreground corners. No NEW people on the sides.
This story is told in seven pictures in order, so the room, the light and the time of day must be the SAME in all seven landscape scenes (send all seven in one conversation).
```

### 27. `LS-story-3c-restore.png` (intro story scene 3c-restore)
```
STORY SCENE: extend the attached portrait story picture `backdrop-story-3c-restore.png` (the young man smiling at a restored wooden board, the kitchen cleaner and brighter). Same rule as above (centre column x 656 to 1264 unchanged, the room continues left and right,
invisible seams). The story scenes have PEOPLE in them: the people stay exactly as they are in the centre. Any person who is cut by the left or right edge of the
portrait picture is completed naturally on the side (same clothes, same pose, same lighting), never copied or mirrored. Left and right: the same big sunlit barn kitchen, with the
same warm god-rays from the tall windows, hanging lamps, a brick oven, shelves of crockery, ivy, long worktables, herbs and baskets in the foreground corners. No NEW people on the sides.
This story is told in seven pictures in order, so the room, the light and the time of day must be the SAME in all seven landscape scenes (send all seven in one conversation).
```

### 28. `LS-story-4-chef.png` (intro story scene 4-chef)
```
STORY SCENE: extend the attached portrait story picture `backdrop-story-4-chef.png` (the old chef in a white hat explaining something to the young man seen from behind, a table of vegetables). Same rule as above (centre column x 656 to 1264 unchanged, the room continues left and right,
invisible seams). The story scenes have PEOPLE in them: the people stay exactly as they are in the centre. Any person who is cut by the left or right edge of the
portrait picture is completed naturally on the side (same clothes, same pose, same lighting), never copied or mirrored. Left and right: the same big sunlit barn kitchen, with the
same warm god-rays from the tall windows, hanging lamps, a brick oven, shelves of crockery, ivy, long worktables, herbs and baskets in the foreground corners. No NEW people on the sides.
This story is told in seven pictures in order, so the room, the light and the time of day must be the SAME in all seven landscape scenes (send all seven in one conversation).
```

### 29. `LS-story-5-first-order.png` (intro story scene 5-first-order)
```
STORY SCENE: extend the attached portrait story picture `backdrop-story-5-first-order.png` (the chef handing the young man a tomato to start his first order). Same rule as above (centre column x 656 to 1264 unchanged, the room continues left and right,
invisible seams). The story scenes have PEOPLE in them: the people stay exactly as they are in the centre. Any person who is cut by the left or right edge of the
portrait picture is completed naturally on the side (same clothes, same pose, same lighting), never copied or mirrored. Left and right: the same big sunlit barn kitchen, with the
same warm god-rays from the tall windows, hanging lamps, a brick oven, shelves of crockery, ivy, long worktables, herbs and baskets in the foreground corners. No NEW people on the sides.
This story is told in seven pictures in order, so the room, the light and the time of day must be the SAME in all seven landscape scenes (send all seven in one conversation).
```

### 30. `LS-loading-screen.png` (the loading screen)
```
Extend the attached loading-screen picture `backdrop-loading-screen.png` (576 x 1024): a big sunlit kitchen with a tall arched window onto trees, copper pots on the left, a brick oven with a
fire on the right, wooden cabinets, hanging lamps, ivy and purple wisteria, a shiny wooden floor with light patches. Same rule as above (the portrait picture is the centre column,
here scaled to 1080 tall = 608 wide, x 656 to 1264). Left and right: the same kitchen continuing, wider: more windows with trees, more copper and shelves of jars on the left, more of the
oven wall and cabinets on the right, more floor with light patches. The game puts a logo, a chef, a board and a progress bar over the centre column and a soft shade at the top and bottom:
keep the sides calm and slightly darker.
```

### 31. `LS-second-floor.png` (the Second Floor)
```
SECOND FLOOR MAP VARIANT OF THE RULE: the attached picture `map-second-floor.png` (864 x 1535) is the top-down map of the Second Floor food hall. Place it in the exact middle of the canvas,
scaled uniformly to 1080 tall, so it is about 608 pixels wide and covers x = 656 to x = 1264. KEEP THAT COLUMN PIXEL-FOR-PIXEL THE SAME (the game puts tap areas and cash piles on it).
Paint the food hall continuing left and right of it, seen from above at an angle like the attached `look-restaurant-dining-landscape.png`: more counters and seating, plants, a glass roof or
window wall with daylight, floor tiles, lamps. No people, no text, no copy or mirror of the map. Seams invisible; the top and bottom 14 % calm.
```

## Checklist (run it on EVERY picture before moving on)

1. The file name is exact, the size is exactly 1920 x 1080, opaque PNG.
2. The centre column (x 656 to 1264) is the attached picture unchanged (story scenes: except the few pixels at its left or right edge where a person cut by the edge is completed). Overlay it on the reference to check: nothing moved.
3. The two seams (x = 656 and x = 1264) cannot be found: no step in the wall, floor, counter or horizon line, no colour jump, no hard light edge.
4. The sides are NEW painting, not a mirror and not a copy of the centre, and not blurred or flat.
5. No NEW people, no animals, game pieces, buttons or cards. No text of any kind.
6. The sides are a little calmer and darker than the centre; the bottom 12 % has no busy detail.
7. The seven story scenes are one room: the same windows, light rays, lamps and time of day, and the people are the same people in the same clothes.

