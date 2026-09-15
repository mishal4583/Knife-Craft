# KnifeCraft — Skin / Peel / Overhang mechanics: how they actually work

Reference doc for anyone (human or agent) editing `knifecraft.html`. Everything below is read from the
current source. Line numbers are approximate anchors — **always grep for the named symbol**, never trust the
number after an edit.

There is exactly **one HTML file**: `knifecraft.html` (~10,000 lines). No build step, no modules, no
TypeScript. Everything is inside a single `<script>` in that file. There are no image assets: every
ingredient is painted procedurally into an offscreen canvas once, then blitted.

---

## 0. The three layers you must not confuse

An ingredient can have up to three visual layers. They are separate systems with separate rules.

| Layer | What it is | Lives in | Sees cuts? |
|---|---|---|---|
| **Base sprite** | the ingredient's *interior/peeled* picture | `PAINT[id]` (~L5415) | yes — clipped per piece |
| **Skin sprite** | a *full-body* shell painted over the base | `SKIN[id]` (~L7563) | fades as a whole via `skinAlpha` |
| **Overhang** | paint *outside* the silhouette (stems, crowns, roots) | inside `PAINT[id]`/`SKIN[id]`, gated by `geom.overhang` | no — cosmetic only, sheds on first cut |

The cutting model itself (partitions, spans, `cuts[]`, scoring) **never sees the skin or the overhang.**
That is the whole design point. If you change peel or overhang behaviour you must not touch cut geometry.

---

## 1. Sprite pipeline (read this first — everything else hangs off it)

```
CONFIG.INGREDIENTS[id].geom     authored geometry (cx, cy, rx, ry, shape, overhang, spriteM, …)   L~240-1160
      │
artGeom(id)              L5227  → .art if present else .geom   (authored proportions, NOT the scaled box)
      │
ingSprite(id)            L5279  → paints PAINT[id] into an offscreen canvas, cached in `sprites{}`
skinSprite(id)           L5228  → paints SKIN[id] into a second offscreen canvas, cached in `skins{}`
      │
drawIngredient(src)      L5141  → blits base sprite, then blits skin sprite at globalAlpha = skinAlpha(id)
```

`spriteM(g)` is the sprite **margin** (bleed) in authored px: how far past `rx/ry` the canvas extends so
overhang paint isn't cropped. `geom.spriteM` overrides the shared default. **If you add or lengthen an
overhang you must raise `spriteM` or it gets clipped.**

Sprites are painted at authored size and blitted into the scaled box, so the global ingredient-scale pass
never stretches a stem away from its body.

Both caches are keyed by id only — they are painted **once**. Anything that must change per-frame (like the
pumpkin stem, see §5) cannot live in a sprite.

---

## 2. Rub-to-peel — the real peel step

**Location: L5156–L5222** (block comment + all state), plus input hooks and the overlay.

### The sets

```js
const SKIN_KEEP  = { beetroot, sweetpotato, mango, kiwi, pomegranate, fennel, peapod, turnip }  // L5173
const SKIN_WHOLE = { turnip: true }                                                             // L5177
const PEEL_TONE  = { pineapple:'#8A6A2A', watermelon:'#2C6531', coconut:'#8A5A2A' }             // L5178
const peelable   = id => !!SKIN[id] && !SKIN_KEEP[id]                                           // L5181
```

`peelable` is **derived, not a list**. There is no `PEELABLE` constant. Peelable = *has a SKIN entry* AND
*is not in SKIN_KEEP*. Right now that resolves to exactly three: **pineapple, watermelon, coconut** — the
same three that have `PEEL_TONE` shred colours.

To make a new food peelable you add `SKIN[id]` and **do not** add it to `SKIN_KEEP`; add a `PEEL_TONE` entry
so its shreds are the right colour (fallback is `#8A6A2A`).

### The tuning constants (L5165–L5172)

```js
PEEL_SHED_MS   = 520      // shell fade-out after the rub completes
PEEL_NEED_PX   = 2200     // hand travel needed, in AUTHORED px
peelNeed()     = PEEL_NEED_PX * (T.k || 1)   // scaled by ingredient scale, so cost in strokes is constant
PEEL_THIN_MAX  = 0.45     // rubbing alone only fades the shell to 55%; the rest goes on shed
```

### The state machine

```js
let peel = null      // L5180  { ing, got, done, doneT, flecks, soundAt }
let peelForced= null // L5179  test override: true = peeled, false = shell on, null = follow the step
```

- `peelStart()` **L5184** — called from `startRecipe()` (**L3988**), right after `resetBoard()`. Sets `peel`
  if `peelable(activeSrc.ing)`, else `null`.
- `peelPending()` **L5182** — `peel && !peel.done`.
- `canCut()` **L3306** — `phase === 'cutting' && !peelPending()`. **This is what locks the knife.** The peel
  step does not use its own phase; `phase` is already `'cutting'` and the peel just gates it.
- `peelRub(prev, p)` **L5190** — accumulates `peel.got` **only for movement inside the silhouette**
  (`insideSil`), spawns flecks, plays the rasp sound. When `peel.got >= peelNeed()` it sets
  `done = true, doneT = gameNow()`.
