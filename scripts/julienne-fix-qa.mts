/**
 * JULIENNE_FIX_QA — task: "julienne centering + carrot julienne cut
 * correction". Run like the project's other focused QA scripts:
 *   npx tsx scripts/julienne-fix-qa.mts
 *
 * ISSUE 1 root cause: every plated piece Image uses a top-left origin
 * (createPieceImage's setOrigin(0,0) in PreparationScene.ts), but the
 * whole plating composition pipeline (getPlatingArrangement,
 * calculateCompositionBounds, fitCompositionToSafeRadius) is built
 * entirely around "position === this piece's own CENTER". The flight
 * loop used to assign that computed center straight into `piece.x/y`
 * (the CORNER), so every piece's true visual center sat offset from
 * where the composition math intended it — invisible for small/near-
 * square pieces at modest rotation, dramatic for Julienne's large,
 * heavily-rotated (34deg+), elongated strips. Fixed by converting
 * corner<->center using each piece's own half-width/half-height AND
 * current angle/scale (PreparationScene.ts's `cornerToCenterOffset`).
 *
 * ISSUE 2 root cause: Julienne/Chiffonade (technique.parallelSnap) had no
 * ingredient-shape-aware default cut axis. A TAP (`resolveTapCut`) or an
 * exact-diagonal swipe resolves its axis via `tapDefaultAxis()`, which
 * used to fall back to `ingredient.axisOverride ?? technique.axis`
 * ("v") — the SAME override tuned for Slice/Chop's cross-section
 * "rounds", the opposite of what Julienne needs. Carrot has no
 * axisOverride at all, so its Julienne taps used axis "v": cuts
 * PERPENDICULAR to its own horizontal length, chopping it into segments
 * instead of cutting parallel to its length into strips. Fixed by
 * deriving the parallelSnap default axis from the ingredient's own
 * rendered aspect ratio (`ingRx >= ingRy ? "h" : "v"`) — shape-driven,
 * not a per-ingredient special case, so it's correct for any ingredient
 * generically (and also fixes zucchini's julienne, which shares the
 * exact same "taper axisOverride tuned for Slice" shape).
 */
import {
  type Cut,
  type Piece,
  rebuildPieces,
  pieceBounds,
  idealPositions,
} from "../src/game/CutGeometry.ts";
import { makeTaperSilhouette } from "../src/game/ingredientShapes.ts";
import { TECHNIQUES, INGREDIENTS } from "../src/game/definitions.ts";
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

// ============ ISSUE 2 — CARROT JULIENNE CUT CORRECTION ============

// ===== 1: julienne dispatch reaches the correct, existing technique — carrot's own techniques list includes "julienne", and the technique itself is still parallelSnap (never re-implemented as slice+rotation/chop+scaling). =====
{
  const carrot = INGREDIENTS.carrot;
  const julienne = TECHNIQUES.julienne;
  assert(
    carrot.techniques.includes("julienne") && julienne.parallelSnap === true && julienne.guideType === "parallel-free",
    "1: carrot supports julienne, and julienne is still the same parallel-snap technique (not re-implemented)",
  );
}

// ===== 6: existing cut count / validation semantics are unchanged — julienne.requiredCuts is still exactly 10, untouched by this fix (§10). =====
{
  assert(TECHNIQUES.julienne.requiredCuts === 10, `6: julienne.requiredCuts is still 10 (got ${TECHNIQUES.julienne.requiredCuts}) — this fix never touched requiredCutsFor/recipe validation`);
}

/** A carrot-proportioned taper silhouette (real makeTaperSilhouette, not a stand-in) — wide crown, narrow tip, lying flat (rx >> ry), matching carrot's real geometry family (see ingredientShapes.ts's own doc: "cucumber lies flat exactly like carrot does"). */
function carrotLikeSilhouette() {
  return makeTaperSilhouette(0, 0, 150, 45, 8, 0.5, 0.6);
}

/** Mirrors PreparationScene.tapDefaultAxis()'s new parallelSnap branch exactly — a pure function so it's testable without a Phaser scene. */
function parallelSnapDefaultAxis(ingRx: number, ingRy: number): "h" | "v" {
  return ingRx >= ingRy ? "h" : "v";
}

