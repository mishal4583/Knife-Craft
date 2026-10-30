/**
 * POPULAR DISHES COST MORE (developer 2026-10-30, Phase 2 decision Q6: "Let the popular dish increase
 * its price"; design approved 2026-10-31, docs/planning/PHASE2-PLAN-2026-10-30.md §12).
 *
 *  - Each dish has a HEAT (`business.dishHeat`, optional; absent = 0, old saves need nothing).
 *    Every guest order adds `perOrder`; every closing multiplies all heat by `decay` and drops
 *    anything under `dropBelow` — a dish nobody orders cools in about 10 services.
 *  - A dish is popular at heat ≥ `popularAt`. Its price rises `stepPct`% for each whole heat point
 *    above `freeHeat`, capped at `capPct`%, and never above the menu cap (1.5 × the suggested price).
 *  - The rise is paid by the guest on top of the menu price (and the restaurant-wide popularity
 *    multiplier that already exists): still one "business-revenue" entry per guest, whole cents.
 *  - Self-balancing: a dish's pick weight is × (1 − rise / 2), so a pricier dish is ordered a little
 *    less and cools down.
 *
 * Pure and deterministic (heat moves only on orders and closings). No wallet, no ledger.
 */
import type { SaveData } from "../SaveManager";

export const HEAT_RULES = {
  perOrder: 1,
  decay: 0.85,
  dropBelow: 0.1,
  popularAt: 3,
  freeHeat: 2,
  stepPct: 5,
  capPct: 25,
} as const;

const tidy = (x: number) => Math.round(x * 100) / 100;

/** The saved heat map, sanitized (finite, positive numbers only). */
export function dishHeatOf(save: SaveData): Record<string, number> {
  const raw = save.business.dishHeat;
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(raw))
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[id] = v;
  return out;
}

export const heatOf = (save: SaveData, dishId: string) => dishHeatOf(save)[dishId] ?? 0;

/** The price rise in whole percent for a heat (0 below `popularAt`). */
export function riseForHeat(heat: number): number {
  const R = HEAT_RULES;
  if (heat < R.popularAt) return 0;
  return Math.min(R.capPct, Math.floor(heat - R.freeHeat) * R.stepPct);
}

export const dishRisePct = (save: SaveData, dishId: string) => riseForHeat(heatOf(save, dishId));

/** A guest ordered the dish: its heat goes up (saved with the guest's payment). */
export function withDishOrdered(save: SaveData, dishId: string): SaveData {
  const heat = dishHeatOf(save);
  return {
    ...save,
    business: {
      ...save.business,
      dishHeat: { ...heat, [dishId]: tidy((heat[dishId] ?? 0) + HEAT_RULES.perOrder) },
    },
  };
}

/** Closing: every dish cools; a dish under `dropBelow` is dropped. Leaves a save with no heat alone. */
export function coolDishHeat(save: SaveData): SaveData {
  const heat = dishHeatOf(save);
  if (Object.keys(heat).length === 0) return save;
  const cooled: Record<string, number> = {};
  for (const [id, v] of Object.entries(heat)) {
    const next = tidy(v * HEAT_RULES.decay);
    if (next >= HEAT_RULES.dropBelow) cooled[id] = next;
  }
  return { ...save, business: { ...save.business, dishHeat: cooled } };
}

/** The menu price with the rise, in whole cents, never above `cap`. */
export function heatedPrice(menuPrice: number, risePct: number, cap: number): number {
  if (risePct <= 0) return menuPrice;
  return Math.max(menuPrice, Math.min(cap, Math.round((menuPrice * (100 + risePct)) / 100)));
}

/** The pick weight factor for a rise: × (1 − rise / 2). */
export const heatWeight = (risePct: number) => 1 - risePct / 200;
