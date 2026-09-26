/**
 * PLATING_ARRANGEMENT — pure, deterministic per-piece layout math for the
 * plating redesign. Consumed by PreparationScene.startPlating(), which owns
 * everything about WHERE a plate sits and HOW pieces fly there.
 *
 * Distribution/composition fix (task: "plating distribution / composition
 * fix" — the previous containment-only pass kept every piece safely on the
 * plate, but did it by shrinking the whole group's REACH around a single
 * worst-case piece, which read as a small huddle in one spot rather than a
 * plated portion). Containment and distribution are now two separate
 * concerns, computed in this order (PreparationScene.startPlating() runs
 * this per group):
 *
 * 1. `getPlatingArrangement()` — a BROAD, technique- and count-aware raw
 *    layout, in "piece-radius units" (1.0 unit == that group's own AVERAGE
 *    piece bounding radius — see pieceBoundingRadius). Using the average
 *    rather than the largest piece is what stops one oversized piece from
 *    collapsing everyone else's spacing: a grid/fan naturally gets WIDER
 *    as piece count grows (more grid cells, wider fan angle coverage), and
 *    scales with how big pieces actually typically are in that group.
 *
 * 2. `calculateCompositionBounds()` — converts those raw per-piece
 *    positions (already in real pixels — the caller multiplies by the
 *    group's average radius) plus each piece's OWN real bounding radius
 *    into the composition's true visual center and the radius of the
 *    smallest circle, centered there, that contains every piece. This is
 *    the "calculate the bounding box of ALL arranged pieces" step —
 *    necessary because raw jittered/irregular layouts (rockMince, smash)
 *    are not perfectly symmetric around the origin, so the origin is not
 *    automatically the visual center.
 *
 * 3. `fitCompositionToSafeRadius()` — if that required radius is bigger
 *    than the plate's own safe radius, returns a single uniform scale
 *    factor (<=1) that tightens the whole ARRANGEMENT's spacing/overlap
 *    (controlled overlap between pieces) down to fit. Most groups never
 *    need this at all — it only engages when the broad composition
 *    genuinely doesn't fit.
 *
 *    Task: "food scale + multi-instance preparation bug" (§A) — an earlier
 *    revision of this pipeline multiplied this SAME fitScale into every
 *    piece's own rendered scale too (contradicting this doc's own "not any
 *    individual piece's own size" contract above), which visibly shrank
 *    every plated piece well below its actual prepared-board size any time
 *    a realistic multi-piece composition didn't fit the plate's safe
 *    radius at full scale — the common case, not a rare edge case, once
 *    positions/radii were both expressed in real pixels. `fitScale` now
 *    ONLY ever multiplies POSITION (PreparationScene's flight-target
 *    calculation) — never a piece's `setScale`.
 *
 * 4. `computeFoodSafeRadius`/`computeCenterReach`/`computeExtraShrink` —
 *    kept exactly as the earlier containment pass, applied PER PIECE
 *    (keyed on that one piece's own real bounding radius, never the
 *    group's), and now actually wired into PreparationScene's real
 *    pipeline (previously only exercised by this module's own QA). Full
 *    containment is guaranteed by PreparationScene's final per-piece
 *    POSITION pull (using each piece's real, only-rarely-shrunk render
 *    radius) — `computeExtraShrink` itself only trims a piece's own scale
 *    in the genuinely-impossible case where that ONE piece's bounding
 *    radius alone already exceeds the plate's safe radius (e.g. one huge
 *    Halve/steak wedge on a modest plate) — the "last-resort safety net"
 *    this was always meant to be, now actually acting like one.
 *
 * Deterministic only: every offset comes from `jitter()`, a sine-hash
 * salted by piece index and a caller-supplied seed — never Math.random().
 * The same (technique, index, count, seed) always returns the same raw
 * transform, and the same (plate size, piece sizes) always returns the
 * same composition/fit/reach/shrink.
 */
import type { TechniqueId } from "../definitions";

export type PlatingTransform = {
  /** "Piece-radius units" — the caller multiplies by the group's own average piece bounding radius to get real pixels (see calculateCompositionBounds). NOT normalized to [-1,1] — a bigger, more spread-out technique/piece-count naturally returns a bigger magnitude here, on purpose. */
  xFrac: number;
  yFrac: number;
  /** Degrees, added to the piece's own settle rotation blend exactly like the old flat fan did. */
  rotationDeg: number;
  /** Multiplier on top of the caller's existing per-plate settleScale (piece-count based) and computeExtraShrink. */
  scale: number;
};

