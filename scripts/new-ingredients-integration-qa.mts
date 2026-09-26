/**
 * NEW_INGREDIENTS_INTEGRATION_QA — regression suite for the
 * KNIFECRAFT-NEW-INGREDIENTS integration (Ginger/Green Chili/Cilantro/
 * Green Onion/Lime), run the same way as scripts/phase{1..6,7-1,7-2}-
 * smoke-test.mts and scripts/ingredient-realism-qa.mts:
 *   npx esbuild scripts/new-ingredients-integration-qa.mts --bundle --platform=node --format=esm --outfile=/tmp/newing.mjs
 *   node /tmp/newing.mjs
 *
 * Pure structural/data assertions only — this pass never touched the
 * campaign/recipe/level system, so there's nothing recipe- or level-
 * shaped to test yet; that's intentionally deferred to the later Level
 * System migration (see this task's own final report).
 */
import { INGREDIENTS, TECHNIQUES } from "../src/game/definitions.ts";
import { INGREDIENT_EMOJI } from "../src/game/knives/knifeDefinitions.ts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

const NEW_IDS = ["ginger", "chilli", "lime", "cilantro", "springonion"] as const;
const EXISTING_52 = Object.keys(INGREDIENTS).filter((id) => !NEW_IDS.includes(id as (typeof NEW_IDS)[number]));

// ===== 1: exactly 57 ingredients total (52 pre-existing + 5 new), none of the 52 removed/renamed. =====
assert(Object.keys(INGREDIENTS).length === 57, `1: 57 total ingredients (${Object.keys(INGREDIENTS).length})`);
assert(EXISTING_52.length === 52, `1b: all 52 pre-existing ingredients still present (${EXISTING_52.length})`);

// ===== 2: all 5 new ingredient ids exist with the package's own exact ids (not renamed for convenience). =====
for (const id of NEW_IDS) {
  assert(!!INGREDIENTS[id], `2: ${id} has a CONFIG.INGREDIENTS-equivalent entry`);
}
assert(!("greenChili" in INGREDIENTS) && !("greenOnion" in INGREDIENTS), "2b: no renamed greenChili/greenOnion aliases were created");

// ===== 3: each new ingredient's shape/techniques match the supplied package exactly. =====
// 3a UPDATED for the Level System v2 migration: v2 places Ginger — Rock
// Mince (curry/masala bases) and Ginger — Julienne (Chicken & Cabbage
// Julienne, Radish & Cucumber Namasu) across many campaign recipes, so
// `rockMince`/`julienne` were added to its techniques (both reuse the
// same generic cut-grid engine peel/slice/chop already used — no new
// texture/rendering, no new mechanic; see the migration's final report).
assert(INGREDIENTS.ginger?.shape === "cluster" && INGREDIENTS.ginger.techniques.join(",") === "peel,slice,chop,rockMince,julienne", "3a: ginger shape/techniques");
assert(INGREDIENTS.chilli?.shape === "taper" && INGREDIENTS.chilli.techniques.join(",") === "slice,chop", "3b: chilli shape/techniques");
assert(INGREDIENTS.lime?.shape === "ellipse" && INGREDIENTS.lime.techniques.join(",") === "radial", "3c: lime shape/techniques (Radial, same precedent as Lemon)");
assert(INGREDIENTS.cilantro?.shape === "cluster" && INGREDIENTS.cilantro.techniques.join(",") === "chop,chiffonade", "3d: cilantro shape/techniques");
assert(INGREDIENTS.springonion?.shape === "cluster" && INGREDIENTS.springonion.techniques.join(",") === "slice,chop", "3e: springonion shape/techniques");

// ===== 4: Ginger is peel-mandatory (not peel-decoupled) — same rule as Onion/Potato/Garlic/Pineapple/Watermelon/Coconut. =====
assert(
  INGREDIENTS.ginger!.techniques.includes("peel") && !INGREDIENTS.ginger!.peelDecoupled,
  "4: Ginger is peel-mandatory (peelDecoupled unset), matching the package's own 'not in SKIN_KEEP' spec",
);

// ===== 5: the other 4 new ingredients have no peel technique at all (no SKIN entry in the package). =====
for (const id of ["chilli", "lime", "cilantro", "springonion"] as const) {
  assert(!INGREDIENTS[id]!.techniques.includes("peel"), `5: ${id} has no Peel technique (matches the package's own "no SKIN entry" spec)`);
}

// ===== 6: Lemon is completely untouched — Lime is a genuinely separate ingredient/geometry. =====
assert(INGREDIENTS.lemon?.techniques.join(",") === "radial", "6: Lemon's own techniques are unchanged");
assert(INGREDIENTS.lemon!.id !== INGREDIENTS.lime!.id, "6b: Lime has its own distinct id from Lemon");

// ===== 7: Parsley/Basil are completely untouched by Cilantro's addition. =====
assert(INGREDIENTS.parsley?.techniques.join(",") === "chop,chiffonade", "7: Parsley's own techniques are unchanged");
assert(INGREDIENTS.basil?.techniques.join(",") === "chop,chiffonade", "7b: Basil's own techniques are unchanged");

// ===== 8: all 5 new ingredients have a resistance curve and audio profile (verbatim-ported, not invented). =====
for (const id of NEW_IDS) {
  const def = INGREDIENTS[id]!;
  assert(Array.isArray(def.resistance) && def.resistance.length === 5, `8: ${id} has a real 5-point resistance curve`);
  assert(typeof def.audio.filterMin === "number", `8b: ${id} has a real audio profile`);
}

// ===== 9: all 5 new ingredients resolve in INGREDIENT_EMOJI (no missing/undefined emoji), and none collide with the ingredient they're most easily confused with. =====
for (const id of NEW_IDS) {
  assert(!!INGREDIENT_EMOJI[id], `9: ${id} has an emoji`);
}
assert(INGREDIENT_EMOJI.lime !== INGREDIENT_EMOJI.lemon, "9b: Lime's emoji does not collide with Lemon's");
assert(INGREDIENT_EMOJI.springonion !== INGREDIENT_EMOJI.onion, "9c: Green Onion's emoji does not collide with Onion's");
assert(INGREDIENT_EMOJI.cilantro !== INGREDIENT_EMOJI.basil && INGREDIENT_EMOJI.cilantro !== INGREDIENT_EMOJI.parsley, "9d: Cilantro's emoji does not collide with Basil's/Parsley's");

// ===== 10: every technique the 5 new ingredients declare is a real, existing technique id — no new technique was introduced. =====
const ALL_TECHNIQUE_IDS = new Set(Object.keys(TECHNIQUES));
for (const id of NEW_IDS) {
  for (const t of INGREDIENTS[id]!.techniques) {
    assert(ALL_TECHNIQUE_IDS.has(t), `10: ${id}'s technique "${t}" is a real, pre-existing technique id`);
  }
}
assert(ALL_TECHNIQUE_IDS.size === 11, `10b: still exactly 11 techniques total, none added (${ALL_TECHNIQUE_IDS.size})`);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
