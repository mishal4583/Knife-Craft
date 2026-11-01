/**
 * When cleaning starts: its tasks, the shift chores (the morning's opening chores, the lull between services and
 * the night's closing chores), the spotless streak, the Cleanliness page and the day ceremony (the opening card and
 * Closing Time). A leaf module, so firstLevels.ts and cleanliness.ts can both read it without importing each other.
 *
 * It was Level 5 (developer 2026-10-29); the developer moved it to DAY 2 (2026-11-01: "at day 2 night there are no
 * cleaning chores, bring them, and the service time cleaning and the morning chores"). A restaurant day is two
 * services (Lunch, Dinner), so Day 2 is Levels 3-4: Level 3 is its morning, Level 4 its night.
 */
export const CLEANING_FROM_LEVEL = 3;
