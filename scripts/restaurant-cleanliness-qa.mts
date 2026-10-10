/**
 * CLEANLINESS & MAINTENANCE QA (developer 2026-10-10). restaurant/cleanliness.ts,
 * serviceReport.ts / hygiene.ts, businessInspection.ts, businessSupplies.ts.
 *
 *  C  Catalog: a 4th section "cleaning" (restaurant build only — the classic
 *     order keeps 3): 7 consumables + 3 durable tools, real sources; the
 *     classic three sections unchanged (18 / 17 / 17).
 *  G  Tasks come only from real services, deterministically: the kitchen's
 *     equipment and bins, grease for fried / sautéed / grilled dishes; the
 *     dining floor, tables when guests ate in (L31+), seeded spills from
 *     messy dishes; the restroom's toilet and floor, refills as the
 *     customers add up. Nothing before L21. One task per kind (count).
 *  X  Cleaning uses its supplies exactly once: a second clean of the same
 *     task changes nothing; opened units are tracked (a bottle = N uses);
 *     a missing tool or supply leaves the task open and names it; no money,
 *     no ledger. The Market purchase lands in the same stock.
 *  S  Staff: the existing Cleaner does the routine tasks of the assigned
 *     areas (never spills), once; daily payroll is unchanged.
 *  P  Spotless: a task open when a service starts makes it not spotless and
 *     resets the streak (the +1 % rule itself unchanged); a clean start keeps
 *     the streak; the existing soap / dirty / cleaning-liquid rules hold.
 *  I  The inspector warns on undone cleaning without a Cleaner; a Cleaner
 *     passes; Business Mode saves (no record) are unchanged.
 *  V  Saves: an odd / old state is clamped; Grandma's cupboard comes once
 *     (cost 0, no ledger), also to an older save past L21.
 *  N  No soft-lock: with $0 and no supplies every task just stays open and
 *     the service still starts (nothing here blocks).
 *  W  Wiring: App / sim call order; no Math.random.
 *
 * Run: npx tsx scripts/restaurant-cleanliness-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { getLevels } from "../src/game/levels/LevelManager.ts";
import { getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import {
  CLEANING_TOOL_IDS,
  RESTAURANT_SUPPLY_SECTION_ORDER,
  SUPPLY_CATALOG,
  SUPPLY_SECTION_ORDER,
  isConsumableSupply,
  type SupplyId,
} from "../src/game/business/businessSupplies.ts";
import { purchaseSupply, supplyUnits } from "../src/game/business/BusinessSuppliesManager.ts";
import { dailyPayroll } from "../src/game/business/businessStaff.ts";
import { inspectBusiness } from "../src/game/business/businessInspection.ts";
import {
  CLEANING_FROM_LEVEL,
  GRANDMAS_CUPBOARD,
  TASK_RULES,
  applyCleanlinessAction,
  areaView,
  cleanAll,
  cleanTask,
  cleanerRound,
  cleanlinessOf,
  giveGrandmasCupboard,
  snapshotServiceStart,
  tasksAfterService,
  usesAvailable,
  usesPerUnit,
  type CleaningTask,
} from "../src/game/restaurant/cleanliness.ts";
import { closeServiceReport, restaurantRecordOf } from "../src/game/restaurant/serviceReport.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const recipe = (name: RegExp) =>
  getLevels()
    .flatMap((l) => [...(l.recipePoolIds ?? []), ...(l.batchGroupRecipeIds ?? [])])
    .map((id) => getCampaignRecipe(id)!)
    .find((r) => name.test(r.name))!;
const FULL: Partial<Record<SupplyId, number>> = {
  "mop-bucket": 1,
  brooms: 1,
  "toilet-brushes": 1,
  "floor-cleaner": 2,
  disinfectant: 4,
  "hand-soap": 2,
  "toilet-paper": 6,
  "paper-towels": 1000,
  "sponges-cloths": 4,
  "bin-liners": 30,
  "dish-soap": 2,
  "cleaning-liquid": 2,
};
const saveAt = (
  n: number,
  stock: Partial<Record<SupplyId, number>> = FULL,
  tasks: CleaningTask[] = [],
  hired: string[] = [],
): SaveData => ({
  ...DEFAULT_SAVE,
  credits: 500_000,
  levelProgress: {
    currentLevelId: `level-${n}`,
    highestUnlockedLevelId: `level-${n}`,
    completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
  },
  business: {
    ...DEFAULT_SAVE.business,
    inventory: {},
    staff: { hiredRoles: hired as never },
    supplies: {
      ...DEFAULT_SAVE.business.supplies,
      stock: Object.fromEntries(
        Object.entries(stock).map(([id, units]) => [id, { units, costBasis: units * 100 }]),
      ),
    },
    ...(tasks.length
      ? { cleanliness: { ...cleanlinessOf(DEFAULT_SAVE), tasks: tasks.map((t) => ({ ...t })) } }
      : {}),
  },
});
const kinds = (s: SaveData) =>
  cleanlinessOf(s)
    .tasks.map((t) => t.kind)
    .sort()
    .join();
const plain = recipe(/^Sliced Tomato Plate$/);
const fried = recipe(/Pickled Onion Rings/);
const curry = recipe(/Steak Curry Bowl/);

console.log("C. Catalog");
{
  const cleaning = SUPPLY_CATALOG.filter((i) => i.section === "cleaning");
  assert(
    SUPPLY_SECTION_ORDER.join() === "culinary,service,packaging" &&
      RESTAURANT_SUPPLY_SECTION_ORDER.join() === "culinary,service,packaging,cleaning" &&
      ["culinary", "service", "packaging"]
        .map((s) => SUPPLY_CATALOG.filter((i) => i.section === s).length)
        .join() === "18,17,17",
    "C1: the classic build keeps its 3 sections (18 / 17 / 17); the restaurant build adds Cleaning",
  );
  assert(
    cleaning.length === 10 &&
      cleaning.filter((i) => isConsumableSupply(i)).length === 7 &&
      CLEANING_TOOL_IDS.every((id) => {
        const it = cleaning.find((i) => i.id === id);
        return it && !isConsumableSupply(it);
      }),
    "C2: Cleaning = 7 consumables (floor cleaner, sanitizer, hand soap, toilet paper, towels, cloths, liners) + 3 durable tools (mop & bucket, broom, toilet brush)",
    cleaning.map((i) => i.id),
  );
  const used = new Set(
    Object.values(TASK_RULES).flatMap((r) => [...r.uses.map((u) => u.id), ...r.tools]),
  );
  assert(
    cleaning.every((i) => used.has(i.id)),
    "C3: every cleaning line is used by a cleaning task",
    cleaning.filter((i) => !used.has(i.id)).map((i) => i.id),
  );
}

console.log("G. Tasks from services");
{
  const before = tasksAfterService(saveAt(20), 20, { recipes: [plain], dineIn: 0, customers: 1 });
  const a = tasksAfterService(saveAt(25), 25, { recipes: [plain], dineIn: 0, customers: 1 });
  const b = tasksAfterService(saveAt(25), 25, { recipes: [plain], dineIn: 0, customers: 1 });
  assert(
    kinds(before) === "" &&
      kinds(a) === "bins,equipment,floor,restroom-floor,toilet" &&
      JSON.stringify(a) === JSON.stringify(b),
    "G1: nothing before L21; from L21 a service leaves the kitchen's equipment and bins, the dining floor, the restroom's toilet and floor (deterministic)",
    kinds(a),
  );
  const g = tasksAfterService(saveAt(40), 40, { recipes: [fried], dineIn: 2, customers: 2 });
  assert(
    kinds(g).includes("grease") && kinds(g).includes("tables") && !kinds(a).includes("tables"),
    "G2: fried food leaves grease; guests eating in (L31+) leave the tables",
    kinds(g),
  );
  let spills = 0;
  for (let n = 31; n < 131; n++)
    if (
      kinds(
        tasksAfterService(saveAt(n), n, { recipes: [curry], dineIn: 1, customers: 1 }),
      ).includes("spill")
    )
      spills++;
  const plainSpills = [31, 32, 33, 34, 35].filter((n) =>
    kinds(tasksAfterService(saveAt(n), n, { recipes: [plain], dineIn: 1, customers: 1 })).includes(
      "spill",
    ),
  ).length;
  assert(
    spills > 15 && spills < 60 && plainSpills === 0,
    "G3: messy dishes spill now and then (seeded, ~35 %); a plain plate never",
    { spills, plainSpills },
  );
  let s = saveAt(30);
  for (let i = 0; i < 3; i++)
    s = tasksAfterService(s, 30, { recipes: [plain], dineIn: 0, customers: 3 });
  const t = cleanlinessOf(s).tasks;
  assert(
    t.find((x) => x.kind === "floor")?.count === 3 &&
      t.some((x) => x.kind === "sink") &&
      t.some((x) => x.kind === "paper") &&
      t.filter((x) => x.kind === "floor").length === 1,
    "G4: one task per kind (a repeat raises its count); restroom refills come as customers add up (9 customers: soap, paper)",
    t,
  );
}

console.log("X. Cleaning uses supplies once");
{
  const s = saveAt(30, FULL, [{ kind: "floor", count: 1, since: 29 }]);
  const one = cleanTask(s, "floor");
  const two = cleanTask(one.save, "floor");
  assert(
    one.ok &&
      supplyUnits(one.save.business.supplies, "floor-cleaner") === FULL["floor-cleaner"]! - 1 &&
      cleanlinessOf(one.save).open["floor-cleaner"] === usesPerUnit("floor-cleaner") - 1 &&
      usesAvailable(one.save, "floor-cleaner") === usesAvailable(s, "floor-cleaner") - 1 &&
      !two.ok &&
      two.save === one.save &&
      one.save.credits === s.credits &&
      one.save.economyLedger.length === s.economyLedger.length &&
      supplyUnits(one.save.business.supplies, "mop-bucket") === 1,
    "X1: mopping opens one bottle of floor cleaner (30 uses → 29 left), the mop isn't used up; cleaning again does nothing; no money, no ledger",
  );
  let x = one.save;
  for (let i = 0; i < 5; i++)
    x = cleanTask(tasksAfterService(x, 30, { recipes: [], dineIn: 0, customers: 0 }), "floor").save;
  assert(
    supplyUnits(x.business.supplies, "floor-cleaner") === FULL["floor-cleaner"]! - 1 &&
      cleanlinessOf(x).open["floor-cleaner"] === usesPerUnit("floor-cleaner") - 6,
    "X2: the opened bottle is used up first (6 floors: still one bottle opened, 24 uses left)",
  );
  const noMop = cleanTask(
    saveAt(30, { "floor-cleaner": 1 }, [{ kind: "floor", count: 1, since: 29 }]),
    "floor",
  );
  const noSoap = cleanTask(
    saveAt(30, { ...FULL, "hand-soap": 0 }, [{ kind: "sink", count: 1, since: 29 }]),
    "sink",
  );
  assert(
    !noMop.ok &&
      noMop.needs.join() === "brooms,mop-bucket" &&
      kinds(noMop.save) === "floor" &&
      !noSoap.ok &&
      noSoap.needs.join() === "hand-soap",
    "X3: a missing tool or supply leaves the task open and names it",
    { noMop: noMop.needs, noSoap: noSoap.needs },
  );
  const bought = purchaseSupply(
    saveAt(30, {}, [{ kind: "sink", count: 1, since: 29 }]),
    "hand-soap",
    1,
  );
  const after = bought.ok ? cleanTask(bought.save, "sink") : null;
  assert(
    bought.ok &&
      !!after?.ok &&
      usesAvailable(bought.save, "hand-soap") === 4 * usesPerUnit("hand-soap"),
    "X4: a Market purchase lands in the same stock the task uses",
  );
}

console.log("S. The Cleaner");
{
  const tasks: CleaningTask[] = [
    { kind: "equipment", count: 1, since: 40 },
    { kind: "floor", count: 1, since: 40 },
    { kind: "spill", count: 1, since: 40 },
    { kind: "toilet", count: 1, since: 40 },
  ];
  const none = cleanerRound(saveAt(41, FULL, tasks));
  const hired = saveAt(41, FULL, tasks, ["cleaner"]);
  const all = cleanerRound(hired);
  const onlyKitchen = cleanerRound(
    applyCleanlinessAction(hired, { kind: "areas", areas: ["kitchen"] }).save,
  );
  assert(
    none.cleaned.length === 0 &&
      all.cleaned.sort().join() === "equipment,floor,toilet" &&
      kinds(all.save) === "spill" &&
      onlyKitchen.cleaned.join() === "equipment" &&
      cleanlinessOf(all.save).byCleaner === 3 &&
      cleanerRound(all.save).cleaned.length === 0 &&
      dailyPayroll(all.save.business.staff.hiredRoles) === dailyPayroll(["cleaner"]),
    "S1: no Cleaner = nothing; a hired Cleaner does the routine tasks of their areas (spills stay the player's), once; payroll unchanged",
    { all: all.cleaned, kitchen: onlyKitchen.cleaned },
  );
}

console.log("P. Spotless");
{
  // A service that starts with a task open isn't spotless.
  let s = saveAt(40, FULL, [], []);
  s = {
    ...s,
    business: {
      ...s.business,
      restaurantRecord: { ...restaurantRecordOf(s), streak: 2, bestStreak: 2 },
    },
  };
  const dirtyStart = tasksAfterService(s, 40, { recipes: [plain], dineIn: 0, customers: 1 });
  const r1 = closeServiceReport(snapshotServiceStart(dirtyStart, 41), 41, false);
  const cleanStart = cleanAll(dirtyStart).save;
  const r2 = closeServiceReport(snapshotServiceStart(cleanStart, 41), 41, false);
  assert(
    r1.report.spotless === false &&
      r1.report.streak === 0 &&
      (r1.report.hygiene?.openTasks ?? 0) === 5 &&
      r2.report.spotless === true &&
      r2.report.streak === 3,
    "P1: tasks open at the start → not spotless, the streak resets; cleaned first → spotless, the streak grows (3)",
    { r1: r1.report.hygiene, r2: r2.report.streak },
  );
  const l21 = closeServiceReport(snapshotServiceStart(saveAt(21), 21), 21, false);
  const l20 = closeServiceReport(snapshotServiceStart(saveAt(20), 20), 20, false);
  assert(
    l21.report.spotless === true && l20.report.spotless === null,
    "P2: from L21 (no cleaning liquid needed before dine-in) a clean start is spotless; before L21 there's no streak",
  );
}

console.log("I. The inspector");
{
  const s = closeServiceReport(
    snapshotServiceStart(
      tasksAfterService(saveAt(95), 95, { recipes: [plain], dineIn: 1, customers: 1 }),
      96,
    ),
    96,
    false,
  ).save;
  const kc = (x: SaveData) =>
    inspectBusiness(x).categories.find((c) => c.category === "KITCHEN_CLEANLINESS")!;
  const withCleaner = {
    ...s,
    business: { ...s.business, staff: { hiredRoles: ["cleaner" as never] } },
  };
  assert(
    kc(s).result === "WARNING" &&
      /cleaning tasks left undone/.test(kc(s).reason) &&
      kc(withCleaner).result === "PASS" &&
      kc(saveAt(95)).result === "PASS",
    "I1: undone cleaning → a cleanliness WARNING (the existing fine rule); a Cleaner passes; no record = unchanged",
    kc(s),
  );
}

console.log("V. Saves");
{
  const odd = {
    ...saveAt(30),
    business: {
      ...saveAt(30).business,
      cleanliness: {
        tasks: [
          { kind: "nope", count: 2 },
          { kind: "floor", count: -3 },
          { kind: "toilet", count: 99 },
        ],
        open: { "floor-cleaner": 999, junk: 3 },
        cleanerAreas: ["attic", "kitchen"],
      },
    },
  } as unknown as SaveData;
  const c = cleanlinessOf(odd);
  assert(
    c.tasks.length === 1 &&
      c.tasks[0]!.count === 9 &&
      c.open["floor-cleaner"] === usesPerUnit("floor-cleaner") &&
      c.cleanerAreas.join() === "kitchen" &&
      c.cupboardAt === null,
    "V1: an odd state is clamped (unknown tasks and areas dropped, counts and opened uses capped)",
    c,
  );
  const fresh = saveAt(20, {});
  const at20 = giveGrandmasCupboard(fresh, 20);
  const at21 = giveGrandmasCupboard(fresh, 21);
  const again = giveGrandmasCupboard(at21, 22);
  const old = giveGrandmasCupboard(saveAt(120, {}), 120);
  assert(
    at20 === fresh &&
      GRANDMAS_CUPBOARD.every((x) => supplyUnits(at21.business.supplies, x.id) === x.units) &&
      at21.economyLedger.length === 0 &&
      at21.credits === fresh.credits &&
      again === at21 &&
      cleanlinessOf(old).cupboardAt === 120,
    "V2: Grandma's cupboard once from L21 (cost 0, no ledger), also to an older save at L120",
  );
}

console.log("N. No soft-lock");
{
  let s = { ...saveAt(60, {}), credits: 0 };
  for (let i = 0; i < 20; i++)
    s = tasksAfterService(s, 60, { recipes: [curry], dineIn: 1, customers: 2 });
  const all = applyCleanlinessAction(s, { kind: "clean-all" });
  const views = (["kitchen", "dining", "restroom"] as const).map((a) => areaView(s, a, 60));
  assert(
    all.cleaned.length === 0 &&
      all.needs.length > 0 &&
      s.credits === 0 &&
      views.every((v) => v.meter >= 5 && v.meter < 100) &&
      cleanlinessOf(s).tasks.every((t) => t.count <= 9),
    "N1: with $0 and nothing in stock the tasks stay open (capped) and say what's needed — nothing blocks, no money moves",
  );
}

console.log("W. Wiring");
{
  const app = read("src/App.tsx");
  const sim = read("scripts/restaurantCampaignSim.mts");
  const mod = read("src/game/restaurant/cleanliness.ts");
  assert(
    /snapshotServiceStart\(base, levelNumber\(level\.id\)\)/.test(app) &&
      /closeServiceReport\([\s\S]{0,400}tasksAfterService\([\s\S]{0,400}cleanerRound\(/.test(app) &&
      /giveGrandmasCupboard\(/.test(app) &&
      /snapshotServiceStart\(s, n\)/.test(sim) &&
      /tasksAfterService\(next, n/.test(sim) &&
      !/Math\.random/.test(mod),
    "W1: App and the sim snapshot at the start, add tasks after the report, then the Cleaner's round; the cupboard; no Math.random",
  );
  assert(CLEANING_FROM_LEVEL === 21, "W2: the whole section opens at Level 21");
}

console.log(failures ? `\nCLEANLINESS QA: ${failures} FAILURE(S)` : "\nCLEANLINESS QA: ALL PASS");
process.exit(failures ? 1 : 0);