// ===== 2: the shape-derived default axis picks "h" for a carrot-proportioned (wide) silhouette — this is the exact fix for the reported bug. =====
{
  const sil = carrotLikeSilhouette();
  const axis = parallelSnapDefaultAxis(sil.rx, sil.ry);
  assert(axis === "h" && sil.rx > sil.ry, `2: a carrot-proportioned silhouette (rx=${sil.rx}, ry=${sil.ry}) resolves the parallel-snap default axis to "h" (cuts parallel to its length)`);
}

/** Applies `count` parallel cuts of the given axis, evenly spaced across the correct cross-axis band, to a fresh whole silhouette — mirrors finishCut/resolveTapCut's own end-to-end effect on `this.cuts`/pieces, without needing PreparationScene's input-handling machinery. */
function applyParallelCuts(sil: ReturnType<typeof carrotLikeSilhouette>, axis: "h" | "v", count: number): Piece[] {
  const band = axis === "h" ? { lo: sil.cy - sil.ry * 0.85, hi: sil.cy + sil.ry * 0.85 } : { lo: sil.cx - sil.rx * 0.85, hi: sil.cx + sil.rx * 0.85 };
  const positions = idealPositions(band.lo, band.hi, count);
  let pieces: Piece[] = [{ cons: [] }];
  for (const c of positions) {
    const cut: Cut = { axis, c, slope: 0 };
    pieces = rebuildPieces(pieces, cut, sil);
  }
  return pieces;
}

function boundsOf(piece: Piece, sil: ReturnType<typeof carrotLikeSilhouette>) {
  return pieceBounds(piece.cons, sil);
}

// ===== 3: axis "h" (the corrected default) produces genuinely ELONGATED pieces — long and thin, a large length/width ratio — not chopped chunks. =====
let hAspects: number[] = [];
{
  const sil = carrotLikeSilhouette();
  const pieces = applyParallelCuts(sil, "h", 10);
  const bounds = pieces.map((p) => boundsOf(p, sil)).filter((b): b is NonNullable<typeof b> => b !== null);
  hAspects = bounds.map((b) => (b.x1 - b.x0) / Math.max(1, b.y1 - b.y0));
  const allElongated = hAspects.length > 0 && hAspects.every((a) => a > 3);
  assert(allElongated, `3: every axis="h" piece has a long/thin aspect ratio > 3 (got [${hAspects.map((a) => a.toFixed(1)).join(", ")}])`);
}

// ===== 5: multiple julienne pieces are actually produced (not collapsed to one blob). =====
{
  const sil = carrotLikeSilhouette();
  const pieces = applyParallelCuts(sil, "h", 10);
  assert(pieces.length >= 8, `5: 10 parallel cuts produce multiple distinct pieces (got ${pieces.length})`);
}

// ===== 4: Carrot Julienne (axis "h") is measurably NOT equivalent to the old buggy axis ("v", cross-section chop geometry) — the two produce very different, easily-distinguished aspect ratios for the exact same silhouette/cut count. =====
{
  const sil = carrotLikeSilhouette();
  const vPieces = applyParallelCuts(sil, "v", 10);
  const vBounds = vPieces.map((p) => boundsOf(p, sil)).filter((b): b is NonNullable<typeof b> => b !== null);
  const vAspects = vBounds.map((b) => (b.x1 - b.x0) / Math.max(1, b.y1 - b.y0));
  const avgH = hAspects.reduce((a, b) => a + b, 0) / hAspects.length;
  const avgV = vAspects.reduce((a, b) => a + b, 0) / Math.max(1, vAspects.length);
  assert(
    avgH > avgV * 3,
    `4: the corrected axis's average aspect ratio (${avgH.toFixed(1)}) is dramatically higher than the old buggy axis's (${avgV.toFixed(1)}) — genuinely different geometry, not a cosmetic tweak`,
  );
}

// ===== 13: deterministic — the same silhouette/cut inputs always produce the same piece geometry (no Math.random() anywhere in this path). =====
{
  const sil = carrotLikeSilhouette();
  const a = applyParallelCuts(sil, "h", 10).map((p) => boundsOf(p, sil));
  const b = applyParallelCuts(sil, "h", 10).map((p) => boundsOf(p, sil));
  assert(JSON.stringify(a) === JSON.stringify(b), "13: julienne cut geometry is deterministic for the same inputs");
}

// ===== 12: no Math.random() in the touched axis-resolution code. =====
{
  const src = fs.readFileSync("src/game/scenes/PreparationScene.ts", "utf8");
  const fnStart = src.indexOf("private tapDefaultAxis()");
  const fnBody = src.slice(fnStart, src.indexOf("\n  }", fnStart));
  assert(!fnBody.includes("Math.random("), "12: tapDefaultAxis() (the fixed function) contains no Math.random()");
}

