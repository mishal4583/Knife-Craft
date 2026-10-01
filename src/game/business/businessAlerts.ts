/**
 * BUSINESS_ALERTS — Business Mode's operations/feedback layer. Every
 * alert is DERIVED from state and functions that already exist
 * (maintenanceStatusFor, inspectBusiness, fineSeverityFor via
 * determineInspectionFine, perishabilityStateFor, hasUsableIngredients,
 * eventForDay, isContractActive, dailyPayroll) — no new thresholds, no
 * new mechanics, no stored alert state. The "what happens if I end the
 * day now" preview is literally `BusinessDayManager.endBusinessDay(save)`
 * run on a snapshot: that function is pure, so previewing it is the
 * exact same calculation the real button performs, never a second one.
 */
import type { SaveData } from "../SaveManager";
import type { IngredientId } from "../definitions";
import { INGREDIENTS } from "../definitions";
import { maintenanceStatusFor, maintenanceCostFor } from "./businessMaintenance";
import type { InspectionCategory } from "./businessInspection";
import { determineInspectionFine } from "./businessInspectionFines";
import { perishabilityStateFor, hasUsableIngredients } from "./perishability";
import {
  eventForDay,
  eventAdjustedUnitCost,
  type SupplierEventDefinition,
} from "./businessSupplierEvents";
import {
  isContractActive,
  getAllContractOffers,
  effectiveUnitCost,
  type SupplierContractTerms,
} from "./businessSupplierContract";
import { getSupplier } from "../economy/supplierDefinitions";
import { dailyPayroll, staffUnitCostDiscount } from "./businessStaff";
import { BUSINESS_DISH_CATALOG } from "./businessDishCatalog";
import { businessDishForRecipeId, businessDishRequirements } from "./businessServiceCatalog";
import { endBusinessDay, type EndBusinessDayResult } from "./BusinessDayManager";
import { businessOrderAvailability } from "./BusinessServiceManager";
import { activeBusinessDishes } from "./businessMenuActivation";
import { formatUsd } from "./businessCurrency";

export type BusinessAlertSeverity = "critical" | "warning" | "info" | "ok";

/** Business screens an alert may send the player to — plain strings so this game-layer module never imports UI routing. */
export type BusinessAlertScreen =
  | "business-refrigerator"
  | "business-inspections"
  | "business-suppliers"
  | "business-staff"
  | "business-inventory"
  /** The Market's Ingredients tab — where stock is bought (Business → Inventory only monitors it). */
  | "shop-ingredients"
  | "business-service"
  | "business-finance";

export type BusinessAlertAction =
  | { kind: "navigate"; label: string; screen: BusinessAlertScreen }
  | { kind: "repair-refrigerator"; label: string }
  /** Rush Restock the current order's missing ingredients (cash + rush fee, or free after an ad) — businessRushRestock.ts. */
  | { kind: "rush-restock"; label: string };

export type BusinessAlert = {
  /** Stable identity of the underlying condition — used to fire a notification only when the condition newly appears, never on every render. */
  key: string;
  severity: BusinessAlertSeverity;
  title: string;
  detail: string;
  action?: BusinessAlertAction;
  /** Whether this alert's first appearance deserves a banner notification. */
  notify: boolean;
};

export const INSPECTION_CATEGORY_LABEL: Record<InspectionCategory, string> = {
  FOOD_STORAGE: "Food Storage",
  INGREDIENT_EXPIRY: "Ingredient Expiry",
  REFRIGERATOR_CONDITION: "Refrigerator Condition",
  EQUIPMENT_CONDITION: "Equipment Condition",
  KITCHEN_CLEANLINESS: "Kitchen Cleanliness",
  FOOD_SAFETY: "Food Safety",
  STAFF_COMPLIANCE: "Staff Compliance",
};

function ingredientNames(ids: readonly IngredientId[]): string {
  return ids.map((id) => INGREDIENTS[id]?.name ?? id).join(", ");
}

/** The fine V3-13 charges for a WARNING that follows a non-passing day — read from the fine rule itself, never hard-coded here. */
export function repeatedWarningFineAmount(): number {
  return determineInspectionFine("WARNING", "WARNING", Number.MAX_SAFE_INTEGER).fineAmount;
}

/**
 * The player-facing explanation of today's supplier event. "Supplier
 * Delay" only suspends an ACTIVE contract's discount — for a player with
 * no contract its catalog text ("your active contract's discount doesn't
 * apply") contradicts their situation, so it says plainly that nothing
 * changes for them. One helper, used by every screen that shows the event.
 */
