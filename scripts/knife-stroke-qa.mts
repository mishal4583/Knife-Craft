/**
 * KNIFE_STROKE_QA — how the knife moves when it cuts
 * (scenes/knifeProfile.ts tapCutRot / tapStrokePose / swipeKnifeDir, used
 * by PreparationScene's tap cut and swipe knife and by the coaching ghost).
 * The developer's rules:
 *
 *   A. Tap cut: the knife lies EXACTLY on the cut line — a horizontal cut
 *      gets a fully horizontal knife (tip right), a vertical cut a fully
 *      vertical knife (handle down, tip up); every other line, along it.
 *   B. Tap stroke: it snaps into that orientation, lands on the line, makes
 *      one short back-and-forth slice along it (never across it, never
 *      turning), the middle of its edge on the line; the cut is committed at
 *      the end of the stroke, within 0.2–0.35 s of the tap.
 *   C. Swipe: the knife follows the drag like a pointer — along the drag,
 *      TIP LEADING (drag right→left: the tip points and moves left), in
 *      every direction, turning continuously; the sharp edge stays on the
 *      lower side (never more than 100° from horizontal).
 *   D. Wiring: the tap cut, the swipe and the ghost all use these.
 *
 * Run: npx tsx scripts/knife-stroke-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import {
  swipeContactAlong,
  swipeKnifeDir,
  tapCutRot,
  tapStrokePose,
  TAP_SLICE_FRAC,
} from "../src/game/scenes/knifeProfile.ts";
import { lineAngleDeg } from "../src/game/CutGeometry.ts";
import { TAP_KNIFE, CHOP_KNIFE } from "../src/game/definitions.ts";

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

// A. Orientation.
assert(Math.abs(tapCutRot(0)) < EPS, "A1. horizontal cut → fully horizontal knife, tip right");
const v = tapCutRot(90);
assert(
  Math.abs(Math.cos(v)) < EPS && Math.sin(v) < 0,
  "A2. vertical cut → fully vertical knife, handle down, tip up",
);
assert(
  Math.abs(tapCutRot(-90) - v) < EPS && Math.abs(tapCutRot(180)) < EPS,
  "A3. the same line drawn either way gets the same knife",
);
const notOn: number[] = [];
for (let a = -180; a <= 180; a += 0.5) {
  if (Math.abs(Math.sin(tapCutRot(a) - rad(a))) > 1e-9) notOn.push(a);
}
const eBad: string[] = [];
for (const axis of ["h", "v"] as const)
  for (let sl = -3; sl <= 3; sl += 0.05) {
    const a = lineAngleDeg(axis, sl);
    if (Math.abs(Math.sin(tapCutRot(a) - rad(a))) > 1e-9) eBad.push(`${axis}:${sl.toFixed(2)}`);
  }
assert(
  notOn.length === 0 && eBad.length === 0,
  "A4. every cut line the game makes: the knife lies exactly on it",
  { notOn: notOn.slice(0, 5), eBad: eBad.slice(0, 5) },
);

// B. The tap stroke.
const tip = 120;
const centre = { x: 270, y: 480 };
const hop = 30;
const bad: string[] = [];
let forward = false;
let back = false;
let prevAlong = 0;
for (const a of [0, 90, 30, -60, 12]) {
  const rot = tapCutRot(a);
  const ux = Math.cos(rot);
  const uy = Math.sin(rot);
  for (let s = 0; s <= 1.0001; s += 0.02) {
    const p = tapStrokePose(centre, rot, tip, hop, s);
    if (Math.abs(p.rot - rot) > EPS) bad.push(`rot@${a}:${s}`);
    // Edge point under the middle of the blade, after landing (s ≥ 0.3).
    const mx = p.x + ux * tip * 0.5;
    const my = p.y + uy * tip * 0.5;
    const perp = Math.abs((mx - centre.x) * -uy + (my - centre.y) * ux);
    if (s >= 0.3 && perp > 1e-6) bad.push(`off-line@${a}:${s.toFixed(2)}`);
    const along = (mx - centre.x) * ux + (my - centre.y) * uy;
    if (s >= 0.3 && Math.abs(along) > tip * TAP_SLICE_FRAC + 1e-6) bad.push(`slide@${a}`);
    if (a === 0 && s > 0.3) {
      if (along > prevAlong + 1e-9) forward = true;
      if (along < prevAlong - 1e-9) back = true;
    }
    if (a === 0) prevAlong = along;
  }
  const end = tapStrokePose(centre, rot, tip, hop, 1);
  const start = tapStrokePose(centre, rot, tip, hop, 0);
  if (Math.abs(end.x + ux * tip * 0.5 - centre.x) > 1e-6) bad.push(`end@${a}`);
  if (!(start.y < end.y - hop * 0.9)) bad.push(`no-landing@${a}`);
}
assert(
  bad.length === 0,
  "B1. the knife never turns, lands on the line and stays on it",
  bad.slice(0, 6),
);
assert(forward && back, "B2. a short back-and-forth slice along the line (not a press)");
for (const [name, K] of [
  ["slice", TAP_KNIFE],
  ["chop", CHOP_KNIFE],
] as const) {
  const toCut = K.PREP_MS + K.PAUSE_MS + K.CUT_MS;
  assert(
    toCut >= 120 && toCut <= 350,
    `B3. ${name}: the cut lands at the end of the stroke, ${toCut} ms after the tap (≤ 0.35 s)`,
  );
}

// C. Swipe — tip leading in every direction.
const dirs: [string, number, number][] = [
  ["right→left", -1, 0],
  ["left→right", 1, 0],
  ["top→bottom", 0, 1],
  ["bottom→top", 0, -1],
  ["down-left", -1, 1],
  ["up-right", 1, -1],
  ["down-right", 1, 1],
  ["up-left", -1, -1],
];
const cBad: string[] = [];
for (const [name, dx, dy] of dirs) {
  for (const cur of [0, rad(80), rad(-80), rad(30)]) {
    const { rot, sign } = swipeKnifeDir(dx, dy, cur);
    const len = Math.hypot(dx, dy);
    const tx = sign * Math.cos(rot);
    const ty = sign * Math.sin(rot);
    if (Math.abs(tx - dx / len) > 1e-9 || Math.abs(ty - dy / len) > 1e-9)
      cBad.push(`${name} from ${Math.round((cur * 180) / Math.PI)}°`);
    if (Math.abs(rot) > rad(100) + 1e-9) cBad.push(`${name}: edge on top`);
  }
}
assert(
  cBad.length === 0,
  "C1. drag in any direction: the knife's tip points and leads that way",
  cBad,
);
// A drag curving from right through down to left turns the knife continuously.
let cur = 0;
let maxStep = 0;
let edgeTop = false;
for (let deg = 0; deg <= 180; deg += 3) {
  const { rot, rebase } = swipeKnifeDir(Math.cos(rad(deg)), Math.sin(rad(deg)), cur);
  const base = cur + rebase;
  maxStep = Math.max(maxStep, Math.abs(rot - base));
  if (Math.abs(rot) > rad(100) + 1e-9) edgeTop = true;
  cur = rot;
}
assert(
  maxStep <= rad(3) + 1e-9 && !edgeTop,
  "C2. a curving drag turns the knife continuously, edge kept underneath",
  { maxStepDeg: (maxStep * 180) / Math.PI },
);
assert(
  swipeContactAlong(tip) === tip * 0.5,
  "C3. the middle of the edge is under the finger (the tip ahead of it)",
);

// D. Wiring.
const scene = read("src/game/scenes/PreparationScene.ts");
const ghost = read("src/game/scenes/coachGhost.ts");
const i = scene.indexOf("private runTapCut(");
const tapCut = scene.slice(i, i + 7000);
assert(
  /tapCutRot\(cutAngleDeg\)/.test(tapCut) && /tapStrokePose\(/.test(tapCut),
  "D1. the tap cut uses tapCutRot + tapStrokePose (no per-cut tilt)",
);
const j = scene.indexOf("private updateKnifeDirection(");
assert(
  /swipeKnifeDir\(dx, dy/.test(scene.slice(j, j + 3000)),
  "D2. the swipe knife uses swipeKnifeDir",
);
assert(
  /tapCutRot\(/.test(ghost) && /tapStrokePose\(/.test(ghost) && /swipeContactAlong\(/.test(ghost),
  "D3. the coaching ghost shows the same tap and swipe",
);

console.log(
  failures === 0 ? "\nKNIFE STROKE QA: ALL PASS" : `\nKNIFE STROKE QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
