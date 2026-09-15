# KNIFECRAFT
### Master Every Cut

**Complete Design Document — v6 (Final)**

---

# PART I — IDENTITY

## 1. What KnifeCraft Is

A **craft-mastery game wearing a cozy restaurant.**

You are the prep chef in a beautiful restaurant. You never cook, never serve, never run. You stand at one perfect cutting station, and everything the kitchen produces begins with your knife. The restaurant lives around you — and over weeks and months, it lives *because* of you.

**Reference points:**
- **Fruit Ninja** is destruction; KnifeCraft is *precision*.
- **PowerWash Simulator / Unpacking** proved meticulous, low-stakes work is its own reward.
- **Celeste / Rhythm Heaven** proved that teaching a skill kindly creates devotion.
- **Animal Crossing / Spiritfarer** proved that tiny wordless stories create enormous attachment.

## 2. The Governing Principle: Calm Mastery

> **The game never punishes. It only rewards more.**
> **And the game never compares you to a standard — only to yourself.**

| Player type | What they experience |
|---|---|
| Casual / ASMR player | Every cut sounds and looks great. No fail states. The restaurant slowly comes alive. |
| Mastery player | Personal bests, deltas, replay overlay, Master tiers, Chef's Signature, a mentor's rare approval. Depth is *available*, never *demanded*. |

A messy cut and a perfect cut both produce a satisfying result. The perfect cut simply produces *more* — richer sound, brighter atmosphere, a green +3%, faster story progression. Nothing is ever taken away. The floor is "pleasant." The ceiling is "sublime."

## 3. The Quality Bar: The Satisfaction Engine

This is not a feature. It is the bar every feature must clear:

> **"That looked and sounded so good… let me prepare one more dish."**

Every ingredient, knife stroke, sound, animation, and plate is tuned until it produces that sentence. Retention comes from the act of cutting being enjoyable in itself — not from leaderboards, currencies, or daily rewards. Any feature that doesn't serve this feeling is cut; any tuning pass that doesn't strengthen it is repeated.

## 4. The Golden Loop

Every 30–45 seconds, the player experiences:

**Swipe → instant satisfaction → small improvement → beautiful payoff → "I'll do one more."**

The player's brain should always be thinking: *"I know I can make that slice cleaner."* Everything else in this document exists to support that thought.

## 5. Strategic Position: A Routine, Not a Game You Finish

Most cooking games reward recipes. KnifeCraft rewards **routine** — the game people play while drinking their morning coffee. Five minutes of preparation, not because of coins or events, but because it's relaxing and something in the restaurant is always quietly in motion. The same defensible niche that made Wordle durable: a small daily ritual, never a grind.

## 6. Platform Emphasis (Deliberate)

Same game, same systems — different foreground:

- **YouTube Playables (Phase 1) → Mastery leads.** 30–90 second sessions. Hook: *swipe → instant feedback → "+3%" → one-tap retry.*
- **Android / iOS (Phase 2–3) → Cozy leads.** 3–10 minute daily sessions. Hook: *my restaurant is alive, and it grew because of my hands.*
- **Steam (future)** → the full cozy-mastery experience.

---

# PART II — THE CORE GAME

## 7. Core Loop

**Playable (30–90s):**
Order appears → ingredient on board with glowing guides → cut → plating animation → Result screen → **[Prep Again]** or **[Next Recipe]**

**Mobile (3–10 min):**
Morning Prep → several recipes → Kitchen Spirit ticks up → a story beat may advance → session ends on a plated dish, never a menu.

**The replay unit is the recipe. Retry is one tap, zero load, zero menu.**

**Session structure (mobile framing):** the same content presented as a restaurant day rather than a lesson list — *Daily Prep → Chef's Choice → Practice → Master Challenge.* Identical recipes underneath; the presentation makes it feel like working in a kitchen, not clearing a level select.

## 8. Controls

One finger. Swipe. Nothing else. The knife follows the finger.

**REVISED (Phase 1B — Tap-Primary Cutting):** one finger, **tap** — a tap anywhere on the ingredient produces a clean, perfectly horizontal cut through that point. Swipe survives as an optional expressive layer (angle-snapped, never scored differently). Neither input is the "skilled" one.

**REVISED (Phase 2 — device testing):** **swipe is the primary verb; tap is the accessible fallback.** Identical scoring is non-negotiable, but the polish budget (knife performance, traversal, foley) follows the swipe. Tap gets a clean chop and the same beautiful result.

**Portrait orientation.** Cut guides are horizontal or diagonal wherever possible — the board layout must respect the thumb.

## 9. Knife Feel (50% of the Game)

The knife must feel **physical**: slight resistance entering the ingredient, velocity, weight, momentum, glide on exit. Players should enjoy cutting even if nothing else existed. This is the single largest tuning investment in the project and the first thing built.

