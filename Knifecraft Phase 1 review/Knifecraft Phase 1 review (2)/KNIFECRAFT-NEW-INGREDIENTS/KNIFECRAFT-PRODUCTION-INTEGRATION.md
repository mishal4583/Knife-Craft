# KNIFECRAFT — PRODUCTION INTEGRATION
**Claude Design → production React/TypeScript/Phaser/Vite**

> **AUTHORITATIVE SOURCE: `knifecraft.html` — 11,301 lines, one file, no build step, zero image assets.**
> Everything visual is procedural: ingredients are painted into offscreen canvases via `PAINT[id]`/`SKIN[id]`;
> story art is inline SVG strings in `ART`. There is no second candidate file. Nothing in `screenshots/` or
> `uploads/` is source.

**Status: FROZEN 2026-09-14.** Companion files: `KNIFECRAFT-INTEGRATION-MANIFEST.json` (machine-readable),
`KNIFECRAFT-SOURCE-MAP.md` (line anchors), `REGRESSION-RUN.md` (QA receipt),
`MECHANICS-SKIN-PEEL-OVERHANG.md` (deep-dive on skin/peel/overhang), `DESIGN.md` (design rationale).

---

## 1. Executive summary

Claude Design is the **visual and behavioural reference**. Production owns architecture (React/TS/Phaser/Vite),
scene management, build, and its own 10 ingredients. Everything else — geometry, paint, scale, cut behaviour,
peel behaviour, story — should be **ported from this source, not reinvented**.

| | Claude Design |
|---|---|
| Ingredients | **47** |
| Recipes | **81** (level N = recipe N; the list repeats after 81) |
| Techniques implemented | 8 — Slice, Dice, Julienne, Chiffonade, Chop, Halve, Prep, Free |
| Shape families | 7 — ellipse, capsule, taper, cluster, wedge, block, fillet |
| Ingredients with a skin sprite | 11 (8 permanent, **3 peelable**) |
| Proteins | 3 — `chicken`, `steak`, `salmon` |
| Story | THE LAST WISH — 17 beats + 4 milestones + 4-beat finale |
| Bitmap assets | **0** |

### ⚠ Four corrections to the packaging brief — read these first

The brief that commissioned this package asserts several things the source does not contain. Documenting the
source faithfully means contradicting the brief in exactly these four places.

1. **The proteins are `chicken`, `steak` (Ribeye Steak) and `salmon` (Salmon Fillet)** — not "Chicken, Meat,
   Fish". There is no ingredient id `meat` or `fish`. If production creates `meat`/`fish` ids it will not
   match this source. Section 4 maps them.
2. **The peel system is rub-to-peel, not a progressive grid peel.** The brief's section D describes normalized
   peel grids, stroke stamping, deterministic wobble, new-cell counting, `destination-out` compositing and a
   scratch/flesh canvas. **None of that exists here.** The real system is a hand-travel budget
   (`PEEL_NEED_PX`) against a full-body shell sprite faded by `skinAlpha`. See §8. Porting the brief's
   description instead of the source would be a from-scratch invention of a system the game does not have.
3. **Five requested techniques do not exist**: Peel (a *gate*, not a technique), Smash, Rings, Radial,
   Rock Mince. The matrix in §7 lists the 8 that do. Do not scaffold the missing 5 from the recipe list.
4. **The roster arithmetic does not reach 49.** 42 Claude Design + 10 production-only = **52**, and no
   production-only id appears in the Claude Design roster, so there is nothing to reconcile away. The only
   near-duplicate is Claude Design `baguette` vs production-only `Bread`. **Product owner must confirm the
   intended 49 before anyone deletes an ingredient.** See §6.

---

## 2. Source of truth statement

- `knifecraft.html` at freeze is authoritative for: ingredient geometry, paint, palettes, real-world sizes,
  scale math, cut geometry, peel behaviour, resistance/audio/particle profiles, the story layer and the
  character art.
- **Production is authoritative for**: the React/TS/Phaser/Vite architecture, scene/state management, asset
  pipeline, save format, and its 10 production-only ingredients (§6).
- Where the two disagree on anything in the first list, **Claude Design wins** unless this document marks the
  difference PRODUCTION-ONLY or SOURCE-INTENTIONAL.

---

## 3. Final ingredient roster (47)

