/**
 * PHASE1_CUTTING_QA — Phase 1 "Core Cutting Satisfaction": the combo
 * (src/game/definitions.ts COMBO, PreparationScene.commitCut,
 * Preparation.tsx, GameHUD.tsx), the cut-drag impact accent (CUT_DRAG,
 * boardNudge), the differentiated cutting audio (AudioManager), the
 * settle tilt (PIECE_SETTLE.TILT_RAD, settleTilt/tweenSettle), and the
 * Knife Report's "New Best!" line with its improvement and before/after
 * digits (src/game/bestVerdict.ts).
 *
 * The tilt and the digits override two older design rules (the
 * reference's "no rotation" and Law 4's "no visible score") by the
 * developer's decision of 2026-10-21 — sections F and H test the new rules.
 *
 * Run: npx tsx scripts/phase1-cutting-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { COMBO, CUT_DRAG, BOARD_NUDGE, PIECE_SETTLE } from "../src/game/definitions.ts";
import { bestVerdict, formatScorePair } from "../src/game/bestVerdict.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f: string) => fs.readFileSync(path.resolve(ROOT, f), "utf8");
let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else console.log(`ok   ${label}`);
}

const scene = read("src/game/scenes/PreparationScene.ts");
const prep = read("src/components/kc/game/Preparation.tsx");
const hud = read("src/components/kc/game/GameHUD.tsx");
const report = read("src/components/kc/game/KnifeReport.tsx");
const audio = read("src/game/AudioManager.ts");
const events = read("src/game/events.ts");

/** The body of a class method, from its signature to the next method at the same indent. */
function methodBody(src: string, signature: string): string {
  const at = src.indexOf(signature);
  if (at === -1) return "";
  return src.slice(at, at + 1400);
}

console.log("A. Combo configuration");
assert(COMBO.MILESTONES.length > 0, "A1: at least one combo milestone is configured");
assert(
  COMBO.MILESTONES.every((m, i) => i === 0 || m > COMBO.MILESTONES[i - 1]!),
  "A2: milestones are strictly ascending, so each fires once and in order",
);
assert(
  COMBO.MILESTONES.every((m) => Number.isInteger(m) && m >= 2),
  "A3: every milestone is a whole number of cuts, 2 or more",
);
assert(
  COMBO.PITCH_MAX > 1 && COMBO.PITCH_MAX <= 1.25,
  "A4: the combo pitch ramp stays within a pleasant bound (1 < max <= 1.25)",
);
assert(COMBO.PITCH_FULL_AT >= 1, "A5: the pitch ramp reaches its max over a positive run of cuts");
assert(
  COMBO.TOAST_MS >= 500 && COMBO.TOAST_MS <= 2000,
  "A6: a milestone toast is readable but never blocks play (500-2000 ms)",
);

console.log("\nB. The combo is the scene's own step counter (one source of truth)");
assert(
  /const combo = this\.cuts\.length - this\.stepCutsAtStart;/.test(scene),
  "B1: the scene derives the combo from the step's own cut count",
);
assert(/^\s*combo,$/m.test(scene), "B2: the scene emits it on CUT_COMPLETED");
assert(/combo: number;/.test(events), "B3: CutCompletedPayload carries the combo");
assert(
  /const nextCombo = event\.payload\.combo;/.test(prep),
  "B4: the UI reads the scene's combo rather than counting cuts itself",
);
assert(
  !/setCombo\(\s*(combo|prev)\s*\+\s*1\s*\)/.test(prep),
  "B5: the UI keeps no second, drift-prone counter",
);
assert(
  /currentCombo: combo,/.test(prep),
  "B6: the HUD gameplay state carries the live combo, not a hardcoded 0",
);
assert(
  /gameplay\.currentCombo >= 2/.test(hud) && /data-testid="hud-combo"/.test(hud),
  "B7: the HUD renders a combo meter from that state",
);

