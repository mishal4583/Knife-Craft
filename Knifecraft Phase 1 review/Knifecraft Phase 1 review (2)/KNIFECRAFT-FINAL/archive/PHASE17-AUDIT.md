# Phase 17 — Ingredient Visual Audit

**Scope note, read first.** This prompt is addressed to Claude Code operating on the KnifeCraft
repo. That repo is not in this project. What *is* here is `knifecraft.html` — the original Claude
Design prototype, i.e. the thing the prompt names as the visual reference. So this audit covers the
half I can actually inspect: **what the reference does, why it works, and what contract the repo must
satisfy to inherit it.** Sections A, G, H and I need the repo and are marked as such.

One finding overrides everything else, so it goes first.

---

## THE HEADLINE: the prototype has no ingredient images, and that is *why* its cuts look good

The prototype renders every ingredient procedurally into a cached offscreen canvas, then **clips that
one canvas per piece**. Full pipeline, `knifecraft.html`:

```
PAINT[id](c2, geom)      →  ingSprite(id)          →  drawIngredient(p.src)
procedural canvas art       one cached offscreen      blitted per piece, clipped by
(lines 3063–3140)           canvas per ingredient     silhouette + each cut's half-plane
                            (2× supersampled)         (drawPieces, lines 3022–3033)
```

The critical line is in `drawPieces`:

```js
ctx.clip(silPath(pieceGeom(p), 1.5));
for(const cn of p.cons) clipHalfPlane(cn);
drawIngredient(p.src);          // ← the SAME sprite, every piece
```

**A cut piece is not new art. It is the whole ingredient's painting, clipped.** That is the entire
reason §13's requirement ("cut results must also look good", "cut results should remain visually
associated with the original ingredient") is satisfied in the reference — it is satisfied
*structurally*, and it cost zero cut-specific artwork.

### Why this kills the WebP plan

§12 says "Prefer WebP with transparency." **For this renderer that is the wrong call, and it would
regress the exact quality you are trying to import.** Two concrete reasons:

**1. A flat bitmap has no interior.** The cucumber reads as a cucumber *at any cut angle* because
`innerGeom(g, 9)` insets the silhouette by 9px and paints a second two-tone inside it — dark skin
`#5C8A42→#2C4E24`, pale flesh `#F3F8E6→#CBDDAA`. Any clip through that body therefore exposes pale
flesh with a dark rind edge, automatically, for free, forever. Clip a photographic WebP with a
half-plane and you get **skin-coloured pixels at the cut face** — the slice looks like a torn sticker,
not a cut. You would then have to author separate cut-face art per ingredient per technique, which is
a combinatorial art bill (11 techniques × 35 ingredients) that the procedural approach does not have.

**2. The silhouette is load-bearing geometry, not decoration.** `SILS[shape]` exposes five functions
the *gameplay* consumes:

| function | consumed by |
|---|---|
| `inside(g,x,y)` | hit-testing, piece partition |
| `spanX(g,y)` / `spanY(g,x)` | seam extents, ghost line, replay, `spanAcross` |
| `support(g,nx,ny)` | cut placement, no-room refusal, angled-set fitting |
| `trace(p,g,pad)` | `silPath` → clipping and per-piece contact shadow |

An image asset answers none of these. Ship WebP and you still need the analytic silhouette
underneath, so you end up maintaining **art and geometry as two sources of truth that drift.**

### Recommendation for §21-D

**Option A — improved procedural rendering — with a narrow hybrid exception.** Procedural for
everything whose silhouette the cutter must reason about (all vegetables, fruits, cheese, bakery).
Bitmap textures only as *fills clipped inside a procedural silhouette* (e.g. a bread-crumb texture
tile inside an analytic baguette outline), never as the silhouette itself. That keeps one source of
truth for geometry and gets you texture where procedural noise is weak.

This also resolves the §11 token concern in your favour: procedural ingredients are ~30 lines of
`PAINT` each. The tomato is 27 lines. That is cheaper than an asset pipeline, not more expensive.

---

## C. THE BASIL / PARSLEY PROBLEM — diagnosed

I cannot read the repo's basil/parsley code, but the reference architecture makes the cause almost
certain, and it is **not** an art problem.

