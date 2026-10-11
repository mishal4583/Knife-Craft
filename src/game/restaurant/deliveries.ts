/**
 * STANDING ORDERS & DELIVERIES (a real restaurant's day, plan F3 — developer
 * 2026-10-11: "fresh ingredients delivered every 2–3 days, dry goods,
 * paper and cleaning chemicals weekly"; answer: standing orders + the Market).
 *
 * From DELIVERIES_FROM (21) the player can switch on two standing orders
 * (Restaurant → Suppliers):
 *  - FRESH — protein, herbs, dairy, bakery, fruit, vegetables — delivered
 *    on every even restaurant day (every 2 days), enough for the next
 *    FRESH_DAYS days;
 *  - WEEKLY — the slow goods (aromatics) for WEEK_DAYS days, and the
 *    cleaning supplies for a week (restaurant/cleanliness.ts uses) —
 *    delivered on the week's first day (Monday).
 *
 * The order is worked out at closing from what the coming days need
 * (`marketPlanFor` — usable stock only: stock that will have expired by
 * then doesn't count, and never more than fits in the fridge) and arrives
 * with the next morning (`afterNight`, called right after Closing Time's
 * close). Each line is an ordinary Market purchase at the Market's own
 * price (bulk tier, supplier, freshness, lb/kg — App.buyOn's arguments) with
 * one ledger entry; a line the wallet or the fridge can't take is skipped
 * and listed (never debt, never credit). The Market stays for instant buys.
 *
 * Once only: each delivery has an id ("day-kind"); an id already pending or
 * delivered is never ordered or delivered again — a reload, a second tap or
 * a repeated opening changes nothing. State: `business.deliveries`
 * (optional, clamped by `deliveriesOf`). Pure; no randomness; never reads
 * RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import { INGREDIENTS, type IngredientId } from "../definitions";
import { purchaseIngredient } from "../business/BusinessInventoryManager";
import { purchaseSupply } from "../business/BusinessSuppliesManager";
import { getSupplyItem, isConsumableSupply, type SupplyId } from "../business/businessSupplies";
import { appendLedgerEntry } from "../economy/EconomyLedger";
import {
  recordCapitalExpenditure,
  recordInventoryPurchase,
  recordPackagingPurchase,
} from "../business/BusinessFinanceManager";
import { lbPerMarketUnit, marketStep, measureOf } from "../business/measure";
import { ingredientBulkDiscount, bulkDiscountFor, BULK_MAX_PACKS } from "./bulkBuying";
import { supplierEffects, supplierPriceFactor } from "./restaurantEconomy";
import { marketPlanFor } from "./marketPlan";
import { closeDay, restaurantDayOf } from "./restaurantDay";
import { servicesForDayAt } from "./restaurantProgression";
import { TASK_KINDS, TASK_RULES, usesAvailable, usesPerUnit } from "./cleanliness";
import { bottleView } from "./serviceSupplies";

export const DELIVERIES_FROM = 21;
export const FRESH_DAYS = 2;
export const WEEK_DAYS = 7;

export type DeliveryKind = "fresh" | "weekly";

/** The categories that spoil fast (perishability.ts) — delivered fresh every 2 days. */
export const FRESH_CATEGORIES: readonly string[] = [
  "Protein",
  "Herb",
  "Dairy",
  "Bakery",
  "Fruit",
  "Vegetable",
];
export const isFreshIngredient = (id: IngredientId) =>
  FRESH_CATEGORIES.includes(INGREDIENTS[id]?.category ?? "");

/** Fresh arrives every even restaurant day; the weekly delivery on each week's first day (Monday). */
export const isDeliveryDay = (kind: DeliveryKind, day: number) =>
  kind === "fresh" ? day % FRESH_DAYS === 0 : (day - 1) % WEEK_DAYS === 0;

/** The next day (≥ `from`) a kind arrives. */
export function nextDeliveryDay(kind: DeliveryKind, from: number): number {
  let d = Math.max(1, from);
  while (!isDeliveryDay(kind, d)) d++;
  return d;
}

export type DeliveryLine = {
  kind: "ingredient" | "supply";
  id: string;
  /** Market units (ingredients) or packs (supplies). */
  qty: number;
};

export type DeliveryRecord = {
  id: string;
  day: number;
  kind: DeliveryKind;
  cost: number;
  lines: { id: string; qty: number; cost: number }[];
  /** Lines the wallet or the fridge couldn't take. */
  skipped: string[];
};

export type DeliveriesState = {
  fresh: boolean;
  weekly: boolean;
  /** Orders placed, not yet delivered (normally delivered the same night). */
  pending: { id: string; arriveDay: number; kind: DeliveryKind; lines: DeliveryLine[] }[];
  /** Ids already delivered (the once-only guard; the last DELIVERED_KEPT). */
  delivered: string[];
  /** The last deliveries (newest last). */
  history: DeliveryRecord[];
};