**ADDED (Phase 2 fix pass — Cutting Happens During the Stroke):** separation resolving only at release meant a slow stroke dragged a blade across whole food — the traversal read as a gesture being *recorded*, not a cut being *made*. The seam now opens progressively under the blade during the stroke (leading the finger to the blade's belly, since the edge cuts, not the heel) and full separation continues from wherever the score reached — never restarting. Supporting rules: the blade lifts 4px and levels as it leaves the food; board impact travels along the cut normal, so vertical and horizontal cuts land differently; a tap chop anchors the blade **heel** at the tap point rather than centring the knife on it; and stroke velocity decays toward zero when movement stops, so a paused stroke can no longer finish gently while sounding fast and blurring hard.

**BUGFIX (Phase 2 — Blade Direction):** device testing showed the blade shaking, mirroring mid-stroke and swinging in from horizontal. Five separate causes: travel direction was measured over a 3-sample window (sampling noise, not intent — now a 24px distance baseline); the edge-down wrap at ±90° let the smoothing take the long way round on near-vertical strokes (now the equivalent angle nearest the current rotation); `dirSign` was recomputed from that noisy vector on every event, mirroring the knife on jitter (now latched, flipping only on a true reversal); rotation initialised to 0, so every swipe began horizontal and swung into line (now snapped to travel direction on entry); and the blade was drawn centred on the pointer, putting the cutting edge ~11px off the seam (now offset in the blade's local frame, so the **edge** rides the cut line in both verbs).

**BUGFIX (Phase 2 — The Partition Must Never Drop a Piece):** piece existence was decided by whether a 7px sample grid happened to hit the region, so a sliver thinner than the grid was silently discarded — the seam still drew but nothing separated (partial cuts), and the missing region showed board through the ingredient. Existence is now analytic: walk the new cut inside the parent region, and if any point on it is interior, **both** children exist regardless of thickness. Grid sampling only supplies centroids; a sliver's centroid is the crossing segment's midpoint offset along the cut normal. Uncrossed pieces are left whole instead of re-measured. 6+6 crossing cuts: 49/49 pieces at ~6ms per cut (was 48/49 at ~62ms).

## 10. Technique Selection: The Guides ARE the Instruction

No technique picker, no auto-recognition (auto-detection misfires — a sloppy slice reads as a dice attempt). The recipe places each ingredient on the board with its guides already glowing:

**REVISED (Phase 1B — Tap-Primary Cutting): guides are removed from slice mode.** The objective is a count ("Slice ×6"); the player chooses every cut position — a template contradicts player-chosen spacing. An optional graphite ghost line (1px, never golden) previews the cut under the finger before release. The guide-pattern table below is retained as the future gesture vocabulary for techniques (Phase 4: row+column taps for dice, rapid taps for mince); free technique choice belongs to Zen mode, not recipes.

| Guide pattern | Technique |
|---|---|
| Horizontal parallel lines | Slice |
| Grid | Dice |
| Dense thin verticals | Julienne |
| Rapid short ticks | Mince |
| Curved dotted path | Fillet |
| Radial segments | Wedges |
| Concentric marks | Rings |

Multi-technique recipes sequence ingredients: tomato (slice guides) → done → onion (grid guides) → done. No modes, no ambiguity — and the patterns silently teach real culinary vocabulary.

**Full technique unlock order:** Slice → Dice → Julienne → Wedges → Rings → Mince → Brunoise → Chiffonade → Fillet → Butterfly → Decorative.

## 11. The Knife Engine

Every swipe records **x, y, t** at input-event resolution.

### Three metrics. Exactly three.

| Metric | Question | Computation |
|---|---|---|
| **Accuracy** | Did the cut follow the guide? | Sample the swipe path at fixed intervals; perpendicular distance to guide. Score = f(mean deviation, max deviation) — mean rewards closeness, max catches the one big wobble. |
| **Consistency** | Are the pieces even? | Standard deviation of gap widths between adjacent cuts, normalized to ingredient size. |
| **Rhythm** | Steady pace? | Variance of inter-cut time intervals. |

Every metric answers *"what do I do differently next time?"* Any proposed fourth that can't is rejected.

### The Grade Ladder

| Overall | Grade |
|---|---|
| 95%+ on all three metrics, one recipe | **Chef's Signature** (see §14) |
| 95%+ | **Masterful** |
| 85–94% | **Clean** |
| 70–84% | **Honest** |
| 50–69% | **Rustic** |
| <50% | **Learning** |

"Learning" is the philosophy in one word: the lowest result is a direction, not a verdict. Even a Learning-grade tomato plates beautifully — home-style rather than refined.

### Tolerance Design

Tolerances are **wider than realistic** — real julienne is sub-finger-width on a phone. The player feels the *fantasy* of fine knife work; the math quietly forgives touchscreen physics. Julienne grades primarily on consistency, not absolute thinness.

**REVISED (Phase 1 revision — supersedes raw-path rendering): Intent-based cutting.** *The cut is always beautiful. The grade is a whisper.* The swipe is least-squares fitted to a line; the render blends that fit toward the guide by an error-tapered assist (near-perfect swipes ≈ no correction; poor swipes rescued; separate offset/angle weights; mouse/trackpad gets more assist than touch). Wobble is never rendered. Geometry guards enforce a minimum gap between cuts (nudge, never reject) and make crossing cuts impossible; a badly missed swipe still lands a clean cut on the nearest guide — no dead input. Grading: Accuracy = fitted-line deviation (position + angle) from the guide; a gently-weighted smoothness term (≤ ~15%); Consistency measured on RENDERED gaps; all bands widened — target distribution for a relaxed player is mostly Clean/Honest, Learning near-unreachable. The Knife Replay shows the fitted intent line, not raw jitter — it teaches aim, not tremor. Curved/decorative cuts later use a fitted arc, same principle.

**REVISED AGAIN (Phase 1B — Tap-Primary Cutting, supersedes the above where they conflict):** *The player decides WHERE the cuts go. The game guarantees they are beautiful. The grade only ever whispers about spacing and rhythm.* Tap = clean horizontal cut through the tapped point; no guides, no aiming, no failure; taps off the ingredient are silently ignored. Swipes are fitted (curvature structurally impossible) and angle-snapped: within ANGLE_SNAP_DEG (12°) of horizontal → exactly horizontal; blended toward horizontal by ANGLE_PULL (0.7) up to ANGLE_FREE_DEG (30°); steeper is deliberate and preserved. The cut passes through the swipe's midpoint — chosen height respected exactly. Swipe speed drives audio/visuals only, never the grade; taps and swipes score identically. **Metrics: Evenness** (gaps vs the ideal even division for the required count — replaces Accuracy), **Consistency** (stddev of RENDERED gap widths), **Rhythm** (interval variance, floor 35). Guards: MIN_GAP nudging (crossing impossible), edge cuts nudged inward (no slivers). Grade ladder and band widths unchanged; target distribution: mostly Clean/Honest, Rustic rare, Learning near-unreachable.

**REVISED (Phase 1C — Rhythm Rebalance + Axis Freedom):** Measured play showed rhythm-as-metric punished deliberate placement and rewarded spam, violating §2. **Rhythm is now bonus-only**: overall = weightedMean(Evenness, Consistency) + RHYTHM_BONUS_MAX (0.10) × rhythmQuality — it can only add, never subtract; the floor is gone (moot); the breakdown shows "Rhythm +7", never a percentage. **Axis freedom:** swipes snap to the NEAREST of 0°/90° (same 12° window and 0.7 pull around whichever axis is nearer); deliberate diagonals beyond 30° stay as drawn; taps cut along the objective's CUT_AXIS ("Slice ×6" = horizontal; future objectives may request vertical); evenness/consistency measure along the active axis. Same-axis cuts can never cross (MIN_GAP nudging); cross-axis cuts may — that is dice. Pieces are a half-plane partition of the silhouette: both sides of every cut always exist (including polar caps), and pieces separate radially by SLAB_OFFSET_PX.

**REVISED (Phase 2 — Nearest-Axis Snapping):** every stroke snaps to the nearer of the two axes by dominant direction — a vertical swipe cuts vertically, a horizontal one horizontally, a 45° stroke resolves to whichever axis it leans toward, and exact ties go to the recipe axis. The old 30° free window was a cliff the player could not see or feel (29° snapped, 31° did not), so it now sits behind a per-recipe `FREE_ANGLE` flag (default off) for decorative techniques. Slicing cannot be done "wrong". Cuts on both axes may coexist; only same-axis cuts are kept from crossing.

**REVISED (Phase 2 — Cut At Any Angle):** the axis model was a limitation, not a design. Cuts now land at whatever angle the stroke was made, and cuts more than 10° apart in angle may cross freely — an X, a fan, a star are all legal work. Only near-parallel cuts (within 10°) hold a minimum gap apart, because those are slices of the same set. Straight strokes still snap: within 12° of an axis reads as "straight," 12–30° is partially pulled, past 30° is left exactly as cut. Two supporting rules follow from it: a conflicted cut is moved to the nearest free position and never has its angle flattened (silent flattening was the cause of the "unpredictable direction changes"), and if no position clears the gap the stroke is refused outright rather than stacked on an existing line. The objective counts cuts, not axes — `count` cuts completes the recipe and the board stays live for extra work up to `MAX_CUTS`.

**REVISED (Phase 2 — Grading Parallel Sets):** spacing is measured within each set of parallel cuts, perpendicular to that set's direction, and the sets are weighted by cut count. Measuring against a fixed axis made diagonals meaningless (cuts through the centre all read as zero gaps, so a clean star scored 0/0). A fan of single cuts at distinct angles is graded on placement rather than spacing.

**BUGFIX (Phase 2 — Every Worked Axis Is Graded):** the scorer filtered cuts to a single axis, so cuts on the other axis were dropped from the spacing metrics. Six deliberately uneven cuts on the unscored axis left one gap with zero variance and reported **Masterful 100/100** — the highest praise for the least careful play, which inverts §2. Grading one axis also let a clean pass hide a sloppy one (6 even + 6 chaotic scored 100/100). Now every axis carrying **two or more** cuts is graded and the results are weighted by cut count: that run scores 50/50. A single stray cut carries no spacing information, so it sits out rather than being punished. `gradeInfo` records the dominant `axis` (the replay overlay draws its ideals there) and `offAxis`, the cuts not counted. Permanent regression: `__kcTest.metricSpread(verb)` runs near-perfect / uneven / chaotic patterns on both axes and both verbs — the six overalls must match across axes (100 / 71 / 10).

**REVISED (Phase 3 — Free Angle Is The Default):** angle and evenness are independent, so `Slice ×6` now allows any direction. Six parallel cuts at 40° that divide the ingredient evenly score exactly what six horizontal ones do — verified at 0°, 90°, 28°, 40° and 60°, all Masterful 100. Two rules had to change for that to be true:

- **The assist tapers instead of pulling.** The old ladder flattened 70% of any angle between 12° and 26–30°, so a deliberate 30° stroke landed at 10°, and then jumped to full freedom one degree later. The pull now decays linearly to zero by `ANGLE_FREE_DEG` (26°): ≤12° still snaps square so casual straight cuts stay tidy, 18° keeps about half of its angle, and anything from 26° up is exactly as drawn. Continuous at both ends — no cliff the player can feel but not see.
- **The usable band follows the angle.** Placement clamped every cut's intercept to the *horizontal* band, which squashed steep cuts onto the band edges and cost evenness for an angle the player chose (a perfectly spaced 40° run scored 93 instead of 100). `interceptBand(axis, slope)` now expresses the same perpendicular span the scorer measures as an intercept range, so placement and grading agree by construction. Flat cuts keep the original band, bit for bit.

The knife replay draws its gold ideals along the direction of the set the player actually worked — horizontal guides over diagonal cuts teach nothing — and the Perfect Slice targets the same angle-aware division points.

**SUPERSEDED (Phase 3 — the recipe is a loop):** the Phase 2 clause above, "`count` cuts completes the recipe and the board stays live for extra work up to `MAX_CUTS`", no longer holds. The `phase` machine ends the cutting phase at exactly `count` (§0): there is no headroom, no extra-cut regrade, and no `MAX_CUTS`. A stroke after the count is refused with a named reason (`not-cutting (phase sequence)`), never silently swallowed.

**SUPERSEDED (Phase 4A — both flags are now in use):** the cleanup-pass note above called `SINGLE_AXIS` and `FREE_ANGLE: false` "live, currently unused". `FREE_ANGLE: false` shipped briefly for dice and was then retired again — see §49: **every** shipped recipe is free-angle, and direction is set by the player's first cut rather than by a flag. `SINGLE_AXIS` remains in CONFIG as a hard lock for a future strict technique, still used by nothing.

---

# PART VI-A — PHASE 4A: INGREDIENTS AND TECHNIQUES (BUILT)

## 47. The silhouette API — why a capsule needs no new code

Every ingredient answers the same three questions and nothing else in the game asks a fourth:

| | question | used by |
|---|---|---|
| `inside(g,x,y)` | is this point in the food | taps, stroke rejection, crossing test |
| `spanX(g,y)` / `spanY(g,x)` | how far does it reach across at this height | seams, ghost line, replay, particles, centroids |
| `trace(path,g,pad)` | what is its outline | piece clipping (cached `Path2D`) |

Three shapes implement it: `ellipse` (tomato), `capsule` (cucumber — a barrel of radius `capR` swept between two centres), `taper` (carrot — crown radius easing to a tip, both ends rounded, x-extent scanned because it is not symmetric along its length). The partition, grading, plating and replay were rewritten to ask the silhouette instead of assuming an ellipse; **no per-shape branch exists outside `SILS`**. All three share `cx/cy`, which is what lets cut intercepts stay comparable when a recipe swaps ingredients mid-run.

The carrot's two ends are deliberately unlike each other: the crown is a **flat cut face** (`buttRound` 0.16 — a short bevel, because the carrot arrives topped), the tip is a **real point** (`rSmall` 10, `tipRound` 3.4 — a long run-out, not a wedge). Taper ratio 0.179. Ridging is a suggestion, not corrugation: 10 strokes at alpha 0.09. Verified live on the Free Cut carrot; all six recipes hold exact piece counts and Masterful at 100 after the change, and `julienneDirs.diagonal40` — the one direction whose `support()` shrinks with a thinner tip — stays at 11 pieces, 0 refusals.

Long thin shapes are the stress case. A cut near the carrot's tip crosses only a few px of food; piece existence is decided analytically (`crossSegment` walks the seam inside the silhouette), never by whether a sample grid happened to hit — so the tip still yields two separated pieces instead of a dropped sliver.

## 48. The three ingredients

| | Tomato | Cucumber | Carrot |
|---|---|---|---|
| shape | wide ellipse, 5 lobes | capsule 412×104, skin/flesh two-tone | taper 420 long, r56→r10, ridged |
| resistance `[k,drag]` | .75 → .30 → .10 → .15 → .40 | .40 → .16 → .08 → .12 → .22 | .95 → .62 → .10 → .14 → .30 |
| feel | skin resists, then glides | light, crisp, quick clean break | rigid entry, sharp snap partway |
| entry transient | 550–2800 Hz, Q 1.2, 6/14 ms attack, 50 ms | 900–4400 Hz, Q 1.9, 3/7 ms, 34 ms | 1500–5400 Hz, Q 2.6, 2/4 ms, 26 ms |
| body | lowpass 380+900v, Q 0.9, tail 240 ms | **bandpass** 1500+1700v, Q 1.1, tail 95 ms | lowpass 460+520v, Q 1.4, tail 58 ms |
| board contact | 95→50 Hz, gain .40 | 128→78 Hz, gain .30 | 72→40 Hz, gain .52 |
| particles | seeds + juice, g 900 | pale flecks, wet .35, g 840, 0.6× count | hard fragments, no juice, g 1150, **bounce .34** |

The sound stays fully synthesized (§32): differentiation is filter type and centre, transient length, tail and board pitch — no asset files, payload unchanged. Wet/soft, bright/dry, hard/short/dense is the whole ladder, and it is why the ears test can be passed with eyes closed.

## 49. Techniques: dice and julienne

Both reuse the cut engine; only the objective, the direction policy and the grading emphasis change. **Both are free-angle.**

**The first cut sets the direction.** An axis lock contradicted the free-angle principle: julienne wants cuts parallel to *each other*, not to a direction the game picked in advance, and a grid wants two *perpendicular* sets, not two fixed axes. So:

- Cut 1 of a set is placed exactly as drawn — any angle, with the existing nearest-axis snap assist for strokes close to horizontal or vertical.
- Cuts 2..n inherit that direction and keep the position the player chose along the perpendicular (`dirSnap`, gated by `JULIENNE_PARALLEL_SNAP`). A tap has no direction of its own, so it follows the set too.
- Dice is the same rule with two directions: cut 1, and its perpendicular. Each stroke joins whichever of the two sets it was aiming at; when one set is full, strokes go to the other.
- `SINGLE_AXIS` stays in CONFIG as a hard lock for a future strict technique. **No shipped recipe uses it.**

**Julienne** — ten cuts, one set, per-recipe overrides rather than global changes: `evennessTol 1.9` (from 1.2), `consistencyCvTol 1.5` (from 0.9), weights **Evenness 1 / Consistency 2** — fine work is judged on repeatability, not on hitting an ideal grid. `minGap` 11 (global 18).

**Dice** — `counts: {h:3, v:3}`, two perpendicular sets, 4×4 = 16 pieces. Both sets are graded (each parallel group weighted by its cut count, as built in Phase 2). The HUD shows **one pip row per set**, so two directions of progress read wordlessly. Grading is unchanged: spacing is measured perpendicular to each set's own direction, so it never knew about axes to begin with.

### The constants yield to the direction

Free direction exposed two fixed numbers that silently assumed a wide band. Cutting a carrot across its narrow way leaves ~93px of room instead of ~357, and ten cuts there need 8.5px spacing:

- **`MIN_GAP_PX` / the recipe's `minGap`** capped at `GAP_CAPACITY_FRAC` (0.7) of the ideal spacing for *this* direction, floored at `MIN_GAP_FLOOR_PX` (6) where two cuts stop reading as two. Without it, four of ten cuts were refused for "no room" at positions the game itself calls ideal.
- **`EDGE_MARGIN_PX`** capped the same way. Reserving 12px of edge in an 8.5px-spacing band pushed the outermost ideal cut outside the placeable band — a refusal at an ideal position.

Wide directions never reach either cap, so every established score is untouched. The principle: a direction the player chose must be able to *hold* the recipe; refusing the direction would contradict free-angle, so the constant gives way instead.

**Coverage is measured along the stroke's own line** (`cutChord`), not along an axis-aligned span. A steep diagonal near a thin shape's edge barely spans either axis while fully crossing the food; the old test read that as uncovered and demoted the stroke to a tap that landed off the ingredient.

The carrot's `support()` scans its outline and keeps the smaller reach, because a taper is not symmetric along its length — otherwise an angled set places cuts past the tip that split nothing.

## 50. The five MVP recipes and the stage model

A recipe is a **list of stages**, so a three-ingredient prep is not a special case: recipes 1–4 have one stage, Garden Prep has three, and the same code path runs both.

| # | recipe | ingredient | technique | plate |
|---|---|---|---|---|
| 1 | Tomato — Slice ×6 | tomato | slice, free-angle | fan |
| 2 | Cucumber — Slice ×8 | cucumber | slice, free-angle | shingle |
| 3 | Tomato — Dice 3×3 | tomato | dice, perpendicular sets | mound |
| 4 | Carrot — Julienne ×10 | carrot | julienne, parallel set | nest |
| 5 | Garden Prep | all three | slice → slice → julienne | garden |
| 6 | Free Cut | rotates | nothing constrained — any direction, cross cuts | follows ingredient |

**Free Cut** is the recipe that fixes nothing. Every other one constrains something: slice is free-angle but never reaches the carrot, dice holds a grid, julienne holds one set. Here `FREE_ANGLE` is on and no snap of any kind is set — six cuts in any directions, crossing sets included — and the existing parallel-group scorer already handles it: each set graded on spacing perpendicular to its own direction, weighted by cut count. The ingredient rotates through tomato → cucumber → carrot on arrival (never on `[Prep Again]`; a retry is the same plate again, not a different vegetable) and the plating style follows it. It needed no new mechanic — only a stage that declares nothing.

Stage lifecycle: cuts complete → the stage is graded and its pieces **stamped** (source ingredient, set angle/axis/slope, plating style) → they slide off the board into `harvest` → `handoff` (300 ms, input closed) → the next ingredient enters. After the last stage every piece — harvested and current — is plated together in one arrangement. The recipe's score is the stage grades weighted by cut count; Chef's Signature reads the combined numbers, so its threshold is untouched.

Each recipe keeps its own `best.<recipeId>`; `[Next Recipe]` advances 1→2→3→4→5→1.

## 51. Plating per ingredient

The cascade already stepped along the cut's own normal, so it generalized; the other three arrangements are new and each is one function of the same shape (`list, zone, refinement → x/y/rot`):

- **fan** (tomato) — unchanged cascade along the set's normal.
- **shingle** (cucumber) — a climbing row of discs; overlapping, deliberate, never a stack.
- **nest** (julienne) — batons roughly aligned on a −24° line with alternating cross offsets: a loose bundle.
- **mound** (dice) — a tight grid cluster with per-piece scatter.
- **garden** (Garden Prep) — three zones on one plate: cucumber shingled top-left, tomato fanned top-right, julienne nested bottom-centre.

**Every arrangement is fitted to the ceramic afterwards** (`plateFit`). A piece's long axis runs *along* its set's cut direction, so its length is the ingredient's reach in that direction — 210px for a carrot cut crosswise, 56px cut lengthwise — and no arrangement knows that. The targets are measured against the rim and, if anything overhangs, positions and pieces are scaled by the same factor about the plate centre: exact in one pass, composition unchanged. Directions that already fit (every axis-aligned slice recipe) get a factor of 1 and are untouched. Without it a horizontal julienne threw ten full-length ribbons across the board like spilled sticks.

Two things make the combined plate work. The ceramic is now a **fixed** ellipse (`PLATE_RX/RY`) instead of a multiple of the ingredient's own radius — a 412 px cucumber would otherwise have drawn a plate wider than the board. And a zone scales the **pieces** as well as the arrangement (`ps` ≈ 0.55): packing three ingredients tighter is not enough, full-size slices collide. Pieces ease to plate scale during the flight, so it reads as depth rather than a pop. `platingRefinement` still drives tightness from Evenness, and every arrangement stays appetizing at Learning grade. `regress()` asserts plate containment per recipe and per julienne direction — grades and piece counts never caught a piece hanging off the plate.

The chime ladder climbs **within each ingredient**, so a three-ingredient plate lands as three ascending phrases rather than one run off the top of the scale. The stagger compresses for large plates (`PLATE_STAGGER_SPAN_MS` 900) so a 17-piece plate does not out-stay a 7-piece one.

## 51a. One physical scale for the whole roster (REVISED — real-world sizes)

Thirty-nine ingredients were authored one at a time, each in its own px space, so the roster had no shared sense of size: a watermelon filled **87%** of the board while a kiwi filled 48%, and the plate then shrank whatever did not fit. Six watermelon slices arrived as scraps beside two full-size peach halves — a cut peach piece could out-measure a whole watermelon serving.

The first normalization pass fixed the *relative* sizes with hand-authored board fractions (`SCALE_TARGETS`), and left the roster reading uniformly **small**: every number in the table was a guess about the screen, so nothing in it could be checked against anything, and a `min(…, 1)` cap meant no food was ever allowed to grow.

**REVISED — the table is real centimetres.** `REAL_CM` holds the dimensions of the actual food, LONG × SHORT, whole and untrimmed, as a grocer hands it over: tomato 8×7.5, cucumber 21×5, carrot 19×3.6, watermelon 32×22, celery 30×12, radish 6×3, kiwi 7×5. A bunch is listed where a bunch is what you cut (celery, grapes, parsley, asparagus, spinach, beans, pods). Two concessions to the board: the baguette is a demi (a 65cm loaf cannot lie down) and the pineapple's 33cm includes its crown.

**One number turns centimetres into this board.** At `PX_PER_CM` 22.5 the 496×748 board *is* a 22 × 33 cm cutting board — a board a real person owns — so a 10cm food lands at **true size** on it. Away from that reference true scale and playability disagree: a 3cm radish beside a 32cm watermelon is one tenth of it, and a tenth of a board cannot hold six cuts. `SIZE_GAMMA` 0.5 compresses the spread around the reference (square root), so the order is never violated and every ratio survives, just gentler — watermelon at 0.56× life, radish at 1.29×, and the watermelon still reads four times the radish. Two numbers move all thirty-nine together; there are no per-food multipliers.

The fit is **orientation-free and area-based**: the food's long extent against the target's long, short against short, `k = √(tl·ts / al·as)`. This retires both special cases the fraction table needed — the elongation swap (a mango is painted standing, a celery lying; asking whether the *box* was wide or tall only re-derived that, and got fennel — drawn square, grown tall in life — wrong both ways) and the square-box-against-a-long-root exception. The geometric mean also absorbs the gap between an authored aspect and the real one, where the old `min()` turned every aspect mismatch into a silent shrink. Result: **k now ranges 0.52–1.28** where it used to top out at 0.80, and the whole roster grew 1.3–2.2×.

Three rules the table alone could not express:

- **No food may crowd the board out.** `SIZE_MAX_W` 0.90 / `SIZE_MAX_H` 0.62 clamp the fit — the knife needs the margins. Widest is celery at 0.77 W, tallest watermelon at 0.43 H.
- **An off-centre bias must not walk off the board.** Celery sits left of centre so its leaf crown has room, which was self-correcting while every `k` was below 1 and pulled it *toward* centre. At `k` 1.28 the same bias pushed its silhouette 11px past the left edge. The body is clamped back onto the board after scaling — inward only.
- **Art is not scaled, but its resolution follows `k`.** `ing.art` keeps the authored geometry, the painters draw into a sprite at that size, and the blit maps the art box onto the scaled one — so a stem, taproot or leaf crown drawn at absolute px moves with its body. Now that the blit *enlarges*, a fixed 2× supersample would be magnified back below 1:1 and read as a soft photograph of a small drawing; `spriteSS` scales the supersample with `k`, capped at 4×.

**The plate now arranges; it no longer redefines how big food is.** Arrangement spacing is a multiple of the piece (`pieceStep` — the ingredient's extent across the cut direction over the piece count *is* a piece's thickness), so a fan holds its character dressing ten carrot batons or two peach halves. `plateFit` answers crowding in one order: compress the composition about the plate centre so the piece centres sit inside the serving zone (`PLATE_ZONE` 0.74, down to `PLATE_POS_MIN`) — the pieces keep their size and overlap more, which is what a plated portion does — and only if a single piece still reaches past the rim does a serving trim shrink pieces, floored at `PLATE_SERVE_MIN` 0.85.

**The ceramic grew with the roster** (`PLATE_RX/RY` 224×172, was 196×150): at `PX_PER_CM` it is a 20cm side plate rather than a 17cm saucer. Left at its old size under food half again as big, a watermelon shingle hung 5% past the rim and a 3×3 dice sat exactly on it — and the plate would have gone straight back to deciding how big food is, by trimming. `GARDEN_ZONES` offsets moved proportionally, so the three-zone composition is unchanged. Measured across all 63 recipes: **every plate lands at serving scale 1.00**, worst extent 0.97 of the rim, nothing overhanging; garden prep's seventeen pieces reach 0.76.

**Every px constant that is really a FEEL constant now scales with the food** (`× k`), because a roster at half its former size makes a fixed pixel budget mean something different on every plate:

- `MIN_GAP_FLOOR_PX` (legibility) — at a fixed 6px it silently refused half a ten-cut julienne taken across a carrot's narrow way, a direction the game promises is free.
- `PERFECT_TOL` (accuracy) — 12px was tuned against ideal spacings of 32–36px. Halved spacings made neighbouring ±12px windows meet in the middle, so a cut placed *exactly* between two ideal points fired the hero moment: Perfect Slice became unmissable on roughly half the roster. Scaled, the window holds its old ~35% of a spacing (tomato 6.4px of 18.0). `regress()` now asserts the worst possible cut does **not** fire, on the tightest spacing in the game — the old check only covered the cut-index gate, which is why it stayed green while the mechanic was broken.
- `PEEL_NEED_PX` (effort) — the rub budget is per *fruit*, not per pixel: 2200px over a 159px pineapple is fourteen full passes where it used to be six. Scaled, a shell costs the strokes it always did (pineapple 6.3, coconut 8.6, watermelon 5.1).

And beetroot's cut band tightened to `bandSideFrac` 0.80 with its dice at 2×2 (the mango finding again): a beet ends in a fine taproot, and a cut that lands there has no crossing cut able to reach it — the tail plated as one whole piece.

## 51b. A cut piece is a slab, not a sticker (2.5D depth)

Correct geometry was still reading as coloured paper. Every piece is a **window onto one cached whole-ingredient sprite** — the thing that makes thirty-nine foods cheap — and a window shows a top surface and nothing else. Six watermelon slices on the ceramic were six flat polygons: no thickness, no side, no cut face, no shadow to sit in. The cutting engine, the scoring, the clipping and the plating were all right; the piece had no volume.

**One shared renderer answers it, and it needs no new art.** The side is the *same window*, blitted once a few px along one fixed pseudo-depth direction and dropped in value. That is the whole trick — and because it is the same sprite, the wall carries each food's own cross-section for free: a watermelon's wall is green rind at the rim, pale rind under it, red flesh across the middle, because those are the pixels that live there. `wallPass` draws it immediately before the piece's own top surface, so back-to-front plate order gives correct occlusion between overlapping pieces at no cost — a slice's wall lands *on* the slice behind it, which is simultaneously the thickness, the cut face and the depth order.

- **MULTIPLY, not a brown wash.** The first pass tinted the wall with translucent brown and muddied every hue it touched — cheddar's side went olive. Multiplying by a warm grey drops **value** and leaves **hue** exactly where the painter put it, so the wall is unmistakably the same food in shade. The grey leans faintly amber, never blue: this kitchen's light is warm and food in shadow has to stay appetising.
- **`DIR_X` 0.55, not a token sideways nudge.** A near-vertical extrusion hides *inside* a slice that stands on its end, so a set of shoulder-to-shoulder slices showed only its bottom rind and the plate still read as one whole melon with lines drawn on it. At 29° off vertical each slice lays a band of its own darkened flesh over its neighbour.
- **Thickness is a PROFILE, not thirty-nine numbers.** Nine reusable profiles (`thin_leaf`, `thin_slice`, `citrus`, `medium_fruit`, `root`, `bread`, `thick_fruit`, `cheese`, `block`) carry thickness, wall darkness, bevel and shadow weight; `PIECE_DEPTH` is one word per food. Thickness is a fraction of the piece's **geometric mean** radius, so a long loaf is not judged by its width alone.
- **Never thicker than the piece is narrow.** Ten julienne batons off a carrot are ~26px wide; a wall sized off the whole root turned each into a cube. The cap is the distance from the piece to its nearest bounding cut (`cutDist`), and `MAX_PX` 22 stops anything becoming a brick.
- **Two deliberate exclusions.** **Uncut** food has no `cons` and gets no wall — the whole-ingredient look is untouched, including the first frame of every recipe. **Cluster** foods (herbs, leaves, florets) get none either: a bunch is not a slab, and extruding a basil ribbon is exactly the cardboard this was meant to avoid. Chiffonade and chopped parsley keep an edge and a shadow and nothing more.
- **The contact shadow now agrees with the slab.** It starts where the wall's bottom edge lands and takes its weight from the same profile, so a cheese block sits heavier on the ceramic than a herb ribbon. Overlap darkens for free — the shadows are drawn as one pass under all the tops, so they accumulate where pieces stack.
- **The bevel is one 1.6px inner stroke** at 0.10–0.22 alpha along the piece's own silhouette. Food is not infinitely sharp; it is also not outlined.

Untouched and asserted after: cut engine, gesture detection, scoring, piece counts, recipes, ingredient definitions, the scale pass, plating arrangement. **63/63 recipes pass, zero failures**, worst plate extent 0.972, payoff 3793ms; 100fps on a slice plate and 74fps on garden prep's seventeen pieces — the cost is one extra sprite blit and one fill per cut piece per frame.

## 52. What Phase 4A did not touch

Cut feel, knife rendering and traversal, Perfect Slice behaviour and gating, the result screen's structure and delta rules, the Details collapse rule, Chef's Signature threshold, retry speed, the ghost hand, the first-ten-seconds flow, and free-angle behaviour in slice recipes. `regress()` asserts all of it before and after — and from the direction pass it also asserts that a julienne started horizontally, vertically or at 40° lands ten parallel cuts with zero refusals, and that a dice started at 30° builds two sets exactly 90° apart.

---

## 12. The Result Screen: Beat Yourself, Not a Standard

The single most important scoring decision: **the headline is the delta, not the grade.**

```
      M A S T E R F U L
         ★★★★★

     Best        91%
     New         94%
              ▲ +3%

   [ Prep Again ]        ← visually primary
   [ Next Recipe ]
   ▼ Details
```

A green **+3%** is more motivating than any absolute number — people love beating themselves. When there's no improvement, show Best and New without a red delta; the previous best simply stands. **Never a negative number, never red.**

Tapping **Details** reveals Accuracy / Consistency / Rhythm percentages and **[Show my cuts]**.

**Progressive disclosure in both directions:** casual players see a warm word, stars, and a delta. Mastery players tap once for everything. **Exception:** on the Playable, full percentages show by default for the *first five recipes* — the fastest way to teach that precision is measured — then collapse behind Details.

**BUILT (Phase 3):** the card is DOM chrome over the softly blurred plated board, in the order above — grade word (cookbook serif, letter-spaced) → five-tier stars → Best / New → delta → **[Prep Again]** → *Next Recipe* → *Details*. The delta is the visual anchor by size alone: 40px golden against 14px rows, so a squint sees the improvement first and the grade word second. All numbers count up over 220ms with no bounce. Three rules are enforced in code, not by convention: a delta line renders **only** when the run beat the stored best (nothing red, nothing negative is reachable); a first prep shows New plus a quiet "first prep" marker and no delta at all, never 0%; and Rhythm displays as `+10`, never a percentage. Details opens by default for the first five preps ever played (`recipesPlayed`, persisted) and collapses afterwards. **Show my cuts** replays the cut map over a dashed silhouette of the ingredient, since the pieces are on the plate by then.

## 13. The Perfect Slice (The Hero Moment)
Every recipe contains **one** special slice: one guide glows gold.

**REVISED (Phase 2 — guide-less definition):** with guides removed (§10 rev), the Perfect Slice triggers on the cut that lands within PERFECT_TOL (12px) of an ideal even-division point for the current count — at most once per recipe (PERFECT_ONCE_PER_RECIPE). Same reward stack, plus a 1–2% ease-out camera zoom. The hitstop pauses the game clock AND the rhythm clock; the cut's own timestamp is recorded before the trigger fires, so the reward can never touch the metrics of the cut that earned it.

Hit it near-perfectly and:
- Time freezes ~50ms (hitstop)
- A spark
- A glass-like chime
- The knife shines

**No extra score. No bonus coins. Pure sensation.** One hero moment per recipe — the moment players clip for Shorts.

**Technical rule:** the rhythm timer pauses during the hitstop. The reward must never damage the metrics on the very cut the player nailed.

**REVISED (Phase 2 fix pass — Eligibility):** the hero moment cannot fire before the **third** cut of a recipe (`PERFECT_MIN_CUT_INDEX`). With one cut placed, "ideal spacing" is trivially satisfied and the reward is unearned; from the third the player has a pattern worth rewarding, and the recipe gains a shape — early cuts to establish, a middle where mastery is recognised.

**REVISED (Phase 2 — Working Axis):** the hero moment follows the axis the player is actually cutting, not the recipe constant, for the same reason the score does (§11).

## 14. Chef's Signature (The Shareable Capstone)

Achieve **Masterful (95%+) on all three metrics in a single recipe** and the result screen shows not *Masterful* but:

```
   CHEF'S  SIGNATURE
```

— stamped, as the Head Chef's mark. Rare enough to be posted ("Finally got Chef's Signature on the carrot julienne!"), real enough to be chased. Deliberately *not* defined as literal 100%, which touchscreen physics would make near-impossible; an unreachable achievement is worse than none.

This unifies two features: the Signature *is* the Head Chef's stamp — the mentor fiction and the shareable achievement are one system.

**REVISED (Phase 3 — Redefined for the current metrics):** the trigger is **Evenness ≥ 95 AND Consistency ≥ 95** in a single recipe. Rhythm is a bonus and cannot gate an achievement — verified by a run that earns the Signature at Rhythm **+0**. The grade word is replaced by a pressed **CHEF'S SIGNATURE** mark in Golden `#D8A03D`, revealed over 400ms (slower than a normal grade's 260ms) with one soft, distinct chime. No score change, no currency. A lifetime `signatures` count is persisted for later display.

## 15. Visual Replay — The Knife Replay (Signature Feature)

Immediately after each ingredient, for ~1 second, automatically:

- **Guide lines** in soft gold
- **The player's fitted intent lines** (Phase 1B: the overlay shows the ideal even division in soft gold vs the player's rendered cuts in steel blue — it teaches spacing, not tremor)

