/**
 * CUT_GEOMETRY — the general cut/piece model shared by every technique
 * (Slice, Dice, Julienne), ported from knifecraft.html's `cuts`/`pieces`/
 * `cons` globals and their supporting functions (`cutSide`, `containsPoint`,
 * `crossSegment`, `rebuildPieces`, `dirSnap`, `parallelGroups`,
 * `groupSpacing`) — see the porting plan for exact line-number references.
 *
 * A `Cut` is one committed line: `axis==="h"` → `y = c + slope*(x-cx)`;
 * `axis==="v"` → `x = c + slope*(y-cy)`. A `Piece` is nothing but the list
 * of half-plane constraints every cut that touched it left behind — its
 * shape is never stored explicitly, only re-derived (by `containsPoint`,
 * `crossSegment`, `regionGeom`) whenever something needs to know it. This
 * is what makes one code path handle a horizontal slice band, a
 * perpendicular dice grid cell, and an angled julienne baton identically.
 *
 * Deliberate simplification vs. the reference: cut POSITION is still
 * snapped to a fixed guide (see PreparationScene) rather than the
 * reference's continuous free-placement + outward-scan collision
 * avoidance (`resolvePlacement`) — same reasoning as the original Slice
 * port ("the guide the player is working"). Direction (axis + slope,
 * including PERP_SNAP/PARALLEL_SNAP) is ported exactly; only *where along
 * the perpendicular* a cut can land is simplified to "the next guide".
 */

export type Axis = "h" | "v";

export type Cut = { axis: Axis; c: number; slope: number };

export type Constraint = { cut: Cut; sign: 1 | -1 };

export type Piece = { cons: Constraint[] };

/** The active ingredient's silhouette, in world (canvas) px — everything CutGeometry needs to know about its shape. */
export type Silhouette = {
  cx: number;
  cy: number;
  rx: number; // half-extent along x (bounding, for seam-span sampling)
  ry: number; // half-extent along y
  inside(x: number, y: number): boolean;
  /** The silhouette's [lo,hi] x-range at a given y, or null if y misses it entirely — used for centroid sampling. */
  spanX(y: number): { lo: number; hi: number } | null;
  /** Max projection of the silhouette onto a unit normal (nx,ny) — half-width of the shape along that direction, used to normalize spacing for a sloped (non-axis-aligned) group of cuts. */
  support(nx: number, ny: number): number;
  /**
   * The silhouette's TRUE half-extent, when it can exceed rx/ry — an
   * organic profile with an amplitude/taper above 1.0 (a mushroom cap
   * wider than its own base radius) genuinely reaches past rx/ry, unlike
   * a plain ellipse or taper where rx/ry already ARE the exact bound.
   * Absent (falls back to rx/ry) for every shape where that's still
   * exact. This is what PreparationScene.pointInIngredientBounds reads —
   * without it, a real point inside the silhouette (the top of a tall
   * cap) could sit outside the tap-validity box, an invisible dead zone.
   */
  reachX?: number;
  reachY?: number;
};

export function cutSide(cut: Cut, x: number, y: number, cx: number, cy: number): number {
  return cut.axis === "h" ? y - (cut.c + cut.slope * (x - cx)) : x - (cut.c + cut.slope * (y - cy));
}

export function containsPoint(
  cons: Constraint[],
  x: number,
  y: number,
  cx: number,
  cy: number,
): boolean {
  for (const cn of cons) {
    if (cutSide(cn.cut, x, y, cx, cy) * cn.sign <= 0) return false;
  }
  return true;
}

function cutNormal(cut: Cut, sign: 1 | -1): { nx: number; ny: number } {
  let nx: number, ny: number;
  if (cut.axis === "h") {
    nx = -cut.slope;
    ny = 1;
  } else {
    nx = 1;
    ny = -cut.slope;
  }
  const m = Math.hypot(nx, ny) || 1;
  nx /= m;
  ny /= m;
  return sign < 0 ? { nx: -nx, ny: -ny } : { nx, ny };
}

