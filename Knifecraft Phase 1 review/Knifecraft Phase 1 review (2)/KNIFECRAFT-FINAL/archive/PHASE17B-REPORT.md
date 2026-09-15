# Phase 17B — Lemon, Avocado, Eggplant, Cheddar, Baguette, Broccoli

All six implemented and through the true-scale visual gate. Two failed that gate on the first attempt and
were rebuilt; both failures are recorded because the causes generalise.

**Evidence:** `screenshots/17b-truescale.png` (first pass, whole), `17b-truescale-fixed.png` (cheddar +
baguette after fixes), `17b-av-eg-fixed.png` (avocado + eggplant rebuilt), `17b-cuts.png` (cut faces, all
six). Every render is rasterised at the real on-screen size — the ingredient's own `PAINT` function through
`silPath`/`innerGeom`, scaled by the measured 0.562 design→screen factor — then magnified for inspection.
This is the §CRITICAL-TESTING-RULE method, and it is what caught both failures.

---

## Geometry summary

| ingredient | silhouette | new geometry? | on-screen size |
|---|---|---|---|
| Lemon | `ellipse` | no | 162×133 |
| Avocado | `taper` | no | 171×117 |
| Eggplant | `taper` | no | 192×113 |
| Cheddar | **`wedge`** | **yes — the only one** | 162×115 |
| Baguette | `capsule` | no | 259×77 |
| Broccoli | `cluster` | no | 221×134 |

Five of six reuse existing silhouettes. One new primitive in the whole phase.

---

## 1. Lemon — PASS first time

`ellipse`, 126×100, `lobes:0`. No new geometry.

The citrus reading is entirely paint depth: rind → **pith** → flesh → radial membranes, three concentric
layers via `innerGeom` (11 and 17). The pith is the load-bearing one — without a white ring between peel
and flesh, a cut reads as melon. Nine segments with a 3.2px membrane and five juice vesicles each; peel
pores scattered on the golden angle (deterministic, no RNG, so the sprite is stable across rebuilds).

**Cut result:** each slice shows rind, pith ring and radial segments — an unmistakable lemon cross-section.

**Radial: NOT IMPLEMENTED — reporting instead of improvising (§STOP-1).** This prototype has no Radial
technique. It has Slice, Dice, Julienne and Free, plus the Chop and Chiffonade added in 17A. Radial needs
cuts constrained to pass through the centre at distributed angles: a new placement rule *and* a new scoring
rule, i.e. a new mechanic, which §"DO NOT INVENT NEW GAMEPLAY" forbids. Lemon ships on **Slice ×6** across
the short axis, which produces exactly the cross-section the brief asks to see, so nothing visual is lost.
Radial is a production-repo decision.

## 2. Avocado — FAILED the gate, rebuilt

**Geometry: `taper`, not `cluster` — and that reversal is the most useful finding in this phase.**

I built it first as a 2-lobe cluster. A pear is not one ellipse, cluster already unions overlapping lobes,
and it cost no new geometry — it looked like the obvious right answer. At true scale it read as a
**snowman**: two visible circles with a pinched waist, plus a crescent of skin showing through at the
concave junction where the two individually-inset flesh lobes pulled apart. Widening the overlap and
increasing the size differential reduced but did not remove it — the pinch is inherent to unioning circles.

`taper` sweeps ONE radius big→small, so the outline is single and smooth. 134×86, `rBig:86 rSmall:42`,
`buttRound:0.46`. One smooth pear body, no junction, no pinch.

**The generalisable rule: `cluster` is for food that genuinely IS separate bodies (herbs, florets). For a
smooth continuous body with a waist, a swept-radius shape is correct.** Reaching for cluster because it is
flexible produces visible seams.

**Pit: paint, not a hole — deliberately, and this is an architecture answer, not a shortcut.** The brief
allows a real hole "if the existing clipping system requires it". It does not, and a real hole would be
actively wrong: `inside()` returning false in the pit means a single cut piece can become **two
disconnected regions**, which `regionGeom`'s one-centroid-per-region model cannot represent — the piece
would get one pivot for two separated fragments. Paint gives the correct visual with no topology change.

**Halve result:** 2 pieces — one carrying the pit, one clean flesh, both with dark skin rim and the pale rim
where flesh meets stone. Exactly what Halve should produce.

**New topology required: none.**

## 3. Eggplant — FAILED the gate, rebuilt

`taper`, reused from carrot but far less extreme: 152×82, `rBig:82 rSmall:46` against carrot's 56→10. A
capsule has parallel sides and a taper swells, which is what keeps it from reading as a purple cucumber.

