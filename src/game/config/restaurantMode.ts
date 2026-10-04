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
 *    QA exercises them whatever the switch says;
 *  - it stays false until every phase, the save migration, the economy
 *    pass, QA and real-device testing are done and the developer approves.
 *
 * Build-controlled: a normal build (`npm run build`, every release) has it
 * OFF. Only a test build made with `VITE_RESTAURANT_MODE=1 npm run build`
 * turns it on, so the restaurant can be played in the browser tests before
 * release. Vite inlines the value, so a release bundle carries `false`.
 * Outside Vite (tsx QA scripts) `import.meta.env` is absent: off. (Vite only
 * substitutes the plain `import.meta.env.VITE_…` form, never `?.`.)
 */
export const RESTAURANT_MODE: boolean =
  typeof import.meta.env !== "undefined" && import.meta.env.VITE_RESTAURANT_MODE === "1";