/** Of the plate's own min(rx,ry) — how far out a piece's rendered edge may ever reach. Leaves a visible ceramic margin outside it (drawPlateShape's own rim sits at 1.0); §"55-70% of usable plate area" of the brief translates to roughly this fraction of the RADIUS once the decorative rim band is excluded. */
export const FOOD_SAFE_FRAC = 0.66;
/**
 * A piece's own bounding-circle radius is never allowed to EXCEED this
 * fraction of the safe radius — past this point computeExtraShrink scales
 * the piece DOWN (plating-only, never touches its real cutting-board size)
 * rather than letting it dominate the whole plate. Because
 * computeCenterReach subtracts this SAME capped ("effective") radius, a
 * huge single piece (e.g. one Halve) is guaranteed at least
 * `safeRadius * (1 - MAX_PIECE_FRAC_OF_SAFE)` of reach.
 */
const MAX_PIECE_FRAC_OF_SAFE = 0.9;

function jitter(i: number, salt: number): number {
  const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1; // [-1, 1]
}

function gridCell(
  i: number,
  count: number,
): { col: number; row: number; cols: number; rows: number } {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / cols));
  return { col: i % cols, row: Math.floor(i / cols), cols, rows };
}

/**
 * How much a technique's own layout should widen as piece count grows —
 * shared by every technique below rather than hand-tuned per case, so
 * "more pieces -> broader composition" (the brief's §11) is one formula,
 * not eleven. sqrt growth: a 12-piece serving spreads noticeably more than
 * a 2-piece one, but doubling again (24) doesn't double the footprint
 * again — real plated food densifies, it doesn't just keep sprawling.
 */
function countSpread(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, 0.55 + 0.4 * Math.sqrt(Math.max(1, n))));
}