**The failure was skin thickness.** I started at `innerGeom(g, 13)`, proportionally close to cucumber's
9-of-52. Cucumber gets away with a 17% rim because green-on-pale-green is a quiet edge. Purple against
cream is the loudest pair in the game, so at 17% the pale interior won outright and it read as a **parsnip
with a purple outline**. Now inset 46 — the body reads purple, and a cut face still opens onto a generous
cream centre.

**Rule: rind thickness is not a constant fraction — it scales with the skin/flesh contrast.** A loud pair
needs a proportionally thicker rind than a quiet one to read as the same food.

Also: green calyx of five overlapping blades at the narrow end, sparse seed speckle, single sheen highlight.

**Cut result:** thick purple rim, cream centre with speckle, on every slice.

## 4. Cheddar — PASS after one fix

**`wedge` — the only new geometry in the phase.** Cheese is the first non-organic food, and every existing
silhouette is built from swept circles, so all of them round the corners a cheese block must keep sharp.
`wedge` is a straight-edged trapezoid: `rx`, `ry`, `topFrac` (0.46). Analytic like the rest — `spanX`
interpolates the half-width, `spanY` solves for the first scanline reaching a column, `support` takes the
max over four corners (a convex polygon's support *is* its corners), `trace` walks the four edges with a
5px corner radius so it reads as a knife-cut block rather than a pillow.

**No rind inset** — cheese is the same material throughout, so a cut face is simply more cheese. That is
the §6 "solid and dense" requirement expressed as an absence rather than an addition.

**Fixed after the gate:** the lit top facet was a plain rectangle whose edges didn't follow the wedge, so it
read as a pasted-on strip. Now a trapezoid computed from `SILS.wedge.hw()` at two heights, so it follows
the tapering sides and reads as a bevel.

**Cut result:** six solid slices, uniform colour through the cut, slightly angled ends from the wedge sides.

## 5. Baguette — PASS after one fix

`capsule`, reused from cucumber: 212×50, `capR:50`. Crust→crumb is the same `innerGeom` trick as skin/flesh
(inset 15), which is what makes a slice expose pale crumb automatically rather than crust-coloured pixels —
the §7 requirement, satisfied structurally.

Crumb texture is 170 air pockets, each a shadow dot plus an offset highlight dot, on the golden angle.
Subordinate to the silhouette as required: visible as texture, never as pattern.

**Fixed after the gate:** the scoring was five full-length 9px slashes at alpha 0.55, and at true scale they
read as brown **dowels lying on the crumb**. Now short (26px), thinner (5.5px), alpha 0.34, positioned high
on the loaf with a pale lower lip — a surface mark rather than an object.

**Slice result:** eight slices, each pale crumb with a golden crust rim and visible pockets.

## 6. Broccoli — PASS first time

`cluster`, and the reason 17A's `stem` flag was worth having: the main stalk and two branch stems are
stem-flagged lobes, the crown is nine florets of varied size. **Same primitive as basil and parsley, a third
completely different silhouette character out of it** — the strongest evidence yet that the cluster
abstraction is right.

The §8 trap is "broccoli made from repeated balls", so no floret is a circle: each is a wobbled radial path
with three harmonics (3, 5, 8 cycles) at a per-floret phase derived from its index, so no two crowns share
an outline. 64 buds per floret, each a shadow dot plus a lighter offset dot, give the granular crown
texture. Stalk is pale green with along-the-axis fibre; florets are dark with a per-floret brightness jitter
so they read as overlapping depth.

**Cut result:** floret fragments keep their bud texture and dark green; stalk fragments stay pale and
fibrous. The two materials stay distinguishable after cutting, which was the hard part.

**One honest note:** broccoli's chop yields **10 pieces, not 12**. Two of the 3×3 grid cells contain no food
— they fall in gaps between crown and stalk. Correct behaviour for a genuinely disconnected silhouette (the
partition creates regions only where food exists), not a defect, but a production recipe must not assume
`pieces === h × v` for cluster ingredients.

---

## 7. Regression — verified structurally; `regress()` NOT completed this turn

**I could not complete a `regress()` run and I am not claiming green.** The preview's `requestAnimationFrame`
is throttled to near-zero again: 40s after starting, the suite was still on recipe 0 of 16. Same
environmental condition as 17A, where your own run came back green twice. Not evidence of a regression, but
unverified by me.

What I did verify, with a check that does not depend on the render loop (partition is synchronous), across
**all eleven recipes**:

| recipe | shape | coverage | pieces | centroids off food |
|---|---|---|---|---|
| tomato-slice-6 | ellipse | 77.3% | 6 | 0 |
| cucumber-slice-8 | capsule | 93.7% | 8 | 0 |
| carrot-julienne-10 | taper | 56.8% | 10 | 0 |
| basil-chiffonade | cluster | 62.0% | 8 | 0 |
| parsley-chop | cluster | 60.5% | 12 | 0 |
| lemon-slice-6 | ellipse | 77.0% | 6 | 0 |
| avocado-halve | taper | — | 2 | 0 |
| eggplant-slice-8 | taper | 66.4% | 8 | 0 |
| cheddar-slice-6 | wedge | 72.4% | 6 | 0 |
| baguette-slice-8 | capsule | 94.1% | 8 | 0 |
| broccoli-chop | cluster | 48.3% | 10 | 0 |

Tomato, cucumber and carrot are **unchanged in geometry** — same `rx/ry`, same shapes, same piece counts,
same seam values as before this phase. Pointer round-trip error **0**. Drawn board face still **492×430**.

**Onion, Potato and Garlic do not exist in this prototype** — the roster here is tomato, cucumber, carrot
plus what 17A/17B added. They are production-repo ingredients, so the §REGRESSION list cannot be checked
here. Worth knowing before someone reads a green run as covering them.

**Broccoli's 48.3% coverage** sits at the sparseness threshold flagged in 17A (parsley read as scattered
specks at 48.8%). Here it is a false alarm: the stalk is legitimately thin, so it occupies little of the
bounding box while the crown itself is dense. The metric needs qualifying — measure the crown region, not
the whole box, for stalk-plus-cluster food.

