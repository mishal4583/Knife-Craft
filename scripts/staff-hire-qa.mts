/**
 * STAFF_HIRE_QA — early game phase 4 (developer 2026-10-26: "I need everything to be unlocked
 * at or before level 5" and "don't make any staff hire for free, let them pay for it").
 *   F. the hiring fee: 3 days' full pay, whole dollars, for every role and specialist chef;
 *   H. a hire: charged exactly once (one "staff-purchase" entry, opening + ledger = closing),
 *      all-or-nothing when short, no charge when already hired, re-hiring pays again;
 *   W. wages unchanged (no pay before L29, half pay to L55, full from L56) — never charged twice;
 *   C. capacity: a hired cook or server still adds a seat (menu guests / walk-ins);
 *   U. every unlock at or before Level 5, in its old order, prices unchanged;
 *   O. old saves: hired staff, wallet and ledger kept; a pre-V2.5 save keeps exactly the kitchen
 *      tiers its level entitled it to (the cap never grants tiers);
 *   A. the App wiring.
 *
 * Run: npx tsx scripts/staff-hire-qa.mts
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
import { execSync } from "node:child_process";
import { DEFAULT_SAVE, SaveManager, type SaveData } from "../src/game/SaveManager.ts";
import type { LevelProgress } from "../src/game/levels/LevelManager.ts";
import {
  HALF_WAGES_FROM,
  HIRE_FEE_DAYS,
  SPECIALIST_CHEFS,
  STAFF_HIRE_FROM,
  hireRestaurantStaff,
  payHalfWages,
  restaurantStaffOf,
  specialistOpensAt,
  staffHireFee,
} from "../src/game/restaurant/staffRequirements.ts";
import { ALL_STAFF_ROLES, dailyPayroll } from "../src/game/business/businessStaff.ts";
import { fireStaff } from "../src/game/business/BusinessStaffManager.ts";
import { menuGuestCapacity, walkInsFor } from "../src/game/restaurant/menuGuests.ts";
import { EARLY_UNLOCK_CAP } from "../src/game/config/earlyUnlocks.ts";
import { KNIFE_CATALOG } from "../src/game/knives/knifeDefinitions.ts";
import { BOARD_CATALOG } from "../src/game/boards/boardDefinitions.ts";
import {
  KITCHEN_UPGRADE_CATALOG,
  LEGACY_KITCHEN_GRANT_LEVEL,
} from "../src/game/kitchen/kitchenUpgradeDefinitions.ts";
import { STAFF_CATALOG } from "../src/game/economy/staffDefinitions.ts";
import { SECOND_FLOOR_OPENS_AT, STATIONS_OPEN_AT } from "../src/game/restaurant/secondFloor.ts";
import { RESTAURANT_MAP_ZONES } from "../src/components/kc/restaurantMap/restaurantMapZones.ts";
import { TAB_OPENS_AT } from "../src/game/restaurant/firstLevels.ts";
import { CLEANING_FROM_LEVEL } from "../src/game/restaurant/cleanliness.ts";
import { migrateKitchenDevelopment } from "../src/game/kitchen/KitchenUpgradeManager.ts";
import { restaurantSystem } from "../src/game/restaurant/restaurantProgression.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASE = "057d728";
let failures = 0;
function assert(cond: unknown, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`ok   ${label}`);
}
const progressAt = (n: number): LevelProgress => ({
  ...DEFAULT_SAVE.levelProgress,
  currentLevelId: `level-${n}`,
  highestUnlockedLevelId: `level-${n}`,
  completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
});
const saveAt = (n: number, credits = 50_000, roles: string[] = []): SaveData => ({
  ...DEFAULT_SAVE,
  credits,
  levelProgress: progressAt(n),
  business: { ...DEFAULT_SAVE.business, staff: { hiredRoles: roles as never } },
});
const ledgerSum = (s: SaveData) => s.economyLedger.reduce((n, e) => n + e.amount, 0);

console.log("F. The hiring fee");
{
  const ids = [...ALL_STAFF_ROLES, ...SPECIALIST_CHEFS.map((c) => c.id)];
  const fees = Object.fromEntries(ids.map((id) => [id, staffHireFee(id)]));
  assert(
    HIRE_FEE_DAYS === 3 &&
      ALL_STAFF_ROLES.every(
        (r) => fees[r] === Math.round((dailyPayroll([r]) * 3) / 100) * 100 && fees[r]! > 0,
      ) &&
      SPECIALIST_CHEFS.every((c) => fees[c.id] === Math.round((c.dailyWage * 3) / 100) * 100) &&
      ids.every((id) => fees[id]! % 100 === 0) &&
      staffHireFee("nobody") === null,
    "F1: every role and chef has a fee of 3 days' full pay in whole dollars (none is free)",
    fees,
  );
  assert(
    fees["prep-cook"] === 12_000 &&
      fees["server"] === 11_300 &&
      fees["cleaner"] === 8_400 &&
      fees["head-chef"] === 21_000,
    "F2: e.g. Prep Cook $120, Server $113, Cleaner $84, Head Chef $210",
  );
}

console.log("H. A hire");
{
  const s = saveAt(5, 50_000);
  const h = hireRestaurantStaff(s, "prep-cook", 5);
  assert(
    h.ok &&
      h.fee === 12_000 &&
      h.save.credits === s.credits - 12_000 &&
      h.save.economyLedger.length === s.economyLedger.length + 1 &&
      h.save.economyLedger.at(-1)!.category === "staff-purchase" &&
      h.save.economyLedger.at(-1)!.amount === -12_000 &&
      h.save.economyLedger.at(-1)!.description === "prep-cook" &&
      h.save.business.staff.hiredRoles.includes("prep-cook") &&
      h.save.credits - s.credits === ledgerSum(h.save) - ledgerSum(s),
    "H1: at L5 a Prep Cook hire takes $120 once — one staff-purchase entry; wallet = ledger",
  );
  const again = h.ok ? hireRestaurantStaff(h.save, "prep-cook", 5) : null;
  assert(
    !!again && !again.ok && again.reason === "alreadyHired",
    "H2: hiring someone already on the team fails and charges nothing",
  );
  const poor = saveAt(5, 11_999);
  const p = hireRestaurantStaff(poor, "prep-cook", 5);
  assert(
    !p.ok && p.reason === "insufficientFunds" && p.fee === 12_000,
    "H3: $119.99 can't hire the Prep Cook — refused (the fee is reported)",
  );
  assert(
    poor.credits === 11_999 &&
      poor.business.staff.hiredRoles.length === 0 &&
      poor.economyLedger.length === 0,
    "H4: a refused hire changes nothing (no role, no money, no entry)",
  );
  const fired = h.ok ? fireStaff(h.save, "prep-cook") : null;
  const rehire = fired?.ok ? hireRestaurantStaff(fired.save, "prep-cook", 5) : null;
  assert(
    !!fired?.ok &&
      fired.save.credits === h.save.credits! &&
      !!rehire?.ok &&
      rehire.save.credits === fired.save.credits - 12_000,
    "H5: letting go refunds nothing; hiring again pays the fee again",
  );
  const early = hireRestaurantStaff(saveAt(4), "prep-cook", 4);
  assert(
    STAFF_HIRE_FROM === 5 && !early.ok && early.reason === "notYet",
    "H6: hiring opens with Business at L5 (refused at L4, nothing charged)",
  );
  const chef = hireRestaurantStaff(saveAt(5), "mexican-chef", 5);
  assert(
    SPECIALIST_CHEFS.every((c) => specialistOpensAt(c) <= 5) &&
      chef.ok &&
      chef.fee === staffHireFee("mexican-chef") &&
      restaurantStaffOf(chef.save).specialists.includes("mexican-chef") &&
      chef.save.economyLedger.at(-1)!.category === "staff-purchase",
    "H7: every specialist chef can be hired from L5, and pays its fee the same way",
  );
}

console.log("W. Wages unchanged");
{
  const team = saveAt(10, 50_000, ["prep-cook"]);
  const before = payHalfWages(team, 10);
  const half = payHalfWages(saveAt(HALF_WAGES_FROM, 50_000, ["prep-cook"]), HALF_WAGES_FROM);
  assert(
    HALF_WAGES_FROM === 29 &&
      restaurantSystem("full-operation").firstLevel === 56 &&
      before.paid === 0 &&
      before.save === team &&
      half.paid === 2_000 &&
      half.save.economyLedger.filter((e) => e.category === "business-staff-salary").length === 1,
    "W1: no pay before L29 (the hire fee is the only charge); half pay ($20, one entry) from L29",
  );
  // The half wages are paid in one place (closing, restaurantDay.ts); the hire never pays wages.
  const src = execSync("git grep -n 'payHalfWages(' -- src", { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((l) => l && !/export function payHalfWages/.test(l));
  const hire = fs.readFileSync(path.join(ROOT, "src/game/restaurant/staffRequirements.ts"), "utf8");
  const body = hire.slice(hire.indexOf("export function hireRestaurantStaff"));
  const hireBody = body.slice(0, body.indexOf("\n}\n"));
  assert(
    src.length === 1 &&
      /src\/game\/restaurant\/restaurantDay\.ts/.test(src[0]!) &&
      !/payHalfWages|business-staff-salary/.test(hireBody) &&
      (hireBody.match(/appendLedgerEntry/g) ?? []).length === 1,
    "W2: wages are paid in one place (closing); a hire writes exactly one entry and no wage",
    src,
  );
}

console.log("C. Capacity");
{
  const chef = saveAt(16);
  const hired = hireRestaurantStaff(chef, "prep-cook", 16);
  assert(
    hired.ok &&
      menuGuestCapacity(chef) === 2 &&
      menuGuestCapacity(hired.save) === 3 &&
      walkInsFor(chef, 16) === 0 &&
      walkInsFor(hired.save, 16) === 1,
    "C1: a paid Prep Cook adds a seat — at L16 it makes room for the walk-in",
  );
}

console.log("U. Everything unlocked by Level 5");
{
  const late = [
    ...KNIFE_CATALOG.filter((k) => k.unlockLevel > 5).map((k) => k.id),
    ...BOARD_CATALOG.filter((b) => b.unlockLevel > 5).map((b) => b.id),
    ...KITCHEN_UPGRADE_CATALOG.filter((u) => u.unlockLevel > 5).map((u) => u.id),
    ...STAFF_CATALOG.filter((s) => s.unlockLevel > 5).map((s) => s.id),
  ];
  assert(
    EARLY_UNLOCK_CAP === 5 && late.length === 0,
    "U1: every knife, board, kitchen tier and kitchen helper is for sale by L5",
    late,
  );
  const sorted = (xs: number[]) => xs.every((x, i) => i === 0 || x >= xs[i - 1]!);
  assert(
    sorted(KITCHEN_UPGRADE_CATALOG.map((u) => u.unlockLevel)),
    "U2: the kitchen tiers keep their order (each still needs the one before)",
  );
  const zones = RESTAURANT_MAP_ZONES.filter((z) => z.id !== "restroom");
  const restroom = RESTAURANT_MAP_ZONES.find((z) => z.id === "restroom")!;
  assert(
    zones.every((z) => z.unlockLevel <= 5) &&
      RESTAURANT_MAP_ZONES.find((z) => z.id === "dining")!.unlockLevel === 5 &&
      restroom.unlockLevel === CLEANING_FROM_LEVEL,
    "U3: every map room opens by L5 (the Dining Area too; was L31); the Restroom with its Cleanliness tab (L10)",
  );
  assert(
    SECOND_FLOOR_OPENS_AT === 5 &&
      STATIONS_OPEN_AT === 5 &&
      Object.values(TAB_OPENS_AT).every((n) => n <= 5),
    "U4: the Second Floor and all its stations (was L10 / L60) and every section (Progress was L10) by L5",
  );
  // Prices are untouched: in the catalog files only unlock-level lines changed.
  const diff = execSync(
    `git diff -U0 ${BASE} -- src/game/knives/knifeDefinitions.ts src/game/boards/boardDefinitions.ts src/game/kitchen/kitchenUpgradeDefinitions.ts src/game/economy/staffDefinitions.ts src/game/restaurant/secondFloor.ts`,
    { cwd: ROOT, encoding: "utf8" },
  )
    .split("\n")
    .filter((l) => /^[+-](?![+-])/.test(l));
  const priceLines = diff.filter((l) => /price|perHour|salary|dollars\(/i.test(l));
  assert(
    priceLines.length === 0,
    "U5: no price, wage or station income changed (only unlock levels)",
    priceLines,
  );
}

console.log("O. Old saves");
{
  const old = saveAt(20, 123_456, ["server", "prep-cook"]);
  const withLedger = {
    ...old,
    economyLedger: [
      { id: "x", category: "campaign-settlement", amount: 5_000, balanceAfter: 123_456, at: 1 },
    ],
  } as unknown as SaveData;
  await SaveManager.save(withLedger);
  const back = await SaveManager.load();
  assert(
    back.business.staff.hiredRoles.join() === "server,prep-cook" &&
      back.credits === 123_456 &&
      back.economyLedger.length === 1,
    "O1: an old save's hired staff stay hired (nothing re-charged), wallet and ledger kept",
  );
  const pre = { ...saveAt(20), version: 2, ownedKitchenUpgradeIds: ["humble-kitchen"] };
  const migrated = migrateKitchenDevelopment(pre);
  const entitled = KITCHEN_UPGRADE_CATALOG.filter(
    (u) => 20 >= LEGACY_KITCHEN_GRANT_LEVEL[u.id]!,
  ).map((u) => u.id);
  assert(
    migrated.ownedKitchenUpgradeIds.slice().sort().join() === entitled.slice().sort().join() &&
      !migrated.ownedKitchenUpgradeIds.includes("established-kitchen") &&
      migrated.ownedKitchenUpgradeIds.includes("growing-kitchen"),
    "O2: a pre-V2.5 save at L20 keeps only the tiers its level granted (Growing L16), never every tier the cap opened",
    migrated.ownedKitchenUpgradeIds,
  );
}

console.log("A. The App wiring");
{
  const app = fs.readFileSync(path.join(ROOT, "src/App.tsx"), "utf8");
  assert(
    /const required = !!plan\?\.staff\.some\(\(r\) => r\.id === role && !r\.met\);/.test(app) &&
      /const hired = hireRestaurantStaff\(save, role, restaurantLevelOf\(save\.levelProgress\), \{\s*required,\s*\}\);\s*if \(hired\.ok\) persist\(hired\.save\);/.test(
        app,
      ),
    "A1: the restaurant's Hire goes through hireRestaurantStaff (required = the next service needs them) and persists its one save",
  );
}

console.log(
  failures === 0 ? "\nSTAFF HIRE QA: ALL PASS" : `\nSTAFF HIRE QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
