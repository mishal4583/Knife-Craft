/**
 * The Restaurant (Business) screens as ONE lazily loaded chunk (task #24):
 * the back office (Overview · Equipment · Staff · Suppliers · Menu ·
 * Operations), the Restaurant Service counter and Inventory (with the
 * physical fridge). ScreensRouter loads it the first time the player opens
 * one of them, so the Kitchen, the Order Board and the Market never carry
 * the restaurant's UI. Routes, props and behaviour are unchanged.
 */
export { BusinessDashboard } from "./business/BusinessDashboard";
export { BusinessService } from "./business/BusinessService";
export { InventoryScreen } from "./inventory/InventoryScreen";
