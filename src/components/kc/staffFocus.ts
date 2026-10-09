import type { ScreenId } from "./data";

/**
 * Pre-Service Check → Restaurant → Staff (developer 2026-10-09: "doesn't
 * show which staff to hire"). `go` only takes a screen id, so the roles the
 * service is missing are handed over here: the Staff screen reads them when
 * it opens, scrolls to the Restaurant Team and marks those cards. Navigation
 * state only — never saved.
 */
let pending: readonly string[] | null = null;

/** `ids`: role ids or specialist chef ids (StaffRequirement.id). */
export function openStaffFor(go: (s: ScreenId) => void, ids: readonly string[]) {
  pending = ids.length > 0 ? [...ids] : null;
  go("business-staff");
}

export function peekStaffFocus(): readonly string[] | null {
  return pending;
}

export function clearStaffFocus() {
  pending = null;
}
