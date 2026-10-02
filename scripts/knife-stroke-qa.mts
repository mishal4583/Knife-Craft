/**
 * KNIFE_STROKE_QA — the knife cuts ALONG the cut line, the way a real knife
 * moves through a slice (scenes/knifeProfile.ts cuttingRot / cuttingStroke,
 * used by PreparationScene's tap cut and swipe knife and by the coaching
 * ghost). A vertical cut is made by a knife lying vertically and moving
 * vertically — never a knife lying across the cut, or moving sideways
 * across it.
 *
 *   A. For every cut angle, the blade lies on the cut line (parallel to it).
 *   B. The handle is at the player's end: a steep cut's tip points up the
 *      screen, a flat cut's tip points right.
 *   C. The tap stroke moves along the line, tip first, and the edge stays
 *      on the line from start to finish.
 *   D. The stroke cuts the whole line: the tip starts inside the food's near
 *      end and finishes past its far end.
 *   E. Every cut the game can make (axis × slope, via lineAngleDeg) passes A–C.
 *   F. Wiring: the tap cut, the swipe knife and the ghost all use the shared
 *      rule, and nothing turns the knife across the cut.
 *
 * Run: npx tsx scripts/knife-stroke-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { cuttingRot, cuttingStroke } from "../src/game/scenes/knifeProfile.ts";
import { lineAngleDeg } from "../src/game/CutGeometry.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f: string) => fs.readFileSync(path.resolve(ROOT, f), "utf8");
let failures = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`ok   ${label}`);
}

const EPS = 1e-6;
const rad = (d: number) => (d * Math.PI) / 180;
/** |sin| of the angle between the knife (rot) and a line at `deg`: 0 when parallel. */
const across = (rot: number, deg: number) => Math.abs(Math.sin(rot - rad(deg)));

function checkAngle(deg: number) {
  const rot = cuttingRot(deg);
  const ux = Math.cos(rot);
  const uy = Math.sin(rot);
  const centre = { x: 270, y: 480 };
  const halfLen = 90;
  const tip = 40;
  const s = cuttingStroke(centre, deg, halfLen, tip);
  const tx = s.to.x - s.from.x;
  const ty = s.to.y - s.from.y;
  const travel = Math.hypot(tx, ty);
  // Distance of a point from the cut line through `centre`.
  const off = (p: { x: number; y: number }) =>
    Math.abs((p.x - centre.x) * Math.sin(rad(deg)) - (p.y - centre.y) * Math.cos(rad(deg)));
  // Where along the knife's direction (from the centre) the tip is.
  const tipAlong = (p: { x: number; y: number }) =>
    (p.x - centre.x) * ux + (p.y - centre.y) * uy + tip;
  let a = ((deg % 180) + 180) % 180;
  if (a > 90) a -= 180;
  const steep = Math.abs(a) > 45;
  return {
    parallel: across(rot, deg) < EPS,
    handleNear: steep ? uy < 0 : ux > 0,
    strokeAlong: travel > halfLen && Math.abs(tx * uy - ty * ux) / travel < EPS,
    tipFirst: tx * ux + ty * uy > 0,
    edgeOnLine: off(s.from) < EPS && off(s.to) < EPS,
    wholeCut: tipAlong(s.from) > -halfLen && tipAlong(s.from) < 0 && tipAlong(s.to) > halfLen,
    rotSame: Math.abs(s.rot - rot) < EPS,
  };
}

const bad: Record<string, number[]> = {};
for (let d = -180; d <= 180; d += 0.5) {
  const r = checkAngle(d);
  for (const [k, v] of Object.entries(r)) if (!v) (bad[k] ??= []).push(d);
}
const none = (k: string) => !bad[k];
assert(
  none("parallel"),
  "A. the blade lies on the cut line at every angle",
  bad.parallel?.slice(0, 8),
);
assert(
  none("handleNear"),
  "B. the handle is at the player's end (steep: tip up the screen; flat: tip right)",
  bad.handleNear?.slice(0, 8),
);
assert(
  none("strokeAlong") && none("tipFirst") && none("edgeOnLine") && none("rotSame"),
  "C. the tap stroke slides along the line, tip first, its edge on the line",
  {
    along: bad.strokeAlong?.slice(0, 5),
    tip: bad.tipFirst?.slice(0, 5),
    edge: bad.edgeOnLine?.slice(0, 5),
  },
);
assert(none("wholeCut"), "D. the stroke goes through the whole line", bad.wholeCut?.slice(0, 8));

// The cases the player sees most, spelled out.
const v = cuttingRot(90);
assert(
  Math.abs(Math.cos(v)) < EPS && Math.sin(v) < 0,
  "A2. a vertical cut (slicing bread into rounds): the knife is vertical, tip up, handle toward the player",
);
const vs = cuttingStroke({ x: 0, y: 0 }, 90, 100, 50);
assert(
  Math.abs(vs.to.x - vs.from.x) < EPS && vs.to.y < vs.from.y,
  "C2. ... and it moves vertically (up the cut, tip first), not sideways",
  vs,
);
const h = cuttingRot(0);
assert(Math.abs(h) < EPS, "A3. a horizontal cut: the knife is horizontal, tip right");

// E. Every cut line the game makes.
const eBad: string[] = [];
for (const axis of ["h", "v"] as const) {
  for (let slope = -3; slope <= 3; slope += 0.05) {
    const deg = lineAngleDeg(axis, slope);
    const r = checkAngle(deg);
    if (!Object.values(r).every(Boolean)) eBad.push(`${axis}:${slope.toFixed(2)}`);
  }
}
assert(eBad.length === 0, "E. every axis/slope cut line passes A–D", eBad.slice(0, 8));

// F. Wiring.
const scene = read("src/game/scenes/PreparationScene.ts");
const ghost = read("src/game/scenes/coachGhost.ts");
const tapCut = scene.slice(
  scene.indexOf("private runTapCut("),
  scene.indexOf("private runTapCut(") + 6000,
);
assert(
  /cuttingStroke\(/.test(tapCut) && /rot: cutRot/.test(tapCut),
  "F1. the tap cut moves the knife by cuttingStroke",
);
const dir = scene.slice(scene.indexOf("private updateKnifeDirection("));
assert(
  /cuttingRot\(Phaser\.Math\.RadToDeg\(Math\.atan2\(dy, dx\)\)\)/.test(dir.slice(0, 2500)),
  "F2. a steep swipe lays the knife along the stroke (cuttingRot of the stroke's own angle)",
);
assert(/cuttingStroke\(/.test(ghost), "F3. the coaching ghost slices with the same cuttingStroke");
const all = scene + ghost + read("src/game/scenes/knifeProfile.ts");
assert(
  !/CROSS_TILT|cuttingRot\(90\)/.test(all),
  "F4. nothing turns the knife across the cut (no fixed cross pose)",
);

console.log(
  failures === 0 ? "\nKNIFE STROKE QA: ALL PASS" : `\nKNIFE STROKE QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