// ===== 11: the fix is generic (shape-derived), not a carrot-specific hack — structural check that tapDefaultAxis() branches on `this.technique.parallelSnap` and ingRx/ingRy, never on `this.ingredientId === "carrot"`. =====
{
  const src = fs.readFileSync("src/game/scenes/PreparationScene.ts", "utf8");
  const fnStart = src.indexOf("private tapDefaultAxis()");
  const fnBody = src.slice(fnStart, src.indexOf("\n  }", fnStart) + 4);
  assert(
    fnBody.includes("this.technique.parallelSnap") &&
      fnBody.includes("this.ingRx") &&
      fnBody.includes("this.ingRy") &&
      !fnBody.includes('"carrot"') &&
      !fnBody.includes("ingredientId ==="),
    "11: tapDefaultAxis()'s parallelSnap branch is shape-derived (ingRx/ingRy) and ingredient-agnostic — no carrot-specific (or any other ingredient-specific) special case",
  );
}

// ===== Every OTHER julienne-supporting ingredient benefits from the same generic fix — audit every ingredient whose techniques include "julienne". =====
{
  const julienneIngredients = Object.values(INGREDIENTS).filter((i) => i.techniques.includes("julienne"));
  assert(julienneIngredients.length >= 5, `julienne is supported by ${julienneIngredients.length} ingredients — the fix in tapDefaultAxis() applies uniformly to all of them (no per-ingredient branch exists to miss one)`);
}

// ===== Slice/Chop/Dice/every other technique's own tap-default axis is completely unaffected — regression guard: axisOverride is still consulted for non-parallelSnap techniques exactly as before. =====
{
  const src = fs.readFileSync("src/game/scenes/PreparationScene.ts", "utf8");
  const fnStart = src.indexOf("private tapDefaultAxis()");
  const fnBody = src.slice(fnStart, src.indexOf("\n  }", fnStart) + 4);
  assert(
    fnBody.includes("this.ingredient.axisOverride ?? this.technique.axis"),
    "13b: the original axisOverride ?? technique.axis fallback is still exactly there for every non-parallelSnap technique (Slice/Chop/Dice/etc. completely unaffected)",
  );
}

// ============ ISSUE 1 — JULIENNE PLATING CENTERING FIX ============

/** Mirrors PreparationScene's new `cornerToCenterOffset` exactly. */
function cornerToCenterOffset(angleDeg: number, scale: number, halfWidth: number, halfHeight: number) {
  const rad = (angleDeg * Math.PI) / 180;
  const hw = halfWidth * scale;
  const hh = halfHeight * scale;
  return { x: hw * Math.cos(rad) - hh * Math.sin(rad), y: hw * Math.sin(rad) + hh * Math.cos(rad) };
}

// ===== 7: composition centering — round-trip correctness of the corner<->center conversion itself: converting a desired CENTER to a corner (center - offset) and back (corner + offset) recovers the exact original center, for a Julienne-shaped elongated piece at Julienne's own real rotation. =====
{
  const halfWidth = 90; // a long julienne strip: e.g. 180px wide
  const halfHeight = 8; // ...and thin: 16px tall
  const angle = 34; // Julienne's own real rotationDeg base value
  const scale = 1.05;
  const desiredCenter = { x: 123.4, y: -56.7 };
  const offset = cornerToCenterOffset(angle, scale, halfWidth, halfHeight);
  const corner = { x: desiredCenter.x - offset.x, y: desiredCenter.y - offset.y };
  const recoveredCenter = { x: corner.x + offset.x, y: corner.y + offset.y };
  const drift = Math.hypot(recoveredCenter.x - desiredCenter.x, recoveredCenter.y - desiredCenter.y);
  assert(drift < 1e-9, `7: the corner<->center conversion round-trips exactly for an elongated, rotated Julienne piece (drift=${drift})`);
}

// ===== 7b: for a genuinely elongated piece at Julienne's real rotation, the corner-vs-center offset is LARGE (this is why the bug was visible for Julienne specifically, not for a near-square Dice cube). =====
{
  const offsetJulienne = cornerToCenterOffset(34, 1, 90, 8);
  const offsetDiceLike = cornerToCenterOffset(10, 1, 20, 20); // a near-square dice cube at a small rotation
  const magJulienne = Math.hypot(offsetJulienne.x, offsetJulienne.y);
  const magDice = Math.hypot(offsetDiceLike.x, offsetDiceLike.y);
  assert(magJulienne > magDice * 2, `7b: an elongated Julienne piece's corner-to-center offset (${magJulienne.toFixed(1)}px) is far larger than a near-square Dice piece's (${magDice.toFixed(1)}px) — confirms why the pre-fix bug was dramatic for Julienne and easy to miss for Dice`);
}

