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

## Solvable by construction

The deck is built by taking the dessert apart in a sequence that can always continue (the next colour is the one
with the fewest reachable cubes with chance `narrow`, otherwise by what is left). It is dealt into lanes in a
shuffled pattern that keeps every lane in deck order, so sending waiters in deck order always wins, while the
lane fronts can be far ahead of it. `dessert-run-qa` replays all 420 shipped plates in deck order, on time and with
taps up to 4 s late, on the real rules. A first version dealt round-robin and careless play won 95 % of every tier;
the shuffled deal and the `narrow` chains moved it to 100 / 65 / 38 / 25 % by tier.

## Gallery

Four desserts are built: cookie (tier 1), donut (1, 2), strawberry tart (2, 3), pancakes (3, 4). The plan wants
about twelve (chocolate cake, cheesecake, fruit pie, sundae, waffle, macarons, cupcake, lemon tart next). Every
new dessert needs a build in `dessertGallery.ts`, a place in `DESSERTS_BY_TIER`, new seeds
(`scripts/make-dessert-seeds.mts`) and a QA run.

## Art

Code draws the mosaic, the cubes, the numbers and the lit cubes. Codex painted the rest (see
`DESSERT-RUN-CODEX-PROMPTS-2026-11-16.md`); one magenta-keyed waiter is recoloured in the browser to the ten cube
colours.

## Still to do (nothing starts without the developer's word)

1. The developer plays `/?dessertRun=18` on a real phone and says whether it is fun and fair.
2. Then: the routine slot (Level 18+, alternating with the Car Park), rewards, the rewarded-ad skip, analytics,
   store text and screenshots, `belt_slot` in `public/playgama-bridge-config.json` (flag it), more desserts.
