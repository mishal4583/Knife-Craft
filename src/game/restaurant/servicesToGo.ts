/**
 * Unlock wording in services (Phase 1, developer 2026-10-30; see nextService.ts): a feature that
 * opens at level N is open once the furthest level reached is N, so N − reached first services
 * are still to play. No imports, so every game module can use it.
 */

/** First services still to play before something that opens at `openLevel` (0 = open now). */
export function servicesLeft(openLevel: number, reached: number): number {
  return Math.max(0, Math.round(openLevel) - Math.round(reached));
}

/** "this service" / "after the next service" / "in 3 services" (after "opens", "unlocks", "pass X", …). */
export function opensInText(openLevel: number, reached: number): string {
  const n = servicesLeft(openLevel, reached);
  return n === 0 ? "this service" : n === 1 ? "after the next service" : `in ${n} services`;
}

/** A short lock badge: "🔒 next service" / "🔒 3 services". */
export function lockBadge(openLevel: number, reached: number): string {
  const n = servicesLeft(openLevel, reached);
  return n <= 1 ? "🔒 next service" : `🔒 ${n} services`;
}
