/**
 * IPHONE_FIXES_QA — the four bugs from the developer's iPhone playtest (2026-11-06):
 *   L. "low" follows the Market: with today's plan bought Inventory shows nothing low, whatever the customer estimate says;
 *      the estimate stays for the Endless Restaurant and classic callers; stock is counted when it is bought, never when
 *      it is put away (Fridge Sort's crate holds no stock);
 *   S. the Market's scroll is rebuilt whenever the plan's list changes height, and the page ends clear of the pill;
 *   C. the Cleaning page uses the painted Cleaner, says nothing about a hiring fee once hired, and a failed Hire says why
 *      on screen;
 *   R. the cleaning room has no live filter, blur or half-pixel transform over the painting.
 *
 * Run: npx tsx scripts/iphone-fixes-qa.mts
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

const { DEFAULT_SAVE } = await import("../src/game/SaveManager.ts");
type SaveData = import("../src/game/SaveManager.ts").SaveData;
const { marketPlanFor, todayPlanNeed } = await import("../src/game/restaurant/marketPlan.ts");
const { inventoryMenuOf } = await import("../src/game/restaurant/restaurantMenu.ts");
const { lowStockItems, menuDemand } = await import("../src/game/business/inventoryAnalytics.ts");
const { inventoryView } = await import("../src/game/business/inventoryView.ts");

let failed = 0;
function check(id: string, ok: boolean, detail?: unknown) {
  if (!ok) failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${id}`,
    ok || detail === undefined ? "" : JSON.stringify(detail),
  );
}
const read = (p: string) =>
  fs.readFileSync(path.join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

/** A player `n` services in. */
const at = (n: number): SaveData => {
  const s = structuredClone(DEFAULT_SAVE);
  return {
    ...s,
    credits: 5_000_000,
    story: { ...s.story, introDone: true },
    levelProgress: {
      ...s.levelProgress,
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
  };
};
/** The plan for `days` bought: each line lands in the fridge, exactly as much as it asks for. */
const bought = (s: SaveData, days: number): SaveData => {
  const inventory = { ...s.business.inventory };
  for (const row of marketPlanFor(s, days).rows)
    inventory[row.ingredientId] = {
      ingredientId: row.ingredientId,
      quantity: row.stock,
      unitCost: 100,
      purchaseDay: s.business.calendar.businessDay,
    } as (typeof inventory)[typeof row.ingredientId];
  return { ...s, business: { ...s.business, inventory } };
};
const low = (s: SaveData) => lowStockItems(s, inventoryMenuOf(s), todayPlanNeed(s));

// ── L. low follows the Market ────────────────────────────────────────────
for (const n of [12, 30, 60]) {
  const s = at(n);
  const need = todayPlanNeed(s);
  check(`L1 Level ${n}: today has a plan to compare with`, !!need && need.size > 0);
  for (const days of [1, 3]) {
    const stocked = bought(s, days);
    const lows = low(stocked);
    check(
      `L2 Level ${n}: ${days}-day Buy all leaves nothing low for today`,
      lows.length === 0 && marketPlanFor(stocked, 1).rows.length === 0,
      lows,
    );
  }
}
{
  const s = at(30);
  const stocked = bought(s, 1);
  const estimateLow = lowStockItems(stocked, inventoryMenuOf(stocked));
  check(
    "L3 the bug: the old customer estimate called this stocked fridge low",
    estimateLow.length > 0,
  );
  const [id, need] = [...(todayPlanNeed(s) ?? new Map<string, number>())][0]!;
  const short: SaveData = {
    ...stocked,
    business: {
      ...stocked.business,
      inventory: {
        ...stocked.business.inventory,
        [id]: { ...stocked.business.inventory[id as never]!, quantity: need / 2 },
      },
    },
  };
  check(
    "L4 food really short of today's need is still low, and the Market still offers it",
    low(short).some((l) => l.id === id) &&
      marketPlanFor(short, 1).rows.some((r) => r.ingredientId === id),
  );
  const view = inventoryView(stocked, inventoryMenuOf(stocked), todayPlanNeed(stocked));
  check(
    "L5 the Inventory summary and groups agree",
    view.summary.runningLow === 0 && !view.attention.some((g) => g.id === "low"),
  );
  const demand = menuDemand(s, inventoryMenuOf(s));
  check(
    "L6 without today's need the estimate is unchanged (Endless, classic)",
    [...demand.values()].some((d) => d.perDay > 0) &&
      menuDemand(s, inventoryMenuOf(s), new Map()).size === demand.size,
  );
}
{
  const endless = at(148);
  const done = {
    ...endless,
    levelProgress: {
      ...endless.levelProgress,
      completedLevelIds: Array.from({ length: 148 }, (_, i) => `level-${i + 1}`),
    },
  };
  check("L7 the Endless Restaurant keeps menu demand", todayPlanNeed(done) === undefined);
}
check(
  "L8 both Inventory screens pass today's need",
  /inventoryView\(save, inventoryMenuOf\(save\), todayPlanNeed\(save\)\)/.test(
    read("src/components/kc/inventory/InventoryScreen.tsx"),
  ) &&
    /inventoryView\(save, inventoryMenuOf\(save\), todayPlanNeed\(save\)\)/.test(
      read("src/components/kc/DailyMaintenance.tsx"),
    ),
);
check(
  "L9 Fridge Sort's crate holds no stock: a purchase is counted at once",
  !/inventory/.test(
    read("src/game/business/fridgeSort.ts")
      .slice(read("src/game/business/fridgeSort.ts").indexOf("export function addToCrate"))
      .split("\nexport ")[0]!,
  ),
);

// ── S. scroll ────────────────────────────────────────────────────────────
const plan = read("src/components/kc/MarketPlanPanel.tsx");
check(
  "S1 a change of day, Show all or rows rebuilds the scroller after the new layout",
  /`\$\{days\}:\$\{showAll\}:\$\{plan\.rows\.length\}`/.test(plan) &&
    /requestAnimationFrame\(\(\) => repairScroller\(ref\.current\)\)/.test(plan),
);
const repair = read("src/components/kc/common/scrollRepair.ts");
check(
  "S2 the repair keeps the position inside the new height",
  /scrollHeight - scroller\.clientHeight/.test(repair) &&
    /void scroller\.offsetHeight/.test(repair),
);
check(
  "S3 the Market page ends clear of the Pre-Service Check pill",
  /overflow-y-auto no-scrollbar pb-40/.test(read("src/components/kc/Shop.tsx")),
);

// ── C. the Cleaner ───────────────────────────────────────────────────────
const cleaning = read("src/components/kc/business/BusinessCleanliness.tsx");
check(
  "C1 the Cleaning page draws the painted Cleaner; only a toast string keeps the emoji",
  // Rule changed (developer 2026-11-07): the team's Cleaner is still `floor-cleaner`; "a Cleaner for today" is another person (DAY_CLEANER_PORTRAIT).
  /today \? DAY_CLEANER_PORTRAIT : "floor-cleaner"/.test(cleaning) &&
    cleaning.split("\n").filter((l) => l.includes("🧑‍🔧")).length === 2 &&
    cleaning
      .split("\n")
      .filter((l) => l.includes("🧑‍🔧"))
      .every((l) => /Cleaner on today/.test(l) && /[`"]🧑‍🔧/.test(l)),
);
check(
  "C1b the Cleaner is the broom-and-dustpan portrait on every screen (developer 2026-11-06)",
  // Rule changed (developer 2026-11-06): the Staff screen no longer keeps its own role map; it reads staffPortraits.ts (asset-mapping-qa B1/B2).
  /staffPortraitFile\(def\.role\)/.test(read("src/components/kc/business/BusinessStaff.tsx")) &&
    /cleaner: "floor-cleaner"/.test(read("src/components/kc/business/staffPortraits.ts")),
);
check(
  "C2 a hired Cleaner's line has no hiring fee",
  /\$\{hired \? "" : `Hire \$\{formatUsd\(staffHireFee\("cleaner"\)/.test(cleaning),
);
const staff = read("src/components/kc/business/BusinessStaff.tsx");
check(
  "C3 a failed Hire says why where the player is; the screen opens on the person asked for",
  /data-testid="staff-message"[\s\S]{0,60}sticky top-2/.test(staff) &&
    /\[data-staff-needed=true\]/.test(staff),
);

// ── R. the room ──────────────────────────────────────────────────────────
const room = read("src/components/kc/business/AreaCleaningPrototype.tsx");
check(
  "R1 no filter, blur or half-pixel transform on the room",
  !/backdrop-blur/.test(room) &&
    !/transition-\[filter\]/.test(room) &&
    !/filter: `saturate/.test(room) &&
    !/translate\(-50%, -50%\)",\n\s+touchAction/.test(room),
);
check("R2 the room still brightens as it gets clean", /opacity: 0\.16 \* \(1 - shine\)/.test(room));

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
