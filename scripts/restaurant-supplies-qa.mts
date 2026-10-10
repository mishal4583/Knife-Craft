/**
 * RESTAURANT SUPPLIES QA — Unified Restaurant phase G: consumable supplies
 * during a service (restaurant/serviceSupplies.ts), tested with the real
 * functions.
 *
 *  U. Unlocks: nothing before dine-in (L31); L31–70 every order dine-in;
 *     from L71 a seeded share is takeaway (same every time, ~30%).
 *  K. Catalog: dish soap and cleaning liquid are two sourced lines (retail ×
 *     0.65, the shared rule), bottles; a bottle line is low only with none
 *     in stock; the Market purchase is the existing one.
 *  B. Bottles: % of the open bottle + sealed spares, "~N services left",
 *     low / empty; a draw opens a sealed bottle when needed (one stock unit,
 *     its cost basis to packaging "used"); empty → nothing changes.
 *  S. Serving: dine-in takes a clean place setting (→ washing) and a napkin;
 *     takeaway a container, a bag and a napkin; missing supplies are simply
 *     not used (never a throw, never negative); null uses nothing.
 *  W. Wash-up: dirty settings washed with one wash-up of soap; no soap →
 *     they stay dirty; nothing dirty → no soap used.
 *  C. Pre-Service Check: settings and packaging block, napkins warn; the
 *     wash-up is counted in when there's soap; costs are whole Market packs;
 *     the plan carries it and opens the sheet when something blocks.
 *  G. Covering what blocks (rule changed, developer 2026-10-10: Grandma's
 *     spares are gone): only when the wallet can't cover it, a rewarded ad
 *     brings exactly the missing units at cost 0 (no money, no ledger), or
 *     supplier credit brings the Market's packs, owed (no money now); then
 *     ready.
 *  D. Closing: the wipe-down uses cleaning liquid from L31; none → the day
 *     still closes; before L31 nothing; the preview shows the bottle.
 *  M. No function here moves money or writes the ledger.
 *  L. Saves: no field → defaults; malformed values clamped; the state and the
 *     new stock lines survive the real SaveManager save/load.
 *  R. Wiring: both campaign serve paths and menu guests take supplies, only
 *     under RESTAURANT_MODE and never on a replay; a guest needs a clean
 *     setting; the wash-up runs at start and after a service; Business
 *     orders are unchanged.
 *
 * Run: npx tsx scripts/restaurant-supplies-qa.mts
 */
const memoryStore = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memoryStore.get(k) ?? null,
  setItem: (k: string, v: string) => void memoryStore.set(k, v),
  removeItem: (k: string) => void memoryStore.delete(k),
  clear: () => memoryStore.clear(),
  key: () => null,
  length: 0,
} as Storage;

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, SaveManager, type SaveData } from "../src/game/SaveManager.ts";
import {
  SERVICE_SUPPLY_RULES,
  bottleView,
  cleanSettings,
  closingWipeDown,
  drawFromBottle,
  orderServiceFor,
  restaurantSuppliesOf,
  serviceSuppliesCheck,
  settingsOwned,
  suppliesNeedAttention,
  takeOrderSupplies,
  washUp,
  type OrderService,
} from "../src/game/restaurant/serviceSupplies.ts";
import {
  SUPPLY_WHOLESALE_FACTOR,
  getSupplyItem,
  isBottleSupply,
  supplyPackPrice,
  type SupplyId,
} from "../src/game/business/businessSupplies.ts";
import { isLowSupply, purchaseSupply } from "../src/game/business/BusinessSuppliesManager.ts";
import {
  closeDay,
  closingPreview,
  openDay,
  recordService,
  restaurantDayOf,
} from "../src/game/restaurant/restaurantDay.ts";
import { servicePlanFor, servicePlanNeedsSheet } from "../src/game/restaurant/preServiceCheck.ts";
import { coverFor, coverWithAd, coverWithCredit } from "../src/game/restaurant/serviceCover.ts";
import { supplierCreditOf } from "../src/game/restaurant/supplierCredit.ts";

