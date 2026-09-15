/**
 * INGREDIENT_SHAPES — Silhouette factories for CutGeometry, ported from
 * knifecraft.html's `SILS` table (ellipse for tomato, taper for carrot).
 * Cucumber (a new-project addition) reuses the SAME horizontal taper —
 * it lies flat on the board exactly like carrot does, just with a near-
 * equal rBig/rSmall and generous rounding on both ends (a blunt capsule
 * instead of carrot's fat crown tapering to a point) — see
 * definitions.ts's CUCUMBER_GEOMETRY and PreparationScene's per-
 * ingredient axis override, which is what makes a cut that runs
 * perpendicular to this shape's length (producing rounds) the default
 * for cucumber while staying "h" for tomato. World/canvas px, not the
 * reference's design-canvas px.
 */
import type { Silhouette } from "./CutGeometry";

/**
 * Optional ellipse-silhouette modifiers, ported from knifecraft.html's
 * `SILS.ellipse` (`scallop`/`lobes` — Pumpkin's ribbed lobe wave via the
 * shared `ellVH` helper — and `ovoid` — Mango's shoulder-narrower-than-
 * belly profile). Absent (the default `{}`), both `makeEllipseSilhouette`
 * and `traceEllipsePath` are the exact old closed-form ellipse to the
 * last digit, so no other food's geometry moves.
 */
export type EllipseModOpts = { scallop?: number; lobes?: number; ovoid?: number };

/** Ported verbatim from the source's `ellVH(g,pad,u)` — the scalloped half-height at normalized x `u` (in [-1,1]). */
function ellVH(ry: number, pad: number, u: number, scallop: number, lobes: number): number {
  const uu = Math.max(-1, Math.min(1, u));
  const base = (ry + pad) * Math.sqrt(Math.max(0, 1 - uu * uu));
  return scallop
    ? base * (1 + scallop * (1 - 0.62 * uu * uu) * Math.cos(2 * lobes * Math.asin(uu)))
    : base;
}

/** Traces the ellipse outline (padded by `pad`) into an already-`beginPath()`'d context — world coords. */
export function traceEllipsePath(
  ctx: CanvasPath,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  pad: number,
  opts: EllipseModOpts = {},
): void {
  if (opts.scallop) {
    const N = 128;
    const lobes = opts.lobes ?? 9;
    const rrx = rx + pad;
    ctx.moveTo(cx - rrx, cy);
    for (let i = 0; i <= N; i++) {
      const u = -1 + (2 * i) / N;
      ctx.lineTo(cx + rrx * u, cy - ellVH(ry, pad, u, opts.scallop, lobes));
    }
    for (let i = N; i >= 0; i--) {
      const u = -1 + (2 * i) / N;
      ctx.lineTo(cx + rrx * u, cy + ellVH(ry, pad, u, opts.scallop, lobes));
    }
    ctx.closePath();
    return;
  }
  if (opts.ovoid) {
    const N = 96;
    const rrx = rx + pad;
    const rry = ry + pad;
    const ov = opts.ovoid;
    const hw = (t: number) => rrx * Math.sqrt(Math.max(0, 1 - t * t)) * (1 + ov * t);
    ctx.moveTo(cx + hw(-1), cy - rry);
    for (let i = 1; i <= N; i++) {
      const t = -1 + (2 * i) / N;
      ctx.lineTo(cx + hw(t), cy + rry * t);
    }
    for (let i = N - 1; i >= 0; i--) {
      const t = -1 + (2 * i) / N;
      ctx.lineTo(cx - hw(t), cy + rry * t);
    }
    ctx.closePath();
    return;
  }
  ctx.ellipse(cx, cy, rx + pad, ry + pad, 0, 0, Math.PI * 2);
}

export function makeEllipseSilhouette(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  opts: EllipseModOpts = {},
): Silhouette {
  const { scallop, ovoid } = opts;
  const lobes = opts.lobes ?? 9;
  if (scallop) {
    return {
      cx,
      cy,
      rx,
      ry,
      inside(x, y) {
        const u = (x - cx) / rx;
        if (Math.abs(u) > 1) return false;
        return Math.abs(y - cy) <= ellVH(ry, 0, u, scallop, lobes);
      },
      spanX(y) {
        const N = 192;
        const d = Math.abs(y - cy);
        let lo: number | null = null;
        let hi: number | null = null;
        for (let i = 0; i <= N; i++) {
          const u = -1 + (2 * i) / N;
          if (d <= ellVH(ry, 0, u, scallop, lobes)) {
            const x = cx + rx * u;
            if (lo == null) lo = x;
            hi = x;
          }
        }
        return lo == null || hi == null ? null : { lo, hi };
      },
      support(nx, ny) {
        const N = 128;
        let m = 0;
        for (let i = 0; i <= N; i++) {
          const u = -1 + (2 * i) / N;
          const x = rx * u;
          const hh = ellVH(ry, 0, u, scallop, lobes);
          m = Math.max(m, Math.abs(x * nx + hh * ny), Math.abs(x * nx - hh * ny));
        }
        return m;
      },
      // scallop's amplitude peaks at u=0 (cos(0)=1, (1-0.62*0)=1), so the
      // true half-height can exceed ry by exactly the scallop fraction —
      // small (Pumpkin's own 0.032), but real: without this, the crown of
      // a lobe between u's sample points could sit just outside the
      // tap-validity box PreparationScene derives from reachX/reachY.
      reachY: ry * (1 + scallop),
    };
  }
  if (ovoid) {
    return {
      cx,
      cy,
      rx,
      ry,
      inside(x, y) {
        const t = (y - cy) / ry;
        if (Math.abs(t) > 1) return false;
        return Math.abs(x - cx) <= rx * Math.sqrt(1 - t * t) * (1 + ovoid * t);
      },
      spanX(y) {
        const dy = (y - cy) / ry;
        const s = 1 - dy * dy;
        if (s <= 0) return null;
        const h = rx * Math.sqrt(s) * (1 + ovoid * dy);
        return h <= 0 ? null : { lo: cx - h, hi: cx + h };
      },
      support(nx, ny) {
        const N = 96;
        let m = 0;
        for (let i = 0; i <= N; i++) {
          const t = -1 + (2 * i) / N;
          const hw = rx * Math.sqrt(Math.max(0, 1 - t * t)) * (1 + ovoid * t);
          const y = ry * t;
          m = Math.max(m, Math.abs(hw * nx + y * ny), Math.abs(-hw * nx + y * ny));
        }
        return m;
      },
    };
  }
  return {
    cx,
    cy,
    rx,
    ry,
    inside(x, y) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      return dx * dx + dy * dy <= 1;
    },
    spanX(y) {
      const dy = (y - cy) / ry;
      const s = 1 - dy * dy;
      if (s <= 0) return null;
      const h = rx * Math.sqrt(s);
      return { lo: cx - h, hi: cx + h };
    },
    support(nx, ny) {
      return Math.hypot(rx * nx, ry * ny);
    },
  };
}