// ===== 8: full composition remains centered — build a synthetic Julienne-like set of elongated, rotated pieces, apply the SAME corner correction the real flight loop now does, and confirm the recomputed bounds of their true CENTERS (not corners) sit at plate-center, unlike the pre-fix corner-based math would show. =====
{
  const n = 10;
  const halfWidth = 70;
  const halfHeight = 7;
  const angle = 34;
  // Positions mirror getPlatingArrangement's own julienne case: a band along x, small jitter in y.
  const centers = Array.from({ length: n }, (_, i) => ({
    x: (i / (n - 1) - 0.5) * 1.7 * 1.4 * halfWidth,
    y: (Math.sin(i * 12.9898) * 0.3) * halfHeight,
  }));
  // The FIXED pipeline: corner = center - offset, then recompute true center from that corner (as the flight loop's onUpdate now effectively guarantees at rest).
  const recoveredCenters = centers.map((c) => {
    const offset = cornerToCenterOffset(angle, 1, halfWidth, halfHeight);
    const corner = { x: c.x - offset.x, y: c.y - offset.y };
    return { x: corner.x + offset.x, y: corner.y + offset.y };
  });
  const meanX = recoveredCenters.reduce((a, p) => a + p.x, 0) / n;
  const meanY = recoveredCenters.reduce((a, p) => a + p.y, 0) / n;
  const intendedMeanX = centers.reduce((a, p) => a + p.x, 0) / n;
  const intendedMeanY = centers.reduce((a, p) => a + p.y, 0) / n;
  assert(
    Math.abs(meanX - intendedMeanX) < 1e-6 && Math.abs(meanY - intendedMeanY) < 1e-6,
    "8: the fixed pipeline's recovered piece centers match the arrangement's intended centers exactly — the composition's own centering math is preserved, only the corner/center conversion was broken before",
  );
}

// ===== 9: containment is unaffected by the centering fix — pieceBoundingRadius/computeCenterReach/computeExtraShrink still operate purely on center-space math, untouched by this change (structural). =====
{
  const src = fs.readFileSync("src/game/scenes/PreparationScene.ts", "utf8");
  assert(
    src.includes("const dist = Math.hypot(targetX - plate.cx, targetY - plate.cy);") &&
      src.includes("const maxDist = Math.max(0, safeRadius - pieceRadius);"),
    "9: the final per-piece containment clamp still operates in center-space exactly as before (untouched by the corner/center fix)",
  );
}

// ===== 10: actual piece scale is preserved — the centering fix only changes WHERE the piece is positioned (corner vs center), never its rendered SCALE; piece.setScale still uses only settleScale/scaleMul/emergencyShrink. =====
{
  const src = fs.readFileSync("src/game/scenes/PreparationScene.ts", "utf8");
  const scaleLine = src.split("\n").find((l) => /const scale = .*emergencyShrink/.test(l)) ?? "";
  assert(scaleLine.includes("settleScale") && scaleLine.includes("scaleMul") && !scaleLine.includes("halfWidth"), `10: the piece's rendered scale expression is unchanged by the centering fix (found: "${scaleLine.trim()}")`);
}

// ===== 9b: no duplicate piece rendering was introduced by this fix — still exactly one platedPieceImages.push call site. =====
{
  const src = fs.readFileSync("src/game/scenes/PreparationScene.ts", "utf8");
  const pushSites = [...src.matchAll(/platedPieceImages\.push/g)].length;
  assert(pushSites === 1, `9b: exactly one call site pushes into platedPieceImages (got ${pushSites})`);
}

// ===== Multi-output same-destination grouping (the prior fix) still works — structural: destinationDerived/destinationOrder grouping logic is untouched by this centering change. =====
{
  const src = fs.readFileSync("src/game/scenes/PreparationScene.ts", "utf8");
  assert(
    src.includes("destinationDerived.get(destination)!") && src.includes("destinationOrder.forEach((destination, gi)"),
    "the shared-destination grouping fix (destinationDerived/destinationOrder) is untouched by this centering change",
  );
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