Then both fade. No text, no tutorial. The overlay *is* the teacher: percentages say *that* you drifted; the replay shows *where*. People immediately understand why they got the grade they got. Nearly free to build — the path data already exists.

- **Playable:** automatic, 1 second, non-blocking.
- **Mobile:** also available on demand via **[Show my cuts]** — mastery players use it constantly; relaxation players are never confronted by it.

## 16. Flow (Within-Session Atmosphere)

**No combo multipliers.** A streak of clean cuts builds **Flow** — and Flow changes *atmosphere*, never score:

- Brighter sunlight
- Music layers come forward
- More steam from the kitchen
- The world feels warmer

Losing the streak simply fades the atmosphere back. **No punishment, no lost points, no broken counter anxiety.**

Flow is the *within-session* arc; Kitchen Spirit (§24) is the *cross-session* arc. Flow rides entirely on systems that already exist (Cadence mix layers + lighting), so it costs almost nothing and gives even a 90-second session a visible emotional shape.


**BUILT (Phase 4B).** Flow is a hidden 0..1 value. Every cut is read the way the grade reads it — distance from the nearest ideal division as a fraction of ideal spacing — and a cut within `FLOW_CLEAN_TOL_FRAC` (22%) raises it by `FLOW_RISE_PER_CLEAN` (0.22); anything looser lowers it by `FLOW_FALL_PER_SLOPPY` (0.12). **It rises faster than it falls, and it never touches the score.** Between recipes it eases to half over `FLOW_RESET_LERP_MS` rather than snapping to zero.