/** The line's endpoints, extended a small overhang past the silhouette — the range crossSegment samples along, and what the scene draws the seam mark as (ported from knifecraft.html seamSpan()). */
export function seamSpanFor(
  cut: Cut,
  sil: Silhouette,
): { x0: number; y0: number; x1: number; y1: number } {
  const hw = (cut.axis === "h" ? sil.rx : sil.ry) * Math.hypot(1, cut.slope) + 8;
  return cut.axis === "h"
    ? { x0: sil.cx - hw, y0: cut.c - cut.slope * hw, x1: sil.cx + hw, y1: cut.c + cut.slope * hw }
    : { x0: cut.c - cut.slope * hw, y0: sil.cy - hw, x1: cut.c + cut.slope * hw, y1: sil.cy + hw };
}

/**
 * The seam's VISIBLE span — seamSpanFor()'s line (deliberately generous,
 * so crossSegment's sampling never falls short of the silhouette) walked
 * and clipped down to where the silhouette actually is, the same 200-
 * sample approach crossSegment itself uses. This is for DRAWING only
 * (guides, committed seam marks, the ideal/player comparison paths) —
 * never for cut-splitting math, which still needs seamSpanFor's own
 * overreach. Conflating the two was the seam-overshoot bug: a fixed
 * length based on the silhouette's overall rx/ry drew a seam that stuck
 * out past the actual (narrower, at that specific position) edge of a
 * round or tapered ingredient.
 */
export function visibleSeamSpanFor(
  cut: Cut,
  sil: Silhouette,
): { x0: number; y0: number; x1: number; y1: number } {
  const sp = seamSpanFor(cut, sil);
  const N = 200;
  let t0 = -1;
  let t1 = -1;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = sp.x0 + (sp.x1 - sp.x0) * t;
    const y = sp.y0 + (sp.y1 - sp.y0) * t;
    if (sil.inside(x, y)) {
      if (t0 < 0) t0 = t;
      t1 = t;
    }
  }
  if (t0 < 0) return sp; // shouldn't happen for a real committed cut — fall back rather than draw nothing
  const len = Math.hypot(sp.x1 - sp.x0, sp.y1 - sp.y0) || 1;
  const padT = 3 / len; // ~3px overhang so the seam still visibly meets the edge, not stopping just short of it
  const t0p = Math.max(0, t0 - padT);
  const t1p = Math.min(1, t1 + padT);
  return {
    x0: sp.x0 + (sp.x1 - sp.x0) * t0p,
    y0: sp.y0 + (sp.y1 - sp.y0) * t0p,
    x1: sp.x0 + (sp.x1 - sp.x0) * t1p,
    y1: sp.y0 + (sp.y1 - sp.y0) * t1p,
  };
}

/**
 * Walks the new cut's line (sampled 200x) inside the silhouette, looking
 * for the sub-range that is also inside the given piece. If any such
 * range exists, the cut genuinely crosses this piece (even a sliver) and
 * it must be split; otherwise the cut missed it and it stays whole.
 */
export function crossSegment(
  cons: Constraint[],
  cut: Cut,
  sil: Silhouette,
): { t0: number; t1: number; x0: number; y0: number; x1: number; y1: number } | null {
  const sp = seamSpanFor(cut, sil);
  const N = 200;
  let t0 = -1;
  let t1 = -1;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = sp.x0 + (sp.x1 - sp.x0) * t;
    const y = sp.y0 + (sp.y1 - sp.y0) * t;
    if (!sil.inside(x, y)) continue;
    if (containsPoint(cons, x, y, sil.cx, sil.cy)) {
      if (t0 < 0) t0 = t;
      t1 = t;
    }
  }
  return t0 < 0 ? null : { t0, t1, x0: sp.x0, y0: sp.y0, x1: sp.x1, y1: sp.y1 };
}