const DELIVERED_KEPT = 40;
const HISTORY_KEPT = 10;

export const DEFAULT_DELIVERIES: DeliveriesState = {
  fresh: false,
  weekly: false,
  pending: [],
  delivered: [],
  history: [],
};

const whole = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
const positive = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);
const isKind = (k: unknown): k is DeliveryKind => k === "fresh" || k === "weekly";

/** The save's deliveries (clamped; defaults when absent or odd). */
export function deliveriesOf(save: SaveData): DeliveriesState {
  const raw = save.business.deliveries as Partial<DeliveriesState> | undefined;
  if (!raw || typeof raw !== "object") return DEFAULT_DELIVERIES;
  const lines = (ls: unknown): DeliveryLine[] =>
    Array.isArray(ls)
      ? ls
          .filter(
            (l) =>
              l &&
              (l.kind === "ingredient" || l.kind === "supply") &&
              typeof l.id === "string" &&
              positive(l.qty) > 0,
          )
          .map((l) => ({ kind: l.kind, id: l.id, qty: positive(l.qty) }))
      : [];
  return {
    fresh: raw.fresh === true,
    weekly: raw.weekly === true,
    pending: Array.isArray(raw.pending)
      ? raw.pending
          .filter((p) => p && typeof p.id === "string" && isKind(p.kind))
          .map((p) => ({
            id: p.id,
            arriveDay: whole(p.arriveDay),
            kind: p.kind,
            lines: lines(p.lines),
          }))
      : [],
    delivered: Array.isArray(raw.delivered)
      ? raw.delivered.filter((x): x is string => typeof x === "string").slice(-DELIVERED_KEPT)
      : [],
    history: Array.isArray(raw.history)
      ? raw.history
          .filter((h) => h && typeof h.id === "string" && isKind(h.kind))
          .map((h) => ({
            id: h.id,
            day: whole(h.day),
            kind: h.kind,
            cost: whole(h.cost),
            lines: Array.isArray(h.lines)
              ? h.lines.map((l) => ({
                  id: String(l.id),
                  qty: positive(l.qty),
                  cost: whole(l.cost),
                }))
              : [],
            skipped: Array.isArray(h.skipped) ? h.skipped.map(String) : [],
          }))
          .slice(-HISTORY_KEPT)
      : [],
  };
}

const withState = (save: SaveData, deliveries: DeliveriesState): SaveData => ({
  ...save,
  business: { ...save.business, deliveries },
});

/** Switch a standing order on or off. */
export function setStandingOrder(save: SaveData, kind: DeliveryKind, on: boolean): SaveData {
  const st = deliveriesOf(save);
  return withState(save, { ...st, [kind]: on });
}

// ── What an order holds ─────────────────────────────────────────────────

/** The cleaning supplies a week needs (task uses × services a day × 7), less what's in, in packs. */
function weeklySupplyLines(save: SaveData, levelNumber: number): DeliveryLine[] {
  const perDay = servicesForDayAt(levelNumber).length;
  const out: DeliveryLine[] = [];
  const perService = new Map<SupplyId, number>();
  for (const k of TASK_KINDS)
    for (const u of TASK_RULES[k].uses) perService.set(u.id, (perService.get(u.id) ?? 0) + u.n);
  for (const [id, n] of perService) {
    const item = getSupplyItem(id);
    if (!item || !isConsumableSupply(item)) continue;
    const short = n * perDay * WEEK_DAYS - usesAvailable(save, id);
    if (short <= 0) continue;
    const units = Math.ceil(short / usesPerUnit(id));
    out.push({ kind: "supply", id, qty: Math.max(1, Math.ceil(units / item.packSize)) });
  }
  // The dish soap and cleaning liquid bottles: one case when a week's worth isn't in.
  for (const id of ["dish-soap", "cleaning-liquid"] as const) {
    const b = bottleView(save, id);
    if (b.servicesLeft < perDay * WEEK_DAYS) out.push({ kind: "supply", id, qty: 1 });
  }
  return out;
}

/** What a standing order would bring now (read-only): from usable stock and the coming days' needs. */
export function orderFor(save: SaveData, kind: DeliveryKind, levelNumber: number): DeliveryLine[] {
  const days = kind === "fresh" ? FRESH_DAYS : WEEK_DAYS;
  const rows = marketPlanFor(save, days).rows.filter((r) =>
    kind === "fresh" ? isFreshIngredient(r.ingredientId) : !isFreshIngredient(r.ingredientId),
  );
  const ingredients: DeliveryLine[] = rows
    .filter((r) => r.buyUnits > 0)
    .map((r) => ({ kind: "ingredient", id: r.ingredientId, qty: r.buyUnits }));
  return kind === "weekly"
    ? [...ingredients, ...weeklySupplyLines(save, levelNumber)]
    : ingredients;
}

// ── The night: order, then the morning's delivery ───────────────────────