console.log("\nC. Combo reset and once-per-milestone");
assert(
  /setCombo\(0\);[\s\S]{0,300}firedMilestone\.current = 0;/.test(prep),
  "C1: STEP_STARTED resets the combo and the milestone guard",
);
assert(
  /if \(reached > firedMilestone\.current\)/.test(prep),
  "C2: a milestone fires only when higher than the last one announced",
);
assert(
  /data-testid="combo-milestone"/.test(prep),
  "C3: the milestone toast has a stable hook for browser tests",
);
assert(
  /pointer-events-none[\s\S]{0,200}data-testid="combo-milestone"/.test(prep),
  "C4: the toast is non-interactive, so it can never swallow a cut",
);

console.log("\nD. Impact accent / cut drag");
assert(
  CUT_DRAG.PX_FRAC > 0 && CUT_DRAG.PX_FRAC < BOARD_NUDGE.PX_FRAC * 4,
  "D1: the lateral drag is a small give, on the scale of the existing board nudge",
);
assert(
  /private boardNudge\(axis\?: "h" \| "v", velocity = 0\)/.test(scene),
  "D2: the board nudge takes the cut's axis and stroke speed",
);
assert(
  /this\.boardNudge\(cut\.axis, opts\.velocity\)/.test(scene),
  "D3: every committed cut drives it, tap and swipe alike (one pipeline)",
);
assert(
  /!this\.reducedMotion\(\)/.test(scene) && /kc-reduced-motion/.test(scene),
  "D4: the drag is skipped when the player has Reduced Motion on",
);
assert(
  !/private knifeDrag|this\.knife\.squash =[^;]*CUT_DRAG/.test(scene),
  "D5: the knife's own pose/squash (KNIFE_RULES: it stands on its edge) is untouched",
);

console.log("\nE. Differentiated cutting audio");
assert(/playComboMilestone\(index: number\)/.test(audio), "E1: a combo-milestone sound exists");
assert(/playIngredientComplete\(\)/.test(audio), "E2: an ingredient-completion chime exists");
assert(
  /if \(!this\.enabled\) return;/.test(methodBody(audio, "playComboMilestone(index: number)")),
  "E3: the combo sound respects the player's Sound setting",
);
assert(
  /if \(!this\.enabled\) return;/.test(methodBody(audio, "playIngredientComplete()")),
  "E4: the completion chime respects the player's Sound setting",
);
assert(
  /comboPitch \*\s*\(perfect \? 1\.06 : 1\)/.test(scene),
  "E5: a perfect cut sounds sharper than an ordinary one, on top of the combo ramp",
);
assert(
  /AudioManager\.playIngredientComplete\(\);\s*\n\s*this\.advanceStepOrFinish\(\);/.test(scene),
  "E6: the completion chime fires once, on the cut that finishes the ingredient",
);

