/**
 * OVERHANG_REGRESSION_QA — regression suite for the stem/crown overhang
 * + first-cut auto-removal port (knifecraft.html's `geom.overhang`/
 * `drawOverhang`), run the same way as scripts/phase{1..6,7-1,7-2}-
 * smoke-test.mts:
 *   npx esbuild scripts/overhang-regression-qa.mts --bundle --platform=node --format=esm --outfile=/tmp/overhang.mjs
 *   node /tmp/overhang.mjs
 *
 * Production has no `geom.overhang`-shaped data structure of its own —
 * the whole system lives in each ingredient's texture-paint function,
 * gated on the `overhangGone` parameter PreparationScene.ts's four
 * renderer dispatch sites compute uniformly as `this.cuts.length > 0`.
 * So this suite checks it the same way that architecture is checkable
 * without a live Phaser scene/canvas: source-text presence/absence of
 * the `overhangGone` identifier in each ingredient's own texture file,
 * plus (for Pineapple, whose crown-removal falls out of the existing
 * mandatory-peel gate instead) a data-level check on its technique/
 * peelDecoupled flags.
 */
import fs from "node:fs";
import path from "node:path";
import { INGREDIENTS } from "../src/game/definitions.ts";

// Resolved against the CURRENT WORKING DIRECTORY, not import.meta.url —
// esbuild bundles this script into a single file elsewhere (e.g. a temp
// dir), so the bundle's own location isn't the project root. Every sibling
// smoke-test script in this directory is run with the project root as cwd
// (see this file's own header doc), so that's what these paths assume.
const PROJECT_ROOT = process.cwd();
const TEXTURES_DIR = path.join(PROJECT_ROOT, "src", "game", "textures");

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

function textureSource(file: string): string {
  return fs.readFileSync(path.join(TEXTURES_DIR, file), "utf8");
}

// The 14 ingredients the prototype's geom.overhang declares for first-cut
// auto-removal (peach/corn/celery/pineapple/springonion/radish/beetroot/
// mango/pomegranate/fennel/artichoke/peapod/pumpkin/turnip), mapped to
// their own production texture file — every one but Pineapple gates its
// overhang art directly on the new `overhangGone` parameter.
const AUTO_REMOVE_GATED: Record<string, string> = {
  peach: "peachTexture.ts",
  corn: "cornTexture.ts",
  celery: "celeryTexture.ts",
  springonion: "springOnionTexture.ts",
  radish: "radishTexture.ts",
  beetroot: "beetrootTexture.ts",
  mango: "mangoTexture.ts",
  pomegranate: "pomegranateTexture.ts",
  fennel: "fennelTexture.ts",
  artichoke: "artichokeTexture.ts",
  peapod: "peaPodTexture.ts",
  pumpkin: "pumpkinTexture.ts",
  turnip: "turnipTexture.ts",
};

// ===== 1: all 13 directly-gated auto-remove ingredients' paint functions read `overhangGone`. =====
for (const [id, file] of Object.entries(AUTO_REMOVE_GATED)) {
  assert(textureSource(file).includes("overhangGone"), `1: ${id}'s texture (${file}) gates its overhang art on overhangGone`);
}

// ===== 2: Pineapple's crown-removal falls out of the pre-existing mandatory-peel gate — =====
// it never reaches an un-peeled first cut, so no overhangGone plumbing is needed in its own
// paint function (requiresPeelFirst() in PreparationScene.ts already blocks any cut pre-peel).
assert(
  INGREDIENTS.pineapple!.techniques.includes("peel") && !INGREDIENTS.pineapple!.peelDecoupled,
  "2: Pineapple is peel-mandatory (not peelDecoupled) — its crown is gone by the time any cut can happen",
);
assert(
  !textureSource("pineappleTexture.ts").includes("overhangGone"),
  "2b: Pineapple's texture correctly has no separate overhangGone plumbing (redundant with the peel gate)",
);

// ===== 3: Green Chili (`chilli`) is DECLARED but EXEMPT (keepOverhang) — its calyx/stalk =====
// paints unconditionally, every cut, forever; it must NOT reference overhangGone at all.
assert(
  !textureSource("chilliTexture.ts").includes("overhangGone"),
  "3: chilli's texture never gates on overhangGone — the calyx/stalk is kept for the entire run (keepOverhang)",
);

// ===== 4: Carrot/Onion/Garlic have NO geom.overhang declaration in the prototype — their =====
// production texture files must not reference overhangGone either.
for (const [id, file] of Object.entries({ carrot: "carrotTexture.ts", onion: "onionTexture.ts", garlic: "garlicTexture.ts" })) {
  const p = path.join(TEXTURES_DIR, file);
  if (fs.existsSync(p)) {
    assert(!fs.readFileSync(p, "utf8").includes("overhangGone"), `4: ${id}'s texture (${file}) has no overhang system (none declared in the prototype)`);
  } else {
    assert(true, `4: ${id} has no dedicated texture file (paint lives inline in PreparationScene.ts) — nothing to check`);
  }
}

// ===== 5: the four renderer dispatch sites in PreparationScene.ts all pass overhangGone as =====
// `this.cuts.length > 0`, independent of any peel/hasCut state — one flag, one meaning, everywhere.
{
  const scene = fs.readFileSync(path.join(PROJECT_ROOT, "src", "game", "scenes", "PreparationScene.ts"), "utf8");
  const overhangGoneParamCount = (scene.match(/overhangGone\?: boolean/g) ?? []).length;
  assert(overhangGoneParamCount === 4, `5: all 4 renderer types (Ellipse/Taper/Capsule/Cluster) declare overhangGone?: boolean (${overhangGoneParamCount})`);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
