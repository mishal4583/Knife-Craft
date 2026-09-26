/**
 * CAMPAIGN INTEGRITY QA — whole-campaign content invariants (all 250 levels).
 *
 * Two real content bugs were found during the release pass because the
 * older phase tests only checked a slice of the campaign:
 *  1. Five levels (19, 61, 62, 242, 246) served a recipe whose own
 *     `unlockLevel` was LATER than the level — fixed by setting each
 *     recipe's unlockLevel to the first level that serves it.
 *  2. 34 component `batchable` flags were lost after Phase 6, so 18
 *     "shared prep" Real Batch levels (KnifeCraft_Level_System_v2.docx:
 *     "the shared prep is the point of the level") shared nothing — fixed
 *     by restoring the flags / marking each level's shared component.
 *
 *  A. Every recipe a level serves (pool or batch group) exists and is
 *     unlocked by that level.
 *  B. Every batch-group level whose recipes have a component in common
 *     really shares it in the batch engine (one cut serves several orders).
 *  C. Every level has something to serve, a reward, and a known chapter.
 *
 * Run: npx tsx scripts/campaign-integrity-qa.mts
 */
import { LEVELS, CHAPTER_TITLES } from "../src/game/levels/levelDefinitions.ts";
import { CAMPAIGN_RECIPES } from "../src/game/recipes/campaignRecipes.ts";
import { createBatchGroupSession, recordBatchGroupComponents } from "../src/game/service/ServiceManager.ts";
import { levelNumber } from "../src/game/levels/levelMastery.ts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}
const byId = new Map(CAMPAIGN_RECIPES.map((r) => [r.id, r]));
const key = (c: { ingredientId: string; technique: string; resultingState: string }) => `${c.ingredientId}:${c.technique}:${c.resultingState}`;

// ===== A: served recipes exist and are unlocked by the level that serves them =====
{
  const missing: string[] = [];
  const early: string[] = [];
  for (const l of LEVELS) {
    const n = levelNumber(l.id);
    for (const id of [...(l.recipePoolIds ?? []), ...(l.batchGroupRecipeIds ?? [])]) {
      const r = byId.get(id);
      if (!r) missing.push(`${l.id}→${id}`);
      else if (r.unlockLevel > n) early.push(`${l.id} serves ${id} (unlocks ${r.unlockLevel})`);
    }
  }
  assert(LEVELS.length === 250, `A0: the campaign has 250 levels (${LEVELS.length})`);
  assert(missing.length === 0, `A: every served recipe exists${missing.length ? " — " + missing.join(", ") : ""}`);
  assert(early.length === 0, `A2: no level serves a recipe before its own unlockLevel${early.length ? " — " + early.join("; ") : ""}`);
}

// ===== B: Real Batch levels really share their common prep =====
{
  const notShared: string[] = [];
  let batchLevels = 0;
  let withCommon = 0;
  for (const l of LEVELS) {
    if (!l.batchGroupRecipeIds?.length) continue;
    batchLevels++;
    const recipes = l.batchGroupRecipeIds.map((id) => byId.get(id)!).filter(Boolean);
    const count = new Map<string, number>();
    for (const r of recipes) for (const k of new Set(r.components.map(key))) count.set(k, (count.get(k) ?? 0) + 1);
    if (![...count.values()].some((c) => c > 1)) continue; // e.g. Level 139: two independent orders by design
    withCommon++;
    let shared = false;
    for (let i = 0; i < recipes.length && !shared; i++) {
      let g = createBatchGroupSession(l.id, recipes, () => 0);
      g = recordBatchGroupComponents(g, g.orders[i]!.order.id);
      shared = g.session.outputs.some((o) => new Set(o.assignedTo.map((a) => a.split("::")[0])).size > 1);
    }
    if (!shared) notShared.push(`${l.id} "${l.title}"`);
  }
  assert(notShared.length === 0, `B: all ${withCommon} of ${batchLevels} batch levels with common prep really share it (one cut serves several orders)${notShared.length ? " — " + notShared.join("; ") : ""}`);
}

// ===== C: every level is playable content =====
{
  const bad = LEVELS.filter(
    (l) =>
      !((l.recipePoolIds?.length ?? 0) > 0 || (l.batchGroupRecipeIds?.length ?? 0) > 0) ||
      !(l.reward.coins > 0) ||
      !CHAPTER_TITLES[l.chapter],
  ).map((l) => l.id);
  assert(bad.length === 0, `C: every level serves real recipes, pays a reward and belongs to a titled chapter${bad.length ? " — " + bad.join(", ") : ""}`);
}

console.log(failures === 0 ? "\nCAMPAIGN INTEGRITY QA: ALL PASS" : `\nCAMPAIGN INTEGRITY QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