Flow drives exactly two things: the Cadence mix (melody rises with it, texture rises last) and the window light. The light is capped at `FLOW_LIGHT_RANGE` = 8%, and that 8% is *relative* — a fraction of the board's own luminance, not an alpha. Applied as an alpha it measured +20% and was very much conscious; scaled against the board it measures **+8.3% (lum 95.2 → 103.1)**.

**Flow has no UI. Not a number, not a meter, not a bar, not a word — not even in the debug overlay.** `regress()` asserts this by scanning the rendered document for the string and for any `meter`/`progress` element. The only way to read it is `__kcTest.atmosphere()`. A visible flow becomes a thing to protect, and protecting things creates stress.

## 17. The Satisfaction Stack (Feel Without Haptics)

The YouTube webview has no vibration API. Every cut feels physical through:

1. **Slice sound** (primary)
2. **Clean visual separation** with piece inertia and weight
3. **1–2px board nudge** on knife impact
4. **Knife-trail glint**
5. **Particles** per ingredient (seeds, crumbs, flakes, juice)
6. **Grade pip**

Haptics arrive on native Android/iOS as an enhancement. The feel must be complete without them.

## 18. Plating (Never Skipped. Ever.)

After every recipe, the cut pieces fly to the plate and assemble — tomato slices fan, cucumber overlaps in a ring, julienne nests in the center. Two to three seconds.

**Not realistic. Beautiful.** Think Apple ads: everything snaps perfectly into place with intention and weight. Always gorgeous — cut quality changes *how refined* the arrangement looks, never whether it looks good.

This is the shareable moment, the session's closing chord, and the "I made that" feeling. It ships in the MVP and is never cut from any version.

---

