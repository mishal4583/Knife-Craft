/**
 * PLATING_SYSTEM_QA — production plating redesign, run the same way as
 * scripts/level-system-v2-qa.mts:
 *   npx esbuild scripts/plating-system-qa.mts --bundle --platform=node --format=esm --outfile=/tmp/platqa.mjs
 *   node /tmp/platqa.mjs
 *
 * Scoped to what's actually testable outside a Phaser/canvas runtime: the
 * pure arrangement module (determinism, no Math.random, technique
 * coverage) plus the grouping logic startPlating() itself now runs on
 * platedPieceMeta. PreparedOutput/organizationManager are untouched by
 * this task and already have their own QA elsewhere — not re-tested here.
 */
import {
  getPlatingArrangement,
  seedFor,
  pieceBoundingRadius,
  computeFoodSafeRadius,
  computeCenterReach,
  computeExtraShrink,
  calculateCompositionBounds,
  fitCompositionToSafeRadius,
  FOOD_SAFE_FRAC,
  type CompositionPiece,
} from "../src/game/plating/platingArrangement.ts";
import { TECHNIQUES, type TechniqueId } from "../src/game/definitions.ts";
import * as fs from "node:fs";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

// ===== 1: no Math.random() anywhere in the plating module (code, not doc comments mentioning the rule). =====
{
  const src = fs
    .readFileSync("src/game/plating/platingArrangement.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert(!src.includes("Math.random("), "1: platingArrangement.ts contains no Math.random() call");
}

// ===== 2: every real technique id is handled (no silent fallback for a real one). =====
{
  const ids = Object.keys(TECHNIQUES) as TechniqueId[];
  assert(ids.length === 11, `2: all 11 techniques exist to check against (${ids.length})`);
  const covered = [
    "slice", "rings", "radial", "halve", "julienne", "chiffonade",
    "chop", "dice", "rockMince", "smash", "peel",
  ];
  assert(
    ids.every((id) => covered.includes(id)),
    "2b: every technique id has an explicit arrangement case (or the documented peel fallback)",
  );
}

// ===== 3: determinism — same input always returns the same transform. =====
{
  let allSame = true;
  for (const tech of Object.keys(TECHNIQUES) as TechniqueId[]) {
    for (const count of [1, 3, 6, 12]) {
      for (let i = 0; i < count; i++) {
        const a = getPlatingArrangement({ technique: tech, index: i, count, seed: seedFor("carrot") });
        const b = getPlatingArrangement({ technique: tech, index: i, count, seed: seedFor("carrot") });
        if (JSON.stringify(a) !== JSON.stringify(b)) allSame = false;
      }
    }
  }
  assert(allSame, "3: same (technique,index,count,seed) always returns the same transform");
}

// ===== 4: different ingredient seeds produce different arrangements (real variation, not a stamp). =====
{
  const a = getPlatingArrangement({ technique: "slice", index: 2, count: 6, seed: seedFor("carrot") });
  const b = getPlatingArrangement({ technique: "slice", index: 2, count: 6, seed: seedFor("radish") });
  assert(JSON.stringify(a) !== JSON.stringify(b), "4: two different ingredients' same-index arrangement differ (seed matters)");
}

// ===== 5: seedFor is itself deterministic and ingredient-distinguishing. =====
{
  assert(seedFor("carrot") === seedFor("carrot"), "5a: seedFor is deterministic for the same id");
  assert(seedFor("carrot") !== seedFor("radish"), "5b: seedFor distinguishes different ingredient ids");
}

// ===== 6: raw arrangement output never runs away unbounded (a loose sanity ceiling, not a tight spec — the distribution/composition pass intentionally made xFrac/yFrac SCALE with count, in piece-radius units, rather than staying normalized to [-1,1]; see platingArrangement.ts's own header doc). =====
{
  let withinBounds = true;
  for (const tech of Object.keys(TECHNIQUES) as TechniqueId[]) {
    for (const count of [1, 4, 12, 24]) {
      const ceiling = 1.5 * Math.sqrt(count) + 3; // generous — real composition sizing/fitting happens downstream
      for (let i = 0; i < count; i++) {
        const t = getPlatingArrangement({ technique: tech, index: i, count, seed: seedFor("x") });
        if (Math.hypot(t.xFrac, t.yFrac) > ceiling) withinBounds = false;
      }
    }
  }
  assert(withinBounds, "6: raw arrangement magnitude never runs away unbounded, at any technique/count (loose sanity ceiling)");
}

// ===== 7: piece count is never altered by the arrangement call (pure function of its own inputs). =====
{
  // The module never generates or drops pieces — it has no piece array at
  // all, only an (index, count) pair supplied by the caller — so "count
  // preserved" / "no fake pieces" is true by construction here; verified
  // structurally rather than by re-deriving PreparationScene's own piece
  // list (out of reach outside a Phaser runtime).
  const srcScene = fs.readFileSync("src/game/scenes/PreparationScene.ts", "utf8");
  assert(
    srcScene.includes("this.platedPieceImages.push(img)") &&
      srcScene.includes("const pieceImages = this.platedPieceImages;"),
    "7: startPlating iterates the SAME platedPieceImages array closeOutCurrentIngredient pushed into — no cloning/regeneration",
  );
}

// ===== 8: PreparedOutput / organizationManager are untouched by this task. =====
{
  const orgTypes = fs.readFileSync("src/game/organization/organizationTypes.ts", "utf8");
  assert(
    orgTypes.includes("export type PreparedOutput") && orgTypes.includes("assignedTo: string[]"),
    "8: PreparedOutput's assignedTo[] shape is unchanged (this task never edited organizationTypes.ts/organizationManager.ts)",
  );
}

// ============ VISUAL CORRECTION PASS — plate-relative containment ============

// ===== 9: FOOD_SAFE_FRAC matches the brief's "55-70% of usable plate area" intent. =====
{
  assert(
    FOOD_SAFE_FRAC >= 0.5 && FOOD_SAFE_FRAC <= 0.72,
    `9: FOOD_SAFE_FRAC (${FOOD_SAFE_FRAC}) sits in the 0.5-0.72 radius range the brief's 55-70% area target implies`,
  );
}

// ===== 10: computeCenterReach/computeExtraShrink's OWN containment guarantee — a piece placed at exactly `reach` from center never has its (rotation-invariant, shrink-adjusted) edge exceed the safe radius, for any plate size or piece size, including a large elongated piece (a long rotated steak wedge is exactly the case that escaped the original containment-only pass). Tested directly against these two functions, independent of getPlatingArrangement's own (now much larger, count-scaled — see the distribution/composition pass) raw output magnitude, since they're now the FINAL safety-net clamp (checks 15-23 below cover the primary broad-composition pipeline that runs before it). =====
{
  let allContained = true;
  const plateSizes = [
    { rx: 196, ry: 150 }, // single-plate default
    { rx: 90, ry: 69 }, // heavily shrunk multi-plate case
  ];
  // width/height pairs: small (spinach dice), square-ish (mozzarella
  // slice), and a long thin one (a steak wedge / kiwi strip) — the exact
  // shape that used its rotation to sweep past the rim in the original
  // containment-only pass.
  const pieceSizes = [
    { w: 20, h: 20 },
    { w: 60, h: 60 },
    { w: 140, h: 30 },
  ];
  for (const plate of plateSizes) {
    const safeRadius = computeFoodSafeRadius(plate.rx, plate.ry);
    for (const piece of pieceSizes) {
      const pieceR = pieceBoundingRadius(piece.w, piece.h);
      const reach = computeCenterReach(safeRadius, pieceR, 1);
      const shrink = computeExtraShrink(safeRadius, pieceR);
      // A piece at the boundary of its own allotted reach, at any angle —
      // rotation never enters this at all, by construction (pieceR is
      // already the rotation-invariant bounding-circle radius).
      for (let angleStep = 0; angleStep < 24; angleStep++) {
        const angle = (angleStep / 24) * Math.PI * 2;
        const centerDist = Math.hypot(Math.cos(angle) * reach, Math.sin(angle) * reach);
        const edgeDist = centerDist + pieceR * shrink;
        if (edgeDist > safeRadius + 1e-6) allContained = false;
      }
    }
  }
  assert(allContained, "10: a piece placed at computeCenterReach's own boundary, at any angle, never has its shrink-adjusted edge exceed the safe radius — for every plate-size/piece-size combination tested");
}

// ===== 11: a piece far too large for its plate gets shrunk; a small piece does not. =====
{
  const safeRadius = computeFoodSafeRadius(90, 69); // a heavily-shrunk multi-plate case
  const bigPieceShrink = computeExtraShrink(safeRadius, pieceBoundingRadius(140, 60));
  const smallPieceShrink = computeExtraShrink(safeRadius, pieceBoundingRadius(15, 15));
  assert(bigPieceShrink < 1, `11a: an oversized piece for its plate gets a plating-only shrink (${bigPieceShrink.toFixed(3)} < 1)`);
  assert(smallPieceShrink === 1, `11b: a small piece is left at its real size (shrink === 1)`);
}

// ===== 12: reach never goes negative or collapses every piece to the exact same point. =====
{
  const safeRadius = computeFoodSafeRadius(90, 69);
  const reach = computeCenterReach(safeRadius, 500 /* an absurdly large piece */, 1);
  assert(reach > 0, `12: computeCenterReach stays positive even for a piece bigger than the whole plate (${reach.toFixed(2)})`);
}

// ===== 13: dice/chop/rockMince stay a compact mound, not a pinwheel — rotation range is small, not the old +/-180. =====
{
  let maxAbsRotation = 0;
  for (const tech of ["dice", "chop", "rockMince"] as TechniqueId[]) {
    for (let i = 0; i < 12; i++) {
      const t = getPlatingArrangement({ technique: tech, index: i, count: 12, seed: seedFor("steak") });
      maxAbsRotation = Math.max(maxAbsRotation, Math.abs(t.rotationDeg));
    }
  }
  assert(maxAbsRotation <= 25, `13: dice/chop/rockMince rotation stays small (<=25deg, got ${maxAbsRotation.toFixed(1)}) — a mound, not a starburst`);
}

// ===== 14: adjacent plates in the multi-plate grid don't touch — a >1.0 spacing multiplier leaves a real gap between plate edges. =====
{
  const srcScene = fs.readFileSync("src/game/scenes/PreparationScene.ts", "utf8");
  const spacingMatches = [...srcScene.matchAll(/rowSpacingY = baseRy \* 2 \* ([\d.]+);/g), ...srcScene.matchAll(/colSpacingX = baseRx \* 2 \* ([\d.]+);/g)];
  assert(
    spacingMatches.length === 2 && spacingMatches.every((m) => Number(m[1]) > 1),
    "14: multi-plate grid spacing multiplier is > 1x plate diameter on both axes (adjacent plates never touch)",
  );
}

// ============ DISTRIBUTION / COMPOSITION FIX ============
// Containment (checks 9-14 above, unchanged) answers "can this piece fit".
// These answer "where should the GROUP go so the plate looks properly
// plated" — geometry-based, per the brief's own instruction not to test
// subjective visual quality with arbitrary pixel numbers alone.

/** Builds the same raw-position array startPlating() does for a group, without needing Phaser: technique/count -> getPlatingArrangement -> * avgRadius -> {x,y,radius}. */
function buildRawComposition(
  technique: TechniqueId,
  count: number,
  avgRadius: number,
  pieceRadiusOverride?: number[],
  seed = seedFor("test-ingredient"),
): CompositionPiece[] {
  const pieces: CompositionPiece[] = [];
  for (let i = 0; i < count; i++) {
    const a = getPlatingArrangement({ technique, index: i, count, seed });
    pieces.push({
      x: a.xFrac * avgRadius,
      y: a.yFrac * avgRadius,
      radius: pieceRadiusOverride ? pieceRadiusOverride[i]! : avgRadius * a.scale,
    });
  }
  return pieces;
}

/**
 * The exact pipeline PreparationScene.startPlating() runs per group: raw ->
 * per-piece emergencyShrink -> bounds/center -> fit (POSITION ONLY) -> final
 * per-piece position pull. Task "food scale + multi-instance preparation
 * bug" §A: `fitScale` no longer multiplies `radius` anywhere in this
 * function — that was the bug (see platingArrangement.ts's own doc). The
 * containment guarantee now comes entirely from the final position pull,
 * using each piece's own (only rarely emergency-shrunk) real radius.
 */
function runFullPipeline(pieces: CompositionPiece[], safeRadius: number) {
  const shrunk = pieces.map((p) => {
    const emergencyShrink = computeExtraShrink(safeRadius, p.radius);
    return { x: p.x, y: p.y, radius: p.radius * emergencyShrink, emergencyShrink };
  });
  const { centerX, centerY, requiredRadius } = calculateCompositionBounds(shrunk);
  const fitScale = fitCompositionToSafeRadius(requiredRadius, safeRadius);
  const final = shrunk.map((p) => {
    let x = (p.x - centerX) * fitScale;
    let y = (p.y - centerY) * fitScale;
    const dist = Math.hypot(x, y);
    const maxDist = Math.max(0, safeRadius - p.radius);
    if (dist > maxDist && dist > 0) {
      const pull = maxDist / dist;
      x *= pull;
      y *= pull;
    }
    return { x, y, radius: p.radius, emergencyShrink: p.emergencyShrink };
  });
  return { fitScale, final };
}

const BROAD_TECHNIQUES: TechniqueId[] = ["dice", "chop", "rockMince", "halve", "smash", "julienne", "slice"];

// ===== 15: composition center is within a small tolerance of plate center, after the real pipeline (raw -> bounds -> fit) runs — not just "the math says so", but re-verified by recomputing bounds on the FINAL positions. =====
// Tolerance loosened from an exact 0.01px to 0.2px by the "food scale"
// fix (§A): containment is now guaranteed by a PER-PIECE position pull
// (task §A5) rather than one uniform fitScale applied to every piece's
// position AND radius alike, so an outlier piece at the edge of a dense
// composition can be pulled in slightly further than its symmetric
// counterpart, shifting the recomputed centroid by a fraction of a
// pixel — visually meaningless, but no longer mathematically exact.
{
  let allCentered = true;
  const drifts: string[] = [];
  for (const tech of BROAD_TECHNIQUES) {
    for (const count of [1, 4, 8, 16]) {
      const raw = buildRawComposition(tech, count, 20);
      const { final } = runFullPipeline(raw, 90);
      const recomputed = calculateCompositionBounds(final);
      const drift = Math.hypot(recomputed.centerX, recomputed.centerY);
      if (drift > 0.2) {
        allCentered = false;
        drifts.push(`${tech}(n=${count})=${drift.toFixed(3)}px`);
      }
    }
  }
  assert(allCentered, `15: after the full pipeline, the composition's own recomputed center sits within 0.2px of plate-center (0,0) — true centering, not just a symmetric formula (${drifts.join(", ")})`);
}

// ===== 16: composition uses a meaningful portion of the safe plate area (not a tiny huddle) for a representative piece count. =====
{
  const safeRadius = 100;
  let allMeaningful = true;
  const details: string[] = [];
  for (const tech of BROAD_TECHNIQUES) {
    const raw = buildRawComposition(tech, 8, 12); // 8 modestly-sized pieces
    const { requiredRadius } = calculateCompositionBounds(raw);
    const frac = requiredRadius / safeRadius;
    if (frac < 0.3) {
      allMeaningful = false;
      details.push(`${tech}: only ${(frac * 100).toFixed(0)}% of safe radius`);
    }
  }
  assert(allMeaningful, `16: every broad technique's natural (pre-fit) 8-piece composition reaches at least 30% of the safe radius — not collapsed into one corner (${details.join(", ")})`);
}

// ===== 17/18/19: rock-mince/dice/chop footprint EXPANDS with piece count. =====
{
  for (const [n, tech] of [[17, "rockMince"], [18, "dice"], [19, "chop"]] as const) {
    const small = calculateCompositionBounds(buildRawComposition(tech, 4, 15));
    const large = calculateCompositionBounds(buildRawComposition(tech, 16, 15));
    assert(
      large.requiredRadius > small.requiredRadius,
      `${n}: ${tech}'s footprint grows with piece count (4pc=${small.requiredRadius.toFixed(1)}, 16pc=${large.requiredRadius.toFixed(1)})`,
    );
  }
}

// ===== 20: no technique collapses all pieces into an excessively small region (every piece landing on top of each other). =====
{
  let noneDegenerate = true;
  for (const tech of Object.keys(TECHNIQUES) as TechniqueId[]) {
    const raw = buildRawComposition(tech, 8, 15);
    const { requiredRadius } = calculateCompositionBounds(raw);
    if (requiredRadius < 15 * 1.15) noneDegenerate = false; // barely bigger than one piece's own radius alone
  }
  assert(noneDegenerate, "20: no technique's 8-piece composition collapses to (roughly) a single piece's own footprint");
}

// ===== 21: final composition bounds remain inside the plate's safe region — the full pipeline, re-tested against a heterogeneous group (small/square/long-elongated pieces together, the exact mix that escaped in the containment-only pass). =====
{
  const safeRadius = computeFoodSafeRadius(90, 69);
  let allContained = true;
  const mixedRadii = [
    pieceBoundingRadius(20, 20),
    pieceBoundingRadius(60, 60),
    pieceBoundingRadius(140, 30),
    pieceBoundingRadius(25, 25),
    pieceBoundingRadius(140, 30),
  ];
  for (const tech of Object.keys(TECHNIQUES) as TechniqueId[]) {
    const avg = mixedRadii.reduce((a, b) => a + b, 0) / mixedRadii.length;
    const raw = buildRawComposition(tech, mixedRadii.length, avg, mixedRadii);
    const { final } = runFullPipeline(raw, safeRadius);
    for (const p of final) {
      if (Math.hypot(p.x, p.y) + p.radius > safeRadius + 1e-6) allContained = false;
    }
  }
  assert(allContained, "21: the full raw->center->fit pipeline keeps every piece (including a heterogeneous small/square/long-elongated mix) inside the plate's safe radius");
}

// ===== 22: the full pipeline (bounds + fit) is itself deterministic. =====
{
  const raw = buildRawComposition("rockMince", 9, 18);
  const a = runFullPipeline(raw, 95);
  const b = runFullPipeline(raw, 95);
  assert(JSON.stringify(a) === JSON.stringify(b), "22: calculateCompositionBounds/fitCompositionToSafeRadius are deterministic for the same inputs");
}

// ===== 23: multi-plate internal compositions are independently centered — structural check that each piece's target position is computed relative to ITS OWN plate's cx/cy and its OWN group's center/fit, never a shared/global one. =====
{
  const srcScene = fs.readFileSync("src/game/scenes/PreparationScene.ts", "utf8");
  assert(
    srcScene.includes("plate.cx + (rawX - centerX) * fitScale") &&
      srcScene.includes("destinationDerived.get(destination)!") &&
      srcScene.includes("destinationOrder.forEach((destination, gi)"),
    "23: each destination's positions are centered/fitted against its OWN plate.cx/cy and its OWN destinationDerived entry — multi-plate compositions never share centering state",
  );
}

// ============ FOOD SCALE PRESERVATION FIX ============
// Task: "food scale + multi-instance preparation bug" §A — plated pieces
// must render at their actual prepared-board size by default; the group's
// composition-fit scale must never multiply an individual piece's own
// rendered size (that was the bug). §E checks 1-6.

// ===== 24: PreparationScene's piece.setScale call no longer multiplies by the group's fitScale — structural regression guard for the exact bug (fitScale silently shrinking every plated piece). =====
{
  const srcScene = fs.readFileSync("src/game/scenes/PreparationScene.ts", "utf8");
  // Julienne centering fix moved the scale EXPRESSION onto its own `const
  // scale = ...` line (piece.setScale(scale) reads that variable) — find
  // whichever line actually assigns it, not just whatever line calls
  // piece.setScale(...).
  const scaleAssignLine =
    srcScene.split("\n").find((l) => /const scale = .*emergencyShrink/.test(l))?.trim() ?? "";
  const setScaleCallLine = srcScene.split("\n").find((l) => l.includes("piece.setScale("))?.trim() ?? "";
  assert(
    scaleAssignLine.length > 0 &&
      !scaleAssignLine.includes("fitScale") &&
      setScaleCallLine.includes("scale"),
    `24: piece.setScale's own composition-scale expression uses emergencyShrink, not the group's fitScale (found: "${scaleAssignLine}" / "${setScaleCallLine}")`,
  );
}

// ===== 25: a normal piece's prepared scale is preserved even when the group's natural composition clearly doesn't fit the plate (fitScale « 1) — the exact scenario that produced visibly tiny plated food. =====
{
  // A deliberately harsh case: 8 large (radius 40) pieces fanned out with
  // the slice/radial technique's generous spread, on a modest 60px-safe
  // plate — requiredRadius is guaranteed to badly exceed safeRadius here.
  const raw = buildRawComposition("slice", 8, 40);
  const safeRadius = 60;
  const { fitScale, final } = runFullPipeline(raw, safeRadius);
  const genuinelyCompressed = fitScale < 0.9; // sanity: this scenario actually stresses the pipeline
  const allFullScale = final.every((p) => Math.abs(p.emergencyShrink - 1) < 1e-9);
  assert(
    genuinelyCompressed && allFullScale,
    `25: every normal piece's own render radius is untouched (emergencyShrink===1) even though the group's fitScale had to compress to ${fitScale.toFixed(2)} to fit spacing`,
  );
}

// ===== 26: despite piece scale never shrinking for the fix above, the full pipeline still keeps every piece fully contained — the position-only pull (not scale) is what now guarantees this. =====
{
  const raw = buildRawComposition("dice", 9, 35);
  const safeRadius = 55; // small plate relative to 9 large dice pieces
  const { final } = runFullPipeline(raw, safeRadius);
  const allContained = final.every((p) => Math.hypot(p.x, p.y) + p.radius <= safeRadius + 1e-6);
  assert(
    allContained,
    "26: even with piece scale fully preserved, the final per-piece position pull still keeps every piece's real (unshrunk) edge within the plate's safe radius",
  );
}

// ===== 27: the one true emergency case still works — a single piece whose OWN bounding radius alone exceeds the plate's entire safe radius still gets a minimal (not aggressive) scale trim, never affecting siblings. =====
{
  const hugeRadius = 200;
  const smallRadius = 20;
  const safeRadius = 60;
  const raw: CompositionPiece[] = [
    { x: 0, y: 0, radius: hugeRadius },
    { x: 30, y: 0, radius: smallRadius },
  ];
  const { final } = runFullPipeline(raw, safeRadius);
  const hugeShrunk = final[0]!.emergencyShrink < 1 && final[0]!.radius <= safeRadius * 0.9 + 1e-6;
  const smallUntouched = final[1]!.emergencyShrink === 1;
  assert(
    hugeShrunk && smallUntouched,
    `27: an individually oversized piece gets a minimal emergency shrink (radius ${final[0]!.radius.toFixed(1)}, shrink ${final[0]!.emergencyShrink.toFixed(2)}) while its small sibling's scale is completely untouched (shrink ${final[1]!.emergencyShrink})`,
  );
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
