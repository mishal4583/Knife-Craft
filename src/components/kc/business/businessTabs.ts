import type { ScreenId } from "../data";

export type BusinessTab =
  "overview" | "supplies" | "equipment" | "staff" | "suppliers" | "menu" | "operations";

/**
 * The Business screen ids (existing routes) and the tab each one opens.
 * Tabs navigate by screen id, so every existing `go("business-…")` — alert
 * actions, the Market's pantry link, the service counter's back button —
 * lands on the right tab. There are no separate old screens any more.
 */
export const BUSINESS_TAB_SCREEN: Record<BusinessTab, ScreenId> = {
  overview: "business",
  supplies: "business-supplies",
  equipment: "business-refrigerator",
  staff: "business-staff",
  suppliers: "business-suppliers",
  menu: "business-menu",
  operations: "business-inspections",
};

export function businessTabForScreen(screen: ScreenId): BusinessTab | null {
  switch (screen) {
    case "business":
      return "overview";
    case "business-supplies":
      return "supplies";
    case "business-refrigerator":
    case "business-shop":
      return "equipment";
    case "business-staff":
      return "staff";
    case "business-suppliers":
      return "suppliers";
    case "business-menu":
      return "menu";
    case "business-inspections":
    case "business-finance":
      return "operations";
    default:
      return null;
  }
}
