/**
 * CUT_EVALUATOR — pure scoring, ported from the Phase 1 reference
 * (Knifecraft Phase 1 review/knifecraft.html — computeGrade(), tolFor(),
 * groupSpacing()). No React, no Phaser objects; numbers in, numbers out.
 *
 * Structural note carried over from the reference: grading is NOT an
 * average of per-cut scores. It runs once, over the full set of
 * committed cut positions, exactly like the original — a gap between
 * two evenly-spaced cuts only exists once both cuts are placed.
 */
import type { CutPath, QualityLabel } from "@/types/game";
import {
  parallelGroups,
  groupSpacing,
  lineAngleDeg,
  type Axis,
  type Cut,
  type Silhouette,
} from "./CutGeometry";

export type RecordedPoint = { x: number; y: number; time: number };

/** knifecraft.html CONFIG.scoring (tomato-slice-6 uses the base table — recipe.tol is null). */
export const SCORING = {
  evennessTol: 1.0,
  consistencyCvTol: 1.2,
  rhythmCvGrace: 0.25,
  rhythmCvTol: 1.5,
  RHYTHM_BONUS_MAX: 0.1,
  EVENNESS_WEIGHT: 1,
  CONSISTENCY_WEIGHT: 1,
} as const;

/** knifecraft.html CONFIG.scoring.GRADE_THRESHOLDS, unchanged. */
const GRADE_THRESHOLDS: [number, QualityLabel][] = [
  [95, "Masterful"],
  [85, "Clean"],
  [70, "Honest"],
  [50, "Rustic"],
  [0, "Learning"],
];

/** knifecraft.html CONFIG.assist — swipe angle assist. */
export const ASSIST = {
  ANGLE_SNAP_DEG: 12, // within this of an axis, the cut reads as exactly square
  ANGLE_FREE_DEG: 26, // beyond this, the angle is exactly as drawn
  PARALLEL_TOL_DEG: 10,
} as const;

/** knifecraft.html CONFIG.perfect — the one hero-moment slice per recipe. */
export const PERFECT = {
  PERFECT_TOL: 12, // px from an ideal division point
  PERFECT_MIN_CUT_INDEX: 3, // earliest cut (1-based) that can trigger it
  HITSTOP_MS: 50,
} as const;

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function stddev(xs: number[]): number {
  if (!xs.length) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function qualityFor(overall: number): QualityLabel {
  return GRADE_THRESHOLDS.find(([t]) => overall >= t)?.[1] ?? "Learning";
}

/**
 * The angle-snap assist (knifecraft.html, the fitStroke/targetRot logic):
 * within ANGLE_SNAP_DEG of the nearest axis, land exactly square; beyond
 * ANGLE_FREE_DEG, keep exactly what was drawn; between the two, taper
 * linearly. Returns radians, taken as the offset from the nearer axis
 * (0 = horizontal-relative axis in this scene's guide space).
 */
export function snapAngle(angleDeg: number): number {
  const a = Math.abs(angleDeg);
  if (a <= ASSIST.ANGLE_SNAP_DEG) return 0;
  if (a >= ASSIST.ANGLE_FREE_DEG) return angleDeg;
  const pull = (a - ASSIST.ANGLE_SNAP_DEG) / (ASSIST.ANGLE_FREE_DEG - ASSIST.ANGLE_SNAP_DEG);
  return angleDeg * pull;
}

/**
 * Least-squares line fit through the recorded stroke (knifecraft.html's
 * "intent-based cutting" — §11 revised: the cut is always beautiful, the
 * grade is a whisper. Wobble is never rendered). Returns a point on the
 * line and its direction; degenerate (near-vertical in x) strokes fall
 * back to the raw endpoints.
 */
export function fitLine(points: RecordedPoint[]): { cx: number; cy: number; angleDeg: number } {
  const n = points.length;
  const mx = mean(points.map((p) => p.x));
  const my = mean(points.map((p) => p.y));
  let sxx = 0,
    sxy = 0;
  for (const p of points) {
    sxx += (p.x - mx) * (p.x - mx);
    sxy += (p.x - mx) * (p.y - my);
  }
  const slope = Math.abs(sxx) > 1e-6 ? sxy / sxx : (points[n - 1]!.y - points[0]!.y) / 1e-6;
  const angleDeg = (Math.atan(slope) * 180) / Math.PI;
  return { cx: mx, cy: my, angleDeg };
}

/**
 * A straight rendered cut through `through`, at `angleDeg` (already
 * snapped), spanning the guide band's y-extent — the "always beautiful"
 * fitted line the player actually sees, per §11 revised.
 */
export function fittedCutPath(
  throughX: number,
  throughY: number,
  angleDeg: number,
  halfLen: number,
): CutPath {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad) * halfLen;
  const dy = Math.sin(rad) * halfLen;
  return {
    points: [
      { x: throughX - dx, y: throughY - dy },
      { x: throughX + dx, y: throughY + dy },
    ],
  };
}