- `peelProgress()` **L5183** — `clamp01(peel.got / peelNeed())`.

### Input routing (pointer handlers ~L3410–3450)

- `pointerdown` **L3414**: bails unless `canCut() || peelPending()`; stroke is tagged `rub: peelPending()`.
- `pointermove` **L3441**: `if(stroke.rub && prev) peelRub(prev, p)`.
- **L3446**: `if(stroke.rub){ pump(); return; }` — a rub stroke produces **no blade, no ghost line, and no
  cut on release**. This is why a peel gesture can never cost the player a misplaced cut.
- `commitCut` guard **L3673–3675**: refuses with reason `'peel step holds the board (rub to peel first)'`.

### The overlay

`drawPeel(gnow)` **L4328**, called from the frame at **L4318**. Draws the flecks, then a progress ring
**outside** the silhouette (stand-off `clamp(max(T.rx,T.ry)*0.16, 26, 52)`) so it can never read as a cut
line, plus the label `Rub to peel` / `Keep rubbing` / `Peeled`. Everything is derived from `gnow`, so a
stalled frame cadence can't leave it half-drawn.

### `skinAlpha(id)` — the single source of truth for shell opacity (L5211)

```js
if(!SKIN[id])        return 0;                    // no shell at all
if(SKIN_KEEP[id])    return 1;                    // PERMANENT skin, never fades
if(peelForced != null) return peelForced ? 0 : 1; // test hook
if(peel && peel.ing === id){
  if(!peel.done)     return 1 - PEEL_THIN_MAX*peelProgress();   // thinning under the hand
  k = (gameNow()-peel.doneT)/PEEL_SHED_MS;
  return (1-PEEL_THIN_MAX)*(1-k*k);                             // shedding
}
if(!cuts.length)     return 1;
k = (gameNow()-cuts[0].revealT0)/PEEL_SHED_MS;
return 1 - k*k;                                   // FALLBACK: shed on first cut
```

Every call site inherits this through `drawIngredient`, so pieces, the plate, the replay and the overhang
all agree without any of them knowing about peeling.

---

## 3. Auto-peel-on-cut — **there is no such designed mechanic** (common misreading)

The last branch of `skinAlpha` fades the shell off `cuts[0].revealT0`. It looks like "auto-peel after one
cut", and it is **not** reachable in normal play for any ingredient:

- Peelable foods (pineapple, watermelon, coconut) always have `peel` set by `peelStart()`, so the branch
  above catches them; and the knife is locked until `peel.done`, so `cuts[]` is empty while peeling.
- `SKIN_KEEP` foods return `1` two lines earlier and never reach it.

It is a **fallback** for the three peelables when the peel step is bypassed: `peelForced` via the test hook
`window.__kcTest.peelSet(v)` (**L9909**), and `runStage` (**L9828**) which calls `peelSet(true)` so a
scripted knife never fights the peel gate.

**Kiwi and mango do not auto-peel.** They are `SKIN_KEEP` — permanent skin. A cut opens a flesh face inside
a skin rim, which is what the reference photos show (halves keep a brown/gold rim). If Claude Code has been
told kiwi/mango auto-peel, that is wrong and any code written to that belief will fight `skinAlpha`.

`SKIN_WHOLE` (**L5177**, turnip only) is a further step: the skin stays wall-to-wall even after cutting and
the rim-annulus treatment is skipped, because a turnip is drawn from its outside alone and has no flesh
sprite — a cut opens onto *more outside*, not a different interior.

---

## 4. Cosmetic overhang — stems, crowns, leaves, roots

**Location: `overhangPath` L5241, `drawOverhang` L5263.** Declared per ingredient as
`geom.overhang: { x, y }` (extra painted extent past the silhouette, authored px) + a matching `spriteM`.

### How it works

`overhangPath(g)` **L5241** builds *sprite box MINUS silhouette*, even-odd. `drawOverhang` clips to that and
blits the ingredient sprite, so you get **the sprite's leaf/stem pixels with not one pixel of body** — a
plain sprite blit would paint over the gaps the cuts open.

Because the overhang is only ever drawn through this even-odd window, **no cut, span, piece or score ever
sees it.** It fades on the first cut along with everything else outside the silhouette.

### The 13 declarations (grep `overhang: {`)

| Ingredient | Line | What hangs over |
|---|---|---|
| Peach | 497 | stem + leaf past the crown |
| Corn | 520 | green stalk stub past the butt |
| Celery | 541 | leaf crown |
| Pineapple | 762 | spiky green crown past the tip |
| Radish | 816 | leaf tops past the crown |
| Beetroot | 842 | crown stalks + leaves |
| Mango | 910 | stem + one leaf (painted in `SKIN.mango`, so it shows while the shell is on) |
| Pomegranate | 949 | dried calyx crown |
| Fennel | 1051 | stalks + fronds |
| Artichoke | 1074 | stubby cut stem below the bracts |
| Pea Pod | 1107 | stem + curled tendril |
| Pumpkin | 1128 | the stem (special case — see §5) |
| Turnip | 1149 | leaf stalks up-right, taproot down-left |

