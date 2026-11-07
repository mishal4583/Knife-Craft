# NPC REALISM PLAN (developer 2026-11-07)

Player reviews asked for the people in the restaurant to look and act more real: appearance, costumes, size, faces, male / female
identification, hair, walking and behaviour. Status 2026-11-07: the art is delivered and phases 0, 1 and the faces of phase 3 are built (see HANDOFF "NPC realism"); the path graph and behaviour of phase 2 are not. The Codex prompts are in
`NPC-CODEX-PROMPTS-2026-11-07.md`.

## 1. What the players see today (and why)

Every person on the first floor and the Second Floor is the same tiny SVG puppet (`restaurantMap/GuestPoses.tsx`, a 24 x 32 viewBox):

| Player complaint | Cause in the code |
|---|---|
| "Same people, no faces" | One body path and one head circle for everybody; no eyes, nose or mouth. Only `outfit` and `hair` are colours. |
| "Can't tell men from women" | No silhouette difference: same shoulders, same trousers, the hair is one cap-shaped path; no skirts, long hair, beards, glasses. |
| "Costumes" | Staff differ from guests by a coloured cap (`.floor-cap`); servers, cooks, cleaners, the cashier and the manager have no apron, tunic, blazer or tools. |
| "Too small" | `.floor-person` is `clamp(19px, 4.5vw, 30px)` wide, `clamp(25px, 5.8vw, 38px)` tall (about 38 px on a phone). A seated guest is half a table wide. |
| "Walking looks fake" | `timeline()` moves a person in straight lines between stops at one constant speed (`WALK_SPEED`); only the legs swing; nobody turns to face the way they walk; they cross tables and chairs because there are no paths; guests at the door stack on one another. |
| "Behaviour" | Guests loop through fixed CSS routes (`map-guest-party--solo / couple / friends`); staff walk a short loop with one bubble. No queue, no thinking, no reaction, no work animation (chopping, stirring, mopping, typing). |
| "Looks pasted on" | Flat colours with a hard black drop shadow on a warm, lit, painted scene; no light tint, no contact shadow, depth order not by y. |
| The named customers | The 12 regulars (Mara, Tobias, Priya, Oscar, Lena, Diego, Yuki, Amir, Rosa, Felix, Sana, Noah) are emoji (`👩`, `🧔`, `👵`) in the service card, so they have no face at all (`ServiceFloor.tsx`, `REACTION_FACE`). |

## 2. The fix in one sentence

Replace the puppet with **painted, animated character sprites** that match the game's art (and the existing staff portraits), give every
role and every guest archetype its own look, and give the people **paths, facing, speed and tasks**. Keep the old SVG as the fallback
when a picture fails to load (the same rule as the staff portraits).

## 3. Decisions

1. **Style.** Warm painted, the same look as the map and the `staff-portraits/` (copper, green aprons, cream tunics). A 3/4 top-down view
   like the map. Readable at a glance: big head, clear hair and clothes, no thin details that vanish at 60 px.
2. **Size.** Raise the on-screen figure to about 1.6 x today (about 62 px tall on a 390 px phone): `clamp(30px, 7vw, 46px)` wide. Per-look
   scale: child 0.78, elder 0.95, tall 1.05, so heights differ. Check at 320 x 568 to 768 x 1024 (no overlap that hides a table).
3. **Male / female identification.** Not by colour: by silhouette and costume. Women: long / bun / ponytail hair, dresses, skirts,
   blouses, earrings, bags. Men: short hair, beards and moustaches, shirts, trousers, caps. Both with several body shapes and skin
   tones. Staff keep the identities of their portraits (below).
4. **Faces.** Two tiers. (A) map sprites: simple, expressive faces (eyes, brows, nose, mouth) readable at 60 px; (B) **busts** for the 12
   named customers (six expressions) to replace the emoji in the service card. The bigger bust is where the facial design is detailed.
5. **Walk.** 4-frame walk cycles in 3 directions (down, up, side; left = the side view mirrored), a body bob and sway in CSS, a soft
   contact shadow, start / stop easing, a per-person speed (elder slower, child quicker), and facing that follows the route.
