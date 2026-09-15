# Phase 17A — Cluster Primitive + Basil & Parsley

Report against §18's 17 items. Where I verified something, I say how. Where I did not, I say so.

---

## 1. Cluster geometry architecture

New `cluster` entry in `SILS`, satisfying the same five-function contract as `ellipse`, `capsule` and
`taper`. Geometry is one field: `leaves`, an array of rotated ellipse lobes `{dx, dy, rx, ry, rot, stem}`
offset from the ingredient's `cx/cy`.

| function | cluster implementation |
|---|---|
| `inside` | true if inside ANY lobe (exact, per-lobe) |
| `spanX` / `spanY` | `mergeParts()` over per-lobe `lobeSpan()` |
| `support` | max projection over all lobes, then `min(-lo, hi)` — the conservative form `taper` already used |
| `trace` | one closed subpath per lobe; nonzero winding unions the overlaps |

`lobeSpan()` substitutes the lobe's rotation into the ellipse equation, leaving a quadratic in the free
coordinate — solved analytically, not scanned, so it is cheaper than `taper.spanX`.

`fitCluster()` derives `rx/ry` (the bounding half-extents that drive the sprite canvas, the cut bands and
the plate fit) from the leaf list at startup. They are never hand-written, so editing a leaf cannot leave
them stale. Basil computes to 159×130, parsley to 139×124.

## 2. How backward compatibility was preserved

This is the part worth reading. **No existing call site changed, and no return type changed.**

The insight is that a multi-interval span object can also BE a single interval. `mergeParts()` returns
`{lo, hi, parts}` where `lo`/`hi` are the outer hull and `parts` holds the real separations. Every
existing consumer reads `.lo`/`.hi` and behaves exactly as it does for an ellipse; only code that wants
the gaps looks at `.parts`. Convex shapes still return bare `{lo, hi}` on their original fast path.

That the gaps are ignored by seams, the ghost line and replay is **correct, not a compromise**: all three
are stroked inside the per-piece clip, so `silPath` trims them to the leaves automatically. The hull is
the right line; the clip does the rest.

Three genuine adjustments were needed:

- **`regionGeom` centroid** — the sampling loop trusted `spanX` to be solid food, true only for a convex
  body. Added `insideSil(x,y)` to the test. Redundant for existing shapes, load-bearing for a cluster.
- **`regionGeom` centroid, part two** — see item 16.
- **`setIngredient`** — added `delete T.leaves`. `Object.assign` only copies what the incoming geom owns,
  so a leftover leaf list would have left a tomato clipping to basil's bunch. Same trap the existing
  `__paths`/`__in`/`__sup` deletes already guard.

## 3. Basil implementation

8 broad ovate blades + 5 stems, deliberately asymmetric, with real gaps. `PAINT.basil` draws each blade
in its own lobe frame, so the painting and the geometry are the same bunch — a cut that misses a leaf
misses its paint too. Blades are ovate Béziers inscribed in their lobe ellipse (tip on the boundary,
flanks slightly inside) so clipping never shaves an edge. Midrib, four pairs of side veins at alpha 0.20,
a soft sheen, a 0.30 edge stroke, and four green tones cycled across leaves.

## 4. Basil Chop result — PASS

