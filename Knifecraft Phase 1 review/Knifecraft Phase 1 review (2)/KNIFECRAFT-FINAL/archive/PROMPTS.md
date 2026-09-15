# KnifeCraft — Development Prompt Pack (v2)
### For use with Claude Code / Claude, alongside DESIGN.md

## How to use this pack

1. DESIGN.md in project root is the single source of truth.
2. Run **Prompt 0** once to establish the working contract.
3. Run one phase prompt per session, **in order**. Do not skip Phase 1 — everything depends on it.
4. Run the **Critique Prompt** at the end of every phase, not just once at the start.
5. Never ask for "the whole game." Every session ends with something you can open on your phone and test.

## PROMPT 0 — The Working Contract (run first, once)

ROLE: simultaneously a senior gameplay-feel engineer (Nintendo/thatgamecompany: input, physics, juice, tuning), a senior frontend engineer (canvas rendering, performance, touch input), and a UI/motion designer at Apple Arcade quality (Monument Valley, Unpacking, Assemble With Care, Alto's Odyssey, A Little to the Left, PowerWash Simulator; Japanese-minimal + Scandinavian warmth).

UI reads: premium, warm, calm, elegant. Never childish, flashy, casino-like, or overloaded. The UI's job is to disappear — the cutting board is the hero.

TECHNICAL CONSTRAINTS (non-negotiable)
- Target: HTML5 for YouTube Playables. Portrait. Design at 540x960, must scale cleanly to 720x1280 and 1080x1920 (letterbox-free responsive canvas).
- Rendering: single <canvas> for the game (board, ingredient, knife, guides, particles, plating). DOM only for UI chrome (header, result screen, buttons). Never mix game rendering into DOM elements.
- Input: pointer events (pointerdown/move/up), NOT touch+mouse duplicates. Record x, y, t for every pointermove. Never throttle input sampling.
- Performance budget: 60fps on a mid-range phone. Every animation must be transform/opacity or canvas-drawn. No layout thrash.
- Asset budget: total initial payload under 15MB. Audio: mono, 22kHz, compressed; pitch/velocity variation in code, not extra files.
- No external network calls at runtime. No web fonts heavier than two files.
- Persistence: wrap all saves behind a single Storage module with an in-memory fallback, so the same code runs in sandboxed previews and in the real Playables environment.
- No vibration API (Playables webview doesn't support it). Feel must be complete through sound + visuals (DESIGN.md §17).

DESIGN SYSTEM (fixed — do not invent alternatives)
- Palette: Cream #F8F4EE, Walnut #8A5A3C, Steel #50545A, Sage #8DAA6D, Tomato #D94B45, Golden #D8A03D. Nothing saturated beyond these.
- Type: cookbook serif for headings, clean sans for UI, bold modern numerals for percentages. No outlines, no glow, no cartoon fonts.
- Spacing: 8px grid; paddings from {16, 24, 32, 48}.
- Motion: 150–250ms, ease-out only. Gentle compression on press (2–3px). No bounce, no elastic, no overshoot. Everything moves slowly, elegantly.
- Guides: soft glowing golden lines, handcrafted feel, never neon. They fade the moment a cut lands on them.
- Buttons: rounded, cream with wood accents, soft shadows. No gradients, no bevels.

WORKING RULES
1. One phase per session. Build ONLY that phase.
2. Every phase ends with a single runnable build openable on a phone.
3. Before writing code for a phase, list: (a) build, (b) explicitly NOT build yet, (c) acceptance criteria. Wait for confirmation, then build.
4. Tunable values (tolerances, thresholds, timings, easing, audio gains) live in ONE config object at the top of the code, commented.
5. When DESIGN.md specifies a number (grade thresholds, hitstop duration, overlay duration, first-10-seconds timing), use exactly that number.
6. If an instruction contradicts DESIGN.md, stop and flag the conflict instead of silently choosing.

## PHASE 1 — THE SWIPE

> AMENDED (Phase 1 revision): intent-based cutting supersedes "cut along the ACTUAL swipe path" and raw-path replay — see DESIGN.md §11 (revised). Fitted line + error-tapered assist; replay shows the fitted intent line.

> AMENDED AGAIN (Phase 1B — Tap-Primary Cutting): tap is the primary verb (clean horizontal cut through the tapped point, count-based objective, guides removed from slice mode, optional graphite ghost line); swipe is optional and angle-snapped (ANGLE_SNAP_DEG 12 / ANGLE_PULL 0.7 / ANGLE_FREE_DEG 30), passing through its midpoint; metrics = Evenness / Consistency / Rhythm (floor 35); MIN_GAP + edge-margin guards; slab offsets small/consistent/alternating (SLAB_OFFSET_PX) and slab masks clip to the ingredient silhouette. See DESIGN.md §8, §10, §11 (revised). Technique gestures are Phase 4; free technique choice belongs to Zen mode.

> AMENDED AGAIN (Phase 1C): rhythm is BONUS-ONLY (overall = weightedMean(Evenness, Consistency) + RHYTHM_BONUS_MAX·rhythmQuality; RHYTHM_FLOOR removed; breakdown shows "Rhythm +N"); angle snapping targets the NEAREST of 0°/90° so vertical cuts work (taps follow recipe CUT_AXIS; spacing metrics measure along the active axis; same-axis crossings impossible, cross-axis allowed); pieces are a half-plane partition of the silhouette — terminal caps always separate. See DESIGN.md §11 (Phase 1C note).

> PHASE 2 BUILT (The Feel): knife visual (enter/exit with the swipe, travel-aligned, ghost-trail blur, glint, tap-chop), progressive cut traversal shaped by RESISTANCE_CURVE, layered WebAudio foley (skin/glide/thunk, velocity-varied, ±3% jitter, zero files), Perfect Slice redefined for the guide-less design (even-spacing proximity, PERFECT_TOL 12px, once/recipe, 50ms hitstop with PAUSED rhythm clock, spark+chime+shine+1.5% zoom), pooled fps-culled particles, board nudge, per-piece shadows, delayed piece settle, truthful ghost line (shared resolvePlacement). Swipe = primary verb, tap = accessible fallback (device-testing decision; scoring parity non-negotiable). See DESIGN.md §8/§13 (Phase 2 notes).

Single-screen playable: one tomato on the walnut board, four golden guide lines, full swipe-to-cut with live scoring. Nothing else exists yet.

Scope:
1. Responsive portrait canvas (540x960 design space), board ~78% of screen, cream background, soft natural shadow.
2. Tomato rendered on the board (canvas-drawn; must read as a tomato with soft specular highlight, not a red circle).
3. Four horizontal guide lines per DESIGN.md §10 — soft golden glow.
4. Swipe engine: capture x/y/t on every pointermove; a swipe crossing the ingredient produces a cut along the ACTUAL swipe path (slightly smoothed), splitting the tomato visually with natural inertia — the piece tips/settles with weight; nearest guide consumed, glow fades.
5. Live scoring per §11: Accuracy (mean + max perpendicular deviation); after all four cuts: Consistency (gap-width stddev) and Rhythm (inter-cut interval variance); grade ladder per §11.
6. Knife Replay overlay (§15): after 4th cut, guides in gold + actual paths in steel blue for exactly 1 second, then fade.
7. Minimal debug readout (top corner, toggleable): live accuracy of last cut, input latency estimate, fps.
8. One placeholder slice sound (synthesized fine) for rhythm testing.
9. A "reset tomato" tap target for infinite retry.

Acceptance criteria:
- Input-to-visual-cut latency under 50ms on a mid-range phone
- 60fps sustained during cut + particle moment
- The cut visibly follows MY path (wobbles included), while the score compares my path to the guide — §11 tolerance design
- The replay overlay makes it obvious, with zero text, why I scored what I scored
- All tunables in the single config object

Do not build: result screens, plating, other ingredients, dice/julienne, audio beyond placeholder, Flow, Perfect Slice, persistence, menus.

**Exit test:** you find yourself re-slicing the tomato more than five times *without deciding to*. If that pull isn't there, tune the swipe — do not proceed.

## PHASE 2 — THE FEEL

DESIGN.md §9, §13, §17. The swipe becomes physical.

Scope:
1. Knife rendering: premium stainless steel following the finger — subtle reflection, tiny motion blur at speed, soft highlight. Realistic scale, never oversized.
2. Satisfaction Stack (§17): knife-trail glint, tomato seed/juice particles (minimal, natural), 1–2px board nudge on impact, micro shadow shifts on separated pieces.
3. Real slice foley: tomato sound family (soft wet slice), velocity-varied in code — faster swipe = sharper transient. Knife-on-board impact varies with speed. Mono 22kHz or WebAudio-synthesized.
4. THE PERFECT SLICE (§13): one of four guides glows gold-brighter. Near-perfect hit triggers: ~50ms hitstop, single spark, glass-like chime, brief knife shine. No score bonus. Rhythm timer MUST pause during hitstop.
5. Camera: very subtle zoom-in (1–2%) on Masterful-grade cuts, ease-out.

Acceptance: eyes-closed slow-vs-fast cut audible; Perfect Slice delights (if hitstop reads as lag, shorten — tunable); rhythm scores identical with/without Perfect Slice trigger (prove via debug); 60fps with particles.

Do not build: other ingredients, recipes, result screen, plating, Flow, music.

**FIX PASS (applied, post-critique):**
1. **Pre-score line** — the seam opens under the blade *during* the stroke (leading to the blade's belly); separation on release continues from the score's progress instead of restarting. `PRESCORE_ENABLED`, `PRESCORE_LEAD_FRAC`; `pre` shown in the debug panel.
2. **Knife lift-off** — 4px rise + rotation to level on exit (`KNIFE_LIFT_PX`).
3. **Cut-normal board nudge** — impact travels along the cut normal, not always +y.
4. **velEMA decay** (bug) — velocity decays toward zero after `VEL_IDLE_MS` of no movement; a stalled stroke no longer carries stale speed into blur and audio brightness.
5. **Perfect Slice eligibility** — `PERFECT_MIN_CUT_INDEX: 3` (see DESIGN.md §13 revision).
6. **Tap chop anchor** — blade heel lands at the tap point (`HEEL_AT`).
7. Placeholder grade line drops "Overall" (the result screen owns the headline number — §12).

Deferred to their proper homes: grade typography and the post-recipe quiet gap (Phase 3 result screen); reset-button hand bias (Settings pass).

Regression evidence after the fix pass: tap/swipe parity delta 0 (both 100 / rhythm +10 on identical positions and cadence), ghost resolver output unchanged, Perfect Slice blocked on cuts 1–2 and firing on cut 3, 7 pieces from 6 cuts, 60fps.

**BUGFIX PASSES (applied, post-device):**

1. **Off-axis scoring saturation** (high) — the scorer's single-axis filter dropped off-axis cuts, leaving one gap with zero variance: deliberately uneven play scored Masterful 100/100. The metric path itself (ordering, gaps, ideal division) was axis-correct all along — the projection hypothesis was disproven by measurement; the fault was the *filter*. Now every axis with ≥2 cuts is graded, weighted by cut count.
2. **Knife animation** — five causes fixed (noise-window direction, long-way rotation across the wrap, jitter mirroring, no entry snap, edge off the seam). DESIGN.md §9.
3. **Diagonals** — nearest-axis snapping replaces the invisible 30° free window; `FREE_ANGLE` (default off) keeps diagonals available for later techniques. An intermediate `SINGLE_AXIS` lock proved to be an overcorrection (it broke working vertical slicing) and now defaults off.
4. **Partition** — existence is analytic, not grid-sampled; no piece can be dropped. DESIGN.md §9.

**FREE-ANGLE PASS (applied, closes Phase 2):** cutting at any angle, crossing cuts at any angle, parallel-set grading, objective by cut count with `MAX_CUTS` headroom, no coincident/duplicate cuts, and the blade aiming at the fitted cut line (`FIT_AIM_MIN_PTS`) instead of the raw finger direction so hand wobble no longer deviates the knife from the line being cut. Evidence: straight Slice ×6 unchanged (100/100/+10 Masterful, parity 0, spread 100/71/10 on both axes and verbs); 6h+6v cross 49 pieces 100 Masterful; clean slices + chaotic cross 50/50/+10 = 60 Rustic (no longer a false 100); 5-cut star 10 pieces Masterful (was ungraded); 6-cut fan renders every wedge separated; wobble stroke deviates 16° early and 0.0° once the fit takes over; 84–108fps.

New permanent tests in `__kcTest`: `metricSpread(verb)` (six numbers, both axes, both verbs — would have caught bug 1), `strokeInfo()` (live stroke extents + knife rot/target/dirSign/instance id), `setRecipe(patch)`, and `lockInput(true)` — scripted strokes must ignore the real pointer, whose events and coalesced trail otherwise contaminate a run and fake a rotation bug.

Evidence after the passes: rot settles to 0° / 90° / 62.5° / 0° across left-to-right, vertical, diagonal and right-to-left strokes, one knife instance and no mirroring in each; 6h+6v crossing cuts give 49/49 pieces at ~1ms per cut; metric spread 100 / 71 / 10 identical on both axes and verbs; mixed clean+chaotic scores 50/50/60; tap-vs-swipe parity delta 0; Perfect Slice gated to cut 3; ghost resolver and pre-score seam unchanged; 60fps.

## PHASE 3 — THE RECIPE AND THE PAYOFF

DESIGN.md §7, §12, §14, §18, §40.

Scope:
1. Recipe structure: Recipe 1 = "Tomato — Slice ×4". Ingredient slides onto board (never pops); slides off on completion.
2. HUD per §39: recipe name + objective + wordless progress pips top-left, pause icon only. Bottom empty.
3. PLATING (§18): four slices fly to a plate and fan into place — Apple-ad energy. 2–3 seconds. Cut quality subtly affects refinement (tighter vs looser fan), never prettiness.
4. RESULT SCREEN (§12) — EXACT hierarchy: grade word + stars / Best / New / green ▲delta (headline) / [Prep Again] primary / [Next Recipe] secondary / ▼ Details → Accuracy/Consistency/Rhythm count-up + [Show my cuts]. Never red or negative delta. Percentages default-OPEN for first five recipes ever, collapsed after. Background blurs softly.
5. Chef's Signature detection (§14): 95%+ all three metrics replaces grade word with CHEF'S SIGNATURE stamp treatment.
6. One-tap retry: [Prep Again] restarts in under 300ms, zero intermediate screens.
7. Local best per recipe via Storage module.
8. FIRST 10 SECONDS (§40 exact): load → board + tomato + guides instantly → ghost hand draws one slow swipe at 0.5s and fades → game waits. First playable frame within 2s of load.

Acceptance: [Prep Again]-to-cutting under 300ms; delta line is the visual anchor (squint test); stranger understands with zero text in 10s; plating screenshot postable.

Do not build: cucumber/carrot, dice/julienne, Flow, Cadence, Kitchen Spirit, recipes 2–5.

## PHASE 3 — THE RECIPE AND THE PAYOFF

**BUILT.** The core became a loop. A `phase` state machine (`cutting → sequence → result`) replaced the open board: meeting the cut count ends the cutting phase immediately, so no stroke can place a seventh cut (`MAX_CUTS` and the extra-cut regrade path are gone). Recipe data lives in `CONFIG.recipes.RECIPES`; `startRecipe(i)` loads an entry, `nextRecipe()` advances the index. Free-angle cutting stays available but **defaults off** for `Slice ×6`, which is axis-snapped slicing.

Built this phase: ingredient entry/exit, wordless HUD pips + pause icon, the completion sequence (knife replay → plating → result, skippable by a tap), the plating cascade with `platingRefinement`, the result screen with its delta rules, Chef's Signature, one-tap retry, the persistence schema, and the ghost-hand onboarding. New CONFIG blocks: `recipes`, `plating`, `result`, `retry`, `onboard`.

**Acceptance evidence (measured):**
1. Recipe ends at exactly 6 cuts — a 7th stroke returns `not-cutting (phase sequence)`, cuts stay 6, 7 pieces.
2. [Prep Again] → cuttable in **0.1ms** (the 180ms fade runs over live input).
3. Squint test: delta **40px** golden vs New 14px, grade word 20px, stars 12px — the improvement dominates.
4. Worse-than-best (best 99 → new 17, Learning): delta line hidden, nothing red, previous best stands.
5. First prep: no Best row, no delta, "first prep" marker shown — 0% never displayed.
6. Details open on runs 1–5, collapsed on run 6 (verified by stepping `recipesPlayed`).
7. Chef's Signature fires at Evenness 100 / Consistency 100 with Rhythm **+0** — Rhythm cannot gate it.
8. Full sequence (replay → plating → result) **3332ms**, under the 4.5s ceiling; a tap skips straight to the result.
9. Regression clean: metricSpread 100/71/10 on both axes and both verbs, tap-vs-swipe parity delta 0, ghost resolver unchanged, Perfect Slice still gated to cut 3 (cut 1 false), no duplicate cuts from five identical strokes, 108–122fps with the plate populated.
10. Payload unchanged — no new asset files (plate, ceramic settle and Signature chime are all drawn/synthesized).

**Not built (deferred by scope):** cucumber · carrot · dice · julienne · mince · recipes 2–5 · Flow atmosphere · Chef's Cadence music · Kitchen Spirit behaviour (schema only) · blurred kitchen background · main menu · settings · cosmetics · daily challenges · Knife Journal.

**FREE-ANGLE PASS (applied after Phase 3):** `Slice ×6` defaults to `freeAngle: true` — one recipe, full freedom, no separate free-cut mode. Grading logic is unchanged (parallel groups, spacing perpendicular to each set's direction, weighted by count); what changed is the assist taper and the angle-aware intercept band, both in DESIGN.md §11. Evidence: clean 6-cut runs score **100 Masterful at 0°, 90°, 28°, 40° and 60°** (7 pieces each, no partial cuts); the snap ladder maps 5°→0°, 12°→0°, 18°→7.9°, 26°→26°, 40°→40°; a 6-cut radial fan grades 60 Rustic (sensible — a fan is not even spacing); metricSpread 100/71/10 on both axes and verbs, parity delta 0, Perfect Slice still gated to cut 3, ghost resolver unchanged, 103–126fps. Plating: wedge pieces from angled cuts fan correctly, with the cascade spread tightened for steep sets so end wedges stay on the plate. Two plating fixes came out of eyeballing the 40° plate: the fan steps along the cut's **normal** (a fixed down-right cascade collapsed angled slices into one streak), and each plate shadow is the slice's **own silhouette** (the axis-aligned ellipse jutted out as grey teeth under diagonal pieces). Verified visually at 0° and 40° — both fan cleanly inside the rim.

**HIDDEN-DOCUMENT FIX (verifier catch, two attempts):** the completion sequence ran on absolute game-clock deadlines while the pump kept ticking in a hidden document, so backgrounding the app inside the payoff window skipped the replay and plating outright and fired all seven chimes in one frame. The first fix froze the clock whenever `document.hidden` was true per frame — wrong, and worse: hosts that report hidden while still pumping and taking input (including this project's own preview) hung the loop after the last cut. Backgrounded time is now discounted on the **visibilitychange transition** instead. Verified: with `hidden` spoofed permanently true the sequence still completes (phase `result`, plated true, 3178ms), and a plain 6-cut run reaches the result screen normally. See DESIGN.md §18.

**CLEANUP PASS (closes Phase 3, no behaviour change):** `regress()` run before and after — identical results (spread 100/71/10 ×4, parity 0, ghost 0, gate `001`, rhythm +10 with and without the hitstop, 0/28/40/60° all 100 with 7 pieces, minGap 33.65px, ends at 6, sequence → result plated, retry 0.2ms).

Removed as dead: `axisCuts()` (never called), `regrade()`'s `gradeInfo.t0` bookkeeping and `CONFIG.grade.showMs` (the old in-canvas grade card, replaced by the DOM result screen — `260ms` now `result.GRADE_REVEAL_MS`), `recipeDone` (the phase machine is the single source of truth), the `FONTS` table (no canvas text survives), `CONFIG.audio.sliceGain` (unreferenced since the layered foley landed), and the debug HUD's `cuts 6/6+` overflow marker (a `MAX_CUTS` remnant — unreachable now). Deduplicated: `regionGeom` now calls `containsPoint`, the board-nudge normal calls `cutNormal`. Cascade literals moved into `CONFIG.plating` (`CASCADE_ACROSS_PX/ALONG_PX/ROT`, same values). `CONFIG.retry.RETRY_TRANSITION_MS` was config-only — `regress()` now asserts the retry against it.

Structure hardening: the watchdog interval self-clears when its generation goes stale (each re-injection used to leave one interval ticking forever — harmless work, leaked timers), and the `visibilitychange` handler ignores stale generations so an old instance cannot rewind the live clock. One instance, one RAF loop, the frame-exception guard (`window.__kcError`) and the input-driven repaint are all unchanged.

Known superseded prose in this file: line 139's "free-angle … **defaults off**" is corrected by the FREE-ANGLE PASS entry above (it defaults **on**), and the Phase 2 entries' `SINGLE_AXIS` / `MAX_CUTS` mentions are history — `MAX_CUTS` is gone from the code; `SINGLE_AXIS` and `FREE_ANGLE: false` survive as Phase 4 flags (both are in use as of 4A: julienne and dice respectively — DESIGN.md §11, §49).

## PHASE 4A — INGREDIENTS AND TECHNIQUES

**BUILT.** Two ingredients, two techniques, five recipes. Nothing about cut feel, grading or the result screen changed; `regress()` ran green before and after (spread 100/71/10 ×4, parity 0, ghost 0, gate `001`, rhythm +10/+10, diagonals 0/28/40/60° all 100, minGap 33.65, ends at 6, sequence → result plated 3187 ms, retry 0.2 ms).

**The refactor came first.** The tomato's hardcoded geometry moved into `CONFIG.INGREDIENTS` (silhouette + resistance curve + audio params + particle profile per entry) and into a three-function silhouette API (`inside` / `spanX`+`spanY` / `trace`) — `SILS.ellipse`, `SILS.capsule`, `SILS.taper`. What moved out of hardcode: `tomatoHalfWidth/HalfHeight/insideTomato` (now span queries against the active shape), `CONFIG.cutFeel.RESISTANCE_CURVE` → per ingredient, `CONFIG.audio.SLICE_FILTER_*`/`SLICE_TAIL_MS`/`BOARD_THUNK_GAIN` → per-ingredient audio sets, particle colours/gravity/counts → per-ingredient profiles, the piece clip path (was a hardcoded ellipse, now a cached `Path2D` per shape), and the plate's size (was `T.rx*1.32`, now fixed `PLATE_RX/RY` — a 412 px cucumber drew a plate wider than the board).

**Decisions.**
- **Stages, not a special case.** A recipe is a list of stages; Garden Prep has three, recipes 1–4 have one, one code path. Stage complete → grade + stamp pieces → slide off into `harvest` → 300 ms handoff → next ingredient. The final stage plates harvest + current together. Recipe score = stage grades weighted by cut count.
- **Pieces scale in a shared plate.** Tightening three arrangements was not enough — full-size tomato slices collided with the cucumber. Zones now scale the pieces too (≈0.55), eased in during the flight.
- **Per-recipe overrides, never global.** Julienne widens `evennessTol` 1.2→1.9, `consistencyCvTol` 0.9→1.5, weights E1/C2, `minGap` 18→11. Nothing outside that recipe moves.
- **A finished set never swallows a stroke.** In a dice recipe a stroke aimed at a full axis redirects to the unfinished one (`liveAxis`); if both are full the phase has already ended and the refusal is named.
- **The chime ladder restarts per ingredient**, so a 17-piece plate is three ascending phrases, not one run off the top of the scale; the stagger compresses (900 ms span) so a big plate does not out-stay a small one.

**Numbers.** All five recipes graded 100 Masterful on a clean scripted run with exact piece counts (7 / 9 / 16 / 11 / 17, zero partial cuts). Julienne: ten cuts, zero refusals, 32.5 px ideal spacing, `minGap` 11; crowded into the middle 60 % it still lands ten (min achieved gap 23.8 px). Dice: 3+3 cuts → 16 pieces, two graded sets of 3, pip rows `111|111`, free angle off. Garden Prep: three stages seen in order, 10 harvested + 7 live = 17 plated, three ingredients and three styles on one plate, combined grade over 3 stages. `[Next Recipe]` cycles 1→5→1 with five separate bests. No new asset files — payload unchanged.

**Not built (Phase 4B):** Chef's Cadence, Flow, Kitchen Spirit behaviour (schema only), blurred kitchen background, menu, settings, cosmetics, daily challenges, Knife Journal, mince/fillet/decorative cuts, story arcs, Head Chef.

**DIRECTION PASS (4A follow-up) — first cut sets the direction.** `SINGLE_AXIS` on the carrot rejected horizontal and diagonal strokes, contradicting the free-angle principle: julienne needs cuts parallel to *each other*, not to a predetermined axis. Replaced with `JULIENNE_PARALLEL_SNAP` — cut 1 is placed as drawn (nearest-axis assist intact), cuts 2..n inherit its direction and keep the player's position along the perpendicular. `SINGLE_AXIS` stays in CONFIG, used by nothing.

**Dice had the same problem** and got the same rule: cut 1 sets one direction, its perpendicular becomes the second set (`PERP_SNAP`). Free angle is now ON for every shipped recipe; `FREE_ANGLE: false` is retired. Grading is untouched — spacing was already measured perpendicular to each set's own direction.

Three fixed numbers assumed a wide band and had to yield to the chosen direction. **`minGap`** is capped at 0.7× the ideal spacing for that direction (floor 6px) — without it, cutting a carrot crosswise refused four of ten cuts for "no room" at positions the game calls ideal. **`EDGE_MARGIN_PX`** is capped the same way — 12px of edge in an 8.5px-spacing band pushed the outermost ideal cut outside the placeable band. **Coverage** is now measured along the stroke's own line (`cutChord`), not an axis-aligned span — a steep diagonal near a thin shape's edge barely spans either axis while fully crossing the food, and was being demoted to a tap that landed off the ingredient. Wide directions never reach any cap; every established score is unchanged.

One latent inconsistency surfaced and was left alone deliberately: flat sets are graded against `bandRange` while sloped sets use the angled support span. Both are self-consistent with their own ideals (a player hitting the game's own ghost targets scores 100 either way), so nothing moved.

**Numbers.** Julienne ×10 started horizontally / vertically / at 40°: **100 Masterful each**, 10 cuts, 11 pieces, 0 refusals, all cuts parallel (ideal spacing 8.5 / 32.5 / 26.1px, effective gap 6 / 11 / 11), plate overflow 0.97 / 0.76 / 0.97 (≤1 = inside the rim). Dice started at 30°: 6 cuts, 0 refusals, 16 pieces, two sets at −60° and 30° — exactly 90° apart. `regress()` green before and after, zero fails; Phases 1–3 unmoved (spread 100/71/10 ×4, parity 0, ghost 0, gate `001`, rhythm +10/+10, diagonals 100, minGap 33.65, sequence 3195ms plated, retry 0.1ms).

**PLATING FIT (direction-pass follow-up).** The one direction the change newly enabled was the one whose payoff screen nobody looked at: a horizontal julienne cuts ten ribbons each the carrot's full 420px length, and `startPlating` only ever scaled pieces for multi-ingredient zones — they splayed off the ceramic across the cutting board. Fixed at the source: `plateFit` measures every arrangement's rotated piece extents against the rim and scales positions and pieces by one factor about the plate centre. Arrangements that already fit return exactly 1, so nothing established moved. `regress()` now asserts plate containment per recipe and per julienne direction — grades and piece counts never caught it.

**FREE CUT (sixth recipe).** Every recipe constrained direction somehow — slice never reached the carrot, dice holds a grid, julienne holds one set. `free-cut` declares nothing: `FREE_ANGLE` true, no parallel/perp/axis snap, count 6, ingredient rotating tomato → cucumber → carrot on arrival (not on `[Prep Again]` — a retry is the same plate again), plating style following the ingredient. No new mechanic: the parallel-group scorer already grades crossing sets separately, and `plateFit` already contains whatever shape comes out.

Numbers: six cross cuts on a carrot (3 vertical + 3 at 20/40/60°) land with 0 refusals — 4 sets, 14 pieces, 87 Clean, overflow 0.69. A clean parallel six in Free Cut scores **100, identical to the same run in Slice ×6** (evenness 100 both), confirming no hidden per-recipe scoring. Cycle now runs 1→6→1 with six separate bests. `regress()` green before and after, zero fails.

**END-CAP INVESTIGATION.** Reported symptom: carrot and cucumber render with tip and butt missing, flat faces where the shape should round off; tomato unaffected.

**Suspect #3 was real.** `setIngredient` did `Object.assign(T, ING.geom)` and never cleared T's derived caches; `silPath` memoises on `g.__paths`, so when the incoming geom had no `__paths` of its own the assign copied nothing and T silently kept the *previous* ingredient's `Path2D`. Cold, after tomato → carrot: `silPath(T, 1.5)` returned the tomato ellipse at ±149.5 instead of ±211.5 — a carrot clipped to a 148×128 ellipse, chopped flat at both ends, cucumber likewise, tomato unaffected. Exactly the reported symptom. The first investigation missed it because every probe ran warm: once anything builds a shape's path the staleness vanishes, which is also why a "fresh" load showed `carrotGeomHadCache: true`. **Fixed:** `delete T.__paths / __in / __sup` before the assign. Currently unreachable through the render path (`pieceGeom` is `p.src ? p.src.geom : T` and every piece carries `src`), so no behaviour moved — but it was the only identified mechanism producing that symptom and it was live.

Suspects #1 and #2 were genuinely clean: `EDGE_MARGIN_PX` enters only `interceptBand` (cut placement, never the silhouette), and `spanX`/`spanY` return full silhouette extents — painted profile matches geometry within ~1px at every sample, both ends, both ingredients.

Also fixed while measuring: `taper.inside` had no x bound — `taperH` returns 0 past both ends and `|y-cy| <= 0` is true on the centre line, so every point along y=cy read as inside the food out to infinity past the tip, letting a cut register off the end of the carrot. **Noted, not changed:** `PAINT.carrot` deliberately draws a "trimmed crown face" ellipse at the butt; that is art direction, not a clipping fault.

**Two permanent assertions added.** Per ingredient at 0/1/6/10 cuts: piece count is cuts+1, no piece is empty, and the union of piece extents matches the silhouette at both ends. Plus a **cold-cache clip check** that wipes every derived cache, warms T on the previous shape, switches, and requires the rendered clip to match the correct one — the warm-cache blindness that hid this bug is now itself covered.

## PHASE 4B — ATMOSPHERE

DESIGN.md §16, §19, §21, §24 (MVP slice), §31, §41.

Scope:
1. ~~Cucumber and carrot~~ — **done in 4A.**
2. ~~Dice and julienne~~ — **done in 4A.**
3. ~~All five MVP recipes, Garden Prep sequencing all three ingredients~~ — **done in 4A.**
4. CHEF'S CADENCE (§31): one ambient track, 2–3 layers, all always playing; quality controls the MIX — forward on clean streaks, gently recede on sloppy, never cut out. Cut sounds quantize to beat grid.
5. FLOW (§16): streaks brighten light + bring Cadence forward; losing streak fades back, zero penalty, zero UI counter.
6. Kitchen Spirit MVP slice (§24, §41): persisted Spirit + days-played in Storage. Spirit shifts ambient lighting warmth + adds one ambient sound at a threshold. Blurred kitchen background gets subtle morning-warmth gradient tied to it.
7. Blurred kitchen background — soft, never competing with board.

Acceptance: eyes-closed ingredient ID 3/3; Cadence never audibly stops; deleting site data resets Spirit, replaying regrows it; payload under 15MB; 60fps in Recipe 5.

Then run the Critique Prompt one final time.

## THE CRITIQUE PROMPT (end of every phase)

Review the current build as three people:
1. Senior game-feel designer at Nintendo: where does input, weight, timing, or juice fall short of "the swipe is the game"? Specific to the millisecond and pixel.
2. Senior UX designer at Apple Arcade: what violates calm-premium? Visual clutter, dead space misuse, contrast, thumb-reach on one-handed portrait, anything competing with the board.
3. YouTube Playables retention analyst: walk the first 30 seconds frame by frame. Where could a player bounce? Anything delaying the first cut? Is [Prep Again] winning?

For each issue: severity (blocker / should-fix / polish), the specific fix, its cost. Then the top 3 missing micro-interactions that would most increase perceived quality per hour of work. Report first; the user chooses what to act on.

## Phase 4B — Atmosphere (BUILT, measured)

Cadence, Flow, Kitchen Spirit and the kitchen background are in. Governing rule held throughout: **nothing is ever taken away** — a bad run slows growth, never reverses it.

- **Cadence** — 66 BPM, three synthesized layers always audible, `CADENCE_LAYER_FLOOR` 0.28. Worst run measured: gains 0.052 / 0.021 / 0.0118, none zero. Foley sits 4.53× above the loudest layer.
- **Quantize** — assist only, forward only, 1/8 grid (454.5ms). Worst shift 59.55/60ms; only 13.1% of cuts are nudged. Perfect Slice capped at one frame: 15.91/16ms inside a 50ms hitstop.
- **Flow** — hidden 0..1, atmosphere only, **zero UI** (asserted). Light range +8.3% relative, measured lum 95.2 → 103.1.
- **Spirit** — float, monotonic in `Save.setSpirit` itself. Learning +0.5, Masterful +2.0. Ambient room tone at 58, never announced. Corrupt/absent/negative/huge values all clamp without throwing.
- **Kitchen** — gradients large, blur only on three small objects, half-res, 220ms rate limit, adaptive blur drop. **0.000ms per frame**; 2.9ms worst re-render.
- Regression additions: cadence floor + rise, quantize sweep (audio-independent), no-flow-UI DOM scan, measured light range, spirit monotonicity + corruption, background redraw count and cost, payload has no external assets.

## PHASE 5A — THE HOME KITCHEN (BUILT, measured)

DESIGN.md Part VI-C (§53–60). Phase 5 builds the world around the mechanics and changes none of them.

**Built:** `KitchenScene` (composition, two pre-rendered layers, one blit per frame) · `StationLayout` (the eight fixed workspace objects, hand-placed and slightly off-square) · `OrderBoard` (the wooden order clipboard, deterministic imperfections per recipe, pips unchanged) · `IdleState` (10s trigger + state + a 0.02 exposure lift, nothing else) · `SceneMemory` (`lastRecipeId`, `sessionCount`, `lastPlayedAt`, all presentation-only) · `kitchenReveal` as one value on one renderer · the serving hatch past the table's front edge · the standing no-rotation camera constraint, and the layering that lets 5B honour it.

**Not built (by scope):** camera movement or transitions and the chef's hands taking the plate (5B) · steam, birds, plants, curtains, dust motes, kitchen ambient audio, the time-of-day cycle (5C) · doorway, customers, waiters, hatch life (5D) · Head Chef praise, story arcs (5E) · menus, settings, cosmetics. `CameraController`, `AmbientManager`, `RestaurantManager`, `ChefController` and `CustomerManager` are **not stubbed.**

**Acceptance evidence (measured, both `regress()` runs green with zero fails):**
1. `regress()` **pass, 0 fails, twice.** Identical numbers: spread 100/71/10 on both axes and both verbs, parity 0, ghost 0, gate `001`, rhythm +10/+10, diagonals 0/28/40/60° all 100 (6 cuts, 7 pieces), minGap 33.65px, ends at 6 with the 7th refused, six recipes 100 Masterful at 7/9/16/11/17/7 pieces, plate overflow 0.97/0.97/0.97/0.769/0.932/0.72, staging 10+7=17 (shingle|fan|nest, 3 stage grades), julienne 10 cuts 0 refusals (ideal 32.5px, crowded min gap 23.8px), dice 16 pieces / sets 3+3 / pips `111|111`, cadence floor 0.28 (gains 0.052/0.021/0.0118, foley 4.53× the loudest layer), quantize 59.55/60ms with 13.1% nudged and chime 15.91/16ms, flow light 95.2 → 103.1 (+8.3%), spirit +0.5/+2.0 with the decrease refused, cold-cache clip 415/423/299 correct. Only wall-clock and cumulative counters move between runs (sequence 3201 vs 3193ms, retry 0.2 vs 0.3ms, fps 136 foreground vs 10 in a throttled hidden iframe).
2. Board **pixel-identical**: design 496×748 at (22,128) r26 = 91.9%×77.9% of frame; device px (dpr 1.25) x 540.54 y 111.33 w 431.42 h 650.60; tap (270,400) → client (605.000, 278.333) → mapped back (270.0000, 400.0000), **err 0.000000**; `roomIntrudes false`, intruders `[]`.
3. First-ever load: `phase: 'cutting'` on the first frame, recipe loaded **+4.9ms** and first painted frame **+113.5ms** after the script starts (the preview host's own 1.38s boot dominates the absolute mark), ghost hand at 500ms, and the kitchen **not rendered at all** — reveal 0, composites 0, far/near renders 0, no composite canvas, 0.0008ms per frame.
4. `firstRecipeDone` persists: false before any plate → `true` in the store → `true` after a reload → reveal 1 on the next load.
5. One value, one renderer: `renderers: 1`, layers `[far, near]`, 0 renders while unrevealed, reveal 0 → 1 over 900ms. No second code path exists to gate.
6. Idle: `active` at 9.8s → `idle` at 10.04s, lift 0.02 (= cap), exits to `active` with lift 0 in the same call, **0 canvas text draws, 0 DOM nodes added, no prompt string** anywhere in the document.
7. Memory: all three keys persist and affect presentation only. Corrupt → silent defaults (`sessionCount` `'not-a-number'`/`-50` → 1, `1e12` → 1e6; unknown or object `lastRecipeId` → default recipe; `lastPlayedAt: 'yesterday'` → cool 0), and the room still renders from each.
8. Per-frame cost **0.003ms** revealed / 0.0008ms unrevealed (whole frame 0.223ms) — a blit, as the 4B background was (0.000ms). Worst re-render far 0.4–0.7ms, near 1.3–1.8ms, composite 0.4ms; two identical frames → **0** re-renders; composite 1210×668 at far 0.5 / near 0.8 res, 220ms rate limit, detail-drop at 18ms retained.
9. Payload: **zero new asset files** — 0 scripts, 0 images, 0 audio files, 0 resource fetches. Still one file.
10. Clipboard legibility: the *paper* is the handwritten object, not the letterforms — recipe name in 21px cookbook serif, objective in 13px clean sans, pips unchanged; a script face at 13px on a 540-wide frame costs readability and would cost an asset file. DOM block 118.6×72.9 at (31.2,42.4) sits inside the 228×80 paper and ends at y 115.3, above the board's 128.

**Two harness hardenings were needed to report criterion 1 at all** (measurement only — no shipped behaviour moved):
- **`measureFg`.** The payoff sequence deliberately waits while the document is hidden (§18), which is right on a phone and makes the sequence unmeasurable in a preview iframe that is backgrounded for the whole run: seven correct behaviours reported as failures (`sequence.incomplete`, `garden-prep.handoff`, `free-cut.noResult`/`pieces`, `staging.×3`). The suite now measures as a foreground app, sets the flag itself, restores it, and reports `env.hostHidden` beside the numbers. Proof it is measurement and not a change: run 2 ran with `hostHidden: true` and still plated in 3193ms.
- **Spirit is seeded to `SPIRIT_BASE` before the growth assertions.** Spirit is monotonic by design, so a save already at 100 clamps every write and growth becomes unmeasurable — `spirit.learningDidNotGrow` on a well-played save is a full save, not a defect. The suite already snapshots and restores the key.

**Device pass (§14) — the only tuning that matters this phase (5A):** the board still reads as the hero (91.9% × 77.9% of the frame at full contrast; everything behind the table at half resolution and flattened by `BG_CONTRAST` 0.42), and the room reads hand-placed rather than generated (nothing is procedurally positioned; the towel is 2.4° off square, the oil bottle 1.6° off axis, the clipboard −1.1°). The serving hatch is the one element to watch on a tall device: it sits at `HATCH_Y` 992, below the 540×960 working frame, so it exists only in the vertical bleed — one number moves it if it pulls the eye down.

## PHASE 5B — CAMERA AND FLOW (BUILT, measured)

DESIGN.md Part VI-D (§61–64). 5A built a room; 5B makes it one space the player moves within. No gameplay changed.

**Built:** `Camera` (four states, one `{zoom, pan}` transform about the board centre, per-layer parallax, idle drift) · `SceneFlow` (one state machine, two paths, gated on `hasCompletedFirstRecipe`) · pointer mapping through the camera inverse in the shared path · the **chef's hands** taking the plate · the handoff sequence and the pull-back reveal. New CONFIG blocks: `camera`, `sceneflow`. Named apart from `Flow` (§16) on purpose — that is the hidden quality value, this is *scene* flow.

**Acceptance evidence (measured, both `regress()` runs green with zero fails):**
1. `regress()` **pass, 0 fails.** Phases 1–5A identical — spread 100/71/10 ×4, parity 0, ghost 0, gate `001`, rhythm +10/+10, diagonals 100, minGap 33.65px, six recipes 100 Masterful at 7/9/16/11/17/7 pieces, plate containment per recipe and per julienne direction, cadence/quantize/flow/spirit numbers unmoved.
2. **Cut fidelity is camera-independent** — the riskiest thing in the phase, so it is measured through the real pointer path: identical cut positions and grades at all five framings (ROOM, STATION, PLATE, HANDOFF, mid-tween), **pointer round-trip error 0.000000**. One inverse, in one place, reading the same `eff()` the matrices read.
3. **No rotation anywhere:** `audit()` over the camera's nine functions reports `rotateInSource: 0`, and `world.b/c` and `blit.b/c` are literal `0` — the constraint is structural, not a convention.
4. **STATION is 5A bit for bit:** zoom exactly 1, pan 0/0, `atRest: true`, world matrix identical, room still one blit.
5. **Returning path:** starts in ROOM, hold 600ms (clamped against the `INTRO_MAX_MS` 1500 ceiling), push 380ms → **cuttable at 608ms**. Calm, not a cutscene.
6. **Input during the intro wins:** touch at 200ms → cuttable at **208ms total, ≤120ms after the touch** (`SKIP_PUSH_MS` 110). No path makes a player wait for a camera.
7. **First-ever path launches at STATION** — §40 untouched: recipe on frame 1, ghost hand at 500ms, room not rendered at all. The reveal is the pull-back after the first plate, not a load-time cutscene.
8. **Handoff: 3790–3798ms total against a `SEQ_CEILING_MS` of 4200.** Hands 440 enter / 60 grip / 400 exit = 900ms, overlapped by `HANDS_LEAD_MS` **300** → +600ms net on the payoff. Plate taken, board clear on return, result read from ROOM. A **skip takes the plate too** (`phase: result`, `plateTaken: true`, camera ROOM) — the board is never left dressed.
9. **Cost: +0.078ms per frame** for all camera movement (budget 0.5ms), **zero room re-renders** through every push, pull and drift — the camera moves the blit, not the layers. `OVERSCAN` 1.26 so a pull-back shows room, not the edge of the world.
10. **Idle drift is the room, never the board:** ≤2% zoom / ≤6px pan over ~20s, ROOM only, refused while `phase === 'cutting'`, in over 900ms and gone within 180ms of input. Payload unchanged — zero new asset files.

**PAYOFF BUDGET — `SEQ_CEILING_MS` 4200, ~400ms of real headroom.** The ceiling was 3900 with 21ms of margin, and that margin broke the first time the suite instrumented these very frames (two GPU readbacks pushed the sequence to 4122ms — a failure the measurement itself caused). 5C adds per-frame work to the same frames, so **the ceiling moved rather than the hands**: it is now a number in `CONFIG.sceneflow`, read by both the report and the assertion, and the sequence measures 3790–3798ms under it. Spend the headroom deliberately and re-measure; if a 5C addition eats it, grow `HANDS_LEAD_MS` past 300 or compress the plate stagger — the suite measures both. **Never buy time back by shortening the hands** (440/60/400): a snatched plate closes nothing, which is the entire reason they exist.

**Not built (by scope):** steam, birds, plants, curtains, dust motes, kitchen ambient audio, time-of-day cycle (5C) · doorway, customers, waiters, hatch life (5D) · Head Chef praise, story arcs, and any part of him beyond hands (5E) · menus, settings, cosmetics. `AmbientManager`, `RestaurantManager`, `ChefController` and `CustomerManager` are still **not stubbed**.

**Device pass (§14) — open:** whether the pull-back reads as a reveal rather than a zoom-out, and whether the returning intro reads as calm rather than as waiting (600ms hold, one number). `HANDS_LEAD_MS` 300 may want ±40ms if the hands read as arriving early or late against the last pieces settling.

## PHASE 5A-2 — KITCHEN COMPOSITION PASS (BUILT, measured)

DESIGN.md §53a–§53f. Reference-driven layout fix: composition and value, canvas-drawn, zero assets. No
gameplay, scoring, sequence timing or STATION framing changed.

**Built:** the receding table and the board drawn as a trapezoid with an edge slab and contact shadow
(`boardQuad` / `boardFacePath`, paint only) · the value grade (`ROOM_SHADE` + far/near/mid/vignette/pool, five
numbers) · the near-edge object cluster at ~2× scale, overlapping and cropped by the left and bottom frame
edges · the mid band (back counter, jars, plant) inside the far layer · cool daylight outside the glass
against warm light inside · `__kcTest.valueProbe()` and three permanent value assertions.

**Acceptance evidence (measured):**
1. `regress()` **pass, 0 fails** on two consecutive runs — spread 100/71/10 ×4, parity 0, ghost 0, gate `001`, six
   recipes Masterful at 7/9/16/11/17/7 pieces, plate containment, camera states, handoff sequence 3790/3798ms
   against the 4200 ceiling.
2. **Board untouched:** cut rect 496×748 at (22,128); pointer round trip **err 0.000000**; `roomIntrudes:
   false`, `intruders: []`. The drawn quad is 74→466 at y128 and 4→536 at y876 — paint that never reaches the
   geometry.
3. **Value inverted, off rendered pixels.** Grade off → board 115.6, wall 187.0, table 148.0, corners 184.8,
   **board÷room 0.67** (the room was brighter than the board). Grade on → board **140.0** (97.6–172.3), wall
   106.6, table 91.9, corners 66.3, **board÷room 1.59**, board÷corners **2.11**, `brightest: 'board'`.
   Permanent assertions: brightest must be the board, board÷room ≥ 1.25, board÷corners ≥ 1.9.
3b. **Legibility held, and now asserted.** The first build graded the order clipboard with everything else and
   dropped the recipe name to **1.7:1** — every existing clipboard assertion passed, because they checked type
   size and geometry and never contrast. The clipboard is now drawn after the pool/vignette pass and keeps its
   5A paper value (lum 241.6): **title 6.79:1**. The objective line then measured 3.04:1 — Phase 3's
   `rgba(80,84,90,0.65)`, not something this pass moved — and was raised to `.88` for **5.07:1**. Both lines
   are asserted at AA (≥4.5:1) off rendered pixels, so no later grade tweak can take the paper out from under
   the one always-on piece of reading in the game.
4. **Depth ladder without a third layer:** `renderers: 1`, `layers: [far, near]` unchanged; the mid band is a
   relieved strip inside the far layer (`MID_RELIEF` 0.60), so contrast and warmth rise across far → mid →
   near.
5. **Cost unchanged:** kitchen 0.005ms per frame, worst re-render far 0.8 / near 1.2 / composite 0.5ms, 0
   re-renders for two identical frames, camera delta −0.125ms against a 0.5ms budget, composite 1525×842.
6. **Payload unchanged:** zero new asset files, still one file.
7. Flow light still inside its bound from the brighter base: 173.3 → 181.2 (+4.56%, cap 8%).

**Decision worth keeping:** the brief asked for a large basket at **mid-height beside the board**. The board
owns x 22..518 of a 540 frame, so at mid-height there is a 22px strip and nothing else — anything larger would
enter the gesture area (and trip `roomIntrudes`) or be hidden behind the board. The basket is at the near left
instead, 212×128 and cropped by the frame edge. The board rect was not negotiable; the placement was.

**Measurement notes (three, all measurement-only — no shipped behaviour moved):**
- `KitchenScene.refresh()` was added for the probes. The room is rate-limited to one re-render per 220ms by
  design, so a before/after measurement taken inside that window silently reads the same composite twice — the
  first value run reported an unchanged room for exactly that reason. Nothing in the game calls `refresh()`.
- **Both probes sample through `Camera.forwardView` and measure from a snapped STATION framing**, restoring the
  camera afterwards. Sampling design coordinates through `view` alone reads whatever the camera happens to be
  pointing at: run at the end of the suite with the camera at ROOM, the clipboard probe sampled dark wall and
  reported a 1.04:1 failure that was pure measurement. Identical numbers now come back from ROOM and STATION.
- **Both probes run last in the suite.** They force a room re-render and read pixels back off the GPU; a
  readback stall lands on the following frames, and run before the payoff it pushed the handoff sequence to
  4122ms against what was then a 3900ms ceiling — a timing failure the measurement itself caused. Moved after
  the camera block, the sequence measures 3790–3798ms. That break is why the ceiling is now 4200 (above).
- **The hands are scheduled from their deadline, not from the frame that noticed it.** `startHandoff` was
  passed `gn`, so under a sparse frame cadence the whole 900ms slid by however far `gn` had overshot the
  trigger (676ms measured on a loaded host). It now takes `plate.endAt − HANDS_LEAD_MS`. Every other deadline
  in the payoff was already absolute (§18); this one was the exception.

**Device pass (§14) — open:** the near cluster only has the 84px band below the board plus the vertical bleed,
so on a short device it crops harder than the reference; and the wall wedges beside the table's far end are
visible on wide/landscape hosts (the far layer below the table line is warm-dark for that reason). Both are
one number each (`PERSP_TOP_IN`, the near cluster's y) if the device pass disagrees.
