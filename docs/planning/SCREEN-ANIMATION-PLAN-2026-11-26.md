# Screen animation plan (2026-11-26)

Developer's request (2026-11-26): the Kitchen's steam "needs to be improved", plan more good animations that suit each screen, and give Codex prompts for the art. The Codex prompts are in
`docs/planning/ANIMATION-FX-CODEX-PROMPTS-2026-11-26.md`.

## 1. Where we are

- **Built (v1, committed work in progress):** the Kitchen home, all six stages, tall and wide (`KitchenAmbient`): steam, a burner glow, a low haze, lamps that breathe, a beam of sun with dust, glints on the copper, a slow push-in. It is a CSS layer over the painted picture, driven by one data table (`game/kitchen/kitchenAmbient.ts`).
- **Steam, honestly:** v1 was soft round puffs; v1.1 (this round) is curling plumes (a rising outer layer and a swaying inner layer, a haze and a burner glow). A CSS gradient cannot give smoke its texture and curl; that is what the developer's Gemini clip has and ours does not. **The real fix is painted wisps** (sheet FX-1). The layer is already wired for them (`KITCHEN_STEAM_SPRITES` in `kitchenAmbient.ts`: set it to the number of files and the plumes become the pictures, same motion).
- **Already animated by other work** (leave alone): the restaurant map and Second Floor people (`FloorLife`, `StaffLife`), table cash, the sink (soap, clean burst), the cooking clips, Paige's bubble, the cinematic intro's camera moves.

## 2. The rules every animation follows (from CLAUDE.md and what worked)

1. **No new video** (only the six cooking clips and the oven film are allowed) and no large assets. Everything is CSS or a small sprite (`webp`, 12 to 60 KB each, loaded lazily with the screen that uses it).
2. **Only `transform` and `opacity`** are keyframed on painted-room layers (no filter, no blur, no box-shadow). Small gradient elements, a budget of about 40 animated elements on a screen, fewer on a phone.
3. **Follow the painting.** A layer sits in ONE stage the size of the picture's `object-cover` box (`coverRect`), so a point in percent of the picture stays on the same pixel in any window. Anchors are drawn onto the real pictures and checked by eye before they are trusted.
4. **Reduced motion:** the app's `kc-reduced-motion` class (Settings) and `prefers-reduced-motion` switch every layer off. No Page Visibility API, no timers of its own.
5. **Never hide what the player must see.** In a game room the layer stays in the margins and under the board; amplitude is low while a round is being played.
6. **A test per family**, like the Kitchen's: a pure data suite (anchors inside the picture, counts, only transform and opacity, nothing loaded) and one browser check (drawn, moving, on the painting, reduced motion off).
7. **The developer looks at motion on a real phone** before it is called done (jank and battery cannot be judged from a still).

## 3. The engine to reuse

`KitchenAmbient` is the first of a family. The plan is ONE `RoomAmbient` layer driven by a spec per picture, with these element kinds (all already proven in the Kitchen except the new ones):

| Kind | What it draws | Needs art? |
|---|---|---|
| `steam` | rising plumes from a point (pot, cup, plate, machine) | painted wisps (FX-1) |
| `glow` | a lamp or window that breathes, a candle that flickers | no (CSS); flame frames (FX-2) for real fire |
| `beam` + `motes` | a slow sun shaft and dust in it | no |
| `glint` | a star on metal | optional (FX-3) |
| `flame` (new) | a looping fire (fireplace, brick oven, stove, candle) from frames | frames (FX-2) |
| `drift` (new) | petals, leaves, pollen, bubbles, flour, embers moving across a region | particles (FX-4) |
| `drip` (new) | a drop and a ripple (a tap, a sink) | no (CSS) |
| `push` | a very slow zoom | no |

Each screen below is a spec (anchors and kinds) plus, where listed, art.

## 4. Screen by screen

"Anchors" were read from the real pictures (shown in the contact sheets used for this plan). Phases are in section 5.

### Painted rooms

