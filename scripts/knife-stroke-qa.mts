/**
 * KNIFE_STROKE_QA — how the knife looks and moves when it cuts
 * (scenes/knifeProfile.ts knifeTipDir / poseForTipDir / tapStrokePose /
 * topViewProfile, used by PreparationScene's tap cut, swipe knife and draw,
 * and by the coaching ghost). The reference is the developer's point-of-view
 * photos of a cook slicing a tomato. The knife is held in the right hand at
 * the lower right, lies along the cut, and is seen from above standing on
 * its edge.
 *
 *   A. Tap: the knife lies exactly on the cut line, held from the right hand.
 *      - vertical cut: tip up, handle down;
 *      - horizontal cut: tip left, handle right;
 *      - "\" diagonal: tip upper left;
 *      - the tip never points at the cook's hand.
 *   B. It is drawn with the tip that way round. The rotation stays within a
 *      quarter turn; a leftward tip is mirrored, never upside down.
 *   C. The tap stroke: it snaps on, lands on the line, makes a short
 *      back-and-forth slice along it without turning, and the cut is
 *      committed at the end of the stroke, within 0.35 s.
 *   D. Swipe: the knife lies along the drag, held from the right hand. Right
 *      to left is a push, so the tip leads; left to right is a pull. Down or
 *      up, the knife is vertical, tip up. It holds steady near the tie.
 *   E. Seen from above while cutting: the blade is foreshortened to
 *      CUT_SQUASH (it stands on its edge, so the flat face is not what
 *      shows), the handle stays round, and at rest it lies flat.
 *   F. Wiring: the tap cut, the swipe, the drawing and the ghost all use these.
 *
 * Run: npx tsx scripts/knife-stroke-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import {
  CUT_SQUASH,
  knifeProfile,
  knifeTipDir,
  poseForTipDir,
  swipeContactAlong,
  tapStrokePose,
  topViewProfile,
  TAP_SLICE_FRAC,
} from "../src/game/scenes/knifeProfile.ts";
import { lineAngleDeg } from "../src/game/CutGeometry.ts";
import { TAP_KNIFE, CHOP_KNIFE } from "../src/game/definitions.ts";
import { knifeOrDefault, DEFAULT_KNIFE_ID } from "../src/game/knives/knifeDefinitions.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f: string) => fs.readFileSync(path.resolve(ROOT, f), "utf8");
let failures = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`ok   ${label}`);
}
const EPS = 1e-9;
const rad = (d: number) => (d * Math.PI) / 180;
const near = (a: number, b: number) =>
  Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 1e-6;

// A. Tap orientation.
assert(
  near(knifeTipDir(rad(90)), rad(-90)) && near(knifeTipDir(rad(-90)), rad(-90)),
  "A1. vertical cut: tip up, handle down (either way the line runs)",
);
assert(
  near(knifeTipDir(0), Math.PI) && near(knifeTipDir(Math.PI), Math.PI),
  "A2. horizontal cut: tip left, handle right (the right hand)",
);
assert(
  near(knifeTipDir(rad(45)), rad(-135)),
  "A3. a \\ diagonal: tip upper left, handle lower right",
);
const aBad: string[] = [];
for (let a = -180; a <= 180; a += 0.5) {
  const d = knifeTipDir(rad(a));
  if (Math.abs(Math.sin(d - rad(a))) > 1e-9) aBad.push(`${a}: not on line`);
  if (Math.cos(d) * -0.6 + Math.sin(d) * -0.8 < -1e-9) aBad.push(`${a}: tip at the hand`);
}
for (const axis of ["h", "v"] as const)
  for (let sl = -3; sl <= 3; sl += 0.05) {
    const a = lineAngleDeg(axis, sl);
    if (Math.abs(Math.sin(knifeTipDir(rad(a)) - rad(a))) > 1e-9)
      aBad.push(`${axis}:${sl.toFixed(2)}`);
  }
assert(
  aBad.length === 0,
  "A4. every cut line the game makes: the knife on it, tip away from the hand",
  aBad.slice(0, 5),
);

// B. Drawn the right way round.
const bBad: number[] = [];
for (let d = -180; d < 180; d += 1) {
  const { rot, sign } = poseForTipDir(rad(d));
  if (
    !near(Math.atan2(sign * Math.sin(rot), sign * Math.cos(rot)), rad(d)) ||
    Math.abs(rot) > Math.PI / 2 + 1e-9
  )
    bBad.push(d);
}
assert(
  bBad.length === 0,
  "B. the drawn tip points along the tip direction; a leftward tip is mirrored, never upside down",
  bBad.slice(0, 5),
);

// C. The tap stroke.
const tip = 120;
const centre = { x: 270, y: 480 };
const hop = 30;
const cBad: string[] = [];
let forward = false;
let back = false;
for (const a of [0, 90, 45, -60, 12]) {
  const d = knifeTipDir(rad(a));
  const ux = Math.cos(d);
  const uy = Math.sin(d);
  let prev = 0;
  for (let s = 0; s <= 1.0001; s += 0.02) {
    const p = tapStrokePose(centre, d, tip, hop, s);
    const want = poseForTipDir(d);
    if (Math.abs(p.rot - want.rot) > EPS || p.sign !== want.sign) cBad.push(`turns@${a}`);
    const mx = p.x + ux * tip * 0.5;
    const my = p.y + uy * tip * 0.5;
    const perp = Math.abs((mx - centre.x) * -uy + (my - centre.y) * ux);
    const along = (mx - centre.x) * ux + (my - centre.y) * uy;
    if (s >= 0.3 && perp > 1e-6) cBad.push(`off-line@${a}:${s.toFixed(2)}`);
    if (s >= 0.3 && Math.abs(along) > tip * TAP_SLICE_FRAC + 1e-6) cBad.push(`slide@${a}`);
    if (a === 0 && s > 0.3) {
      if (along > prev + 1e-9) forward = true;
      if (along < prev - 1e-9) back = true;
    }
    prev = along;
  }
  const start = tapStrokePose(centre, d, tip, hop, 0);
  const end = tapStrokePose(centre, d, tip, hop, 1);
  if (!(start.y < end.y - hop * 0.9)) cBad.push(`no-landing@${a}`);
}
assert(
  cBad.length === 0,
  "C1. the knife lands on the line and stays on it, never turning",
  cBad.slice(0, 6),
);
assert(forward && back, "C2. a short back-and-forth slice along the line");
for (const [name, K] of [
  ["slice", TAP_KNIFE],
  ["chop", CHOP_KNIFE],
] as const) {
  const toCut = K.PREP_MS + K.PAUSE_MS + K.CUT_MS;
  assert(
    toCut >= 120 && toCut <= 350,
    `C3. ${name}: the cut lands at the end of the stroke, ${toCut} ms after the tap`,
  );
}

// D. Swipe.
const drag = (dx: number, dy: number, prev?: number) => knifeTipDir(Math.atan2(dy, dx), prev);
const dRL = drag(-1, 0);
assert(
  near(dRL, Math.PI),
  "D1. drag right → left: tip left, so the tip leads the way the finger moves (a push cut)",
);
assert(
  near(drag(1, 0), Math.PI),
  "D2. drag left → right: same grip, tip left, handle right (a pull cut)",
);
assert(
  near(drag(0, 1), rad(-90)) && near(drag(0, -1), rad(-90)),
  "D3. drag up or down: the knife vertical, tip up, handle down",
);
const dBad: string[] = [];
for (let a = -180; a < 180; a += 1) {
  const d = drag(Math.cos(rad(a)), Math.sin(rad(a)));
  if (Math.abs(Math.sin(d - rad(a))) > 1e-9) dBad.push(`${a}`);
}
assert(dBad.length === 0, "D4. the knife always lies along the drag", dBad.slice(0, 5));
// Near the tie (a line square to "away from the hand") it keeps its way round.
const tie = Math.atan2(-0.6, 0.8); // up-right shallow line
const held = drag(Math.cos(tie + 0.05), Math.sin(tie + 0.05), tie - 0.05);
const held2 = drag(Math.cos(tie - 0.05), Math.sin(tie - 0.05), held);
const free1 = drag(Math.cos(tie + 0.05), Math.sin(tie + 0.05));
const free2 = drag(Math.cos(tie - 0.05), Math.sin(tie - 0.05));
assert(
  Math.cos(held - held2) > 0.9 && Math.cos(free1 - free2) < -0.9,
  "D5. near the tie the knife keeps its way round (without that it would flip 180°)",
);
assert(swipeContactAlong(tip) === tip * 0.5, "D6. the middle of the edge is under the finger");

// E. Seen from above.
const prof = knifeProfile(knifeOrDefault(DEFAULT_KNIFE_ID).animation.blade, 540);
const top = topViewProfile(prof, CUT_SQUASH);
const height = (pts: { y: number }[]) =>
  Math.max(...pts.map((q) => q.y)) - Math.min(...pts.map((q) => q.y));
assert(
  CUT_SQUASH >= 0.3 &&
    CUT_SQUASH <= 0.6 &&
    Math.abs(height(top.outline) / height(prof.outline) - CUT_SQUASH) < 1e-6,
  `E1. while cutting the blade is foreshortened to ${CUT_SQUASH} (stood on its edge, seen from above)`,
);
assert(height(top.handle) / height(prof.handle) >= 0.8, "E2. the handle stays round");
assert(topViewProfile(prof, 1) === prof, "E3. at rest the knife lies flat (full profile)");
assert(
  Math.max(...top.cuttingEdge.map((q) => Math.abs(q.y))) <=
    Math.max(...prof.cuttingEdge.map((q) => Math.abs(q.y))) * CUT_SQUASH + 1e-6 &&
    top.cuttingEdge.slice(0, 2).every((q) => q.y === 0),
  "E4. the edge stays on the cut line",
);

// F. Wiring.
const scene = read("src/game/scenes/PreparationScene.ts");
const ghost = read("src/game/scenes/coachGhost.ts");
const i = scene.indexOf("private runTapCut(");
const tapCut = scene.slice(i, i + 8000);
const h = scene.indexOf("private cutStrokeFor(");
const stroke = scene.slice(h, scene.indexOf("private layKnifeDown(", h));
assert(
  /this\.cutStrokeFor\(cut, \{ x, y \}\)/.test(tapCut) &&
    /targetSquash = CUT_SQUASH/.test(tapCut) &&
    /knifeTipDir\(/.test(stroke) &&
    /tapStrokePose\(/.test(stroke),
  "F1. the tap cut: knifeTipDir + tapStrokePose (cutStrokeFor), stood on its edge",
);
const j = scene.indexOf("private updateKnifeDirection(");
assert(
  /knifeTipDir\(Math\.atan2\(dy, dx\)/.test(scene.slice(j, j + 3000)),
  "F2. the swipe knife uses knifeTipDir",
);
assert(
  /topViewProfile\(knifeProfile\(/.test(scene),
  "F3. the knife is drawn through topViewProfile",
);
assert(
  /knifeTipDir\(/.test(ghost) && /tapStrokePose\(/.test(ghost) && /topViewProfile\(/.test(ghost),
  "F4. the coaching ghost shows the same knife and motion",
);

console.log(
  failures === 0 ? "\nKNIFE STROKE QA: ALL PASS" : `\nKNIFE STROKE QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
