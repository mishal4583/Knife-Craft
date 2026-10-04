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
 */
export const RESTAURANT_MODE: boolean = false;