// ---------- capsule: a true stadium (barrel + two exact semicircle end-caps) ----------

/**
 * Ported directly from knifecraft.html's `SILS.capsule` — a barrel of
 * radius `capR` swept between two centres `rx-capR` apart. Cucumber,
 * Baguette and Pineapple use this in the actual source (confirmed by
 * grepping every `shape:'capsule'` occurrence, not assumed); Corn moved
 * to `taper`+`taperCurve` in a later revision and is NOT a capsule in the
 * final source, so it is not ported as one. Genuinely different from a
 * near-equal-rBig/rSmall `taper`: a taper's cap eases in with a
 * `buttRound`/`tipRound`-scaled sqrt curve, while a capsule's ends are
 * exact semicircular arcs — the two read differently at the rounded tip,
 * which is why this is its own primitive rather than a taper special case.
 */
export function makeCapsuleSilhouette(
  cx: number,
  cy: number,
  rx: number,
  capR: number,
): Silhouette {
  const f = rx - capR;
  return {
    cx,
    cy,
    rx,
    ry: capR,
    inside(x, y) {
      const dx = Math.max(0, Math.abs(x - cx) - f);
      const dy = y - cy;
      return dx * dx + dy * dy <= capR * capR;
    },
    spanX(y) {
      const dy = y - cy;
      const s = capR * capR - dy * dy;
      if (s <= 0) return null;
      const d = Math.sqrt(s);
      return { lo: cx - f - d, hi: cx + f + d };
    },
    support(nx, ny) {
      return Math.abs(nx) * f + capR;
    },
  };
}

