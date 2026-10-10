// The `Knife` type + `KNIVES` mock array used to live here (owned/price/
// stats hardcoded per entry, disconnected from SaveManager). Phase 8
// replaced it with one authoritative catalog — see
// src/game/knives/knifeDefinitions.ts (KNIFE_CATALOG) — which the
// Workshop/Shop screens now read directly, with real ownership coming
// from SaveData.ownedKnifeIds instead of a static `owned: boolean`.

// The `Board` type + `BOARDS` mock array used to live here (owned/price
// hardcoded per entry, disconnected from SaveManager) — the exact same
// pattern the old `Knife`/`KNIVES` mock had. Phase 9 replaced it with one
// authoritative catalog — see src/game/boards/boardDefinitions.ts
// (BOARD_CATALOG) — which Boards.tsx/Shop.tsx now read directly, with
// real ownership coming from SaveData.ownedBoardIds.

// The `Recipe` type + `RECIPES`/`RECIPE_CATEGORIES` mock arrays used to
// live here (fake dishes like "Herb Focaccia" with hand-picked `best`/
// `done` values, disconnected from real level data). Phase 12B replaced
// them with a real derived view over the existing level catalog — see
// src/game/levels/recipeBook.ts (getRecipeBookEntries/
// getRecipeBookCategories) — which Recipes.tsx/Journal.tsx now read
// directly, with real progress coming from SaveData.recipeProgress.

// The `MILESTONES` mock array used to live here (hand-picked `done`
// booleans and invented labels like "Chiffonade"/"Sushi chapter" that
// don't correspond to any real technique/chapter). Phase 12C replaced it
// — progression is now shown on Restaurant Progress (screen id "rack"),
// whose milestones are all derived from the save by
// src/game/progression/restaurantProgress.ts. The separate Chef's Journey
// screen was merged into it so there is one progression screen.

// DECOR_CATEGORIES/DECOR_ITEMS (a mock kitchen-decor shelf with hardcoded
// `owned` booleans, never backed by SaveManager) and ACHIEVEMENTS (a mock
// list with hardcoded `done` booleans) lived here — Phase 15 removed
// their only entry points (the old Journal hub and Shop's decor shelf)
// as part of consolidating navigation down to Kitchen/Shop/Rack, and
// since neither was ever a real, save-backed system, the mock data went
// with them rather than being carried into a screen with nowhere left to
// live. Nothing else referenced either array.

export type ScreenId =
  | "gameplay"
  | "kitchen"
  | "board"
  | "kitchen-upgrades"
  | "recipes"
  | "recipe-detail"
  | "daily"
  | "endless"
  | "shop"
  // The Market opened on its Ingredients tab (Business → "Go to Market" /
  // "Buy in Market →", see marketFocus.ts). Same Shop screen, different
  // starting category.
  | "shop-ingredients"
  // The Market opened on one of its supply sections (Inventory → Supplies →
  // "Restock", see marketFocus.ts openMarketSupplies).
  | "shop-supplies"
  | "rack"
  // Inventory — the restaurant's stock control, its own bottom-bar section
  // between Market and Business (InventoryScreen.tsx). Read-only over
  // save.business.inventory; buying stays in the Market.
  | "inventory"
  // Inventory opened on Supplies (smallwares, tableware & cutlery, takeaway
  // parcels) — the same screen, other kind of stock. Bought in the Market.
  | "inventory-supplies"
  | "settings"
  // Economy V3 Phase 1 — the Business Simulation layer's own entry point.
  // A real bottom-nav destination (mirrors Kitchen/Shop/Rack), not a
  // Kitchen hotspot: over the next 13 phases this screen accretes its
  // own sections (inventory, refrigerator, menu, suppliers, staff,
  // equipment, inspections, P&L) exactly the way Shop.tsx grew section
  // by section across Economy V2, rather than becoming a second app.
  | "business"
  // Economy V3 Phase 3 — the Refrigerator sub-screen under Business.
  | "business-refrigerator"
  // Economy V3 Phase 5 — the Menu Pricing sub-screen under Business.
  | "business-menu"
  // Economy V3 Phase 7 — the Supplier Contracts sub-screen under Business.
  | "business-suppliers"
  // Economy V3 Phase 9 — the Staff sub-screen under Business.
  | "business-staff"
  // Economy V3 Phase 12 — the Inspections sub-screen under Business.
  | "business-inspections"
  | "business-cleanliness"
  // Economy V3 Phase 14 (Checkpoint 3) — the Service sub-screen under
  // Business: shows the current Business order (a real curated dish),
  // its live menu price, and ingredient availability, gated into the
  // SAME "gameplay" Preparation flow every other service mode already
  // uses once the player taps "Start Preparing" (see App.tsx's own
  // `sessionMode === "business-service"` wiring).
  | "business-service"
  // Economy V3 Phase 14 (Checkpoint 5) — the categorized Business Shop:
  // one overview hub (equipped knife/board, refrigeration, staff,
  // suppliers) answering "why should I spend this money" for every real
  // Business Mode investment, with links into the existing detail
  // screens (business-refrigerator/business-staff/business-suppliers)
  // for the deeper management flows — never a duplicate transaction
  // engine.
  | "business-shop"
  // Economy V3 Phase 14 (Checkpoint... V3-15) — the Business Mode P&L
  // screen: today's live accumulator, the most recently completed
  // Business Day's full reconciled P&L, and lifetime figures computed
  // directly from the existing economyLedger — see
  // BusinessFinanceManager.ts's own doc.
  | "business-finance";