export function supplierEventSummary(
  event: SupplierEventDefinition,
  hasActiveContract: boolean,
): string {
  if (event.suspendsContractDiscount && !hasActiveContract) {
    return "A contracted supplier's delivery is running late, so contract discounts don't apply today. You have no contract, so your prices are unaffected.";
  }
  return event.description;
}

/** The fine V3-13 charges for any FAIL — read from the fine rule itself. */
export function failFineAmount(): number {
  return determineInspectionFine("FAIL", null, Number.MAX_SAFE_INTEGER).fineAmount;
}

/** The exact result the "End Business Day" button would produce right now — see file header. */
export function previewBusinessDayClose(save: SaveData): EndBusinessDayResult {
  return endBusinessDay(save);
}

/** Ingredients currently in stock that the existing perishability rules will sweep at the next day advance. */
export function stockSpoilingTonight(save: SaveData): IngredientId[] {
  const nextDay = save.business.calendar.businessDay + 1;
  return Object.values(save.business.inventory)
    .filter((e): e is NonNullable<typeof e> => !!e)
    .filter((e) => perishabilityStateFor(e.ingredientId, e.purchaseDay, nextDay) === "EXPIRED")
    .map((e) => e.ingredientId);
}

/** Ingredients already NEAR_EXPIRY today but not spoiling tonight. */
export function stockNearExpiry(save: SaveData): IngredientId[] {
  const day = save.business.calendar.businessDay;
  const tonight = new Set(stockSpoilingTonight(save));
  return Object.values(save.business.inventory)
    .filter((e): e is NonNullable<typeof e> => !!e)
    .filter(
      (e) =>
        !tonight.has(e.ingredientId) &&
        perishabilityStateFor(e.ingredientId, e.purchaseDay, day) === "NEAR_EXPIRY",
    )
    .map((e) => e.ingredientId);
}

/** How many ON-MENU Business Dishes the current usable (non-expired) stock can make (Economy V3 Phase 16 — off-menu dishes are never ordered, so they don't count). */
export function makeableDishCount(save: SaveData): number {
  const day = save.business.calendar.businessDay;
  return activeBusinessDishes(save.business.menuActivation).filter((dish) =>
    hasUsableIngredients(save.business.inventory, businessDishRequirements(dish), day),
  ).length;
}

export type SupplierOfferToday = {
  supplierId: string;
  name: string;
  terms: SupplierContractTerms;
  isCurrent: boolean;
  /** Effective price today for the reference ingredient at the offer's own minimum order. */
  effectivePrice: number;
};

export type SupplierMarketToday = {
  event: SupplierEventDefinition | null;
  /** True when today's event suspends an ACTIVE contract's discount. */
  contractDiscountSuspended: boolean;
  referenceBasePrice: number;
  referencePriceToday: number;
  offers: SupplierOfferToday[];
};

const REFERENCE_BASE_PRICE_CENTS = 100;

/** Today's supplier situation, computed only from the existing event/contract functions — shared by the Shop, Suppliers screen and Dashboard. */
export function supplierMarketToday(save: SaveData): SupplierMarketToday {
  const day = save.business.calendar.businessDay;
  const contract = save.business.supplierContract;
  const active = isContractActive(contract, day);
  const event = eventForDay(day);
  const referencePriceToday = eventAdjustedUnitCost(REFERENCE_BASE_PRICE_CENTS, event);
  const offers = getAllContractOffers().map(({ supplierId, terms }) => {
    const isCurrent = active && contract?.supplierId === supplierId;
    // Mirrors BusinessInventoryManager.purchaseIngredient's own formula
    // (event → contract discount unless suspended → staff discount).
    const contractCost = event?.suspendsContractDiscount
      ? referencePriceToday
      : effectiveUnitCost(
          referencePriceToday,
          isCurrent && contract
            ? contract
            : { ...terms, supplierId, contractStartDay: day, contractEndDay: day + 1 },
          day,
          terms.minimumOrder,
        );
    const effectivePrice = staffUnitCostDiscount(contractCost, save.business.staff.hiredRoles);
    return {
      supplierId,
      name: getSupplier(supplierId)?.name ?? supplierId,
      terms,
      isCurrent,
      effectivePrice,
    };
  });
  return {
    event,
    contractDiscountSuspended: !!event?.suspendsContractDiscount && active,
    referenceBasePrice: REFERENCE_BASE_PRICE_CENTS,
    referencePriceToday,
    offers,
  };
}