console.log("\nF. 'New Best!' and the improvement line are honest");
assert(bestVerdict(80, 0).kind === "first", "F1: no stored best is a FIRST result, not a best");
assert(bestVerdict(80, Number.NaN).kind === "first", "F2: a non-finite best is treated as first");
assert(bestVerdict(80, -5).kind === "first", "F3: a negative best is treated as first");
assert(bestVerdict(0, 60).kind === "none", "F4: a zero score never celebrates");
assert(bestVerdict(Number.NaN, 60).kind === "none", "F5: a non-finite score never celebrates");
assert(bestVerdict(60, 60).kind === "none", "F6: equalling your best is not a new best");
assert(bestVerdict(59, 60).kind === "none", "F7: a worse run is not a new best");
const better = bestVerdict(84, 75);
assert(
  better.kind === "best" && better.gain === 12,
  "F8: a genuine improvement reports the real percentage (75 -> 84 = +12%)",
);
const tiny = bestVerdict(60.2, 60);
assert(
  tiny.kind === "best" && tiny.gain === null,
  "F9: an improvement under 1% celebrates without printing a misleading +0%",
);
assert(
  /data-testid="knife-report-best"/.test(report) &&
    /data-testid="knife-report-gain"/.test(report) &&
    /data-testid="knife-report-first"/.test(report),
  "F10: the report renders the celebration, the gain line and the first-time line separately",
);
// F11–F17 replace the original F11 ("Law 4 — no score digits on the
// report"). The developer overrode Law 4 for the New Best line on
// 2026-10-21, so that assertion no longer described the spec — and since
// the digits render through `before`/`after`, it would have kept passing
// while claiming something untrue. These check the NEW rule, which is
// narrower than "digits anywhere": digits only on a genuine new best.
const bestAt = report.indexOf("isBest ? (");
const scoresAt = report.indexOf('data-testid="knife-report-scores"');
const firstAt = report.indexOf('verdict.kind === "first"');
assert(
  bestAt !== -1 && scoresAt > bestAt && scoresAt < firstAt,
  "F11: the old-best -> new-score digits render ONLY inside the genuine-new-best branch",
);
assert(
  /formatScorePair\(previousBest, result\.score\)/.test(report),
  "F12: the digits are the stored best and this run's own score (no other source)",
);
assert(
  /className="sr-only"[\s\S]{0,80}Previous best \{before\}, new score \{after\}/.test(report),
  "F13: screen readers get a full sentence, not a bare arrow",
);
const [b1, a1] = formatScorePair(30, 84);
assert(b1 === "30" && a1 === "84", "F14: whole-number scores print as whole numbers (30 -> 84)");
const [b2, a2] = formatScorePair(60, 60.2);
assert(b2 === "60.0" && a2 === "60.2", "F15: a sub-point gain adds a decimal (60.0 -> 60.2)");
const [b3, a3] = formatScorePair(60, 60.04);
assert(b3 === "60.00" && a3 === "60.04", "F16: ...and a second one if it still reads equal");
assert(
  [
    [30, 84],
    [60, 60.2],
    [60, 60.04],
    [99, 100],
    [0.5, 0.51],
  ].every(([b, a]) => {
    const [x, y] = formatScorePair(b!, a!);
    return x !== y;
  }),
  "F17: the printed pair never reads equal under 'New Best!' (gains >= 0.01)",
);

