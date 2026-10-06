/**
 * ECONOMY FINAL SIMULATION — the final economy design pass (developer
 * 2026-10-06): the whole campaign, Level 1 → 250, through the real
 * restaurant functions (restaurantCampaignSim.mts — every order's stock,
 * supplies, settlement, menu guests, closings, wages, the completionist's
 * shopping), for six players:
 *
 *  A. Saver — buys no items (stocks and staffs as the restaurant requires).
 *  B. Progression buyer — buys the restaurant's development (kitchen tiers) only.
 *  C. Completionist — buys everything, Local Market supplier.
 *  D. Completionist + Wholesale.
 *  E. Completionist + Premium.
 *  F. Completionist with sensible staffing (also hires the optional team the
 *     restaurant can use to take more menu guests).
 *
 * Prints a checkpoint table per player (wallet, cumulative income/costs,
 * purchases, ingredients, supplies, wages, quality bonus, orders, average
 * order, fridge, safety nets) and a summary. No Endless income: the campaign
 * ends with Level 250's closing.
 *
 * Run: npx tsx scripts/economy-final-sim.mts [--json <file>]
 */
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import {
  run,
  freshRestaurantSave,
  $,
  type SimOptions,
  type Stats,
} from "./restaurantCampaignSim.mts";
import type { SaveData } from "../src/game/SaveManager.ts";
import { dollars } from "../src/game/money.ts";
import {
  getInventoryUsedCapacity,
  getRefrigeratorCapacity,
} from "../src/game/business/RefrigeratorManager.ts";

export const CHECKPOINTS = [1, 10, 20, 30, 40, 50, 75, 91, 100, 121, 150, 200, 250] as const;

export type Checkpoint = {
  level: number;
  wallet: number;
  income: number;
  costs: number;
  purchases: number;
  ingredients: number;
  supplies: number;
  wages: number;
  fines: number;
  qualityBonus: number;
  orderEarnings: number;
  orders: number;
  guests: number;
  avgOrder: number;
  fridgeCap: number;
  fridgePeak: number;
  pantry: number;
  spares: number;
};

export type ScenarioResult = {
  key: string;
  name: string;
  final: number;
  rows: Checkpoint[];
  minCash: { cash: number; where: string };
  stats: Stats;
  save: SaveData;
};

const PURCHASE = [
  "knife-purchase",
  "board-purchase",
  "staff-purchase",
  "kitchen-investment-purchase",
  "blacksmith-upgrade",
  "refrigerator-purchase",
] as const;

const life = (s: SaveData, k: string) =>
  (s.economy.lifetime as Record<string, number | undefined>)[k] ?? 0;

export type Scenario = {
  key: string;
  name: string;
  opts: Omit<SimOptions, "observe" | "onLevel">;
  supplier?: string;
  /** Hire the optional team (scenario F); applied by the caller's rules. */
  prepare?: (s: SaveData) => SaveData;
};

export const SCENARIOS: Scenario[] = [
  { key: "A", name: "Saver (buys no items)", opts: { profile: "diligent" } },
  {
    key: "B",
    name: "Progression buyer (kitchen tiers only)",
    opts: { profile: "completionist", shop: "kitchen" },
  },
  { key: "C", name: "Completionist (Local)", opts: { profile: "completionist", dayStock: true } },
  {
    key: "D",
    name: "Completionist + Wholesale",
    opts: { profile: "completionist", dayStock: true },
    supplier: "wholesale-supplier",
  },
  {
    key: "E",
    name: "Completionist + Premium",
    opts: { profile: "completionist", dayStock: true },
    supplier: "premium-supplier",
  },
  {
    key: "F",
    name: "Completionist, sensible staffing",
    opts: { profile: "completionist", staffing: "sensible", dayStock: true },
  },
  {
    key: "G",
    name: "Prudent completionist (keeps $500 after every purchase)",
    opts: { profile: "completionist", dayStock: true, reserve: dollars(500) },
  },
];

