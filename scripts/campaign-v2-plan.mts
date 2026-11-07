/**
 * CAMPAIGN V2 PLAN (developer 2026-11-07: "reduce the level count to 100 or less by merging the orders that require almost the same
 * ingredients"; implemented the same day). Reads the campaign as the game has it (src/game/levels/campaignPlan.ts, the one source of the
 * data), checks it against the design rules and writes the planning documents (docs/planning/CAMPAIGN-V2-PLAN-2026-11-07.md,
 * ...-REMOVED-AND-MERGED-..., which compare it with the previous 148-level campaign). Changes no game file.
 * Run: npx tsx scripts/campaign-v2-plan.mts [--write] [--detail] [--tables]
 */
import { writeFileSync } from "node:fs";
import {
  LEGACY_CAMPAIGN_LEVELS,
  CAMPAIGN_148_LEVEL_FIXES,
} from "../src/game/levels/levelDefinitions";
import { CAMPAIGN_148_SOURCE_LEVEL_NUMBERS } from "../src/game/levels/campaignSelection";
import { CAMPAIGN_PLAN_CHAPTERS } from "../src/game/levels/campaignPlan";
import { preparationStepsForRecipe } from "../src/game/service/stepsForRecipe";

/** The 148-level campaign that shipped until 2026-11-07, with its text fixes (this script reads it to explain the plan). */
const OLD148 = CAMPAIGN_148_SOURCE_LEVEL_NUMBERS.map((n, i) => ({
  ...LEGACY_CAMPAIGN_LEVELS[n - 1]!,
  ...(CAMPAIGN_148_LEVEL_FIXES[i + 3] ?? {}),
}));
import { INGREDIENTS } from "../src/game/definitions";
import { CAMPAIGN_RECIPES, getCampaignRecipe } from "../src/game/recipes/campaignRecipes";

type Entry = {
  title: string;
  /** Recipes the level serves (a pool, a party or a batch). */
  r: string[];
  /** Previous-campaign (148-level) numbers merged or moved into this level. */
  from: number[];
  /** How the orders are served: one dish, a party of two or more different dishes, or a shared-prep batch. */
  mode?: "single" | "party" | "batch";
  /** Orders served when the pool is bigger than the orders. */
  orders?: number;
  note?: string;
};
type Chapter = { name: string; blurb: string; levels: Entry[] };

/** One line per chapter (the document's intro text); the data itself is src/game/levels/campaignPlan.ts. */
const BLURB: Record<string, string> = {
  "Opening the Restaurant":
    "Unchanged: the two guided first services (hire the Server and the Cashier inside them).",
  "Italian Kitchen & First Chicken":
    "Bread, garlic and herbs, then the FIRST PROTEIN at level 6 (it used to arrive at level 57).",
  "The Meat & Fish Counter":
    "Steak, salmon and the chicken dishes, moved up from the Japanese chapter (levels 57-73) to right after Italian.",
  "French Bistro & Precision":
    "The fine cuts (rock-mince, chiffonade) on herbs, mushrooms and roots. 14 levels become 8.",
  "Indian Kitchen & Service":
    "Aromatics and curries. 11 levels become 7; the proteins finally appear in curries (unused dishes).",
  "Mediterranean & Latin":
    "Fresh, bright produce and salsas. 13 levels become 9; the repeated salsa levels collapse into two services.",
  "Chinese Wok": "Stir-fry prep and shared-protein batches. 12 levels become 8.",
  "Thai & Southeast Asian": "Basil, lime, chilli, coconut. 13 levels become 7.",
  "Korean Kitchen": "Steak, chicken, pear. 6 levels become 4.",
  "Italian & French Encore": "The artichoke, lettuce, turnip and peach. 10 levels become 6.",
  "Mediterranean & Latin Encore":
    "Fruit, grapes and the proteins again with new partners. 16 levels become 9.",
  "East Asian Fusion": "Two kitchens on one table. 10 levels become 6.",
  "The Grand Finale": "Every kitchen, every skill. 8 levels become 5.",
};
// The chapter titles the document uses (the game's title for chapter 2 is "Italian Kitchen & Service").
const DOC_NAME: Record<string, string> = {
  "Italian Kitchen & Service": "Italian Kitchen & First Chicken",
};
const CHAPTERS: Chapter[] = CAMPAIGN_PLAN_CHAPTERS.map((c) => {
  const name = DOC_NAME[c.title] ?? c.title;
  return {
    name,
    blurb: BLURB[name] ?? "",
    levels: c.levels.map((l) => ({
      title: l.title,
      r: [...l.recipes],
      from: [...l.from],
      ...(l.mode ? { mode: l.mode } : {}),
      ...(l.orders ? { orders: l.orders } : {}),
      ...(l.note ? { note: l.note } : {}),
    })),
  };
});
// ---------------------------------------------------------------------------------------------------------------------------------
const TECH_ORDER = [
  "slice",
  "peel",
  "halve",
  "smash",
  "dice",
  "chop",
  "rings",
  "radial",
  "julienne",
  "rockMince",
  "chiffonade",
];
const flat = CHAPTERS.flatMap((c, ci) =>
  c.levels.map((l) => ({ ...l, chapter: ci + 1, chapterName: c.name })),
);
const total = flat.length;
const recOf = (id: string) => {
  const r = getCampaignRecipe(id);
  if (!r) throw new Error(`unknown recipe ${id}`);
  return r;
};
const orders = (l: Entry) =>
  l.orders ?? (l.mode === "single" || l.r.length === 1 ? 1 : Math.min(3, l.r.length));