| Screen | Picture | What moves (and where) | Tech and art | Phase |
|---|---|---|---|---|
| **Kitchen home** (6 stages) | `kitchen-01..06` + the six tall skins | DONE v1.1: steam off each pot, burner glow, haze, lamps (Stage 4 up), sun beam + motes, copper glints, push-in. NEXT: painted steam; flame glow ring at the burner; petals and pollen drifting outside the arched window (Stages 3 to 6 show a garden); a slow cloud shadow across the wooden table; at night (the day clock) the lamps are stronger and the beam is off | RoomAmbient + FX-1, FX-2 (burner), FX-4 (petals) | 1 done, 2 next |
| **Loading screen** | `loading.webp` | the brick oven's fire (right side) as a flame loop, the three hanging lamps breathing, the window's sun beam with dust, a little pollen; the loading bar stays crisp and still | `index.html` inline CSS (it paints before the app loads), flame frames FX-2 (small: one strip) | 2 |
| **Market** (header) | `market-header.webp` | the pendant lamp's glow breathes, sun through the right window with dust, a faint steam from nowhere is NOT drawn (no pot); keep it to 3 elements: it is a header | RoomAmbient, no art | 2 |
| **Dining room** (a customer is served) | `dining-01..06` | chandelier candles flicker (the hanging chandeliers at the top centre), the string lamps along the bottom twinkle, the fireplace if the stage has one, sun beams from the arched windows at the sides; guests and cash already move | RoomAmbient, FX-2 (candle) | 3 |
| **Restaurant map** (6 stages) and **Second Floor** | `map-*`, `second-floor.webp` | the warm string lamps along the edges twinkle; Second Floor machines: steam off the coffee machine, cold mist off the ice-cream machine, the pizza oven's glow, a screen flicker; the people already walk | RoomAmbient on the wide plan only, FX-1 (steam + cold mist), FX-3 (glow) | 3 |
| **Mini-game rooms** (9) | `game-*` | see section 4.1 | RoomAmbient, subtle | 2 |
| **Cutting scene** (Phaser) | the kitchen picture behind the board | NOT the CSS layer: the board covers the middle and the engine is busy. In-engine particles only: crumbs, juice, a flour puff, a sparkle on a Perfect cut (`boardDebris` already has crumbs) | Phaser particles, FX-4 (flour, droplet, spark) | 4 |
| **Story scenes** (5) | `story-scene1..5` | the oven fire, the sun shafts with dust, steam off the pots, a flickering lamp; the camera moves already exist (`CinematicIntro`) | RoomAmbient, FX-1, FX-2 | 4 |

#### 4.1 The mini-game rooms (keep them calm: the play area is never touched)

| Game | Picture | What moves |
|---|---|---|
| Sauce Station (mix and bottle) | `game-sauce-station-mix/bottle` | the window beam (right) with dust, copper pots on the shelf glint, a faint steam from the stove (left) |
| Stockroom | `game-stockroom` | the wall lamp (top left) breathes, the window beam (right) with dust |
| Fridge Sort | `game-fridge-sort` | the lantern (top left) flickers, a little steam from nothing is NOT drawn |
| Car Park | `game-car-park` | the garden lamps glow at the top, a few petals drift past the flowers |
| Dessert Run | `game-dessert-run` | the lanterns at the top flicker, the window beam (left) |
| Dishwashing | `game-dishwashing` | the window beam (left), a tap drip and its ripple in the sink, soap bubbles drifting up (FX-4) |
| Delivery Inspection, Fridge Check, Unload the Van | their own `game-*` | a window beam and a lamp each (anchors read when each is built) |

### Paper screens (no picture to animate): micro-motion, no art

These screens (Business tabs, Progress, Achievements, Inventory, the Market lists, Recipes) are paper cards. They get small, fast motion that tells the player something, never a loop that nags:

1. **Entrance:** cards fade and rise 8 px in a short stagger (40 ms apart) when a tab opens.
2. **Counting:** money, points and ranks count up to their value in about 600 ms when they change.
3. **Bars fill** from the old value to the new one with an ease, not a jump.
4. **A shine sweep** crosses an emblem, a medal or the trophy once every 6 to 8 s (prestige emblem, rank medal, branch badge, Rush Hour Hero).
5. **A new thing pulses** once: a fresh badge, an unlocked tab, a collectable achievement.
6. **A coin pop** when money is collected (the wallet chip bounces, 3 small coins fly): coin sprite from FX-5.
7. **A celebration** card gets confetti and a glow behind its emblem (FX-5): the card already exists, this only decorates it.

### Served dish (the Order ready and Served cards)

A gentle steam rises off the plate (FX-1) and a glint crosses it once when the grade is Perfect. It is the picture the player sees most: a high-value place for steam.

## 5. Phases

1. **Done:** the Kitchen home (v1.1), CSS only.
2. **Needs FX-1, FX-2, FX-3, FX-4:** painted steam on the Kitchen and the served plate, the burner and fire flames, the Market header, the loading screen's fire, the mini-game rooms' ambience (RoomAmbient generalised from `KitchenAmbient`, data per room).
3. **Map, Second Floor, dining room:** the machine effects, string lights, chandeliers.
4. **Paper-screen micro-motion** (no art, can start any time) and the **cutting scene's in-engine particles**, then the **story scenes**.

The order inside phase 2 that I recommend: painted steam first (it is the thing the developer called out), then the mini-game rooms (every player meets them early), then the loading screen.

## 6. Cost and risk

- Each room is a data table plus one test; the engine is written once. A room is about an hour of anchors-and-check work, most of it looking at the picture.
- **Risk:** motion on a low-end phone. Mitigation: the element budget, transform and opacity only, halved counts on a tall layout, the reduced-motion switches, and the developer's own phone check before anything ships.
- **Risk:** motion competing with play. Mitigation: rooms stay in the margins and the amplitude is low; the Kitchen's layer sits under every card and button.
- **Art:** five small sheets (section 3 of the prompts file), about 400 KB in all after cutting, lazy per screen. Nothing is needed for phase 4's paper screens.

## 7. What I need from the developer

1. Look at the Kitchen on a real phone and a real desktop window and say what to tune (steam size, lamp strength, push-in speed).
2. Run the Codex sheets FX-1 first (steam), look at one wisp, then the rest.
3. Say which phase-2 rooms to do first (my order is above) and whether the mini-game rooms should be animated at all while a round is being played (my default: yes, very low amplitude).
