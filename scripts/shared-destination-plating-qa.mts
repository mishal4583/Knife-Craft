/**
 * SHARED_DESTINATION_PLATING_QA — task: "shared-destination plating
 * composition fix". Run like the project's other focused QA scripts:
 *   npx tsx scripts/shared-destination-plating-qa.mts
 *
 * Root cause (see the task's final report for the full trace): startPlating()
 * grouped plated pieces by `ingredientId` alone. That key can neither (a)
 * split ONE ingredient's two independently-prepared instances across two
 * REAL destinations (a chicken sliced for the plate and a fresh one diced
 * for the bowl both being "chicken" got dumped onto one ingredient-keyed
 * plate) nor (b) combine several DIFFERENT ingredients that genuinely share
 * one destination (three toppings for one shared antipasto plate rendered
 * as three separate mini-plates). The fix threads `PrepStep.destination`
 * (already-authoritative recipe/level data, just never forwarded past
 * Preparation.tsx before this task) through platedPieceMeta and regroups:
 * INSTANCE (one per closeOutCurrentIngredient call, i.e. one per
 * independently-prepared ingredient/technique — untouched, still exactly
 * what the chainBreak fix produces) -> DESTINATION (one plate per distinct
 * destination string, which may contain 1+ instances combined into one
 * composition).
 *
 * This script mirrors that two-level grouping/composition pipeline in pure
 * functions (no Phaser dependency), the same style plating-system-qa.mts's
 * own buildRawComposition/runFullPipeline already use, so it can assert
 * exact geometric properties without a browser.
 */
import {
  getPlatingArrangement,
  seedFor,
  calculateCompositionBounds,
  fitCompositionToSafeRadius,
  computeFoodSafeRadius,
  computeExtraShrink,
  type CompositionPiece,
} from "../src/game/plating/platingArrangement.ts";
import type { TechniqueId } from "../src/game/definitions.ts";
import * as fs from "node:fs";
import { execSync } from "node:child_process";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

// ===== 1: PrepStep (events.ts) carries `destination` — the exact field the fix threads through; a structural regression guard for the root cause itself (destination data existed but was dropped before it reached the scene). =====
{
  const src = fs.readFileSync("src/game/events.ts", "utf8");
  const prepStepBody = src.slice(src.indexOf("export type PrepStep"), src.indexOf("export type StartPreparationConfig"));
  assert(prepStepBody.includes("destination?: string"), "1: PrepStep carries an optional destination string");
}

// ===== 2: Preparation.tsx forwards PreparationStep.destination into the scene-facing PrepStep — the exact one-line fix for the root cause. =====
{
  const src = fs.readFileSync("src/components/kc/game/Preparation.tsx", "utf8");
  assert(
    /s\.destination\s*\?\s*\{\s*destination:\s*s\.destination\s*\}/.test(src),
    "2: Preparation.tsx copies s.destination into the mapped PrepStep (previously dropped)",
  );
}

// ===== Mirror of PreparationScene.startPlating()'s two-level grouping (instance -> destination), pure/no-Phaser, for geometric assertions below. =====
type Meta = { ingredientId: string; technique: TechniqueId; destination: string; instanceSeq: number };

function groupByDestination(metas: Meta[]) {
  const instanceOrder: number[] = [];
  const instanceMeta = new Map<number, Meta>();
  for (const m of metas) {
    if (!instanceMeta.has(m.instanceSeq)) {
      instanceOrder.push(m.instanceSeq);
      instanceMeta.set(m.instanceSeq, m);
    }
  }
  const destinationOrder: string[] = [];
  const destinationInstances = new Map<string, number[]>();
  for (const instanceSeq of instanceOrder) {
    const destination = instanceMeta.get(instanceSeq)!.destination;
    if (!destinationInstances.has(destination)) {
      destinationOrder.push(destination);
      destinationInstances.set(destination, []);
    }
    destinationInstances.get(destination)!.push(instanceSeq);
  }
  return { destinationOrder, destinationInstances };
}

type InstanceSpec = { instanceSeq: number; ingredientId: string; technique: TechniqueId; count: number; avgRadius: number };