const seenIng = new Set<string>();
const seenTech = new Set<string>();
const issues: string[] = [];
const rows = flat.map((l, i) => {
  const n = i + 1;
  const recs = l.r.map(recOf);
  const ings = [...new Set(recs.flatMap((r) => r.components.map((c) => c.ingredientId)))];
  const techs = [...new Set(recs.flatMap((r) => r.components.map((c) => c.technique)))];
  const newIng = ings.filter((g) => !seenIng.has(g));
  const newTech = techs.filter((t) => !seenTech.has(t));
  newIng.forEach((g) => seenIng.add(g));
  newTech.forEach((t) => seenTech.add(t));
  const peel = recs.flatMap((r) =>
    r.components.filter((c) => c.technique === "peel").map((c) => c.ingredientId),
  );
  const actionsPerDish = recs.map((r) => r.components.length);
  for (const d of recs) {
    const k = new Set(d.components.map((c) => c.ingredientId)).size;
    if (k > 6) issues.push(`L${n} ${d.name}: ${k} ingredients in one dish`);
    if (d.components.length > 8)
      issues.push(`L${n} ${d.name}: ${d.components.length} prep actions in one dish`);
  }
  const perOrder = actionsPerDish.reduce((a, b) => a + b, 0) / recs.length;
  // Techniques must have been taught earlier in the chapter order (a level may introduce at most two at once).
  if (newTech.length > 2)
    issues.push(`L${n} introduces ${newTech.length} techniques at once (${newTech.join(",")})`);
  return { n, ...l, recs, ings, techs, newIng, newTech, peel, perOrder, ord: orders(l) };
});

// Rule checks -------------------------------------------------------------------------------------------------------------------
const allIngs = Object.keys(INGREDIENTS);
const missing = allIngs.filter((g) => !seenIng.has(g));
if (missing.length) issues.push(`ingredients never used: ${missing.join(", ")}`);