/** Traces a capsule outline (padded by `pad`) into an already-`beginPath()`'d context — same calling convention as every other trace* helper in this file. */
export function traceCapsulePath(
  ctx: CanvasPath,
  cx: number,
  cy: number,
  rx: number,
  capR: number,
  pad: number,
): void {
  const f = rx - capR;
  const r = capR + pad;
  ctx.moveTo(cx - f, cy - r);
  ctx.lineTo(cx + f, cy - r);
  ctx.arc(cx + f, cy, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(cx - f, cy + r);
  ctx.arc(cx - f, cy, r, Math.PI / 2, Math.PI * 1.5);
  ctx.closePath();
}

// ---------- organic (Pre-Phase-8): a generic angular-radius-profile silhouette ----------

/**
 * A silhouette described as a periodic radius multiplier around its own
 * center, in ellipse-unit space — the generalization `makeOrganicSilhouette`
 * needs to represent lobed/leaf/cap-and-stem/heart-taper shapes as ONE
 * reusable factory instead of a bespoke polygon per ingredient. `harmonics`
 * sum cosine terms (`k` cycles per 360°, `amp` the term's swing, `phaseDeg`
 * where it peaks); `notches` add a localized Gaussian dent/bump (a stem
 * dimple, a calyx indent, a cap/stem shoulder) on top. The result is
 * clamped to [0.4, 1.32] so the outline always stays a simple, star-shaped
 * closed curve around (cx,cy) — required for `spanX`'s row-scan and
 * `crossSegment`'s line-walk (CutGeometry.ts) to keep finding exactly one
 * contiguous interval, the same assumption `makeTaperSilhouette` already
 * relies on for its own non-analytic shape.
 */
export type OrganicProfile = {
  harmonics: { k: number; amp: number; phaseDeg: number }[];
  notches?: { centerDeg: number; widthDeg: number; depth: number }[];
  /**
   * A generic two-zone envelope for ingredients with a genuinely distinct
   * "broad zone / narrow zone" structure — Mushroom's cap+stem is the
   * first user, but any future ingredient with the same wide-then-narrow
   * silhouette (a drumstick, a gourd) can reuse it rather than fighting a
   * single sinusoid into the same shape. A lone `harmonics` term is
   * ALWAYS a smooth, roughly symmetric bulge-to-bulge curve — pushed to
   * a big top/bottom ratio it still reads as two comparable round lobes
   * pinched at the waist (a peanut/hourglass), because a cosine's extremes
   * are single points, not plateaus, and nothing stops the "wide" side
   * from also being read as its own lobe. `taper` instead defines two
   * flat RADIUS PLATEAUS — `fromScale` for the whole top zone, `toScale`
   * for the whole bottom zone — eased between them (smoothstep) across a
   * band `transitionWidth` wide (0..1, a fraction of the vertical
   * domain) centered on the vertical middle, so one zone genuinely
   * dominates and the other reads as subordinate, with no dip below
   * either plateau's own resting width. Parameterized by sin(theta) —
   * vertical position, not the raw angle — so it's automatically
   * left-right symmetric without the caller reasoning about wraparound.
   * Applied as the profile's own BASE (replacing the flat `1`) before
   * harmonics/notches add their own, smaller, organic wobble on top.
   */
  taper?: { fromScale: number; toScale: number; transitionWidth: number };
};

const RAD_PER_DEG = Math.PI / 180;

/** Shortest signed difference a-b in degrees, wrapped to [-180,180). */
function angleDeltaDeg(a: number, b: number): number {
  return ((((a - b + 180) % 360) + 360) % 360) - 180;
}

/** Classic smoothstep, 0..1 in, 0..1 out, zero slope at both ends. */
function smoothstep01(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/** The profile's radius multiplier at a given angle (degrees, standard atan2 convention) — clamped so the outline can never self-intersect. */
export function organicProfileRadius(thetaDeg: number, profile: OrganicProfile): number {
  let base = 1;
  if (profile.taper) {
    const { fromScale, toScale, transitionWidth } = profile.taper;
    const t = (Math.sin(thetaDeg * RAD_PER_DEG) + 1) / 2; // 0 at the very top, 1 at the very bottom
    const band = Math.max(0.001, transitionWidth);
    const tw = smoothstep01((t - 0.5) / band + 0.5);
    base = fromScale + (toScale - fromScale) * tw;
  }
  let r = base;
  for (const h of profile.harmonics) {
    r += h.amp * Math.cos((h.k * thetaDeg - h.phaseDeg) * RAD_PER_DEG);
  }
  for (const n of profile.notches ?? []) {
    const d = angleDeltaDeg(thetaDeg, n.centerDeg);
    r -= n.depth * Math.exp(-(d * d) / (2 * n.widthDeg * n.widthDeg));
  }
  return Math.max(0.4, Math.min(1.32, r));
}

/** Traces the organic outline (padded by `pad`) into an already-`beginPath()`'d context — world coords, same calling convention as traceEllipsePath. */
export function traceOrganicPath(
  ctx: CanvasPath,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  profile: OrganicProfile,
  pad: number,
): void {
  const N = 96;
  const px = rx + pad;
  const py = ry + pad;
  for (let i = 0; i <= N; i++) {
    const thetaDeg = (i / N) * 360;
    const R = organicProfileRadius(thetaDeg, profile);
    const x = cx + px * R * Math.cos(thetaDeg * RAD_PER_DEG);
    const y = cy + py * R * Math.sin(thetaDeg * RAD_PER_DEG);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function makeOrganicSilhouette(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  profile: OrganicProfile,
): Silhouette {
  const insideAt = (x: number, y: number): boolean => {
    const u = (x - cx) / rx;
    const v = (y - cy) / ry;
    const r = Math.hypot(u, v);
    if (r === 0) return true;
    const thetaDeg = Math.atan2(v, u) / RAD_PER_DEG;
    return r <= organicProfileRadius(thetaDeg, profile);
  };
  // The profile's own true max radius (e.g. a mushroom cap's taper
  // envelope reaches past 1.0) — sampled once here rather than assumed,
  // so reachX/reachY stay correct for any profile without hand-tuning a
  // margin per ingredient. See Silhouette.reachX/reachY's own doc.
  let maxR = 1;
  for (let i = 0; i < 128; i++) {
    maxR = Math.max(maxR, organicProfileRadius((i / 128) * 360, profile));
  }
  return {
    cx,
    cy,
    rx,
    ry,
    reachX: rx * maxR,
    reachY: ry * maxR,
    inside: insideAt,
    // Same row-scan approach makeTaperSilhouette's spanX already uses for
    // its own non-analytic shape — walk x at this y and keep the
    // contiguous inside run. Safe because the clamp above guarantees a
    // star-shaped (single-interval-per-row) outline.
    spanX(y) {
      const N = 120;
      const xMax = rx * 1.34;
      let lo: number | null = null;
      let hi: number | null = null;
      for (let i = 0; i <= N; i++) {
        const x = cx - xMax + (2 * xMax * i) / N;
        if (insideAt(x, y)) {
          if (lo == null) lo = x;
          hi = x;
        }
      }
      return lo == null ? null : { lo, hi: hi! };
    },
    // Scan the outline itself and keep the smaller reach either side of
    // center along (nx,ny) — the same conservative convention
    // makeTaperSilhouette's support() uses, so grading never assumes more
    // room than the narrower side of an asymmetric shape actually has.
    support(nx, ny) {
      const N = 128;
      let lo = 0;
      let hi = 0;
      for (let i = 0; i < N; i++) {
        const thetaDeg = (i / N) * 360;
        const R = organicProfileRadius(thetaDeg, profile);
        const x = rx * R * Math.cos(thetaDeg * RAD_PER_DEG);
        const y = ry * R * Math.sin(thetaDeg * RAD_PER_DEG);
        const p = x * nx + y * ny;
        if (p < lo) lo = p;
        if (p > hi) hi = p;
      }
      return Math.min(-lo, hi);
    },
  };
}

// ---------- cluster (Phase 18): a bunch of separate lobes, not one closed body ----------

/**
 * One lobe of a cluster silhouette — a rotated ellipse offset from the
 * ingredient's own (cx,cy), in world px. Ported from knifecraft.html's
 * Phase 17A `SILS.cluster` (see its own PHASE17A-REPORT.md): a leafy herb,
 * a broccoli/cauliflower floret head, or a bundle of asparagus/beans/grapes
 * is genuinely a set of separate bodies with real gaps between them, which
 * no single-center radius function (ellipse/taper/organic/polygon) can
 * represent — a cluster is the missing primitive, not more detail on an
 * existing one. `stem` is a cosmetic flag only (thin lobes drawn as stems,
 * not fed into any geometry math differently) — carried here purely so
 * PAINT code doesn't need a second parallel array.
 */
export type ClusterLeaf = {
  dx: number;
  dy: number;
  rx: number;
  ry: number;
  /** Radians. Optional — defaults to 0 (a berry/floret with rx≈ry has no meaningful orientation). */
  rot?: number;
  stem?: boolean;
};

/** A leaf's own local (u,v) frame value for a world point, relative to the leaf's own rotated center. */
function leafLocalUV(
  x: number,
  y: number,
  cx: number,
  cy: number,
  leaf: ClusterLeaf,
): { u: number; v: number } {
  const lx = x - (cx + leaf.dx);
  const ly = y - (cy + leaf.dy);
  const c = Math.cos(leaf.rot ?? 0);
  const s = Math.sin(leaf.rot ?? 0);
  return { u: lx * c + ly * s, v: -lx * s + ly * c };
}

function leafInside(x: number, y: number, cx: number, cy: number, leaf: ClusterLeaf): boolean {
  const { u, v } = leafLocalUV(x, y, cx, cy, leaf);
  const nu = u / leaf.rx;
  const nv = v / leaf.ry;
  return nu * nu + nv * nv <= 1;
}

/**
 * One lobe's [lo,hi] world-x span at a fixed world y — solved analytically
 * (a quadratic in the local x-offset, from substituting the rotated
 * ellipse equation), not scanned, the same closed-form knifecraft.html's
 * `lobeSpan()` uses. Returns null if this y misses the lobe entirely.
 */
function leafSpanX(
  y: number,
  cx: number,
  cy: number,
  leaf: ClusterLeaf,
): { lo: number; hi: number } | null {
  const ox = cx + leaf.dx;
  const oy = cy + leaf.dy;
  const ly = y - oy;
  const c = Math.cos(leaf.rot ?? 0);
  const s = Math.sin(leaf.rot ?? 0);
  const rx2 = leaf.rx * leaf.rx;
  const ry2 = leaf.ry * leaf.ry;
  const A = (c * c) / rx2 + (s * s) / ry2;
  const B = 2 * ly * c * s * (1 / rx2 - 1 / ry2);
  const C = (ly * ly * s * s) / rx2 + (ly * ly * c * c) / ry2 - 1;
  const disc = B * B - 4 * A * C;
  if (disc < 0 || A === 0) return null;
  const sq = Math.sqrt(disc);
  const lx1 = (-B - sq) / (2 * A);
  const lx2 = (-B + sq) / (2 * A);
  return { lo: ox + Math.min(lx1, lx2), hi: ox + Math.max(lx1, lx2) };
}

/**
 * A lobe's own axis-aligned bounding half-extents (world px, relative to
 * its own center) — the standard rotated-ellipse bbox formula.
 */
function leafBoundingHalfExtents(leaf: ClusterLeaf): { hw: number; hh: number } {
  const c = Math.cos(leaf.rot ?? 0);
  const s = Math.sin(leaf.rot ?? 0);
  return {
    hw: Math.sqrt((leaf.rx * c) ** 2 + (leaf.ry * s) ** 2),
    hh: Math.sqrt((leaf.rx * s) ** 2 + (leaf.ry * c) ** 2),
  };
}

/**
 * Derives the cluster's own symmetric rx/ry bound from its leaf list —
 * ported from knifecraft.html's `fitCluster()`: NEVER hand-write these,
 * they feed the sprite/texture canvas size and the tap-validity box, so a
 * stale value clips the art or leaves a dead zone. Editing a leaf can
 * never leave rx/ry stale because they're recomputed from the leaves
 * every time this is called.
 */
/**
 * Scales a leaf list's dx/dy/rx/ry by a uniform factor — rot/stem are
 * untouched (an angle and a boolean don't scale). Every `*_LEAVES` array
 * in definitions.ts is authored in the same 540-wide reference-canvas
 * units every other `*_GEOMETRY` constant already uses (confirmed by
 * TOMATO_GEOMETRY's own doc comment); PreparationScene calls this with
 * `scale = canvasWidth / 540`, the exact same conversion `RX_FRAC * w`
 * already performs for ellipse/taper ingredients — just applied to a
 * whole leaf list at once instead of a single rx/ry pair.
 */
export function scaleClusterLeaves(leaves: ClusterLeaf[], scale: number): ClusterLeaf[] {
  return leaves.map((l) => ({
    dx: l.dx * scale,
    dy: l.dy * scale,
    rx: l.rx * scale,
    ry: l.ry * scale,
    ...(l.rot !== undefined ? { rot: l.rot } : {}),
    ...(l.stem ? { stem: true } : {}),
  }));
}

export function fitClusterBounds(leaves: ClusterLeaf[]): { rx: number; ry: number } {
  let maxX = 0;
  let maxY = 0;
  for (const leaf of leaves) {
    const { hw, hh } = leafBoundingHalfExtents(leaf);
    maxX = Math.max(maxX, Math.abs(leaf.dx) + hw);
    maxY = Math.max(maxY, Math.abs(leaf.dy) + hh);
  }
  return { rx: maxX, ry: maxY };
}

/** Traces one leaf's outline (as a rotated ellipse, padded by `pad`) as a subpath — caller has already `beginPath()`'d; nonzero winding unions overlapping leaves into one outline. */
function traceLeafSubpath(
  ctx: CanvasPath,
  cx: number,
  cy: number,
  leaf: ClusterLeaf,
  pad: number,
): void {
  ctx.ellipse(
    cx + leaf.dx,
    cy + leaf.dy,
    leaf.rx + pad,
    leaf.ry + pad,
    leaf.rot ?? 0,
    0,
    Math.PI * 2,
  );
}

/** Traces every leaf of a cluster into an already-`beginPath()`'d context — same calling convention as traceEllipsePath/traceOrganicPath/tracePolygonPath. Uses nonzero winding (the default), so overlapping leaves union into one silhouette rather than fighting each other. */
export function traceClusterPath(
  ctx: CanvasPath,
  cx: number,
  cy: number,
  leaves: ClusterLeaf[],
  pad: number,
): void {
  for (const leaf of leaves) traceLeafSubpath(ctx, cx, cy, leaf, pad);
}

/**
 * Builds a cluster `Silhouette` — same five-function contract as ellipse/
 * taper/organic/polygon, so CutGeometry/PreparationScene need no cluster-
 * specific branch anywhere: `inside` is true inside ANY leaf; `spanX`
 * returns the OUTER HULL across every leaf that has a span at this row
 * (the real per-leaf gaps are handled by CutGeometry.regionGeom/pieceBounds
 * checking `inside()` alongside `spanX`, not by this function returning
 * anything more than a hull — see that file's own doc for why that split
 * is correct and not a compromise: seams/ghost-line/replay are stroked
 * inside the per-piece clip, so the clip trims them to the leaves
 * automatically). `support` takes the conservative numeric-scan form
 * `makeTaperSilhouette`/`makePolygonSilhouette` already use in this file,
 * projecting every leaf's boundary samples rather than solving a closed
 * form for the whole bunch.
 */
export function makeClusterSilhouette(cx: number, cy: number, leaves: ClusterLeaf[]): Silhouette {
  const { rx, ry } = fitClusterBounds(leaves);
  return {
    cx,
    cy,
    rx,
    ry,
    inside(x, y) {
      for (const leaf of leaves) {
        if (leafInside(x, y, cx, cy, leaf)) return true;
      }
      return false;
    },
    spanX(y) {
      let lo: number | null = null;
      let hi: number | null = null;
      for (const leaf of leaves) {
        const sp = leafSpanX(y, cx, cy, leaf);
        if (!sp) continue;
        if (lo == null || sp.lo < lo) lo = sp.lo;
        if (hi == null || sp.hi > hi) hi = sp.hi;
      }
      return lo == null ? null : { lo, hi: hi! };
    },
    support(nx, ny) {
      let lo = 0;
      let hi = 0;
      const N = 48;
      for (const leaf of leaves) {
        for (let i = 0; i < N; i++) {
          const t = (i / N) * Math.PI * 2;
          // A point on the leaf's own rotated-ellipse boundary, in world space.
          const c = Math.cos(leaf.rot ?? 0);
          const s = Math.sin(leaf.rot ?? 0);
          const ex = leaf.rx * Math.cos(t);
          const ey = leaf.ry * Math.sin(t);
          const wx = leaf.dx + ex * c - ey * s;
          const wy = leaf.dy + ex * s + ey * c;
          const p = wx * nx + wy * ny;
          if (p < lo) lo = p;
          if (p > hi) hi = p;
        }
      }
      return Math.min(-lo, hi);
    },
  };
}

/**
 * Phase 18 (corrected) — a taper's optional curve/bow, ported directly
 * from knifecraft.html's own `taperH`/`taperY`. `taperCurve` (default 1)
 * bends the radius sweep: 1 is the original LINEAR carrot and is an exact
 * identity (`rSmall+(rBig-rSmall)*(1-t)` === the old formula), so no
 * existing ingredient moves; below 1 the fat end holds longer then
 * narrows fast — the bulb profile Avocado/Eggplant/Pear/Mango/
 * SweetPotato/PeaPod/Corn/Celery/Mozzarella/Radish/Beetroot actually use,
 * which a plain linear sweep can only ever render as a cone. `spine`
 * (default 0) bows the centreline with both ends still on the axis — an
 * eggplant is not a straight vegetable — normalised against `spineRx`
 * (the PARENT's un-inset half-length) rather than the taper's own `rx`,
 * exactly as the source requires, so an inner/inset copy shares the same
 * centreline as its own outer skin.
 */
export type TaperCurveOpts = { taperCurve?: number; spine?: number; spineRx?: number };

/** knifecraft.html taperH(): half-height of the taper at x — a rounded crown easing to a rounded tip. */
function taperH(
  x: number,
  cx: number,
  rx: number,
  rBig: number,
  rSmall: number,
  buttRound: number,
  tipRound: number,
  taperCurve: number,
): number {
  const x0 = cx - rx;
  const x1 = cx + rx;
  if (x < x0 || x > x1) return 0;
  const t = (x - x0) / (2 * rx);
  const base = rSmall + (rBig - rSmall) * Math.pow(1 - t, taperCurve);
  const capL = rBig * buttRound;
  const capR = rSmall * tipRound;
  if (x < x0 + capL) {
    const k = (x0 + capL - x) / capL;
    return base * Math.sqrt(Math.max(0, 1 - k * k));
  }
  if (x > x1 - capR) {
    const k = (x - (x1 - capR)) / capR;
    return base * Math.sqrt(Math.max(0, 1 - k * k));
  }
  return base;
}

/** knifecraft.html taperY(): the taper's own centreline — `cy` unbowed (spine=0, bit-identical to every pre-existing straight taper), else bowed by `spine` px at the midpoint, both ends still on the axis. */
function taperY(x: number, cx: number, cy: number, spine: number, spineRx: number): number {
  if (!spine) return cy;
  const t = Math.max(0, Math.min(1, (x - (cx - spineRx)) / (2 * spineRx)));
  return cy - spine * Math.sin(Math.PI * t);
}

export function makeTaperSilhouette(
  cx: number,
  cy: number,
  rx: number,
  rBig: number,
  rSmall: number,
  buttRound: number,
  tipRound: number,
  opts: TaperCurveOpts = {},
): Silhouette {
  const taperCurve = opts.taperCurve ?? 1;
  const spine = opts.spine ?? 0;
  const spineRx = opts.spineRx ?? rx;
  const h = (x: number) => taperH(x, cx, rx, rBig, rSmall, buttRound, tipRound, taperCurve);
  const yc = (x: number) => taperY(x, cx, cy, spine, spineRx);
  return {
    cx,
    cy,
    rx,
    // `spine` bows the centreline up by up to `spine` px, so a bowed
    // taper's real vertical half-extent is larger than `rBig`. `inside`/
    // `spanX` already track the bow via `yc(x)`; this keeps the summary
    // `ry` (which pieceBounds / the piece-canvas sizer read as the true
    // extent) honest too, so a bowed pod/eggplant's arched top isn't
    // sliced off by a too-small piece canvas. A straight taper (spine 0)
    // is unchanged.
    ry: rBig + Math.abs(spine),
    inside(x, y) {
      const hh = h(x);
      return hh > 0 && Math.abs(y - yc(x)) <= hh;
    },
    spanX(y) {
      const N = 80;
      const x0 = cx - rx;
      const step = (2 * rx) / N;
      let lo: number | null = null;
      let hi: number | null = null;
      for (let i = 0; i <= N; i++) {
        const x = x0 + step * i;
        const hh = h(x);
        if (hh > 0 && Math.abs(y - yc(x)) <= hh) {
          if (lo == null) lo = x;
          hi = x;
        }
      }
      return lo == null ? null : { lo, hi: hi! };
    },
    // Not symmetric along its length — scan the outline and keep the smaller
    // reach, so an angled julienne set stays inside the food at both ends
    // instead of placing cuts past the tip that would split nothing.
    support(nx, ny) {
      let lo = 0;
      let hi = 0;
      const N = 72;
      for (let i = 0; i <= N; i++) {
        const x = cx - rx + (2 * rx * i) / N;
        const hh = h(x);
        if (hh <= 0) continue;
        const cyx = yc(x);
        for (const y of [cyx - hh, cyx + hh]) {
          const p = (x - cx) * nx + (y - cy) * ny;
          if (p < lo) lo = p;
          if (p > hi) hi = p;
        }
      }
      return Math.min(-lo, hi);
    },
  };
}

// ---------- polygon: an explicit vertex silhouette ----------

/** A point in an ingredient's own LOCAL design space — origin at the ingredient's own center, unscaled (multiplied by a per-ingredient `scale` to reach world px). */
export type LocalPoint = { x: number; y: number };

/**
 * The center of a local-space polygon's own bounding box — NOT
 * necessarily (0,0). The ported reference shapes each pick their own
 * local origin for the math that generates them (e.g. strawberry's `v`
 * parameterization runs TOP=-58 to BOTTOM=86, a bbox centered ~14 units
 * below y=0), so anchoring world placement directly at local (0,0) would
 * silently offset the shape from the ingredient's actual world center —
 * exactly the class of asymmetric-reach dead-zone bug `reachX`/`reachY`
 * exists to prevent. `makePolygonSilhouette`/`tracePolygonPath` both
 * recenter on this instead. Texture paint code (see src/game/shapes/*.ts
 * consumers) must apply the SAME offset to every point array it draws
 * (main outline and any named sub-region/scatter arrays alike) so the
 * painted texture and the real collision silhouette never diverge.
 */
export function polygonBoundsCenter(localPts: LocalPoint[]): LocalPoint {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of localPts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

/**
 * A silhouette built from an explicit closed polygon in local design-
 * space — for ingredients whose real outline genuinely isn't a
 * single-center radius function (a mushroom's cap+stem, a lobed pepper's
 * hanging base, a heart-tapered strawberry's scalloped crown). Ported
 * ingredient art supplies the polygon directly (see src/game/shapes/) —
 * this factory only needs to turn it into the same `Silhouette` contract
 * CutGeometry.ts already consumes generically, exactly like the ellipse/
 * taper/organic factories above. `reachX`/`reachY` are set from the
 * polygon's own true bounding box (exact, unlike an organic profile's
 * amplitude), so there's no dead-zone risk to guard against here — as
 * long as the polygon is recentered on its own bbox first (see
 * `polygonBoundsCenter`'s own doc for why that step is required).
 */
export function makePolygonSilhouette(
  cx: number,
  cy: number,
  scale: number,
  localPts: LocalPoint[],
): Silhouette {
  const origin = polygonBoundsCenter(localPts);
  const world = localPts.map((p) => ({
    x: cx + (p.x - origin.x) * scale,
    y: cy + (p.y - origin.y) * scale,
  }));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of world) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const rx = (maxX - minX) / 2;
  const ry = (maxY - minY) / 2;
  const insideAt = (x: number, y: number): boolean => {
    // Standard ray-casting point-in-polygon test.
    let inside = false;
    for (let i = 0, j = world.length - 1; i < world.length; j = i++) {
      const pi = world[i]!;
      const pj = world[j]!;
      const crosses = pi.y > y !== pj.y > y;
      if (crosses) {
        const xAt = ((pj.x - pi.x) * (y - pi.y)) / (pj.y - pi.y) + pi.x;
        if (x < xAt) inside = !inside;
      }
    }
    return inside;
  };
  return {
    cx,
    cy,
    rx,
    ry,
    reachX: rx,
    reachY: ry,
    inside: insideAt,
    // Scanline: every edge crossing at this y, kept as [min,max] — the
    // same "outer bound, not a guarantee of a single interval" convention
    // makeOrganicSilhouette's own spanX already documents; every ported
    // shape here is star-shaped enough in practice for this to be exact.
    spanX(y) {
      const xs: number[] = [];
      for (let i = 0, j = world.length - 1; i < world.length; j = i++) {
        const pi = world[i]!;
        const pj = world[j]!;
        if (pi.y > y !== pj.y > y) {
          xs.push(((pj.x - pi.x) * (y - pi.y)) / (pj.y - pi.y) + pi.x);
        }
      }
      if (xs.length === 0) return null;
      return { lo: Math.min(...xs), hi: Math.max(...xs) };
    },
    // Same conservative "smaller of the two sides" convention the taper/
    // organic factories use — project every vertex onto (nx,ny).
    support(nx, ny) {
      let lo = 0;
      let hi = 0;
      for (const p of world) {
        const proj = (p.x - cx) * nx + (p.y - cy) * ny;
        if (proj < lo) lo = proj;
        if (proj > hi) hi = proj;
      }
      return Math.min(-lo, hi);
    },
  };
}

/** Traces the polygon outline into an already-`beginPath()`'d context — world coords, same calling convention as traceEllipsePath/traceOrganicPath. `pad` nudges each vertex outward along its own direction from the LOCAL origin (already close to each ported shape's own visual centroid) — approximate, but the pads used here are only a couple of px (a piece-clip inset, a rim stroke), so it doesn't need to be exact. */
export function tracePolygonPath(
  ctx: CanvasPath,
  cx: number,
  cy: number,
  scale: number,
  localPts: LocalPoint[],
  pad: number,
): void {
  const origin = polygonBoundsCenter(localPts);
  for (let i = 0; i < localPts.length; i++) {
    const p = localPts[i]!;
    const ox = p.x - origin.x;
    const oy = p.y - origin.y;
    const len = Math.hypot(ox, oy) || 1;
    const wx = cx + ox * scale + (ox / len) * pad;
    const wy = cy + oy * scale + (oy / len) * pad;
    if (i === 0) ctx.moveTo(wx, wy);
    else ctx.lineTo(wx, wy);
  }
  ctx.closePath();
}

/**
 * Shared texture-canvas sizing for every "polygon" ingredient — computes
 * the polygon's own local-space bounding box, scales it, and pads by
 * `margin`, the same (rx+margin)*2 x (ry+margin)*2 convention every
 * ellipse/taper *TextureSize function already uses (so `redrawIngredient
 * Texture`'s existing `ingredientSourceOriginWorld = {cx - w/2, cy - h/2}`
 * math keeps working unmodified). Each polygon texture file calls this
 * directly instead of duplicating the bbox scan.
 */
export function polygonTextureSize(
  localPts: LocalPoint[],
  scale: number,
  margin: number,
): { w: number; h: number; rx: number; ry: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of localPts) {
    const x = p.x * scale;
    const y = p.y * scale;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const rx = (maxX - minX) / 2;
  const ry = (maxY - minY) / 2;
  return { w: (rx + margin) * 2, h: (ry + margin) * 2, rx, ry };
}

// ---------- block: a rectangular box in oblique projection (real 6-corner geometry) ----------

/**
 * Ported directly from knifecraft.html's actual `SILS.block` — NOT the
 * flat trapezoid this file shipped originally (which matched the source's
 * own superseded/dead `SILS.wedge`, confirmed unused by any ingredient:
 * `grep shape:'wedge'` returns zero hits in the source, `shape:'block'`
 * returns exactly three — Cheddar, Butter, Tofu). The real block is a
 * proper oblique/isometric box: six corners forming the front face plus
 * the receding top and right planes that make it read as a solid rather
 * than a flat card, `depthX`/`depthY` the receding edge (0,0 degenerates
 * to a plain rectangle). `rx` is the half-width of the WHOLE silhouette,
 * depth included — the contract every other shape keeps.
 */
export function blockCorners(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  depthX: number,
  depthY: number,
): [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] {
  const x0 = cx - rx;
  const x1 = cx + rx - depthX;
  const yT = cy - ry;
  const yB = cy + ry;
  return [
    [x0, yT + depthY],
    [x0 + depthX, yT],
    [x1 + depthX, yT],
    [x1 + depthX, yB - depthY],
    [x1, yB],
    [x0, yB],
  ];
}

export function makeBlockSilhouette(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  depthX: number,
  depthY: number,
): Silhouette {
  const pts = () => blockCorners(cx, cy, rx, ry, depthX, depthY);
  return {
    cx,
    cy,
    rx,
    ry,
    inside(x, y) {
      const P = pts();
      let pos = 0;
      let neg = 0;
      for (let i = 0; i < P.length; i++) {
        const a = P[i]!;
        const b = P[(i + 1) % P.length]!;
        const c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
        if (c > 1e-9) pos++;
        else if (c < -1e-9) neg++;
      }
      return !(pos && neg); // convex: interior sees every edge the same way
    },
    spanX(y) {
      const P = pts();
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < P.length; i++) {
        const a = P[i]!;
        const b = P[(i + 1) % P.length]!;
        if ((a[1] - y) * (b[1] - y) > 1e-9) continue;
        if (Math.abs(b[1] - a[1]) < 1e-9) {
          lo = Math.min(lo, a[0], b[0]);
          hi = Math.max(hi, a[0], b[0]);
          continue;
        }
        const x = a[0] + (b[0] - a[0]) * ((y - a[1]) / (b[1] - a[1]));
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
      return lo > hi ? null : { lo, hi };
    },
    support(nx, ny) {
      let lo = 0;
      let hi = 0;
      for (const [x, y] of pts()) {
        const p = (x - cx) * nx + (y - cy) * ny;
        if (p < lo) lo = p;
        if (p > hi) hi = p;
      }
      return Math.min(-lo, hi);
    },
  };
}

/**
 * Traces the block outline (padded by `pad`) into an already-`beginPath()`'d
 * context — ported directly from `SILS.block.trace`: each corner is
 * nudged outward along its own direction from the polygon's centroid (not
 * a per-edge normal), then rounded with a small (r=4 at reference scale)
 * quadratic corner so it reads as a knife-cut block, not a paper cutout.
 */
export function traceBlockPath(
  ctx: CanvasPath,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  depthX: number,
  depthY: number,
  pad: number,
  corner = 4,
): void {
  const P = blockCorners(cx, cy, rx, ry, depthX, depthY);
  const mx = P.reduce((s, q) => s + q[0], 0) / P.length;
  const my = P.reduce((s, q) => s + q[1], 0) / P.length;
  const Q: [number, number][] = P.map(([x, y]) => {
    const dx = x - mx;
    const dy = y - my;
    const m = Math.hypot(dx, dy) || 1;
    return [x + (dx / m) * pad, y + (dy / m) * pad];
  });
  const n = Q.length;
  for (let i = 0; i < n; i++) {
    const a = Q[i]!;
    const b = Q[(i + 1) % n]!;
    const c = Q[(i + 2) % n]!;
    const v1x = a[0] - b[0];
    const v1y = a[1] - b[1];
    const v2x = c[0] - b[0];
    const v2y = c[1] - b[1];
    const n1 = Math.hypot(v1x, v1y) || 1;
    const n2 = Math.hypot(v2x, v2y) || 1;
    const k1 = Math.min(corner, n1 / 2);
    const k2 = Math.min(corner, n2 / 2);
    if (i === 0) ctx.moveTo(b[0] + (v1x / n1) * k1, b[1] + (v1y / n1) * k1);
    else ctx.lineTo(b[0] + (v1x / n1) * k1, b[1] + (v1y / n1) * k1);
    ctx.quadraticCurveTo(b[0], b[1], b[0] + (v2x / n2) * k2, b[1] + (v2y / n2) * k2);
  }
  ctx.closePath();
}

// ---------- fillet: two independent rails (chicken/steak/salmon only) ----------

/**
 * FILLET — ported verbatim from knifecraft.html's `SILS.fillet`
 * (source `fillet:{...}` object, plus its free-standing `FILLET`
 * defaults/`filletRails()`/`filletP()` helpers). The one silhouette
 * family every other production shape family can't be pressed into:
 * ellipse, capsule, taper, cluster and block are all mirror-symmetric
 * about their long axis, and a raw protein fillet (chicken breast,
 * ribeye, salmon side) is not — one shoulder domes, the other sags and
 * leans out to a blunt tip. `fillet` authors that as TWO INDEPENDENT
 * RAILS over one normalized length parameter `s` (0 = broad shoulder,
 * 1 = blunt tip), so the asymmetry is real geometry: `inside`, `spanX`,
 * `support` and the traced outline all read the same two rails, and the
 * painted shape can never disagree with the interaction shape.
 *
 * Used ONLY by chicken/steak/salmon — no existing production ingredient
 * changes shape family. See `CHICKEN_GEOMETRY`/`STEAK_GEOMETRY`/
 * `SALMON_GEOMETRY` in definitions.ts for the three per-protein rail
 * tunings (bias/full/bow/tilt/topFull/botFull/wob).
 */
export type FilletOpts = {
  bias?: number;
  full?: number;
  bow?: number;
  tilt?: number;
  topFull?: number;
  botFull?: number;
  wob?: number;
};

/** Ported verbatim from the source's `const FILLET` defaults. */
const FILLET_DEFAULTS: Required<FilletOpts> = {
  bias: 0.6,
  full: 0.62,
  bow: 0.13,
  tilt: 0.26,
  topFull: 0.16,
  botFull: 0.12,
  wob: 0.045,
};

function filletClamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Ported verbatim from the source's `filletRails(P,s)` — the pair of
 * normalized rail offsets (top, bottom) at length-fraction `s`. `bias`
 * puts the widest point ahead of centre, `full` how squarely the body
 * holds that width before it runs out, `bow` the belly sag, `tilt` the
 * lean that lifts the tip above the shoulder, top/botFull the two
 * rails' independent fullness, `wob` a low-frequency irregularity so no
 * part of the perimeter is a clean conic. Both ends approach zero
 * thickness like `(1-s)^full` with an infinite slope — blunt and
 * rounded, never a mathematical point.
 */
function filletRails(P: Required<FilletOpts>, s: number): [number, number] {
  const e =
    Math.pow(Math.sin(Math.PI * Math.pow(s, P.bias)), P.full) *
    (1 + P.wob * Math.sin(4.1 * Math.PI * s + 1.35));
  const m = P.bow * Math.sin(Math.PI * Math.pow(s, 0.85)) - P.tilt * (s - 0.5);
  return [
    m - e * (1 + P.topFull * Math.cos(Math.PI * s)),
    m + e * (1 - P.botFull * Math.cos(Math.PI * s)),
  ];
}

/**
 * Ported verbatim from the source's `filletP(g)` — scans `filletRails`
 * over s in [0,1] to find the true max |rail| and returns its
 * reciprocal, so a caller can normalize the rails to EXACTLY ±1 (then
 * scale by `ry`). The source caches this per-geometry object; here it's
 * just returned to the caller once per silhouette construction, which
 * is equally once-per-ingredient-paint since `makeFilletSilhouette`
 * itself is only called from `layout()`.
 */
function filletFit(P: Required<FilletOpts>): number {
  let m = 0;
  for (let i = 0; i <= 400; i++) {
    const r = filletRails(P, i / 400);
    m = Math.max(m, Math.abs(r[0]), Math.abs(r[1]));
  }
  return m > 0 ? 1 / m : 1;
}

function filletResolveOpts(opts: FilletOpts): Required<FilletOpts> {
  return { ...FILLET_DEFAULTS, ...opts };
}

/** Traces the fillet outline (padded by `pad`, along each rail's own outward normal — never a naive y-offset, which would grow horns where the two rails meet at the blunt ends) into an already-`beginPath()`'d context — world coords. Ported verbatim from the source's `fillet.trace(p,g,pad)`. */
export function traceFilletPath(
  ctx: CanvasPath,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  pad: number,
  opts: FilletOpts = {},
): void {
  const P = filletResolveOpts(opts);
  const fit = filletFit(P);
  const N = 112;
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const r = filletRails(P, s);
    const x = cx - rx + 2 * rx * s;
    pts.push([x, cy + r[0] * fit * ry, cy + r[1] * fit * ry]);
  }
  const off = (i: number, top: boolean): [number, number] => {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(N, i + 1)]!;
    const q = pts[i]!;
    const j = top ? 1 : 2;
    let tx = b[0] - a[0];
    let ty = b[j] - a[j];
    const m = Math.hypot(tx, ty) || 1;
    tx /= m;
    ty /= m;
    const nx = top ? ty : -ty;
    const ny = top ? -tx : tx;
    return [q[0] + nx * pad, q[j] + ny * pad];
  };
  for (let i = 0; i <= N; i++) {
    const q = off(i, true);
    if (i === 0) ctx.moveTo(q[0], q[1]);
    else ctx.lineTo(q[0], q[1]);
  }
  for (let i = N; i >= 0; i--) {
    const q = off(i, false);
    ctx.lineTo(q[0], q[1]);
  }
  ctx.closePath();
}

/** Ported verbatim from the source's `SILS.fillet` (`inside`/`spanX`/`spanY`/`support`, `sAt`/`xAt`/`rails` folded in as closures) — see this section's own header doc. `ry` is set to the exact true half-extent: `filletFit` normalizes the rails to precisely ±1 before the `ry` scale, so (unlike a bowed taper) no separate `reachY` is needed here. */
export function makeFilletSilhouette(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  opts: FilletOpts = {},
): Silhouette {
  const P = filletResolveOpts(opts);
  const fit = filletFit(P);
  const sAt = (x: number) => (x - (cx - rx)) / (2 * rx);
  const xAt = (s: number) => cx - rx + 2 * rx * s;
  const railsAt = (s: number): [number, number] => {
    const r = filletRails(P, filletClamp01(s));
    return [cy + r[0] * fit * ry, cy + r[1] * fit * ry];
  };
  return {
    cx,
    cy,
    rx,
    ry,
    inside(x, y) {
      const s = sAt(x);
      if (s < 0 || s > 1) return false;
      const [lo, hi] = railsAt(s);
      return hi > lo && y >= lo && y <= hi;
    },
    // Scanned, not solved: the rails are not symmetric, so the x-extent
    // at a height has no closed form (same reasoning as taper's spanX).
    spanX(y) {
      const N = 144;
      let lo: number | null = null;
      let hi: number | null = null;
      for (let i = 0; i <= N; i++) {
        const s = i / N;
        const [rLo, rHi] = railsAt(s);
        if (rHi > rLo && y >= rLo && y <= rHi) {
          const x = xAt(s);
          if (lo == null) lo = x;
          hi = x;
        }
      }
      return lo == null ? null : { lo, hi: hi! };
    },
    // Conservative like taper and cluster: keep the SMALLER reach, so an
    // angled cut set stays inside the body at both ends instead of
    // placing cuts past the tip that would split nothing.
    support(nx, ny) {
      const N = 160;
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i <= N; i++) {
        const s = i / N;
        const x = xAt(s);
        const [rLo, rHi] = railsAt(s);
        for (const y of [rLo, rHi]) {
          const d = (x - cx) * nx + (y - cy) * ny;
          if (d < lo) lo = d;
          if (d > hi) hi = d;
        }
      }
      return Math.min(-lo, hi);
    },
  };
}

/**
 * Ported from the source's `PAINT._railAt(g,s,v)` — the one primitive
 * every protein painter (and its own `_region`/`_thread` helpers, see
 * textures/proteinPaintHelpers.ts) builds on: a rail-space point `(s,v)`
 * (`s` along the length, `v` from the top rail at 0 to the bottom rail
 * at 1) mapped to a canvas-space `[x,y]`. Returned as a closure so the
 * (identical-every-call) `fit` normalization is computed once per paint
 * call, not once per point — a single protein paint calls this hundreds
 * of times.
 */
export function makeFilletRailAt(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  opts: FilletOpts = {},
): (s: number, v: number) => [number, number] {
  const P = filletResolveOpts(opts);
  const fit = filletFit(P);
  return (s, v) => {
    const ss = filletClamp01(s);
    const r = filletRails(P, ss);
    const lo = cy + r[0] * fit * ry;
    const hi = cy + r[1] * fit * ry;
    return [cx - rx + 2 * rx * ss, lo + (hi - lo) * v];
  };
}