/**
 * A piece's true centroid, by dense grid sample — the pivot pieceTexture.ts
 * renders around and the scene uses to decide which way a piece nudges
 * apart.
 *
 * Phase 18 addition: `sil.inside(x,y)` is checked alongside `spanX`, not
 * instead of it. `spanX(y)` only ever needs to return the row's OUTER hull
 * (its true [lo,hi] extent, gaps and all) — for every existing convex
 * shape (ellipse/taper/polygon/organic) the hull IS solid, so `inside`
 * is true everywhere in range and this is a no-op. For a `cluster`
 * silhouette (separate leaf/floret lobes with real gaps between them) the
 * hull spans the gaps too; without this check a sample landing between two
 * leaves would be wrongly counted as food. This is the "widen the
 * silhouette contract" step the Claude Design port audit called for,
 * done as a pure filter — no change to Silhouette's shape, no new call
 * site anywhere else (spanX has exactly two consumers, both in this
 * file — confirmed by repo-wide grep before making this change).
 */
export function regionGeom(
  cons: Constraint[],
  sil: Silhouette,
  step = 7,
): { n: number; gx: number; gy: number } | null {
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (let y = sil.cy - sil.ry + 2; y <= sil.cy + sil.ry - 2; y += step) {
    const sp = sil.spanX(y);
    if (!sp || sp.hi - sp.lo <= 2) continue;
    for (let x = sp.lo + 1; x <= sp.hi - 1; x += step) {
      if (!sil.inside(x, y)) continue;
      if (containsPoint(cons, x, y, sil.cx, sil.cy)) {
        n++;
        sx += x;
        sy += y;
      }
    }
  }
  if (n < 1) return null;
  const snapped = snapToInterior(sx / n, sy / n, sil);
  return { n, gx: snapped.gx, gy: snapped.gy };
}

/**
 * Phase 18 — cluster support: `regionGeom`'s sampled mean can land off-food
 * for a piece made of separate lobes (two leaf tips either side of a gap
 * average to the air between them) — the exact failure the Claude Design
 * port documented and fixed with a nearest-interior-point snap. Ported
 * here as a small, generically-useful post-process: if the given point is
 * already inside, it's returned unchanged (a no-op for every convex
 * ingredient); otherwise a widening ring search finds the nearest point
 * that IS inside, so a piece's render/plating pivot always sits on actual
 * food.
 */
export function snapToInterior(
  gx: number,
  gy: number,
  sil: Silhouette,
): { gx: number; gy: number } {
  if (sil.inside(gx, gy)) return { gx, gy };
  const reach = Math.max(sil.reachX ?? sil.rx, sil.reachY ?? sil.ry);
  const RINGS = 24;
  const DIRS = 16;
  for (let r = 1; r <= RINGS; r++) {
    const rad = (reach * r) / RINGS;
    for (let i = 0; i < DIRS; i++) {
      const a = (i / DIRS) * Math.PI * 2;
      const x = gx + Math.cos(a) * rad;
      const y = gy + Math.sin(a) * rad;
      if (sil.inside(x, y)) return { gx: x, gy: y };
    }
  }
  return { gx: sil.cx, gy: sil.cy }; // shouldn't happen for a real piece — fall back to the ingredient's own center
}

/** Falls back to the crossing segment's own midpoint (nudged off the cut line) when a piece is too thin for the centroid grid to sample. */
function childGeom(
  cons: Constraint[],
  seg: { t0: number; t1: number; x0: number; y0: number; x1: number; y1: number },
  cut: Cut,
  sign: 1 | -1,
  sil: Silhouette,
): { gx: number; gy: number } {
  const g = regionGeom(cons, sil);
  if (g) return g;
  const tm = (seg.t0 + seg.t1) / 2;
  const n = cutNormal(cut, sign);
  return {
    gx: seg.x0 + (seg.x1 - seg.x0) * tm + n.nx * 2,
    gy: seg.y0 + (seg.y1 - seg.y0) * tm + n.ny * 2,
  };
}

