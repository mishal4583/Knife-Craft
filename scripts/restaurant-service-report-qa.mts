/**
 * SERVICE REPORT QA (supplies plan Phase D, developer 2026-10-10: "they
 * should feel proud after successfully progressing their restaurant").
 * restaurant/serviceReport.ts, serviceSupplies.ts, businessInspection.ts.
 *
 *  R  The supplies keep running totals (guests served, takeaway orders,
 *     pieces packed); a report is the difference since the last one, so
 *     two services report their own numbers.
 *  S  Spotless (from dine-in, L31): soap at the wash-up, nothing left
 *     dirty, cleaning liquid in; spotless services build a streak, a lapse
 *     resets it, the best is kept; before L31 no streak change.
 *  Q  A streak of SPOTLESS_QUALITY_STREAK adds SPOTLESS_QUALITY_PCT to the
 *     restaurant's quality share.
 *  I  The inspector (L91+) warns on the last service's hygiene unless a
 *     Cleaner is on staff; a spotless service or no record changes nothing
 *     (Business Mode saves untouched).
 *  L  Level Complete lines: guests · takeaway (pieces packed) · washed,
 *     "✨ Spotless service · N in a row", or what wasn't spotless.
 *  V  An odd / old record is clamped; no money, no ledger.
 *  W  Wiring: App closes the report after the wash-up and shows its lines;
 *     Restaurant Progress shows "Your restaurant in numbers"; no
 *     Math.random.
 *
 * Run: npx tsx scripts/restaurant-service-report-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { getLevels } from "../src/game/levels/LevelManager.ts";
import { getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import type { SupplyId } from "../src/game/business/businessSupplies.ts";
import { inspectBusiness } from "../src/game/business/businessInspection.ts";
import {
  restaurantSuppliesOf,
  takeOrderSupplies,
  washUp,
} from "../src/game/restaurant/serviceSupplies.ts";
import {
  SPOTLESS_QUALITY_PCT,
  SPOTLESS_QUALITY_STREAK,
  closeServiceReport,
  hygieneIssue,
  restaurantRecordOf,
  serviceReportLines,
  spotlessQualityPct,
} from "../src/game/restaurant/serviceReport.ts";
import { restaurantQualityBonusPct } from "../src/game/restaurant/restaurantEconomy.ts";

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
  "dinner-plates": 20,
  "dinner-forks": 20,
  "dinner-knives": 20,
  "water-glasses": 20,
  "paper-napkins": 50,
  "dish-soap": 2,
  "cleaning-liquid": 2,
  "burger-boxes": 10,
  "paper-bags": 10,
  "cutlery-packs": 10,
  "wet-wipes": 10,
  "tamper-labels": 10,
};
const saveAt = (n: number, stock: Partial<Record<SupplyId, number>> = FULL): SaveData => ({
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
    supplies: {
      ...DEFAULT_SAVE.business.supplies,
      stock: Object.fromEntries(
        Object.entries(stock).map(([id, units]) => [id, { units, costBasis: units * 100 }]),
      ),
    },
  },
});
const plain = recipe(/^Sliced Tomato Plate$/);
const fried = recipe(/Pickled Onion Rings/);
/** One service at level `n`: `dine` dine-in plates and `take` fried takeaways, then the wash-up and the report. */
function service(s: SaveData, n: number, dine: number, take: number) {
  let x = s;
  for (let i = 0; i < dine; i++)
    x = takeOrderSupplies(x, "dine-in", { recipe: plain, levelNumber: n, index: i });
  for (let i = 0; i < take; i++)
    x = takeOrderSupplies(x, "takeaway", { recipe: fried, levelNumber: n, index: dine + i });
  const w = washUp(x, n);
  return closeServiceReport(w.save, n, w.noSoap);
}

console.log("R. The numbers");
{
  const a = service(saveAt(95), 95, 3, 2);
  const b = service(a.save, 95, 1, 0);
  assert(
    a.report.covers === 3 &&
      a.report.takeaway === 2 &&
      a.report.packed === 10 &&
      a.report.washed === 12 &&
      b.report.covers === 1 &&
      b.report.takeaway === 0 &&
      b.report.washed === 4 &&
      restaurantSuppliesOf(b.save).coversTotal === 4 &&
      restaurantRecordOf(b.save).services === 2,
    "R1: 3 guests + 2 takeaways (5 pieces each packed, 4 pieces a guest washed), then 1 guest: each report has its own numbers",
    { a: a.report, b: b.report },
  );
  assert(
    a.save.credits === saveAt(95).credits && a.save.economyLedger.length === 0,
    "R2: no money, no ledger",
  );
}

