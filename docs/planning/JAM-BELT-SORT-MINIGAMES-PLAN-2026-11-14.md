# Three games the developer likes, turned into KnifeCraft mini-games (plan, developer 2026-11-14)

The developer shared three pictures: a **pixel-picture conveyor game** (a coloured picture is filled by coloured shooters that ride a belt around it; five waiting
slots at the bottom), a **water sort** game (tubes of coloured layers, pour to sort), and a **car jam / parking jam** game (cars with arrows leave a crowded lot; each
car that leaves collects the waiting passengers of its colour; cars that do not match wait in a few spaces). They are the same wave the market data
showed (arrow / jam puzzles, conveyor-flow, sort). Nothing is built yet; this is the plan to approve.

The building rules are `docs/planning/MINIGAME-PRODUCTION-RULES-2026-11-14.md` (plain art first, a phone feel check before rewards or art, every level
solvable by construction, a mistake never blocks progress and a restart is one tap, one-tap retry, store text in the same release). Mini-games stay MANDATORY (never optional); the
hired Prep Cook can do a step with no stars, as for the others.

> **2026-11-15:** section A (Loading Dock, delivery carts) is replaced by the developer's own version, **Car Park** (guests' cars and a neighbour's in a shared lot):
> `docs/planning/CAR-PARK-MINIGAME-PLAN-2026-11-15.md`. Sections B and C below stand.

## 1. What makes each one work (the core loop)

| Game | The one action | Why it holds players | The pressure |
|---|---|---|---|
| Car jam | Tap a car: it drives out along its arrow if the way is clear | Pure "which first?" thinking, instant satisfying exit, no timer | A few waiting spaces; the queue wants a colour |
| Pixel conveyor | Pick which coloured shooter goes on the belt | The picture appears as you play; order matters; a clear end result | Five waiting slots; a shooter that cannot hit waits |
| Water sort | Pour one tube into another (same colour on top, or empty) | Calm, logical, every move reversible with Undo | Few empty tubes |

All three have **no clock**, a **small hand of waiting slots** as the only pressure, and an **Undo**. That fits a kitchen game that is played every business day.

## 2. How each becomes a restaurant mini-game

### A. Loading Dock ("Van Jam"), from the car jam. FIRST to build (it includes the Arrow Dock idea from the trends list)

- **The scene:** the yard behind the restaurant. Delivery carts and vans stand packed in rows, each pointing one way with an arrow and painted in a supplier colour
  (greens, meat, dairy, bakery, pantry, seafood). The **delivery door** is on the edge. The number of carts is the number of baskets in today's delivery
  (it grows with the prep batch, so the game scales with the restaurant).
- **The action:** tap a cart. If nothing blocks its arrow it drives to the door; if blocked it bumps with a small shake (no penalty, only the move count).
- **The queue:** along the door waits a line of order tickets in colours. A cart that reaches the door serves the head tickets of ITS colour (up to its load, 3-4);
  a cart that does not match parks in one of **five waiting bays**. A bay cart serves automatically when its colour reaches the head.
- **Win / stars:** the yard is empty and the queue served. 3 stars = no Undo used and at most 2 bays ever used at once; 2 stars = no jam; 1 star = finished with Undo.
- **Fair failure:** if all bays are full and the next move cannot free one, the yard is "jammed": one free **Undo** per round, then "Try again" (one tap, same yard). The
  rewarded ad "+1 bay" (`dock_bay`) is offered once, never needed.
- **Solvable by construction:** the generator builds the yard backwards (every cart is placed so its arrow path ends at the edge; the "blocked by" graph is
  acyclic), then a solver proves a win exists for the queue order within the bay limit; a QA suite proves it for 500 seeds per tier.
- **Difficulty (a table, like the other games):** carts 8 → 40, colours 3 → 6, bays 5 → 4 (late), blockers per cart 1 → 3, ticket order more mixed.
- **Where it sits:** the first step of the delivery routine: "Unload the van" before "Check the delivery" (the carts ARE the baskets).

### B. Plating Belt, from the pixel conveyor

- **The scene:** the day's special on a plate drawn as a **mosaic** (about 20 x 20 cells at the start, 36 x 36 late). A belt loops around it. Under it, a queue of
  coloured **scoops** (ingredient pieces: tomato red, herb green, cheese yellow...) each with an ammo number, and **five waiting slots**.
- **The action:** tap a scoop in the queue: it rides the belt around the plate and fills the nearest visible cells of its colour (only cells a scoop can reach
  from the belt, as in the original), then returns empty. A scoop with nothing of its colour reachable waits in a slot.
- **Win / stars:** the plate is complete. 3 stars = the belt never stalled (no full slots). The finished plate flashes as a real plated dish.
- **Mosaic source:** there are no per-dish photos in the project, so the mosaic is built from the dish's ingredient colours (the registry / Sauce Station
  colours) on a seeded plate shape (a bowl, a round plate, a bun, a pizza...). To verify first: that every dish has usable ingredient colours.
- **Solvable by construction:** the scoop deck is DERIVED from the mosaic (ammo per colour = cells per colour), and a solver proves an order that never fills the five slots.
- **Where it sits:** the rotating "service prep" slot (see 3), or the step "Plate the special" before opening.
- **Ad:** "+1 waiting slot" (`belt_slot`), once a day, never needed.

### C. Drink Bar, from water sort. LAST, and it needs a decision