export function idealCutPath(guideY: number, x0: number, x1: number): CutPath {
  return {
    points: [
      { x: x0, y: guideY },
      { x: x1, y: guideY },
    ],
  };
}

/**
 * knifecraft.html computeGrade(): buckets every committed cut into
 * parallel-angle groups (parallelGroups — a dice grid naturally makes two
 * groups ~90° apart; a slice or julienne run makes one), grades each
 * group's spacing independently (groupSpacing), then combines them into
 * one evenness/consistency via an n-weighted average — there is no
 * separate "grid grading" path; a single-group technique's weighted
 * average just degenerates to that one group's own numbers.
 * `bandRange` gives each axis's playable band edges (the silhouette's own
 * band, ported from knifecraft.html's `bandRange()`). `tolOverride` is a
 * technique's `tol` override (e.g. julienne's wider bands).
 */
export function computeGrade(
  cuts: Cut[],
  timestamps: number[],
  sil: Silhouette,
  bandRange: (axis: Axis) => { lo: number; hi: number },
  tolOverride?: { evennessTol?: number; consistencyCvTol?: number },
): {
  evenness: number;
  consistency: number;
  rhythmBonus: number;
  overall: number;
  qualityLabel: QualityLabel;
} {
  const tol = {
    evennessTol: tolOverride?.evennessTol ?? SCORING.evennessTol,
    consistencyCvTol: tolOverride?.consistencyCvTol ?? SCORING.consistencyCvTol,
  };
  const groups = parallelGroups(cuts, ASSIST.PARALLEL_TOL_DEG)
    .map((g) => groupSpacing(g, sil, bandRange, tol))
    .filter((g): g is { n: number; evenness: number; consistency: number } => g !== null);
  const parts = groups.length ? groups : [{ n: 1, evenness: 100, consistency: 100 }];
  const wsum = parts.reduce((s, a) => s + a.n, 0) || 1;
  const evenness = Math.round(parts.reduce((s, a) => s + a.evenness * a.n, 0) / wsum);
  const consistency = Math.round(parts.reduce((s, a) => s + a.consistency * a.n, 0) / wsum);

  const intervals: number[] = [];
  for (let i = 1; i < timestamps.length; i++) intervals.push(timestamps[i]! - timestamps[i - 1]!);
  const cvR = intervals.length ? stddev(intervals) / (mean(intervals) || 1) : 0;
  const rhythmQ = 1 - clamp01((cvR - SCORING.rhythmCvGrace) / SCORING.rhythmCvTol);
  const rhythmBonus = Math.round(SCORING.RHYTHM_BONUS_MAX * 100 * rhythmQ);

  const base =
    (evenness * SCORING.EVENNESS_WEIGHT + consistency * SCORING.CONSISTENCY_WEIGHT) /
    (SCORING.EVENNESS_WEIGHT + SCORING.CONSISTENCY_WEIGHT);
  const overall = Math.min(100, Math.round(base + rhythmBonus));

  return { evenness, consistency, rhythmBonus, overall, qualityLabel: qualityFor(overall) };
}

/**
 * Radial's own grading (Phase 7 — Apple/Orange) — computeGrade()'s
 * parallelGroups() buckets cuts by SIMILAR angle (within
 * ASSIST.PARALLEL_TOL_DEG); radial cuts are deliberately at DIFFERENT
 * angles from each other (they all pass through the shared center, see
 * TechniqueDefinition.radialSnap's own doc), so every cut would land in
 * its own singleton group and — because a radial cut's position is
 * always exactly the center, i.e. always perfectly "centered" along its
 * own group's normal — always score a hollow 100 regardless of how the
 * angles are actually spread. This measures the real thing instead:
 * evenness/consistency of the ANGULAR gaps around the center, the exact
 * same rmsDev/cv math groupSpacing() already uses, just on the angle
 * domain (lineAngleDeg already folds into a 180°-periodic domain — a
 * line and its 180°-rotated twin are the same line — so gaps naturally
 * wrap at 180, not 360). Same SCORING tolerances (they're dimensionless
 * ratios, valid on either domain) and the same qualityFor() mapping.
 */
