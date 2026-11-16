# Dessert Run: plan and decisions (developer 2026-11-16)

Replaces `PLATING-BELT-PLAN-2026-11-15.md`. The developer played the Plating Belt on 2026-11-16 and said the rules
were not understandable, the art did not fit the other games and the mosaic did not look like a dish. They asked
for the mechanics of Ants Foraging: Color Dash, with waiters carrying the pieces of a dessert to the guests.
The playable demo and the plan were shown as a private artifact (https://claude.ai/artifact/FPBYT5nr2XdFDJXmwNvXLD).

## Decisions

1. The waiters RUN (tiny people on the aisle), not flying cubes.
2. A fixed dessert GALLERY by tier, never the menu's dish of the day.
3. The name is **Dessert Run**.

## Rules (all in `src/game/business/dessertRun.ts`)

- A dessert is a 24 x 24 mosaic of cubes on a plate. Five standby spots, 3 to 5 lanes of numbered waiters (only
  the front one is tappable). A tap sends it to a free spot. There it fetches, one at a time, the cube of its
  colour nearest the aisle that touches the outside; a runner takes it to the serving cart and on to a guest.
- Reachable = a cube with an empty 4-neighbour joined to the outside of the grid. A donut's hole counts only once
  a corridor has opened it. A waiter with nothing reachable waits and goes on by itself.
- Jam = every spot waiting (no waiter running, none can reach a cube, no tap can help). "Try again" is the same
  plate. No clock, no undo. Speed x1 / x2 / x4. Hold a waiter to light the cubes it can reach.
- Stars by the most waiters blocked at once: at most 2 = 3 stars, 3 or 4 = 2, 5 = 1.
- Tiers from Level 18 / 28 / 45 / 65: lanes 3 / 3 / 4 / 5, smaller waiters and longer chains higher up
  (`RUN_TIERS`: `min`, `spread`, `narrow`).

## Solvable: proved by replay

The deck is built by taking the dessert apart in a sequence that can always continue (the next colour is the one
with the fewest reachable cubes with chance `narrow`, otherwise by what is left). It is dealt into lanes in a
shuffled pattern that keeps every lane in deck order. Sending waiters in deck order usually wins, but the live rules
pick the nearest reachable cube at run time, so 5 to 10 % of seeds did not win on replay with the 7 to 8 colour
pictures. The seed generator keeps only seeds that win on time and with taps up to 4 s late, and `dessert-run-qa`
replays all 420 shipped plates. Careless play wins 70 / 65 / 30 / 10 % by tier.

## Gallery

Four mosaic pictures on a 28 x 28 grid, 500 cubes each (the whole plate disc): cookie on cyan and blue (tier 1),
donut on mint (1, 2), cherry cupcake on butter yellow (2, 3), strawberry ice-cream cone on lilac (3, 4). Built
like the developer's Colony Flow lily-pad reference, after three rejected tries (blobs; glossy "button" cubes; a
flat dessert alone on a bare plate). The rules of the look, from the developer's notes and the reference:
- the board is FULL: a two-tone background (light field, darker under a wavy line) with white splash bars, and the
  dessert sits on it with a navy outline one cube thick; the background and the outline are layers to peel;
- 5 to 9 colours, vivid; each shape a base plus a darker shade, and a one-cube light edge on the upper left;
- clusters only: sprinkles in pairs, glints in bars, never a lone cube;
- tiles have NO gap at all (developer 2026-11-17: "absolute zero gaps"): sharp-cornered squares snapped to whole
  device pixels, no edge lines, one small glint each (a hairline gap and a bevel were tried first and rejected).
`dessertGallery.ts` paints regions in order; the outline and the edges are worked out. The plan wants about twelve
desserts (chocolate cake, cheesecake, fruit pie, sundae, waffle, macarons, lemon tart next). Every new one needs a
painter function, a place in `DESSERTS_BY_TIER`, new seeds (`scripts/make-dessert-seeds.mts`) and a QA run (the QA
also checks the picture stays inside the plate's well).

## Art

Code draws the mosaic, the cubes, the numbers and the lit cubes. Codex painted the rest (see
`DESSERT-RUN-CODEX-PROMPTS-2026-11-16.md`); one magenta-keyed waiter is recoloured in the browser to the ten cube
colours.

## Still to do (nothing starts without the developer's word)

1. The developer plays `/?dessertRun=18` on a real phone and says whether it is fun and fair.
2. Then: the routine slot (Level 18+, alternating with the Car Park), rewards, the rewarded-ad skip, analytics,
   store text and screenshots, `belt_slot` in `public/playgama-bridge-config.json` (flag it), more desserts.