Note **mango's overhang paint lives in `SKIN.mango`, not `PAINT.mango`** — it must be visible while the
(permanent) shell is on. That is the pattern for any `SKIN_KEEP` food with an overhang.

---

## 5. The pumpkin stem — the one overhang that is NOT in the sprite

**Location: `paintPumpkinStem(c2, g)` L5293–L5414**, called from `drawOverhang` **L5263** on the `over` pass.

Why it is special: baked into the cached sprite, the part of the stem **inside** the silhouette belonged to
whichever cut piece happened to cover it, so it survived the cut and left a stub riding a piece. So:

1. The stem was **removed from `PAINT.pumpkin`** and moved into its own function, declared **before**
   `const PAINT` so it is defined when the paint table is built.
2. `drawOverhang` gained a fourth parameter, `over`, and the guard
   `if((s.ing === 'pumpkin') !== !!over) return;` — leaf crowns draw **under** the piece paint, the pumpkin
   stem draws **over** it. Drawn under, the body's own crown paint covered the flare and the lower stalk.
3. The frame calls `drawOverhang(activeSrc, gnow, A, true)` **after** the pieces and pre-score strokes
   (~L5108), inside the same `ctx.save()/restore()` so it inherits the ingress alpha `A`.
4. On the `over` pass it calls `paintPumpkinStem` **unclipped** (not through `overhangPath`), so the whole
   stem — inside and outside the silhouette — is one object on one fade clock. The first cut takes all of it.

Stem construction, for anyone tuning it:

- base `bx = g.cx + 4, by = g.cy - g.ry*0.94` (top of the crown); `wx/wy` for the crown well read the **same
  point** — when they drifted apart the seating shadow ringed empty shell.
- `RISE = g.ry*0.90`, `LEAN = g.rx*0.80`; cubic Bézier spine, near-vertical at the base, bend in the upper half.
- widths `[30, 18.5, 14, 10.5] * K` where `K = g.rx/152` — **authored units, scaled by food size**.
- both flanks carry independent low-frequency wobble (`wob(t, ph)`) so it is asymmetric, never a swept cylinder.
- the rounded base cap is part of the `Path2D` itself (`st.ellipse(...)`), not a separate fill — otherwise the
  shading clip stops at the base chord and re-creates a ruler-straight seam.
- the shell's rim stroke (`c2.stroke(sil)`) runs **before** the stem in `PAINT.pumpkin` (~L7471) or it draws a
  tan hairline across the green.
- six longitudinal grooves are walked as a *fraction across the left/right rails*, so they follow taper and lean.
- the tip is a lumpy **solid** cap, deliberately not a clean ring (no "hollow pipe" read).

---

## 6. Other real categories (so they don't get reinvented)

- **Layered interiors** — `innerGeom(g, d)` **L3228** returns a cached inset copy of a silhouette. Used for
  concentric rind → pith → flesh: Lemon, Watermelon, Coconut (+ hollow cavity), Cucumber, Mozzarella,
  Pineapple. Cheap and cached on the geometry; do not hand-roll insets.
- **Cluster foods** — `shape:'cluster'`, silhouette *is* the leaves/florets; `rx/ry` are **derived** by
  `fitCluster(g)` **L3100**, never hand-written. Lobes with `stem:true` are stalks drawn behind the blades.
  Basil, Parsley, Broccoli, Cauliflower, Lettuce, Cabbage, Spinach, Asparagus, Green Bean, Grapes, Artichoke.
- **Block foods** — `SILS.block` **L2824**; a real 3-face box whose corners come from `SILS.block.pts(g)` so
  paint can never drift out of register. Cheddar, Butter, Tofu.
- **Pit/stone occlusion is PAINT, never geometry** — Avocado, Peach, Mango. A real hole would let one cut
  piece become two disconnected regions, which the partition model cannot represent. The interior stays
  continuous flesh.
- **Per-ingredient `resistance` curves + `audio` profiles** — every one of the 39, in the ingredient record.

---

## 7. Rules for editing this area

1. **Never** put skin, peel or overhang state into the cut model. `cuts[]`, spans and scoring stay ignorant.
2. All shell opacity goes through `skinAlpha`. Do not add a second opacity path.
3. Peelability is derived (`SKIN` minus `SKIN_KEEP`). Do not introduce a `PEELABLE` list — it will desync.
4. New/longer overhang ⇒ raise `geom.spriteM` or it is cropped by the sprite canvas.
5. Anything that must change per frame cannot live in `PAINT`/`SKIN` (they are cached once per id) — give it
   its own function like `paintPumpkinStem`.
6. Overhang for a `SKIN_KEEP` food belongs in `SKIN[id]`, not `PAINT[id]`.
7. `window.__kcTest.peelSet(true|false|null)` **L9909** forces the shell state; `runStage` uses it so
   scripted cuts never fight the peel gate. Regression harness checks skin coverage at **L9133**.