/** Mirrors startPlating()'s per-destination 3-pass pipeline: local composition per instance -> slot offsets -> ONE combined bounds/fit/pull. */
function runDestinationPipeline(instances: InstanceSpec[], safeRadius: number) {
  const instanceLocal = instances.map((inst) => {
    const seed = seedFor(`${inst.ingredientId}#${inst.instanceSeq}`);
    const localPieces = Array.from({ length: inst.count }, (_, localIndex) => {
      const a = getPlatingArrangement({ technique: inst.technique, index: localIndex, count: inst.count, seed });
      const rawX = a.xFrac * inst.avgRadius;
      const rawY = a.yFrac * inst.avgRadius;
      const pieceRadius = inst.avgRadius * a.scale;
      const emergencyShrink = computeExtraShrink(safeRadius, pieceRadius);
      return { rawX, rawY, radius: pieceRadius * emergencyShrink, instanceSeq: inst.instanceSeq };
    });
    const { centerX, centerY, requiredRadius } = calculateCompositionBounds(
      localPieces.map((p) => ({ x: p.rawX, y: p.rawY, radius: p.radius })),
    );
    return { localPieces, centerX, centerY, requiredRadius };
  });

  const subCount = instanceLocal.length;
  const subRows = Math.max(1, Math.ceil(subCount / 2));
  const subRemainder = subCount - 2 * (subRows - 1);
  const maxSubRadius = Math.max(1, ...instanceLocal.map((s) => s.requiredRadius));
  const subSpacing = maxSubRadius * 2 * 1.12;
  const combined: { x: number; y: number; radius: number; instanceSeq: number }[] = [];
  instanceLocal.forEach((sub, si) => {
    let dx = 0;
    let dy = 0;
    if (subCount > 1) {
      const row = si < subRemainder ? 0 : 1 + Math.floor((si - subRemainder) / 2);
      const rowCount = row === 0 ? subRemainder : 2;
      const indexInRow = row === 0 ? si : (si - subRemainder) % 2;
      dx = (indexInRow - (rowCount - 1) / 2) * subSpacing;
      dy = (row - (subRows - 1) / 2) * subSpacing;
    }
    for (const p of sub.localPieces) {
      combined.push({ x: p.rawX - sub.centerX + dx, y: p.rawY - sub.centerY + dy, radius: p.radius, instanceSeq: p.instanceSeq });
    }
  });

  const { centerX, centerY, requiredRadius } = calculateCompositionBounds(combined);
  const fitScale = fitCompositionToSafeRadius(requiredRadius, safeRadius);
  const final = combined.map((p) => {
    let x = (p.x - centerX) * fitScale;
    let y = (p.y - centerY) * fitScale;
    const dist = Math.hypot(x, y);
    const maxDist = Math.max(0, safeRadius - p.radius);
    if (dist > maxDist && dist > 0) {
      const pull = maxDist / dist;
      x *= pull;
      y *= pull;
    }
    return { x, y, radius: p.radius, instanceSeq: p.instanceSeq };
  });
  return { fitScale, final };
}

// ===== 3: same ingredient + same destination -> ONE plating group. =====
{
  const metas: Meta[] = [
    { ingredientId: "chicken", technique: "slice", destination: "Plate", instanceSeq: 0 },
    { ingredientId: "chicken", technique: "dice", destination: "Plate", instanceSeq: 1 },
  ];
  const { destinationOrder } = groupByDestination(metas);
  assert(destinationOrder.length === 1, "3: same ingredient, same destination -> exactly one plating group");
}

// ===== 4: same ingredient + different destinations -> separate plating groups (this is the literal "Chicken, The Last Branch" shape: slice->Plate, dice->Bowl). =====
{
  const metas: Meta[] = [
    { ingredientId: "chicken", technique: "slice", destination: "Plate", instanceSeq: 0 },
    { ingredientId: "chicken", technique: "dice", destination: "Bowl", instanceSeq: 1 },
  ];
  const { destinationOrder, destinationInstances } = groupByDestination(metas);
  assert(
    destinationOrder.length === 2 && destinationInstances.get("Plate")!.length === 1 && destinationInstances.get("Bowl")!.length === 1,
    "4: same ingredient, different destinations -> two separate plating groups, never merged",
  );
}

// ===== 5: different ingredients + same destination -> ONE plating group (the "Family Antipasto"/Example 6 shape). =====
{
  const metas: Meta[] = [
    { ingredientId: "bread", technique: "slice", destination: "Plate", instanceSeq: 0 },
    { ingredientId: "tomato", technique: "dice", destination: "Plate", instanceSeq: 1 },
    { ingredientId: "mozzarella", technique: "slice", destination: "Plate", instanceSeq: 2 },
  ];
  const { destinationOrder, destinationInstances } = groupByDestination(metas);
  assert(
    destinationOrder.length === 1 && destinationInstances.get("Plate")!.length === 3,
    "5: three different ingredients sharing one destination -> one combined plating group",
  );
}

