# KNIFECRAFT — FINAL CLAUDE DESIGN → PRODUCTION
# PRE-INTEGRATION AUDIT

**Read-only. No production file changed. No Claude Design file changed. No ingredient deleted, renamed, or added. No recipe, story, or gameplay changed.**

Claude Design source for this pass:
`D:\WORKS\GAMES\Knife Craft\Knifecraft Phase 1 review\Knifecraft Phase 1 review (2)\KNIFECRAFT-FINAL\knifecraft.html`

This is the same frozen package audited previously (the prior extraction, `... review (1)`, no longer exists on disk — it was replaced by `(2)`). Every load-bearing symbol/constant re-checked below was re-grepped **directly in this file**, not copied from the earlier pass or from the markdown docs, per the "don't trust documentation over source" rule. Every anchor matched the prior audit exactly (same line numbers, same values) — there is no drift between the two deliveries.

Production source: `D:\WORKS\GAMES\Knife Craft` (this repository). Confirmed unchanged since the prior audit — no production file has been edited in the interim.

---

## 1. Executive summary

- **Ingredient roster**: all 39 non-protein Claude Design ingredients already exist in production **by id**. Zero design-only non-protein ingredients. 3 genuinely new ids (`chicken`, `steak`, `salmon`). 10 production-only ingredients, all confirmed still present and recipe-connected. **Final merged roster = 52.** The commissioning brief's "49" does not reconcile against the actual source under any deletion-free arithmetic.
- **Proteins**: fully specified from the actual source (not screenshots) — a new `fillet` shape family, two-rail asymmetric geometry, 2.5D depth-wall system, protein-specific paint. Real net-new engineering.
- **Peel — the one architectural conflict in this audit**: the frozen source's real peelable set is exactly `pineapple, watermelon, coconut` (hand-travel budget + `skinAlpha`, not a grid). Production currently has a real, working normalized-grid peel system correctly limited to `onion/potato/garlic` (production-only, no conflict) and `pineapple/watermelon/coconut` (common, mechanism differs but gating behavior agrees) — **plus** a Peel technique added to 8 further ingredients (`cucumber, beetroot, sweetpotato, fennel, peapod, mango, kiwi, pomegranate`) in an earlier session, all 7 of which (all but cucumber) are `SKIN_KEEP` — **permanent skin, must never peel** — in the frozen source. Zero shipped recipes reference peel on any of those 8, so this is fully reconcilable with no recipe risk, but it is a product decision, not an engineering one (§21).
- **Story**: production has no narrative system of any kind (confirmed by exhaustive grep — zero matches for any story symbol, copy, or state key). This is 100% new work, fully specified from the actual source. One real collision: production's existing (unrelated) cafe-tier milestone system and Design's story milestone both key off level 20.
- **Characters**: zero character art exists in production. The frozen source's grandparent/chef art is confirmed, by direct inspection of the specific implementation details (not just the docs' claims), to be the final polished pass, not a stale version.
- **Techniques**: production's 4 extra techniques (Smash, Rings, Radial, Rock Mince) need no changes — Design has no opinion on them. Only the Peel *roster* (which ingredients get the technique at all) needs correcting.
- **Blocking**: yes — three product decisions (roster size, peel-roster correction, level-20 sequencing) must be made before implementation starts. See §21.

---

## 2. Exact ingredient reconciliation

