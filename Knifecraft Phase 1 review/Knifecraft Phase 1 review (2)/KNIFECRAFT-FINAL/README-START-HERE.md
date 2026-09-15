# KNIFECRAFT — CLAUDE DESIGN FINAL PACKAGE
**FROZEN 2026-09-14.** Do not edit `knifecraft.html` in this package.

## ⭐ THE AUTHORITATIVE SOURCE IS `knifecraft.html`

One file. 11,301 lines. No build step. No modules. No TypeScript. **Zero image assets** — every
ingredient is painted procedurally into an offscreen canvas; all story art is inline SVG strings.
There is no second candidate and nothing to choose between.

## Read in this order

| Order | File | What it is |
|--:|---|---|
| 1 | **KNIFECRAFT-PRODUCTION-INTEGRATION.md** | **START HERE.** The integration spec: roster, proteins, technique matrix, peel system, geometry, story, characters, scaling, what must not change, QA checklist. Ends with a "CLAUDE CODE — INTEGRATION START HERE" section. |
| 2 | KNIFECRAFT-SOURCE-MAP.md | Every integration item → exact line in `knifecraft.html`. |
| 3 | KNIFECRAFT-INTEGRATION-MANIFEST.json | The same data, machine-readable. |
| 4 | REGRESSION-RUN.md | Freeze QA receipt. 2 runs, both green, known issues listed. |
| 5 | MECHANICS-SKIN-PEEL-OVERHANG.md | Deep dive on skin / peel / overhang. Read before touching peel. |
| 6 | DESIGN.md | Design rationale — why things are the way they are. |
| — | `knifecraft.html` | The source. |
| — | `archive/` | **HISTORICAL phase reports. Not source. Not authoritative.** Superseded by the four documents above; kept for provenance only. |

## Four things the commissioning brief got wrong

Documented in full in §1 of the integration doc. In short:

1. The proteins are **`chicken`, `steak` (Ribeye Steak), `salmon` (Salmon Fillet)** — there is no
   `meat` or `fish` id.
2. The peel system is **rub-to-peel** (hand-travel budget + `skinAlpha`), **not** a normalized grid
   peel with stroke stamping and `destination-out` compositing. That system does not exist here.
3. **Peel, Smash, Rings, Radial and Rock Mince are not implemented.** Peel is a gate on 3 ingredients.
4. **42 + 10 = 52, not 49.** No ingredient was deleted to reach 49. Needs a product decision.

## Counts at freeze

- **42** ingredients (incl. 3 proteins) · **71** recipes · **8** techniques · **7** shape families
- **11** skin sprites: 8 permanent (`SKIN_KEEP`), **3 peelable** (pineapple, watermelon, coconut)
- Story: **THE LAST WISH** — 17 opening/chef beats, **4** milestones (levels 8/20/45/70), **4**-beat
  finale at level 100 · `story.ms` is a 4-bit mask, full value **15**
- **7** story art assets, all inline SVG · **0** bitmaps · **0** external files

## Verify

```js
window.__kcTest.regressStart();   // ~13-14 s
window.__kcRegressLast;           // { pass: true, fail: [], …48 sections }
```
