# KNIFECRAFT — five new ingredients, production integration pack

Generated 2026-09-18 from `knifecraft.html` (the Claude Design source of truth).
State of the source at generation: **47 ingredients, 81 recipes**, in-page regression harness
`__kcTest.regress()` **green — 0 failures, 81/81 recipes plate their expected piece counts.**

## What's in this pack

| File | What it is | How to use it |
|---|---|---|
| `01-ingredients.js` | the five `CONFIG.INGREDIENTS` profiles + their `REAL_CM` rows | paste blocks verbatim |
| `02-painters.js` | the five `PAINT` entries, ginger's `SKIN` entry, and the shared `gingerBody` helper | paste into `PAINT` / `SKIN`; helper at top level |
| `03-recipes.js` | the ten new `CONFIG.recipes.RECIPES` entries | splice into the array (see level-numbering warning inside) |
| `04-shared-patches.md` | the **four** edits to shared code, quoted from source with line numbers | apply as diffs |
| `knifecraft.html` | the full working source, for reference and for diffing | do not ship; read it |

Apply order: 04 (shared patches) → 01 → 02 → 03. Nothing in 01–03 works before the patches in 04.

## The five ingredients

| id | name | primitive it reuses | real cm | recipes | peelable |
|---|---|---|--:|---|---|
| `ginger` | Ginger | `cluster` — a rhizome HAND: one thick diagonal body + four unequal fingers | 14 x 9 | Slice x5, Chop 3x3 | **yes** (shell sheds on the rub) |
| `chilli` | Green Chilli | `taper` + eggplant's `spine` bow | 12 x 2.2 | Slice x6, Chop x5 | no |
| `lime` | Lime | `ellipse` — lemon's rind→pith→flesh insets and radial-segment scaffold, repalettized green | 6 x 4.5 | Slice x6, Halve | no |
| `cilantro` | Cilantro | `cluster` + parsley's blade generator via the new `leafRound` flag | 17 x 12 | Chop 3x3, Chiffonade x8 | no |
| `springonion` | Spring Onion | `cluster` with `bundle: true` — asparagus's rule, one lobe per stalk | 34 x 11 | Slice x8, Chop x6 | no |

## The four shared-code edits (full detail in 04)

1. **`drawOverhang`** gains `if(cuts.length && !g.keepOverhang)` — chilli's stalk/calyx stay on the board
   after the first cut instead of shedding. Only chilli sets the flag.
2. **`parsleyLeafShape`** gains a `geom.leafRound` branch — a polar fan blade slit inward from the margin
   (cilantro), alongside parsley's untouched trifid path. Same return contract, so fit/clip/chop are shared.
3. **`clusterBlade`** also answers for `cilantro`, so plated pieces clip to the painted leaflet.
4. **`REAL_CM`** gains five rows.

## Per-ingredient gotchas a port will hit

- **ginger** — peelable, so it has BOTH a `PAINT` entry (the shaved pale body, which is the BASE sprite) and a
  `SKIN` entry (the corky tan shell drawn over it on its own alpha). Both delegate to `gingerBody` so the knobs
  can't drift apart. It is **not** in `SKIN_KEEP`: the shell comes off by rubbing, never by cutting.
- **chilli** — single-row chop only (`count`, not `counts`). A lengthwise cut through a 2cm pod has nothing to
  divide and the piece count comes up short. The calyx and crooked stalk are paint PAST the butt, so no cut,
  span or piece ever sees them — plus `keepOverhang`.
- **lime** — three concentric layers via `innerGeom` (rind 11px, flesh 17px insets), exactly lemon's numbers.
  Halve is Slice with `count: 2`, a label over the existing mechanic.
- **cilantro** — the blade generator is shared with parsley; the three fan constants are pinned by the fit loop
  (a longer fan renders SMALLER). The bunch carries 21 leaflets including two mid-band and one dead-centre: the
  paint smoke samples the ingredient's own centre pixel and a transparent centre is a hard failure.
- **springonion** — the stalk outline is a half-width FUNCTION of length (bulb gaussian added to the tube, not
  `max()`'d over it — a max puts hard corners at the neck), with a circular end cap that reaches zero and
  **cosine-spaced samples** so the caps resolve (uniform sampling drew them as polygonal Vs). Root tuft is
  declared as `overhang`. Bulb:shaft is about 1.6:1; wider reads as a dart, equal reads as a leek.

## Verification the port should repeat

Run `__kcTest.regress()` in the page and expect `fail: []`. It asserts, per ingredient: the painter does not
throw; the paint COVERS at least 30% of its box (parsley 24 and beetroot 26 are the only allowances); the
centre pixel is opaque; and the interior differs measurably from the skin. Per recipe it asserts the plated
piece count equals the objective. Two flow assertions (`flow.lightDoesNotRise`, `flow.lightImperceptible`) and
the perf budgets are frame-rate sensitive and will trip in a throttled or hidden iframe — run them foregrounded.
