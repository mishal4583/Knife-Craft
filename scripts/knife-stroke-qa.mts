/**
 * KNIFE_STROKE_QA — the knife cuts with its sharp edge, like a cook's
 * slicing stroke (scenes/knifeProfile.ts cutContactRot / cutStrokePose,
 * used by PreparationScene's tap cut and steep swipe and by the coaching
 * ghost). Reference: a chef slicing a tomato — the knife diagonal, the edge
 * entering the food, the hand at the handle end.
 *
 *   A. At every cut angle the sharp edge faces down the screen, into the food.
 *   B. A steep (vertical) cut is crossed DIAGONALLY: the knife is neither
 *      upright along the line nor flat across it; handle at the lower left.
 *   C. A flat cut: the knife lies nearly along the line (≤ 14° off it).
 *   D. The pivot is the handle end: every stroke pose turns about the heel,
 *      which sits behind the cutting point toward the handle.
 *   E. The stroke is a slice: the cutting point travels from above the food
 *      to the cut (edge first), the knife rocks down about the pivot (it
 *      rotates, not just translates) and slides forward along its length.
 *   F. Wiring: the tap cut, the steep swipe and the ghost all use it.
 *
 * Run: npx tsx scripts/knife-stroke-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import {
  cutContactRot,
  cutStrokePose,
  STROKE_ROCK_DEG,
  swipeContactAlong,
} from "../src/game/scenes/knifeProfile.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f: string) => fs.readFileSync(path.resolve(ROOT, f), "utf8");
let failures = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`ok   ${label}`);
}

const deg = (r: number) => (r * 180) / Math.PI;
/** The acute angle (deg) between the knife and a line at `lineDeg`. */
const offLine = (rot: number, lineDeg: number) => {
  const d = Math.abs(deg(rot) - lineDeg) % 180;
  return d > 90 ? 180 - d : d;
};
const norm = (a: number) => {
  let x = ((a % 180) + 180) % 180;
  if (x > 90) x -= 180;
  return x;
};

const badA: number[] = [];
const badB: number[] = [];
const badC: number[] = [];
for (let a = -180; a <= 180; a += 0.5) {
  const rot = cutContactRot(a);
  // The edge is local +y; on screen that is (-sin rot, cos rot). Down = cos > 0.
  if (!(Math.cos(rot) > 0.15)) badA.push(a);
  const steep = Math.abs(norm(a)) > 45;
  const off = offLine(rot, a);
  if (steep && !(off >= 30 - 1e-6 && off <= 60 + 1e-6)) badB.push(a);
  if (!steep && !(off <= 14.001)) badC.push(a);
}
assert(
  badA.length === 0,
  "A. the sharp edge faces down into the food at every cut angle",
  badA.slice(0, 8),
);
assert(
  badB.length === 0,
  "B. a steep cut is crossed diagonally (30°–60° off the line, never upright or flat)",
  badB.slice(0, 8),
);
assert(
  badC.length === 0,
  "C. a flat cut: the knife lies nearly along it (≤ 14°)",
  badC.slice(0, 8),
);
const v = cutContactRot(90);
assert(
  deg(v) <= -30 && deg(v) >= -60,
  "B2. a vertical cut (bread): the knife is diagonal, tip up-right, handle lower left",
  deg(v),
);

// D/E. A stroke onto a vertical cut.
const tip = 120;
const from = { x: 216, y: 300 };
const to = { x: 200, y: 480 };
const rot = cutContactRot(90);
const contactAt = (k: number) => {
  const p = cutStrokePose(from, to, rot, tip, k);
  const along = tip * (0.62 - 0.22 * k);
  return { p, c: { x: p.x + Math.cos(p.rot) * along, y: p.y + Math.sin(p.rot) * along }, along };
};
const s0 = contactAt(0);
const s1 = contactAt(1);
assert(
  Math.hypot(s0.c.x - from.x, s0.c.y - from.y) < 1e-6 &&
    Math.hypot(s1.c.x - to.x, s1.c.y - to.y) < 1e-6,
  "E1. the edge's cutting point goes from above the food to the cut (the edge meets it)",
);
assert(
  Math.abs(deg(s1.p.rot - s0.p.rot) - STROKE_ROCK_DEG) < 1e-6 && STROKE_ROCK_DEG >= 8,
  "E2. the knife rocks down about its pivot during the stroke (it rotates, not only moves)",
  deg(s1.p.rot - s0.p.rot),
);
assert(s1.along < s0.along, "E3. it slides forward along its length (a slice, not a press)");
let pivotBehind = true;
for (let k = 0; k <= 1.08; k += 0.04) {
  const { p, c, along } = contactAt(Math.min(k, 1));
  // The pivot sits `along` px behind the cutting point, toward the handle.
  const back = (c.x - p.x) * Math.cos(p.rot) + (c.y - p.y) * Math.sin(p.rot);
  if (!(Math.abs(back - along) < 1e-6 && along > 0 && along < tip)) pivotBehind = false;
}
assert(
  pivotBehind,
  "D. every pose turns about the pivot at the handle end, behind the cutting point",
);
assert(
  s1.p.x < s1.c.x && s1.p.y > s1.c.y,
  "D2. on a vertical cut the pivot (handle end) is below and left of where the edge cuts",
);
assert(
  swipeContactAlong(tip) > 0 && swipeContactAlong(tip) < tip,
  "D3. a steep swipe holds the cut on the edge, between pivot and tip",
);

// F. Wiring.
const scene = read("src/game/scenes/PreparationScene.ts");
const ghost = read("src/game/scenes/coachGhost.ts");
const i = scene.indexOf("private runTapCut(");
const tapCut = scene.slice(i, i + 7000);
assert(
  /cutContactRot\(/.test(tapCut) &&
    /cutStrokePose\(/.test(tapCut) &&
    /onUpdate: followStroke/.test(tapCut),
  "F1. the tap cut drives the knife through cutStrokePose",
);
const j = scene.indexOf("private updateKnifeDirection(");
assert(
  /cutContactRot\(Phaser\.Math\.RadToDeg\(Math\.atan2\(dy, dx\)\)\)/.test(scene.slice(j, j + 3000)),
  "F2. a steep swipe holds the knife at cutContactRot",
);
assert(
  /cutStrokePose\(/.test(ghost) && /cutContactRot\(/.test(ghost),
  "F3. the coaching ghost demonstrates the same stroke",
);

console.log(
  failures === 0 ? "\nKNIFE STROKE QA: ALL PASS" : `\nKNIFE STROKE QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