Chop is a 3×3 **grid** (`counts`, `perpSnap` — dice's existing fields), not a parallel set. This was a
change I made after seeing the first result: six parallel cuts on a bunch produce ribbons, which is
chiffonade, so the two techniques were visually identical. Crossing the cuts gives the irregular leafy
fragments §7 asks for, and the irregularity is free — every grid cell meets a different part of the
cluster, so no two fragments are the same shape. 16 pieces, verified in `screenshots/basil-states.png`.

## 5. Basil Chiffonade result — PASS

8 ribbons. Each is a band of the cluster, so ribbons have leafy edges, varied widths, internal gaps and
visible veins — "visibly derived from leaves" with no ribbon-specific art. Verified in
`screenshots/basil-states.png` (bands drawn apart to show each one).

Honest caveat: because the leaves lie mostly along the board's length and the chiffonade cuts run across
it, a ribbon crosses several leaves rather than running down one. It reads as cut basil, not as a
mechanical strip, so it clears §7's bar — but it is not the "one leaf rolled and sliced" ideal.

## 6. Parsley implementation — took two attempts

**The architectural test passed on the first attempt: parsley added ZERO lines of geometry.** Same
`cluster` shape, same five functions, only different leaf data — 17 small leaflets in trifoliate groups
of three around six stem tips. That is the result §9 was actually asking for.

The **art** failed first time and I am flagging it because the failure is instructive. I built each
leaflet from three overlapping circles, expecting "frilly". It rendered as **broccoli florets** — round
lobes read bobbly. Replaced with a deeply toothed ovate profile built from straight segments, so the teeth
stay angular. Tuned on a three-way render sweep (`screenshots/parsley-candidates.png`): 3.2 teeth/0.42
depth read as oak leaf, 5.6/0.56 as thistle; shipped 4.4/0.50. Stems thinned from 4.0/3.6 to 3.4/3.0.

**Third attempt, and the real lesson.** 4.4/0.50 was still wrong, and wrong for a reason worth recording:
I tuned it on an offscreen sweep rendered at roughly double game size. A leaflet is 66 design px, which
`designToClient` puts at **37.1 on-screen px** — so 4.4 teeth at 0.50 depth land as ~4px spikes, and at board
scale 4.4/0.50 renders where 5.6/0.56 rendered in my preview. I had already rejected that as thistle and
then shipped it anyway, one scale factor removed. Now 3.6/0.32, judged on a raster rendered at the true
147×135 px and then magnified (`screenshots/parsley-truescale.png`) rather than at sandbox size.

**Density.** Parsley was also the sparsest food in the game — 48.8% of its own bounding box was food,
against basil 62%, tomato 77.3%, cucumber 93.7% — and a scanline through the middle of the bunch crossed
only ONE run, so the trifoliate structure never read as a cluster. Pulled every leaflet 15% toward the
centre and added three to close the mid band: now **60.5%** coverage, level with basil, and the mid scanline
crosses 3 runs. `fitCluster()` recomputed 139×124 → 123×109 with no bounds to hand-edit — which is exactly
why those numbers are derived.

## 7–12. Lemon, Avocado, Eggplant, Cheddar, Baguette, Broccoli — NOT STARTED

§8 gates these behind basil, and §10 behind parsley. Both now pass, so the batch is unblocked, but I
stopped here rather than start six ingredients I could not verify in the remaining budget.

## 13. Per-ingredient seam colour (§14) — done

`seamTint(src)` resolves the seam block from the ingredient profile, falling back to `CONFIG.render` so an
ingredient without one is unchanged. `strokeSeam` takes the piece's `src`, so a multi-ingredient prep
tints each piece's seams by the food it was cut from. `strokePreScore` resolves through `activeSrc`.

| ingredient | seamDark |
|---|---|
| tomato | `rgba(148,42,38,0.55)` — unchanged, per §14 |
| cucumber | `rgba(32,64,26,0.50)` |
| carrot | `rgba(132,58,10,0.50)` |
| basil | `rgba(22,44,14,0.72)` |
| parsley | `rgba(18,40,12,0.72)` |

Basil's alpha is higher than the others for a measured reason. My first values were 0.50/0.85, and
sampling the live canvas across a seam gave `130,169,98` against a leaf of `135,174,103` — about 4%
apart. Green-on-green gives none of the contrast tomato gets from pale flesh against red skin, so the cut
was invisible at board scale, which is a feedback failure on a technique built entirely from cuts. Raised
to 0.72 dark against a brightened `rgba(228,246,200,0.95)` flesh. Re-measured after the change: **25.4%**
luminance contrast across the seam (118.5 → 158.8, hard step). The frame that looked unchanged to me was a
downscaled-screenshot artifact, not a failed fix.

## 14. Existing-ingredient regression — VERIFIED, `regress()` green twice

`regress()` ran green **twice** — 31.7s and 12.0s, `pass: true`, zero failures — in an unthrottled render
loop. All ten recipes plate the expected count: tomato-slice-6 7/7, cucumber-slice-8 9/9, tomato-dice-3×3
16/16, carrot-julienne-10 11/11, garden-prep 17/17, free-cut 7/7. **No §15 regression exists.**

Worth recording why I could not get this myself: the preview's `requestAnimationFrame` was throttled to
near-zero (a 12s run sat at recipe 0 of 10 after 45s; an `await`-on-rAF probe timed out). The suite is
phase-driven, so it crawls rather than fails. I reported it unverified rather than claim green, which was
right — but the lesson is that a stalled loop is an environment symptom, not a code signal.

The loop-independent check I used in the meantime (partition is synchronous) also stands:

| recipe | pieces | centroids off food |
|---|---|---|
| tomato-slice-6 | 6 | 0 |
| cucumber-slice-8 | 8 | 0 |
| tomato-dice-3×3 | 12 | 0 |
| carrot-julienne-10 | 10 | 0 |
| basil-chiffonade | 8 | 0 |
| basil-chop | 12 | 0 |
| parsley-chop | 12 | 0 |
| parsley-chiffonade | 8 | 0 |

Every count is correct, every seam tint resolves to the right ingredient, pointer round-trip error is
**0**, and the drawn face is still **492×430**. Basil's in-game partition was also checked in detail: 7
cuts → 8 pieces with constraint counts descending 7,6,5,4,3,2,1 and centroids spread 142→374 across x.

## 15. Exact changes

`knifecraft.html` only. No new files, no new dependencies.

- `CONFIG.INGREDIENTS.tomato/cucumber/carrot` — added `seam` blocks (no other field touched)
- `CONFIG.INGREDIENTS.basil`, `.parsley` — new profiles
- `CONFIG.recipes.RECIPES` — added `basil-chiffonade`, `basil-chop`, `parsley-chop`,
  `parsley-chiffonade`; inserted before `garden-prep` so `free-cut` stays last (the suite's `full` flag
  keys off the last index)
- `SILS.cluster` — new; `lobeInside`, `lobeSpan`, `mergeParts`, `fitCluster` — new helpers
- `spanAt` — passes `parts` through
- `setIngredient` — `delete T.leaves`
- `regionGeom` — `insideSil` in the sample test; off-food centroid snap
- `seamTint` — new; `strokeSeam` takes `src`; `strokePreScore` resolves via `activeSrc`
- `PAINT.basil`, `PAINT.parsley` — new

Untouched: kitchen, camera, plating layout, scoring, save, board geometry, pointer mapping, cut engine.

## 16. Limitations

1. **A cluster piece's centroid is not naturally on the food.** Two leaf tips either side of a gap average
   to the air between them. Measured: basil-chop 1 piece, parsley-chiffonade 4 of 8. Since `(gx,gy)` is
   the pivot plating rotates and scales about, those fragments swung around nothing. Fixed by snapping an
   off-food mean to the nearest sampled interior point — provably inert for convex bodies, whose mean is
   always inside their own region. Re-verified: 0 off-food across all 8 recipes. **Any port must not
   assume the centroid of a piece lies inside the silhouette.**
2. **Blades are inscribed in their lobe ellipses**, so `inside()` reports a few px of empty space near
   leaf tips as food. Affects tap hit-testing marginally; invisible in play.
3. **Chiffonade ribbons cross several leaves** rather than running along one — see item 5.
4. The replay overlay draws cut lines across the hull, including gaps. Pre-existing behaviour, shared with
   every ingredient; it reads fine but is worth a look if herbs get a dedicated replay.

## 17. What must be done differently when porting

1. **Do not port `{lo, hi, parts}` as a union type.** In TypeScript make it one interface where `parts` is
   optional and `lo`/`hi` are always the hull. The compatibility win comes from clusters being *readable
   as* single intervals, not from callers branching.
2. **Widen, never replace.** Convex shapes must keep their analytic fast path; `spanX` is called per
   scanline in the centroid sampler.
3. **Port the centroid snap with the cluster**, not after. Without it herb plating pivots on empty air, and
   the symptom (fragments arranged slightly wrong) does not obviously point at the centroid.
4. **Seam tint per ingredient before the roster grows.** Trivial now; 35 ingredients of tomato-red seams
   later is tedious and someone will ship it.
5. **Derive cluster bounds in code** (`fitCluster`), never hand-write them — they feed texture memory
   allocation, so a stale value is a clipped sprite.
6. **Chop must be a crossed grid, not a parallel set**, or it is indistinguishable from chiffonade.
7. Herb seam contrast needs its own alphas. The values that read on red tomato flesh vanish on green.
8. **Tune organic detail at true on-screen scale, never in an offscreen sandbox.** Parsley's teeth were
   tuned at ~2× game size and shipped as a sawblade; a leaflet is 66 design px but 37 on-screen px. Any
   frequency-based detail — serration, ridging, crumb, seeds — has to be judged at the size the player
   sees, which for the port means at final device scale, not in a component harness.
9. **Measure silhouette coverage when adding cluster food.** Parsley sat at 48.8% of its bounding box and
   read as scattered specks; 60% is where it began reading as a bunch. Cheap metric, catches sparseness
   before it reaches art review.
