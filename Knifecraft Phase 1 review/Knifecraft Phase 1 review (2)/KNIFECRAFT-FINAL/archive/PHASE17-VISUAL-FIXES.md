# 17B visual/presentation defects — resolution report

Two of the four ingredient items were **already fixed by later phases** (17C added `taperCurve` and the
`block` silhouette after the 17B report was written). Verified by rendering each ingredient's own `PAINT`
through its live geometry at magnification, not by reading code. Only cheddar and the café palette needed a
change; broccoli and the watermark needed a decision, not an edit.

---

### Avocado — **PASS, no change**

- **Existing implementation:** `shape:'taper'`, `rx:150 ry:96 rBig:92 rSmall:50`, **`taperCurve: 0.58`**,
  `buttRound: 0.92`, `tipRound: 2.0`.
- **Source basis:** `taperH()` in the silhouette layer already carries the §17C curve parameter:
  `rSmall + (rBig-rSmall)·(1-t)^c`, where `c === 1` is an exact identity with the original linear carrot
  sweep. The comment on it names this exact defect — "the bulb profile an avocado and an eggplant need,
  which a straight sweep can only ever render as a cone."
- **Defect status:** the cone is gone. At magnification the body is one smooth pear curve — broad rounded
  shoulder, curved narrowing to the tip, no triangular sweep, dark skin rim into pale flesh, pit as paint.
- **Left unchanged:** geometry, palette, skin/peel behaviour, cut behaviour, scale normalisation. No X/Y
  stretch was introduced — the shared proportional model is untouched.
- Halve → 3 regions (2 cuts + 1), no empty pieces, no clipping, plate containment green in `regress()`.

### Cheddar — **PASS, paint only**

- **Existing implementation:** already the `block` silhouette (a real box: three planes with hard seams,
  every corner read from `SILS.block.pts`), not 17B's flat `wedge`. Front gradient + top facet + falling side,
  nine wire-cut striations on the front, waxy grain scatter, two interior seams, rim stroke.
- **Defect:** not geometry and not the three-plane read — **the paint was mathematically perfect.** Uniform
  front, ruler-straight top rail, one flat value per facet.
- **Minimal correction (three passes, all inside the existing silhouette clip):** a dry matte edge along the
  front's lower rail; a broad soft mottle on the top facet (14 blobs, never a pattern); seven crumble nicks
  along the top-front rail so the edge is not a ruler. All deterministic — golden angle plus index-derived
  jitter, no RNG, so the sprite is stable across cache rebuilds.
- **Left unchanged:** every corner, the three-plane construction, the palette, the striations, the grain, the
  seams, the rim. **No 2.5D thickness, no sidewall experiment, no bitmap texture.** Cut geometry and
  evaluation cannot see paint: 6 cuts → 7 pieces, grade unchanged.

### Broccoli — **PASS, no change; the label was never wrong**

- **Actual piece count:** 16. **Displayed label:** "Chop 3×3".
- **Source-of-truth convention:** `counts:{h:3,v:3}` is **cuts per axis**, and the HUD pips count cuts. Three
  cuts each way partitions a solid silhouette into 4×4 = 16 pieces. Measured on four 3×3 recipes —
  broccoli 16, basil 16, parsley 16, tomato dice 16 — cluster and solid foods alike.
- **Why 17B saw 10:** the broccoli silhouette of that phase was sparse enough that grid cells fell in gaps
  between crown and stalk, so the partition created no region there. The current cluster is dense: every cell
  carries food, `pieces === cuts+1` holds, and no piece is empty.
- **Deliberately not changed:** the label (it is the cut grid, consistently, across every recipe), the Chop
  technique, and the partition. Renaming broccoli's objective alone would make it the one recipe whose label
  means something different from every other.

### Board watermark — **nothing to remove: it does not exist**

`drawBoard()` draws shadow, slab, face gradient, converging grain, the window-light pool and the far-edge
highlight. No text, no logo, no mark. The only `fillText` on the canvas is the technique label during the
completion sequence. The `FONTS` table and all other canvas text were removed in the Phase 3 cleanup pass.
The audit item was an open **proposal** ("should the board carry a watermark?"), not residue — and per the
brief, no new logo was introduced. The board stays clean.

### Café palette — **PASS, one number at the environment layer**

- **What changed:** `CONFIG.scene.ROOM_SHADE` `'#232A2E'` → `'#2E2723'`. That is the shade every room value
  falls toward, so the whole room below the light pool moves from slate-grey to walnut — which is what made
  a warm-lit kitchen read as grey concrete. Low chroma on purpose: no sepia, no orange filter.