/** Splits every existing piece the new cut actually crosses into two children; pieces it misses are kept whole. */
export function rebuildPieces(old: Piece[], newCut: Cut, sil: Silhouette): Piece[] {
  const next: Piece[] = [];
  for (const p of old) {
    const seg = crossSegment(p.cons, newCut, sil);
    if (!seg) {
      next.push(p);
      continue;
    }
    for (const sign of [1, -1] as const) {
      next.push({ cons: [...p.cons, { cut: newCut, sign }] });
    }
  }
  return next;
}

/** A piece's world-space bounding box AND centroid, in one grid pass — pieceTexture.ts sizes/positions the piece's canvas from the bbox; the scene uses the centroid for the settle-nudge direction. */
export function pieceBounds(
  cons: Constraint[],
  sil: Silhouette,
  step = 7,
): { x0: number; y0: number; x1: number; y1: number; gx: number; gy: number } | null {
  // The whole, uncut ingredient's bounding box IS the silhouette's own
  // analytic extent — return it exactly, with no grid scan. The scan
  // (below, for cut sub-pieces) samples interior points and so always
  // stops short of a boundary that narrows to a sliver — a taper's
  // rounded butt/tip, a cluster's outermost berries — and pieceTexture.ts
  // would then size the piece canvas too small and `ctx.drawImage` would
  // clip the painted edge off. `spanX`/`inside` never enter this path.
  if (cons.length === 0) {
    return {
      x0: sil.cx - sil.rx,
      y0: sil.cy - sil.ry,
      x1: sil.cx + sil.rx,
      y1: sil.cy + sil.ry,
      gx: sil.cx,
      gy: sil.cy,
    };
  }
  let n = 0;
  let sx = 0;
  let sy = 0;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let y = sil.cy - sil.ry + 2; y <= sil.cy + sil.ry - 2; y += step) {
    const sp = sil.spanX(y);
    if (!sp || sp.hi - sp.lo <= 2) continue;
    for (let x = sp.lo + 1; x <= sp.hi - 1; x += step) {
      if (!sil.inside(x, y)) continue; // see regionGeom's own doc — load-bearing for a cluster's gaps
      if (containsPoint(cons, x, y, sil.cx, sil.cy)) {
        n++;
        sx += x;
        sy += y;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (n < 1) return null;
  const snapped = snapToInterior(sx / n, sy / n, sil);
  // The scan samples INTERIOR points on a `step`-spaced grid, inset a
  // couple px from every edge, so the min/max it found sit up to
  // `step + inset` inside the true silhouette boundary on each side.
  // pieceTexture.ts sizes the piece's canvas straight from this box and
  // `ctx.drawImage` silently drops whatever the painted texture puts
  // outside it — a straight-edged bite out of every rounded part that
  // reached the silhouette (a grape cluster's outer berries, a taper's
  // rounded caps, a mozzarella's bulge). Grow the box past that worst-case
  // gap and clamp to the silhouette's own analytic extent: the result
  // always contains the whole piece and never exceeds the food. Centroid
  // (gx/gy) is unchanged.
  const grow = step + 2;
  return {
    x0: Math.max(x0 - grow, sil.cx - sil.rx),
    y0: Math.max(y0 - grow, sil.cy - sil.ry),
    x1: Math.min(x1 + grow, sil.cx + sil.rx),
    y1: Math.min(y1 + grow, sil.cy + sil.ry),
    gx: snapped.gx,
    gy: snapped.gy,
  };
}

/** A piece's centroid — used by the scene for the settle-nudge direction and by pieceTexture.ts as the render pivot. Returns the silhouette center itself if the piece is degenerate (shouldn't happen for a real cut). */
export function pieceCentroid(p: Piece, sil: Silhouette): { gx: number; gy: number } {
  const g = regionGeom(p.cons, sil);
  if (g) return g;
  if (p.cons.length) {
    const last = p.cons[p.cons.length - 1]!;
    const fallbackSpan = seamSpanFor(last.cut, sil);
    return childGeom(
      p.cons,
      crossSegment(p.cons.slice(0, -1), last.cut, sil) ?? { t0: 0, t1: 1, ...fallbackSpan },
      last.cut,
      last.sign,
      sil,
    );
  }
  return { gx: sil.cx, gy: sil.cy };
}

/** The intercept a line through world point (x,y), at the given axis/slope, would have — ported from interceptThrough(). */
export function interceptThrough(
  axis: Axis,
  slope: number,
  x: number,
  y: number,
  cx: number,
  cy: number,
): number {
  return axis === "h" ? y - slope * (x - cx) : x - slope * (y - cy);
}

/** knifecraft.html bandRange(): the playable band's edges on an axis, from the ingredient's own geometry fractions. */
export function bandRangeFor(
  axis: Axis,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  bandTopClear: number,
  bandBotFrac: number,
  bandSideFrac: number,
): { lo: number; hi: number } {
  return axis === "h"
    ? { lo: cy - ry + ry * 2 * bandTopClear, hi: cy + ry * bandBotFrac }
    : { lo: cx - rx * bandSideFrac, hi: cx + rx * bandSideFrac };
}

/** n evenly-spaced ideal division points within [lo,hi] — ported from idealPositions(). */
export function idealPositions(lo: number, hi: number, n: number): number[] {
  const span = hi - lo;
  return Array.from({ length: n }, (_, i) => lo + (span * (i + 1)) / (n + 1));
}

// ---------- direction snapping (PERP_SNAP / PARALLEL_SNAP) ----------

export function perpOf(d: { axis: Axis; slope: number }): { axis: Axis; slope: number } {
  return { axis: d.axis === "h" ? "v" : "h", slope: -d.slope };
}

/** The line's own tilt, folded into [-90,90) — what "parallel"/"perpendicular" mean for grading and snapping. */
export function lineAngleDeg(axis: Axis, slope: number): number {
  const a = axis === "h" ? Math.atan(slope) : Math.atan2(1, slope);
  let d = (a * 180) / Math.PI;
  while (d >= 90) d -= 180;
  while (d < -90) d += 180;
  return d;
}

export function angleApart(a: number, b: number): number {
  const d = Math.abs(a - b) % 180;
  return d > 90 ? 180 - d : d;
}

/**
 * knifecraft.html fitStroke()'s least-squares direction fit, axis-aware
 * (the reference regresses the CROSS-axis coordinate against the along-
 * axis one, so a "v" axis stroke and an "h" axis stroke use the same
 * formula with their roles swapped). Angle-assist taper (ANGLE_SNAP_DEG/
 * ANGLE_FREE_DEG) is applied by the caller, same as the reference's
 * fitStroke — this only returns the raw fit.
 */
export function fitStrokeDirection(
  points: { x: number; y: number }[],
  axis: Axis,
  cx: number,
  cy: number,
): { slope: number; c: number; angInDeg: number } {
  const iv = axis === "h" ? points.map((p) => p.x) : points.map((p) => p.y);
  const dv = axis === "h" ? points.map((p) => p.y) : points.map((p) => p.x);
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const mi = mean(iv);
  const md = mean(dv);
  let sii = 0;
  let sid = 0;
  for (let k = 0; k < iv.length; k++) {
    sii += (iv[k]! - mi) * (iv[k]! - mi);
    sid += (iv[k]! - mi) * (dv[k]! - md);
  }
  const fitB = sii < 1 ? 0 : sid / sii;
  const center = axis === "h" ? cx : cy;
  const c = md + fitB * (center - mi);
  const angInDeg = (Math.atan(Math.abs(fitB)) * 180) / Math.PI;
  return { slope: fitB, c, angInDeg };
}

export function axisCount(cuts: Cut[], axis: Axis): number {
  return cuts.filter((c) => c.axis === axis).length;
}

/** Whether an axis's cut quota (a grid technique's `counts`) is already met — always false for a single-count technique. */
export function makeAxisFull(cuts: Cut[], counts: { h: number; v: number } | null) {
  return (axis: Axis): boolean => (counts ? axisCount(cuts, axis) >= counts[axis] : false);
}

/** A grid technique redirects an incoming stroke to the unfinished axis rather than swallowing it once one set is done. */
export function liveAxis(a: Axis, counts: { h: number; v: number } | null, cuts: Cut[]): Axis {
  if (!counts) return a;
  const o: Axis = a === "h" ? "v" : "h";
  const full = makeAxisFull(cuts, counts);
  return full(a) && !full(o) ? o : a;
}

/**
 * knifecraft.html dirSnap(): cut 1 belongs to the player (any angle, as
 * fit). PARALLEL_SNAP (julienne) forces every later cut to cut 1's exact
 * direction. PERP_SNAP (dice) offers cut 1's direction OR its
 * perpendicular, picking whichever the new stroke was actually aiming
 * at, and never lets an already-finished set swallow a stroke meant for
 * the other one.
 */
export function dirSnap(
  cfg: { parallelSnap: boolean; perpSnap: boolean },
  cuts: Cut[],
  fitAxis: Axis,
  fitSlope: number,
  counts: { h: number; v: number } | null,
): { axis: Axis; slope: number } | null {
  if (!cfg.parallelSnap && !cfg.perpSnap) return null;
  if (!cuts.length) return null;
  let d = { axis: cuts[0]!.axis, slope: cuts[0]!.slope };
  if (cfg.perpSnap) {
    const full = makeAxisFull(cuts, counts);
    const p = perpOf(d);
    const a = lineAngleDeg(fitAxis, fitSlope);
    if (
      angleApart(lineAngleDeg(p.axis, p.slope), a) < angleApart(lineAngleDeg(d.axis, d.slope), a)
    ) {
      d = p;
    }
    if (full(d.axis) && !full(perpOf(d).axis)) d = perpOf(d);
  }
  return d;
}

/**
 * Tap-to-cut's position resolver — the reference's `resolvePlacement()`
 * simplified to a pure "clamp then push away from neighbors" pass (no
 * angle-flattening fallback, since a tap is never sloped): clamp the raw
 * tap coordinate away from both ends of the band by `minEdgeFrac` of the
 * band's length, then, if it lands within `minGapFrac` of an existing
 * cut on the same axis, scan outward in both directions for the nearest
 * spot that clears every existing cut by that same margin. Returns null
 * only when genuinely no valid spot remains (the ingredient is fully
 * processed) — never produces an unusably thin piece.
 *
 * `band` is already the ingredient's own real cuttable region (see
 * PreparationScene.bandFor / the ingredient's bandTopClear/bandBotFrac/
 * bandSideFrac) — `minEdgeFrac` here is only a small residual safety
 * margin against a literal zero-width edge piece, not a second
 * independent shrink. Keep it small; the earlier 0.13 (13% of an
 * ALREADY-margined band) compounded with that first margin into a ~30%+
 * dead zone near each end that was visibly still ingredient — the bug
 * this comment used to just call "clamp the raw tap coordinate" without
 * flagging that it stacks.
 */
export function resolveContinuousPosition(
  band: { lo: number; hi: number },
  existing: number[],
  rawTarget: number,
  minEdgeFrac: number,
  minGapFrac: number,
): number | null {
  const span = band.hi - band.lo;
  if (span <= 0) return null;
  const minGap = span * minGapFrac;
  const lo = band.lo + span * minEdgeFrac;
  const hi = band.hi - span * minEdgeFrac;
  if (hi <= lo) return null;

  const clear = (c: number) => existing.every((e) => Math.abs(e - c) >= minGap);
  const clamped = Math.max(lo, Math.min(hi, rawTarget));
  if (clear(clamped)) return clamped;

  const step = Math.max(1, minGap * 0.25);
  for (let d = step; d <= hi - lo; d += step) {
    for (const cand of [clamped + d, clamped - d]) {
      if (cand < lo || cand > hi) continue;
      if (clear(cand)) return cand;
    }
  }
  return null; // no room left at this margin — the band is fully cut
}

// ---------- grading: parallel groups, per-group spacing, n-weighted combine ----------

export type ScoringTol = {
  evennessTol: number;
  consistencyCvTol: number;
};

/** knifecraft.html parallelGroups(): buckets committed cuts by angle (within PARALLEL_TOL_DEG) — a dice grid naturally makes two groups ~90° apart; a slice/julienne run makes one. */
export function parallelGroups(cuts: Cut[], tolDeg: number): { a: number; cuts: Cut[] }[] {
  const groups: { a: number; cuts: Cut[] }[] = [];
  for (const c of cuts) {
    const a = lineAngleDeg(c.axis, c.slope);
    const g = groups.find((g) => angleApart(g.a, a) <= tolDeg);
    if (g) {
      g.a = (g.a * g.cuts.length + a) / (g.cuts.length + 1);
      g.cuts.push(c);
    } else {
      groups.push({ a, cuts: [c] });
    }
  }
  return groups;
}

/** knifecraft.html groupSpacing(): evenness/consistency for one angle-group of cuts, band-width normalized (axis-aligned band for a flat group, the silhouette's support along the group's own normal otherwise). */
export function groupSpacing(
  group: { a: number; cuts: Cut[] },
  sil: Silhouette,
  bandRange: (axis: Axis) => { lo: number; hi: number },
  tol: ScoringTol,
): { n: number; evenness: number; consistency: number } | null {
  const cs = group.cuts;
  if (!cs.length) return null;
  const flat = cs.every((c) => Math.abs(c.slope) < 0.02 && c.axis === cs[0]!.axis);
  let pos: number[];
  let lo: number;
  let hi: number;
  if (flat) {
    const bd = bandRange(cs[0]!.axis);
    pos = cs.map((c) => c.c).sort((a, b) => a - b);
    lo = bd.lo;
    hi = bd.hi;
  } else {
    const th = (group.a * Math.PI) / 180;
    const nx = -Math.sin(th);
    const ny = Math.cos(th);
    const half = sil.support(nx, ny) * 0.85; // reference's T.bandSideFrac-equivalent margin
    pos = cs
      .map((c) => {
        const px = c.axis === "h" ? sil.cx : c.c;
        const py = c.axis === "h" ? c.c : sil.cy;
        return (px - sil.cx) * nx + (py - sil.cy) * ny;
      })
      .sort((a, b) => a - b);
    lo = -half;
    hi = half;
  }
  const edges = [lo, ...pos, hi];
  const gaps: number[] = [];
  for (let i = 1; i < edges.length; i++) gaps.push(edges[i]! - edges[i - 1]!);
  const ideal = (hi - lo) / (pos.length + 1);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const stddev = (xs: number[]) => {
    const m = mean(xs);
    return Math.sqrt(mean(xs.map((x) => (x - m) * (x - m))));
  };
  const rmsDev = Math.sqrt(mean(gaps.map((g) => (g - ideal) * (g - ideal)))) / (ideal || 1);
  const cvC = stddev(gaps) / (mean(gaps) || 1);
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  return {
    n: pos.length,
    evenness: Math.round(100 * (1 - clamp01(rmsDev / tol.evennessTol))),
    consistency: Math.round(100 * (1 - clamp01(cvC / tol.consistencyCvTol))),
  };
}