export type CurrentOrderRef = { orderId: string; recipeId: string } | null;

const SEVERITY_RANK: Record<BusinessAlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  ok: 3,
};

/**
 * Every operational alert for the restaurant right now, most urgent
 * first. Deterministic: the same save (and current order) always
 * produces the same list.
 */
export function businessAlertsFor(
  save: SaveData,
  currentOrder: CurrentOrderRef = null,
): BusinessAlert[] {
  const alerts: BusinessAlert[] = [];
  const day = save.business.calendar.businessDay;
  const credits = save.credits;

  // Refrigerator (V3-10/V3-11) — the existing maintenance status bands only.
  const condition = save.business.equipmentCondition.refrigeratorCondition;
  const fridgeStatus = maintenanceStatusFor(condition);
  if (fridgeStatus !== "OPERATIONAL") {
    const cost = maintenanceCostFor(condition) ?? 0;
    const broken = fridgeStatus === "BROKEN";
    alerts.push({
      key: `fridge:${fridgeStatus}`,
      severity: broken ? "critical" : "warning",
      title: broken ? "Refrigerator Broken" : "Refrigerator Needs Service",
      detail:
        `Condition ${condition}/100. ` +
        (broken
          ? "Spoilage and reputation are taking a real hit until it's repaired."
          : "Wear is already nudging spoilage and reputation.") +
        ` Repair ${formatUsd(cost)} restores it to 100.` +
        (credits < cost ? " Not enough cash for the repair right now." : ""),
      action: { kind: "repair-refrigerator", label: `Repair · ${formatUsd(cost)}` },
      notify: true,
    });
  }

  // Inspection (V3-12) + fine (V3-13) exactly as End Business Day would
  // assess them — the preview runs the real, pure day-close on a snapshot.
  const closePreview = previewBusinessDayClose(save);
  const report = closePreview.inspectionReport;
  if (report.overall !== "PASS") {
    const fine = closePreview.inspectionFine;
    const problems = report.categories
      .filter((c) => c.result !== "PASS")
      .map((c) => `${INSPECTION_CATEGORY_LABEL[c.category]} (${c.result})`)
      .join(", ");
    const fineText =
      report.overall === "FAIL"
        ? `A FAIL at End Business Day is fined ${formatUsd(fine.fineAmount)}.`
        : fine.fineAmount > 0
          ? `The last inspection was also non-passing — a repeated WARNING is fined ${formatUsd(fine.fineAmount)}.`
          : `A first WARNING isn't fined, but a second non-passing day in a row is fined ${formatUsd(repeatedWarningFineAmount())}.`;
    alerts.push({
      key: `inspection:${report.overall}`,
      severity: report.overall === "FAIL" ? "critical" : "warning",
      title: report.overall === "FAIL" ? "Inspection Would Fail" : "Inspection Warning",
      detail: `${problems}. ${fineText}`,
      action: { kind: "navigate", label: "View Inspection", screen: "business-inspections" },
      notify: true,
    });
  }

  // Perishability (V3-4).
  const spoilingTonight = stockSpoilingTonight(save);
  if (spoilingTonight.length > 0) {
    alerts.push({
      key: `spoil-tonight:${day}:${[...spoilingTonight].sort().join(",")}`,
      severity: "warning",
      title: "Stock Spoils Tonight",
      detail: `${ingredientNames(spoilingTonight)} will be discarded at End Business Day. Use it in orders today.`,
      action: { kind: "navigate", label: "View Inventory", screen: "business-inventory" },
      notify: true,
    });
  }
  const nearExpiry = stockNearExpiry(save);
  if (nearExpiry.length > 0) {
    alerts.push({
      key: `near-expiry:${day}:${[...nearExpiry].sort().join(",")}`,
      severity: "info",
      title: "Nearing Expiry",
      detail: `${ingredientNames(nearExpiry)} — best used soon. Holding stock this close to its shelf life shows up as an Ingredient Expiry WARNING at inspection, and a WARNING two days running is fined ${formatUsd(repeatedWarningFineAmount())}.`,
      action: { kind: "navigate", label: "View Inventory", screen: "business-inventory" },
      notify: false,
    });
  }

  // Order availability (V3-14's own accept gate).
  const currentDish = currentOrder ? businessDishForRecipeId(currentOrder.recipeId) : undefined;
  if (currentOrder && currentDish) {
    const availability = businessOrderAvailability(save, currentDish);
    if (!availability.available) {
      const missing = availability.missing;
      alerts.push({
        key: `order-blocked:${currentOrder.orderId}`,
        severity: "warning",
        title: "Current Order Blocked",
        detail: `A customer wants ${currentDish.name} — missing ${ingredientNames(missing)}. It can't be accepted until you restock.`,
        action: { kind: "rush-restock", label: "Restock" },
        notify: true,
      });
    }
  }
  const makeable = makeableDishCount(save);
  const menuSize = activeBusinessDishes(save.business.menuActivation).length;
  alerts.push(
    makeable === 0
      ? {
          key: "no-dishes",
          severity: "warning",
          title: "No Dish Can Be Made",
          detail: `Your usable stock can't make any of the ${menuSize} dishes on your menu — no customer can be served until you restock. You can buy as little as one unit, and a smaller menu needs fewer different ingredients.`,
          action: { kind: "navigate", label: "Restock in Market", screen: "shop-ingredients" },
          notify: true,
        }
      : {
          key: "dishes-available",
          severity: "ok",
          title: "Menu Ready",
          detail: `${makeable} of the ${menuSize} dishes on your menu can be made from current stock.`,
          action: { kind: "navigate", label: "Open Service", screen: "business-service" },
          notify: false,
        },
  );

  // Supplier events (V3-8) and contracts (V3-7).
  const market = supplierMarketToday(save);
  if (market.event) {
    const pct = Math.round(market.event.priceModifier * 100);
    alerts.push({
      key: `supplier-event:${day}:${market.event.id}`,
      severity: market.contractDiscountSuspended ? "warning" : "info",
      title: market.contractDiscountSuspended
        ? `${market.event.name} — Contract Discount Suspended`
        : `Supplier Event: ${market.event.name}`,
      detail:
        `${supplierEventSummary(market.event, isContractActive(save.business.supplierContract, day))}` +
        (pct !== 0 ? ` Prices ${pct > 0 ? "+" : ""}${pct}% today.` : "") +
        (market.event.maxPurchaseQuantity !== undefined
          ? ` Purchases capped at ${market.event.maxPurchaseQuantity} per order.`
          : ""),
      action: { kind: "navigate", label: "Manage Suppliers", screen: "business-suppliers" },
      notify: true,
    });
  }
  const contract = save.business.supplierContract;
  if (contract && isContractActive(contract, day) && !isContractActive(contract, day + 1)) {
    alerts.push({
      key: `contract-ends:${contract.supplierId}:${contract.contractEndDay}`,
      severity: "info",
      title: "Supplier Contract Ends Tonight",
      detail: `Your ${getSupplier(contract.supplierId)?.name ?? contract.supplierId} contract ends at End Business Day (no fee for letting it run out).`,
      action: { kind: "navigate", label: "Manage Suppliers", screen: "business-suppliers" },
      notify: false,
    });
  }

  // Staff / payroll (V3-9).
  const hired = save.business.staff.hiredRoles;
  if (hired.length > 0) {
    const payroll = dailyPayroll(hired);
    alerts.push(
      credits < payroll
        ? {
            key: "payroll-unaffordable",
            severity: "critical",
            title: "Payroll Can't Be Covered",
            detail: `Today's payroll is ${formatUsd(payroll)} but you have ${formatUsd(credits)}. If that's still true at End Business Day, the whole staff is let go.`,
            action: { kind: "navigate", label: "Manage Staff", screen: "business-staff" },
            notify: true,
          }
        : {
            key: "payroll-ok",
            severity: "ok",
            title: "Staff",
            detail: `${hired.length} on staff · ${formatUsd(payroll)} payroll due at End Business Day.`,
            action: { kind: "navigate", label: "Manage Staff", screen: "business-staff" },
            notify: false,
          },
    );
  }

  return alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/** Alerts whose condition just appeared (not present in `previousKeys`) and deserve a banner. */
export function newlyRaisedAlerts(
  previousKeys: ReadonlySet<string>,
  alerts: readonly BusinessAlert[],
): BusinessAlert[] {
  return alerts.filter((a) => a.notify && !previousKeys.has(a.key));
}

export function alertKeys(alerts: readonly BusinessAlert[]): Set<string> {
  return new Set(alerts.map((a) => a.key));
}