export function computeRadialGrade(
  cuts: Cut[],
  timestamps: number[],
): {
  evenness: number;
  consistency: number;
  rhythmBonus: number;
  overall: number;
  qualityLabel: QualityLabel;
} {
  const n = cuts.length;
  if (n === 0) {
    return {
      evenness: 90,
      consistency: 90,
      rhythmBonus: 5,
      overall: 90,
      qualityLabel: qualityFor(90),
    };
  }
  const angles = cuts.map((c) => lineAngleDeg(c.axis, c.slope)).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < angles.length; i++) gaps.push(angles[i]! - angles[i - 1]!);
  gaps.push(angles[0]! + 180 - angles[angles.length - 1]!); // wrap-around gap, 180°-periodic

  const ideal = 180 / n;
  const rmsDev = Math.sqrt(mean(gaps.map((g) => (g - ideal) * (g - ideal)))) / (ideal || 1);
  const cvC = stddev(gaps) / (mean(gaps) || 1);
  const evenness = Math.round(100 * (1 - clamp01(rmsDev / SCORING.evennessTol)));
  const consistency = Math.round(100 * (1 - clamp01(cvC / SCORING.consistencyCvTol)));

  const intervals: number[] = [];
  for (let i = 1; i < timestamps.length; i++) intervals.push(timestamps[i]! - timestamps[i - 1]!);
  const cvR = intervals.length ? stddev(intervals) / (mean(intervals) || 1) : 0;
  const rhythmQ = 1 - clamp01((cvR - SCORING.rhythmCvGrace) / SCORING.rhythmCvTol);
  const rhythmBonus = Math.round(SCORING.RHYTHM_BONUS_MAX * 100 * rhythmQ);

  const base =
    (evenness * SCORING.EVENNESS_WEIGHT + consistency * SCORING.CONSISTENCY_WEIGHT) /
    (SCORING.EVENNESS_WEIGHT + SCORING.CONSISTENCY_WEIGHT);
  const overall = Math.min(100, Math.round(base + rhythmBonus));

  return { evenness, consistency, rhythmBonus, overall, qualityLabel: qualityFor(overall) };
}

/**
 * Rings' own grading (Pre-Phase-8) — Rings never produces `Cut` objects
 * (interactionMode "ring", not "cut"), so it can't route through
 * computeGrade/computeRadialGrade at all; before this it wasn't graded on
 * anything, just a fixed fallback for a zero-cut segment. This measures
 * the real thing PreparationScene.recordRingTapAccuracy already computed
 * per tap: how far off-center each tap landed within the band it was
 * about to remove, normalized so 0 = dead center, ±1 = right at that
 * band's own edge. Same evenness (RMS deviation from 0, dimensionless)
 * and consistency (coefficient of variation of |deviation|) shape as
 * computeGrade/computeRadialGrade, same SCORING tolerances and rhythm-
 * bonus treatment from real tap timestamps, same qualityFor() mapping.
 */
export function computeRingsGrade(
  deviations: number[],
  timestamps: number[],
): {
  evenness: number;
  consistency: number;
  rhythmBonus: number;
  overall: number;
  qualityLabel: QualityLabel;
} {
  const n = deviations.length;
  if (n === 0) {
    return {
      evenness: 90,
      consistency: 90,
      rhythmBonus: 5,
      overall: 90,
      qualityLabel: qualityFor(90),
    };
  }
  const rmsDev = Math.sqrt(mean(deviations.map((d) => d * d)));
  const evenness = Math.round(100 * (1 - clamp01(rmsDev / SCORING.evennessTol)));
  const absDevs = deviations.map((d) => Math.abs(d));
  const cvC = stddev(absDevs) / (mean(absDevs) || 1);
  const consistency = Math.round(100 * (1 - clamp01(cvC / SCORING.consistencyCvTol)));

  const intervals: number[] = [];
  for (let i = 1; i < timestamps.length; i++) intervals.push(timestamps[i]! - timestamps[i - 1]!);
  const cvR = intervals.length ? stddev(intervals) / (mean(intervals) || 1) : 0;
  const rhythmQ = 1 - clamp01((cvR - SCORING.rhythmCvGrace) / SCORING.rhythmCvTol);
  const rhythmBonus = Math.round(SCORING.RHYTHM_BONUS_MAX * 100 * rhythmQ);

  const base =
    (evenness * SCORING.EVENNESS_WEIGHT + consistency * SCORING.CONSISTENCY_WEIGHT) /
    (SCORING.EVENNESS_WEIGHT + SCORING.CONSISTENCY_WEIGHT);
  const overall = Math.min(100, Math.round(base + rhythmBonus));

  return { evenness, consistency, rhythmBonus, overall, qualityLabel: qualityFor(overall) };
}

/**
 * Lightweight PER-CUT proxy for the transient "toast" shown right after
 * each cut (a new-project addition — the reference only grades once, at
 * the end). Reuses the same evenness math against the ideal division
 * points implied by the current progress, purely for immediate flavor
 * text; the authoritative score is always computeGrade() at completion.
 */
export function proxyCutQuality(cutX: number, guideX: number, tolerancePx: number): QualityLabel {
  const offset = Math.abs(cutX - guideX);
  const overall = Math.round(100 * (1 - clamp01(offset / (tolerancePx * 4))));
  return qualityFor(overall);
}

/** knifecraft.html's Perfect Slice trigger: within PERFECT_TOL of an ideal even-division point. */
export function isPerfectCut(cutX: number, idealX: number): boolean {
  return Math.abs(cutX - idealX) <= PERFECT.PERFECT_TOL;
}
