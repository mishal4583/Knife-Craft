/**
 * NO FREE GIFTS QA (developer 2026-10-30: "remove the grandma pantry, grandma left overs, all those
 * things — let the players buy all of it from their own money, from the Market").
 *
 * This file used to test Grandma's fridge (retired 2026-10-15); that feature, her old tools and her
 * cleaning cupboard are now gone for good. It keeps its name (docs link to it) and checks that
 * nothing is given away any more and that the first run works on the player's own money:
 *
 *  N  Nothing is given: the gift modules and grants are gone from the source; a new save holds
 *     only the starter knife and board
 *  M  The Market opens at Level 1: ingredient stock is used from the very first level
 *  F  The first order is affordable from the starting wallet, and a hand points the way
 *  C  A short service still has a safety net (ad or supplier credit) — never a soft-lock
 *
 * Run: npx tsx scripts/restaurant-grandmas-fridge-qa.mts
 */
import fs from "node:fs";
import path from "node:path";

const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => void (store[k] = v),
  removeItem: (k: string) => void delete store[k],
  clear: () => void Object.keys(store).forEach((k) => delete store[k]),
  key: () => null,
  length: 0,
} as Storage;

const ROOT = path.resolve(import.meta.dirname, "..");
const { DEFAULT_SAVE } = await import("../src/game/SaveManager.ts");
const { dollars } = await import("../src/game/money.ts");
const { getLevel } = await import("../src/game/levels/LevelManager.ts");
const { getCampaignRecipe } = await import("../src/game/recipes/campaignRecipes.ts");
const { serviceStockCheck, serviceUsesStock } =
  await import("../src/game/restaurant/campaignStock.ts");
const { isTabOpen, sectionToPoint, grandmaTipFor } =
  await import("../src/game/restaurant/firstLevels.ts");
const { INGREDIENT_STOCK_FIRST_LEVEL } =
  await import("../src/game/restaurant/restaurantProgression.ts");

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const walk = (d: string): string[] =>
  fs
    .readdirSync(path.join(ROOT, d), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));

console.log("N. Nothing is given");
{
  const src = walk("src").filter((f) => /\.(ts|tsx)$/.test(f));
  const offenders = src.filter((f) =>
    /giveGrandmas|GRANDMAS_CUPBOARD|GRANDMAS_TOOL_SET|grandmasFridge\.ts|giveGrandmasLeftovers/.test(
      read(f),
    ),
  );
  assert(
    !fs.existsSync(path.join(ROOT, "src/game/restaurant/grandmasFridge.ts")) &&
      offenders.length === 0,
    "N1: the leftovers fridge module and every Grandma grant (tools, cupboard, leftovers) are gone from the source",
    offenders,
  );
  const owned = DEFAULT_SAVE;
  assert(
    JSON.stringify(owned.ownedKnifeIds) === '["chef"]' &&
      JSON.stringify(owned.ownedBoardIds) === '["walnut"]' &&
      !owned.business.grandmasTools &&
      !owned.business.grandmasFridge &&
      Object.keys(owned.business.supplies.stock).length === 0 &&
      Object.keys(owned.business.inventory).length === 0,
    "N2: a new save holds only the starter knife and board — no tools, supplies or ingredients",
  );
  assert(
    DEFAULT_SAVE.credits === dollars(10),
    "N3: a new game starts with $10.00 — the player's own money for the first shopping",
    DEFAULT_SAVE.credits,
  );
}

console.log("M. The Market opens at Level 1");
{
  assert(
    INGREDIENT_STOCK_FIRST_LEVEL === 1 &&
      serviceUsesStock(1) &&
      isTabOpen("shop", 1) &&
      isTabOpen("inventory", 1),
    "M1: ingredient stock is used from Level 1, and the Market and Inventory are open from the start",
  );
}

console.log("F. The first order, with the player's own money");
{
  for (const n of [1, 2, 3, 4, 5]) {
    const level = getLevel(`level-${n}`)!;
    const ids = level.recipePoolIds ?? [level.recipeId!];
    const worst = Math.max(
      ...ids.map((id) => {
        const c = serviceStockCheck(DEFAULT_SAVE, n, [getCampaignRecipe(id)!]);
        return c.applies ? c.missingCost : Number.POSITIVE_INFINITY;
      }),
    );
    if (n === 1)
      assert(
        worst > 0 && worst <= DEFAULT_SAVE.credits,
        `F1: Level 1's food costs ${worst / 100} dollars — inside the $10.00 start`,
        worst,
      );
    else
      assert(
        worst > 0 && worst < dollars(10),
        `F${n}: Level ${n}'s food is under $10 (${worst / 100} dollars), paid from what the levels earn`,
        worst,
      );
  }
  const pointer = sectionToPoint(1, []);
  const tip = grandmaTipFor(1);
  assert(
    pointer === "shop" && tip?.to === "shop" && tip.focus === "ingredients",
    "F6: the hand points at the Market first, and Level 1's tip opens its ingredients",
    { pointer, tip },
  );
  assert(
    /first-shopping-hint/.test(read("src/components/kc/MarketPlanPanel.tsx")) &&
      /first-shopping-hand/.test(read("src/components/kc/MarketPlanPanel.tsx")),
    "F7: the Market's plan shows a hint and a hand on the first Buy before any level is done",
  );
  const app = read("src/App.tsx");
  assert(
    /setScreen\("kitchen"\);\s*setActiveLevelId\(loaded\.levelProgress\.currentLevelId\)/.test(app),
    "F8: a brand-new player lands on the Kitchen after the intro, not inside the cutting",
  );
}

console.log("C. Never a soft-lock");
{
  const cover = read("src/game/restaurant/serviceCover.ts");
  assert(
    /supplier/i.test(cover) && /ad/i.test(cover),
    "C1: a service the player cannot afford still has the ad / supplier-credit safety net (serviceCover.ts)",
  );
}

console.log(
  failures ? `\nNO FREE GIFTS QA: ${failures} FAILURE(S)` : "\nNO FREE GIFTS QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