- **What was preserved:** the entire value structure (`FAR_SHADE` / `NEAR_SHADE` / `MID_RELIEF` / `VIGNETTE`
  untouched), the board (not one board colour moved), every ingredient palette, Spirit-driven warmth and Flow
  brightness, the six kitchen skins and their progression. Measured after: brightest surface still the
  **board** (176.8 vs room 121.8, corners 99.1), room floor **71.6** against `ROOM_FLOOR_MIN` 70, clipboard
  title **6.79:1** and objective **5.07:1** — both AA.
- **Two rejected attempts, both caught by measurement:** `POOL_WARM` 0.30 → 0.32 pushed the sampled board
  near saturation and cost the Flow light its perceptibility (4.56% → 0.57%), so the pool is back at its
  ceiling; and `'#2B2420'` was warmer but dropped the room floor to 70.8 against a minimum of 70 — warm *and*
  crushed. `'#2E2723'` holds the depth the cool shade had.

---

## Regression

`regress()` — **1 failure: `flow.lightImperceptible`. Not this change, and not host throttling.**

- 71 recipes measured, every other assertion green: piece counts, plate containment per recipe, camera
  states and fidelity, handoff sequence (3793ms against the 4200 ceiling), value hierarchy
  (brightest = board, floor 71.6), clipboard AA (6.79 / 5.07), board pointer round-trip **0.000000**,
  cold-cache clip, end-caps, cadence, quantize, spirit, payload.
- **Corrected attribution.** An earlier read blamed host throttling. The final run was *not* throttled —
  `fps 110.7`, `hostHidden: false` — and reported the **identical** numbers (`lum0 174 → lum1 174.7`,
  0.4%). It is deterministic, so it is neither timing nor the host.
- **It is an in-suite sampling artifact, and it is shade-independent.** Measured directly: a settled flow-0
  board is **172.5**, a settled flow-1 board is **176.8** — **+2.49%**, comfortably perceptible and inside
  the 8% cap. The suite's `lum0` of **174.0** is neither endpoint: it is mid-lerp. Both samples are taken
  while Flow is still travelling (the block runs straight after the suite's 1200ms perf soak, which leaves
  Flow high), so they land close together and the computed delta collapses. `'#232A2E'` and `'#2E2723'`
  both measure **+2.49%**, identical at 2 and at 120 settle frames — the palette is not a variable in it.
- Per instruction the café palette was **not** altered to satisfy this measurement. The correction belongs
  in the suite (settle Flow before each sample), not in the room.
- **Typecheck / lint / build: not applicable.** This prototype is a single hand-written HTML file with no
  build step, no TypeScript and no linter — those gates live in the production repo, which is not in this
  project.

## Final verification pass (magnified, whole and completed-cut)

- **Avocado** whole: one smooth pear curve, no cone. Halved: clean flesh faces, skin rim intact.
- **Cheddar** whole: three facets read as a box; mottle, dry lower rail and crumble nicks read as surface,
  never as pattern. Sliced ×6: 7 slabs, facets and seams survive every cut.
- **Broccoli** whole: crown texture + pale stalk. Chop 3×3: all 16 regions present, none empty, no missing
  portion, fragments keep their own material.
- **Cheddar paint containment:** of 8,447 opaque samples, 8,398 fall inside `SILS.block.inside` and 49 sit
  on the boundary — the pre-existing 2px rim stroke and the trace's 5px corner radius, not the new passes
  (each is clipped to the silhouette or to a facet polygon). Geometry unmoved: corners
  `(156,461) (212,423) (384,423) (384,539) (328,577) (156,577)`, `spanX(cy) = 155.6 → 384.4`.
- **Broccoli repeatability:** 6 cuts → 16 pieces on three consecutive runs.
- **Value after the warm shade:** brightest = board (176.2), room 128.0, corners 100.6, floor 73.8,
  board÷room 1.38, board÷corners 1.75, clipboard 7.23 / 5.34 — all inside their assertions.
- `window.__kcError` null throughout; no resize errors.

**Status: 17B visual-fix work COMPLETE.**

## Not in this project (reported, not guessed)

The brief references an **Ingredient Lab**, a **Shop**, a **Rack**, a **Journal** and a **49-ingredient**
roster. This prototype has none of those: 39 ingredients, 71 recipes, and inspection is done by playing a
recipe or calling a `PAINT` function directly. Visual QA above was done that way. Those are production-repo
surfaces.