**BUILT (Phase 3):** the plate is canvas-drawn cream ceramic — soft shadow, subtle double rim — and slides in beneath the pieces as they lift. The slices fly in an **overlapping cascade**, staggered 90ms apart with ease-out arcs and a gentle settle (no bounce). Two geometry rules earn the look: the cascade steps **across** the slices (along the cut's normal), because slices are wide and shallow and stepping *along* them stacks them into one streak — this is why an earlier rosette read as a pinwheel and a fixed down-right cascade collapsed angled cuts into a stripe; and each slice's plate shadow is its **own silhouette**, so it stays true at any cut angle rather than jutting out as axis-aligned teeth. Steep sets tighten their spread so end wedges stay on the ceramic. **Quality changes refinement, never beauty:** one `platingRefinement` value derived from Evenness tightens the step spacing and removes jitter; a Learning-grade run lands looser and more rustic but still plated and appetizing. Audio is a soft ceramic contact per piece, pitched up a pentatonic ladder so seven arrivals sound musical rather than clattery — synthesized, no new assets.

**BUGFIX (Phase 3 — Backgrounding Must Not Skip The Payoff):** the completion sequence runs on absolute game-clock deadlines while the watchdog pump keeps ticking in a hidden document, so a notification or app-switch inside the ~3.2s payoff window let the replay hold and the plating flight elapse unseen — the player returned to the result screen having never watched the plating, and all seven plate chimes fired in one frame instead of on the stagger. Backgrounded time is now discounted **on the transition back to visible**, added to the same accumulator that pauses use, so a real background/foreground cycle is subtracted exactly once and every deadline resumes where it left off. Testing `document.hidden` per frame instead is wrong and was tried first: some hosts report a document hidden while still pumping, rendering and taking input, and freezing the clock there hangs the loop after the last cut — no plating, no grade, no [Prep Again]. Verified both ways: with `hidden` spoofed permanently true the sequence still completes to the result screen (3178ms), and a real hidden span is discounted rather than played through.


# PART VI-B — PHASE 4B: THE KITCHEN (BUILT)

## 50a. The room behind the board

The flat cream field is now a soft, blurred kitchen: a wash that runs from cool early-morning grey to golden, a window of light in the upper third, a counter, and three out-of-focus shapes on it. It is canvas-drawn, low contrast, and **flattened toward the wash by `BG_CONTRAST` as the last step** — the desaturate knob, applied after everything else, so "if in doubt, blur more" is one number.

**Everything large is a gradient; the blur only ever touches the three small objects.** The first build blurred full-canvas fills through `ctx.filter` and wedged the compositor whenever the light moved — the page stopped responding entirely. A gradient is already soft, so the blur is now confined to three small ellipses, and the whole render measures **2.9ms worst case**.

Cost-checked three ways, because it sits behind every frame: pre-rendered to an offscreen canvas at **half resolution**; re-rendered only when the lighting has moved by `BG_REDRAW_THRESHOLD` **and** at most once per 220ms; and **adaptive** — two renders over 18ms and the blur is dropped permanently, so a slow device loses three background objects rather than its frame rate. Measured per-frame cost of the finished kitchen: **0.000ms** (a cached `drawImage` costs what the `fillRect` it replaced cost). The board light costs 0.014ms. `regress()` asserts two identical frames trigger zero re-renders.

**One lighting model, two numbers.** Spirit sets warmth, flow sets brightness; the window in the background and the light on the board read the same two values, so the kitchen and the food can never disagree about the time of day.

# PART VI-C — PHASE 5A: THE HOME KITCHEN (BUILT)

> **The cutting board earns the player's attention. The kitchen earns their affection.**
> The board is why they tap Play. The kitchen is why they remember it.

Phase 5 builds the world around the mechanics and changes none of them. 5A is the room: static this phase, so it has to read as hand-placed and warm while completely still. It is called `KitchenScene` in code, never "the background" — players are not entering a room, they are returning home, and the naming is what makes later phases inherit that intent.

## 53. The room, and why the board never moves

Composition, top to bottom in the portrait frame: **morning window** (the light source, upper area) · herbs, shelf, copper pans · **knife rack** on the wall · the **preparation table**, whose side edges converge upward so the surface itself points at the board · the **cutting board, unchanged** · basket and plate at the near edge · the **serving hatch** past the table's front edge. Sightlines, shelf edges and the table's perspective all lead inward; nothing draws the eye outward.

The board is 496×748 at (22,128) — 91.9% × 77.9% of the 540×960 frame, radius 26 — and 5A moved none of it. Pointer mapping is byte-identical: design (270,400) → client (605.000, 278.333) → mapped back (270.0000, 400.0000), **error 0.000000**. Nothing in the room overlaps the board or intrudes into the gesture area: every station object's box is tested against the board rect and against the two touchable controls (the pause chip at x 486–518, the new-ingredient control at x 458–540) — `roomIntrudes: false, intruders: []`, asserted permanently.

**Distance is less contrast, not just more blur.** Everything behind the table pre-renders at half resolution and is flattened toward the wash by `BG_CONTRAST` as the last step, with the light laid on afterwards so the source still reads as a source. The window is the visible source of the existing lighting model — Spirit sets warmth, Flow sets brightness — so the room and the food can never disagree about the time of day. Room objects use desaturated variants of the locked palette; **only the food is fully saturated.**

The **serving hatch** is the one composition element that lives outside the design frame. At 540×960 the near edge is already spoken for by the basket, towel, oil, grinder and plate, so the hatch sits at `HATCH_Y` 992 — below the working frame, visible in the vertical bleed every real phone has (a 19.5:9 screen shows ~178px of it) and ready for 5B's pull-back. It is a lip, a contact shadow and a quiet opening: the lowest-contrast thing in the frame, because it sits at the far end of every sightline. No life of any kind — waiters, the doorway and the dining room are 5D. One number moves it if the device pass disagrees.

## 54. The preparation station — hand-placed, never scattered

The player's workspace is **identical every session**, which is what makes it theirs: walnut board (existing) · knife rack · ingredient basket · serving plate · folded kitchen towel · small herb pot · olive oil bottle · salt grinder. Slightly imperfect on purpose — the towel is 2.4° off square, the oil bottle 1.6° off axis. **Nothing is procedurally scattered:** procedural placement is the fastest way to make a room feel generated rather than lived in, and a room that rearranges itself is not a home.

## 55. The order clipboard

The "Recipe 1 / Tomato — Slice ×6" chrome is now a wooden clipboard standing against the wall beside the board: paper under a steel clip, tilted −1.1°, with imperfections that are **deterministic per recipe** (hashed from the recipe id, never per frame) — a soft fold, a faint coffee ring, one line written and struck out. No rounded-rect card, no dialog shadow: it reads as an object in the room. The objective pips are exactly as built; they just live on the paper now (`pipRows: ["111111"]`, and `["111","111"]` for dice).

**Type decision (legibility is not negotiable):** the *paper* is the handwritten object, not the letterforms. A script face at 13px on a 540-wide frame costs readability outright, and shipping one would cost an asset file — so the name stays cookbook serif at 21px and the objective stays clean sans at 13px, and the hand shows up as paper, ring, fold, struck line and a slightly off-square clip. The DOM block measures 118.6×72.9 at design (31.2,42.4), inside the 228×80 paper, and its bottom edge is 115.3 — above the board's top at 128.

## 56. The environment is the reward

This is the structural decision of Phase 5, and it protects the first-ten-seconds rule (§40).

- **Gated on `hasCompletedFirstRecipe`, not days played.** Someone who plays, closes and reopens thirty seconds later is already a returning player.
- **First-ever load:** board and tomato immediately, ghost hand at 0.5s, cutting live on the first frame — exactly as before. Measured: script → recipe loaded 4.9ms, first painted frame 113.5ms after the script starts, `phase: 'cutting'`. The room is not merely hidden, it is **not rendered at all**: `reveal 0`, composites 0, far renders 0, near renders 0, no composite canvas allocated, 0.0008ms per frame.
- **After the first plate is taken** the kitchen becomes visible — in 5A a plain fade-up over 900ms, pre-warmed behind the result card so it is never paid for mid-cut. The camera pull-back that makes it feel earned is 5B.
- **Every load after that** it is simply there (returning load: the room finishes 4.0ms after the first painted frame).

**One value, one renderer.** The room is always rendered by the same renderer and `kitchenReveal` (0→1) is its opacity. There is no "no kitchen" mode: divergent paths are how regressions hide. `regress()` asserts `renderers: 1`, two layers, and zero renders before the room is earned.

## 57. Memory — tiny persistence, never announced

Three values in the existing Storage module, all **presentation only**, none ever mentioned in UI, none ever a reward:

- `lastRecipeId` — the basket holds what they usually prep, and yesterday's ingredient is already sitting by the board. Frozen at load, written for next time: reading it live would just put today's ingredient in the basket twice.
- `sessionCount` — at 4 sessions the towel has moved; at 10 a second herb pot appears.
- `lastPlayedAt` — a gap of 20 hours or more starts the light 0.22 cooler, warming back over the first nine cuts.

Corrupt or absent values fall back silently through the hardened `Store.get` behaviour from 4B, and the room still renders from them: `sessionCount` of `'not-a-number'` or `-50` → 1, `1e12` → clamped to 1e6, an unknown or object `lastRecipeId` → the default recipe, `lastPlayedAt: 'yesterday'` → cool 0. Nothing here is read by scoring or the cut engine.

## 58. Idle — the state, not yet the motion

After **10 seconds without input** the game enters `idle`, and nothing asks the player to play: no prompt, no pulse, no "tap to start", no dimming. The room simply exists and can be looked at — the exposure lifts by 0.02 over 1.4s so it reads very slightly more present, and that is all. Measured: `active` at 9.8s, `idle` at 10.04s, lift 0.02 (= cap), **0 canvas text draws and 0 DOM nodes added across a full idle frame**, no prompt string anywhere in the document. Any input exits instantly with no transition cost — state back to `active`, lift back to 0 in the same call. The ghost hand is unchanged: it is onboarding, not an idle prompt, and it still stops permanently after the first cut.

The actual life — steam, birds, plants swaying, curtains, a chef passing — is 5C and hooks into this state. Very few games let players enjoy doing nothing; this is where that becomes part of KnifeCraft's identity.

## 59. Camera: push, pull, parallax — never rotate (standing constraint)

A rule established here so 5B inherits it: **the camera may push, pull and parallax by a few pixels. It may never rotate.** Rotation in a portrait frame reads as disorientation, not cinematography. 5A has no camera movement at all, but the scene is **authored for it** — window / far wall / shelves / table / station are separate pre-rendered layers, so 5B can move them independently without rebuilding anything or re-rendering the room per frame.

## 60. Performance, and what 5A did not touch

The room is a **blit**, exactly as the 4B background was. Two layers pre-render in design coordinates (far at 0.5 resolution, near at 0.8) and flatten into one composite (1210×668 here) that rebuilds only when the light, the recipe or the save actually moves, at most once per 220ms; two identical frames trigger **zero** re-renders. Per-frame cost **0.003ms** revealed, 0.0008ms unrevealed, against a whole-frame cost of 0.223ms. Worst re-render: far 0.4–0.7ms, near 1.3–1.8ms, composite 0.4ms. Two renders over 18ms and the room drops detail permanently rather than frames. **Zero new asset files** — everything is canvas-drawn, and the page still fetches nothing (0 scripts, 0 images, 0 audio files).

Untouched, and asserted before and after: swipe system, cut engine, scoring, replay overlay, plating, audio engine, Chef's Cadence, Flow, Kitchen Spirit, result screen, Chef's Signature, recipes, piece counts and retry speed. `regress()` is green on both runs with identical numbers — metric spread 100/71/10 on both axes and both verbs, tap↔swipe parity 0, ghost 0, Perfect Slice gate `001`, rhythm +10 with and without the hitstop, diagonals 0/28/40/60° all 100, minimum gap 33.65px, the recipe ending at 6 with the 7th stroke refused, all six recipes 100 Masterful at 7/9/16/11/17/7 pieces, three-ingredient staging 10+7=17 on one plate, sequence → result plated in 3193–3201ms, retry 0.2–0.3ms, Flow light 95.2 → 103.1 (+8.3%), Spirit +0.5 Learning / +2.0 Masterful with decrease refused.

# PART VI-D — PHASE 5B: CAMERA AND FLOW (BUILT)

> **5A built a room. 5B makes it one space the player moves within.**
> The board is still the hero; the camera only ever changes how far away you are standing from it.

5B adds no gameplay. It adds a camera, the sequence that drives it, and the pair of hands that finally takes the plate away — the three things that turn a static backdrop into a place. `Camera` and `SceneFlow` are named apart from `Flow` (§16) deliberately: Flow is the hidden session-quality value, this is *scene* flow, and the two can never collide in code or in conversation.

## 61. The camera model — four states, one transform, never a rotation

The camera is one transform over 5A's already-separated layers: `{ zoom, pan }` about a fixed focus at the board's centre (270, 502). Four states, and nothing between them that is not a tween:

| state | zoom | pan (design px) | what it is for |
|---|---|---|---|
| **ROOM** | 0.86 | 0, +12 | the kitchen as a place — intro, and where the result is read |
| **STATION** | **1** | **0, 0** | gameplay. Every cut ever made happens here |
| **PLATE** | 1.05 | 0, −16 | the plating payoff, supported and not stolen |
| **HANDOFF** | 1.03 | 0, −10 | the hands arriving, half a step back from the plate |

**STATION is exactly 1 / 0 / 0, which is 5A's framing bit for bit** — not tuned to match, *constructed* to match. `atRest()` reports it, and at rest the world matrix is identical to 5A's and the room is a single blit, so nothing about cutting knows a camera exists.

**Push 380ms, pull 320ms, ease-out, no overshoot** — the same motion language as every other transition in the game (§38). A pull is slower to arrive at than a push because leaving is a release and entering is an intent.

**Parallax is two numbers.** The far layer (window, wall, shelves) moves at 0.4 of the station's rate; the near layer at 1. Enough that depth reads, not enough to become an effect. The room pre-renders at `OVERSCAN` 1.26, because a pull-back on a frame-sized layer shows the edge of the world.

**The camera may never rotate.** This was already the standing constraint from §59; 5B is where it becomes structural rather than aspirational. The matrix has no `b` or `c` term to get wrong — they are literal zeros in both the world transform and the per-layer blit — and `Camera.audit()` asserts that permanently, over the camera's own source *and* the matrices it produces.

**Cut space is camera-independent, and this is the most dangerous thing in the phase.** Every pointer sample is mapped through the *same* inverse, once, in the shared path (`toPointerCanvas` → `Camera.toDesign`); the effective zoom/pan the eye sees and the values the finger is mapped through come from one function (`eff()`), so they cannot disagree by a frame. A cut lands in the same design place at any zoom, at any point in a tween, mid-drift included.

**Idle drift is the room breathing, not the board.** After idle (§58) and only in ROOM, only outside `cutting`: ≤2% zoom and ≤6px pan over a ~20s loop, eased in over 900ms and gone within 180ms of any input. Gameplay framing never drifts — a board that breathes while you are aiming at it is a moving target, and this game does not move the target.

## 62. SceneFlow — two paths, one state machine

Same rule that made `kitchenReveal` a single value in 5A: **no duplicate code path**, because divergent paths are how regressions hide. One machine serves both players, and which path a load takes is decided once, by the save, before frame 1.

- **First-ever player → launches at STATION.** Board, ingredient, cutting live on the first frame — §40 is untouched, and the room is still not rendered at all. The room is revealed *later*, by the pull-back after their first plate is taken (§63). The reveal is earned, not shown.
- **Returning player → ROOM, hold, push in.** The kitchen is simply there for `INTRO_HOLD_MS` 600, then the camera pushes to STATION over 380ms. `INTRO_MAX_MS` 1500 is a hard ceiling, and the hold is clamped against it (`min(HOLD, MAX − PUSH)`) so the ceiling can never be exceeded by tuning the hold.
- **Input always wins.** A touch at any moment during the intro cuts straight to STATION in `SKIP_PUSH_MS` 110 — a player who wants to cut is never made to wait for a camera. The intro is a moment of calm, never a cutscene, and never a trap.

**The gate is `hasCompletedFirstRecipe`, not days played** — the same gate 5A used for the room itself (§56). Someone who plays, closes and reopens thirty seconds later is a returning player and gets the returning path.

The payoff states are one call each, at one moment each: `plating()` → PLATE, `handoff()` → HANDOFF, `taken()` → ROOM, `prep()` → STATION on both `[Prep Again]` and `[Next Recipe]`. **The result screen is always read from the room** — if anything reaches `showResult` in another state, the pull runs first, so there is no framing in which the card can appear over a close-up.

## 63. The chef's hands — closing the loop

The plate stops disappearing on a screen transition. Two hands reach in from off-frame, take it, and leave with it.

**Hands only.** No face, no body, not even a silhouette — the Head Chef is never seen fully (§26), and 5E owns whatever of him is ever seen. Forearms and hands, canvas-drawn in the warm palette, entering from `HANDS_TRAVEL_PX` 720 away so that no arm end and no plate edge is ever in frame.

Timing: **enter 440 → grip 60 → exit 400** = 900ms of hands. They start `HANDS_LEAD_MS` **300** before the plating animation ends, so the hands reach in *while the last pieces are still settling* — the overlap is what makes it read as a kitchen rather than a queue of animations. Net cost to the payoff: **+600ms**.

The lead is the value that yields under pressure, never the hands' own pace: at a 260ms lead the sequence overran, so the lead grew to 300. A snatched plate closes nothing — shortening the hands would buy the same milliseconds and cost the whole point. The sequence measures 3790–3798ms against `SEQ_CEILING_MS` **4200**, a ceiling that was 3900 until instrumentation proved 21ms of margin was not a margin at all (§53g).

The hands are scheduled from their **deadline** (`plate.endAt − HANDS_LEAD_MS`), never from the frame that noticed it: under a sparse frame cadence, passing the current time slid the whole 900ms by however far that frame had overshot the trigger. Every other deadline in the payoff is absolute (§18); this one was the exception, and now isn't.

**FIXED — plating had the same exception.** `startPlating` was called with the current time instead of `seq.plateAt`, so a late frame slid the entire plating schedule by the overshoot and the payoff got *longer* exactly when the host was busiest. The instrumented suite read **4969ms** against the 4200 ceiling while the same build measured 3803ms idle — a failure the measurement caused, in the one place the codebase had already learned that lesson. Scheduled from the deadline, it reads **3793ms** under the full suite: catching up is what a deadline means.

**The board is clear when the camera returns.** Hands grip → camera to HANDOFF → hands leave with the plate → pull back to ROOM. A skipped sequence takes the plate too: the board is never left dressed, in any path.

## 64. Performance, and what 5B did not touch

The camera moves the **blit**, never the layers: room re-renders stay at zero through every push, pull and drift, because a pre-rendered layer at a new zoom is a new matrix, not a new render. Measured cost of all camera movement: **+0.078ms per frame** against a 0.5ms budget. Zero new asset files; the page still fetches nothing.

Untouched, and asserted before and after: the swipe system, cut engine, scoring, replay overlay, plating arrangement and fit, audio, Cadence, Flow, Spirit, result screen, Chef's Signature, recipes, piece counts, retry speed, and the whole of 5A's room, station, clipboard, idle and memory. `regress()` is green with identical numbers on both runs.

**Not built (by scope):** steam, birds, plants, curtains, dust motes, kitchen ambient audio, time-of-day (5C) · doorway, customers, waiters, hatch life (5D) · Head Chef praise and story arcs (5E, which owns any part of him beyond hands) · menus, settings, cosmetics.

## PHASE 5A-2 — THE COMPOSITION PASS (BUILT)

> **5A placed the room. 5A-2 gives it a camera's-eye view, a value hierarchy and a light source.**
> Reference-driven, canvas-drawn, zero assets. Composition and value — never texture, never photorealism.

Nothing about gameplay, scoring, sequence timing or the STATION framing moved. The board's cut rect, its hit
area and its pointer mapping are the same as they were in Phase 1.

### §53a. Value structure — inverted, and measured

5A's kitchen was a bright room containing a mid-tone board: the eye had nowhere to land. The room is now
graded **down** and the board is the brightest surface in the frame. Five numbers own the whole hierarchy,
and every object keeps the hand-picked colour it already had:

| | |
|---|---|
| `ROOM_SHADE` `#171B1E` | the room falls toward a **cool** shadow, so the warm board separates by hue as well as value |
| `FAR_SHADE` 0.52 / `NEAR_SHADE` 0.46 | the wall gives up the most, the table nearly as much — only the board keeps its value |
| `MID_RELIEF` 0.60 | the mid band is relieved of 60% of the far shade: contrast rises with proximity |
| `VIGNETTE` 0.80 | the corners go near-dark; the frame closes around the board |
| `POOL_WARM` 0.34 | the warm pool the window throws, centred on the board |

The grade is one gradient per layer, not a repaint. The far layer is opaque, so it takes a plain fill; the
near layer has transparency the composite depends on, so its grade, pool and vignette go on through
`source-atop`. The table is graded **before** the station objects are drawn on it — the surface recedes, the
objects on it keep their contrast, which is what makes near read as near.

**Measured** (`__kcTest.valueProbe()`, real rendered pixels, luminance 0–255):

| | grade off (5A's structure) | grade on (shipped) |
|---|---|---|
| board face | 115.6 | **140.0** (97.6–172.3) |
| far wall | 187.0 | 106.6 |
| table | 148.0 | 91.9 |
| corners | 184.8 | 66.3 |
| board ÷ room | **0.67 — the room was brighter than the board** | **1.59** |
| board ÷ corners | 0.63 | **2.11** |

The two cream objects in the room — the order paper and the serving ceramic — are reported apart from the
surfaces. White things in a dark room are locally bright and always will be; the value hierarchy is a question
about *surfaces*. `regress()` asserts `brightest === 'board'`, board÷room ≥ 1.25 and board÷corners ≥ 1.9 off
rendered pixels, so no later tuning pass can drift the room back into the light.

**The order clipboard is exempt from the grade**, and that exemption is the rule rather than an oversight: it
is the one always-on piece of reading in the game, it stands in the window's light, and §55 says legibility is
not negotiable. It is drawn *after* the pool and vignette pass, so its paper keeps its 5A value (luminance
241.6) — the first build graded it with everything else and took the recipe name down to 1.7:1, which every
existing assertion happily passed because they only ever checked type size and geometry. `regress()` now
measures WCAG contrast off the rendered paper: **title 6.79:1**, and the objective line — which measured
3.04:1 on Phase 3's `rgba(80,84,90,0.65)`, below AA and not something this pass moved — was raised to `.88`
for **5.07:1**. Both lines are asserted at AA (≥4.5:1).

### §53g. The payoff ceiling

`SEQ_CEILING_MS` **4200**, in `CONFIG.sceneflow`, read by both the report and the assertion. It was 3900 with
21ms of margin, and the margin broke the first time the suite instrumented the payoff's own frames: two GPU
readbacks pushed the sequence to 4122ms, a failure the measurement caused rather than found. A budget that a
probe can break is not a budget. 5C adds per-frame work to those same frames, so the ceiling moved and the
hands did not — the sequence sits at 3790–3798ms with ~400ms of real headroom.

### §53b. Perspective — paint, never geometry

The flat frontal view was the biggest problem: a wall of wood with a rectangle on it.

- **The table recedes.** Its far edge is inset `PERSP_TOP_IN` 38px per side at `TABLE_TOP`; its near edge runs
  190px off both sides of the frame. The grain runs *into* the frame and converges with it, and the plank
  joints compress with distance (t²), so the surface is a plane going away rather than a backdrop.
- **The board is a trapezoid on that surface**: 74→466 at its far edge, 4→536 at its near edge, with a 10px
  edge slab (dropped and widened by 3.5px, so thickness shows on the sides as well as the bottom) and a soft
  contact shadow beneath it. Its grain converges with the table's.
- **The playable rect does not move.** `CONFIG.board` is the same 496×748 at (22,128) it has been since Phase
  1. Perspective is `boardQuad()` / `boardFacePath()` — a paint path used by the board, the board light and
  the replay dim, and by nothing that decides where a cut lands. Measured after the change: pointer round
  trip **0.000000**, `roomIntrudes: false`, `intruders: []`.

The drawn face is narrower than the cut rect at the far edge (74 vs 22) and wider at the near edge; the widest
ingredient (a 420px carrot spanning 59..481) still sits inside the face at its own height by ~20px per side.

### §53c. The pool

One warm radial, centred on the board's far third, painted on the board itself and — at 55% strength and a
wider radius — on the near layer, so the light that lands on the board also spills onto the table around it.
This is composition, not atmosphere: it is independent of Flow (§16, ≤8% relative, still measured at +4.6%
from this brighter base) and of Spirit warmth, both of which continue to ride on top of it unchanged.

### §53d. Density and scale — clustered, overlapping, cropped

Every near object is roughly twice its 5A size, and the near edge is now **one overlapping cluster** rather
than seven evenly spaced items: basket → towel → loose ingredient → serving plate → oil → grinder, drawn back
to front, each touching the next. The basket (212×128) is cropped by the left frame edge; the oil, grinder and
plate run off the bottom. All three ingredients heap in the basket and spill over its rim — the kitchen holds
more than tonight's order.

**One constraint shaped this and is worth stating plainly:** the board owns x 22..518 of a 540 frame, so there
is no "mid-height beside the board" to put a basket in — only a 22px strip, and anything wider would either
sit inside the gesture area or be hidden behind the board. The large basket therefore lives at the near left,
cropped by the frame edge, at the closest thing to mid-height the composition has. Moving it up would cost the
board rect, which is not for sale.

Nothing is procedurally scattered (§54 still holds), nothing enters the board rect, and nothing sits under the
pause chip or the new-ingredient control.

### §53e. Light — warm inside, cool outside

The window is a **backlight**: cool green daylight outside the glass (`DAYLIGHT`, two stops plus three soft
foliage blobs — a suggestion, never a landscape), muntins dark against it, and a warm bloom and sill wash
spilling into the room. Warm interior against cool exterior is the whole reason a room reads as an interior,
and it is why the daylight is painted *after* the grade and after the room's own light: a source is not a
surface, and nothing in here may wash it out.

### §53f. Depth layers

Still exactly two pre-rendered layers — `renderers: 1`, `layers: [far, near]`, the 5A contract — with the mid
band living inside the far layer as a **relieved** strip: back counter, four jars with window-side rim lights,
and a plant, drawn after the flatten and given back 60% of the grade. Contrast and warmth both rise with
proximity across three reads (far wall → counter and jars → table and station) without a third layer, a third
render or a third blit.

Cost is unchanged: **0.005ms per frame**, worst re-render far 0.8 / near 1.2 / composite 0.5ms, zero
re-renders for two identical frames, and zero new asset files.

# PART III — INGREDIENTS & CONTENT

## 19. Ingredient Feel

Every ingredient must be identifiable **by sound alone**, and each reacts differently — not because gameplay changes, but because it *feels* different:

| Ingredient | Feel | Sound |
|---|---|---|
| Tomato | Knife glides, juice, seeds bounce | Soft wet slice |
| Cucumber | Crisp, light | Fresh snap |
| Carrot | Rigid, fragments hop | Sharp crunch |
| Onion | Translucent layers | Thin crisp |
| Garlic | Tiny, rapid | Light ticks |
| Bread | Compression, crumbs | Gentle saw |
| Cheese | Silky drag, slight stretch | Muted glide |
| Chocolate | Crisp snap, flakes | Clean crack |
| Steak | Visible fibres, resistance | Dense cut |
| Salmon | Delicate, curved work | Silken slice |
| Watermelon | Juice, heavy slabs | Deep thunk |
| Pineapple | Fibrous, patterned | Coarse saw |
| Cake | Soft, decorative | Whispered glide |

**Audio gets budget priority over particles** — sound is the ASMR contract.

## 20. Ingredient Variation (Alive Ingredients)

No two tomatoes are identical: round, oval, small, large. Carrots: straight, crooked, fat, thin. Bread: rustic, square. Implementation is cheap (scale/skew the mesh, regenerate guides); tiny variation creates infinite freshness.

**The fairness rule:** guides and tolerances generate *from* the individual ingredient's shape — a crooked carrot has crooked guides. The challenge shifts; the fairness doesn't. Chef's Signature attempts and any future leaderboards draw from moderate variants only.

## 21. Recipes

Recipes replace levels. The game remembers the best preparation of every recipe.

| Recipe | Preparation |
|---|---|
| Garden Salad | Tomato slices, cucumber slices, carrot julienne |
| Burger Prep | Onion rings, tomato slices, lettuce chop |
| Pasta Base | Garlic mince, onion dice, mushroom slice |
| Sushi Prep | Salmon fillet, cucumber julienne, avocado slice |
| Fruit Bowl | Apple wedges, kiwi slices, strawberry halves |

**Per-recipe mastery tiers:** Bronze / Silver / Gold / Master (95%+ all metrics — i.e., a Chef's Signature run).

**Difficulty grows through preparation, never through pressure:**
- Level 1: large tomato, 4 slices
- Level 5: small tomato, 8 slices
- Level 12: tomato → rotate → dice
- Level 20: mixed vegetables

**No timers. No stress. Just craftsmanship.**

## 22. Signature Recipes (Celebrations, Not Bosses)

Every restaurant has one iconic dish — long, multi-ingredient, multi-technique, ending in the game's most elaborate plating:

Italian → Lasagna Prep · Sushi Bar → Dragon Roll · Bakery → Wedding Cake · French → Ratatouille · Luxury → Chef's Tasting Plate

**Celebrations:** unlocked by rank, no fail state, no time pressure. Designed to be screenshotted — the marketing pipeline built into the design.

## 23. Weekly Chef's Special (Phase 1.5 — First Live-Ops)

Once the MVP validates, the cheapest possible live-ops: **each week, Recipe 5 rotates into a "Chef's Special."** Players return because there's something new — never because they'd lose progress. One swapped recipe, no economy, no events infrastructure. This is the first thing added after launch, not part of the launch.

---

# PART IV — THE LIVING RESTAURANT

## 24. Kitchen Spirit (Persistent Ambience)

A hidden **Kitchen Spirit** value grows with every well-prepared recipe and **persists between sessions** (localStorage on Playables, cloud save on mobile).

- Spirit **never decreases.** Messy sessions grow it slowly; masterful sessions grow it quickly.
- Session 1: bare morning kitchen, one window, quiet.
- Session 10: plants on the sill, coffee steam, a second cook humming.
- Session 30: rain on the window, jazz, regulars in the dining room, golden-hour light.

**Progression is invisible by design.** No "Restaurant 2 Unlocked!" banner — the kitchen simply looks slightly nicer next session. Most players won't consciously notice; all of them will feel the game is alive. Milestones stay legible without numbers ("a cat now sleeps by the window").


**BUILT (Phase 4B).** `spirit` grows after every completed recipe by `SPIRIT_PER_RECIPE` × the grade's scale — Masterful 2.0 down to **Learning 0.5, which is still growth**. Measured: a Learning run moves it +0.5, a Masterful run +2.0. It is stored as a float, because rounding on the way in would have made a Learning run worth nothing at all.

**Spirit never decreases, and that is enforced in `Save.setSpirit`, not by its callers**: a write below the stored value is clamped up to it, so no future feature can quietly introduce decay. `regress()` attempts a decrease and asserts it was refused. A corrupt, absent, hostile or out-of-range value falls back to `SPIRIT_BASE` or clamps into 0..100 and never throws — string, NaN, null, negative and 1e9 are all in the suite.

Two visible effects, both continuous, neither announced: the scene's **lighting warmth** (`SPIRIT_WARMTH_CURVE` 0.7 — the first sessions warm fastest), and at `SPIRIT_AMBIENT_AT` (58) a **distant room tone** that fades in over 3s at gain 0.018 and then never fades out. **No toast, no banner, no milestone, no "+5".** The suite asserts no announcement text exists. The kitchen is simply warmer next session; noticing it is the player's business.

Warmth is measured from `SPIRIT_BASE` (50, the schema's fresh-install value), so a new player starts in a cool early-morning kitchen and reaches golden at 100 — about 25 Masterful recipes.

## 25. Story Arcs (The Heart of Long-Term Retention)

**People remember stories, not decorations.** Spirit milestones advance **wordless micro-stories** told through the window and dining room while the player preps:

**The Regular & the Girl** *(months)* — a regular appears by the window → he brings a little girl → she waves at you → she gives you a flower → she's a teenager → she works in the café.

**The Stray Cat** *(weeks)* — outside in the rain → tolerated at the doorstep → a saucer appears → asleep on the windowsill → owns the place.

**The Young Cook** *(days)* — nervous, drops things → steadier → hums while working → one day plates a dish alone and glances at your station.

**The rules that protect the magic:**
1. **Nothing is ever explained.** No popup ever says "The girl waved! +5 Spirit." UI acknowledgment kills the mechanic. The game must pretend it doesn't know.
2. **Multiple overlapping arcs on different timescales** — something is always quietly in motion.
3. **Arcs advance on days-played, not recipes-ground** — you cannot binge through the girl's childhood in one evening. The stories need real time to feel real.

Players slowly realize: *"I've watched this restaurant grow."*

## 26. The Head Chef

The player's mentor. **Never seen fully — only hands** taking finished plates.

Roughly once every 20 recipes, and **only after a genuinely clean recipe** (quality-gated, never scheduled, so it always reads as earned): a quiet 👍, or two words — *"Excellent prep."*

Rare praise is an event; frequent praise is wallpaper. Chef's Signature (§14) is his stamp — the achievement and the mentor are one fiction. And once, after hundreds of recipes, he silently places **his own knife** on your station. No text. Screenshot bait by design.

## 27. Ambience by Time of Day

Morning: soft sunlight, coffee sounds. Lunch: kitchen chatter. Evening: warm lamps, jazz, rain. The player never leaves the prep station — the restaurant is felt, not toured.

## 28. Morning Prep (The Daily Ritual)

Each real-world day, a small natural order waits: three ingredients, ~two minutes. Completing it advances story beats.

**No streaks. No punishment for missing days.** The girl simply waves *whenever you next return.* Routine through affection, not obligation — the mechanical spine of the "coffee game" positioning, and the throttle that keeps Spirit honest.

## 29. Knife Journal (Phase 2 — The Collection)

Every ingredient remembers your best cut. Eventually the player unlocks the **Knife Journal**:

```
Tomato     Chef's Signature    97 recipes
Carrot     Masterful           44 recipes
Cucumber   Clean               61 recipes
```

Per-ingredient bests, counts, and Signature stamps. The collection layer completionists love, and the natural bridge into the mobile Mastery Gallery.

---

# PART V — AUDIO & MUSIC

## 30. One Musical Kitchen

Not many sounds — **one instrument.** Knife, board, ingredient, plate, kitchen ambience, and music all sync to a single beat grid. Nothing feels separate.

## 31. Chef's Cadence

The soundtrack **never stops and never starts from silence.** A full ambient track always plays, most layers mixed low. **Cut quality controls the mix, not the existence of the music:**

- Average cuts → base mix
- Good cuts → instruments come forward
- Great streak (Flow rising) → soft percussion rises
- Masterful streak → melody blooms
- Sloppy stretch → layers gently *recede* — never cut out

**All cut-triggered sounds quantize to the beat grid**, so player actions always land musically even off-tempo. The player conducts the kitchen.


**BUILT (Phase 4B).** Fully synthesized, no new asset files. 66 BPM, no drums. Three layers — **bed** (sustained root + fifth through a breathing lowpass, started once and never stopped), **melody** (a sparse plucked line), **texture** (soft taps) — all always scheduled, all always audible. Cut quality moves the *mix*: melody rises with flow, texture rises last. `CADENCE_LAYER_FLOOR` is 0.28 and **no layer is ever muted**. Measured after forty consecutive sloppy cuts: mix bed 1.0 / mel 0.28 / tex 0.28, absolute gains **0.052 / 0.021 / 0.0118 — none of them zero**. Mix moves are `setTargetAtTime` over `CADENCE_LERP_MS` (1500ms), so no step change is audible. The bed fades in over 800ms on the first pointerdown; nothing plays before the first touch.

**Quantization vs immediacy — how the tension was resolved.** Quantization is an *assist*, never a scheduler. A cut sound is only ever nudged **forward**, and only when the next 1/8 is already within `QUANTIZE_MAX_SHIFT_MS`; otherwise it plays dry, on the stroke. The cut never waits for the music. On a 454.5ms eighth-note grid that means **worst case 59.55ms of 60ms allowed, and 13.1% of cuts get nudged at all** — the rest land exactly where the hand put them. The Perfect Slice has a stricter cap of its own, `CHIME_MAX_SHIFT_MS` = 16ms (one frame), measured worst case **15.91ms against a 50ms hitstop**: it can never drift out of its own freeze. Both bounds are asserted by a pure sweep of every offset across four beats, so they hold with or without live audio.

**Foley is never masked.** The loudest cadence layer peaks at 0.075 against a foley transient peak of 0.34 — **4.53× (≈13dB) above the loudest layer, 6.54× above the bed** — and the bed's 520Hz lowpass sits below all three ingredients' transient bands (550–2800 / 900–4400 / 1500–5400 Hz). Numerically clear; the ear is the device pass's job.

## 32. Audio Budget (Playables Reality)

Playables are HTML5 with a hard size budget (~15MB initial load historically). MVP ships **3 ingredients = 3 sound families**, aggressively compressed (mono, 22kHz is fine for foley), with pitch/velocity variation done **in code**, not extra files. 2–3 Cadence layers prove the mechanic.

---

# PART VI — PROGRESSION & STRUCTURE

## 33. Reputation Ranks (Mobile)

Apprentice → Prep Cook → Kitchen Assistant → Line Cook → Sous Chef → Prep Master → Knife Master

Ranks unlock restaurants, ingredients, and Signature Recipes. Authority, never power — no gameplay stat ever improves.

## 34. Restaurant Progression (Mobile)

Cozy Café → Garden Bistro → Burger House → Italian Kitchen → Sushi Bar → Bakery → Dessert Café → Luxury Hotel

Each with unique ambience, music, ingredients, story cast, and one Signature Recipe. **New restaurants add new ingredients — never harder punishment.** Unlocks are presented invisibly per §24 — the world simply grows.

## 35. Daily Challenges (Mobile, Phase 2)

Short, optional, cosmetic rewards: *Tomato Mastery* (10 clean tomatoes), *Julienne Practice*, *No Waste*.

## 36. Endless Zen Mode (Phase 3)

No score. No stars. Random ingredients arrive; the player cuts, listens, breathes. Pure ASMR. A gift, not the main game.

## 37. Cosmetics & Economy (Mobile Only)

Purely cosmetic: boards, knife handles, counters, plants, lighting, aprons, music themes. **No gameplay advantage, ever.**

- **Playable:** no economy at all.
- **Mobile:** coins from stars/challenges; rewarded ads (bonus coins, rare knife skins — never "second chances," since there is nothing to fail); IAP for Remove Ads, knife packs, kitchen themes.

---

# PART VII — PRESENTATION

## 38. Visual Style

Semi-realistic. Warm. Soft shadows. **Apple Arcade quality.** Not cartoon, not photorealistic. Beautiful wood, tiny particles, knife reflections, natural light.

**Palette:** Cream `#F8F4EE` · Walnut `#8A5A3C` · Dark Steel `#50545A` · Sage `#8DAA6D` · Tomato `#D94B45` · Mustard `#D8A03D` — warm, premium, Japanese kitchen.

**Typography:** cookbook serif headings; clean sans UI; large numerals; minimal text, icons where possible.

**Motion:** 150–250ms micro-animations. Menus slide like cutting boards. Buttons compress gently — no bounce. Percentages count up smoothly. Everything moves slowly, elegantly.

**Standing camera constraint (from Phase 5A):** push, pull and tiny parallax only — **never rotate.** Rotation in portrait reads as disorientation. See §59, and §61 for the four states it became.

## 39. UI Layout

The board owns ~80% of the portrait screen. Nothing else exists that doesn't have to.

```
┌────────────────────────────┐
  Garden Salad
  Slice ×4   □□□□□□□□
─────────────────────────────

        CUTTING BOARD

─────────────────────────────
                      ○ pause
└────────────────────────────┘
```

The □□□□ progress pips show cuts remaining — glanceable, wordless.

**Mobile-only screens:** ambient main menu (peaceful kitchen, knife on board, sunlight, dust motes), recipe-book style selection, Mastery Gallery / Knife Journal, Settings.

**BUILT (Phase 3):** top-left is the recipe name in cookbook serif with the objective beneath it in clean sans, and **six wordless progress pips** that fill as cuts land — they replace the old "N cuts remaining" text entirely. Top-right is a pause icon with no label (pause freezes the game clock, so no animation or rhythm time passes). The bottom is empty: no score, no coins, no combo meter, no progress bar. All of it is DOM chrome; the canvas draws only the world.

## 40. The First 10 Seconds (Playable — Non-Negotiable)

1. **0.0s** — Load complete. No splash. No logo. No menu.
2. **0.0s** — Board on screen. A tomato. Four glowing guide lines.
3. **0.5s** — A ghost hand draws one slow swipe and fades.
4. **∞** — The game waits. The first thing the player ever does is cut.
5. First cut → sound + separation + grade pip. The contract is signed.
6. Recipe 1 complete (~30s) → plating → result screen → **[Prep Again]** highlighted first.

Every second before the first swipe is a lost player.

---

**BUILT (Phase 3, adapted to the guide-less design):** no splash, no logo, no menu — board, ingredient and HUD are present on the first frame, and the ingredient slides onto the board rather than popping in. At 500ms a **ghost hand** draws one slow horizontal swipe across the bare tomato and fades, repeating every 4s until the first cut, then never again in the session. It demonstrates the verb without drawing a guide the player must obey. Cutting is live from the first frame — the entry animation never gates input.

# PART VIII — MVP & EXECUTION

## 41. MVP Scope (YouTube Playable)

**Persistence (Phase 3, via the Storage module with its in-memory fallback):** `best.<recipeId>` (best overall per recipe), `recipesPlayed` (lifetime count, drives the Details default-open rule), `signatures` (lifetime Chef's Signature count), plus `spirit` and `daysPlayed` — written now, read in Phase 4. Every read is guarded: a corrupt or absent value returns null and falls back to a default rather than throwing into the game loop, and clearing site data resets the game to a clean first-prep state.

**In:**
- **5 recipes:**
  1. Tomato — Slice (the 10-second hook)
  2. Cucumber — Slice (even spacing focus)
  3. Tomato — Dice (new technique, familiar ingredient)
  4. Carrot — Julienne (widened tolerances, consistency-graded)
  5. Garden Prep (all three ingredients; fullest plating)
- **3 ingredients — tomato, cucumber, carrot. Hard rule.** Every extra ingredient costs a model, cut-behavior, sound family, and particle set.
- 3 techniques: slice, dice, julienne
- Knife engine + 3 metrics + grade ladder + Chef's Signature detection
- **Best-vs-Current result screen with green delta** (percentages default-visible for first 5 recipes, then behind Details)
- **The Perfect Slice** — one gold guide per recipe, hitstop + spark + chime (rhythm timer paused during hitstop)
- Knife Replay overlay (automatic, 1s)
- **Flow atmosphere** (lighting + Cadence layers respond to streaks)
- Plating animation
- Chef's Cadence (2–3 mix layers, beat-quantized cut sounds)
- One-tap retry
- Local best per recipe
- **Persistent save schema from day one:** Kitchen Spirit value + days-played counter — even if the MVP only uses Spirit for lighting + one ambient sound. Two variables now; future-proofed saves forever.
- First-10-seconds flow exactly as specified

**Out (explicitly):**
Coins · shops · cosmetics · ads · IAP · reputation ranks · restaurant unlocks · story arcs · Head Chef appearances · Signature Recipes · ingredient variation · Morning Prep · Knife Journal · weekly rotation · Endless Zen · daily challenges · splash screen · animated menu · haptics

Everything in Part IV is Phase 2+. Designed now so the architecture leaves room — not built now.

**One command closes every phase (Phase 3 cleanup, extended in 4A):** `__kcTest.regress()` runs the whole permanent suite in one async call and returns `{pass, fail[], …}` — metric spread on both axes and both verbs (100 / 71 / 10), tap↔swipe parity (placement delta and score), ghost truthfulness against the shared resolver, Perfect Slice gating at `PERFECT_MIN_CUT_INDEX`, rhythm integrity (hitstop must not tax the bonus), free-angle scoring at 0°/28°/40°/60°, minimum gap (no duplicate or coincident cuts), the recipe ending at `count` with the next stroke refused, the completion sequence reaching `result` with `plated: true`, `[Prep Again]` inside `RETRY_TRANSITION_MS`, frame health, and — from Phase 4A — a clean run of **all five recipes** (grade, piece count, plating style, best key), julienne's ten cuts with zero refusals, the dice grid with both sets graded and two pip rows, three-ingredient staging onto one plate, and the `[Next Recipe]` cycle with separate bests. It snapshots the recipe config and the player's save and restores both, so measuring never costs progress; `fps` is reported but never asserted (a backgrounded iframe throttles frames — the permanent guard is that no single frame hangs). Hosts with a short eval timeout can use `regressStart()` / `regressResult()`.

## 42. Validation Bar

> **Players voluntarily press [Prep Again] on recipes they already completed.**

Test with 10 people. Watch which button they press on the result screen. That button is the verdict — the only rating that matters. If they replay Lesson 1 chasing a cleaner tomato, the game exists. If they don't, no amount of content fixes it.

## 43. Build Order

**Week 1 — The Swipe.**
One tomato → touch tracking → cut separation with inertia → live accuracy score → Knife Replay overlay. **Test input latency in the actual YouTube webview immediately** — a precision game with 100ms+ lag is dead, and it's better to know in week one. Knife feel (§9) tuning starts here and never really stops.

**Week 2 — The Feel.**
Knife trail glint, particles, board nudge, real slice foley with velocity variation, the Perfect Slice moment.

**Week 3 — The Recipe.**
Full recipe flow → grading + Best-vs-Current screen + Details → plating animation → one-tap retry → Chef's Signature detection.

**Week 4 — The Restaurant.**
Ambient backdrop → Flow atmosphere → Kitchen Spirit persistence (lighting + one ambient sound) → Cadence layers → all five recipes tuned (tolerances, thresholds, deltas).

**Then:** 10-person test → verdict → iterate the swipe until Prep Again wins.

## 44. Phase Roadmap

**Phase 1 — YouTube Playable:** §41 exactly.

**Phase 1.5 — First live-ops:** Weekly Chef's Special rotation (§23). One swapped recipe per week; no other infrastructure.

**Phase 2 — Android:**
Story arcs · Head Chef · Morning Prep · ingredient variation · Knife Journal · reputation ranks · first 4 restaurants · 2 Signature Recipes · ~15 ingredients · 6 techniques · daily challenges · cosmetics + economy · haptics · cloud save · ambient menu + Mastery Gallery.

**Phase 3 — iOS + expansion:**
Remaining restaurants and Signatures · Endless Zen · seasonal ambience · weekly events · leaderboards (moderate ingredient variants only) · recipe book · community challenges.

**Future — Steam:** expanded art, long-session cozy focus, complete story arcs.

---

# PART IX — CLOSING

## 45. Positioning Statement

Not another slicing game. Not another cooking game.

**KnifeCraft is a craft-mastery game wearing a cozy restaurant** — where every swipe is a small lesson in a real skill, where you only ever compete with yesterday's self, where nothing you do is ever punished, where one golden slice per recipe freezes time for a heartbeat, where a restaurant slowly fills with life and quiet stories because of your hands, and where the rarest reward in the game is a mentor's silent stamp on a perfect plate.

Five minutes. A cup of coffee. One cleaner cut than yesterday. **+3%.**

## 46. The Only Next Step

The design phase is **complete** — six documents deep, and the ideas have begun looping back on themselves, which is the universal sign that the next unit of progress costs code, not prose.

The next artifact is not v7. It is a single HTML page: one tomato, four glowing guides, swipe detection, live scoring with Best-vs-Current, the Knife Replay overlay, and one golden Perfect Slice — running in a mobile browser.

Every remaining question — does the swipe feel physical, does the hitstop delight or annoy, does the green +3% actually drive retries — can only be answered there.