6. **Behaviour.** A small state machine per actor (section 6), still pure and seeded (no `Math.random()`), still decorative (no taps,
   no money, no save).
7. **Budget.** Sprites are lazy: loaded when the map opens. Target <= 70 KB per sheet, <= 2.4 MB for the whole cast (a QA check
   guards it). No animation library: CSS `steps()` on a sprite sheet and `transform` / `opacity` only.
8. **Identity continuity.** A staff sprite is made from its portrait (attach the portrait to the Codex request), so the person on the
   map is the person on the Staff card.

## 4. The cast (who needs a sprite)

Identities of the existing portraits (`public/business/staff-portraits/`): Cashier = young man, round glasses, holds a receipt; Cleaner =
man with a moustache, cloth; Floor Cleaner = woman with broom and dustpan; Floor Server = young man, bow tie, brown vest, cloche tray; Head
Chef = elder man, white hair and moustache; Line Cook = young man, dark hair; Manager = woman, glasses, green blazer; Prep Cook = woman,
curly hair, rust apron; Server = woman, curly updo, bow tie, brown vest; Asian specialist = man, navy apron; Indian specialist = woman, hair
bun, mustard apron; Mediterranean specialist = man, grey beard; Mexican specialist = woman, red bandana.

| Group | Who | Sheets |
|---|---|---|
| First-floor staff (11) | server (F), cashier (M), cleaner (M), line cook (M), prep cook (F), head chef (M, elder; also the intro's Old Chef), manager (F), Asian (M), Indian (F), Mediterranean (M), Mexican (F) specialists | A (walk, sit, carry) + B (6 work actions) |
| Second-floor crew (8) | floor servers 1-4 (2 F, 2 M), floor cleaners 1-4 (2 F, 2 M): so a bigger crew is not identical clones | A only |
| Named regulars (12) | Mara, Tobias, Priya, Oscar (elder M), Lena, Diego, Yuki, Amir, Rosa (elder F), Felix, Sana (hijab), Noah (boy) | A (the last row = guest actions) + a bust sheet each |
| Generic guests (8) | office worker F and M, student F and M, tourist F and M, a sporty M, an elder F | A |
| Props (1 sheet) | tray, plates, cloche, bag, mop and bucket, clipboard, bubble icons | one sheet |

50 character sheets + 12 busts + 1 props sheet. **Build in this order** (Codex budget): P1 = the 11 staff (A) and the 12 regulars (A); P2 = the
staff B sheets, 8 generic guests; P3 = the second-floor crew, busts, props.

## 5. Sprite sheet standard (every character)

- One transparent PNG per character, 1536 x 1024, **6 columns x 4 rows**, every cell 256 x 256, the character centred, the feet on the
  same baseline in every cell (y = 218), the head top near y = 28, the same scale in every cell, **no shadow, no border, no text, no logo**.
- **SHEET A** rows: (1) front view: walk x4 (contact, pass, contact with the other leg, pass), idle, seated; (2) back view, the same six;
  (3) side view facing RIGHT, the same six (left = mirrored by the game, so no one-sided text or badges); (4) guests: menu, raise hand,
  eating, drinking, delighted, annoyed. Staff row 4: carrying walk (side x4), idle carrying front, idle carrying side.
- **SHEET B** (first-floor staff only): six work frames for the role (cook: stir, flip, chop, garnish, taste, wipe brow; server: take order,
  place plate, clear plate, greet, call, bow; cashier: type, hand bag, count cash, scan, greet, thumbs up; cleaner: mop front, mop side,
  wipe table, spray, carry bucket, polish; manager: clipboard, write, phone, tablet, greet, arms crossed; head chef: taste, direct, inspect,
  stir, proud, wave).
- `scripts/make-npc-assets.py` (new, like `make-market-assets.py`) cuts the cells by their grid, trims, scales to the display size x 2
  and writes `public/people/<id>/a.webp` (and `b.webp`), a `manifest.json` with each look's id, gender, age, height scale, role, and the
  checks (6 x 4 cells, baseline, size budget).

## 6. Behaviour (what the people do)

Pure functions in `floorLife.ts` / `staffLife.ts`, seeded; every state is a pose from the sheets.

**Guests (both floors).** arrive (door) -> glance at the menu / board (thinking pause with a bubble) -> queue at the counter in a line (spacing
so they never overlap; the door queue is spread along the walkway) -> order (raise hand + bubble) -> wait (idle, some impatient: foot tap,
arms crossed) -> pick up the tray (carrying walk) -> walk to a free table by the **aisle path** -> sit facing the table -> eat (fork frames) -> a
reaction (delighted / annoyed, from the real service quality when the player is playing) -> leave through the door. Parties walk together
with a small stagger, regulars always use their own look.
**Staff.** server: greets, takes the order, carries the tray, places and clears; cashier: types, hands the bag, counts; cleaner: mops a
lane, wipes the table the guest left, carries the bucket; cooks: stir, flip, chop at their stations; head chef: tastes, directs, inspects a
plate; manager: clipboard rounds, greets guests at the door.
**Movement quality.** a path graph per kitchen stage (aisle nodes, the stage's `STAGE_SPOTS` plus the second floor's `FLOOR_SPOTS`) so nobody
crosses a table or a chair; shortest path over a tiny graph, computed once and seeded; the facing follows each segment; depth order by y;
speed variety (elder 0.8, child 1.15, adult 1.0); ease in and out at stops; a person who finds the next spot busy waits, not stacks.

## 7. Code plan (phases)

**Phase 0 (no new art, ships first, about 1 day): fix what is wrong right now.** Raise the size and add the per-look scale; draw people in
y order; turn the figure toward its walk (flip the SVG by the sign of dx); stop the door stacking (stagger and queue spacing); per-person
speed; a softer contact shadow and a warm tint to sit in the scene; seated guests drawn behind the table edge, not through it. Optional
stop-gap while art is made: SVG v2 with a skirt / trousers silhouette, long / short / bun hair, beard, glasses, apron and a simple face.
**Phase 1: the sprite engine (when the first sheets exist).** New `restaurantMap/CharacterSprite.tsx` (a sprite from `manifest.json`,
`background-position` + `steps()`, facing, pose, scale, fallback to `GuestPoses` on a load error), `FloorActor` gets `look` and `gender` in
place of `outfit` / `hair` (old saves unaffected: the cast is not saved), `GuestPoses` stays as the fallback. The cast picks a look by a seeded
rule (no two neighbours share a look; regulars fixed).
**Phase 2: behaviour.** Path graph, the guest and staff state machines, the carry and work poses, queue spacing, reactions.
**Phase 3: faces and props.** Busts for the 12 regulars in the service card (an expression per service quality) in place of the emoji; the
props sheet for trays, plates, bags and bubble icons.

## 8. Tests

- New `scripts/npc-sprites-qa.mts`: every look in `manifest.json` has its sheet(s); size budget per sheet and in total; each first-floor
  role and each regular has a look; the picks are deterministic and neighbours differ; both genders exist for servers, cleaners and guests;
  no `Math.random()`; the cast is not saved.
- Update `floor-life-qa` (cast shape), the first-floor staff-life QA (looks per role) and the map e2e screenshots (5 viewports, no
  sideways scroll, a person never hides a hotspot or a table).
- Browser check: a screenshot of each stage's first floor and the second floor, and a 20-second recording of a guest from the door to the
  table and out (no walking through furniture, a queue forms and clears).

## 9. Risks

- **Consistency of AI-made frames.** Walk cycles can drift between cells. Mitigation: a style anchor image attached to every request,
  4-frame cycles only, CSS bob for the rest, and the QA check that the baseline and scale are the same in all cells (reject a sheet that fails).
- **Weight.** 50 sheets is the heaviest asset set so far. Mitigation: lazy load, a per-sheet budget, WebP, only the looks on the floor right now
  are fetched.
- **Perception of "realistic".** At 60 px the face is tiny, so the bust tier carries the facial design. Say so in the update notes.
- **Representation.** Diverse skin tones, ages, body shapes and head coverings (Sana wears a hijab) are drawn with respect, as ordinary
  guests, never as a joke.