- **The scene:** a bar counter with glass bottles of layered syrups / juices / sauces; pour the top layer onto the same colour or into an empty glass until each is one colour.
- **The honest caveat:** the market data says sort is crowded and cooling, and we already have two sort games (Fridge Sort, Stock the shelves). A third sort game risks feeling the
  same. It earns a place only with a reason of its own: a **Drinks Bar section** at higher levels (a new business area, new menu items), with the order tickets asking for
  layered drinks. That is new restaurant content, not just a mini-game, so it needs a decision (see 6).
- **Fair failure:** unlimited Undo, an "add an empty glass" rewarded ad (`bar_glass`) once a day, never needed.

## 3. Keeping the routine fun, not a chore

Today a business day is: Check the delivery, Fridge Sort, Stock the shelves, Fridge Check (closing), Sauce Station = 5 steps. Adding three more would be too many.

- The five stay. **One rotating "service prep" slot** is added (not three): service 1 = Loading Dock, service 2 = Plating Belt, service 3 = Drink Bar (once unlocked), repeat.
  So a day has at most 6 steps. Each step should take 45-90 s.
- It is mandatory like the others. The Prep Cook does it with no stars (`PREP_COOK_STEPS`), and the existing "skip this step" ad (`skip_step`, 3 a day) covers it.
- Unlock by level (a table): Loading Dock at about Level 8, Plating Belt about Level 18, Drink Bar about Level 35. Each arrives with Paige's how-to and a first-time guide card.

## 4. How it is built (the same pattern as the other mini-games)

| Piece | Loading Dock (the template for the others) |
|---|---|
| Pure rules | `game/business/loadingDock.ts`: `roundFor(save, level)`, tier table, the generator and solver, `finishRound`, `autoDock` (Prep Cook). No clock, no random. |
| State | `business.loadingDock` `{ rounds, best, stars, perfect, streak, howto, doneDay }` (optional, no migration). No money, no stock, no ledger entry; stars and Hype by the existing table. |
| Screen | `components/kc/inventory/LoadingDockGame.tsx`: the yard with CSS transforms (no animation library), pause card with Resume / **Restart** / Leave, Undo, a hint (a glowing cart that can leave, after 4 s idle), a "why 2 stars" line on the result. |
| Routine | `FlowStepId` gets `"dock"`; `flowSteps`, `PREP_COOK_STEPS`, `routineStepDone`, the "Before you open" sheet, the Pre-Service Check. |
| Praise | `miniGamePraise.ts` `PraiseGame` gets `"loading-dock"`: Paige praises 3 stars on the kitchen home page. |
| Analytics | `loading_dock_started / finished / skipped / auto` (stable names; `level`, `stars`, `moves`). |
| Tests | `loading-dock-qa` (solvable for 500 seeds per tier, no cycle, bay rule, stars, Prep Cook, save round trip), e2e `loadingdock.mjs` (tap a cart, a bump, a jam, Undo, Restart, 320 x 568 to 768 x 1024), updates to `difficulty-ramp-qa`, `delivery-flow-qa`, `paige` e2e. |
| Art | Phase 1: plain rounded rectangles and the existing icons. Later: about 8 painted top-down carts (rotated by CSS), a door, ticket tags. Codex prompts only after you have played it. |

The Plating Belt adds a mosaic grid (CSS grid or a small canvas) and the belt path; Drink Bar adds bottle components. Each is its own pure module, its own state, its own suite.

## 5. Order of work

1. **Approve this plan** and answer the questions in 6.
2. **Loading Dock prototype**: the pure module + QA + the plain screen, reachable from a debug route or the routine, nothing else. You play it on your phone.
3. Change the numbers until it feels good. Then the failure and restart rules, the "why" line, the hint, Paige's how-to.
4. The routine slot, the Prep Cook, the rewarded ad, the praise, the e2e, HANDOFF / REFERENCE / README rows.
5. Art (Codex prompts), then the store text with the release.
6. Repeat 2-5 for the Plating Belt. Decide the Drink Bar after both.

## 6. Questions for the developer

1. Start with the Loading Dock (my recommendation: the cheapest, the safest, and the car-jam style is the one in your pictures that has the most room for restaurant meaning)?
2. The rotating "service prep" slot (one extra step a day) as in 3, or a different place for these?
3. The Plating Belt's picture: built from ingredient colours (no new art), or do you want hand-made pixel pictures per dish (Codex, 221 dishes is a lot, so I suggest 12 plate shapes)?
4. Drink Bar: build only if we add a Drinks Bar section, or skip the water sort for now?
5. Look: keep the warm painted 2D style (top-down painted carts) or something more like the 3D-toy look of your pictures (more art work)?
6. Rewarded ads for "+1 bay / slot / glass": yes, as in the plan (each a new placement, once a day, never needed), or none for these?

## 7. Risks

- **Fatigue:** more steps = a longer pre-service. The rotating slot and the 45-90 s target keep it down; if the live `level_completed` / step-quit numbers drop, the slot becomes every second service.
- **A solver that is too slow or a yard that is too easy or hard:** the QA suites generate and solve in milliseconds; the tier tables are one place to tune after your phone test.
- **Phone fit:** the 40-cart late yard must still have 48 px-friendly carts on 320 x 568; the late tiers may need a scrollable or zoomed yard. Checked in the prototype first.
- **No real-phone test yet:** the feel of tapping and the cart motion can only be judged by you.