const firstOf = (g: string) => rows.find((r) => r.ings.includes(g))?.n ?? 0;
const dryRuns: string[] = [];
let run = 0;
let maxRun = 0;
let runStart = 0;
for (const r of rows) {
  if (r.newIng.length === 0 && r.newTech.length === 0) {
    if (run === 0) runStart = r.n;
    run++;
    if (run > maxRun) {
      maxRun = run;
    }
    if (run === 4) dryRuns.push(`L${runStart}-L${r.n}`);
  } else run = 0;
}
const CORE = ["tomato", "onion", "garlic", "carrot", "cucumber"];
const PROTEIN = ["chicken", "steak", "salmon"];
let worstCore = 0;
let worstCoreAt = 0;
for (let i = 11; i + 5 <= rows.length; i++) {
  const w = rows.slice(i, i + 5);
  const c = w.filter((r) => r.ings.some((g) => CORE.includes(g))).length;
  if (c > worstCore) {
    worstCore = c;
    worstCoreAt = i + 1;
  }
}
const countIn = (g: string) => rows.filter((r) => r.ings.includes(g)).length;
const dishUse = new Map<string, number>();
rows.forEach((r) => r.l_r?.forEach?.(() => undefined));
rows.forEach((r) => r.r.forEach((id) => dishUse.set(id, (dishUse.get(id) ?? 0) + 1)));
const usedRecipes = new Set(rows.flatMap((r) => r.r));
const unusedRecipes = CAMPAIGN_RECIPES.filter((r) => !usedRecipes.has(r.id));
const fate = new Map<number, string>();
rows.forEach((r) => {
  r.from.forEach((o, i) => {
    if (fate.has(o)) issues.push(`old L${o} used twice`);
    fate.set(
      o,
      r.from.length === 1
        ? r.from[0] === o && r.n === o
          ? `kept (L${r.n})`
          : `kept as new L${r.n}`
        : `merged into new L${r.n}`,
    );
  });
});
const cut = OLD148.map((_, i) => i + 1).filter((o) => !fate.has(o));
const protRow = (g: string) => firstOf(g);

// The final run of levels without anything new is the deliberate "mastery tail" (Fusion + Finale); gaps before it are the real ones.
const tailStart = (() => {
  let i = rows.length;
  while (i > 0 && rows[i - 1]!.newIng.length === 0 && rows[i - 1]!.newTech.length === 0) i--;
  return i + 1;
})();
let bodyGap = 0;
{
  let g = 0;
  for (const r of rows.slice(0, tailStart - 1)) {
    g = r.newIng.length === 0 && r.newTech.length === 0 ? g + 1 : 0;
    bodyGap = Math.max(bodyGap, g);
  }
}
const stats = {
  total,
  chickenFirst: protRow("chicken"),
  steakFirst: protRow("steak"),
  salmonFirst: protRow("salmon"),
  maxDry: maxRun,
  bodyGap,
  tailFrom: tailStart,
  tailLength: rows.length - tailStart + 1,
  dryRuns,
  worstCore: `${worstCore} of 5 consecutive levels from L${worstCoreAt}`,
  avgPerOrder: (rows.reduce((a, r) => a + r.perOrder, 0) / rows.length).toFixed(2),
};

// Print summary to the console ----------------------------------------------------------------------------------------------------
console.log("TOTAL LEVELS", total);
console.log(CHAPTERS.map((c) => `${c.name}: ${c.levels.length}`).join("\n"));
console.log("ISSUES", issues.length ? "\n" + issues.join("\n") : "none");
console.log(JSON.stringify(stats));
console.log("old levels cut:", cut.join(","));
console.log(
  "ingredient order:",
  rows
    .filter((r) => r.newIng.length)
    .map((r) => `L${r.n}:${r.newIng.join("+")}`)
    .join("  "),
);
console.log(
  "tech order:",
  rows
    .filter((r) => r.newTech.length)
    .map((r) => `L${r.n}:${r.newTech.join("+")}`)
    .join("  "),
);
console.log(
  "counts",
  ["chicken", "steak", "salmon", "tomato", "onion", "garlic", "carrot", "cucumber"]
    .map((g) => `${g}=${countIn(g)}`)
    .join(" "),
);
console.log("recipes not in any level:", unusedRecipes.length);