export function runScenario(sc: Scenario): ScenarioResult {
  let start = freshRestaurantSave();
  if (sc.supplier) start = { ...start, selectedSupplierId: sc.supplier };
  const rows: Checkpoint[] = [];
  let peak = 0;
  let minCash = { cash: Number.POSITIVE_INFINITY, where: "" };
  const { s, stats } = run(
    sc.name,
    start,
    1,
    {
      ...sc.opts,
      observe(where, x) {
        peak = Math.max(peak, getInventoryUsedCapacity(x.business.inventory));
        if (x.credits < minCash.cash) minCash = { cash: x.credits, where };
      },
      onLevel(n, x, st) {
        if (!(CHECKPOINTS as readonly number[]).includes(n)) return;
        const lt = (x.economy.lifetime ?? {}) as Record<string, number | undefined>;
        const income = Object.values(lt).reduce((a, v) => a + Math.max(0, v ?? 0), 0);
        const costs = -Object.values(lt).reduce((a, v) => a + Math.min(0, v ?? 0), 0);
        rows.push({
          level: n,
          wallet: x.credits,
          income,
          costs,
          purchases: -PURCHASE.reduce((a, k) => a + life(x, k), 0),
          ingredients: -life(x, "inventory-purchase"),
          supplies: -(life(x, "supply-packaging-purchase") + life(x, "supply-equipment-purchase")),
          wages: -life(x, "business-staff-salary"),
          fines: -life(x, "inspection-fine"),
          qualityBonus: st.qualityBonus,
          orderEarnings: st.orderEarnings,
          orders: st.ordersServed,
          guests: st.guests,
          avgOrder: st.ordersServed
            ? Math.round((st.orderEarnings + st.qualityBonus) / st.ordersServed)
            : 0,
          fridgeCap: getRefrigeratorCapacity(x.business.refrigerator.refrigeratorId),
          fridgePeak: Math.round(peak * 10) / 10,
          pantry: st.pantry,
          spares: st.spares,
        });
      },
    },
    false,
  );
  return { key: sc.key, name: sc.name, final: s.credits, rows, minCash, stats, save: s };
}

export function printScenario(r: ScenarioResult) {
  console.log(
    `\n${r.key}. ${r.name} — final ${$(r.final)} · lowest cash ${$(r.minCash.cash)} (${r.minCash.where})`,
  );
  console.log(
    "  lvl  | wallet    | income    | costs     | items     | ingred.  | supplies | wages    | fines   | quality  | orders(+guests) | avg order | fridge peak/cap | pantry/spares",
  );
  for (const c of r.rows)
    console.log(
      `  L${String(c.level).padEnd(4)}| ${$(c.wallet).padEnd(10)}| ${$(c.income).padEnd(10)}| ${$(c.costs).padEnd(10)}| ${$(c.purchases).padEnd(10)}| ${$(c.ingredients).padEnd(9)}| ${$(c.supplies).padEnd(9)}| ${$(c.wages).padEnd(9)}| ${$(c.fines).padEnd(8)}| ${$(c.qualityBonus).padEnd(9)}| ${`${c.orders} (+${c.guests})`.padEnd(16)}| ${$(c.avgOrder).padEnd(10)}| ${`${c.fridgePeak}/${c.fridgeCap}`.padEnd(16)}| ${c.pantry}/${c.spares}`,
    );
  const qb = Object.entries(r.stats.qualityBy)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k} ${$(v)}`)
    .join(" · ");
  console.log(
    `  quality bonus from investments: ${qb || "none"} · emergency orders ${r.stats.emergencyOrders}`,
  );
  if (r.stats.blocked.length || r.stats.invariant.length)
    console.log(
      `  PROBLEMS: ${[...r.stats.blocked, ...r.stats.invariant].slice(0, 5).join(" | ")}`,
    );
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (isMain) {
  const only = process.argv.find((a) => /^[A-G]+$/.test(a));
  const results = SCENARIOS.filter((sc) => !only || only.includes(sc.key)).map((sc) => {
    const r = runScenario(sc);
    printScenario(r);
    return r;
  });
  const j = process.argv.indexOf("--json");
  if (j > 0)
    fs.writeFileSync(
      process.argv[j + 1]!,
      JSON.stringify(
        results.map(({ save: _s, stats, ...r }) => ({
          ...r,
          stats: { ...stats, observe: undefined },
        })),
        null,
        1,
      ),
    );
}
