import type { ScreenId } from "../data";

export type BusinessTab =
  | "overview"
  | "equipment"
  | "staff"
  | "suppliers"
  | "menu"
  | "operations"
  // Restaurant build, from CLEANING_FROM_LEVEL (restaurant/cleanliness.ts).
  | "cleanliness";

/**
 * The Business screen ids (existing routes) and the tab each one opens.
 * Tabs navigate by screen id, so every existing `go("business-…")` — alert
 * actions, the Market's pantry link, the service counter's back button —
 * lands on the right tab. There are no separate old screens any more.
 */
export const BUSINESS_TAB_SCREEN: Record<BusinessTab, ScreenId> = {
  overview: "business",
  equipment: "business-refrigerator",
  staff: "business-staff",
  suppliers: "business-suppliers",
  menu: "business-menu",
  operations: "business-inspections",
  cleanliness: "business-cleanliness",
};

export function businessTabForScreen(screen: ScreenId): BusinessTab | null {
  switch (screen) {
    case "business":
      return "overview";
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
    case "business-cleanliness":
      return "cleanliness";
    default:
      return null;
  }
}
