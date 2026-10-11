/**
 * THE DAY CLOCK (developer 2026-10-11: "improve the day and night setting
 * according to this" — a real restaurant's day: opening → services with a
 * lull between them → closing). Read-only, derived from the restaurant day
 * (`restaurantDay.ts`) and the day's schedule (`servicesForDayAt`) — no
 * clock is stored and nothing here changes the save.
 *
 *   opening   the day hasn't opened yet: the next level opens it (prepare);
 *   lull      between two services of an open day (reset);
 *   closing   the day's last service is done: Closing Time (clean and plan);
 *
 * The weekday comes from the restaurant day (Day 1 = Monday, a 7-day week —
 * businessCalendar's own names). The light is the time of day of the next
 * service (Breakfast = dawn … Late Supper = late evening), night at closing.
 * Pure; nothing reads RESTAURANT_MODE.
 */
import type { SaveData } from "../SaveManager";
import { dayOfWeekFor } from "../business/businessCalendar";
import { restaurantDayOf } from "./restaurantDay";
import { servicesForDayAt } from "./restaurantProgression";
import { deepCleansFor } from "./cleanliness";
import { AUDIT_FROM, isAuditDay } from "./parAudit";

export type DayPhase = "opening" | "lull" | "closing";

/** The light over the kitchen: the time of day of the next service, night at closing. */
export type DayLight = "dawn" | "morning" | "midday" | "afternoon" | "evening" | "late" | "night";

/** Each service's time of day (an unknown name is midday). */
export const SERVICE_LIGHT: Record<string, DayLight> = {
  Breakfast: "dawn",
  Brunch: "morning",
  Lunch: "midday",
  "Afternoon Tea": "afternoon",
  Dinner: "evening",
  "Late Supper": "late",
};

/** Each service's icon on the day strip. */
export const SERVICE_ICON: Record<string, string> = {
  Breakfast: "🌅",
  Brunch: "🥐",
  Lunch: "☀️",
  "Afternoon Tea": "🫖",
  Dinner: "🌆",
  "Late Supper": "🌙",
};

export type DayClock = {
  day: number;
  /** "Monday" … "Sunday". */
  weekday: string;
  /** Week of the restaurant's life (Day 1–7 = week 1). */
  week: number;
  phase: DayPhase;
  /** The day's services, in order (fixed when the day opened). */
  services: readonly string[];
  /** The next service (null at closing). */
  next: { name: string; index: number } | null;
  servicesDone: number;
  light: DayLight;
  /** Today's closing brings a deep clean (cleanliness.ts, the week's last day / the audit day). */
  deepClean: boolean;
  /** Today is a par audit day (parAudit.ts; the opening card counts the stock). */
  audit: boolean;
};

/** Where the restaurant's day stands (`restaurantLevel`: the next level to play). */
export function dayClockFor(save: SaveData, restaurantLevel: number): DayClock {
  const d = restaurantDayOf(save);
  const start = d.opened || d.closingDue ? (d.openingLevel ?? restaurantLevel) : restaurantLevel;
  const all = servicesForDayAt(start);
  const services = d.opened || d.closingDue ? all.slice(0, d.servicesPlanned || all.length) : all;
  const phase: DayPhase = d.closingDue
    ? "closing"
    : d.opened && d.servicesDone > 0
      ? "lull"
      : "opening";
  const nextIndex = phase === "closing" ? -1 : d.opened ? d.servicesDone : 0;
  const nextName = nextIndex >= 0 ? (services[nextIndex] ?? null) : null;
  return {
    day: d.day,
    weekday: dayOfWeekFor(d.day),
    week: Math.floor((d.day - 1) / 7) + 1,
    phase,
    services,
    next: nextName ? { name: nextName, index: nextIndex + 1 } : null,
    servicesDone: d.servicesDone,
    light: phase === "closing" || !nextName ? "night" : (SERVICE_LIGHT[nextName] ?? "midday"),
    deepClean: deepCleansFor(d.day, start).length > 0,
    audit: start >= AUDIT_FROM && isAuditDay(d.day),
  };
}

/** The day strip's line, e.g. "Day 12 · Tue · ☀️ Lunch next (2/4)". */
export function dayStripText(c: DayClock): string {
  const head = `Day ${c.day} · ${c.weekday.slice(0, 3)}`;
  // The day's extra jobs: the par audit (opening) and the deep clean (closing).
  const extra =
    (c.audit && c.phase === "opening" ? " · 📋 Par audit" : "") +
    (c.deepClean ? (c.phase === "closing" ? " · 🧽 Deep clean" : " · 🧽 Deep clean tonight") : "");
  if (c.phase === "closing") return `${head} · 🌙 Closing time${extra}`;
  if (!c.next) return head + extra;
  const icon = SERVICE_ICON[c.next.name] ?? "🍽️";
  return c.phase === "opening"
    ? `${head} · ${icon} Opening: ${c.next.name} first (${c.services.length} services)${extra}`
    : `${head} · ${icon} ${c.next.name} next (${c.next.index}/${c.services.length})${extra}`;
}
