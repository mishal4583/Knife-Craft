/**
 * BUSINESS_STAFF_MANAGER — Economy V3 Phase 9. The two staff actions,
 * mirroring BusinessSupplierManager's own shape exactly. Both are free —
 * hiring moves no money (the real, recurring cost is the daily payroll
 * BusinessDayManager deducts); firing is a voluntary exit with no fee at
 * all (unlike a supplier contract's cancellationFee — an employee isn't
 * under a fixed-term contract). Neither ever touches the ledger; App.tsx
 * mirrors that (no `appendLedgerEntry` call for either action).
 */
import type { SaveData } from "../SaveManager";
import { getStaffDefinition, type BusinessStaffRole } from "./businessStaff";

export type HireStaffResult =
  | { ok: true; save: SaveData; role: BusinessStaffRole }
  | { ok: false; reason: "unknownRole" | "alreadyHired" };

/** Atomic: either the role is added to `hiredRoles`, or nothing changes at all. */
export function hireStaff(save: SaveData, role: string): HireStaffResult {
  const def = getStaffDefinition(role);
  if (!def) return { ok: false, reason: "unknownRole" };
  if (save.business.staff.hiredRoles.includes(def.role)) {
    return { ok: false, reason: "alreadyHired" };
  }
  return {
    ok: true,
    save: {
      ...save,
      business: {
        ...save.business,
        staff: { hiredRoles: [...save.business.staff.hiredRoles, def.role] },
      },
    },
    role: def.role,
  };
}

export type FireStaffResult =
  { ok: true; save: SaveData; role: BusinessStaffRole } | { ok: false; reason: "notHired" };

/** Atomic: either the role is removed from `hiredRoles`, or nothing changes at all. */
export function fireStaff(save: SaveData, role: string): FireStaffResult {
  const def = getStaffDefinition(role);
  if (!def || !save.business.staff.hiredRoles.includes(def.role)) {
    return { ok: false, reason: "notHired" };
  }
  return {
    ok: true,
    save: {
      ...save,
      business: {
        ...save.business,
        staff: { hiredRoles: save.business.staff.hiredRoles.filter((r) => r !== def.role) },
      },
    },
    role: def.role,
  };
}
