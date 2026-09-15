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
// — Chef's Journey now reads the 5 real chapter-transition milestones
// already authored on LEVELS (LevelDefinition.milestone, at Level
// 10/20/30/40/50 — the same field OrderBoard already reads), with
// unlock state coming from LevelManager.isCompleted, not a static flag.
// See Journal.tsx's Progression component.

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
  | "progression"
  | "recipes"
  | "recipe-detail"
  | "daily"
  | "endless"
  | "shop"
  | "rack"
  | "settings"
  // Phase 18A — dev/QA only, reachable only from Settings and only when
  // QA_MODE is on (see IngredientLab.tsx's own doc) — never part of the
  // real player-facing navigation graph.
  | "ingredient-lab";