> **Roster addendum (post-§17G).** Five ingredients were added after the table below was written, and the
> table's 42 rows are unchanged and still correct for those 42. The additions, each built on an existing
> primitive with **no new geometry and no new mechanic**:
>
> | # | Name | id | shape | real cm | recipes |
> |--:|---|---|---|--:|---|
> | 43 | Ginger | `ginger` | cluster | 14 x 9 | Slice x5, Chop 3x3 |
> | 44 | Green Chilli | `chilli` | taper (spine) | 12 x 2.2 | Slice x6, Chop x5 |
> | 45 | Lime | `lime` | ellipse | 6 x 4.5 | Slice x6, Halve |
> | 46 | Cilantro | `cilantro` | cluster (`leafRound`) | 17 x 12 | Chop 3x3, Chiffonade x8 |
> | 47 | Spring Onion | `springonion` | cluster (`bundle`) | 34 x 11 | Slice x8, Chop x6 |
>
> Notes a port must carry: ginger and lime reuse the peelable/inset machinery already documented (pineapple's
> shell, lemon's rind→pith→flesh); `chilli` sets **`keepOverhang: true`** so its calyx and stalk do NOT shed on
> the first cut, the one exception to `drawOverhang`'s shed rule; cilantro shares parsley's blade generator
> through the `leafRound` flag (a polar fan slit inward from the margin, versus parsley's trifid lobes);
> spring onion follows asparagus's `bundle` rule — one cluster lobe per stalk, single-row cuts only.
>
> Counts elsewhere in this document that read "42" or "71" refer to the state at §17F and have not been
> renumbered; the technique matrix in §7 likewise covers the original 42. Recipe indices L1–L71 are unchanged
> (the ten new recipes were appended within their ingredient groups, so **level numbering after the insertion
> points shifts** — regenerate any level table from `CONFIG.recipes.RECIPES` order, never from this document).

`face` = the interior band a cut opens. `depth` = 2.5D thickness wall (proteins only).
`skin` = has a shell sprite; **P** = permanent (`SKIN_KEEP`, never peels), **R** = peelable by rubbing.
`over` = paints outside the silhouette (stem/crown/root). Sizes are `REAL_CM [long, short]`.

| # | Ingredient | id | shape | REAL_CM | face | depth | skin | over | techniques |
|--:|---|---|---|---|:--:|:--:|:--:|:--:|---|
| 1 | Tomato | `tomato` | ellipse | 8 x 7.5 |  |  |  |  | Slice, Dice, Prep |
| 2 | Cucumber | `cucumber` | capsule | 21 x 5 |  |  |  |  | Slice, Prep |
| 3 | Carrot | `carrot` | taper | 19 x 3.6 |  |  |  |  | Julienne, Prep |
| 4 | Basil | `basil` | cluster | 15 x 10 |  |  |  |  | Chiffonade, Chop |
| 5 | Parsley | `parsley` | cluster | 18 x 12 |  |  |  |  | Chop, Chiffonade |
| 6 | Lemon | `lemon` | ellipse | 8 x 6 |  |  |  |  | Slice |
| 7 | Avocado | `avocado` | taper | 11 x 7.5 |  |  |  |  | Halve |
| 8 | Eggplant | `eggplant` | taper | 20 x 10 |  |  |  |  | Slice |
| 9 | Cheddar | `cheddar` | block | 12 x 7 |  |  |  |  | Slice |
| 10 | Baguette | `baguette` | capsule | 32 x 6.5 | y |  |  |  | Slice |
| 11 | Broccoli | `broccoli` | cluster | 18 x 13 |  |  |  |  | Chop |
| 12 | Pear | `pear` | taper | 12 x 8 |  |  |  |  | Slice, Halve |
| 13 | Peach | `peach` | ellipse | 7.5 x 7 |  |  |  | y | Halve |
| 14 | Corn | `corn` | taper | 19 x 5 |  |  |  | y | Slice |
| 15 | Celery | `celery` | taper | 30 x 12 |  |  |  | y | Julienne |
| 16 | Mozzarella | `mozzarella` | taper | 10 x 9 |  |  |  |  | Slice |
| 17 | Butter | `butter` | block | 12 x 5 |  |  |  |  | Slice |
| 18 | Tofu | `tofu` | block | 10 x 7 |  |  |  |  | Dice |
| 19 | Lettuce | `lettuce` | cluster | 17 x 15 |  |  |  |  | Chop, Chiffonade |
| 20 | Cabbage | `cabbage` | ellipse | 17 x 16 |  |  |  |  | Slice, Chop |
| 21 | Cauliflower | `cauliflower` | cluster | 16 x 15 |  |  |  |  | Chop |
| 22 | Spinach | `spinach` | cluster | 20 x 14 |  |  |  |  | Chop, Chiffonade |
| 23 | Pineapple | `pineapple` | capsule | 33 x 13 |  |  | R | y | Slice, Dice |
| 24 | Asparagus | `asparagus` | cluster | 24 x 8 |  |  |  |  | Slice, Chop |
| 25 | Radish | `radish` | taper | 6 x 3 |  |  |  | y | Slice, Halve |
| 26 | Beetroot | `beetroot` | taper | 9 x 8 |  |  | P | y | Slice, Dice |
| 27 | Sweet Potato | `sweetpotato` | taper | 16 x 7 |  |  | P |  | Slice, Dice, Halve |
| 28 | Watermelon | `watermelon` | ellipse | 32 x 22 |  |  | R |  | Slice, Dice |
| 29 | Mango | `mango` | ellipse | 12 x 8 |  |  | P | y | Slice, Dice |
| 30 | Kiwi | `kiwi` | ellipse | 7 x 5 |  |  | P |  | Slice, Halve |
| 31 | Pomegranate | `pomegranate` | ellipse | 9 x 9 |  |  | P | y | Halve |
| 32 | Green Bean | `greenbean` | cluster | 13 x 5 |  |  |  |  | Slice, Chop |
| 33 | Grapes | `grapes` | cluster | 18 x 12 |  |  |  |  | Slice |
| 34 | Coconut | `coconut` | ellipse | 12 x 11 |  |  | R |  | Halve |
| 35 | Fennel | `fennel` | ellipse | 22 x 10 |  |  | P | y | Slice, Chop |
| 36 | Artichoke | `artichoke` | cluster | 12 x 10 |  |  |  | y | Halve, Chop |
| 37 | Pea Pod | `peapod` | taper | 9 x 3 |  |  | P | y | Slice |
| 38 | Pumpkin | `pumpkin` | ellipse | 20 x 17 |  |  |  | y | Slice, Dice |
| 39 | Turnip | `turnip` | ellipse | 8 x 7.5 |  |  | P | y | Slice, Dice, Halve |
| 40 | Chicken Breast | `chicken` | fillet | 16 x 9 | y | y |  |  | Slice, Dice, Julienne, Halve |
| 41 | Ribeye Steak | `steak` | fillet | 17 x 13 | y | y |  |  | Slice, Dice |
| 42 | Salmon Fillet | `salmon` | fillet | 25 x 11 | y | y |  |  | Slice, Dice |

Every ingredient carries its own `resistance` curve, `audio` profile, `particles` profile and `seam` colours
in its `CONFIG.INGREDIENTS` record. **Port these records verbatim** — they are the feel of the game, and they
are the single most expensive thing to re-tune by hand.

---

## 4. Proteins — Chicken, Steak, Salmon

All three are **one new shape family**, `SILS.fillet` (`knifecraft.html:3370`), and they are the
only ingredients with a `depth` record.

### 4.0 Name mapping (the brief's names → real ids)

| Brief name | **Actual id** | Display name | REAL_CM |
|---|---|---|---|
| Chicken | `chicken` | Chicken Breast | 16 x 9 cm |
| Meat | `steak` | Ribeye Steak | 17 x 13 cm |
| Fish | `salmon` | Salmon Fillet | 25 x 11 cm |

### 4.1 Why `fillet` exists (do not substitute an ellipse)

Every other primitive — ellipse, capsule, taper, block, wedge — is **mirror-symmetric about its long axis**.
A raw chicken breast is not. `fillet` is authored as **two independent rails** over one normalised length
parameter `s` (0 = broad shoulder, 1 = blunt tip), so the asymmetry is real geometry: `inside()`, both spans,
`support()` and the traced outline all read the same two rails. Retuning the rails is how one family carries
three very different foods — a teardrop ribeye and a long-pointed salmon side are the same code.

Rail parameters (`geom`):

| param | chicken | steak | salmon | meaning |
|---|--:|--:|--:|---|
| `rx` | 188 | 180 | 200 | half-length, authored px |
| `ry` | 96 | 138 | 100 | half-width, authored px |
| `bias` | default | 0.52 | 0.44 | where along `s` the widest point sits |
| `full` | default | 0.70 | 0.54 | how square the body holds its width |
| `bow` | default | 0.05 | 0.08 | centreline curvature |
| `tilt` | default | 0.10 | 0.16 | lean out to the tip |
| `topFull`/`botFull` | default | 0.10 / 0.20 | 0.12 / 0.14 | per-rail fullness |
| `wob` | default | 0.05 | 0.03 | low-frequency rail wobble |
| `bandTopClear` | 0.10 | 0.10 | 0.10 | cut-band clearances (shared with the rest of the roster) |
| `bandBotFrac` | 0.88 | 0.88 | 0.88 | |
| `bandSideFrac` | 0.90 | 0.90 | 0.90 | |

`cx:270, cy:500` for all three (the authored art frame, not a screen position).

### 4.2 Thickness — the 2.5D system (proteins only)

Three cooperating pieces, all keyed off the ingredient's `depth` record:

- **`drawDepthWall`** (`:5417`) — extrudes `depth.px` authored px along **one**
  world-space direction, scaled by the ingredient's own `k`. Tones are the flesh palette walked darker
  (`lit`/`mid`/`low`/`rim`), **never white or grey**: the wall must read as the same meat seen edge-on.
- **`spreadPieces()`** (`:4230`) — fans pieces along each cut set's own normal by
  `depth.spread`, proportional to distance from the middle of that set (an affine expansion, so every gap
  opens equally and nothing flies apart). Without it, six chicken slices read as one breast with lines on it.
  The global parting offset for the other 39 ingredients is unchanged.
- **`shadeCutEdges()`** (`:5027`) — layer 8, per-piece roll-off a few px inside every
  cut boundary (`depth.edge`), so a piece reads as a rounded chunk lit from above, not a flat panel.

`depth.slab` widens the parting for a thick food (4/5/5 px): at the global 4px, slices still merged visually.

| | chicken | steak | salmon |
|---|---|---|---|
| `depth.px` | 12 | 14 | 13 |
| `depth.slab` | 4 | 5 | 5 |
| `depth.spread` | 0.17 | 0.17 | 0.17 |
| `lit / mid / low` | `#E09580 / #C97B68 / #9E5344` | `#B23840 / #93262F / #6B171E` | `#F4835F / #DE6B49 / #B04A31` |
| `rim` | `rgba(150,74,62,0.30)` | `rgba(92,22,28,0.34)` | `rgba(150,62,42,0.30)` |
| `edge.px` | 18 | 20 | 18 |

### 4.3 Cut face (`face`)

The pale interior band a cut opens — the same mechanism the baguette's crumb uses.

| | `px` | `inset` | stops |
|---|--:|--:|---|
| chicken | 4 | 2.5 | `#F5CABC → #EBB2A1 → #DFA08D` (pink, lighter and more uniform than the outer flesh) |
| steak | 5 | 2.5 | `#C4424A → #AE313A → #97262E` (**lighter red, never pink** — the inside of beef is beef) |
| salmon | 5 | 2.5 | `#FFA582 → #F98A66 → #ED7A55` |

### 4.4 Paint — what makes each one itself

Shared helpers (`PAINT._railAt`, `PAINT._region`, `PAINT._taperStroke`, `PAINT._branch`, from `:8130`):
a curve-bounded **region** so a muscle group can be toned separately; a **taper stroke** whose width and
opacity vary along its length so a fibre fades out instead of stopping; and a **branching** stroke.
All variation is **hashed off the loop index — no `Math.random` anywhere in paint**, so a fillet renders
identically every time. Port the hash, not a RNG.

- **`PAINT.chicken`** (`:8061`) — restrained on purpose. Order: flesh ground → form shading
  following the two rails → muscle fibres fanning shoulder-to-tip → **5** sparse connective slicks (pale,
  stretched, very low opacity — anything whiter reads as beef fat) → two soft elongated highlights → darker
  perimeter band → faintest outline (`rgba(196,110,98,0.40)`, 1.4px).
- **`PAINT.steak`** (`:8179`) — zero new geometry; what makes it beef is two things paint owns:
  **marbling** (a pale branching web through the muscle) and the **fat cap** along the lower rail. Both are
  read by the piece clip, so every slice carries its share. Sheen is broad and low, along the grain — raw beef
  is wet, not lacquered. Outline `rgba(118,30,36,0.42)`.
- **`PAINT.salmon`** (`:8318`) — identity is the **myocommata**, the pale connective stripes.
  Rebuilt after a first pass read as a striped balloon. Three rules, all true of the fish: (1) the stripes are
  not a comb — they crowd and steepen toward the tail, vary in width and brightness, and many fade before
  reaching the belly; (2) the flesh is not one colour — deeper loin, paler creamier belly, fine mottle
  everywhere; (3) the stripes are **ridges** (shadow one side, lit crest the other), which is what stops them
  reading as print. Gloss is three soft slicks, never one — an unbroken highlight is what makes CG food waxy.

### 4.5 Behaviour

- **No skin, no peel** for all three: a boneless fillet, a trimmed steak and a skinned salmon side have no
  shell. No `SKIN` entry ⇒ `skinAlpha` returns 0 ⇒ nothing to peel. **Do not give them a peel step.**
- **Resistance** — chicken `[[0,0.44],[0.12,0.34],[0.5,0.30],[0.85,0.34],[1,0.42]]` (soft yielding muscle, no skin spike, no core);
  steak `[[0,0.52],[0.10,0.46],[0.5,0.44],[0.86,0.48],[1,0.58]]` (dense, heavier everywhere, no spike);
  salmon `[[0,0.40],[0.10,0.28],[0.5,0.24],[0.86,0.30],[1,0.40]]` (softest protein — fish parts easily).
- **Audio/particles/seam** — full records at the profile lines below. Seams are deliberately a soft darker
  transition, **not** a bright line: a near-white `seamFlesh` read as an artificial separator band between
  slices, the one thing a thick piece of meat must not do.
- **Recipes** — 8 of the 71, existing technique ids only, no protein-only mechanic:
  chicken Slice x6 (L62), Dice 3x3 (L63), Julienne x8 (L64), Halve (L65); steak Slice x6 (L66), Dice 3x3 (L67);
  salmon Slice x6 (L68), Dice 3x3 (L69). Chicken Julienne runs **eight** at celery's widened `minGap:11` with
  tightened tolerances (`evennessTol:1.9, consistencyCvTol:1.5`) because the fillet's band is shorter than a
  carrot's.
- **Plating** — `shingle` (Slice), `mound` (Dice), `nest` (Julienne), `fan` (Halve). Standard paths.

Source: profile `chicken` `:1317`, `steak` `:1353`, `salmon` `:1380`;
paint `:8061` / `:8179` / `:8318`.

---

## 5. Common ingredients — use the Claude Design implementation

These exist in both projects. **Replace the production approximations.**

| Ingredient | id | Claude Design profile | paint | REAL_CM | note |
|---|---|--:|--:|---|---|
| Tomato | `tomato` | 347 | 5884 | 8 x 7.5 | ellipse family, lobed silhouette |
| Cucumber | `cucumber` | 362 | 5911 | 21 x 5 | two-tone skin/flesh inset — the two-tone is what identifies it at any cut angle |
| Carrot | `carrot` | 378 | 5938 | 19 x 3.6 | ellipse family, lobed silhouette |
| Basil | `basil` | 398 | 5963 | 15 x 10 | `cluster` — silhouette IS the leaves; rx/ry derived by fitCluster(), never hand-written |
| Parsley | `parsley` | 431 | 6017 | 18 x 12 | `cluster` — silhouette IS the leaves; rx/ry derived by fitCluster(), never hand-written |

Also verify against Claude Design before keeping any production version of: lemon, avocado, eggplant, corn,
celery, lettuce, cabbage, cauliflower, spinach, asparagus, broccoli — all 42 in §3 are authoritative.

---

## 6. Production-only ingredients — DO NOT REMOVE

Not in Claude Design. Production keeps them exactly as they are; this package says nothing about their
implementation.

| Ingredient | Status |
|---|---|
| Onion | **PRODUCTION-ONLY — DO NOT REMOVE** |
| Potato | **PRODUCTION-ONLY — DO NOT REMOVE** |
| Bell Pepper | **PRODUCTION-ONLY — DO NOT REMOVE** |
| Zucchini | **PRODUCTION-ONLY — DO NOT REMOVE** |
| Mushroom | **PRODUCTION-ONLY — DO NOT REMOVE** |
| Garlic | **PRODUCTION-ONLY — DO NOT REMOVE** |
| Strawberry | **PRODUCTION-ONLY — DO NOT REMOVE** |
| Apple | **PRODUCTION-ONLY — DO NOT REMOVE** |
| Orange | **PRODUCTION-ONLY — DO NOT REMOVE** |
| Bread | **PRODUCTION-ONLY — DO NOT REMOVE** |

### Roster arithmetic — unresolved, needs a product decision

```
Claude Design            42
Production-only        + 10
Overlap                -  0   (no production-only id appears in the Claude Design roster)
                       ————
Computed total           52     ← brief states 49
```

The brief's 49 cannot be derived from the source. The only plausible reconciliation is Claude Design
`baguette` ≈ production-only `Bread` (→ 51). **Do not delete any ingredient to hit 49.** Ship 52 or get an
explicit list of the 3 to drop.

---

## 7. Technique matrix (42 x 8)

Cells hold the **level(s)** where that pairing appears (L = recipe index, 1-based). Empty = **NOT SUPPORTED**
(no recipe exercises it). `Prep` is the multi-stage garden prep; `Free` is the free-cut sandbox.

| Ingredient | Slice | Dice | Julienne | Chiffonade | Chop | Halve | Prep | Free |
|---|---|---|---|---|---|---|---|---|
| Tomato | L1 | L3 | — | — | — | — | L70 | — |
| Cucumber | L2 | — | — | — | — | — | L70 | — |
| Carrot | — | — | L4 | — | — | — | L70 | — |
| Basil | — | — | — | L5 | L6 | — | — | — |
| Parsley | — | — | — | L8 | L7 | — | — | — |
| Lemon | L9 | — | — | — | — | — | — | — |
| Avocado | — | — | — | — | — | L10 | — | — |
| Eggplant | L11 | — | — | — | — | — | — | — |
| Cheddar | L12 | — | — | — | — | — | — | — |
| Baguette | L13 | — | — | — | — | — | — | — |
| Broccoli | — | — | — | — | L14 | — | — | — |
| Pear | L15 | — | — | — | — | L16 | — | — |
| Peach | — | — | — | — | — | L17 | — | — |
| Corn | L18 | — | — | — | — | — | — | — |
| Celery | — | — | L19 | — | — | — | — | — |
| Mozzarella | L20 | — | — | — | — | — | — | — |
| Butter | L21 | — | — | — | — | — | — | — |
| Tofu | — | L22 | — | — | — | — | — | — |
| Lettuce | — | — | — | L24 | L23 | — | — | — |
| Cabbage | L25 | — | — | — | L26 | — | — | — |
| Cauliflower | — | — | — | — | L27 | — | — | — |
| Spinach | — | — | — | L29 | L28 | — | — | — |
| Pineapple | L30 | L31 | — | — | — | — | — | — |
| Asparagus | L32 | — | — | — | L33 | — | — | — |
| Radish | L34 | — | — | — | — | L35 | — | — |
| Beetroot | L36 | L37 | — | — | — | — | — | — |
| Sweet Potato | L38 | L39 | — | — | — | L40 | — | — |
| Watermelon | L41 | L42 | — | — | — | — | — | — |
| Mango | L43 | L44 | — | — | — | — | — | — |
| Kiwi | L45 | — | — | — | — | L46 | — | — |
| Pomegranate | — | — | — | — | — | L47 | — | — |
| Green Bean | L48 | — | — | — | L49 | — | — | — |
| Grapes | L50 | — | — | — | — | — | — | — |
| Coconut | — | — | — | — | — | L51 | — | — |
| Fennel | L52 | — | — | — | L53 | — | — | — |
| Artichoke | — | — | — | — | L55 | L54 | — | — |
| Pea Pod | L56 | — | — | — | — | — | — | — |
| Pumpkin | L57 | L58 | — | — | — | — | — | — |
| Turnip | L59 | L60 | — | — | — | L61 | — | — |
| Chicken Breast | L62 | L63 | L64 | — | — | L65 | — | — |
| Ribeye Steak | L66 | L67 | — | — | — | — | — | — |
| Salmon Fillet | L68 | L69 | — | — | — | — | — | — |

**Not implemented anywhere in this source:** Peel (see §8 — it is a gate), Smash, Rings, Radial, Rock Mince.

Notable technique behaviour:
- **Halve** — `count:2, freeAngle:true, plate:'fan'`. 12 ingredients.
- **Chop** — first appears L6; `Chiffonade` L5 (leaf foods only: basil, parsley, lettuce, cabbage, spinach).
- **Dice** — `counts:{h,v}` + `perpSnap:true`. A 3x3 grid yields **16 pieces** and that is correct and
  consistent across every dice ingredient (audited in Phase 17; broccoli was verified specifically).
- **Julienne** — `parallelSnap:true` + a per-recipe `minGap`; chicken and celery use the widened 11.
- **Prep** (L70, `garden-prep`) — the only multi-stage recipe: cucumber Slice x4 → tomato → carrot. Same code
  path as single-stage, not a special case.
- **Free** (L71, `free-cut`) — no objective, no grade.

---

## 8. Peel system — rub-to-peel (⚠ not a grid peel)

> **The brief's section D describes a system that does not exist in this source.** There is no normalized peel
> grid, no stroke stamping, no stroke radius, no deterministic wobble, no new-cell counting, no
> `destination-out` skin removal, no scratch/flesh canvas, no stroke history, no resize stroke replay.
> Do not build those. The real system is below and it is much smaller.

### The model

A peelable food wears a **full-body shell sprite** (`SKIN[id]`) painted over its base sprite. Peeling is a
**hand-travel budget**: rubbing inside the silhouette accrues distance; at the threshold the shell sheds.
The shell's opacity is one function, `skinAlpha(id)` (`:5679`), and **every** call site
inherits it through `drawIngredient` — pieces, plate, replay and overhang all agree without knowing anything
about peeling.

### Constants (`:5641–5649`)

```
PEEL_SHED_MS  = 520     // shell fade-out after the rub completes
PEEL_NEED_PX  = 2200    // hand travel needed, in AUTHORED px
peelNeed()    = PEEL_NEED_PX * (T.k || 1)   // scaled by ingredient scale → constant cost in strokes
PEEL_THIN_MAX = 0.45    // rubbing alone only fades the shell to 55%; the rest goes on shed
```

`peelNeed()` scaling matters: the budget was tuned when a pineapple was 348px wide (~6 passes). After the
global scale pass, a fixed 2200px over a 159px fruit would be fourteen passes.

### Peelability is DERIVED, never a list

```js
const peelable = id => !!SKIN[id] && !SKIN_KEEP[id];
```

- `SKIN` entries (11): turnip, pomegranate, kiwi, mango, watermelon, sweetpotato, beetroot, coconut, fennel, peapod, pineapple
- `SKIN_KEEP` (8, **permanent skin — never peels**): beetroot, sweetpotato, mango, kiwi, pomegranate, fennel, peapod, turnip
- ⇒ **peelable = exactly 3: watermelon, coconut, pineapple** — the same three with `PEEL_TONE` shred colours
  (`pineapple #8A6A2A`, `watermelon #2C6531`, `coconut #8A5A2A`; fallback `#8A6A2A`).
- `SKIN_WHOLE` (`turnip` only): skin stays wall-to-wall even after cutting and the rim-annulus treatment is
  skipped — a turnip is drawn from its outside alone and has no flesh sprite, so a cut opens onto *more
  outside*, not a different interior.

**Do not introduce a `PEELABLE` constant in production.** It will desync from `SKIN`/`SKIN_KEEP`.

### State machine

```js
peel = { ing, got, done, doneT, flecks, soundAt } | null
peelForced = null | true | false        // test override only
```

- `peelStart()` `:5652` — called from `startRecipe()` right after `resetBoard()`.
- `peelPending()` — `peel && !peel.done`.
- `canCut()` — `phase === 'cutting' && !peelPending()`. **This is what locks the knife.** The peel step has
  no phase of its own.
- `peelRub(prev, p)` `:5658` — accrues `peel.got` **only for movement inside the silhouette**
  (`insideSil`); sweeping the empty board does nothing. Rasp sound throttled to 90ms; flecks capped at 90.
  At `got >= peelNeed()`: `done = true`, 26 burst flecks, `Audio.whoosh(0.5)`.
- Input routing: a rub stroke is tagged `rub` on `pointerdown` and **produces no blade, no ghost line and no
  cut on release** — a peel gesture can never cost the player a misplaced cut. `commitCut` refuses with
  `'peel step holds the board (rub to peel first)'`.
- `drawPeel(gnow)` `:4732` — flecks plus a progress ring drawn **outside** the silhouette
  (stand-off `clamp(max(T.rx,T.ry)*0.16, 26, 52)`) so it can never read as a cut line; labels
  *Rub to peel* / *Keep rubbing* / *Peeled*. Everything derives from `gnow`, so a stalled frame cadence
  cannot leave it half-drawn.

### `skinAlpha(id)` — the whole contract

```js
if(!SKIN[id])          return 0;                     // no shell at all
if(SKIN_KEEP[id])      return 1;                     // PERMANENT skin, never fades
if(peelForced != null) return peelForced ? 0 : 1;    // test hook
if(peel && peel.ing === id){
  if(!peel.done)       return 1 - PEEL_THIN_MAX*peelProgress();   // thinning under the hand
  k = (gameNow()-peel.doneT)/PEEL_SHED_MS;
  return (1-PEEL_THIN_MAX)*(1-k*k);                               // shedding
}
if(!cuts.length)       return 1;
k = (gameNow()-cuts[0].revealT0)/PEEL_SHED_MS;
return 1 - k*k;                                      // FALLBACK: shed on first cut
```

### The three things the brief asks to keep distinct

1. **TRUE progressive peeling** — the rub. Only pineapple, watermelon, coconut. Knife locked until done.
2. **Normal cutting** — never touches skin state. `cuts[]`, spans and scoring are **ignorant of the shell and
   the overhang**, by design.
3. **First-cut flesh reveal** — the **last branch only**, and it is **not a designed mechanic and not reachable
   in normal play**: peelables always have `peel` set (caught two branches earlier) and the knife is locked
   while peeling, so `cuts[]` is empty; `SKIN_KEEP` foods return 1 earlier. It exists as a fallback for when
   the peel step is bypassed — `__kcTest.peelSet()` and `runStage()`, which calls `peelSet(true)` so a
   scripted knife never fights the gate.

> **Kiwi and mango do NOT auto-peel.** They are `SKIN_KEEP`. A cut opens a flesh face inside a skin rim,
> which is what the reference photos show. If production has been told otherwise, that belief will fight
> `skinAlpha`.

### Overhang (adjacent system, same rules)

`geom.overhang:{x,y}` + a matching `geom.spriteM`. `overhangPath(g)` builds **sprite box MINUS silhouette**
(even-odd) and `drawOverhang` clips to it, so you get the sprite's leaf/stem pixels with **not one pixel of
body** — a plain blit would paint over the gaps cuts open. 13 declarations (peach, corn, celery, pineapple,
radish, beetroot, mango, pomegranate, fennel, artichoke, peapod, pumpkin, turnip).

**Two special rules:** a `SKIN_KEEP` food's overhang belongs in `SKIN[id]`, not `PAINT[id]` (mango's stem and
leaf must show while the permanent shell is on). And the **pumpkin stem** is the one overhang not in a sprite
at all — `paintPumpkinStem(c2,g)`, drawn **over** the pieces on a separate `over` pass, unclipped, so the
whole stem is one object on one fade clock; baked into the sprite, the part inside the silhouette belonged to
whichever piece covered it and survived the cut as a stub riding a slice.

New or longer overhang ⇒ **raise `geom.spriteM`** or the sprite canvas crops it.

---

## 9. Geometry, cut model and bounds

### Sprite pipeline (everything hangs off this)

```
CONFIG.INGREDIENTS[id].geom     authored geometry (cx, cy, rx, ry, shape, overhang, spriteM …)
      │  artGeom(id) → .art if present, else .geom     (authored proportions, NOT the scaled box)
      ├─ ingSprite(id)  → paints PAINT[id] into an offscreen canvas, cached in sprites{}
      └─ skinSprite(id) → paints SKIN[id]  into a second offscreen canvas, cached in skins{}
drawIngredient(src) → blits base, then blits skin at globalAlpha = skinAlpha(id)
```

Sprites are painted at **authored** size and blitted into the **scaled** box, so the global scale pass never
stretches a stem, leaf crown or hand-placed root away from its body. Both caches are **keyed by id only —
painted once**; anything that must change per frame cannot live in `PAINT`/`SKIN` (hence `paintPumpkinStem`).

### Silhouette and cut model

- **Silhouette** — a `Path2D` from the shape family (`SILS`), plus `inside()`, both spans and `support()`
  reading the same source of truth. `silPath(g, inset)` for the body; `innerGeom(g, d)` returns a **cached**
  inset copy for concentric interiors (lemon, watermelon, coconut + hollow cavity, cucumber, mozzarella,
  pineapple). **Do not hand-roll insets.**
- **Cluster foods** (`shape:'cluster'`) — the silhouette **is** the leaves/florets; `rx/ry` are **derived by
  `fitCluster(g)`, never hand-written**. Lobes with `stem:true` draw behind the blades. Basil, parsley,
  broccoli, cauliflower, lettuce, cabbage, spinach, asparagus, greenbean, grapes, artichoke.
- **Block foods** (`SILS.block`) — a real 3-face box whose corners come from `SILS.block.pts(g)` so paint can
  never drift out of register. Cheddar, butter, tofu.
- **Pit/stone occlusion is PAINT, never geometry** — avocado, peach, mango. A real hole would let one cut piece
  become two disconnected regions, which the partition model cannot represent; the interior stays continuous
  flesh, so a cut anywhere still opens onto flesh.
- **Cut model never sees skin or overhang.** Non-negotiable.

### Fixes that must survive the port

| Fix | What it protects |
|---|---|
| **Border clipping** | sprite margin `spriteM` sized so overhang paint is never cropped by the sprite canvas |
| **Pea Pod spine bounds** | `spine`/`spineRx` are in `SCALE_LEN`, so the spine scales with the body instead of escaping its bounds |
| **Grapes / cluster clipping** | `fitCluster()` derives `rx/ry` from the lobes, so the silhouette always contains every blade |
| **Zero-size canvas guards** | added in Phase 17 to `resize`, `KitchenScene.ensure` and `checkSize` — a 0-width/height canvas produces non-finite transforms and throws on gradient creation |
| **`getImageData` safety** | all probes clamp px/py into `[0, canvas.width/height-1]` before reading |
| **Deterministic paint** | every painter hashes off its loop index; **no `Math.random` in `PAINT`/`SKIN`** (runtime particles and peel flecks may use it — paint may not) |

---

## 10. Special ingredient implementations

### Kiwi — FINAL (do not regress the 0-cut appearance)

```
profile  knifecraft.html:1075      paint  :7490      skin  :8593
```

- **Geometry** — `shape:'ellipse', cx:270, cy:500, rx:118, ry:94, lobes:0`. **Wider than tall**, matching the
  reference photo's horizontal oval. Bands `bandTopClear:0.08, bandBotFrac:0.90, bandSideFrac:0.90`.
- **REAL_CM** `7 x 5` cm.
- **Resistance** `[[0,0.34],[0.12,0.18],[0.5,0.10],[0.85,0.16],[1,0.30]]` — thin fuzzy skin, soft flesh throughout.
- **Skin is PERMANENT** (`SKIN_KEEP`) ⇒ `skinAlpha` returns **1 forever**. Kiwi has **no peel step** and
  **does not auto-peel on first cut**.
- **`SKIN.kiwi`** (`:8593`) — linear gradient `#B4854A → #9E6E3B (0.38) → #845330 (0.74) → #5F3A20`,
  olive undertone patches, a dense field of short hair strokes for the fuzz, one stem scar.
- **Pre-cut (0 cuts)** — the fruit is **entirely the brown fuzzy shell**. This is the corrected appearance;
  an earlier pass showed green flesh through an unpeeled kiwi. **Do not regress it.**
- **Post-cut** — the cut opens a green flesh face **inside a brown skin rim** (the rim-annulus treatment;
  kiwi is not `SKIN_WHOLE`, so the annulus applies). Flesh is a radial gradient with a pale core, seed ring
  and radial rays; `seam` `rgba(60,86,10,0.60)` / `rgba(210,232,140,0.95)`.
- **Resize** — sprite repainted from `art` geometry and re-blitted; proportions never stretch.
- **Recipes** — Slice x5 (L45), Halve (L46).

### Other special implementations

| Ingredient | What is special | Source |
|---|---|--:|
| **Pineapple** | peelable (R); spiky crown overhang; concentric rind/flesh via `innerGeom`; `PEEL_TONE #8A6A2A` | 7198 / skin 9026 |
| **Watermelon** | peelable (R); rind→pith→flesh insets; `PEEL_TONE #2C6531`; largest food (32x22cm, drawn 0.56x life) | null / 8684 |
| **Coconut** | peelable (R); rind + **hollow cavity** inset; `PEEL_TONE #8A5A2A` | 7725 / 8825 |
| **Broccoli** | `cluster`; florets are the silhouette; 3x3 dice → **16 pieces, correct** | 7981 |
| **Cauliflower** | `cluster`; curd lobes | 7035 |
| **Artichoke** | `cluster`; bract lobes + stubby cut-stem overhang | 7784 |
| **Pumpkin** | per-frame stem via `paintPumpkinStem`, drawn on the `over` pass, unclipped | 7893 |
| **Pea Pod** | permanent skin (P); spine/spineRx in `SCALE_LEN`; stem + curled tendril overhang | 7851 / 8973 |
| **Lemon** | concentric rind → pith → flesh via `innerGeom` | 6071 |
| **Basil / Parsley** | `cluster`; `fitCluster` derives rx/ry; Chiffonade ingredients | 5963 / 6017 |
| **Avocado** | pit occlusion is **paint**, not geometry; `taperCurve` fixed the linear-sweep defect in 17C | 6120 |
| **Grapes** | `cluster`; `fitCluster` prevents berry clipping | 7699 |
| **Cabbage** | `cluster`; Chiffonade | 6942 |
| **Cheddar** | `block` (3-face box); Phase 17B paint-only character pass — matte rail, mottle, crumble nicks, all clipped to the existing silhouette, **no geometry change** | 6248 |
| **Butter / Tofu** | `block`; corners from `SILS.block.pts(g)` | 6802 / 6840 |
| **Turnip** | **`SKIN_WHOLE`** — only ingredient whose skin stays wall-to-wall after cutting; no flesh sprite; leaf stalks + taproot overhang | 7976 / 8401 |
| **Mango** | permanent skin (P); **overhang lives in `SKIN.mango`** so stem and leaf show while the shell is on; pit is paint | 7452 / 8633 |
| **Baguette** | `face` crumb band — the mechanism the proteins' `face` reuses; demi loaf (32x6.5cm) | 6309 |

---

## 11. Story — THE LAST WISH

Presentation layer only. **No new phase, no new gameplay, no new save fields beyond three flags.**
The story reads the existing plate counter and reinterprets it; it never advances progression itself.

### 11.1 What "level" means

```js
Story.level() === Save.played()      // plates completed  (:1914)
```

There is **no 100-level table**. `nextRecipe()` is `recipeIndex + 1` mod 71, so for a forward-only player
**level N = recipe N** through 71; levels 72–100 replay the early list. Any production "level" concept must
map onto this counter or the milestones will fire at the wrong time.

### 11.2 Beat-by-beat

Storage keys: `story.introDone`, `story.ms`, `story.fin`, plus the existing `recipesPlayed`.
Beats hold `tint` (`sFaded`/`sDecline`/`sClean`/`sThrive`), `bare`, `veil`, `cam`, `hold` ms, `art`, `fx`,
`lines`, `quote`, `btn`, `kicker`, `step`, `cards`, `dlg`, `onEnter`.

**OPENING (4 beats, `:10944`)** — runs on first load via `boot()`.

| # | tint | art / fx | copy | hold |
|--:|---|---|---|--:|
| 1 | sFaded | cam ROOM | "For generations, this little restaurant belonged to your family." / "Your grandparent built it from the ground up." | 4400 |
| 2 | sDecline | — | "But when they became ill and could no longer run the restaurant, everything slowly fell apart." / "The kitchen grew quiet." / "Customers stopped coming." | 5600 |
| 3 | sDecline | `bedside`, veil | "Before they passed away, they gave you the keys." / "And one last wish." — quote **"Don't let this place disappear."** | 5600 |
| 4 | sFaded | `keys` (`sProp`) | "You had never planned to run a restaurant." / "You weren't even sure you wanted to." / "But this was their last wish." / "So you decided to give it one last chance." | btn **OPEN THE RESTAURANT** |

**FRESH — A Fresh Start (4 beats, `:10957`)**

| # | step | fx | copy | hold |
|--:|---|---|---|--:|
| 1 | kicker A FRESH START | — | "The restaurant needs a little work before we can open." | 2900 |
| 2 | CLEAN | `dust` | "Counters wiped. Dust out the door. The light comes back." | 3100 |
| 3 | SMALL REPAIRS | `spark` | "A shelf straightened, a hinge tightened, the kitchen light switched on." | 3100 |
| 4 | YOUR SAVINGS | `coins` | "You spent your savings to give the restaurant a chance." + 3 cards | btn **READY** |

The savings beat shows three cards — **Basic Cutting Board** (BOUGHT), **Basic Kitchen Knife** (BOUGHT),
**Fresh Ingredients** (FIRST BATCH) — and the coin particles fly **into** the cards: the savings *becoming*
the board, the knife and the first ingredients. The ingredient card paints **real tomato, cucumber and carrot
through their own `PAINT`** (`paintIng(cv)` `:11011`) — the story never invents food.

**CHEF (5 beats, `:10969`)** — dialogue, `ART.chef` / `ART.you`.

| # | who | line | hold |
|--:|---|---|--:|
| 1 | CHEF | "You really spent your savings on this place?" | 3000 |
| 2 | YOU | "I promised." | 2400 |
| 3 | CHEF | "Then we'd better make it count." | 2800 |
| 4 | CHEF | **"I'll handle the cooking. You handle the prep."** | 3200 |
| 5 | — | kicker **LEVEL 1**, title **FIRST PREP**, "The chef sets the first ingredient on your board." — `onEnter` calls `SceneFlow.prep(); startRecipe(0)` | 2600 |

> **Role contract:** the player is the **restaurant owner and hands-on prep cook**. The player is **not** the
> chef; the chef cooks. Beat 4 states it in dialogue and the game never contradicts it.

**MILESTONES (4, `:10997`)** — a 4200ms banner (kicker + line), not a sequence.

| bit | level | kicker | line | why this level |
|--:|--:|---|---|---|
| 1 | **8** | THE ROOM COMES BACK | "It's starting to feel like a real restaurant again." | spirit crosses `SPIRIT_AMBIENT_AT` (58) on the normal grade mix — the room gains its ambient tone, warmth ~0.3; all five core techniques seen by recipe 6 |
| 2 | **20** | WORD GETS AROUND | "People are coming back." | the 20th distinct ingredient lands at recipe 20 — a menu, not a station |
| 4 | **45** | SOMETHING WORTH KEEPING | "I never thought I'd care this much about this place." | spirit caps and warmth stops rising — the player continues for its own sake |
| 8 | **70** | THE LAST WISH | "They would have loved seeing this." | recipe 70 is `garden-prep`, the only multi-stage plate, made of the cucumber/tomato/carrot the savings beat bought |

Grandparent copy is **gender-neutral throughout** — "They would have loved seeing this.", never "Grandpa".
The opening is grandparent-neutral and beat 4 must stay consistent with it.

**FINALE (4 beats, `:10977`)** — gated `n >= 100 && story.fin !== true`.

| # | tint | art | copy |
|--:|---|---|---|
| 1 | sThrive | cam ROOM, no art (**the room IS the art** — the restored kitchen the player has been standing in) | "You came here to keep a promise." / "You stayed because you wanted to." |
| 2 | sThrive | — | "Years ago, this place was almost forgotten." / "Today, it's the best restaurant in town." |
| 3 | sThrive | `dining`, veil | "You didn't just inherit your grandparent's restaurant." / **"You built this."** |
| 4 | sThrive | `dining`, veil | title **THE RESTAURANT LIVES ON**, quote **"They would be proud."**, btn BACK TO THE KITCHEN |

> **Copy freeze:** finale ownership stays with the player — **"You built this."** and **"They would be
> proud."**. **"We did it." must NOT be introduced.** The payoff is the realisation, not the ranking.

### 11.3 Implementation contract

```js
flush(){                                                        // :11197
  if(live || Store.get(KEY.done) !== true) return null;         // never during a sequence or before the intro
  const n = Save.played();
  if(n >= 100 && Store.get(KEY.fin) !== true){                  // finale first, once
    Store.set(KEY.fin, true); run(FINALE, backToKitchen); return 'finale'; }
  let mask = intOr(Store.get(KEY.ms), 0);
  for(const m of MILES) if(n >= m.at && !(mask & m.bit)){       // first unfired milestone only
    Store.set(KEY.ms, mask | m.bit); banner(m.kicker, m.line); return 'milestone.' + m.at; }
  return null;
}
```

Properties that must survive the port:

- **`story.ms` is a 4-bit mask** (bits 1/2/4/8). **Full value 15.** The regression harness's mute value is 15
  and stays correct only while there are exactly 4 milestones.
- **Duplicate prevention** is the mask, not a timestamp: a milestone whose bit is set can never fire again.
  Verified by simulating plates 1→101 with a second `flush()` at every level — all second calls returned null.
- **One banner per flush.** `for … return` — a player who jumps from level 5 to level 50 (e.g. a restored
  save) gets milestone 8 on that plate, then 20 on the next, and so on. Deliberate: no stacking.
- **Forward-only.** Conditions are `n >= m.at`, so the mask only ever gains bits. Nothing recomputes or
  un-fires. `newGame()` resets `story.ms` to 0 and `story.fin` to null.
- **Finale takes precedence** over any unfired milestone and fires exactly once (`story.fin`).
- **`flush()` is called after a plate is put away** and reads the existing counter and nothing else.
- **`boot()`** `:11186` — `story.introDone === true` ⇒ `'returning'` (no story); otherwise `newGame()` runs
  OPENING+FRESH+CHEF and sets `introDone` on completion, ending **on the first prep, ready to cut**.
- **Chapters** (`const CH` `:11157`) — a dev/QA walk of the whole flow. Entries are **derived** from the beat
  arrays and `MILES`, so `LEVEL 8 / 20 / 45 / 70 / FINALE` labels update automatically from `at:`. Changing a
  milestone level requires **no** chapter edit.
- **`Story.report()`** `:11212` returns `{live, beat, beats, level, introDone, milestones, finaleSeen, bare, locked}`.

---

## 12. Characters — final implementation (character-art polish pass COMPLETE)

Both characters were rebuilt in the polish pass immediately before this freeze. **The versions in the source
now are the final ones.** Same art language for both: flat fills, one darker tone per shape, 1.1–2.6px
strokes, warm muted palette, rounded geometry, simplified faces, no photorealism, no bitmaps.

### Grandparent — `ART.bedside` (`:10779`, viewBox 360x232)

Scene: warm wall gradient, window with muntins and sill, dresser, nightstand, **lamp with a radial glow**, bed
with pillow and quilt, plus the figure. Unchanged from before the pass: glasses, hair, bed, blanket, lamp,
room, composition.

**The arm is ONE pose authored in its own frame** — `<g transform="translate(242,155) rotate(16)">` — so the
axis runs from the shoulder (local 0) down the quilt at 16°, and every part shares a centreline and cannot
drift apart:

| part | construction |
|---|---|
| contact shadow | `ellipse cx=58 cy=12 rx=40 ry=9.5 #6E7A4E @ .15` on the quilt |
| pyjama sleeve | `#EADDC6` body, `#DCCDB2` fold stroke, attached at the shoulder |
| cuff | `rect x=20 w=7.5 h=19 rx=3.2 #DCCDB2` — a clear sleeve→skin transition |
| forearm | `#E9C6A2`, **wider at the elbow, narrowing to the wrist** (not a uniform capsule); `#F2D3AF` top light, `#D8AF89` wrist crease |
| palm | rounded, `#E9C6A2` |
| thumb | separate lobe off the palm's upper edge, readable at scene scale |
| fingers | **three lobes** with soft `#D8AF89` divisions + a knuckle line — simple curved divisions, not detailed fingers |

**Palette:** skin `#E9C6A2` / light `#F2D3AF` / shade `#D8AF89`; sleeve `#EADDC6` / `#DCCDB2`;
quilt `#EADDC6`; linen `#F3E8D6` / `#FCF6EA`; hair `#DFDAD2`; lamp `#D8A03D`.

**Key interaction:** the key is drawn **before** the hand in document order, so its shank passes **under** the
fingers and only the bow (`circle r=6`, `#C9973F`) and teeth clear them. It reads as **held / being handed
over**, not an icon resting on the blanket. Rendering order is load-bearing — do not reorder.

**Expression:** two 32%-alpha cheek shapes (`#D99C74`) and a softened mouth curve
(`M218,118 q6,4 12,-0.5`, `#B07C5E`). Reads elderly, frail, peaceful, warm, slightly tired — **not** ill,
frightening or melodramatic.

### Chef — `ART.chef` (`:10858`, viewBox 120x120)

**A bust, not a floating head.** Structure top to bottom: toque → head → neck → shoulders → chef jacket →
partial arms. Composed so the circular portrait frame **crops the sleeves, not the shoulders**.

| part | construction |
|---|---|
| background | `linearGradient #sgChefBg` `#F3E6CF → #E6D5B7`, full-bleed circle |
| toque | `#FFFDF7` crown with real volume (`M28,38 C22,16 34,4 50,7 C55,-2 68,-2 73,7 C89,4 99,17 92,38`), `#F4ECDD` shadow side, `rect x=29 y=33 w=62 h=11 rx=6` band + `#E2D6C0` band line |
| head | `ellipse cx=60 cy=62 rx=21.5 ry=23 #E3B183`, group rotated **−3°** for a slight head angle |
| ears | `ellipse rx=3.6 ry=5 #D49B6C` both sides |
| jaw shading | `#3E3129 @ .1` under the cheeks |
| sideburns | two `#3E3129` wedges at the temples |
| neck | `M50,72 h20 v14 q-10,7 -20,0` `#C98F60` |
| shoulders / jacket | `#FAF6EE` squared bust with `#EFE6D4` sleeve shading at both frame edges |
| lapels | two `#FFFDF7` panels + `#E2D6C0` seam strokes (double-breasted) |
| buttons | two `circle r=1.8 #E2D6C0` |
| neckerchief | `#D94B45` diamond (kept from the original) |

**Palette:** skin `#E3B183` / `#D49B6C` / `#C98F60`; ink `#3E3129`; whites `#FFFDF7` / `#FAF6EE` / `#F4ECDD` /
`#EFE6D4`; seam `#E2D6C0`; red `#D94B45`; mouth `#8A4B40`.

**Expression — skeptical surprise for "You really spent your savings on this place?"** and asymmetric on
purpose: one brow raised straight, the other lower (`M45,51.5 q7,-5.5 14,-2` vs `M66,55 q7,-2.5 13,0.5`);
widened eyes of slightly different size (`rx 3/ry 3.5` vs `rx 2.9/ry 3.3`); a small open mouth (`#8A4B40`) with
an amusement crease at the corner; the −3° head tilt. Reads **surprise + disbelief + skepticism + a little
amusement** — never anger. Approachable and cozy, not intimidating; experienced, not a mascot or a child.

### Dialogue integration

`dlgHTML(d)` `:11030` — `.sDlg` (flex, `align-items:flex-end`) → `.sDlgArt` (circular, `overflow:hidden`)
+ `.sBubble` (`.sWho` + `.sSay`), `.you` modifier flips the side for the player.
**`.sDlgArt` is `clamp(64px, 14vmin, 100px)`** — raised from `clamp(54px,12vmin,86px)` in the polish pass so
the bust has room. That CSS value is the **only** layout change the pass made; the dialogue box, typography,
timing and all text are untouched.

### Other story art

| Asset | Line | viewBox | Purpose |
|---|--:|---|---|
| `ART.keys` | 10843 | — | the restaurant key as a prop (opening beat 4, `sProp` class) |
| `ART.you` | 10889 | 120x120 | the player's portrait (dialogue, `side:'you'`) |
| `ART.dining` | 10901 | 360x116 | full dining room, finale beats 3–4: 3 pendant lamps with radial glows, seated diner silhouettes, tables |
| `ART.board` | 10923 | 120x70 | Basic Cutting Board card |
| `ART.knife` | 10932 | 120x70 | Basic Kitchen Knife card |
| *(ingredient card)* | 11011 | canvas | **not an asset** — `paintIng()` calls the real `PAINT.tomato/cucumber/carrot` |

All 7 are **inline SVG strings, procedural, zero bitmaps, zero external files**. Production likely has no
equivalent — port the strings verbatim, or re-render them as components with the exact same path data.

### Particles

`fx(kind)` `:11046` — DOM `div`s with CSS keyframes, three kinds: `dust` (26), `coins` (18, **retargeted at
the live card bounding boxes** so the money lands in the purchases), `spark` (12). No skeletal animation, no
sprite sheets. Host is cleared past 120 children.

---

## 13. Rendering, scaling and resize

```js
const PX_PER_CM = 22.5, SIZE_REF_CM = 10, SIZE_GAMMA = 0.5;    // :3526
const SIZE_MAX_W = 0.90, SIZE_MAX_H = 0.62;                     // no food may crowd the board out
const SCALE_LEN = ['rx','ry','rBig','rSmall','capR','depthX','depthY','spine','spineRx','skinRim'];
```

**The scale rule.** `REAL_CM[id] = [long, short]` in centimetres (all 42 present, `:3506`).

```
dispL = SIZE_REF_CM * (REAL_CM[id][0] / SIZE_REF_CM) ^ SIZE_GAMMA      // cm on the board
tl    = dispL * PX_PER_CM                                              // long axis, px
ts    = REAL_CM[id][1] * (dispL / REAL_CM[id][0]) * PX_PER_CM          // short axis, food's own aspect
```

The **footprint** is matched long-to-long and short-to-short, with no reference to which screen axis either
lies along — a mango is painted standing and a celery lying, so asking "is the target box wide or tall" gives
the wrong answer. `PX_PER_CM 22.5` makes the board a real 22cm board, so a 10cm food lands at **true size**.
`SIZE_GAMMA 0.5` (square root) compresses the spread around the reference: order and every ratio survive,
just gentler — watermelon 0.56x life, radish 1.29x, and the watermelon still reads 4x the radish's length.
**Nothing here is a per-food fudge: change these two numbers and all 42 move together.**

`ing.art = geomSnapshot(g)` freezes the **authored** proportions for the painters, forever, before any scaling.

**Plate:** `PLATE_RX 224, PLATE_RY 172, PLATE_DY 14` — a 20cm side plate at `PX_PER_CM`. It grew with the
roster; at the old 196x150 a watermelon shingle hung 5% past the rim and the plate was deciding how big food is.

**Resize:** on viewport change, sprites are repainted from `art` geometry and re-blitted into the new scaled
box — proportions never stretch. Plating re-lays out from the same geometry. Phase 17 added **zero-size canvas
guards** in `resize`, `KitchenScene.ensure` and `checkSize`: a 0-width/height canvas yields non-finite
transforms and throws on gradient creation.

### MUST NOT CHANGE during integration

1. `PX_PER_CM`, `SIZE_REF_CM`, `SIZE_GAMMA` — the whole roster's relative size.
2. Any `REAL_CM` entry.
3. `SCALE_LEN` membership — dropping `spine`/`spineRx` breaks Pea Pod bounds; dropping `skinRim` breaks the
   permanent-skin rim annulus.
4. The `ing.art` snapshot mechanism (painters must never see the scaled box).
5. `skinAlpha` as the **single** shell-opacity path.
6. The cut model's ignorance of skin and overhang.
7. Determinism in `PAINT`/`SKIN` (hash off the loop index, never `Math.random`).
8. Key-before-hand rendering order in `ART.bedside`.
9. `story.ms` as a 4-bit mask, full value 15.
10. Milestone levels **8 / 20 / 45 / 70** and the finale gate at **100**.
11. The zero-size canvas guards and the `getImageData` clamps.

---

## 14. Intentional differences — SOURCE-INTENTIONAL / MUST PRESERVE

None of these were "fixed" during packaging. **Do not reorient them in production to match older production
art.** The Claude Design orientation is the reference.

| Ingredient | Status | Detail |
|---|---|---|
| **Corn** | SOURCE-INTENTIONAL / MUST PRESERVE | painted lying along the board, green stalk stub overhang past the butt; REAL_CM 19 x 5 |
| **Radish** | SOURCE-INTENTIONAL / MUST PRESERVE | root-down, leaf tops as overhang past the crown; `rBig`/`rSmall` geometry, not a plain ellipse |
| **Mozzarella** | SOURCE-INTENTIONAL / MUST PRESERVE | radial-gradient ball; a cut opens a **duller** face on purpose — a shinier cut face reads as a lit sphere with a line drawn on it |
| **Pear** | SOURCE-INTENTIONAL / MUST PRESERVE | painted standing on its base, stem up as overhang |

Also deferred, documented, not defects:
- **Flow-light probe sensitivity** — the settled board-luminance delta is measurable but small (+2.49%). The
  regression harness must sample `valueProbe().board.mean` on a settled frame; a single-pixel single-draw
  probe reads ~0.4% and is wrong. See §16.
- **`camCost.roomRerendered`** — flakes under host load in the preview environment. Not a product defect.

---

## 15. Where Claude Code should start reading

| To port… | Read |
|---|---|
| an ingredient | `CONFIG.INGREDIENTS[id]` (profile) + `PAINT[id]` + `SKIN[id]` — line numbers in `KNIFECRAFT-SOURCE-MAP.md` |
| the proteins | `SILS.fillet` `:3370`, `drawDepthWall` `:5417`, `spreadPieces` `:4230`, `shadeCutEdges` `:5027`, protein paint `:8061`/`:8179`/`:8318` |
| peel | `:5641–5679` end-to-end, then `MECHANICS-SKIN-PEEL-OVERHANG.md` |
| scale | `:3506–3526` and the loop that follows it |
| shape families | `const SILS` `:3124` |
| the story | `:10774–11216` (the whole `Story` IIFE) |
| the characters | `ART.bedside` `:10779`, `ART.chef` `:10858` |
| QA | `window.__kcTest` `:9489`; run `__kcTest.regressStart()`, read `window.__kcRegressLast` |

### Porting instructions

1. **Port data before code.** `CONFIG.INGREDIENTS`, `REAL_CM` and `CONFIG.recipes.RECIPES` are plain data —
   move them across verbatim first, as JSON/TS objects. They carry geometry, resistance, audio, particles and
   seams. Do not retype values; copy them.
2. **Port the scale loop next** (`:3506–3560`), unchanged, including `ing.art = geomSnapshot(g)`.
3. **Port `SILS` verbatim.** Same rails, same `inside()`, same `support()`. `fillet`'s two-rail parameterisation
   is not optional.
4. **Port the painters as canvas functions.** They are `(ctx, geom) => void` with no framework dependency and
   run unchanged inside Phaser or a plain canvas texture pass. Keep the index hashing.
5. **Keep the sprite cache shape**: paint once per id at authored size, blit into the scaled box.
6. **Port peel as-is** (§8). Resist the brief's grid description.
7. **Port the story as data + one renderer.** The beat arrays are declarative; `flush()` is 9 lines. Keep the
   bitmask.
8. **Port the character SVGs verbatim** (path data included), or render them as components with identical paths.
9. **Run the QA checklist (§17) against production**, not against this file.

### What Claude Code MUST NOT change

- The 11 items in §13.
- The 10 production-only ingredients (§6) — do not delete while syncing the roster.
- The 4 intentional differences (§14) — do not "fix".
- Story copy: the finale is **"You built this."** / **"They would be proud."**; beat 4 is **"They would have
  loved seeing this."**; **"We did it." must not appear**; the grandparent stays gender-neutral.
- Milestone pacing 8/20/45/70/100.
- Kiwi's 0-cut appearance (fully brown shell) and the permanent-skin set.
- The proteins' lack of a peel step.

---

## 16. Regression receipt

Full detail in `REGRESSION-RUN.md`. Summary of the freeze run appears there with date, pass/fail, per-section
figures and the two known flakes. **No known failure is hidden.**

## 17. QA checklist for the production port

- [ ] All 42 Claude Design ingredients present, ids matching §3 exactly.
- [ ] `chicken`, `steak`, `salmon` present under **those ids**, on `fillet`, with `depth` and `face`.
- [ ] All 10 production-only ingredients still present.
- [ ] Roster count reconciled with the product owner (52 computed vs 49 stated).
- [ ] `REAL_CM` complete for every ingredient; `PX_PER_CM/SIZE_REF_CM/SIZE_GAMMA` = 22.5/10/0.5.
- [ ] A 10cm food renders at true size on the board; watermelon ≈0.56x life, radish ≈1.29x.
- [ ] Exactly 3 peelable ingredients; 8 permanent-skin; turnip is the only `SKIN_WHOLE`.
- [ ] Kiwi at 0 cuts is entirely brown shell; a cut opens green flesh inside a brown rim.
- [ ] Kiwi and mango do **not** auto-peel.
- [ ] Knife locked during a peel step; rub strokes produce no cut.
- [ ] Cut model never reads skin/overhang state.
- [ ] 3x3 dice yields 16 pieces on every dice ingredient.
- [ ] Protein slices visibly part (`spreadPieces`) and show a depth wall in the flesh palette.
- [ ] No `Math.random` in any painter; two loads render identical sprites.
- [ ] Zero-size canvas guards present; no non-finite transform under a collapsed viewport.
- [ ] Story: milestones fire at exactly 8/20/45/70, once each; finale at 100, once.
- [ ] `story.ms` reaches 15 and no further.
- [ ] Chapter labels derive from `MILES` (change an `at:`, label follows).
- [ ] Finale copy exact; no "We did it."; grandparent gender-neutral.
- [ ] Chef reads as a bust with shoulders; grandparent's hand has thumb + 3 fingers and holds the key.
- [ ] Zero bitmap assets introduced.

---

## CLAUDE CODE — INTEGRATION START HERE

1. **Read this file top to bottom once.** Then read the ⚠ box in §1 again — four things in the commissioning
   brief contradict the source, and following the brief instead of the source will produce systems this game
   does not have (most importantly a grid-based peel that does not exist).
2. **The only authoritative file is `knifecraft.html`.** Open it. `KNIFECRAFT-SOURCE-MAP.md` has every line
   anchor; `KNIFECRAFT-INTEGRATION-MANIFEST.json` has the same data machine-readable.
3. **Port in this order:** data (`CONFIG.INGREDIENTS`, `REAL_CM`, `RECIPES`) → scale loop → `SILS` → painters
   → sprite cache → peel → cut model → story → characters.
4. **Proteins are `chicken` / `steak` / `salmon`.** Not `meat`, not `fish`. §4.
5. **Peel is rub-to-peel, 3 ingredients, `skinAlpha` is the only opacity path.** §8.
6. **Do not delete the 10 production-only ingredients** while reconciling the roster, and **do not delete
   anything to hit 49** — that number does not reconcile (§6). Ask the product owner.
7. **Do not change the 11 frozen items in §13**, the 4 intentional differences in §14, or any story copy.
8. **Verify with §17**, then run the production equivalent of `__kcTest.regressStart()`.