Every silhouette the prototype ships is a **single closed convex-ish body**:

| shape | ingredient | character |
|---|---|---|
| `ellipse` | tomato | one round body, `rx:148 ry:128`, 5 lobe seams |
| `capsule` | cucumber | barrel `capR:52` swept across `rx:206` |
| `taper` | carrot | `rBig:56 → rSmall:10`, flat crown, run-out tip |

`spanX`/`spanY` return a **single `{lo,hi}` interval** — one entry and one exit per scanline. That
assumption is baked into seams, the ghost line, replay, and placement.

**A leafy herb is not one body. It is a cluster of bodies with gaps between them.** If the repo
defines basil or parsley as any existing single-body shape, a green blob is not a rendering mistake —
it is the only thing that shape *can* draw. New artwork will not fix it, because the silhouette
contract will keep collapsing the cluster back into one closed outline.

**The missing primitive is a cluster silhouette**, and it is the real deliverable of this phase:

- `spanX`/`spanY` must return **multiple intervals** (or the callers must accept a list)
- `inside()` becomes "inside any lobe"
- `support()` takes the outer hull, which is already how `taper.support` works (it scans and keeps the
  smaller reach) — so there is precedent to copy
- Chiffonade of a cluster must divide **leaves**, not one body

That last point is the gameplay consequence, and it is why this is architecture and not art. Flag it
against §14's "if an ingredient requires a genuinely new mechanic, STOP and report it."

---

## B. WHAT TRANSFERS FROM THE REFERENCE

Transfers cleanly — this is the "quality that worked":

1. **The sprite-clip model.** One procedural painting per ingredient, clipped per piece. Non-negotiable;
   it is the source of the cut quality.
2. **Skin/flesh two-tone via `innerGeom`.** The single highest-value trick in the file. Every
   ingredient with a rind gets believable cut faces for ~4 lines of code.
3. **The five-function silhouette contract.** Adding an ingredient is data, not a code path (§19).
4. **2× supersampled sprite cache.** `SPRITE_SS: 2`, `SPRITE_MARGIN: 14`. Paint once, blit many.
5. **Per-ingredient profile object** bundling geometry + resistance curve + audio + particles. The
   tomato/cucumber/carrot entries are the template for all 35.
6. **Restraint in the detail passes.** Ridges at `alpha 0.09`, lobe seams at `0.07`. The comments say
   it outright — *"ridges: a suggestion, not corrugation"*. This is what separates it from
   "generic colored polygon" far more than resolution does.

Does **not** transfer: the prototype is one 4,644-line HTML file with global `CONFIG` and a
module-less canvas loop. Do not import its structure. Import the model above.

---

## E. REFERENCE SPEC (exact values, for parity)

Design space `540×960`. Ingredients share `cx:270 cy:500` — deliberate, so cut intercepts stay
comparable across a multi-ingredient recipe.

```
tomato    ellipse  rx 148  ry 128  lobes 5      sprite 648×568
cucumber  capsule  rx 206  ry 52   capR 52      sprite 880×264
carrot    taper    rx 210  ry 56   rBig 56 rSmall 10  sprite 896×280
                            buttRound 0.16  tipRound 3.4
```

Sprite dimension rule: `ceil((r + SPRITE_MARGIN) * 2 * SPRITE_SS)`, margin 14, SS 2.

Palettes as shipped:

```
tomato    body   radial #E86A5C → #B93832 → #A02F2C
          spec   #FFF7EE @ 0.34      lobes #7E211E @ 0.07, lw 7
          crown  #6E8A54  stem #5C744A
cucumber  skin   #5C8A42 → #40702F → #2C4E24
          flesh  #F3F8E6 → #E4F0CB → #CBDDAA   (innerGeom inset 9)
          seeds  rgba(150,178,110,0.5)   highlight rgba(255,255,255,0.30)
carrot    body   #F5A24A → #E4822F → #C0631E
          core   rgba(255,214,158,0.36 → 0)     ridges rgba(132,60,12,0.09)
```

If the repo goes procedural, these are literals to port. If it ever does go bitmap, these are the
colours the art must match.

### One real gap found