// ===== 6: different ingredients + different destinations -> separate groups. =====
{
  const metas: Meta[] = [
    { ingredientId: "carrot", technique: "julienne", destination: "Plate", instanceSeq: 0 },
    { ingredientId: "onion", technique: "dice", destination: "Bowl", instanceSeq: 1 },
    { ingredientId: "garlic", technique: "rockMince", destination: "Cup", instanceSeq: 2 },
  ];
  const { destinationOrder } = groupByDestination(metas);
  assert(destinationOrder.length === 3, "6: different ingredients, different destinations -> three separate plating groups");
}

// ===== 7: same ingredient + different techniques + same destination -> one combined plate (§16 item 5). =====
{
  const safeRadius = 90;
  const { fitScale, final } = runDestinationPipeline(
    [
      { instanceSeq: 0, ingredientId: "chicken", technique: "slice", count: 12, avgRadius: 18 },
      { instanceSeq: 1, ingredientId: "chicken", technique: "dice", count: 6, avgRadius: 20 },
    ],
    safeRadius,
  );
  const bothInstancesPresent = new Set(final.map((p) => p.instanceSeq)).size === 2;
  assert(final.length === 18 && bothInstancesPresent && fitScale > 0, "7: two same-ingredient/different-technique instances combine into one 18-piece composition on one plate");
}

// ===== 8: the combined composition is centered — recomputing bounds on the FINAL positions puts the centroid within a small tolerance of plate-center (0,0). =====
{
  const safeRadius = 100;
  const { final } = runDestinationPipeline(
    [
      { instanceSeq: 0, ingredientId: "chicken", technique: "slice", count: 12, avgRadius: 18 },
      { instanceSeq: 1, ingredientId: "chicken", technique: "dice", count: 6, avgRadius: 20 },
    ],
    safeRadius,
  );
  const recomputed = calculateCompositionBounds(final);
  const drift = Math.hypot(recomputed.centerX, recomputed.centerY);
  assert(drift < 0.5, `8: the combined composition's own recomputed center sits within 0.5px of plate-center (drift=${drift.toFixed(3)})`);
}

// ===== 9: the combined composition remains fully contained — every piece's real edge stays inside the plate's safe radius, even under a harsh combined mix (heterogeneous sizes across instances). =====
{
  const safeRadius = 60;
  const { final } = runDestinationPipeline(
    [
      { instanceSeq: 0, ingredientId: "bread", technique: "slice", count: 12, avgRadius: 35 },
      { instanceSeq: 1, ingredientId: "tomato", technique: "dice", count: 6, avgRadius: 25 },
      { instanceSeq: 2, ingredientId: "mozzarella", technique: "slice", count: 8, avgRadius: 20 },
    ],
    safeRadius,
  );
  const allContained = final.every((p) => Math.hypot(p.x, p.y) + p.radius <= safeRadius + 1e-6);
  assert(allContained, "9: a 3-instance combined plate (bread+tomato+mozzarella) keeps every piece inside the plate's safe radius");
}

// ===== 10: actual piece sizes are preserved in the combined pipeline too — no group-wide shrink was reintroduced; a normal piece's radius survives untouched even when the destination's overall spread needed real compression. =====
{
  const safeRadius = 55;
  const instances: InstanceSpec[] = [
    { instanceSeq: 0, ingredientId: "chicken", technique: "dice", count: 9, avgRadius: 30 },
    { instanceSeq: 1, ingredientId: "chicken", technique: "slice", count: 8, avgRadius: 28 },
  ];
  // Recompute each piece's own pre-fit radius the same way runDestinationPipeline does internally, to compare against the FINAL radius it returns.
  let allPreserved = true;
  for (const inst of instances) {
    const seed = seedFor(`${inst.ingredientId}#${inst.instanceSeq}`);
    for (let i = 0; i < inst.count; i++) {
      const a = getPlatingArrangement({ technique: inst.technique, index: i, count: inst.count, seed });
      const pieceRadius = inst.avgRadius * a.scale;
      const emergencyShrink = computeExtraShrink(safeRadius, pieceRadius);
      if (emergencyShrink !== 1) allPreserved = false; // sanity: this scenario shouldn't need the emergency case at all
    }
  }
  const { fitScale } = runDestinationPipeline(instances, safeRadius);
  assert(allPreserved && fitScale < 1, `10: every normal piece's own radius is untouched by emergencyShrink even though the combined plate's fitScale had to compress to ${fitScale.toFixed(2)}`);
}