/** One delivered line, the Market's own way (App.buyOn / App.purchaseSupply), with its ledger entry. */
function deliverLine(save: SaveData, line: DeliveryLine): { save: SaveData; cost: number } | null {
  if (line.kind === "ingredient") {
    const id = line.id as IngredientId;
    const measure = measureOf(save);
    const r = purchaseIngredient(
      save,
      id,
      line.qty,
      ingredientBulkDiscount(id, line.qty, measure),
      supplierPriceFactor(save),
      supplierEffects(save).freshnessBonusDays,
      lbPerMarketUnit(id, measure),
      marketStep(id),
    );
    if (!r.ok) return null;
    const recorded = appendLedgerEntry(r.save, "inventory-purchase", -r.totalCost, id);
    return { save: recordInventoryPurchase(recorded, r.totalCost, 1), cost: r.totalCost };
  }
  const item = getSupplyItem(line.id);
  if (!item) return null;
  const consumable = isConsumableSupply(item);
  const r = purchaseSupply(
    save,
    line.id,
    line.qty,
    consumable ? { discount: bulkDiscountFor(line.qty), maxPacks: BULK_MAX_PACKS } : undefined,
  );
  if (!r.ok) return null;
  const recorded = appendLedgerEntry(
    r.save,
    consumable ? "supply-packaging-purchase" : "supply-equipment-purchase",
    -r.totalCost,
    r.item.id,
  );
  return {
    save: consumable
      ? recordPackagingPurchase(recorded, r.totalCost)
      : recordCapitalExpenditure(recorded, r.totalCost),
    cost: r.totalCost,
  };
}

/**
 * The night after closing: today's standing orders are placed (each once —
 * its id is remembered) and delivered with the morning, each line once.
 * `nextLevel`: the level that opens the new day.
 */
export function afterNight(
  save: SaveData,
  nextLevel: number,
  /** Cash a line never spends into (a prudent player's reserve; the game passes none). */
  keep = 0,
): { save: SaveData; received: DeliveryRecord[] } {
  if (nextLevel < DELIVERIES_FROM) return { save, received: [] };
  const day = restaurantDayOf(save).day;
  let st = deliveriesOf(save);
  let s = save;
  // Place: tonight's orders for the morning (never twice).
  for (const kind of ["fresh", "weekly"] as const) {
    const id = `${day}-${kind}`;
    if (!st[kind] || !isDeliveryDay(kind, day)) continue;
    if (st.delivered.includes(id) || st.pending.some((p) => p.id === id)) continue;
    const lines = orderFor(s, kind, nextLevel);
    if (lines.length === 0) continue;
    st = { ...st, pending: [...st.pending, { id, arriveDay: day, kind, lines }] };
  }
  s = withState(s, st);
  // Deliver: everything due by this morning, each id once.
  const received: DeliveryRecord[] = [];
  for (const p of st.pending) {
    if (p.arriveDay > day || deliveriesOf(s).delivered.includes(p.id)) continue;
    const rec: DeliveryRecord = { id: p.id, day, kind: p.kind, cost: 0, lines: [], skipped: [] };
    for (const line of p.lines) {
      const r = deliverLine(s, line);
      if (!r || r.save.credits < keep) {
        rec.skipped.push(line.id);
        continue;
      }
      s = r.save;
      rec.cost += r.cost;
      rec.lines.push({ id: line.id, qty: line.qty, cost: r.cost });
    }
    const now = deliveriesOf(s);
    s = withState(s, {
      ...now,
      pending: now.pending.filter((x) => x.id !== p.id),
      delivered: [...now.delivered, p.id].slice(-DELIVERED_KEPT),
      history: [...now.history, rec].slice(-HISTORY_KEPT),
    });
    received.push(rec);
  }
  return { save: s, received };
}

/** This morning's deliveries (for the opening card), newest last. */
export function deliveredToday(save: SaveData): DeliveryRecord[] {
  const day = restaurantDayOf(save).day;
  return deliveriesOf(save).history.filter((h) => h.day === day);
}

/** Tonight's order preview for Closing Time (what closing now would bring tomorrow). */
export function tonightsOrder(
  save: SaveData,
  nextLevel: number,
): { kind: DeliveryKind; lines: DeliveryLine[] }[] {
  if (nextLevel < DELIVERIES_FROM) return [];
  const st = deliveriesOf(save);
  const tomorrow = restaurantDayOf(save).day + 1;
  // Worked out on the save as it will be after closing (the night's sweep and calendar),
  // exactly what afterNight orders.
  const night = restaurantDayOf(save).closingDue ? closeDay(save, nextLevel) : save;
  return (["fresh", "weekly"] as const)
    .filter((k) => st[k] && isDeliveryDay(k, tomorrow))
    .map((k) => ({ kind: k, lines: orderFor(night, k, nextLevel) }))
    .filter((o) => o.lines.length > 0);
}