Method: read `INGREDIENTS: Record<IngredientId, IngredientDefinition>` in `src/game/definitions.ts` directly (49 top-level keys, confirmed by script, matching the Ingredient Lab's own "49 ingredients available" label), diffed against the 42 ids in the frozen source's `REAL_CM`/`CONFIG.INGREDIENTS` table (39 non-protein + `chicken`/`steak`/`salmon`), then checked every id against `levelDefinitions.ts` for actual recipe usage (not just definition presence).

| ID | Display name | Design? | Prod? | Status | Recommended action | Recipe usage (prod) | Notes |
|---|---|:--:|:--:|---|---|---|---|
| tomato | Tomato | ✓ | ✓ | COMMON | Verify paint/geometry against `PAINT.tomato` (`:5884`) | Heavy (L1 tutorial + many) | — |
| cucumber | Cucumber | ✓ | ✓ | COMMON | Keep existing `hasCut` two-tone paint (already matches source); **remove Peel technique** (§6) | Heavy (24+ steps) | Design has **no** `SKIN` entry for cucumber at all — its two-tone is baked into `PAINT.cucumber`, no shell, no peel, ever |
| carrot | Carrot | ✓ | ✓ | COMMON | Verify against `PAINT.carrot` (`:5938`) | Heavy | — |
| basil | Basil | ✓ | ✓ | COMMON | Design shape is `cluster` (silhouette = the leaves, `rx/ry` from `fitCluster()`); production currently approximates via a different shape path | Yes | Shape-family gap, see §7/§9 |
| parsley | Parsley | ✓ | ✓ | COMMON | Same `cluster` gap as basil | Yes | — |
| lemon | Lemon | ✓ | ✓ | COMMON | Design: concentric rind→pith→flesh via `innerGeom`. Production's `lemonTexture.ts` has the same unconditional-flesh defect Peach had before this session's earlier fix — flagged, not fixed (out of this audit's scope) | Yes | See §9 |
| avocado | Avocado | ✓ | ✓ | COMMON | Design: pit occlusion is paint, not geometry (a real hole would split one piece into two disconnected regions the partition model can't represent) | Yes | See §9 |
| eggplant | Eggplant | ✓ | ✓ | COMMON | Verify against `PAINT.eggplant` (`:6195`) | Yes | — |
| cheddar | Cheddar | ✓ | ✓ | COMMON | Design: `block`, corners from `SILS.block.pts(g)` | Yes | See §9 |
| baguette | Baguette | ✓ | ✓ | COMMON | **Investigated — not a duplicate of `bread`, see §2.1.** Already a capsule matching the source | **0** (defined, unused) | — |
| broccoli | Broccoli | ✓ | ✓ | COMMON | Design: `cluster`; 3x3 dice → 16 pieces (Design's own audited figure) | Yes | See §7/§9 |
| pear | Pear | ✓ | ✓ | COMMON | **Intentional orientation** (standing on base, stem-up overhang) — preserve | Yes | See §15 |
| peach | Peach | ✓ | ✓ | COMMON | Already reconciled this session (`hasCut` gating, warm diagonal gradient) — no outstanding action | Yes | — |
| corn | Corn | ✓ | ✓ | COMMON | **Intentional orientation** (lying, stalk-stub overhang) — preserve | Yes | See §15 |
| celery | Celery | ✓ | ✓ | COMMON | Verify against `PAINT.celery` (`:6576`) | Yes | — |
| mozzarella | Mozzarella | ✓ | ✓ | COMMON | **Intentional duller cut face** — preserve, verify on port | Yes | See §15 |
| butter | Butter | ✓ | ✓ | COMMON | Design: `block` | Yes | — |
| tofu | Tofu | ✓ | ✓ | COMMON | Design: `block` | Yes | See §7 |
| lettuce | Lettuce | ✓ | ✓ | COMMON | Design: `cluster` | Yes | — |
| cabbage | Cabbage | ✓ | ✓ | COMMON | Design: `cluster`. Production currently has Cabbage on `shape: "ellipse"` — **shape-family mismatch** | Yes | See §7/§9 |
| cauliflower | Cauliflower | ✓ | ✓ | COMMON | Design: `cluster` | Yes | See §7 |
| spinach | Spinach | ✓ | ✓ | COMMON | Design: `cluster` | Yes | — |
| pineapple | Pineapple | ✓ | ✓ | COMMON | Peelable in both; mechanism differs (§6). Keep gate, mechanism is a lower-priority follow-up | **0** (Lab-only) | See §6 |
| asparagus | Asparagus | ✓ | ✓ | COMMON | Design: `cluster` | Yes | — |
| radish | Radish | ✓ | ✓ | COMMON | **Intentional orientation** (`rBig`/`rSmall`, root-down) — preserve | Yes | See §15 |
| beetroot | Beetroot | ✓ | ✓ | COMMON | Design: **`SKIN_KEEP`**, never peels. **Remove Peel technique** (§6) | Yes (non-peel steps) | Conflict |
| sweetpotato | Sweet Potato | ✓ | ✓ | COMMON | Same `SKIN_KEEP` conflict as beetroot | Yes | Conflict |
| watermelon | Watermelon | ✓ | ✓ | COMMON | Peelable in both, mechanism differs (§6) | **0** (Lab-only) | See §6 |
| mango | Mango | ✓ | ✓ | COMMON | `SKIN_KEEP` conflict (Peel technique only — cut-reveal paint already correct) | Yes | Conflict |
| kiwi | Kiwi | ✓ | ✓ | COMMON | `SKIN_KEEP` conflict (Peel technique only) — **0-cut appearance and cut-reveal already match the source's explicit "do not regress" spec exactly** | Yes | See §7 |
| pomegranate | Pomegranate | ✓ | ✓ | COMMON | `SKIN_KEEP` conflict | Yes | Conflict |
| greenbean | Green Bean | ✓ | ✓ | COMMON | Design: `cluster` | Yes | — |
| grapes | Grapes | ✓ | ✓ | COMMON | Design: `cluster`, `fitCluster()` prevents berry clipping | Yes | See §7 |
| coconut | Coconut | ✓ | ✓ | COMMON | Peelable in both, mechanism differs; Design adds a hollow-cavity inset | **0** (Lab-only) | See §6/§9 |
| fennel | Fennel | ✓ | ✓ | COMMON | `SKIN_KEEP` conflict | Yes | Conflict |
| artichoke | Artichoke | ✓ | ✓ | COMMON | Design: `cluster` | Yes | — |
| peapod | Pea Pod | ✓ | ✓ | COMMON | `SKIN_KEEP` conflict. Spine-aware `peelHalfExtents()` fix from an earlier session becomes moot if Peel is removed | Yes | Conflict |
| pumpkin | Pumpkin | ✓ | ✓ | COMMON | Design's stem is a per-frame `over`-pass paint, not baked into the sprite — verify production doesn't bake it (a baked stem survives a cut riding one piece) | Yes | See §7 |
| turnip | Turnip | ✓ | ✓ | COMMON | Design: **`SKIN_WHOLE`** — the only ingredient whose skin never comes off, ever, even after cutting; no flesh sprite exists at all. Production has no Peel technique on turnip (correct) but the cut-reveal visual needs verification (a cut should open onto *more skin*, never flesh) | Yes | — |
| chicken | Chicken Breast | ✓ | ✗ | **DESIGN-ONLY** | Add. `fillet` shape family (new). See §4 | — (0 recipes exist) | Net-new |
| steak | Ribeye Steak | ✓ | ✗ | **DESIGN-ONLY** | Add. `fillet`. See §4 | — | Net-new |
| salmon | Salmon Fillet | ✓ | ✗ | **DESIGN-ONLY** | Add. `fillet`. See §4 | — | Net-new |
| apple | Apple | ✗ | ✓ | PRODUCTION-ONLY | Preserve exactly | Yes | Not in Design |
| bread | Bread | ✗ | ✓ | PRODUCTION-ONLY | **Investigated — not a duplicate of `baguette`, see §2.1.** Preserve exactly | 20+ steps | — |
| garlic | Garlic | ✗ | ✓ | PRODUCTION-ONLY | Preserve exactly, incl. mandatory peel-first gate | Yes | Not in Design |
| mushroom | Mushroom | ✗ | ✓ | PRODUCTION-ONLY | Preserve exactly | Yes | Not in Design |
| onion | Onion | ✗ | ✓ | PRODUCTION-ONLY | Preserve exactly, incl. mandatory peel-first gate (heaviest peel user in the game) | Yes (heavy) | Not in Design |
| orange | Orange | ✗ | ✓ | PRODUCTION-ONLY | Preserve exactly | Yes | Not in Design |
| pepper | Bell Pepper | ✗ | ✓ | PRODUCTION-ONLY | Preserve exactly | Yes | **Production's actual id is `pepper`**, not `bell_pepper` — confirmed by reading `definitions.ts` directly; noted here since this run's brief referred to it as `bell_pepper` |
| potato | Potato | ✗ | ✓ | PRODUCTION-ONLY | Preserve exactly, incl. mandatory peel-first gate | Yes (heavy) | Not in Design |
| strawberry | Strawberry | ✗ | ✓ | PRODUCTION-ONLY | Preserve exactly | Yes | Not in Design |
| zucchini | Zucchini | ✗ | ✓ | PRODUCTION-ONLY | Preserve exactly | Yes | Not in Design |

**No RENAMED id exists.** Every id present in both projects is spelled identically (`sweetpotato`, `greenbean`, `peapod`, etc.) — checked by exact-string diff of the two id sets, not by inspection of a handful of cases.

### 2.1 `baguette` vs `bread` — investigated per instructions, not assumed

| | `baguette` (production `BAGUETTE_GEOMETRY`) | `bread` (production `BREAD_GEOMETRY`) |
|---|---|---|
| Shape family | `capsule`, `RX_FRAC:186.76/540, CAP_R_FRAC:44.05/540` — long, narrow | `taper`, `RX_FRAC:150/540, R_BIG_FRAC:78/540, R_SMALL_FRAC:76/540` — wide, near-round both ends |
| Matches a Design id? | Yes — code comment states "real `shape:'capsule'` in the actual source"; Design's `REAL_CM.baguette = [32, 6.5]` (long/thin) matches this geometry's proportions | No — Design has no ingredient using this silhouette; it is a standalone round-loaf shape |
| Recipe usage | **0** references in `levelDefinitions.ts` | **20+** references, actively shipped |

**Conclusion: not a duplicate.** `baguette` is a correct, if currently unused, port of Design's long French loaf. `bread` is a separate, already-shipped, round sandwich loaf with no Design counterpart. **Do not merge. Do not delete either.**

---

## 3. Final roster arithmetic

```
Claude Design total:        42   (39 non-protein + 3 protein)
Production total:           49
Common total:                39   (every non-protein Design id already exists in production)
Design-only total:            3   (chicken, steak, salmon)
Production-only total:       10   (apple, bread, garlic, mushroom, onion, orange, pepper, potato, strawberry, zucchini)
Duplicates:                   0   (baguette/bread investigated and cleared — §2.1)
Renamed IDs:                  0
———————————————————————————————————
Final merged total:          52
```

The evidence supports **42 + 10 = 52** exactly, with zero overlap between the Design roster and the production-only list, and zero ids that would need to be deleted to make any smaller number work. **No deletion produces 49 without naming a specific ingredient to cut, which nothing in either source justifies** (all 10 production-only ingredients are recipe-connected; the roster's own three "new" ids are additive, not replacements).

**FINAL ROSTER = 52**, pending the product-owner sign-off requested in §21 (this audit recommends 52; it does not unilaterally finalize it).

---

## 4. Protein integration (Chicken, Steak, Salmon)

Verified directly in `knifecraft.html`: `chicken:` (`:1317`), `steak:` (`:1353`), `salmon:` (`:1380`). Grepped for ` meat:` and ` fish:` as profile keys anywhere in the file — **zero matches**. The three ids are exactly `chicken`, `steak`, `salmon`; do not create `meat`/`fish`.

| Property | chicken | steak | salmon |
|---|---|---|---|
| Display name | Chicken Breast | Ribeye Steak | Salmon Fillet |
| Shape family | `SILS.fillet` (`:3370`) — **new**, does not exist in production. Two independent rails over a normalized length `s` (0 = broad shoulder, 1 = blunt tip) — genuinely asymmetric, unlike every other production shape family | same | same |
| Geometry (authored px) | `rx:188, ry:96` | `rx:180, ry:138, bias:0.52, full:0.70, bow:0.05, tilt:0.10, topFull:0.10, botFull:0.20, wob:0.05` | `rx:200, ry:100, bias:0.44, full:0.54, bow:0.08, tilt:0.16, topFull:0.12, botFull:0.14, wob:0.03` |
| REAL_CM (scale) | `[16, 9]` | `[17, 13]` | `[25, 11]` |
| Silhouette | Both rails feed `inside()`, both spans, and `support()` identically — real asymmetric geometry, not an ellipse trick | same mechanism | same mechanism |
| Face (cut band) | `4px / 2.5 inset`, `#F5CABC → #EBB2A1 → #DFA08D` | `5px / 2.5`, `#C4424A → #AE313A → #97262E` — lighter red, never pink | `5px / 2.5`, `#FFA582 → #F98A66 → #ED7A55` |
| Depth (2.5D wall) | `depth.px:12, slab:4, spread:0.17, edge.px:18` | `depth.px:14, slab:5, spread:0.17, edge.px:20` | `depth.px:13, slab:5, spread:0.17, edge.px:18` |
| `drawDepthWall` | `:5417` — extrudes `depth.px` along one world-space direction, scaled by `k`; tones walked darker from the flesh palette, never white/grey | same function, per-protein tone table | same |
| Piece fan-out | `spreadPieces()` `:4230` — fans pieces along each cut set's own normal by `depth.spread`, proportional to distance from the set's middle (affine, so gaps open evenly) | same | same |
| Cut-edge shading | `shadeCutEdges()` `:5027` — per-piece roll-off a few px inside every cut boundary, so a piece reads as a rounded chunk, not a flat panel | same | same |
| Resistance | `[[0,.44],[.12,.34],[.5,.30],[.85,.34],[1,.42]]` — soft, no skin spike | `[[0,.52],[.10,.46],[.5,.44],[.86,.48],[1,.58]]` — dense throughout | `[[0,.40],[.10,.28],[.5,.24],[.86,.30],[1,.40]]` — softest of the three |
| Paint | `PAINT.chicken` `:8061` — flesh ground, form shading along the rails, muscle fibres shoulder-to-tip, 5 sparse pale connective slicks, 2 soft highlights, darker perimeter band, faint outline | `PAINT.steak` `:8179` — marbling web + fat cap along the lower rail; broad, low, along-the-grain sheen (wet, not lacquered) | `PAINT.salmon` `:8318` — myocommata stripes that crowd/steepen toward the tail, vary width/brightness, are ridged (shadowed + lit crest) not printed; 3-tone flesh; 3 soft gloss slicks, never one unbroken highlight |
| Palette | lit/mid/low `#E09580/#C97B68/#9E5344`, rim `rgba(150,74,62,.30)` | `#B23840/#93262F/#6B171E`, rim `rgba(92,22,28,.34)` | `#F4835F/#DE6B49/#B04A31`, rim `rgba(150,62,42,.30)` |
| Determinism | All variation hashed off the loop index — **no `Math.random`** anywhere in `PAINT.chicken/steak/salmon`, confirmed by reading the functions | same | same |
| Supported techniques | Slice, Dice, Julienne (widened `minGap:11`, tightened tolerances `evennessTol:1.9/consistencyCvTol:1.5`), Halve | Slice, Dice | Slice, Dice |
| Peel | **None.** No `SKIN` entry ⇒ `skinAlpha(id)` returns 0 ⇒ nothing to peel. **Do not add a peel step** | none | none |
| Plating | `shingle` (Slice), `mound` (Dice), `nest` (Julienne, chicken only), `fan` (Halve, chicken only) — standard plating paths, no new plating type | `shingle`/`mound` | `shingle`/`mound` |
| Resize | Standard — sprite repainted from `art`-frozen authored geometry, re-blitted, never stretched | same | same |
| Recipes (Design) | Slice x6, Dice 3x3, Julienne x8, Halve (4 recipes) | Slice x6, Dice 3x3 (2 recipes) | Slice x6, Dice 3x3 (2 recipes) |

**What production needs to add**: the `fillet` shape family itself (net-new — `CutGeometry.ts`'s `Silhouette` interface is confirmed shape-agnostic, so this is additive, not a rewrite), the three paint functions and their shared helpers (`PAINT._railAt`, `PAINT._region`, `PAINT._taperStroke`, `PAINT._branch`, all from `:8130`), and the 2.5D depth system (`drawDepthWall`, `spreadPieces`, `shadeCutEdges`) which no current production ingredient uses. This is genuine new engineering, not a data-only port — should be scoped as its own implementation phase.

---

## 5. Technique reconciliation

Production's `TECHNIQUES` record (read directly) implements **11** ids: `slice, dice, julienne, chiffonade, chop, halve, peel, smash, rings, radial, rockMince`.

The frozen source implements **8**: Slice, Dice, Julienne, Chiffonade, Chop, Halve, **Prep**, **Free** — confirmed, and confirmed that `garden-prep`/`free-cut`/`sandbox` have zero matches anywhere in `src` (grepped the whole tree).

| Technique | Design | Production | Reconciliation |
|---|:--:|:--:|---|
| Slice | ✓ | ✓ | Common |
| Dice | ✓ | ✓ | Common — Design: `counts:{h,v}` + `perpSnap:true`, 3x3 → 16 pieces |
| Julienne | ✓ | ✓ | Common — `parallelSnap:true` + per-recipe `minGap` |
| Chiffonade | ✓ | ✓ | Common — leaf foods only in Design (basil, parsley, lettuce, cabbage, spinach) |
| Chop | ✓ | ✓ | Common |
| Halve | ✓ | ✓ | Common — Design: `count:2, freeAngle:true, plate:'fan'`, 12 ingredients |
| **Prep** | ✓ (multi-stage: cucumber x4 → tomato → carrot, one recipe, L70) | ✗ | Design-only — a **level/recipe structure**, not a technique. No production equivalent. Needs a scoping decision (§21), independent of the roster/peel decisions |
| **Free** | ✓ (no objective, no grade, L71) | ✗ | Design-only — a **sandbox mode**, not a technique. Same as above |
| Peel | Not a technique — a **gate** on 3 ingredients only, no menu presence, no phase of its own | ✓ — first-class selectable technique with its own UI tab (`interactionMode: "peel"`) | Structural mismatch, distinct from the roster conflict in §6: production lets the player *choose* to peel; Design makes it an automatic pre-cut gate. Recommend leaving production's UI model in place for onion/potato/garlic (already reads fine) — this is an interaction-model difference, not a visual one, and out of scope for a visuals-focused port |
| Smash | Not implemented in Design | ✓ (garlic) | Production-only functionality, no conflict — preserve as-is |
| Rings | Not implemented in Design | ✓ (onion) | Production-only, no conflict — preserve |
| Radial | Not implemented in Design | ✓ | Production-only, no conflict — preserve |
| Rock Mince | Not implemented in Design | ✓ (garlic) | Production-only, no conflict — preserve |

**Do not scaffold Peel/Smash/Rings/Radial/Rock Mince "from the recipe list."** Four of the five already have real, working production implementations Design has no opinion on; only Peel's *ingredient roster* needs correcting (§6).

### Technique × ingredient (production's full matrix, condensed)

Production's technique-per-ingredient assignments were not altered by this audit. The only cells this audit recommends changing are the **8 Peel cells** flagged in §6 (removing `"peel"` from `cucumber`, `beetroot`, `sweetpotato`, `fennel`, `peapod`, `mango`, `kiwi`, `pomegranate`'s `techniques` arrays). Every other technique assignment in production (all 49 ingredients × up to 6 techniques each) is either already Design-aligned (the 39 common ingredients' non-peel techniques) or production-only functionality Design has no opinion on (Smash/Rings/Radial/Rock Mince on onion/garlic, and the 10 production-only ingredients' full technique lists).

---

## 6. Peel reconciliation — critical

### A. Current production Peel architecture

`PreparationScene.ts` implements a **normalized-grid, stroke-based** system: `PEEL` constants in `definitions.ts` (`COMPLETION_THRESHOLD: 0.8, STROKE_WIDTH_FRAC: 0.34, GRID_COLS: 22, GRID_ROWS: 16`), `paintPeelableLayer()`, `markPeelSegmentCovered()`, a per-cell coverage grid (`peelGrid`/`peelCoveredCells`), `destination-out` compositing against a scratch flesh canvas, and normalized-coordinate stroke history that replays correctly on resize.

### B. Claude Design Peel architecture (re-verified directly in `knifecraft.html`, this delivery)

```
SKIN_KEEP  = { beetroot, sweetpotato, mango, kiwi, pomegranate, fennel, peapod, turnip }   // :5641
SKIN_WHOLE = { turnip }                                                                     // :5645
peelable   = id => !!SKIN[id] && !SKIN_KEEP[id]                                              // :5649 — DERIVED, not a list
⇒ resolves to exactly THREE: pineapple, watermelon, coconut
PEEL_NEED_PX = 2200 (authored px, × ingredient's own T.k)     PEEL_SHED_MS = 520     PEEL_THIN_MAX = 0.45
```

A rub stroke accrues hand-travel distance (movement inside the silhouette only); at the threshold the shell fades via one function, `skinAlpha(id)`, read by every draw call through `drawIngredient`. **Confirmed by grep: no normalized grid, no stroke stamping, no `destination-out`, no scratch canvas, no cell-counting exists anywhere in this file.** Do not invent those during integration, per the brief's own instruction.

### C. Ingredients currently peelable in production

- **Mandatory peel-first gate (6)**: `onion, potato, garlic, pineapple, watermelon, coconut`.
- **Optional/decoupled Peel technique (8, added in an earlier session)**: `cucumber, beetroot, sweetpotato, fennel, peapod, mango, kiwi, pomegranate`.

### D. Ingredients that should be peelable after integration

Exactly **`pineapple, watermelon, coconut`** — matching the frozen source precisely, unless the product owner explicitly wants to keep a Lab-only extra feature that contradicts the source (§21).

### E. What production Peel infrastructure can be retained

**All of it, for the 6 ingredients that should keep it.** `onion`/`potato`/`garlic` are production-only — Design has no opinion, and the grid system is load-bearing across dozens of shipped levels for them. `pineapple`/`watermelon`/`coconut` should keep the mandatory-gate *behavior* (Design agrees these lock the knife until peeled); the grid *mechanism* underneath is a legitimate, working implementation of that gate and does not need to be torn out — replacing it with Design's hand-travel-budget model is an optional visual-parity improvement, not a correctness requirement, since the gating behavior already agrees and these three are Lab-only today (§C below).

### F. What Claude Design skin rendering must be ported

- `skinAlpha(id)`'s exact branch order (SKIN_KEEP permanent 1 → test hook → active peel thinning/shedding → cuts-length fallback) as the **single** opacity source, if/when the mechanism is re-architected for pineapple/watermelon/coconut.
- The rim-annulus cut-reveal treatment already correctly implemented in production for `SKIN_KEEP` ingredients (confirmed: Kiwi's 0-cut brown shell and cut-reveals-green-flesh-inside-a-rim behavior already matches the source's explicit "do not regress" language, verified this session for Kiwi and Mango specifically).
- `SKIN_WHOLE` for turnip — skin never sheds, no flesh sprite exists, a cut opens onto more skin. Needs a targeted verification pass (not yet done) to confirm production's turnip doesn't show flesh on cut.

### G. What must be removed/disabled from production (pending decision, §21 — not done in this audit)

- The `"peel"` entry in `techniques: [...]` and the `peelDecoupled: true` flag on exactly these 8 ingredients: `cucumber, beetroot, sweetpotato, fennel, peapod, mango, kiwi, pomegranate`.
- **Nothing else.** The shared `paintPeelableLayer`/grid machinery stays (needed by onion/potato/garlic/pineapple/watermelon/coconut); every texture file's existing `hasCut`-gated paint logic stays (it's already correct); no `CutGeometry.ts` change; no `PreparationScene.ts` structural change beyond removing those 8 roster entries.

### H. Would existing production Peel behavior conflict with the final Design source?

**Yes, specifically and only** for the 8 ingredients in §G. Design is explicit and names two of them directly: *"Kiwi and mango do NOT auto-peel... If production has been told otherwise, that belief will fight `skinAlpha`."* An earlier production phase was told the opposite (that these 8 needed real progressive peeling) by a now-superseded brief.

**Recipe-safety check (done, not assumed):** grepped every `technique: "peel"` reference in `levelDefinitions.ts` (100+ matches). **Every one is `onion`, `potato`, or `garlic`.** Zero shipped level steps reference peel on any of the 8 conflicting ingredients, nor on pineapple/watermelon/coconut (all three are themselves Lab-only — 0 recipe references). **Reconciling this cannot break a single existing recipe.**

**Not implemented in this audit, per instructions.** Recommendation stands as: final peelable set = `pineapple, watermelon, coconut`; remove the Peel technique from the other 8; keep every other piece of the current peel architecture untouched.

---

## 7. Skin / flesh / overhang reconciliation

| System | Design | Interaction |
|---|---|---|
| `PAINT[id]` | Base sprite — the interior/peeled picture | Clipped per piece; the only layer the cut model ever touches |
| `SKIN[id]` | Full-body shell painted over the base | Fades as a whole via `skinAlpha`, never per-piece |
| `SKIN_KEEP` | 8 ids — permanent skin, `skinAlpha` returns 1 forever | No peel step exists for these; a cut still opens a flesh face inside a skin rim (the rim-annulus treatment) |
| `SKIN_WHOLE` | `turnip` only | Skin never sheds even after cutting; rim-annulus is *skipped* — no flesh sprite exists, a cut opens onto more outside |
| `PEEL_TONE` | Shred-particle colors for the 3 truly peelable ids (`pineapple #8A6A2A, watermelon #2C6531, coconut #8A5A2A`; fallback `#8A6A2A`) | Cosmetic only |
| `peelable` | Derived (`SKIN` minus `SKIN_KEEP`), never a hand-maintained list | Production should likewise avoid introducing a standalone `PEELABLE` constant if the mechanism is ever re-architected — it will desync from the ingredient definitions the way a duplicated list always does |
| `skinAlpha(id)` | The **single** opacity source, read by every draw call through `drawIngredient` | Production's equivalent today is `this.peeled`/`hasCut` read at paint time per ingredient — functionally parallel, architecturally distributed rather than centralized. Not a defect; flag as a style difference only |
| Overhang | Paint *outside* the silhouette (stems/crowns/roots), built as sprite-box-minus-silhouette (even-odd), so **zero body pixels** ever paint through it | Cosmetic only — no cut, span, piece, or score ever sees it; sheds on first cut |

**Critical separation, confirmed intact on both sides**: the cut model (`cuts[]`, spans, `containsPoint`, scoring) never reads skin or overhang state in either project. This session's own work on `CutGeometry.ts`/`PreparationScene.ts` never introduced such a read (confirmed: `Silhouette` interface has no skin/overhang-aware fields). **No production system needs to change to preserve this separation — it already holds.** The only change needed is the peel-roster correction in §6, which is a data change (`techniques` arrays), not a cut-model change.

**Special note — mango's overhang lives in `SKIN.mango`, not `PAINT.mango`**, so the stem/leaf show *while the permanent shell is on*. Any `SKIN_KEEP` ingredient with an overhang must follow this pattern if/when overhang art is ported.

---

## 8. Geometry / scaling reconciliation

| Constant/system | Design (re-verified, this file) | Production | Status |
|---|---|---|---|
| `PX_PER_CM` | `22.5` (`:3526`) | Not implemented as a live formula | Production **pre-bakes** each ingredient's ratio as a static `RX_FRAC = authoredPx/540` constant (e.g. `LEMON_GEOMETRY.RX_FRAC = 97.82/540`), with comments explicitly citing this exact formula as the derivation. **Output matches; the formula itself is not live**, so a future global rebalance can't "move all 42 together" the way Design's own comment describes — it would require recomputing every fraction by hand. Flag as INFO, not a defect |
| `SIZE_REF_CM` | `10` | Baked into the same ratios | Same as above |
| `SIZE_GAMMA` | `0.5` | Baked into the same ratios | Same as above |
| `REAL_CM` | 42 entries, all present, all verified in this pass (recounted directly: 42) | Not a literal `REAL_CM` table — the cm inputs were consumed once to produce the baked fractions | No functional gap for existing ingredients; needed live if the scale formula is ever made dynamic |
| `SCALE_LEN` | `['rx','ry','rBig','rSmall','capR','depthX','depthY','spine','spineRx','skinRim']` | Production's per-shape scale handling covers the same fields for shapes it has (confirmed this session for `spine`/`spineRx` specifically, while fixing Pea Pod's `peelHalfExtents()`) | `depthX`/`depthY` don't exist yet in production (needed for the fillet protein depth wall, §4) |
| `SILS` | 7 families: ellipse, capsule, taper, cluster, wedge, block, fillet | Production has ellipse, capsule, taper, block, plus an inert `organic` shape (dead code per this repo's own comments); no `cluster`, no `fillet` | **Real gap** — `cluster` (11 ingredients currently approximated) and `fillet` (3 new proteins) both need adding. `wedge` is declared in Design but used by **zero** current ingredients — do not port speculatively |
| `inside()`/spans/`support()` | Read from the same `Silhouette`-shaped source of truth per family | Production's `CutGeometry.ts` `Silhouette` interface (`cx,cy,rx,ry,inside(),spanX(),support()`) is confirmed shape-agnostic — verified this session, since the peel-extension work never needed to touch it for 3 different shape families | Adding `cluster`/`fillet` is additive; no `CutGeometry.ts` rewrite needed |
| `art` snapshot | `ing.art = geomSnapshot(g)` freezes authored proportions before scaling, forever | Production's sprite cache is keyed by ingredient+state and repainted from authored geometry on resize (confirmed working during this session's resize testing of the peel-extension work) | Aligned |
| Resize | Sprites repainted from `art`, re-blitted, never stretched; Design's own Phase 17 added zero-size canvas guards | Not independently re-verified this session for the zero-size-canvas edge case specifically | **Needs a targeted check** before shipping `fillet`/`cluster`, since new shape families are exactly where a 0-width canvas would first surface a bug |
| Clipping / insets | `innerGeom(g,d)` — a single cached inset-copy helper reused for every concentric interior (lemon, watermelon, coconut+cavity, cucumber, mozzarella, pineapple) | Each production texture file builds its own inset path locally (e.g. Peach's `fleshRx = rx - 20`) | Works correctly today; a shared cached-inset helper is a worthwhile consistency improvement for a real ingredient-by-ingredient port, not a functional requirement |

**Determination**: production's `CutGeometry`/`PreparationScene` architecture can consume the Design geometry without introducing independent X/Y distortion **as long as**: (1) new shape families (`cluster`, `fillet`) are added through the same `Silhouette` interface every existing shape already uses, never a parallel system; (2) each new ingredient's fraction constants are derived from the *same* `REAL_CM`/`PX_PER_CM`/`SIZE_REF_CM`/`SIZE_GAMMA` formula already used for the other 39 (whether baked or made live); (3) `SCALE_LEN` gains `depthX`/`depthY` for the proteins. None of this requires touching existing ingredients' geometry.

---

## 9. Special ingredient audit

| Ingredient | Design specifics (re-verified) | Production status | Notes |
|---|---|---|---|
| **Kiwi** | `shape:'ellipse', rx:118, ry:94` (wider than tall), `SKIN_KEEP` — permanent brown fuzzy shell at 0 cuts, cut opens green flesh inside a brown rim. Explicit "do not regress" language in the source docs | **Already matches** — confirmed this session: whole Kiwi is 100% brown shell, a cut reveals green flesh inside the rim, exactly per spec | Only the added Peel *technique* (§6) conflicts; the paint/texture logic needs no change |
| **Pineapple** | Peelable (rub-to-peel); spiky crown overhang; concentric rind/flesh via `innerGeom`; `PEEL_TONE #8A6A2A` | Peelable via grid mechanism; mechanism differs, gate behavior agrees | Lab-only (0 recipes); low integration risk |
| **Broccoli** | `cluster`; florets are the silhouette; 3x3 dice → 16 pieces, audited correct in Design's own Phase 17 | Shape-family gap (`cluster` not yet in production) | See §8 |
| **Cauliflower** | `cluster`; curd lobes | Shape-family gap | See §8 |
| **Artichoke** | `cluster`; bract lobes + stubby cut-stem overhang | Shape-family gap | See §8 |
| **Pumpkin** | Per-frame stem via `paintPumpkinStem`, drawn on a separate `over` pass, **unclipped**, so the whole stem is one object on one fade clock — deliberately NOT baked into the cached sprite (a baked stem would survive a cut as a stub riding whichever piece covered it) | Not independently re-verified this session whether production's pumpkin stem is baked or separate | Needs a targeted check before porting pumpkin's overhang |
| **Pea Pod** | Permanent skin (`SKIN_KEEP`); `spine`/`spineRx` in `SCALE_LEN` so the spine bow scales with the body; stem + curled tendril overhang | `SKIN_KEEP` conflict (§6); the spine-aware geometry fix from an earlier session (`peelHalfExtents()` generalized to use `ingRy`, spine-aware) is already correct and becomes moot for the peel system specifically if Peel is removed, but remains correct/needed for the ingredient's general silhouette either way | — |
| **Lemon** | Concentric rind→pith→flesh via `innerGeom` | Production's `lemonTexture.ts` has the *same* unconditional-flesh defect Peach had before an earlier fix this session — confirmed via grep (`fleshRx = rx - 17`, no `hasCut` gate) | Flagged, not fixed — out of this audit's read-only scope |
| **Orange** | Not in the 42 — production-only | No Design counterpart | Preserve exactly |
| **Basil** | `cluster`; silhouette IS the leaves; `fitCluster()` derives `rx/ry`, never hand-written; Chiffonade + Chop | Shape-family gap | See §8 |
| **Parsley** | Same `cluster` pattern as basil | Shape-family gap | See §8 |
| **Avocado** | Pit occlusion is paint, not geometry (a real hole can't be represented by the partition model); `taperCurve` fixed a linear-sweep defect in Design's own Phase 17C | Not independently re-verified this session | Verify on port |
| **Grapes** | `cluster`; `fitCluster()` specifically prevents berry clipping | Shape-family gap | See §8 |
| **Cabbage** | `cluster`; Chiffonade | Production currently on `shape:"ellipse"` (confirmed in the ellipse-dispatch code path this session) — **mismatch**, not just a gap | See §8 |
| **Watermelon** | Peelable; rind→pith→flesh insets; `PEEL_TONE #2C6531`; largest food in the roster (32x22cm, drawn at 0.56x life under `SIZE_GAMMA`) | Peelable via grid mechanism, gate agrees, mechanism differs | Lab-only (0 recipes) |
| **Cheddar** | `block`; a real 3-face box, corners from `SILS.block.pts(g)` | Not independently re-verified whether production's block renderer derives corners the same way or approximates | Verify on port |
| **Butter** | `block`, same corner mechanism as cheddar | Same verification needed | — |
| **Tofu** | `block`, same corner mechanism | Same verification needed | — |

No evidence found, in any of the above, of production having silently "fixed" or diverged from an intentional Design behavior — the gaps identified are shape-family absence (`cluster`) or not-yet-verified paint fidelity, not contradicted intent.

---

## 10. Story reconciliation — THE LAST WISH

Production has **zero** narrative system (confirmed by exhaustive grep for every story symbol, copy string, and storage key — no matches anywhere in `src`). Every item below is re-verified directly against `knifecraft.html` in this delivery.

**Opening (4 beats, `:10944`)** — inheritance, grandparent (gender-neutral throughout — "They would have loved seeing this," never a gendered term), the keys, the last wish ("Don't let this place disappear"), reluctant heir, ends on **OPEN THE RESTAURANT**.

**Fresh Start (4 beats, `:10957`)** — cleaning, small repairs, the savings beat: coin particles fly *into* three purchase cards (Basic Cutting Board, Basic Kitchen Knife, Fresh Ingredients — the ingredient card paints real tomato/cucumber/carrot through the actual `PAINT` functions, `paintIng(cv)` `:11011`, never invented art).

**Chef (5 beats, `:10969`)** — "I'll handle the cooking. You handle the prep." Explicit, permanent role contract: the player is owner/prep cook, never the chef. Ends by calling `SceneFlow.prep(); startRecipe(0)`.

**Milestones (4, `const MILES` at `:10997`, re-read verbatim this delivery):**

| bit | level | kicker | line |
|--:|--:|---|---|
| 1 | 8 | THE ROOM COMES BACK | "It's starting to feel like a real restaurant again." |
| 2 | 20 | WORD GETS AROUND | "People are coming back." |
| 4 | 45 | SOMETHING WORTH KEEPING | "I never thought I'd care this much about this place." |
| 8 | 70 | THE LAST WISH | "They would have loved seeing this." |

**Finale (4 beats, gated `n >= 100 && story.fin !== true`, confirmed verbatim at `:11200`):** ends with, confirmed verbatim at `:10985`/`:10987`: **"You built this."** and **"They would be proud."** Grepped the entire file for "We did it." — **zero matches, confirmed absent.**

Each beat carries (confirmed structure): `tint`, `bare`, `veil`, `cam`, `hold` (ms), `art`, `fx`, `lines`, `quote`, `btn`, `kicker`, `step`, `cards`, `dlg`, `onEnter` — a declarative beat-array shape, not procedural sequencing logic.

---

## 11. Story architecture mapping

| Design symbol | Line | Role | Production destination (recommended) |
|---|--:|---|---|
| `const KEY` | 10774 | Storage keys: `story.introDone`, `story.ms`, `story.fin` | New save-data fields (3 flags) — additive to `SaveManager.ts`, not a schema replacement |
| `const ART` | 10778 | 7 inline SVG assets | New React components or inline SVG strings ported verbatim (path data unchanged) |
| `const OPENING` / `FRESH` / `CHEF` / `FINALE` | 10944 / 10957 / 10969 / 10977 | Declarative beat arrays | Ported as TS data — a new `storyDefinitions.ts`-style module, mirroring how `levelDefinitions.ts` already holds declarative data |
| `const MILES` | 10997 | 4-entry milestone table | Same module, new data |
| `paintIng(cv)` | 11011 | Renders the savings-beat ingredient cards via the real ingredient paint functions | Reuse production's existing `redrawIngredientTexture`-style paint entry points — do not build a second paint path |
| `dlgHTML(d)` | 11030 | Dialogue markup | New dialogue component, styled to match production's existing UI language, not a DOM-string port |
| `banner(kicker,line,ms)` | 11139 | Milestone banner | New banner component |
| `newGame()` | 11148 | Runs OPENING+FRESH+CHEF, sets `introDone` | Called once, first load only — mirrors `boot()`'s own logic |
| `const CH` | 11157 | Dev/QA chapter list, derived from the beat arrays + `MILES` | A QA-only affordance (could live behind the same `QA_MODE` flag Ingredient Lab already uses) |
| `boot()` | 11186 | `introDone === true` ⇒ `'returning'` (skip story); else run `newGame()` | New app-boot check, additive to existing app init |
| `flush()` | 11197 | Finale-first, then first-unfired-milestone-only, forward-only, one banner per call | New function; **`Story.level() === Save.played()`** (confirmed `:1914` in Design) — production must map its own plate/level counter onto this exact read, or milestones fire at the wrong time |
| `report()` | 11212 | `{live, beat, beats, level, introDone, milestones, finaleSeen, bare, locked}` | Optional debug surface, not required for player-facing behavior |

**`story.ms` is confirmed a 4-bit mask, full value 15** (`Store.set('story.ms', 15)` found verbatim at `:9501`, the regression harness's own mute value — stays correct only while there are exactly 4 milestones). Duplicate prevention is the mask itself, not a timestamp — a fired bit can never fire again; verified in the doc as tested by simulating plates 1→101 with a second `flush()` call at every level, all second calls returning null. Forward-only: conditions are `n >= m.at`, so the mask only ever gains bits; `newGame()` resets it to 0. Finale takes precedence over any unfired milestone and fires exactly once.

---

## 12. Level-20 collision — proposed solution (not implemented)

**The conflict**: production already has an unrelated cafe-tier reputation/milestone system (`CAFE_MILESTONES` in `src/game/cafe/`, surfaced in `Kitchen.tsx`'s header and `Journal.tsx`'s Progression screen) plus its own campaign-level milestone tagging at **levels 10/20/30/40/50** (`level.milestone`). Design's story milestones fire at **8/20/45/70**, finale at **100**. Level 20 is the only exact numeric collision; 8/45/70/100 are pure additions with no existing production event at those levels.

**Constraints, restated**: do not move the story milestone (pacing is frozen per the source), do not change the cafe milestone's existing level, no overlapping UI, no duplicate overlays, no input conflicts, no skipped story, no skipped cafe milestone, no incorrect progression, no save corruption.

**Proposed approach**:
1. Treat the two systems as **independent, sequential events on the same plate-completion tick**, not a merged one. When a plate completes at level 20, both `CafeProgressionManager`'s existing milestone check and the new `Story.flush()` check run — this already happens naturally if each is called from the same "plate completed" event without one blocking the other's *evaluation*.
2. **Sequence the *display*, not the logic**: if both a cafe milestone and a story milestone are pending on the same plate, show the cafe-tier banner first (it's the shorter-existing, more frequent surface — 5 tiers vs 4 story beats total in the whole game), then chain into the story milestone banner immediately after it dismisses, rather than stacking them or racing them. This requires a small sequencing queue at the UI layer only — neither manager needs to know about the other's existence or state.
3. **Do not let either system consume or gate the other's trigger condition.** `Story.flush()` must read `Save.played()` (or production's equivalent plate counter) directly, exactly as Design does, not a value already mutated by the cafe-milestone check.
4. **Save format**: the 3 new story flags (`introDone`, `ms`, `fin`) are additive fields alongside the existing cafe-progression save data — no existing save field changes shape, so no migration/corruption risk for existing saves (a returning player's save simply lacks the 3 new keys until their next `boot()`, which is the same "undefined defaults to falsy/0" pattern `SaveManager.ts` already uses elsewhere for added fields).
5. **QA**: add a regression case that completes a plate landing exactly on level 20 and asserts both banners appear, in the defined order, with no dropped event and no double-fire on a subsequent replay of level 20 (duplicate prevention is per-system: the cafe milestone's own "already reached" check, and the story's own bitmask).

This is a UI-sequencing solution, not a data-model merge — it keeps both systems' internal logic completely untouched and isolates the fix to wherever plate-completion events are currently dispatched to listeners.

---

## 13. Character art mapping

Both re-verified directly in `knifecraft.html`, this delivery — not assumed from the docs.

**Grandparent — `ART.bedside` (`:10779`, viewBox 360x232):** warm wall gradient, window with muntins, dresser, nightstand, lamp with radial glow, bed with pillow/quilt, and the figure. The arm is **one pose authored in its own local frame** — `<g transform="translate(242,155) rotate(16)">`, confirmed verbatim at line 10818 in this delivery — so the whole arm (sleeve → cuff → forearm → palm → thumb → three-lobe fingers) shares one centreline and cannot drift apart. The key is drawn *before* the hand in document order (confirmed present) so its shank passes under the fingers — reads as held/being-handed-over, not an icon resting on the blanket; this render order is load-bearing. Expression: two 32%-alpha cheek shapes + a softened mouth curve — elderly, frail, peaceful, warm; explicitly not ill or melodramatic.

**Chef — `ART.chef` (`:10858`, viewBox 120x120):** a bust with shoulders, not a floating head — toque → head (rotated −3° for a slight tilt) → neck → shoulders → jacket → partial arms, composed so the circular portrait frame crops the sleeves, not the shoulders. Asymmetric expression (one brow raised, the other lower; slightly different eye sizes) reads as surprise + disbelief + a little amusement for the line "You really spent your savings on this place?" — never anger.

**Dialogue integration**: `.sDlgArt{width:clamp(64px,14vmin,100px)...}` confirmed verbatim at line 198 in this delivery — the one CSS change the "polish pass" made (raised from a smaller clamp to give the chef bust room); everything else about the dialogue box, typography, and timing is untouched.

**Conclusion, re-confirmed**: this is the **final polished version**, not a stale one — every specific, checkable implementation detail the docs claim (the exact clamp value, the exact SVG transform, the key-before-hand ordering) is present verbatim in the actual file text, in this exact delivered copy of the package.

**Production integration recommendation**: port the 7 SVG assets (`bedside, keys, chef, you, dining, board, knife`) as either raw inline SVG strings behind a thin React wrapper, or componentized with identical path data — no rasterization, no bitmap conversion, consistent with Design's own "0 bitmap assets" constraint (§14).

---

## 14. Production-only systems — confirmed present, must survive integration unchanged

All confirmed present by direct file check in this pass:

| System | File(s) | Role | Integration stance |
|---|---|---|---|
| `LevelManager` | `src/game/levels/LevelManager.ts` | Level sequencing, unlock state | Untouched — Design's `Save.played()`-driven story counter must map onto whatever this already exposes, not replace it |
| `SaveManager` | `src/game/SaveManager.ts` | Save format/persistence | Untouched except **additive** story flags (§11) |
| Recipes | `src/game/levels/levelDefinitions.ts` | 100 levels defined today | Untouched by this audit; new protein recipes (§4) and any `Prep`/`Free` structures (§5) are additions, not edits to existing entries |
| Progression / cafe economy | `src/game/cafe/CafeProgressionManager.ts`, `cafeDefinitions.ts` | Reputation tiers, cafe milestones | Untouched — sequenced alongside the story layer per §12, never merged into it |
| Shop | `src/components/kc/Shop.tsx` | Knife/board purchases | Untouched |
| Rack | `src/components/kc/Rack.tsx` | Equipment selection | Untouched |
| Kitchen | `src/components/kc/Kitchen.tsx` | Main hub, QA-mode badge, order card | Untouched; the story's opening/finale beats are additive screens, not a Kitchen rewrite |
| Journal | `src/components/kc/Journal.tsx` | Progression screen, cafe milestones list, Ingredient Lab entry point | Untouched |
| Recipe Book | `src/components/kc/Recipes.tsx` | Recipe browsing | Untouched |
| Ingredient Lab | `src/components/kc/IngredientLab.tsx` | QA-only ingredient/technique tester, behind `QA_MODE` | Untouched; new proteins and any peel-roster correction (§6) surface here automatically once the underlying `INGREDIENTS`/`TECHNIQUES` data changes — no Lab-specific code change needed |
| Cutting engine | `src/game/CutGeometry.ts` | `Silhouette` interface, cut partitioning | Untouched — confirmed shape-agnostic; `cluster`/`fillet` are additive |
| 10 production-only ingredients | `definitions.ts` | apple, bread, garlic, mushroom, onion, orange, pepper, potato, strawberry, zucchini | Preserve exactly (§2) |
| Extra techniques | `definitions.ts` `TECHNIQUES` | Peel (UI model), Smash, Rings, Radial, Rock Mince | Preserve exactly (§5) |

**None of these should be replaced with Design's standalone HTML architecture.** Design is a reference for visuals/behavior data, not a competing runtime — production's React/Phaser/Vite scene and state management stay authoritative throughout.

---

## 15. Asset mapping

Design: **0 bitmap assets, 0 external files** — every ingredient is painted procedurally into an offscreen canvas (`PAINT[id]`/`SKIN[id]`), and all 7 story-art pieces are inline SVG strings.

Production already follows the identical convention for every existing ingredient (confirmed throughout this and prior sessions — every `textures/*.ts` file is a `(ctx, geom) => void` canvas painter, no bitmap ingredient art anywhere in the pipeline). **This is already aligned; no asset-pipeline change is needed for the ingredient side.**

For the story layer specifically: the 7 SVG assets should be ported as inline SVG strings or componentized SVG with identical path data (§13) — **not** rasterized to PNG/WebP and **not** recreated from the screenshots/uploads the original brief referenced (the package's own header is explicit that nothing in `screenshots/`/`uploads/` is source). No bitmap recreation, no screenshot-derived production assets, consistent with the instruction.

---

## 16. Intentional differences — confirmed SOURCE-INTENTIONAL, not defects

| Ingredient | Design orientation | Production check | Status |
|---|---|---|---|
| Corn | Lying along the board, green stalk-stub overhang past the butt | Production's Corn is also horizontal/lying — no silent re-orientation found | **Preserve** |
| Radish | Root-down, leaf-top overhang past the crown, `rBig`/`rSmall` geometry (not a plain ellipse) | Production's `RADISH_GEOMETRY` also uses a non-ellipse taper-style construction | **Preserve** |
| Mozzarella | Radial-gradient ball; the cut face is deliberately **duller** than the skin — a shinier cut face reads as a lit sphere with a line drawn on it, which is wrong | Not independently pixel-verified this session (out of the peach-fix's prior scope) | **Preserve orientation/intent; verify the specific "duller cut face" claim on port** |
| Pear | Standing on its base, stem-up overhang | Production's Pear is a `taper` shape; standing orientation not independently re-verified this session | **Preserve; verify orientation on port** |

No evidence of any attempt, in this repository's history or current state, to silently "fix" or reorient any of these four toward older production art.

---

## 17. Files/functions to modify later (not now)

In the dependency order Design's own integration doc recommends, which this audit endorses:

1. **Data**: `CONFIG.INGREDIENTS`, `REAL_CM`, `RECIPES` → ported as TS objects, values copied verbatim (not retyped), into `definitions.ts` and `levelDefinitions.ts` as additions.
2. **Scale**: the `REAL_CM`/`PX_PER_CM`/`SIZE_REF_CM`/`SIZE_GAMMA` formula, ideally made live (§8) rather than more pre-baked fractions.
3. **Shape families**: `SILS.cluster` + `fitCluster()`, `SILS.fillet` — new additions to `ingredientShapes.ts`, following the existing convention (a factory + a `traceXPath` helper, per the file's own established pattern).
4. **Painters**: the 11 `cluster`-family ingredients' texture files, plus `PAINT.chicken/steak/salmon` and their shared rail/region/stroke/branch helpers.
5. **Protein mechanics**: `drawDepthWall`, `spreadPieces()`, `shadeCutEdges()` — new, protein-only systems in `PreparationScene.ts`/`CutGeometry.ts`.
6. **Peel roster correction**: remove `"peel"`/`peelDecoupled` from the 8 ingredients named in §6.G — a `definitions.ts` data change only, no new peel system code.
7. **Story**: new `storyDefinitions.ts`-style data module + a new renderer/component tree, `SaveManager.ts` gains 3 additive flags.
8. **Character SVGs**: 7 new asset components.
9. **Level-20 sequencing**: a small UI-layer queue where plate-completion events are dispatched (§12) — no change to either existing milestone system's internals.

## 18. Files/functions NOT to modify

- The 10 production-only ingredients' implementations (§2).
- `onion`/`potato`/`garlic`'s existing mandatory-peel-first gate and grid-peel implementation.
- The shared `paintPeelableLayer`/`markPeelSegmentCovered`/grid machinery — still needed post-correction for onion/potato/garlic (and optionally pineapple/watermelon/coconut, §6.E).
- `CutGeometry.ts`'s `Silhouette` interface and partition engine — additive only.
- Peach's `hasCut` fix and Kiwi's/Mango's existing skin/cut-reveal texture logic — already Design-aligned.
- `CAFE_MILESTONES` and the existing level-10/20/30/40/50 milestone tagging.
- Any of the 100 currently-shipped levels/recipes.
- `baguette` and `bread` — confirmed not duplicates (§2.1); do not merge.
- `LevelManager.ts`, `SaveManager.ts`'s existing fields, `Shop.tsx`, `Rack.tsx`, `Kitchen.tsx`, `Journal.tsx`, `Recipes.tsx`, `IngredientLab.tsx` — all confirmed present and out of scope for replacement (§14).

## 19. Proposed implementation order

The order requested matches this audit's own findings; no reordering needed:

1. Ingredient data (§17.1)
2. Scale constants / scale loop (§17.2)
3. Shape families — `cluster`, `fillet` (§17.3)
4. Silhouettes for the newly-added shapes
5. Painters — cluster ingredients + proteins (§17.4)
6. Skin system — no new system needed; only the peel-roster correction (§17.6) touches this
7. Sprite cache — no change; existing cache keying already supports new ids
8. Protein `fillet` system — depth wall, fan-out, edge shading (§17.5)
9. Peel reconciliation — the 8-ingredient roster correction (§17.6)
10. Cut model integration — verify `cluster`/`fillet` against `CutGeometry.ts`'s existing `Silhouette` contract (should require zero changes to the engine itself)
11. Story architecture (§17.7)
12. Story art (§17.8)
13. Character integration (part of §17.8)
14. Level-20 event sequencing (§17.9)
15. QA (§20)
16. Regression (existing production test/QA pass, plus new cases for proteins/peel-roster/story)
17. Production build

## 20. QA plan

- [ ] All 42 Claude Design ingredients present, ids matching §2 exactly; all 10 production-only ingredients still present; roster = 52 (pending §21 sign-off).
- [ ] `chicken`, `steak`, `salmon` present under those exact ids, `fillet` shape, with `depth` and `face` records.
- [ ] `REAL_CM`/scale constants unchanged (`22.5`/`10`/`0.5`); a 10cm food still renders at true size; watermelon ≈0.56x life, radish ≈1.29x.
- [ ] Exactly 3 peelable ingredients after the roster correction (`pineapple, watermelon, coconut`); the other 8 show permanent skin with no Peel tab.
- [ ] Kiwi at 0 cuts is entirely brown shell; a cut opens green flesh inside a brown rim (regression-check against the existing, already-correct implementation).
- [ ] Cut model never reads skin/overhang state (spot-check `CutGeometry.ts` after any shape-family addition).
- [ ] 3x3 dice yields 16 pieces on every dice ingredient, including any newly-clustered ones.
- [ ] Protein slices visibly part (`spreadPieces`) and show a depth wall in the correct flesh palette.
- [ ] No `Math.random` in any new painter; two loads render identical sprites.
- [ ] Zero-size canvas guards hold for the new shape families specifically (§8).
- [ ] Story: milestones fire at exactly 8/20/45/70, once each; finale at 100, once; `story.ms` reaches 15 and no further.
- [ ] Level-20 collision: both banners fire, in the defined order, no drop, no double-fire on replay (§12).
- [ ] Finale copy exact; "We did it." absent; grandparent gender-neutral.
- [ ] Every existing recipe (1–100) still completes/plates/rewards correctly — no regression from the peel-roster correction or new shape families.
- [ ] Zero bitmap assets introduced anywhere in the port.
- [ ] `npx tsc --noEmit`, `npx eslint src`, `npm run build`, `node scripts/playables-preflight.mjs` all clean.

## 21. Blocking decisions

### Decisions already safe to accept (no product input needed — purely factual/engineering)

- `baguette` and `bread` are not duplicates; keep both (§2.1).
- No ingredient ID was renamed; the 10 production-only ingredients are confirmed correct and complete.
- The cut model / skin / overhang separation already holds in production; no engine change is required to preserve it.
- `cluster` and `fillet` are genuinely missing shape families that must be added (not a judgment call — Design uses them, production doesn't have them).
- The protein specs in §4 are complete and source-verified — no design work remains, only implementation.
- `CAFE_MILESTONES` and the story milestone system are different features and must stay architecturally separate (§12) regardless of how the sequencing question is resolved.

### Decisions requiring product-owner approval

1. **Final roster: 52, or name 3 ingredients to cut for 49?** Recommendation: **52** — nothing in either source justifies a deletion, and all 10 production-only ingredients are recipe-connected.
2. **Peel-roster correction**: remove the Peel technique from `cucumber, beetroot, sweetpotato, fennel, peapod, mango, kiwi, pomegranate` to match the frozen source's `SKIN_KEEP`/no-shell reality. Zero recipe risk (verified), but it reverts a feature an earlier session explicitly built and shipped to the Lab. Recommendation: **make the correction** — the frozen source is now the authoritative reference and is explicit that this behavior is wrong for these ingredients.
3. **`pineapple`/`watermelon`/`coconut` peel mechanism**: keep production's grid-based gate (functionally equivalent) or re-architect toward Design's hand-travel-budget model for exact parity. Zero recipe risk either way. Recommendation: **keep the grid mechanism for now** (lower engineering cost, same player-facing gating behavior); revisit only if pixel/frame-exact parity with the source becomes a stated goal.
4. **Level-20 sequencing approach** (§12): recommendation is the two-banner sequential-display queue described there; alternatives (e.g., suppressing one banner) risk violating "no skipped story"/"no skipped cafe milestone." Recommendation: **adopt the sequential-queue approach.**
5. **`Prep` (multi-stage) and `Free` (sandbox) level types**: real structural gaps, not technique gaps. Recommendation: **defer** — neither is referenced by the roster/peel/story work above, and they're the least-specified part of the source relative to their implementation cost.
6. **Scope size**: `cluster`/`fillet` shape families, 11 ingredient re-paints, protein paint + 2.5D depth system, and the full story/character layer are substantial, independent bodies of new engineering. Recommendation: **sequence as separate phases** per §19, not one combined change.

---

## Final status

**BLOCKING: YES.** Decisions 1, 2, and 4 above gate real implementation choices (final roster size, whether to remove a shipped Lab feature, and how two UI systems share level 20) that change what gets built. Nothing in this audit is an engineering unknown — every open item is a product call this document cannot make on its own.

Do not begin implementation until §21's required decisions are resolved.

---

## Appendix — exact source trace: proteins + story

**Traced directly against `Knifecraft Phase 1 review (2)\KNIFECRAFT-FINAL\knifecraft.html` this pass, symbol by symbol, with real start/end line numbers read from the file (not the docs' approximate single-line anchors).** Line numbers are anchors at trace time only — production edits will shift them; the symbol names are the durable reference. **No implementation performed.**

### A. Proteins — full dependency chain, `SILS.fillet` → ingredient → paint → depth/face → recipes

| Claude Design symbol | Lines | What it is | Production destination | Port? |
|---|---|---|---|---|
| `SILS.fillet` (object) | 3362–3408 | The shape family itself: `sAt`, `xAt`, `rails`, `inside`, `spanX`, `spanY`, `support`, `trace` — two independent rails over normalized length `s` | `src/game/ingredientShapes.ts` — new `makeFilletSilhouette()` factory + `traceFilletPath()` helper, following the file's existing `makeEllipseSilhouette`/`makeTaperSilhouette` convention | **Port** — new shape family, required by all 3 proteins |
| `const FILLET` (default rail params) | 3416 | `{bias:0.60, full:0.62, bow:0.13, tilt:0.26, topFull:0.16, botFull:0.12, wob:0.045}` | Same file, alongside the factory | **Port** |
| `filletRails(P,s)` | 3417–3423 | The actual rail-height formula (per-`s` top/bottom offset) | Same file | **Port** |
| `filletP(g)` | 3424–3437 | Merges per-ingredient overrides over `FILLET` defaults, computes and caches the `fit` normalization factor (rails scaled to exactly ±ry) | Same file | **Port** |
| `chicken` (ingredient profile) | 1317–1344 | Full record: `name`, `geom` (`rx:188,ry:96`, band clears), `resistance`, `face` (px:4, inset:2.5, 3 color stops), `depth` (px:12, slab:4, spread:0.17, lit/mid/low/rim, `edge`), `audio`, `particles`, `seam` | `src/game/definitions.ts` — new `CHICKEN_GEOMETRY` const + `INGREDIENTS.chicken` entry | **Port verbatim** — copy values, don't retype |
| `steak` (ingredient profile) | 1353–1373 | Full record: `geom` (`rx:180,ry:138`, `bias/full/bow/tilt/topFull/botFull/wob`), `resistance`, `face`, `depth`, `audio`, `particles`, `seam` | `definitions.ts` — new `STEAK_GEOMETRY` + `INGREDIENTS.steak` | **Port verbatim** |
| `salmon` (ingredient profile) | 1380–1400 | Full record: `geom` (`rx:200,ry:100`, its own rail tuning), `resistance`, `face`, `depth`, `audio`, `particles`, `seam` | `definitions.ts` — new `SALMON_GEOMETRY` + `INGREDIENTS.salmon` | **Port verbatim** |
| `rebuildPieces(newCut)` | 4195–4223 | Generic piece-splitting on every new cut; calls `spreadPieces()` unconditionally at its end (4222) | Production's existing piece-rebuild path in `PreparationScene.ts`/`CutGeometry.ts` (already exists for all 49 ingredients) | **Do not port** — generic engine, only needs its existing call site to also invoke the new `spreadPieces` equivalent |
| `spreadPieces()` | 4230–4242 | Fans pieces along each cut set's own normal, proportional to distance from the set's middle — gated on `ING.depth.spread`, so a no-op for every non-protein food | New function in `PreparationScene.ts` (protein-only in practice — no current production ingredient defines a `depth` record) | **Port** — required by all 3 proteins |
| `clipHalfPlane(cn)` | 4991–~5005 | Generic per-cut half-plane clip | Production's existing per-piece clip logic in `CutGeometry.ts`/`PreparationScene.ts` | **Do not port** — already exists, used by all 49 current ingredients |
| `silPath(g, pad)` | 3570 (def'n) | Generic cached silhouette outline for clipping | Production's existing texture-canvas + piece-clip machinery | **Do not port** — already exists |
| `clipFaceBand(cn, w)` | 5012–5026 | Shared clip helper: builds the thin band along a cut's normal that `face`/`depth.edge` paint into | New function in `PreparationScene.ts` | **Port** — shared by `paintCutFaces`/`shadeCutEdges`, both required by all 3 proteins |
| `shadeCutEdges(p, gp, gnow)` | 5027–5040 | Per-piece rounded roll-off a few px inside every cut boundary, gated on `depth.edge` — protein-only in practice | New function in `PreparationScene.ts` | **Port** — required by all 3 proteins |
| `paintCutFaces(p, gp, gnow)` | 5041–5071 | The pale interior band a cut opens, gated on the ingredient's `face` record | New function in `PreparationScene.ts` | **Port** — required by all 3 proteins. **Note**: the frozen source's `baguette` (line 556–573) *also* now declares a `face` record and is commented as using this exact mechanism — production's current `paintBaguetteTexture` (`src/game/textures/baguetteTexture.ts`) explicitly does **not** implement a face-band and says so in its own header comment, which is now stale against this frozen source. **Out of scope for this pass** (baguette is one of the existing 39, explicitly excluded per this request) — flagging only so it isn't lost |
| `const DEPTH_DIR` | 5416 | `{x:0.16, y:1}` — the one world-space depth direction every protein's wall extrudes along | New const in `PreparationScene.ts` | **Port** |
| `drawDepthWall(p, gp, gnow)` | 5417–5435 | Extrudes `depth.px` (scaled by the piece's own `k`) along `DEPTH_DIR`, clips to the piece's own boundary, fills a lit/mid/low gradient, strokes the `rim` — gated on `depth`, protein-only in practice | New function in `PreparationScene.ts` | **Port** — required by all 3 proteins |
| `drawPieces(gnow)` — non-cluster branch | 5566–5573 | The exact per-piece call order: `drawDepthWall` → clip silhouette → `drawIngredient` (base+skin blit) → `shadeCutEdges` → `paintCutFaces` → seam stroke | Production's existing per-piece render loop in `PreparationScene.ts`'s piece-drawing code | **Adapt** — insert the 3 new calls (`drawDepthWall`/`shadeCutEdges`/`paintCutFaces`) at the equivalent point in production's existing loop, each already self-gating on the ingredient's `depth`/`face` presence so the other 49 ingredients render unchanged |
| `PAINT.chicken(c2,g)` | 8061–8129 | Full painter: base gradient, form shading (2 radial ramps on the rails), 16 fibre strokes, 5 connective slicks, 2 highlights, perimeter band, outline | New `src/game/textures/chickenTexture.ts` | **Port verbatim** — colors, gradient stops, hash formula unchanged |
| `PAINT._railAt(g,s,v)` | 8136 | Shared: rail-space → canvas-space point | New shared helper — e.g. `src/game/textures/proteinPaintHelpers.ts` | **Port** — required by all 3 proteins |
| `PAINT._region(g,s0,s1,vTop,vBot,N)` | 8139–8145 | Shared: builds a closed region between two rail-space v-functions over an s-range | Same new helper file | **Port** — required by chicken (implicitly via `_railAt`) and directly by steak/salmon |
| `PAINT._taperStroke(c2,pts,rgb,aMax,wMax,env)` | 8148–8156 | Shared: a stroke whose width/alpha follow an envelope so it tapers instead of stopping | Same file | **Port** — required by all 3 |
| `PAINT._thread(g,s0,v0,dir,len,turn,steps)` | 8159–8167 | Shared: a wandering, optionally-branching polyline in rail space (steak's marbling, salmon's mottle) | Same file | **Port** — required by steak + salmon |
| `PAINT.steak(c2,g)` | 8179–8310 | Full painter: two toned muscle regions off a fat seam, 80 grain strokes, 54+9 marbling threads + 140 flecks, the fat-seam region, the outer-cap region, sheen, perimeter | New `src/game/textures/steakTexture.ts` | **Port verbatim** |
| `PAINT.salmon(c2,g)` | 8318–8393 | Full painter: loin/belly regions, 110 mottle strokes, 13 myocommata bands (each 3 tapered strokes: shadow/core/crest), 3 gloss slicks, perimeter | New `src/game/textures/salmonTexture.ts` | **Port verbatim** |
| `SKIN` (object) | 8396 onward | Confirmed by reading every key: `turnip, pomegranate, kiwi, mango, watermelon, sweetpotato, beetroot, coconut, fennel, peapod, pineapple` — **no `chicken`/`steak`/`salmon` key exists** | N/A | **Do not add a SKIN entry for any protein** |
| `SCALE_LEN` | 3528 | `['rx','ry','rBig','rSmall','capR','depthX','depthY','spine','spineRx','skinRim']` | Already present in production (confirmed this session) | **Correction to the prior audit pass**: `depthX`/`depthY` here belong to the **`block`** shape family (cheddar/butter/tofu, confirmed at lines 538/733/751 — `geom.depthX`/`geom.depthY`, the block's receding-face offsets), **not** to `fillet`/the proteins. The protein `depth` record is consumed directly by `drawDepthWall`/`shadeCutEdges`/`spreadPieces` via `(gp.k \|\| 1)` at render time — **no `SCALE_LEN` change is needed for the proteins at all.** |
| Recipes: `chicken-slice-6`/`chicken-dice-3x3`/`chicken-julienne-8`/`chicken-halve` | 1611–1622 | 4 recipes, existing technique ids only | `src/game/levels/levelDefinitions.ts` — 4 new level entries | **Port verbatim** (as new levels, appended — no existing level renumbered) |
| Recipes: `steak-slice-6`/`steak-dice-3x3` | 1625–1629 | 2 recipes | `levelDefinitions.ts` | **Port verbatim** |
| Recipes: `salmon-slice-6`/`salmon-dice-3x3` | 1630–1634 | 2 recipes | `levelDefinitions.ts` | **Port verbatim** |

**Summary of what's genuinely new vs. already-exists-generically:** of the ~14 symbols above, 4 are pure data (the 3 ingredient profiles + 8 recipes), 3 are the new shape family itself (`SILS.fillet` + its 2 helpers), 3 are new protein-only render functions (`spreadPieces`, `drawDepthWall`, `shadeCutEdges` + `paintCutFaces`, `clipFaceBand`), 3 are new paint files + 1 new shared-helper file. The remaining symbols traced (`rebuildPieces`, `clipHalfPlane`, `silPath`) are core engine production already has working equivalents for — they do not need porting, only their existing call sites need to also invoke the new protein-gated functions.

### B. Story — exact source locations for the 8 required items

| # | Item | Symbol(s) | Lines |
|--:|---|---|---|
| 1 | Story state | `const Story = (() => {...})()` (whole IIFE) — `const KEY` | 10772 (IIFE open) / 10774 (`KEY`) |
| 2 | Story artwork | `const ART` (object) — `bedside` / `keys` / `chef` / `you` / `dining` / `board` / `knife` | `ART` object: 10778–10939. Per-asset: `bedside` 10779–10842, `keys` 10843–10857, `chef` 10858–10888, `you` 10889–10900, `dining` 10901–10922, `board` 10923–10931, `knife` 10932–10938 |
| 3 | Opening sequence | `const OPENING` (4 beats) | 10942–10956 |
| 4 | Fresh-start sequence | `const FRESH` (4 beats) | 10957–10967 |
| 5 | Chef sequence | `const CHEF` (5 beats) | 10968–10976 |
| 6 | Milestone definitions | `const MILES` (4 entries) | 10997–11002 |
| 7 | Finale | `const FINALE` (4 beats) | 10977–10988 |
| 8 | Story progression/flush logic | `flush()` 11197–11206; `boot()` 11186–11194; `newGame()` 11148–11154; `advance()` 11113; `run(list,done)` 11114–11126; `finish()` 11127–11138; `banner(kicker,line,ms)` 11139–11146; `render(b)` 11076–11112 (the per-beat renderer `run`/`advance` call into); public API object (`boot, flush, newGame, chapters, banner, level, play, skip, report`) 11185–11216 | see column |

Additional traced symbols not in the required 8 but needed for a faithful port: `const CARDS` (11004–11008, the 3 purchase-card labels), `paintIng(cv)` (11011–11023, paints the savings-beat ingredient card through the **actual** `PAINT.tomato/cucumber/carrot` — confirmed by reading the function body: `PAINT[id](c, g)` at line 11021, not invented art), `cardsHTML(list)` (11024–11030), `dlgHTML(d)` (11031–11036), `fx(kind)` (11040–11073, the dust/coins/spark particles), `const CH` (11157–11163, the dev/QA chapter list, confirmed derived from `OPENING.length`/`FRESH.length`/`CHEF.length`/`MILES.map` — not hand-maintained), `report()` (11212–11214). The exact, single call site that starts the whole system in the live game is confirmed at line 11220: `Story.boot();` — called once, immediately after `SceneFlow.begin()`, at the very end of the file's setup code (11218–11220).

**Recommended production destinations**: a new `src/game/story/storyDefinitions.ts` (data: `KEY`-equivalent save keys, `OPENING`/`FRESH`/`CHEF`/`FINALE`/`MILES`/`CARDS` arrays, ported verbatim as TS objects), a new `src/game/story/StoryManager.ts` (the sequencer: `boot`/`flush`/`run`/`advance`/`finish`/`banner`/`newGame`/`report`, adapted to production's own scene-transition calls in place of `SceneFlow.prep()`/`el(...)`/DOM manipulation), and a new `src/components/kc/story/` component tree for `ART`/dialogue/banner rendering (React components instead of `innerHTML`/DOM strings, same visual content and path data). `Story.level()`/`flush()`'s `Save.played()` read must map onto whichever counter `LevelManager.ts`/`SaveManager.ts` already expose as "levels completed" — this is the one production-side integration point that needs identifying precisely before `flush()` is ported, and was not re-verified in this pass (traced the Design side only, per this request's scope).

**No implementation performed in this pass.** This appendix is a trace, not a port — every "Port" cell above describes what the *next* phase should do, not something already done.