const check0 = (s: SaveData, services: OrderService[]) => {
  const c = serviceSuppliesCheck(s, 31, services);
  return c.applies ? c : { missingCost: -1 };
};
import { getLevel } from "../src/game/levels/LevelManager.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const read = (p: string) => fs.readFileSync(path.resolve(p), "utf8");

function saveAt(n: number, credits = 500_000): SaveData {
  return {
    ...structuredClone(DEFAULT_SAVE),
    credits,
    levelProgress: {
      ...structuredClone(DEFAULT_SAVE.levelProgress),
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
  };
}
function stocked(save: SaveData, lines: Partial<Record<SupplyId, number>>): SaveData {
  const stock = { ...save.business.supplies.stock };
  for (const [id, units] of Object.entries(lines))
    stock[id as SupplyId] = { units: units!, costBasis: units! * 10 };
  return {
    ...save,
    business: { ...save.business, supplies: { ...save.business.supplies, stock } },
  };
}
const units = (s: SaveData, id: SupplyId) => s.business.supplies.stock[id]?.units ?? 0;
const SETTING = { "dinner-plates": 12, "dinner-forks": 12, "dinner-knives": 12 } as const;

console.log("U. Unlocks");
{
  assert(
    [1, 11, 21, 30].every((n) => [0, 1, 2].every((i) => orderServiceFor(n, i) === null)),
    "U1: no supplies before dine-in (L31)",
  );
  assert(
    Array.from({ length: 40 }, (_, k) => 31 + k).every((n) =>
      [0, 1, 2, 3].every((i) => orderServiceFor(n, i) === "dine-in"),
    ),
    "U2: L31–70 every order is dine-in",
  );
  let take = 0;
  let all = 0;
  for (let n = 71; n <= 250; n++)
    for (let i = 0; i < 4; i++) {
      all++;
      if (orderServiceFor(n, i) === "takeaway") take++;
    }
  const share = take / all;
  assert(
    share > 0.22 && share < 0.38,
    `U3: from L71 about 30% takeaway (${(share * 100).toFixed(1)}%)`,
  );
  assert(
    Array.from({ length: 50 }, (_, k) => 71 + k).every(
      (n) => orderServiceFor(n, 2) === orderServiceFor(n, 2),
    ),
    "U4: seeded — the same level and order index always give the same answer",
  );
}

console.log("K. Catalog");
{
  const soap = getSupplyItem("dish-soap")!;
  const cleaner = getSupplyItem("cleaning-liquid")!;
  assert(
    soap &&
      cleaner &&
      soap.section === "packaging" &&
      cleaner.section === "packaging" &&
      soap.packSize === 4 &&
      cleaner.packSize === 4,
    "K1: dish soap and cleaning liquid are packaging & hygiene lines, 4 gallon bottles a pack",
  );
  assert(
    supplyPackPrice(soap) === Math.round(5099 * SUPPLY_WHOLESALE_FACTOR) &&
      supplyPackPrice(cleaner) === Math.round(5149 * SUPPLY_WHOLESALE_FACTOR) &&
      [soap, cleaner].every((i) => /^https:\/\/www\.webstaurantstore\.com\//.test(i.source.url)),
    "K2: priced by the shared rule (retail × 0.65) from a recorded WebstaurantStore source",
  );
  const empty = saveAt(31).business.supplies;
  const one = stocked(saveAt(31), { "dish-soap": 1 }).business.supplies;
  assert(
    isBottleSupply(soap) &&
      isLowSupply(empty, soap, 40) &&
      !isLowSupply(one, soap, 40) &&
      isLowSupply(empty, getSupplyItem("paper-napkins")!, 40),
    "K3: a bottle line is low only with no bottle in stock (napkins keep the per-customer rule)",
  );
  const bought = purchaseSupply(saveAt(31, 10_000), "dish-soap", 1);
  assert(
    bought.ok &&
      bought.save.credits === 10_000 - supplyPackPrice(soap) &&
      units(bought.save, "dish-soap") === 4,
    "K4: the existing Market purchase buys a pack of 4 bottles",
  );
}

console.log("B. Bottles");
{
  const s = stocked(saveAt(31), { "dish-soap": 4 });
  const v = bottleView(s, "dish-soap");
  assert(
    v.openPct === 0 &&
      v.spare === 4 &&
      v.servicesLeft === 400 / SERVICE_SUPPLY_RULES.soapPerWashUp &&
      v.status === "ok",
    `B1: 4 sealed bottles, none open → ~${v.servicesLeft} services`,
  );
  const d = drawFromBottle(s, "dish-soap");
  const after = restaurantSuppliesOf(d.save);
  assert(
    d.ok &&
      after.soapPct === 100 - SERVICE_SUPPLY_RULES.soapPerWashUp &&
      units(d.save, "dish-soap") === 3 &&
      d.save.business.supplies.lifetime.packaging.unitsUsed === 1 &&
      d.save.business.supplies.lifetime.packaging.usedCost === 10,
    "B2: a draw with nothing open opens one sealed bottle (stock −1, its cost basis to 'used')",
  );
  const d2 = drawFromBottle(d.save, "dish-soap");
  assert(
    d2.ok && units(d2.save, "dish-soap") === 3 && restaurantSuppliesOf(d2.save).soapPct === 90,
    "B3: the next draw comes from the open bottle",
  );
  const none = saveAt(31);
  const dn = drawFromBottle(none, "dish-soap");
  assert(!dn.ok && dn.save === none, "B4: no soap at all → nothing changes");
  const low = {
    ...saveAt(31),
    business: {
      ...saveAt(31).business,
      restaurantSupplies: { soapPct: 12, cleanerPct: 0, washing: 0 },
    },
  };
  assert(
    bottleView(low, "dish-soap").status === "low" &&
      bottleView(low, "dish-soap").servicesLeft === 2 &&
      bottleView(low, "cleaning-liquid").status === "empty",
    "B5: 12% open = ~2 services (low); nothing = empty",
  );
  const pour = drawFromBottle(stocked(low, { "dish-soap": 1 }), "dish-soap");
  assert(
    restaurantSuppliesOf(pour.save).soapPct === 12 - 5 && units(pour.save, "dish-soap") === 1,
    "B6: the open bottle is used first while it covers a draw",
  );
  const tail = {
    ...low,
    business: { ...low.business, restaurantSupplies: { soapPct: 3, cleanerPct: 0, washing: 0 } },
  };
  const opened = drawFromBottle(stocked(tail, { "dish-soap": 1 }), "dish-soap");
  assert(
    restaurantSuppliesOf(opened.save).soapPct === 98 && units(opened.save, "dish-soap") === 0,
    "B7: what's left in the old bottle is poured into the new one (3% + 100% − 5%)",
  );
}

console.log("S. Serving");
{
  const s = stocked(saveAt(31), { ...SETTING, "paper-napkins": 2 });
  const one = takeOrderSupplies(s, "dine-in");
  assert(
    restaurantSuppliesOf(one).washing === 1 &&
      cleanSettings(one) === 11 &&
      settingsOwned(one) === 12 &&
      units(one, "paper-napkins") === 1 &&
      units(one, "dinner-plates") === 12,
    "S1: dine-in takes a clean setting (→ washing, never destroyed) and a napkin",
  );
  const bare = saveAt(31);
  const b = takeOrderSupplies(bare, "dine-in");
  assert(
    restaurantSuppliesOf(b).washing === 0 && Object.keys(b.business.supplies.stock).length === 0,
    "S2: with nothing in stock nothing is used (no throw, nothing negative)",
  );
  const t = takeOrderSupplies(
    stocked(saveAt(80), {
      "microwave-containers": 2,
      "paper-bags": 2,
      "paper-napkins": 2,
      ...SETTING,
    }),
    "takeaway",
  );
  assert(
    units(t, "microwave-containers") === 1 &&
      units(t, "paper-bags") === 1 &&
      units(t, "paper-napkins") === 1 &&
      restaurantSuppliesOf(t).washing === 0,
    "S3: takeaway takes a container, a bag and a napkin — no place setting",
  );
  assert(takeOrderSupplies(s, null) === s, "S4: before dine-in an order uses nothing");
  let many = s;
  for (let i = 0; i < 15; i++) many = takeOrderSupplies(many, "dine-in");
  assert(
    restaurantSuppliesOf(many).washing === 12 &&
      cleanSettings(many) === 0 &&
      units(many, "paper-napkins") === 0,
    "S5: never more settings in washing than owned; napkins stop at 0",
  );
}

console.log("W. Wash-up");
{
  const used = takeOrderSupplies(
    takeOrderSupplies(stocked(saveAt(31), { ...SETTING, "dish-soap": 1 }), "dine-in"),
    "dine-in",
  );
  const w = washUp(used, 31);
  // Rule changed (supplies plan B, 2026-10-10): the wash-up counts PIECES (2 settings = 6
  // pieces) and the soap scales with them (at least one wash-up's 5 %); a piece may break.
  assert(
    w.washed === 6 &&
      !w.noSoap &&
      restaurantSuppliesOf(w.save).washing === 0 &&
      Object.keys(restaurantSuppliesOf(w.save).dirty).length === 0 &&
      cleanSettings(w.save) === settingsOwned(w.save) &&
      settingsOwned(w.save) === 12 - w.broken.length &&
      restaurantSuppliesOf(w.save).soapPct === 95,
    "W1: the wash-up washes every waiting piece (6 for two settings) with one wash-up of soap (5 %)",
  );
  const dry = takeOrderSupplies(stocked(saveAt(31), SETTING), "dine-in");
  const wd = washUp(dry, 31);
  assert(
    wd.noSoap && wd.save === dry && cleanSettings(wd.save) === 11,
    "W2: no soap → the setting stays dirty",
  );
  const clean = stocked(saveAt(31), { ...SETTING, "dish-soap": 1 });
  assert(washUp(clean, 31).save === clean, "W3: nothing to wash → no soap used");
  assert(washUp(used, 30).save === used, "W4: before dine-in there is no wash-up");
}

console.log("C. Pre-Service Check");
{
  const empty = saveAt(31);
  const c = serviceSuppliesCheck(empty, 31, ["dine-in", "dine-in"]);
  const plate = getSupplyItem("dinner-plates")!;
  const fork = getSupplyItem("dinner-forks")!;
  const knife = getSupplyItem("dinner-knives")!;
  assert(
    c.applies &&
      !c.ready &&
      c.dineIn === 2 &&
      c.rows
        .filter((r) => r.blocking)
        .map((r) => r.id)
        .join() === "dinner-plates,dinner-forks,dinner-knives" &&
      c.rows.find((r) => r.id === "paper-napkins")?.blocking === false &&
      c.missingCost === supplyPackPrice(plate) + supplyPackPrice(fork) + supplyPackPrice(knife),
    "C1: no tableware: plate, fork and knife block (one Market pack each); napkins only warn",
  );
  assert(
    !serviceSuppliesCheck(empty, 30, ["dine-in"]).applies,
    "C2: no supplies section before L31",
  );
  const ready = stocked(saveAt(31), SETTING);
  const r = serviceSuppliesCheck(ready, 31, ["dine-in", "dine-in"]);
  assert(
    r.applies &&
      r.ready &&
      r.rows.find((x) => x.id === "paper-napkins")!.missing === 2 &&
      suppliesNeedAttention(r),
    "C3: settings in stock → ready; no napkins is a warning that still shows the check",
  );
  let dirty = stocked(saveAt(31), { "dinner-plates": 2, "dinner-forks": 2, "dinner-knives": 2 });
  dirty = takeOrderSupplies(takeOrderSupplies(dirty, "dine-in"), "dine-in");
  const noSoap = serviceSuppliesCheck(dirty, 31, ["dine-in"]);
  const withSoap = serviceSuppliesCheck(stocked(dirty, { "dish-soap": 1 }), 31, ["dine-in"]);
  assert(
    noSoap.applies &&
      !noSoap.ready &&
      noSoap.rows[0]!.dirty === 2 &&
      withSoap.applies &&
      withSoap.ready &&
      withSoap.rows[0]!.dirty === 0,
    "C4: dirty settings with no soap block; with soap the start's wash-up makes them ready",
  );
  const ta = serviceSuppliesCheck(stocked(saveAt(80), SETTING), 80, [
    "dine-in",
    "takeaway",
    "takeaway",
  ]);
  assert(
    ta.applies &&
      !ta.ready &&
      ta.takeaway === 2 &&
      ta.rows.some((x) => x.label === "Takeaway containers" && x.blocking && x.missing === 2) &&
      ta.rows.some((x) => x.label === "Takeaway bags" && x.blocking && x.missing === 2),
    "C5: takeaway orders need a container and a bag each (blocking)",
  );
  const lvl = getLevel("level-31")!;
  const plan = servicePlanFor(openDay(empty, 31), lvl)!;
  assert(
    plan.supplies.applies &&
      plan.services.length === plan.tickets.length &&
      plan.services.every((s) => s === "dine-in") &&
      servicePlanNeedsSheet(plan),
    "C6: the service plan carries the supplies; something blocking opens the sheet mid-day",
  );
  // Supplies plan B: "every supply" = what this service's dishes, guests and tables need.
  const bare = openDay(saveAt(31), 31);
  const needs = servicePlanFor(bare, lvl)!.supplies;
  const full = stocked(bare, {
    ...SETTING,
    ...(needs.applies
      ? Object.fromEntries(
          needs.rows.map((r) => [
            r.id,
            Math.max(r.need, SETTING[r.id as keyof typeof SETTING] ?? 0),
          ]),
        )
      : {}),
    "paper-napkins": 50,
    "dish-soap": 1,
    "cleaning-liquid": 1,
  });
  const ok = servicePlanFor(full, lvl)!;
  assert(
    ok.supplies.applies &&
      ok.supplies.ready &&
      !suppliesNeedAttention(ok.supplies) &&
      // Mid-day, the sheet then opens only if the food needs attention.
      servicePlanNeedsSheet(ok) === (ok.check.applies && (!ok.check.ready || ok.check.hasExpired)),
    "C7: with every supply in stock the supplies never open the sheet",
  );
}

console.log("G. Covering what blocks (ad / supplier credit)");
{
  const plan31 = (s: SaveData, services: OrderService[]) => ({
    levelNumber: 31,
    check: { applies: false } as const,
    supplies: serviceSuppliesCheck(s, 31, services),
  });
  const rich = saveAt(31);
  assert(
    coverFor(plan31(rich, ["dine-in"]), "supplies") === null &&
      coverWithAd(rich, plan31(rich, ["dine-in"]), "supplies") === null,
    "G1: never when the wallet can cover it (the player buys it)",
  );
  const poor = saveAt(31, 100);
  const three: OrderService[] = ["dine-in", "dine-in", "dine-in"];
  const lent = coverWithAd(poor, plan31(poor, three), "supplies")!;
  const after = serviceSuppliesCheck(lent, 31, three);
  assert(
    lent &&
      units(lent, "dinner-plates") === 3 &&
      units(lent, "dinner-forks") === 3 &&
      lent.business.supplies.stock["dinner-plates"]!.costBasis === 0 &&
      units(lent, "paper-napkins") === 0 &&
      lent.credits === 100 &&
      lent.economyLedger.length === poor.economyLedger.length &&
      after.applies &&
      after.ready,
    "G2: the ad brings exactly the missing blocking units at cost 0 (not the napkins), no money, no ledger → ready",
  );
  const offer = coverFor(plan31(poor, three), "supplies")!;
  const credit = coverWithCredit(poor, plan31(poor, three), "supplies")!;
  const afterCredit = serviceSuppliesCheck(credit, 31, three);
  assert(
    credit &&
      units(credit, "dinner-plates") === 12 &&
      credit.business.supplies.stock["dinner-plates"]!.costBasis > 0 &&
      credit.credits === 100 &&
      credit.economyLedger.length === poor.economyLedger.length &&
      supplierCreditOf(credit).owed === offer.creditCost &&
      offer.creditCost === check0(poor, three).missingCost &&
      afterCredit.applies &&
      afterCredit.ready,
    `G3: supplier credit brings the Market's packs (12 plates), owes their price (${offer.creditCost}¢), moves no money now → ready`,
  );
  assert(
    coverFor(plan31(lent, three), "supplies") === null &&
      coverWithAd(lent, plan31(lent, three), "supplies") === null,
    "G4: nothing more once the service can start",
  );
}

console.log("D. Closing");
{
  const due = (n: number, extra: Partial<Record<SupplyId, number>>) => {
    let s = stocked(openDay(saveAt(n), n), extra);
    s = recordService(recordService(recordService(s, n), n), n);
    return s;
  };
  const s = due(31, { "cleaning-liquid": 1 });
  const closed = closeDay(s, 31);
  assert(
    restaurantDayOf(s).closingDue &&
      restaurantDayOf(closed).day === 2 &&
      restaurantSuppliesOf(closed).cleanerPct === 100 - SERVICE_SUPPLY_RULES.cleanerPerClosing &&
      units(closed, "cleaning-liquid") === 0 &&
      closed.credits === s.credits,
    "D1: from L31 the closing wipe-down uses cleaning liquid (no money)",
  );
  const dry = due(31, {});
  const closedDry = closeDay(dry, 31);
  assert(
    restaurantDayOf(closedDry).day === 2 && restaurantSuppliesOf(closedDry).cleanerPct === 0,
    "D2: no cleaning liquid → the day still closes (a warning, not a block)",
  );
  const early = due(25, { "cleaning-liquid": 1 });
  assert(
    units(closeDay(early, 25), "cleaning-liquid") === 1 &&
      closingPreview(early, 25).cleaner === null,
    "D3: before L31 closing uses none and shows no bottle",
  );
  assert(
    closingPreview(s, 31).cleaner?.spare === 1 && closingWipeDown(saveAt(20), 20).ok,
    "D4: the closing preview shows the bottle; before L31 the wipe-down needs nothing",
  );
}

console.log("M. Money");
{
  let s = stocked(saveAt(80), {
    ...SETTING,
    "dish-soap": 1,
    "cleaning-liquid": 1,
    "microwave-containers": 3,
    "paper-bags": 3,
    "paper-napkins": 9,
  });
  const c0 = s.credits;
  const l0 = s.economyLedger.length;
  s = takeOrderSupplies(s, "dine-in");
  s = takeOrderSupplies(s, "takeaway");
  s = washUp(s, 80).save;
  s = drawFromBottle(s, "cleaning-liquid").save;
  assert(
    s.credits === c0 && s.economyLedger.length === l0,
    "M1: using supplies never moves money or writes the ledger",
  );
}

console.log("L. Saves");
{
  const old = saveAt(31);
  delete (old.business as { restaurantSupplies?: unknown }).restaurantSupplies;
  const d = restaurantSuppliesOf(old);
  assert(
    d.soapPct === 0 && d.cleanerPct === 0 && d.washing === 0,
    "L1: a save without the field reads as empty bottles, nothing washing",
  );
  const bad = {
    ...old,
    business: {
      ...old.business,
      restaurantSupplies: { soapPct: 250, cleanerPct: -4, washing: -2.5 },
    },
  } as SaveData;
  const b = restaurantSuppliesOf(bad);
  assert(
    b.soapPct === 100 && b.cleanerPct === 0 && b.washing === 0,
    "L2: malformed values are clamped",
  );
  let s = stocked(saveAt(31), { ...SETTING, "dish-soap": 2, "cleaning-liquid": 1 });
  s = washUp(takeOrderSupplies(s, "dine-in"), 31).save;
  s = takeOrderSupplies(s, "dine-in");
  await SaveManager.save(s);
  const back = await SaveManager.load();
  assert(
    restaurantSuppliesOf(back).soapPct === 95 &&
      restaurantSuppliesOf(back).washing === 1 &&
      units(back, "dish-soap") === 1 &&
      units(back, "cleaning-liquid") === 1,
    "L3: the bottles, the washing count and the new stock lines survive the real SaveManager save/load",
  );
}

console.log("R. Wiring");
{
  const app = read("src/App.tsx");
  const takes =
    app.match(/takeOrderSupplies\(\s*stock\?\.ok \? stock\.save : save,\s*orderServiceFor\(/g) ??
    [];
  assert(
    takes.length === 2 &&
      (app.match(/RESTAURANT_MODE && level && save && !isReplay\s*\?\s*takeOrderSupplies\(/g) ?? [])
        .length === 2,
    "R1: both campaign serve paths take the order's supplies, only under RESTAURANT_MODE and never on a replay",
  );
  assert(
    // Supplies plan B: the guest's own tableware, by their dish (a cover after the orders).
    /const withSupplies = takeOrderSupplies\(\s*stock\.save,\s*isSystemLive\("dine-in", levelNumber\(level\.id\)\) \? "dine-in" : null,[\s\S]{0,160}\{ recipe, levelNumber: levelNumber\(level\.id\), index: guestCover\(save, level\) \},?\s*\)/.test(
      app,
    ) &&
      /cleanSettingFor\(s, guest\.recipe, n, guestCover\(s, level\)\)/.test(app) &&
      /function guestHasSetting/.test(app) &&
      /!guestHasSetting\(save, campaignLevelForSession!\)/.test(app) &&
      /!guest\.inStock \|\| \(level && !guestHasSetting\(save, level\)\)/.test(app),
    "R2: a menu guest eats in (their dish's tableware + napkin) and can't be taken without it clean",
  );
  assert(
    /if \(RESTAURANT_MODE && level && !isCompleted\(level\.id, base\.levelProgress\)\)\s*base = (?:markStarterCrateSeen\()?washUp\(base, levelNumber\(level\.id\)\)\.save\)?;/.test(
      app,
    ) &&
      /(?:nextSave|const washed) = washUp\(\s*recordService\(nextSave, levelNumber\(level\.id\)\)/.test(
        app,
      ),
    "R3: the wash-up runs when a first play starts (phase M also marks the starter crate seen there) and after a service",
  );
  const day = read("src/game/restaurant/restaurantDay.ts");
  assert(
    /next = closingWipeDown\(next, levelNumber\)\.save;/.test(day),
    "R4: closing does the wipe-down",
  );
  const biz = read("src/game/business/BusinessServiceManager.ts");
  assert(
    !/serviceSupplies/.test(biz) && /takePackagingForOrder/.test(biz),
    "R5: Business orders are unchanged (still one container + one bag)",
  );
  const mod = read("src/game/restaurant/serviceSupplies.ts");
  assert(
    !/RESTAURANT_MODE/.test(mod.replace(/\/\*[\s\S]*?\*\//g, "")) && !/Math\.random/.test(mod),
    "R6: the module never reads the switch and is deterministic",
  );
}

console.log(
  failures ? `RESTAURANT SUPPLIES QA: ${failures} FAILURE(S)` : "RESTAURANT SUPPLIES QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
