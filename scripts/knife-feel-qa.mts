/**
 * KNIFE FEEL QA — the knife's own effects while cutting (developer
 * 2026-10-24: "add effects to the knife while cutting … so the player gets
 * dopamine from it"; src/game/knifeFeel.ts says when, scenes/knifeFx.ts
 * draws). Tested with the real functions and the scene's source.
 *
 *  T. Tiers: the edge heats with the combo (×5 / ×10 / ×15), Fever is at
 *     least tier 2, never above 3.
 *  M. Moments: every cut glints; milestones glint brighter with a star;
 *     Perfect Slice flashes with a star; the last cut echoes, rings, stars
 *     and flicks the juice; haptics grow with the moment and stay short.
 *  W. Wiring: the scene answers every committed cut with cutMoment, passes
 *     the ingredient's juice, rings the steel on the step's last cut, draws
 *     the effects on the knife's own transform (hidden with the knife), cools
 *     the blade per ingredient, honours Reduced Motion; presentation only.
 *
 * Run: npx tsx scripts/knife-feel-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { COMBO } from "../src/game/definitions.ts";
import { KNIFE_FX, bladeTier, cutMoment } from "../src/game/knifeFeel.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`, detail === undefined ? "" : JSON.stringify(detail));
  }
}
const read = (p: string) => fs.readFileSync(path.resolve(p), "utf8");

// ---------- T. Tiers ----------
assert(
  bladeTier(0) === 0 &&
    bladeTier(4) === 0 &&
    bladeTier(5) === 1 &&
    bladeTier(10) === 2 &&
    bladeTier(15) === 3 &&
    bladeTier(99) === 3,
  "T1: the edge heats with the combo — ×5 ivory, ×10 gold, ×15 white-gold, never past it",
);
assert(bladeTier(1, true) === 2 && bladeTier(20, true) === 3, "T2: Fever is at least tier 2");

// ---------- M. Moments ----------
{
  const plain = cutMoment({ combo: 2, perfect: false, last: false });
  const mile = cutMoment({ combo: COMBO.MILESTONES[0]!, perfect: false, last: false });
  const perfect = cutMoment({ combo: 3, perfect: true, last: false });
  const last = cutMoment({ combo: 8, perfect: false, last: true });
  assert(
    plain.glint > 0 &&
      !plain.flash &&
      !plain.star &&
      !plain.shing &&
      !plain.flick &&
      plain.haptic === KNIFE_FX.HAPTIC.cut,
    "M1: every cut glints and buzzes lightly — nothing more",
    plain,
  );
  assert(
    mile.glint > plain.glint && mile.star && mile.haptic > plain.haptic,
    "M2: a combo milestone glints brighter, with a star at the tip",
    mile,
  );
  assert(
    perfect.flash && perfect.star && perfect.glint > plain.glint,
    "M3: Perfect Slice flashes the whole blade, with a star",
    perfect,
  );
  assert(
    last.echo && last.shing && last.flick && last.star && last.haptic === KNIFE_FX.HAPTIC.last,
    "M4: the last cut double-glints, rings the steel, flicks the juice off and stars",
    last,
  );
  const all = [plain, mile, perfect, last];
  assert(
    all.every((m) => m.glint > 0 && m.glint <= 1 && m.haptic > 0 && m.haptic <= 30),
    "M5: brightness 0–1; buzzes short (≤ 30 ms)",
  );
}

// ---------- W. Wiring ----------
{
  const scene = read("src/game/scenes/PreparationScene.ts");
  const fx = read("src/game/scenes/knifeFx.ts");
  const feel = read("src/game/knifeFeel.ts");
  const commit = scene.slice(
    scene.indexOf("private commitCut("),
    scene.indexOf("private markCutCommitted("),
  );
  assert(
    /this\.knifeFx\?\.onCut\(\s*cutMoment\(\{ combo, perfect, last: stepDone, fever: !!this\.fever \}\),\s*JUICE\[this\.ingredientId\]\?\.color \?\? null,?\s*\)/.test(
      commit,
    ) && /if \(stepDone\) AudioManager\.playBladeRing\(\);/.test(commit),
    "W1: every committed cut gets its moment (with the ingredient's juice); the step's last rings the steel",
  );
  assert(
    /this\.knifeFx\?\.draw\(g, profile, g\.visible \? alpha : 0\);/.test(scene) &&
      /setPosition\(g\.x, g\.y\)\.setRotation\(g\.rotation\)\.setScale\(g\.scaleX, g\.scaleY\)/.test(
        fx,
      ),
    "W2: the effects ride the knife's own transform and hide with it (the cloth, plating)",
  );
  assert(
    /newIngredientBatch\(\);\s*this\.knifeFx\?\.reset\(\);/.test(scene),
    "W3: each fresh ingredient starts with a cool, dry blade",
  );
  assert(
    /new KnifeFx\(this, \(\) => this\.reducedMotion\(\)\)/.test(scene) &&
      (fx.match(/!still/g) ?? []).length >= 4 &&
      /if \(!this\.last \|\| this\.reduced\(\)\)/.test(fx),
    "W4: Reduced Motion: no glint runs, afterimages, flying juice, stars or sparks",
  );
  assert(
    !/SaveData|credits|ledger|grade|score|requiredCuts/i.test(
      fx + feel.replace(/\/\*[\s\S]*?\*\//g, ""),
    ) && !/knife\.(x|y|rot)\s*=/.test(fx),
    "W5: presentation only — no save, money or grade, and it never moves the knife",
  );
  assert(
    /playBladeRing\(\): void \{\s*if \(!this\.enabled\) return;/.test(
      read("src/game/AudioManager.ts"),
    ),
    "W6: the steel ring is synthesized and gated on the Sound setting",
  );
}

console.log(failures ? `KNIFE FEEL QA: ${failures} FAILURE(S)` : "KNIFE FEEL QA: ALL PASS");
process.exit(failures ? 1 : 0);