export function getPlatingArrangement(opts: {
  technique: TechniqueId;
  index: number;
  count: number;
  /** Stable per-plate salt (e.g. a small hash of the ingredient id) so two different ingredients' plates don't jitter in lockstep. */
  seed: number;
}): PlatingTransform {
  const { technique, index: i, count: n, seed: s } = opts;
  switch (technique) {
    // Fan/ring compositions — already a good restaurant-garnish overlap
    // (the brief's own §10 says preserve it), just now widening with
    // count like every other technique instead of a flat radius.
    case "slice":
    case "rings":
    case "radial": {
      const spread = countSpread(n, 0.85, 1.9);
      const twoRings = n > 7;
      const ring = twoRings && i % 2 === 1 ? 1 : 0;
      const ringCount = twoRings ? Math.ceil(n / 2) : n;
      const ringIndex = twoRings ? Math.floor(i / 2) : i;
      const angle = (ringIndex / Math.max(1, ringCount)) * Math.PI * 2 + jitter(i, s + 1) * 0.16;
      const radius = (ring === 0 ? 1.05 : 0.55) * spread + jitter(i, s + 2) * 0.14;
      return {
        xFrac: Math.cos(angle) * radius,
        yFrac: Math.sin(angle) * radius,
        rotationDeg: (angle * 180) / Math.PI + jitter(i, s + 3) * 10,
        scale: 1 + jitter(i, s + 4) * 0.04,
      };
    }
    // Individual visible pieces distributed around the plate, cut faces up.
    case "halve": {
      const spread = countSpread(n, 0.75, 1.6);
      const angle = (i / Math.max(1, n)) * Math.PI * 2 + jitter(i, s + 1) * 0.12;
      const radius = 0.95 * spread + jitter(i, s + 2) * 0.1;
      return {
        xFrac: Math.cos(angle) * radius,
        yFrac: Math.sin(angle) * radius,
        rotationDeg: jitter(i, s + 3) * 14,
        scale: 1 + jitter(i, s + 4) * 0.03,
      };
    }
    // Elongated strands nested along a wide diagonal band — the strip's
    // OWN long dimension is a per-piece containment concern (handled by
    // the caller's bounding-radius math), this only decides how far apart
    // along the band successive strips sit, which widens with count.
    case "julienne":
    case "chiffonade": {
      const spread = countSpread(n, 0.85, 2.3);
      const t = n > 1 ? i / (n - 1) - 0.5 : 0;
      return {
        xFrac: t * 1.7 * spread + jitter(i, s + 1) * 0.22,
        yFrac: jitter(i, s + 2) * 0.55,
        rotationDeg: 34 + jitter(i, s + 3) * 14,
        scale: 1 + jitter(i, s + 4) * 0.04,
      };
    }
    // A broad mound — a real grid (adaptive cols/rows, gridCell already
    // scales both with sqrt(count)), spaced in piece-radius units so it
    // naturally widens with both MORE pieces (more cells) and BIGGER
    // pieces (bigger radius unit) instead of being squeezed into one flat
    // normalized box regardless of either. Small rotation range only —
    // dice/chop/mince are a mound, never a pinwheel.
    case "chop":
    case "dice": {
      const { col, row, cols, rows } = gridCell(i, n);
      const cellSpacing = 1.7; // center-to-center, in piece-radius units — mild overlap (diameter is 2 units)
      const xFrac = (col - (cols - 1) / 2) * cellSpacing;
      const yFrac = (row - (rows - 1) / 2) * cellSpacing;
      return {
        xFrac: xFrac + jitter(i, s + 1) * 0.3,
        yFrac: yFrac + jitter(i, s + 2) * 0.3,
        rotationDeg: jitter(i, s + 3) * 18,
        scale: 1 + jitter(i, s + 4) * 0.05,
      };
    }
    // Same grid bones as dice/chop, but denser (more overlap) and with a
    // brick-course row stagger plus stronger jitter — an irregular mound,
    // not a tidy grid, still adapting cols/rows to count.
    case "rockMince": {
      const { col, row, cols, rows } = gridCell(i, n);
      const cellSpacing = 1.4;
      const stagger = row % 2 === 1 ? cellSpacing / 2 : 0;
      const xFrac = (col - (cols - 1) / 2) * cellSpacing + stagger;
      const yFrac = (row - (rows - 1) / 2) * cellSpacing;
      return {
        xFrac: xFrac + jitter(i, s + 1) * 0.4,
        yFrac: yFrac + jitter(i, s + 2) * 0.4,
        rotationDeg: jitter(i, s + 3) * 22,
        scale: 1 + jitter(i, s + 4) * 0.08,
      };
    }
    // An irregular cluster, broader than a tiny pile but still clearly
    // "smashed together" rather than a fanned-out serving.
    case "smash": {
      const spread = countSpread(n, 0.65, 1.4);
      const angle = (i / Math.max(1, n)) * Math.PI * 2 + jitter(i, s + 1) * 0.35;
      const radius = 0.95 * spread + jitter(i, s + 2) * 0.3;
      return {
        xFrac: Math.cos(angle) * radius,
        yFrac: Math.sin(angle) * radius,
        rotationDeg: jitter(i, s + 3) * 25,
        scale: 1 + jitter(i, s + 4) * 0.05,
      };
    }
    // Peel never reaches this — a chain's own final cut technique always
    // drives its plate (see PreparationScene.startPlating's grouping) — and
    // any other future/unknown id falls back to a safe compact fan rather
    // than crashing or looking broken.
    case "peel":
    default: {
      const spread = countSpread(n, 0.7, 1.5);
      const angle = n > 1 ? -Math.PI * 0.25 + (Math.PI * 0.5 * i) / (n - 1) : 0;
      return {
        xFrac: Math.sin(angle) * 0.8 * spread,
        yFrac: -Math.cos(angle) * 0.55 * spread,
        rotationDeg: (angle * 180) / Math.PI,
        scale: 1,
      };
    }
  }
}

/** A small stable hash for an ingredient id — used as `seed` above so two different ingredients' plates never jitter identically. Never Math.random(). */
export function seedFor(id: string): number {
  let h = 0;
  for (let k = 0; k < id.length; k++) h = (h * 31 + id.charCodeAt(k)) | 0;
  return h;
}

/** A piece's own rendered footprint, as the radius of the circle that bounds it AT ANY ROTATION — half its display diagonal. Deliberately rotation-invariant: a piece placed so this circle stays inside the safe radius can never poke past it no matter what `rotationDeg` it settles at, so rotation never needs its own separate containment case. */
export function pieceBoundingRadius(displayWidth: number, displayHeight: number): number {
  return Math.hypot(displayWidth, displayHeight) / 2;
}

export type CompositionPiece = { x: number; y: number; radius: number };

