/**
 * RESTAURANT_MODE — the ONE build-time switch for the Unified Restaurant
 * (docs/RESTAURANT_INTEGRATION_AUDIT.md; developer decision 2026-10-04).
 *
 * false: the game plays exactly as before (Campaign, Business Mode, Endless
 * and Today's Special as separate modes).
 * true: Campaign and Business are one restaurant: campaign orders use real
 * stock, systems unlock by level, Business is the restaurant's management
 * UI, and Endless Restaurant Service follows Level 250.
 *
 * Rules:
 *  - this is the only restaurant feature flag; never add a second one;
 *  - it is an engineering switch, never a player-facing setting;
 *  - only wiring (App, router, screens) reads it. The restaurant modules in
 *    src/game/restaurant/ are pure and take their inputs as parameters, so
 *    QA exercises them whatever the switch says.
 *
 * ON BY DEFAULT (developer decision 2026-10-08: the unified restaurant is
 * the game). Every build — `npm run build`, GitHub Pages, Playgama zips —
 * has it ON. A classic build (the old separate Campaign / Business Mode /
 * Endless Service) is made with `VITE_RESTAURANT_MODE=0 npm run build`; the
 * classic browser tests use one. Vite inlines the value. Outside Vite (tsx
 * QA scripts) `import.meta.env` is absent: off, so the scripts keep testing
 * the classic paths and the restaurant modules as pure functions. (Vite
 * only substitutes the plain `import.meta.env.VITE_…` form, never `?.`.)
 */
export const RESTAURANT_MODE: boolean =
  typeof import.meta.env !== "undefined" && import.meta.env.VITE_RESTAURANT_MODE !== "0";