// ===== 11: determinism — the same instance/destination inputs always produce the same combined composition. =====
{
  const instances: InstanceSpec[] = [
    { instanceSeq: 0, ingredientId: "carrot", technique: "julienne", count: 10, avgRadius: 15 },
    { instanceSeq: 1, ingredientId: "radish", technique: "slice", count: 8, avgRadius: 12 },
  ];
  const a = runDestinationPipeline(instances, 95);
  const b = runDestinationPipeline(instances, 95);
  assert(JSON.stringify(a) === JSON.stringify(b), "11: the combined-destination pipeline is deterministic for the same inputs");
}

// ===== 12: no Math.random() in the actual code this fix touched — startPlating() and closeOutCurrentIngredient() (PreparationScene.ts has pre-existing, unrelated Math.random() elsewhere, e.g. peel-juice particle flourish — not part of this fix, not asserted here). =====
{
  const src = fs.readFileSync("src/game/scenes/PreparationScene.ts", "utf8");
  const startPlatingBody = src.slice(src.indexOf("private startPlating("), src.indexOf("private createPlatingThickness"));
  const closeOutStart = src.indexOf("private closeOutCurrentIngredient(");
  const closeOutBody = src.slice(closeOutStart, src.indexOf("private ", closeOutStart + 50));
  assert(
    !startPlatingBody.includes("Math.random(") && !closeOutBody.includes("Math.random("),
    "12: no Math.random() in startPlating()/closeOutCurrentIngredient() — the destination grouping stays fully deterministic",
  );
}

// ===== 13: no duplicate piece rendering — platedPieceImages still has exactly one push call site (unchanged from the multi-instance fix's own check), and the new instance/destination grouping never clones an Image. =====
{
  const src = fs.readFileSync("src/game/scenes/PreparationScene.ts", "utf8");
  const pushSites = [...src.matchAll(/platedPieceImages\.push/g)].length;
  const noCloneCalls = !/\.clone\(\)|this\.add\.image\([^)]*piece\.texture/.test(
    src.slice(src.indexOf("private startPlating"), src.indexOf("private createPlatingThickness")),
  );
  assert(pushSites === 1 && noCloneCalls, `13: exactly one call site pushes into platedPieceImages (${pushSites}) and startPlating never clones/re-creates a piece Image`);
}

// ===== 14: PreparedOutput/organizationManager/organizationTypes are completely untouched — the plating layer only reads platedPieceMeta (a purely visual, separate array), never PreparedOutput/assignedTo[]. =====
{
  let diffStat = "";
  try {
    diffStat = execSync(
      "git diff --name-only HEAD -- src/game/organization/organizationManager.ts src/game/organization/organizationTypes.ts",
      { cwd: process.cwd() },
    ).toString();
  } catch {
    diffStat = "<git unavailable>";
  }
  const src = fs.readFileSync("src/game/scenes/PreparationScene.ts", "utf8");
  // Comments are free to explain the boundary (several already do — "nothing
  // about PreparedOutput/organizationManager is touched") — only actual
  // code usage (an import, a type annotation, or a real `.assignedTo`
  // property access) would mean the plating layer started depending on the
  // organization layer, which it must not.
  const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert(
    diffStat.trim() === "" && !codeOnly.includes("PreparedOutput") && !codeOnly.includes(".assignedTo"),
    `14: organizationManager.ts/organizationTypes.ts are untouched, and PreparationScene.ts's actual CODE never references PreparedOutput/assignedTo[] — the plating fix is visual-only (diff: "${diffStat.trim()}")`,
  );
}

// ===== 15: multiple genuinely different destinations in the same recipe still produce that many separate plates — the fix doesn't collapse everything to one plate by accident. Uses the real "Chicken, the Full Kitchen" recipe shape (3 destinations). =====
{
  const metas: Meta[] = [
    { ingredientId: "chicken", technique: "slice", destination: "Plate", instanceSeq: 0 },
    { ingredientId: "chicken", technique: "julienne", destination: "Bowl", instanceSeq: 1 },
    { ingredientId: "chicken", technique: "dice", destination: "Cup", instanceSeq: 2 },
  ];
  const { destinationOrder } = groupByDestination(metas);
  assert(destinationOrder.length === 3, "15: a 3-destination recipe (plate/bowl/cup) still produces three separate plates, not collapsed to one");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