/**
 * Step "calculate the bounding box of ALL arranged pieces, then find its
 * center" (brief §3/§13) — pure geometry, no Phaser dependency, so it's
 * directly unit-testable. Takes each piece's already-converted-to-pixels
 * raw (x, y) position (the technique's own xFrac/yFrac * the group's
 * average piece radius, still centered on the RAW origin, not yet on
 * plate-center) plus that SAME piece's own real bounding radius, and
 * returns the true visual center of the whole group (the midpoint of its
 * tightest enclosing axis-aligned box, which handles asymmetric/irregular
 * layouts like rockMince/smash correctly, not just a symmetric grid) and
 * the radius of the smallest circle centered there that still contains
 * every piece's own circle.
 */
export function calculateCompositionBounds(pieces: CompositionPiece[]): {
  centerX: number;
  centerY: number;
  requiredRadius: number;
} {
  if (pieces.length === 0) return { centerX: 0, centerY: 0, requiredRadius: 0 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pieces) {
    minX = Math.min(minX, p.x - p.radius);
    maxX = Math.max(maxX, p.x + p.radius);
    minY = Math.min(minY, p.y - p.radius);
    maxY = Math.max(maxY, p.y + p.radius);
  }
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  let requiredRadius = 0;
  for (const p of pieces) {
    requiredRadius = Math.max(requiredRadius, Math.hypot(p.x - centerX, p.y - centerY) + p.radius);
  }
  return { centerX, centerY, requiredRadius };
}

/**
 * Step "if the composition exceeds the safe plate region, uniformly scale
 * the ARRANGEMENT inward" (brief §13 step 4) — a single multiplier applied
 * to every piece's (already-recentered) position, never to an individual
 * piece's own display scale. 1 (no scaling) whenever the broad composition
 * from calculateCompositionBounds already fits — which is the common case
 * now that composition width scales with actual piece/group size instead
 * of the previous pass's single-worst-piece reach.
 */
export function fitCompositionToSafeRadius(requiredRadius: number, safeRadius: number): number {
  if (requiredRadius <= 0 || requiredRadius <= safeRadius) return 1;
  return safeRadius / requiredRadius;
}

/** The plate-relative, piece-size-blind safe radius — the outer boundary ANY piece's own rendered edge may reach. Leaves the ceramic rim visible outside it. */
export function computeFoodSafeRadius(
  plateRx: number,
  plateRy: number,
  safeFrac: number = FOOD_SAFE_FRAC,
): number {
  return Math.min(plateRx, plateRy) * safeFrac;
}

/**
 * The piece's own bounding radius AFTER computeExtraShrink would apply —
 * i.e. capped at `safeRadius * MAX_PIECE_FRAC_OF_SAFE`. computeCenterReach
 * and computeExtraShrink both key off this SAME effective radius (never
 * the raw, pre-shrink one) — that coupling guarantees
 * `centerDistance + renderedPieceRadius <= safeRadius`.
 */
function effectivePieceRadius(safeRadius: number, pieceBoundingRadiusPx: number): number {
  return Math.min(pieceBoundingRadiusPx, safeRadius * MAX_PIECE_FRAC_OF_SAFE);
}

/**
 * Final-safety-net reach (brief §13 step 6, "apply final individual piece
 * containment check") — no longer the PRIMARY placement mechanism (that's
 * calculateCompositionBounds/fitCompositionToSafeRadius above), kept as
 * the same per-piece guarantee the earlier containment-only pass used, now
 * applied only as a last-resort clamp after the broad composition has
 * already been centered and fitted.
 */
export function computeCenterReach(
  safeRadius: number,
  pieceBoundingRadiusPx: number,
  radiusScale = 1,
): number {
  const effective = effectivePieceRadius(safeRadius, pieceBoundingRadiusPx);
  return (safeRadius - effective) * radiusScale;
}

/** 1 unless the piece's own bounding radius alone would already blow past the safe radius (e.g. one large Halve/Steak wedge on a modest plate) — then a plating-only shrink (never touching the real cutting-board piece) brings its footprint down to exactly the same effective radius computeCenterReach already budgeted for. */
export function computeExtraShrink(safeRadius: number, pieceBoundingRadiusPx: number): number {
  if (pieceBoundingRadiusPx <= 0) return 1;
  return effectivePieceRadius(safeRadius, pieceBoundingRadiusPx) / pieceBoundingRadiusPx;
}
