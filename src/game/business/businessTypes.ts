/**
 * BUSINESS_TYPES — Economy V3's own persisted-state container. A single
 * new field on SaveData (`business: BusinessState`), mirroring how every
 * other self-contained feature already gets exactly one nested object
 * (`levelProgress`, `story`, `dailyOrder`, `endless`) rather than a
 * flat spray of top-level SaveData fields. Economy V3 spans 14 phases
 * (calendar, inventory, refrigerator, perishability, menu pricing,
 * popularity, supplier contracts/events, staff expansion, equipment
 * condition, maintenance, inspections, fines, business P&L) — each adds
 * its own field to `BusinessState` below, never a new top-level SaveData
 * field, so SaveData itself stays exactly as stable as it is today.
 *
 * Business Mode is a SEPARATE layer from Campaign — nothing here is
 * read by campaign settlement (EconomySettlement.ts), campaign payout
 * wiring, or the 250-level economy simulation. See businessCalendar.ts's
 * own doc for why the calendar in particular never touches
 * `levelProgress`.
 */
import { DEFAULT_BUSINESS_CALENDAR, type BusinessCalendar } from "./businessCalendar";
import { DEFAULT_BUSINESS_INVENTORY, type BusinessInventory } from "./businessInventory";
import { DEFAULT_REFRIGERATOR_ID } from "./refrigeratorDefinitions";
import type { BusinessRefrigeratorState } from "./refrigeratorTypes";
import { DEFAULT_SPOILAGE_STATE, type BusinessSpoilageState } from "./SpoilageManager";
import { DEFAULT_BUSINESS_MENU, type BusinessMenu } from "./businessMenu";
import { DEFAULT_POPULARITY_STATE, type BusinessPopularityState } from "./businessPopularity";
import {
  DEFAULT_SUPPLIER_CONTRACT_STATE,
  type BusinessSupplierContractState,
} from "./businessSupplierContract";
import { DEFAULT_STAFF_STATE, type BusinessStaffState } from "./businessStaff";
import {
  DEFAULT_EQUIPMENT_CONDITION_STATE,
  type BusinessEquipmentConditionState,
} from "./businessEquipmentCondition";
import {
  DEFAULT_INSPECTION_FINE_STATE,
  type BusinessInspectionFineState,
} from "./businessInspectionFines";
import {
  DEFAULT_BUSINESS_FINANCE_STATE,
  type BusinessFinanceState,
} from "./BusinessFinanceManager";
import {
  DEFAULT_MENU_ACTIVATION_STATE,
  type BusinessMenuActivationState,
} from "./businessMenuActivation";
import { defaultSuppliesState, type BusinessSuppliesState } from "./businessSupplies";

export type BusinessState = {
  calendar: BusinessCalendar;
  /** Economy V3 Phase 2 — physical restaurant stock, Business Mode only. See businessInventory.ts's own doc. */
  inventory: BusinessInventory;
  /** Economy V3 Phase 3 — which refrigerator is currently owned/active. See refrigeratorTypes.ts's own doc for why this never duplicates inventory quantities. */
  refrigerator: BusinessRefrigeratorState;
  /** Economy V3 Phase 4 — lifetime spoilage totals. See SpoilageManager.ts's own doc. */
  spoilage: BusinessSpoilageState;
  /** Economy V3 Phase 5 — player-set prices for existing recipes, Business Mode only. See businessMenu.ts's own doc. */
  menu: BusinessMenu;
  /** Economy V3 Phase 6 — the 0-100 reputation score. See businessPopularity.ts's own doc. */
  popularity: BusinessPopularityState;
  /** Economy V3 Phase 7 — the active supplier contract, if any. See businessSupplierContract.ts's own doc for why this never duplicates the existing supplier catalog. */
  supplierContract: BusinessSupplierContractState;
  /** Economy V3 Phase 9 — hired Business Mode employees, if any. See businessStaff.ts's own doc for why this is a separate catalog from Campaign's own staff system. */
  staff: BusinessStaffState;
  /** Economy V3 Phase 10 — the refrigerator's own 0-100 condition. See businessEquipmentCondition.ts's own doc for why this is a separate mechanic from Campaign's own knife sharpness. */
  equipmentCondition: BusinessEquipmentConditionState;
  /** Economy V3 Phase 13 — yesterday's own inspection result, the one piece of state needed to detect a "repeated" violation. See businessInspectionFines.ts's own doc. */
  inspectionFines: BusinessInspectionFineState;
  /** Economy V3 Phase 15 — the Business Mode P&L's own two pieces of state that the existing ledger structurally cannot hold (a per-Business-Day accumulator, and lifetime non-cash COGS). See BusinessFinanceManager.ts's own doc. */
  finance: BusinessFinanceState;
  /** Economy V3 Phase 16 — which Business Dishes are ON the menu (orders are generated only from these). See businessMenuActivation.ts's own doc for why this is not stored inside `menu`. */
  menuActivation: BusinessMenuActivationState;
  /** Business Supplies (master spec §25, a separately authorized extension — not an Economy V3 phase): culinary smallwares, tableware and takeaway packaging bought in the Market. See businessSupplies.ts's own doc for why this is not part of `inventory`. */
  supplies: BusinessSuppliesState;
};

export const DEFAULT_BUSINESS_STATE: BusinessState = {
  calendar: { ...DEFAULT_BUSINESS_CALENDAR },
  inventory: { ...DEFAULT_BUSINESS_INVENTORY },
  refrigerator: { refrigeratorId: DEFAULT_REFRIGERATOR_ID },
  spoilage: { ...DEFAULT_SPOILAGE_STATE },
  menu: { ...DEFAULT_BUSINESS_MENU },
  popularity: { ...DEFAULT_POPULARITY_STATE },
  supplierContract: DEFAULT_SUPPLIER_CONTRACT_STATE,
  staff: { hiredRoles: [...DEFAULT_STAFF_STATE.hiredRoles] },
  equipmentCondition: { ...DEFAULT_EQUIPMENT_CONDITION_STATE },
  inspectionFines: { ...DEFAULT_INSPECTION_FINE_STATE },
  finance: {
    dailyAccumulator: { ...DEFAULT_BUSINESS_FINANCE_STATE.dailyAccumulator },
    lifetimeCogs: DEFAULT_BUSINESS_FINANCE_STATE.lifetimeCogs,
    lastDailyPnL: DEFAULT_BUSINESS_FINANCE_STATE.lastDailyPnL,
    lifetime: { ...DEFAULT_BUSINESS_FINANCE_STATE.lifetime },
  },
  menuActivation: { inactiveDishIds: [...DEFAULT_MENU_ACTIVATION_STATE.inactiveDishIds] },
  supplies: defaultSuppliesState(),
};