// I — a static guard for the narrow-screen fix; the real check is the
// browser test tools/e2e/knifereport.mjs (6 screen sizes, worst-case content).
console.log("\nI. Knife Report stats grid fits narrow games");
const indicators = read("src/components/kc/common/Indicators.tsx");
assert(
  /grid-cols-\[minmax\(0,1fr\)_auto\]/.test(report) && !/grid-cols-\[1fr_auto\]/.test(report),
  "I1: the stats column can shrink below its text (minmax(0, 1fr), not 1fr)",
);
assert(
  /className="@container absolute inset-0/.test(report),
  "I2: the report is the size container, so it follows the game's width, not the window's",
);
assert(
  /min-w-7 shrink-0[^"]*@min-\[390px\]:w-\[62px\]/.test(report) &&
    /min-w-7 shrink-0[^"]*@min-\[390px\]:w-\[62px\]/.test(indicators),
  "I3: value columns never shrink (no clipped '100'), and are the original 62 px from 390 px",
);
assert(
  /min-w-0 flex-1 truncate/.test(report),
  "I4: the Rhythm line's text truncates instead of widening the column",
);

console.log("\nG. Replay (B6) and economy safety");
assert(
  /if \(restarting\.current\) return;/.test(prep) && /restarting\.current = true;/.test(prep),
  "G1: a second Prepare Again press cannot start a second run",
);
assert(
  /restarting\.current = false;/.test(prep),
  "G2: the latch reopens when the scene confirms a fresh run started",
);
assert(
  /awarded\.current = false;/.test(prep),
  "G3: the existing one-award-per-run guard is still in place",
);
assert(
  !/credits|ledger|reward/i.test(
    scene.slice(scene.indexOf("const combo ="), scene.indexOf("const combo =") + 1200),
  ),
  "G4: the combo awards nothing — no wallet, ledger or reward path near it",
);
assert(
  // The CODE, not the doc comment, which names the stored field it compares against.
  !/recipeProgress|SaveData|localStorage/.test(
    read("src/game/bestVerdict.ts").replace(/\/\*[\s\S]*?\*\//g, ""),
  ),
  "G5: the verdict is a pure comparison — it reads and writes no save state itself",
);
assert(
  /best: number/.test(read("src/types/game.ts")) ||
    /previousBest: number;/.test(read("src/types/game.ts")),
  "G6: the comparison reuses the best score the game already tracks (no new save field)",
);

console.log("\nH. Settle tilt (A2) — built so the old 'crossing pieces' failure cannot recur");
const tiltBody = scene.slice(
  scene.indexOf("private settleTilt("),
  scene.indexOf("private tweenSettle("),
);
const tweenBody = methodBody(scene, "private tweenSettle(");
assert(
  PIECE_SETTLE.TILT_RAD > 0 && PIECE_SETTLE.TILT_RAD <= 0.08,
  "H1: the peak tilt is a small lean (0 < TILT_RAD <= 0.08 rad, about 4.6 degrees)",
);
assert(
  tiltBody.length > 0 && !/slope|\bcut\b|\.axis|angle/.test(tiltBody),
  "H2: the tilt never reads the cut's angle (the reference's crossing-shapes bug)",
);
assert(
  /Phaser\.Math\.Clamp\(\(gx - this\.ingCx\) \/ half,\s*-1,\s*1\)/.test(tiltBody) &&
    /const half = this\.silhouette\.rx;/.test(tiltBody),
  "H3: the tilt is proportional to the piece's offset across the silhouette's own half-width",
);
assert(
  /if \(this\.reducedMotion\(\)\) return 0;/.test(tiltBody),
  "H4: Reduced Motion keeps the original untilted parting",
);
assert(
  /x: centroid\.gx \+ dx \+ cos \* rx - sin \* ry,/.test(tweenBody) &&
    /y: centroid\.gy \+ dy \+ sin \* rx \+ cos \* ry,/.test(tweenBody) &&
    /rotation: img\.rotation \+ tilt,/.test(tweenBody),
  "H5: the lean pivots on the piece's own centroid (images have a top-left origin)",
);
assert(
  /this\.tweenSettle\(img, centroid, \(vx \/ m\) \* offset, \(vy \/ m\) \* offset\)/.test(scene) &&
    /this\.tweenSettle\(img, centroid, dx, dy\)/.test(scene),
  "H6: every ingredient's settle — standard and protein — goes through the same lean",
);
assert(
  /const fromAngle = piece\.angle;/.test(scene),
  "H7: the plate flight still starts from each piece's actual angle, so a tilted piece flies cleanly",
);
{
  // The pivot maths itself, run on numbers: placing the top-left corner
  // with tweenSettle's formula and drawing the image rotated by the tilt
  // must leave the centroid exactly where it was.
  const g = { x: 200, y: 300 };
  const tl = { x: 170, y: 240 };
  const t = PIECE_SETTLE.TILT_RAD;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const nx = g.x + c * (tl.x - g.x) - s * (tl.y - g.y);
  const ny = g.y + s * (tl.x - g.x) + c * (tl.y - g.y);
  const lx = g.x - tl.x;
  const ly = g.y - tl.y;
  const gx2 = nx + c * lx - s * ly;
  const gy2 = ny + s * lx + c * ly;
  assert(
    Math.abs(gx2 - g.x) < 1e-9 && Math.abs(gy2 - g.y) < 1e-9,
    "H8: on numbers, the centroid stays put under the lean (no swing about the corner)",
  );
}

console.log(
  failures === 0
    ? "\nPHASE 1 CUTTING QA: ALL PASS"
    : `\nPHASE 1 CUTTING QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
