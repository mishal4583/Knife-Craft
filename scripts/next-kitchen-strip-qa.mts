/**
 * NEXT_KITCHEN_STRIP_QA — Transformation Phase C (developer 2026-10-25): the
 * Kitchen's progress strip towards the next existing kitchen upgrade
 * (src/game/kitchen/nextKitchenUpgrade.ts, Kitchen.tsx).
 *   A. the next tier, its existing price (the restaurant's own), its level, the
 *      wallet's progress; locked / available / ready; none once all are built;
 *   B. read-only: it never changes the save; the strip only opens Kitchen Upgrades;
 *   E. no save field, price or reward changed since Phase C's oven (876ac79).
 *
 * Run: npx tsx scripts/next-kitchen-strip-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { migrateToUnifiedRestaurant } from "../src/game/restaurant/restaurantMigration.ts";
import { nextKitchenUpgrade } from "../src/game/kitchen/nextKitchenUpgrade.ts";
import { KITCHEN_UPGRADE_CATALOG } from "../src/game/kitchen/kitchenUpgradeDefinitions.ts";
import { kitchenTierPrice } from "../src/game/restaurant/restaurantInvestments.ts";
import { dollars } from "../src/game/money.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const code = (f: string) =>
  fs
    .readFileSync(path.resolve(ROOT, f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
let failures = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`ok   ${label}`);
}
const at = (level: number, credits: number, owned?: string[]): SaveData => {
  const s = migrateToUnifiedRestaurant(structuredClone(DEFAULT_SAVE));
  return {
    ...s,
    credits,
    levelProgress: {
      ...s.levelProgress,
      currentLevelId: `level-${level}`,
      highestUnlockedLevelId: `level-${level}`,
      completedLevelIds: Array.from({ length: level - 1 }, (_, i) => `level-${i + 1}`),
    },
    ...(owned ? { ownedKitchenUpgradeIds: owned, equippedKitchenUpgradeId: owned.at(-1)! } : {}),
  };
};

console.log("A. The next tier");
{
  const growing = KITCHEN_UPGRADE_CATALOG.find((u) => u.id === "growing-kitchen")!;
  const s = at(3, dollars(1240));
  const n = nextKitchenUpgrade(s);
  assert(
    n?.id === "growing-kitchen" &&
      n.price === kitchenTierPrice(growing, s) &&
      n.unlockLevel === growing.unlockLevel &&
      n.state === "locked" &&
      !n.ready &&
      Math.abs(n.progress - dollars(1240) / n.price) < 1e-9,
    "A1: early on: the Growing Kitchen, its existing restaurant price and level, locked, wallet progress",
    n,
  );
  const avail = nextKitchenUpgrade(at(growing.unlockLevel, dollars(100)));
  const ready = nextKitchenUpgrade(at(growing.unlockLevel, n!.price + 1));
  assert(
    avail?.state === "available" && !avail.ready && ready?.ready === true && ready.progress === 1,
    "A2: level reached → available; ready only when affordable; progress capped at 100%",
    { avail, ready },
  );
  const afterOne = nextKitchenUpgrade(at(60, 0, ["humble-kitchen", "growing-kitchen"]));
  const all = nextKitchenUpgrade(
    at(
      60,
      0,
      KITCHEN_UPGRADE_CATALOG.map((u) => u.id),
    ),
  );
  assert(
    afterOne?.id === KITCHEN_UPGRADE_CATALOG[2]!.id && all === null,
    "A3: the strip moves to the following tier once one is built, and goes away when all are built",
    { afterOne: afterOne?.id, all },
  );
}

console.log("B. Read-only");
{
  const s = at(16, dollars(50000));
  const before = JSON.stringify(s);
  nextKitchenUpgrade(s);
  assert(JSON.stringify(s) === before, "B1: it never changes the save");
  const kitchen = code("src/components/kc/Kitchen.tsx");
  const logic = code("src/game/kitchen/nextKitchenUpgrade.ts");
  assert(
    /\{RESTAURANT_MODE \? <NextKitchenStrip save=\{save\} go=\{go\} \/> : null\}/.test(kitchen) &&
      /onClick=\{\(\) => go\("kitchen-upgrades"\)\}/.test(kitchen) &&
      !/purchaseKitchenUpgrade|debitWallet|appendLedgerEntry|persist/.test(logic),
    "B2: restaurant build only; the strip opens Kitchen Upgrades and buys nothing itself",
  );
}

console.log("E. Nothing else moves");
{
  const diff = execSync(
    // Early-game phase 4 (developer 2026-10-26): everything unlocked by Level 5 — only the unlock-level
    // lines of these catalogs change (staff-hire-qa U5 checks no price moved).
    // KitchenUpgradeManager: the pre-V2.5 migration keeps its old grant levels.
    // levelMastery.ts: a level's stale knife/board "Unlocks" hint is dropped (display only).
    "git diff 876ac79 -- src/game/SaveManager.ts src/game/business/businessTypes.ts src/game/economy ':!src/game/economy/staffDefinitions.ts' src/game/kitchen/kitchenUpgradeDefinitions.ts src/game/kitchen/KitchenUpgradeManager.ts src/game/restaurant/restaurantInvestments.ts src/game/levels ':!src/game/levels/levelMastery.ts'" +
      " ':!src/game/kitchen/kitchenUpgradeDefinitions.ts' ':!src/game/kitchen/KitchenUpgradeManager.ts'",
    { cwd: ROOT, encoding: "utf8" },
  );
  assert(
    diff.trim() === "",
    "E1: no save field, price, reward, tier or level change",
    diff.slice(0, 300),
  );
}

console.log(
  failures === 0
    ? "\nNEXT KITCHEN STRIP QA: ALL PASS"
    : `\nNEXT KITCHEN STRIP QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