`CONFIG.render` holds seam colour **globally**, not per ingredient:

```js
seamDark: 'rgba(148,42,38,0.55)',  seamFlesh: 'rgba(244,168,152,0.9)',
preScoreDark: 'rgba(118,29,26,0.72)',  preScoreFlesh: 'rgba(247,178,162,0.8)',
```

Those are **tomato reds**. Cutting the cucumber strokes a faintly red seam. Nobody has noticed at
three ingredients; across 35 (cheese, bread, lemon) it will look broken. `particles` is already
per-ingredient (`fragColor`, `wetColor`), so the precedent exists — **move seam tint into the
ingredient profile before the roster grows.** Cheap now, tedious later.

---

## F. FIRST TEST BATCH — confirmed, with one reorder

Agreed on 8. But sequence them to test *architecture*, not to collect art:

1. **Basil** — forces the cluster silhouette. The whole phase's risk lives here.
2. **Parsley** — proves cluster generalises (finer, frillier, same primitive).
3. **Lemon** — proves radial/segment interiors + `Radial` technique.
4. **Avocado** — proves a *hole* (stone) and `Halve`. Genuinely new topology.
5. **Eggplant** — easy win, validates skin/flesh at a new scale (near-`taper`).
6. **Cheddar** — proves a hard-edged non-organic body, no rind.
7. **Baguette** — proves the texture-inside-silhouette hybrid.
8. **Broccoli** — hardest; cluster *plus* stalk, two materials in one body. Last on purpose.

Rationale: 1, 4 and 8 are the three that can break the contract. Front-load basil, keep broccoli
last so it lands on a proven primitive. Doing eggplant first would feel productive and prove nothing.

---

## A / G / H / I — BLOCKED ON THE REPO

Cannot be answered from this project. A (current architecture), G (files to modify), H (files to
leave alone), and I (risk to Levels 1–100) all require reading the actual codebase — `package.json`,
the ingredient definitions, `CutGeometry`, `CutEvaluator`, `PreparationScene`, `Preparation.tsx`.

Guessing at them would be worse than leaving them open, and §3 explicitly says not to assume the old
prototype's architecture. Connect the repo and I will complete these four against real files.

**What I can say about risk without the repo:** the danger is concentrated in the cluster silhouette.
If `spanX`/`spanY` change their return type from one interval to a list, every consumer — seams,
ghost line, replay, placement, no-room refusal — is a call site. In the prototype that is ~6
locations. Done as a widening (accept both, single-interval shapes keep the fast path) it is additive
and Levels 1–100 are untouched. Done as a replacement, every existing level's cut placement is in
scope. **Insist on the widening.**

---

## J. IMPLEMENTATION PLAN (smallest viable sequence)

1. Connect the repo; complete A/G/H/I.
2. Port the per-ingredient **profile object** shape if the repo lacks it (geometry + resistance +
   audio + particles + seam tint).
3. Move seam tint per-ingredient. Small, isolated, unblocks everything after.
4. **Widen the silhouette contract** to multi-interval spans, single-body shapes on the fast path.
   Ship behind no flag but with Levels 1/5/8/10/51/52/60/82/91/100 regression-verified.
5. Add `cluster` silhouette. Basil only.
6. `PAINT.basil` — broad leaves, visible stems, central veins, varied orientation.
7. Verify Chiffonade produces leafy ribbons, not rectangles. **Gate: if this looks wrong, stop.**
8. Parsley on the same primitive. Zero new geometry code, or the primitive is wrong.
9. Then 3–8 of the batch, in the order above.
10. Only then consider the remaining roster.

Steps 4–7 are the phase. Everything else is consequence.

---

## Open questions for you

1. **Does the repo already render procedurally, or is it sprite/image based?** This changes the
   recommendation's cost, not its direction. If it is already procedural, Phase 17 is mostly step 4
   and you are much closer than the prompt assumes.
2. **Is basil/parsley currently a reused single-body shape?** If yes, the diagnosis above is
   confirmed and step 4 is the fix.
3. Still open from the previous turn: the **"Knife Craft" board watermark** and the warmer café
   palette. Watermark is a contained change to the drawn face; "make it look like a café" needs
   scoping before I spend budget on it.