console.log("S. Spotless");
{
  let s = saveAt(40);
  const streaks: number[] = [];
  for (let i = 0; i < 4; i++) {
    const r = service(s, 40, 2, 0);
    s = r.save;
    streaks.push(r.report.streak);
  }
  // A lapse: no soap.
  const dry = {
    ...s,
    business: {
      ...s.business,
      supplies: {
        ...s.business.supplies,
        stock: { ...s.business.supplies.stock, "dish-soap": { units: 0, costBasis: 0 } },
      },
      restaurantSupplies: { ...restaurantSuppliesOf(s), soapPct: 0 },
    },
  };
  const lapse = service(dry, 40, 2, 0);
  assert(
    streaks.join() === "1,2,3,4" &&
      lapse.report.spotless === false &&
      lapse.report.hygiene?.soap === false &&
      lapse.report.streak === 0 &&
      restaurantRecordOf(lapse.save).bestStreak === 4 &&
      restaurantRecordOf(lapse.save).spotless === 4,
    "S1: spotless services build a streak (1,2,3,4); no soap breaks it; the best (4) is kept",
    { streaks, lapse: lapse.report },
  );
  // Cleaning starts with Level 10 (developer 2026-10-10), so the streak starts there.
  const early = service(saveAt(9, {}), 9, 0, 0);
  assert(
    early.report.spotless === null && early.report.streak === 0 && early.report.hygiene === null,
    "S2: before cleaning starts (L10) there's nothing to keep spotless — no streak change",
  );
}

console.log("Q. Quality");
{
  let s = saveAt(40);
  const base = restaurantQualityBonusPct(s);
  for (let i = 0; i < SPOTLESS_QUALITY_STREAK - 1; i++) s = service(s, 40, 1, 0).save;
  const before = spotlessQualityPct(s);
  s = service(s, 40, 1, 0).save;
  assert(
    before === 0 &&
      spotlessQualityPct(s) === SPOTLESS_QUALITY_PCT &&
      restaurantQualityBonusPct(s) === base + SPOTLESS_QUALITY_PCT,
    `Q1: ${SPOTLESS_QUALITY_STREAK} spotless services in a row add ${SPOTLESS_QUALITY_PCT * 100}% to the quality share`,
  );
}

console.log("I. The inspector");
{
  const clean = service(saveAt(95), 95, 2, 0).save;
  const dirty = {
    ...clean,
    business: {
      ...clean.business,
      restaurantRecord: {
        ...restaurantRecordOf(clean),
        lastHygiene: { soap: false, cleaner: true, dirtyLeft: 6 },
      },
    },
  };
  const kc = (s: SaveData) =>
    inspectBusiness(s).categories.find((c) => c.category === "KITCHEN_CLEANLINESS")!;
  const withCleaner = {
    ...dirty,
    business: {
      ...dirty.business,
      staff: {
        ...dirty.business.staff,
        hiredRoles: [...dirty.business.staff.hiredRoles, "cleaner"],
      },
    },
  } as SaveData;
  assert(
    hygieneIssue(clean) === null &&
      kc(clean).result === "PASS" &&
      kc(dirty).result === "WARNING" &&
      /without soap/.test(kc(dirty).reason) &&
      kc(withCleaner).result === "PASS" &&
      kc(saveAt(95)).result === "PASS",
    "I1: a spotless service passes; a lapse is a cleanliness WARNING (why); a Cleaner on staff passes; no record = unchanged",
    { dirty: kc(dirty) },
  );
}

console.log("L. Level Complete lines");
{
  const r = service(saveAt(95), 95, 3, 2).report;
  const lines = serviceReportLines(r);
  const lapse = serviceReportLines({
    ...r,
    spotless: false,
    hygiene: { soap: true, cleaner: false, dirtyLeft: 0 },
  });
  assert(
    lines[0] === "🍽️ 3 guests served · 🥡 2 takeaway (10 pieces packed) · 🧼 12 washed" &&
      /^✨ Spotless service · 1 in a row/.test(lines[1] ?? "") &&
      /Not spotless: no cleaning liquid/.test(lapse[1] ?? "") &&
      serviceReportLines({ ...r, covers: 0, takeaway: 0, washed: 0, spotless: null }).length === 0,
    "L1: guests · takeaway (pieces packed) · washed; ✨ spotless streak, or why not; nothing to say = no line",
    lines,
  );
}

console.log("V. Odd saves");
{
  const odd = {
    ...saveAt(40),
    business: {
      ...saveAt(40).business,
      restaurantRecord: { services: -3, streak: "x", bestStreak: 2.7, at: null, lastHygiene: 5 },
    },
  } as unknown as SaveData;
  const r = restaurantRecordOf(odd);
  assert(
    r.services === 0 &&
      r.streak === 0 &&
      r.bestStreak === 2 &&
      r.at.covers === 0 &&
      r.lastHygiene === null,
    "V1: an odd record is clamped (never negative, never NaN)",
    r,
  );
}

console.log("W. Wiring");
{
  const app = read("src/App.tsx");
  const prog = read("src/components/kc/RestaurantProgress.tsx");
  const mod = read("src/game/restaurant/serviceReport.ts");
  const insp = read("src/game/business/businessInspection.ts");
  assert(
    /closeServiceReport\(/.test(app) &&
      /serviceReportLines\(/.test(app) &&
      /data-testid="restaurant-numbers"/.test(prog) &&
      /hygieneIssue\(save\)/.test(insp) &&
      !/Math\.random/.test(mod),
    "W1: App closes the report after the wash-up and shows its lines; Progress shows the numbers; the inspector reads the hygiene; no Math.random",
  );
}

console.log(
  failures ? `\nSERVICE REPORT QA: ${failures} FAILURE(S)` : "\nSERVICE REPORT QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