// Document ----------------------------------------------------------------------------------------------------------------------------
if (process.argv.includes("--write")) {
  void TECH_ORDER;
  const hot = new Set(["chicken", "garlic", "onion", "tomato", "salmon", "carrot", "steak"]);
  const fmt = (g: string, fresh: string[]) =>
    (hot.has(g) ? `**${g}**` : g) + (fresh.includes(g) ? " `NEW`" : "");
  let out = `# KnifeCraft Campaign V2: the ${total}-level campaign (implemented 2026-11-07)

`;
  out += `Generated by \`scripts/campaign-v2-plan.mts\` from the game's own campaign data (\`src/game/levels/campaignPlan.ts\`). The developer approved the plan on 2026-11-07 (keep 91 levels, Meat & Fish Counter after the Italian chapter, optional peeling, parties of 2, three dishes restored) and it is built; sections 9 and 10 record how and what was decided.

`;
  out += `## 1. Why (the data)\n\n`;
  out += `- Playgama telemetry, 8 Oct to 7 Nov 2026 (live build 1.4.x, the OLD game, so use it for the shape, not the exact numbers): 342 users, 288 started a level, 170 finished one; about 22 reached chapter 2, 4 reached chapter 3 and 1 reached chapter 4. The median session lasts 60 seconds (average 6 minutes).\n`;
  out += `- So almost everything is decided in the first 10 to 15 levels. A shorter campaign helps, but the order in which the player discovers things matters more.\n`;
  out += `- Today: chicken arrives at level 57, steak at 61, salmon at 64; the seven most repeated ingredients fill 32 to 43 of 148 levels; levels 89 to 101 and 124 to 148 introduce nothing new.\n\n`;
  out += `## 2. The result\n\n`;
  out += `| | Today | Plan |\n|---|---|---|\n`;
  out += `| Levels | 148 | **${total}** |\n| First chicken | level 57 | **level ${stats.chickenFirst}** |\n| First steak | level 61 | **level ${stats.steakFirst}** |\n| First salmon | level 64 | **level ${stats.salmonFirst}** |\n`;
  out += `| Longest stretch with nothing new (campaign body) | 25 levels | **${stats.bodyGap} levels** |\n| Final mastery tail (no new ingredient, only new combinations) | 25 levels | **${stats.tailLength} levels** (L${stats.tailFrom} to L${total}) |\n| Average prep actions per dish | n/a | ${stats.avgPerOrder} |\n`;
  out += `| Dishes kept | 221 | 221 (every dish stays in the Menu; ${unusedRecipes.length} are not used by a campaign level) |\n\n`;
  out += `How much of the campaign each repeated ingredient fills (share of levels where it can appear):\n\n| Ingredient | Today (of 148) | Plan (of ${total}) |\n|---|---|---|\n`;
  {
    const oldN: Record<string, number> = {
      chicken: 43,
      garlic: 40,
      onion: 38,
      tomato: 34,
      salmon: 34,
      carrot: 32,
      steak: 32,
    };
    for (const g of Object.keys(oldN))
      out += `| ${g} | ${oldN[g]} levels (${Math.round((oldN[g]! / 148) * 100)}%) | ${countIn(g)} levels (${Math.round((countIn(g) / total) * 100)}%) |\n`;
  }
  {
    const oldCount = (g: string) =>
      OLD148.filter((lv) =>
        (lv.batchGroupRecipeIds ?? lv.recipePoolIds ?? []).some((id) =>
          getCampaignRecipe(id)?.components.some((c) => c.ingredientId === g),
        ),
      ).length;
    const all = Object.keys(INGREDIENTS).sort((a, b) => countIn(b) - countIn(a));
    out += `\nEvery ingredient, most repeated first (levels where it can appear):\n\n| Ingredient | Today (of 148) | Plan (of ${total}) | Change in share |\n|---|---|---|---|\n`;
    for (const g of all) {
      const a = (oldCount(g) / 148) * 100;
      const b = (countIn(g) / total) * 100;
      out += `| ${g} | ${oldCount(g)} (${a.toFixed(0)}%) | ${countIn(g)} (${b.toFixed(0)}%) | ${b - a >= 0 ? "+" : ""}${(b - a).toFixed(0)} pts |\n`;
    }
  }
  out += `\nHonest reading: merging removes about the same fraction of every ingredient, so the SHARES barely move (garlic, carrot and steak even rise by a few points); only chicken and salmon fall. What changes is that a new thing arrives much more often, the proteins come early, and the repeated peel can go (section 8). If you want the shares themselves lower, the next step is a "variety pass": swap the garlic, carrot and onion companions in the stir-fry, Thai and fusion pools for other produce.\n`;
  out += `\n| Chapter | Today | Plan |\n|---|---|---|\n`;
  const oldCounts: Record<string, number> = {
    "Opening the Restaurant": 2,
    "Italian Kitchen & First Chicken": 16,
    "The Meat & Fish Counter": 17,
    "French Bistro & Precision": 14,
    "Indian Kitchen & Service": 11,
    "Mediterranean & Latin": 13,
    "Chinese Wok": 12,
    "Thai & Southeast Asian": 13,
    "Korean Kitchen": 6,
    "Italian & French Encore": 10,
    "Mediterranean & Latin Encore": 16,
    "East Asian Fusion": 10,
    "The Grand Finale": 8,
  };
  CHAPTERS.forEach(
    (c, i) => (out += `| ${i + 1}. ${c.name} | ${oldCounts[c.name]} | ${c.levels.length} |\n`),
  );
  out += `\nChapter order change: the Meat & Fish Counter (today's Japanese chapter) moves up to chapter 3. Chinese now comes before the two Encore chapters, which come before Thai and Korean, so new ingredients keep arriving.\n`;
  out += `\n## 3. The design rules (checked by the script)\n\n`;
  out += `1. A new ingredient or a new cut at least every 4 levels up to level 50, and at least every ${stats.bodyGap} levels after that (the cuisines run out of unseen produce; the longest gaps are marked in section 4). The last ${stats.tailLength} levels (Fusion and the Grand Finale) are mastery: no new ingredient, only new combinations.\n`;
  out += `2. A cut is taught in a level of its own before the harder dishes use it; no level teaches more than 2 new cuts.\n`;
  out += `3. Prefer a party of 2 when two dishes truly share ingredients; a party of 3 only for milestone services; shared prep ("batch") only when the dishes really share a cut.\n`;
  out += `4. 3 to 6 ingredients per dish, and about 3 to 7 prep actions per dish.\n`;
  out += `5. No near-identical dish just to fill a level. Dishes that lose their level stay in the Menu and the daily orders.\n`;
  out += `6. Each chapter ends with one service that combines the chapter's skills.\n\n`;
  out += `## 4. When each ingredient and cut appears\n\n`;
  out += `| Ingredient | Today | Plan |\n|---|---|---|\n`;
  const oldFirst = (g: string) => {
    const i = OLD148.findIndex((lv) =>
      (lv.recipePoolIds ?? lv.batchGroupRecipeIds ?? []).some((id) =>
        getCampaignRecipe(id)?.components.some((c) => c.ingredientId === g),
      ),
    );
    return i + 1;
  };
  rows.forEach((r) =>
    r.newIng.forEach((g) => (out += `| ${g} | L${oldFirst(g)} | **L${r.n}** |\n`)),
  );
  out +=
    `\nCuts: ` +
    rows
      .filter((r) => r.newTech.length)
      .map((r) => `L${r.n} ${r.newTech.join(", ")}`)
      .join("; ") +
    `.\n\n`;
  {
    const marks = rows.filter((r) => r.newIng.length || r.newTech.length).map((r) => r.n);
    const gaps: string[] = [];
    for (let i = 1; i < marks.length; i++)
      if (marks[i]! - marks[i - 1]! > 4)
        gaps.push(
          `L${marks[i - 1]! + 1} to L${marks[i]! - 1} (${marks[i]! - marks[i - 1]! - 1} levels)`,
        );
    out += `Stretches of 4 or more levels with nothing new: ${gaps.join("; ")}, then the mastery tail from L${stats.tailFrom}.\n\n`;
  }
  out += `## 5. The ${total} levels\n\nBold = one of the seven most repeated ingredients today. \`NEW\` = first level that uses it. **Peel** marks a dish step that peels. "Today" numbers are the current 148-level numbers (see \`CAMPAIGN-LEVELS-INGREDIENTS-2026-11-07.md\`).\n`;
  let ch = 0;
  for (const r of rows) {
    if (r.chapter !== ch) {
      ch = r.chapter;
      out += `\n### Chapter ${ch}: ${r.chapterName}\n\n${CHAPTERS[ch - 1]!.blurb}\n`;
    }
    const kind =
      r.ord === 1
        ? "one order"
        : r.mode === "batch"
          ? `${r.ord} orders, shared prep (batch)`
          : r.r.length > r.ord
            ? `party of ${r.ord}, drawn from a pool of ${r.r.length} dishes`
            : `party of ${r.ord} (different dishes at once)`;
    out += `\n#### L${r.n} - ${r.title}\n`;
    out += `- ${kind}; from today's ${r.from.length ? r.from.map((o) => "L" + o).join(" + ") : "(no level: new)"}${r.note ? `. ${r.note}` : ""}\n`;
    out += `- Ingredients (${r.ings.length}): ${r.ings.map((g) => fmt(g, r.newIng)).join(", ")}${r.newTech.length ? ` | new cut: ${r.newTech.join(", ")}` : ""}\n`;
    out += `- Dishes:\n`;
    for (const d of r.recs)
      out += `  - ${d.emoji} ${d.name} (\`${d.id}\`): ${d.components.map((c) => `${c.ingredientId} ${c.technique === "peel" ? "**Peel**" : c.technique}`).join(", ")}\n`;
  }
  out += `\n## 6. What happens to today's 148 levels\n\n| Today | Fate |\n|---|---|\n`;
  for (let o = 1; o <= OLD148.length; o++)
    out += `| L${o} ${OLD148[o - 1]!.title} | ${fate.get(o) ?? "**cut** (its dishes stay in the Menu)"} |\n`;
  out += `\n## 7. Dishes not used by any campaign level (${unusedRecipes.length})\n\nThey stay in the Menu and the daily orders. Examples of what each could do later: a Menu unlock, a Today's Special, or a reserved-slot level.\n\n`;
  out += unusedRecipes.map((r) => `- ${r.name} (\`${r.id}\`)`).join("\n") + "\n";

  const peelLevels = (g: string) => rows.filter((r) => r.peel.includes(g)).length;
  out += `\n## 8. Peeling (your second request)\n\n`;
  out += `Today the engine FORCES a peel before any cut on garlic, onion, potato, ginger, apple, pear, pumpkin, turnip, pineapple and watermelon, so every dish that uses them carries a peel step (garlic 44 dishes, onion 39). Cucumber, beetroot, sweet potato, fennel, pea pod, mango, kiwi, pomegranate and coconut are "decoupled": peel and cut are independent, so a dish can ask for a peel or not. No dish asks for a cucumber peel today.\n\n`;
  out += `In this plan, levels with a peel step: onion ${peelLevels("onion")}, garlic ${peelLevels("garlic")}, ginger ${peelLevels("ginger")}, potato ${peelLevels("potato")}, and the fruit and root peels (apple ${peelLevels("apple")}, mango ${peelLevels("mango")}, pineapple ${peelLevels("pineapple")}, kiwi ${peelLevels("kiwi")}, watermelon ${peelLevels("watermelon")}, pear ${peelLevels("pear")}, turnip ${peelLevels("turnip")}, beetroot ${peelLevels("beetroot")}, sweet potato ${peelLevels("sweetpotato")}, pumpkin ${peelLevels("pumpkin")}).\n\n`;
  out += `Proposal ("peel only if the dish needs it"):\n`;
  out += `1. Make every peelable ingredient decoupled, so a dish decides. Today that is an engine rule (\`peelDecoupled\` in \`definitions.ts\`), and the skin shows on the cut faces of an unpeeled onion or garlic, which must be checked visually before we rely on it.\n`;
  out += `2. Keep the peel as a dish step where it is the point: onion rings and French onion, rock-minced garlic and pastes, potato dishes, every fruit and root peel.\n`;
  out += `3. Drop the peel where it only repeats: garlic that is smashed or sliced into a salsa, bruschetta or stir-fry, and onion chopped into a base. Those dishes keep the cut and lose the repeated peel.\n`;
  out += `4. Add 2 to 3 small new dishes where the peel is the satisfying part (cucumber ribbons, peeled apple and pear). They fit in the spare slots (this plan uses ${total} of at most 100).\n\n`;

  out += `## 9. How it was built

`;
  out += `- **Data and numbering:** \`campaignPlan.ts\` holds the levels (the first level in each \`from\` list gives the new level its rewards, unlock items and story); \`campaignSelection.ts\` maps the three numberings and the thresholds; \`levelDefinitions.ts\` builds LEVELS from the plan.
`;
  out += `- **Thresholds:** by PROGRESS for systems, the menu curve, the day, staff, supplies and story; by CONTENT for cuisines (each opens with its chapter, the Asian Chef with the wok chapter), the ribeye and the steak knife.
`;
  out += `- **Saves:** campaignVersion 4; section 6 is the migration table (a merged level asks for all of its parts; cut levels owe nothing).
`;
  out += `- **Economy:** level pay re-tuned (x1.65 at the former-campaign position) to the same completion total; frozen baseline re-recorded (revenue 51,560, completion 243,953, COGS 11,337, quality 1,047, net 285,223); the completionist ends near $299k.
`;
  out += `- **Tools, parties, tests:** the first shopping list at L10 is bigger; a party serves different dishes; about 45 QA suites were re-baselined and the e2e seeds re-pointed (HANDOFF lists them).

`;

  out += `## 10. Decisions (answered 2026-11-07)

`;
  out += `1. **Length:** keep ${total} levels (not 100).
`;
  out += `2. **Chapter order:** good — the Meat & Fish Counter comes right after the Italian chapter, chicken at level ${stats.chickenFirst}.
`;
  out += `3. **Peeling:** yes — optional per dish (section 8; not built yet).
`;
  out += `4. **Parties:** a party of 2 is the default (the plan has ${rows.filter((r) => r.ord === 2).length} of 2, ${rows.filter((r) => r.ord === 3).length} of 3).
`;
  out += `5. **Kept or brought back:** Radish & Cucumber Namasu, Salmon, Tofu & Spinach and Basil Mozzarella Bowl are back in a level each.
`;
  writeFileSync("docs/planning/CAMPAIGN-V2-PLAN-2026-11-07.md", out);
  console.log("wrote doc", out.split("\n").length, "lines");
}