## 8. Files and functions changed

`knifecraft.html` only. No new files, no new dependencies, no changes to the cut engine, camera, plating,
scoring, save, board geometry or pointer mapping.

- `SILS.wedge` — new silhouette (5 contract functions + `hw` helper)
- `CONFIG.INGREDIENTS` — six new profiles: `lemon`, `avocado`, `eggplant`, `cheddar`, `baguette`, `broccoli`
- `CONFIG.recipes.RECIPES` — six new recipes, inserted before `garden-prep` so `free-cut` stays last (the
  suite's `full` flag keys off the last index)
- `PAINT.lemon`, `.avocado`, `.eggplant`, `.cheddar`, `.baguette`, `.broccoli` — new

## 9. Architecture extensions

Exactly one: `SILS.wedge`. Additive — a new entry alongside `ellipse`/`capsule`/`taper`/`cluster`, touching
no existing shape and no consumer.

The cluster primitive was **not** extended for broccoli's stalk-plus-crown. The `stem` flag already carried
it. That was the case §8 warned might need "the smallest additive extension possible", and it needed none.

## 10. Remaining visual defects

1. **Avocado's flesh is slightly cone-like** rather than a true pear curve — `taper`'s linear radius sweep is
   straighter than a real avocado's shoulder. Reads correctly at gameplay scale; an exact profile would want
   a curved sweep (a `taperCurve` parameter).
2. **Broccoli chop yields 10 of 12 cells** — correct, documented above, but "Chop 3×3" displayed alongside
   10 pieces could confuse.
3. **Cheddar is a plain wedge.** It passes and it is dense and solid, but it is the least characterful of the
   six; it would benefit from a slightly uneven cut edge.
4. **Lemon has no Radial**, per §STOP-1 above.

## 11. Porting notes for the production repo

Additions to 17A's list:

1. **`cluster` is not the universal organic shape.** Use it where the food genuinely is separate bodies. For
   a smooth body with a waist (avocado, pear, butternut), a swept-radius taper is correct — cluster's
   circle-union shows a visible pinch and leaks skin at concave junctions.
2. **Rind thickness scales with skin/flesh contrast, not with body size.** Cucumber's 17% rim works because
   green-on-pale-green is quiet; eggplant needed 39% because purple-on-cream is loud. Any port that copies a
   single "rind fraction" constant will produce parsnip-coloured eggplants.
3. **A pit/stone must be paint, not a hole**, unless the piece model is first extended to hold multiple
   disconnected regions per piece with independent pivots. Not worth doing for a visual the clip model
   already delivers.
4. **`wedge` is needed for every non-organic food** — cheese, butter, tofu, bread ends. Port it with the
   cluster, not later; the swept-circle shapes cannot make a sharp corner.
5. **Do not assume `pieces === h × v`** for cluster ingredients. Grid cells landing in gaps produce no piece.
6. **Deterministic scatter, not RNG.** All texture here uses the golden angle plus index-derived jitter, so
   sprites are stable across rebuilds and identical between any two renders. An `rng()` inside a paint
   function makes the food change appearance every time the cache rebuilds.
7. **Cheese needs no rind inset.** Resist applying the skin/flesh pattern universally — for a homogeneous
   food a cut face is just more of the same material, and insetting invents a rind that isn't there.