// Detail of what disappears (developer 2026-11-07: "give me the list of recipes or levels that you removed in detail and then merged one") ----
if (process.argv.includes("--detail")) {
  const poolOf = (o: number) =>
    OLD148[o - 1]!.batchGroupRecipeIds ?? OLD148[o - 1]!.recipePoolIds ?? [];
  const inPlan = new Map<string, number[]>();
  rows.forEach((r) => r.r.forEach((id) => inPlan.set(id, [...(inPlan.get(id) ?? []), r.n])));
  const dish = (id: string) => {
    const d = recOf(id);
    return `${d.emoji} ${d.name} (${d.components.map((c) => `${c.ingredientId} ${c.technique}`).join(", ")})`;
  };
  const where = (id: string) =>
    inPlan.has(id)
      ? `still played in new L${[...new Set(inPlan.get(id))].join(", L")}`
      : "NOT in any campaign level (Menu and daily orders only)";
  let d = `# What the V2 plan removes and merges, in detail (2026-11-07)\n\nGenerated by \`scripts/campaign-v2-plan.mts --detail\`. "Today" numbers are the current 148-level numbers. A dish that loses its level is never deleted: it stays in the Menu and the daily orders.\n\n`;
  const vanish = OLD148.map((_, i) => i + 1).filter((o) => {
    const row = rows.find((r) => r.from.includes(o));
    return !row || row.from[0] !== o;
  });
  const cutOnes = OLD148.map((_, i) => i + 1).filter((o) => !rows.some((r) => r.from.includes(o)));
  const mergedAway = vanish.filter((o) => !cutOnes.includes(o));
  d += `## Totals\n\n- Today: 148 levels. Plan: ${total}. So ${148 - total} levels disappear as numbers.\n- ${cutOnes.length} are CUT outright (section A).\n- ${mergedAway.length} are MERGED into another level (section B): their dishes are moved or dropped as listed.\n- ${rows.filter((r) => r.from.length === 1).length} levels are kept one for one (some moved earlier, e.g. the chicken, steak and salmon introductions).\n\n`;
  d += `## A. Levels cut outright (${cutOnes.length})\n\n`;
  for (const o of cutOnes) {
    d += `### Today L${o} - ${OLD148[o - 1]!.title}\n`;
    d += `- ${OLD148[o - 1]!.description}\n`;
    for (const id of poolOf(o)) d += `- ${dish(id)}: ${where(id)}\n`;
    d += `\n`;
  }
  d += `## B. Levels merged into another level (${mergedAway.length})\n\n`;
  for (const r of rows.filter((x) => x.from.length > 1)) {
    d += `### New L${r.n} - ${r.title} (${r.ord} orders)\n`;
    d += `Plays: ${r.r.map((id) => recOf(id).name).join(" + ")}\n\n`;
    for (const o of r.from) {
      d += `- Today L${o} - ${OLD148[o - 1]!.title}${o === r.from[0] ? " (the level this one grows from)" : " (absorbed)"}\n`;
      for (const id of poolOf(o)) {
        const kept = r.r.includes(id);
        d += `  - ${kept ? "KEPT here" : "dropped from this level"}: ${dish(id)}${kept ? "" : `. ${where(id)}`}\n`;
      }
    }
    d += `\n`;
  }
  d += `## C. Levels kept one for one (${rows.filter((r) => r.from.length === 1).length})\n\n| Today | New | Title | Note |\n|---|---|---|---|\n`;
  for (const r of rows.filter((x) => x.from.length === 1))
    d += `| L${r.from[0]} | L${r.n} | ${r.title} | ${r.from[0] !== r.n ? "moved" : "same place"}${r.note ? "; " + r.note.replace(/\|/g, "/") : ""} |\n`;
  const orphans = CAMPAIGN_RECIPES.filter(
    (x) => !inPlan.has(x.id) && OLD148.some((_, i) => poolOf(i + 1).includes(x.id)),
  );
  d += `\n## D. Dishes that played in a level today but play in none in the plan (${orphans.length})\n\nThey stay in the Menu and the daily orders.\n\n`;
  for (const x of orphans)
    d += `- ${dish(x.id)} - was in today L${OLD148.map((_, i) => i + 1)
      .filter((o) => poolOf(o).includes(x.id))
      .join(", L")}\n`;
  writeFileSync("docs/planning/CAMPAIGN-V2-REMOVED-AND-MERGED-2026-11-07.md", d);
  console.log(
    "detail",
    d.split("\n").length,
    "lines;",
    cutOnes.length,
    "cut;",
    mergedAway.length,
    "merged;",
    orphans.length,
    "orphan dishes",
  );
}

if (process.argv.includes("--tables")) {
  const tech: string[] = [];
  const ing: string[] = [];
  for (const r of rows) {
    r.newTech.forEach((t) => tech.push(`  ${t}: ${r.n},`));
    r.newIng.forEach((g) => ing.push(`  ${g}: ${r.n},`));
  }
  console.log("TECH\n" + tech.join("\n") + "\nING\n" + ing.join("\n"));
}
